import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.hospitals.models import Hospital
from apps.beds.models import Bed

try:
    hospital = Hospital.objects.get(name='Indore Care Hospital')
    
    # Adding ICU beds
    for i in range(1, 6):
        bed_number = f"ICH-NEW-ICU-{i}"
        Bed.objects.get_or_create(
            hospital=hospital,
            bed_number=bed_number,
            defaults={
                'bed_type': Bed.BedType.ICU,
                'ward_type': Bed.WardType.ICU_WARD,
                'status': Bed.BedStatus.AVAILABLE,
                'notes': 'Newly added ICU Bed'
            }
        )
    
    # Adding General beds
    for i in range(1, 11):
        bed_number = f"ICH-NEW-GEN-{i}"
        Bed.objects.get_or_create(
            hospital=hospital,
            bed_number=bed_number,
            defaults={
                'bed_type': Bed.BedType.GENERAL,
                'ward_type': Bed.WardType.GENERAL_WARD,
                'status': Bed.BedStatus.AVAILABLE,
                'notes': 'Newly added General Ward Bed'
            }
        )
    print('Successfully added 5 new ICU beds and 10 new General Ward beds for Indore Care Hospital.')

except Exception as e:
    print(f'Error: {e}')

