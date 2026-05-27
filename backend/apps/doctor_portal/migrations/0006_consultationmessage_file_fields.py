from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('doctor_portal', '0005_doctorprofile_display_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='consultationmessage',
            name='message_type',
            field=models.CharField(
                choices=[('text', 'Text'), ('file', 'File')],
                db_index=True,
                default='text',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='consultationmessage',
            name='file_url',
            field=models.CharField(blank=True, max_length=1000, null=True),
        ),
        migrations.AddField(
            model_name='consultationmessage',
            name='file_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='consultationmessage',
            name='file_size',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='consultationmessage',
            name='mime_type',
            field=models.CharField(blank=True, max_length=120, null=True),
        ),
        migrations.AlterField(
            model_name='consultationmessage',
            name='content',
            field=models.TextField(blank=True, default=''),
        ),
    ]
