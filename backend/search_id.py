import os
import django
import uuid
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.apps import apps
target_id = '626186a8-4bd0-dbf8-7eb1-56ad48d44042'
# Or maybe UUID format?
try:
    uid = uuid.UUID('626186a84bd0dbf87eb156ad48d44042')
except Exception:
    uid = None

for model in apps.get_models():
    try:
        if uid:
            obj = model.objects.filter(pk=uid).first()
            if obj:
                print(f'Found in model (UUID): {model.__name__}')
                break
        obj = model.objects.filter(pk=target_id).first()
        if obj:
            print(f'Found in model (str): {model.__name__}')
            break
    except Exception:
        pass
