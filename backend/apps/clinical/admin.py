"""
apps/clinical/admin.py
"""
from django.contrib import admin
from .models import (
    Patient, PatientCondition, Caregiver, PatientCaregiverLink,
    Medication, DrugInteraction, Prescription, MedicationSchedule,
)


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display  = ['patient_code', 'user', 'timezone', 'is_hospitalized', 'created_at']
    list_filter   = ['is_hospitalized', 'gender', 'cognitive_status']
    search_fields = ['patient_code', 'user__email', 'user__full_name']
    readonly_fields = ['patient_code', 'id', 'created_at']


@admin.register(Medication)
class MedicationAdmin(admin.ModelAdmin):
    list_display  = ['name', 'generic_name', 'form', 'drug_class', 'is_verified', 'is_controlled_substance']
    list_filter   = ['form', 'is_verified', 'is_controlled_substance', 'requires_food']
    search_fields = ['name', 'generic_name', 'brand_name', 'barcode']
    actions       = ['mark_verified']

    @admin.action(description='Mark selected medications as verified')
    def mark_verified(self, request, queryset):
        queryset.update(is_verified=True)


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display  = ['patient', 'medication', 'dosage_value', 'dosage_unit', 'is_active', 'start_date', 'end_date']
    list_filter   = ['is_active']
    search_fields = ['patient__patient_code', 'patient__user__email', 'medication__name']
    raw_id_fields = ['patient', 'medication']


@admin.register(PatientCaregiverLink)
class PatientCaregiverLinkAdmin(admin.ModelAdmin):
    list_display = ['patient', 'caregiver', 'permission_level', 'is_active', 'accepted_at']
    list_filter  = ['permission_level', 'is_active']


@admin.register(Caregiver)
class CaregiverAdmin(admin.ModelAdmin):
    list_display = ['user', 'is_professional', 'specialty', 'organization_name']

@admin.register(DrugInteraction)
class DrugInteractionAdmin(admin.ModelAdmin):
    list_display  = ['medication_a', 'medication_b', 'severity']
    list_filter   = ['severity']
    search_fields = ['medication_a__name', 'medication_b__name']
