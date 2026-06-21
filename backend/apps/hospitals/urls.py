# apps/hospitals/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    HospitalSearchView, HospitalDetailPublicView,
    HospitalViewSet,
    DepartmentListCreateView, DepartmentDetailView,
    ServiceCategoryListView, ServiceMasterListView,
    HospitalServiceView, HospitalServiceUpdateView, DoctorListCreateView, DoctorDetailView,
    DutyScheduleListCreateView, DutyScheduleDetailView,
    OnDutyNowView,
    nearby_hospitals_view,
)
from .views_doctors_public import public_doctors_view, symptom_to_category_view

router = DefaultRouter()
router.register('manage', HospitalViewSet, basename='hospital-manage')

urlpatterns = [
    # public
    path('search/',                                          HospitalSearchView.as_view(),          name='hospital-search'),
    path('<uuid:pk>/',                                       HospitalDetailPublicView.as_view(),     name='hospital-detail-public'),

    # admin / supervisor
    path('', include(router.urls)),

    # departments
    path('<uuid:hospital_id>/departments/',                  DepartmentListCreateView.as_view(),     name='dept-list'),
    path('<uuid:hospital_id>/departments/<uuid:pk>/',        DepartmentDetailView.as_view(),         name='dept-detail'),

    # service master (admin manages)
    path('service-categories/',                              ServiceCategoryListView.as_view(),      name='service-categories'),
    path('services/',                                        ServiceMasterListView.as_view(),        name='service-master'),

    # hospital services (what each hospital offers)
    path('<uuid:hospital_id>/services/',                     HospitalServiceView.as_view(),          name='hospital-services'),
    path('<uuid:hospital_id>/services/<uuid:pk>/',           HospitalServiceUpdateView.as_view(),    name='hospital-service-update'),

    path('<uuid:hospital_id>/doctors/',                 DoctorListCreateView.as_view(),       name='doctor-list'),
    path('doctors/<uuid:pk>/',                          DoctorDetailView.as_view(),           name='doctor-detail'),
    path('<uuid:hospital_id>/duty-schedules/',          DutyScheduleListCreateView.as_view(), name='duty-schedule-list'),
    path('duty-schedules/<uuid:pk>/',                   DutyScheduleDetailView.as_view(),     name='duty-schedule-detail'),
    path('<uuid:hospital_id>/on-duty-now/',             OnDutyNowView.as_view(),              name='on-duty-now'),

    # ── Nearby hospitals (Phase 2) ──────────────────────────
    path('nearby/',                                     nearby_hospitals_view,                name='hospitals-nearby'),

    # ── Public Doctor Search + AI Symptom Mapping ───────────
    path('doctors/public/',                             public_doctors_view,                  name='doctors-public'),
    path('symptom-category/',                           symptom_to_category_view,             name='symptom-category'),

]