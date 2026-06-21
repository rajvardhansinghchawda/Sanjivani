// frontend/hospital/src/components/SymptomAnalyzer.jsx
import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const SEVERITY_CONFIG = {
  P1: {
    label: "Critical",
    color: "#dc2626",
    bg: "linear-gradient(135deg,#fef2f2,#fee2e2)",
    border: "#fca5a5",
    badgeBg: "#dc2626",
    icon: "🚨",
    actionColor: "#7f1d1d",
    ringColor: "rgba(220,38,38,0.15)",
  },
  P2: {
    label: "Urgent",
    color: "#d97706",
    bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
    border: "#fcd34d",
    badgeBg: "#d97706",
    icon: "⚠️",
    actionColor: "#78350f",
    ringColor: "rgba(217,119,6,0.15)",
  },
  P3: {
    label: "Moderate",
    color: "#2563eb",
    bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
    border: "#93c5fd",
    badgeBg: "#2563eb",
    icon: "🔵",
    actionColor: "#1e3a8a",
    ringColor: "rgba(37,99,235,0.12)",
  },
  P4: {
    label: "Low Priority",
    color: "#16a34a",
    bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
    border: "#86efac",
    badgeBg: "#16a34a",
    icon: "🟢",
    actionColor: "#14532d",
    ringColor: "rgba(22,163,74,0.12)",
  },
};

const QUICK_SYMPTOMS = [
  "Chest pain and shortness of breath",
  "Severe headache and dizziness",
  "High fever and body ache",
  "Abdominal pain and vomiting",
  "Difficulty breathing",
  "Unconscious or unresponsive",
  "Knee pain after fall",
  "Child with high fever",
];

