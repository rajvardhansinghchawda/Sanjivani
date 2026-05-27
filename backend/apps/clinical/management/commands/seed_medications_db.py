"""
Management command: seed_medications_db
Usage: python manage.py seed_medications_db
Seeds WHO Essential Medicines list (sample set).
"""
from django.core.management.base import BaseCommand

MEDICATIONS = [
    {'name': 'Metformin', 'generic_name': 'Metformin Hydrochloride', 'drug_class': 'Biguanide', 'form': 'TABLET', 'default_unit': 'mg', 'strength': '500mg', 'requires_food': True},
    {'name': 'Amlodipine', 'generic_name': 'Amlodipine Besylate', 'drug_class': 'Calcium Channel Blocker', 'form': 'TABLET', 'default_unit': 'mg', 'strength': '5mg'},
    {'name': 'Atorvastatin', 'generic_name': 'Atorvastatin Calcium', 'drug_class': 'Statin', 'form': 'TABLET', 'default_unit': 'mg', 'strength': '10mg'},
    {'name': 'Lisinopril', 'generic_name': 'Lisinopril', 'drug_class': 'ACE Inhibitor', 'form': 'TABLET', 'default_unit': 'mg', 'strength': '10mg'},
    {'name': 'Losartan', 'generic_name': 'Losartan Potassium', 'drug_class': 'ARB', 'form': 'TABLET', 'default_unit': 'mg', 'strength': '50mg'},
    {'name': 'Omeprazole', 'generic_name': 'Omeprazole', 'drug_class': 'PPI', 'form': 'CAPSULE', 'default_unit': 'mg', 'strength': '20mg'},
    {'name': 'Paracetamol', 'generic_name': 'Acetaminophen', 'drug_class': 'Analgesic/Antipyretic', 'form': 'TABLET', 'default_unit': 'mg', 'strength': '500mg'},
    {'name': 'Aspirin', 'generic_name': 'Acetylsalicylic Acid', 'drug_class': 'NSAID/Antiplatelet', 'form': 'TABLET', 'default_unit': 'mg', 'strength': '75mg'},
    {'name': 'Levothyroxine', 'generic_name': 'Levothyroxine Sodium', 'drug_class': 'Thyroid Hormone', 'form': 'TABLET', 'default_unit': 'mcg', 'strength': '50mcg'},
    {'name': 'Salbutamol', 'generic_name': 'Albuterol', 'drug_class': 'Beta-2 Agonist', 'form': 'INHALER', 'default_unit': 'puff'},
    {'name': 'Insulin Glargine', 'generic_name': 'Insulin Glargine', 'drug_class': 'Insulin', 'form': 'INJECTION', 'default_unit': 'units', 'refrigeration_required': True},
    {'name': 'Clopidogrel', 'generic_name': 'Clopidogrel Bisulfate', 'drug_class': 'Antiplatelet', 'form': 'TABLET', 'default_unit': 'mg', 'strength': '75mg'},
    {'name': 'Furosemide', 'generic_name': 'Furosemide', 'drug_class': 'Loop Diuretic', 'form': 'TABLET', 'default_unit': 'mg', 'strength': '40mg'},
    {'name': 'Warfarin', 'generic_name': 'Warfarin Sodium', 'drug_class': 'Anticoagulant', 'form': 'TABLET', 'default_unit': 'mg', 'strength': '5mg', 'is_controlled_substance': True},
    {'name': 'Pantoprazole', 'generic_name': 'Pantoprazole Sodium', 'drug_class': 'PPI', 'form': 'TABLET', 'default_unit': 'mg', 'strength': '40mg'},
]


class Command(BaseCommand):
    help = 'Seed WHO Essential Medicines into Medication catalog.'

    def handle(self, *args, **opts):
        from apps.clinical.models import Medication
        created = 0
        for data in MEDICATIONS:
            data.setdefault('is_verified', True)
            _, was_created = Medication.objects.get_or_create(
                name=data['name'], defaults=data
            )
            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f'  Added: {data["name"]}'))
        self.stdout.write(self.style.SUCCESS(f'Done — {created} medications added.'))
