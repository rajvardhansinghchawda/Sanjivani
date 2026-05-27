"""
Migration: add missing `version` field (from BaseModel) to dispenser models.
PhysicalCompartment, SubCompartment, DoseSession were created in 0003 without
the BaseModel.version column — this adds it.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('iot', '0003_dispenser_architecture'),
    ]

    operations = [
        migrations.AddField(
            model_name='physicalcompartment',
            name='version',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='subcompartment',
            name='version',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='dosesession',
            name='version',
            field=models.PositiveIntegerField(default=1),
        ),
    ]
