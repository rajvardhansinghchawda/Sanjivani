# apps/authentication/models.py
import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.Role.ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):

    class Role(models.TextChoices):
        RECEPTION   = 'reception',   'Reception Staff'
        SUPERVISOR  = 'supervisor',  'Supervisor'
        ADMIN       = 'admin',       'Admin'
        AMBULANCE   = 'ambulance',   'Ambulance Driver'
        PATIENT     = 'public/patient',     'Public/Patient'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email      = models.EmailField(unique=True)
    phone      = models.CharField(max_length=15, unique=True, null=True, blank=True)
    full_name  = models.CharField(max_length=150)
    role       = models.CharField(max_length=20, choices=Role.choices)

    # Reception / Admin / Supervisor → linked to a hospital
    hospital   = models.ForeignKey(
        'hospitals.Hospital',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='staff_users'
    )

    is_active  = models.BooleanField(default=True)
    is_staff   = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['full_name', 'role']

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.full_name} ({self.role})'

    # --- handy role-check properties ---
    @property
    def is_reception(self):
        return self.role == self.Role.RECEPTION

    @property
    def is_supervisor(self):
        return self.role == self.Role.SUPERVISOR

    @property
    def is_admin_user(self):
        return self.role == self.Role.ADMIN

    @property
    def is_ambulance_driver(self):
        return self.role == self.Role.AMBULANCE

    @property
    def is_patient(self):
        return self.role == self.Role.PATIENT