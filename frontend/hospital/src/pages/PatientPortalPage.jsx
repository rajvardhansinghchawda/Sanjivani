import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../services/auth';
import { apiFetch } from '../services/api';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import SanjivniLogo from '../components/SanjivniLogo';
import '../css/styles.css';

const PatientPortalPage = () => {
  const navigate = useNavigate();
  const user = Auth.user;
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bedSummaries, setBedSummaries] = useState({});
  const [error, setError] = useState('');
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState('');
  const [records, setRecords] = useState([]);

  // Patient profile + admissions
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [patientProfile, setPatientProfile] = useState(null);
  const [patientDetail, setPatientDetail] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [profileLocationLoading, setProfileLocationLoading] = useState(false);
  const [profileLocationError, setProfileLocationError] = useState('');
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    age: '',
    gender: '',
    blood_group: '',
    address: '',
    city: '',
    area: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    known_allergies: '',
    chronic_conditions: '',
  });

  // Search filters (public API)
  const [searchFilters, setSearchFilters] = useState({
    city: 'Indore',
    category: 'all',
    has_icu: 'all',
    service: 'all',
    treatment: 'all',
  });
  const [nearMe, setNearMe] = useState({ enabled: false, lat: null, lng: null, radius: 10, loading: false, error: '' });
  const [serviceCategories, setServiceCategories] = useState([]);
  const [services, setServices] = useState([]);

  // Hospital detail modal
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [hospitalDetailLoading, setHospitalDetailLoading] = useState(false);
  const [hospitalDetailError, setHospitalDetailError] = useState('');
  const [hospitalDetail, setHospitalDetail] = useState(null);
  const [hospitalDepartments, setHospitalDepartments] = useState([]);
  const [hospitalOnDuty, setHospitalOnDuty] = useState([]);

  // Ambulance booking + tracking (public APIs)
  const [showAmbulanceModal, setShowAmbulanceModal] = useState(false);
  const [ambulanceCity, setAmbulanceCity] = useState('Indore');
  const [ambulanceType, setAmbulanceType] = useState('icu');
  const [availableAmbulances, setAvailableAmbulances] = useState([]);
  const [ambulanceLoading, setAmbulanceLoading] = useState(false);
  const [ambulanceError, setAmbulanceError] = useState('');
  const [ambulanceBookLoading, setAmbulanceBookLoading] = useState(false);
  const [ambulanceRequest, setAmbulanceRequest] = useState({
    pickup_address: '',
    pickup_city: 'Indore',
    pickup_latitude: '',
    pickup_longitude: '',
    destination_hospital: '',
    requester_name: '',
    requester_phone: '',
  });
  const [trackRequestId, setTrackRequestId] = useState('');
  const [tracking, setTracking] = useState(null);
  const [rating, setRating] = useState({ score: 5, comment: '' });
  const [driverLocation, setDriverLocation] = useState(null); // {lat, lng} from real-time tracking
  const [distanceToDriver, setDistanceToDriver] = useState(null);
  const [driverArrived, setDriverArrived] = useState(false);
  const [showNearbyHospitalsAfterPickup, setShowNearbyHospitalsAfterPickup] = useState(false);

  // AI agent call (public)
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentMessage, setAgentMessage] = useState('');

  // ── AI Symptom Analysis ─────────────────────────────────────
  const [symptomText, setSymptomText]           = useState('');
  const [symptomResult, setSymptomResult]       = useState(null);  // { specialization, category, confidence }
  const [symptomAnalyzing, setSymptomAnalyzing] = useState(false);
  const [voiceListening, setVoiceListening]     = useState(false);
  const [voiceTranscript, setVoiceTranscript]   = useState('');
  const [showSymptomSug, setShowSymptomSug]     = useState(false);
  const [docList, setDocList]                   = useState([]);
  const [docLoading, setDocLoading]             = useState(false);
  const recognitionRef = useRef(null);
  const debounceRef    = useRef(null);
  const symptomInputRef= useRef(null);

  const SYMPTOM_SUGGESTIONS = [
    'chest pain and shortness of breath',
    'severe headache and dizziness',
    'knee pain after injury',
    'high fever in child',
    'kidney stone and back pain',
    'difficulty breathing and cough',
    'stomach pain and vomiting',
    'blurry vision and headache',
  ];

  const SPEC_ICONS_MAP = {
    cardiology:'❤️', neurology:'🧠', orthopedics:'🦴', oncology:'🔬',
    pediatrics:'👶', general:'🏥', surgery:'🔪', radiology:'📡',
    emergency:'🚨', icu:'💊', nephrology:'🫘', other:'👨‍⚕️',
  };

  const MOCK_DOCTORS_LIST = [
    { id:'d1', full_name:'Dr. Arjun Sharma',  specialization:'cardiology',  qualification:'MBBS, MD Cardiology', experience_years:14, status:'active',   hospital_name:'City Regional Hospital',   department_name:'Cardiology',   is_on_duty_now:true  },
    { id:'d2', full_name:'Dr. Priya Mehta',   specialization:'neurology',   qualification:'MBBS, DM Neurology',  experience_years:9,  status:'active',   hospital_name:'Westwood Clinical Center', department_name:'Neurology',    is_on_duty_now:false },
    { id:'d3', full_name:'Dr. Rahul Verma',   specialization:'orthopedics', qualification:'MBBS, MS Orthopedics',experience_years:11, status:'active',   hospital_name:'City Regional Hospital',   department_name:'Orthopedics',  is_on_duty_now:true  },
    { id:'d4', full_name:'Dr. Sunita Patel',  specialization:'pediatrics',  qualification:'MBBS, MD Pediatrics', experience_years:7,  status:'active',   hospital_name:'Apollo Westend',           department_name:'Pediatrics',   is_on_duty_now:false },
    { id:'d5', full_name:'Dr. Vikram Singh',  specialization:'emergency',   qualification:'MBBS, FCEM',          experience_years:12, status:'active',   hospital_name:'City Regional Hospital',   department_name:'Emergency',    is_on_duty_now:true  },
    { id:'d6', full_name:'Dr. Anita Joshi',   specialization:'general',     qualification:'MBBS, MD',            experience_years:6,  status:'on_leave', hospital_name:'Westwood Clinical Center', department_name:'Gen. Medicine',is_on_duty_now:false },
    { id:'d7', full_name:'Dr. Suresh Kumar',  specialization:'oncology',    qualification:'MBBS, DM Oncology',   experience_years:18, status:'active',   hospital_name:'Apollo Westend',           department_name:'Oncology',     is_on_duty_now:false },
    { id:'d8', full_name:'Dr. Kavya Reddy',   specialization:'icu',         qualification:'MBBS, MD Critical Care',experience_years:8,status:'active',   hospital_name:'City Regional Hospital',   department_name:'ICU',          is_on_duty_now:true  },
    { id:'d9', full_name:'Dr. Manish Gupta',  specialization:'nephrology',  qualification:'MBBS, DM Nephrology', experience_years:15, status:'active',   hospital_name:'Westwood Clinical Center', department_name:'Nephrology',   is_on_duty_now:false },
    { id:'d10',full_name:'Dr. Deepa Nair',    specialization:'radiology',   qualification:'MBBS, MD Radiology',  experience_years:10, status:'active',   hospital_name:'Apollo Westend',           department_name:'Radiology',    is_on_duty_now:true  },
  ];

  // Setup Web Speech API
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = false; r.interimResults = true; r.lang = 'en-IN';
    r.onresult = (e) => {
      const interim = Array.from(e.results).map(r => r[0].transcript).join(' ');
      setVoiceTranscript(interim);
      if (e.results[e.results.length-1].isFinal) {
        const final = e.results[e.results.length-1][0].transcript;
        setSymptomText(final); setVoiceTranscript(''); setVoiceListening(false);
        analyzeSymptoms(final);
      }
    };
    r.onend  = () => setVoiceListening(false);
    r.onerror= () => setVoiceListening(false);
    recognitionRef.current = r;
  }, []);

  const analyzeSymptoms = useCallback(async (symptoms) => {
    if (!symptoms || symptoms.trim().length < 3) return;
    setSymptomAnalyzing(true);
    try {
      const res = await fetch(`${(import.meta.env.VITE_API_BASE || 'http://localhost:8000')}/api/hospitals/symptom-category/?symptoms=${encodeURIComponent(symptoms)}`);
      if (res.ok) {
        const data = await res.json();
        setSymptomResult(data.matched);
        loadDoctorsByCategory(data.matched?.specialization);
      } else throw new Error('api fail');
    } catch {
      // local fallback
      const lower = symptoms.toLowerCase();
      const MAP = [
        {kw:['chest','heart','cardiac','palpitation'], s:'cardiology', l:'Cardiology'},
        {kw:['head','brain','stroke','seizure','memory'], s:'neurology', l:'Neurology'},
        {kw:['bone','joint','knee','fracture','back pain'], s:'orthopedics', l:'Orthopedics'},
        {kw:['child','baby','infant','kid'], s:'pediatrics', l:'Pediatrics'},
        {kw:['kidney','urine','renal'], s:'nephrology', l:'Nephrology'},
        {kw:['breath','lung','asthma','cough'], s:'icu', l:'Pulmonology / ICU'},
        {kw:['cancer','tumor','lump'], s:'oncology', l:'Oncology'},
        {kw:['emergency','accident','trauma','unconscious'], s:'emergency', l:'Emergency Medicine'},
      ];
      const matched = MAP.find(m => m.kw.some(k => lower.includes(k)));
      const result  = matched ? {specialization:matched.s, category:matched.l, confidence:0.72} : {specialization:'general', category:'General Medicine', confidence:0.35};
      setSymptomResult(result);
      loadDoctorsByCategory(result.specialization);
    }
    setSymptomAnalyzing(false);
  }, []);

  const loadDoctorsByCategory = async (specialization) => {
    setDocLoading(true);
    try {
      const res = await fetch(`${(import.meta.env.VITE_API_BASE || 'http://localhost:8000')}/api/hospitals/doctors/public/${specialization ? `?specialization=${specialization}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.results || [];
        setDocList(list.length > 0 ? list : MOCK_DOCTORS_LIST.filter(d => !specialization || d.specialization === specialization));
      } else {
        setDocList(MOCK_DOCTORS_LIST.filter(d => !specialization || d.specialization === specialization));
      }
    } catch {
      setDocList(MOCK_DOCTORS_LIST.filter(d => !specialization || d.specialization === specialization));
    }
    setDocLoading(false);
  };

  // Load random doctors initially
  useEffect(() => { loadDoctorsByCategory(null); }, []);

  // Debounced text analysis
  useEffect(() => {
    if (!symptomText) { setSymptomResult(null); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => analyzeSymptoms(symptomText), 750);
    return () => clearTimeout(debounceRef.current);
  }, [symptomText, analyzeSymptoms]);

  const startVoice = () => {
    if (!recognitionRef.current) { alert('Voice not supported. Use Chrome.'); return; }
    setVoiceListening(true); setSymptomResult(null); setVoiceTranscript('');
    recognitionRef.current.start();
  };
  const stopVoice = () => { recognitionRef.current?.stop(); setVoiceListening(false); };

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  const [pickupPin, setPickupPin] = useState(null); // {lat, lng}
  const [mapCenter, setMapCenter] = useState({ lat: 22.7196, lng: 75.8577 }); // default: Indore
  const [hospitalPin, setHospitalPin] = useState(null); // {lat, lng}

  const getHospitalCoords = (hospitalId) => {
    if (!hospitalId) return null;
    const idStr = String(hospitalId);
    const candidates = [
      ...(hospitalDetail && (String(hospitalDetail.id) === idStr) ? [hospitalDetail] : []),
      ...(selectedHospital && (String(selectedHospital.id) === idStr) ? [selectedHospital] : []),
      ...hospitals.filter(h => String(h.id) === idStr),
    ];
    for (const h of candidates) {
      const lat = parseFloat(h.latitude ?? h.lat ?? h.location_lat ?? '');
      const lng = parseFloat(h.longitude ?? h.lng ?? h.location_lng ?? '');
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
    }
    return null;
  };

  useEffect(() => {
    const destId = ambulanceRequest.destination_hospital || selectedHospital?.id || null;
    const coords = getHospitalCoords(destId);
    setHospitalPin(coords);
    if (coords && !pickupPin) {
      setMapCenter(coords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambulanceRequest.destination_hospital, selectedHospital?.id, hospitalDetail?.id, hospitals.length]);

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    fetchHospitals();
    fetchRecords();
    fetchProfile();
  }, []);

  useEffect(() => {
    // load search filter metadata (public)
    fetchSearchMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // refresh search results when filters change (public)
    fetchHospitals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFilters.city, searchFilters.category, searchFilters.has_icu, searchFilters.service, searchFilters.treatment, searchQuery]);

  // Auto-load ambulances when modal opens
  useEffect(() => {
    if (showAmbulanceModal) {
      // Try to load nearby ambulances first, fallback to city-based
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            loadNearbyAmbulances(lat, lng);
          },
          () => {
            // Fallback to city-based search
            loadAvailableAmbulances();
          }
        );
      } else {
        // No geolocation support, use city-based search
        loadAvailableAmbulances();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAmbulanceModal]);

  const fetchSearchMeta = async () => {
    try {
      const [catsRes, servicesRes] = await Promise.all([
        apiFetch('/api/hospitals/service-categories/'),
        apiFetch('/api/hospitals/services/'),
      ]);
      if (catsRes.ok) {
        const data = await catsRes.json();
        setServiceCategories(Array.isArray(data) ? data : data.results || []);
      }
      if (servicesRes.ok) {
        const data = await servicesRes.json();
        setServices(Array.isArray(data) ? data : data.results || []);
      }
    } catch {
      // keep empty lists; UI stays same
    }
  };

  const fetchHospitals = async () => {
    setLoading(true);
    setError('');
    try {
      // Public hospital search endpoint — filter via query params
      const qs = new URLSearchParams();
      if (nearMe.enabled && typeof nearMe.lat === 'number' && typeof nearMe.lng === 'number') {
        qs.set('lat', String(nearMe.lat));
        qs.set('lng', String(nearMe.lng));
        qs.set('radius', String(nearMe.radius || 10));
      } else {
        qs.set('city', searchFilters.city || 'Indore');
      }
      if (searchQuery) qs.set('search', searchQuery);
      if (searchFilters.category !== 'all') qs.set('category', searchFilters.category);
      if (searchFilters.has_icu !== 'all') qs.set('has_icu', searchFilters.has_icu);
      if (searchFilters.service !== 'all') qs.set('service', searchFilters.service);
      if (searchFilters.treatment !== 'all') qs.set('treatment', searchFilters.treatment);

      const res = await apiFetch(`/api/hospitals/search/?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.results || [];
        setHospitals(list);

        // Fetch cached bed availability per hospital (Redis, 2 min TTL)
        const summaries = {};
        await Promise.all(
          list.map(async (hosp) => {
            if (!hosp.id) return;
            try {
              const bedRes = await apiFetch(`/api/beds/availability/${hosp.id}/`);
              if (bedRes.ok) {
                const summary = await bedRes.json();
                summaries[hosp.id] = summary;
              }
            } catch {
              // ignore per-hospital errors; fallback UI will show total_beds
            }
          })
        );
        setBedSummaries(summaries);
      } else {
        const err = await res.json().catch(() => ({}));
        setHospitals([]);
        setError(err.detail || 'Could not load hospitals from server.');
      }
    } catch (e) {
      setHospitals([]);
      setError(e.message || 'Network error while loading hospitals.');
    }
    setLoading(false);
  };

  const enableNearMeSearch = async () => {
    setNearMe((s) => ({ ...s, loading: true, error: '' }));
    if (!navigator.geolocation) {
      setNearMe((s) => ({ ...s, loading: false, error: 'Geolocation is not supported by this browser.' }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setNearMe((s) => ({ ...s, enabled: true, lat, lng, loading: false, error: '' }));
      },
      () => setNearMe((s) => ({ ...s, loading: false, error: 'Could not fetch your location. Please allow location access.' }))
    );
  };

  const disableNearMeSearch = () => {
    setNearMe((s) => ({ ...s, enabled: false, loading: false, error: '' }));
  };

  const fetchRecords = async () => {
    setRecordsLoading(true);
    setRecordsError('');
    try {
      // Patient portal record list is driven by "my admissions" which comes from GET /api/patients/{id}/.
      // We keep a lightweight list here; full patientDetail is loaded separately.
      setRecords([]);
    } catch (e) {
      setRecords([]);
      setRecordsError(e.message || 'Network error while loading records.');
    }
    setRecordsLoading(false);
  };

  const fetchProfile = async () => {
    setProfileLoading(true);
    setProfileError('');
    try {
      const res = await apiFetch('/api/auth/profile/');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to load profile');
      setPatientProfile(data);
      // Load patient-owned profile (full editable) + current admission
      const pRes = await apiFetch('/api/patients/me/');
      const pData = await pRes.json().catch(() => ({}));
      if (pRes.ok) {
        setPatientDetail(pData);
        const merged = { ...(pData || {}), ...(data || {}) };
        setEditForm({
          full_name: merged.full_name || user?.name || '',
          phone: merged.phone || '',
          email: merged.email || '',
          age: (merged.age !== undefined && merged.age !== null) ? String(merged.age) : '',
          gender: merged.gender || '',
          blood_group: merged.blood_group || '',
          address: merged.address || '',
          city: merged.city || '',
          area: merged.area || '',
          emergency_contact_name: merged.emergency_contact_name || '',
          emergency_contact_phone: merged.emergency_contact_phone || '',
          known_allergies: merged.known_allergies || '',
          chronic_conditions: merged.chronic_conditions || '',
        });
      }
    } catch (e) {
      setProfileError(e.message || 'Failed to load profile');
    }
    setProfileLoading(false);
  };

  const openEditProfile = () => {
    setEditError('');
    const merged = { ...(patientDetail || {}), ...(patientProfile || {}) };
    setEditForm((f) => ({
      ...f,
      full_name: merged.full_name || user?.name || f.full_name,
      phone: merged.phone || f.phone,
      email: merged.email || f.email,
      age: (merged.age !== undefined && merged.age !== null) ? String(merged.age) : f.age,
      gender: merged.gender || f.gender,
      blood_group: merged.blood_group || f.blood_group,
      address: merged.address || f.address,
      city: merged.city || f.city,
      area: merged.area || f.area,
      emergency_contact_name: merged.emergency_contact_name || f.emergency_contact_name,
      emergency_contact_phone: merged.emergency_contact_phone || f.emergency_contact_phone,
      known_allergies: merged.known_allergies || f.known_allergies,
      chronic_conditions: merged.chronic_conditions || f.chronic_conditions,
    }));
    setShowEditProfile(true);
  };

  const autofetchProfileLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setProfileLocationError('Location is not supported in this browser.');
      return;
    }

    setProfileLocationLoading(true);
    setProfileLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          if (window.google?.maps?.Geocoder) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                const components = results[0].address_components || [];
                const getComp = (...types) => {
                  const hit = components.find((component) => types.some((type) => component.types.includes(type)));
                  return hit?.long_name || '';
                };
                const street = [getComp('street_number'), getComp('route')].filter(Boolean).join(' ');
                const locality = getComp('sublocality_level_1', 'sublocality', 'neighborhood');
                const city = getComp('locality', 'administrative_area_level_2');

                setEditForm((f) => ({
                  ...f,
                  address: results[0].formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                  city: city || f.city || 'Indore',
                  area: locality || street || f.area || '',
                }));
              } else {
                setEditForm((f) => ({
                  ...f,
                  address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                  city: f.city || 'Indore',
                  area: f.area || '',
                }));
              }
              setProfileLocationLoading(false);
            });
          } else {
            setEditForm((f) => ({
              ...f,
              address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
              city: f.city || 'Indore',
              area: f.area || '',
            }));
            setProfileLocationLoading(false);
          }
        } catch {
          setEditForm((f) => ({
            ...f,
            address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            city: f.city || 'Indore',
            area: f.area || '',
          }));
          setProfileLocationLoading(false);
        }
      },
      () => {
        setProfileLocationLoading(false);
        setProfileLocationError('Unable to fetch your location. Please allow location permission.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (showEditProfile) {
      autofetchProfileLocation();
    }
  }, [showEditProfile, autofetchProfileLocation]);

  const saveProfile = async () => {
    if (!editForm.full_name.trim()) {
      setEditError('Full name is required.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      const payload = {
        full_name: editForm.full_name.trim(),
        phone: editForm.phone?.trim() || '',
        ...(editForm.email?.trim() ? { email: editForm.email.trim() } : {}),
        ...(() => {
          if (editForm.age === '' || editForm.age === null || editForm.age === undefined) return {};
          const n = parseInt(editForm.age, 10);
          if (!Number.isFinite(n) || n < 0) return {};
          return { age: n };
        })(),
        ...(editForm.gender ? { gender: editForm.gender } : {}),
        ...(editForm.blood_group ? { blood_group: editForm.blood_group } : {}),
        ...(editForm.address?.trim() ? { address: editForm.address.trim() } : {}),
        ...(editForm.city?.trim() ? { city: editForm.city.trim() } : {}),
        ...(editForm.area?.trim() ? { area: editForm.area.trim() } : {}),
        ...(editForm.emergency_contact_name?.trim() ? { emergency_contact_name: editForm.emergency_contact_name.trim() } : {}),
        ...(editForm.emergency_contact_phone?.trim() ? { emergency_contact_phone: editForm.emergency_contact_phone.trim() } : {}),
        ...(editForm.known_allergies?.trim() ? { known_allergies: editForm.known_allergies.trim() } : {}),
        ...(editForm.chronic_conditions?.trim() ? { chronic_conditions: editForm.chronic_conditions.trim() } : {}),
      };

      const pRes = await apiFetch('/api/patients/me/', { method: 'PATCH', body: JSON.stringify(payload) });
      const pData = await pRes.json().catch(() => ({}));
      if (!pRes.ok) {
        const msg =
          pData.detail ||
          (typeof pData === 'object' && pData
            ? Object.entries(pData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join(' | ')
            : null) ||
          'Failed to update patient profile';
        throw new Error(msg);
      }

      // Keep auth user profile in sync for header name/phone.
      const uRes = await apiFetch('/api/auth/profile/', {
        method: 'PATCH',
        body: JSON.stringify({ full_name: payload.full_name, phone: payload.phone }),
      });
      const uData = await uRes.json().catch(() => ({}));
      if (!uRes.ok) throw new Error(uData.detail || 'Failed to update login profile');

      try {
        const raw = localStorage.getItem('medgrid_user');
        const u = raw ? JSON.parse(raw) : null;
        if (u) {
          localStorage.setItem('medgrid_user', JSON.stringify({ ...u, name: uData.full_name || payload.full_name, phone: uData.phone || payload.phone }));
        }
      } catch {}

      await fetchProfile();
      setShowEditProfile(false);
    } catch (e) {
      setEditError(e.message || 'Failed to update profile');
    }
    setEditSaving(false);
  };

  const openHospitalDetail = async (hosp) => {
    if (!hosp?.id) return;
    setSelectedHospital(hosp);
    setHospitalDetailLoading(true);
    setHospitalDetailError('');
    setHospitalDetail(null);
    setHospitalDepartments([]);
    setHospitalOnDuty([]);
    try {
      const [hRes, dRes, onRes] = await Promise.all([
        apiFetch(`/api/hospitals/${hosp.id}/`),
        apiFetch(`/api/hospitals/${hosp.id}/departments/`),
        apiFetch(`/api/hospitals/${hosp.id}/on-duty-now/`),
      ]);
      const hData = await hRes.json().catch(() => ({}));
      const dData = await dRes.json().catch(() => ({}));
      const onData = await onRes.json().catch(() => ({}));
      if (!hRes.ok) throw new Error(hData.detail || 'Failed to load hospital');
      setHospitalDetail(hData);
      setHospitalDepartments(Array.isArray(dData) ? dData : dData.results || []);
      setHospitalOnDuty(Array.isArray(onData) ? onData : onData.results || []);
    } catch (e) {
      setHospitalDetailError(e.message || 'Failed to load hospital details');
    }
    setHospitalDetailLoading(false);
  };

  const loadAvailableAmbulances = async () => {
    setAmbulanceLoading(true);
    setAmbulanceError('');
    try {
      const res = await apiFetch(`/api/ambulances/available/?city=${encodeURIComponent(ambulanceCity)}&type=${encodeURIComponent(ambulanceType)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to load ambulances');
      setAvailableAmbulances(Array.isArray(data) ? data : data.ambulances || data.results || []);
    } catch (e) {
      setAvailableAmbulances([]);
      setAmbulanceError(e.message || 'Failed to load ambulances');
    }
    setAmbulanceLoading(false);
  };

  const loadNearbyAmbulances = async (lat, lng, radiusKm = 15) => {
    setAmbulanceLoading(true);
    setAmbulanceError('');
    try {
      const res = await apiFetch(`/api/ambulances/available/?lat=${lat}&lng=${lng}&radius=${radiusKm}&type=${encodeURIComponent(ambulanceType)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to load nearby ambulances');
      setAvailableAmbulances(Array.isArray(data) ? data : data.ambulances || data.results || []);
    } catch (e) {
      setAvailableAmbulances([]);
      setAmbulanceError(e.message || 'Failed to load nearby ambulances');
    }
    setAmbulanceLoading(false);
  };

  const bookAmbulance = async () => {
    setAmbulanceBookLoading(true);
    setAmbulanceError('');
    try {
      const payload = {
        ambulance_type: ambulanceType,
        pickup_address: ambulanceRequest.pickup_address,
        pickup_city: ambulanceRequest.pickup_city || ambulanceCity,
        pickup_latitude: pickupPin?.lat ? String(pickupPin.lat) : ambulanceRequest.pickup_latitude,
        pickup_longitude: pickupPin?.lng ? String(pickupPin.lng) : ambulanceRequest.pickup_longitude,
        destination_hospital: ambulanceRequest.destination_hospital || selectedHospital?.id,
        requester_name: ambulanceRequest.requester_name || (patientProfile?.full_name || user?.name || ''),
        requester_phone: ambulanceRequest.requester_phone || (patientProfile?.phone || ''),
      };
      const res = await apiFetch('/api/ambulances/book/', { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Booking failed');
      setTrackRequestId(data.request_id || '');
      setTracking({ status: 'requested', live_location: null, ...data });
    } catch (e) {
      setAmbulanceError(e.message || 'Booking failed');
    }
    setAmbulanceBookLoading(false);
  };

  const pollTracking = async (requestId) => {
    if (!requestId) return;
    try {
      const res = await apiFetch(`/api/ambulances/track/${requestId}/`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTracking((t) => ({ ...(t || {}), ...data }));
        
        // Extract driver location from response
        if (data.live_location) {
          setDriverLocation(data.live_location);
          
          // Calculate distance between user and driver
          if (pickupPin?.lat && pickupPin?.lng) {
            const dist = calculateDistance(
              pickupPin.lat, pickupPin.lng,
              data.live_location.lat, data.live_location.lng
            );
            setDistanceToDriver(dist);
            
            // Auto-detect when driver arrives (< 100m = 0.1km)
            if (dist <= 0.1 && !driverArrived && data.status === 'en_route') {
              setDriverArrived(true);
            }
            
            // Show nearby hospitals after pickup
            if (data.status === 'picked_up' && !showNearbyHospitalsAfterPickup) {
              setShowNearbyHospitalsAfterPickup(true);
            }
          }
        }
      }
    } catch {
      // ignore single poll failure
    }
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    // Haversine formula to calculate distance in km
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    if (!trackRequestId) return;
    pollTracking(trackRequestId);
    const t = setInterval(() => pollTracking(trackRequestId), 10000);
    return () => clearInterval(t);
  }, [trackRequestId]);

  const rateAmbulance = async () => {
    if (!trackRequestId) return;
    try {
      const res = await apiFetch(`/api/ambulances/rate/${trackRequestId}/`, {
        method: 'POST',
        body: JSON.stringify({ rating: rating.score, comment: rating.comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Rating failed');
      setAmbulanceError('');
    } catch (e) {
      setAmbulanceError(e.message || 'Rating failed');
    }
  };

  const requestAgentCall = async () => {
    setAgentLoading(true);
    setAgentMessage('');
    try {
      const phone = patientProfile?.phone || '';
      const city = searchFilters.city || 'Indore';
      const res = await apiFetch('/api/calls/user-agent/request/', {
        method: 'POST',
        body: JSON.stringify({ phone, city }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Request failed');
      setAgentMessage(data.message || 'Our agent will call you in a few seconds');
    } catch (e) {
      setAgentMessage(e.message || 'Could not request call.');
    }
    setAgentLoading(false);
  };

  const requestEmergencySOSCall = () => {
    setAgentLoading(true);
    setAgentMessage('Locating you for emergency dispatch...');
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const phone = patientProfile?.phone || '';
          
          const payload = {
            phone,
            city: 'Indore', // default or reverse geocoded if available
            is_emergency: true,
            location_lat: lat,
            location_lng: lng,
            patient_name: user?.name || patientProfile?.name || '',
            age: patientProfile?.age || null,
            gender: patientProfile?.gender || '',
            known_conditions: patientProfile?.medical_history || ''
          };

          const res = await apiFetch('/api/calls/user-agent/request/', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.detail || 'Request failed');
          setAgentMessage(data.message || '🚨 Emergency Agent calling you now...');
          setTimeout(() => setAgentMessage(''), 5000);
        } catch (err) {
          setAgentMessage(err.message || 'Failed to trigger emergency call.');
          setTimeout(() => setAgentMessage(''), 5000);
        } finally {
          setAgentLoading(false);
        }
      }, (err) => {
        setAgentMessage('Could not get GPS location. Calling standard agent...');
        requestAgentCall(); // Fallback
      });
    } else {
      requestAgentCall(); // Fallback
    }
  };

  const handleLogout = async () => { await Auth.logout(); navigate('/'); };

  const filteredHospitals = hospitals.filter(h => h.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  const getBedSnapshot = (hospital) => {
    const summary = bedSummaries[hospital.id];
    if (!summary) {
      return {
        availableBeds: hospital.available_beds || 0,
        icuBeds: hospital.icu_capacity || 0,
      };
    }
    const byType = summary.by_type || {};
    const icu = byType.icu || byType.ICU || {};
    return {
      availableBeds: summary.available_beds || 0,
      icuBeds: icu.available || 0,
    };
  };

  const navTabs = [
    { id: 'overview',  label: 'Overview',      icon: '🏠' },
    { id: 'search',    label: 'Find Hospital',  icon: '🔍' },
    { id: 'doctors',   label: 'Find Doctors',   icon: '👨‍⚕️' },
    { id: 'records',   label: 'My Records',     icon: '📋' },
    { id: 'emergency', label: 'Emergency',      icon: '🚨', danger: true },
  ];

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#FDFCF7', minHeight: '100vh' }}>
      <style>{`
        .hero-heading { font-family: 'Playfair Display', serif; }
        .patient-nav { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); width: calc(100% - 28px); max-width: 1440px; z-index: 50; background: rgba(253,252,247,0.86); backdrop-filter: blur(22px); border: 1px solid rgba(255,255,255,0.68); box-shadow: 0 8px 30px rgba(0,0,0,0.06); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-radius: 999px; }
        .tab-btn { padding: 10px 18px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: transparent; color: #64748b; transition: all 0.2s; display: flex; align-items: center; gap: 8px; white-space: nowrap; }
        .tab-btn.active { background: #1B4332; color: white; }
        .tab-btn:hover:not(.active) { background: #f0fdf4; color: #1B4332; }
        .hosp-card { background: white; border-radius: 24px; padding: 24px; border: 1px solid #e5e7eb; transition: all 0.3s; }
        .hosp-card:hover { box-shadow: 0 12px 30px -8px rgba(27,67,50,0.12); transform: translateY(-4px); }
        .pulse-light { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        .blob-bg { filter: blur(40px); opacity: 0.4; }
        .action-card { transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1); }
        .action-card:hover { transform: translateY(-10px); }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .float-anim { animation: float 4s ease-in-out infinite; }
        @keyframes emergencyPulse { 0%,100%{ box-shadow:0 0 0 0 rgba(220,38,38,0.4); } 50%{ box-shadow:0 0 0 8px rgba(220,38,38,0); } }
        @keyframes voicePulse { 0%,100%{ box-shadow:0 0 0 4px rgba(220,38,38,0.25); } 50%{ box-shadow:0 0 0 10px rgba(220,38,38,0.05); } }
        @keyframes spinAI { to { transform:rotate(360deg); } }
        @keyframes symptomSlide { from{opacity:0;transform:translateY(-6px);} to{opacity:1;transform:translateY(0);} }
        @keyframes fadeU { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.4} }
        .symptom-input::placeholder { color:#aaa; }
      `}</style>

      {/* Top Nav */}
      <nav className="patient-nav">
        <div className="flex items-center gap-3 shrink-0 pl-2">
          <SanjivniLogo size={34} />
        </div>
        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-black/5 p-1 rounded-full border border-white/60 shadow-inner overflow-x-auto">
          {navTabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={tab.danger ? {
                color: activeTab === tab.id ? '#fff' : '#dc2626',
                background: activeTab === tab.id ? 'linear-gradient(135deg,#dc2626,#ef4444)' : 'rgba(220,38,38,0.07)',
                border: '1.5px solid rgba(220,38,38,0.2)',
                animation: 'emergencyPulse 2s infinite',
              } : {}}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── AI Symptom Bar ── */}
        <div style={{ position:'relative', width:340, flexShrink:0 }}>
          <div style={{
            display:'flex', alignItems:'center', gap:7,
            background: voiceListening ? 'rgba(220,38,38,0.05)' : '#fff',
            border: `2px solid ${voiceListening ? '#dc2626' : symptomResult ? '#22c55e' : '#e5e4dc'}`,
            borderRadius:28, padding:'6px 6px 6px 14px', transition:'all .25s',
            boxShadow: voiceListening ? '0 0 0 4px rgba(220,38,38,0.12)' : '0 1px 6px rgba(0,0,0,0.07)',
          }}>
            <span style={{ fontSize:14, flexShrink:0 }}>🤖</span>
            <input
              ref={symptomInputRef}
              className="symptom-input"
              value={voiceListening ? (voiceTranscript||symptomText) : symptomText}
              onChange={e => setSymptomText(e.target.value)}
              onFocus={() => setShowSymptomSug(true)}
              onBlur={() => setTimeout(()=>setShowSymptomSug(false), 160)}
              placeholder={voiceListening ? '🎤 Listening…' : 'Describe symptoms (voice or type)…'}
              readOnly={voiceListening}
              style={{
                flex:1, border:'none', outline:'none', fontSize:12, background:'transparent',
                color: voiceListening ? '#dc2626' : '#1a1a18', fontWeight:500, minWidth:0,
                fontFamily:'inherit',
              }}
            />
            {symptomAnalyzing && (
              <div style={{ width:14, height:14, borderRadius:'50%', border:'2.5px solid #e0dfd8', borderTopColor:'#1B4332', animation:'spinAI .7s linear infinite', flexShrink:0 }}/>
            )}
            {symptomResult && !symptomAnalyzing && (
              <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:20, background:'#dcfce7', border:'1px solid #86efac', flexShrink:0 }}>
                <span style={{ fontSize:13 }}>{SPEC_ICONS_MAP[symptomResult.specialization]||'👨‍⚕️'}</span>
                <span style={{ fontSize:11, fontWeight:700, color:'#1B4332', whiteSpace:'nowrap' }}>{symptomResult.category}</span>
                <span style={{ fontSize:10, color: symptomResult.confidence>=0.7?'#16a34a':'#d97706', fontWeight:700 }}>
                  {Math.round((symptomResult.confidence||0)*100)}%
                </span>
              </div>
            )}
            {(symptomText||symptomResult) && !voiceListening && (
              <button onClick={()=>{setSymptomText('');setSymptomResult(null);loadDoctorsByCategory(null);}}
                style={{ width:20, height:20, borderRadius:'50%', border:'none', background:'#f1efea', cursor:'pointer', fontSize:11, color:'#73726c', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            )}
            <button
              onClick={voiceListening ? stopVoice : startVoice}
              title={voiceListening ? 'Stop' : 'Speak symptoms'}
              style={{
                width:34, height:34, borderRadius:'50%', border:'none', cursor:'pointer', flexShrink:0,
                background: voiceListening ? '#dc2626' : 'linear-gradient(135deg,#1B4332,#2D6A4F)',
                color:'#fff', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center',
                animation: voiceListening ? 'voicePulse 1s infinite' : 'none', transition:'all .2s',
              }}>
              {voiceListening ? '⏹' : '🎤'}
            </button>
          </div>

          {/* Suggestions */}
          {showSymptomSug && !symptomText && !voiceListening && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:'#fff', borderRadius:12, border:'1px solid #e5e4dc', boxShadow:'0 8px 24px rgba(0,0,0,0.11)', zIndex:200, overflow:'hidden', animation:'symptomSlide .2s ease' }}>
              <div style={{ padding:'7px 12px 3px', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em' }}>Common symptoms</div>
              {SYMPTOM_SUGGESTIONS.map(s=>(
                <button key={s} onMouseDown={()=>{setSymptomText(s);setShowSymptomSug(false);symptomInputRef.current?.focus();}}
                  style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 13px', border:'none', background:'transparent', fontSize:12, color:'#1a1a18', cursor:'pointer', borderBottom:'1px solid #f5f4f0' }}
                  onMouseEnter={e=>e.target.style.background='#f0fdf4'}
                  onMouseLeave={e=>e.target.style.background='transparent'}
                >💬 {s}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 pr-1">
          {/* Emergency SOS button triggers agent directly */}
          <button
            onClick={requestEmergencySOSCall}
            disabled={agentLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#dc2626,#ef4444)',
              color: '#fff', textDecoration: 'none',
              fontSize: 12, fontWeight: 700,
              boxShadow: '0 2px 10px rgba(220,38,38,0.35)',
              animation: 'emergencyPulse 2s infinite',
              opacity: agentLoading ? 0.7 : 1
            }}
          >
            {agentLoading ? 'Calling...' : '🚨 SOS Calling'}
          </button>
          <button onClick={openEditProfile} className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full hover:bg-green-100 transition-all">
            <div className="w-7 h-7 bg-[#1B4332] rounded-full flex items-center justify-center text-white text-[10px] font-black">
              {(user?.name || 'P')[0]}
            </div>
            <span className="text-sm font-bold text-[#1B4332]">{user?.name || 'Patient'}</span>
          </button>
          <button onClick={handleLogout} className="text-sm font-bold text-red-500 hover:bg-red-50 px-4 py-2 rounded-full transition-all">Sign Out</button>
        </div>
      </nav>

      <div className="pt-24 px-10 pb-10">
        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="max-w-6xl mx-auto space-y-12">
            {/* Redesigned Hero Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 py-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100 text-[10px] font-black uppercase tracking-widest text-[#1B4332]">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  Network Radar Active
                </div>
                <h1 className="text-6xl font-black text-[#1B4332] hero-heading italic leading-tight">
                  Hello, <span className="text-green-600 underline decoration-green-200 underline-offset-8 decoration-4">{user?.name?.split(' ')[0] || 'Patient'}</span>
                </h1>
                <p className="text-gray-500 text-lg font-medium">Your healthcare command center is ready.</p>
              </div>
              
              <div className="flex items-center gap-4 px-6 py-4 bg-white rounded-[28px] shadow-sm border border-black/5 hover:border-black/10 transition-all group overflow-hidden relative">
                <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-blue-50 rounded-full opacity-0 group-hover:opacity-100 group-hover:scale-150 transition-all duration-700"></div>
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors relative z-10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-white transition-colors"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div className="relative z-10">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current Location</p>
                  <span className="text-sm font-black text-gray-900 leading-none">Indore Region</span>
                </div>
              </div>
            </div>

            {/* Quick Action Cards with Interactive Blobs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { 
                  label: 'Find Hospital', 
                  desc: 'Search live bed counts, specialists, and facilities in real-time.', 
                  icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><line x1="12" y1="22" x2="12" y2="12"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>,
                  color: 'green',
                  action: () => setActiveTab('search'),
                  href: null,
                },
                { 
                  label: 'Book Ambulance', 
                  desc: 'Emergency transport with AI-guided route optimization.', 
                  icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 10H6"/><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>,
                  color: 'orange',
                  action: () => { setShowAmbulanceModal(true); setActiveTab('search'); },
                  href: null,
                },
                { 
                  label: 'My Records', 
                  desc: 'Access your medical history, bookings, and health tags.', 
                  icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>,
                  color: 'blue',
                  action: () => setActiveTab('records'),
                  href: null,
                },
                { 
                  label: 'Emergency Triage', 
                  desc: 'AI-powered severity check and instant hospital routing. Use in medical emergencies.', 
                  icon: <span style={{fontSize:28}}>🚨</span>,
                  color: 'red',
                  action: null,
                  href: '/emergency',
                  isEmergency: true,
                },
              ].map((card, i) => {
                const content = (
                  <>
                    <div style={card.isEmergency ? {
                      width:56, height:56, borderRadius:20,
                      background:'linear-gradient(135deg,rgba(220,38,38,0.12),rgba(239,68,68,0.08))',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      marginBottom:24, border:'1.5px solid rgba(220,38,38,0.2)',
                      animation:'emergencyPulse 2s infinite',
                    } : { width:56, height:56, borderRadius:20, background:`var(--${card.color}-50,#f0fdf4)`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:24 }
                    } className={card.isEmergency ? '' : `bg-${card.color}-50 group-hover:bg-${card.color}-600 group-hover:text-white text-${card.color}-600 transition-all duration-300 group-hover:rotate-6`}>
                      {card.icon}
                    </div>
                    <h3 style={card.isEmergency ? {fontSize:20,fontWeight:800,color:'#dc2626',marginBottom:8} : {}} className={card.isEmergency ? '' : 'text-xl font-black text-[#1B4332] mb-2'}>{card.label}</h3>
                    <p className="text-gray-500 font-medium leading-relaxed text-sm relative z-10">{card.desc}</p>
                    {card.isEmergency && (
                      <div style={{marginTop:16, display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, background:'rgba(220,38,38,0.1)', color:'#dc2626', fontSize:11, fontWeight:700}}>
                        <span style={{width:6,height:6,borderRadius:'50%',background:'#dc2626',animation:'emergencyPulse 2s infinite',display:'inline-block'}}></span>
                        Open Emergency Portal
                      </div>
                    )}
                  </>
                );
                if (card.href) {
                  return (
                    <a
                      key={i}
                      href={card.href}
                      className="action-card bg-white p-8 rounded-[36px] text-left border shadow-sm hover:shadow-2xl hover:-translate-y-2 group relative overflow-hidden block"
                      style={{ borderColor:'rgba(220,38,38,0.25)', textDecoration:'none' }}
                    >
                      <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full opacity-30 group-hover:scale-150 transition-transform duration-700" style={{background:'rgba(220,38,38,0.1)'}}></div>
                      {content}
                    </a>
                  );
                }
                return (
                  <button 
                    key={i} 
                    onClick={card.action} 
                    className={`action-card bg-white p-8 rounded-[36px] text-left border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 group relative overflow-hidden`}
                  >
                    <div className={`absolute -right-6 -bottom-6 w-32 h-32 bg-${card.color}-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700`}></div>
                    {content}
                  </button>
                );
              })}
            </div>

            {/* AI Radar Insights Section */}
            <div className="bg-gradient-to-br from-[#1B4332] to-[#081C15] rounded-[56px] p-12 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-1/2 h-full blob-bg">
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="h-full w-full float-anim">
                  <path fill="#FFFFFF" d="M44.7,-76.4C58.1,-69.2,69.2,-58.1,76.4,-44.7C83.7,-31.3,87.1,-15.6,85.2,-0.2C83.3,15.2,76.1,30.4,66.8,43.4C57.5,56.4,46.1,67.2,32.7,74.1C19.3,81,3.9,84,-11.1,81.9C-26.1,79.8,-40.7,72.6,-53,63.1C-65.3,53.6,-75.3,41.8,-80.7,28.2C-86.1,14.6,-86.9,-0.8,-83.4,-15.1C-79.9,-29.4,-72.1,-42.6,-61.4,-51.7C-50.7,-60.8,-37.1,-65.8,-24.1,-73.4C-11.1,-81,1.3,-91.2,14.7,-91.2C28.1,-91.2,44.7,-76.4,44.7,-76.4Z" transform="translate(100 100)" />
                </svg>
              </div>
              
              <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12">
                <div className="flex-1 space-y-6 text-left">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/20 text-xs font-black uppercase tracking-widest backdrop-blur-md">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Smart Health Insights
                  </div>
                  <h2 className="text-5xl font-black leading-tight hero-heading italic">SANJIVNI Smart Radar</h2>
                  <p className="text-green-100/70 text-lg max-w-xl font-medium">
                    {agentLoading ? 'Our AI is scanning your local grid...' : agentMessage || 'Analyzing 60+ network hospitals for your current location and history...'}
                  </p>
                  
                  <div className="flex flex-wrap gap-4 mt-8">
                    <button onClick={requestAgentCall} className="px-8 py-4 bg-white text-[#1B4332] rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-2xl transition-all hover:-translate-y-1">
                      Request AI Care Call
                    </button>
                    <button onClick={() => setActiveTab('search')} className="px-8 py-4 bg-white/10 border border-white/20 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/20 transition-all">
                      View Capacity Logs
                    </button>
                  </div>
                </div>

                <div className="w-full lg:w-80 bg-white/10 rounded-[48px] border border-white/20 backdrop-blur-xl p-10 text-center space-y-6 transition-all hover:bg-white/20">
                  <div className="w-24 h-24 bg-white/5 mx-auto rounded-full flex items-center justify-center text-5xl">⭐</div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-300">Matching Quality</p>
                    <p className="text-4xl font-black">98.2% Accuracy</p>
                  </div>
                  <p className="text-xs text-green-100/50">Enhanced by real-time bed tracking across Indore.</p>
                </div>
              </div>
            </div>

            {/* Health Snapshot Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-12">
              {[
                { label: 'Live Admissions', value: patientDetail?.current_admission ? 'Admitted' : 'Normal', icon: '🛏️', color: '#dcfce7', textColor: '#16a34a' },
                { label: 'Available Beds', value: `${hospitals.filter(h => (h.available_beds || 0) > 0).length || 0} Nearby`, icon: '🏥', color: '#eff6ff', textColor: '#3b82f6' },
                { label: 'Health Score', value: 'Excellent', icon: '❤️', color: '#fdf2f8', textColor: '#ec4899' },
              ].map((card, i) => (
                <div key={i} className="bg-white rounded-[36px] p-8 border border-gray-100 shadow-sm flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[24px] flex items-center justify-center text-3xl shrink-0" style={{ background: card.color }}>{card.icon}</div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{card.label}</p>
                    <p className="text-xl font-black" style={{ color: card.textColor }}>{card.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* ─── Emergency Tab ─────────────────────────────── */}

        {/* ─── Find Doctors Tab ───────────────────────────────── */}
        {activeTab === 'doctors' && (
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>

            {/* AI Result Banner — shown when symptom analysed */}
            {symptomResult && (
              <div style={{ background: 'linear-gradient(135deg,#1B4332,#2D6A4F)', borderRadius: 24, padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 8px 32px rgba(27,67,50,0.25)', animation: 'symptomSlide .4s ease' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                  {SPEC_ICONS_MAP[symptomResult.specialization] || '👨‍⚕️'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(216,243,220,0.7)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>
                    🤖 AI Recommendation Based on Your Symptoms
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                    {symptomResult.category}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(216,243,220,0.7)', marginTop: 2 }}>
                    Confidence: {Math.round((symptomResult.confidence || 0) * 100)}% · Showing doctors matched to your symptoms
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => { setSymptomText(''); setSymptomResult(null); loadDoctorsByCategory(null); }}
                    style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#D8F3DC', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Show All Doctors
                  </button>
                  <a href="/doctor-portal" style={{ padding: '8px 16px', borderRadius: 20, border: 'none', background: '#fff', color: '#1B4332', cursor: 'pointer', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                    Full Directory →
                  </a>
                </div>
              </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: 32, fontWeight: 800, color: '#1B4332', margin: 0, fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
                  {symptomResult ? `${SPEC_ICONS_MAP[symptomResult.specialization]||'👨‍⚕️'} ${symptomResult.category} Specialists` : '👨‍⚕️ Find Doctors'}
                </h1>
                <p style={{ fontSize: 14, color: '#6b7280', margin: '6px 0 0', fontWeight: 500 }}>
                  {symptomResult
                    ? `Doctors matched to "${symptomText}" — use the voice bar to refine`
                    : 'Describe your symptoms in the top bar to get AI-matched doctors'}
                </p>
              </div>
              <a href="/doctor-portal" style={{ padding: '10px 20px', borderRadius: 20, border: '1.5px solid #1B4332', background: 'transparent', color: '#1B4332', textDecoration: 'none', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                Full Directory 🔗
              </a>
            </div>

            {/* Prompt bar if no symptom */}
            {!symptomResult && !symptomText && (
              <div style={{ background: '#fff', borderRadius: 20, border: '2px dashed #e0dfd8', padding: '28px 32px', textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🎤</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a18', marginBottom: 6 }}>Speak or type your symptoms</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Use the AI Symptom Bar in the top navigation to describe what you're feeling.</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['chest pain', 'headache', 'knee pain', 'high fever', 'back pain'].map(s => (
                    <button key={s} onClick={() => { setSymptomText(s); setActiveTab('doctors'); }}
                      style={{ padding: '6px 16px', borderRadius: 20, border: '1.5px solid #e0dfd8', background: '#f9f9f8', color: '#374151', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      💬 {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Doctor Cards */}
            {docLoading ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#6b7280', fontSize: 14 }}>
                <div style={{ width: 28, height: 28, border: '3px solid #e0dfd8', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spinAI .8s linear infinite', margin: '0 auto 10px' }} />
                Finding matched doctors…
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {(docList.length > 0 ? docList : MOCK_DOCTORS_LIST).map((doc, i) => {
                  const icon = SPEC_ICONS_MAP[doc.specialization] || '👨‍⚕️';
                  const isActive = doc.status === 'active';
                  return (
                    <div key={doc.id || i} style={{ background: '#fff', borderRadius: 20, border: '1px solid #e5e4dc', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', transition: 'all .3s', animation: `fadeU .4s ease ${i * .06}s both` }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                      {/* Card header */}
                      <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1efea', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <div style={{ width: 54, height: 54, borderRadius: 16, background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>{icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#1B4332' }}>{doc.full_name}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{doc.qualification || 'MBBS'}</div>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', color: '#1B4332', fontWeight: 600, display: 'inline-block', marginTop: 4 }}>{icon} {doc.specialization}</span>
                        </div>
                        {doc.is_on_duty_now && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'blink 2s infinite' }} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a' }}>On Duty</span>
                          </div>
                        )}
                      </div>
                      {/* Hospital info */}
                      <div style={{ padding: '12px 20px', background: '#f9fdf9', borderBottom: '1px solid #f1efea', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14 }}>🏥</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1B4332' }}>{doc.hospital_name || '—'}</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{doc.department_name} Department</div>
                        </div>
                      </div>
                      {/* Stats row */}
                      <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#185FA5' }}>{doc.experience_years}y</div>
                          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>Experience</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 13, padding: '3px 10px', borderRadius: 20, background: isActive ? '#dcfce7' : '#fef3c7', color: isActive ? '#16a34a' : '#d97706', fontWeight: 700 }}>
                            {doc.status === 'on_leave' ? 'On Leave' : doc.status === 'active' ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                        <button onClick={() => { setActiveTab('search'); }}
                          style={{ padding: '8px 16px', borderRadius: 20, border: 'none', background: 'linear-gradient(135deg,#1B4332,#2D6A4F)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                          Find Hospital →
                        </button>
                      </div>
                    </div>
                  );
                })}
                {docList.length === 0 && !docLoading && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: '#6b7280', fontSize: 14 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>👨‍⚕️</div>
                    No doctors found for this specialization
                  </div>
                )}
              </div>
            )}

            {/* Link to full portal */}
            <div style={{ textAlign: 'center', marginTop: 32, padding: 24, background: '#f9f9f8', borderRadius: 20, border: '1px solid #e5e4dc' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18', marginBottom: 8 }}>Want to see all {MOCK_DOCTORS_LIST.length}+ doctors with full details?</div>
              <a href="/doctor-portal" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 24, background: '#1B4332', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 14px rgba(27,67,50,0.3)' }}>
                Open Full Doctor Portal 👨‍⚕️
              </a>
            </div>
          </div>
        )}

        {activeTab === 'emergency' && (

          <div className="max-w-2xl mx-auto space-y-8">
            <div>
              <h1 className="text-4xl font-black text-red-600 hero-heading italic mb-2">🚨 Emergency Triage</h1>
              <p className="text-gray-500 font-medium">AI-powered severity assessment and nearest hospital routing — for you or someone near you.</p>
            </div>

            {/* Main CTA */}
            <div style={{
              background: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
              borderRadius: 40, padding: 48, textAlign: 'center', position: 'relative', overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(153,27,27,0.4)',
            }}>
              <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, background:'rgba(255,255,255,0.04)', borderRadius:'50%' }}/>
              <div style={{ fontSize:72, marginBottom:16 }}>🚨</div>
              <h2 style={{ fontSize:32, fontWeight:800, color:'#fff', marginBottom:12, fontFamily:'Playfair Display, serif' }}>
                Need Emergency Help?
              </h2>
              <p style={{ color:'rgba(255,255,255,0.75)', fontSize:16, marginBottom:32, lineHeight:1.6 }}>
                Describe your symptoms. Our AI will assess severity (P1–P4) and instantly route you to the nearest available hospital.
              </p>
              <a
                href="/emergency"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '18px 40px', borderRadius: 32,
                  background: '#fff', color: '#991b1b',
                  textDecoration: 'none', fontWeight: 800, fontSize: 16,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize:20 }}>🏥</span>
                Open Emergency Portal
              </a>
            </div>

            {/* How it works */}
            <div style={{ background:'#fff', borderRadius:28, padding:32, border:'1px solid #fee2e2', boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize:18, fontWeight:700, color:'#1a1a18', marginBottom:20, marginTop:0 }}>
                How Emergency Triage Works
              </h3>
              {[
                { step:'1', icon:'📝', title:'Fill In Symptoms', desc:'Enter patient name, age, department, and describe symptoms in plain language.' },
                { step:'2', icon:'🤖', title:'AI Severity Analysis', desc:'Our engine classifies severity as P1 (Critical) → P4 (Low) with escalation keywords.' },
                { step:'3', icon:'🗺️', title:'Nearest Hospital Map', desc:'GPS-based routing shows the closest hospitals ranked by distance and bed availability.' },
                { step:'4', icon:'📡', title:'Case Broadcast', desc:'Confirming the case instantly notifies the hospital triage dashboard via WebSocket.' },
              ].map(item => (
                <div key={item.step} style={{ display:'flex', gap:16, marginBottom:20, alignItems:'flex-start' }}>
                  <div style={{
                    width:44, height:44, borderRadius:14, flexShrink:0,
                    background:'rgba(220,38,38,0.08)', border:'1.5px solid rgba(220,38,38,0.2)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
                  }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1a1a18', marginBottom:3 }}>
                      <span style={{ color:'#dc2626', marginRight:6, fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em' }}>Step {item.step}</span>
                      {item.title}
                    </div>
                    <div style={{ fontSize:13, color:'#73726c', lineHeight:1.5 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Severity guide */}
            <div style={{ background:'#fff', borderRadius:28, padding:32, border:'1px solid #e5e4dc', boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize:18, fontWeight:700, color:'#1a1a18', marginBottom:20, marginTop:0 }}>
                Priority Levels Explained
              </h3>
              {[
                { level:'P1', label:'Critical', color:'#E24B4A', bg:'#FCEBEB', desc:'Immediate life-threatening. Cardiac arrest, stroke, severe trauma.' },
                { level:'P2', label:'Urgent', color:'#EF9F27', bg:'#FAEEDA', desc:'High risk. Needs treatment within 1 hour. High fever, fractures.' },
                { level:'P3', label:'Moderate', color:'#378ADD', bg:'#E6F1FB', desc:'Semi-urgent. Stable but needs attention within 4 hours.' },
                { level:'P4', label:'Low', color:'#639922', bg:'#EAF3DE', desc:'Non-urgent. Can be managed in OPD or general consultation.' },
              ].map(p => (
                <div key={p.level} style={{
                  display:'flex', alignItems:'center', gap:14, marginBottom:12,
                  padding:'12px 16px', borderRadius:14, background:p.bg,
                  border:`1px solid ${p.color}25`,
                }}>
                  <span style={{
                    padding:'3px 12px', borderRadius:20,
                    background:p.color, color:'#fff',
                    fontWeight:800, fontSize:12, flexShrink:0,
                  }}>{p.level}</span>
                  <span style={{ fontWeight:600, color:p.color, flexShrink:0, fontSize:13 }}>{p.label}</span>
                  <span style={{ fontSize:13, color:'#73726c' }}>{p.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Find Hospital */}
        {activeTab === 'search' && (
          <div className="max-w-5xl mx-auto space-y-8">
            <div>
              <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic mb-2">Find Care Near You</h1>
              <p className="text-gray-500 font-medium">Real-time bed availability across Bhopal's medical network</p>
            </div>
            <div className="relative">
              <input type="text" placeholder="Search hospitals by name or location..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border-2 border-gray-100 rounded-2xl px-6 py-4 pl-12 text-sm font-medium outline-none focus:border-[#2D6A4F]" />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            </div>
            {/* Filters (same theme, minimal UI) */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="bg-white border border-gray-100 rounded-2xl p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">City / Near me</p>
                  {nearMe.enabled ? (
                    <button onClick={disableNearMeSearch} className="text-[10px] font-black text-red-500 hover:bg-red-50 px-2 py-1 rounded-full transition-all">
                      Disable
                    </button>
                  ) : (
                    <button
                      onClick={enableNearMeSearch}
                      disabled={nearMe.loading}
                      className={`text-[10px] font-black text-[#1B4332] hover:bg-green-50 px-2 py-1 rounded-full transition-all ${nearMe.loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                      title="Search hospitals near your current location"
                    >
                      {nearMe.loading ? 'Locating…' : 'Use my location'}
                    </button>
                  )}
                </div>
                <input
                  value={searchFilters.city}
                  onChange={(e) => setSearchFilters((f) => ({ ...f, city: e.target.value }))}
                  disabled={nearMe.enabled}
                  className={`w-full bg-gray-50 rounded-xl px-3 py-2 text-sm font-bold outline-none ${nearMe.enabled ? 'opacity-70 cursor-not-allowed' : ''}`}
                />
                {nearMe.enabled && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-[9px] text-gray-400 font-black uppercase">Radius (km)</p>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={nearMe.radius}
                        onChange={(e) => setNearMe((s) => ({ ...s, radius: parseInt(e.target.value, 10) || 10 }))}
                        className="w-full bg-transparent outline-none text-sm font-black text-gray-900"
                      />
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-[9px] text-gray-400 font-black uppercase">Coords</p>
                      <p className="text-[11px] font-mono text-gray-600 truncate">
                        {typeof nearMe.lat === 'number' ? nearMe.lat.toFixed(4) : '—'}, {typeof nearMe.lng === 'number' ? nearMe.lng.toFixed(4) : '—'}
                      </p>
                    </div>
                  </div>
                )}
                {nearMe.error && <p className="text-[11px] font-bold text-orange-600 mt-2">{nearMe.error}</p>}
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Category</p>
                <select value={searchFilters.category} onChange={(e) => setSearchFilters((f) => ({ ...f, category: e.target.value }))} className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm font-bold outline-none">
                  <option value="all">All</option>
                  <option value="government">Government</option>
                  <option value="private">Private</option>
                  <option value="trust">Trust</option>
                </select>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Has ICU</p>
                <select value={searchFilters.has_icu} onChange={(e) => setSearchFilters((f) => ({ ...f, has_icu: e.target.value }))} className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm font-bold outline-none">
                  <option value="all">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Service</p>
                <select value={searchFilters.service} onChange={(e) => setSearchFilters((f) => ({ ...f, service: e.target.value }))} className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm font-bold outline-none">
                  <option value="all">All</option>
                  {services.map((s, idx) => (
                    <option key={s.code || s.id || idx} value={s.code || s.id || s.name}>
                      {s.name || s.label || s.code || s.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Treatment</p>
                <select value={searchFilters.treatment} onChange={(e) => setSearchFilters((f) => ({ ...f, treatment: e.target.value }))} className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm font-bold outline-none">
                  <option value="all">All</option>
                  {serviceCategories.map((c, idx) => (
                    <option key={c.code || c.id || idx} value={c.code || c.id || c.name}>
                      {c.name || c.label || c.code || c.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading && hospitals.length === 0 && (
                <div className="col-span-full text-center text-gray-400 text-sm py-12">
                  Loading nearby hospitals...
                </div>
              )}
              {!loading && error && (
                <div className="col-span-full text-center text-red-500 text-sm py-6 font-semibold">
                  {error}
                </div>
              )}
              {(filteredHospitals.length > 0 ? filteredHospitals : hospitals).map((h, i) => {
                const beds = getBedSnapshot(h);
                return (
                  <div key={h.id || i} className="hosp-card">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-2xl">🏥</div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black ${beds.availableBeds > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {beds.availableBeds > 0 ? `${beds.availableBeds} Beds` : 'Full'}
                      </span>
                    </div>
                    <h3 className="font-black text-gray-900 text-lg mb-1">{h.name}</h3>
                    <p className="text-xs text-gray-400 font-medium mb-4">
                      {h.category} · {h.city || 'Nearby'}
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-4 text-center">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">General</p>
                        <p className="font-black text-gray-900">{beds.availableBeds}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">ICU</p>
                        <p className="font-black text-gray-900">{beds.icuBeds}</p>
                      </div>
                    </div>
                    <button onClick={() => openHospitalDetail(h)} className="w-full mt-2 bg-white border border-gray-200 text-[#1B4332] py-3 rounded-xl font-bold text-sm hover:bg-green-50 transition-all">
                      View Hospital Profile
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Records */}
        {activeTab === 'records' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div>
              <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic mb-2">Medical Records</h1>
              <p className="text-gray-500 font-medium">Your secure health history</p>
            </div>
            <div className="bg-white rounded-3xl p-10 border border-gray-100 shadow-sm text-center">
              <div className="text-6xl mb-6">📋</div>
              <h3 className="text-2xl font-black text-[#1B4332] hero-heading italic mb-3">Records Vault</h3>
              <p className="text-gray-400 font-medium max-w-md mx-auto">Your complete medical history, prescriptions, lab results, and discharge summaries are securely stored here.</p>
              <div className="mt-8 text-left max-w-2xl mx-auto">
                {profileLoading && <p className="text-gray-400 font-bold text-sm text-center">Loading profile...</p>}
                {!profileLoading && profileError && <p className="text-red-500 font-semibold text-sm text-center">{profileError}</p>}
                {!profileLoading && patientProfile && (
                  <div className="space-y-3">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Patient</p>
                      <p className="text-sm font-black text-gray-900">{patientProfile.full_name || user?.name}</p>
                      <p className="text-xs text-gray-400 font-medium mt-1">{patientProfile.phone || '—'}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Current Admission</p>
                      {patientDetail?.current_admission ? (
                        <>
                          <p className="text-sm font-black text-gray-900">{patientDetail.current_admission.hospital_name || 'Hospital'}</p>
                          <p className="text-xs text-gray-400 font-medium mt-1">
                            Bed: {patientDetail.current_admission.bed_number || '—'} · Admitted: {patientDetail.current_admission.admitted_at ? new Date(patientDetail.current_admission.admitted_at).toLocaleString() : '—'}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-bold text-gray-500">No active admission.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hospital Profile Modal (public endpoints) */}
      {selectedHospital && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <div className="bg-white rounded-[48px] p-10 w-full max-w-4xl shadow-2xl border border-gray-100">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-3xl font-black text-[#1B4332] hero-heading italic">Hospital Profile</h3>
                <p className="text-gray-400 font-medium text-sm">{selectedHospital.name}</p>
              </div>
              <button onClick={() => { setSelectedHospital(null); setHospitalDetail(null); }} className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-xl font-black">×</button>
            </div>

            {hospitalDetailLoading ? (
              <div className="text-center py-16 text-gray-400 font-bold">Loading hospital details...</div>
            ) : hospitalDetailError ? (
              <div className="text-center py-10 text-red-500 font-semibold">{hospitalDetailError}</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-3xl p-6">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Details</p>
                  <p className="text-lg font-black text-gray-900">{hospitalDetail?.name || selectedHospital.name}</p>
                  <p className="text-sm text-gray-500 font-medium mt-1">{hospitalDetail?.category || selectedHospital.category} · {hospitalDetail?.city || selectedHospital.city}</p>
                  <p className="text-xs text-gray-400 font-medium mt-3">{hospitalDetail?.address || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-3xl p-6">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Doctors on duty</p>
                  {hospitalOnDuty.length > 0 ? hospitalOnDuty.slice(0, 6).map((d, idx) => (
                    <div key={d.id || idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                      <p className="text-sm font-bold text-gray-900">{d.full_name || d.name || 'Doctor'}</p>
                      <p className="text-xs text-gray-400 font-medium">{d.specialization || d.department_name || ''}</p>
                    </div>
                  )) : <p className="text-sm text-gray-400 font-medium">No on-duty list available.</p>}
                </div>
                <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Departments</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {hospitalDepartments.length > 0 ? hospitalDepartments.map((dep, idx) => (
                      <div key={dep.id || idx} className="bg-gray-50 rounded-2xl p-4">
                        <p className="text-sm font-black text-gray-900">{dep.name || dep.department_name || 'Department'}</p>
                        <p className="text-xs text-gray-400 font-medium mt-1">{dep.phone || dep.email || ''}</p>
                      </div>
                    )) : <p className="text-sm text-gray-400 font-medium col-span-full">No departments available.</p>}
                  </div>
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <button
                    onClick={() => { setShowAmbulanceModal(true); setAmbulanceRequest((r) => ({ ...r, destination_hospital: selectedHospital.id })); }}
                    className="flex-1 bg-[#1B4332] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#2D6A4F] transition-all"
                  >
                    Book Ambulance to this hospital
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ambulance Modal (public endpoints) */}
      {showAmbulanceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[210] flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-[28px] sm:rounded-[48px] p-4 sm:p-10 w-full max-w-4xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-3xl font-black text-[#1B4332] hero-heading italic">Ambulance</h3>
                <p className="text-gray-400 font-medium text-sm">Search → Book → Track (real-time) → Rate</p>
              </div>
              <button 
                onClick={() => {
                  setShowAmbulanceModal(false);
                  // Reset tracking state
                  setTrackRequestId('');
                  setTracking(null);
                  setDriverLocation(null);
                  setDistanceToDriver(null);
                  setDriverArrived(false);
                  setShowNearbyHospitalsAfterPickup(false);
                }} 
                className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-xl font-black hover:bg-gray-100 transition-all"
              >
                ×
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-3xl p-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">1) Check availability</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">City</label>
                    <input value={ambulanceCity} onChange={(e) => { setAmbulanceCity(e.target.value); setAmbulanceRequest((r) => ({ ...r, pickup_city: e.target.value })); }} className="w-full mt-1 bg-white rounded-2xl p-3 font-bold outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Type</label>
                    <select value={ambulanceType} onChange={(e) => setAmbulanceType(e.target.value)} className="w-full mt-1 bg-white rounded-2xl p-3 font-bold outline-none">
                      <option value="basic">basic</option>
                      <option value="icu">icu</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button onClick={loadAvailableAmbulances} className="bg-[#1B4332] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#2D6A4F] transition-all disabled:opacity-70" disabled={ambulanceLoading}>
                    {ambulanceLoading ? 'Searching...' : 'Search by city'}
                  </button>
                  <button onClick={() => {
                    if (!navigator.geolocation) {
                      setAmbulanceError('Geolocation not supported by this browser');
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      (pos) => loadNearbyAmbulances(pos.coords.latitude, pos.coords.longitude),
                      () => setAmbulanceError('Unable to access your location. Please allow location permission or use "Search by city" instead.')
                    );
                  }} className="bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-all disabled:opacity-70" disabled={ambulanceLoading}>
                    {ambulanceLoading ? 'Searching...' : 'Nearby (GPS)'}
                  </button>
                </div>
                {ambulanceError && <p className="text-sm text-red-500 font-semibold mt-3">{ambulanceError}</p>}
                {ambulanceLoading && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-200">
                    <p className="text-sm text-blue-700 font-bold">🔍 Searching for ambulances nearby...</p>
                  </div>
                )}
                <div className="mt-4 space-y-2 max-h-[160px] overflow-auto">
                  {availableAmbulances.map((a, idx) => (
                    <div key={a.id || idx} className="bg-white rounded-2xl p-3 border border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black text-gray-900">{a.name || a.vehicle_number || 'Ambulance'}</p>
                        {a.distance_km && <p className="text-xs text-gray-400 font-medium">{a.distance_km} km away</p>}
                      </div>
                      <p className="text-xs text-gray-400 font-bold">{a.ambulance_type || ambulanceType}</p>
                    </div>
                  ))}
                  {availableAmbulances.length === 0 && !ambulanceLoading && (
                    <p className="text-sm text-gray-400 font-medium">No ambulances found. Try adjusting search or use GPS.</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-3xl p-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">2) Book</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Pickup address</label>
                    <input value={ambulanceRequest.pickup_address} onChange={(e) => setAmbulanceRequest((r) => ({ ...r, pickup_address: e.target.value }))} className="w-full mt-1 bg-white rounded-2xl p-3 font-bold outline-none" />
                  </div>
                  {/* Map picker for pickup location */}
                  <div className="bg-white rounded-3xl p-4 border border-gray-100">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pickup location on map</p>
                        <p className="text-xs text-gray-500 font-medium mt-1">Click the map to drop a pin, or use your current location.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!navigator.geolocation) {
                            setAmbulanceError('Geolocation is not supported by this browser.');
                            return;
                          }
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              const lat = pos.coords.latitude;
                              const lng = pos.coords.longitude;
                              setPickupPin({ lat, lng });
                              setMapCenter({ lat, lng });
                              setAmbulanceRequest((r) => ({ ...r, pickup_latitude: String(lat), pickup_longitude: String(lng) }));
                            },
                            () => setAmbulanceError('Could not fetch your location. Please allow location access.')
                          );
                        }}
                        className="px-4 py-2 bg-green-50 text-[#1B4332] rounded-xl font-black text-xs hover:bg-green-100 transition-all"
                      >
                        Use my location
                      </button>
                    </div>

                    <div className="w-full h-44 sm:h-56 rounded-3xl overflow-hidden border border-gray-100 bg-gray-50">
                      {isMapLoaded ? (
                        <GoogleMap
                          mapContainerStyle={{ width: '100%', height: '100%' }}
                          center={mapCenter}
                          zoom={13}
                          options={{ disableDefaultUI: true, zoomControl: true }}
                          onClick={(e) => {
                            const lat = e.latLng?.lat();
                            const lng = e.latLng?.lng();
                            if (typeof lat !== 'number' || typeof lng !== 'number') return;
                            setPickupPin({ lat, lng });
                            setAmbulanceRequest((r) => ({ ...r, pickup_latitude: String(lat), pickup_longitude: String(lng) }));
                          }}
                        >
                          {hospitalPin && (
                            <Marker
                              position={hospitalPin}
                              icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' }}
                              title="Hospital"
                            />
                          )}
                          {pickupPin && (
                            <Marker
                              position={pickupPin}
                              icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
                              title="Pickup"
                            />
                          )}
                        </GoogleMap>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 font-bold text-sm">
                          Map loading…
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Pickup latitude</label>
                        <input value={ambulanceRequest.pickup_latitude} onChange={(e) => setAmbulanceRequest((r) => ({ ...r, pickup_latitude: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Pickup longitude</label>
                        <input value={ambulanceRequest.pickup_longitude} onChange={(e) => setAmbulanceRequest((r) => ({ ...r, pickup_longitude: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none" />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-bold text-gray-500">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
                        Pickup location
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span>
                        Hospital location
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Requester name</label>
                      <input value={ambulanceRequest.requester_name} onChange={(e) => setAmbulanceRequest((r) => ({ ...r, requester_name: e.target.value }))} className="w-full mt-1 bg-white rounded-2xl p-3 font-bold outline-none" placeholder={patientProfile?.full_name || user?.name || ''} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Requester phone</label>
                      <input value={ambulanceRequest.requester_phone} onChange={(e) => setAmbulanceRequest((r) => ({ ...r, requester_phone: e.target.value }))} className="w-full mt-1 bg-white rounded-2xl p-3 font-bold outline-none" placeholder={patientProfile?.phone || ''} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Destination hospital</label>
                    <select value={ambulanceRequest.destination_hospital} onChange={(e) => setAmbulanceRequest((r) => ({ ...r, destination_hospital: e.target.value }))} className="w-full mt-1 bg-white rounded-2xl p-3 font-bold outline-none">
                      <option value="">Select hospital…</option>
                      {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                  <button onClick={bookAmbulance} disabled={ambulanceBookLoading} className={`w-full bg-[#1B4332] text-white py-3 rounded-xl font-bold text-sm transition-all ${ambulanceBookLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-[#2D6A4F]'}`}>
                    {ambulanceBookLoading ? 'Booking...' : 'Book ambulance'}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-gray-100">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">3) Live Tracking & Navigation</p>
                    <p className="text-xs text-gray-500 font-medium mt-1">Real-time location updates every 10 seconds</p>
                  </div>
                  <div className="text-right">
                    {driverArrived && (
                      <span className="inline-block px-3 py-2 bg-green-100 text-green-700 font-black text-xs rounded-xl">
                        ✅ Driver Arrived!
                      </span>
                    )}
                    {tracking?.status === 'picked_up' && (
                      <span className="inline-block px-3 py-2 bg-blue-100 text-blue-700 font-black text-xs rounded-xl">
                        🚑 Patient Picked Up
                      </span>
                    )}
                  </div>
                </div>

                {!trackRequestId ? (
                  <p className="text-sm text-gray-400 font-medium">No active request. Book an ambulance to start.</p>
                ) : (
                  <div className="space-y-6">
                    {/* Tracking Status Card */}
                    <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-3xl p-5 border border-blue-100">
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</p>
                          <p className="text-lg font-black text-gray-900 mt-2 capitalize">{tracking?.status?.replace('_', ' ') || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Driver</p>
                          <p className="text-sm font-bold text-gray-900 mt-2">{tracking?.driver_name || 'Waiting...'}</p>
                          <p className="text-xs text-gray-500 font-medium">{tracking?.driver_phone}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Distance</p>
                          <p className="text-2xl font-black text-[#1B4332] mt-2">
                            {distanceToDriver !== null ? `${(distanceToDriver * 1000).toFixed(0)}m` : '—'}
                          </p>
                          {distanceToDriver !== null && distanceToDriver < 0.5 && (
                            <p className="text-xs text-orange-600 font-bold">Driver is very close!</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Live Navigation Map */}
                    {(tracking?.status === 'en_route' || tracking?.status === 'accepted') && (
                      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest p-4 pb-2">Navigation: You ↔ Ambulance</p>
                        <div className="w-full h-64 sm:h-80 bg-gray-50">
                          {isMapLoaded ? (
                            <GoogleMap
                              mapContainerStyle={{ width: '100%', height: '100%' }}
                              center={driverLocation || mapCenter}
                              zoom={14}
                              options={{ disableDefaultUI: true, zoomControl: true }}
                            >
                              {/* Your Location */}
                              {pickupPin && (
                                <Marker
                                  position={pickupPin}
                                  icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
                                  title="Your Location"
                                  label={{ text: 'YOU', fontSize: '10px', fontWeight: 'bold', color: '#1B4332' }}
                                />
                              )}
                              {/* Driver Location */}
                              {driverLocation && (
                                <Marker
                                  position={driverLocation}
                                  icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png' }}
                                  title="Ambulance Location"
                                  label={{ text: '🚑', fontSize: '14px' }}
                                />
                              )}
                            </GoogleMap>
                          ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 font-bold">
                              Map loading…
                            </div>
                          )}
                        </div>
                        <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 border-t border-orange-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-black text-gray-600">Red pin: Your location</p>
                              <p className="text-xs font-black text-gray-600 mt-1">Yellow pin: Ambulance location</p>
                            </div>
                            <button 
                              onClick={() => pollTracking(trackRequestId)} 
                              className="px-4 py-2 bg-[#1B4332] text-white rounded-xl font-black text-xs hover:bg-[#2D6A4F] transition-all"
                            >
                              Refresh Now
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Driver Arrived - Ready for Pickup */}
                    {driverArrived && tracking?.status === 'en_route' && (
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-3xl p-5 border-2 border-green-300 animate-pulse">
                        <div className="flex items-center gap-3">
                          <span className="text-4xl">🚑</span>
                          <div>
                            <p className="text-lg font-black text-green-700">Driver Has Arrived!</p>
                            <p className="text-sm text-green-600 font-bold">Get ready. Your ambulance is here.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* After Pickup - Show Nearby Hospitals */}
                    {showNearbyHospitalsAfterPickup && tracking?.status === 'picked_up' && (
                      <div className="bg-white rounded-3xl border-2 border-blue-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">🏥 Destination Changed?</p>
                            <p className="text-sm text-gray-600 font-bold mt-1">Would you like to go to a nearby hospital instead?</p>
                          </div>
                        </div>
                        <div className="space-y-3 max-h-[200px] overflow-y-auto">
                          {hospitals.slice(0, 5).map((h) => (
                            <div
                              key={h.id}
                              onClick={() => {
                                setAmbulanceRequest((r) => ({ ...r, destination_hospital: h.id }));
                                setShowNearbyHospitalsAfterPickup(false);
                                alert(`Destination updated to ${h.name}`);
                              }}
                              className="p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl border border-blue-200 cursor-pointer hover:border-blue-400 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-black text-gray-900">{h.name}</p>
                                  <p className="text-xs text-gray-500 font-medium mt-1">{h.city} · {h.area || 'City Center'}</p>
                                </div>
                                <span className="text-2xl">→</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trip Completed */}
                    {tracking?.status === 'completed' && (
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-3xl p-5 border-2 border-green-300">
                        <p className="text-lg font-black text-green-700">✅ Trip Completed!</p>
                        <p className="text-sm text-green-600 font-bold mt-2">You've safely arrived at the hospital. Thank you!</p>
                      </div>
                    )}

                    {/* Manual Refresh Button */}
                    <button 
                      onClick={() => pollTracking(trackRequestId)}
                      className="w-full py-3 bg-[#1B4332] text-white rounded-xl font-bold hover:bg-[#2D6A4F] transition-all"
                    >
                      🔄 Refresh Tracking (Updates every 10s)
                    </button>
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">4) Rate after trip</p>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Rating</label>
                      <select value={rating.score} onChange={(e) => setRating((r) => ({ ...r, score: parseInt(e.target.value, 10) }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none">
                        {[5,4,3,2,1].map(v => <option key={v} value={v}>{v} ⭐</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Comment</label>
                      <input value={rating.comment} onChange={(e) => setRating((r) => ({ ...r, comment: e.target.value }))} className="w-full mt-1 bg-gray-50 rounded-2xl p-3 font-bold outline-none" placeholder="Great service! Driver was professional..." />
                    </div>
                  </div>
                  <button onClick={rateAmbulance} disabled={!trackRequestId || tracking?.status !== 'completed'} className={`mt-3 w-full py-3 rounded-xl font-bold text-sm transition-all ${trackRequestId && tracking?.status === 'completed' ? 'bg-[#1B4332] text-white hover:bg-[#2D6A4F]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                    Submit Rating
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[220] flex items-center justify-center p-6">
          <div className="bg-white rounded-[48px] p-12 w-full max-w-2xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-8">
              <div>
                <h3 className="text-3xl font-black text-[#1B4332] hero-heading italic">Edit Profile</h3>
                <p className="text-gray-400 font-medium text-sm">Update your details for faster visits.</p>
              </div>
              <button onClick={() => setShowEditProfile(false)} className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-xl font-black">×</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Full Name</label>
                <input value={editForm.full_name} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Phone</label>
                <input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Email</label>
                <input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" placeholder="optional" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Age</label>
                <input type="number" value={editForm.age} onChange={(e) => setEditForm((f) => ({ ...f, age: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Gender</label>
                <select value={editForm.gender} onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900">
                  <option value="">Select…</option>
                  <option value="male">male</option>
                  <option value="female">female</option>
                  <option value="other">other</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Blood Group</label>
                <input value={editForm.blood_group} onChange={(e) => setEditForm((f) => ({ ...f, blood_group: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" placeholder="Ex: B+" />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Address</label>
                <input value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
                <div className="flex items-center justify-between gap-3 mt-2">
                  <p className="text-[10px] text-gray-400 font-bold">
                    {profileLocationLoading ? 'Fetching your current location...' : profileLocationError || 'Location can be filled automatically from your browser.'}
                  </p>
                  <button
                    type="button"
                    onClick={autofetchProfileLocation}
                    className="text-[10px] font-black uppercase tracking-widest text-[#1B4332] bg-green-50 hover:bg-green-100 px-3 py-2 rounded-full transition-all"
                  >
                    Use my location
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">City</label>
                <input value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Area</label>
                <input value={editForm.area} onChange={(e) => setEditForm((f) => ({ ...f, area: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Emergency Contact Name</label>
                <input value={editForm.emergency_contact_name} onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact_name: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Emergency Contact Phone</label>
                <input value={editForm.emergency_contact_phone} onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Known Allergies</label>
                <input value={editForm.known_allergies} onChange={(e) => setEditForm((f) => ({ ...f, known_allergies: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" placeholder="optional" />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Chronic Conditions</label>
                <input value={editForm.chronic_conditions} onChange={(e) => setEditForm((f) => ({ ...f, chronic_conditions: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" placeholder="optional" />
              </div>
            </div>

            {editError && <p className="text-sm font-semibold text-red-500 mt-5 text-center">{editError}</p>}

            <div className="flex gap-4 pt-8">
              <button onClick={() => setShowEditProfile(false)} className="flex-1 bg-gray-50 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all">
                Cancel
              </button>
              <button onClick={saveProfile} disabled={editSaving} className={`flex-1 bg-[#1B4332] text-white py-4 rounded-2xl font-black transition-all ${editSaving ? 'opacity-70 cursor-not-allowed' : 'hover:bg-[#2D6A4F]'}`}>
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientPortalPage;
