from shared.exceptions import SubscriptionLimitError
from .models import UserSubscription

class SubscriptionGate:
    DEFAULT_LIMITS = {
        'history_days': 30,
        'max_medications': 5,
        'max_caregivers': 1,
    }

    PLAN_FIELD_LIMITS = {
        'max_medications': 'max_medications',
        'max_caregivers': 'max_caregivers',
    }

    @classmethod
    def _get_active_plan(cls, user):
        try:
            sub = user.subscription
            if sub.status == 'ACTIVE':
                return sub.plan
        except UserSubscription.DoesNotExist:
            pass
        return None

    @classmethod
    def has_feature(cls, user, feature_key: str) -> bool:
        """Boolean feature check used in non-blocking flows (e.g., channel selection)."""
        role = getattr(user, 'role', None)
        if role and role != 'PATIENT':
            return True
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return True

        plan = cls._get_active_plan(user)
        if not plan:
            return False
        features = plan.features or {}
        return bool(features.get(feature_key, False))

    @classmethod
    def get_limit(cls, user, limit_key: str, default=None) -> int:
        """Return numeric limit for a plan capability with safe fallback defaults."""
        plan = cls._get_active_plan(user)
        fallback = cls.DEFAULT_LIMITS.get(limit_key, 0 if default is None else default)

        # Some limits are modeled as direct fields on SubscriptionPlan.
        field_name = cls.PLAN_FIELD_LIMITS.get(limit_key)
        if plan and field_name:
            value = getattr(plan, field_name, None)
            if isinstance(value, int) and value > 0:
                return value

        # Most variable limits are modeled inside the JSON features dictionary.
        value = (plan.features or {}).get(limit_key) if plan else None
        if value in (None, ''):
            return fallback
        if isinstance(value, int):
            return value if value > 0 else fallback
        if isinstance(value, str):
            raw = value.strip().lower()
            if raw in {'unlimited', 'inf', 'infinite'}:
                return 3650
            if raw.isdigit():
                parsed = int(raw)
                return parsed if parsed > 0 else fallback

        return fallback

    @classmethod
    def check_feature(cls, user, feature_key: str) -> bool:
        """
        Check if the user's current subscription plan allows access to a feature.
        Raises SubscriptionLimitError if not.
        """
        if not cls.has_feature(user, feature_key):
            raise SubscriptionLimitError(f"Feature '{feature_key}' requires an upgraded plan.")
        return True

    @classmethod
    def check_medication_limit(cls, user, current_count: int):
        """
        Raises an error if adding one more medication exceeds the plan limit.
        """
        plan = cls._get_active_plan(user)
        limit = plan.max_medications if plan else 0
        if current_count >= limit:
            raise SubscriptionLimitError(f"Medication limit of {limit} reached. Please upgrade your plan.")

    @classmethod
    def check_caregiver_limit(cls, user, current_count: int):
        """
        Raises an error if adding one more caregiver exceeds the plan limit.
        """
        plan = cls._get_active_plan(user)
        limit = plan.max_caregivers if plan else 0
        if current_count >= limit:
            raise SubscriptionLimitError(f"Caregiver limit of {limit} reached. Please upgrade your plan.")
