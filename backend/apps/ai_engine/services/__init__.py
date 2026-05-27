"""
AI Engine Services — Public Interface
======================================
Import from here, not from individual service modules.

Example:
    from apps.ai_engine.services import RiskEngine
    result = RiskEngine.get_risk_score(patient_id)
"""

from apps.ai_engine.services.risk_engine import RiskEngine

__all__ = ["RiskEngine"]
