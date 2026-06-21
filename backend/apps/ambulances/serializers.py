# apps/ambulances/serializers.py
from rest_framework import serializers
from .models import Ambulance, AmbulanceRequest


class AmbulanceSerializer(serializers.ModelSerializer):
    hospital_name    = serializers.CharField(source='hospital.name', read_only=True)
    live_location    = serializers.SerializerMethodField()

    class Meta:
        model  = Ambulance
        fields = [
            'id', 'vehicle_number', 'ambulance_type',
            'driver_name', 'driver_phone', 'driver_license',
            'hospital', 'hospital_name',
            'city', 'area', 'latitude', 'longitude',
            'status', 'trips_completed', 'service_rating',
            'is_active', 'live_location', 'updated_at',
        ]
        read_only_fields = ['id', 'trips_completed', 'service_rating', 'updated_at']

    def get_live_location(self, obj):
        from .cache import get_driver_location
        return get_driver_location(str(obj.id))


class AmbulancePublicSerializer(serializers.ModelSerializer):
    """Minimal serializer for patient portal."""
    live_location = serializers.SerializerMethodField()

    class Meta:
        model  = Ambulance
        fields = [
            'id', 'ambulance_type', 'driver_name', 'driver_phone',
            'city', 'area', 'latitude', 'longitude',
            'service_rating', 'live_location',
        ]

    def get_live_location(self, obj):
        from .cache import get_driver_location
        return get_driver_location(str(obj.id))


class AmbulanceStatusUpdateSerializer(serializers.ModelSerializer):
    """Driver updates their own availability."""
    class Meta:
        model  = Ambulance
        fields = ['status']


class LocationUpdateSerializer(serializers.Serializer):
    """Driver sends GPS coordinates."""
    latitude  = serializers.FloatField()
    longitude = serializers.FloatField()


# ── Request serializers ───────────────────────────────────────

class AmbulanceRequestSerializer(serializers.ModelSerializer):
    patient_name          = serializers.CharField(source='patient.full_name',              read_only=True)
    ambulance_number      = serializers.CharField(source='ambulance.vehicle_number',        read_only=True)
    destination_name      = serializers.CharField(source='destination_hospital.name',       read_only=True)
    response_time_minutes = serializers.FloatField(read_only=True)
    trip_duration_minutes = serializers.FloatField(read_only=True)

    class Meta:
        model  = AmbulanceRequest
        fields = [
            'id', 'status', 'source', 'ambulance_type',
            'patient', 'patient_name',
            'ambulance', 'ambulance_number',
            'destination_hospital', 'destination_name',
            'pickup_address', 'pickup_latitude', 'pickup_longitude', 'pickup_city',
            'requester_name', 'requester_phone',
            'requested_at', 'accepted_at', 'picked_up_at', 'completed_at',
            'response_time_minutes', 'trip_duration_minutes',
            'patient_rating', 'notes', 'cancellation_reason',
        ]
        read_only_fields = [
            'id', 'status', 'ambulance',
            'requested_at', 'accepted_at', 'picked_up_at', 'completed_at',
            'response_time_sec', 'trip_duration_sec',
        ]


class BookAmbulanceSerializer(serializers.Serializer):
    """
    Patient or reception books an ambulance.
    """
    ambulance_type       = serializers.ChoiceField(choices=Ambulance.AmbulanceType.choices)
    pickup_address       = serializers.CharField()
    pickup_latitude      = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    pickup_longitude     = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    pickup_city          = serializers.CharField()
    destination_hospital = serializers.UUIDField(required=False)
    requester_name       = serializers.CharField()
    requester_phone      = serializers.CharField()
    patient_id           = serializers.UUIDField(required=False)
    notes                = serializers.CharField(required=False, allow_blank=True)


class RateAmbulanceSerializer(serializers.Serializer):
    """Patient rates the ambulance service after trip."""
    rating = serializers.IntegerField(min_value=1, max_value=5)