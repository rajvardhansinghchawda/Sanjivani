import io
import hmac
import hashlib
import logging
from decimal import Decimal
from django.http import HttpResponse
from django.conf import settings
from django.template.loader import render_to_string
from django.shortcuts import get_object_or_404
from django.core.mail import EmailMessage
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny

from shared.response import APIResponse
from .models import SubscriptionPlan, UserSubscription, SubscriptionInvoice
from .serializers import SubscriptionPlanSerializer, UserSubscriptionSerializer, SubscriptionInvoiceSerializer
from .services import SubscriptionService

logger = logging.getLogger('medadhere')


class PlanListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plans = SubscriptionPlan.objects.all()
        return APIResponse.success(SubscriptionPlanSerializer(plans, many=True).data)


class CurrentSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            sub = request.user.subscription
            return APIResponse.success(UserSubscriptionSerializer(sub).data)
        except UserSubscription.DoesNotExist:
            return APIResponse.success(None, message="No active subscription")


class CreateRazorpayOrderView(APIView):
    """
    POST /api/v1/subscriptions/create-order/
    Body: { "plan_id": "<uuid>" }
    Returns Razorpay order details for the frontend checkout modal.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan_id = request.data.get('plan_id')
        if not plan_id:
            return APIResponse.error("plan_id is required", status=400)
        try:
            order_data = SubscriptionService.create_razorpay_order(request.user, plan_id)
            return APIResponse.success(order_data)
        except SubscriptionPlan.DoesNotExist:
            return APIResponse.error("Plan not found", status=404)
        except Exception as e:
            logger.error(f'Razorpay order creation failed: {e}')
            return APIResponse.error("Failed to create payment order. Try again.", status=500)


class VerifyRazorpayPaymentView(APIView):
    """
    POST /api/v1/subscriptions/verify-payment/
    Body: { plan_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
    Verifies HMAC signature and activates the subscription.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan_id            = request.data.get('plan_id')
        razorpay_order_id  = request.data.get('razorpay_order_id')
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_signature  = request.data.get('razorpay_signature')

        if not all([plan_id, razorpay_order_id, razorpay_payment_id, razorpay_signature]):
            return APIResponse.error("plan_id, razorpay_order_id, razorpay_payment_id and razorpay_signature are required", status=400)

        try:
            sub, invoice = SubscriptionService.verify_and_activate(
                user=request.user,
                plan_id=plan_id,
                razorpay_order_id=razorpay_order_id,
                razorpay_payment_id=razorpay_payment_id,
                razorpay_signature=razorpay_signature,
            )
            return APIResponse.success(
                UserSubscriptionSerializer(sub).data,
                message="Payment verified. Subscription activated!"
            )
        except ValueError as e:
            return APIResponse.error(str(e), code='SIGNATURE_FAILED', status=400)
        except Exception as e:
            logger.error(f'Payment verification failed: {e}')
            return APIResponse.error("Payment verification failed.", status=500)


class UpgradeSubscriptionView(APIView):
    """Legacy direct upgrade without payment — kept for admin/testing."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan_id = request.data.get('plan_id')
        if not plan_id:
            return APIResponse.error("plan_id is required", status=400)
        sub = SubscriptionService.upgrade_plan(request.user, plan_id)
        return APIResponse.success(UserSubscriptionSerializer(sub).data, message="Subscription upgraded.")


class CancelSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        sub = SubscriptionService.cancel_plan(request.user)
        if sub:
            return APIResponse.success(UserSubscriptionSerializer(sub).data, message="Auto-renew disabled.")
        return APIResponse.error("No active subscription to cancel.", status=400)


class InvoiceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        invoices = SubscriptionInvoice.objects.filter(subscription__user=request.user).order_by('-created_at')
        return APIResponse.success(SubscriptionInvoiceSerializer(invoices, many=True).data)


class RazorpayWebhookView(APIView):
    """
    POST /api/v1/subscriptions/webhook/razorpay/
    Verifies X-Razorpay-Signature header before processing.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        webhook_secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', '')
        if webhook_secret:
            sig = request.headers.get('X-Razorpay-Signature', '')
            body = request.body
            expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected, sig):
                return APIResponse.error("Invalid webhook signature", status=400)

        SubscriptionService.handle_razorpay_webhook(request.data)
        return APIResponse.success({}, message="Webhook received")


class StripeWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        SubscriptionService.handle_stripe_webhook(request.data)
        return APIResponse.success({}, message="Webhook received")


class InvoiceDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        invoice = get_object_or_404(SubscriptionInvoice, id=invoice_id, subscription__user=request.user)

        patient_name = request.user.full_name
        hospital_name = "N/A"
        if hasattr(request.user, 'patient_profile'):
            hospital_name = request.user.patient_profile.hospital_name or "N/A"

        tax_amount  = invoice.amount * Decimal('0.18')
        grand_total = invoice.amount + tax_amount

        context = {
            'invoice_id':              str(invoice.id),
            'invoice_date':            invoice.created_at,
            'payment_status':          invoice.status,
            'patient_name':            patient_name,
            'patient_email':           request.user.email,
            'hospital_tenant_name':    hospital_name,
            'plan_name':               invoice.subscription.plan.name,
            'billing_period':          'Monthly',
            'subscription_description': invoice.subscription.plan.features.get('description', 'Subscription to MedAdhere'),
            'amount':                  f"{invoice.amount:.2f}",
            'tax':                     f"{tax_amount:.2f}",
            'grand_total':             f"{grand_total:.2f}",
            'currency':                invoice.currency,
            'payment_method':          'Razorpay',
            'support_email':           'support@medadhere.io',
            'due_days':                7,
            'health_tip':              'Take your medication on time for better health outcomes.',
        }

        html_string = render_to_string('invoices/invoice.html', context)

        try:
            from xhtml2pdf import pisa
            result = io.BytesIO()
            pdf = pisa.pisaDocument(io.BytesIO(html_string.encode("UTF-8")), result)
            if not pdf.err:
                response = HttpResponse(result.getvalue(), content_type='application/pdf')
                response['Content-Disposition'] = f'attachment; filename="invoice_{invoice.id}.pdf"'
                return response
            return APIResponse.error("Error generating PDF invoice", status=500)
        except ImportError:
            return APIResponse.error("PDF generation library not installed.", status=500)


def _build_invoice_context(invoice, user):
    """Shared context builder for invoice PDF generation."""
    hospital_name = "N/A"
    if hasattr(user, 'patient_profile'):
        hospital_name = user.patient_profile.hospital_name or "N/A"
    tax_amount  = invoice.amount * Decimal('0.18')
    grand_total = invoice.amount + tax_amount
    return {
        'invoice_id':               str(invoice.id),
        'invoice_date':             invoice.created_at,
        'payment_status':           invoice.status,
        'patient_name':             user.full_name,
        'patient_email':            user.email,
        'hospital_tenant_name':     hospital_name,
        'plan_name':                invoice.subscription.plan.name,
        'billing_period':           'Monthly',
        'subscription_description': invoice.subscription.plan.features.get('description', 'Subscription to MedAdhere'),
        'amount':                   f"{invoice.amount:.2f}",
        'tax':                      f"{tax_amount:.2f}",
        'grand_total':              f"{grand_total:.2f}",
        'currency':                 invoice.currency,
        'payment_method':           'Razorpay',
        'support_email':            'support@medadhere.io',
        'due_days':                 7,
        'health_tip':               'Take your medication on time for better health outcomes.',
    }


class EmailInvoiceView(APIView):
    """POST /subscriptions/invoices/<invoice_id>/email/ — email a PDF invoice to the user."""
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        invoice = get_object_or_404(SubscriptionInvoice, id=invoice_id, subscription__user=request.user)

        context     = _build_invoice_context(invoice, request.user)
        html_string = render_to_string('invoices/invoice.html', context)

        try:
            from xhtml2pdf import pisa
            result = io.BytesIO()
            pdf    = pisa.pisaDocument(io.BytesIO(html_string.encode('UTF-8')), result)
            if pdf.err:
                return APIResponse.error("Error generating PDF invoice", status=500)

            month_label = invoice.created_at.strftime('%B %Y')
            email = EmailMessage(
                subject=f"Your MedAdhere Invoice — {month_label}",
                body=(
                    f"Hi {request.user.full_name},\n\n"
                    f"Please find your invoice for {month_label} attached.\n\n"
                    f"Plan: {invoice.subscription.plan.name}\n"
                    f"Amount: ₹{invoice.amount} + 18% GST\n\n"
                    "Thank you for using MedAdhere!\n"
                    "— The MedAdhere Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[request.user.email],
            )
            email.attach(
                f"medadhere_invoice_{invoice.created_at.strftime('%Y_%m')}.pdf",
                result.getvalue(),
                'application/pdf',
            )
            email.send(fail_silently=False)
            return APIResponse.success({"message": f"Invoice emailed to {request.user.email}"})

        except ImportError:
            return APIResponse.error("PDF generation library not installed.", status=500)
        except Exception as e:
            logger.error(f"Email invoice failed: {e}")
            return APIResponse.error("Failed to send invoice email. Try again.", status=500)
