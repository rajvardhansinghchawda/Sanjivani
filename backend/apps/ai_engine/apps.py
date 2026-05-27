from django.apps import AppConfig


class AIEngineConfig(AppConfig):
    name = "apps.ai_engine"
    label = "ai_engine"
    verbose_name = "AI Engine"

    def ready(self):
        """
        Bootstrap the AI engine on Django startup.
        - Registers signal handlers
        - Pre-loads active model into memory cache (lazy)
        - Does NOT fail startup if model file is missing
        """
        try:
            from apps.ai_engine.services.inference import InferenceService
            InferenceService.warmup()
        except Exception as e:
            import logging
            logger = logging.getLogger("medadhere.ai_engine")
            logger.warning(
                f"AI Engine warmup skipped (will use fallback): {e}"
            )
