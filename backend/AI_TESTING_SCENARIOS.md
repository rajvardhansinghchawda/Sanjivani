# 🧪 AI Assistant Testing Guide - Aarohi

## Database Status: ✅ READY

Your AI assistant now has:
- ✅ 2 hospitals with 320+ beds
- ✅ 10 patients with real medical profiles
- ✅ 7 active transfer requests
- ✅ 10 call logs (completed & failed)
- ✅ Multi-language support (English & Hindi)
- ✅ Emergency routing configured

---

## 🎯 Test Scenarios

### Test 1: Critical Emergency Transfer
**Objective:** Test CRITICAL priority handling

```bash
# Call the AI assistant
Phone: +919123456701
Patient: Vikram Singh (65y, cardiac patient)
Expected: Fast-track to ICU, Bombay Hospital priority routing
```

**AI Should:**
- Detect critical condition
- Route to nearest facility with ICU
- Provide transfer details
- Confirm patient details

---

### Test 2: Post-Operative Complication
**Objective:** Test HIGH priority medical decision-making

```bash
Phone: +919123456703
Patient: Deepa Sharma (52y, post-operative)
Hospital: Bombay → Indore Care
Expected: Neurological assessment, specialized surgery available
```

**AI Should:**
- Understand post-op complications
- Check surgical specialty availability
- Route to Indore Care Hospital
- Provide specialist names

---

### Test 3: Stable Patient Routine Transfer
**Objective:** Test MEDIUM priority standard routing

```bash
Phone: +919123456705
Patient: Arjun Patel (48y, stable)
Expected: General ward available, X-ray facility confirmed
```

**AI Should:**
- Confirm stable vital signs
- Check bed availability
- Provide estimated transfer time
- Route to appropriate ward

---

### Test 4: Multi-Language Test (Hindi)
**Objective:** Test Hindi/Hinglish detection

```
Voice Input: "Mere papa ko ICU bed chahiye, unhe cardiac problem hai"
Translation: "My father needs ICU bed, he has cardiac problems"
Expected: Response in Hindi with transfer options
```

**AI Should:**
- Auto-detect Hindi
- Respond in conversational Hindi
- Provide options in Hindi
- Offer SMS confirmation

---

### Test 5: Multi-Language Test (English)
**Objective:** Test English medical terminology

```
Voice Input: "I need to transfer my patient with acute myocardial infarction"
Expected: Medical facility with cardiac ICU
```

**AI Should:**
- Recognize medical terms
- Route to cardiology department
- Provide clinical details
- Confirm in professional English

---

### Test 6: No Answer Scenario
**Objective:** Test fallback mechanism

```bash
Phone: +919123456709
Status: No Answer initially
Expected: Automatic retry with SMS backup
```

**AI Should:**
- Retry call 3 times
- Send SMS with details
- Log attempt
- Flag for manual follow-up

---

### Test 7: Elderly Patient (Multiple Conditions)
**Objective:** Test complex medical history

```bash
Phone: +919123456709
Patient: Rajesh Gupta (72y, Heart Disease, Hypertension, Stroke Risk)
Expected: Comprehensive care facility with ICU + monitoring
```

**AI Should:**
- Prioritize critical conditions
- Check all required services
- Route to best-equipped hospital
- Provide family communication

---

### Test 8: Young Patient Routine Care
**Objective:** Test non-emergency scenario

```bash
Phone: +919123456711
Patient: Neha Verma (29y, no chronic conditions)
Expected: Standard ward, routine care facility
```

**AI Should:**
- Assess non-emergency need
- Provide appropriate facility
- Offer cost-effective option
- Confirm appointment

---

## 🔧 How to Run Tests

### Via Django Admin
1. Go to http://localhost:8000/admin/
2. Login with: `admin@indorecarehospital.com / Admin@123`
3. Navigate to:
   - Patients (view all 10)
   - Transfer Requests (view 7 active)
   - Call Logs (view history)

### Via API Endpoints

```bash
# Get all transfer requests
curl http://localhost:8000/api/transfers/

# Get pending transfers only
curl http://localhost:8000/api/transfers/?status=pending

# Get critical priority only
curl http://localhost:8000/api/transfers/?priority=critical

# Get hospital-specific requests
curl http://localhost:8000/api/transfers/?hospital=indore-care

# Get call history
curl http://localhost:8000/api/calls/

# Get specific patient
curl http://localhost:8000/api/patients/
```

### Via Django Shell

```bash
python manage.py shell
```

