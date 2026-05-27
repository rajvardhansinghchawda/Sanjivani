from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DoctorProfileViewSet,
    DoctorPatientLinkViewSet,
    DigitalPrescriptionViewSet,
    ConsultationSessionViewSet,
)

router = DefaultRouter()
router.register(r'profiles',      DoctorProfileViewSet,       basename='doctor-profile')
router.register(r'links',         DoctorPatientLinkViewSet,   basename='doctor-link')
router.register(r'prescriptions', DigitalPrescriptionViewSet, basename='digital-prescription')
router.register(r'consultations', ConsultationSessionViewSet, basename='consultation')

urlpatterns = [
    path('', include(router.urls)),
]
