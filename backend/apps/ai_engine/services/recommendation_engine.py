"""
Recommendation Engine — Public Re-export
=========================================
RecommendationEngine lives alongside InsightEngine in insight_engine.py.
This module exists so risk_engine.py can import from a dedicated path:

    from apps.ai_engine.services.recommendation_engine import RecommendationEngine

This keeps the import contract stable even if the implementation moves later.
"""

from apps.ai_engine.services.insight_engine import RecommendationEngine  # noqa: F401

__all__ = ["RecommendationEngine"]
