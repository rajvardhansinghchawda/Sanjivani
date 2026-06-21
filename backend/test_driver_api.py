import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import RequestFactory
from apps.authentication.models import User
from apps.ambulances.views import DriverDashboardView
from rest_framework.test import force_authenticate

user = User.objects.get(email='driver1@indorecarehospital.com')
print(f"Testing DriverDashboardView for {user.email}...")

factory = RequestFactory()
request = factory.get('/api/ambulances/driver/dashboard/')
force_authenticate(request, user=user)

view = DriverDashboardView.as_view()
response = view(request)

print(f"Status Code: {response.status_code}")
print(f"Response Data: {response.data}")
