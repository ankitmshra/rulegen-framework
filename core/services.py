"""
Services for processing email files and generating SpamAssassin rules.
"""

from .prompt_manager import PromptManager
import re
import datetime
import jwt
from typing import List, Dict, Any, Optional
import email.message
from email import policy
from django.conf import settings
from .models import EmailFile, RuleGeneration
from openai import AzureOpenAI


class SpamGenieService:
    """Service class for processing email files and generating SpamAssassin rules."""

    @staticmethod
    def parse_email(email_file: EmailFile) -> Dict[str, Any]:
        """Parse an email file and extract its headers and content."""
        with open(email_file.file.path, "rb") as f:
            msg = email.message_from_bytes(f.read(), policy=policy.default)

        email_data = {
            "headers": dict(msg.items()),
            "body": SpamGenieService._get_email_body(msg),
            "file_name": email_file.original_filename,
        }
        return email_data

    @staticmethod
    def _get_email_body(msg: email.message.EmailMessage) -> Dict[str, str]:
        """Extract both plain text and HTML body from the message."""
        body = {"plain": "", "html": ""}

        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_maintype() == "multipart":
                    continue

                content_type = part.get_content_type()
                try:
                    content = part.get_payload(decode=True).decode()
                except (UnicodeDecodeError, AttributeError):
                    continue

                if content_type == "text/plain":
                    body["plain"] += content
                elif content_type == "text/html":
                    body["html"] += content
        else:
            # Handle non-multipart messages
            content_type = msg.get_content_type()
            try:
                content = msg.get_payload(decode=True).decode()
                if content_type == "text/plain":
                    body["plain"] = content
                elif content_type == "text/html":
                    body["html"] = content
            except (UnicodeDecodeError, AttributeError):
                pass

        return body

    @staticmethod
    def get_available_headers(email_files: List[EmailFile]) -> Dict[str, str]:
        """Get all available headers from the processed emails."""
        all_headers = {}

        for email_file in email_files:
            email_data = SpamGenieService.parse_email(email_file)
            for key, value in email_data["headers"].items():
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
        url_pattern = r"https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+"
        return list(set(re.findall(url_pattern, html_content)))

    @staticmethod
    def _extract_common_phrases(text: str) -> List[str]:
        """Extract potentially suspicious phrases from text."""
        # Split into sentences and clean
        sentences = re.split(r"[.!?]+", text)
        return [s.strip() for s in sentences if len(s.strip()) > 10][:5]

    @staticmethod
    def _analyze_html_formatting(html_content: str) -> Dict[str, Any]:
        """Analyze HTML formatting patterns."""
        return {
            "has_images": bool(re.search(r"<img.*?>", html_content)),
            "has_links": bool(re.search(r"<a.*?href=.*?>", html_content)),
            "has_tables": bool(re.search(r"<table.*?>", html_content)),
            "has_hidden_content": bool(
                re.search(r"display:\s*none|visibility:\s*hidden", html_content)
            ),
        }

    @staticmethod
    def _extract_common_patterns(analysis_data: List[Dict]) -> Dict[str, Any]:
        """Extract common patterns from the analyzed emails."""
        patterns = {
            "header_patterns": {},
            "body_patterns": {
                "common_phrases": [],
                "url_patterns": [],
                "formatting_patterns": [],
            },
        }

        # Analyze headers
        for mail_data in analysis_data:
            for header, value in mail_data["headers"].items():
                if header not in patterns["header_patterns"]:
                    patterns["header_patterns"][header] = []
                patterns["header_patterns"][header].append(value)

        # Analyze body content
        for mail_data in analysis_data:
            # Extract URLs
            urls = SpamGenieService._extract_urls(mail_data["body"].get("html", ""))
            patterns["body_patterns"]["url_patterns"].extend(urls)

            # Extract common phrases
            phrases = SpamGenieService._extract_common_phrases(mail_data["body"].get("plain", ""))
            patterns["body_patterns"]["common_phrases"].extend(phrases)

            # Analyze HTML formatting
            if mail_data["body"].get("html"):
                formatting = SpamGenieService._analyze_html_formatting(mail_data["body"]["html"])
                patterns["body_patterns"]["formatting_patterns"].append(formatting)

        return patterns

    @staticmethod
    def _extract_domains_from_urls(urls: List[str]) -> List[str]:
        """Extract domain names from a list of URLs."""
        domains = []
        for url in urls:
            try:
                # Extract domain using regex
                domain_match = re.search(r"https?://([^/]+)", url)
                if domain_match:
                    domains.append(domain_match.group(1))
            except Exception as e:
                # Log the error and continue
                import logging

                logging.error(f"Error extracting domain from URL {url}: {str(e)}")
                continue
        return list(set(domains))  # Remove duplicates

    @staticmethod
    def _enhance_analysis_data(analysis_data: List[Dict]) -> List[Dict]:
        """Enhance analysis data with additional extracted patterns."""
        if not analysis_data:
            return analysis_data

        # Extract and add URLs
        for data in analysis_data:
            html_content = data["body"].get("html", "")
            urls = SpamGenieService._extract_urls(html_content)
            domains = SpamGenieService._extract_domains_from_urls(urls)

            # Add to the data structure
            data["extracted"] = {
                "urls": urls,
                "domains": domains,
                "html_analysis": SpamGenieService._analyze_html_formatting(html_content),
            }

        return analysis_data

    @staticmethod
    def generate_prompt(
        rule_generation: RuleGeneration, email_files: Optional[List[EmailFile]] = None
    ) -> str:
        """Generate a detailed prompt based on the
        RuleGeneration object and associated email files."""
        workspace = rule_generation.workspace
        selected_headers = workspace.selected_headers
        selected_modules = rule_generation.prompt_modules or []
        base_prompt_id = rule_generation.base_prompt_id

        # If email_files not provided, get them from the workspace
        if email_files is None:
            email_files = workspace.email_files.all()

        # Separate spam and ham emails
        spam_email_files = [ef for ef in email_files if ef.email_type == EmailFile.SPAM]
        ham_email_files = [ef for ef in email_files if ef.email_type == EmailFile.HAM]

        # Process spam emails
        spam_analysis_data = []
        for email_file in spam_email_files:
            email_data = SpamGenieService.parse_email(email_file)
            filtered_data = {
                "headers": {k: email_data["headers"].get(k, "") for k in selected_headers},
                "body": email_data["body"],
                "is_spam": True,  # Mark as spam
            }
            spam_analysis_data.append(filtered_data)

        # Process ham emails
        ham_analysis_data = []
        for email_file in ham_email_files:
            email_data = SpamGenieService.parse_email(email_file)
            filtered_data = {
                "headers": {k: email_data["headers"].get(k, "") for k in selected_headers},
                "body": email_data["body"],
                "is_spam": False,  # Mark as ham
            }
            ham_analysis_data.append(filtered_data)

        # Enhance analysis data with additional patterns
        enhanced_spam_data = (
            SpamGenieService._enhance_analysis_data(spam_analysis_data)
            if spam_analysis_data
            else []
        )
        enhanced_ham_data = (
            SpamGenieService._enhance_analysis_data(ham_analysis_data) if ham_analysis_data else []
        )

        # Extract common patterns and characteristics for both types
        spam_patterns = (
            SpamGenieService._extract_common_patterns(enhanced_spam_data)
            if enhanced_spam_data
            else {}
        )
        ham_patterns = (
            SpamGenieService._extract_common_patterns(enhanced_ham_data)
            if enhanced_ham_data
            else {}
        )

        # Combine analysis data for prompt building
        combined_data = []

        # Add spam data with patterns
        if enhanced_spam_data:
            combined_data = enhanced_spam_data
            if combined_data:
                combined_data[0]["spam_patterns"] = spam_patterns

        # Add ham data with patterns
        if enhanced_ham_data:
            if not combined_data and enhanced_ham_data:
                combined_data = enhanced_ham_data
                if combined_data:
                    combined_data[0]["ham_patterns"] = ham_patterns
            elif combined_data:
                # If we already have spam data, add ham patterns to it
                combined_data[0]["ham_patterns"] = ham_patterns

        # Use PromptManager to build the prompt
        prompt_data = PromptManager.build_prompt(combined_data, selected_modules, base_prompt_id)

        # Store metadata in rule_generation if it's not already set
        if not rule_generation.prompt_metadata:
            rule_generation.prompt_metadata = {
                **(prompt_data.get("metadata", {})),
                "spam_count": len(spam_email_files),
                "ham_count": len(ham_email_files),
            }
            rule_generation.save(update_fields=["prompt_metadata"])

        return prompt_data["prompt"]

    @staticmethod
    def get_openai_client():
        """Initialize and return an OpenAI client."""
        team_private_key = settings.TEAM_PRIVATE_KEY
        if not team_private_key:
            raise ValueError("TEAM_PRIVATE_KEY environment variable not set!")

        # Generate JWT token for authentication
        now = datetime.datetime.now(datetime.UTC)
        payload = {
            "iss": "low",  # Team name as defined in your OpenAI account
            "kid": "1",  # Key ID, should be 1 unless revoked and new keys issued
            "iat": now.timestamp(),  # Issued at time
            "nbf": now.timestamp(),  # Not before time
            "exp": (now + datetime.timedelta(hours=1)).timestamp(),  # Expiration
            "session_token": f"session_{now.timestamp()}",  # Session tracking token
        }
        encoded = jwt.encode(payload, team_private_key, algorithm="PS256")

        # Create and return Azure OpenAI client
        client = AzureOpenAI(
            api_version=settings.OPENAI_API_VERSION,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            azure_ad_token=encoded,
        )
        return client

    @staticmethod
    def query_openai(prompt: str) -> str:
        """Query OpenAI API to generate SpamAssassin rules."""
        try:
            client = SpamGenieService.get_openai_client()

            # Set up messages for the chat completion
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are a SpamAssassin expert AI that generates "
                        + "effective and accurate rule sets."
                    ),
                },
                {"role": "user", "content": prompt},
            ]

            # Create the completion with the appropriate model
            completion = client.chat.completions.create(
                messages=messages,
                model=settings.OPENAI_MODEL_NAME,
                temperature=0.2,  # Lower temperature for more precise rule generation
                max_tokens=8000,
            )

            # Extract the generated text from the response
            generated_text = completion.choices[0].message.content

            return generated_text

        except Exception as e:
            import logging

            logging.error(f"Error querying OpenAI API: {str(e)}")
            raise Exception(f"Error querying OpenAI API: {str(e)}")

    @staticmethod
    def process_rule_generation(rule_generation_id: int) -> Dict[str, Any]:
        """Process a rule generation request and update the database."""
        try:
            rule_generation = RuleGeneration.objects.get(id=rule_generation_id)
            workspace = rule_generation.workspace
            email_files = workspace.email_files.all()

            # Generate the prompt if it's not already set (from a custom prompt)
            if not rule_generation.prompt:
                prompt = SpamGenieService.generate_prompt(rule_generation, email_files)
                rule_generation.prompt = prompt
                rule_generation.save()

            # Query OpenAI API instead of Gemini
            rule = SpamGenieService.query_openai(rule_generation.prompt)

            # Update the rule generation
            rule_generation.rule = rule
            rule_generation.is_complete = True
            rule_generation.save()

            # Mark email files as processed
            for email_file in email_files:
                email_file.processed = True
                email_file.save()

            return {
                "success": True,
                "rule_generation_id": rule_generation.id,
                "rule": rule,
            }
        except RuleGeneration.DoesNotExist:
            return {
                "success": False,
                "error": f"Rule generation with ID {rule_generation_id} not found",
            }
        except Exception as e:
            import logging

            logging.error(f"Error processing rule generation {rule_generation_id}: {str(e)}")
            return {"success": False, "error": str(e)}
