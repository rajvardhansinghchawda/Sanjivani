from django.contrib import admin
from .models import Bed, BedAllocation, MedicalEquipment

admin.site.register(Bed)
admin.site.register(BedAllocation)
admin.site.register(MedicalEquipment)