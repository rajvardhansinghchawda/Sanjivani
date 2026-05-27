"""
apps/clinical/services.py — Domain services for clinical operations.
"""
import logging
from django.db.models import Q
from django.utils import timezone
from shared.exceptions import InvalidInviteTokenError

logger = logging.getLogger('medadhere')


class CaregiverInviteService:

    @staticmethod
    def send_invite(patient, caregiver_email: str, permission_level: str,
                    can_receive_alerts: bool = True) -> 'PatientCaregiverLink':
        from apps.subscriptions.gates import SubscriptionGate
        from apps.identity.models import User
        from .models import Caregiver, PatientCaregiverLink

        # Check subscription limit
        current_caregivers = PatientCaregiverLink.objects.filter(patient=patient, is_active=True).count()
        SubscriptionGate.check_caregiver_limit(patient.user, current_caregivers)

        # Resolve or create caregiver user
        try:
            user = User.objects.get(email__iexact=caregiver_email, is_active=True)
        except User.DoesNotExist:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'email': f'No account found for {caregiver_email}. Ask them to register first.'})

        caregiver, _ = Caregiver.objects.get_or_create(user=user)

        # Prevent duplicate active links
        if PatientCaregiverLink.objects.filter(patient=patient, caregiver=caregiver, is_active=True).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'This caregiver is already linked to your account.'})

        link, _ = PatientCaregiverLink.objects.get_or_create(
            patient=patient, caregiver=caregiver,
            defaults={
                'permission_level':   permission_level,
                'can_receive_alerts': can_receive_alerts,
                'is_active':          False,
            }
        )
        link.permission_level   = permission_level
        link.can_receive_alerts = can_receive_alerts
        link.is_active          = False
        link.generate_invite_token()

        # TODO: send email via NotificationService (Phase 7)
        logger.info(f'Caregiver invite token generated for {caregiver_email}: {link.invite_token}')
        return link

    @staticmethod
    def accept_invite(token: str, caregiver_user) -> 'PatientCaregiverLink':
        from .models import PatientCaregiverLink, Caregiver

        link = PatientCaregiverLink.objects.filter(invite_token=token).first()
        if not link or not link.is_invite_valid:
            raise InvalidInviteTokenError()

        caregiver, _ = Caregiver.objects.get_or_create(user=caregiver_user)
        if link.caregiver != caregiver:
            raise InvalidInviteTokenError()

        link.is_active    = True
        link.accepted_at  = timezone.now()
        link.invite_token = None
        link.save(update_fields=['is_active', 'accepted_at', 'invite_token', 'updated_at'])

        try:
            from agenthandover import get_orchestrator
            get_orchestrator().broadcast('CAREGIVER_ACCEPTED', {
                'patient_id':   str(link.patient.user.id),
                'caregiver_id': str(caregiver_user.id),
            })
        except Exception:
            pass

        return link


class DrugInteractionChecker:

    @staticmethod
    def check(patient, new_medication_id) -> list:
        """
        Returns list of interaction dicts for new medication
        against all active prescriptions of the patient.
        """
        from .models import Prescription, DrugInteraction
        active_med_ids = Prescription.objects.filter(
            patient=patient, is_active=True, deleted_at__isnull=True
        ).values_list('medication_id', flat=True)

        interactions = DrugInteraction.objects.filter(
            Q(medication_a_id=new_medication_id, medication_b_id__in=active_med_ids) |
            Q(medication_b_id=new_medication_id, medication_a_id__in=active_med_ids)
        ).select_related('medication_a', 'medication_b')

        return [
            {
                'medication_a':  i.medication_a.name,
                'medication_b':  i.medication_b.name,
                'severity':      i.severity,
                'description':   i.description,
            }
            for i in interactions
        ]


class PrescriptionService:

    @staticmethod
    def create(patient, validated_data: dict) -> 'Prescription':
        from apps.subscriptions.gates import SubscriptionGate
        from .models import Prescription

        current_prescriptions = Prescription.objects.filter(patient=patient, deleted_at__isnull=True).count()
        SubscriptionGate.check_medication_limit(patient.user, current_prescriptions)

        prescription = Prescription.objects.create(patient=patient, **validated_data)

        # Trigger schedule generation if schedules provided
        try:
            from agenthandover import get_orchestrator
            get_orchestrator().broadcast('PRESCRIPTION_CREATED', {
                'patient_id':      str(patient.user.id),
                'prescription_id': str(prescription.id),
                'medication':      prescription.medication.name,
            })
        except Exception:
            pass

        return prescription


class OpenFDAInteractionService:
    """
    Service to interface with OpenFDA for drug-drug interaction checking.
    """
    
    @staticmethod
    def check(drug_a, drug_b) -> dict:
        """
        Mock implementation of OpenFDA interaction check.
        In production, this would call https://api.fda.gov/drug/event.json
        """
        # drug_a, drug_b are Medication instances
        
        # Canonical severe pairs for demo
        severe_pairs = [
            ('Warfarin', 'Aspirin'),
            ('Sildenafil', 'Nitroglycerin'),
            ('Simvastatin', 'Clarithromycin'),
            ('Methotrexate', 'NSAIDs'),
            ('Digoxin', 'Amiodarone')
        ]
        
        name_a = drug_a.name.strip().title()
        name_b = drug_b.name.strip().title()
        
        # Check against local DB first if needed, but here we simulate OpenFDA
        for p1, p2 in severe_pairs:
            if (name_a == p1 and name_b == p2) or (name_a == p2 and name_b == p1):
                return {
                    'severity': 'SEVERE',
                    'description': f'Severe interaction detected between {name_a} and {name_b}. Potential for life-threatening complications.',
                    'drug_names': f'{name_a} + {name_b}',
                    'source': 'OpenFDA (Simulated)'
                }
        
        # Moderate interactions
        moderate_pairs = [
            ('Metformin', 'Contrast Media'),
            ('Lisinopril', 'Spironolactone')
        ]
        for p1, p2 in moderate_pairs:
            if (name_a == p1 and name_b == p2) or (name_a == p2 and name_b == p1):
                return {
                    'severity': 'MODERATE',
                    'description': f'Moderate interaction between {name_a} and {name_b}. Monitor for side effects.',
                    'drug_names': f'{name_a} + {name_b}',
                    'source': 'OpenFDA (Simulated)'
                }

        return None
