"""
config/celery_beat.py — Schedule definition for Celery Beat.
"""
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    # Identity
    'purge-expired-sessions': {
        'task': 'apps.identity.tasks.purge_expired_sessions',
        'schedule': crontab(hour=3, minute=0),  # Daily at 3:00 AM
    },
    # Subscriptions
    'process-expiring-subscriptions': {
        'task': 'apps.subscriptions.tasks.process_expiring_subscriptions',
        'schedule': crontab(hour=4, minute=0),  # Daily at 4:00 AM
    },
    'mark-expired-subscriptions': {
        'task': 'apps.subscriptions.tasks.mark_expired_subscriptions',
        'schedule': crontab(hour=4, minute=30), # Daily at 4:30 AM
    },
    # Scheduling
    'fill-reminder-window': {
        'task': 'apps.scheduling.tasks.fill_reminder_window',
        'schedule': crontab(minute=0),          # Hourly
    },
    'dispatch-due-reminders': {
        'task': 'apps.scheduling.tasks.dispatch_due_reminders',
        'schedule': crontab(minute='*/2'),      # Every 2 minutes
    },
    'mark-missed-reminders': {
        'task': 'apps.scheduling.tasks.mark_missed_reminders',
        'schedule': crontab(minute='*/30'),     # Every 30 minutes
    },
    'compute-daily-adherence': {
        'task': 'apps.scheduling.tasks.compute_daily_adherence',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2:00 AM
    },
    'check-refill-alerts': {
        'task': 'apps.scheduling.tasks.check_refill_alerts',
        'schedule': crontab(hour=8, minute=0),  # Daily at 8:00 AM
    },
    # Telemetry
    'detect-consecutive-misses': {
        'task': 'apps.telemetry.tasks.detect_consecutive_misses',
        'schedule': crontab(minute=30),         # Hourly at :30
    },
    'detect-offline-devices': {
        'task': 'apps.telemetry.tasks.detect_offline_devices',
        'schedule': crontab(hour=1, minute=0),  # Daily at 1:00 AM
    },
    # Notifications
    'purge-old-notifications': {
        'task': 'apps.notifications.tasks.purge_old_notifications',
        'schedule': crontab(day_of_week='sun', hour=5, minute=0), # Weekly on Sunday 5:00 AM
    },
    
    # ─── Extensions ────────────────────────────────────────────────────────────
    'check-refill-thresholds': {
        'task': 'apps.pharmacy.tasks.check_refill_thresholds',
        'schedule': crontab(hour=8, minute=0),  # Daily at 8:00 AM
    },
    'sync-all-fhir-connections': {
        'task': 'apps.fhir_integration.tasks.sync_all_fhir_connections',
        'schedule': crontab(hour=1, minute=30), # Daily at 1:30 AM
    },
    'sync-all-abha-connections': {
        'task': 'apps.abha.tasks.sync_all_abha_connections',
        'schedule': crontab(hour=2, minute=30), # Daily at 2:30 AM
    },
    'update-all-patient-scores': {
        'task': 'apps.gamification.tasks.update_all_patient_scores',
        'schedule': crontab(hour=5, minute=30), # Daily at 5:30 AM
    },

    # ─── IoT Phase 3: Priority Scheduler ──────────────────────────────────────
    'iot-priority-scheduler': {
        'task': 'apps.iot.tasks.run_priority_scheduler',
        'schedule': crontab(minute='*/2'),          # Every 2 minutes
    },

    # ─── IoT Phase 4: Safety & Alerts ─────────────────────────────────────────
    'iot-check-missed-doses-30min': {
        'task': 'apps.iot.tasks.check_missed_doses_30min',
        'schedule': crontab(minute='*/5'),          # Every 5 minutes
    },
    'iot-check-device-heartbeats': {
        'task': 'apps.iot.tasks.check_device_heartbeats',
        'schedule': crontab(minute='*/15'),         # Every 15 minutes
    },
    'iot-expire-stale-commands': {
        'task': 'apps.iot.tasks.expire_stale_commands',
        'schedule': crontab(minute=0),              # Hourly
    },
    'iot-reset-daily-flags': {
        'task': 'apps.iot.tasks.reset_daily_dispense_flags',
        'schedule': crontab(hour=0, minute=0),      # Midnight every day
    },
}
