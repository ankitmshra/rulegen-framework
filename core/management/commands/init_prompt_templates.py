# core/management/commands/init_prompt_templates.py

from django.core.management.base import BaseCommand
from core.models import PromptTemplate


class Command(BaseCommand):
    help = 'Initialize default prompt templates'

    def handle(self, *args, **options):
        # Base prompt - focused only on subrule generation, removed scoring instructions
        base_prompt, created = PromptTemplate.objects.get_or_create(
            name="Base SpamAssassin Rule Generation",
            defaults={
                "is_base": True,
                "description": "Basic prompt for generating SpamAssassin subrules only",
                "template": """
As a SpamAssassin expert, analyze this spam email data and create effective detection subrules.

SPAM EMAIL ANALYSIS:
{HEADERS}

Email Body Samples:
{EMAIL_BODY}

## ⚠️ CRITICAL FORMAT REQUIREMENT ⚠️
All subrules MUST start with EXACTLY TWO underscores: __RULE_NAME
DO NOT use more or fewer underscores. EXACTLY TWO.

## SpamAssassin Subrule Instructions

1. **Subrule Format**:
   - Create rules like this: `header __SPAM_SUBJECT Subject =~ /pattern/i`
   - WRONG: `header ____SPAM_SUBJECT Subject =~ /pattern/i`
   - WRONG: `header _SPAM_SUBJECT Subject =~ /pattern/i`
   - CORRECT: `header __SPAM_SUBJECT Subject =~ /pattern/i`

2. **Content Type Detection**:
   - For HTML content: Use `rawbody __HTML_PATTERN /pattern/i`
   - For plain text: Use `body __TEXT_PATTERN /pattern/i`

3. **URI Detection**:
   - For URL patterns: Use `uri __SUSPICIOUS_URL /example\\.com/i`

4. **Rule Documentation**:
   - Document rules with: `describe __RULE_NAME Description of what this rule detects`
   - The rule name in describe MUST match exactly the name used in the rule

5. **Output Format**:
   - Group related subrules by type (headers, URI, body, etc.)
   - Present each subrule + describe as a separate code block for easy copying

## Example Correct Subrules:

```
header   __SPAM_SUBJECT_1   Subject =~ /\\[SPAM\\]/i
describe __SPAM_SUBJECT_1   Subject line contains "[SPAM]"
```

```
uri      __SUSP_URL_TLD     /\\.(bid|xyz|top)$/i
describe __SUSP_URL_TLD     URL with suspicious TLD
```

```
rawbody  __HTML_HIDDEN      /<div[^>]+style=["']display:\\s*none["']/i
describe __HTML_HIDDEN      HTML with hidden content
```

DO NOT create meta rules or assign scores - these will be handled separately.
Every rule name MUST start with EXACTLY TWO underscores - no more, no less.
"""
            }
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created base prompt: {base_prompt.name}")
            )
        else:
            # Update the template if it already exists
            base_prompt.template = """
As a SpamAssassin expert, analyze this spam email data and create effective detection subrules.

SPAM EMAIL ANALYSIS:
{HEADERS}

Email Body Samples:
{EMAIL_BODY}

## SpamAssassin Subrule Instructions

Your task is to generate ONLY subrules (not meta rules or scoring) following these requirements:

1. **Subrule Format**:
   - All subrules MUST start with EXACTLY two underscores: `__RULE_NAME`
   - Example: `header __SPAM_SUBJECT Subject =~ /pattern/i`

2. **Content Type Detection**:
   - For HTML content: Use `rawbody` instead of `body`
   - Example: `rawbody __HTML_PATTERN /pattern/i`

3. **URI Detection**:
   - For URL patterns: Use the `uri` tag, NOT `body`
   - Example: `uri __SUSPICIOUS_URL /example\\.com/i`

4. **Header Format**:
   - Format: `header __HEADER_PATTERN Header-Name =~ /pattern/i`
   - Use the exact header field name, not a processed version

5. **Rule Documentation**:
   - Provide a `describe` line for each subrule
   - Format: `describe __RULE_NAME Description of what this rule detects`

6. **Output Format**:
   - Group related subrules by type (headers, URI, body, etc.)
   - Present each subrule as a separate code block for easy copying
   - Do NOT include meta rules or scores (these will be added separately)

## Example Header Subrules:

```
header   __SPAM_SUBJECT_1   Subject =~ /\\[SPAM\\]/i
describe __SPAM_SUBJECT_1   Subject line contains "[SPAM]"
```

```
header   __FAKE_SENDER      From =~ /.*@(gmail|yahoo)\\.com/i
describe __FAKE_SENDER      Suspicious sender pattern
```

## Example URI Subrules:

```
uri      __SUSP_URL_TLD     /\\.(bid|xyz|top)$/i
describe __SUSP_URL_TLD     URL with suspicious TLD
```

```
uri      __SHORT_URL        /bit\\.ly|goo\\.gl/i
describe __SHORT_URL        Contains shortened URL
```

## Example Content Subrules:

```
rawbody  __HTML_HIDDEN      /<div[^>]+style=["']display:\\s*none["']/i
describe __HTML_HIDDEN      HTML with hidden content
```

Focus ONLY on creating detection subrules that start with EXACTLY two underscores.
DO NOT create meta rules or assign scores - these will be handled separately.
Present each subrule in its own separate code block for easy selection and copying.
"""
            base_prompt.save()
            self.stdout.write(
                self.style.SUCCESS(f"Updated base prompt: {base_prompt.name}")
            )

        # Enhanced Scoring module with more complete instructions
        scoring_module, created = PromptTemplate.objects.get_or_create(
            name="Scoring Module",
            defaults={
                "is_module": True,
                "module_type": "scoring",
                "description": "Adds scoring information to rules",
                "template": """
### Scoring Guidelines

Take the subrules from above and create meta rules that combine them, then assign scores:

1. **Meta Rule Creation**:
   ```
   meta       RULE_NAME      (__SUBRULE1 && __SUBRULE2)
   describe   RULE_NAME      Combined rule description
   ```

2. **Score Assignment**:
   ```
   score      RULE_NAME      3.0   # Justification for score
   ```

3. **Scoring Scale**:
   - 0.5-1.0: Minor indicators with high false positive risk
   - 1.0-2.0: Moderate indicators
   - 2.0-3.0: Strong indicators
   - 3.0+: Very strong indicators with low false positive risk

4. **Output Format**:
   - Present each meta rule with its score as a separate code block
   - Include a brief justification comment with each score

Remember that scores are ONLY applied to meta rules, not to subrules.
"""
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created module: {scoring_module.name}")
            )
        else:
            # Update the template if it already exists
            scoring_module.template = """
### Scoring Guidelines

Take the subrules from above and create meta rules that combine them, then assign scores:

1. **Meta Rule Creation**:
   ```
   meta       RULE_NAME      (__SUBRULE1 && __SUBRULE2)
   describe   RULE_NAME      Combined rule description
   ```

2. **Score Assignment**:
   ```
   score      RULE_NAME      3.0   # Justification for score
   ```

3. **Scoring Scale**:
   - 0.5-1.0: Minor indicators with high false positive risk
   - 1.0-2.0: Moderate indicators
   - 2.0-3.0: Strong indicators
   - 3.0+: Very strong indicators with low false positive risk

4. **Output Format**:
   - Present each meta rule with its score as a separate code block
   - Include a brief justification comment with each score

Remember that scores are ONLY applied to meta rules, not to subrules.
"""
            scoring_module.save()
            self.stdout.write(f"Updated module: {scoring_module.name}")

        # Enhanced Subrules module with better formatting instructions
        subrules_module, created = PromptTemplate.objects.get_or_create(
            name="Meta Rules Module",
            defaults={
                "is_module": True,
                "module_type": "subrules",
                "description": "Creates meta-rules that combine simpler rules",
                "template": """
### Meta Rules Construction

Take the subrules from above and create effective meta rules by combining them:

1. **Meta Rule Format**:
   ```
   meta       RULE_NAME      (__SUBRULE1 && __SUBRULE2)
   describe   RULE_NAME      Combined rule description
   ```

2. **Logical Operators**:
   - `&&` (AND): Both conditions must match
   - `||` (OR): Either condition can match
   - `!` (NOT): Invert the condition

3. **Best Practices**:
   - Create focused meta rules that target specific spam characteristics
   - Combine related subrules that reinforce each other
   - Use descriptive names without underscores for meta rules
   - Avoid overly complex combinations that are hard to understand

4. **Output Format**:
   - Present each meta rule as a separate code block
   - Group related meta rules together
   - Include clear descriptions

Example meta rule:
```
meta       SUSPICIOUS_URL_COMBO   (__SUSP_URL_TLD && (__SHORT_URL || __REDIRECT_URL))
describe   SUSPICIOUS_URL_COMBO   Combines multiple suspicious URL indicators
```
"""
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created module: {subrules_module.name}")
            )
        else:
            # Update the template if it already exists
            subrules_module.template = """
### Meta Rules Construction

Take the subrules from above and create effective meta rules by combining them:

1. **Meta Rule Format**:
   ```
   meta       RULE_NAME      (__SUBRULE1 && __SUBRULE2)
   describe   RULE_NAME      Combined rule description
   ```

2. **Logical Operators**:
   - `&&` (AND): Both conditions must match
   - `||` (OR): Either condition can match
   - `!` (NOT): Invert the condition

3. **Best Practices**:
   - Create focused meta rules that target specific spam characteristics
   - Combine related subrules that reinforce each other
   - Use descriptive names without underscores for meta rules
   - Avoid overly complex combinations that are hard to understand

4. **Output Format**:
   - Present each meta rule as a separate code block
   - Group related meta rules together
   - Include clear descriptions

Example meta rule:
```
meta       SUSPICIOUS_URL_COMBO   (__SUSP_URL_TLD && (__SHORT_URL || __REDIRECT_URL))
describe   SUSPICIOUS_URL_COMBO   Combines multiple suspicious URL indicators
```
"""
            subrules_module.save()
            self.stdout.write(f"Updated module: {subrules_module.name}")

        # Continue updating the other modules with similar improvements
        # (notes_module, uri_module, html_module)

        # Notes module
        notes_module, created = PromptTemplate.objects.get_or_create(
            name="Notes Module",
            defaults={
                "is_module": True,
                "module_type": "notes",
                "description": "Adds detailed explanations about false positives",
                "template": """
### Rule Explanations and False Positive Prevention

For the subrules and meta rules above, provide detailed explanations separated from the rule code:

1. **Explanation Format**:
   - Present explanations as markdown text, NOT within code blocks
   - Refer to rules by name and explain their purpose and design

2. **Areas to Address**:
   - How the patterns were selected to target specific spam characteristics
   - Why certain combinations were chosen for meta rules
   - Potential false positive scenarios and how they're mitigated
   - Testing recommendations before deploying in production

3. **Example**:

The `__SPAM_SUBJECT_1` rule targets emails with an explicit spam marker in the subject.
This pattern has very low false positive risk since
legitimate emails rarely contain "[SPAM]" in the subject.

The `SUSPICIOUS_URL_COMBO` meta rule combines multiple URL indicators to reduce false positives.
It requires both a suspicious TLD and either a URL shortener or redirect pattern to trigger,
which is unlikely to occur in legitimate business communications.

4. **Testing Recommendations**:
   - Suggest methods for safely testing the rules
   - Explain any thresholds or adjustments that might be needed
"""
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created module: {notes_module.name}")
            )
        else:
            # Update the template if it already exists
            notes_module.template = """
### Rule Explanations and False Positive Prevention

For the subrules and meta rules above, provide detailed explanations separated from the rule code:

1. **Explanation Format**:
   - Present explanations as markdown text, NOT within code blocks
   - Refer to rules by name and explain their purpose and design

2. **Areas to Address**:
   - How the patterns were selected to target specific spam characteristics
   - Why certain combinations were chosen for meta rules
   - Potential false positive scenarios and how they're mitigated
   - Testing recommendations before deploying in production

3. **Example**:

The `__SPAM_SUBJECT_1` rule targets emails with an explicit spam marker in the subject.
This pattern has very low false positive risk since
legitimate emails rarely contain "[SPAM]" in the subject.

The `SUSPICIOUS_URL_COMBO` meta rule combines multiple URL indicators to reduce false positives.
It requires both a suspicious TLD and either a URL shortener or redirect pattern to trigger,
which is unlikely to occur in legitimate business communications.

4. **Testing Recommendations**:
   - Suggest methods for safely testing the rules
   - Explain any thresholds or adjustments that might be needed
"""
            notes_module.save()
            self.stdout.write(f"Updated module: {notes_module.name}")

        # URI Rules module
        uri_module, created = PromptTemplate.objects.get_or_create(
            name="URI Rules Module",
            defaults={
                "is_module": True,
                "module_type": "uri",
                "description": "Adds rules for detecting suspicious URLs",
                "template": """
### URI Detection Rules

Based on the email data above, create specialized subrules to detect suspicious URLs:

1. **URI Rule Format**:
   ```
   uri      __RULE_NAME      /pattern/i
   describe __RULE_NAME      Description of URL pattern
   ```

2. **Effective Patterns to Target**:
   - Suspicious TLDs (.bid, .xyz, etc.)
   - URL shortening services
   - Numeric IP addresses in URLs
   - Misleading domains mimicking legitimate sites
   - Encoded/obfuscated URLs
   - Suspicious URL parameters

3. **Output Format**:
   - Present each URI subrule as a separate code block
   - Group similar URL patterns together
   - Use precise regex patterns to minimize false positives

Examples:

```
uri      __SUSP_TLD_BID     /\\.bid\\b/i
describe __SUSP_TLD_BID     URL using suspicious .bid TLD
```

```
uri      __URL_SHORTENER    /bit\\.ly|tinyurl\\.com/i
describe __URL_SHORTENER    URL using common shortening service
```

```
uri      __NUMERIC_IP_URL   /https?:\\/\\/\\d+\\.\\d+\\.\\d+\\.\\d+/i
describe __NUMERIC_IP_URL   URL using numeric IP address instead of domain
```
"""
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created module: {uri_module.name}")
            )
        else:
            # Update the template if it already exists
            uri_module.template = """
### URI Detection Rules

Based on the email data above, create specialized subrules to detect suspicious URLs:

1. **URI Rule Format**:
   ```
   uri      __RULE_NAME      /pattern/i
   describe __RULE_NAME      Description of URL pattern
   ```

2. **Effective Patterns to Target**:
   - Suspicious TLDs (.bid, .xyz, etc.)
   - URL shortening services
   - Numeric IP addresses in URLs
   - Misleading domains mimicking legitimate sites
   - Encoded/obfuscated URLs
   - Suspicious URL parameters

3. **Output Format**:
   - Present each URI subrule as a separate code block
   - Group similar URL patterns together
   - Use precise regex patterns to minimize false positives

Examples:

```
uri      __SUSP_TLD_BID     /\\.bid\\b/i
describe __SUSP_TLD_BID     URL using suspicious .bid TLD
```

```
uri      __URL_SHORTENER    /bit\\.ly|tinyurl\\.com/i
describe __URL_SHORTENER    URL using common shortening service
```

```
uri      __NUMERIC_IP_URL   /https?:\\/\\/\\d+\\.\\d+\\.\\d+\\.\\d+/i
describe __NUMERIC_IP_URL   URL using numeric IP address instead of domain
```
"""
            uri_module.save()
            self.stdout.write(f"Updated module: {uri_module.name}")

        # HTML Content module
        html_module, created = PromptTemplate.objects.get_or_create(
            name="HTML Content Module",
            defaults={
                "is_module": True,
                "module_type": "html",
                "description": "Adds rules for detecting suspicious HTML content",
                "template": """
### HTML Content Detection Rules

Based on the email data above, create specialized subrules to detect suspicious HTML patterns:

1. **HTML Rule Format**:
   ```
   rawbody  __RULE_NAME      /pattern/i
   describe __RULE_NAME      Description of HTML pattern
   ```

2. **Effective Patterns to Target**:
   - Hidden content (display:none, visibility:hidden)
   - Image-only emails
   - Excessive obfuscation techniques
   - Malformed HTML that might trick rendering
   - Scripts or other active content
   - Text/background color tricks

3. **Output Format**:
   - Present each HTML subrule as a separate code block
   - Group similar HTML patterns together
   - Use precise regex patterns to minimize false positives

Examples:

```
rawbody  __HTML_HIDDEN_DIV  /<div[^>]+style=["']display:\\s*none["']/i
describe __HTML_HIDDEN_DIV  HTML with hidden div content
```

```
rawbody  __HTML_INVISIBLE_TEXT  /<span[^>]+style=["']color:\\s*white["']/i
describe __HTML_INVISIBLE_TEXT  HTML with potentially invisible text
```

```
rawbody  __SINGLE_IMG_BODY  /<body[^>]*>\\s*<img[^>]+>\\s*<\\/body>/i
describe __SINGLE_IMG_BODY  Email body consists of only an image
```
"""
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created module: {html_module.name}")
            )
        else:
            # Update the template if it already exists
            html_module.template = """
### HTML Content Detection Rules

Based on the email data above, create specialized subrules to detect suspicious HTML patterns:

1. **HTML Rule Format**:
   ```
   rawbody  __RULE_NAME      /pattern/i
   describe __RULE_NAME      Description of HTML pattern
   ```

2. **Effective Patterns to Target**:
   - Hidden content (display:none, visibility:hidden)
   - Image-only emails
   - Excessive obfuscation techniques
   - Malformed HTML that might trick rendering
   - Scripts or other active content
   - Text/background color tricks

3. **Output Format**:
   - Present each HTML subrule as a separate code block
   - Group similar HTML patterns together
   - Use precise regex patterns to minimize false positives

Examples:

```
rawbody  __HTML_HIDDEN_DIV  /<div[^>]+style=["']display:\\s*none["']/i
describe __HTML_HIDDEN_DIV  HTML with hidden div content
```

```
rawbody  __HTML_INVISIBLE_TEXT  /<span[^>]+style=["']color:\\s*white["']/i
describe __HTML_INVISIBLE_TEXT  HTML with potentially invisible text
```

```
rawbody  __SINGLE_IMG_BODY  /<body[^>]*>\\s*<img[^>]+>\\s*<\\/body>/i
describe __SINGLE_IMG_BODY  Email body consists of only an image
```
"""
            html_module.save()
            self.stdout.write(f"Updated module: {html_module.name}")

        self.stdout.write(
            self.style.SUCCESS("Prompt templates initialization complete.")
        )
