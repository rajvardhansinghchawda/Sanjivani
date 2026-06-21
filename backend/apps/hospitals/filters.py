# apps/hospitals/filters.py
import math
from django_filters import rest_framework as filters
from .models import Hospital


class HospitalFilter(filters.FilterSet):
    city         = filters.CharFilter(field_name='city',     lookup_expr='icontains')
    area         = filters.CharFilter(field_name='area',     lookup_expr='icontains')
    name         = filters.CharFilter(field_name='name',     lookup_expr='icontains')
    category     = filters.ChoiceFilter(choices=Hospital.Category.choices)
    hospital_type= filters.ChoiceFilter(choices=Hospital.HospitalType.choices)
    status       = filters.ChoiceFilter(choices=Hospital.Status.choices)
    verification = filters.ChoiceFilter(field_name='verification_status', choices=Hospital.VerificationStatus.choices)
    min_beds     = filters.NumberFilter(field_name='total_beds', lookup_expr='gte')
    has_icu      = filters.BooleanFilter(field_name='icu_capacity', method='filter_has_icu')
    service      = filters.CharFilter(method='filter_by_service')
    treatment = filters.CharFilter(method='filter_by_treatment')
    class Meta:
        model  = Hospital
        fields = ['city', 'area', 'category', 'hospital_type', 'status','treatment',]

    def filter_has_icu(self, queryset, name, value):
        if value:
            return queryset.filter(icu_capacity__gt=0)
        return queryset

    def filter_by_service(self, queryset, name, value):
        # filter by service code e.g. ?service=IMG_MRI
        return queryset.filter(
            services__service__code=value,
            services__is_available=True
        ).distinct()
    
   

    def filter_by_treatment(self, queryset, name, value):
        """
        Filter hospitals that have a department of the given type.
        Usage: ?treatment=cardiology
        Maps directly to Department.DeptType choices.
        e.g. cardiology, neurology, orthopedic, oncology,
            pediatrics, surgery, icu, emergency, radiology
        """
        return queryset.filter(
            departments__dept_type__iexact=value,
            departments__is_active=True
        ).distinct()


def get_nearby_hospitals(queryset, lat, lng, radius_km=10):
    """
    Simple bounding-box filter for nearby hospitals.
    For production use PostGIS or GeoDjango for accuracy.
    """
    if not lat or not lng:
        return queryset

    lat, lng = float(lat), float(lng)
    delta_lat = radius_km / 111.0
    delta_lng = radius_km / (111.0 * math.cos(math.radians(lat)))

    return queryset.filter(
        latitude__range=(lat - delta_lat, lat + delta_lat),
        longitude__range=(lng - delta_lng, lng + delta_lng),
    )