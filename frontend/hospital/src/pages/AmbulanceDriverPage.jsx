import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../services/auth';
import { apiFetch } from '../services/api';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import SanjivniLogo from '../components/SanjivniLogo';
import '../css/styles.css';


// Fix default Leaflet marker icons in bundled apps
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom ambulance icon with pulse animation
const driverIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;width:48px;height:48px;border-radius:50%;background:rgba(220,38,38,0.15);animation:navPulse 2s ease-out infinite"></div>
    <div style="position:absolute;width:32px;height:32px;border-radius:50%;background:rgba(220,38,38,0.25);animation:navPulse 2s ease-out infinite 0.5s"></div>
    <div style="width:44px;height:44px;background:white;border-radius:50%;box-shadow:0 4px 20px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;border:3px solid #dc2626;font-size:22px;position:relative;z-index:2">🚑</div>
    <div style="position:absolute;bottom:-6px;width:12px;height:12px;background:white;border-right:3px solid #dc2626;border-bottom:3px solid #dc2626;transform:rotate(45deg);z-index:1"></div>
  </div>`,
  iconSize: [48, 54],
  iconAnchor: [24, 48],
  popupAnchor: [0, -48],
});

// Custom hospital icon
const hospitalIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">
    <div style="width:44px;height:44px;background:white;border-radius:50%;box-shadow:0 4px 20px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;border:3px solid #1B4332;font-size:22px;position:relative;z-index:2">🏥</div>
    <div style="position:absolute;bottom:-6px;width:12px;height:12px;background:white;border-right:3px solid #1B4332;border-bottom:3px solid #1B4332;transform:rotate(45deg);z-index:1"></div>
  </div>`,
  iconSize: [48, 54],
  iconAnchor: [24, 48],
  popupAnchor: [0, -48],
});

