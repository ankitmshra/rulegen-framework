from .prompt_manager import PromptManager
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
    def _extract_domains_from_urls(urls: List[str]) -> List[str]:
        """Extract domain names from a list of URLs."""
        domains = []
        for url in urls:
            try:
                # Extract domain using regex
                domain_match = re.search(r'https?://([^/]+)', url)
                if domain_match:
                    domains.append(domain_match.group(1))
            except Exception:
                continue
        return list(set(domains))  # Remove duplicates

    @staticmethod
    def _enhance_analysis_data(analysis_data: List[Dict]) -> List[Dict]:
        """Enhance analysis data with additional extracted patterns."""
        if not analysis_data:
            return analysis_data
        
        # Extract and add URLs
        for data in analysis_data:
            html_content = data['body'].get('html', '')
            urls = SpamGenieService._extract_urls(html_content)
            domains = SpamGenieService._extract_domains_from_urls(urls)
            
            # Add to the data structure
            data['extracted'] = {
                'urls': urls,
                'domains': domains,
                'html_analysis': SpamGenieService._analyze_html_formatting(html_content)
            }
            
        return analysis_data

    @staticmethod
    def generate_prompt(rule_generation: RuleGeneration) -> str:
        """Generate a detailed prompt based on selected keys, email content, and prompt modules."""
        selected_keys = rule_generation.selected_headers
        email_files = rule_generation.email_files.all()
        selected_modules = rule_generation.prompt_modules or []
        base_prompt_id = rule_generation.base_prompt_id

        analysis_data = []
        for email_file in email_files:
            email_data = SpamGenieService.parse_email(email_file)
            filtered_data = {
                'headers': {k: email_data['headers'].get(k, '') for k in selected_keys},
                'body': email_data['body']
            }
            analysis_data.append(filtered_data)

        # Enhance analysis data with additional patterns
        enhanced_data = SpamGenieService._enhance_analysis_data(analysis_data)

        # Extract common patterns and characteristics
        common_patterns = SpamGenieService._extract_common_patterns(enhanced_data)

        # Add common patterns to the first email analysis for prompt building
        if enhanced_data:
            enhanced_data[0]['common_patterns'] = common_patterns

        # Use PromptManager to build the prompt
        prompt_data = PromptManager.build_prompt(enhanced_data, selected_modules, base_prompt_id)

        # Store metadata in rule_generation if it's not already set
        if not rule_generation.prompt_metadata:
            rule_generation.prompt_metadata = prompt_data.get('metadata', {})
            rule_generation.save(update_fields=['prompt_metadata'])

        return prompt_data['prompt']

    @staticmethod
    def _validate_spamassassin_rules(rules_text: str) -> Dict[str, Any]:
        """Validate SpamAssassin rules for proper structure."""
        validation = {
            'valid': True,
            'issues': [],
            'subrules_count': 0,
            'meta_rules_count': 0
        }
        
        # Look for subrules (should start with __)
        subrule_regex = r'^(?:header|uri|rawbody|body)\s+(__\w+)'
        subrules = re.findall(subrule_regex, rules_text, re.MULTILINE)
        validation['subrules_count'] = len(subrules)
        
        # Look for meta rules (should NOT start with __)
        meta_regex = r'^meta\s+(\w+)'
        meta_rules = re.findall(meta_regex, rules_text, re.MULTILINE)
        validation['meta_rules_count'] = len(meta_rules)
        
        # Check for basic issues
        if validation['subrules_count'] == 0:
            validation['valid'] = False
            validation['issues'].append("No subrules found. Rules should use the __ prefix.")
            
        if validation['meta_rules_count'] == 0:
            validation['valid'] = False
            validation['issues'].append("No meta rules found. Meta rules should combine subrules.")
        
        # Check for body tag misuse (should use rawbody for HTML)
        if re.search(r'^body\s+__\w+\s+/<', rules_text, re.MULTILINE):
            validation['valid'] = False
            validation['issues'].append("Using 'body' tag with HTML patterns. Should use 'rawbody' instead.")
        
        return validation

    @staticmethod
    def _fix_common_rule_issues(rules_text: str) -> str:
        """Fix common issues in generated rules."""
        fixed_text = rules_text
        
        # Fix rules without __ prefix
        subrule_pattern = r'^(header|uri|rawbody|body)\s+([A-Z_]+[^_])'
        fixed_text = re.sub(subrule_pattern, r'\1 __\2', fixed_text, flags=re.MULTILINE)
        
        # Fix body tag with HTML patterns
        body_html_pattern = r'^body(\s+__\w+\s+/<)'
        fixed_text = re.sub(body_html_pattern, r'rawbody\1', fixed_text, flags=re.MULTILINE)
        
        # Fix uri tag misuse
        uri_pattern = r'^body(\s+__\w+\s+/https?:)'
        fixed_text = re.sub(uri_pattern, r'uri\1', fixed_text, flags=re.MULTILINE)
        
        return fixed_text

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
            }],
            "generationConfig": {
                "temperature": 0.2,  # Lower temperature for more precise rule generation
                "topP": 0.9,
                "maxOutputTokens": 8000
            }
        }

        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            result = response.json()

            # Extract the generated text from the response
            generated_text = result['candidates'][0]['content']['parts'][0]['text']
            
            # Fix common issues in the generated rules
            fixed_rules = SpamGenieService._fix_common_rule_issues(generated_text)
            
            # Validate the rules
            validation = SpamGenieService._validate_spamassassin_rules(fixed_rules)
            
            # Add validation info as a comment to the output
            if not validation['valid']:
                validation_notes = "\n\n# Validation Notes:\n"
                for issue in validation['issues']:
                    validation_notes += f"# - {issue}\n"
                fixed_rules += validation_notes
            
            return fixed_rules
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
