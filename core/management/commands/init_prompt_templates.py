from django.core.management.base import BaseCommand
from core.models import PromptTemplate


class Command(BaseCommand):
    help = 'Initialize default prompt templates'

    def handle(self, *args, **options):
        # Base prompt
        base_prompt, created = PromptTemplate.objects.get_or_create(
            name="Base SpamAssassin Rule Generation",
            defaults={
                "is_base": True,
                "description": "Basic prompt for generating SpamAssassin rules",
                "template": """
As a SpamAssassin expert, analyze this spam email data and create effective rules.

SPAM EMAIL ANALYSIS:
{HEADERS}

Email Body Samples:
{EMAIL_BODY}

## Instructions
Create SpamAssassin rules to detect similar spam emails.

For each rule:
1. Provide a brief explanation of what the rule detects
2. Place the actual rule code in a code block

For example:

### Header Check
This rule targets suspicious sender addresses.

```
header   SPAM_FROM   /^From:.*suspicious/i
describe SPAM_FROM   Suspicious sender address
```
"""
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created base prompt: {base_prompt.name}")
            )
        else:
            self.stdout.write(f"Base prompt already exists: {base_prompt.name}")

        # Scoring module
        scoring_module, created = PromptTemplate.objects.get_or_create(
            name="Scoring Module",
            defaults={
                "is_module": True,
                "module_type": "scoring",
                "description": "Adds scoring information to rules",
                "template": """
### Scoring Guidelines

For each rule, include a score value and justification:

```
score    RULE_NAME   3.0   # Justification for score
```

Suggested scoring:
- 0.5-1.0: Minor indicators
- 1.0-2.0: Moderate indicators
- 2.0-3.0: Strong indicators
- 3.0+: Very strong indicators

Consider the false positive risk when assigning scores.
"""
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created module: {scoring_module.name}")
            )
        else:
            self.stdout.write(f"Module already exists: {scoring_module.name}")

        # Subrules module
        subrules_module, created = PromptTemplate.objects.get_or_create(
            name="Subrules Module",
            defaults={
                "is_module": True,
                "module_type": "subrules",
                "description": "Creates complex meta-rules that combine simpler rules",
                "template": """
### Meta Rules

Create meta rules that combine simple rules for better detection:

```
# First create individual rules
header   SPAM_HEADER_1   /pattern1/
body     SPAM_BODY_1     /pattern2/

# Then combine them with a meta rule
meta     SPAM_META       (SPAM_HEADER_1 && SPAM_BODY_1)
describe SPAM_META       Combined spam patterns
```

Use logical operators (&&, ||, !) to create sophisticated combinations.
"""
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created module: {subrules_module.name}")
            )
        else:
            self.stdout.write(f"Module already exists: {subrules_module.name}")

        # Notes module
        notes_module, created = PromptTemplate.objects.get_or_create(
            name="Notes Module",
            defaults={
                "is_module": True,
                "module_type": "notes",
                "description": "Adds detailed explanations about false positives",
                "template": """
### False Positive Prevention

Include notes on how your rules minimize false positives:

1. **Header Rules**: How specific patterns prevent matching legitimate emails
2. **Body Rules**: How pattern specificity reduces false matches
3. **Testing Recommendations**: Suggest ways to test the rules in a safe environment

For each rule that has a high risk of false positives, include specific notes:

```
# Note: This rule is specific enough to avoid matching legitimate communications
# because it requires multiple specific patterns to match simultaneously.
```
"""
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created module: {notes_module.name}")
            )
        else:
            self.stdout.write(f"Module already exists: {notes_module.name}")

        # URI Rules module
        uri_module, created = PromptTemplate.objects.get_or_create(
            name="URI Rules Module",
            defaults={
                "is_module": True,
                "module_type": "uri",
                "description": "Adds rules for detecting suspicious URLs",
                "template": """
### URI Rules

Create rules to detect suspicious URLs in the email:

```
uri      SPAM_URI      /suspicious-pattern/
describe SPAM_URI      URL containing suspicious pattern
```

Focus on:
- Domain patterns
- URL path patterns
- Query parameter patterns
- Shortened URLs
- Encoded URLs
"""
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created module: {uri_module.name}")
            )
        else:
            self.stdout.write(f"Module already exists: {uri_module.name}")

        self.stdout.write(
            self.style.SUCCESS("Prompt templates initialization complete.")
        )
