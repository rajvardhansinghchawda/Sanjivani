import hmac
import hashlib
import logging
from django.utils import timezone
from django.conf import settings
from .models import SubscriptionPlan, UserSubscription, SubscriptionInvoice

logger = logging.getLogger('medadhere')


def _razorpay_client():
    import razorpay
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


class SubscriptionService:

    @staticmethod
    def create_razorpay_order(user, plan_id):
        """
        Step 1 of checkout: create a Razorpay order and return its details.
        The frontend opens the Razorpay modal with these details.
        """
        plan = SubscriptionPlan.objects.get(id=plan_id)
        # Razorpay expects amount in paise (INR × 100)
        amount_paise = int(plan.price_monthly * 100)

        client = _razorpay_client()
        order = client.order.create({
            'amount':   amount_paise,
            'currency': 'INR',
            'receipt':  f'sub_{user.id}_{plan.slug}',
            'notes': {
                'user_id': str(user.id),
                'plan_id': str(plan.id),
                'plan_name': plan.name,
            },
        })
        return {
            'order_id':  order['id'],
            'amount':    amount_paise,
            'currency':  'INR',
            'key_id':    settings.RAZORPAY_KEY_ID,
            'plan_id':   str(plan.id),
            'plan_name': plan.name,
            'user_name': user.full_name,
            'user_email': user.email,
        }

    @staticmethod
    def verify_and_activate(user, plan_id, razorpay_order_id, razorpay_payment_id, razorpay_signature):
        """
        Step 2: verify the payment signature then activate subscription.
        Raises ValueError on invalid signature.
        """
        # HMAC-SHA256 signature verification
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode(),
            f"{razorpay_order_id}|{razorpay_payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected, razorpay_signature):
            raise ValueError("Payment signature verification failed.")

        plan = SubscriptionPlan.objects.get(id=plan_id)

        sub, created = UserSubscription.objects.get_or_create(
            user=user,
            defaults={'plan': plan, 'status': 'ACTIVE'},
        )
        if not created:
            sub.plan = plan
            sub.status = 'ACTIVE'
            sub.gateway_sub_id = razorpay_payment_id
            sub.save()

        invoice = SubscriptionInvoice.objects.create(
            subscription=sub,
            amount=plan.price_monthly,
            currency='INR',
            status='PAID',
            paid_at=timezone.now(),
            gateway_invoice_id=razorpay_payment_id,
        )

        # Notify user
        try:
            from apps.notifications.services import NotificationDispatcher
            NotificationDispatcher.dispatch(
                user=user,
                notification_type='INVOICE_GENERATED',
                title='Payment Successful — MedAdhere',
                body=f'Your payment for {plan.name} plan is confirmed. Invoice #{invoice.id}.',
                channels=['EMAIL', 'PUSH'],
            )
        except Exception as e:
            logger.warning(f'Subscription notification failed: {e}')

        return sub, invoice

    @staticmethod
    def upgrade_plan(user, plan_id):
        """Legacy direct upgrade (no payment). Kept for admin use."""
        from apps.notifications.services import NotificationDispatcher

        plan = SubscriptionPlan.objects.get(id=plan_id)
        sub, created = UserSubscription.objects.get_or_create(
            user=user,
            defaults={'plan': plan, 'status': 'ACTIVE'},
        )
        if not created:
            sub.plan = plan
            sub.status = 'ACTIVE'
            sub.save()

        invoice = SubscriptionInvoice.objects.create(
            subscription=sub,
            amount=plan.price_monthly,
            currency='INR',
            status='PAID',
            paid_at=timezone.now(),
        )
        return sub

    @staticmethod
    def cancel_plan(user):
        try:
            sub = user.subscription
            sub.auto_renew = False
            sub.save()
            return sub
        except UserSubscription.DoesNotExist:
            return None

    @staticmethod
    def handle_razorpay_webhook(payload):
        """Handle Razorpay server-to-server webhook events."""
        event = payload.get('event', '')
        logger.info(f'Razorpay webhook: {event}')

        if event == 'payment.captured':
            payment = payload.get('payload', {}).get('payment', {}).get('entity', {})
            notes   = payment.get('notes', {})
            user_id = notes.get('user_id')
            plan_id = notes.get('plan_id')

            if user_id and plan_id:
                try:
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    user = User.objects.get(id=user_id)
                    SubscriptionService.verify_and_activate(
                        user=user,
                        plan_id=plan_id,
                        razorpay_order_id=payment.get('order_id', ''),
                        razorpay_payment_id=payment.get('id', ''),
                        razorpay_signature='webhook_bypass',  # webhook already verified at view level
                    )
                except Exception as e:
                    logger.error(f'Webhook activation failed: {e}')

    @staticmethod
    def handle_stripe_webhook(payload):
        pass
