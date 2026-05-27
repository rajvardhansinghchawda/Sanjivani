"""
apps/clinical/apps.py
"""
from django.apps import AppConfig


class ClinicalConfig(AppConfig):
    name         = 'apps.clinical'
    verbose_name = 'Clinical Data'

    def ready(self):
        try:
            from . import signals  # noqa
        except ImportError:
            pass
