from django.urls import path
from .views import (
    PlanListView, CurrentSubscriptionView,
    CreateRazorpayOrderView, VerifyRazorpayPaymentView,
    UpgradeSubscriptionView, CancelSubscriptionView,
    InvoiceListView, InvoiceDownloadView, EmailInvoiceView,
    RazorpayWebhookView, StripeWebhookView,
)

urlpatterns = [
    path('plans/',                                  PlanListView.as_view(),                name='subscription-plans'),
    path('current/',                                CurrentSubscriptionView.as_view(),     name='subscription-current'),
    # Razorpay checkout flow
    path('create-order/',                           CreateRazorpayOrderView.as_view(),     name='subscription-create-order'),
    path('verify-payment/',                         VerifyRazorpayPaymentView.as_view(),   name='subscription-verify-payment'),
    # Legacy / admin upgrade (no payment)
    path('upgrade/',                                UpgradeSubscriptionView.as_view(),     name='subscription-upgrade'),
    path('cancel/',                                 CancelSubscriptionView.as_view(),      name='subscription-cancel'),
    path('invoices/',                               InvoiceListView.as_view(),             name='subscription-invoices'),
    path('invoices/<uuid:invoice_id>/download/',    InvoiceDownloadView.as_view(),         name='subscription-invoice-download'),
    path('invoices/<uuid:invoice_id>/email/',       EmailInvoiceView.as_view(),            name='subscription-invoice-email'),
    path('webhook/razorpay/',                       RazorpayWebhookView.as_view(),         name='subscription-webhook-razorpay'),
    path('webhook/stripe/',                         StripeWebhookView.as_view(),           name='subscription-webhook-stripe'),
]
