// frontend/hospital/src/pages/TriageDashboard.jsx
// UPDATED: Now shows AI reasoning text, hospital routing explanation,
// capability match scores, and outcome recording (learner loop).

import { useState, useEffect, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const SEVERITY_CONFIG = {
  P1: { label: "Critical", color: "#E24B4A", bg: "#FCEBEB", icon: "🚨" },
  P2: { label: "Urgent",   color: "#EF9F27", bg: "#FAEEDA", icon: "⚠️" },
  P3: { label: "Moderate", color: "#378ADD", bg: "#E6F1FB", icon: "🔵" },
  P4: { label: "Low",      color: "#639922", bg: "#EAF3DE", icon: "🟢" },
};

const WS_HOST = window.location.host.replace("5173", "8000").replace("3000", "8000");

export default function TriageDashboard() {
  const [cases, setCases]           = useState([]);
  const [wsStatus, setWsStatus]     = useState("connecting");
  const [stats, setStats]           = useState({ P1: 0, P2: 0, P3: 0, P4: 0 });
  const [filter, setFilter]         = useState("ALL");
  const [expandedCase, setExpanded] = useState(null);  // case_id of detail-expanded row
  const [outcomeModal, setOutcome]  = useState(null);  // case for outcome recording
  const [outcomeForm, setOutcomeForm] = useState({ actual_p_level: "", outcome_notes: "" });
  const [outcomeLoading, setOutcomeLoading] = useState(false);
  const [incomingAlert, setIncomingAlert] = useState(null);
  const [ambulanceAlert, setAmbulanceAlert] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    
    fetch(`${API_BASE}/api/triage/cases/`)
      .then(res => res.json())
      .then(data => {
        let items = data.results ? data.results : (Array.isArray(data) ? data : []);
        items = items.map(c => ({
          ...c,
          received_at: c.created_at,
          age: c.patient_age,
          doctor_category: c.ai_doctor_category,
          recommended_hospital: c.recommended_hospitals || [],
          severity: {
            p_level: c.ai_p_level,
            confidence: c.ai_confidence,
            was_escalated: c.ai_was_escalated,
            label: c.ai_severity_label
          },
          patient: {
             needs_ambulance: c.ai_requires_ambulance,
             needs_icu: c.ai_requires_icu,
             red_flags: c.ai_red_flags,
             possible_conditions: c.ai_possible_conditions
          },
          reasoning: c.ai_reasoning,
          hospital_routing: c.routing_explanation
        }));
        setCases(items);
        updateStats(items);
      })
      .catch(err => console.error("Failed to load cases:", err));

    const ws = new WebSocket(`ws://${WS_HOST}/ws/triage/`);
    wsRef.current = ws;
    ws.onopen    = () => setWsStatus("connected");
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "new_emergency") {
        const newCase = { ...msg.data, received_at: new Date().toISOString(), status: "INCOMING" };
        setCases(prev => {
          const updated = [newCase, ...prev].slice(0, 100);
          updateStats(updated);
          return updated;
        });
        setIncomingAlert(newCase);
        
        // Auto-dismiss the alert after 8 seconds
        setTimeout(() => {
          setIncomingAlert(null);
        }, 8000);
      }
      if (msg.type === "case_updated") {
        setCases(prev => prev.map(c => c.case_id === msg.data.case_id ? { ...c, ...msg.data } : c));
      }
      if (msg.type === "patient_incoming") {
        setAmbulanceAlert(msg.data);
        setTimeout(() => {
          setAmbulanceAlert(null);
        }, 15000); // show for 15 seconds
      }
    };
    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("error");
    return () => ws.close();
  }, []);

  const updateStats = (allCases) => {
    const s = { P1: 0, P2: 0, P3: 0, P4: 0 };
    allCases.forEach(c => { if (c.severity?.p_level) s[c.severity.p_level]++; });
    setStats(s);
  };

  const handleStatusChange = (caseId, newStatus) => {
    setCases(prev => prev.map(c => c.case_id === caseId ? { ...c, status: newStatus } : c));
  };

  const handleRecordOutcome = async () => {
    if (!outcomeModal || !outcomeForm.actual_p_level) return;
    setOutcomeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/triage/cases/${outcomeModal.case_id}/outcome/`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(outcomeForm),
      });
      const data = await res.json();
      if (data.success) {
        setCases(prev => prev.map(c =>
          c.case_id === outcomeModal.case_id
            ? {
                ...c,
                status:           data.status,
                actual_p_level:   data.actual_p_level,
                was_undertriaged: data.was_undertriaged,
                was_overtriaged:  data.was_overtriaged,
              }
            : c
        ));
        setOutcome(null);
        setOutcomeForm({ actual_p_level: "", outcome_notes: "" });
        if (data.was_undertriaged) {
          alert(`⚠️ UNDER-TRIAGE FLAGGED\n\nAI scored ${data.ai_p_level} but actual was ${data.actual_p_level}.\nThis case has been flagged for model review.`);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setOutcomeLoading(false);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return "--";
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  const filteredCases = filter === "ALL" ? cases : cases.filter(c => c.severity?.p_level === filter);

  return (
    <div style={{ padding: "20px 24px", minHeight: "100vh", background: "#f9f9f8", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#1a1a18" }}>
            🏥 Emergency Triage Dashboard
          </h1>
          <p style={{ fontSize: 13, color: "#73726c", margin: "4px 0 0" }}>
            Real-time AI-powered emergency cases — live WebSocket feed
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/emergency" style={{
            fontSize: 13, padding: "8px 16px", borderRadius: 8,
            background: "linear-gradient(135deg, #E24B4A, #ff6b6b)", color: "#fff",
            textDecoration: "none", fontWeight: 600, boxShadow: "0 2px 8px rgba(226,75,74,0.3)",
          }}>
            🚨 New Emergency
          </a>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 13,
            color: wsStatus === "connected" ? "#3B6D11" : wsStatus === "connecting" ? "#854F0B" : "#A32D2D",
            padding: "6px 14px",
            background: wsStatus === "connected" ? "#EAF3DE" : wsStatus === "connecting" ? "#FAEEDA" : "#FCEBEB",
            borderRadius: 20,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: wsStatus === "connected" ? "#639922" : wsStatus === "connecting" ? "#EF9F27" : "#E24B4A",
              animation: wsStatus === "connected" ? "pulse 2s infinite" : "none",
            }} />
            {wsStatus === "connected" ? "● Live AI Feed" : wsStatus === "connecting" ? "⏳ Connecting..." : "✕ Offline"}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {Object.entries(SEVERITY_CONFIG).map(([level, cfg]) => (
          <div
            key={level}
            onClick={() => setFilter(filter === level ? "ALL" : level)}
            style={{
              flex: 1, minWidth: 130, background: cfg.bg,
              border: `2px solid ${filter === level ? cfg.color : cfg.color + "30"}`,
              borderRadius: 14, padding: "16px 18px", borderLeft: `5px solid ${cfg.color}`,
              cursor: "pointer", transition: "all 0.2s",
              transform: filter === level ? "translateY(-2px)" : "none",
              boxShadow: filter === level ? `0 4px 16px ${cfg.color}33` : "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: cfg.color }}>{stats[level]}</div>
            <div style={{ fontSize: 12, color: cfg.color, opacity: 0.9, fontWeight: 600 }}>
              {cfg.icon} {level} · {cfg.label}
            </div>
          </div>
        ))}
        <div style={{ flex: 1, minWidth: 130, background: "#fff", border: "1px solid #e5e4dc", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1a18" }}>{cases.length}</div>
          <div style={{ fontSize: 12, color: "#73726c", fontWeight: 500 }}>Total this session</div>
        </div>
      </div>

      {/* Filter clear */}
      {filter !== "ALL" && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setFilter("ALL")} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: "#e5e4dc", border: "none", cursor: "pointer", color: "#444" }}>
            ✕ Clear filter: {filter}
          </button>
        </div>
      )}

      {/* Cases table */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e4dc", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e4dc", fontSize: 15, fontWeight: 600, color: "#1a1a18", display: "flex", alignItems: "center", gap: 10 }}>
          Incoming Cases
          {cases.filter(c => c.status === "INCOMING").length > 0 && (
            <span style={{ fontSize: 11, padding: "3px 10px", background: "#FCEBEB", color: "#A32D2D", borderRadius: 20, fontWeight: 600, animation: "blink 2s infinite" }}>
              🔴 {cases.filter(c => c.status === "INCOMING").length} new
            </span>
          )}
          <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>
            Click a row to see full AI reasoning
          </span>
        </div>

        {filteredCases.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#73726c", fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              {wsStatus === "connected" ? "⏳" : "📡"}
            </div>
            {wsStatus === "connected" ? "Waiting for incoming emergencies..." : "WebSocket disconnected. Reconnecting..."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9f9f8" }}>
                  {["Time", "Case ID", "Patient", "AI Severity", "Department", "Hospital", "ETA", "Confidence", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#73726c", borderBottom: "1px solid #e5e4dc", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => {
                  const sev       = SEVERITY_CONFIG[c.severity?.p_level] || SEVERITY_CONFIG.P4;
                  const hosp      = c.recommended_hospital?.[0];
                  const isExpanded = expandedCase === c.case_id;
                  const wasFlagged = c.status === "FLAGGED_FOR_REVIEW";
                  const wasUnder  = c.was_undertriaged;

                  return (
                    <>
                      <tr
                        key={c.case_id}
                        onClick={() => setExpanded(isExpanded ? null : c.case_id)}
                        style={{
                          background: wasFlagged ? "#fef3c7" : c.status === "INCOMING" ? `${sev.bg}80` : "#fff",
                          borderBottom: isExpanded ? "none" : "1px solid #f1efea",
                          transition: "background 0.3s", cursor: "pointer",
                        }}
                      >
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "#73726c" }}>{formatTime(c.received_at)}</td>
                        <td style={{ padding: "12px 14px", fontSize: 11, color: "#888", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                          {c.case_id}
                          {wasUnder && <span style={{ marginLeft: 6, fontSize: 10, background: "#dc2626", color: "#fff", padding: "1px 6px", borderRadius: 8 }}>UNDER-TRIAGED</span>}
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600 }}>
                          {c.patient_name || "Unknown"}
                          {c.age ? <span style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>({c.age}y)</span> : null}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: sev.bg, color: sev.color, fontWeight: 600, border: `1px solid ${sev.color}40` }}>
                            {sev.icon} {c.severity?.p_level} · {sev.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "#444" }}>{c.doctor_category || "--"}</td>
                        <td style={{ padding: "12px 14px", fontSize: 13 }}>{hosp ? hosp.name : "--"}</td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "#73726c" }}>{hosp ? `~${hosp.travel_minutes}min` : "--"}</td>
                        <td style={{ padding: "12px 14px" }}>
                          {c.severity?.confidence && (
                            <span style={{
                              fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600,
                              background: c.severity.confidence === "HIGH" ? "#EAF3DE" : c.severity.confidence === "MEDIUM" ? "#FAEEDA" : "#FCEBEB",
                              color: c.severity.confidence === "HIGH" ? "#3B6D11" : c.severity.confidence === "MEDIUM" ? "#854F0B" : "#A32D2D",
                            }}>
                              {c.severity.confidence}
                              {c.severity.was_escalated && " ⚡"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{
                            fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600,
                            background: wasFlagged ? "#fef3c7" : c.status === "INCOMING" ? "#FCEBEB" : c.status === "DISPATCHED" ? "#FAEEDA" : "#EAF3DE",
                            color: wasFlagged ? "#854F0B" : c.status === "INCOMING" ? "#A32D2D" : c.status === "DISPATCHED" ? "#854F0B" : "#3B6D11",
                          }}>
                            {wasFlagged ? "⚠️ FLAGGED" : c.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            {c.status === "INCOMING" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(c.case_id, "DISPATCHED"); }}
                                style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, background: "#185FA5", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}
                              >
                                🚑 Dispatch
                              </button>
                            )}
                            {c.status === "DISPATCHED" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setOutcome(c); }}
                                style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, background: "#639922", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}
                              >
                                ✓ Record Outcome
                              </button>
                            )}
                            {c.status === "RESOLVED" && (
                              <span style={{ fontSize: 12, color: "#639922" }}>✅ Done</span>
                            )}
                            {c.actual_p_level && c.status !== "RESOLVED" && !wasFlagged && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setOutcome(c); }}
                                style={{ fontSize: 11, padding: "4px 8px", borderRadius: 8, background: "#f1efea", color: "#555", border: "1px solid #e0dfd8", cursor: "pointer" }}
                              >
                                📝 Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row — AI reasoning + routing explanation */}
                      {isExpanded && (
                        <tr key={`${c.case_id}-detail`}>
                          <td colSpan={10} style={{ padding: 0, borderBottom: "2px solid #e5e4dc" }}>
                            <div style={{ padding: "16px 20px", background: "#fafaf8" }}>

                              {/* AI Reasoning */}
                              {c.severity?.reasoning && (
                                <div style={{ marginBottom: 14 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>
                                    🤖 AI Severity Reasoning
                                  </div>
                                  <div style={{ background: `${(SEVERITY_CONFIG[c.severity.p_level]?.bg || "#fff")}`, border: `1px solid ${SEVERITY_CONFIG[c.severity.p_level]?.color || "#e5e4dc"}40`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                                    {c.severity.reasoning}
                                  </div>
                                  {c.severity.was_escalated && (
                                    <div style={{ marginTop: 6, fontSize: 12, color: "#854F0B", fontWeight: 600 }}>
                                      ⚡ Severity was automatically escalated for patient safety
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Red flags */}
                              {c.severity?.red_flags?.length > 0 && (
                                <div style={{ marginBottom: 14 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>
                                    ⚠️ Red Flags
                                  </div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {c.severity.red_flags.map(f => (
                                      <span key={f} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "#fff", color: "#92400e", border: "1px solid #fcd34d", fontWeight: 600 }}>
                                        {f}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Hospital routing explanation */}
                              {c.routing_explanation && (
                                <div style={{ marginBottom: 14 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>
                                    🏥 Hospital Routing Explanation
                                  </div>
                                  <div style={{ background: "#E6F1FB", border: "1px solid #378ADD40", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#185FA5", lineHeight: 1.6, borderLeft: "3px solid #378ADD" }}>
                                    {c.routing_explanation}
                                  </div>
                                </div>
                              )}

                              {/* Care needs profile (compact) */}
                              {c.needs_profile && (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>
                                    🧾 Care Needs Profile
                                  </div>
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "#E6F1FB", color: "#185FA5", fontWeight: 600 }}>
                                      🛏 {c.needs_profile.required_bed_type?.toUpperCase()} bed
                                    </span>
                                    {c.needs_profile.time_sensitivity_minutes && (
                                      <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "#FAEEDA", color: "#854F0B", fontWeight: 600 }}>
                                        ⏱ {c.needs_profile.time_sensitivity_minutes}min window
                                      </span>
                                    )}
                                    {c.needs_profile.required_services?.map(s => (
                                      <span key={s} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "#f5f3ff", color: "#5b21b6", fontWeight: 600 }}>
                                        📋 {s}
                                      </span>
                                    ))}
                                    {c.needs_profile.requires_ventilator && (
                                      <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "#FCEBEB", color: "#A32D2D", fontWeight: 600 }}>
                                        💨 Ventilator
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Raw symptoms */}
                              <div style={{ fontSize: 12, color: "#888" }}>
                                <strong>Raw symptoms:</strong> {c.symptoms_text}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Incoming Emergency Alert Overlay ─────────────────────────────────── */}
      {incomingAlert && (
        <div style={{ position: "fixed", bottom: 40, right: 40, zIndex: 9999, animation: "slideInRight 0.4s ease-out" }}>
          <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 40px rgba(226,75,74,0.3)", border: "2px solid #E24B4A", width: 420 }}>
            {/* Header */}
            <div style={{ background: "#E24B4A", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ animation: "blink 1s infinite" }}>🚨</span> 
                INCOMING EMERGENCY
              </div>
              <button onClick={() => setIncomingAlert(null)} style={{ background: "none", border: "none", color: "#fff", fontSize: 24, cursor: "pointer", opacity: 0.8 }}>&times;</button>
            </div>
            
            {/* Body */}
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Patient</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#222" }}>{incomingAlert.patient_name}</div>
                  {incomingAlert.age && <div style={{ fontSize: 13, color: "#555" }}>{incomingAlert.age} yrs</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Severity</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: SEVERITY_CONFIG[incomingAlert.severity?.p_level]?.color || "#E24B4A" }}>
                    {incomingAlert.severity?.p_level || "Critical"}
                  </div>
                </div>
              </div>

              {incomingAlert.recommended_hospital?.[0] && (
                <div style={{ background: "#f5f5f5", padding: 12, borderRadius: 8, marginBottom: 16, borderLeft: "4px solid #E24B4A" }}>
                  <div style={{ fontSize: 12, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Routing To</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{incomingAlert.recommended_hospital[0].name}</div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Reported Symptoms</div>
                <div style={{ fontSize: 14, color: "#444", lineHeight: 1.5, maxHeight: 60, overflow: "hidden", textOverflow: "ellipsis" }}>
                  "{incomingAlert.symptoms_text}"
                </div>
              </div>

              <button 
                onClick={() => setIncomingAlert(null)} 
                style={{ width: "100%", padding: "12px", borderRadius: 8, background: "#111", color: "#fff", fontWeight: 600, border: "none", cursor: "pointer" }}
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Outcome Recording Modal ─────────────────────────────────────────── */}
      {outcomeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 480, width: "100%", margin: "0 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 6px" }}>📝 Record Actual Outcome</h3>
            <p style={{ fontSize: 13, color: "#73726c", margin: "0 0 20px" }}>
              Case <strong>{outcomeModal.case_id}</strong> — AI scored <strong style={{ color: SEVERITY_CONFIG[outcomeModal.severity?.p_level]?.color }}>{outcomeModal.severity?.p_level}</strong>
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Actual Triage Level (clinical assessment) *
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["P1", "P2", "P3", "P4"].map(p => {
                  const sc = SEVERITY_CONFIG[p];
                  return (
                    <button
                      key={p}
                      onClick={() => setOutcomeForm(prev => ({ ...prev, actual_p_level: p }))}
                      style={{
                        padding: "8px 18px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
                        background: outcomeForm.actual_p_level === p ? sc.color : sc.bg,
                        color: outcomeForm.actual_p_level === p ? "#fff" : sc.color,
                        border: `2px solid ${sc.color}`,
                        transition: "all .15s",
                      }}
                    >
                      {sc.icon} {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Outcome Notes (optional)
              </label>
              <textarea
                value={outcomeForm.outcome_notes}
                onChange={(e) => setOutcomeForm(prev => ({ ...prev, outcome_notes: e.target.value }))}
                placeholder="e.g. Patient diagnosed with STEMI, taken to cath lab. AI was correct."
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e0dfd8", fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
              />
            </div>

            {outcomeForm.actual_p_level && outcomeModal.severity?.p_level && (() => {
              const order = { P1: 1, P2: 2, P3: 3, P4: 4 };
              const aiRank = order[outcomeModal.severity.p_level];
              const actRank = order[outcomeForm.actual_p_level];
              if (actRank < aiRank) {
                return (
                  <div style={{ background: "#FCEBEB", border: "1px solid #E24B4A", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#A32D2D", fontWeight: 600 }}>
                    ⚠️ WARNING: This will flag an UNDER-TRIAGE event. AI scored lower than actual severity.
                    This case will be sent to supervisor review for model improvement.
                  </div>
                );
              }
              return null;
            })()}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleRecordOutcome}
                disabled={!outcomeForm.actual_p_level || outcomeLoading}
                style={{
                  flex: 2, padding: "12px", borderRadius: 10, fontWeight: 700, fontSize: 14,
                  background: !outcomeForm.actual_p_level || outcomeLoading ? "#e5e4dc" : "linear-gradient(135deg, #1B4332, #2D6A4F)",
                  color: !outcomeForm.actual_p_level || outcomeLoading ? "#888" : "#fff",
                  border: "none", cursor: !outcomeForm.actual_p_level || outcomeLoading ? "not-allowed" : "pointer",
                }}
              >
                {outcomeLoading ? "Saving…" : "✓ Save Outcome"}
              </button>
              <button
                onClick={() => { setOutcome(null); setOutcomeForm({ actual_p_level: "", outcome_notes: "" }); }}
                style={{ flex: 1, padding: "12px", borderRadius: 10, background: "#f1efea", color: "#444", border: "1px solid #e0dfd8", cursor: "pointer", fontSize: 14 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Ambulance Alert Modal */}
      {ambulanceAlert && (
        <div style={{
          position: "fixed", top: 20, right: 20, width: 380, background: "#fff",
          borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
          border: "2px solid #378ADD", zIndex: 9999, overflow: "hidden",
          animation: "slideInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
        }}>
          <div style={{ background: "linear-gradient(135deg, #378ADD, #5D9BE3)", padding: "16px 20px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>🚑</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>AMBULANCE INBOUND</h3>
                <p style={{ margin: "2px 0 0", fontSize: 11, opacity: 0.9, textTransform: "uppercase", letterSpacing: 1 }}>Patient Picked Up</p>
              </div>
            </div>
            <button onClick={() => setAmbulanceAlert(null)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", opacity: 0.8 }}>✕</button>
          </div>
          
          <div style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 11, color: "#888", textTransform: "uppercase", fontWeight: 700 }}>Patient Name</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1a1a18" }}>{ambulanceAlert.patient_name || "Unknown"}</p>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 11, color: "#888", textTransform: "uppercase", fontWeight: 700 }}>Severity</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: SEVERITY_CONFIG[ambulanceAlert.severity]?.color || "#000" }}>{ambulanceAlert.severity}</p>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 11, color: "#888", textTransform: "uppercase", fontWeight: 700 }}>Ambulance</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1a1a18" }}>{ambulanceAlert.ambulance_vehicle} ({ambulanceAlert.driver_name})</p>
            </div>
            
            <div style={{ background: "#f9f9f8", padding: 12, borderRadius: 8, marginTop: 16, border: "1px solid #e5e4dc" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#888", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Condition</p>
              <p style={{ margin: 0, fontSize: 13, color: "#1a1a18", lineHeight: 1.4 }}>{ambulanceAlert.symptoms}</p>
            </div>
          </div>
          
          <div style={{ padding: "0 20px 20px" }}>
            <button onClick={() => setAmbulanceAlert(null)} style={{ width: "100%", padding: "12px", background: "#f1efea", color: "#1a1a18", border: "1px solid #e5e4dc", borderRadius: 8, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
              Acknowledge
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