```python
# Check pending transfers
from apps.patients.models import TransferRequest
critical = TransferRequest.objects.filter(priority='critical', status='pending')
for t in critical:
    print(f"{t.patient.full_name} - Needs: {t.required_services}")

# Check patient details
from apps.patients.models import Patient
p = Patient.objects.get(phone='9123456701')
print(f"Name: {p.full_name}")
print(f"Age: {p.age}")
print(f"Conditions: {p.chronic_conditions}")
print(f"Allergies: {p.known_allergies}")

# Check hospital capacity
from apps.hospitals.models import Hospital
h = Hospital.objects.get(name='Bombay Hospital Indore')
available_beds = h.beds.filter(status='available').count()
print(f"Available ICU beds: {available_beds}")

# Check AI assistant call history
from apps.calls.models import CallLog
calls = CallLog.objects.filter(language='hi')
print(f"Hindi calls: {calls.count()}")
```

---

## 📊 Performance Metrics to Monitor

### Call Duration (Expected: 30-60 seconds)
- ✅ Completed calls: 45-52 seconds
- ⚠️ No answer: Should retry within 5 min
- ❌ Failed calls: Log and notify

### Language Detection Accuracy
- English: Formal medical terminology
- Hindi: Conversational with Hinglish support
- Mixed: Should default to detected primary language

### Transfer Routing Success
- Critical: Should route within 2 minutes
- High: Should route within 5 minutes
- Medium: Should route within 10 minutes

### Bed Availability Updates
- ICU beds: Real-time allocation
- General beds: Hourly updates
- Specialty beds: As needed

---

## 🚨 Emergency Test Protocol

### Simulate Critical Emergency

```bash
# Step 1: Create urgent transfer request
POST /api/transfers/create/
{
    "patient_id": "vikram-singh",
    "from_hospital": "Indore Care Hospital",
    "to_hospital": "Bombay Hospital Indore",
    "priority": "critical",
    "reason": "Acute MI - needs advanced cardiac care"
}

# Step 2: Trigger AI call
POST /api/calls/create/
{
    "transfer_id": "transfer-id",
    "to_number": "+919123456701",
    "language": "hi",
    "call_type": "transfer_notification"
}

# Step 3: Monitor response
GET /api/calls/logs/
# Should show: initiated → ringing → in_progress → completed
```

---

## 🎓 Sample Conversations

### English Conversation
```
AI: "Hello, this is Aarohi from healthcare coordination. 
     I have a critical transfer request for your patient."
     
Patient: "Yes, which hospital?"

AI: "Your patient needs ICU care. Bombay Hospital Indore 
     has advanced cardiac facilities available. 
     Transfer can begin within 10 minutes."
     
Patient: "Please proceed"

AI: "Transfer approved. You'll receive SMS with ambulance 
     details and estimated arrival time."
```

### Hindi Conversation
```
AI: "Namaste, main Aarohi hoon. Aapke patient ke liye 
     ek important transfer request hai."
     
Patient: "Kaunse hospital mein?"

AI: "Aapke patient ko ICU care chahiye. Bombay Hospital 
     ke paas advanced facilities hain. Transfer 10 minute 
     mein shuru ho sakta hai."
     
Patient: "Thik hai, proceed karo"

AI: "Transfer confirm. Aapko ambulance ka SMS detail 
     aur time mil jayega."
```

---

## ✅ Success Criteria

- [ ] AI detects language correctly (English/Hindi)
- [ ] Calls complete within 60 seconds
- [ ] Transfer routing matches hospital capacity
- [ ] Patient details retrieved accurately
- [ ] Emergency calls prioritized correctly
- [ ] SMS notifications sent successfully
- [ ] Call logs maintained properly
- [ ] Multiple languages handled smoothly

---

## 📝 Troubleshooting During Tests

### Issue: Call doesn't connect
**Solution:** Check if Twilio is configured in settings.py

### Issue: Wrong language detected
**Solution:** AI will ask to confirm language preference

### Issue: Transfer route unavailable
**Solution:** Check hospital capacity - may need to route elsewhere

### Issue: Patient not found
**Solution:** Verify phone number matches database (9123456701, etc)

### Issue: Slow call response
**Solution:** Check internet connection and Groq API status

---

## 🎯 Performance Optimization Tips

1. **Cache Hospital Data:** Reduces lookup time
2. **Batch Process Calls:** Handle multiple calls efficiently
3. **Preload Patient History:** Faster context access
4. **Monitor API Response Time:** Should be <500ms
5. **Use Connection Pooling:** Database efficiency

---

## 📞 Contact Support

**AI Assistant:** Aarohi (आरोही)  
**Status:** ✅ Fully Operational  
**Database:** ✅ Seeded and Ready  
**Test Data:** ✅ Complete  

**Ready to receive calls from:**
- +919123456701 (Vikram Singh - Hindi)
- +919123456703 (Deepa Sharma - English)
- +919123456705 (Arjun Patel - Hindi)
- +919123456707 (Surbhi Nair - English)
- +919123456709 (Rajesh Gupta - Hindi)
- +919123456711 (Neha Verma - English)
- +919123456713 (Mohammad Hassan - Hindi)

---

*Happy Testing! Your AI Assistant is ready to save lives. 🚑💙*
