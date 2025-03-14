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
As a SpamAssassin expert, analyze this spam email data and create effective rules following these strict guidelines.

SPAM EMAIL ANALYSIS:
{HEADERS}

Email Body Samples:
{EMAIL_BODY}

## STRICT SpamAssassin Rules Instructions

Follow these precise formatting requirements:

1. **Subrule Format**:
   - All basic detection rules MUST start with double underscore: `__RULE_NAME`
   - These are subrules that will be combined into meta rules later

2. **Content Type Detection**:
   - For HTML content: Use `rawbody` instead of `body`
   - Example: `rawbody __HTML_PATTERN /pattern/i`

3. **URI Detection**:
   - For URL patterns: Use the `uri` tag, NOT `body`
   - Example: `uri __SUSPICIOUS_URL /example\.com/i`

4. **Header Format**:
   - Format: `header __HEADER_PATTERN Header-Name =~ /pattern/i`
   - Do NOT use a processed header name; use the exact header field

5. **Meta Rules**:
   - Create meta rules to combine subrules
   - Format: `meta FINAL_RULE_NAME (__SUBRULE1 && __SUBRULE2)`
   - Meta rules should NOT start with underscores

6. **Rule Documentation**:
   - Provide a `describe` line for each rule
   - Format: `describe RULE_NAME Description of what this rule detects`

7. **Scores**:
   - Only assign scores to meta rules, not subrules
   - Format: `score RULE_NAME 3.0 # Justification for score`

## Example Format:

### Suspicious URL Detection

```
# Subrules for URL detection
uri        __SUSP_URL_TLD     /\.(bid|xyz|top)$/i
describe   __SUSP_URL_TLD     URL with suspicious TLD

uri        __SHORT_URL        /bit\.ly|goo\.gl/i
describe   __SHORT_URL        Contains shortened URL

# Meta rule combining the URL subrules
meta       SUSPICIOUS_URLS    (__SUSP_URL_TLD || __SHORT_URL)
describe   SUSPICIOUS_URLS    Email contains suspicious or shortened URLs
score      SUSPICIOUS_URLS    2.5  # Moderate risk, common in spam
```

### Malicious Header Pattern

```
# Subrule for header detection
header     __FAKE_SENDER      From =~ /.*@(gmail|yahoo)\.com/i
describe   __FAKE_SENDER      Suspicious sender pattern

# Meta rule using the header subrule
meta       FORGED_SENDER      (__FAKE_SENDER && !__HAS_DKIM)
describe   FORGED_SENDER      Likely forged sender address
score      FORGED_SENDER      3.0  # High risk of forgery
```

Please create comprehensive rules following this format, focusing on patterns in the provided email data. Include explanations for each rule and justify your scoring decisions.
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
As a SpamAssassin expert, analyze this spam email data and create effective rules following these strict guidelines.

SPAM EMAIL ANALYSIS:
{HEADERS}

Email Body Samples:
{EMAIL_BODY}

## STRICT SpamAssassin Rules Instructions

Follow these precise formatting requirements:

1. **Subrule Format**:
   - All basic detection rules MUST start with double underscore: `__RULE_NAME`
   - These are subrules that will be combined into meta rules later

2. **Content Type Detection**:
   - For HTML content: Use `rawbody` instead of `body`
   - Example: `rawbody __HTML_PATTERN /pattern/i`

3. **URI Detection**:
   - For URL patterns: Use the `uri` tag, NOT `body`
   - Example: `uri __SUSPICIOUS_URL /example\.com/i`

4. **Header Format**:
   - Format: `header __HEADER_PATTERN Header-Name =~ /pattern/i`
   - Do NOT use a processed header name; use the exact header field

5. **Meta Rules**:
   - Create meta rules to combine subrules
   - Format: `meta FINAL_RULE_NAME (__SUBRULE1 && __SUBRULE2)`
   - Meta rules should NOT start with underscores

6. **Rule Documentation**:
   - Provide a `describe` line for each rule
   - Format: `describe RULE_NAME Description of what this rule detects`

7. **Scores**:
   - Only assign scores to meta rules, not subrules
   - Format: `score RULE_NAME 3.0 # Justification for score`

## Example Format:

### Suspicious URL Detection

```
# Subrules for URL detection
uri        __SUSP_URL_TLD     /\.(bid|xyz|top)$/i
describe   __SUSP_URL_TLD     URL with suspicious TLD

uri        __SHORT_URL        /bit\.ly|goo\.gl/i
describe   __SHORT_URL        Contains shortened URL

# Meta rule combining the URL subrules
meta       SUSPICIOUS_URLS    (__SUSP_URL_TLD || __SHORT_URL)
describe   SUSPICIOUS_URLS    Email contains suspicious or shortened URLs
score      SUSPICIOUS_URLS    2.5  # Moderate risk, common in spam
```

### Malicious Header Pattern

