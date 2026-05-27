"""
shared/decorators.py — Subscription feature gate decorator.
"""
import functools
from shared.exceptions import SubscriptionLimitError


def subscription_required(feature: str):
    """
    Class or method decorator that checks whether the authenticated user's
    active subscription plan includes the given feature.

    Usage:
        @subscription_required('ai_insights')
        class AIInsightsView(APIView): ...

    Returns HTTP 402 Payment Required if feature not in plan.
    """
    def decorator(cls_or_func):
        if isinstance(cls_or_func, type):
            # Applied to a class-based view
            original_dispatch = cls_or_func.dispatch

            @functools.wraps(original_dispatch)
            def patched_dispatch(self, request, *args, **kwargs):
                _check_feature(request.user, feature)
                return original_dispatch(self, request, *args, **kwargs)

            cls_or_func.dispatch = patched_dispatch
            return cls_or_func
        else:
            # Applied to a function-based view or method
            @functools.wraps(cls_or_func)
            def wrapper(self_or_request, *args, **kwargs):
                request = getattr(self_or_request, 'request', self_or_request)
                _check_feature(request.user, feature)
                return cls_or_func(self_or_request, *args, **kwargs)
            return wrapper

    return decorator


def _check_feature(user, feature: str):
    try:
        plan_features = user.subscription.plan.features
        value = plan_features.get(feature)
        if value is False or value is None:
            raise SubscriptionLimitError(
                feature=feature,
                current_plan=user.subscription.plan.slug,
            )
    except AttributeError:
        raise SubscriptionLimitError(feature=feature, current_plan='none')
