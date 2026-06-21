# apps/authentication/urls.py
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    ProfileView,
    ChangePasswordView,
    UserListView,
    UserDetailView,
)

urlpatterns = [
    path('register/',        RegisterView.as_view(),       name='auth-register'),
    path('login/',           LoginView.as_view(),           name='auth-login'),
    path('logout/',          LogoutView.as_view(),          name='auth-logout'),
    path('token/refresh/',   TokenRefreshView.as_view(),    name='token-refresh'),
    path('profile/',         ProfileView.as_view(),         name='auth-profile'),
    path('change-password/', ChangePasswordView.as_view(),  name='change-password'),
    path('users/',           UserListView.as_view(),        name='auth-users'),
    path('users/<uuid:pk>/',    UserDetailView.as_view(),      name='auth-user-detail'),
]