import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.hospitals.models import Hospital
hospitals = Hospital.objects.all()
for h in hospitals:
    print(f"Hospital Name: '{h.name}', City: '{h.city}'")
