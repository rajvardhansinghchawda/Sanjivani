# apps/authentication/views.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import User
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserProfileSerializer,
    ChangePasswordSerializer,
)
from core.permissions import IsAdminUser


class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/
    Creates a new user. Typically called by admin
    when onboarding new staff.
    """
    permission_classes = [AllowAny]
    serializer_class   = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            'message': 'Account created successfully',
            'user': UserProfileSerializer(user).data
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    POST /api/auth/login/
    Returns access + refresh tokens with role embedded.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        user    = serializer.validated_data['user']
        refresh = serializer.validated_data['refresh']

        return Response({
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id':       str(user.id),
                'name':     user.full_name,
                'email':    user.email,
                'role':     user.role,
                'hospital': str(user.hospital_id) if user.hospital_id else None,
            }
        })


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklists the refresh token so it can't be reused.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Logged out successfully'})
        except TokenError:
            return Response(
                {'error': 'Invalid or expired token'},
                status=status.HTTP_400_BAD_REQUEST
            )


class ProfileView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/auth/profile/   → get logged-in user's profile
    PUT  /api/auth/profile/   → update name, phone
    """
    permission_classes = [IsAuthenticated]
    serializer_class   = UserProfileSerializer

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'message': 'Password changed successfully'})


class UserListView(generics.ListAPIView):
    """
    GET /api/auth/users/
    Platform admin: list all users.
    Hospital staff (admin/supervisor): list users in their hospital.
    """
    permission_classes = [IsAuthenticated]
    serializer_class   = UserProfileSerializer
    
    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.PLATFORM_ADMIN:
            return User.objects.all().order_by('-created_at')
        if user.hospital_id:
            return User.objects.filter(hospital_id=user.hospital_id).exclude(id=user.id).order_by('-created_at')
class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/auth/users/<id>/
    PATCH  /api/auth/users/<id>/
    DELETE /api/auth/users/<id>/
    """
    permission_classes = [IsAuthenticated]
    serializer_class   = UserProfileSerializer
    queryset           = User.objects.all()

    def perform_destroy(self, instance):
        # Prevent self-deletion and respect role hierarchy if needed
        if instance == self.request.user:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("You cannot delete your own account.")
        instance.delete()