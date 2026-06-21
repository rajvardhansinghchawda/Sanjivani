// frontend/hospital/src/pages/EmergencyPortal.jsx
// AI Emergency Portal — Full pipeline with multilingual voice input (EN + HI)
// Auto-fills patient details when user is already logged in.
// Voice input uses Web Speech API (SpeechRecognition) — works in Chrome/Edge/Safari.

import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function apiFetch(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
}

// ── Severity config ────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  P1: { bg: "#FCEBEB", border: "#E24B4A", text: "#A32D2D", badge: "#E24B4A", label: "P1 — Critical",  icon: "🚨" },
  P2: { bg: "#FAEEDA", border: "#EF9F27", text: "#854F0B", badge: "#EF9F27", label: "P2 — Urgent",    icon: "⚠️" },
  P3: { bg: "#E6F1FB", border: "#378ADD", text: "#185FA5", badge: "#378ADD", label: "P3 — Moderate",  icon: "🔵" },
  P4: { bg: "#EAF3DE", border: "#639922", text: "#3B6D11", badge: "#639922", label: "P4 — Low",        icon: "🟢" },
};

// ── Bilingual quick-select chips ───────────────────────────────────────────
const QUICK_SYMPTOMS = {
  en: [
    "Chest pain radiating to left arm, sweating",
    "Severe headache, sudden vision loss",
    "Difficulty breathing, cannot speak full sentences",
    "Unconscious, not responding to voice",
    "Child with high fever and rash",
    "Severe abdominal pain and vomiting blood",
    "Fall from height, bleeding from head",
    "Knee pain after accident, swollen",
  ],
  hi: [
    "सीने में दर्द, बायें हाथ में जा रहा है, पसीना आ रहा है",
    "अचानक बहुत तेज सिरदर्द, आँखों से कम दिख रहा है",
    "साँस लेने में बहुत तकलीफ, पूरा वाक्य नहीं बोल पा रहे",
    "बेहोश हैं, आवाज़ देने पर कोई जवाब नहीं",
    "बच्चे को तेज़ बुखार और पूरे शरीर पर दाने",
    "पेट में असहनीय दर्द, खून की उल्टी हो रही है",
    "ऊँचाई से गिरे, सिर से खून आ रहा है",
    "दुर्घटना के बाद घुटने में दर्द, सूजन है",
  ],
};

// ── UI strings (bilingual) ─────────────────────────────────────────────────
const UI = {
  en: {
    heading:        "Describe What's Happening",
    aiBadge:        "🤖 AI determines department automatically",
    quickLabel:     "Quick select:",
    placeholder:    `Describe exactly what the patient is experiencing — in plain language. For example:\n"My mom fell down the stairs, she's not responding when I call her name, and her breathing sounds strange. She's 72 years old."`,
    tapHint:        "✍️ No need to select a department — the AI reads your description and determines the required specialty.",
    micHint:        "🎙️ Click the mic and speak",
    micListening:   "🔴 Listening… speak now",
    micDone:        "✅ Voice captured",
    analyzeBtn:     "🤖 Analyze with AI →",
    analyzing:      "AI is analyzing symptoms, profiling care needs & ranking hospitals…",
    knownLabel:     "Known Medical Conditions (optional)",
    knownPlaceholder: "e.g. diabetes, hypertension, heart disease",
    nameLabel:      "Patient Name", ageLbl: "Age", phoneLbl: "Phone Number", genderLbl: "Gender",
    genderOpts:     ["-- Select --", "Male", "Female", "Other"],
    genderVals:     ["", "male", "female", "other"],
    locDetected:    (lat, lng) => `📍 Location detected: ${lat}, ${lng} — enables AI hospital routing`,
    locWait:        "📍 Detecting your location for hospital routing...",
    voiceNotSupported: "⚠️ Voice input not supported in this browser. Use Chrome or Edge.",
  },
  hi: {
    heading:        "क्या हो रहा है बताएं",
    aiBadge:        "🤖 AI विभाग खुद तय करता है",
    quickLabel:     "जल्दी चुनें:",
    placeholder:    `मरीज़ को क्या हो रहा है, अपनी भाषा में बताएं। जैसे:\n"मेरी माँ सीढ़ियों से गिर गईं, वो जवाब नहीं दे रहीं और उनकी साँसें अजीब लग रही हैं। वो 72 साल की हैं।"`,
    tapHint:        "✍️ विभाग चुनने की ज़रूरत नहीं — AI आपके विवरण से खुद तय करेगा",
    micHint:        "🎙️ माइक दबाएं और बोलें",
    micListening:   "🔴 सुन रहा है… अभी बोलें",
    micDone:        "✅ आवाज़ रिकॉर्ड हो गई",
    analyzeBtn:     "🤖 AI से विश्लेषण करें →",
    analyzing:      "AI लक्षणों का विश्लेषण कर रहा है, अस्पताल खोज रहा है…",
    knownLabel:     "पहले से कोई बीमारी है? (वैकल्पिक)",
    knownPlaceholder: "जैसे: मधुमेह, उच्च रक्तचाप, हृदय रोग",
    nameLabel:      "मरीज़ का नाम", ageLbl: "आयु", phoneLbl: "फ़ोन नंबर", genderLbl: "लिंग",
    genderOpts:     ["-- चुनें --", "पुरुष", "महिला", "अन्य"],
    genderVals:     ["", "male", "female", "other"],
    locDetected:    (lat, lng) => `📍 स्थान मिला: ${lat}, ${lng} — AI अस्पताल रूटिंग सक्षम`,
    locWait:        "📍 आपका स्थान खोजा जा रहा है…",
    voiceNotSupported: "⚠️ इस ब्राउज़र में वॉइस इनपुट नहीं चलता। Chrome या Edge इस्तेमाल करें।",
  },
};

