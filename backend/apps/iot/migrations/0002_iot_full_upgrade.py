# Generated manually — IoT full upgrade
# Adds: DeviceCommand model, new fields on Device/DeviceHeartbeat/DeviceCompartmentMapping/DeviceEvent
# Changes: event_uuid UUIDField → CharField, telemetry_event → adherence_event FK

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('iot', '0001_initial'),
        ('store', '0001_initial'),
        ('telemetry', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Device new fields ───────────────────────────────────────────────
        migrations.AlterField(
            model_name='device',
            name='device_type',
            field=models.CharField(
                choices=[
                    ('CIRCULAR_PILL_DISPENSER', 'Circular Pill Dispenser'),
                    ('PILLBOX', 'Smart Pillbox'),
                    ('WEARABLE', 'Wearable'),
                    ('MONITOR', 'Vital Monitor'),
                    ('OTHER', 'Other'),
                ],
                default='CIRCULAR_PILL_DISPENSER',
                max_length=40,
            ),
        ),
        migrations.AddField(
            model_name='device',
            name='total_doses_dispensed',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='device',
            name='stepper_status',
            field=models.CharField(
                choices=[('ok', 'OK'), ('warning', 'Warning'), ('error', 'Error')],
                default='ok',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='device',
            name='servo_status',
            field=models.CharField(
                choices=[('ok', 'OK'), ('warning', 'Warning'), ('error', 'Error')],
                default='ok',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='device',
            name='ultrasonic_status',
            field=models.CharField(
                choices=[('ok', 'OK'), ('warning', 'Warning'), ('error', 'Error')],
                default='ok',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='device',
            name='unique_id_record',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='linked_device',
                to='store.deviceuniqueid',
            ),
        ),

        # ── DeviceHeartbeat new hardware-status fields ──────────────────────
        migrations.AddField(
            model_name='deviceheartbeat',
            name='stepper_status',
            field=models.CharField(default='ok', max_length=20),
        ),
        migrations.AddField(
            model_name='deviceheartbeat',
            name='servo_status',
            field=models.CharField(default='ok', max_length=20),
        ),
        migrations.AddField(
            model_name='deviceheartbeat',
            name='ultrasonic_status',
            field=models.CharField(default='ok', max_length=20),
        ),

        # ── DeviceEvent: event_uuid → CharField, new event types, adherence FK ─
        migrations.AlterField(
            model_name='deviceevent',
            name='event_uuid',
            field=models.CharField(db_index=True, max_length=64, unique=True),
        ),
        migrations.AlterField(
            model_name='deviceevent',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('DEVICE_BOOT', 'Device Boot'),
                    ('HEARTBEAT', 'Heartbeat'),
                    ('COMPARTMENT_ROTATED', 'Compartment Rotated'),
                    ('HAND_DETECTED', 'Hand Detected'),
                    ('LID_OPENED', 'Lid Opened'),
                    ('LID_CLOSED', 'Lid Closed'),
                    ('DOSE_TAKEN', 'Dose Taken'),
                    ('DOSE_TIMEOUT', 'Dose Timeout (Missed)'),
                    ('DOSE_SKIPPED', 'Dose Skipped'),
                    ('COMMAND_ACKNOWLEDGED', 'Command Acknowledged'),
                    ('DOSE_MISSED', 'Dose Missed'),
                    ('COMPARTMENT_OPEN', 'Compartment Opened'),
                    ('LOW_BATTERY', 'Low Battery'),
                    ('TAMPER', 'Tamper Detected'),
                    ('DEVICE_ON', 'Device Powered On'),
                    ('DEVICE_OFF', 'Device Powered Off'),
                ],
                max_length=40,
            ),
        ),
        # Remove old telemetry FK
        migrations.RemoveField(
            model_name='deviceevent',
            name='telemetry_event',
        ),
        # Add adherence FK (points to TelemetryEvent which is the actual adherence model)
        migrations.AddField(
            model_name='deviceevent',
            name='adherence_event',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='iot_source_events',
                to='telemetry.telemetryevent',
            ),
        ),

        # ── DeviceCompartmentMapping: add scheduled_times ───────────────────
        migrations.AddField(
            model_name='devicecompartmentmapping',
            name='scheduled_times',
            field=models.JSONField(default=list),
        ),

        # ── DeviceCommand (new model) ────────────────────────────────────────
        migrations.CreateModel(
            name='DeviceCommand',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('version', models.PositiveIntegerField(default=1)),
                ('command_type', models.CharField(
                    choices=[
                        ('SYNC_SCHEDULE', 'Sync Schedule'),
                        ('PREPARE_COMPARTMENT', 'Prepare Compartment'),
                        ('FORCE_OPEN_LID', 'Force Open Lid'),
                        ('LOCK_DEVICE', 'Lock Device'),
                        ('UPDATE_DISPLAY', 'Update Display'),
                        ('FIRMWARE_UPDATE', 'Firmware Update'),
                        ('SYNC_TIME', 'Sync Time'),
                    ],
                    max_length=30,
                )),
                ('payload', models.JSONField(default=dict)),
                ('status', models.CharField(
                    choices=[
                        ('PENDING', 'Pending'),
                        ('SENT', 'Sent'),
                        ('ACKNOWLEDGED', 'Acknowledged'),
                        ('EXECUTED', 'Executed'),
                        ('FAILED', 'Failed'),
                        ('EXPIRED', 'Expired'),
                    ],
                    default='PENDING',
                    max_length=20,
                )),
                ('expires_at', models.DateTimeField()),
                ('acknowledged_at', models.DateTimeField(blank=True, null=True)),
                ('executed_at', models.DateTimeField(blank=True, null=True)),
                ('device', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='commands',
                    to='iot.device',
                )),
                ('issued_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='issued_device_commands',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
    ]
