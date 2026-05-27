import os
import sys
import django
import random
from datetime import datetime, timedelta, time
from django.utils import timezone

# ─── Setup Django ─────────────────────────────────────────────────────────────
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.clinical.models import Patient, Medication, Prescription, MedicationSchedule, FrequencyType
from apps.scheduling.models import ReminderJob, ReminderStatus, DoseLog, DoseSource

def seed_prescriptions():
    print("Seeding Prescriptions and Schedules...")

    patients = Patient.objects.all()
    if not patients.exists():
        print("No patients found. Run seed_all_data.py first.")
        return

    medications = list(Medication.objects.all())
    if not medications:
        print("No medications found. Run seed_all_data.py first.")
        return

    today = timezone.now().date()
    now = timezone.now()

    for patient in patients:
        print(f"Seeding for Patient: {patient.user.full_name} ({patient.patient_code})")
        
        # Select 3-4 random medications for each patient
        patient_meds = random.sample(medications, min(len(medications), random.randint(3, 5)))
        
        for med in patient_meds:
            # Create Prescription
            prescription, created = Prescription.objects.get_or_create(
                patient=patient,
                medication=med,
                defaults={
                    'prescribed_by': 'Dr. Sameer Gupta',
                    'dosage_value': 1.0,
                    'dosage_unit': med.default_unit,
                    'start_date': today - timedelta(days=30),
                    'is_indefinite': True,
                    'is_active': True,
                    'instructions': f'Take {med.name} as directed by your physician.'
                }
            )
            
            if created:
                print(f"  Created Prescription: {med.name}")
            else:
                print(f"  Prescription already exists: {med.name}")

            # Create Schedule (Daily at 8 AM and 8 PM)
            schedule, s_created = MedicationSchedule.objects.get_or_create(
                prescription=prescription,
                defaults={
                    'frequency_type': FrequencyType.DAILY,
                    'times_of_day': [
                        {"time": "08:00", "dose": 1.0, "label": "Morning", "with_food": med.requires_food},
                        {"time": "20:00", "dose": 1.0, "label": "Evening", "with_food": med.requires_food}
                    ],
                    'is_active': True
                }
            )
            
            # Create ReminderJobs for Today and Yesterday
            # Yesterday's doses (to show history/adherence)
            yesterday = today - timedelta(days=1)
            for tod in schedule.times_of_day:
                h, m = map(int, tod['time'].split(':'))
                sched_dt_yest = timezone.make_aware(datetime.combine(yesterday, time(h, m)))
                
                job_yest, j_created = ReminderJob.objects.get_or_create(
                    schedule=schedule,
                    scheduled_at=sched_dt_yest,
                    defaults={
                        'window_start': sched_dt_yest - timedelta(minutes=15),
                        'window_end': sched_dt_yest + timedelta(minutes=60),
                        'status': ReminderStatus.TAKEN,
                        'dose_value': tod['dose'],
                        'dose_unit': med.default_unit,
                        'with_food': tod.get('with_food', False),
                        'label': tod.get('label', ''),
                        'sent_at': sched_dt_yest
                    }
                )
                
                if j_created:
                    # Create DoseLog for yesterday's taken dose
                    DoseLog.objects.create(
                        reminder_job=job_yest,
                        prescription=prescription,
                        logged_by=patient.user,
                        status=ReminderStatus.TAKEN,
                        source=DoseSource.APP,
                        taken_at=sched_dt_yest + timedelta(minutes=random.randint(0, 10)),
                        dose_value=tod['dose'],
                        dose_unit=med.default_unit,
                        with_food=tod.get('with_food', False)
                    )

            # Today's doses
            for tod in schedule.times_of_day:
                h, m = map(int, tod['time'].split(':'))
                sched_dt_today = timezone.make_aware(datetime.combine(today, time(h, m)))
                
                # Determine status based on time
                status = ReminderStatus.PENDING
                if sched_dt_today < now - timedelta(hours=1):
                    status = ReminderStatus.MISSED
                elif sched_dt_today < now:
                    status = ReminderStatus.TAKEN # Pretend user took it if it's already past but close
                
                job_today, j_created = ReminderJob.objects.get_or_create(
                    schedule=schedule,
                    scheduled_at=sched_dt_today,
                    defaults={
                        'window_start': sched_dt_today - timedelta(minutes=15),
                        'window_end': sched_dt_today + timedelta(minutes=60),
                        'status': status,
                        'dose_value': tod['dose'],
                        'dose_unit': med.default_unit,
                        'with_food': tod.get('with_food', False),
                        'label': tod.get('label', ''),
                        'sent_at': sched_dt_today if sched_dt_today < now else None
                    }
                )
                
                if j_created and status == ReminderStatus.TAKEN:
                    DoseLog.objects.create(
                        reminder_job=job_today,
                        prescription=prescription,
                        logged_by=patient.user,
                        status=ReminderStatus.TAKEN,
                        source=DoseSource.APP,
                        taken_at=sched_dt_today + timedelta(minutes=random.randint(0, 10)),
                        dose_value=tod['dose'],
                        dose_unit=med.default_unit,
                        with_food=tod.get('with_food', False)
                    )

    print("\nSeeding Completed! Patients now have real medications and today's schedule.")

if __name__ == "__main__":
    seed_prescriptions()
