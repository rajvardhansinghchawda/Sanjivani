from django.contrib import admin
from .models import CallLog, CallSession

admin.site.register(CallLog)
admin.site.register(CallSession)
