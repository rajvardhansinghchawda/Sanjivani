"""
apps/identity/urls/auth.py — Auth URL patterns.
"""
from django.urls import path
from ..views.auth import (
    RegisterView, LoginView, LogoutView, TokenRefreshView,
    PasswordChangeView, PasswordResetRequestView, PasswordResetConfirmView,
    MFASetupView, MFAVerifyView, MFABackupCodesView,
    VerifyEmailView, GoogleLoginView,
    RequestOTPView, LoginWithOTPView,
)

urlpatterns = [
    path('register/',             RegisterView.as_view(),             name='auth-register'),
    path('login/',                LoginView.as_view(),                name='auth-login'),
    path('logout/',               LogoutView.as_view(),               name='auth-logout'),
    path('refresh/',              TokenRefreshView.as_view(),         name='auth-refresh'),
    path('password/change/',      PasswordChangeView.as_view(),       name='auth-password-change'),
    path('password/reset/',       PasswordResetRequestView.as_view(), name='auth-password-reset'),
    path('password/reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
    path('mfa/setup/',            MFASetupView.as_view(),             name='auth-mfa-setup'),
    path('mfa/verify/',           MFAVerifyView.as_view(),            name='auth-mfa-verify'),
    path('mfa/backup-codes/',     MFABackupCodesView.as_view(),       name='auth-mfa-backup-codes'),
    path('verify-email/',         VerifyEmailView.as_view(),          name='auth-verify-email'),
    path('google/',               GoogleLoginView.as_view(),          name='auth-google-login'),
    path('otp/request/',          RequestOTPView.as_view(),           name='auth-otp-request'),
    path('login/otp/',            LoginWithOTPView.as_view(),         name='auth-login-otp'),
]
