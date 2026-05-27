"""
shared/response.py — Standardised API response helpers.
Every DRF view MUST use these instead of raw Response().
"""
from rest_framework.response import Response


class APIResponse:
    @staticmethod
    def success(data=None, message='', status=200, meta=None):
        return Response({
            'success': True,
            'message': message,
            'data':    data if data is not None else {},
            'meta':    meta if meta is not None else {},
        }, status=status)

    @staticmethod
    def created(data=None, message='Created successfully'):
        return APIResponse.success(data=data, message=message, status=201)

    @staticmethod
    def no_content(message='Deleted successfully'):
        return Response({'success': True, 'message': message}, status=204)

    @staticmethod
    def error(message, code='ERROR', status=400, errors=None):
        return Response({
            'success': False,
            'error': {
                'code':    code,
                'message': message,
                'details': errors or {},
            }
        }, status=status)

    @staticmethod
    def not_found(message='Resource not found'):
        return APIResponse.error(message, code='NOT_FOUND', status=404)

    @staticmethod
    def forbidden(message='Permission denied'):
        return APIResponse.error(message, code='FORBIDDEN', status=403)

    @staticmethod
    def unauthorized(message='Authentication required'):
        return APIResponse.error(message, code='UNAUTHORIZED', status=401)

    @staticmethod
    def subscription_required(feature, current_plan, upgrade_url='/api/v1/subscriptions/upgrade/'):
        return Response({
            'success': False,
            'error': {
                'code':         'SUBSCRIPTION_REQUIRED',
                'message':      f'Feature "{feature}" is not available on your {current_plan} plan.',
                'details':      {'feature': feature, 'current_plan': current_plan},
                'upgrade_url':  upgrade_url,
            }
        }, status=402)
