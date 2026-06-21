from django.contrib import admin
from .models import Alert, ResourceAvailability

admin.site.register(Alert)
admin.site.register(ResourceAvailability)