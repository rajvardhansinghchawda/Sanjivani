"""
apps/admin_panel/views.py — Admin REST API (requires ADMIN or SUPER_ADMIN role).
"""
from django.utils import timezone
from django.db.models import Count, Avg
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from shared.response import APIResponse
from shared.permissions import IsAdminOrSuperAdmin

# Lazy imports to avoid circular imports at module level
def _get_user_model():
    from django.contrib.auth import get_user_model
    return get_user_model()


class MetricsOverviewView(APIView):
    """GET /admin/api/v1/metrics/overview/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):
        User = _get_user_model()
        from apps.subscriptions.models import UserSubscription
        from apps.iot.models import Device

        total_users      = User.objects.count()
        active_subs      = UserSubscription.objects.filter(status='ACTIVE').count()
        active_devices   = Device.objects.filter(is_active=True).count()
        new_users_today  = User.objects.filter(
            created_at__date=timezone.now().date()
        ).count()

        return APIResponse.success({
            'total_users': total_users,
            'active_subscriptions': active_subs,
            'active_devices': active_devices,
            'new_users_today': new_users_today,
        })


class MetricsAdherenceView(APIView):
    """GET /admin/api/v1/metrics/adherence/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):
        from apps.scheduling.models import AdherenceSummary
        summaries = AdherenceSummary.objects.filter(
            period_start__gte=timezone.now() - timezone.timedelta(days=7)
        ).aggregate(avg_rate=Avg('adherence_pct'))

        return APIResponse.success({
            'avg_adherence_rate_7d': round(summaries.get('avg_rate') or 0, 2),
        })


class AdminUserListView(APIView):
    """GET /admin/api/v1/users/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):
        User = _get_user_model()
        users = User.objects.order_by('-created_at')[:100]
        data = [
            {
                'id': str(u.id), 'email': u.email, 'full_name': u.full_name,
                'role': u.role, 'is_active': u.is_active,
                'date_joined': u.created_at,
            }
            for u in users
        ]
        return APIResponse.success(data)


class AdminUserDetailView(APIView):
    """GET/PATCH /admin/api/v1/users/{id}/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request, pk):
        User = _get_user_model()
        from django.shortcuts import get_object_or_404
        user = get_object_or_404(User, id=pk)
        return APIResponse.success({
            'id': str(user.id), 'email': user.email, 'full_name': user.full_name,
            'role': user.role, 'is_active': user.is_active,
            'is_email_verified': user.is_email_verified,
        })


class AdminDeactivateUserView(APIView):
    """PATCH /admin/api/v1/users/{id}/deactivate/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def patch(self, request, pk):
        User = _get_user_model()
        from django.shortcuts import get_object_or_404
        user = get_object_or_404(User, id=pk)
        user.is_active = False
        user.save(update_fields=['is_active'])
        return APIResponse.success(message=f"User {user.email} deactivated.")


class AdminSubscriptionListView(APIView):
    """GET /admin/api/v1/subscriptions/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):
        from apps.subscriptions.models import UserSubscription
        from apps.subscriptions.serializers import UserSubscriptionSerializer
        subs = UserSubscription.objects.select_related('user', 'plan').all()[:100]
        return APIResponse.success(UserSubscriptionSerializer(subs, many=True).data)


class AdminExtendSubscriptionView(APIView):
    """PATCH /admin/api/v1/subscriptions/{id}/extend/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def patch(self, request, pk):
        from apps.subscriptions.models import UserSubscription
        from django.shortcuts import get_object_or_404
        import datetime
        sub = get_object_or_404(UserSubscription, id=pk)
        days = int(request.data.get('days', 30))
        base = sub.expires_at or timezone.now()
        sub.expires_at = base + datetime.timedelta(days=days)
        sub.save(update_fields=['expires_at'])
        return APIResponse.success({'expires_at': sub.expires_at}, message=f"Extended by {days} days.")


class AdminGenerateDeviceIDsView(APIView):
    """POST /admin/api/v1/devices/generate-ids/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request):
        from apps.store.models import HardwareProduct, DeviceUniqueID
        from django.shortcuts import get_object_or_404
        import random, string
        product_id = request.data.get('product_id')
        batch_size = int(request.data.get('batch_size', 100))
        batch_size = min(batch_size, 1000)  # safety cap

        product = get_object_or_404(HardwareProduct, id=product_id)
        created_ids = []
        for _ in range(batch_size):
            parts = [''.join(random.choices(string.ascii_uppercase + string.digits, k=4)) for _ in range(3)]
            code = f"MEDA-{'-'.join(parts)}"
            obj, created = DeviceUniqueID.objects.get_or_create(unique_code=code, defaults={'product': product})
            if created:
                created_ids.append(code)

        return APIResponse.success({
            'generated': len(created_ids),
            'sample': created_ids[:5],
        })


class AdminDeviceInventoryView(APIView):
    """GET /admin/api/v1/devices/inventory/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):
        from apps.store.models import DeviceUniqueID
        total    = DeviceUniqueID.objects.count()
        assigned = DeviceUniqueID.objects.filter(order__isnull=False).count()
        return APIResponse.success({'total': total, 'assigned': assigned, 'available': total - assigned})


class AdminNotificationDeliveryRatesView(APIView):
    """GET /admin/api/v1/notifications/delivery-rates/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):
        from apps.notifications.models import Notification
        from django.db.models import Q
        total     = Notification.objects.count()
        delivered = Notification.objects.filter(status='DELIVERED').count()
        failed    = Notification.objects.filter(status='FAILED').count()
        rate = round(delivered / total * 100, 2) if total else 0
        return APIResponse.success({'total': total, 'delivered': delivered, 'failed': failed, 'rate_pct': rate})


class AdminSystemJobsView(APIView):
    """GET /admin/api/v1/system/jobs/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):
        from django_celery_beat.models import PeriodicTask
        tasks = PeriodicTask.objects.values('name', 'enabled', 'last_run_at', 'total_run_count')
        return APIResponse.success(list(tasks))


class AdminTestNotificationView(APIView):
    """POST /admin/api/v1/notifications/test/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request):
        from apps.notifications.services import NotificationDispatcher
        target_user_id = request.data.get('user_id')
        channel = request.data.get('channel', 'push')
        message = request.data.get('message', 'Test notification from MedAdhere admin.')
        User = _get_user_model()
        from django.shortcuts import get_object_or_404
        user = get_object_or_404(User, id=target_user_id)
        NotificationDispatcher.dispatch(
            user=user,
            notification_type='ADMIN_TEST',
            title='Admin Test',
            body=message,
            channels=[channel.upper()],
        )
        return APIResponse.success(message="Test notification dispatched.")
