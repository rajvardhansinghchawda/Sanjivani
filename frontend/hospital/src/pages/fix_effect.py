import re

with open('D:/gdg hackethon/frontend/hospital/src/pages/ReceptionPortalPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

effect_code = '''
  // --- Auto-Admit WebSocket ---
  useEffect(() => {
    const WS_HOST = window.location.host.replace("5173", "8000").replace("3000", "8000");
    const ws = new WebSocket(`ws://${WS_HOST}/ws/triage/`);
    
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "patient_arrived") {
          setPatientArrivedAlert(msg.data);
          if (typeof window !== 'undefined' && window.speechSynthesis) {
            const u = new SpeechSynthesisUtterance("Emergency ambulance has arrived. Patient " + (msg.data.patient_name || "") + " requires admission.");
            window.speechSynthesis.speak(u);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    return () => {
      ws.close();
    };
  }, []);

  const handleAcknowledgeAndAdmit = () => {
    if (!patientArrivedAlert) return;
    
    setAdmitForm({
      name: patientArrivedAlert.patient_name || '',
      phone: patientArrivedAlert.patient_phone || '',
      age: patientArrivedAlert.patient_age || '',
      condition: patientArrivedAlert.symptoms || '',
      ward: patientArrivedAlert.required_bed_type ? patientArrivedAlert.required_bed_type.toLowerCase() : 'emergency',
      bed: ''
    });
    
    setPatientArrivedAlert(null);
    setShowAdmitModal(true);
  };
  // ----------------------------
'''

# Find a good place, e.g., right before `const loadRecentPatients = () => {`
target = '  const loadRecentPatients = () => {'
if target in content:
    content = content.replace(target, effect_code + '\n' + target)
    print('Inserted effect successfully')
else:
    print('Target not found')

with open('D:/gdg hackethon/frontend/hospital/src/pages/ReceptionPortalPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
