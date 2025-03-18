"""
Management command to initialize default prompt templates.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import PromptTemplate, UserProfile


class Command(BaseCommand):
    """Initialize default prompt templates."""

    help = "Initialize default prompt templates"

    def add_arguments(self, parser):
        parser.add_argument(
            "--user",
            type=str,
            help="Username of admin user to set as creator for system prompts",
        )

    def handle(self, *args, **options):
        # Find the admin user to use as creator
        admin_user = None

        # Check for specified user
        if options.get("user"):
            username = options.get("user")
            try:
                user = User.objects.get(username=username)
                # Verify user is an admin
                try:
                    if user.profile.is_admin:
                        admin_user = user
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"Using specified admin user '{username}' as creator"
                            )
                        )
                    else:
                        self.stdout.write(
                            self.style.WARNING(
                                f"User '{username}' is not an admin. "
                                f"Will look for another admin user."
                            )
                        )
                except UserProfile.DoesNotExist:
                    self.stdout.write(
                        self.style.WARNING(
                            f"User '{username}' has no profile. "
                            f"Will look for another admin user."
                        )
                    )
            except User.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(
                        f"User '{username}' not found. Will look for another admin user."
                    )
                )

        # If no valid admin user specified, look for any admin
        if not admin_user:
            # Find users with admin profile
            try:
                admin_profile = UserProfile.objects.filter(
                    role=UserProfile.ADMIN
                ).first()
                if admin_profile:
                    admin_user = admin_profile.user
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Using admin user '{admin_user.username}' as creator"
                        )
                    )
                else:
                    # If no admin profile found, try to use a superuser
                    superuser = User.objects.filter(is_superuser=True).first()
                    if superuser:
                        admin_user = superuser
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"Using superuser '{admin_user.username}' as creator"
                            )
                        )
                    else:
                        self.stdout.write(
                            self.style.WARNING(
                                "No admin user found. Templates will be created without a creator."
                            )
                        )
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(
                        f"Error finding admin user: {str(e)}. "
                        f"Templates will be created without a creator."
                    )
                )

        # Base prompt - minimalist with core instructions only
        base_prompt, created = PromptTemplate.objects.get_or_create(
            name="Base SpamAssassin Rule Generation",
            defaults={
                "is_base": True,
                "description": ("Minimalist prompt for generating basic SpamAssassin " +
                                "subrules with spam vs ham analysis"),
                "created_by": admin_user,
                "visibility": PromptTemplate.GLOBAL,
                "template": """
As a SpamAssassin expert, analyze this spam email data and create effective detection subrules.

SPAM EMAIL ANALYSIS:
{HEADERS}

Email Body Samples:
{EMAIL_BODY}

## Core Requirements

1. Create detection subrules that start with EXACTLY two underscores: `__RULE_NAME`
2. Each subrule must have a corresponding describe line
3. Present each subrule in its own code block
4. DO NOT create meta rules or assign scores
5. When creating rules, prioritize patterns unique to spam emails and
avoid patterns common in legitimate emails

## Basic Example:

