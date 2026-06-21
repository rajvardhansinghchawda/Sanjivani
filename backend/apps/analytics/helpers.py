# apps/analytics/helpers.py
from datetime import date, timedelta
from django.utils import timezone


def parse_date_range(request, default_days=30):
    """
    Parses ?from_date=2024-01-01&to_date=2024-01-31 from query params.
    Falls back to last N days if not provided.
    Returns (start: datetime, end: datetime, label: str)
    """
    from_str = request.query_params.get('from_date')
    to_str   = request.query_params.get('to_date')

    try:
        start = date.fromisoformat(from_str) if from_str else (timezone.now() - timedelta(days=default_days)).date()
        end   = date.fromisoformat(to_str)   if to_str   else timezone.now().date()
    except ValueError:
        start = (timezone.now() - timedelta(days=default_days)).date()
        end   = timezone.now().date()

    return (
        timezone.make_aware(timezone.datetime.combine(start, timezone.datetime.min.time())),
        timezone.make_aware(timezone.datetime.combine(end,   timezone.datetime.max.time())),
        f'{start} to {end}',
    )


def get_date_trunc_series(start, end, trunc='day'):
    """
    Generates a list of date labels between start and end.
    Used to fill zero-value gaps in time-series charts.
    """
    from django.db.models.functions import TruncDay, TruncMonth, TruncWeek

    labels  = []
    current = start.date()
    delta   = timedelta(days=1) if trunc == 'day' else timedelta(days=7) if trunc == 'week' else timedelta(days=30)

    while current <= end.date():
        labels.append(str(current))
        current += delta

    return labels   