# 🚀 Quick Start Guide - AI Assistant Testing

## Running the Seed Script

### First Time Setup
```bash
cd backend
python seed_two_hospitals.py
```

### Reset and Reseed (Warning: Deletes all data)
```bash
python manage.py flush --noinput
python seed_two_hospitals.py
```

### Reseed Without Deletion
```bash
# The script uses get_or_create, so running it again will skip duplicates
python seed_two_hospitals.py
```

---

## Quick Database Queries

### Check All Patients
```bash
python manage.py shell
>>> from apps.patients.models import Patient
>>> for p in Patient.objects.all():
...     print(f"{p.full_name} - {p.phone}")
```

### Check All Transfer Requests
```bash
>>> from apps.patients.models import TransferRequest
>>> for tr in TransferRequest.objects.all():
...     print(f"{tr.patient.full_name}: {tr.status} - Priority: {tr.priority}")
```

### Check All Calls
```bash
>>> from apps.calls.models import CallLog
>>> for call in CallLog.objects.all():
...     print(f"{call.to_number}: {call.status} ({call.language})")
```

### Check Hospital Services
```bash
>>> from apps.hospitals.models import Hospital
>>> h = Hospital.objects.first()
>>> for svc in h.services.all():
...     print(f"  {svc.service.name}")
```

---

## Testing the AI Assistant

### Via Django Shell
```bash
python manage.py shell
>>> from apps.calls.agent import ask_groq
>>> response = ask_groq("I need an ICU bed for a cardiac patient")
>>> print(response)
```

### Via API Endpoint
```bash
curl -X GET http://localhost:8000/api/patients/
curl -X GET http://localhost:8000/api/transfers/
curl -X GET http://localhost:8000/api/calls/
```

---

## Troubleshooting

### Script Fails with "DoesNotExist"
**Solution:** Delete the database and reseed:
```bash
python manage.py flush --noinput
python seed_two_hospitals.py
```

### Unicode Errors on Windows
**Solution:** Set UTF-8 encoding:
```bash
$env:PYTHONIOENCODING='utf-8'
python seed_two_hospitals.py
```

### Foreign Key Constraint Error
**Solution:** Ensure hospitals exist first:
```bash
python manage.py shell
>>> from apps.hospitals.models import Hospital
>>> Hospital.objects.count()  # Should be 2+
```

---

## Data Structure Overview

```
Hospital (2)
  ├─ Departments (4 each)
  ├─ Doctors (4 each)
  ├─ Beds (36 total)
  ├─ Medical Equipment (4 types each)
  ├─ Services (5+ each)
  └─ Users (9 each)
      ├─ Admin
      ├─ Supervisor
      ├─ Reception (2)
      ├─ Ambulance Driver (2)
      └─ Patient (2)

Patient (9)
  ├─ Transfer Requests (5 total)
  │   ├─ 4 Pending
  │   ├─ 1 Accepted
  │   └─ 1 Rejected
  └─ Call Logs (4 total)
      ├─ 3 Completed
      └─ 1 No Answer
```

---

## Key Features Now Active

✅ **Multi-hospital coordination**
✅ **Patient transfer workflow**
✅ **Emergency call routing**
✅ **Multi-language AI assistant (English/Hindi)**
✅ **Real-time call logging**
✅ **Bed availability tracking**
✅ **Medical service lookup**
✅ **User role-based access control**
✅ **Resource sharing between hospitals**
✅ **Call session management**

---

## Performance Tips

1. **Use indexes:** Most queries are already indexed for speed
2. **Cache hospital data:** Hospitals rarely change
3. **Batch notifications:** Send multiple calls at once
4. **Monitor call duration:** Should be 30-60 seconds typically

---

## Next: Integration Testing

Once seeded, you can test:
1. **Patient Transfer Flow** → `/api/transfers/create/`
2. **AI Assistant Call** → Twilio webhook endpoint
3. **SMS Notifications** → Verify SMS delivery
4. **Multi-hospital Coordination** → Transfer between hospitals
5. **Language Detection** → Test with Hindi and English

---

## Support

For issues or questions:
- Check `AI_ASSISTANT_SEED_DATA.md` for detailed info
- Review `seed_two_hospitals.py` for seed structure
- Check Django logs for errors
- Verify Groq API key in settings

**Status:** ✅ Ready to test!
