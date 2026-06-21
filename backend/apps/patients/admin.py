from django.contrib import admin
from .models import Patient, TransferRequest

admin.site.register(Patient)
admin.site.register(TransferRequest)