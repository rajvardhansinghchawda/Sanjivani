from django.apps import AppConfig

class FHIRIntegrationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.fhir_integration'
    verbose_name = 'FHIR / HL7 EHR Integration'
