"""
Module for managing prompt templates and building prompts for rule generation.
"""
import json
from typing import List, Dict, Optional
from .models import PromptTemplate


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
        return PromptTemplate.objects.filter(is_base=True).order_by('name')

    @staticmethod
    def get_base_prompt(base_prompt_id: Optional[int] = None) -> str:
        """
        Get the base prompt template.

        Args:
            base_prompt_id: Optional ID of a specific base prompt to use

        Returns:
            Base prompt string
        """
        try:
            if base_prompt_id:
                # Get specific base prompt
                base_prompt = PromptTemplate.objects.get(id=base_prompt_id, is_base=True)
            else:
                # Get the first base prompt
                base_prompt = PromptTemplate.objects.filter(is_base=True).first()

            if base_prompt:
                return base_prompt.template
        except PromptTemplate.DoesNotExist:
            pass

        # Return a default prompt if no base prompt is found
        return """
As a SpamAssassin expert, analyze this spam email data and create effective rules.

SPAM EMAIL ANALYSIS:
{HEADERS}

Email Body Samples:
{EMAIL_BODY}

## Instructions
Create SpamAssassin rules to detect similar spam emails.
"""

    @staticmethod
    def get_module_prompt(module_type: str) -> str:
        """
        Get a specific module prompt template.

        Args:
            module_type: The type of module to get

        Returns:
            Module prompt string or empty string if not found
        """
        try:
            module = PromptTemplate.objects.get(is_module=True, module_type=module_type)
            return module.template
        except PromptTemplate.DoesNotExist:
            return ""

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
        if selected_modules is None:
            selected_modules = []

        # Get the base prompt
        prompt_content = PromptManager.get_base_prompt(base_prompt_id)

        # Get base prompt information for metadata
        base_prompt = None
        if base_prompt_id:
            try:
                base_prompt = PromptTemplate.objects.get(id=base_prompt_id, is_base=True)
            except PromptTemplate.DoesNotExist:
                pass
        else:
            base_prompt = PromptTemplate.objects.filter(is_base=True).first()

        # Extract data for placeholders
        headers = json.dumps(analysis_data[0]['headers'], indent=2) if analysis_data else "{}"
        body_plain = analysis_data[0]['body']['plain'][:500] if analysis_data else ""
        body_html = analysis_data[0]['body']['html'][:500] if analysis_data else ""

        # Replace placeholders
        prompt_content = prompt_content.replace("{HEADERS}", headers)
        prompt_content = prompt_content.replace(
            "{EMAIL_BODY}",
            f"Plain Text: {body_plain}\nHTML Content: {body_html}"
        )

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

        # Prepare response with metadata
        result = {
            'prompt': prompt_content,
            'metadata': {
                'base_prompt': {
                    'id': base_prompt.id if base_prompt else None,
                    'name': base_prompt.name if base_prompt else 'Default Prompt'
                },
                'modules': added_modules
            }
        }

        return result
