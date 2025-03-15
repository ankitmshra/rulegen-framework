"""
Application configuration for the core app.
"""

from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Configuration for the core app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        """Import signals when app is ready."""
        import core.signals  # noqa
