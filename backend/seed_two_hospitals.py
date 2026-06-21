import os
import sys
import uuid
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
from django.conf import settings

if not settings.configured:
    django.setup()


def seed_data():
    from django.utils import timezone
    from apps.authentication.models import User
    from apps.hospitals.models import (
        Hospital,
        Department,
        ServiceCategory,
        ServiceMaster,
        HospitalService,
        Doctor,
    )
    from apps.beds.models import Bed, MedicalEquipment, BedAllocation
    from apps.patients.models import Patient
    from apps.resources.models import ResourceSharingRequest

    hospitals_data = [
        {
            'name': 'Indore Care Hospital',
            'category': Hospital.Category.PRIVATE,
            'hospital_type': Hospital.HospitalType.MULTISPECIALTY,
            'address': 'Scheme No. 94, Ring Road, Near Janjeerwala Square',
            'city': 'Indore',
            'area': 'Scheme 94',
            'district': 'Indore',
            'state': 'Madhya Pradesh',
            'pincode': '452010',
            'phone': '0731-4977777',
            'email': 'info@indorecarehospital.com',
            'website': 'https://indorecarehospital.com',
            'latitude': 22.7196,
            'longitude': 75.8577,
            'status': Hospital.Status.ACTIVE,
            'verification_status': Hospital.VerificationStatus.VERIFIED,
            'total_beds': 120,
            'icu_capacity': 15,
        },
        {
            'name': 'Bombay Hospital Indore',
            'category': Hospital.Category.PRIVATE,
            'hospital_type': Hospital.HospitalType.MULTISPECIALTY,
            'address': 'IDA Scheme No. 94/95, Eastern Ring Road',
            'city': 'Indore',
            'area': 'IDA Scheme 94',
            'district': 'Indore',
            'state': 'Madhya Pradesh',
            'pincode': '452010',
            'phone': '0731-6611100',
            'email': 'contact@bombayhospitalindore.com',
            'website': 'https://bombayhospitalindore.com',
            'latitude': 22.7192,
            'longitude': 75.8581,
            'status': Hospital.Status.ACTIVE,
            'verification_status': Hospital.VerificationStatus.VERIFIED,
            'total_beds': 200,
            'icu_capacity': 35,
        },
    ]

    user_data = [
        # ============ INDORE CARE HOSPITAL USERS ============
        # ADMIN Users
        {
            'email': 'admin@indorecarehospital.com',
            'password': 'Admin@123',
            'full_name': 'Rajesh Kumar - Admin',
            'role': User.Role.ADMIN,
            'phone': '9876500001',
            'hospital_name': 'Indore Care Hospital',
        },
        # RECEPTION Users
        {
            'email': 'reception1@indorecarehospital.com',
            'password': 'Reception@123',
            'full_name': 'Priya Singh - Reception',
            'role': User.Role.RECEPTION,
            'phone': '9876500002',
            'hospital_name': 'Indore Care Hospital',
        },
        {
            'email': 'reception2@indorecarehospital.com',
            'password': 'Reception@123',
            'full_name': 'Anjali Patel - Reception',
            'role': User.Role.RECEPTION,
            'phone': '9876500003',
            'hospital_name': 'Indore Care Hospital',
        },
        # SUPERVISOR Users
        {
            'email': 'supervisor@indorecarehospital.com',
            'password': 'Supervisor@123',
            'full_name': 'Dr. Vikram Desai - Supervisor',
            'role': User.Role.SUPERVISOR,
            'phone': '9876500004',
            'hospital_name': 'Indore Care Hospital',
        },
        # AMBULANCE DRIVER Users
        {
            'email': 'driver1@indorecarehospital.com',
            'password': 'Driver@123',
            'full_name': 'Arjun Verma - Driver',
            'role': User.Role.AMBULANCE,
            'phone': '9876500005',
            'hospital_name': 'Indore Care Hospital',
        },
        {
            'email': 'driver2@indorecarehospital.com',
            'password': 'Driver@123',
            'full_name': 'Mohan Sharma - Driver',
            'role': User.Role.AMBULANCE,
            'phone': '9876500006',
            'hospital_name': 'Indore Care Hospital',
        },
        # PATIENT Users
        {
            'email': 'patient1@indorecarehospital.com',
            'password': 'Patient@123',
            'full_name': 'Rohan Mehta - Patient',
            'role': User.Role.PATIENT,
            'phone': '9876500007',
            'hospital_name': 'Indore Care Hospital',
        },
        {
            'email': 'patient2@indorecarehospital.com',
            'password': 'Patient@123',
            'full_name': 'Sneha Gupta - Patient',
            'role': User.Role.PATIENT,
            'phone': '9876500008',
            'hospital_name': 'Indore Care Hospital',
        },
        
        # ============ BOMBAY HOSPITAL INDORE USERS ============
        # ADMIN Users
        {
            'email': 'admin@bombayhospitalindore.com',
            'password': 'Admin@123',
            'full_name': 'Nikhil Joshi - Admin',
            'role': User.Role.ADMIN,
            'phone': '9876500009',
            'hospital_name': 'Bombay Hospital Indore',
        },
        # RECEPTION Users
        {
            'email': 'reception1@bombayhospitalindore.com',
            'password': 'Reception@123',
            'full_name': 'Divya Nair - Reception',
            'role': User.Role.RECEPTION,
            'phone': '9876500010',
            'hospital_name': 'Bombay Hospital Indore',
        },
        {
            'email': 'reception2@bombayhospitalindore.com',
            'password': 'Reception@123',
            'full_name': 'Kavya Iyer - Reception',
            'role': User.Role.RECEPTION,
            'phone': '9876500011',
            'hospital_name': 'Bombay Hospital Indore',
        },
        # SUPERVISOR Users
        {
            'email': 'supervisor@bombayhospitalindore.com',
            'password': 'Supervisor@123',
            'full_name': 'Dr. Sanjay Rao - Supervisor',
            'role': User.Role.SUPERVISOR,
            'phone': '9876500012',
            'hospital_name': 'Bombay Hospital Indore',
        },
        # AMBULANCE DRIVER Users
        {
            'email': 'driver1@bombayhospitalindore.com',
            'password': 'Driver@123',
            'full_name': 'Suresh Singh - Driver',
            'role': User.Role.AMBULANCE,
            'phone': '9876500013',
            'hospital_name': 'Bombay Hospital Indore',
        },
        {
            'email': 'driver2@bombayhospitalindore.com',
            'password': 'Driver@123',
            'full_name': 'Ramesh Kumar - Driver',
            'role': User.Role.AMBULANCE,
            'phone': '9876500014',
            'hospital_name': 'Bombay Hospital Indore',
        },
        # PATIENT Users
        {
            'email': 'patient1@bombayhospitalindore.com',
            'password': 'Patient@123',
            'full_name': 'Arjun Pillai - Patient',
            'role': User.Role.PATIENT,
            'phone': '9876500015',
            'hospital_name': 'Bombay Hospital Indore',
        },
        {
            'email': 'patient2@bombayhospitalindore.com',
            'password': 'Patient@123',
            'full_name': 'Ritika Malhotra - Patient',
            'role': User.Role.PATIENT,
            'phone': '9876500016',
            'hospital_name': 'Bombay Hospital Indore',
        },
    ]

    service_catalog = [
        {
            'category': 'Imaging',
            'services': [
                {'code': 'IMG_MRI', 'name': 'MRI Scan', 'description': 'Magnetic resonance imaging services.'},
                {'code': 'IMG_CT', 'name': 'CT Scan', 'description': 'Computed tomography scan services.'},
                {'code': 'IMG_XRAY', 'name': 'X-Ray', 'description': 'Digital radiography services.'},
            ],
        },
        {
            'category': 'Critical Care',
            'services': [
                {'code': 'CCU', 'name': 'Critical Care Unit', 'description': 'Round-the-clock ICU care.'},
                {'code': 'VENT', 'name': 'Ventilator Support', 'description': 'Advanced ventilator support for critical patients.'},
            ],
        },
        {
            'category': 'Diagnostic',
            'services': [
                {'code': 'LAB_BLOOD', 'name': 'Blood Bank', 'description': 'Blood group matching and transfusion services.'},
                {'code': 'LAB_PATH', 'name': 'Pathology Lab', 'description': 'Clinical pathology and lab reports.'},
            ],
        },
    ]

    bed_templates = [
        {'bed_number': 'ICU-1', 'bed_type': Bed.BedType.ICU, 'ward_type': Bed.WardType.ICU_WARD, 'status': Bed.BedStatus.OCCUPIED, 'notes': 'Cardiac patient under monitoring.'},
        {'bed_number': 'ICU-2', 'bed_type': Bed.BedType.ICU, 'ward_type': Bed.WardType.ICU_WARD, 'status': Bed.BedStatus.AVAILABLE, 'notes': 'Ready for emergency admission.'},
        {'bed_number': 'GEN-1', 'bed_type': Bed.BedType.GENERAL, 'ward_type': Bed.WardType.GENERAL_WARD, 'status': Bed.BedStatus.OCCUPIED, 'notes': 'Post-operative patient recovering.'},
        {'bed_number': 'GEN-2', 'bed_type': Bed.BedType.GENERAL, 'ward_type': Bed.WardType.GENERAL_WARD, 'status': Bed.BedStatus.RESERVED, 'notes': 'Reserved for scheduled admission.'},
        {'bed_number': 'VENT-1', 'bed_type': Bed.BedType.VENTILATOR, 'ward_type': Bed.WardType.ICU_WARD, 'status': Bed.BedStatus.MAINTENANCE, 'notes': 'Scheduled maintenance today.'},
        {'bed_number': 'PRV-1', 'bed_type': Bed.BedType.PRIVATE, 'ward_type': Bed.WardType.PRIVATE_ROOM, 'status': Bed.BedStatus.AVAILABLE, 'notes': 'Single room available.'},
    ]

    equipment_templates = [
        {'name': 'Philips Ventilator', 'equipment_type': 'Ventilator', 'manufacturer': 'Philips', 'model_number': 'V200', 'quantity': 5, 'available_quantity': 3, 'status': 'in_use'},
        {'name': 'GE ECG Machine', 'equipment_type': 'ECG', 'manufacturer': 'GE Healthcare', 'model_number': 'ECG-250', 'quantity': 2, 'available_quantity': 2, 'status': 'available'},
        {'name': 'Siemens X-Ray', 'equipment_type': 'X-Ray', 'manufacturer': 'Siemens', 'model_number': 'XR-500', 'quantity': 1, 'available_quantity': 1, 'status': 'available'},
        {'name': 'Mindray Patient Monitor', 'equipment_type': 'Patient Monitor', 'manufacturer': 'Mindray', 'model_number': 'PM800', 'quantity': 8, 'available_quantity': 6, 'status': 'in_use'},
    ]

    doctor_templates = [
        {'full_name': 'Dr. Aarav Sharma', 'specialization': Doctor.Specialization.ICU, 'qualification': 'MD Critical Care', 'phone': '9876510001', 'email': 'aarav.sharma@hospital.example.com', 'experience_years': 12},
        {'full_name': 'Dr. Neha Kulkarni', 'specialization': Doctor.Specialization.CARDIOLOGY, 'qualification': 'MD Cardiology', 'phone': '9876510002', 'email': 'neha.kulkarni@hospital.example.com', 'experience_years': 10},
        {'full_name': 'Dr. Rohan Singh', 'specialization': Doctor.Specialization.GENERAL, 'qualification': 'MBBS', 'phone': '9876510003', 'email': 'rohan.singh@hospital.example.com', 'experience_years': 8},
        {'full_name': 'Dr. Priya Das', 'specialization': Doctor.Specialization.PEDIATRICS, 'qualification': 'MD Pediatrics', 'phone': '9876510004', 'email': 'priya.das@hospital.example.com', 'experience_years': 9},
    ]

    patient_templates = [
        {'full_name': 'Rahul Mehta', 'phone': '9000000001', 'email': 'rahul.mehta@example.com', 'age': 56, 'gender': Patient.Gender.MALE, 'blood_group': Patient.BloodGroup.O_POS, 'city': 'Indore', 'area': 'Rau', 'address': 'Plot 12, Health Colony', 'emergency_contact_name': 'Sunita Mehta', 'emergency_contact_phone': '9000000002', 'known_allergies': 'None', 'chronic_conditions': 'Hypertension'},
        {'full_name': 'Sana Verma', 'phone': '9000000003', 'email': 'sana.verma@example.com', 'age': 38, 'gender': Patient.Gender.FEMALE, 'blood_group': Patient.BloodGroup.A_POS, 'city': 'Indore', 'area': 'Palasia', 'address': 'A-45, Sunshine Apartments', 'emergency_contact_name': 'Amit Verma', 'emergency_contact_phone': '9000000004', 'known_allergies': 'Penicillin', 'chronic_conditions': 'Asthma'},
    ]

    created_hospitals = []
    for data in hospitals_data:
        hospital, created_flag = Hospital.objects.get_or_create(
            name=data['name'],
            city=data['city'],
            defaults=data,
        )
        if created_flag:
            created_hospitals.append(hospital)
            print(f"✓ Created hospital: {hospital.name}")
        else:
            # Update existing hospital with new data
            for key, value in data.items():
                setattr(hospital, key, value)
            hospital.save()
            print(f"✓ Updated hospital: {hospital.name}")

    if created_hospitals:
        print(f"✅ Created {len(created_hospitals)} hospital(s)\n")
    else:
        print(f"✅ Updated existing hospitals\n")

    reception_users = {}
    all_users = {}
    
    for user_info in user_data:
        hospital = Hospital.objects.get(name=user_info['hospital_name'], city='Indore')
        user, created_flag = User.objects.get_or_create(
            email=user_info['email'],
            defaults={
                'full_name': user_info['full_name'],
                'role': user_info['role'],
                'phone': user_info['phone'],
                'hospital': hospital,
            },
        )
        if created_flag:
            user.set_password(user_info['password'])
            user.save()
            print(f"✓ Created {user_info['role']} user: {user.email} for {hospital.name}")
        else:
            if user.hospital != hospital:
                user.hospital = hospital
                user.save()
            print(f"✓ {user_info['role'].title()} user already exists: {user.email}")
        
        # Store all users by hospital for later reference
        if hospital.name not in all_users:
            all_users[hospital.name] = {}
        all_users[hospital.name][user_info['role']] = user
        
        # Also store reception users in the old variable for backward compatibility
        if user_info['role'] == User.Role.RECEPTION:
            reception_users[hospital.name] = user
    
    print(f"\n✅ Created all user types for both hospitals!\n")

    service_objects = []
    for item in service_catalog:
        category, _ = ServiceCategory.objects.get_or_create(
            name=item['category'],
            defaults={'description': f'{item["category"]} services'},
        )
        for svc in item['services']:
            service, _ = ServiceMaster.objects.get_or_create(
                code=svc['code'],
                defaults={
                    'category': category,
                    'name': svc['name'],
                    'description': svc['description'],
                },
            )
            service_objects.append(service)

    for hospital in Hospital.objects.filter(city='Indore'):
        HospitalService.objects.get_or_create(
            hospital=hospital,
            service=service_objects[0],
            defaults={'is_available': True, 'notes': 'Available 24x7'},
        )
        HospitalService.objects.get_or_create(
            hospital=hospital,
            service=service_objects[1],
            defaults={'is_available': True, 'notes': 'Available on demand'},
        )
        HospitalService.objects.get_or_create(
            hospital=hospital,
            service=service_objects[3],
            defaults={'is_available': True, 'notes': 'Critical care support'},
        )
        HospitalService.objects.get_or_create(
            hospital=hospital,
            service=service_objects[4],
            defaults={'is_available': True, 'notes': 'Ventilator backup'},
        )

    for hospital in Hospital.objects.filter(city='Indore'):
        departments = [
            {'name': 'ICU', 'dept_type': Department.DeptType.ICU, 'floor': '2'},
            {'name': 'Emergency', 'dept_type': Department.DeptType.EMERGENCY, 'floor': '1'},
            {'name': 'General Ward', 'dept_type': Department.DeptType.GENERAL, 'floor': '3'},
            {'name': 'Cardiology', 'dept_type': Department.DeptType.CARDIOLOGY, 'floor': '2'},
        ]
        for dept in departments:
            Department.objects.get_or_create(
                hospital=hospital,
                name=dept['name'],
                defaults={'dept_type': dept['dept_type'], 'floor': dept['floor'], 'is_active': True},
            )

    for hospital in Hospital.objects.filter(city='Indore'):
        available_departments = list(hospital.departments.all())
        for idx, doc in enumerate(doctor_templates):
            department = available_departments[idx % len(available_departments)]
            # Generate unique registration number per hospital
            hospital_code = hospital.name.split()[0][:3].upper()
            registration_no = f"{hospital_code}-DOC-{idx+1:04d}"
            
            doctor, created_flag = Doctor.objects.get_or_create(
                registration_no=registration_no,
                hospital=hospital,
                defaults={
                    'full_name': doc['full_name'],
                    'department': department,
                    'specialization': doc['specialization'],
                    'qualification': doc['qualification'],
                    'phone': doc['phone'],
                    'email': doc['email'],
                    'experience_years': doc['experience_years'],
                    'status': Doctor.Status.ACTIVE,
                },
            )
            if created_flag:
                print(f"✓ Created doctor: {doctor.full_name} ({registration_no}) at {hospital.name}")

    for hospital in Hospital.objects.filter(city='Indore'):
        for bed_template in bed_templates:
            bed_number = f"{hospital.name.split()[0].upper()}-{bed_template['bed_number']}"
            bed, created_flag = Bed.objects.get_or_create(
                hospital=hospital,
                bed_number=bed_number,
                defaults={
                    'bed_type': bed_template['bed_type'],
                    'ward_type': bed_template['ward_type'],
                    'status': bed_template['status'],
                    'notes': bed_template['notes'],
                },
            )
            if created_flag:
                print(f"✓ Created bed {bed.bed_number} in {hospital.name}")

    patients = []
    for patient_info in patient_templates:
        patient, created_flag = Patient.objects.get_or_create(
            phone=patient_info['phone'],
            defaults=patient_info,
        )
        if created_flag:
            print(f"Created patient: {patient.full_name}")
        patients.append(patient)

    occupied_beds = Bed.objects.filter(status=Bed.BedStatus.OCCUPIED, hospital__city='Indore')[:2]
    for patient, bed in zip(patients, occupied_beds):
        hospital_name = bed.hospital.name
        reception_user = reception_users.get(hospital_name)
        allocation, created_flag = BedAllocation.objects.get_or_create(
            bed=bed,
            patient=patient,
            defaults={
                'allocated_by': reception_user,
                'notes': 'Demo admission for occupied bed.',
            },
        )
        if created_flag:
            print(f"✓ Allocated {bed.bed_number} to {patient.full_name}")

    for hospital in Hospital.objects.filter(city='Indore'):
        for idx, equipment in enumerate(equipment_templates, start=1):
            serial_number = f"{hospital.name[:3].upper()}-EQ-{idx:03d}"
            equip, created_flag = MedicalEquipment.objects.get_or_create(
                hospital=hospital,
                serial_number=serial_number,
                defaults={
                    'department': hospital.departments.filter(is_active=True).first(),
                    'name': equipment['name'],
                    'equipment_type': equipment['equipment_type'],
                    'manufacturer': equipment['manufacturer'],
                    'model_number': equipment['model_number'],
                    'quantity': equipment['quantity'],
                    'available_quantity': equipment['available_quantity'],
                    'status': equipment['status'],
                    'installation_date': timezone.now().date(),
                },
            )
            if created_flag:
                print(f"✓ Created equipment: {equip.name} for {hospital.name}")

    hospital_a = Hospital.objects.get(name='Indore Care Hospital', city='Indore')
    hospital_b = Hospital.objects.get(name='Bombay Hospital Indore', city='Indore')
    
    # Use admin users for resource sharing requests
    admin_a = all_users[hospital_a.name].get(User.Role.ADMIN)
    admin_b = all_users[hospital_b.name].get(User.Role.ADMIN)
    
    request_1, created_flag = ResourceSharingRequest.objects.get_or_create(
        requester_hospital=hospital_a,
        provider_hospital=hospital_b,
        equipment_type='Defibrillator',
        quantity=2,
        defaults={
            'priority': ResourceSharingRequest.Priority.HIGH,
            'status': ResourceSharingRequest.Status.PENDING,
            'requested_by': admin_a or reception_users[hospital_a.name],
            'provider_contact': admin_b or reception_users[hospital_b.name],
            'reason': 'Need emergency backup defibrillators for cardiac patients.',
            'notes': 'Please prioritize shipment today.',
        },
    )
    if created_flag:
        print(f"✓ Created resource sharing request from {hospital_a.name} to {hospital_b.name}")

    request_2, created_flag = ResourceSharingRequest.objects.get_or_create(
        requester_hospital=hospital_b,
        provider_hospital=hospital_a,
        equipment_type='Blood Bank Unit',
        quantity=5,
        defaults={
            'priority': ResourceSharingRequest.Priority.MEDIUM,
            'status': ResourceSharingRequest.Status.ACCEPTED,
            'requested_by': admin_b or reception_users[hospital_b.name],
            'provider_contact': admin_a or reception_users[hospital_a.name],
            'reason': 'Restock blood units for scheduled surgeries.',
            'notes': 'Confirmed supply from Indore Care.',
            'responded_at': timezone.now(),
        },
    )
    if created_flag:
        print(f"✓ Created accepted resource sharing request from {hospital_b.name} to {hospital_a.name}")

    # Print comprehensive summary
    print('\n' + '='*70)
    print('✅ SEED DATA COMPLETED SUCCESSFULLY!')
    print('='*70)
    print('\n📊 SUMMARY OF CREATED DATA:\n')
    
    for hospital_name in ['Indore Care Hospital', 'Bombay Hospital Indore']:
        print(f"\n🏥 {hospital_name}")
        print('-' * 70)
        if hospital_name in all_users:
            print("  👥 Users Created:")
            role_users = {}
            for role, user in all_users[hospital_name].items():
                if role not in role_users:
                    role_users[role] = []
                role_users[role].append(user.email)
            
            for role in [User.Role.ADMIN, User.Role.SUPERVISOR, User.Role.RECEPTION, User.Role.AMBULANCE, User.Role.PATIENT]:
                if role in role_users:
                    count = len(role_users[role])
                    print(f"     • {role.upper()}: {count}")
                    for email in role_users[role]:
                        print(f"       - {email}")
    
    print('\n' + '='*70)
    print('📝 LOGIN CREDENTIALS:')
    print('='*70)
    print('\nIndore Care Hospital:')
    print('  • Admin: admin@indorecarehospital.com / Admin@123')
    print('  • Supervisor: supervisor@indorecarehospital.com / Supervisor@123')
    print('  • Reception: reception1@indorecarehospital.com / Reception@123')
    print('  • Driver: driver1@indorecarehospital.com / Driver@123')
    print('  • Patient: patient1@indorecarehospital.com / Patient@123')
    
    print('\nBombay Hospital Indore:')
    print('  • Admin: admin@bombayhospitalindore.com / Admin@123')
    print('  • Supervisor: supervisor@bombayhospitalindore.com / Supervisor@123')
    print('  • Reception: reception1@bombayhospitalindore.com / Reception@123')
    print('  • Driver: driver1@bombayhospitalindore.com / Driver@123')
    print('  • Patient: patient1@bombayhospitalindore.com / Patient@123')
    print('='*70 + '\n')


