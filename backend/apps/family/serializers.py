from rest_framework import serializers
from .models import FamilyGroup, FamilyMember

class FamilyMemberSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = FamilyMember
        fields = ['id', 'user', 'user_name', 'user_email', 'role', 'joined_at', 'is_active']
        read_only_fields = ['id', 'joined_at']

class FamilyGroupSerializer(serializers.ModelSerializer):
    members = FamilyMemberSerializer(source='familymember_set', many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = FamilyGroup
        fields = ['id', 'name', 'created_by', 'created_by_name', 'created_at', 'members']
        read_only_fields = ['id', 'created_by', 'created_at']
