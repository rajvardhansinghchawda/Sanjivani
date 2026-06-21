import re

with open('D:/gdg hackethon/frontend/hospital/src/pages/ReceptionPortalPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state
state_match = re.search(r'const \[showAdmitModal, setShowAdmitModal\] = useState\(false\);', content)
if state_match:
    content = content.replace(
        state_match.group(0),
        state_match.group(0) + '\n  const [patientArrivedAlert, setPatientArrivedAlert] = useState(null);'
    )
else:
    print('Failed to find state insertion point')

# 2. Add WebSocket effect
effect_code = '''
  useEffect(() => {
    const WS_HOST = window.location.host.replace("5173", "8000").replace("3000", "8000");
    const ws = new WebSocket(`ws://${WS_HOST}/ws/triage/`);
    
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "patient_arrived") {
          setPatientArrivedAlert(msg.data);
          // Play a sound or use speech synthesis if desired
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
    
    // Pre-fill the admit form
    setAdmitForm({
      name: patientArrivedAlert.patient_name || '',
      phone: patientArrivedAlert.patient_phone || '',
      age: patientArrivedAlert.patient_age || '',
      condition: patientArrivedAlert.symptoms || '',
      ward: patientArrivedAlert.required_bed_type ? patientArrivedAlert.required_bed_type.toLowerCase() : 'emergency',
      bed: ''
    });
    
    setPatientArrivedAlert(null);
    setShowAdmitModal(true); // Open the admit modal
  };
'''

# Find a good place to insert the effect, e.g., before useEffect(() => { if (!user) return; ...
effect_match = re.search(r'useEffect\(\(\) => \{\n    if \(\!user\) return;\n    loadPatients\(\);', content)
if effect_match:
    content = content.replace(
        effect_match.group(0),
        effect_code + '\n  ' + effect_match.group(0)
    )
else:
    print('Failed to find effect insertion point')

# 3. Add Modal JSX
modal_jsx = '''
        {/* Global Modal for Patient Arrived via Ambulance */}
        {patientArrivedAlert && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6 transition-all duration-300">
            <div className="bg-white rounded-[40px] p-10 w-full max-w-xl shadow-2xl relative border-4 border-red-500 overflow-hidden animate-pulse">
              <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
              <h3 className="text-4xl font-black text-red-600 hero-heading italic mb-4">🚑 Ambulance Arrived!</h3>
              <p className="text-gray-600 font-medium mb-6 text-lg">A patient has arrived via ambulance and needs immediate admission.</p>
              
              <div className="bg-red-50 p-6 rounded-3xl mb-8 border border-red-100">
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Patient Details</p>
                <p className="text-3xl font-black text-gray-900 mb-3">{patientArrivedAlert.patient_name || 'Unknown Patient'}</p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase">Phone</p>
                    <p className="font-bold font-mono">{patientArrivedAlert.patient_phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase">Severity / Triage</p>
                    <p className="font-bold text-red-600">{patientArrivedAlert.severity || 'Unknown'}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Condition / Symptoms</p>
                  <p className="font-medium text-gray-700">{patientArrivedAlert.symptoms || 'Not specified'}</p>
                </div>
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-red-100">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase">Required Bed</p>
                    <p className="font-black text-[#1B4332]">{patientArrivedAlert.required_bed_type || 'General'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Ambulance</p>
                    <p className="font-bold text-gray-600">{patientArrivedAlert.ambulance_vehicle}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={handleAcknowledgeAndAdmit}
                  className="flex-1 bg-red-600 text-white font-black py-4 px-6 rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-500/30"
                >
                  Acknowledge & Admit
                </button>
                <button 
                  onClick={() => setPatientArrivedAlert(null)}
                  className="px-6 py-4 rounded-2xl font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
'''

modal_match = re.search(r'\{showAdmitModal && \(', content)
if modal_match:
    content = content.replace(
        modal_match.group(0),
        modal_jsx + '\n        ' + modal_match.group(0)
    )
else:
    print('Failed to find modal insertion point')

with open('D:/gdg hackethon/frontend/hospital/src/pages/ReceptionPortalPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Success: ReceptionPortalPage updated')
