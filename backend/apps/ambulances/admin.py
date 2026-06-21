from django.contrib import admin
from .models import Ambulance, AmbulanceRequest

admin.site.register(Ambulance)
admin.site.register(AmbulanceRequest)