// Smooth tracking like Google Maps — flyTo with animation
function RecenterMap({ center, isTracking }) {
  const map = useMap();
  useEffect(() => {
    if (center && isTracking) {
      map.flyTo(center, Math.max(map.getZoom(), 16), {
        animate: true,
        duration: 1.2,
        easeLinearity: 0.25,
      });
    }
  }, [center, isTracking]);
  return null;
}

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const AmbulanceDriverPage = () => {
  const navigate = useNavigate();
  const user = Auth.user;
  const [activeView, setActiveView] = useState('hospitals'); // hospitals | navigation | history
  const [toast, setToast] = useState('');
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };



  // Free-roam trips state (simulating db save for independent navigation)
  const [localTrips, setLocalTrips] = useState([]);

  // Location state
  const [driverLocation, setDriverLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const watchRef = useRef(null);

  // Hospital finder state
  const [hospitals, setHospitals] = useState([]);
  const [hospitalLoading, setHospitalLoading] = useState(false);
  const [bedSummaries, setBedSummaries] = useState({});

  // History state
  const [tripHistory, setTripHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Navigation state
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInstructions, setRouteInstructions] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [routeDistance, setRouteDistance] = useState('');
  const [routeDuration, setRouteDuration] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const locationIntervalRef = useRef(null);
  // Dispatch State
  const [dispatchAlert, setDispatchAlert] = useState(null);
  const [tripPhase, setTripPhase] = useState(null); // 'to_patient' | 'arrived' | 'to_hospital'
  const [activeTrip, setActiveTrip] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    startLocationWatch();
    findNearestHospitals();
    
    // Connect WebSocket
    const setupWS = async () => {
      try {
        const res = await apiFetch('/api/ambulances/driver/dashboard/');
        if (res.ok) {
          const data = await res.json();
          if (data.ambulance && data.ambulance.id) {
            const API = import.meta.env.VITE_API_BASE?.replace('http', 'ws') || 'ws://localhost:8000';
            const token = localStorage.getItem('access_token') || localStorage.getItem('medgrid_access_token');
            const wsUrl = `${API}/ws/ambulance/driver/${data.ambulance.id}/?token=${token}`;
            wsRef.current = new WebSocket(wsUrl);
            wsRef.current.onmessage = (e) => {
              const msg = JSON.parse(e.data);
              if (msg.type === 'dispatch_pending') {
                setDispatchAlert(msg);
              }
            };
          }
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    };
    setupWS();

    return () => {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const startLocationWatch = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by this browser.');
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDriverLocation(newLoc);
        setLocationError('');
        
        // Auto-advance navigation steps
        if (isNavigating && routeInstructions.length > 0 && currentStepIndex < routeInstructions.length) {
          const target = routeInstructions[currentStepIndex].location;
          if (target) {
            const distToTurn = haversine(newLoc.lat, newLoc.lng, target[0], target[1]) * 1000; // in meters
            if (distToTurn < 50) { // If within 50 meters of the turn point
              setCurrentStepIndex(prev => prev + 1);
            }
          }
        }
      },
      () => setLocationError('Location access denied. Please enable GPS.'),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  };

  // ── Hospital Finder ──
  const findNearestHospitals = async () => {
    if (!driverLocation) { showToast('Waiting for GPS location...'); return; }
    setHospitalLoading(true);
    setActiveView('hospitals');
    try {
      const qs = `lat=${driverLocation.lat}&lng=${driverLocation.lng}&radius=25`;
      const res = await apiFetch(`/api/hospitals/search/?${qs}`);
      if (!res.ok) { showToast('Failed to search hospitals'); setHospitalLoading(false); return; }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.results || [];

      // Fetch bed availability for each hospital
      const summaries = {};
      await Promise.all(list.map(async (h) => {
        try {
          const bRes = await apiFetch(`/api/beds/availability/${h.id}/`);
          if (bRes.ok) summaries[h.id] = await bRes.json();
        } catch {}
      }));
      setBedSummaries(summaries);

      // Enrich & sort: distance asc, then available beds desc
      const enriched = list.map(h => {
        const beds = summaries[h.id];
        const availBeds = beds?.available_beds || h.available_beds || 0;
        const lat = parseFloat(h.latitude || 0);
        const lng = parseFloat(h.longitude || 0);
        const dist = (lat && lng) ? haversine(driverLocation.lat, driverLocation.lng, lat, lng) : 999;
        return { ...h, _availBeds: availBeds, _distance: dist };
      });
      enriched.sort((a, b) => a._distance - b._distance || b._availBeds - a._availBeds);
      setHospitals(enriched);
    } catch { showToast('Network error while searching'); }
    setHospitalLoading(false);
  };

  // ── Navigation ──
  const fetchRoute = async (startLat, startLng, endLat, endLng) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.code !== 'Ok') {
        showToast(`Route Error: ${data.message || 'Check location connectivity'}`);
        return;
      }

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]); // [lat, lng]
        setRouteCoords(coords);
        setRouteDistance((route.distance / 1000).toFixed(1) + ' km');
        setRouteDuration(Math.ceil(route.duration / 60) + ' min');

        const steps = route.legs[0]?.steps || [];
        setRouteInstructions(steps.map(s => ({
          instruction: s.maneuver?.instruction || s.name || 'Proceed',
          distance: (s.distance / 1000).toFixed(1) + ' km',
          duration: Math.ceil(s.duration / 60) + ' min',
          location: s.maneuver?.location ? [s.maneuver.location[1], s.maneuver.location[0]] : null
        })).filter(s => s.instruction));
        setCurrentStepIndex(0);
      } else {
        showToast('No route found between these points.');
      }
    } catch (err) {
      console.error('OSRM Fetch Error:', err);
      showToast('Could not fetch route. Check internet connection.');
    }
  };

  const selectHospitalForNav = async (hospital) => {
    if (!driverLocation) { showToast('GPS not available'); return; }
    const hLat = parseFloat(hospital.latitude || 0);
    const hLng = parseFloat(hospital.longitude || 0);
    if (!hLat || !hLng) { showToast('Hospital location not available'); return; }

    setSelectedHospital(hospital);
    setActiveView('navigation');
    setRouteCoords([]);
    setRouteInstructions([]);
    await fetchRoute(driverLocation.lat, driverLocation.lng, hLat, hLng);
  };

  // ── Dispatch Handlers ──
  const acceptDispatch = async () => {
    if (!dispatchAlert || !driverLocation) return;
    const pLat = parseFloat(dispatchAlert.patient_lat);
    const pLng = parseFloat(dispatchAlert.patient_lng);
    
    try {
      await apiFetch(`/api/ambulances/driver/trip/${dispatchAlert.request_id}/action/`, {
        method: 'POST',
        body: JSON.stringify({ action: 'accept' })
      });
      showToast("Dispatch accepted!");
    } catch (err) {
      showToast("Error accepting dispatch");
      return;
    }

    setActiveTrip(dispatchAlert);
    setTripPhase('to_patient');
    setActiveView('navigation');
    
    setSelectedHospital({ 
      name: `Patient: ${dispatchAlert.patient_name}`, 
      latitude: pLat, 
      longitude: pLng,
      isPatient: true 
    });
    
    setDispatchAlert(null);
    await fetchRoute(driverLocation.lat, driverLocation.lng, pLat, pLng);
    startNavigation();
  };

  const rejectDispatch = async () => {
    if (!dispatchAlert) return;
    try {
      await apiFetch(`/api/ambulances/driver/trip/${dispatchAlert.request_id}/action/`, {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel', reason: 'Driver rejected' })
      });
      showToast("Dispatch rejected.");
    } catch (err) {
      console.error(err);
    }
    setDispatchAlert(null);
  };

  const notifyPatientArrived = async () => {
    if (!activeTrip) return;
    try {
      await apiFetch(`/api/triage/cases/${activeTrip.case_id}/driver-event/`, {
        method: 'POST',
        body: JSON.stringify({ event: 'driver_arrived' })
      });
      setTripPhase('arrived');
      showToast("Patient notified of arrival.");
    } catch {
      showToast("Error notifying patient.");
    }
  };

  const startTripToHospital = async () => {
    if (!activeTrip || !driverLocation) return;
    try {
      await apiFetch(`/api/triage/cases/${activeTrip.case_id}/driver-event/`, {
        method: 'POST',
        body: JSON.stringify({ event: 'patient_picked_up' })
      });
      
      setTripPhase('to_hospital');
      
      const hLat = parseFloat(activeTrip.hospital_lat);
      const hLng = parseFloat(activeTrip.hospital_lng);
      setSelectedHospital({ 
        name: `Hospital: ${activeTrip.hospital_name}`, 
        latitude: hLat, 
        longitude: hLng 
      });
      
      await fetchRoute(driverLocation.lat, driverLocation.lng, hLat, hLng);
      showToast("Heading to hospital.");
    } catch {
      showToast("Error updating status.");
    }
  };

  const completeActiveTrip = async () => {
    if (activeTrip && activeTrip.request_id) {
      try {
        await apiFetch(`/api/ambulances/driver/trip/${activeTrip.request_id}/action/`, {
          method: 'POST',
          body: JSON.stringify({ action: 'complete' })
        });
        showToast("Trip completed.");
      } catch (err) {
        console.error(err);
      }
    }
    setActiveTrip(null);
    setTripPhase(null);
    completeNavigation();
  };

  const handleCancelTrip = async (tripId) => {
    try {
      await apiFetch(`/api/ambulances/driver/trip/${tripId}/action/`, {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel', reason: 'Manually cancelled from history' })
      });
      showToast("Trip cancelled.");
      if (activeTrip && activeTrip.request_id === tripId) {
        setActiveTrip(null);
        setTripPhase(null);
      }
      loadHistory();
      checkDashboard();
    } catch (err) {
      showToast("Error cancelling trip");
    }
  };

  const handleCompleteTrip = async (tripId) => {
    try {
      await apiFetch(`/api/ambulances/driver/trip/${tripId}/action/`, {
        method: 'POST',
        body: JSON.stringify({ action: 'complete' })
      });
      showToast("Trip marked as completed.");
      if (activeTrip && activeTrip.request_id === tripId) {
        setActiveTrip(null);
        setTripPhase(null);
      }
      loadHistory();
      checkDashboard();
    } catch (err) {
      showToast("Error completing trip");
    }
  };

  const startNavigation = () => {
    setIsNavigating(true);
    // Send driver location to backend every 10 seconds
    locationIntervalRef.current = setInterval(async () => {
      if (!driverLocation) return;
      try {
        await apiFetch('/api/ambulances/driver/location/', {
          method: 'POST',
          body: JSON.stringify({ latitude: driverLocation.lat, longitude: driverLocation.lng }),
        });
      } catch {}
    }, 10000);
    showToast('Navigation started! Sending live location.');
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    setCurrentStepIndex(0);
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    showToast('Navigation stopped.');
  };

  const completeNavigation = () => {
    if (selectedHospital) {
      const newTrip = {
        id: Date.now(),
        destination_hospital: { name: selectedHospital.name },
        status: 'completed',
        requested_at: new Date().toISOString(),
        isLocal: true,
        routeDistance
      };
      setLocalTrips(prev => [newTrip, ...prev]);
    }
    setIsNavigating(false);
    setCurrentStepIndex(0);
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    showToast('Trip Complete & Saved!');
    setActiveView('history');
  };

  // ── Ride History ──
  const loadHistory = async () => {
    setHistoryLoading(true);
    setActiveView('history');
    try {
      const res = await apiFetch('/api/ambulances/driver/trips/?ordering=-requested_at');
      if (res.ok) {
        const hData = await res.json();
        setTripHistory(Array.isArray(hData) ? hData : (hData.results || []));
      }
    } catch { showToast('Could not load history'); }
    setHistoryLoading(false);
  };

  const handleLogout = async () => { await Auth.logout(); navigate('/'); };

  const tripStatusColors = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    accepted: 'bg-blue-50 text-blue-700 border-blue-200',
    en_route: 'bg-purple-50 text-purple-700 border-purple-200',
    picked_up: 'bg-orange-50 text-orange-700 border-orange-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-red-50 text-red-600 border-red-200',
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#FDFCF7', minHeight: '100vh' }}>

      
      {/* Tracking animation CSS */}
      <style>{`
        @keyframes navPulse {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes routeDash {
          to { stroke-dashoffset: -30; }
        }
        .leaflet-tracking-route { stroke-dasharray: 15, 10; animation: routeDash 1s linear infinite; }
        @keyframes navHudPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
      {/* ── Top Nav ── */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-[1440px] z-50 bg-[#FDFCF7]/85 backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] px-4 py-3 rounded-full flex items-center justify-between transition-all duration-300">
        <div className="flex items-center gap-3 pl-2">
          <SanjivniLogo size={42} showWordmark={false} />
          <span className="text-xl font-bold text-[#1B4332] tracking-tight">SANJIVNI <span className="text-xs opacity-50 font-normal">Driver Portal</span></span>
        </div>

        <div className="hidden lg:flex items-center gap-1 bg-black/5 p-1 rounded-full border border-white/60 shadow-inner">
          <button onClick={findNearestHospitals} className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${activeView === 'hospitals' ? 'text-[#1B4332] bg-white shadow-sm' : 'text-gray-700 hover:text-[#1B4332] hover:bg-white hover:shadow-sm'}`}>Find Hospital</button>
          <button onClick={() => setActiveView('navigation')} className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${activeView === 'navigation' ? 'text-[#1B4332] bg-white shadow-sm' : 'text-gray-700 hover:text-[#1B4332] hover:bg-white hover:shadow-sm'}`}>Navigation</button>
          <button onClick={loadHistory} className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${activeView === 'history' ? 'text-[#1B4332] bg-white shadow-sm' : 'text-gray-700 hover:text-[#1B4332] hover:bg-white hover:shadow-sm'}`}>Ride History</button>
        </div>

        <div className="flex items-center gap-2 pr-1">
          <div className="flex items-center gap-3 px-3 py-1.5 bg-black/5 rounded-full mr-2">
            <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-[10px] font-black">{(user?.name || 'D')[0]}</div>
            <span className="text-xs font-bold text-[#1B4332]">{user?.name || 'Driver'}</span>
          </div>
          <button onClick={handleLogout} className="bg-gradient-to-r from-red-600 to-red-700 text-white px-5 py-2 rounded-full text-xs font-bold shadow-lg hover:-translate-y-0.5 transition-all">Sign Out</button>
        </div>
      </nav>

      {/* ── GPS Status Pill ── */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40">
        <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-2 ${driverLocation ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          <span className={`w-2 h-2 rounded-full ${driverLocation ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          {driverLocation ? `GPS Active · ${driverLocation.lat.toFixed(4)}, ${driverLocation.lng.toFixed(4)}` : (locationError || 'Acquiring GPS...')}
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-6 pt-32 pb-12 min-h-screen">

        {/* ════════════════════════════════════════════════════════
            HOSPITAL FINDER VIEW
        ════════════════════════════════════════════════════════ */}
        {activeView === 'hospitals' && (
          <section className="space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2">
                <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic leading-tight">Nearest Hospitals</h1>
                <p className="text-gray-500 font-medium">Sorted by distance from your location, then available beds.</p>
              </div>
              <button onClick={findNearestHospitals} className="px-6 py-3 bg-[#1B4332] text-white rounded-full font-black text-xs uppercase tracking-widest hover:bg-[#2D6A4F] transition-all">
                🔄 Refresh
              </button>
            </div>

            {hospitalLoading ? (
              <div className="text-center py-20 text-gray-400 font-bold">Scanning nearby hospitals...</div>
            ) : hospitals.length === 0 ? (
              <div className="bg-white rounded-[40px] p-12 border border-gray-100 shadow-sm text-center">
                <div className="text-6xl mb-6">🏥</div>
                <h3 className="text-2xl font-black text-[#1B4332] hero-heading italic mb-3">No Hospitals Found</h3>
                <p className="text-gray-400 font-medium">No hospitals within 25 km. Try again when your GPS is active.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {hospitals.map((h, i) => (
                  <div key={h.id || i} className="hospital-card rounded-[32px] overflow-hidden">
                    <div className="p-8">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B4332" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M12 9v4"/><path d="M10 11h4"/></svg>
                          </div>
                          {i < 3 && <span className="px-2 py-0.5 bg-green-600 text-white rounded-md text-[9px] font-black uppercase">Top {i + 1}</span>}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${h._availBeds > 0 ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                          {h._availBeds > 0 ? `${h._availBeds} Beds` : 'Full'}
                        </span>
                      </div>

                      <h3 className="text-lg font-black text-[#1B4332] leading-tight mb-1">{h.name}</h3>
                      <p className="text-xs text-gray-400 font-medium mb-4">{h.category} · {h.city || 'Nearby'}</p>

                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-gray-50 rounded-2xl p-3 text-center">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Beds</p>
                          <p className="text-xl font-black text-gray-900">{h._availBeds}</p>
                        </div>
                        <div className="bg-blue-50 rounded-2xl p-3 text-center">
                          <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Distance</p>
                          <p className="text-xl font-black text-blue-700">{h._distance < 999 ? h._distance.toFixed(1) + ' km' : '—'}</p>
                        </div>
                      </div>

                      <button onClick={() => selectHospitalForNav(h)} className="w-full bg-[#1B4332] text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#2D6A4F] transition-all flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                        Get Directions
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ════════════════════════════════════════════════════════
            NAVIGATION VIEW
        ════════════════════════════════════════════════════════ */}
        {activeView === 'navigation' && (
          <section className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <button onClick={() => setActiveView('hospitals')} className="inline-flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-green-600 transition-colors mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                  Back
                </button>
                <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic leading-tight">Navigation</h1>
                {selectedHospital && <p className="text-gray-500 font-medium">Routing to <span className="font-black text-[#1B4332]">{selectedHospital.name}</span></p>}
              </div>
              {routeDistance && (
                <div className="flex gap-4">
                  <div className="px-5 py-2 bg-green-50 rounded-full text-xs font-black text-green-700 border border-green-100">{routeDistance}</div>
                  <div className="px-5 py-2 bg-blue-50 rounded-full text-xs font-black text-blue-700 border border-blue-100">⏱ {routeDuration}</div>
                </div>
              )}
            </div>

            {!selectedHospital || !driverLocation ? (
              <div className="bg-white rounded-[40px] p-12 border border-gray-100 shadow-sm text-center">
                <div className="text-6xl mb-6">🗺️</div>
                <h3 className="text-2xl font-black text-[#1B4332] hero-heading italic mb-3">No Destination Set</h3>
                <p className="text-gray-400 font-medium mb-6">Select a hospital from the Hospital Finder to start navigation.</p>
                <button onClick={findNearestHospitals} className="bg-[#1B4332] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#2D6A4F] transition-all">
                  Find Hospital
                </button>
              </div>
            ) : (
              <div className="grid lg:grid-cols-[1fr_380px] gap-8">
                {/* Map */}
                <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden relative" style={{ height: '70vh', minHeight: 500 }}>
                  {/* Navigation HUD overlay */}
                  {isNavigating && routeInstructions.length > 0 && (
                    <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col gap-2">
                      <div className="bg-[#1B4332] text-white rounded-[24px] px-6 py-4 shadow-2xl border border-[#2D6A4F] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xl shrink-0">
                            {currentStepIndex < routeInstructions.length ? '↗️' : '🏁'}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-green-300 uppercase tracking-widest mb-0.5">
                              {currentStepIndex < routeInstructions.length ? 'Next Turn' : 'Arriving at Destination'}
                            </p>
                            <p className="text-xl font-black leading-tight">
                              {currentStepIndex < routeInstructions.length 
                                ? routeInstructions[currentStepIndex].instruction 
                                : `Arrive at ${selectedHospital?.name}`}
                            </p>
                          </div>
                        </div>
                        {currentStepIndex < routeInstructions.length && (
                          <div className="text-right shrink-0">
                            <p className="text-2xl font-black">{routeInstructions[currentStepIndex].distance}</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-end gap-2">
                        <div className="bg-white/95 backdrop-blur-md rounded-2xl px-4 py-2 shadow-xl border border-gray-100 text-center">
                          <p className="text-[9px] font-black text-gray-400 uppercase">Total Dist</p>
                          <p className="text-sm font-black text-[#1B4332]">{routeDistance}</p>
                        </div>
                        <div className="bg-white/95 backdrop-blur-md rounded-2xl px-4 py-2 shadow-xl border border-gray-100 text-center flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" style={{animation:'navHudPulse 1.5s infinite'}}></div>
                          <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase">ETA</p>
                            <p className="text-sm font-black text-blue-700">{routeDuration}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <MapContainer center={[driverLocation.lat, driverLocation.lng]} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true} zoomControl={false}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <RecenterMap center={isNavigating ? [driverLocation.lat, driverLocation.lng] : null} isTracking={isNavigating} />
                    <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon}>
                      <Popup><b>🚑 Your Location</b></Popup>
                    </Marker>
                    {selectedHospital && parseFloat(selectedHospital.latitude) && (
                      <Marker position={[parseFloat(selectedHospital.latitude), parseFloat(selectedHospital.longitude)]} icon={hospitalIcon}>
                        <Popup><b>🏥 {selectedHospital.name}</b></Popup>
                      </Marker>
                    )}
                    {routeCoords.length > 0 && (
                      <>
                        {/* Shadow route line */}
                        <Polyline positions={routeCoords} pathOptions={{ color: '#0B3D1F', weight: 8, opacity: 0.2 }} />
                        {/* Main route line */}
                        <Polyline positions={routeCoords} pathOptions={{ color: '#2D6A4F', weight: 5, opacity: 0.9 }} />
                        {/* Animated dash overlay when navigating */}
                        {isNavigating && (
                          <Polyline positions={routeCoords} pathOptions={{ color: '#4ADE80', weight: 4, opacity: 0.8, dashArray: '15 10', className: 'leaflet-tracking-route' }} />
                        )}
                      </>
                    )}
                  </MapContainer>
                </div>

                {/* Directions Panel */}
                <div className="space-y-6">
                  {/* Controls */}
                  <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Navigation Controls</p>
                    {!isNavigating && !tripPhase ? (
                      <button onClick={startNavigation} className="w-full bg-[#1B4332] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#2D6A4F] transition-all flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        Start Navigation
                      </button>
                    ) : tripPhase === 'to_patient' ? (
                      <button onClick={notifyPatientArrived} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-md hover:shadow-lg transition-all">
                        🚑 I've Arrived at Patient
                      </button>
                    ) : tripPhase === 'arrived' ? (
                      <button onClick={startTripToHospital} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 shadow-md hover:shadow-lg transition-all">
                        ✅ Patient Picked Up → Go to Hospital
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <button onClick={tripPhase === 'to_hospital' ? completeActiveTrip : completeNavigation} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-700 shadow-md hover:shadow-lg transition-all">
                          🏁 Complete Trip
                        </button>
                        <button onClick={stopNavigation} className="w-full bg-red-50 text-red-600 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-red-200 hover:bg-red-100 transition-all">
                          ⏹ Cancel
                        </button>
                      </div>
                    )}
                    {isNavigating && (
                      <p className="text-center text-[10px] font-bold text-green-600 mt-4 animate-pulse">📡 Sending live GPS every 10s</p>
                    )}
                  </div>

                  {/* Active Booking Details */}
                  {activeTrip && (
                    <div className="bg-red-50 border border-red-200 rounded-[32px] p-6 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-red-600"></div>
                      <p className="text-[10px] font-black text-red-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                        Active Emergency Booking
                      </p>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Patient</p>
                            <p className="font-black text-red-900 text-lg leading-tight">{activeTrip.patient_name}</p>
                            {activeTrip.patient_phone && (
                              <a href={`tel:${activeTrip.patient_phone}`} className="inline-flex items-center gap-1 text-sm font-bold text-red-600 hover:text-red-800 mt-1 bg-white px-2 py-1 rounded-md border border-red-100 shadow-sm">
                                📞 {activeTrip.patient_phone}
                              </a>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Severity</p>
                            <span className="inline-block px-3 py-1 bg-red-600 text-white font-black text-xs rounded-lg shadow-sm">
                              {activeTrip.severity}
                            </span>
                          </div>
                        </div>

                        {activeTrip.routing_explanation && (
                          <div className="bg-white/60 p-3 rounded-xl border border-red-100">
                            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Condition</p>
                            <p className="text-sm font-bold text-red-900">{activeTrip.routing_explanation}</p>
                          </div>
                        )}
                        
                        <div>
                          <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Target Hospital</p>
                          <p className="font-black text-gray-900">{activeTrip.hospital_name}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Turn-by-turn */}
                  <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm max-h-[50vh] overflow-y-auto">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Turn-by-Turn Directions</p>
                    {routeInstructions.length > 0 ? (
                      <div className="space-y-3 relative">
                        {/* Connecting line */}
                        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200"></div>
                        
                        {routeInstructions.map((step, i) => {
                          const isPast = i < currentStepIndex;
                          const isCurrent = i === currentStepIndex;
                          return (
                            <div key={i} className={`flex gap-4 items-start relative z-10 transition-all duration-300 ${isPast ? 'opacity-40' : 'opacity-100'} ${isCurrent ? 'scale-[1.02]' : ''}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm transition-colors duration-300 ${isCurrent ? 'bg-green-500 text-white ring-4 ring-green-100' : isPast ? 'bg-gray-300 text-white' : 'bg-white border-2 border-gray-200 text-gray-500'}`}>
                                {isPast ? '✓' : i + 1}
                              </div>
                              <div className={`flex-1 p-4 rounded-2xl border transition-colors duration-300 ${isCurrent ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-white border-gray-100'}`}>
                                <p className={`text-sm font-bold ${isCurrent ? 'text-green-900' : 'text-gray-900'}`}>{step.instruction}</p>
                                <p className={`text-[10px] font-bold mt-1 ${isCurrent ? 'text-green-700' : 'text-gray-400'}`}>{step.distance} · {step.duration}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 font-medium">Route instructions will appear here.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ════════════════════════════════════════════════════════
            HISTORY VIEW
        ════════════════════════════════════════════════════════ */}
        {activeView === 'history' && (
          <section className="space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2">
                <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic leading-tight">Ride History</h1>
                <p className="text-gray-500 font-medium">Your completed trips and active emergency requests.</p>
              </div>
              <button onClick={loadHistory} className="px-6 py-3 bg-[#1B4332] text-white rounded-full font-black text-xs uppercase tracking-widest hover:bg-[#2D6A4F] transition-all">
                🔄 Refresh
              </button>
            </div>

            {historyLoading ? (
              <div className="text-center py-20 text-gray-400 font-bold">Loading past trips...</div>
            ) : [...localTrips, ...tripHistory].length === 0 ? (
              <div className="bg-white rounded-[40px] p-12 border border-gray-100 shadow-sm text-center">
                <div className="text-6xl mb-6">🗂️</div>
                <h3 className="text-2xl font-black text-[#1B4332] hero-heading italic mb-3">No Trips Yet</h3>
                <p className="text-gray-400 font-medium">You haven't completed any trips in this session.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...localTrips, ...tripHistory]
                  .sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at))
                  .map((trip) => (
                  <div key={trip.id} className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${tripStatusColors[trip.status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {trip.status?.replace('_', ' ')} {trip.isLocal && '(Local)'}
                      </span>
                      <p className="text-[10px] font-bold text-gray-400">{new Date(trip.requested_at).toLocaleDateString()}</p>
                    </div>
                    <div className="space-y-3">
                      {trip.requester_name && (
                        <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Patient / Pickup</p>
                          <p className="text-sm font-bold text-gray-900 leading-tight">{trip.requester_name}</p>
                          <p className="text-xs font-medium text-gray-500">{trip.pickup_address}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Destination</p>
                        <p className="text-sm font-bold text-[#1B4332] leading-tight">{trip.destination_name || trip.destination_hospital?.name || 'Not set'}</p>
                        {trip.routeDistance && <p className="text-[10px] font-bold text-gray-400">Distance Configured: {trip.routeDistance}</p>}
                      </div>
                      
                      {/* Actions for Pending/Active Trips */}
                      {trip.status !== 'completed' && trip.status !== 'cancelled' && !trip.isLocal && (
                        <div className="flex gap-2 pt-2 border-t border-gray-100 mt-2">
                          <button onClick={() => handleCompleteTrip(trip.id)} className="flex-1 bg-green-50 text-green-700 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-100 transition-all">
                            Complete
                          </button>
                          <button onClick={() => handleCancelTrip(trip.id)} className="flex-1 bg-red-50 text-red-700 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all">
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Dispatch Alert Overlay */}
      {dispatchAlert && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl border border-red-500 animate-[pulse_2s_infinite]">
            <div className="bg-red-600 p-6 text-center text-white relative">
              <div className="absolute top-0 left-0 w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.1)_10px,rgba(0,0,0,0.1)_20px)]"></div>
              <h2 className="text-3xl font-black italic relative z-10">🚨 EMERGENCY DISPATCH 🚨</h2>
            </div>
            <div className="p-8 space-y-6">
              <div className="text-center space-y-2 border-b pb-6">
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Severity</p>
                <div className="inline-block px-4 py-1.5 bg-red-100 text-red-700 font-black text-xl rounded-full border border-red-200">
                  {dispatchAlert.severity} — CRITICAL
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Patient</p>
                  <p className="font-bold text-gray-900">{dispatchAlert.patient_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Distance</p>
                  <p className="font-bold text-blue-700">{dispatchAlert.eta_to_patient_minutes} min ETA</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Destination Hospital</p>
                  <p className="font-bold text-[#1B4332]">{dispatchAlert.hospital_name}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={rejectDispatch} className="flex-1 bg-red-100 text-red-700 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-200 transition-all">
                  ❌ REJECT
                </button>
                <button onClick={acceptDispatch} className="flex-1 bg-green-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-green-700 shadow-xl transition-all flex justify-center items-center gap-3">
                  <span className="text-2xl">✅</span> ACCEPT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 right-8 z-[200] bg-[#1B4332] text-white px-6 py-4 rounded-2xl font-bold text-sm shadow-xl max-w-sm">
          {toast}
        </div>
      )}
    </div>
  );
};

export default AmbulanceDriverPage;
