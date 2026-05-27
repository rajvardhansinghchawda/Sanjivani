"""WSGI entrypoint for the MedAdhere project.

This module is referenced by `WSGI_APPLICATION` in settings and used by
`manage.py runserver` and WSGI servers. The development settings module is
selected by default to match the project's conventions.
"""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

application = get_wsgi_application()
