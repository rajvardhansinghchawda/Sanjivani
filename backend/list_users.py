import os
import django
import sys
from pathlib import Path

# Setup Django
BASE_DIR = Path(__file__).resolve().parents[0]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.identity.models import User

def list_users():
    users = User.objects.all()
    print(f"--- Listing All Users ({users.count()}) ---")
    for u in users:
        print(f"ID: {u.id} | Email: {u.email} | Role: {u.role}")

if __name__ == '__main__':
    list_users()
