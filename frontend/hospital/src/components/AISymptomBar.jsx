// frontend/hospital/src/components/AISymptomBar.jsx
// Voice + text symptom analysis bar — shown in Patient Portal top nav
// Sends symptoms to backend API → gets doctor category → parent fetches doctors

import { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

const SPEC_ICONS = {
  cardiology: '❤️', neurology: '🧠', orthopedics: '🦴', oncology: '🔬',
  pediatrics: '👶', general: '🏥', surgery: '🔪', radiology: '📡',
  emergency: '🚨', icu: '💊', nephrology: '🫘', other: '👨‍⚕️',
};

const SUGGESTIONS = [
  'chest pain and shortness of breath',
  'severe headache and dizziness',
  'knee pain after injury',
  'high fever in child',
  'kidney stone and back pain',
  'difficulty breathing and cough',
];

export default function AISymptomBar({ onCategoryChange }) {
  const [text, setText]               = useState('');
  const [listening, setListening]     = useState(false);
  const [analyzing, setAnalyzing]     = useState(false);
  const [result, setResult]           = useState(null);
  const [showSuggestions, setShowSugg] = useState(false);
  const [transcript, setTranscript]   = useState('');
  const recognitionRef                = useRef(null);
  const debounceRef                   = useRef(null);
  const inputRef                      = useRef(null);

  // Setup Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const r = new SpeechRecognition();
    r.continuous      = false;
    r.interimResults  = true;
    r.lang            = 'en-IN';

    r.onresult = (e) => {
      const interim = Array.from(e.results).map(r => r[0].transcript).join(' ');
      setTranscript(interim);
      if (e.results[e.results.length - 1].isFinal) {
        const final = e.results[e.results.length - 1][0].transcript;
        setText(final);
        setTranscript('');
        setListening(false);
        analyzeSymptoms(final);
      }
    };
    r.onend   = () => setListening(false);
    r.onerror = () => setListening(false);

    recognitionRef.current = r;
  }, []);

  const startVoice = () => {
    if (!recognitionRef.current) {
      alert('Voice recognition not supported in this browser. Use Chrome.');
      return;
    }
    setListening(true);
    setResult(null);
    setTranscript('');
    recognitionRef.current.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const analyzeSymptoms = useCallback(async (symptoms) => {
    if (!symptoms || symptoms.trim().length < 3) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/api/hospitals/symptom-category/?symptoms=${encodeURIComponent(symptoms)}`);
      if (res.ok) {
        const data = await res.json();
        setResult(data.matched);
        onCategoryChange?.(data.matched);
      }
    } catch {
      // fallback: parse locally
      const lower = symptoms.toLowerCase();
      const fallbackMap = [
        { kw: ['chest', 'heart', 'cardiac'], spec: 'cardiology', label: 'Cardiology' },
        { kw: ['head', 'brain', 'stroke', 'seizure'], spec: 'neurology', label: 'Neurology' },
        { kw: ['bone', 'joint', 'knee', 'fracture', 'back'], spec: 'orthopedics', label: 'Orthopedics' },
        { kw: ['child', 'baby', 'infant', 'kid'], spec: 'pediatrics', label: 'Pediatrics' },
        { kw: ['kidney', 'urine', 'renal'], spec: 'nephrology', label: 'Nephrology' },
        { kw: ['breath', 'lung', 'asthma', 'cough'], spec: 'icu', label: 'Pulmonology' },
      ];
      const matched = fallbackMap.find(f => f.kw.some(k => lower.includes(k)));
      const result  = matched
        ? { specialization: matched.spec, category: matched.label, confidence: 0.7 }
        : { specialization: 'general', category: 'General Medicine', confidence: 0.3 };
      setResult(result);
      onCategoryChange?.(result);
    }
    setAnalyzing(false);
  }, [onCategoryChange]);

  // Debounced analysis on text change
  useEffect(() => {
    if (!text) { setResult(null); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => analyzeSymptoms(text), 800);
    return () => clearTimeout(debounceRef.current);
  }, [text, analyzeSymptoms]);

  const handleSuggestion = (s) => {
    setText(s);
    setShowSugg(false);
    inputRef.current?.focus();
  };

  const confidenceColor = (c) =>
    c >= 0.8 ? '#16a34a' : c >= 0.5 ? '#d97706' : '#6b7280';

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      {/* Main input row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: listening ? 'rgba(220,38,38,0.06)' : '#fff',
        border: `2px solid ${listening ? '#dc2626' : result ? '#16a34a' : '#e5e4dc'}`,
        borderRadius: 28, padding: '8px 8px 8px 16px',
        transition: 'all 0.25s', boxShadow: listening ? '0 0 0 4px rgba(220,38,38,0.1)' : '0 1px 6px rgba(0,0,0,0.06)',
      }}>
        {/* AI icon */}
        <span style={{ fontSize: 16, flexShrink: 0 }}>🤖</span>

        {/* Text input */}
        <input
          ref={inputRef}
          value={listening ? (transcript || text) : text}
          onChange={e => setText(e.target.value)}
          onFocus={() => setShowSugg(true)}
          onBlur={() => setTimeout(() => setShowSugg(false), 150)}
          placeholder={listening ? '🎤 Listening...' : 'Describe symptoms (voice or type)...'}
          readOnly={listening}
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: 13,
            background: 'transparent', color: listening ? '#dc2626' : '#1a1a18',
            fontWeight: 500, minWidth: 0,
          }}
        />

        {/* Analyzing spinner */}
        {analyzing && (
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2.5px solid #e0dfd8', borderTopColor: '#1B4332', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
        )}

        {/* Result chip */}
        {result && !analyzing && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px',
            borderRadius: 20, background: '#dcfce7', flexShrink: 0,
            border: '1px solid #86efac',
          }}>
            <span style={{ fontSize: 14 }}>{SPEC_ICONS[result.specialization] || '👨‍⚕️'}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1B4332', whiteSpace: 'nowrap' }}>{result.category}</span>
            <span style={{ fontSize: 10, color: confidenceColor(result.confidence), fontWeight: 700 }}>
              {Math.round((result.confidence || 0) * 100)}%
            </span>
          </div>
        )}

        {/* Clear */}
        {(text || result) && !listening && (
          <button onClick={() => { setText(''); setResult(null); onCategoryChange?.(null); }}
            style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: '#f1efea', cursor: 'pointer', fontSize: 12, color: '#73726c', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        )}

        {/* Voice button */}
        <button
          onClick={listening ? stopVoice : startVoice}
          title={listening ? 'Stop listening' : 'Speak your symptoms'}
          style={{
            width: 38, height: 38, borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0,
            background: listening ? '#dc2626' : 'linear-gradient(135deg,#1B4332,#2D6A4F)',
            color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: listening ? '0 0 0 6px rgba(220,38,38,0.2)' : '0 2px 8px rgba(27,67,50,0.3)',
            animation: listening ? 'voicePulse 1s infinite' : 'none',
            transition: 'all 0.2s',
          }}>
          {listening ? '⏹' : '🎤'}
        </button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && !text && !listening && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: '#fff', borderRadius: 14, border: '1px solid #e5e4dc',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#73726c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Common symptoms
          </div>
          {SUGGESTIONS.map(s => (
            <button key={s} onMouseDown={() => handleSuggestion(s)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '9px 14px', border: 'none', background: 'transparent',
              fontSize: 13, color: '#1a1a18', cursor: 'pointer',
              borderBottom: '1px solid #f1efea',
              transition: 'background 0.1s',
            }}
              onMouseEnter={e => e.target.style.background = '#f0fdf4'}
              onMouseLeave={e => e.target.style.background = 'transparent'}
            >
              💬 {s}
            </button>
          ))}
        </div>
      )}

      {/* Listening ripple text */}
      {listening && transcript && (
        <div style={{ position: 'absolute', left: 16, top: '115%', fontSize: 12, color: '#dc2626', fontWeight: 600, animation: 'fadeInUp 0.2s ease' }}>
          🎤 "{transcript}"
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes voicePulse { 0%,100%{ box-shadow:0 0 0 6px rgba(220,38,38,0.2); } 50%{ box-shadow:0 0 0 10px rgba(220,38,38,0.05); } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
