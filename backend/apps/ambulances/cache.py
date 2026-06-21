# apps/ambulances/cache.py
from django.core.cache import cache

# ── Key patterns ──────────────────────────────────────────────
def _city_ambulances_key(city):
    return f'city:{city.lower().strip()}:available_ambulances'

def _ambulance_status_key(ambulance_id):
    return f'ambulance:{ambulance_id}:status'

def _ambulance_location_key(ambulance_id):
    return f'ambulance:{ambulance_id}:location'

def _active_request_key(ambulance_id):
    return f'ambulance:{ambulance_id}:active_request'


# ── TTLs ──────────────────────────────────────────────────────
CITY_LIST_TTL    = 60    # 1 min — availability changes fast
STATUS_TTL       = 120   # 2 min
LOCATION_TTL     = 30    # 30 sec — location updates frequently
REQUEST_TTL      = 3600  # 1 hour — active trip


# ── Available ambulances by city ──────────────────────────────
def get_available_ambulances_in_city(city):
    """
    Returns cached list of available ambulance summaries for a city.
    Used by the patient portal to show nearby options.
    """
    key  = _city_ambulances_key(city)
    data = cache.get(key)
    if data is None:
        data = _compute_city_ambulances(city)
        cache.set(key, data, CITY_LIST_TTL)
    return data


def _compute_city_ambulances(city):
    from apps.ambulances.models import Ambulance
    qs = Ambulance.objects.filter(
        city__iexact=city,
        status=Ambulance.Status.AVAILABLE,
        is_active=True
    ).values(
        'id', 'vehicle_number', 'ambulance_type',
        'driver_name', 'driver_phone',
        'latitude', 'longitude', 'service_rating',
    )
    return [
        {**item, 'id': str(item['id'])}
        for item in qs
    ]


def invalidate_city_ambulances(city):
    cache.delete(_city_ambulances_key(city))


# ── Ambulance status ──────────────────────────────────────────
def set_ambulance_status(ambulance_id, status):
    cache.set(_ambulance_status_key(ambulance_id), status, STATUS_TTL)


def get_ambulance_status(ambulance_id):
    return cache.get(_ambulance_status_key(ambulance_id))


# ── Driver real-time location ─────────────────────────────────
def update_driver_location(ambulance_id, lat, lng):
    """
    Driver app calls this every ~10 seconds while on a trip.
    Short TTL — if driver stops updating, location expires.
    """
    cache.set(
        _ambulance_location_key(ambulance_id),
        {'lat': lat, 'lng': lng},
        LOCATION_TTL
    )


def get_driver_location(ambulance_id):
    return cache.get(_ambulance_location_key(ambulance_id))


# ── Active request tracking ───────────────────────────────────
def set_active_request(ambulance_id, request_id):
    cache.set(_active_request_key(ambulance_id), str(request_id), REQUEST_TTL)


def get_active_request(ambulance_id):
    return cache.get(_active_request_key(ambulance_id))


def clear_active_request(ambulance_id):
    cache.delete(_active_request_key(ambulance_id))