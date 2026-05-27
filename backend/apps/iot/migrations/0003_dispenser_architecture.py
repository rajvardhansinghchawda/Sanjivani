"""
Migration: add dispenser architecture models.
- Device: is_gate_locked, current_compartment_position
- DeviceCommand: GATE_LOCK, GATE_UNLOCK, OPEN_GATE command types
- PhysicalCompartment, SubCompartment, DoseSession, WeightHistory, GateEvent
"""
import uuid
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('iot', '0002_iot_full_upgrade'),
    ]

    operations = [
        # ── Device: add gate lock + compartment position fields ───
        migrations.AddField(
            model_name='device',
            name='is_gate_locked',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='device',
            name='current_compartment_position',
            field=models.PositiveSmallIntegerField(default=1),
        ),

        # ── PhysicalCompartment ───────────────────────────────────
        migrations.CreateModel(
            name='PhysicalCompartment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('compartment_number', models.PositiveSmallIntegerField()),
                ('time_slot', models.CharField(
                    choices=[
                        ('morning_before', 'Morning Before Food'),
                        ('morning_after', 'Morning After Food'),
                        ('night_before', 'Night Before Food'),
                        ('night_after', 'Night After Food'),
                    ],
                    max_length=20,
                )),
                ('expected_weight_grams', models.FloatField(default=0.0)),
                ('current_balance_weight_grams', models.FloatField(default=0.0)),
                ('is_active', models.BooleanField(default=True)),
                ('last_filled_at', models.DateTimeField(blank=True, null=True)),
                ('device', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='physical_compartments',
                    to='iot.device',
                )),
            ],
            options={
                'ordering': ['compartment_number'],
                'unique_together': {('device', 'compartment_number')},
            },
        ),

        # ── SubCompartment ────────────────────────────────────────
        migrations.CreateModel(
            name='SubCompartment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('medicine_name', models.CharField(max_length=200)),
                ('pill_weight_grams', models.FloatField(default=0.0)),
                ('quantity_per_dose', models.PositiveIntegerField(default=1)),
                ('duration_days', models.PositiveIntegerField(default=7)),
                ('total_pills', models.PositiveIntegerField(default=0)),
                ('total_weight_grams', models.FloatField(default=0.0)),
                ('ai_analysis_data', models.JSONField(default=dict)),
                ('instructions', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('compartment', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sub_compartments',
                    to='iot.physicalcompartment',
                )),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),

        # ── DoseSession ───────────────────────────────────────────
        migrations.CreateModel(
            name='DoseSession',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('scheduled_time', models.DateTimeField()),
                ('expected_weight_before', models.FloatField(default=0.0)),
                ('actual_weight_after', models.FloatField(blank=True, null=True)),
                ('weight_reduction_actual', models.FloatField(blank=True, null=True)),
                ('weight_reduction_expected', models.FloatField(default=0.0)),
                ('dose_status', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('taken', 'Taken'),
                        ('partial', 'Partial'),
                        ('missed', 'Missed'),
                    ],
                    default='pending',
                    max_length=10,
                )),
                ('gate_open_count', models.PositiveSmallIntegerField(default=0)),
                ('is_gate_locked', models.BooleanField(default=False)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('compartment', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='dose_sessions',
                    to='iot.physicalcompartment',
                )),
            ],
            options={
                'ordering': ['-scheduled_time'],
            },
        ),

        # ── WeightHistory ─────────────────────────────────────────
        migrations.CreateModel(
            name='WeightHistory',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('compartment_number', models.PositiveSmallIntegerField()),
                ('weight_grams', models.FloatField()),
                ('recorded_at', models.DateTimeField(auto_now_add=True)),
                ('device', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='weight_history',
                    to='iot.device',
                )),
            ],
            options={
                'ordering': ['-recorded_at'],
            },
        ),

        # ── GateEvent ─────────────────────────────────────────────
        migrations.CreateModel(
            name='GateEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('compartment_number', models.PositiveSmallIntegerField()),
                ('event_type', models.CharField(
                    choices=[('open', 'Open'), ('close', 'Close')],
                    max_length=10,
                )),
                ('recorded_at', models.DateTimeField(auto_now_add=True)),
                ('device', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='gate_events',
                    to='iot.device',
                )),
                ('session', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='gate_events',
                    to='iot.dosesession',
                )),
            ],
            options={
                'ordering': ['-recorded_at'],
            },
        ),
    ]