def seed_enhanced_call_data():
    """
    Seed enhanced call and transfer request data for AI assistant testing
    """
    from django.utils import timezone
    from apps.authentication.models import User
    from apps.hospitals.models import Hospital
    from apps.patients.models import Patient, TransferRequest
    from apps.calls.models import CallLog, CallSession
    from datetime import timedelta
    import random

    hospitals = Hospital.objects.filter(city='Indore')
    if hospitals.count() < 2:
        print("⚠️  Not enough hospitals. Run seed_data() first.")
        return

    hospital_a = hospitals.first()
    hospital_b = hospitals.last()

    # ════════════════════════════════════════════════════════════
    # 🏥 ENHANCED PATIENT DATA - More realistic scenarios
    # ════════════════════════════════════════════════════════════
    enhanced_patients = [
        {
            'full_name': 'Vikram Singh',
            'phone': '9123456701',
            'email': 'vikram.singh@example.com',
            'age': 65,
            'gender': Patient.Gender.MALE,
            'blood_group': Patient.BloodGroup.O_POS,
            'city': 'Indore',
            'area': 'Rau',
            'address': 'Plot 45, Health Complex, Rau',
            'emergency_contact_name': 'Priya Singh',
            'emergency_contact_phone': '9123456702',
            'known_allergies': 'Aspirin',
            'chronic_conditions': 'Hypertension, Diabetes Type 2',
        },
        {
            'full_name': 'Deepa Sharma',
            'phone': '9123456703',
            'email': 'deepa.sharma@example.com',
            'age': 52,
            'gender': Patient.Gender.FEMALE,
            'blood_group': Patient.BloodGroup.AB_POS,
            'city': 'Indore',
            'area': 'Palasia',
            'address': 'B-120, Sunshine Towers, Palasia',
            'emergency_contact_name': 'Rajesh Sharma',
            'emergency_contact_phone': '9123456704',
            'known_allergies': 'Penicillin',
            'chronic_conditions': 'Asthma, GERD',
        },
        {
            'full_name': 'Arjun Patel',
            'phone': '9123456705',
            'email': 'arjun.patel@example.com',
            'age': 48,
            'gender': Patient.Gender.MALE,
            'blood_group': Patient.BloodGroup.B_NEG,
            'city': 'Indore',
            'area': 'South Tukoganj',
            'address': 'A-56, Medical Center, South Tukoganj',
            'emergency_contact_name': 'Meera Patel',
            'emergency_contact_phone': '9123456706',
            'known_allergies': 'None',
            'chronic_conditions': 'Cardiac Arrhythmia',
        },
        {
            'full_name': 'Surbhi Nair',
            'phone': '9123456707',
            'email': 'surbhi.nair@example.com',
            'age': 35,
            'gender': Patient.Gender.FEMALE,
            'blood_group': Patient.BloodGroup.A_NEG,
            'city': 'Indore',
            'area': 'Bhanwar Kuwa',
            'address': 'C-34, Healthcare Plaza, Bhanwar Kuwa',
            'emergency_contact_name': 'Hari Nair',
            'emergency_contact_phone': '9123456708',
            'known_allergies': 'Sulfonamides',
            'chronic_conditions': 'Migraine, Thyroid',
        },
        {
            'full_name': 'Rajesh Gupta',
            'phone': '9123456709',
            'email': 'rajesh.gupta@example.com',
            'age': 72,
            'gender': Patient.Gender.MALE,
            'blood_group': Patient.BloodGroup.O_NEG,
            'city': 'Indore',
            'area': 'Mhow Naka',
            'address': 'D-78, Senior Care Home, Mhow Naka',
            'emergency_contact_name': 'Asha Gupta',
            'emergency_contact_phone': '9123456710',
            'known_allergies': 'Codeine',
            'chronic_conditions': 'Heart Disease, Hypertension, Stroke Risk',
        },
        {
            'full_name': 'Neha Verma',
            'phone': '9123456711',
            'email': 'neha.verma@example.com',
            'age': 29,
            'gender': Patient.Gender.FEMALE,
            'blood_group': Patient.BloodGroup.A_POS,
            'city': 'Indore',
            'area': 'Rajwada',
            'address': 'E-12, Young Care Center, Rajwada',
            'emergency_contact_name': 'Arun Verma',
            'emergency_contact_phone': '9123456712',
            'known_allergies': 'None',
            'chronic_conditions': 'None',
        },
        {
            'full_name': 'Mohammad Hassan',
            'phone': '9123456713',
            'email': 'mohammad.hassan@example.com',
            'age': 58,
            'gender': Patient.Gender.MALE,
            'blood_group': Patient.BloodGroup.B_POS,
            'city': 'Indore',
            'area': 'Chhoti Gwaltoli',
            'address': 'F-99, Health Center, Chhoti Gwaltoli',
            'emergency_contact_name': 'Fatima Hassan',
            'emergency_contact_phone': '9123456714',
            'known_allergies': 'Latex',
            'chronic_conditions': 'Diabetes, Kidney Disease',
        },
    ]

    # Create enhanced patients
    enhanced_patient_objects = []
    for patient_info in enhanced_patients:
        patient, created = Patient.objects.get_or_create(
            phone=patient_info['phone'],
            defaults=patient_info,
        )
        enhanced_patient_objects.append(patient)
        if created:
            print(f"✓ Created enhanced patient: {patient.full_name}")

    # ════════════════════════════════════════════════════════════
    # 📋 REALISTIC TRANSFER REQUESTS (for AI assistant to handle)
    # ════════════════════════════════════════════════════════════
    supervisor_a = User.objects.filter(hospital=hospital_a, role=User.Role.SUPERVISOR).first()
    supervisor_b = User.objects.filter(hospital=hospital_b, role=User.Role.SUPERVISOR).first()

    transfer_scenarios = [
        {
            'patient_idx': 0,
            'from_hospital': hospital_a,
            'to_hospital': hospital_b,
            'priority': TransferRequest.Priority.CRITICAL,
            'status': TransferRequest.Status.PENDING,
            'reason': 'Critical cardiac patient needs advanced ICU facilities and 24/7 cardiology support.',
            'required_bed_type': 'ICU',
            'required_services': 'CCU,VENT,ECG',
            'requested_by': supervisor_a,
        },
        {
            'patient_idx': 1,
            'from_hospital': hospital_b,
            'to_hospital': hospital_a,
            'priority': TransferRequest.Priority.HIGH,
            'status': TransferRequest.Status.PENDING,
            'reason': 'Post-operative complication requiring specialized neurosurgery intervention.',
            'required_bed_type': 'GENERAL',
            'required_services': 'IMG_MRI,IMG_CT',
            'requested_by': supervisor_b,
        },
        {
            'patient_idx': 2,
            'from_hospital': hospital_a,
            'to_hospital': hospital_b,
            'priority': TransferRequest.Priority.MEDIUM,
            'status': TransferRequest.Status.ACCEPTED,
            'reason': 'Stable patient requiring orthopedic surgery not available at current facility.',
            'required_bed_type': 'GENERAL',
            'required_services': 'IMG_XRAY',
            'requested_by': supervisor_a,
            'accepted_by': supervisor_b,
        },
        {
            'patient_idx': 4,
            'from_hospital': hospital_b,
            'to_hospital': hospital_a,
            'priority': TransferRequest.Priority.HIGH,
            'status': TransferRequest.Status.PENDING,
            'reason': 'Elderly patient with multiple comorbidities requiring comprehensive care and ICU monitoring.',
            'required_bed_type': 'ICU',
            'required_services': 'CCU,VENT,LAB_BLOOD',
            'requested_by': supervisor_b,
        },
        {
            'patient_idx': 3,
            'from_hospital': hospital_a,
            'to_hospital': hospital_b,
            'priority': TransferRequest.Priority.MEDIUM,
            'status': TransferRequest.Status.REJECTED,
            'reason': 'Patient recovery after routine surgery, requires regular bed and physiotherapy.',
            'required_bed_type': 'GENERAL',
            'required_services': 'LAB_PATH',
            'requested_by': supervisor_a,
            'accepted_by': supervisor_b,
        },
    ]

    for idx, scenario in enumerate(transfer_scenarios):
        transfer_req, created = TransferRequest.objects.get_or_create(
            patient=enhanced_patient_objects[scenario['patient_idx']],
            from_hospital=scenario['from_hospital'],
            defaults={
                'to_hospital': scenario['to_hospital'],
                'priority': scenario['priority'],
                'status': scenario['status'],
                'reason': scenario['reason'],
                'required_bed_type': scenario['required_bed_type'],
                'required_services': scenario['required_services'],
                'requested_by': scenario['requested_by'],
                'accepted_by': scenario.get('accepted_by'),
            },
        )
        if created:
            print(f"✓ Created transfer request #{idx+1}: {enhanced_patient_objects[scenario['patient_idx']].full_name} " +
                  f"({scenario['priority']}) → {scenario['status']}")

    # ════════════════════════════════════════════════════════════
    # 📞 REALISTIC CALL LOGS (for AI assistant call history)
    # ════════════════════════════════════════════════════════════
    pending_transfers = list(TransferRequest.objects.filter(status=TransferRequest.Status.PENDING))
    accepted_transfers = list(TransferRequest.objects.filter(status=TransferRequest.Status.ACCEPTED))
    
    call_scenarios = [
        {
            'transfer_request': pending_transfers[0] if len(pending_transfers) > 0 else None,
            'to_number': '+919123456701',
            'status': CallLog.Status.COMPLETED,
            'language': CallLog.Language.HINDI,
            'duration_sec': 45,
        },
        {
            'transfer_request': pending_transfers[1] if len(pending_transfers) > 1 else None,
            'to_number': '+919123456703',
            'status': CallLog.Status.COMPLETED,
            'language': CallLog.Language.ENGLISH,
            'duration_sec': 38,
        },
        {
            'transfer_request': accepted_transfers[0] if len(accepted_transfers) > 0 else None,
            'to_number': '+919123456705',
            'status': CallLog.Status.COMPLETED,
            'language': CallLog.Language.HINDI,
            'duration_sec': 52,
        },
        {
            'transfer_request': None,
            'to_number': '+919123456711',
            'status': CallLog.Status.COMPLETED,
            'language': CallLog.Language.ENGLISH,
            'duration_sec': 28,
        },
        {
            'transfer_request': pending_transfers[2] if len(pending_transfers) > 2 else None,
            'to_number': '+919123456709',
            'status': CallLog.Status.NO_ANSWER,
            'language': CallLog.Language.HINDI,
            'duration_sec': 0,
        },
    ]

    for idx, call_info in enumerate(call_scenarios):
        if call_info['transfer_request']:
            call_log, created = CallLog.objects.get_or_create(
                call_type=CallLog.CallType.TRANSFER_NOTIFICATION,
                to_number=call_info['to_number'],
                transfer_request=call_info['transfer_request'],
                defaults={
                    'status': call_info['status'],
                    'language': call_info['language'],
                    'duration_sec': call_info['duration_sec'],
                    'twilio_call_sid': f"CA{uuid.uuid4().hex[:30].upper()}",
                },
            )
            if created:
                print(f"✓ Created call log #{idx+1}: {call_info['to_number']} ({call_info['status']})")

    print("\n✅ Enhanced call data seeded successfully!\n")


if __name__ == '__main__':
    import uuid
    # First, seed basic hospital data
    seed_data()
    # Then seed enhanced AI assistant data
    seed_enhanced_call_data()