```
# Subrule for header detection
header     __FAKE_SENDER      From =~ /.*@(gmail|yahoo)\.com/i
describe   __FAKE_SENDER      Suspicious sender pattern

# Meta rule using the header subrule
meta       FORGED_SENDER      (__FAKE_SENDER && !__HAS_DKIM)
describe   FORGED_SENDER      Likely forged sender address
score      FORGED_SENDER      3.0  # High risk of forgery
```

Please create comprehensive rules following this format, focusing on patterns in the provided email data. Include explanations for each rule and justify your scoring decisions.
"""
            base_prompt.save()
            self.stdout.write(
                self.style.SUCCESS(f"Updated base prompt: {base_prompt.name}")
            )

        # Scoring module
        scoring_module, created = PromptTemplate.objects.get_or_create(
            name="Scoring Module",
            defaults={
                "is_module": True,
                "module_type": "scoring",
                "description": "Adds scoring information to rules",
                "template": """
### Scoring Guidelines

For each meta rule (not subrules), include a score value and justification:

```
score    RULE_NAME   3.0   # Justification for score
```

Suggested scoring:
- 0.5-1.0: Minor indicators with high false positive risk
- 1.0-2.0: Moderate indicators
- 2.0-3.0: Strong indicators
- 3.0+: Very strong indicators with low false positive risk

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

For each meta rule (not subrules), include a score value and justification:

```
score    RULE_NAME   3.0   # Justification for score
```

Suggested scoring:
- 0.5-1.0: Minor indicators with high false positive risk
- 1.0-2.0: Moderate indicators
- 2.0-3.0: Strong indicators
- 3.0+: Very strong indicators with low false positive risk

Remember that scores are ONLY applied to meta rules, not to subrules.
"""
            scoring_module.save()
            self.stdout.write(f"Updated module: {scoring_module.name}")

        # Subrules module
        subrules_module, created = PromptTemplate.objects.get_or_create(
            name="Subrules Module",
            defaults={
                "is_module": True,
                "module_type": "subrules",
                "description": "Creates complex meta-rules that combine simpler rules",
                "template": """
### Meta Rules Construction

Create effective meta rules by combining subrules for better detection:

```
# First create individual subrules with double underscore prefix
header   __SPAM_HEADER_1   From =~ /pattern1/i
uri      __SPAM_URI_1      /pattern2/i

# Then combine them with a meta rule (no underscores)
meta     SPAM_META         (__SPAM_HEADER_1 && __SPAM_URI_1)
describe SPAM_META         Combined spam patterns
score    SPAM_META         2.5   # Moderate confidence, reasonable risk
```

Use logical operators (&&, ||, !) to create sophisticated combinations:
- `&&` (AND): Both conditions must match
- `||` (OR): Either condition can match
- `!` (NOT): Invert the condition

Avoid creating too many individual rules - it's better to have fewer, more comprehensive meta rules that combine multiple indicators.
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

Create effective meta rules by combining subrules for better detection:

```
# First create individual subrules with double underscore prefix
header   __SPAM_HEADER_1   From =~ /pattern1/i
uri      __SPAM_URI_1      /pattern2/i

# Then combine them with a meta rule (no underscores)
meta     SPAM_META         (__SPAM_HEADER_1 && __SPAM_URI_1)
describe SPAM_META         Combined spam patterns
score    SPAM_META         2.5   # Moderate confidence, reasonable risk
```

Use logical operators (&&, ||, !) to create sophisticated combinations:
- `&&` (AND): Both conditions must match
- `||` (OR): Either condition can match
- `!` (NOT): Invert the condition

