import json
import re
import requests
from typing import List, Dict, Any
import email.message
from email import policy
from django.conf import settings
from .models import EmailFile, RuleGeneration


class SpamGenieService:
    """Service class for processing email files and generating SpamAssassin rules."""

    @staticmethod
    def parse_email(email_file: EmailFile) -> Dict[str, Any]:
        """Parse an email file and extract its headers and content."""
        with open(email_file.file.path, 'rb') as f:
            msg = email.message_from_bytes(f.read(), policy=policy.default)

        email_data = {
            'headers': dict(msg.items()),
            'body': SpamGenieService._get_email_body(msg),
            'file_name': email_file.original_filename
        }
        return email_data

    @staticmethod
    def _get_email_body(msg: email.message.EmailMessage) -> Dict[str, str]:
        """Extract both plain text and HTML body from the message."""
        body = {
            'plain': '',
            'html': ''
        }

        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_maintype() == 'multipart':
                    continue

                content_type = part.get_content_type()
                try:
                    content = part.get_payload(decode=True).decode()
                except (UnicodeDecodeError, AttributeError):
                    continue

                if content_type == 'text/plain':
                    body['plain'] += content
                elif content_type == 'text/html':
                    body['html'] += content
        else:
            # Handle non-multipart messages
            content_type = msg.get_content_type()
            try:
                content = msg.get_payload(decode=True).decode()
                if content_type == 'text/plain':
                    body['plain'] = content
                elif content_type == 'text/html':
                    body['html'] = content
            except (UnicodeDecodeError, AttributeError):
                pass

        return body

    @staticmethod
    def get_available_headers(email_files: List[EmailFile]) -> Dict[str, str]:
        """Get all available headers from the processed emails."""
        all_headers = {}

        for email_file in email_files:
            email_data = SpamGenieService.parse_email(email_file)
            for key, value in email_data['headers'].items():
                if key not in all_headers:
                    # Truncate long values for display
                    display_value = str(value)
                    if len(display_value) > 100:
                        display_value = display_value[:100] + "..."
                    all_headers[key] = display_value

        return all_headers

    @staticmethod
    def _extract_urls(html_content: str) -> List[str]:
        """Extract URLs from HTML content."""
        url_pattern = r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+'
        return list(set(re.findall(url_pattern, html_content)))

    @staticmethod
    def _extract_common_phrases(text: str) -> List[str]:
        """Extract potentially suspicious phrases from text."""
        # Split into sentences and clean
        sentences = re.split(r'[.!?]+', text)
        return [s.strip() for s in sentences if len(s.strip()) > 10][:5]

    @staticmethod
    def _analyze_html_formatting(html_content: str) -> Dict[str, Any]:
        """Analyze HTML formatting patterns."""
        return {
            'has_images': bool(re.search(r'<img.*?>', html_content)),
            'has_links': bool(re.search(r'<a.*?href=.*?>', html_content)),
            'has_tables': bool(re.search(r'<table.*?>', html_content)),
            'has_hidden_content': bool(
                re.search(r'display:\s*none|visibility:\s*hidden', html_content)
            )
        }

    @staticmethod
    def _extract_common_patterns(analysis_data: List[Dict]) -> Dict[str, Any]:
        """Extract common patterns from the analyzed emails."""
        patterns = {
            'header_patterns': {},
            'body_patterns': {
                'common_phrases': [],
                'url_patterns': [],
                'formatting_patterns': []
            }
        }

        # Analyze headers
        for mail_data in analysis_data:
            for header, value in mail_data['headers'].items():
                if header not in patterns['header_patterns']:
                    patterns['header_patterns'][header] = []
                patterns['header_patterns'][header].append(value)

        # Analyze body content
        for mail_data in analysis_data:
            # Extract URLs
            urls = SpamGenieService._extract_urls(mail_data['body']['html'])
            patterns['body_patterns']['url_patterns'].extend(urls)

            # Extract common phrases
            phrases = SpamGenieService._extract_common_phrases(mail_data['body']['plain'])
            patterns['body_patterns']['common_phrases'].extend(phrases)

            # Analyze HTML formatting
            if mail_data['body']['html']:
                formatting = SpamGenieService._analyze_html_formatting(mail_data['body']['html'])
                patterns['body_patterns']['formatting_patterns'].append(formatting)

        return patterns

    @staticmethod
    def generate_prompt(rule_generation: RuleGeneration) -> str:
        """Generate a detailed prompt for Gemini API based on selected keys and email content."""
        selected_keys = rule_generation.selected_headers
        email_files = rule_generation.email_files.all()

        analysis_data = []
        for email_file in email_files:
            email_data = SpamGenieService.parse_email(email_file)
            filtered_data = {
                'headers': {k: email_data['headers'].get(k, '') for k in selected_keys},
                'body': email_data['body']
            }
            analysis_data.append(filtered_data)

        # Extract common patterns and characteristics
        common_patterns = SpamGenieService._extract_common_patterns(analysis_data)

        prompt = f"""As a SpamAssassin expert, analyze this
spam email data and create effective rules.

SPAM EMAIL ANALYSIS:
Headers:
{json.dumps(analysis_data[0]['headers'], indent=2)}

Email Body Samples:
Plain Text: {analysis_data[0]['body']['plain'][:500]}...
HTML Content: {analysis_data[0]['body']['html'][:500]}...

Common Patterns Detected:
{json.dumps(common_patterns, indent=2)}

Create a comprehensive SpamAssassin rule that would
effectively detect similar spam emails. The rule should:

1. Header Checks:
   - Implement checks for suspicious header patterns
   - Include regex patterns for header value variations
   - Consider header presence/absence patterns

2. Body Checks:
   - Add content-based rules for both plain text and HTML
   - Include checks for suspicious URLs and domains
   - Consider text patterns and formatting characteristics

3. Meta Rules:
   - Combine individual checks using meta rules
   - Implement score aggregation logic
   - Consider rule dependencies

4. Scoring:
   - Assign appropriate scores based on confidence
   - Include score descriptions and justifications
   - Consider false positive prevention

Format the response as a complete SpamAssassin rule set with:
- Rule descriptions and documentation
- Header, body, and meta rules
- Scoring justifications
- False positive prevention measures

Use this template format:
```
# Rule: RULE_NAME
# Description: [Detailed description of what this rule detects]
# Score: [score] [justification]
header   RULE_NAME_HEADER   [pattern]
body     RULE_NAME_BODY     [pattern]
uri      RULE_NAME_URI      [pattern]
meta     RULE_NAME_META     [condition]
score    RULE_NAME          [score]
describe RULE_NAME          [description]
```"""

        return prompt

    @staticmethod
    def query_gemini(prompt: str) -> str:
        """Query Gemini API to generate SpamAssassin rules."""
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set!")

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models"
            f"/gemini-1.5-flash:generateContent?key={api_key}"
        )

        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }]
        }

        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            result = response.json()

            # Extract the generated text from the response
            generated_text = result['candidates'][0]['content']['parts'][0]['text']
            return generated_text
        except Exception as e:
            raise Exception(f"Error querying Gemini API: {str(e)}")

    @staticmethod
    def process_rule_generation(rule_generation_id: int) -> Dict[str, Any]:
        """Process a rule generation request and update the database."""
        try:
            rule_generation = RuleGeneration.objects.get(id=rule_generation_id)

            # Generate the prompt
            prompt = SpamGenieService.generate_prompt(rule_generation)
            rule_generation.prompt = prompt
            rule_generation.save()

            # Query Gemini API
            rule = SpamGenieService.query_gemini(prompt)

            # Update the rule generation
            rule_generation.rule = rule
            rule_generation.is_complete = True
            rule_generation.save()

            # Mark email files as processed
            for email_file in rule_generation.email_files.all():
                email_file.processed = True
                email_file.save()

            return {
                'success': True,
                'rule_generation_id': rule_generation.id,
                'rule': rule
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
