import json
from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask, CrontabSchedule
from celery.schedules import crontab
from config.celery import app as celery_app

class Command(BaseCommand):
    help = "Synchronize Celery Beat schedules from settings to the database scheduler."

    def handle(self, *args, **options):
        self.stdout.write("Syncing Celery Beat schedules to database...")
        schedule = celery_app.conf.beat_schedule
        
        synced_names = []
        for name, entry in schedule.items():
            task_path = entry.get('task')
            sched_obj = entry.get('schedule')
            
            if not task_path or not sched_obj:
                self.stdout.write(self.style.WARNING(f"Skipping task '{name}': missing task or schedule configuration."))
                continue

            if isinstance(sched_obj, crontab):
                # Get or create CrontabSchedule
                cron_schedule, created = CrontabSchedule.objects.get_or_create(
                    minute=sched_obj.minute,
                    hour=sched_obj.hour,
                    day_of_week=sched_obj.day_of_week,
                    day_of_month=sched_obj.day_of_month,
                    month_of_year=sched_obj.month_of_year,
                )
                if created:
                    self.stdout.write(f"Created CrontabSchedule: {sched_obj}")
                
                # Get task arguments and options
                task_args = json.dumps(entry.get('args', []))
                task_kwargs = json.dumps(entry.get('kwargs', {}))
                
                # Create or update PeriodicTask
                periodic_task, task_created = PeriodicTask.objects.update_or_create(
                    name=name,
                    defaults={
                        'task': task_path,
                        'crontab': cron_schedule,
                        'interval': None,
                        'args': task_args,
                        'kwargs': task_kwargs,
                        'enabled': True,
                    }
                )
                
                status_str = "Created" if task_created else "Updated"
                self.stdout.write(f"{status_str} PeriodicTask: {name} -> {task_path} ({sched_obj})")
                synced_names.append(name)
            else:
                self.stdout.write(self.style.WARNING(f"Skipping task '{name}': scheduler type {type(sched_obj)} not handled yet."))

        self.stdout.write(self.style.SUCCESS(f"Successfully synced {len(synced_names)} periodic tasks."))