export default function SymptomAnalyzer({ onResult }) {
  const [symptoms, setSymptoms] = useState("");
  const [age,      setAge]      = useState("");
  const [gender,   setGender]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);

  const handleAnalyze = async () => {
    if (!symptoms.trim() || symptoms.trim().length < 5) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/triage/analyze/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms,
          age:    age    ? parseInt(age)  : undefined,
          gender: gender || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResult(data.result);
        onResult?.(data.result);
      } else {
        setError(data.error || "Analysis failed. Please try again.");
      }
    } catch {
      setError("Could not connect to AI server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setSymptoms("");
    setAge("");
    setGender("");
    setError(null);
  };

  const cfg = result ? (SEVERITY_CONFIG[result.p_level] || SEVERITY_CONFIG.P4) : null;

  // ═══════════════ INPUT FORM ═══════════════
  if (!result) {
    return (
      <div style={{ fontFamily: "inherit" }}>
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200px 0; }
            100% { background-position: calc(200px + 100%) 0; }
          }
          @keyframes triageSpin { to { transform: rotate(360deg); } }
          @keyframes fadeInUp {
            from { opacity:0; transform:translateY(8px); }
            to   { opacity:1; transform:translateY(0); }
          }
          .symptom-chip:hover { background:#dbeafe!important; color:#1e40af!important; border-color:#93c5fd!important; }
          .analyze-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
          .analyze-btn:active:not(:disabled) { transform: translateY(0); }
          .symptom-textarea:focus { border-color:#2563eb!important; box-shadow:0 0 0 3px rgba(37,99,235,0.1)!important; }
        `}</style>

        {/* Quick chips */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
            Quick select a symptom
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {QUICK_SYMPTOMS.map((s) => (
              <button
                key={s}
                className="symptom-chip"
                onClick={() => setSymptoms(s)}
                style={{
                  fontSize: 12, padding: "5px 11px", borderRadius: 20,
                  border: `1.5px solid ${symptoms === s ? "#93c5fd" : "#e0dfd8"}`,
                  background: symptoms === s ? "#dbeafe" : "#fff",
                  color: symptoms === s ? "#1e40af" : "#374151",
                  cursor: "pointer", fontWeight: symptoms === s ? 700 : 500,
                  transition: "all .15s",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          className="symptom-textarea"
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder="Describe symptoms in detail... e.g. 'Severe chest pain for 20 minutes, sweating, pain going to left arm, feeling nauseous'"
          rows={5}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12,
            border: "1.5px solid #e0dfd8", fontSize: 14, resize: "vertical",
            fontFamily: "inherit", color: "#111827", background: "#fafaf8",
            boxSizing: "border-box", marginBottom: 12, outline: "none",
            lineHeight: 1.6, transition: "border-color .2s, box-shadow .2s",
          }}
        />

        {/* Age + Gender row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Age (optional)"
            min={1} max={120}
            style={{
              flex: 1, padding: "9px 12px", borderRadius: 10,
              border: "1.5px solid #e0dfd8", fontSize: 13, color: "#111827",
              background: "#fafaf8", outline: "none", fontFamily: "inherit",
            }}
          />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            style={{
              flex: 1, padding: "9px 12px", borderRadius: 10,
              border: "1.5px solid #e0dfd8", fontSize: 13,
              color: gender ? "#111827" : "#9ca3af", background: "#fafaf8",
              outline: "none", fontFamily: "inherit", cursor: "pointer",
            }}
          >
            <option value="">Gender (optional)</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 12,
            background: "#fef2f2", color: "#991b1b", fontSize: 13,
            border: "1px solid #fca5a5", fontWeight: 500,
            animation: "fadeInUp .2s ease",
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Analyze button */}
        <button
          className="analyze-btn"
          onClick={handleAnalyze}
          disabled={loading || symptoms.trim().length < 5}
          style={{
            width: "100%", padding: "14px", borderRadius: 12,
            background: loading || symptoms.trim().length < 5
              ? "#e5e7eb"
              : "linear-gradient(135deg,#1B4332,#2D6A4F)",
            color: loading || symptoms.trim().length < 5 ? "#9ca3af" : "#fff",
            border: "none", fontSize: 15, fontWeight: 700,
            cursor: loading || symptoms.trim().length < 5 ? "not-allowed" : "pointer",
            transition: "all .2s", letterSpacing: ".02em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {loading ? (
            <>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", animation: "triageSpin .7s linear infinite" }} />
              Analyzing symptoms…
            </>
          ) : (
            <>🔍 Analyze Symptoms</>
          )}
        </button>

        {loading && (
          <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280", marginTop: 10, animation: "fadeInUp .3s ease" }}>
            AI is evaluating severity, recommended department, and immediate actions…
          </p>
        )}
      </div>
    );
  }

  // ═══════════════ RESULT VIEW ═══════════════
  return (
    <div style={{ fontFamily: "inherit", animation: "fadeInUp .35s ease" }}>

      {/* Severity header */}
      <div style={{
        background: cfg.bg,
        border: `2px solid ${cfg.border}`,
        borderRadius: 16, padding: "22px 24px",
        marginBottom: 14, textAlign: "center",
        boxShadow: `0 0 0 6px ${cfg.ringColor}`,
      }}>
        <div style={{ fontSize: 48, marginBottom: 8, lineHeight: 1 }}>{cfg.icon}</div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 20px", background: cfg.badgeBg, color: "#fff",
          borderRadius: 24, fontSize: 14, fontWeight: 800, marginBottom: 12,
          letterSpacing: ".03em",
        }}>
          {result.p_level} — {result.severity_label}
        </div>
        <p style={{ fontSize: 14, color: cfg.actionColor, margin: "0 0 6px", lineHeight: 1.6, fontWeight: 500 }}>
          {result.reasoning}
        </p>
        {result.confidence && (
          <span style={{ fontSize: 11, color: cfg.actionColor, opacity: 0.65, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
            AI Confidence: {result.confidence}
          </span>
        )}
      </div>

      {/* Info grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {/* Department */}
        <div style={{ background: "#fff", border: "1px solid #e5e4dc", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Department</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1B4332" }}>🏥 {result.doctor_category}</div>
        </div>
        {/* Ambulance */}
        <div style={{
          background: result.requires_ambulance ? "#fef2f2" : "#f0fdf4",
          border: `1px solid ${result.requires_ambulance ? "#fca5a5" : "#86efac"}`,
          borderRadius: 12, padding: "14px 16px",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Ambulance</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: result.requires_ambulance ? "#991b1b" : "#14532d" }}>
            {result.requires_ambulance ? "🚑 Required" : "✓ Not needed"}
          </div>
        </div>
      </div>

      {/* ICU badge (only if needed) */}
      {result.requires_icu && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "12px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>💊</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em" }}>ICU Required</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#991b1b" }}>This patient may require intensive care unit admission</div>
          </div>
        </div>
      )}

      {/* Recommended action */}
      <div style={{ background: "#fff", border: "1px solid #e5e4dc", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Recommended Action</div>
        <div style={{ fontSize: 14, color: "#111827", lineHeight: 1.6, fontWeight: 500 }}>
          ⚡ {result.recommended_action}
        </div>
      </div>

      {/* Possible conditions */}
      {result.possible_conditions?.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e4dc", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Possible Conditions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {result.possible_conditions.map((c) => (
              <span key={c} style={{ fontSize: 12, padding: "4px 11px", borderRadius: 20, background: "#f1efea", color: "#374141", fontWeight: 600, border: "1px solid #e0dfd8" }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Red flags */}
      {result.red_flags?.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#78350f", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>⚠️ Red Flags Detected</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {result.red_flags.map((f) => (
              <span key={f} style={{ fontSize: 12, padding: "4px 11px", borderRadius: 20, background: "#fff", color: "#92400e", border: "1px solid #fcd34d", fontWeight: 600 }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleReset}
          style={{
            flex: 1, padding: "12px", borderRadius: 12, background: "#f1efea",
            color: "#374151", border: "1px solid #e0dfd8", fontSize: 14,
            fontWeight: 600, cursor: "pointer", transition: "all .15s",
          }}
        >
          ← Analyze Again
        </button>
        <a
          href="/search"
          style={{
            flex: 2, padding: "12px", borderRadius: 12,
            background: `linear-gradient(135deg,${cfg.badgeBg},${cfg.color})`,
            color: "#fff", border: "none", fontSize: 14, fontWeight: 700,
            cursor: "pointer", textAlign: "center", textDecoration: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .2s",
          }}
        >
          Find Nearby Hospital →
        </a>
      </div>

      {/* Disclaimer */}
      <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
        ⚠️ This is AI-assisted triage, not a medical diagnosis. Always consult a qualified doctor.
      </p>
    </div>
  );
}
