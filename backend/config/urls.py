# config/urls.py
from django.contrib import admin
from django.urls import path, include
from apps.analytics.views import AdherenceExportView

urlpatterns = [
    path('admin/',          admin.site.urls),
    path('api/auth/',       include('apps.authentication.urls')),
    path('api/hospitals/',  include('apps.hospitals.urls')),
    path('api/beds/',       include('apps.beds.urls')),
    path('api/patients/',   include('apps.patients.urls')),
    path('api/ambulances/', include('apps.ambulances.urls')),
    path('api/supervisor/', include('apps.supervisors.urls')),
    path('api/analytics/',  include('apps.analytics.urls')),
    path('api/calls/',      include('apps.calls.urls')),
    path('api/resources/',  include('apps.resources.urls')),
    path('api/triage/',     include('apps.triage.urls')),
    path('api/v1/adherence/export/', AdherenceExportView.as_view(), name='adherence-export'),
]
