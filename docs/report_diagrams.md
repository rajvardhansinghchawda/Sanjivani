# Healthcare Management System - Report Diagrams

These diagrams are written in Mermaid format. You can paste each code block into a Mermaid-supported editor, Markdown report, or diagram exporter to generate images for your project report.

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        Browser["Web Browser"]
        Mobile["Mobile App via Capacitor"]
        Roles["Users: Patient, Reception, Doctor, Driver, Supervisor, Admin"]
    end

    subgraph Frontend["React + Vite Frontend"]
        Router["React Router Pages"]
        APIClient["Axios API Client"]
        MapsCharts["Maps, Charts, Dashboards"]
    end

    subgraph Backend["Django Backend"]
        DRF["Django REST API"]
        Auth["JWT Authentication"]
        Apps["Domain Apps: Hospitals, Beds, Patients, Ambulances, Calls, Triage, Supervisors, Analytics"]
        Channels["Django Channels WebSockets"]
        Celery["Celery Workers"]
        Beat["Celery Beat Scheduler"]
    end

    subgraph Data["Data and Integration Layer"]
        PostgreSQL["PostgreSQL Database"]
        Redis["Redis Cache, Broker, Channel Layer"]
        Twilio["Twilio Voice and SMS"]
        AI["AI Assistant / Triage Engine"]
        Maps["Maps and Location Services"]
    end

    Roles --> Browser
    Roles --> Mobile
    Browser --> Router
    Mobile --> Router
    Router --> APIClient
    Router --> MapsCharts
    APIClient --> DRF
    APIClient --> Channels
    DRF --> Auth
    DRF --> Apps
    Apps --> PostgreSQL
    Apps --> Redis
    Channels --> Redis
    Celery --> Redis
    Celery --> PostgreSQL
    Beat --> Celery
    Apps --> Twilio
    Apps --> AI
    Apps --> Maps
```

## 2. Use Case Diagram

```mermaid
flowchart LR
    Patient((Patient))
    Reception((Reception Staff))
    Doctor((Doctor))
    Driver((Ambulance Driver))
    Supervisor((Supervisor))
    Admin((Admin / Platform Admin))

    subgraph System["Healthcare Management System"]
        UC1["Register / Sign In"]
        UC2["Search Hospitals and Services"]
        UC3["Create Emergency Triage Case"]
        UC4["Track Patient Case"]
        UC5["Book Ambulance"]
        UC6["Update Ambulance Trip Status"]
        UC7["Manage Beds and Admissions"]
        UC8["Create Patient Transfer Request"]
        UC9["Review Triage and Patient Status"]
        UC10["Monitor Alerts and Corrections"]
        UC11["Verify Hospital Registration"]
        UC12["Manage Hospitals, Doctors, Services"]
        UC13["View Analytics Dashboards"]
    end

    Patient --> UC1
    Patient --> UC2
    Patient --> UC3
    Patient --> UC4
    Patient --> UC5

    Reception --> UC1
    Reception --> UC5
    Reception --> UC7
    Reception --> UC8
    Reception --> UC13

    Doctor --> UC1
    Doctor --> UC9

    Driver --> UC1
    Driver --> UC6

    Supervisor --> UC1
    Supervisor --> UC10
    Supervisor --> UC11
    Supervisor --> UC13

    Admin --> UC1
    Admin --> UC11
    Admin --> UC12
    Admin --> UC13
