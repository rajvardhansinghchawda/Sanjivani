# apps/triage/admin.py
"""
Admin interface for EmergencyCase — critical for the learner feedback loop.
Supervisors and medical directors use this to review flagged cases.
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import EmergencyCase


@admin.register(EmergencyCase)
class EmergencyCaseAdmin(admin.ModelAdmin):

    list_display  = [
        'case_id', 'patient_name', 'patient_age',
        'ai_p_level_badge', 'actual_p_level', 'ai_doctor_category',
        'status', 'triage_accuracy', 'created_at',
    ]
    list_filter   = [
        'ai_p_level', 'status', 'ai_confidence',
        'was_undertriaged', 'was_overtriaged', 'ai_requires_ambulance',
        ('created_at', admin.DateFieldListFilter),
    ]
    search_fields = ['case_id', 'patient_name', 'patient_phone', 'raw_symptoms_text']
    readonly_fields = [
        'id', 'case_id', 'created_at', 'was_undertriaged', 'was_overtriaged',
        'ai_reasoning', 'routing_explanation', 'needs_profile',
        'recommended_hospitals', 'ai_red_flags', 'ai_possible_conditions',
    ]
    ordering = ['-created_at']

    fieldsets = (
        ('Patient', {
            'fields': ('case_id', 'patient_name', 'patient_age', 'patient_phone',
                       'patient_gender', 'patient_lat', 'patient_lng')
        }),
        ('Raw Input', {
            'fields': ('raw_symptoms_text', 'known_conditions'),
        }),
        ('AI Triage Output', {
            'fields': (
                'ai_p_level', 'ai_severity_label', 'ai_doctor_category',
                'ai_confidence', 'ai_reasoning', 'ai_red_flags',
                'ai_possible_conditions', 'ai_requires_ambulance',
                'ai_requires_icu', 'ai_was_escalated',
            ),
        }),
        ('Care Needs & Routing', {
            'fields': ('needs_profile', 'recommended_hospitals',
                       'top_hospital', 'routing_explanation'),
        }),
        ('Case Status', {
            'fields': ('status', 'created_at', 'resolved_at'),
        }),
        ('Outcome (Learner Loop)', {
            'fields': ('actual_p_level', 'outcome_notes',
                       'was_undertriaged', 'was_overtriaged', 'reviewed_by'),
            'description': (
                'Fill in the actual outcome after the patient is assessed. '
                'Under-triage (actual > AI score) is automatically flagged for model review.'
            ),
        }),
    )

    def ai_p_level_badge(self, obj):
        colors = {'P1': '#dc2626', 'P2': '#d97706', 'P3': '#2563eb', 'P4': '#16a34a'}
        color  = colors.get(obj.ai_p_level, '#888')
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;border-radius:12px;'
            'font-weight:700;font-size:12px;">{}</span>',
            color, obj.ai_p_level or '—'
        )
    ai_p_level_badge.short_description = 'AI Level'

    def triage_accuracy(self, obj):
        if obj.was_undertriaged:
            return format_html(
                '<span style="color:#dc2626;font-weight:700;">⬆ UNDER-TRIAGED</span>'
            )
        if obj.was_overtriaged:
            return format_html(
                '<span style="color:#d97706;font-weight:700;">⬇ Over-triaged</span>'
            )
        if obj.actual_p_level:
            return format_html(
                '<span style="color:#16a34a;font-weight:700;">✓ Correct</span>'
            )
        return '—'
    triage_accuracy.short_description = 'Accuracy'
