import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../services/auth';
import { apiFetch } from '../services/api';
import '../css/styles.css';

const THEME = {
  navy: '#1B4332',
  blue: '#2D6A4F',
  lightBlue: '#40916C',
  sky: '#D8F3DC',
  bg: '#FDFCF7',
  border: '#F3F4F6',
  text: '#111827',
  text2: '#6B7280',
  severity: {
    high: { bg: '#FEF2F2', border: '#EF4444', text: '#B91C1C' },
    medium: { bg: '#FFFBEB', border: '#F59E0B', text: '#B45309' },
    low: { bg: '#F0FDF4', border: '#22C55E', text: '#15803D' },
  },
};

const fmtAgo = (iso) => {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const buildQS = (params) => {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || v === 'all') return;
    qs.set(k, v);
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

const SupervisorPortalPage = () => {
  const navigate = useNavigate();
  const user = Auth.user;
  const isPlatformAdmin = user?.role === 'platform-admin';
  const myHospitalId = user?.hospital ? String(user.hospital) : null;

  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState(null);

  // Dashboard
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState('');
  const [dashboard, setDashboard] = useState({ hospitals: [], totals: null, pending_verifications: 0 });
  const [dashFilter, setDashFilter] = useState('all'); // all | high_only | pending_verification | most_beds

  // Alerts
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [alertFilters, setAlertFilters] = useState({
    status: 'open',
    severity: 'all',
    alert_type: 'all',
    hospital: 'all',
    from_date: '',
    to_date: '',
  });
  const [resolveModal, setResolveModal] = useState({ open: false, alert: null, note: '', error: '' });

  // Corrections
  const [corTab, setCorTab] = useState('bed'); // bed | patient | allocation
  const [selectedHospitalForAudit, setSelectedHospitalForAudit] = useState('all');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditAlerts, setAuditAlerts] = useState([]);
  const [auditError, setAuditError] = useState('');

  const [bedCorrection, setBedCorrection] = useState({ bed_id: '', status: 'available', correction_reason: '', error: '', loading: false });
  const [patientCorrection, setPatientCorrection] = useState({ patient_id: '', full_name: '', correction_reason: '', error: '', loading: false });
  const [allocationCorrection, setAllocationCorrection] = useState({ allocation_id: '', correction_reason: '', error: '', loading: false });

  // Staff Registration
  const [staffForm, setStaffForm] = useState({ email: '', password: '', hospital: 'all', loading: false, error: '' });

  // History (hospital-scoped)
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyItems, setHistoryItems] = useState([]);
  const [historyFilters, setHistoryFilters] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const ymd = `${y}-${m}-${d}`;
    return { from_date: ymd, to_date: ymd, type: 'all', search: '' };
  });
  const [historyDetail, setHistoryDetail] = useState({ open: false, loading: false, error: '', item: null, detail: null });

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }
    if (user.role && user.role !== 'supervisor' && user.role !== 'platform-admin') {
      navigate('/unauthorized');
      return;
    }
    // Enforce hospital isolation for per-hospital supervisors.
    if (!isPlatformAdmin && myHospitalId) {
      setAlertFilters((f) => ({ ...f, hospital: myHospitalId }));
      setSelectedHospitalForAudit(myHospitalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (type, message) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadDashboard = async (silent = false) => {
    if (!silent) {
      setDashLoading(true);
      setDashError('');
    }
    try {
      const res = await apiFetch('/api/supervisor/dashboard/');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to load dashboard');
      }
      const data = await res.json();
      const hospitals = data.hospitals || data.results || data || [];
      const totals = data.totals || data.summary || null;
      setDashboard({
        hospitals: Array.isArray(hospitals) ? hospitals : [],
        totals,
        pending_verifications: data.pending_verifications ?? data.pending ?? 0,
      });
      setDashLoading(false);
    } catch (e) {
      setDashError(e.message || 'Failed to load dashboard');
      setDashLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard(false);
    const t = window.setInterval(() => loadDashboard(true), 5 * 60 * 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hospitalsSorted = useMemo(() => {
    const base = [...(dashboard.hospitals || [])];
    base.sort((a, b) => (b.high_alerts || 0) - (a.high_alerts || 0));

    // If this is a per-hospital supervisor, only show their hospital card.
    if (!isPlatformAdmin && myHospitalId) {
      return base.filter((h) => String(h.hospital_id || h.id || '') === myHospitalId);
    }

    if (dashFilter === 'high_only') return base.filter((h) => (h.high_alerts || 0) > 0);
    if (dashFilter === 'pending_verification') return base.filter((h) => h.verification_status === 'pending' || h.pending_verification === true);
    if (dashFilter === 'most_beds') return base.sort((a, b) => (b.total_beds || 0) - (a.total_beds || 0));
    return base;
  }, [dashboard.hospitals, dashFilter, isPlatformAdmin, myHospitalId]);

  const dashTop = useMemo(() => {
    if (dashboard.totals) return dashboard.totals;
    // Fallback: compute a minimal summary from hospital cards.
    const open = (dashboard.hospitals || []).reduce((s, h) => s + (h.open_alerts || 0), 0);
    const high = (dashboard.hospitals || []).reduce((s, h) => s + (h.high_alerts || 0), 0);
    return { open, high, medium: '—', low: '—' };
  }, [dashboard.totals, dashboard.hospitals]);

  const loadAlerts = async () => {
    setAlertsLoading(true);
    setAlertsError('');
    try {
      const enforced = !isPlatformAdmin && myHospitalId
        ? { ...alertFilters, hospital: myHospitalId }
        : alertFilters;
      const qs = buildQS(enforced);
      const res = await apiFetch(`/api/supervisor/alerts/${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to load alerts');
      setAlerts(Array.isArray(data) ? data : data.results || data.alerts || []);
      setAlertsLoading(false);
    } catch (e) {
      setAlertsError(e.message || 'Failed to load alerts');
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'alerts') return;
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const actionAlert = async (alertId, payload) => {
    const res = await apiFetch(`/api/supervisor/alerts/${alertId}/resolve/`, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Action failed');
    return data;
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const qs = buildQS({
        from_date: historyFilters.from_date,
        to_date: historyFilters.to_date,
        type: historyFilters.type,
        search: historyFilters.search,
        limit: '250',
      });
      const res = await apiFetch(`/api/patients/history/${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to load history.');
      setHistoryItems(Array.isArray(data.results) ? data.results : []);
    } catch (e) {
      setHistoryItems([]);
      setHistoryError(e.message || 'Failed to load history.');
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const openHistoryDetail = async (row) => {
    if (!row?.source || !row?.source_id) return;
    setHistoryDetail({ open: true, loading: true, error: '', item: row, detail: null });
    try {
      const qs = new URLSearchParams({ source: row.source, id: row.source_id });
      const res = await apiFetch(`/api/patients/history/detail/?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to load history detail.');
      setHistoryDetail((s) => ({ ...s, loading: false, detail: data }));
    } catch (e) {
      setHistoryDetail((s) => ({ ...s, loading: false, error: e.message || 'Failed to load history detail.' }));
    }
  };

  const onInvestigate = async (a) => {
    try {
      await actionAlert(a.id, { action: 'investigate' });
      showToast('success', 'Alert marked investigating');
      loadAlerts();
      loadDashboard(true);
    } catch (e) {
      showToast('error', e.message || 'Failed to update alert');
    }
  };

  const onDismiss = async (a) => {
    try {
      await actionAlert(a.id, { action: 'dismiss' });
      showToast('success', 'Alert dismissed');
      loadAlerts();
      loadDashboard(true);
    } catch (e) {
      showToast('error', e.message || 'Failed to dismiss alert');
    }
  };

  const onResolveOpen = (a) => {
    setResolveModal({ open: true, alert: a, note: '', error: '' });
  };

  const onResolveSubmit = async () => {
    const a = resolveModal.alert;
    const note = resolveModal.note.trim();
    if (!note) {
      setResolveModal((m) => ({ ...m, error: 'resolution_note is required to resolve an alert.' }));
      return;
    }
    try {
      await actionAlert(a.id, { action: 'resolve', resolution_note: note });
      setResolveModal({ open: false, alert: null, note: '', error: '' });
      showToast('success', 'Alert resolved');
      loadAlerts();
      loadDashboard(true);
    } catch (e) {
      setResolveModal((m) => ({ ...m, error: e.message || 'Failed to resolve alert' }));
    }
  };

  const loadAuditTrail = async () => {
    const hospitalId = (!isPlatformAdmin && myHospitalId) ? myHospitalId : selectedHospitalForAudit;
    if (!hospitalId || hospitalId === 'all') {
      setAuditAlerts([]);
      setAuditError('');
      return;
    }
    setAuditLoading(true);
    setAuditError('');
    try {
      const qs = buildQS({ alert_type: 'data_inconsistency', hospital: hospitalId });
      const res = await apiFetch(`/api/supervisor/alerts/${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to load audit trail');
      setAuditAlerts(Array.isArray(data) ? data : data.results || data.alerts || []);
      setAuditLoading(false);
    } catch (e) {
      setAuditError(e.message || 'Failed to load audit trail');
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'corrections') return;
    loadAuditTrail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedHospitalForAudit]);

  const submitBedCorrection = async () => {
    const bed_id = bedCorrection.bed_id.trim();
    const correction_reason = bedCorrection.correction_reason.trim();
    if (!bed_id) return setBedCorrection((s) => ({ ...s, error: 'bed_id is required.' }));
    if (!correction_reason) return setBedCorrection((s) => ({ ...s, error: 'correction_reason is required.' }));
    setBedCorrection((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await apiFetch(`/api/supervisor/correct/bed/${bed_id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: bedCorrection.status, correction_reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Correction failed');
      showToast('success', 'Bed corrected. Audit alert created.');
      setBedCorrection({ bed_id: '', status: 'available', correction_reason: '', error: '', loading: false });
      loadDashboard(true);
      loadAuditTrail();
    } catch (e) {
      setBedCorrection((s) => ({ ...s, loading: false, error: e.message || 'Correction failed' }));
    }
  };

  const submitPatientCorrection = async () => {
    const patient_id = patientCorrection.patient_id.trim();
    const correction_reason = patientCorrection.correction_reason.trim();
    if (!patient_id) return setPatientCorrection((s) => ({ ...s, error: 'patient_id is required.' }));
    if (!correction_reason) return setPatientCorrection((s) => ({ ...s, error: 'correction_reason is required.' }));
    setPatientCorrection((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await apiFetch(`/api/supervisor/correct/patient/${patient_id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ full_name: patientCorrection.full_name, correction_reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Correction failed');
      showToast('success', 'Patient corrected. Audit alert created.');
      setPatientCorrection({ patient_id: '', full_name: '', correction_reason: '', error: '', loading: false });
      loadDashboard(true);
      loadAuditTrail();
    } catch (e) {
      setPatientCorrection((s) => ({ ...s, loading: false, error: e.message || 'Correction failed' }));
    }
  };

  const submitAllocationCorrection = async () => {
    const allocation_id = allocationCorrection.allocation_id.trim();
    const correction_reason = allocationCorrection.correction_reason.trim();
    if (!allocation_id) return setAllocationCorrection((s) => ({ ...s, error: 'allocation_id is required.' }));
    if (!correction_reason) return setAllocationCorrection((s) => ({ ...s, error: 'correction_reason is required.' }));
    setAllocationCorrection((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await apiFetch(`/api/supervisor/correct/allocation/${allocation_id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ force_discharge: true, correction_reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Correction failed');
      showToast('success', 'Allocation force-discharged. Audit alert created.');
      setAllocationCorrection({ allocation_id: '', correction_reason: '', error: '', loading: false });
      loadDashboard(true);
      loadAuditTrail();
    } catch (e) {
      setAllocationCorrection((s) => ({ ...s, loading: false, error: e.message || 'Correction failed' }));
    }
  };

  const handleRegisterStaff = async () => {
    const email = staffForm.email.trim();
    const password = staffForm.password;
    const hospital = (!isPlatformAdmin && myHospitalId) ? myHospitalId : staffForm.hospital;

    if (!email || !password) {
      return setStaffForm((s) => ({ ...s, error: 'Email and password are required.' }));
    }
    if (password.length < 8) {
      return setStaffForm((s) => ({ ...s, error: 'Password must be at least 8 characters.' }));
    }
    if (hospital === 'all' || !hospital) {
      return setStaffForm((s) => ({ ...s, error: 'Please select a hospital.' }));
    }

    setStaffForm((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await apiFetch('/api/auth/register/', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          password2: password,
          full_name: 'Reception Staff',
          role: 'reception',
          hospital
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.email?.[0] || 'Registration failed');
      
      showToast('success', 'Receptionist registered successfully');
      setStaffForm({ email: '', password: '', hospital: 'all', loading: false, error: '' });
    } catch (e) {
      setStaffForm((s) => ({ ...s, loading: false, error: e.message || 'Registration failed' }));
    }
  };

  const hospitalOptions = useMemo(() => {
    return (dashboard.hospitals || []).map((h) => ({
      id: h.hospital_id || h.id,
      name: h.hospital_name || h.name || 'Hospital',
    }));
  }, [dashboard.hospitals]);

  return (
    <div className="min-h-screen" style={{ background: THEME.bg, color: THEME.text, fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        .hero-heading { font-family: 'Playfair Display', serif; }
        @keyframes pulseDot { 0%,100%{ transform: scale(1); opacity:1;} 50%{ transform: scale(1.3); opacity:.5;} }
        .pulse-dot { animation: pulseDot 1.2s ease-in-out infinite; }
      `}</style>

      <header className="sticky top-0 z-50 shadow-xl" style={{ background: THEME.navy, borderBottom: `1px solid ${THEME.border}` }}>
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white" style={{ background: THEME.blue }}>S</div>
            <div>
              <div className="text-xl font-black tracking-tight" style={{ color: THEME.sky }}>Supervisor Portal</div>
              <div className="text-xs font-bold opacity-70" style={{ color: THEME.sky }}>{user?.name || 'Supervisor'} · {user?.email || ''}</div>
            </div>
          </div>

          <nav className="flex gap-2 bg-white/10 p-1.5 rounded-2xl">
            {[
              ['dashboard', 'Dashboard'],
              ['alerts', 'Alerts'],
              ['corrections', 'Corrections'],
              ['history', 'History'],
              ['staff', 'Staff']
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === id ? 'bg-white text-[#1B4332]' : 'text-white/80 hover:bg-white/10'}`}
              >
                {label}
              </button>
            ))}
            <a
              href="/triage-dashboard"
              className="px-5 py-2.5 rounded-xl text-sm font-black transition-all text-red-300 hover:bg-red-500/20 flex items-center gap-1.5"
              title="Open real-time triage dashboard"
            >
              🚨 Triage
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadDashboard(false)}
              className="px-4 py-2 rounded-xl font-black text-xs bg-white/10 text-white hover:bg-white/15 transition-all"
              title="Refresh dashboard"
            >
              Refresh
            </button>
            <button onClick={async () => { await Auth.logout(); navigate('/'); }} className="px-4 py-2 rounded-xl font-black text-xs bg-white text-[#1B4332] hover:bg-gray-50 transition-all">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10 space-y-10">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl font-black hero-heading italic" style={{ color: THEME.navy }}>Supervisor Dashboard</h1>
                <p className="text-sm font-bold" style={{ color: THEME.text2 }}>Auto-refreshes every 5 minutes · Cards sorted by high alerts</p>
              </div>
              <div className="flex gap-2">
                {[
                  ['all', 'All'],
                  ['high_only', 'High Alerts Only'],
                  ['pending_verification', 'Pending Verification'],
                  ['most_beds', 'Most Beds'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setDashFilter(id)}
                    className={`px-4 py-2 rounded-2xl text-xs font-black border transition-all ${dashFilter === id ? 'bg-white' : 'bg-transparent hover:bg-white/50'}`}
                    style={{ borderColor: THEME.border, color: THEME.navy }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Open', value: dashTop.open ?? dashTop.total_open ?? '—', tone: { bg: '#D6EAF8', border: THEME.lightBlue, text: THEME.blue } },
                { label: 'High', value: dashTop.high ?? '—', tone: THEME.severity.high },
                { label: 'Medium', value: dashTop.medium ?? '—', tone: THEME.severity.medium },
                { label: 'Low', value: dashTop.low ?? '—', tone: THEME.severity.low },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-3xl p-6 border shadow-sm" style={{ borderColor: THEME.border }}>
                  <div className="inline-flex px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border" style={{ background: s.tone.bg, borderColor: s.tone.border, color: s.tone.text }}>
                    {s.label}
                  </div>
                  <div className="mt-3 text-4xl font-black" style={{ color: THEME.navy }}>{s.value}</div>
                </div>
              ))}
            </div>

            {dashboard.pending_verifications > 0 && (
              <div className="bg-white rounded-3xl p-6 border shadow-sm flex items-center justify-between" style={{ borderColor: THEME.border }}>
                <div>
                  <div className="text-sm font-black" style={{ color: THEME.navy }}>Pending hospital verifications</div>
                  <div className="text-xs font-bold" style={{ color: THEME.text2 }}>There are hospitals waiting for approval.</div>
                </div>
                <div className="px-4 py-2 rounded-2xl text-xs font-black" style={{ background: THEME.severity.medium.bg, color: THEME.severity.medium.text, border: `1px solid ${THEME.severity.medium.border}` }}>
                  {dashboard.pending_verifications} pending
                </div>
              </div>
            )}

            {dashLoading ? (
              <div className="bg-white rounded-3xl p-10 border text-sm font-bold" style={{ borderColor: THEME.border, color: THEME.text2 }}>Loading hospitals…</div>
            ) : dashError ? (
              <div className="bg-white rounded-3xl p-10 border" style={{ borderColor: THEME.border }}>
                <div className="text-sm font-black" style={{ color: THEME.severity.high.text }}>Failed to load dashboard</div>
                <div className="text-xs font-bold mt-2" style={{ color: THEME.text2 }}>{dashError}</div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {hospitalsSorted.map((h) => {
                  const id = h.hospital_id || h.id;
                  const name = h.hospital_name || h.name || 'Hospital';
                  const city = h.city || '—';
                  const category = h.category || h.hospital_type || '—';
                  const high = h.high_alerts || 0;
                  const open = h.open_alerts || 0;
                  const availBeds = h.available_beds ?? h.available ?? '—';
                  return (
                    <div key={id} className="bg-white rounded-[40px] p-8 border shadow-sm hover:shadow-md transition-all" style={{ borderColor: THEME.border }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-xl font-black truncate" style={{ color: THEME.navy }} title={name}>{name}</div>
                            {high > 0 && <span className="w-2.5 h-2.5 rounded-full pulse-dot" style={{ background: THEME.severity.high.border }} />}
                          </div>
                          <div className="text-xs font-bold mt-1" style={{ color: THEME.text2 }}>{city}</div>
                          <div className="mt-3 inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border" style={{ borderColor: THEME.border, color: THEME.text2 }}>
                            {category}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: THEME.text2 }}>Available beds</div>
                          <div className="text-3xl font-black" style={{ color: THEME.blue }}>{availBeds}</div>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-3 gap-3">
                        <div className="rounded-2xl p-3 border" style={{ borderColor: THEME.border }}>
                          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: THEME.text2 }}>Open</div>
                          <div className="text-2xl font-black" style={{ color: THEME.navy }}>{open}</div>
                        </div>
                        <div className="rounded-2xl p-3 border" style={{ borderColor: THEME.border }}>
                          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: THEME.text2 }}>High</div>
                          <div className="text-2xl font-black" style={{ color: THEME.severity.high.text }}>{high}</div>
                        </div>
                        <div className="rounded-2xl p-3 border" style={{ borderColor: THEME.border }}>
                          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: THEME.text2 }}>Pending transfers</div>
                          <div className="text-2xl font-black" style={{ color: THEME.navy }}>{h.pending_transfers ?? '—'}</div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-xs font-bold" style={{ color: THEME.text2 }}>
                          Long occupancy: <span className="font-black" style={{ color: THEME.navy }}>{h.long_occupancy_beds ?? '—'}</span>
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab('alerts');
                            setAlertFilters((f) => ({ ...f, hospital: (isPlatformAdmin ? (id || 'all') : (myHospitalId || 'all')) }));
                            window.setTimeout(() => loadAlerts(), 50);
                          }}
                          className="px-4 py-2 rounded-2xl text-xs font-black text-white transition-all hover:opacity-95"
                          style={{ background: THEME.blue }}
                        >
                          View alerts
                        </button>
                      </div>
                    </div>
                  );
                })}
                {hospitalsSorted.length === 0 && (
                  <div className="bg-white rounded-3xl p-10 border text-sm font-bold col-span-full" style={{ borderColor: THEME.border, color: THEME.text2 }}>
                    No hospitals match this filter.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-8">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="text-3xl font-black hero-heading italic" style={{ color: THEME.navy }}>Alert Management</h2>
                <p className="text-sm font-bold" style={{ color: THEME.text2 }}>Filter, investigate, resolve, or dismiss alerts.</p>
              </div>
              <button onClick={() => loadAlerts()} className="px-5 py-3 rounded-2xl text-xs font-black text-white" style={{ background: THEME.blue }}>
                Refresh
              </button>
            </div>

            <div className="bg-white rounded-[40px] p-6 border shadow-sm" style={{ borderColor: THEME.border }}>
              <div className="grid md:grid-cols-6 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>Status</label>
                  <select value={alertFilters.status} onChange={(e) => setAlertFilters((f) => ({ ...f, status: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none">
                    {['open', 'investigating', 'resolved', 'dismissed'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>Severity</label>
                  <select value={alertFilters.severity} onChange={(e) => setAlertFilters((f) => ({ ...f, severity: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none">
                    <option value="all">All</option>
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>Alert type</label>
                  <select value={alertFilters.alert_type} onChange={(e) => setAlertFilters((f) => ({ ...f, alert_type: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none">
                    <option value="all">All</option>
                    {[
                      'bed_long_occupancy',
                      'resource_mismatch',
                      'missing_data',
                      'transfer_delay',
                      'suspicious_bed',
                      'data_inconsistency',
                      'pending_verification',
                    ].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>Hospital</label>
                  <select
                    value={(!isPlatformAdmin && myHospitalId) ? myHospitalId : alertFilters.hospital}
                    onChange={(e) => setAlertFilters((f) => ({ ...f, hospital: e.target.value }))}
                    disabled={!isPlatformAdmin}
                    className={`w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none ${!isPlatformAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isPlatformAdmin && <option value="all">All</option>}
                    {hospitalOptions
                      .filter((h) => (isPlatformAdmin ? true : String(h.id) === String(myHospitalId)))
                      .map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>From</label>
                  <input type="date" value={alertFilters.from_date} onChange={(e) => setAlertFilters((f) => ({ ...f, from_date: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none" />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>To</label>
                  <input type="date" value={alertFilters.to_date} onChange={(e) => setAlertFilters((f) => ({ ...f, to_date: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none" />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button onClick={() => loadAlerts()} className="px-6 py-3 rounded-2xl text-xs font-black text-white" style={{ background: THEME.lightBlue }}>
                  Apply filters
                </button>
              </div>
            </div>

            {alertsLoading ? (
              <div className="bg-white rounded-3xl p-10 border text-sm font-bold" style={{ borderColor: THEME.border, color: THEME.text2 }}>Loading alerts…</div>
            ) : alertsError ? (
              <div className="bg-white rounded-3xl p-10 border" style={{ borderColor: THEME.border }}>
                <div className="text-sm font-black" style={{ color: THEME.severity.high.text }}>Failed to load alerts</div>
                <div className="text-xs font-bold mt-2" style={{ color: THEME.text2 }}>{alertsError}</div>
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map((a) => {
                  const sev = (a.severity || 'low').toLowerCase();
                  const tone = THEME.severity[sev] || THEME.severity.low;
                  return (
                    <div key={a.id} className="bg-white rounded-[40px] border shadow-sm overflow-hidden" style={{ borderColor: THEME.border }}>
                      <div className="border-l-8 p-6" style={{ borderLeftColor: tone.border }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border" style={{ background: tone.bg, borderColor: tone.border, color: tone.text }}>
                                {sev}
                              </span>
                              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border" style={{ borderColor: THEME.border, color: THEME.text2 }}>
                                {a.status}
                              </span>
                              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border" style={{ borderColor: THEME.border, color: THEME.text2 }}>
                                {a.alert_type}
                              </span>
                              <span className="text-xs font-black" style={{ color: THEME.text2 }}>{fmtAgo(a.created_at || a.created)}</span>
                            </div>

                            <div className="mt-3 text-lg font-black" style={{ color: THEME.navy }}>
                              {a.title || `${a.alert_type} alert`}
                            </div>
                            <div className="mt-1 text-sm font-bold" style={{ color: THEME.text2 }}>
                              {a.hospital_name || a.hospital?.name || a.hospital || '—'}
                            </div>
                            <div className="mt-3 text-sm font-semibold" style={{ color: THEME.text }}>
                              {a.description || a.message || '—'}
                            </div>

                            {a.meta_data && typeof a.meta_data === 'object' && (
                              <div className="mt-4 bg-gray-50 rounded-2xl p-4 border" style={{ borderColor: THEME.border }}>
                                <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: THEME.text2 }}>meta_data</div>
                                <div className="mt-2 grid md:grid-cols-2 gap-2 text-xs font-bold" style={{ color: THEME.text2 }}>
                                  {Object.entries(a.meta_data).slice(0, 8).map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between gap-3">
                                      <span className="font-black">{k}</span>
                                      <span className="font-mono text-[11px] text-right break-all">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 w-[220px]">
                            {a.status === 'open' && (
                              <button onClick={() => onInvestigate(a)} className="px-4 py-3 rounded-2xl text-xs font-black border hover:bg-gray-50 transition-all" style={{ borderColor: THEME.border, color: THEME.navy }}>
                                Mark Investigating
                              </button>
                            )}
                            {(a.status === 'open' || a.status === 'investigating') && (
                              <button onClick={() => onResolveOpen(a)} className="px-4 py-3 rounded-2xl text-xs font-black text-white transition-all hover:opacity-95" style={{ background: THEME.blue }}>
                                Resolve (note required)
                              </button>
                            )}
                            <button onClick={() => onDismiss(a)} className="px-4 py-3 rounded-2xl text-xs font-black border hover:bg-[#FADBD8]/40 transition-all" style={{ borderColor: THEME.severity.high.border, color: THEME.severity.high.text }}>
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {alerts.length === 0 && (
                  <div className="bg-white rounded-3xl p-10 border text-sm font-bold" style={{ borderColor: THEME.border, color: THEME.text2 }}>
                    No alerts found for the selected filters.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'corrections' && (
          <div className="space-y-8">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="text-3xl font-black hero-heading italic" style={{ color: THEME.navy }}>Record Correction</h2>
                <p className="text-sm font-bold" style={{ color: THEME.text2 }}>All corrections require a <span className="font-black">correction_reason</span> and auto-create a <span className="font-black">DATA_INCONSISTENCY</span> audit alert.</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Correction forms */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-[40px] p-6 border shadow-sm" style={{ borderColor: THEME.border }}>
                  <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl">
                    {[
                      ['bed', 'Correct Bed'],
                      ['patient', 'Correct Patient'],
                      ['allocation', 'Force Discharge'],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => setCorTab(id)}
                        className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${corTab === id ? 'bg-white text-[#1B4332]' : 'text-[#566573] hover:bg-white/60'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {corTab === 'bed' && (
                    <div className="mt-6 space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>bed_id</label>
                          <input value={bedCorrection.bed_id} onChange={(e) => setBedCorrection((s) => ({ ...s, bed_id: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-4 font-bold outline-none border" style={{ borderColor: THEME.border }} placeholder="uuid" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>status</label>
                          <select value={bedCorrection.status} onChange={(e) => setBedCorrection((s) => ({ ...s, status: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-4 font-bold outline-none border" style={{ borderColor: THEME.border }}>
                            {['available', 'occupied', 'maintenance', 'reserved'].map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>correction_reason (required)</label>
                        <textarea
                          value={bedCorrection.correction_reason}
                          onChange={(e) => setBedCorrection((s) => ({ ...s, correction_reason: e.target.value }))}
                          className="w-full mt-1 bg-gray-50 rounded-2xl p-4 font-bold outline-none border min-h-[120px]"
                          style={{ borderColor: bedCorrection.error && !bedCorrection.correction_reason.trim() ? THEME.severity.high.border : THEME.border }}
                          placeholder="Ex: Patient discharged 2 days ago, reception forgot to update"
                        />
                      </div>
                      {bedCorrection.error && <div className="text-xs font-black" style={{ color: THEME.severity.high.text }}>{bedCorrection.error}</div>}
                      <button
                        onClick={submitBedCorrection}
                        disabled={bedCorrection.loading}
                        className={`w-full py-4 rounded-2xl text-sm font-black text-white transition-all ${bedCorrection.loading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-95'}`}
                        style={{ background: THEME.blue }}
                      >
                        {bedCorrection.loading ? 'Submitting…' : 'Submit bed correction'}
                      </button>
                    </div>
                  )}

                  {corTab === 'patient' && (
                    <div className="mt-6 space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>patient_id</label>
                          <input value={patientCorrection.patient_id} onChange={(e) => setPatientCorrection((s) => ({ ...s, patient_id: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-4 font-bold outline-none border" style={{ borderColor: THEME.border }} placeholder="uuid" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>full_name</label>
                          <input value={patientCorrection.full_name} onChange={(e) => setPatientCorrection((s) => ({ ...s, full_name: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-4 font-bold outline-none border" style={{ borderColor: THEME.border }} placeholder="Corrected name" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>correction_reason (required)</label>
                        <textarea
                          value={patientCorrection.correction_reason}
                          onChange={(e) => setPatientCorrection((s) => ({ ...s, correction_reason: e.target.value }))}
                          className="w-full mt-1 bg-gray-50 rounded-2xl p-4 font-bold outline-none border min-h-[120px]"
                          style={{ borderColor: patientCorrection.error && !patientCorrection.correction_reason.trim() ? THEME.severity.high.border : THEME.border }}
                          placeholder="Ex: Name was misspelled on registration"
                        />
                      </div>
                      {patientCorrection.error && <div className="text-xs font-black" style={{ color: THEME.severity.high.text }}>{patientCorrection.error}</div>}
                      <button
                        onClick={submitPatientCorrection}
                        disabled={patientCorrection.loading}
                        className={`w-full py-4 rounded-2xl text-sm font-black text-white transition-all ${patientCorrection.loading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-95'}`}
                        style={{ background: THEME.blue }}
                      >
                        {patientCorrection.loading ? 'Submitting…' : 'Submit patient correction'}
                      </button>
                    </div>
                  )}

                  {corTab === 'allocation' && (
                    <div className="mt-6 space-y-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>allocation_id</label>
                        <input value={allocationCorrection.allocation_id} onChange={(e) => setAllocationCorrection((s) => ({ ...s, allocation_id: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-4 font-bold outline-none border" style={{ borderColor: THEME.border }} placeholder="uuid" />
                      </div>
                      <div className="bg-[#FADBD8] rounded-3xl p-5 border" style={{ borderColor: THEME.severity.high.border }}>
                        <div className="text-sm font-black" style={{ color: THEME.severity.high.text }}>This will discharge the patient and free the bed.</div>
                        <div className="text-xs font-bold mt-1" style={{ color: THEME.text2 }}>An audit alert will be created automatically.</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>correction_reason (required)</label>
                        <textarea
                          value={allocationCorrection.correction_reason}
                          onChange={(e) => setAllocationCorrection((s) => ({ ...s, correction_reason: e.target.value }))}
                          className="w-full mt-1 bg-gray-50 rounded-2xl p-4 font-bold outline-none border min-h-[120px]"
                          style={{ borderColor: allocationCorrection.error && !allocationCorrection.correction_reason.trim() ? THEME.severity.high.border : THEME.border }}
                          placeholder="Ex: Patient confirmed gone, bed stuck as occupied"
                        />
                      </div>
                      {allocationCorrection.error && <div className="text-xs font-black" style={{ color: THEME.severity.high.text }}>{allocationCorrection.error}</div>}
                      <button
                        onClick={submitAllocationCorrection}
                        disabled={allocationCorrection.loading}
                        className={`w-full py-4 rounded-2xl text-sm font-black text-white transition-all ${allocationCorrection.loading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-95'}`}
                        style={{ background: THEME.severity.high.border }}
                      >
                        {allocationCorrection.loading ? 'Submitting…' : 'Force discharge now'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Audit trail */}
              <div className="space-y-6">
                <div className="bg-white rounded-[40px] p-6 border shadow-sm" style={{ borderColor: THEME.border }}>
                  <div className="text-sm font-black" style={{ color: THEME.navy }}>Audit trail</div>
                  <div className="text-xs font-bold mt-1" style={{ color: THEME.text2 }}>DATA_INCONSISTENCY alerts for a hospital.</div>

                  <div className="mt-4">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>Hospital</label>
                    <select
                      value={(!isPlatformAdmin && myHospitalId) ? myHospitalId : selectedHospitalForAudit}
                      onChange={(e) => setSelectedHospitalForAudit(e.target.value)}
                      disabled={!isPlatformAdmin}
                      className={`w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none border ${!isPlatformAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                      style={{ borderColor: THEME.border }}
                    >
                      {isPlatformAdmin && <option value="all">Select hospital…</option>}
                      {hospitalOptions
                        .filter((h) => (isPlatformAdmin ? true : String(h.id) === String(myHospitalId)))
                        .map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>

                  <div className="mt-4">
                    <button onClick={() => loadAuditTrail()} className="w-full px-5 py-3 rounded-2xl text-xs font-black text-white" style={{ background: THEME.lightBlue }}>
                      Refresh audit trail
                    </button>
                  </div>

                  <div className="mt-6 space-y-3">
                    {auditLoading ? (
                      <div className="text-xs font-bold" style={{ color: THEME.text2 }}>Loading…</div>
                    ) : auditError ? (
                      <div className="text-xs font-black" style={{ color: THEME.severity.high.text }}>{auditError}</div>
                    ) : auditAlerts.length === 0 ? (
                      <div className="text-xs font-bold" style={{ color: THEME.text2 }}>No audit alerts for this hospital.</div>
                    ) : (
                      auditAlerts.slice(0, 10).map((a) => (
                        <div key={a.id} className="rounded-3xl p-4 border" style={{ borderColor: THEME.border }}>
                          <div className="text-xs font-black" style={{ color: THEME.navy }}>{a.title || a.alert_type}</div>
                          <div className="text-[11px] font-bold mt-1" style={{ color: THEME.text2 }}>{fmtAgo(a.created_at || a.created)}</div>
                          <div className="text-xs font-semibold mt-2" style={{ color: THEME.text }}>{a.description || '—'}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-8">
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h2 className="text-3xl font-black hero-heading italic" style={{ color: THEME.navy }}>Hospital Patient History</h2>
                <p className="text-sm font-bold" style={{ color: THEME.text2 }}>Admit / transfer / discharge events (hospital isolated).</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadHistory()}
                  className="px-5 py-3 rounded-2xl text-xs font-black text-white"
                  style={{ background: THEME.blue }}
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[40px] p-6 border shadow-sm" style={{ borderColor: THEME.border }}>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>From</label>
                  <input type="date" value={historyFilters.from_date} onChange={(e) => setHistoryFilters((f) => ({ ...f, from_date: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none border" style={{ borderColor: THEME.border }} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>To</label>
                  <input type="date" value={historyFilters.to_date} onChange={(e) => setHistoryFilters((f) => ({ ...f, to_date: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none border" style={{ borderColor: THEME.border }} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>Type</label>
                  <select value={historyFilters.type} onChange={(e) => setHistoryFilters((f) => ({ ...f, type: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none border" style={{ borderColor: THEME.border }}>
                    <option value="all">All</option>
                    <option value="admit">Admitted</option>
                    <option value="discharge">Discharged</option>
                    <option value="transfer_requested">Transfer requested</option>
                    <option value="transfer_accepted">Transfer accepted</option>
                    <option value="transfer_rejected">Transfer rejected</option>
                    <option value="transfer_completed">Transfer completed</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>Search</label>
                  <input value={historyFilters.search} onChange={(e) => setHistoryFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Patient name/phone/bed/hospital" className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none border" style={{ borderColor: THEME.border }} />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="text-xs font-bold" style={{ color: THEME.text2 }}>{historyLoading ? 'Loading…' : `${historyItems.length} events`}</div>
                <button onClick={() => loadHistory()} className="px-6 py-3 rounded-2xl text-xs font-black text-white" style={{ background: THEME.lightBlue }}>
                  Apply
                </button>
              </div>
              {historyError && <div className="mt-3 text-xs font-black" style={{ color: THEME.severity.high.text }}>{historyError}</div>}
            </div>

            <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden" style={{ borderColor: THEME.border }}>
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: THEME.border }}>
                <div className="text-sm font-black" style={{ color: THEME.navy }}>Events</div>
                <div className="text-xs font-bold" style={{ color: THEME.text2 }}>Click to open full detail</div>
              </div>
              {historyLoading ? (
                <div className="p-10 text-center text-sm font-bold" style={{ color: THEME.text2 }}>Loading history…</div>
              ) : historyItems.length === 0 ? (
                <div className="p-10 text-center text-sm font-bold" style={{ color: THEME.text2 }}>No events found.</div>
              ) : (
                <div className="divide-y" style={{ borderColor: THEME.border }}>
                  {historyItems.map((e, idx) => (
                    <button
                      key={`${e.source}-${e.source_id}-${idx}`}
                      onClick={() => openHistoryDetail(e)}
                      className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-all flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-[10px] font-black" style={{ background: THEME.sky, color: THEME.navy }}>
                            {String(e.kind || '').replaceAll('_', ' ')}
                          </span>
                          <span className="text-xs font-bold" style={{ color: THEME.text2 }}>
                            {e.occurred_at ? new Date(e.occurred_at).toLocaleString() : '—'}
                          </span>
                        </div>
                        <div className="text-sm font-black mt-1 truncate" style={{ color: THEME.text }}>
                          {e.patient?.full_name || 'Patient'} {e.patient?.phone ? `· ${e.patient.phone}` : ''}
                        </div>
                        <div className="text-xs font-bold mt-1 truncate" style={{ color: THEME.text2 }}>{e.summary || '—'}</div>
                      </div>
                      <div className="flex-shrink-0 text-xs font-black" style={{ color: THEME.text2 }}>View →</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="space-y-8 max-w-2xl mx-auto">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="text-3xl font-black hero-heading italic" style={{ color: THEME.navy }}>Staff Management</h2>
                <p className="text-sm font-bold" style={{ color: THEME.text2 }}>Register new receptionists for your hospital.</p>
              </div>
            </div>

            <div className="bg-white rounded-[40px] p-8 border shadow-sm" style={{ borderColor: THEME.border }}>
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>Email Address</label>
                  <input
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm(s => ({ ...s, email: e.target.value }))}
                    className="w-full mt-1 bg-gray-50 rounded-2xl p-4 font-bold outline-none border transition-all focus:border-[#40916C]"
                    style={{ borderColor:THEME.border }}
                    placeholder="reception@hospital.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>Password</label>
                  <input
                    type="password"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm(s => ({ ...s, password: e.target.value }))}
                    className="w-full mt-1 bg-gray-50 rounded-2xl p-4 font-bold outline-none border transition-all focus:border-[#40916C]"
                    style={{ borderColor: THEME.border }}
                    placeholder="Min. 8 characters"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>Hospital</label>
                  <select
                    value={(!isPlatformAdmin && myHospitalId) ? myHospitalId : staffForm.hospital}
                    onChange={(e) => setStaffForm(s => ({ ...s, hospital: e.target.value }))}
                    disabled={!isPlatformAdmin}
                    className={`w-full mt-1 bg-gray-50 rounded-2xl p-4 font-bold outline-none border ${!isPlatformAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                    style={{ borderColor: THEME.border }}
                  >
                    {isPlatformAdmin && <option value="all">Select hospital…</option>}
                    {hospitalOptions
                      .filter((h) => (isPlatformAdmin ? true : String(h.id) === String(myHospitalId)))
                      .map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                
                {staffForm.error && (
                  <div className="text-xs font-black p-4 rounded-2xl" style={{ background: THEME.severity.high.bg, color: THEME.severity.high.text, border: `1px solid ${THEME.severity.high.border}` }}>
                    {staffForm.error}
                  </div>
                )}
                
                <button
                  onClick={handleRegisterStaff}
                  disabled={staffForm.loading}
                  className={`w-full py-4 rounded-2xl text-sm font-black text-white transition-all ${staffForm.loading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-95 shadow-lg'}`}
                  style={{ background: THEME.navy }}
                >
                  {staffForm.loading ? 'Registering…' : 'Register Receptionist'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {historyDetail.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <div className="bg-white rounded-[40px] p-8 w-full max-w-3xl shadow-2xl border max-h-[90vh] overflow-y-auto" style={{ borderColor: THEME.border }}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-2xl font-black hero-heading italic" style={{ color: THEME.navy }}>History Detail</div>
                <div className="text-xs font-bold mt-1" style={{ color: THEME.text2 }}>
                  {historyDetail.item?.kind ? String(historyDetail.item.kind).replaceAll('_', ' ') : ''} · {historyDetail.item?.occurred_at ? new Date(historyDetail.item.occurred_at).toLocaleString() : ''}
                </div>
              </div>
              <button onClick={() => setHistoryDetail({ open: false, loading: false, error: '', item: null, detail: null })} className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-xl font-black">×</button>
            </div>

            {historyDetail.loading ? (
              <div className="py-16 text-center text-sm font-bold" style={{ color: THEME.text2 }}>Loading detail…</div>
            ) : historyDetail.error ? (
              <div className="py-10 text-center text-sm font-black" style={{ color: THEME.severity.high.text }}>{historyDetail.error}</div>
            ) : (
              <>
                <div className="rounded-[32px] p-6 border" style={{ borderColor: THEME.border, background: '#F8FAFC' }}>
                  <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: THEME.text2 }}>Summary</div>
                  <div className="text-sm font-black mt-2" style={{ color: THEME.text }}>{historyDetail.item?.summary || '—'}</div>
                  <div className="text-xs font-bold mt-1" style={{ color: THEME.text2 }}>
                    {historyDetail.item?.patient?.full_name || 'Patient'} {historyDetail.item?.patient?.phone ? `· ${historyDetail.item.patient.phone}` : ''}
                  </div>
                </div>
                <div className="mt-4 rounded-[32px] p-6 border" style={{ borderColor: THEME.border }}>
                  <div className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: THEME.text2 }}>Full Detail</div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.entries(historyDetail.detail?.data || historyDetail.detail || {})
                      .filter(([k]) => !['id', 'bed', 'patient', 'allocated_by'].includes(k))
                      .map(([k, v]) => (
                        <div key={k} className="flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: THEME.text2 }}>
                            {k.replaceAll('_', ' ')}
                          </span>
                          <span className="text-sm font-bold truncate" style={{ color: THEME.text }}>
                            {String(v).includes('T') && !isNaN(Date.parse(v)) 
                              ? new Date(v).toLocaleString()
                              : String(v)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Resolve modal */}
      {resolveModal.open && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[48px] p-10 w-full max-w-2xl shadow-2xl border" style={{ borderColor: THEME.border }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-black hero-heading italic" style={{ color: THEME.navy }}>Resolve Alert</div>
                <div className="text-xs font-bold mt-1" style={{ color: THEME.text2 }}>
                  A resolution note is mandatory.
                </div>
              </div>
              <button onClick={() => setResolveModal({ open: false, alert: null, note: '', error: '' })} className="w-12 h-12 rounded-2xl bg-gray-50 font-black text-xl" style={{ color: THEME.navy }}>
                ×
              </button>
            </div>

            <div className="mt-6">
              <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>resolution_note (required)</label>
              <textarea
                value={resolveModal.note}
                onChange={(e) => setResolveModal((m) => ({ ...m, note: e.target.value, error: '' }))}
                className="w-full mt-1 bg-gray-50 rounded-3xl p-5 font-bold outline-none border min-h-[160px]"
                style={{ borderColor: resolveModal.error ? THEME.severity.high.border : THEME.border }}
                placeholder="Ex: Visited hospital, confirmed patient present. Reception updated records."
              />
              {resolveModal.error && <div className="text-xs font-black mt-3" style={{ color: THEME.severity.high.text }}>{resolveModal.error}</div>}
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => setResolveModal({ open: false, alert: null, note: '', error: '' })} className="flex-1 py-4 rounded-2xl font-black border hover:bg-gray-50 transition-all" style={{ borderColor: THEME.border, color: THEME.navy }}>
                Cancel
              </button>
              <button onClick={onResolveSubmit} className="flex-1 py-4 rounded-2xl font-black text-white hover:opacity-95 transition-all" style={{ background: THEME.blue }}>
                Resolve alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-8 right-8 px-7 py-4 rounded-3xl shadow-2xl z-[300] font-black text-sm"
          style={{
            background: toast.type === 'error' ? THEME.severity.high.border : toast.type === 'warning' ? THEME.severity.medium.border : THEME.blue,
            color: 'white',
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default SupervisorPortalPage;
