import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('medadhere')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# ─── Celery Beat Schedule ─────────────────────────────────────────────────────
app.conf.beat_schedule = {
    # Subscriptions
    'subscription-expiry-check': {
        'task': 'apps.subscriptions.tasks.check_subscription_expiries',
        'schedule': crontab(hour=1, minute=0),
    },
    # IoT heartbeat monitor
    'device-heartbeat-monitor': {
        'task': 'apps.iot.tasks.check_device_heartbeats',
        'schedule': crontab(minute='*/5'),
    },
    # Refill alerts
    'refill-alerts': {
        'task': 'apps.clinical.tasks.send_refill_alerts',
        'schedule': crontab(hour=9, minute=0),
    },
    # Session cleanup
    'purge-expired-sessions': {
        'task': 'apps.identity.tasks.purge_expired_sessions',
        'schedule': crontab(minute=0),
    },
    # Weekly adherence report pre-compute
    'weekly-adherence-reports': {
        'task': 'apps.telemetry.tasks.generate_weekly_adherence_reports',
        'schedule': crontab(hour=6, minute=0, day_of_week=1),
    },
    # AI batch risk scoring
    'nightly-risk-scoring': {
        'task': 'ai_engine.batch_risk_score_all',
        'schedule': crontab(hour=2, minute=0),
    },

    # ── Medication Scheduling ─────────────────────────────────────────────────

    # Every 2 min: push due reminder notifications to patients
    'dispatch-due-reminders': {
        'task': 'apps.scheduling.tasks.dispatch_due_reminders',
        'schedule': crontab(minute='*/2'),
    },
    # Every 5 min: mark overdue doses as MISSED + alert caregivers
    'mark-missed-reminders': {
        'task': 'apps.scheduling.tasks.mark_missed_reminders',
        'schedule': crontab(minute='*/5'),
    },
    # Hourly: generate ReminderJob rows for rolling 7-day window
    'fill-reminder-window': {
        'task': 'apps.scheduling.tasks.fill_reminder_window',
        'schedule': crontab(minute=0),
    },
    # Nightly: compute & store AdherenceSummary for each patient
    'compute-daily-adherence': {
        'task': 'apps.scheduling.tasks.compute_daily_adherence',
        'schedule': crontab(hour=0, minute=30),  # 12:30 AM UTC (after midnight IST)
    },
    # 12:01 AM: generate next day's ReminderJobs + auto-deactivate expired prescriptions
    'generate-next-day-reminders': {
        'task': 'apps.scheduling.tasks.generate_next_day_reminders',
        'schedule': crontab(hour=0, minute=1),
    },
}

# Merge Extensions (Phases 13-28)
try:
    from medadhere_extensions_handover import MEDADHERE_EXTENSION_BEAT_SCHEDULE
    app.conf.beat_schedule.update(MEDADHERE_EXTENSION_BEAT_SCHEDULE)
except ImportError:
    pass
