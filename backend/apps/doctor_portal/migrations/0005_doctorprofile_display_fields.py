from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('doctor_portal', '0004_add_consultation_session_message'),
    ]

    operations = [
        migrations.AddField(
            model_name='doctorprofile',
            name='experience_years',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='doctorprofile',
            name='rating',
            field=models.DecimalField(decimal_places=1, default=5.0, max_digits=3),
        ),
        migrations.AddField(
            model_name='doctorprofile',
            name='review_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='doctorprofile',
            name='consultation_fee',
            field=models.PositiveIntegerField(default=300),
        ),
        migrations.AddField(
            model_name='doctorprofile',
            name='is_available',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='doctorprofile',
            name='next_slot',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='doctorprofile',
            name='languages',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
