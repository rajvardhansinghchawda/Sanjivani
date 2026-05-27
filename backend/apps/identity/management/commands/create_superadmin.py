"""
Management command: create_superadmin
Usage: python manage.py create_superadmin
"""
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Create initial SUPER_ADMIN user for MedAdhere platform.'

    def add_arguments(self, parser):
        parser.add_argument('--email',    default='admin@medadhere.com')
        parser.add_argument('--password', default='Admin@12345')
        parser.add_argument('--name',     default='Platform Admin')

    def handle(self, *args, **opts):
        from apps.identity.models import User
        email = opts['email']

        if User.objects.filter(email=email).exists():
            self.stdout.write(self.style.WARNING(f'Super admin {email} already exists.'))
            return

        user = User.objects.create_superuser(
            email=email,
            password=opts['password'],
            full_name=opts['name'],
        )
        self.stdout.write(self.style.SUCCESS(
            f'Super admin created: {user.email} (id={user.id})'
        ))
