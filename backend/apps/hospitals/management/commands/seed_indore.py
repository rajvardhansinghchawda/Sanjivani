# ─────────────────────────────────────────────────────────────
#  HOW TO RUN THIS FILE
#
#  Option 1 — Django management command (recommended):
#    Place this file at:
#    apps/hospitals/management/commands/seed_indore.py
#
#    Then run:
#    python manage.py seed_indore
#
#  Option 2 — Django shell:
#    python manage.py shell
#    exec(open('seed_indore_hospitals.py').read())
#
# ─────────────────────────────────────────────────────────────

from django.core.management.base import BaseCommand
import uuid

class Command(BaseCommand):
    help = 'Seeds real hospital data for Indore city'

    def handle(self, *args, **kwargs):
        run_seed(self)


def run_seed(cmd=None):

    def log(msg):
        if cmd:
            cmd.stdout.write(msg)
        else:
            print(msg)

    from apps.hospitals.models import (
        Hospital, Department,
        ServiceCategory, ServiceMaster, HospitalService,
        HospitalRegistration, Doctor, DutySchedule,
    )
    from apps.beds.models import Bed, MedicalEquipment
    from django.utils import timezone

    log('Starting Indore hospital seed...')

    # ── Step 1: Ensure service categories and master exist ────
    log('  Creating service categories...')

    cat_imaging, _    = ServiceCategory.objects.get_or_create(name='Imaging',             defaults={'description': 'Radiology and scanning services'})
    cat_diagnostics, _= ServiceCategory.objects.get_or_create(name='Diagnostics',         defaults={'description': 'Lab and diagnostic services'})
    cat_icu, _        = ServiceCategory.objects.get_or_create(name='ICU & Critical Care',  defaults={'description': 'Intensive care unit services'})
    cat_blood, _      = ServiceCategory.objects.get_or_create(name='Blood & Transfusion',  defaults={'description': 'Blood bank and transfusion services'})
    cat_emergency, _  = ServiceCategory.objects.get_or_create(name='Emergency',            defaults={'description': 'Emergency and trauma services'})
    cat_dialysis, _   = ServiceCategory.objects.get_or_create(name='Dialysis & Nephrology',defaults={'description': 'Kidney and dialysis services'})
    cat_surgery, _    = ServiceCategory.objects.get_or_create(name='Surgery',              defaults={'description': 'Surgical services'})

    services_data = [
        ('IMG_MRI',    'MRI Scan',           cat_imaging),
        ('IMG_CT',     'CT Scan',            cat_imaging),
        ('IMG_XRAY',   'X-Ray',             cat_imaging),
        ('IMG_USG',    'Ultrasound',         cat_imaging),
        ('DIAG_PATH',  'Pathology Lab',      cat_diagnostics),
        ('DIAG_ECG',   'ECG',               cat_diagnostics),
        ('DIAG_ECHO',  'Echocardiography',   cat_diagnostics),
        ('ICU_VENT',   'Ventilator Support', cat_icu),
        ('ICU_NICU',   'NICU',              cat_icu),
        ('ICU_PICU',   'PICU',              cat_icu),
        ('BLD_BANK',   'Blood Bank',         cat_blood),
        ('BLD_PLASMA', 'Plasma Therapy',     cat_blood),
        ('EMR_TRAUMA', 'Trauma Care',        cat_emergency),
        ('EMR_BURNS',  'Burns Unit',         cat_emergency),
        ('NEP_DIAL',   'Dialysis',           cat_dialysis),
        ('SRG_OT',     'Operation Theatre',  cat_surgery),
        ('SRG_LASER',  'Laser Surgery',      cat_surgery),
    ]

    service_objects = {}
    for code, name, category in services_data:
        svc, _ = ServiceMaster.objects.get_or_create(
            code     = code,
            defaults = {'name': name, 'category': category, 'is_active': True}
        )
        service_objects[code] = svc

    log(f'  {len(service_objects)} services ready.')

    # ── Step 2: Define hospitals ──────────────────────────────

    hospitals_data = [

        # ── Hospital 1 ────────────────────────────────────────
        {
            'name'               : 'MY Hospital (Maharaja Yashwantrao)',
            'category'           : 'government',
            'hospital_type'      : 'multispecialty',
            'address'            : 'MYH Road, Indore',
            'area'               : 'MYH Road',
            'pincode'            : '452001',
            'phone'              : '07312361561',
            'email'              : 'myh@mphealth.gov.in',
            'total_beds'         : 1200,
            'icu_capacity'       : 80,
            'latitude'           : '22.7196',
            'longitude'          : '75.8577',
            'services'           : ['IMG_MRI','IMG_CT','IMG_XRAY','IMG_USG','DIAG_PATH',
                                    'DIAG_ECG','DIAG_ECHO','ICU_VENT','ICU_NICU','BLD_BANK',
                                    'EMR_TRAUMA','NEP_DIAL','SRG_OT'],
            'departments'        : [
                ('ICU Ward',       'icu',        '1st Floor'),
                ('Emergency',      'emergency',  'Ground Floor'),
                ('Cardiology',     'cardiology', '3rd Floor'),
                ('Neurology',      'neurology',  '3rd Floor'),
                ('General Ward',   'general',    '2nd Floor'),
                ('Orthopedics',    'orthopedic', '4th Floor'),
                ('Pediatrics',     'pediatrics', '2nd Floor'),
                ('Oncology',       'oncology',   '5th Floor'),
                ('Nephrology',     'nephrology', '4th Floor'),
                ('Radiology',      'radiology',  'Ground Floor'),
                ('Pathology',      'pathology',  'Ground Floor'),
                ('Surgery',        'surgery',    '5th Floor'),
            ],
            'beds': [
                # (bed_type, ward_type, count_available, count_occupied)
                ('icu',       'icu_ward',     20, 50),
                ('general',   'general_ward', 300, 600),
                ('ventilator','icu_ward',     8,  15),
                ('emergency', 'emergency',    20, 30),
                ('private',   'private_room', 30, 50),
            ],
            'equipment': [
                ('Ventilator',  'Ventilator',  'Philips',       23, 8),
                ('MRI Machine', 'MRI',         'Siemens',       1,  0),
                ('CT Scanner',  'CT Scan',     'GE Healthcare', 2,  1),
                ('Dialysis',    'Dialysis',    'Fresenius',     10, 4),
            ],
            'doctors': [
                ('Dr. Rajesh Sharma',   'cardiology',  'MD Cardiology',  20, '9826000001'),
                ('Dr. Priya Verma',     'neurology',   'DM Neurology',   15, '9826000002'),
                ('Dr. Suresh Patel',    'icu',         'MD Critical Care',18,'9826000003'),
                ('Dr. Anita Joshi',     'pediatrics',  'MD Pediatrics',  12, '9826000004'),
                ('Dr. Vikram Singh',    'surgery',     'MS Surgery',     22, '9826000005'),
            ],
        },

        # ── Hospital 2 ────────────────────────────────────────
        {
            'name'               : 'Bombay Hospital Indore',
            'category'           : 'private',
            'hospital_type'      : 'multispecialty',
            'address'            : 'Ring Road, Indore',
            'area'               : 'Ring Road',
            'pincode'            : '452010',
            'phone'              : '07312570000',
            'email'              : 'info@bombayhospital-indore.com',
            'total_beds'         : 350,
            'icu_capacity'       : 40,
            'latitude'           : '22.7533',
            'longitude'          : '75.8937',
            'services'           : ['IMG_MRI','IMG_CT','IMG_XRAY','IMG_USG','DIAG_PATH',
                                    'DIAG_ECG','DIAG_ECHO','ICU_VENT','BLD_BANK',
                                    'EMR_TRAUMA','SRG_OT','SRG_LASER'],
            'departments'        : [
                ('ICU Ward',       'icu',        '2nd Floor'),
                ('Emergency',      'emergency',  'Ground Floor'),
                ('Cardiology',     'cardiology', '3rd Floor'),
                ('Neurology',      'neurology',  '4th Floor'),
                ('General Ward',   'general',    '1st Floor'),
                ('Orthopedics',    'orthopedic', '3rd Floor'),
                ('Oncology',       'oncology',   '5th Floor'),
                ('Surgery',        'surgery',    '4th Floor'),
                ('Radiology',      'radiology',  'Ground Floor'),
            ],
            'beds': [
                ('icu',       'icu_ward',     15, 20),
                ('general',   'general_ward', 80, 150),
                ('ventilator','icu_ward',     6,  8),
                ('emergency', 'emergency',    10, 12),
                ('private',   'private_room', 50, 40),
                ('semi_pvt',  'private_room', 30, 20),
            ],
            'equipment': [
                ('Ventilator',  'Ventilator',  'Draeger',       14, 8),
                ('MRI Machine', 'MRI',         'Philips',       1,  0),
                ('CT Scanner',  'CT Scan',     'Siemens',       1,  1),
            ],
            'doctors': [
                ('Dr. Amit Malhotra',   'cardiology',  'DM Cardiology',  18, '9826100001'),
                ('Dr. Sunita Rao',      'neurology',   'DM Neurology',   14, '9826100002'),
                ('Dr. Deepak Sharma',   'icu',         'MD Anesthesia',  16, '9826100003'),
                ('Dr. Kavita Jain',     'oncology',    'MD Oncology',    12, '9826100004'),
            ],
        },

        # ── Hospital 3 ────────────────────────────────────────
        {
            'name'               : 'Choithram Hospital & Research Centre',
            'category'           : 'private',
            'hospital_type'      : 'multispecialty',
            'address'            : 'Manik Bagh Road, Indore',
            'area'               : 'Manik Bagh Road',
            'pincode'            : '452014',
            'phone'              : '07314233000',
            'email'              : 'info@choithramhospital.com',
            'total_beds'         : 500,
            'icu_capacity'       : 50,
            'latitude'           : '22.6921',
            'longitude'          : '75.8481',
            'services'           : ['IMG_MRI','IMG_CT','IMG_XRAY','IMG_USG','DIAG_PATH',
                                    'DIAG_ECG','DIAG_ECHO','ICU_VENT','ICU_NICU','ICU_PICU',
                                    'BLD_BANK','BLD_PLASMA','EMR_TRAUMA','NEP_DIAL',
                                    'SRG_OT','SRG_LASER'],
            'departments'        : [
                ('ICU Ward',       'icu',        '1st Floor'),
                ('NICU',           'pediatrics', '1st Floor'),
                ('Emergency',      'emergency',  'Ground Floor'),
                ('Cardiology',     'cardiology', '4th Floor'),
                ('Neurology',      'neurology',  '4th Floor'),
                ('Nephrology',     'nephrology', '3rd Floor'),
                ('Orthopedics',    'orthopedic', '3rd Floor'),
                ('General Ward',   'general',    '2nd Floor'),
                ('Pediatrics',     'pediatrics', '2nd Floor'),
                ('Oncology',       'oncology',   '5th Floor'),
                ('Surgery',        'surgery',    '5th Floor'),
                ('Radiology',      'radiology',  'Ground Floor'),
                ('Pathology',      'pathology',  'Ground Floor'),
            ],
            'beds': [
                ('icu',       'icu_ward',     18, 28),
                ('general',   'general_ward', 120, 220),
                ('ventilator','icu_ward',     10, 12),
                ('emergency', 'emergency',    15, 10),
                ('private',   'private_room', 60, 80),
                ('semi_pvt',  'private_room', 40, 30),
            ],
            'equipment': [
                ('Ventilator',  'Ventilator',  'Philips',       22, 12),
                ('MRI Machine', 'MRI',         'GE Healthcare', 1,  1),
                ('CT Scanner',  'CT Scan',     'Philips',       2,  1),
                ('Dialysis',    'Dialysis',    'Baxter',        8,  5),
            ],
            'doctors': [
                ('Dr. Sanjay Gupta',    'cardiology',  'DM Cardiology',  25, '9826200001'),
                ('Dr. Meera Tiwari',    'nephrology',  'DM Nephrology',  17, '9826200002'),
                ('Dr. Ravi Dubey',      'icu',         'MD Critical Care',20,'9826200003'),
                ('Dr. Pooja Agarwal',   'pediatrics',  'MD Pediatrics',  10, '9826200004'),
                ('Dr. Nitin Jain',      'neurology',   'DM Neurology',   14, '9826200005'),
            ],
        },

        # ── Hospital 4 ────────────────────────────────────────
        {
            'name'               : 'CHL Apollo Hospital',
            'category'           : 'private',
            'hospital_type'      : 'multispecialty',
            'address'            : 'AB Road, LIG, Indore',
            'area'               : 'AB Road LIG',
            'pincode'            : '452011',
            'phone'              : '07314292929',
            'email'              : 'info@chlapollo.com',
            'total_beds'         : 400,
            'icu_capacity'       : 45,
            'latitude'           : '22.7200',
            'longitude'          : '75.8800',
            'services'           : ['IMG_MRI','IMG_CT','IMG_XRAY','IMG_USG','DIAG_PATH',
                                    'DIAG_ECG','DIAG_ECHO','ICU_VENT','BLD_BANK',
                                    'EMR_TRAUMA','SRG_OT'],
            'departments'        : [
                ('ICU Ward',       'icu',        '2nd Floor'),
                ('Emergency',      'emergency',  'Ground Floor'),
                ('Cardiology',     'cardiology', '3rd Floor'),
                ('Orthopedics',    'orthopedic', '4th Floor'),
                ('Neurology',      'neurology',  '3rd Floor'),
                ('General Ward',   'general',    '1st Floor'),
                ('Surgery',        'surgery',    '5th Floor'),
                ('Radiology',      'radiology',  'Ground Floor'),
            ],
            'beds': [
                ('icu',       'icu_ward',     12, 28),
                ('general',   'general_ward', 90, 160),
                ('ventilator','icu_ward',     8,  10),
                ('emergency', 'emergency',    12, 8),
                ('private',   'private_room', 60, 50),
            ],
            'equipment': [
                ('Ventilator',  'Ventilator',  'Draeger',       18, 10),
                ('CT Scanner',  'CT Scan',     'GE Healthcare', 1,  1),
                ('MRI Machine', 'MRI',         'Siemens',       1,  0),
            ],
            'doctors': [
                ('Dr. Ashok Bansal',    'cardiology',  'MD Cardiology',  22, '9826300001'),
                ('Dr. Rekha Sharma',    'orthopedic',  'MS Orthopedics', 18, '9826300002'),
                ('Dr. Vijay Patel',     'icu',         'MD Anesthesia',  15, '9826300003'),
            ],
        },

        # ── Hospital 5 ────────────────────────────────────────
        {
            'name'               : 'Medanta — The Medicity Indore',
            'category'           : 'private',
            'hospital_type'      : 'multispecialty',
            'address'            : 'Scheme 74C, Vijay Nagar, Indore',
            'area'               : 'Vijay Nagar',
            'pincode'            : '452010',
            'phone'              : '07314747474',
            'email'              : 'indore@medanta.org',
            'total_beds'         : 450,
            'icu_capacity'       : 55,
            'latitude'           : '22.7533',
            'longitude'          : '75.9031',
            'services'           : ['IMG_MRI','IMG_CT','IMG_XRAY','IMG_USG','DIAG_PATH',
                                    'DIAG_ECG','DIAG_ECHO','ICU_VENT','ICU_NICU',
                                    'BLD_BANK','BLD_PLASMA','EMR_TRAUMA','EMR_BURNS',
                                    'NEP_DIAL','SRG_OT','SRG_LASER'],
            'departments'        : [
                ('ICU Ward',       'icu',        '1st Floor'),
                ('NICU',           'pediatrics', '1st Floor'),
                ('Emergency',      'emergency',  'Ground Floor'),
                ('Cardiology',     'cardiology', '4th Floor'),
                ('Neurology',      'neurology',  '4th Floor'),
                ('Oncology',       'oncology',   '5th Floor'),
                ('Nephrology',     'nephrology', '3rd Floor'),
                ('Orthopedics',    'orthopedic', '3rd Floor'),
                ('General Ward',   'general',    '2nd Floor'),
                ('Burns Unit',     'emergency',  '2nd Floor'),
                ('Surgery',        'surgery',    '5th Floor'),
                ('Radiology',      'radiology',  'Ground Floor'),
            ],
            'beds': [
                ('icu',       'icu_ward',     20, 30),
                ('general',   'general_ward', 100, 200),
                ('ventilator','icu_ward',     12, 15),
                ('emergency', 'emergency',    18, 12),
                ('private',   'private_room', 80, 60),
                ('semi_pvt',  'private_room', 50, 30),
            ],
            'equipment': [
                ('Ventilator',  'Ventilator',  'Philips',       27, 15),
                ('MRI Machine', 'MRI',         'Siemens 3T',    2,  1),
                ('CT Scanner',  'CT Scan',     'GE Healthcare', 2,  2),
                ('Dialysis',    'Dialysis',    'Fresenius',     12, 8),
            ],
            'doctors': [
                ('Dr. Ramesh Agarwal',  'cardiology',  'DM Cardiology',  28, '9826400001'),
                ('Dr. Shweta Mishra',   'oncology',    'MD Oncology',    16, '9826400002'),
                ('Dr. Prakash Yadav',   'icu',         'MD Critical Care',21,'9826400003'),
                ('Dr. Neha Chouhan',    'neurology',   'DM Neurology',   13, '9826400004'),
                ('Dr. Arvind Kumar',    'nephrology',  'DM Nephrology',  19, '9826400005'),
            ],
        },

        # ── Hospital 6 ────────────────────────────────────────
        {
            'name'               : 'Government District Hospital Indore',
            'category'           : 'government',
            'hospital_type'      : 'multispecialty',
            'address'            : 'Old Palasia, Indore',
            'area'               : 'Old Palasia',
            'pincode'            : '452001',
            'phone'              : '07312531200',
            'email'              : 'districthosp.indore@mp.gov.in',
            'total_beds'         : 600,
            'icu_capacity'       : 30,
            'latitude'           : '22.7289',
            'longitude'          : '75.8772',
            'services'           : ['IMG_XRAY','IMG_USG','DIAG_PATH','DIAG_ECG',
                                    'ICU_VENT','BLD_BANK','EMR_TRAUMA','SRG_OT'],
            'departments'        : [
                ('ICU Ward',     'icu',       '1st Floor'),
                ('Emergency',    'emergency', 'Ground Floor'),
                ('General Ward', 'general',   '1st Floor'),
                ('Pediatrics',   'pediatrics','2nd Floor'),
                ('Orthopedics',  'orthopedic','2nd Floor'),
                ('Surgery',      'surgery',   '3rd Floor'),
                ('Pathology',    'pathology', 'Ground Floor'),
            ],
            'beds': [
                ('icu',       'icu_ward',     8,  18),
                ('general',   'general_ward', 180, 320),
                ('ventilator','icu_ward',     4,  8),
                ('emergency', 'emergency',    25, 30),
            ],
            'equipment': [
                ('Ventilator', 'Ventilator', 'BPL Medical', 12, 8),
                ('X-Ray',      'X-Ray',      'Siemens',     3,  1),
            ],
            'doctors': [
                ('Dr. Mahesh Tiwari',   'general',    'MBBS MD',        10, '9826500001'),
                ('Dr. Savita Dubey',    'pediatrics', 'MD Pediatrics',  8,  '9826500002'),
                ('Dr. Hemant Sharma',   'icu',        'MD General',     12, '9826500003'),
            ],
        },

        # ── Hospital 7 ────────────────────────────────────────
        {
            'name'               : 'Vishesh Jupiter Hospital',
            'category'           : 'private',
            'hospital_type'      : 'multispecialty',
            'address'            : 'Near Bombay Hospital, Ring Road, Indore',
            'area'               : 'Ring Road',
            'pincode'            : '452010',
            'phone'              : '07314255555',
            'email'              : 'info@visheshhospital.com',
            'total_beds'         : 300,
            'icu_capacity'       : 35,
            'latitude'           : '22.7480',
            'longitude'          : '75.8901',
            'services'           : ['IMG_MRI','IMG_CT','IMG_XRAY','IMG_USG','DIAG_PATH',
                                    'DIAG_ECG','ICU_VENT','BLD_BANK','EMR_TRAUMA','SRG_OT'],
            'departments'        : [
                ('ICU Ward',     'icu',        '2nd Floor'),
                ('Emergency',    'emergency',  'Ground Floor'),
                ('Cardiology',   'cardiology', '3rd Floor'),
                ('General Ward', 'general',    '1st Floor'),
                ('Orthopedics',  'orthopedic', '3rd Floor'),
                ('Surgery',      'surgery',    '4th Floor'),
                ('Radiology',    'radiology',  'Ground Floor'),
            ],
            'beds': [
                ('icu',       'icu_ward',     10, 22),
                ('general',   'general_ward', 70, 130),
                ('ventilator','icu_ward',     6,  9),
                ('emergency', 'emergency',    10, 8),
                ('private',   'private_room', 40, 30),
            ],
            'equipment': [
                ('Ventilator', 'Ventilator', 'Draeger',       15, 9),
                ('CT Scanner', 'CT Scan',    'Philips',       1,  1),
                ('MRI Machine','MRI',        'GE Healthcare', 1,  0),
            ],
            'doctors': [
                ('Dr. Sunil Rathore',   'cardiology', 'DM Cardiology', 16, '9826600001'),
                ('Dr. Anita Patidar',   'icu',        'MD Anesthesia', 14, '9826600002'),
                ('Dr. Rohit Shukla',    'orthopedic', 'MS Orthopedics',18, '9826600003'),
            ],
        },
    ]

    # ── Step 3: Create each hospital ─────────────────────────
    created_count = 0

    for data in hospitals_data:

        # skip if hospital already exists
        if Hospital.objects.filter(name=data['name'], city='Indore').exists():
            log(f'  SKIP (already exists): {data["name"]}')
            continue

        log(f'  Creating: {data["name"]}...')

        # create hospital
        hospital = Hospital.objects.create(
            name                = data['name'],
            category            = data['category'],
            hospital_type       = data['hospital_type'],
            address             = data['address'],
            city                = 'Indore',
            area                = data['area'],
            district            = 'Indore',
            state               = 'Madhya Pradesh',
            pincode             = data['pincode'],
            phone               = data['phone'],
            email               = data.get('email', ''),
            total_beds          = data['total_beds'],
            icu_capacity        = data['icu_capacity'],
            latitude            = data.get('latitude'),
            longitude           = data.get('longitude'),
            status              = 'active',
            verification_status = 'verified',
            registration_date   = timezone.now().date(),
        )

        # create registration record
        HospitalRegistration.objects.create(
            hospital          = hospital,
            status            = 'approved',
            verification_date = timezone.now(),
        )

        # create services
        for code in data['services']:
            svc = service_objects.get(code)
            if svc:
                HospitalService.objects.get_or_create(
                    hospital     = hospital,
                    service      = svc,
                    defaults     = {'is_available': True},
                )

        # create departments and track them by name
        dept_map = {}
        for dept_name, dept_type, floor in data['departments']:
            dept = Department.objects.create(
                hospital  = hospital,
                name      = dept_name,
                dept_type = dept_type,
                floor     = floor,
                is_active = True,
            )
            dept_map[dept_type] = dept

        # create beds
        bed_counter = {}
        for bed_type, ward_type, count_avail, count_occup in data['beds']:
            if bed_type not in bed_counter:
                bed_counter[bed_type] = 1

            # find matching department
            dept_key_map = {
                'icu'       : 'icu',
                'ventilator': 'icu',
                'emergency' : 'emergency',
                'general'   : 'general',
                'private'   : 'general',
                'semi_pvt'  : 'general',
            }
            dept = dept_map.get(dept_key_map.get(bed_type, 'general'))

            prefix_map = {
                'icu'       : 'ICU',
                'general'   : 'G',
                'ventilator': 'V',
                'emergency' : 'EM',
                'private'   : 'PR',
                'semi_pvt'  : 'SP',
            }
            prefix = prefix_map.get(bed_type, 'B')

            beds_to_create = []

            for i in range(count_avail):
                beds_to_create.append(Bed(
                    hospital   = hospital,
                    department = dept,
                    bed_number = f'{prefix}-{bed_counter[bed_type]:03d}',
                    bed_type   = bed_type,
                    ward_type  = ward_type,
                    status     = 'available',
                    is_active  = True,
                ))
                bed_counter[bed_type] += 1

            for i in range(count_occup):
                beds_to_create.append(Bed(
                    hospital   = hospital,
                    department = dept,
                    bed_number = f'{prefix}-{bed_counter[bed_type]:03d}',
                    bed_type   = bed_type,
                    ward_type  = ward_type,
                    status     = 'occupied',
                    is_active  = True,
                ))
                bed_counter[bed_type] += 1

            Bed.objects.bulk_create(beds_to_create)

        # create equipment
        for equip_name, equip_type, manufacturer, qty, in_use in data['equipment']:
            dept = dept_map.get('icu') or dept_map.get('general')
            MedicalEquipment.objects.create(
                hospital           = hospital,
                department         = dept,
                name               = equip_name,
                equipment_type     = equip_type,
                manufacturer       = manufacturer,
                quantity           = qty,
                available_quantity = qty - in_use,
                status             = 'available' if in_use < qty else 'in_use',
            )

        # create doctors
        for doc_name, specialization, qualification, experience, phone in data['doctors']:
            dept = dept_map.get(specialization) or dept_map.get('general')
            Doctor.objects.create(
                        hospital         = hospital,
                        department       = dept,
                        full_name        = doc_name,
                        registration_no  = f'MP{uuid.uuid4().hex[:8].upper()}',  # ← FIXED
                        specialization   = specialization,
                        qualification    = qualification,
                        experience_years = experience,
                        phone            = phone,
                        status           = 'active',
                    )

        created_count += 1
        log(f'    [OK] {data["name"]} created with '
            f'{sum(a+o for _,_,a,o in data["beds"])} beds, '
            f'{len(data["departments"])} departments, '
            f'{len(data["doctors"])} doctors.')

    # ── Step 4: Summary ───────────────────────────────────────
    log('\n' + '='*50)
    log(f'SEED COMPLETE')
    log(f'  Hospitals created : {created_count}')
    log(f'  Total hospitals   : {Hospital.objects.filter(city="Indore").count()}')
    log(f'  Total beds        : {Bed.objects.filter(hospital__city="Indore").count()}')
    log(f'  Available beds    : {Bed.objects.filter(hospital__city="Indore", status="available").count()}')
    log(f'  Occupied beds     : {Bed.objects.filter(hospital__city="Indore", status="occupied").count()}')
    log(f'  Total doctors     : {Doctor.objects.filter(hospital__city="Indore").count()}')
    log('='*50)
    log('Now test the agent call:')
    log('  POST /api/calls/user-agent/request/')
    log('  { "phone": "your_number", "city": "Indore" }')


# ── Allow running directly in Django shell ────────────────────
if __name__ == '__main__':
    run_seed()