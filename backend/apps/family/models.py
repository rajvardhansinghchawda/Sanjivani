"""
apps/family/models.py — Phase 17: Family Multi-Patient Account
"""
from django.db import models
from shared.models import BaseModel


RELATIONSHIP_CHOICES = [
    ('self',    'Self'),
    ('spouse',  'Spouse'),
    ('father',  'Father'),
    ('mother',  'Mother'),
    ('child',   'Child'),
    ('sibling', 'Sibling'),
    ('other',   'Other'),
]


class FamilyGroup(BaseModel):
    name    = models.CharField(max_length=100)
    owner   = models.ForeignKey('identity.User', on_delete=models.PROTECT, related_name='owned_family_groups')

    class Meta:
        db_table = 'family_groups'

    def __str__(self):
        return f'{self.name} (owner: {self.owner})'


class FamilyMember(BaseModel):
    group        = models.ForeignKey(FamilyGroup, on_delete=models.CASCADE, related_name='members')
    patient      = models.ForeignKey('clinical.Patient', on_delete=models.CASCADE, related_name='family_memberships')
    relationship = models.CharField(max_length=20, choices=RELATIONSHIP_CHOICES)
    added_by     = models.ForeignKey('identity.User', on_delete=models.PROTECT, related_name='+')

    class Meta:
        db_table = 'family_members'
        unique_together = ('group', 'patient')

    def __str__(self):
        return f'{self.patient} ({self.relationship}) in {self.group}'
