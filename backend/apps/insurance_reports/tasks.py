from celery import shared_task
import logging

logger = logging.getLogger('medadhere')

@shared_task(name='insurance_reports.refresh_cache')
def refresh_insurance_report_cache(patient_id: str):
    """
    Refresh cached adherence stats for insurance reports.
    Triggered when a milestone is reached or adherence score updates.
    """
    # In a real implementation, this might pre-calculate complex stats 
    # or clear a Redis cache used by AdherenceReportBuilder.
    logger.info(f"Refreshing insurance report cache for patient {patient_id}")
    return True