// ── Check if SpeechRecognition is available ────────────────────────────────
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

export default function EmergencyPortal() {
  const [lang, setLang]               = useState("en");   // "en" | "hi"
  const [step, setStep]               = useState(1);
  const [loading, setLoading]         = useState(false);
  const [formData, setFormData]       = useState({
    patient_name: "", age: "", phone: "", gender: "",
    symptoms_text: "", known_conditions: "",
  });
  const [location, setLocation]       = useState(null);
  const [locError, setLocError]       = useState(null);

  // Patient auto-fill state
  const [patientAutoFilled, setPatientAutoFilled] = useState(false);  // show banner
  const [autofillDismissed, setAutofillDismissed] = useState(false);
  const [isLoggedIn, setIsLoggedIn]               = useState(false);
  const [patientDisplayName, setPatientDisplayName] = useState("");

  // Voice recording state
  const [micState, setMicState]       = useState("idle");   // "idle" | "listening" | "done"
  const [micError, setMicError]       = useState(null);
  const recognitionRef                = useRef(null);

  // AI results
  const [triageResult, setTriageResult]     = useState(null);
  const [needsProfile, setNeedsProfile]     = useState(null);
  const [hospitals, setHospitals]           = useState([]);
  const [routingExplanation, setRoutingExp] = useState("");
  const [selectedHosp, setSelectedHosp]     = useState(null);
  const [caseConfirmed, setCaseConfirmed]   = useState(false);
  const [caseId, setCaseId]                 = useState(null);
  const [error, setError]                   = useState(null);

  // Dispatch Tracking State
  const [dispatchStatus, setDispatchStatus] = useState(null); // SEARCHING | ASSIGNED | EN_ROUTE | DRIVER_ARRIVED | TO_HOSPITAL
  const [dispatchData, setDispatchData]     = useState(null);
  const patientWsRef                        = useRef(null);

  // Twilio SOS State
  const [sosLoading, setSosLoading]         = useState(false);
  const [sosMessage, setSosMessage]         = useState("");

  const handleSOSCall = async () => {
    setSosLoading(true);
    setSosMessage(lang === "hi" ? "आपातकालीन नंबर कनेक्ट हो रहा है..." : "Connecting to emergency number...");
    try {
      const payload = {
        phone: formData.phone || "9999999999",
        city: "Indore",
        is_emergency: true,
        location_lat: location?.lat,
        location_lng: location?.lng,
        patient_name: formData.patient_name || patientDisplayName || "",
        age: formData.age || "",
        gender: formData.gender || "",
        known_conditions: formData.known_conditions || ""
      };
      const res = await apiFetch('/api/calls/user-agent/request/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Request failed');
      
      setSosMessage(lang === "hi" ? "कॉल कनेक्ट हो गया है! कृपया फोन उठाएं और बात करें।" : "Call connected! Please pick up your phone and speak to Aarohi.");
      
      // Start polling for case_id
      const interval = setInterval(async () => {
        try {
          const stRes = await apiFetch(`/api/calls/user-agent/status/${data.session_id}/`);
          const stData = await stRes.json();
          if (stData.case_id) {
            clearInterval(interval);
            setSosMessage("Ambulance dispatched! Redirecting to live tracking...");
            setTimeout(() => {
              window.location.href = `/track/${stData.case_id}`;
            }, 1000);
          }
        } catch (e) {
          // ignore polling errors
        }
      }, 3000);

    } catch (err) {
      if (err.message?.includes("unverified")) {
        setSosMessage("❌ Twilio Error: Aapka phone number Twilio me verified nahi hai. Kripya apna verified phone number (e.g. jo Twilio me add kiya hai) form me dalein.");
      } else {
        setSosMessage(err.message || 'Failed to trigger emergency call.');
      }
      setSosLoading(false);
    }
  };

  const t = UI[lang];   // active language strings

  // ── Patient auto-fill on mount ────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("medgrid_access_token") ||
                  localStorage.getItem("access_token");
    if (!token) {
      setIsLoggedIn(false);
      return;
    }
    setIsLoggedIn(true);

    const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

    // Fetch profile + patient detail in parallel
    Promise.all([
      fetch(`${API}/api/auth/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : {}),
      fetch(`${API}/api/patients/me/`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : {}),
    ])
      .then(([profile, patient]) => {
        // Merge: patient record wins over auth profile for medical fields
        const merged = { ...profile, ...patient };

        const name       = merged.full_name || merged.name || "";
        const age        = merged.age  != null ? String(merged.age)  : "";
        const phone      = merged.phone || profile.phone || "";
        const gender     = merged.gender || "";
        // Chronic conditions → pre-fill "known conditions"
        const conditions = merged.chronic_conditions || merged.known_allergies || "";

        if (name || phone) {
          setFormData(prev => ({
            ...prev,
            patient_name:     name     || prev.patient_name,
            age:              age      || prev.age,
            phone:            phone    || prev.phone,
            gender:           gender   || prev.gender,
            known_conditions: conditions || prev.known_conditions,
          }));
          setPatientDisplayName(name || "Patient");
          setPatientAutoFilled(true);
        }
      })
      .catch(() => {
        // Silent fail — user can still fill form manually
      });
  }, []);

  // ── GPS detection ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        ()    => {
          setLocError(t.locWait);
          setLocation({ lat: 22.7196, lng: 75.8577 });
        }
      );
    } else {
      setLocation({ lat: 22.7196, lng: 75.8577 });
    }
  }, []);

  // ── Voice input ──────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setMicError(t.voiceNotSupported);
      return;
    }
    setMicError(null);

    // Stop any existing session
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang         = lang === "hi" ? "hi-IN" : "en-IN";
    recognition.continuous   = true;      // keep listening until user stops
    recognition.interimResults = true;    // show words as they come in

    let finalTranscript = formData.symptoms_text
      ? formData.symptoms_text.trim() + " "
      : "";

    recognition.onstart = () => setMicState("listening");

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      // Show combined in textarea in real time
      setFormData(prev => ({
        ...prev,
        symptoms_text: finalTranscript + interimTranscript,
      }));
    };

    recognition.onerror = (e) => {
      setMicState("idle");
      if (e.error === "not-allowed") {
        setMicError(lang === "hi"
          ? "माइक की अनुमति नहीं मिली। ब्राउज़र सेटिंग में माइक अनुमति दें।"
          : "Microphone access denied. Please allow microphone in browser settings."
        );
      } else if (e.error !== "aborted") {
        setMicError(lang === "hi" ? "माइक में समस्या आई।" : "Microphone error. Try again.");
      }
    };

    recognition.onend = () => {
      // Trim trailing space from final transcript
      setFormData(prev => ({
        ...prev,
        symptoms_text: prev.symptoms_text.trim(),
      }));
      setMicState("done");
      setTimeout(() => setMicState("idle"), 2500);
    };

    recognition.start();
  }, [lang, formData.symptoms_text, t.voiceNotSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ── Submit → unified AI pipeline ─────────────────────────────────────────
  const handleTriageSubmit = async (e) => {
    e.preventDefault();
    if (micState === "listening") stopListening();
    if (!formData.symptoms_text.trim() || formData.symptoms_text.trim().length < 8) {
      setError(lang === "hi"
        ? "कृपया लक्षणों को थोड़ा विस्तार से बताएं।"
        : "Please describe the symptoms in more detail."
      );
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const body = {
        symptoms:         formData.symptoms_text,
        age:              formData.age    ? parseInt(formData.age)  : undefined,
        gender:           formData.gender || undefined,
        known_conditions: formData.known_conditions || undefined,
        lat:              location?.lat,
        lng:              location?.lng,
        include_routing:  !!(location?.lat && location?.lng),
      };

      const res  = await apiFetch("/api/triage/unified-analyze/", {
        method: "POST",
        body:   JSON.stringify(body),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || (lang === "hi" ? "AI विश्लेषण विफल रहा।" : "AI analysis failed."));
        return;
      }

      setTriageResult(data.triage);
      setNeedsProfile(data.needs_profile);
      setHospitals(data.ranked_hospitals || []);
      setRoutingExp(data.routing_explanation || "");
      setStep(2);
    } catch (err) {
      setError(lang === "hi" ? "नेटवर्क त्रुटि।" : "Network error — could not connect.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewMap = () => setStep(3);

  const handleConfirm = async () => {
    if (!selectedHosp) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/triage/create-emergency/", {
        method: "POST",
        body: JSON.stringify({
          patient_name:     formData.patient_name,
          age:              formData.age    ? parseInt(formData.age) : null,
          phone:            formData.phone,
          gender:           formData.gender || null,
          symptoms_text:    formData.symptoms_text,
          known_conditions: formData.known_conditions || null,
          location_lat:     location?.lat,
          location_lng:     location?.lng,
          triage_result:    triageResult,
          needs_profile:    needsProfile,
          ranked_hospitals: hospitals,
          top_hospital_id:  selectedHosp.hospital_id,
          routing_explanation: routingExplanation,
        }),
      });
      const data = await res.json();
      if (data.success || data.case_id) {
        setCaseConfirmed(true);
        setCaseId(data.case_id);
        
        // Start dispatch tracking flow
        setDispatchStatus("SEARCHING");
        if (data.dispatch && data.dispatch.success) {
          setDispatchStatus("ASSIGNED"); // Will be overriden quickly by WS if needed
        }

        // Connect Patient WebSocket
        const API = import.meta.env.VITE_API_BASE?.replace('http', 'ws') || 'ws://localhost:8000';
        const wsUrl = `${API}/ws/triage/patient/${data.case_id}/`;
        patientWsRef.current = new WebSocket(wsUrl);
        patientWsRef.current.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'dispatch_assigned') {
            setDispatchStatus('EN_ROUTE');
            setDispatchData(msg);
          } else if (msg.type === 'driver_arrived') {
            setDispatchStatus('DRIVER_ARRIVED');
          } else if (msg.type === 'patient_picked_up') {
            setDispatchStatus('TO_HOSPITAL');
          }
        };
      } else {
        setError(lang === "hi" ? "केस बनाने में विफल" : "Failed to create case");
      }
    } catch (err) {
      console.error(err);
      setError(lang === "hi" ? "नेटवर्क त्रुटि" : "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (patientWsRef.current) patientWsRef.current.close();
    };
  }, []);

  const cfg = triageResult ? (SEVERITY_CONFIG[triageResult.p_level] || SEVERITY_CONFIG.P2) : null;

  // ── Mic button styles ─────────────────────────────────────────────────────
  const micBg = micState === "listening"
    ? "linear-gradient(135deg,#dc2626,#ef4444)"
    : micState === "done"
      ? "linear-gradient(135deg,#16a34a,#22c55e)"
      : "linear-gradient(135deg,#1B4332,#2D6A4F)";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f9f9f8 0%, #f0f4ff 100%)",
      padding: "24px 16px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>

      {/* ── Header ── */}
      <div style={{ maxWidth: 700, margin: "0 auto 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "linear-gradient(135deg, #E24B4A, #ff6b6b)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, boxShadow: "0 4px 14px rgba(226,75,74,0.35)",
          }}>🚨</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a18", margin: 0 }}>
              {lang === "hi" ? "आपातकालीन ट्राइएज" : "Emergency Triage"}
            </h1>
            <p style={{ fontSize: 13, color: "#73726c", margin: 0 }}>
              {lang === "hi" ? "AI पाइपलाइन — बोलें या टाइप करें" : "AI pipeline — speak or type in any language"}
            </p>
          </div>

          {/* Language toggle */}
          <div style={{
            marginLeft: "auto", display: "flex", gap: 0,
            border: "1.5px solid #e0dfd8", borderRadius: 10, overflow: "hidden",
          }}>
            {[["en", "EN"], ["hi", "हिं"]].map(([code, label]) => (
              <button key={code} onClick={() => setLang(code)} style={{
                padding: "7px 16px", border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 13,
                background: lang === code ? "#1B4332" : "#fff",
                color:      lang === code ? "#D8F3DC" : "#444",
                transition: "all .15s",
              }}>{label}</button>
            ))}
          </div>

          <a href="/" style={{ fontSize: 13, color: "#378ADD", textDecoration: "none", fontWeight: 500, marginLeft: 8 }}>
            ← {lang === "hi" ? "होम" : "Home"}
          </a>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: 8, marginTop: 20, alignItems: "center" }}>
          {(lang === "hi"
            ? ["लक्षण बताएं", "AI विश्लेषण", "अस्पताल मानचित्र"]
            : ["Describe Symptoms", "AI Analysis", "Hospital Map"]
          ).map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: step > i + 1 ? "#639922" : step === i + 1 ? "#E24B4A" : "#e5e4dc",
                color: step >= i + 1 ? "#fff" : "#888",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 600, transition: "all 0.3s ease",
              }}>{step > i + 1 ? "✓" : i + 1}</div>
              <span style={{ fontSize: 13, color: step === i + 1 ? "#E24B4A" : "#888", fontWeight: step === i + 1 ? 600 : 400 }}>
                {label}
              </span>
              {i < 2 && <span style={{ color: "#ccc", fontSize: 16 }}>›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ══════════ STEP 1: Intake Form ══════════ */}
      {step === 1 && (
        <form onSubmit={handleTriageSubmit} style={{ maxWidth: 700, margin: "0 auto" }}>
          
          {/* ── SOS PHONE CALL BUTTON ── */}
          <div style={{ marginBottom: 20 }}>
            <button type="button" onClick={handleSOSCall} disabled={sosLoading} style={{
              width: "100%", padding: "18px", borderRadius: 16,
              background: sosLoading ? "#fca5a5" : "linear-gradient(135deg, #dc2626, #b91c1c)",
              color: "#fff", border: "none", fontSize: 18, fontWeight: 800,
              cursor: sosLoading ? "wait" : "pointer",
              boxShadow: "0 8px 24px rgba(220, 38, 38, 0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12
            }}>
              {sosLoading ? "☎️ " + (lang === "hi" ? "कॉल कनेक्ट हो रहा है..." : "Connecting Call...") : "🚨 " + (lang === "hi" ? "आपातकालीन SOS कॉल (AI से बात करें)" : "Emergency SOS Call (Speak to AI)")}
            </button>
            {sosMessage && (
              <div style={{ marginTop: 12, padding: "12px", background: "#fef2f2", color: "#991b1b", borderRadius: 8, border: "1px solid #fecaca", textAlign: "center", fontWeight: 600 }}>
                {sosMessage}
              </div>
            )}
          </div>

          {/* ── Auto-fill banner (shown when patient is logged in) ── */}
          {patientAutoFilled && !autofillDismissed && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "linear-gradient(135deg, #d1fae5, #a7f3d0)",
              border: "1.5px solid #34d399",
              borderRadius: 14, padding: "12px 18px", marginBottom: 14,
              boxShadow: "0 2px 10px rgba(52,211,153,0.2)",
              animation: "fadeIn .4s ease",
            }}>
              <div style={{ fontSize: 24 }}>✅</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>
                  {lang === "hi"
                    ? `${patientDisplayName} — आपकी जानकारी अपने आप भर दी गई है`
                    : `Welcome back, ${patientDisplayName}! Your details have been auto-filled.`}
                </div>
                <div style={{ fontSize: 12, color: "#047857", marginTop: 2 }}>
                  {lang === "hi"
                    ? "नाम, आयु, फ़ोन और चिकित्सा इतिहास आपके खाते से लिया गया है। ज़रूरत हो तो बदल सकते हैं।"
                    : "Name, age, phone & medical history pulled from your account. Edit if needed."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutofillDismissed(true)}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#065f46", lineHeight: 1, padding: 4 }}
                title="Dismiss"
              >✕</button>
            </div>
          )}

          {/* ── Login nudge (shown when NOT logged in) ── */}
          {!isLoggedIn && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "#fffbeb", border: "1px solid #fcd34d",
              borderRadius: 14, padding: "10px 16px", marginBottom: 14,
              fontSize: 13,
            }}>
              <span style={{ fontSize: 20 }}>💡</span>
              <span style={{ color: "#78350f" }}>
                {lang === "hi"
                  ? "अगर आप पहले से लॉग इन हैं तो आपकी जानकारी अपने आप भरेगी। "
                  : "Logged-in patients get details auto-filled. "}
                <a href="/signin" style={{ color: "#92400e", fontWeight: 700, textDecoration: "underline" }}>
                  {lang === "hi" ? "अभी लॉग इन करें →" : "Sign in now →"}
                </a>
              </span>
            </div>
          )}

          {/* Patient info card */}
          <div style={cardStyle}>
            <h2 style={cardHeadStyle}>👤 {lang === "hi" ? "मरीज़ की जानकारी" : "Patient Information"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { name: "patient_name", label: t.nameLabel,  type: "text",   placeholder: lang === "hi" ? "पूरा नाम" : "Full name",          required: true  },
                { name: "age",          label: t.ageLbl,      type: "number", placeholder: lang === "hi" ? "आयु वर्ष में" : "Age in years",   required: false },
                { name: "phone",        label: t.phoneLbl,    type: "tel",    placeholder: "+91 98765 43210",                                   required: false },
              ].map(field => (
                <div key={field.name}>
                  <label style={labelStyle}>
                    {field.label} {field.required && <span style={{ color: "#E24B4A" }}>*</span>}
                  </label>
                  <input type={field.type} name={field.name} value={formData[field.name]}
                    onChange={handleChange} required={field.required} placeholder={field.placeholder}
                    style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={labelStyle}>{t.genderLbl}</label>
                <select name="gender" value={formData.gender} onChange={handleChange} style={inputStyle}>
                  {t.genderOpts.map((opt, i) => (
                    <option key={i} value={t.genderVals[i]}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>{t.knownLabel}</label>
              <input type="text" name="known_conditions" value={formData.known_conditions}
                onChange={handleChange} placeholder={t.knownPlaceholder} style={inputStyle} />
            </div>
          </div>

          {/* ── SYMPTOM INPUT CARD with Voice ── */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1a1a18" }}>
                🩺 {t.heading}
              </h2>
              <span style={{
                fontSize: 11, padding: "4px 12px", borderRadius: 20,
                background: "#dcfce7", color: "#1B4332", fontWeight: 700,
                border: "1px solid #86efac",
              }}>{t.aiBadge}</span>
            </div>

            {/* Quick-select chips */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
                {t.quickLabel}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {QUICK_SYMPTOMS[lang].map(s => (
                  <button key={s} type="button"
                    onClick={() => setFormData(prev => ({ ...prev, symptoms_text: s }))}
                    style={{
                      fontSize: 12, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                      border: `1.5px solid ${formData.symptoms_text === s ? "#E24B4A" : "#e0dfd8"}`,
                      background: formData.symptoms_text === s ? "#fef2f2" : "#fff",
                      color: formData.symptoms_text === s ? "#9b1c1c" : "#374151",
                      fontWeight: formData.symptoms_text === s ? 700 : 500,
                      transition: "all .15s",
                    }}>{s}</button>
                ))}
              </div>
            </div>

            {/* Textarea + Mic button row */}
            <div style={{ position: "relative", marginBottom: 8 }}>
              <textarea
                name="symptoms_text"
                value={formData.symptoms_text}
                onChange={handleChange}
                required rows={5}
                placeholder={t.placeholder}
                style={{
                  ...inputStyle,
                  resize: "vertical", minHeight: 115,
                  fontFamily: "inherit", lineHeight: 1.65, fontSize: 14,
                  paddingRight: 56,   // room for mic button
                }}
              />

              {/* ── Mic button (absolute, inside textarea) ── */}
              {SpeechRecognition && (
                <button
                  type="button"
                  onClick={micState === "listening" ? stopListening : startListening}
                  title={micState === "listening"
                    ? (lang === "hi" ? "रोकें" : "Stop recording")
                    : (lang === "hi" ? "बोलकर लक्षण बताएं" : "Speak symptoms")}
                  style={{
                    position: "absolute", top: 10, right: 10,
                    width: 38, height: 38, borderRadius: "50%",
                    background: micBg,
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: micState === "listening"
                      ? "0 0 0 5px rgba(220,38,38,0.2)"
                      : "0 2px 8px rgba(27,67,50,0.25)",
                    transition: "all .2s",
                    animation: micState === "listening" ? "micPulse 1.2s infinite" : "none",
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {micState === "listening" ? "⏹" : micState === "done" ? "✓" : "🎙️"}
                </button>
              )}
            </div>

            {/* Mic status hint */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {micState === "listening" ? (
                <p style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#dc2626", animation: "micPulse 1.2s infinite" }} />
                  {t.micListening}
                </p>
              ) : micState === "done" ? (
                <p style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, margin: 0 }}>{t.micDone}</p>
              ) : (
                SpeechRecognition && (
                  <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                    {t.micHint} <span style={{ opacity: 0.6 }}>({lang === "hi" ? "हिंदी में बोल सकते हैं" : "English or Hindi accepted"})</span>
                  </p>
                )
              )}
            </div>

            {micError && (
              <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8, padding: "6px 10px", background: "#fef2f2", borderRadius: 8 }}>
                {micError}
              </div>
            )}

            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4, marginBottom: 0 }}>
              {t.tapHint}
            </p>
          </div>

          {/* Location status */}
          <div style={{
            padding: "10px 16px", borderRadius: 10, marginBottom: 14,
            background: location ? "#EAF3DE" : "#F1EFE8",
            fontSize: 13, color: location ? "#3B6D11" : "#5F5E5A",
            border: `1px solid ${location ? "#c3e0a8" : "#e0dfd8"}`,
          }}>
            {location
              ? t.locDetected(location.lat.toFixed(4), location.lng.toFixed(4))
              : locError || t.locWait}
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 12, background: "#fef2f2", color: "#991b1b", fontSize: 13, border: "1px solid #fca5a5" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit button */}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "16px", borderRadius: 12,
            background: loading ? "#ccc" : "linear-gradient(135deg, #E24B4A, #ff6b6b)",
            color: "#fff", border: "none", fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading ? "none" : "0 4px 14px rgba(226,75,74,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "all 0.2s",
          }}>
            {loading ? (
              <>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,.35)", borderTopColor: "#fff", animation: "spin .7s linear infinite" }} />
                {t.analyzing}
              </>
            ) : t.analyzeBtn}
          </button>
        </form>
      )}

      {/* ══════════ STEP 2: AI Results ══════════ */}
      {step === 2 && triageResult && cfg && (
        <div style={{ maxWidth: 700, margin: "0 auto" }}>

          {/* Severity card */}
          <div style={{
            background: cfg.bg, border: `2px solid ${cfg.border}`,
            borderRadius: 20, padding: "28px 32px", marginBottom: 14, textAlign: "center",
            boxShadow: `0 8px 32px ${cfg.border}22`, animation: "fadeIn .4s ease",
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{cfg.icon}</div>
            <div style={{ display: "inline-block", padding: "6px 22px", background: cfg.badge, color: "#fff", borderRadius: 24, fontSize: 14, fontWeight: 700, marginBottom: 14, letterSpacing: ".03em" }}>
              {cfg.label}
            </div>
            <p style={{ fontSize: 14, color: cfg.text, margin: "0 0 10px", lineHeight: 1.7, fontWeight: 500, textAlign: "left" }}>
              {triageResult.reasoning}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
              <span style={{ fontSize: 11, padding: "3px 12px", borderRadius: 20, background: "rgba(0,0,0,0.07)", color: cfg.text, fontWeight: 600 }}>
                {lang === "hi" ? "AI विश्वास:" : "AI Confidence:"} {triageResult.confidence}
              </span>
              {triageResult.was_escalated && (
                <span style={{ fontSize: 11, padding: "3px 12px", borderRadius: 20, background: "#fff", color: "#854F0B", border: "1px solid #EF9F27", fontWeight: 700 }}>
                  ⚡ {lang === "hi" ? "सुरक्षा के लिए स्तर बढ़ाया" : "Escalated for safety"}
                </span>
              )}
              <span style={{ fontSize: 11, padding: "3px 12px", borderRadius: 20, background: "rgba(0,0,0,0.07)", color: cfg.text, fontWeight: 600 }}>
                🏥 {triageResult.doctor_category}
              </span>
            </div>
          </div>

          {/* Red flags */}
          {triageResult.red_flags?.length > 0 && (
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 14, padding: "14px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#78350f", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>
                ⚠️ {lang === "hi" ? "गंभीर संकेत मिले" : "Clinical Red Flags Detected"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {triageResult.red_flags.map(f => (
                  <span key={f} style={{ fontSize: 12, padding: "4px 11px", borderRadius: 20, background: "#fff", color: "#92400e", border: "1px solid #fcd34d", fontWeight: 600 }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Needs profile */}
          {needsProfile && (
            <div style={{ ...cardStyle, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>
                🧾 {lang === "hi" ? "आवश्यक संसाधन" : "Care Resource Requirements"}
              </div>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: "0 0 10px" }}>
                {needsProfile.profile_reasoning}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {needsProfile.required_bed_type && (
                  <span style={tagStyle("#E6F1FB", "#185FA5")}>🛏 {needsProfile.required_bed_type.toUpperCase()}</span>
                )}
                {needsProfile.time_sensitivity_minutes && (
                  <span style={tagStyle("#FAEEDA", "#854F0B")}>⏱ {needsProfile.time_sensitivity_minutes} min</span>
                )}
                {needsProfile.requires_ventilator && <span style={tagStyle("#FCEBEB", "#A32D2D")}>💨 Ventilator</span>}
                {needsProfile.requires_blood_bank  && <span style={tagStyle("#FCEBEB", "#A32D2D")}>🩸 Blood Bank</span>}
                {needsProfile.requires_pediatric   && <span style={tagStyle("#EAF3DE", "#3B6D11")}>👶 Pediatric</span>}
                {needsProfile.required_services?.map(s => (
                  <span key={s} style={tagStyle("#f5f3ff", "#5b21b6")}>📋 {s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Top hospital */}
          {hospitals.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>
                🏆 {lang === "hi" ? "सबसे उपयुक्त अस्पताल" : "Top Recommended Hospital"}
              </div>
              {(() => {
                const h = hospitals[0];
                const cap = h.capability_match || {};
                return (
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{h.name}</div>
                    <div style={{ fontSize: 13, color: "#73726c", marginBottom: 10 }}>{h.area}, {h.city}</div>
                    {routingExplanation && (
                      <div style={{ background: "#f8f7f5", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#374151", lineHeight: 1.6, borderLeft: "3px solid #378ADD" }}>
                        {routingExplanation}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={tagStyle("#E6F1FB", "#185FA5")}>📍 {h.distance_km} km</span>
                      <span style={tagStyle("#E6F1FB", "#185FA5")}>🚑 ~{h.travel_minutes} min</span>
                      <span style={tagStyle("#EAF3DE", "#3B6D11")}>🛏 {h.available_beds} beds</span>
                      <span style={tagStyle(cap.match_score >= 0.8 ? "#EAF3DE" : "#FAEEDA", cap.match_score >= 0.8 ? "#3B6D11" : "#854F0B")}>
                        🎯 {Math.round((cap.match_score || 0) * 100)}% match
                      </span>
                    </div>
                    {cap.required_services_available?.length > 0 && (
                      <div style={{ fontSize: 12, color: "#3B6D11", marginBottom: 3 }}>
                        ✅ {lang === "hi" ? "उपलब्ध:" : "Available:"} {cap.required_services_available.join(", ")}
                      </div>
                    )}
                    {cap.required_services_missing?.length > 0 && (
                      <div style={{ fontSize: 12, color: "#A32D2D", fontWeight: 600 }}>
                        ⚠️ {lang === "hi" ? "अनुपलब्ध:" : "Not confirmed:"} {cap.required_services_missing.join(", ")}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            {hospitals.length > 0 && (
              <button onClick={handleViewMap} style={{
                flex: 2, padding: "13px", borderRadius: 12,
                background: "linear-gradient(135deg, #185FA5, #378ADD)", color: "#fff",
                border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
                boxShadow: "0 4px 14px rgba(24,95,165,0.3)",
              }}>
                🗺️ {lang === "hi" ? "सभी अस्पताल मानचित्र पर देखें →" : "View All Hospitals on Map →"}
              </button>
            )}
            <button onClick={() => setStep(1)} style={{
              flex: 1, padding: "13px", borderRadius: 12,
              background: "#f1efea", color: "#444", border: "1px solid #d3d1c7", fontSize: 14, cursor: "pointer",
            }}>
              ← {lang === "hi" ? "वापस" : "Back"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════ STEP 3: Map ══════════ */}
      {step === 3 && location && (
        <div style={{ maxWidth: 1020, margin: "0 auto" }}>
          {caseConfirmed && (
            <div style={{ background: "#EAF3DE", border: "1px solid #639922", borderRadius: 12, padding: "12px 20px", marginBottom: 16, color: "#3B6D11", fontWeight: 500, fontSize: 14 }}>
              ✅ {lang === "hi"
                ? `आपातकालीन केस ${caseId} सेव हो गया। चिकित्सा टीम को सूचित किया गया।`
                : `Emergency case ${caseId} submitted. Medical team notified via dashboard.`}
            </div>
          )}

          {/* ── LIVE DISPATCH TRACKING PANEL ── */}
          {caseConfirmed && dispatchStatus && (
            <div style={{ background: "#fff", border: "2px solid #E24B4A", borderRadius: 16, padding: "20px", marginBottom: 20, boxShadow: "0 8px 24px rgba(226,75,74,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1a1a18", display: "flex", alignItems: "center", gap: 8 }}>
                  🚑 Live Ambulance Dispatch
                </h3>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: dispatchStatus === 'SEARCHING' ? '#fef3c7' : dispatchStatus === 'ASSIGNED' || dispatchStatus === 'EN_ROUTE' ? '#dbeafe' : '#dcfce7', color: dispatchStatus === 'SEARCHING' ? '#92400e' : dispatchStatus === 'ASSIGNED' || dispatchStatus === 'EN_ROUTE' ? '#1e40af' : '#166534' }}>
                  {dispatchStatus === 'SEARCHING' ? 'SEARCHING FOR DRIVER...' : 
                   dispatchStatus === 'ASSIGNED' ? 'DRIVER ASSIGNED' :
                   dispatchStatus === 'EN_ROUTE' ? 'AMBULANCE ON THE WAY' :
                   dispatchStatus === 'DRIVER_ARRIVED' ? 'AMBULANCE ARRIVED' :
                   dispatchStatus === 'TO_HOSPITAL' ? 'HEADING TO HOSPITAL' : dispatchStatus}
                </span>
              </div>
              
              {dispatchStatus === 'SEARCHING' && (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ display: "inline-block", width: 40, height: 40, border: "4px solid #f3f3f3", borderTopColor: "#E24B4A", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 12 }}></div>
                  <p style={{ margin: 0, color: "#555", fontWeight: 500 }}>Locating the nearest available ambulance for you...</p>
                </div>
              )}

              {dispatchData && (dispatchStatus === 'EN_ROUTE' || dispatchStatus === 'DRIVER_ARRIVED' || dispatchStatus === 'TO_HOSPITAL') && (
                <div style={{ background: "#f8fafc", borderRadius: 12, padding: "16px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Driver Name</p>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{dispatchData.driver_name || 'Driver'}</p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Vehicle No.</p>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{dispatchData.vehicle_number || 'AMB-XYZ'}</p>
                    </div>
                  </div>
                  {dispatchStatus === 'EN_ROUTE' && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
                      <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Estimated Time of Arrival</p>
                      <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#2563eb" }}>{dispatchData.eta_minutes || 0} min</p>
                    </div>
                  )}
                  {dispatchStatus === 'DRIVER_ARRIVED' && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#16a34a", animation: "pulse 2s infinite" }}>🚨 The ambulance is waiting outside!</p>
                    </div>
                  )}
                  {dispatchStatus === 'TO_HOSPITAL' && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>🏥 Patient Picked Up — Routing to {selectedHosp.name}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: 300, borderRadius: 16, overflow: "hidden", height: 540, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
              <MapContainer center={[location.lat, location.lng]} zoom={13} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[location.lat, location.lng]}>
                  <Popup><strong>📍 {lang === "hi" ? "मरीज़ का स्थान" : "Patient location"}</strong></Popup>
                </Marker>
                {hospitals.map(h => (
                  <Marker key={h.hospital_id} position={[h.latitude, h.longitude]}
                    eventHandlers={{ click: () => setSelectedHosp(h) }}>
                    <Popup>
                      <strong>🏥 {h.name}</strong><br />
                      {h.distance_km}km · {h.travel_minutes}min ETA<br />
                      {h.available_beds} beds · {Math.round((h.capability_match?.match_score || 0) * 100)}% match
                    </Popup>
                  </Marker>
                ))}
                {hospitals.length > 0 && (
                  <Polyline positions={[[location.lat, location.lng], [hospitals[0].latitude, hospitals[0].longitude]]}
                    color="#E24B4A" dashArray="8,8" weight={3} />
                )}
              </MapContainer>
            </div>

            <div style={{ flex: 1, minWidth: 280, maxHeight: 540, overflowY: "auto" }}>
              <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: "#1a1a18" }}>
                🏥 {lang === "hi" ? `नज़दीकी अस्पताल (${hospitals.length})` : `Ranked Hospitals (${hospitals.length})`}
              </div>
              {hospitals.map((h, i) => {
                const cap = h.capability_match || {};
                const isSelected = selectedHosp?.hospital_id === h.hospital_id;
                return (
                  <div key={h.hospital_id} onClick={() => setSelectedHosp(h)}
                    style={{
                      background: isSelected ? "#E6F1FB" : "#fff",
                      border: `1.5px solid ${isSelected ? "#378ADD" : "#e5e4dc"}`,
                      borderRadius: 12, padding: 14, marginBottom: 10, cursor: "pointer",
                      transition: "all 0.2s", boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{h.name}</span>
                      {i === 0 && (
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#EAF3DE", color: "#3B6D11", fontWeight: 600 }}>
                          ⭐ {lang === "hi" ? "सर्वश्रेष्ठ" : "Best"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#73726c", marginBottom: 6 }}>
                      📍 {h.distance_km}km · 🚑 {h.travel_minutes}min · 🛏 {h.available_beds} beds
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>
                        {lang === "hi" ? "क्षमता मिलान:" : "Capability match:"} {Math.round((cap.match_score || 0) * 100)}%
                      </div>
                      <div style={{ background: "#e5e4dc", borderRadius: 6, height: 6, overflow: "hidden" }}>
                        <div style={{ width: `${(cap.match_score || 0) * 100}%`, height: "100%", background: cap.match_score >= 0.8 ? "#639922" : cap.match_score >= 0.5 ? "#EF9F27" : "#E24B4A", borderRadius: 6 }} />
                      </div>
                    </div>
                    {cap.required_services_missing?.length > 0 && (
                      <div style={{ fontSize: 11, color: "#A32D2D", fontWeight: 600 }}>
                        ⚠️ Missing: {cap.required_services_missing.join(", ")}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                      AI Score: {(h.composite_score * 100).toFixed(0)}%
                    </div>
                  </div>
                );
              })}

              {!caseConfirmed && (
                <button onClick={handleConfirm} disabled={loading} style={{
                  width: "100%", marginTop: 10, padding: "13px", borderRadius: 12,
                  background: loading ? "#ccc" : "linear-gradient(135deg, #E24B4A, #ff6b6b)",
                  color: "#fff", border: "none", fontSize: 14, fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 14px rgba(226,75,74,0.35)",
                }}>
                  {loading ? (lang === "hi" ? "⏳ सेव हो रहा है..." : "⏳ Saving...") :
                    (lang === "hi" ? "🚨 आपातकालीन केस दर्ज करें" : "🚨 Confirm & Save Emergency Case")}
                </button>
              )}
              <button onClick={() => setStep(2)} style={{
                width: "100%", marginTop: 8, padding: "10px", borderRadius: 12,
                background: "#f1efea", color: "#444", border: "1px solid #d3d1c7", fontSize: 13, cursor: "pointer",
              }}>
                ← {lang === "hi" ? "विश्लेषण पर वापस" : "Back to Analysis"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn   { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes micPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); } 50% { box-shadow: 0 0 0 8px rgba(220,38,38,0); } }
        input:focus, select:focus, textarea:focus { border-color: #378ADD !important; box-shadow: 0 0 0 3px rgba(55,138,221,0.1); }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────
const cardStyle = {
  background: "#fff", borderRadius: 16,
  border: "1px solid #e5e4dc", padding: 24,
  marginBottom: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
};
const cardHeadStyle = {
  fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 16, color: "#1a1a18",
};
const labelStyle = { fontSize: 12, color: "#555", display: "block", marginBottom: 4, fontWeight: 500 };
const inputStyle = {
  width: "100%", padding: "10px 13px", borderRadius: 10,
  border: "1.5px solid #e0dfd8", fontSize: 13, color: "#1a1a18",
  background: "#fafaf8", outline: "none", fontFamily: "inherit",
  transition: "border-color 0.2s",
};
const tagStyle = (bg, color) => ({
  fontSize: 12, padding: "4px 11px", borderRadius: 20,
  background: bg, color, fontWeight: 600, border: `1px solid ${color}30`,
});
