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
from .models import AppSettings
import functools
import threading
from contextlib import contextmanager
from threading import Event
import concurrent.futures


class TimeoutState:
    def __init__(self):
        self.timed_out = Event()
        self.error_message = None


@contextmanager
def timeout_context(seconds, timeout_state):
    timer = None

    def timeout_handler():
        timeout_state.timed_out.set()
        timeout_state.error_message = "Operation timed out"

    try:
        timer = threading.Timer(seconds, timeout_handler)
        timer.start()
        yield
    finally:
        if timer:
            timer.cancel()


def timeout_decorator(seconds):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            with timeout_context(seconds):
                return func(*args, **kwargs)

        return wrapper

    return decorator


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
                    # Get the content and decode it
                    content = part.get_payload(decode=True)
                    if content:
                        # Try to decode with UTF-8 first, fall back to latin-1 if that fails
                        try:
                            decoded_content = content.decode('utf-8')
                        except UnicodeDecodeError:
                            decoded_content = content.decode('latin-1')
                        
                        if content_type == "text/plain":
                            body["plain"] += decoded_content
                        elif content_type == "text/html":
                            body["html"] += decoded_content
                except (UnicodeDecodeError, AttributeError) as e:
                    import logging
                    logging.error(f"Error decoding email part: {str(e)}")
                    continue
        else:
            # Handle non-multipart messages
            content_type = msg.get_content_type()
            try:
                content = msg.get_payload(decode=True)
                if content:
                    # Try to decode with UTF-8 first, fall back to latin-1 if that fails
                    try:
                        decoded_content = content.decode('utf-8')
                    except UnicodeDecodeError:
                        decoded_content = content.decode('latin-1')
                    
                    if content_type == "text/plain":
                        body["plain"] = decoded_content
                    elif content_type == "text/html":
                        body["html"] = decoded_content
            except (UnicodeDecodeError, AttributeError) as e:
                import logging
                logging.error(f"Error decoding email body: {str(e)}")

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

        # Process spam emails
        spam_analysis_data = []
        for email_file in email_files:
            email_data = SpamGenieService.parse_email(email_file)
            filtered_data = {
                "headers": {k: email_data["headers"].get(k, "") for k in selected_headers},
                "body": {
                    "plain": email_data["body"].get("plain", ""),
                    "html": email_data["body"].get("html", "")
                },
                "is_spam": True,
            }
            spam_analysis_data.append(filtered_data)

        # Enhance analysis data with additional patterns
        enhanced_spam_data = (
            SpamGenieService._enhance_analysis_data(spam_analysis_data)
            if spam_analysis_data
            else []
        )

        # Extract common patterns and characteristics
        spam_patterns = (
            SpamGenieService._extract_common_patterns(enhanced_spam_data)
            if enhanced_spam_data
            else {}
        )

        # Prepare data for prompt building
        combined_data = []
        if enhanced_spam_data:
            combined_data = enhanced_spam_data
            if combined_data:
                combined_data[0]["spam_patterns"] = spam_patterns

        # Use PromptManager to build the prompt
        prompt_data = PromptManager.build_prompt(combined_data, selected_modules, base_prompt_id)

        # Store metadata in rule_generation if it's not already set
        if not rule_generation.prompt_metadata:
            rule_generation.prompt_metadata = {
                **(prompt_data.get("metadata", {})),
                "spam_count": len(email_files),
            }
            rule_generation.save(update_fields=["prompt_metadata"])

        return prompt_data["prompt"]

    @staticmethod
    def get_openai_client():
        """Initialize and return an OpenAI client."""
        team_private_key = settings.TEAM_PRIVATE_KEY
        if not team_private_key:
            raise ValueError("TEAM_PRIVATE_KEY environment variable not set!")

        # Get settings from database
        try:
            endpoint_setting = AppSettings.objects.get(key=AppSettings.OPENAI_API_ENDPOINT)
            api_endpoint = endpoint_setting.value
        except AppSettings.DoesNotExist:
            api_endpoint = "https://api.sage.cudasvc.com"  # Default endpoint

        try:
            version_setting = AppSettings.objects.get(key=AppSettings.OPENAI_API_VERSION)
            api_version = version_setting.value
        except AppSettings.DoesNotExist:
            api_version = ""  # Default version

        try:
            team_setting = AppSettings.objects.get(key=AppSettings.OPENAI_TEAM_NAME)
            team_name = team_setting.value
        except AppSettings.DoesNotExist:
            team_name = "bci_ta"  # Default team name

        # Generate JWT token for authentication
        now = datetime.datetime.now(datetime.UTC)
        payload = {
            "iss": team_name,  # Team name from settings
            "kid": "1",  # Key ID, should be 1 unless revoked and new keys issued
            "iat": now.timestamp(),  # Issued at time
            "nbf": now.timestamp(),  # Not before time
            "exp": (now + datetime.timedelta(hours=1)).timestamp(),  # Expiration
            "session_token": f"session_{now.timestamp()}",  # Session tracking token
        }
        encoded = jwt.encode(payload, team_private_key, algorithm="PS256")

        # Create and return Azure OpenAI client
        client = AzureOpenAI(
            api_version=api_version,
            azure_endpoint=api_endpoint,
            azure_ad_token=encoded,
        )
        return client

    @staticmethod
    def query_openai(prompt: str) -> str:
        """Query OpenAI API to generate SpamAssassin rules."""
        try:
            client = SpamGenieService.get_openai_client()

            # Get model name from settings
            try:
                model_setting = AppSettings.objects.get(key=AppSettings.OPENAI_MODEL_NAME)
                model_name = model_setting.value
            except AppSettings.DoesNotExist:
                model_name = "deepseek-r1"  # Default model

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
                model=model_name,
                temperature=0.2,  # Lower temperature for more precise rule generation
                max_tokens=8000,
            )

            # Extract the generated text from the response
            generated_text = completion.choices[0].message.content

            return generated_text

        except Exception as e:
            import logging

            error_message = str(e)
            if "timeout" in error_message.lower():
                error_message = (
                    "Request timed out. Please try again or increase the timeout value in settings."
                )
            logging.error(f"Error querying OpenAI API: {error_message}")
            raise Exception(f"Error querying OpenAI API: {error_message}")

    @staticmethod
    def process_rule_generation(rule_generation_id: int) -> Dict[str, Any]:
        """Process a rule generation request and update the database."""
        try:
            rule_generation = RuleGeneration.objects.get(id=rule_generation_id)
            workspace = rule_generation.workspace

            # Get all email files from the workspace
            email_files = workspace.email_files.all()

            # Get timeout setting
            try:
                timeout_setting = AppSettings.objects.get(key="rule_gen_timeout")
                timeout = int(timeout_setting.value) / 1000  # Convert milliseconds to seconds
            except AppSettings.DoesNotExist:
                timeout = 30  # Default 30 seconds

            # Generate the prompt if it's not already set (from a custom prompt)
            if not rule_generation.prompt:
                prompt = SpamGenieService.generate_prompt(rule_generation, email_files)
                rule_generation.prompt = prompt
                rule_generation.save()
            
            # If this is a regeneration with feedback, incorporate the feedback into the prompt
            if rule_generation.is_regeneration and rule_generation.feedback:
                # Append feedback to the prompt
                prompt_with_feedback = f"{rule_generation.prompt}\n\nUser Feedback: {rule_generation.feedback}"
                rule_generation.prompt = prompt_with_feedback
                rule_generation.save()

            try:
                # Use ThreadPoolExecutor to run the API call with a timeout
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(SpamGenieService.query_openai, rule_generation.prompt)
                    try:
                        rule = future.result(timeout=timeout)
                    except concurrent.futures.TimeoutError:
                        error_message = (
                            "Request timed out. "
                            + "Please try again or increase the timeout value in settings."
                        )
                        rule_generation.rule = error_message
                        rule_generation.error = error_message
                        rule_generation.is_complete = True
                        rule_generation.save()
                        return {
                            "success": False,
                            "error": error_message,
                            "rule_generation_id": rule_generation.id,
                        }

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

            except Exception as e:
                error_message = str(e)
                rule_generation.rule = error_message
                rule_generation.error = error_message
                rule_generation.is_complete = True
                rule_generation.save()
                return {
                    "success": False,
                    "error": error_message,
                    "rule_generation_id": rule_generation.id,
                }

        except RuleGeneration.DoesNotExist:
            return {
                "success": False,
                "error": f"Rule generation with ID {rule_generation_id} not found",
            }
        except Exception as e:
            import logging

            error_message = str(e)
            logging.error(f"Error processing rule generation {rule_generation_id}: {error_message}")
            # Update rule generation with error
            rule_generation.error = error_message
            rule_generation.is_complete = True
            rule_generation.save()
            return {"success": False, "error": error_message}
