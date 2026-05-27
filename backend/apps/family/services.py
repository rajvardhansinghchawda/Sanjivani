import logging
from django.db import transaction
from .models import FamilyGroup, FamilyMember

logger = logging.getLogger('medadhere.family')

class FamilyService:
    @staticmethod
    def create_group(owner_user, name: str) -> FamilyGroup:
        """Create a new family group."""
        return FamilyGroup.objects.create(owner=owner_user, name=name)

    @staticmethod
    def add_member(group: FamilyGroup, patient_id: str, relationship: str, added_by_user) -> FamilyMember:
        """Add a patient to a family group."""
        member, created = FamilyMember.objects.get_or_create(
            group=group,
            patient_id=patient_id,
            defaults={'relationship': relationship, 'added_by': added_by_user}
        )
        if not created:
            member.relationship = relationship
            member.save(update_fields=['relationship', 'updated_at'])
            
        # Trigger orchestrator event (Phase 17)
        try:
            from agenthandover import get_orchestrator
            from medadhere_extensions_handover import FAMILY_AGENT, ExtAgentEvent, HandoverPayload
            
            payload = HandoverPayload(
                patient_id=patient_id,
                data={'group_id': str(group.id), 'relationship': relationship},
            )
            get_orchestrator().broadcast(FAMILY_AGENT, ExtAgentEvent.FAMILY_MEMBER_ADDED, payload)
        except ImportError:
            logger.warning("Could not broadcast family member added — orchestrator missing.")
            
        return member

    @staticmethod
    def get_accessible_patients(user):
        """Get all patients the user has access to via family groups."""
        # User owns groups or is a patient in a group (though relationship 'self' usually maps to owner)
        # For simplicity, we return patients in groups owned by the user.
        return FamilyMember.objects.filter(group__owner=user).select_related('patient')
