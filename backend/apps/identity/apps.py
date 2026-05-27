"""
apps/identity/apps.py — Identity AppConfig.
"""
from django.apps import AppConfig


class IdentityConfig(AppConfig):
    name            = 'apps.identity'
    default_auto_field = 'django.db.models.BigAutoField'
    verbose_name    = 'Identity & Authentication'

    def ready(self):
        # Import signals
        try:
            from . import signals  # noqa: F401
        except ImportError:
            pass
