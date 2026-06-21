# apps/beds/cache.py
import json
from django.core.cache import cache
from django.db.models import Count, Q

# ── Cache key patterns ────────────────────────────────────────
# Every key follows a consistent pattern so you can
# invalidate groups of keys easily.

def _hospital_bed_key(hospital_id):
    return f'hospital:{hospital_id}:bed_summary'

def _department_bed_key(hospital_id, department_id):
    return f'hospital:{hospital_id}:dept:{department_id}:bed_summary'

def _hospital_equipment_key(hospital_id):
    return f'hospital:{hospital_id}:equipment_summary'

def _bed_detail_key(bed_id):
    return f'bed:{bed_id}:detail'


# ── TTL constants ─────────────────────────────────────────────
BED_SUMMARY_TTL   = 120   # 2 min — bed counts change often
EQUIPMENT_TTL     = 300   # 5 min — equipment changes less often
BED_DETAIL_TTL    = 60    # 1 min — individual bed detail


# ── Read helpers ──────────────────────────────────────────────
def get_hospital_bed_summary(hospital_id):
    """
    Returns cached bed availability counts for a hospital.
    Falls back to DB on cache miss and re-populates the cache.
    """
    key  = _hospital_bed_key(hospital_id)
    data = cache.get(key)

    if data is None:
        data = _compute_hospital_bed_summary(hospital_id)
        cache.set(key, data, BED_SUMMARY_TTL)

    return data


def get_department_bed_summary(hospital_id, department_id):
    """Per-department bed counts."""
    key  = _department_bed_key(hospital_id, department_id)
    data = cache.get(key)

    if data is None:
        data = _compute_department_bed_summary(hospital_id, department_id)
        cache.set(key, data, BED_SUMMARY_TTL)

    return data


def get_hospital_equipment_summary(hospital_id):
    """Cached equipment availability summary."""
    key  = _hospital_equipment_key(hospital_id)
    data = cache.get(key)

    if data is None:
        data = _compute_equipment_summary(hospital_id)
        cache.set(key, data, EQUIPMENT_TTL)

    return data


# ── Compute from DB ───────────────────────────────────────────
def _compute_hospital_bed_summary(hospital_id):
    """Hit the DB and build the summary dict."""
    from apps.beds.models import Bed

    qs = Bed.objects.filter(
        hospital_id=hospital_id,
        is_active=True
    ).values('bed_type').annotate(
        total      = Count('id'),
        available  = Count('id', filter=Q(status='available')),
        occupied   = Count('id', filter=Q(status='occupied')),
        reserved   = Count('id', filter=Q(status='reserved')),
        maintenance= Count('id', filter=Q(status='maintenance')),
    )

    summary = {
        'total_beds'     : 0,
        'available_beds' : 0,
        'occupied_beds'  : 0,
        'by_type'        : {},
    }

    for row in qs:
        btype = row['bed_type']
        summary['total_beds']      += row['total']
        summary['available_beds']  += row['available']
        summary['occupied_beds']   += row['occupied']
        summary['by_type'][btype]   = {
            'total'      : row['total'],
            'available'  : row['available'],
            'occupied'   : row['occupied'],
            'reserved'   : row['reserved'],
            'maintenance': row['maintenance'],
        }

    return summary


def _compute_department_bed_summary(hospital_id, department_id):
    from apps.beds.models import Bed

    qs = Bed.objects.filter(
        hospital_id=hospital_id,
        department_id=department_id,
        is_active=True
    ).aggregate(
        total      = Count('id'),
        available  = Count('id', filter=Q(status='available')),
        occupied   = Count('id', filter=Q(status='occupied')),
        reserved   = Count('id', filter=Q(status='reserved')),
        maintenance= Count('id', filter=Q(status='maintenance')),
    )

    return qs


def _compute_equipment_summary(hospital_id):
    from apps.beds.models import MedicalEquipment

    qs = MedicalEquipment.objects.filter(
        hospital_id=hospital_id
    ).values('equipment_type').annotate(
        total    = Count('id'),
        available= Count('id', filter=Q(status='available')),
        in_use   = Count('id', filter=Q(status='in_use')),
    )

    return {
        row['equipment_type']: {
            'total'    : row['total'],
            'available': row['available'],
            'in_use'   : row['in_use'],
        }
        for row in qs
    }


# ── Invalidation helpers ──────────────────────────────────────
# Call these whenever reception staff updates a bed or equipment.

def invalidate_bed_cache(hospital_id, department_id=None):
    """
    Called after any bed status change.
    Wipes hospital-level + optionally dept-level cache.
    """
    cache.delete(_hospital_bed_key(hospital_id))

    if department_id:
        cache.delete(_department_bed_key(hospital_id, department_id))


def invalidate_equipment_cache(hospital_id):
    cache.delete(_hospital_equipment_key(hospital_id))


def invalidate_bed_detail(bed_id):
    cache.delete(_bed_detail_key(bed_id))