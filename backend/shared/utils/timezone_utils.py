"""
shared/utils/timezone_utils.py — Timezone-aware datetime helpers.
"""
import pytz
from datetime import datetime, date, time, timedelta
from django.utils import timezone


def localize_to_patient(dt: datetime, patient_timezone: str) -> datetime:
    """Convert a UTC datetime to patient's local timezone."""
    tz = pytz.timezone(patient_timezone)
    return dt.astimezone(tz)


def patient_local_to_utc(local_naive: datetime, patient_timezone: str) -> datetime:
    """Convert a naive local datetime to UTC, handling DST correctly."""
    tz = pytz.timezone(patient_timezone)
    local_aware = tz.localize(local_naive, is_dst=None)
    return local_aware.astimezone(pytz.UTC)


def compute_dose_windows(
    times_of_day: list,
    patient_timezone: str,
    start_date: date,
    days: int = 30,
) -> list:
    """
    Generate all dose windows for the given number of days.
    Returns list of dicts: {scheduled_at (UTC), scheduled_local, dose, time_label}
    """
    tz = pytz.timezone(patient_timezone)
    windows = []

    for day_offset in range(days):
        local_date = start_date + timedelta(days=day_offset)
        for entry in times_of_day:
            time_str = entry.get('time', '08:00')
            hour, minute = map(int, time_str.split(':'))
            local_naive = datetime.combine(local_date, time(hour, minute))
            try:
                local_aware = tz.localize(local_naive, is_dst=None)
            except pytz.exceptions.AmbiguousTimeError:
                local_aware = tz.localize(local_naive, is_dst=False)
            except pytz.exceptions.NonExistentTimeError:
                local_aware = tz.localize(
                    local_naive + timedelta(hours=1), is_dst=True
                )

            utc_time = local_aware.astimezone(pytz.UTC)
            windows.append({
                'scheduled_at':    utc_time,
                'scheduled_local': local_aware,
                'dose':            entry.get('dose', 1.0),
                'with_food':       entry.get('with_food', False),
                'time_label':      time_str,
            })

    return windows


def is_in_quiet_hours(user, send_at: datetime) -> bool:
    """Check if send_at falls in user's quiet hours (in user's timezone)."""
    try:
        prefs = user.notification_preferences
        if not prefs.quiet_hours_start or not prefs.quiet_hours_end:
            return False
        tz = pytz.timezone(user.patient_profile.timezone)
        local_time = send_at.astimezone(tz).time()
        start = prefs.quiet_hours_start
        end   = prefs.quiet_hours_end
        if start < end:
            return start <= local_time <= end
        else:  # spans midnight
            return local_time >= start or local_time <= end
    except Exception:
        return False
