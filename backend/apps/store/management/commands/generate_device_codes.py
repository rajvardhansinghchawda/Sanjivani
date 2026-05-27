"""
Management command: generate device unique codes for testing.

Usage:
    python manage.py generate_device_codes
    python manage.py generate_device_codes --count 10
    python manage.py generate_device_codes --count 5 --prefix TEST
    python manage.py generate_device_codes --list       # just list existing codes
"""
import random
import string
from django.core.management.base import BaseCommand
from apps.store.models import HardwareProduct, DeviceUniqueID


def _random_segment(n=4):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=n))


def _generate_code(prefix='MEDA'):
    return f"{prefix}-{_random_segment()}-{_random_segment()}-{_random_segment()}"


class Command(BaseCommand):
    help = 'Generate DeviceUniqueID codes for testing'

    def add_arguments(self, parser):
        parser.add_argument('--count',  type=int, default=5,    help='How many codes to generate (default: 5)')
        parser.add_argument('--prefix', type=str, default='MEDA', help='Code prefix (default: MEDA)')
        parser.add_argument('--list',   action='store_true',     help='List all existing codes and exit')

    def handle(self, *args, **options):
        if options['list']:
            codes = DeviceUniqueID.objects.all().order_by('-created_at')
            if not codes.exists():
                self.stdout.write(self.style.WARNING('No device codes in database.'))
                return
            self.stdout.write(self.style.SUCCESS(f'\n{"CODE":<28} {"STATUS":<14} {"CREATED":<22}'))
            self.stdout.write('-' * 66)
            for c in codes:
                status = 'USED' if c.is_provisioned else 'AVAILABLE'
                style  = self.style.ERROR if c.is_provisioned else self.style.SUCCESS
                self.stdout.write(style(f'{c.unique_code:<28} {status:<14} {c.created_at.strftime("%Y-%m-%d %H:%M"):<22}'))
            self.stdout.write(f'\nTotal: {codes.count()} codes ({codes.filter(is_provisioned=False).count()} available)')
            return

        # Get or create a dummy product to satisfy FK
        product, _ = HardwareProduct.objects.get_or_create(
            sku='DISP-V1',
            defaults={
                'name': 'MedAdhere Smart Pill Dispenser',
                'price': 2999.00,
                'description': 'Circular 4-compartment IoT pill dispenser',
                'stock_count': 9999,
                'is_available': True,
            }
        )

        count   = options['count']
        prefix  = options['prefix'].upper()
        created = []

        for _ in range(count):
            # Retry on collision (extremely rare)
            for attempt in range(10):
                code = _generate_code(prefix)
                if not DeviceUniqueID.objects.filter(unique_code=code).exists():
                    DeviceUniqueID.objects.create(unique_code=code, product=product)
                    created.append(code)
                    break

        self.stdout.write(self.style.SUCCESS(f'\nGenerated {len(created)} device code(s):\n'))
        for code in created:
            self.stdout.write(self.style.SUCCESS(f'  {code}'))
        self.stdout.write(
            self.style.WARNING('\nUse any of the above codes in the caregiver portal "Register Device" step.')
        )
