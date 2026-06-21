// frontend/hospital/src/pages/TriagePage.jsx
import { useState } from "react";
import SymptomAnalyzer from "../components/SymptomAnalyzer";

const P_LEVEL_COLORS = {
  P1: { bg: "#dc2626", text: "Critical — Call Emergency Now" },
  P2: { bg: "#d97706", text: "Urgent — Go to Hospital Immediately" },
  P3: { bg: "#2563eb", text: "Moderate — Visit Today" },
  P4: { bg: "#16a34a", text: "Low — Schedule an Appointment" },
};

export default function TriagePage() {
  const [lastResult, setLastResult] = useState(null);

  const handleResult = (result) => {
    setLastResult(result);
    // Optionally: store to session, navigate to hospital search, etc.
    console.log("Triage result:", result);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f4", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,700&display=swap');
        @keyframes fadeInDown { from{opacity:0;transform:translateY(-10px);} to{opacity:1;transform:translateY(0);} }
      `}</style>

      {/* ── Header bar ── */}
      <header style={{ background: "linear-gradient(135deg,#1B4332,#2D6A4F)", padding: "0 28px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 20px rgba(27,67,50,.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏥</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#D8F3DC", fontFamily: "Playfair Display,serif", fontStyle: "italic" }}>AI Triage</div>
            <div style={{ fontSize: 11, color: "rgba(216,243,220,.55)", fontWeight: 500 }}>SANJIVNI · Symptom Analysis</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/patient-portal" style={{ padding: "7px 16px", borderRadius: 20, border: "1px solid rgba(255,255,255,.25)", background: "transparent", color: "#D8F3DC", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>← Patient Portal</a>
          <a href="/emergency" style={{ padding: "7px 16px", borderRadius: 20, border: "none", background: "#dc2626", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>🚨 Emergency</a>
        </div>
      </header>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "36px 20px" }}>

        {/* Page header */}
        <div style={{ textAlign: "center", marginBottom: 28, animation: "fadeInDown .4s ease" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 14px", background: "#dcfce7", borderRadius: 20, border: "1px solid #86efac", fontSize: 11, fontWeight: 700, color: "#1B4332", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 14 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "pulse 2s infinite" }} />
            Powered by Groq AI
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1B4332", margin: "0 0 8px", fontFamily: "Playfair Display,serif", fontStyle: "italic", lineHeight: 1.2 }}>
            AI Symptom Analysis
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0, fontWeight: 500, lineHeight: 1.6 }}>
            Describe your symptoms and get instant AI triage assessment — severity level, doctor category, and recommended action.
          </p>
        </div>

        {/* Last result strip (when a result was received) */}
        {lastResult && (
          <div style={{
            background: P_LEVEL_COLORS[lastResult.p_level]?.bg || "#1B4332",
            borderRadius: 14, padding: "10px 18px", marginBottom: 16,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            animation: "fadeInDown .3s ease",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              Last result: {lastResult.p_level} · {P_LEVEL_COLORS[lastResult.p_level]?.text}
            </div>
            <button onClick={() => setLastResult(null)} style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: 8, padding: "3px 10px", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>×</button>
          </div>
        )}

        {/* Analyzer card */}
        <div style={{
          background: "#fff", borderRadius: 20,
          border: "1px solid #e5e4dc", padding: "28px",
          boxShadow: "0 4px 20px rgba(0,0,0,.07)",
        }}>
          <SymptomAnalyzer onResult={handleResult} />
        </div>

        {/* Info cards below */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
          {[
            { icon: "🚨", title: "P1 Critical", desc: "Life-threatening — call emergency immediately", color: "#fee2e2", border: "#fca5a5", tc: "#991b1b" },
            { icon: "⚠️", title: "P2 Urgent", desc: "Serious — needs hospital within 1 hour", color: "#fef3c7", border: "#fcd34d", tc: "#78350f" },
            { icon: "🔵", title: "P3 Moderate", desc: "Stable — visit hospital within 4 hours", color: "#dbeafe", border: "#93c5fd", tc: "#1e3a8a" },
            { icon: "🟢", title: "P4 Low", desc: "Non-urgent — schedule an appointment", color: "#dcfce7", border: "#86efac", tc: "#14532d" },
          ].map((card) => (
            <div key={card.title} style={{ background: card.color, borderRadius: 14, padding: "14px 16px", border: `1px solid ${card.border}` }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{card.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: card.tc, marginBottom: 3 }}>{card.title}</div>
              <div style={{ fontSize: 11, color: card.tc, opacity: 0.8, lineHeight: 1.4 }}>{card.desc}</div>
            </div>
          ))}
        </div>

        {/* Bottom disclaimer */}
        <div style={{ textAlign: "center", marginTop: 24, padding: "14px 20px", background: "#fff", borderRadius: 14, border: "1px solid #e5e4dc" }}>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
            <strong style={{ color: "#374151" }}>⚠️ Important:</strong> This AI tool provides triage guidance only. It does not replace a real medical diagnosis. In case of a life-threatening emergency, call <strong style={{ color: "#dc2626" }}>112</strong> immediately.
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );
}