```

## 3. Main Database ER Diagram

```mermaid
erDiagram
    USER ||--o| PATIENT : "has profile"
    USER ||--o| AMBULANCE : "drives"
    USER ||--o{ BED_ALLOCATION : "allocates"
    USER ||--o{ TRANSFER_REQUEST : "requests"
    USER ||--o{ ALERT : "raises or resolves"
    USER ||--o{ EMERGENCY_CASE : "reviews"

    HOSPITAL ||--o{ DEPARTMENT : "contains"
    HOSPITAL ||--o{ BED : "owns"
    HOSPITAL ||--o{ MEDICAL_EQUIPMENT : "stores"
    HOSPITAL ||--o{ AMBULANCE : "operates"
    HOSPITAL ||--o{ DOCTOR : "employs"
    HOSPITAL ||--o| HOSPITAL_REGISTRATION : "has"
    HOSPITAL ||--o{ HOSPITAL_SERVICE : "offers"
    HOSPITAL ||--o{ RESOURCE_AVAILABILITY : "reports"
    HOSPITAL ||--o{ EMERGENCY_CASE : "recommended for"

    DEPARTMENT ||--o{ BED : "contains"
    DEPARTMENT ||--o{ MEDICAL_EQUIPMENT : "uses"
    DEPARTMENT ||--o{ DOCTOR : "assigned doctors"
    DEPARTMENT ||--o{ DUTY_SCHEDULE : "has shifts"

    SERVICE_CATEGORY ||--o{ SERVICE_MASTER : "groups"
    SERVICE_MASTER ||--o{ HOSPITAL_SERVICE : "mapped to hospitals"

    DOCTOR ||--o{ DUTY_SCHEDULE : "works"
    PATIENT ||--o{ BED_ALLOCATION : "admitted through"
    PATIENT ||--o{ TRANSFER_REQUEST : "has"
    PATIENT ||--o{ AMBULANCE_REQUEST : "books"

    BED ||--o{ BED_ALLOCATION : "allocated in"
    BED ||--o{ ALERT : "may trigger"

    AMBULANCE ||--o{ AMBULANCE_REQUEST : "serves"
    HOSPITAL ||--o{ AMBULANCE_REQUEST : "destination"

    HOSPITAL ||--o{ TRANSFER_REQUEST : "from hospital"
    HOSPITAL ||--o{ TRANSFER_REQUEST : "to hospital"

    CALL_LOG ||--o| CALL_SESSION : "has"
    TRANSFER_REQUEST ||--o{ CALL_LOG : "may trigger"

    HOSPITAL ||--o{ RESOURCE_SHARING_REQUEST : "requests"
    HOSPITAL ||--o{ RESOURCE_SHARING_REQUEST : "provides"
```

## 4. UML Class Diagram - Core Domain

```mermaid
classDiagram
    class User {
        +uuid id
        +string email
        +string role
        +uuid hospital
        +login()
        +refreshToken()
    }

    class Hospital {
        +uuid id
        +string name
        +string category
        +string hospital_type
        +string city
        +int total_beds
        +int icu_capacity
        +string verification_status
    }

    class Department {
        +uuid id
        +string name
        +string dept_type
        +string floor
        +boolean is_active
    }

    class Bed {
        +uuid id
        +string bed_number
        +string bed_type
        +string status
        +boolean has_oxygen
        +boolean has_ventilator
    }

    class Patient {
        +uuid id
        +string full_name
        +string phone
        +int age
        +string blood_group
        +is_admitted()
    }

    class BedAllocation {
        +uuid id
        +datetime allocated_at
        +datetime discharged_at
        +string reason
    }

    class Ambulance {
        +uuid id
        +string vehicle_number
        +string ambulance_type
        +string status
        +decimal latitude
        +decimal longitude
    }

    class AmbulanceRequest {
        +uuid id
        +string pickup_address
        +string status
        +datetime requested_at
        +datetime completed_at
        +response_time_minutes()
    }

    class EmergencyCase {
        +uuid id
        +string case_id
        +string patient_name
        +string raw_symptoms_text
        +string ai_p_level
        +json needs_profile
        +json recommended_hospitals
        +string status
    }

    Hospital "1" --> "*" Department
    Hospital "1" --> "*" Bed
    Hospital "1" --> "*" Ambulance
    Hospital "1" --> "*" EmergencyCase
    Department "1" --> "*" Bed
    User "1" --> "0..1" Patient
    User "1" --> "0..1" Ambulance
    Patient "1" --> "*" BedAllocation
    Bed "1" --> "*" BedAllocation
    Patient "1" --> "*" AmbulanceRequest
    Ambulance "1" --> "*" AmbulanceRequest
    Hospital "1" --> "*" AmbulanceRequest
```

## 5. Authentication and Role-Based Access Flow

```mermaid
flowchart TD
    Start([User opens app]) --> LoginPage["Sign in / Sign up page"]
    LoginPage --> Submit["Submit credentials"]
    Submit --> API["POST /api/auth/login/ or register/"]
    API --> Valid{"Credentials valid?"}
    Valid -- No --> Error["Show error message"]
    Error --> LoginPage
    Valid -- Yes --> Token["Issue access and refresh JWT"]
    Token --> Store["Store tokens in localStorage"]
    Store --> Role{"User role"}
    Role -- Patient --> PatientPortal["Patient Portal"]
    Role -- Reception --> ReceptionPortal["Reception Portal"]
    Role -- Doctor --> DoctorPortal["Doctor Portal"]
    Role -- Ambulance Driver --> DriverPortal["Driver Portal"]
    Role -- Supervisor --> SupervisorPortal["Supervisor Portal"]
    Role -- Admin --> AdminPortal["Admin / Platform Portal"]
    Store --> Request["Future API request"]
    Request --> Expired{"Access token expired?"}
    Expired -- No --> Protected["Access protected endpoint"]
    Expired -- Yes --> Refresh["Refresh token"]
    Refresh --> Retry["Retry original request"]
```

## 6. Emergency AI Triage and Hospital Routing Flow

```mermaid
flowchart TD
    Start([Emergency reported]) --> Form["Collect patient details, location, symptoms"]
    Form --> Submit["Submit emergency case"]
    Submit --> Backend["Triage API receives case"]
    Backend --> AI["AI evaluates symptoms and severity"]
    AI --> PLevel["Assign P-level: P1, P2, P3, or P4"]
    PLevel --> Needs["Build care needs profile"]
    Needs --> Search["Find hospitals by distance, beds, ICU, services, doctors"]
    Search --> Rank["Rank recommended hospitals"]
    Rank --> Save["Save EmergencyCase with AI output"]
    Save --> Notify["Notify dispatcher / reception dashboard"]
    Notify --> Decision{"Ambulance required?"}
    Decision -- Yes --> Ambulance["Create or suggest ambulance request"]
    Decision -- No --> Guidance["Show hospital guidance and tracking link"]
    Ambulance --> Track["Track case and ambulance progress"]
    Guidance --> Track
    Track --> Resolve["Mark case resolved"]
    Resolve --> Review["Doctor or dispatcher records actual outcome"]
    Review --> Learn["Store undertriage / overtriage feedback"]
```

## 7. Ambulance Booking and Dispatch Sequence

```mermaid
sequenceDiagram
    actor Patient
    participant Frontend as React Frontend
    participant API as Django REST API
    participant DB as PostgreSQL
    participant Redis as Redis / WebSocket
    participant Driver as Driver App

    Patient->>Frontend: Enter pickup, phone, hospital, ambulance type
    Frontend->>API: Create ambulance request
    API->>DB: Save AmbulanceRequest as pending
    API->>DB: Search available ambulances
    API->>Redis: Publish new request notification
    Redis-->>Driver: Notify nearby driver
    Driver->>API: Accept request
    API->>DB: Assign ambulance and update status
    API->>Redis: Broadcast accepted status
    Redis-->>Frontend: Show accepted / en route
    Driver->>API: Update location and trip status
    API->>Redis: Broadcast live status
    Redis-->>Frontend: Show tracking updates
    Driver->>API: Complete trip
    API->>DB: Store completed time and duration
    API-->>Frontend: Show completed status
```

## 8. Bed Admission and Discharge Flow

```mermaid
flowchart TD
    Start([Patient arrives or is selected]) --> Search["Search patient record"]
    Search --> Existing{"Patient exists?"}
    Existing -- No --> Register["Register patient profile"]
    Existing -- Yes --> BedCheck["Check bed availability"]
    Register --> BedCheck
    BedCheck --> Available{"Suitable bed available?"}
    Available -- No --> Transfer["Create transfer request or waitlist"]
    Available -- Yes --> SelectBed["Select ward, department, and bed"]
    SelectBed --> Allocate["Create BedAllocation"]
    Allocate --> Occupy["Update bed status to occupied"]
    Occupy --> Notify["Notify dashboard and analytics"]
    Notify --> Monitor["Monitor length of stay"]
    Monitor --> LongStay{"Occupied more than threshold?"}
    LongStay -- Yes --> Alert["Create supervisor alert"]
    LongStay -- No --> Treatment["Continue treatment"]
    Alert --> Treatment
    Treatment --> Discharge{"Ready for discharge?"}
    Discharge -- No --> Monitor
    Discharge -- Yes --> Close["Set discharged_at"]
    Close --> FreeBed["Update bed status to available"]
    FreeBed --> End([Admission closed])
```

## 9. Patient Transfer Request Flow

```mermaid
flowchart TD
    Start([Reception creates transfer request]) --> Details["Enter patient, priority, reason, required bed and services"]
    Details --> Save["Save TransferRequest as pending"]
    Save --> NotifyHospitals["Notify receiving hospital / supervisor"]
    NotifyHospitals --> Review["Receiving hospital reviews capacity"]
    Review --> Capacity{"Can accept patient?"}
    Capacity -- No --> Reject["Reject with reason"]
    Reject --> SearchAlt["Search another hospital"]
    SearchAlt --> NotifyHospitals
    Capacity -- Yes --> Accept["Accept transfer"]
    Accept --> Ambulance{"Ambulance needed?"}
    Ambulance -- Yes --> Book["Book ambulance request"]
    Ambulance -- No --> Move["Arrange transfer manually"]
    Book --> Move
    Move --> Complete["Mark transfer completed"]
    Complete --> Update["Update patient admission / bed allocation"]
    Update --> End([Transfer closed])
```

## 10. Supervisor Monitoring Flow

```mermaid
flowchart TD
    Start([Scheduled checks or manual review]) --> Checks["Run verification, long occupancy, and resource checks"]
    Checks --> LongOcc{"Long bed occupancy found?"}
    Checks --> MissingRes{"Missing or stale resource update?"}
    Checks --> Mismatch{"Resource mismatch detected?"}
    Checks --> PendingReg{"Pending hospital verification?"}

    LongOcc -- Yes --> Alert1["Create long occupancy alert"]
    MissingRes -- Yes --> Alert2["Create resource update alert"]
    Mismatch -- Yes --> Alert3["Create resource mismatch alert"]
    PendingReg -- Yes --> ReviewReg["Supervisor reviews registration"]

    Alert1 --> Dashboard["Supervisor dashboard"]
    Alert2 --> Dashboard
    Alert3 --> Dashboard
    ReviewReg --> Decision{"Approve hospital?"}
    Decision -- Yes --> Verified["Set hospital verified"]
    Decision -- No --> Rejected["Set hospital rejected with reason"]
    Dashboard --> Resolve["Supervisor resolves or assigns correction"]
    Resolve --> Audit["Store resolution history"]
```

## 11. Real-Time Notification Flow

```mermaid
sequenceDiagram
    participant Event as System Event
    participant API as Django App
    participant Redis as Redis Channel Layer
    participant WS as Django Channels
    participant UI as React Dashboard

    Event->>API: Bed, ambulance, alert, or triage status changes
    API->>Redis: Publish event payload
    Redis->>WS: Deliver to subscribed group
    WS-->>UI: Push WebSocket message
    UI->>UI: Update dashboard card, map, or alert list
```

## 12. Deployment Diagram

```mermaid
flowchart TB
    User["User Browser / Mobile App"] --> Nginx["Nginx / HTTPS Reverse Proxy"]
    Nginx --> React["React Static Build"]
    Nginx --> Gunicorn["Gunicorn Django REST API"]
    Nginx --> Daphne["Daphne ASGI WebSocket Server"]

    Gunicorn --> DB["PostgreSQL"]
    Gunicorn --> Redis["Redis"]
    Daphne --> Redis

    Redis --> Worker["Celery Worker"]
    Redis --> Beat["Celery Beat"]
    Worker --> DB
    Worker --> Twilio["Twilio"]
    Worker --> AI["AI / Triage Provider"]
    Gunicorn --> Maps["Maps Provider"]
```