Avoid creating too many individual rules - it's better to have fewer, more comprehensive meta rules that combine multiple indicators.
"""
            subrules_module.save()
            self.stdout.write(f"Updated module: {subrules_module.name}")

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
2. **URI Rules**: How pattern specificity reduces false matches
3. **Meta Rules Advantage**: Explain how combining multiple indicators reduces false positives
4. **Testing Recommendations**: Suggest ways to test the rules in a safe environment

For each meta rule that has a high risk of false positives, include specific notes:

```
# Note: META_RULE is specific enough to avoid matching legitimate communications
# because it requires multiple specific patterns to match simultaneously:
#  - __SUBRULE1 matches specific spam pattern A
#  - __SUBRULE2 matches specific spam pattern B
#  - Legitimate emails rarely contain both patterns
```
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
### False Positive Prevention

Include notes on how your rules minimize false positives:

1. **Header Rules**: How specific patterns prevent matching legitimate emails
2. **URI Rules**: How pattern specificity reduces false matches
3. **Meta Rules Advantage**: Explain how combining multiple indicators reduces false positives
4. **Testing Recommendations**: Suggest ways to test the rules in a safe environment

For each meta rule that has a high risk of false positives, include specific notes:

```
# Note: META_RULE is specific enough to avoid matching legitimate communications
# because it requires multiple specific patterns to match simultaneously:
#  - __SUBRULE1 matches specific spam pattern A
#  - __SUBRULE2 matches specific spam pattern B
#  - Legitimate emails rarely contain both patterns
```
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

Create specialized rules to detect suspicious URLs in emails:

```
# Subrules for URL pattern detection
uri      __SUSP_URI_PATTERN    /suspicious-pattern/i
describe __SUSP_URI_PATTERN    URL containing suspicious pattern

uri      __SHORT_URL_SERVICE   /bit\.ly|tinyurl|goo\.gl/i
describe __SHORT_URL_SERVICE   URL using a link shortening service

# Meta rule combining URI patterns
meta     SUSPICIOUS_LINKS      (__SUSP_URI_PATTERN || __SHORT_URL_SERVICE)
describe SUSPICIOUS_LINKS      Email contains suspicious URL patterns
score    SUSPICIOUS_LINKS      2.0   # Medium risk - many spam emails use questionable links
```

Focus on detecting:
- Suspicious TLDs (.bid, .xyz, etc.)
- URL shortening services
- Numeric IP addresses in URLs
- Misleading domains that mimic legitimate sites
- Encoded/obfuscated URLs
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

Create specialized rules to detect suspicious URLs in emails:

```
# Subrules for URL pattern detection
uri      __SUSP_URI_PATTERN    /suspicious-pattern/i
describe __SUSP_URI_PATTERN    URL containing suspicious pattern

uri      __SHORT_URL_SERVICE   /bit\.ly|tinyurl|goo\.gl/i
describe __SHORT_URL_SERVICE   URL using a link shortening service

# Meta rule combining URI patterns
meta     SUSPICIOUS_LINKS      (__SUSP_URI_PATTERN || __SHORT_URL_SERVICE)
describe SUSPICIOUS_LINKS      Email contains suspicious URL patterns
score    SUSPICIOUS_LINKS      2.0   # Medium risk - many spam emails use questionable links
```

Focus on detecting:
- Suspicious TLDs (.bid, .xyz, etc.)
- URL shortening services
- Numeric IP addresses in URLs
- Misleading domains that mimic legitimate sites
- Encoded/obfuscated URLs
"""
            uri_module.save()
            self.stdout.write(f"Updated module: {uri_module.name}")

        # HTML Content module - new module
        html_module, created = PromptTemplate.objects.get_or_create(
            name="HTML Content Module",
            defaults={
                "is_module": True,
                "module_type": "html",
                "description": "Adds rules for detecting suspicious HTML content",
                "template": """
### HTML Content Detection Rules

Create specialized rules to detect suspicious HTML patterns in emails:

```
# Subrules for HTML pattern detection
rawbody  __HTML_OBFUSCATION    /<div[^>]+style=["']display:\\s*none["']/i
describe __HTML_OBFUSCATION    HTML with hidden content 

rawbody  __SINGLE_IMAGE_BODY   /<body[^>]*>\\s*<img[^>]+>\\s*<\\/body>/i
describe __SINGLE_IMAGE_BODY   Email body consists of only an image

# Meta rule combining HTML patterns
meta     SUSPICIOUS_HTML       (__HTML_OBFUSCATION || __SINGLE_IMAGE_BODY)
describe SUSPICIOUS_HTML       Email contains suspicious HTML patterns
score    SUSPICIOUS_HTML       2.5   # Higher risk - specifically crafted to evade text filters
```

Focus on detecting:
- Hidden content (display:none, visibility:hidden, etc.)
- Image-only emails
- Excessive obfuscation techniques
- Malformed HTML that might trick rendering engines
- Scripts or other active content
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

Create specialized rules to detect suspicious HTML patterns in emails:

```
# Subrules for HTML pattern detection
rawbody  __HTML_OBFUSCATION    /<div[^>]+style=["']display:\\s*none["']/i
describe __HTML_OBFUSCATION    HTML with hidden content 

rawbody  __SINGLE_IMAGE_BODY   /<body[^>]*>\\s*<img[^>]+>\\s*<\\/body>/i
describe __SINGLE_IMAGE_BODY   Email body consists of only an image

# Meta rule combining HTML patterns
meta     SUSPICIOUS_HTML       (__HTML_OBFUSCATION || __SINGLE_IMAGE_BODY)
describe SUSPICIOUS_HTML       Email contains suspicious HTML patterns
score    SUSPICIOUS_HTML       2.5   # Higher risk - specifically crafted to evade text filters
```

Focus on detecting:
- Hidden content (display:none, visibility:hidden, etc.)
- Image-only emails
- Excessive obfuscation techniques
- Malformed HTML that might trick rendering engines
- Scripts or other active content
"""
            html_module.save()
            self.stdout.write(f"Updated module: {html_module.name}")

        self.stdout.write(
            self.style.SUCCESS("Prompt templates initialization complete.")
        )
