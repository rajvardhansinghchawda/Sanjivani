import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.conf import settings
settings.TWILIO_AUTH_TOKEN = 'wrong_token'
from apps.calls.services import make_user_agent_call
try:
    make_user_agent_call('+919999999999', '1234')
    print('Success')
except Exception as e:
    print('Exception:', str(e))
