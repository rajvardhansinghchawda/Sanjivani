from django.urls import path
from .views import ReportShareView, ReportAccessView

urlpatterns = [
    path('share/', ReportShareView.as_view(), name='report-share'),
    path('access/<str:token>/', ReportAccessView.as_view(), name='report-access'),
]
