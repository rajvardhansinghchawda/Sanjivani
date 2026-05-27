from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import VitalReading, VitalTarget
from .serializers import VitalReadingSerializer, VitalTargetSerializer
from .services import VitalsService

class VitalTargetViewSet(viewsets.ModelViewSet):
    serializer_class = VitalTargetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return VitalTarget.objects.filter(patient=self.request.user)

    def perform_create(self, serializer):
        serializer.save(patient=self.request.user)

class VitalReadingViewSet(viewsets.ModelViewSet):
    serializer_class = VitalReadingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return VitalReading.objects.filter(patient=self.request.user).order_by('-measured_at')

    def create(self, request, *args, **kwargs):
        vital_type = request.data.get('vital_type')
        value = request.data.get('value')
        unit = request.data.get('unit')
        source = request.data.get('source', 'MANUAL')

        if not vital_type or value is None or not unit:
            return Response({"error": "vital_type, value, and unit are required."}, status=status.HTTP_400_BAD_REQUEST)

        reading = VitalsService.log_vital(
            patient=request.user,
            vital_type=vital_type,
            value=float(value),
            unit=unit,
            source=source
        )
        
        serializer = self.get_serializer(reading)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
