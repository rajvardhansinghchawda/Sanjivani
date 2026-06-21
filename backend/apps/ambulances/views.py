# apps/ambulances/views.py
from django.utils import timezone
from django.db.models import Q, Avg
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, status, filters
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.notifications.notify import notify_driver_new_request

from core.permissions import (
    IsReception, IsAmbulanceDriver,
    IsStaffMember, IsAdminUser, IsSameHospitalStaff
)
from apps.patients.models import Patient
from .models import Ambulance, AmbulanceRequest
from .serializers import (
    AmbulanceSerializer, AmbulancePublicSerializer,
    AmbulanceStatusUpdateSerializer, LocationUpdateSerializer,
    AmbulanceRequestSerializer, BookAmbulanceSerializer,
    RateAmbulanceSerializer,
)
from .cache import (
    get_available_ambulances_in_city,
    invalidate_city_ambulances,
    set_ambulance_status, get_ambulance_status,
    update_driver_location, get_driver_location,
    set_active_request, get_active_request, clear_active_request,
)


# ─────────────────────────────────────────────────────────────
#  Public — patient portal
# ─────────────────────────────────────────────────────────────

class AvailableAmbulancesView(APIView):
    """
    GET /api/ambulances/available/?city=Bhopal&type=basic
    GET /api/ambulances/available/?lat=22.7&lng=75.8&radius=10&type=icu
    Patient portal — shows available ambulances in a city or by location.
    Serves from Redis cache (1 min TTL for city-based, computed on-demand for nearby).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        ambulance_type = request.query_params.get('type', '').strip()
        lat_str = request.query_params.get('lat', '').strip()
        lng_str = request.query_params.get('lng', '').strip()
        radius_str = request.query_params.get('radius', '10').strip()
        city = request.query_params.get('city', '').strip()

        data = []

        # ─ Location-based search (lat/lng/radius) ─
        if lat_str and lng_str:
            try:
                lat = float(lat_str)
                lng = float(lng_str)
                radius = float(radius_str) if radius_str else 10
                data = self._find_nearby_ambulances(lat, lng, radius)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Invalid lat/lng/radius. Must be numbers.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        # ─ City-based search (cached) ─
        elif city:
            from .cache import get_available_ambulances_in_city
            data = get_available_ambulances_in_city(city)
        else:
            return Response(
                {'error': 'Either (city) or (lat/lng) params are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Filter by type in memory — avoids DB hit
        if ambulance_type:
            data = [a for a in data if a['ambulance_type'] == ambulance_type]

        return Response({
            'method'     : 'nearby' if (lat_str and lng_str) else 'city',
            'city'       : city or 'By location',
            'count'      : len(data),
            'ambulances' : data,
        })

    def _find_nearby_ambulances(self, lat, lng, radius_km):
        """
        Find ambulances within radius_km of (lat, lng).
        Uses Haversine formula for distance calculation.
        """
        from math import radians, sin, cos, sqrt, atan2
        from .models import Ambulance

        def haversine(lat1, lng1, lat2, lng2):
            """Distance in km between two coordinates."""
            R = 6371  # Earth radius in km
            dlat = radians(lat2 - lat1)
            dlng = radians(lng2 - lng1)
            a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
            c = 2 * atan2(sqrt(a), sqrt(1 - a))
            return R * c

        qs = Ambulance.objects.filter(
            status=Ambulance.Status.AVAILABLE,
            is_active=True
        ).values(
            'id', 'vehicle_number', 'ambulance_type',
            'driver_name', 'driver_phone',
            'latitude', 'longitude', 'service_rating', 'city',
        )

        result = []
        for item in qs:
            if item['latitude'] is None or item['longitude'] is None:
                continue
            dist = haversine(lat, lng, float(item['latitude']), float(item['longitude']))
            if dist <= radius_km:
                result.append({
                    **item,
                    'id': str(item['id']),
                    'distance_km': round(dist, 2)
                })

        # Sort by distance (closest first)
        result.sort(key=lambda x: x['distance_km'])
        return result



class BookAmbulanceView(APIView):
    """
    POST /api/ambulances/book/
    Patient books an ambulance — no login needed.
    System auto-assigns nearest available ambulance.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = BookAmbulanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # find nearest available ambulance in the city
        ambulance = Ambulance.objects.filter(
            city__iexact=data['pickup_city'],
            ambulance_type=data['ambulance_type'],
            status=Ambulance.Status.AVAILABLE,
            is_active=True
        ).order_by('service_rating').last()   # highest rated first

        if not ambulance:
            return Response(
                {
                    'error'  : 'No ambulances available in your area right now',
                    'city'   : data['pickup_city'],
                    'type'   : data['ambulance_type'],
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # get or create patient record
        patient = None
        if data.get('patient_id'):
            try:
                patient = Patient.objects.get(pk=data['patient_id'])
            except Patient.DoesNotExist:
                pass

        if not patient:
            patient = Patient.objects.create(
                full_name=data['requester_name'],
                phone=data['requester_phone'],
            )

        # create the request
        amb_request = AmbulanceRequest.objects.create(
            ambulance            = ambulance,
            patient              = patient,
            destination_hospital_id = data.get('destination_hospital'),
            pickup_address       = data['pickup_address'],
            pickup_latitude      = data.get('pickup_latitude'),
            pickup_longitude     = data.get('pickup_longitude'),
            pickup_city          = data['pickup_city'],
            ambulance_type       = data['ambulance_type'],
            requester_name       = data['requester_name'],
            requester_phone      = data['requester_phone'],
            notes                = data.get('notes', ''),
            source               = AmbulanceRequest.RequestSource.PATIENT,
        )

        # mark ambulance as on trip
        ambulance.status = Ambulance.Status.ON_TRIP
        ambulance.save(update_fields=['status', 'updated_at'])

        # update Redis
        set_ambulance_status(str(ambulance.id), Ambulance.Status.ON_TRIP)
        set_active_request(str(ambulance.id), str(amb_request.id))
        invalidate_city_ambulances(ambulance.city)

        try:
                notify_driver_new_request(str(ambulance.id), amb_request)
        except Exception:
            # never let notification failure break the booking
            # driver can still see the request on next dashboard poll
            pass

        

        return Response({
            'message'     : 'Ambulance booked successfully',
            'request_id'  : str(amb_request.id),
            'driver_name' : ambulance.driver_name,
            'driver_phone': ambulance.driver_phone,
            'vehicle'     : ambulance.vehicle_number,
            'eta_note'    : 'Driver will contact you shortly',
        }, status=status.HTTP_201_CREATED)


class TrackAmbulanceView(APIView):
    """
    GET /api/ambulances/track/<request_id>/
    Patient tracks live driver location for their active request.
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            amb_request = AmbulanceRequest.objects.select_related(
                'ambulance'
            ).get(pk=pk)
        except AmbulanceRequest.DoesNotExist:
            return Response({'error': 'Request not found'}, status=404)

        location = None
        if amb_request.ambulance:
            location = get_driver_location(str(amb_request.ambulance.id))

        return Response({
            'request_id'  : str(amb_request.id),
            'status'      : amb_request.status,
            'driver_name' : amb_request.ambulance.driver_name if amb_request.ambulance else None,
            'driver_phone': amb_request.ambulance.driver_phone if amb_request.ambulance else None,
            'vehicle'     : amb_request.ambulance.vehicle_number if amb_request.ambulance else None,
            'live_location': location,
        })


class RateAmbulanceView(APIView):
    """
    POST /api/ambulances/rate/<request_id>/
    Patient rates the service after trip is completed.
    Updates the ambulance's average rating.
    """
    permission_classes = [AllowAny]

    def post(self, request, pk):
        try:
            amb_request = AmbulanceRequest.objects.select_related(
                'ambulance'
            ).get(pk=pk, status=AmbulanceRequest.Status.COMPLETED)
        except AmbulanceRequest.DoesNotExist:
            return Response(
                {'error': 'Completed request not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = RateAmbulanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amb_request.patient_rating = serializer.validated_data['rating']
        amb_request.save(update_fields=['patient_rating'])

        # recalculate ambulance average rating
        ambulance = amb_request.ambulance
        avg = AmbulanceRequest.objects.filter(
            ambulance=ambulance,
            patient_rating__isnull=False
        ).aggregate(avg=Avg('patient_rating'))['avg']

        ambulance.service_rating = round(avg, 2)
        ambulance.save(update_fields=['service_rating'])

        return Response({'message': 'Thank you for your rating'})


# ─────────────────────────────────────────────────────────────
#  Driver portal — ambulance driver's own views
# ─────────────────────────────────────────────────────────────

class DriverDashboardView(APIView):
    """
    GET /api/ambulances/driver/dashboard/
    Driver sees their ambulance info + active request if any.
    """
    permission_classes = [IsAmbulanceDriver]

    def get(self, request):
        try:
            ambulance = request.user.ambulance
        except Ambulance.DoesNotExist:
            return Response(
                {'error': 'No ambulance assigned to your account'},
                status=status.HTTP_404_NOT_FOUND
            )

        active_request_id = get_active_request(str(ambulance.id))
        active_request    = None

        if active_request_id:
            try:
                active_request = AmbulanceRequest.objects.select_related(
                    'patient', 'destination_hospital'
                ).get(pk=active_request_id)
            except AmbulanceRequest.DoesNotExist:
                pass

        return Response({
            'ambulance'     : AmbulanceSerializer(ambulance).data,
            'active_request': AmbulanceRequestSerializer(active_request).data if active_request else None,
        })


class DriverSetAvailabilityView(APIView):
    """
    PATCH /api/ambulances/driver/availability/
    Driver marks themselves available or goes offline.
    Body: { "status": "available" | "inactive" }
    """
    permission_classes = [IsAmbulanceDriver]

    def patch(self, request):
        try:
            ambulance = request.user.ambulance
        except Ambulance.DoesNotExist:
            return Response({'error': 'No ambulance assigned'}, status=404)

        new_status = request.data.get('status')
        allowed    = [Ambulance.Status.AVAILABLE, Ambulance.Status.INACTIVE]

        if new_status not in allowed:
            return Response(
                {'error': f'Status must be one of {allowed}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # can't go available while on a trip
        if ambulance.status == Ambulance.Status.ON_TRIP:
            return Response(
                {'error': 'Cannot change status while on a trip'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ambulance.status = new_status
        ambulance.save(update_fields=['status', 'updated_at'])

        set_ambulance_status(str(ambulance.id), new_status)
        invalidate_city_ambulances(ambulance.city)

        return Response({'status': new_status, 'message': 'Availability updated'})


class DriverUpdateLocationView(APIView):
    """
    POST /api/ambulances/driver/location/
    Driver app sends GPS every ~10 seconds while on a trip.
    Stored in Redis only — not persisted to DB.
    Body: { "latitude": 23.2599, "longitude": 77.4126 }
    """
    permission_classes = [IsAmbulanceDriver]

    def post(self, request):
        serializer = LocationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            ambulance = request.user.ambulance
        except Ambulance.DoesNotExist:
            return Response({'error': 'No ambulance assigned'}, status=404)

        update_driver_location(
            str(ambulance.id),
            float(serializer.validated_data['latitude']),
            float(serializer.validated_data['longitude']),
        )
        return Response({'message': 'Location updated'})


class DriverTripActionView(APIView):
    """
    POST /api/ambulances/driver/trip/<request_id>/action/
    Driver moves the trip through its lifecycle.

    Actions:
      accept     → ACCEPTED  (driver confirms they're going)
      en_route   → EN_ROUTE  (driver has started moving to patient)
      picked_up  → PICKED_UP (patient is on board)
      complete   → COMPLETED (arrived at hospital)
      cancel     → CANCELLED (driver cannot go)
    """
    permission_classes = [IsAmbulanceDriver]

    VALID_TRANSITIONS = {
        'accept'   : ([AmbulanceRequest.Status.PENDING],   AmbulanceRequest.Status.EN_ROUTE),
        'picked_up': ([AmbulanceRequest.Status.EN_ROUTE],  AmbulanceRequest.Status.PICKED_UP),
        'complete' : ([AmbulanceRequest.Status.PICKED_UP, AmbulanceRequest.Status.EN_ROUTE, AmbulanceRequest.Status.PENDING, AmbulanceRequest.Status.ACCEPTED], AmbulanceRequest.Status.COMPLETED),
        'cancel'   : ([AmbulanceRequest.Status.PENDING, AmbulanceRequest.Status.EN_ROUTE, AmbulanceRequest.Status.PICKED_UP, AmbulanceRequest.Status.ACCEPTED],   AmbulanceRequest.Status.CANCELLED),
    }

    def post(self, request, pk):
        action = request.data.get('action')

        if action not in self.VALID_TRANSITIONS:
            return Response(
                {'error': f'Invalid action. Choose from: {list(self.VALID_TRANSITIONS.keys())}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            ambulance   = request.user.ambulance
            amb_request = AmbulanceRequest.objects.select_related(
                'ambulance', 'patient', 'destination_hospital'
            ).get(pk=pk, ambulance=ambulance)
        except (Ambulance.DoesNotExist, AmbulanceRequest.DoesNotExist):
            return Response({'error': 'Request not found'}, status=404)

        required_from_list, new_status = self.VALID_TRANSITIONS[action]

        # validate current state allows this transition
        if amb_request.status not in required_from_list:
            return Response(
                {'error': f'Cannot {action} a request in {amb_request.status} state'},
                status=status.HTTP_400_BAD_REQUEST
            )

        now = timezone.now()

        # apply the transition
        amb_request.status = new_status

        if action == 'accept':
            amb_request.accepted_at       = now
            amb_request.response_time_sec = int(
                (now - amb_request.requested_at).total_seconds()
            )
            # Mark ambulance on trip
            ambulance.status = Ambulance.Status.ON_TRIP
            ambulance.save(update_fields=['status', 'updated_at'])
            
            # Broadcast to patient
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            from apps.triage.models import EmergencyCase
            
            try:
                case = EmergencyCase.objects.filter(patient_name=amb_request.requester_name).order_by('-created_at').first()
                if case:
                    case_id = case.case_id
                    patient_group_name = f'patient_{str(case_id).replace("-", "_")}'
                    channel_layer = get_channel_layer()
                    async_to_sync(channel_layer.group_send)(
                        patient_group_name,
                        {
                            "type": "dispatch_assigned",
                            "ambulance_id": str(ambulance.id),
                            "driver_name": ambulance.driver_name,
                            "vehicle_number": ambulance.vehicle_number,
                            "eta_to_patient_minutes": 10
                        }
                    )
                    
                    # Send Twilio SMS to patient with Tracking Link
                    from twilio.rest import Client as TwilioClient
                    from django.conf import settings
                    try:
                        twilio_client = TwilioClient(
                            settings.TWILIO_ACCOUNT_SID,
                            settings.TWILIO_AUTH_TOKEN
                        )
                        tracking_link = f"http://localhost:5173/track/{case_id}"
                        message_body = (
                            f"🚨 MedGrid SOS: Ambulance {ambulance.vehicle_number} has been dispatched! "
                            f"Driver: {ambulance.driver_name}. "
                            f"Track live here: {tracking_link}"
                        )
                        twilio_client.messages.create(
                            body=message_body,
                            to=amb_request.requester_phone,
                            from_=settings.TWILIO_PHONE_NUMBER
                        )
                        print(f"[SMS Sent] To {amb_request.requester_phone}: {tracking_link}")
                    except Exception as e:
                        print(f"Failed to send Twilio SMS: {e}")

            except Exception as e:
                print(f"Error in broadcast/SMS: {e}")

        elif action == 'picked_up':
            amb_request.picked_up_at = now
            
            # Alert the hospital that the patient is inbound
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            from apps.triage.models import EmergencyCase
            
            try:
                case = EmergencyCase.objects.filter(patient_phone=amb_request.requester_phone).order_by('-created_at').first()
                if not case:
                    case = EmergencyCase.objects.filter(patient_name=amb_request.requester_name).order_by('-created_at').first()
                if case:
                    channel_layer = get_channel_layer()
                    async_to_sync(channel_layer.group_send)(
                        "triage_dashboard",
                        {
                            "type": "patient_incoming",
                            "data": {
                                "case_id": str(case.case_id),
                                "patient_name": case.patient_name,
                                "patient_phone": case.patient_phone,
                                "severity": case.ai_p_level,
                                "symptoms": case.raw_symptoms_text,
                                "ambulance_vehicle": ambulance.vehicle_number,
                                "driver_name": ambulance.driver_name,
                                "eta_minutes": 10
                            }
                        }
                    )
            except Exception as e:
                print(f"Failed to send patient_incoming alert: {e}")

        elif action == 'complete':
            # Alert the hospital that the patient has arrived for admission
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            from apps.triage.models import EmergencyCase
            
            try:
                case = EmergencyCase.objects.filter(patient_phone=amb_request.requester_phone).order_by('-created_at').first()
                if not case:
                    case = EmergencyCase.objects.filter(patient_name=amb_request.requester_name).order_by('-created_at').first()
                if case:
                    channel_layer = get_channel_layer()
                    # We broadcast to triage_dashboard, ReceptionPortalPage will also listen to this
                    async_to_sync(channel_layer.group_send)(
                        "triage_dashboard",
                        {
                            "type": "patient_arrived",
                            "data": {
                                "case_id": str(case.case_id),
                                "patient_name": case.patient_name,
                                "patient_phone": case.patient_phone,
                                "patient_age": case.patient_age,
                                "patient_gender": case.patient_gender,
                                "severity": case.ai_p_level,
                                "symptoms": case.raw_symptoms_text,
                                "required_bed_type": case.needs_profile.get('required_bed_type', '') if case.needs_profile else '',
                                "ambulance_vehicle": ambulance.vehicle_number,
                                "driver_name": ambulance.driver_name,
                            }
                        }
                    )
            except Exception as e:
                print(f"Failed to send patient_arrived alert: {e}")

            amb_request.completed_at      = now
            amb_request.trip_duration_sec = int(
                (now - amb_request.picked_up_at).total_seconds()
            ) if amb_request.picked_up_at else None

            # free the ambulance
            ambulance.status         = Ambulance.Status.AVAILABLE
            ambulance.trips_completed += 1
            ambulance.save(update_fields=['status', 'trips_completed', 'updated_at'])

            clear_active_request(str(ambulance.id))
            set_ambulance_status(str(ambulance.id), Ambulance.Status.AVAILABLE)
            invalidate_city_ambulances(ambulance.city)

        elif action == 'cancel':
            amb_request.cancellation_reason = request.data.get('reason', '')
            ambulance.status = Ambulance.Status.AVAILABLE
            ambulance.save(update_fields=['status', 'updated_at'])
            clear_active_request(str(ambulance.id))
            set_ambulance_status(str(ambulance.id), Ambulance.Status.AVAILABLE)
            invalidate_city_ambulances(ambulance.city)

        amb_request.save()

        return Response({
            'message'   : f'Trip status updated to {new_status}',
            'request'   : AmbulanceRequestSerializer(amb_request).data,
        })


class DriverTripHistoryView(generics.ListAPIView):
    """
    GET /api/ambulances/driver/trips/
    Driver's completed trip history.
    """
    permission_classes = [IsAmbulanceDriver]
    serializer_class   = AmbulanceRequestSerializer
    filter_backends    = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields   = ['status']
    ordering_fields    = ['requested_at', 'completed_at']

    def get_queryset(self):
        return AmbulanceRequest.objects.filter(
            ambulance=self.request.user.ambulance
        ).select_related('patient', 'destination_hospital')


# ─────────────────────────────────────────────────────────────
#  Admin / Reception — management views
# ─────────────────────────────────────────────────────────────

class AmbulanceListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/ambulances/manage/   → list all ambulances
    POST /api/ambulances/manage/   → register new ambulance
    """
    serializer_class = AmbulanceSerializer
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['city', 'ambulance_type', 'status', 'is_active']
    search_fields    = ['vehicle_number', 'driver_name', 'driver_phone']

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsStaffMember()]
        return [IsAdminUser()]

    def get_queryset(self):
        return Ambulance.objects.select_related(
            'hospital', 'driver'
        ).filter(is_active=True)


class AmbulanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/ambulances/manage/<id>/
    PATCH  /api/ambulances/manage/<id>/
    DELETE /api/ambulances/manage/<id>/
    """
    serializer_class = AmbulanceSerializer
    queryset         = Ambulance.objects.select_related('hospital', 'driver')

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsStaffMember()]
        return [IsAdminUser()]

    def perform_update(self, serializer):
        ambulance = serializer.save()
        invalidate_city_ambulances(ambulance.city)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()
        invalidate_city_ambulances(instance.city)


class AllRequestsView(generics.ListAPIView):
    """
    GET /api/ambulances/requests/
    Staff sees all ambulance requests with filters.
    """
    permission_classes = [IsStaffMember]
    serializer_class   = AmbulanceRequestSerializer
    filter_backends    = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields   = ['status', 'ambulance_type', 'source', 'pickup_city']
    ordering_fields    = ['requested_at', 'completed_at']

    def get_queryset(self):
        return AmbulanceRequest.objects.select_related(
            'ambulance', 'patient', 'destination_hospital'
        )
    
# apps/ambulances/views.py — add below DriverSetAvailabilityView

class ReceptionAmbulanceStatusView(APIView):
    """
    PATCH /api/ambulances/<id>/status/
    Reception OR driver can update ambulance availability.

    Reception use cases:
      - Mark hospital's ambulance under maintenance
      - Mark it available after service
      - Override driver status if driver is unresponsive

    Driver use cases (same endpoint, same body):
      - Toggle available / inactive when going off shift

    Body: { "status": "available" | "maintenance" | "inactive" }
    """
    def get_permissions(self):
        # both reception staff and driver can call this
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def patch(self, request, pk):
        try:
            ambulance = Ambulance.objects.select_related(
                'hospital', 'driver'
            ).get(pk=pk)
        except Ambulance.DoesNotExist:
            return Response(
                {'error': 'Ambulance not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        user     = request.user
        new_status = request.data.get('status')
        reason   = request.data.get('reason', '')

        # ── permission check ──────────────────────────────────
        # reception can only update ambulances at their hospital
        if user.role == 'reception':
            if not user.hospital or str(ambulance.hospital_id) != str(user.hospital_id):
                return Response(
                    {'error': 'You can only update ambulances at your hospital'},
                    status=status.HTTP_403_FORBIDDEN
                )
            allowed_statuses = [
                Ambulance.Status.AVAILABLE,
                Ambulance.Status.MAINTENANCE,
                Ambulance.Status.INACTIVE,
            ]

        # driver can only update their own ambulance
        elif user.role == 'ambulance':
            if not hasattr(user, 'ambulance') or str(user.ambulance.id) != str(pk):
                return Response(
                    {'error': 'You can only update your own ambulance'},
                    status=status.HTTP_403_FORBIDDEN
                )
            # driver cannot put ambulance in maintenance (that's reception's job)
            allowed_statuses = [
                Ambulance.Status.AVAILABLE,
                Ambulance.Status.INACTIVE,
            ]

        # admin can update any ambulance to any status
        elif user.role == 'admin':
            allowed_statuses = [s.value for s in Ambulance.Status]

        else:
            return Response(
                {'error': 'You do not have permission to update ambulance status'},
                status=status.HTTP_403_FORBIDDEN
            )

        # ── validate status ───────────────────────────────────
        if new_status not in allowed_statuses:
            return Response(
                {
                    'error'  : f'Invalid status for your role. Allowed: {allowed_statuses}',
                    'current': ambulance.status,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── block status change while on trip ─────────────────
        if ambulance.status == Ambulance.Status.ON_TRIP and new_status != Ambulance.Status.ON_TRIP:
            return Response(
                {'error': 'Cannot change status while ambulance is on a trip'},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status         = ambulance.status
        ambulance.status   = new_status
        ambulance.save(update_fields=['status', 'updated_at'])

        # update Redis
        set_ambulance_status(str(ambulance.id), new_status)
        invalidate_city_ambulances(ambulance.city)

        return Response({
            'message'    : f'Ambulance status updated to {new_status}',
            'ambulance'  : str(ambulance.id),
            'vehicle'    : ambulance.vehicle_number,
            'old_status' : old_status,
            'new_status' : new_status,
            'updated_by' : user.full_name,
            'role'       : user.role,
        })
    
