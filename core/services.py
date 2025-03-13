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

        JSON_HEADERS = json.dumps(analysis_data[0]['headers'], indent=2)
        PLAIN_TEXT_SAMPLE = analysis_data[0]['body']['plain'][:500]
        HTML_CONTENT_SAMPLE = analysis_data[0]['body']['html'][:500]
        JSON_PATTERNS = json.dumps(common_patterns, indent=2)

        prompt = f"""
As a SpamAssassin expert, analyze this spam email data and create effective rules.

SPAM EMAIL ANALYSIS:
Headers:
{JSON_HEADERS}

Email Body Samples:
Plain Text: {PLAIN_TEXT_SAMPLE}
HTML Content: {HTML_CONTENT_SAMPLE}

Common Patterns Detected:
{JSON_PATTERNS}

## Instructions

Create a comprehensive SpamAssassin ruleset that would effectively detect similar spam emails.

For each rule or rule group:
1. Provide a brief explanation of what the rule detects and its importance
2. Include score justification and false positive considerations
3. Place the actual rule code in a code block

For example:

### Header Check: From Address

This rule targets suspicious sender addresses claiming to be from medical journals.
Score: 2.0 - Strong indicator with low false positive risk.

```
header   JOURNAL_SPAM_FROM   /^From:.*journal.*dermatology/i
describe JOURNAL_SPAM_FROM   Suspicious sender claiming to be a medical journal
score    JOURNAL_SPAM_FROM   2.0
```

### Rule Components to Include

1. **Header Checks**
   - Patterns for suspicious From, Subject or other headers
   - Variations to catch different spoofing techniques

2. **Body Checks**
   - Rules for suspicious phrases in plain text and HTML
   - Patterns indicating unsolicited communications
   - Keyword patterns specific to this type of spam

3. **URI Rules** (if applicable)
   - Rules for suspicious domains or URL patterns

4. **Meta Rules**
   - Logical combinations of individual rules
   - Score aggregation logic

5. **Final Ruleset**
   - Main rule that combines everything
   - Overall score and description

### False Positive Prevention

Include notes on how your rules minimize false positives,
especially for legitimate communications from real medical journals or researchers.
"""

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

            # Generate the prompt if it's not already set (from a custom prompt)
            if not rule_generation.prompt:
                prompt = SpamGenieService.generate_prompt(rule_generation)
                rule_generation.prompt = prompt
                rule_generation.save()

            # Query Gemini API
            rule = SpamGenieService.query_gemini(rule_generation.prompt)

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
