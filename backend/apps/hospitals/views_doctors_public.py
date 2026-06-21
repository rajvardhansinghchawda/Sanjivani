# apps/hospitals/views_doctors_public.py
# Public Doctor Search + AI Symptom Category API

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import Doctor, Hospital
from .serializers import DoctorSerializer


@api_view(['GET'])
@permission_classes([AllowAny])
def public_doctors_view(request):
    """
    GET /api/hospitals/doctors/public/
    Public endpoint — patients & doctor portal use this.
    Supports: ?specialization=cardiology &status=active &on_duty=true &search=name
    """
    qs = Doctor.objects.select_related('hospital', 'department').filter(
        hospital__status=Hospital.Status.ACTIVE
    )

    spec     = request.query_params.get('specialization')
    status_f = request.query_params.get('status')
    search   = request.query_params.get('search')
    on_duty  = request.query_params.get('on_duty')

    if spec:
        qs = qs.filter(specialization__icontains=spec)
    if status_f:
        qs = qs.filter(status=status_f)
    if search:
        qs = qs.filter(full_name__icontains=search)

    doctors_data = DoctorSerializer(qs, many=True).data

    if on_duty and on_duty.lower() == 'true':
        doctors_data = [d for d in doctors_data if d.get('is_on_duty_now')]

    return Response(doctors_data)


@api_view(['GET'])
@permission_classes([AllowAny])
def symptom_to_category_view(request):
    """
    GET /api/hospitals/symptom-category/?symptoms=chest+pain
    Returns best-matching doctor category from symptoms text.
    """
    symptoms_text = request.query_params.get('symptoms', '').lower()

    KEYWORD_MAP = [
        (['chest pain', 'heart', 'cardiac', 'palpitation', 'angina'],        'cardiology',  'Cardiology'),
        (['headache', 'stroke', 'seizure', 'brain', 'memory', 'paralysis'],  'neurology',   'Neurology'),
        (['bone', 'joint', 'fracture', 'spine', 'knee', 'hip', 'back pain'], 'orthopedics', 'Orthopedics'),
        (['cancer', 'tumor', 'chemo', 'oncology', 'lump'],                   'oncology',    'Oncology'),
        (['child', 'baby', 'infant', 'kid', 'pediatric'],                    'pediatrics',  'Pediatrics'),
        (['kidney', 'urine', 'dialysis', 'renal', 'creatinine'],             'nephrology',  'Nephrology'),
        (['breath', 'lungs', 'asthma', 'cough', 'pneumonia'],                'icu',         'Pulmonology / ICU'),
        (['surgery', 'appendix', 'hernia', 'gallbladder'],                   'surgery',     'General Surgery'),
        (['emergency', 'accident', 'trauma', 'unconscious', 'bleeding'],     'emergency',   'Emergency Medicine'),
        (['x-ray', 'mri', 'ct scan', 'ultrasound', 'scan'],                  'radiology',   'Radiology'),
        (['stomach', 'gastro', 'vomit', 'nausea', 'diarrhea', 'liver'],      'general',     'General Medicine'),
    ]

    matched = None
    score   = 0
    for keywords, spec_value, spec_label in KEYWORD_MAP:
        hits = sum(1 for kw in keywords if kw in symptoms_text)
        if hits > score:
            score = hits
            matched = {
                'specialization': spec_value,
                'category': spec_label,
                'confidence': min(0.95, 0.5 + hits * 0.15)
            }

    if not matched:
        matched = {'specialization': 'general', 'category': 'General Medicine', 'confidence': 0.3}

    return Response({'input': symptoms_text, 'matched': matched, 'score': score})
