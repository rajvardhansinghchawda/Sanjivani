import csv
import json
import os
from django.conf import settings
from django.utils import timezone

class CDSCOExporter:
    """
    Exports SideEffectReports in CDSCO (Central Drugs Standard Control Organisation) 
    compatible formats (simplified version for demo).
    """
    def __init__(self, reports):
        self.reports = reports

    def export(self) -> str:
        """
        Exports reports to a CSV file and returns the path.
        """
        filename = f"cdsco_export_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        export_dir = os.path.join(settings.MEDIA_ROOT, 'cdsco_exports')
        os.makedirs(export_dir, exist_ok=True)
        file_path = os.path.join(export_dir, filename)

        with open(file_path, 'w', newline='') as csvfile:
            fieldnames = [
                'report_id', 'date', 'patient_age', 'patient_gender', 
                'medication', 'symptom', 'severity', 'outcome'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()

            for report in self.reports:
                # Anonymized data
                writer.writerow({
                    'report_id': str(report.id),
                    'date': report.created_at.strftime('%Y-%m-%d'),
                    'patient_age': report.patient.age if hasattr(report.patient, 'age') else 'N/A',
                    'patient_gender': report.patient.gender if hasattr(report.patient, 'gender') else 'N/A',
                    'medication': report.prescription.medication.name,
                    'symptom': report.symptom,
                    'severity': report.severity,
                    'outcome': 'RECOVERING' # Placeholder
                })

        return file_path
