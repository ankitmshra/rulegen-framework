"""
Module for managing prompt templates and building prompts for rule generation.
"""
import json
from typing import List, Dict
from .models import PromptTemplate


class PromptManager:
    """
    Manages prompt templates and builds complete prompts based on selected modules.
    """

    @staticmethod
    def get_base_prompt() -> str:
        """
        Get the base prompt template.

        Returns:
            Base prompt string
        """
        try:
            base_prompt = PromptTemplate.objects.get(is_base=True)
            return base_prompt.template
        except PromptTemplate.DoesNotExist:
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
        selected_modules: List[str] = None
    ) -> str:
        """
        Build a complete prompt using the base prompt and selected modules.

        Args:
            analysis_data: List of dictionaries containing email analysis data
            selected_modules: List of module names to include

        Returns:
            Complete prompt string
        """
        if selected_modules is None:
            selected_modules = []

        # Get the base prompt
        prompt = PromptManager.get_base_prompt()

        # Extract data for placeholders
        headers = json.dumps(analysis_data[0]['headers'], indent=2) if analysis_data else "{}"
        body_plain = analysis_data[0]['body']['plain'][:500] if analysis_data else ""
        body_html = analysis_data[0]['body']['html'][:500] if analysis_data else ""

        # Replace placeholders
        prompt = prompt.replace("{HEADERS}", headers)
        prompt = prompt.replace(
            "{EMAIL_BODY}",
            f"Plain Text: {body_plain}\nHTML Content: {body_html}"
        )

        # Add modules
        for module in selected_modules:
            module_content = PromptManager.get_module_prompt(module)
            if module_content:
                prompt += f"\n\n{module_content}"

        return prompt
