"""
apps/scheduling/admin.py
"""
from django.contrib import admin
from .models import ReminderJob, DoseLog, AdherenceSummary


@admin.register(ReminderJob)
class ReminderJobAdmin(admin.ModelAdmin):
    list_display  = ['__str__', 'status', 'scheduled_at', 'sent_at', 'snooze_count']
    list_filter   = ['status']
    search_fields = ['schedule__prescription__patient__patient_code',
                     'schedule__prescription__medication__name']
    readonly_fields = ['id', 'created_at', 'notification_id']
    date_hierarchy = 'scheduled_at'

    actions = ['mark_as_missed']

    @admin.action(description='Mark selected reminders as MISSED')
    def mark_as_missed(self, request, queryset):
        queryset.update(status='MISSED')


@admin.register(DoseLog)
class DoseLogAdmin(admin.ModelAdmin):
    list_display  = ['prescription', 'status', 'source', 'taken_at', 'dose_value', 'dose_unit', 'logged_by']
    list_filter   = ['status', 'source']
    search_fields = ['prescription__patient__patient_code',
                     'prescription__medication__name']
    readonly_fields = ['id', 'created_at']
    date_hierarchy  = 'taken_at'


@admin.register(AdherenceSummary)
class AdherenceSummaryAdmin(admin.ModelAdmin):
    list_display  = ['patient', 'prescription', 'period_start', 'period_type',
                     'scheduled_count', 'taken_count', 'adherence_pct']
    list_filter   = ['period_type']
    search_fields = ['patient__patient_code']