```
header   __SPAM_SUBJECT   Subject =~ /pattern/i
describe __SPAM_SUBJECT   Subject line contains suspicious pattern
```
""",
            },
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

## Core Requirements

1. Create detection subrules that start with EXACTLY two underscores: `__RULE_NAME`
2. Each subrule must have a corresponding describe line
3. Present each subrule in its own code block
4. DO NOT create meta rules or assign scores
5. When creating rules, prioritize patterns unique to spam emails and avoid patterns common in
legitimate emails

## Basic Example:

```
header   __SPAM_SUBJECT   Subject =~ /pattern/i
describe __SPAM_SUBJECT   Subject line contains suspicious pattern
```
"""
            # Update creator if it's not set and we have an admin user
            if not base_prompt.created_by and admin_user:
                base_prompt.created_by = admin_user

            # Ensure global visibility
            base_prompt.visibility = PromptTemplate.GLOBAL

            base_prompt.save()
            self.stdout.write(
                self.style.SUCCESS(f"Updated base prompt: {base_prompt.name}")
            )

        # Enhanced Scoring module
        scoring_module, created = PromptTemplate.objects.get_or_create(
            name="Scoring Module",
            defaults={
                "is_module": True,
                "module_type": "scoring",
                "description": "Adds scoring information to rules",
                "created_by": admin_user,
                "visibility": PromptTemplate.GLOBAL,
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
""",
            },
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
            # Update creator if it's not set and we have an admin user
            if not scoring_module.created_by and admin_user:
                scoring_module.created_by = admin_user

            # Ensure global visibility
            scoring_module.visibility = PromptTemplate.GLOBAL

            scoring_module.save()
            self.stdout.write(f"Updated module: {scoring_module.name}")

        # Meta Rules module
        subrules_module, created = PromptTemplate.objects.get_or_create(
            name="Meta Rules Module",
            defaults={
                "is_module": True,
                "module_type": "subrules",
                "description": "Creates meta-rules that combine simpler rules",
                "created_by": admin_user,
                "visibility": PromptTemplate.GLOBAL,
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

Example meta rule:
```
meta       SUSPICIOUS_URL_COMBO   (__SUSP_URL_TLD && (__SHORT_URL || __REDIRECT_URL))
describe   SUSPICIOUS_URL_COMBO   Combines multiple suspicious URL indicators
```
""",
            },
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

Example meta rule:
```
meta       SUSPICIOUS_URL_COMBO   (__SUSP_URL_TLD && (__SHORT_URL || __REDIRECT_URL))
describe   SUSPICIOUS_URL_COMBO   Combines multiple suspicious URL indicators
```
"""
            # Update creator if it's not set and we have an admin user
            if not subrules_module.created_by and admin_user:
                subrules_module.created_by = admin_user

            # Ensure global visibility
            subrules_module.visibility = PromptTemplate.GLOBAL

            subrules_module.save()
            self.stdout.write(f"Updated module: {subrules_module.name}")

        # Notes module
        notes_module, created = PromptTemplate.objects.get_or_create(
            name="Notes Module",
            defaults={
                "is_module": True,
                "module_type": "notes",
                "description": "Adds detailed explanations about false positives",
                "created_by": admin_user,
                "visibility": PromptTemplate.GLOBAL,
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
""",
            },
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
            # Update creator if it's not set and we have an admin user
            if not notes_module.created_by and admin_user:
                notes_module.created_by = admin_user

            # Ensure global visibility
            notes_module.visibility = PromptTemplate.GLOBAL

            notes_module.save()
            self.stdout.write(f"Updated module: {notes_module.name}")

        # URI Rules module
        uri_module, created = PromptTemplate.objects.get_or_create(
            name="URI Rules Module",
            defaults={
                "is_module": True,
                "module_type": "uri",
                "description": "Adds rules for detecting suspicious URLs",
                "created_by": admin_user,
                "visibility": PromptTemplate.GLOBAL,
                "template": """
### URI Detection Rules

Create specialized subrules to detect suspicious URLs in the email data:

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

Examples:

```
uri      __SUSP_TLD_BID     /\\.bid\\b/i
describe __SUSP_TLD_BID     URL using suspicious .bid TLD
```

```
uri      __URL_SHORTENER    /bit\\.ly|tinyurl\\.com/i
describe __URL_SHORTENER    URL using common shortening service
```
""",
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created module: {uri_module.name}"))
        else:
            # Update the template if it already exists
            uri_module.template = """
### URI Detection Rules

Create specialized subrules to detect suspicious URLs in the email data:

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

Examples:

```
uri      __SUSP_TLD_BID     /\\.bid\\b/i
describe __SUSP_TLD_BID     URL using suspicious .bid TLD
```

```
uri      __URL_SHORTENER    /bit\\.ly|tinyurl\\.com/i
describe __URL_SHORTENER    URL using common shortening service
```
"""
            # Update creator if it's not set and we have an admin user
            if not uri_module.created_by and admin_user:
                uri_module.created_by = admin_user

            # Ensure global visibility
            uri_module.visibility = PromptTemplate.GLOBAL

            uri_module.save()
            self.stdout.write(f"Updated module: {uri_module.name}")

        # HTML Content module
        html_module, created = PromptTemplate.objects.get_or_create(
            name="HTML Content Module",
            defaults={
                "is_module": True,
                "module_type": "html",
                "description": "Adds rules for detecting suspicious HTML content",
                "created_by": admin_user,
                "visibility": PromptTemplate.GLOBAL,
                "template": """
### HTML Content Detection Rules

Create specialized subrules to detect suspicious HTML patterns in the email:

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

Examples:

```
rawbody  __HTML_HIDDEN_DIV  /<div[^>]+style=["']display:\\s*none["']/i
describe __HTML_HIDDEN_DIV  HTML with hidden div content
```

```
rawbody  __HTML_INVISIBLE_TEXT  /<span[^>]+style=["']color:\\s*white["']/i
describe __HTML_INVISIBLE_TEXT  HTML with potentially invisible text
```
""",
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created module: {html_module.name}"))
        else:
            # Update the template if it already exists
            html_module.template = """
### HTML Content Detection Rules

Create specialized subrules to detect suspicious HTML patterns in the email:

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

Examples:

```
rawbody  __HTML_HIDDEN_DIV  /<div[^>]+style=["']display:\\s*none["']/i
describe __HTML_HIDDEN_DIV  HTML with hidden div content
```

```
rawbody  __HTML_INVISIBLE_TEXT  /<span[^>]+style=["']color:\\s*white["']/i
describe __HTML_INVISIBLE_TEXT  HTML with potentially invisible text
```
"""
            # Update creator if it's not set and we have an admin user
            if not html_module.created_by and admin_user:
                html_module.created_by = admin_user

            # Ensure global visibility
            html_module.visibility = PromptTemplate.GLOBAL

            html_module.save()
            self.stdout.write(f"Updated module: {html_module.name}")

        if admin_user:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Prompt templates initialization complete. Creator: {admin_user.username}"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    "Prompt templates initialization complete. No creator assigned."
                )
            )
