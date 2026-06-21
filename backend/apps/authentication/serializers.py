# apps/authentication/serializers.py
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db.models import Q
from .models import User
from apps.patients.models import Patient


class RegisterSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model  = User
        fields = [
            'email', 'phone', 'full_name',
            'role', 'hospital',
            'password', 'password2'
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password2'):
            raise serializers.ValidationError({'password': 'Passwords do not match'})

        role = attrs.get('role')
        hospital = attrs.get('hospital')

        # reception / admin / supervisor must be linked to a hospital
        staff_roles = [User.Role.RECEPTION, User.Role.ADMIN, User.Role.SUPERVISOR]
        if role in staff_roles and not hospital:
            raise serializers.ValidationError(
                {'hospital': f'{role} must be linked to a hospital'}
            )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        if user.role == User.Role.PATIENT:
            patient = (
                Patient.objects.filter(
                    user__isnull=True
                ).filter(
                    Q(phone=user.phone) | Q(email=user.email)
                ).first()
            )
            if patient:
                patient.user = user
                patient.full_name = user.full_name or patient.full_name
                if user.email and not patient.email:
                    patient.email = user.email
                if user.phone and not patient.phone:
                    patient.phone = user.phone
                patient.save()
            else:
                Patient.objects.create(
                    user=user,
                    full_name=user.full_name,
                    phone=user.phone or (user.email[:15] if user.email else '0000000000'),
                    email=user.email,
                )
        return user


class LoginSerializer(serializers.Serializer):
    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get('request'),
            username=attrs['email'],
            password=attrs['password']
        )
        if not user:
            raise serializers.ValidationError('Invalid email or password')
        if not user.is_active:
            raise serializers.ValidationError('Account is deactivated')

        refresh = RefreshToken.for_user(user)

        # embed role & hospital in token payload
        refresh['role']     = user.role
        refresh['name']     = user.full_name
        refresh['hospital'] = str(user.hospital_id) if user.hospital_id else None

        attrs['user']    = user
        attrs['refresh'] = refresh
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(
        source='hospital.name', read_only=True
    )

    class Meta:
        model  = User
        fields = [
            'id', 'email', 'phone', 'full_name',
            'role', 'hospital', 'hospital_name',
            'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'role', 'created_at']


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Old password is incorrect')
        return value

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()