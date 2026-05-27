from django.urls import path
from .views import (
    MetricsOverviewView, MetricsAdherenceView,
    AdminUserListView, AdminUserDetailView, AdminDeactivateUserView,
    AdminSubscriptionListView, AdminExtendSubscriptionView,
    AdminGenerateDeviceIDsView, AdminDeviceInventoryView,
    AdminNotificationDeliveryRatesView, AdminSystemJobsView,
    AdminTestNotificationView,
)

urlpatterns = [
    path('metrics/overview/',             MetricsOverviewView.as_view(),             name='admin-metrics-overview'),
    path('metrics/adherence/',            MetricsAdherenceView.as_view(),            name='admin-metrics-adherence'),
    path('users/',                        AdminUserListView.as_view(),               name='admin-user-list'),
    path('users/<uuid:pk>/',              AdminUserDetailView.as_view(),             name='admin-user-detail'),
    path('users/<uuid:pk>/deactivate/',   AdminDeactivateUserView.as_view(),         name='admin-user-deactivate'),
    path('subscriptions/',                AdminSubscriptionListView.as_view(),       name='admin-subscription-list'),
    path('subscriptions/<uuid:pk>/extend/', AdminExtendSubscriptionView.as_view(),   name='admin-subscription-extend'),
    path('devices/generate-ids/',         AdminGenerateDeviceIDsView.as_view(),      name='admin-device-generate-ids'),
    path('devices/inventory/',            AdminDeviceInventoryView.as_view(),        name='admin-device-inventory'),
    path('notifications/delivery-rates/', AdminNotificationDeliveryRatesView.as_view(), name='admin-notification-rates'),
    path('system/jobs/',                  AdminSystemJobsView.as_view(),             name='admin-system-jobs'),
    path('notifications/test/',           AdminTestNotificationView.as_view(),       name='admin-notification-test'),
]
