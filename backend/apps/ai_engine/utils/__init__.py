"""
AI Engine Utilities
====================
Shared helpers used across the ai_engine module.
Import from here, not from individual util files.

Examples:
    from apps.ai_engine.utils import validate_patient_id, get_logger
"""

import logging
import re
import uuid
from typing import Optional


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def get_logger(name: str) -> logging.Logger:
    """
    Return a namespaced logger for the ai_engine module.

    Usage:
        logger = get_logger("risk_engine")
        # → logs under "medadhere.ai_engine.risk_engine"
    """
    return logging.getLogger(f"medadhere.ai_engine.{name}")


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_patient_id(patient_id: str) -> bool:
    """
    Return True if patient_id is a valid UUID string.
    All public AI methods accept patient_id as str — validate at entry points.
    """
    try:
        uuid.UUID(str(patient_id))
        return True
    except (ValueError, AttributeError):
        return False


def sanitize_patient_id(patient_id) -> Optional[str]:
    """
    Coerce patient_id to a clean UUID string, or return None if invalid.
    Safe to call with UUID objects, strings, or None.
    """
    try:
        return str(uuid.UUID(str(patient_id)))
    except (ValueError, AttributeError):
        return None


# ---------------------------------------------------------------------------
# Risk level helpers
# ---------------------------------------------------------------------------

RISK_LEVEL_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def risk_level_to_int(level: str) -> int:
    """Map risk level string to integer for comparison. Unknown → -1."""
    return RISK_LEVEL_ORDER.get(level, -1)


def is_escalation(old_level: str, new_level: str) -> bool:
    """Return True if risk has moved to a higher level."""
    return risk_level_to_int(new_level) > risk_level_to_int(old_level)


def clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    """Clamp a float to [lo, hi]. Used throughout feature engineering."""
    return max(lo, min(hi, value))


# ---------------------------------------------------------------------------
# Model version helpers
# ---------------------------------------------------------------------------

_SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")


def is_valid_semver(version: str) -> bool:
    """Return True if version matches semantic versioning format (e.g. 1.2.3)."""
    return bool(_SEMVER_RE.match(version))


__all__ = [
    "get_logger",
    "validate_patient_id",
    "sanitize_patient_id",
    "risk_level_to_int",
    "is_escalation",
    "clamp",
    "is_valid_semver",
]
