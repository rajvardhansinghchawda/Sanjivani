# apps/hospitals/serializers.py
from rest_framework import serializers
from .models import (
    Hospital, Department,
    ServiceCategory, ServiceMaster,
    HospitalService, HospitalRegistration,DutySchedule,Doctor
)


# ── Service Category ──────────────────────────────────────────
class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model  = ServiceCategory
        fields = ['id', 'name', 'description', 'is_active']


# ── Service Master ────────────────────────────────────────────
class ServiceMasterSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model  = ServiceMaster
        fields = ['id', 'code', 'name', 'description', 'category', 'category_name', 'is_active']


# ── Hospital Service (junction) ───────────────────────────────
class HospitalServiceSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source='service.name', read_only=True)
    service_code = serializers.CharField(source='service.code', read_only=True)
    category     = serializers.CharField(source='service.category.name', read_only=True)

    class Meta:
        model  = HospitalService
        fields = ['id', 'service', 'service_name', 'service_code', 'category', 'is_available', 'notes']


# ── Department ────────────────────────────────────────────────
class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Department
        fields = ['id', 'name', 'dept_type', 'floor', 'is_active']
        read_only_fields = ['id']

    def validate(self, attrs):
        # prevent duplicate dept name in same hospital
        hospital = self.context['hospital']
        name     = attrs.get('name')
        qs = Department.objects.filter(hospital=hospital, name=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({'name': 'Department already exists in this hospital'})
        return attrs


# ── Hospital — Public (for patients, no sensitive data) ───────
class HospitalPublicSerializer(serializers.ModelSerializer):
    services     = serializers.SerializerMethodField()
    departments  = serializers.SerializerMethodField()

    class Meta:
        model  = Hospital
        fields = [
            'id', 'name', 'category', 'hospital_type',
            'address', 'city', 'area', 'district', 'state', 'pincode',
            'latitude', 'longitude',
            'total_beds', 'icu_capacity',
            'phone', 'email', 'website',
            'status', 'verification_status',
            'license_number', 'registration_date',
            'services', 'departments',
        ]

    def get_services(self, obj):
        qs = obj.services.filter(is_available=True).select_related('service', 'service__category')
        return HospitalServiceSerializer(qs, many=True).data

    def get_departments(self, obj):
        qs = obj.departments.filter(is_active=True)
        return DepartmentSerializer(qs, many=True).data


# ── Hospital — Staff (full detail for portal use) ─────────────
class HospitalStaffSerializer(HospitalPublicSerializer):
    class Meta(HospitalPublicSerializer.Meta):
        fields = HospitalPublicSerializer.Meta.fields + [
            'created_at', 'updated_at'
        ]


# ── Hospital Registration ─────────────────────────────────────
class HospitalRegistrationSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    verified_by_name = serializers.CharField(source='verified_by.full_name', read_only=True)

    class Meta:
        model  = HospitalRegistration
        fields = [
            'id', 'hospital', 'hospital_name',
            'status', 'license_document',
            'rejection_reason', 'registration_date',
            'verification_date', 'verified_by', 'verified_by_name'
        ]
        read_only_fields = ['id', 'registration_date', 'verified_by', 'verification_date']


# ── Hospital Create (used during registration form) ───────────
class HospitalCreateSerializer(serializers.ModelSerializer):
    # accept list of service IDs during registration
    service_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    departments_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )

    class Meta:
        model  = Hospital
        fields = [
            'name', 'category', 'hospital_type',
            'address', 'city', 'area', 'district',
            'state', 'pincode', 'latitude', 'longitude',
            'total_beds', 'icu_capacity',
            'phone', 'email', 'website',
            'license_number', 'registration_date',
            'service_ids', 'departments_data',
        ]

    def create(self, validated_data):
        service_ids      = validated_data.pop('service_ids', [])
        departments_data = validated_data.pop('departments_data', [])

        hospital = Hospital.objects.create(**validated_data)

        # create HospitalRegistration record automatically
        HospitalRegistration.objects.create(hospital=hospital)

        # bulk create selected services
        HospitalService.objects.bulk_create([
            HospitalService(hospital=hospital, service_id=sid)
            for sid in service_ids
        ])

        # bulk create departments
        Department.objects.bulk_create([
            Department(hospital=hospital, **dept)
            for dept in departments_data
        ])

        return hospital
    

# apps/hospitals/serializers.py — add at the bottom

class DoctorSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    hospital_name   = serializers.CharField(source='hospital.name',   read_only=True)
    is_on_duty_now  = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Doctor
        fields = [
            'id', 'full_name', 'registration_no',
            'specialization', 'qualification',
            'phone', 'email', 'experience_years', 'status',
            'hospital', 'hospital_name',
            'department', 'department_name',
            'is_on_duty_now', 'created_at',
        ]
        read_only_fields = ['id', 'hospital', 'created_at']


class DutyScheduleSerializer(serializers.ModelSerializer):
    doctor_name     = serializers.CharField(source='doctor.full_name',    read_only=True)
    specialization  = serializers.CharField(source='doctor.specialization', read_only=True)
    department_name = serializers.CharField(source='department.name',     read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model  = DutySchedule
        fields = [
            'id', 'doctor', 'doctor_name', 'specialization',
            'department', 'department_name',
            'shift_type', 'shift_start', 'shift_end',
            'is_active', 'notes',
            'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def validate(self, attrs):
        if attrs.get('shift_end') and attrs.get('shift_start'):
            if attrs['shift_end'] <= attrs['shift_start']:
                raise serializers.ValidationError(
                    {'shift_end': 'Shift end must be after shift start'}
                )
        return attrs

    def create(self, validated_data):
        return DutySchedule.objects.create(
            **validated_data,
            created_by=self.context['request'].user
        )


class OnDutyDoctorSerializer(serializers.ModelSerializer):
    """
    Compact serializer — used on the reception dashboard
    to show who is currently on duty right now.
    """
    department_name = serializers.CharField(source='department.name', read_only=True)
    current_shift   = serializers.SerializerMethodField()

    class Meta:
        model  = Doctor
        fields = [
            'id', 'full_name', 'specialization',
            'department_name', 'phone',
            'current_shift',
        ]

    def get_current_shift(self, obj):
        from django.utils import timezone
        now = timezone.now()
        schedule = obj.duty_schedules.filter(
            shift_start__lte=now,
            shift_end__gte=now,
            is_active=True
        ).first()
        if schedule:
            return {
                'shift_type' : schedule.shift_type,
                'shift_start': schedule.shift_start,
                'shift_end'  : schedule.shift_end,
            }
        return None