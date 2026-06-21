from django.contrib import admin
from .models import Hospital, Department, ServiceCategory, ServiceMaster, HospitalService, HospitalRegistration, Doctor, DutySchedule

admin.site.register(Hospital)
admin.site.register(Department)
admin.site.register(ServiceCategory)
admin.site.register(ServiceMaster)
admin.site.register(HospitalService)
admin.site.register(HospitalRegistration)
admin.site.register(Doctor)
admin.site.register(DutySchedule)