import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../services/auth';
import { apiFetch } from '../services/api';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import SanjivniLogo from '../components/SanjivniLogo';
import '../css/styles.css';

const mapContainerStyle = { w: '100%', h: '400px' };

const ReceptionPortalPage = () => {
  const navigate = useNavigate();
  const user = Auth.user;
  const [activeTab, setActiveTab] = useState('patients');
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [patientArrivedAlert, setPatientArrivedAlert] = useState(null);
  // `admitForm.bed` stores a selected `bed_id` (string) from the live availability list.
  const [admitForm, setAdmitForm] = useState({ name: '', phone: '', age: '', condition: '', ward: 'general_ward', bed: '' });
  const [admitLookup, setAdmitLookup] = useState({ loading: false, error: '', found: null });
  const [recentPatients, setRecentPatients] = useState([]); // per-hospital local cache for fast re-entry
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [availableBeds, setAvailableBeds] = useState([]);
  const [availableBedsLoading, setAvailableBedsLoading] = useState(false);

  const normalizeWardSelection = (wardValue) => {
    const raw = String(wardValue || '').trim();
    const lower = raw.toLowerCase();
    // Backward compatibility for legacy UI values
    if (lower === 'general') return 'general_ward';
    if (lower === 'icu') return 'icu_ward';
    if (lower === 'emergency') return 'emergency';
    if (lower === 'pediatric') return 'picu';
    if (lower === 'ot') return 'icu_ward';
    return raw;
  };

  const filteredAvailableBeds = useMemo(() => {
    const selected = normalizeWardSelection(admitForm.ward);
    const selectedLower = String(selected || '').trim().toLowerCase();
    if (!selectedLower) return availableBeds;
    return availableBeds.filter((b) => {
      const wardType = String(b.ward_type || '').trim().toLowerCase();
      const bedType = String(b.bed_type || '').trim().toLowerCase();
      // Support both ward_type selections and special "bed:*" selections.
      if (selectedLower.startsWith('bed:')) {
        const wanted = selectedLower.slice(4);
        return bedType === wanted;
      }
      // Prefer ward_type match when present; fallback to bed_type for legacy values
      if (wardType) return wardType === selectedLower;
      if (selectedLower === 'icu_ward') return bedType === 'icu' || bedType === 'ventilator';
      if (selectedLower === 'general_ward') return bedType === 'general' || bedType === 'semi_pvt';
      if (selectedLower === 'emergency') return bedType === 'emergency';
      return true;
    });
  }, [availableBeds, admitForm.ward]);

  // Resource Sharing State
  const [resourceRequests, setResourceRequests] = useState([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceForm, setResourceForm] = useState({ 
    equipment_type: '', 
    quantity: 1, 
    priority: 'medium', 
    reason: '', 
    provider_hospital: '' 
  });

  const recentPatientsKey = useMemo(() => (
    user?.hospital ? `medgrid_recent_patients_${String(user.hospital)}` : 'medgrid_recent_patients_unknown'
  ), [user?.hospital]);


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

  const loadRecentPatients = () => {
    try {
      const raw = localStorage.getItem(recentPatientsKey);
      const list = raw ? JSON.parse(raw) : [];
      setRecentPatients(Array.isArray(list) ? list : []);
    } catch {
      setRecentPatients([]);
    }
  };

  const saveRecentPatient = (p) => {
    if (!p || !p.id) return;
    const entry = {
      id: p.id,
      full_name: p.full_name || p.name || '',
      phone: p.phone || '',
      age: p.age ?? '',
      updated_at: new Date().toISOString(),
    };
    setRecentPatients((prev) => {
      const next = [entry, ...prev.filter(x => x.id !== entry.id)].slice(0, 12);
      try { localStorage.setItem(recentPatientsKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const lookupPatientByPhone = async (phoneRaw) => {
    const phone = (phoneRaw || '').trim();
    if (!phone) return;
    setAdmitLookup({ loading: true, error: '', found: null });
    try {
      const res = await apiFetch(`/api/patients/search/?phone=${encodeURIComponent(phone)}`);
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data.detail || 'Lookup failed');
      const found = Array.isArray(data) ? data[0] : (data.results || [])[0];
      if (!found) {
        setAdmitLookup({ loading: false, error: 'No existing patient found for this phone.', found: null });
        return;
      }
      // Autofill basic details for faster revisit
      setAdmitForm((f) => ({
        ...f,
        name: found.full_name || f.name,
        age: (found.age !== undefined && found.age !== null) ? String(found.age) : f.age,
        phone,
      }));
      saveRecentPatient(found);
      setAdmitLookup({ loading: false, error: '', found });
    } catch (e) {
      setAdmitLookup({ loading: false, error: e.message || 'Lookup failed', found: null });
    }
  };

  const [bedStats, setBedStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  // Bed types from backend Bed.BedType choices — hardcoded to match exactly
  const BED_TYPES = [
    { id: 'icu',       label: 'ICU' },
    { id: 'general',   label: 'General Ward' },
    { id: 'ventilator',label: 'Ventilator' },
    { id: 'emergency', label: 'Emergency' },
    { id: 'private',   label: 'Private' },
    { id: 'semi_pvt',  label: 'Semi-Private' },
  ];
  // Ward categories match backend Bed.WardType choices (and special bed-type categories for filtering).
  const WARD_CATEGORIES = [
    { id: 'general_ward',   label: 'General Ward' },
    { id: 'icu_ward',       label: 'ICU Ward' },
    { id: 'emergency',      label: 'Emergency Ward' },
    { id: 'private_room',   label: 'Private Room' },
    { id: 'nicu',           label: 'NICU' },
    { id: 'picu',           label: 'PICU' },
    { id: 'bed:ventilator', label: 'Ventilator (bed type)' },
    { id: 'bed:semi_pvt',   label: 'Semi-Private (bed type)' },
  ];
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [doctorForm, setDoctorForm] = useState({ full_name: '', registration_no: '', specialization: 'general', phone: '', email: '', experience_years: '', status: 'active', department: '' });
  const [transferPatient, setTransferPatient] = useState(null);
  const [transferForm, setTransferForm] = useState({ priority: 'high', reason: '', required_bed_type: 'general', notes: '', destination_hospital: '' });
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [searchingHospitals, setSearchingHospitals] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  const [newTransferAlert, setNewTransferAlert] = useState(null);
  const [announceTransfers, setAnnounceTransfers] = useState(() => {
    try { return localStorage.getItem('medgrid_announce_transfers') === '1'; } catch { return false; }
  });
  const lastSpokenTransferId = useRef(null);
  const transferSpeakTimerRef = useRef(null);
  const currentTransferAlertRef = useRef(null);

  const speakTransferAlert = (q) => {
    if (!q) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const parts = [];
    parts.push('New incoming patient transfer.');
    if (q.from_hospital_name) parts.push(`From ${q.from_hospital_name}.`);
    if (q.patient_name) parts.push(`Patient ${q.patient_name}.`);
    if (q.required_bed_type) parts.push(`${q.required_bed_type} bed required.`);
    if (q.priority) parts.push(`Priority ${q.priority}.`);
    const text = parts.join(' ');

    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      u.pitch = 1.0;
      u.volume = 1.0;
      const voices = synth.getVoices?.() || [];
      const preferred = voices.find(v => /en/i.test(v.lang) && /female|zira|susan|neural/i.test(v.name)) || voices.find(v => /en/i.test(v.lang));
      if (preferred) u.voice = preferred;
      synth.speak(u);
    } catch {
      // ignore speech failures (browser permissions / no voices)
    }
  };

  const stopTransferAnnouncements = () => {
    if (transferSpeakTimerRef.current) {
      clearTimeout(transferSpeakTimerRef.current);
      transferSpeakTimerRef.current = null;
    }
    try {
      if (typeof window !== 'undefined') {
        window?.speechSynthesis?.cancel?.();
      }
    } catch {}
  };

  const startTransferAnnouncements = (q) => {
    if (!announceTransfers || !q) return;
    currentTransferAlertRef.current = q;
    lastSpokenTransferId.current = q.id;

    const loop = () => {
      if (!announceTransfers) {
        stopTransferAnnouncements();
        return;
      }
      const active = currentTransferAlertRef.current;
      if (!active || String(active.id) !== String(q.id)) {
        stopTransferAnnouncements();
        return;
      }
      speakTransferAlert(q);
      transferSpeakTimerRef.current = setTimeout(loop, 8000);
    };

    stopTransferAnnouncements();
    loop();
  };

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
  const prevQueueIds = useRef(new Set());

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    loadRecentPatients();
    loadPatients();
    loadDashboardData();

    // Poll for live bed status and queue (keeps destination portal updated without reload)
    const interval = setInterval(() => {
      loadDashboardData(true); // silent fetch
      loadPatients(true);
    }, 8000);

    const onFocus = () => {
      // Refresh immediately when user returns to tab/window.
      loadDashboardData(true);
      loadPatients(true);
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    if (!announceTransfers) return;
    if (!newTransferAlert?.id) return;
    if (String(lastSpokenTransferId.current) === String(newTransferAlert.id)) return;
    startTransferAnnouncements(newTransferAlert);
  }, [announceTransfers, newTransferAlert]);

  const loadResourceRequests = async (silent = false) => {
    if (!user?.hospital) return;
    if (!silent) setResourceLoading(true);
    try {
      const res = await apiFetch('/api/resources/requests/');
      if (res.ok) {
        const data = await res.json();
        setResourceRequests(Array.isArray(data) ? data : data.results || []);
      }
    } catch (e) {
      console.error('Failed to load resource requests', e);
    }
    if (!silent) setResourceLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'resources') {
      loadResourceRequests();
    }
  }, [activeTab]);

  // When opening the Incoming Transfers tab, refresh instantly.
  useEffect(() => {
    if (activeTab === 'queue') {
      loadDashboardData(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const qs = new URLSearchParams();
      if (historyFilters.from_date) qs.set('from_date', historyFilters.from_date);
      if (historyFilters.to_date) qs.set('to_date', historyFilters.to_date);
      if (historyFilters.type && historyFilters.type !== 'all') qs.set('type', historyFilters.type);
      if (historyFilters.search) qs.set('search', historyFilters.search);
      qs.set('limit', '250');
      const res = await apiFetch(`/api/patients/history/?${qs.toString()}`);
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

  const loadDashboardData = async (silent = false) => {
    if (!user?.hospital) return;
    if (!silent) setLoadingDashboard(true);
    try {
      const [bedsRes, queueRes, docsRes, deptsRes] = await Promise.all([
        apiFetch(`/api/beds/availability/${user.hospital}/`),
        apiFetch('/api/patients/transfers/incoming/?status=pending'),
        apiFetch(`/api/hospitals/${user.hospital}/doctors/`),
        apiFetch(`/api/hospitals/${user.hospital}/departments/`)
      ]);
      if (bedsRes.ok) setBedStats(await bedsRes.json());
      if (queueRes.ok) {
        let qData = await queueRes.json();
        const newQueue = Array.isArray(qData) ? qData : qData.results || [];
        setQueue(newQueue);

        // Check for new transfers in silent background polling
        if (silent) {
          const newCurrentIds = new Set(newQueue.map(q => q.id));
          for (const q of newQueue) {
            if (!prevQueueIds.current.has(q.id)) {
              // Found a new transfer request
              setNewTransferAlert(q);
              break; 
            }
          }
          prevQueueIds.current = newCurrentIds;
        } else {
          prevQueueIds.current = new Set(newQueue.map(q => q.id));
        }
      }
      if (docsRes.ok) {
        let dData = await docsRes.json();
        setDoctors(Array.isArray(dData) ? dData : dData.results || []);
      }
      if (deptsRes.ok) {
        let dData = await deptsRes.json();
        setDepartments(Array.isArray(dData) ? dData : dData.results || []);
      }
    } catch {}
    setLoadingDashboard(false);
  };

  const loadPatients = async (silent = false) => {
    if (!user?.hospital) return;
    if (!silent) setLoadingPatients(true);
    try {
      const res = await apiFetch(`/api/patients/hospital/${user.hospital}/`);
      if (res.ok) {
        const data = await res.json();
        const mapped = (Array.isArray(data) ? data : data.results || []).map((p) => ({
          id: p.id,
          name: p.full_name,
          age: p.age,
          ward: p.current_admission?.ward_type || '—',
          bed: p.current_admission?.bed_number || '—',
          condition: p.chronic_conditions || 'Admitted',
          status: p.transfer_status || (p.is_admitted ? 'Admitted' : 'Discharged'),
          allocationId: p.current_admission?.allocation_id || null,
        }));
        setPatients(mapped);
      }
    } catch {
      // keep current state on failure
    }
    if (!silent) setLoadingPatients(false);
  };

  const handleLogout = async () => { await Auth.logout(); navigate('/'); };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadAvailableBeds = async (silent = false) => {
    if (!user?.hospital) return;
    if (!silent) setAvailableBedsLoading(true);
    try {
      const res = await apiFetch(`/api/beds/hospital/${user.hospital}/?status=available&ordering=bed_number`);
      if (res.ok) {
        const data = await res.json();
        const beds = Array.isArray(data) ? data : data.results || [];
        setAvailableBeds(beds);
      }
    } catch {
      // keep last known list
    }
    if (!silent) setAvailableBedsLoading(false);
  };

  useEffect(() => {
    if (!showAdmitModal) return;
    loadAvailableBeds();
    const t = setInterval(() => loadAvailableBeds(true), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdmitModal]);

  const handleAdmit = async (e) => {
    e.preventDefault();
    if (!user?.hospital) {
      showToast('Your user account is not linked to a hospital.');
      return;
    }

    try {
      // Step 1: find existing patient by phone
      let patientId = null;
      const phone = admitForm.phone.trim();
      let foundPatient = null;

      if (phone) {
        try {
          const searchRes = await apiFetch(`/api/patients/search/?phone=${encodeURIComponent(phone)}`);
          if (searchRes.ok) {
            const found = await searchRes.json();
            if (Array.isArray(found) && found.length > 0) {
              patientId = found[0].id;
              foundPatient = found[0];
            }
          }
        } catch {
          // ignore search errors, we will register a new patient
        }
      }

      // Step 2: register patient if not found
      if (!patientId) {
        const registerBody = {
          full_name: admitForm.name,
          phone: phone || undefined,
          age: admitForm.age ? parseInt(admitForm.age, 10) : undefined,
        };
        const regRes = await apiFetch('/api/patients/register/', {
          method: 'POST',
          body: JSON.stringify(registerBody),
        });
        if (!regRes.ok) {
          const err = await regRes.json().catch(() => ({}));
          const msg = err.detail || 'Failed to register patient';
          showToast(msg);
          return;
        }
        const reg = await regRes.json();
        patientId = reg.id;
        foundPatient = reg;
      }

      // Save to local "recent patients" cache for fast revisit.
      saveRecentPatient(foundPatient || { id: patientId, full_name: admitForm.name, phone, age: admitForm.age });

      // Step 3: pick selected bed (filtered by ward) or use freshest availability
      let targetBed = null;
      if (admitForm.bed) {
        targetBed = filteredAvailableBeds.find((b) => String(b.id) === String(admitForm.bed)) || null;
      }
      if (!targetBed) {
        const bedsRes = await apiFetch(`/api/beds/hospital/${user.hospital}/?status=available&ordering=bed_number`);
        if (!bedsRes.ok) {
          showToast('Could not fetch available beds.');
          return;
        }
        const bedList = await bedsRes.json();
        const beds = Array.isArray(bedList) ? bedList : bedList.results || [];
        setAvailableBeds(beds);
        const selected = normalizeWardSelection(admitForm.ward);
        const selectedLower = String(selected || '').trim().toLowerCase();
        const bedsInWard = selectedLower
          ? beds.filter((b) => {
              const wardType = String(b.ward_type || '').trim().toLowerCase();
              const bedType = String(b.bed_type || '').trim().toLowerCase();
              if (selectedLower.startsWith('bed:')) {
                const wanted = selectedLower.slice(4);
                return bedType === wanted;
              }
              if (wardType) return wardType === selectedLower;
              if (selectedLower === 'icu_ward') return bedType === 'icu' || bedType === 'ventilator';
              if (selectedLower === 'general_ward') return bedType === 'general' || bedType === 'semi_pvt';
              if (selectedLower === 'emergency') return bedType === 'emergency';
              return true;
            })
          : beds;

        if (bedsInWard.length === 0) {
          showToast('No available beds in this hospital.');
          return;
        }
        targetBed = bedsInWard[0];
      }

      // Step 4: admit patient to selected bed
      const admitRes = await apiFetch('/api/beds/admit/', {
        method: 'POST',
        body: JSON.stringify({
          bed_id: targetBed.id,
          patient_id: patientId,
          notes: admitForm.condition || '',
        }),
      });

      if (!admitRes.ok) {
        const err = await admitRes.json().catch(() => ({}));
        const msg = err.detail || 'Failed to admit patient to bed';
        showToast(msg);
        loadAvailableBeds(true);
        return;
      }

      const admitData = await admitRes.json();
      const bedNumber = admitData.allocation?.bed_number || targetBed.bed_number || 'bed';

      showToast(`Patient admitted to ${bedNumber}`);
      setShowAdmitModal(false);
      setAdmitForm({ name: '', phone: '', age: '', condition: '', ward: 'general_ward', bed: '' });
      await loadPatients();
      loadDashboardData(); // Refetch bed statistics
    } catch {
      showToast('Something went wrong while admitting patient.');
    }
  };

  const handleDischarge = async (patient) => {
    if (!patient.allocationId) {
      showToast('No active bed allocation found for this patient.');
      return;
    }
    try {
      const res = await apiFetch('/api/beds/discharge/', {
        method: 'POST',
        body: JSON.stringify({ allocation_id: patient.allocationId, notes: 'Discharged via reception portal' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.detail || 'Failed to discharge patient';
        showToast(msg);
        return;
      }
      showToast('Patient discharged.');
      await loadPatients();
      loadDashboardData(); // Refresh bed counts
    } catch {
      showToast('Something went wrong while discharging patient.');
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    let targetPatientId = transferPatient?.id || (transferForm.is_new_patient ? null : transferForm.patient_id);
    
    try {
      // Step 1: Register if new patient
      if (transferForm.is_new_patient) {
        if (!transferForm.new_patient_name || !transferForm.new_patient_phone) {
          showToast('Name and Phone are required for new patients.');
          return;
        }
        const regRes = await apiFetch('/api/patients/', {
          method: 'POST',
          body: JSON.stringify({
            full_name: transferForm.new_patient_name,
            phone: transferForm.new_patient_phone,
            age: transferForm.new_patient_age || 0,
            gender: 'other',
            hospital: user.hospital
          })
        });
        if (regRes.ok) {
          const newP = await regRes.json();
          targetPatientId = newP.id;
        } else {
          showToast('Failed to register new patient.');
          return;
        }
      }

      if (!targetPatientId) {
        showToast('Please select a patient to transfer.');
        return;
      }

      const payload = {
        patient: targetPatientId,
        priority: transferForm.priority,
        reason: transferForm.reason,
        required_bed_type: transferForm.required_bed_type,
        notes: transferForm.notes,
        destination_hospital: transferForm.destination_hospital
      };
      const res = await apiFetch('/api/patients/transfers/create/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Transfer request initiated.');
        setShowTransferModal(false);
        setTransferForm({ priority: 'high', reason: '', required_bed_type: 'general', notes: '', destination_hospital: '' });
        // Auto refresh sender portal immediately
        await loadPatients();
        loadDashboardData(true);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || err.error || 'Failed to initiate transfer');
      }
    } catch {
      showToast('Network error while requesting transfer.');
    }
  };

  const handleOpenTransferModal = (patient = null) => {
    setTransferPatient(patient);
    setTransferForm({ 
      priority: 'high', reason: '', required_bed_type: 'general', notes: '', destination_hospital: '', patient_id: '',
      is_new_patient: false, new_patient_name: '', new_patient_phone: '', new_patient_age: ''
    });
    setNearbyHospitals([]);
    setShowTransferModal(true);

    if (navigator.geolocation) {
      setSearchingHospitals(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            setCurrentLocation({ lat: latitude, lng: longitude });
            const res = await apiFetch(`/api/hospitals/search/?lat=${latitude}&lng=${longitude}&radius=50`);
            if (res.ok) {
              const data = await res.json();
              // Filter out the current hospital from the nearby list
              const others = (data.results || data).filter(h => h.id !== user?.hospital);
              setNearbyHospitals(others);
            }
          } catch (e) {
            console.error('Error fetching nearby hospitals', e);
          }
          setSearchingHospitals(false);
        },
        (error) => {
          console.error('Geolocation error', error);
          setSearchingHospitals(false);
          showToast('Enable location to find nearby hospitals.');
        }
      );
    } else {
      showToast('Geolocation is not supported by this browser.');
    }
  };

  const handleAcceptTransfer = async (q) => {
    try {
        const res = await apiFetch(`/api/patients/transfers/${q.id}/respond/`, {
            method: 'POST',
            body: JSON.stringify({ action: 'accept', notes: 'Accepting via portal' })
        });
        if (res.ok) {
            // Auto-complete the transfer (discharges from old hospital)
            const compRes = await apiFetch(`/api/patients/transfers/${q.id}/complete/`, { method: 'POST' });
            
            if (compRes.ok) {
                // Auto-admit to a bed
                const bedsRes = await apiFetch(`/api/beds/hospital/${user.hospital}/?status=available`);
                if (bedsRes.ok) {
                    const bedList = await bedsRes.json();
                    const beds = Array.isArray(bedList) ? bedList : bedList.results || [];
                    
                    // Map required_bed_type (BedType) to ward_type (WardType) on beds table
                    const preferredWards = { 
                        'icu':       'icu_ward', 
                        'general':   'general_ward', 
                        'ventilator':'icu_ward',     // ventilator patients go to ICU ward
                        'emergency': 'emergency', 
                        'private':   'private_room', 
                        'semi_pvt':  'general_ward' 
                    };
                    const wardTarget = preferredWards[(q.required_bed_type || '').toLowerCase()] || 'general_ward';
                    const targetBed = beds.find(b => b.ward_type === wardTarget) 
                                   || beds.find(b => b.ward_type === 'general_ward') 
                                   || beds[0];

                    if (targetBed) {
                        await apiFetch('/api/beds/admit/', {
                            method: 'POST',
                            body: JSON.stringify({ 
                                bed_id: targetBed.id, 
                                patient_id: q.patient, 
                                notes: q.reason || 'Auto-admitted from transfer' 
                            })
                        });
                    }
                }
            }

            showToast('Transfer accepted & patient received successfully.');
            loadDashboardData();
            loadPatients();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.detail || err.error || 'Failed to accept transfer.');
        }
    } catch {
        showToast('Network error.');
    }
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    if (!user?.hospital) return;
    try {
      // Find the department ID string
      const selectedDept = departments.find(d => d.name === doctorForm.department);
      const payload = { ...doctorForm, department: selectedDept?.id || null };
      
      if (!payload.email) delete payload.email;
      if (!payload.phone) delete payload.phone;
      payload.experience_years = payload.experience_years ? parseInt(payload.experience_years, 10) : 0;
      
      const res = await apiFetch(`/api/hospitals/${user.hospital}/doctors/`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Doctor added successfully.');
        setShowAddDoctorModal(false);
        setDoctorForm({ full_name: '', registration_no: '', specialization: 'general', phone: '', email: '', experience_years: '', status: 'active', department: '' });
        loadDashboardData(true); // refresh doctors list silently
      } else {
        const err = await res.json().catch(() => ({}));
        // Display validation errors nicely
        const errMsgs = Object.entries(err).map(([k, v]) => `${k}: ${v}`).join(' | ');
        showToast(errMsgs || err.detail || 'Failed to add doctor');
      }
    } catch {
      showToast('Network error while adding doctor.');
    }
  };

  const handleToggleDoctorStatus = async (doctor) => {
    try {
      const newStatus = doctor.status === 'active' ? 'inactive' : 'active';
      const res = await apiFetch(`/api/hospitals/doctors/${doctor.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Doctor ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
        loadDashboardData(true);
      } else {
        showToast('Failed to change doctor status.');
      }
    } catch {
      showToast('Network error while changing doctor status.');
    }
  };

  const handleResourceRequestSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...resourceForm };
      if (!payload.provider_hospital) delete payload.provider_hospital;
      payload.quantity = Number.isFinite(Number(payload.quantity)) ? Number(payload.quantity) : 1;

      const res = await apiFetch('/api/resources/requests/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Resource request sent successfully.');
        setShowResourceModal(false);
        setResourceForm({ equipment_type: '', quantity: 1, priority: 'medium', reason: '', provider_hospital: '' });
        loadResourceRequests();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Failed to send request.');
        console.error('Resource Request Error:', err);
      }
    } catch {
      showToast('Network error.');
    }
  };

  const handleResourceAction = async (id, action, rejectionReason = '') => {
    try {
      const res = await apiFetch(`/api/resources/requests/${id}/respond/`, {
        method: 'PATCH',
        body: JSON.stringify({ action, rejection_reason: rejectionReason })
      });
      if (res.ok) {
        showToast(`Request ${action}ed.`);
        loadResourceRequests();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || `Failed to ${action} request.`);
      }
    } catch {
      showToast('Network error.');
    }
  };

  const filtered = patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.condition || '').toLowerCase().includes(search.toLowerCase()));
  const filteredDoctors = doctors.filter(d => d.full_name?.toLowerCase().includes(search.toLowerCase()) || d.specialization?.toLowerCase().includes(search.toLowerCase()));

  const statusColor = { 'Admitted': 'bg-blue-50 text-blue-600', 'Under Observation': 'bg-yellow-50 text-yellow-600', 'Critical': 'bg-red-50 text-red-600', 'Stable': 'bg-green-50 text-green-600' };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#FDFCF7', minHeight: '100vh' }}>
      <style>{`
        .hero-heading { font-family: 'Playfair Display', serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(27, 67, 50, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(27, 67, 50, 0.2); }
      `}</style>

      {/* Topbar */}
      <header style={{ background: 'rgba(253,252,247,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(27,67,50,0.1)', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}>
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SanjivniLogo size={40} />
            <span className="text-xl font-black text-[#1B4332] max-w-[200px] truncate" title={user?.hospitalName || 'SANJIVNI'}>
              {user?.hospitalName || 'SANJIVNI'} <span className="text-gray-400 font-medium text-sm">· Reception</span>
            </span>
          </div>
          <div className="flex gap-2">
            {[['patients', '🧑‍🤝‍🧑 Patients'], ['beds', '🛏️ Bed Status'], ['doctors', '👨‍⚕️ Doctors'], ['resources', '📦 Resources'], ['queue', '⏳ Queue'], ['history', '🧾 History']].map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)} className={`relative px-4 py-2 rounded-full text-sm font-bold transition-all ${activeTab === id ? 'bg-[#1B4332] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                {label}
                {id === 'queue' && queue.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-md animate-pulse">
                    {queue.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/triage-dashboard')} className="text-sm font-bold text-red-600 bg-red-50 rounded-full px-4 py-1.5 border border-red-100 shadow-sm hover:bg-red-100 transition-all flex items-center gap-2">
              🚨 Live Triage
            </button>
            <button 
              onClick={() => setShowProfileModal(true)}
              className="text-sm font-bold text-gray-900 bg-white rounded-full px-4 py-1.5 border border-gray-100 shadow-sm hover:bg-gray-50 transition-all"
            >
              {user?.name || 'Reception Staff'}
            </button>
            <button onClick={handleLogout} className="text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-full">Sign Out</button>
          </div>
        </div>
      </header>

      <div className="pt-24 max-w-7xl mx-auto px-8 py-8">
        {/* Patients Tab */}
        {activeTab === 'patients' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic">Patient Registry</h1>
                <p className="text-gray-400 font-medium">
                  {loadingPatients ? 'Loading patients...' : `${filtered.length} active patients`}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleOpenTransferModal()} className="bg-white border-2 border-[#1B4332] text-[#1B4332] px-6 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-sm">Transfer Patient</button>
                <button onClick={() => setShowAdmitModal(true)} className="bg-[#1B4332] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#2D6A4F] transition-all shadow-lg">+ Admit Patient</button>
              </div>
            </div>
            <div className="relative">
              <input type="text" placeholder="Search patients..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-4 pl-12 text-sm outline-none shadow-sm" />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-gray-50">{['Patient', 'Age', 'Ward', 'Bed', 'Condition', 'Status', 'Actions'].map(h => <th key={h} className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest px-6 py-4">{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-all">
                      <td className="px-6 py-4 font-bold text-gray-900">{p.name}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{p.age}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{p.ward}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm font-mono">{p.bed}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{p.condition}</td>
                      <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-[10px] font-black ${statusColor[p.status] || 'bg-gray-50 text-gray-600'}`}>{p.status}</span></td>
                      <td className="px-6 py-4">
                        {p.status === 'Transferred' ? (
                          <div className="flex gap-2">
                            <span className="px-3 py-1.5 bg-yellow-50 text-yellow-600 rounded-lg text-xs font-bold w-full text-center border border-yellow-100 italic">
                              Transferred out
                            </span>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {p.status === 'Admitted' && (
                              <button onClick={() => handleOpenTransferModal(p)} className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold hover:bg-purple-100">Transfer</button>
                            )}
                            <button onClick={() => handleDischarge(p)} className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100">Discharge</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Beds Tab */}
        {activeTab === 'beds' && (
          <div className="space-y-6">
            <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic">Bed Status</h1>
            {loadingDashboard ? (
              <p className="text-gray-400 font-medium">Loading bed numbers...</p>
            ) : bedStats && Object.keys(bedStats.by_type || {}).length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(bedStats.by_type).map(([typeKey, stats]) => {
                  const colorMap = { icu: 'bg-red-400', general: 'bg-blue-400', emergency: 'bg-yellow-400', ventilator: 'bg-purple-400' };
                  const labelMap = { icu: 'ICU', general: 'General Ward', emergency: 'Emergency', ventilator: 'Ventilator' };
                  const color = colorMap[typeKey.toLowerCase()] || 'bg-gray-400';
                  const total = Math.max(stats.total || 0, 1);
                  return (
                    <div key={typeKey} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white font-bold text-lg mb-4`}>🛏️</div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{labelMap[typeKey.toLowerCase()] || typeKey}</p>
                      <p className="text-3xl font-black text-gray-900">{stats.occupied || 0}/{stats.total || 0}</p>
                      <div className="mt-3 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className={`${color} h-full rounded-full`} style={{ width: `${((stats.occupied || 0) / total) * 100}%` }}></div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{stats.available || 0} available</p>
                    </div>
                  );
                })}
              </div>
            ) : (
               <p className="text-gray-400 font-medium">No bed statistics available for this hospital.</p>
            )}
          </div>
        )}

        {/* Doctors Tab */}
        {activeTab === 'doctors' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic">Medical Staff</h1>
                <p className="text-gray-400 font-medium">
                  {loadingDashboard ? 'Loading doctors...' : `${doctors.length} registered doctors`}
                </p>
              </div>
              <button onClick={() => setShowAddDoctorModal(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg">+ Add Doctor</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
               <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
                 <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl font-bold">👨‍⚕️</div>
                 <div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight">Total Doctors</p>
                   <p className="text-3xl font-black text-gray-900">{doctors.length}</p>
                 </div>
               </div>
               <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
                 <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-2xl font-bold">✅</div>
                 <div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight">Active duty</p>
                   <p className="text-3xl font-black text-gray-900">{doctors.filter(d => d.status === 'active').length}</p>
                 </div>
               </div>
               <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
                 <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-2xl font-bold">🏥</div>
                 <div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight">Departments</p>
                   <p className="text-3xl font-black text-gray-900">{departments.length}</p>
                 </div>
               </div>
            </div>

            <div className="relative">
              <input type="text" placeholder="Search doctors..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-4 pl-12 text-sm outline-none shadow-sm" />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-gray-50">{['Name', 'Reg No', 'Specialty', 'Department', 'Phone', 'Status', 'Actions'].map(h => <th key={h} className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest px-6 py-4">{h}</th>)}</tr></thead>
                <tbody>
                  {filteredDoctors.map(d => (
                    <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50 transition-all">
                      <td className="px-6 py-4 font-bold text-gray-900">{d.full_name}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm font-mono">{d.registration_no || '—'}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{d.specialization}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{d.department_name || '—'}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{d.phone}</td>
                      <td className="px-6 py-4">
                         <span className={`px-3 py-1 rounded-full text-[10px] font-black ${d.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                           {d.status?.toUpperCase()}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                         <button onClick={() => handleToggleDoctorStatus(d)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${d.status === 'active' ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                           {d.status === 'active' ? 'Deactivate' : 'Activate'}
                         </button>
                      </td>
                    </tr>
                  ))}
                  {filteredDoctors.length === 0 && (
                    <tr><td colSpan="7" className="text-center py-8 text-gray-400 font-bold">No doctors found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Global Modal for New Incoming Transfers */}
        {newTransferAlert && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-6 transition-all duration-300">
            <div className="bg-white rounded-[48px] p-12 w-full max-w-lg shadow-2xl relative border-4 border-red-500 overflow-hidden animate-pulse">
              <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
              <h3 className="text-4xl font-black text-red-600 hero-heading italic mb-4">🚨 New Incoming Transfer!</h3>
              
              <div className="space-y-4 mb-8">
                <div className="bg-red-50 p-6 rounded-3xl">
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Patient Details</p>
                  <p className="text-2xl font-black text-gray-900">{newTransferAlert.patient_name || 'Unknown Patient'}</p>
                  <div className="flex flex-wrap gap-2 mt-2 mb-3">
                    {newTransferAlert.patient_age && <span className="px-2 py-0.5 bg-white rounded-md text-xs font-bold text-gray-600 border border-red-100">{newTransferAlert.patient_age} yrs</span>}
                    {newTransferAlert.patient_gender && <span className="px-2 py-0.5 bg-white rounded-md text-xs font-bold text-gray-600 border border-red-100 capitalize">{newTransferAlert.patient_gender}</span>}
                    {newTransferAlert.patient_blood_group && <span className="px-2 py-0.5 bg-white rounded-md text-xs font-bold text-gray-600 border border-red-100">{newTransferAlert.patient_blood_group}</span>}
                    {newTransferAlert.patient_phone && <span className="px-2 py-0.5 bg-white rounded-md text-xs font-bold text-gray-600 border border-red-100 font-mono">{newTransferAlert.patient_phone}</span>}
                  </div>
                  <p className="font-bold text-gray-500 mt-1">From: {newTransferAlert.from_hospital_name}</p>
                  <p className="font-bold text-gray-500">Reason: {newTransferAlert.reason || 'Not specified'}</p>
                  {newTransferAlert.patient_condition && <p className="font-bold text-gray-500">Condition: {newTransferAlert.patient_condition}</p>}
                  <div className="mt-4 flex gap-2">
                    <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-black uppercase">{newTransferAlert.priority}</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-black uppercase text-center min-w-[80px]">{newTransferAlert.required_bed_type || 'General'} Bed Needed</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    stopTransferAnnouncements();
                    handleAcceptTransfer(newTransferAlert);
                    setNewTransferAlert(null);
                  }} 
                  className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black hover:bg-red-600 transition-all shadow-lg text-lg"
                >
                  Accept & Admit Immediately
                </button>
                <button 
                  onClick={() => {
                    stopTransferAnnouncements();
                    setNewTransferAlert(null);
                  }} 
                  className="px-8 bg-gray-100 text-gray-500 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all font-mono"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resources Tab */}
        {activeTab === 'resources' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic">Resource Sharing</h1>
                <p className="text-gray-400 font-medium">Request or provide medical equipment across hospitals.</p>
              </div>
              <button 
                onClick={() => setShowResourceModal(true)} 
                className="bg-[#1B4332] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#2D6A4F] transition-all shadow-lg"
              >
                + Request Equipment
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* My Requests (Outgoing) */}
              <div className="space-y-4">
                <h3 className="text-xl font-black text-[#1B4332]">My Requests</h3>
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden custom-scrollbar max-h-[500px] overflow-y-auto">
                  {resourceRequests.filter(r => r.requester_hospital === user.hospital).length === 0 ? (
                    <div className="p-8 text-center text-gray-400 font-bold">No outgoing requests.</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {resourceRequests.filter(r => r.requester_hospital === user.hospital).map(r => (
                        <div key={r.id} className="p-6 hover:bg-gray-50 transition-all flex justify-between items-center group">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-black text-gray-900 text-lg">{r.equipment_type}</p>
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-500">Qty: {r.quantity}</span>
                            </div>
                            <p className="text-xs font-bold text-gray-400 mb-2">Provider: {r.provider_hospital_name || 'Broadcasting...'}</p>
                            <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                              r.status === 'received' || r.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' :
                              r.status === 'rejected' || r.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' :
                              'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                              {r.status}
                            </span>
                          </div>
                          {r.status === 'shipped' && (
                            <button 
                              onClick={() => handleResourceAction(r.id, 'receive')}
                              className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 shadow-sm transform group-hover:scale-105 transition-all"
                            >
                              Confirm Receipt
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Incoming Requests (For Approval) */}
              <div className="space-y-4">
                <h3 className="text-xl font-black text-[#1B4332]">Help Others</h3>
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden custom-scrollbar max-h-[500px] overflow-y-auto">
                  {resourceRequests.filter(r => r.requester_hospital !== user.hospital).length === 0 ? (
                    <div className="p-8 text-center text-gray-400 font-bold">No incoming requests.</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {resourceRequests.filter(r => r.requester_hospital !== user.hospital).map(r => (
                        <div key={r.id} className="p-6 hover:bg-gray-50 transition-all flex justify-between items-center group">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-black text-gray-900 text-lg">{r.equipment_type}</p>
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-500">Qty: {r.quantity}</span>
                            </div>
                            <p className="text-xs font-bold text-gray-400 mb-2">From: {r.requester_hospital_name}</p>
                            <div className="flex items-center gap-2">
                              {r.priority === 'critical' && <span className="animate-pulse">🚨</span>}
                              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                                r.priority === 'critical' ? 'bg-red-50 text-red-600 border-red-100' :
                                r.priority === 'high' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                'bg-blue-50 text-blue-600 border-blue-100'
                              }`}>
                                {r.priority} Priority
                              </span>
                              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border bg-gray-50 text-gray-500 border-gray-100`}>
                                {r.status}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-gray-500 mt-2 italic line-clamp-1">"{r.reason}"</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            {r.status === 'pending' && (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleResourceAction(r.id, 'accept')}
                                  className="px-4 py-2 bg-[#1B4332] text-white rounded-xl text-xs font-black hover:bg-[#2D6A4F] shadow-sm transform group-hover:scale-105 transition-all"
                                >
                                  Accept
                                </button>
                                <button 
                                  onClick={() => handleResourceAction(r.id, 'reject')}
                                  className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-black hover:bg-red-100 border border-red-100"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                            {r.status === 'accepted' && (
                              <button 
                                onClick={() => handleResourceAction(r.id, 'ship')}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 shadow-sm"
                              >
                                Dispatch Item
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Queue Tab (Incoming Transfers) */}
        {activeTab === 'queue' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic">Incoming Transfers</h1>
              <button
                type="button"
                onClick={() => {
                  setAnnounceTransfers((v) => {
                    const next = !v;
                    try { localStorage.setItem('medgrid_announce_transfers', next ? '1' : '0'); } catch {}
                    // On enable, speak a short test phrase (user gesture).
                    if (!v && next) {
                      speakTransferAlert({ patient_name: 'Transfer announcements enabled', from_hospital_name: '', required_bed_type: '', priority: '' });
                    } else {
                      stopTransferAnnouncements();
                    }
                    return next;
                  });
                }}
                className={`px-5 py-3 rounded-2xl text-xs font-black border transition-all ${announceTransfers ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                title="Announce new transfer alerts via speakers"
              >
                {announceTransfers ? '🔊 Announcements ON' : '🔈 Announcements OFF'}
              </button>
            </div>
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-4">
              {queue.length === 0 && <p className="text-gray-400 font-medium">No pending incoming transfers right now.</p>}
              {queue.map((q, i) => (
                <div key={q.id} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-all">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500">{i + 1}</div>
                  <div className="flex-1">
                    <p className="font-black text-gray-900">{q.patient_name || 'Unknown Patient'}</p>
                    <p className="text-xs text-gray-400">From: {q.from_hospital_name} | Requested: {new Date(q.requested_at).toLocaleTimeString()}</p>
                  </div>
                  <span className="text-sm">{q.priority === 'critical' ? '🔴' : q.priority === 'high' ? '🟠' : '🟡'}</span>
                  <span className="px-3 py-1 bg-gray-50 rounded-full text-xs font-bold text-gray-600 uppercase">{q.priority}</span>
                  <button
                    onClick={() => {
                      stopTransferAnnouncements();
                      handleAcceptTransfer(q);
                    }}
                    className="bg-[#1B4332] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#2D6A4F] transition-all"
                  >
                    Accept
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic">Patient History</h1>
                <p className="text-gray-400 font-medium">Daily + custom history for your hospital only.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => loadHistory()} className="bg-[#1B4332] text-white px-6 py-3 rounded-2xl font-bold hover:bg-[#2D6A4F] transition-all shadow-lg">
                  Refresh
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">From</p>
                  <input type="date" value={historyFilters.from_date} onChange={(e) => setHistoryFilters((f) => ({ ...f, from_date: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">To</p>
                  <input type="date" value={historyFilters.to_date} onChange={(e) => setHistoryFilters((f) => ({ ...f, to_date: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Type</p>
                  <select value={historyFilters.type} onChange={(e) => setHistoryFilters((f) => ({ ...f, type: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none">
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
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Search patient</p>
                  <input value={historyFilters.search} onChange={(e) => setHistoryFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Name / phone / bed / hospital..." className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-gray-500">{historyLoading ? 'Loading…' : `${historyItems.length} events`}</p>
                <button onClick={() => loadHistory()} className="px-6 py-3 rounded-2xl text-xs font-black text-white bg-[#1B4332] hover:bg-[#2D6A4F] transition-all">
                  Apply
                </button>
              </div>
              {historyError && <p className="text-sm font-bold text-red-500 mt-3">{historyError}</p>}
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                <p className="text-sm font-black text-gray-900">Events</p>
                <p className="text-xs font-bold text-gray-400">Click a row to view details</p>
              </div>
              {historyLoading ? (
                <div className="p-10 text-center text-gray-400 font-bold">Loading history…</div>
              ) : historyItems.length === 0 ? (
                <div className="p-10 text-center text-gray-400 font-bold">No events found for selected filters.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {historyItems.map((e, idx) => (
                    <button key={`${e.source}-${e.source_id}-${idx}`} onClick={() => openHistoryDetail(e)} className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-all flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-[10px] font-black bg-green-50 text-[#1B4332] border border-green-100">
                            {String(e.kind || '').replaceAll('_', ' ')}
                          </span>
                          <span className="text-xs font-bold text-gray-400">{e.occurred_at ? new Date(e.occurred_at).toLocaleString() : '—'}</span>
                        </div>
                        <p className="text-sm font-black text-gray-900 mt-1 truncate">{e.patient?.full_name || 'Patient'} {e.patient?.phone ? `· ${e.patient.phone}` : ''}</p>
                        <p className="text-xs font-bold text-gray-500 mt-1 truncate">{e.summary}</p>
                      </div>
                      <div className="flex-shrink-0 text-xs font-black text-gray-400">View →</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* History Detail Modal */}
      {historyDetail.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-center justify-center p-6">
          <div className="bg-white rounded-[36px] p-8 w-full max-w-3xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-2xl font-black text-[#1B4332] hero-heading italic">History Detail</h3>
                <p className="text-xs font-bold text-gray-400 mt-1">
                  {historyDetail.item?.kind ? String(historyDetail.item.kind).replaceAll('_', ' ') : ''} · {historyDetail.item?.occurred_at ? new Date(historyDetail.item.occurred_at).toLocaleString() : ''}
                </p>
              </div>
              <button onClick={() => setHistoryDetail({ open: false, loading: false, error: '', item: null, detail: null })} className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-xl font-black">×</button>
            </div>

            {historyDetail.loading ? (
              <div className="py-16 text-center text-gray-400 font-bold">Loading detail…</div>
            ) : historyDetail.error ? (
              <div className="py-10 text-center text-red-500 font-semibold">{historyDetail.error}</div>
            ) : (
              <>
                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Summary</p>
                  <p className="text-sm font-black text-gray-900">{historyDetail.item?.summary || '—'}</p>
                  <p className="text-xs text-gray-500 font-medium mt-1">
                    {historyDetail.item?.patient?.full_name || 'Patient'} {historyDetail.item?.patient?.phone ? `· ${historyDetail.item.patient.phone}` : ''}
                  </p>
                </div>
                <div className="mt-4 bg-white rounded-3xl p-6 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Full Detail</p>
                  
                  {historyDetail.detail?.source === 'allocation' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-2xl">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Bed Information</p>
                          <p className="text-sm font-bold text-gray-900">Bed {historyDetail.detail.data?.bed_number}</p>
                          <p className="text-xs text-gray-500 capitalize">{historyDetail.detail.data?.bed_type?.replaceAll('_', ' ')}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black mt-1 ${historyDetail.detail.data?.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                            {historyDetail.detail.data?.is_active ? 'ACTIVE' : 'DISCHARGED'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-2xl">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Admitted At</p>
                          <p className="text-sm font-bold text-gray-900">{new Date(historyDetail.detail.data?.admitted_at).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Discharged At</p>
                          <p className="text-sm font-bold text-gray-900">{historyDetail.detail.data?.discharged_at ? new Date(historyDetail.detail.data.discharged_at).toLocaleString() : '—'}</p>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Notes</p>
                        <p className="text-sm font-medium text-gray-700 italic">"{historyDetail.detail.data?.notes || 'No notes provided'}"</p>
                      </div>
                      <div className="flex items-center justify-between px-2 pt-2">
                        <p className="text-xs text-gray-400 font-bold">Allocated By: {historyDetail.detail.data?.allocated_by_name || 'System'}</p>
                        {historyDetail.detail.data?.duration_days > 0 && <p className="text-xs text-[#1B4332] font-black">Stay Duration: {historyDetail.detail.data.duration_days} days</p>}
                      </div>
                    </div>
                  )}

                  {historyDetail.detail?.source === 'transfer' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                         <div className="flex gap-2">
                           <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                             historyDetail.detail.data?.priority === 'critical' ? 'bg-red-50 text-red-600 border border-red-100' :
                             historyDetail.detail.data?.priority === 'high' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                             'bg-blue-50 text-blue-600 border border-blue-100'
                           }`}>
                             {historyDetail.detail.data?.priority} Priority
                           </span>
                           <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                             historyDetail.detail.data?.status === 'completed' ? 'bg-green-50 text-green-600' :
                             historyDetail.detail.data?.status === 'rejected' ? 'bg-red-50 text-red-600' :
                             'bg-yellow-50 text-yellow-600'
                           }`}>
                             {historyDetail.detail.data?.status}
                           </span>
                         </div>
                         <p className="text-[10px] font-bold text-gray-400">{historyDetail.detail.data?.response_time_minutes ? `Responded in ${historyDetail.detail.data.response_time_minutes}m` : 'Pending response'}</p>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                        <div className="flex justify-between border-b border-gray-200 pb-2">
                           <div>
                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">From Hospital</p>
                             <p className="text-xs font-black text-gray-900">{historyDetail.detail.data?.from_hospital_name}</p>
                           </div>
                           <div className="text-right">
                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">To Hospital</p>
                             <p className="text-xs font-black text-gray-900">{historyDetail.detail.data?.to_hospital_name || '—'}</p>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Requested By</p>
                            <p className="text-xs font-bold text-gray-700">{historyDetail.detail.data?.requested_by_name || '—'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Accepted By</p>
                            <p className="text-xs font-bold text-gray-700">{historyDetail.detail.data?.accepted_by_name || '—'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50/30 p-4 rounded-2xl border border-green-100/50">
                          <p className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-1">Reason for Transfer</p>
                          <p className="text-sm font-bold text-gray-900 leading-tight">{historyDetail.detail.data?.reason}</p>
                        </div>
                        <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100/50">
                          <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">Bed Required</p>
                          <p className="text-sm font-bold text-gray-900 uppercase">{historyDetail.detail.data?.required_bed_type?.replaceAll('_', ' ')}</p>
                        </div>
                      </div>

                      {historyDetail.detail.data?.rejection_reason && (
                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                          <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Rejection Reason</p>
                          <p className="text-sm font-bold text-gray-900">{historyDetail.detail.data.rejection_reason}</p>
                        </div>
                      )}

                      <div className="bg-gray-50 p-4 rounded-2xl">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Notes</p>
                        <p className="text-sm font-medium text-gray-700 italic">"{historyDetail.detail.data?.notes || 'No notes provided'}"</p>
                      </div>

                      <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 border-t border-gray-50">
                        <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Requested</p>
                          <p className="text-[10px] font-bold text-gray-600">{new Date(historyDetail.detail.data?.requested_at).toLocaleString()}</p>
                        </div>
                        {historyDetail.detail.data?.responded_at && (
                          <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Responded</p>
                            <p className="text-[10px] font-bold text-gray-600">{new Date(historyDetail.detail.data.responded_at).toLocaleString()}</p>
                          </div>
                        )}
                        {historyDetail.detail.data?.completed_at && (
                          <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Completed</p>
                            <p className="text-[10px] font-bold text-gray-600">{new Date(historyDetail.detail.data.completed_at).toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!historyDetail.detail?.source && (
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words text-gray-700">
                      {JSON.stringify(historyDetail.detail?.data || historyDetail.detail || {}, null, 2)}
                    </pre>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Admit Modal */}
      
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

        {showAdmitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-[32px] sm:rounded-[48px] p-8 sm:p-12 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-2xl sm:text-3xl font-black text-[#1B4332] hero-heading italic mb-8">Admit Patient</h3>
            <form onSubmit={handleAdmit} className="space-y-5">
              {/* Returning patient shortcut */}
              {recentPatients.length > 0 && (
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Recent patients</label>
                  <select
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) return;
                      const p = recentPatients.find(x => String(x.id) === String(id));
                      if (!p) return;
                      setAdmitForm((f) => ({
                        ...f,
                        name: p.full_name || f.name,
                        phone: p.phone || f.phone,
                        age: (p.age !== undefined && p.age !== null) ? String(p.age) : f.age,
                      }));
                      setAdmitLookup({ loading: false, error: '', found: p });
                    }}
                    className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900"
                  >
                    <option value="">Select a returning patient…</option>
                    {recentPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || 'Patient'} {p.phone ? `(${p.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Phone</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 9876543210"
                    value={admitForm.phone}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAdmitForm((f) => ({ ...f, phone: v }));
                      setAdmitLookup((s) => ({ ...s, error: '', found: null }));
                    }}
                    onBlur={() => lookupPatientByPhone(admitForm.phone)}
                    className="flex-1 mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => lookupPatientByPhone(admitForm.phone)}
                    className={`mt-1 px-4 rounded-2xl font-black text-xs text-white ${admitLookup.loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-[#2D6A4F]'}`}
                    style={{ background: '#1B4332' }}
                    disabled={admitLookup.loading}
                    title="Lookup patient history by phone"
                  >
                    {admitLookup.loading ? 'Looking…' : 'Lookup'}
                  </button>
                </div>
                {admitLookup.error && <p className="text-xs font-bold text-orange-600 mt-2">{admitLookup.error}</p>}
                {admitLookup.found && !admitLookup.error && (
                  <p className="text-xs font-black text-green-700 mt-2">
                    Existing patient found — details auto-filled.
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Full Name</label>
                <input type="text" required placeholder="Ex: John Doe" value={admitForm.name} onChange={e => setAdmitForm(f => ({ ...f, name: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Age</label>
                <input type="number" placeholder="25" value={admitForm.age} onChange={e => setAdmitForm(f => ({ ...f, age: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Condition</label>
                <input type="text" required placeholder="Ex: Cardiac Arrest" value={admitForm.condition} onChange={e => setAdmitForm(f => ({ ...f, condition: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">
                  Bed (available)
                </label>
                <select
                  value={admitForm.bed}
                  onChange={(e) => setAdmitForm((f) => ({ ...f, bed: e.target.value }))}
                  className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900"
                >
                  <option value="">
                    {availableBedsLoading
                      ? 'Loading beds…'
                      : (filteredAvailableBeds.length ? 'Auto-assign (first available in ward)' : 'No available beds in selected ward')}
                  </option>
                  {filteredAvailableBeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bed_number ? `Bed ${b.bed_number}` : 'Bed'}{b.bed_type ? ` · ${String(b.bed_type).toUpperCase()}` : ''}{b.ward_type ? ` · ${b.ward_type}` : ''}{b.department_name ? ` · ${b.department_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Ward</label>
                <select
                  value={admitForm.ward}
                  onChange={(e) => setAdmitForm((f) => ({ ...f, ward: e.target.value, bed: '' }))}
                  className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900"
                >
                  {WARD_CATEGORIES.map(w => (
                    <option key={w.id} value={w.id}>{w.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-[#1B4332] text-white py-4 rounded-2xl font-black hover:bg-[#2D6A4F] transition-all">Confirm Admission</button>
                <button type="button" onClick={() => setShowAdmitModal(false)} className="flex-1 bg-gray-50 text-gray-500 py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Doctor Modal */}
      {showAddDoctorModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-[32px] sm:rounded-[48px] p-8 sm:p-12 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-2xl sm:text-3xl font-black text-blue-600 hero-heading italic mb-8">Register New Doctor</h3>
            <form onSubmit={handleAddDoctor} className="grid grid-cols-2 gap-5">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Full Name</label>
                <input type="text" required placeholder="Ex: Dr. Anjali Mehta" value={doctorForm.full_name} onChange={e => setDoctorForm(f => ({ ...f, full_name: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Registration No</label>
                <input type="text" required placeholder="Ex: MCI-12345" value={doctorForm.registration_no} onChange={e => setDoctorForm(f => ({ ...f, registration_no: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Specialization</label>
                <select required value={doctorForm.specialization} onChange={e => setDoctorForm(f => ({ ...f, specialization: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900">
                  <option value="">Select Specialty...</option>
                  {[
                    {id: 'cardiology', label: 'Cardiology'},
                    {id: 'neurology', label: 'Neurology'},
                    {id: 'orthopedics', label: 'Orthopedics'},
                    {id: 'oncology', label: 'Oncology'},
                    {id: 'pediatrics', label: 'Pediatrics'},
                    {id: 'general', label: 'General Medicine'},
                    {id: 'surgery', label: 'Surgery'},
                    {id: 'radiology', label: 'Radiology'},
                    {id: 'emergency', label: 'Emergency Medicine'},
                    {id: 'icu', label: 'Intensive Care'},
                    {id: 'nephrology', label: 'Nephrology'},
                    {id: 'other', label: 'Other'}
                  ].map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Phone</label>
                <input type="tel" required placeholder="Ex: 9876543210" value={doctorForm.phone} onChange={e => setDoctorForm(f => ({ ...f, phone: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Experience (Years)</label>
                <input type="number" placeholder="Ex: 5" value={doctorForm.experience_years} onChange={e => setDoctorForm(f => ({ ...f, experience_years: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Department</label>
                <select value={doctorForm.department} onChange={e => setDoctorForm(f => ({ ...f, department: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900">
                  <option value="">Select Department...</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Status</label>
                <select value={doctorForm.status} onChange={e => setDoctorForm(f => ({ ...f, status: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              
              <div className="col-span-2 flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black hover:bg-blue-700 transition-all">Add Doctor</button>
                <button type="button" onClick={() => setShowAddDoctorModal(false)} className="flex-1 bg-gray-50 text-gray-500 py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-[32px] sm:rounded-[48px] p-6 sm:p-12 w-full max-w-5xl shadow-2xl flex flex-col lg:flex-row gap-8 max-h-[95vh] overflow-y-auto custom-scrollbar">
            <div className="flex-1">
              <h3 className="text-2xl sm:text-3xl font-black text-[#1B4332] hero-heading italic mb-8">Transfer Patient</h3>
              
              <form onSubmit={handleTransferSubmit} className="space-y-5">
                {transferPatient ? (
                  <p className="text-sm font-bold mb-4 text-[#1B4332]">Patient: {transferPatient.name}</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <input 
                         type="checkbox" 
                         id="isNew" 
                         checked={transferForm.is_new_patient} 
                         onChange={e => setTransferForm(f => ({ ...f, is_new_patient: e.target.checked }))} 
                         className="w-4 h-4"
                       />
                       <label htmlFor="isNew" className="text-xs font-bold text-gray-600 cursor-pointer">New Patient / Not Admitted</label>
                    </div>

                    {transferForm.is_new_patient ? (
                      <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl">
                        <div className="col-span-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Patient Full Name</label>
                          <input type="text" required placeholder="Ex: John Doe" value={transferForm.new_patient_name} onChange={e => setTransferForm(f => ({ ...f, new_patient_name: e.target.value }))} className="w-full mt-1 bg-white border-none outline-none rounded-xl p-3 text-sm font-semibold" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Phone</label>
                          <input type="tel" required placeholder="98765..." value={transferForm.new_patient_phone} onChange={e => setTransferForm(f => ({ ...f, new_patient_phone: e.target.value }))} className="w-full mt-1 bg-white border-none outline-none rounded-xl p-3 text-sm font-semibold" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Age</label>
                          <input type="number" placeholder="25" value={transferForm.new_patient_age} onChange={e => setTransferForm(f => ({ ...f, new_patient_age: e.target.value }))} className="w-full mt-1 bg-white border-none outline-none rounded-xl p-3 text-sm font-semibold" />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Select Admitted Patient</label>
                        <select value={transferForm.patient_id || ''} onChange={e => setTransferForm(f => ({ ...f, patient_id: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900">
                          <option value="">-- Choose Patient --</option>
                          {patients.filter(p => p.status === 'Admitted').map(p => (
                            <option key={p.id} value={p.id}>{p.name} (Bed: {p.bed})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Priority</label>
                  <select value={transferForm.priority} onChange={e => setTransferForm(f => ({ ...f, priority: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Required Bed Type</label>
                  <select value={transferForm.required_bed_type} onChange={e => setTransferForm(f => ({ ...f, required_bed_type: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900">
                    {BED_TYPES.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Reason</label>
                  <input type="text" required placeholder="Ex: Needs specialized care" value={transferForm.reason} onChange={e => setTransferForm(f => ({ ...f, reason: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Additional Notes</label>
                  <input type="text" placeholder="Ex: Patient stable" value={transferForm.notes} onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" disabled={!transferForm.destination_hospital} className={`flex-1 text-white py-4 rounded-2xl font-black transition-all ${transferForm.destination_hospital ? 'bg-[#1B4332] hover:bg-[#2D6A4F]' : 'bg-gray-300 cursor-not-allowed'}`}>Initiate</button>
                  <button type="button" onClick={() => setShowTransferModal(false)} className="flex-1 bg-gray-50 text-gray-500 py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all">Cancel</button>
                </div>
              </form>
            </div>
            
            <div className="flex-1 bg-gray-50 rounded-3xl p-6 overflow-y-auto max-h-[600px] flex flex-col gap-4">
              <h4 className="text-xl font-black text-[#1B4332]">Select Destination</h4>
              {searchingHospitals ? (
                <div className="flex items-center justify-center p-8 text-gray-500 font-bold">
                  Finding nearby hospitals... 📍
                </div>
              ) : nearbyHospitals.length > 0 ? (
                <>
                  {isMapLoaded && currentLocation && (
                    <div className="w-full h-48 rounded-2xl overflow-hidden shadow-sm flex-shrink-0 border border-gray-200">
                      <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={currentLocation}
                        zoom={12}
                        options={{ disableDefaultUI: true, zoomControl: true }}
                      >
                        {/* Current Location Marker */}
                        <Marker position={currentLocation} icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' }} />
                        {/* Hospital Markers */}
                        {nearbyHospitals.map(h => {
                            const lat = parseFloat(h.latitude);
                            const lng = parseFloat(h.longitude);
                            if (isNaN(lat) || isNaN(lng)) return null;
                            const isSelected = transferForm.destination_hospital === h.id;
                            return (
                                <Marker 
                                    key={h.id} 
                                    position={{ lat, lng }} 
                                    onClick={() => setTransferForm(f => ({ ...f, destination_hospital: h.id }))}
                                    icon={{ url: isSelected ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
                                />
                            );
                        })}
                      </GoogleMap>
                    </div>
                  )}
                  <div className="space-y-3 overflow-y-auto pr-2">
                    {nearbyHospitals.map(h => (
                      <div 
                        key={h.id} 
                        onClick={() => setTransferForm(f => ({ ...f, destination_hospital: h.id }))}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${transferForm.destination_hospital === h.id ? 'border-[#1B4332] bg-[#FDFCF7] shadow-md' : 'border-transparent bg-white hover:border-gray-200'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{h.name}</p>
                            <p className="text-xs text-gray-500">{h.city}</p>
                          </div>
                          {h.distance !== undefined && (
                            <span className="bg-gray-100 px-2 py-1 rounded-lg text-[10px] font-black text-gray-600">{parseFloat(h.distance).toFixed(1)} km</span>
                          )}
                        </div>
                        <div className="flex gap-2 text-xs font-bold">
                          <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded">Beds: {h.total_beds || '?'}</span>
                          <span className="text-red-600 bg-red-50 px-2 py-1 rounded">ICU: {h.icu_capacity || '?'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center p-8 text-gray-500 font-bold text-center">
                  No nearby hospitals found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-md rounded-[40px] p-10 space-y-8 animate-in fade-in zoom-in duration-300 shadow-2xl">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto text-4xl font-bold border-4 border-white shadow-sm">
                  {user?.name?.charAt(0) || 'R'}
                </div>
                <h3 className="text-2xl font-black text-gray-900 hero-heading italic">Staff Profile</h3>
                <p className="text-gray-400 text-sm font-medium">Internal Hospital Registry Details</p>
              </div>
              
              <div className="space-y-4">
                <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Full Name</p>
                  <p className="font-bold text-gray-900">{user?.name || 'N/A'}</p>
                </div>
                <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Email Address</p>
                  <p className="font-bold text-gray-900">{user?.email || 'N/A'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Role</p>
                    <p className="font-bold text-green-600 uppercase text-xs">Reception</p>
                  </div>
                  <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                    <p className="font-bold text-blue-600 uppercase text-xs">Active</p>
                  </div>
                </div>
                <div className="p-5 bg-[#1B4332] rounded-3xl border border-white/10 shadow-lg">
                  <p className="text-[10px] font-black text-green-200/50 uppercase tracking-widest mb-1">Current Hospital</p>
                  <p className="font-bold text-white truncate">{user?.hospitalName || 'SANJIVNI Network'}</p>
                </div>
                <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Staff Access Key (ID)</p>
                  <p className="text-[10px] font-mono text-gray-500 break-all">{user?.id || 'NO_UUID_FOUND'}</p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowProfileModal(false)}
                className="w-full bg-[#1B4332] text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:-translate-y-1 transition-all active:scale-95"
              >
                Close Profile
              </button>
            </div>
          </div>
        )}

      {/* Resource Sharing Request Modal */}
      {showResourceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xl rounded-[40px] p-10 space-y-8 shadow-2xl animate-in zoom-in duration-300 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-[#1B4332]/10 text-[#1B4332] rounded-3xl flex items-center justify-center mx-auto text-3xl font-bold">📦</div>
              <h3 className="text-3xl font-black text-gray-900 hero-heading italic">Request Resources</h3>
              <p className="text-gray-400 text-sm font-medium">Broadcast equipment needs to neighboring hospitals</p>
            </div>

            <form onSubmit={handleResourceRequestSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Equipment Type</label>
                  <select 
                    required 
                    value={resourceForm.equipment_type} 
                    onChange={e => setResourceForm(f => ({ ...f, equipment_type: e.target.value }))}
                    className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900"
                  >
                    <option value="">Select Equipment...</option>
                    <option value="Ultrasound Machine">Ultrasound Machine</option>
                    <option value="Defibrillator AED">Defibrillator AED</option>
                    <option value="Infusion Pump">Infusion Pump</option>
                    <option value="Blood Analyzer">Blood Analyzer</option>
                    <option value="Ventilator (Portable)">Ventilator (Portable)</option>
                    <option value="Patient Monitor">Patient Monitor</option>
                    <option value="X-Ray Machine (Mobile)">X-Ray Machine (Mobile)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Quantity</label>
                  <input 
                    type="number" 
                    min="1" 
                    required 
                    value={resourceForm.quantity} 
                    onChange={e => setResourceForm(f => ({ ...f, quantity: parseInt(e.target.value) }))}
                    className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" 
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Priority</label>
                  <select 
                    value={resourceForm.priority} 
                    onChange={e => setResourceForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Reason for Request</label>
                  <textarea 
                    required 
                    rows="3"
                    placeholder="Briefly explain the emergency or deficiency..."
                    value={resourceForm.reason} 
                    onChange={e => setResourceForm(f => ({ ...f, reason: e.target.value }))}
                    className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900 resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="submit" 
                  className="flex-1 bg-[#1B4332] text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:-translate-y-1 transition-all active:scale-95"
                >
                  Send Broadcast
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowResourceModal(false)}
                  className="flex-1 bg-gray-50 text-gray-500 py-5 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-8 right-8 bg-[#1B4332] text-white px-6 py-4 rounded-2xl font-bold text-sm shadow-xl z-[100] animate-in slide-in-from-right duration-300">{toast}</div>}
    </div>
  );
};

export default ReceptionPortalPage;
