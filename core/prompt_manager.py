"""
Module for managing prompt templates and building prompts for rule generation.
"""
import json
from typing import List, Dict, Optional, Any


class PromptManager:
    """
    Manages prompt templates and builds complete prompts based on selected modules.
    """

    @staticmethod
    def get_base_prompts():
        """
        Get all available base prompts.

        Returns:
            List of base prompts
        """
        from .models import PromptTemplate
        return PromptTemplate.objects.filter(is_base=True).order_by('name')

    @staticmethod
    def get_base_prompt(base_prompt_id: Optional[int] = None) -> str:
        """
        Get the base prompt template.

        Args:
            base_prompt_id: Optional ID of a specific base prompt to use

        Returns:
            Base prompt string or empty string if none found
        """
        from .models import PromptTemplate
        try:
            if base_prompt_id:
                # Get specific base prompt
                base_prompt = PromptTemplate.objects.get(id=base_prompt_id, is_base=True)
            else:
                # Get the first base prompt
                base_prompt = PromptTemplate.objects.filter(is_base=True).first()

            if base_prompt:
                return base_prompt.template
            else:
                # Log the issue rather than providing a default
                import logging
                logging.error("No base prompt template found in the database")
                return ""
        except PromptTemplate.DoesNotExist:
            import logging
            logging.error(f"Base prompt with ID {base_prompt_id} not found")
            return ""

    @staticmethod
    def get_module_prompt(module_type: str) -> str:
        """
        Get a specific module prompt template.

        Args:
            module_type: The type of module to get

        Returns:
            Module prompt string or empty string if not found
        """
        from .models import PromptTemplate
        try:
            module = PromptTemplate.objects.get(is_module=True, module_type=module_type)
            return module.template
        except PromptTemplate.DoesNotExist:
            return ""

    @staticmethod
    def format_email_data(analysis_data: List[Dict]) -> Dict[str, Any]:
        """
        Format email data for inclusion in the prompt.

        Args:
            analysis_data: List of dictionaries containing email analysis data

        Returns:
            Dictionary with formatted headers and body sections
        """
        if not analysis_data:
            return {
                "headers": "{}",
                "body_plain": "",
                "body_html": ""
            }

        # Extract headers
        headers = json.dumps(analysis_data[0]['headers'], indent=2)

        # Extract body samples - limit length to avoid overly long prompts
        body_plain = analysis_data[0]['body'].get('plain', '')[:1000] if analysis_data else ""
        body_html = analysis_data[0]['body'].get('html', '')[:1000] if analysis_data else ""

        # Extract any URLs found
        urls = []
        for data in analysis_data:
            if not data.get('body'):
                continue
            html = data['body'].get('html', '')
            import re
            found_urls = re.findall(r'https?://[^\s<>"]+', html)
            urls.extend(found_urls[:10])  # Limit to first 10 URLs

        return {
            "headers": headers,
            "body_plain": body_plain,
            "body_html": body_html,
            "urls": list(set(urls))[:10]  # Remove duplicates and limit
        }

    @staticmethod
    def build_prompt(
        analysis_data: List[Dict],
        selected_modules: List[str] = None,
        base_prompt_id: Optional[int] = None
    ) -> Dict:
        """
        Build a complete prompt using the base prompt and selected modules.

        Args:
            analysis_data: List of dictionaries containing email analysis data
            selected_modules: List of module names to include
            base_prompt_id: Optional ID of a specific base prompt to use

        Returns:
            Dictionary with prompt string and metadata
        """
        from .models import PromptTemplate

        if selected_modules is None:
            selected_modules = []

        # Get the base prompt
        prompt_content = PromptManager.get_base_prompt(base_prompt_id)
        if not prompt_content:
            # Return empty result if no base prompt found
            return {
                'prompt': '',
                'metadata': {
                    'base_prompt': {'id': None, 'name': 'No Base Prompt Found'},
                    'modules': [],
                    'email_sample_count': len(analysis_data)
                }
            }

        # Get base prompt information for metadata
        base_prompt = None
        if base_prompt_id:
            try:
                base_prompt = PromptTemplate.objects.get(id=base_prompt_id, is_base=True)
            except PromptTemplate.DoesNotExist:
                pass
        else:
            base_prompt = PromptTemplate.objects.filter(is_base=True).first()

        # Format email data for the prompt
        formatted_data = PromptManager.format_email_data(analysis_data)

        # Replace placeholders
        prompt_content = prompt_content.replace("{HEADERS}", formatted_data["headers"])

        email_body_content = f"""
Plain Text:
```
{formatted_data["body_plain"]}
```

HTML Content:
```
{formatted_data["body_html"]}
```

Extracted URLs:
```
{chr(10).join(formatted_data["urls"]) if formatted_data["urls"] else "No URLs found"}
```
"""
        prompt_content = prompt_content.replace("{EMAIL_BODY}", email_body_content)

        # Add modules
        added_modules = []
        for module in selected_modules:
            module_content = PromptManager.get_module_prompt(module)
            if module_content:
                prompt_content += f"\n\n{module_content}"
                try:
                    module_obj = PromptTemplate.objects.get(is_module=True, module_type=module)
                    added_modules.append({
                        'id': module_obj.id,
                        'name': module_obj.name,
                        'type': module_obj.module_type
                    })
                except PromptTemplate.DoesNotExist:
                    pass

        # Add a final reminder to ensure proper formatting
        prompt_content += """

## IMPORTANT REMINDER
1. Use EXACTLY two underscores (__) prefix for all subrules
2. Present each subrule in its own separate code block for easy copying
3. Follow the exact format shown in the examples
4. Group related subrules by type (headers, URI, body, etc.)
"""

        # Prepare response with metadata
        result = {
            'prompt': prompt_content,
            'metadata': {
                'base_prompt': {
                    'id': base_prompt.id if base_prompt else None,
                    'name': base_prompt.name if base_prompt else 'Unknown Prompt'
                },
                'modules': added_modules,
                'email_sample_count': len(analysis_data)
            }
        }

        return result
