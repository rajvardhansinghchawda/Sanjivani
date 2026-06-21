import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom ambulance icon
const ambulanceIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;width:48px;height:48px;border-radius:50%;background:rgba(220,38,38,0.15);animation:pulse 2s ease-out infinite"></div>
    <div style="width:36px;height:36px;background:white;border-radius:50%;box-shadow:0 4px 10px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;border:2px solid #dc2626;font-size:20px;position:relative;z-index:2">🚑</div>
  </div>`,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, Math.max(map.getZoom(), 14), { animate: true, duration: 1 });
    }
  }, [center]);
  return null;
}

export default function PatientTrackingPage() {
  const { case_id } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [caseData, setCaseData] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState("SEARCHING");
  const [dispatchData, setDispatchData] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  
  const wsRef = useRef(null);

  useEffect(() => {
    if (!case_id) return;
    
    // Fetch initial case data
    const fetchCase = async () => {
      try {
        // Use VITE_API_BASE_URL (with _URL suffix) – that's what .env.local defines.
        // When opened from an external device via ngrok, localhost:8000 is unreachable,
        // so we fall back to the same origin's /api path (works when backend is also proxied).
        const API = import.meta.env.VITE_API_BASE_URL
          || import.meta.env.VITE_API_BASE
          || "http://localhost:8000";
        const res = await fetch(`${API}/api/triage/cases/${case_id}/`);
        if (!res.ok) throw new Error("Case not found");
        const data = await res.json();
        setCaseData(data);
        
        // Setup WebSocket
        const wsAPI = import.meta.env.VITE_API_BASE?.replace('http', 'ws') || 'ws://localhost:8000';
        wsRef.current = new WebSocket(`${wsAPI}/ws/triage/patient/${case_id}/`);
        
        wsRef.current.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          
          if (msg.type === "dispatch_assigned" || msg.type === "driver_event") {
            setDispatchStatus(msg.status || msg.event);
            if (msg.driver_name) {
              setDispatchData(prev => ({ ...prev, ...msg }));
            }
          } else if (msg.type === "driver_location_update") {
            setDriverLocation({ lat: msg.latitude, lng: msg.longitude });
          }
        };
        
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    
    fetchCase();
    
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [case_id]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fdfcf7" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "4px solid #f3f3f3", borderTopColor: "#E24B4A", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }}></div>
          <h2 style={{ color: "#1a1a18", fontWeight: 700 }}>Loading Tracking Details...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fdfcf7" }}>
        <div style={{ background: "#fef2f2", color: "#991b1b", padding: "20px 30px", borderRadius: 16, border: "1px solid #fca5a5", textAlign: "center" }}>
          <h2 style={{ margin: "0 0 10px" }}>⚠️ Error</h2>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  const pLat = parseFloat(caseData?.patient_location?.lat || 0);
  const pLng = parseFloat(caseData?.patient_location?.lng || 0);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#fdfcf7', minHeight: '100vh', padding: "20px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#E24B4A", margin: "0 0 4px" }}>SANJIVNI SOS Tracking</h1>
          <p style={{ color: "#555", fontSize: 14, margin: 0 }}>Case ID: {case_id}</p>
        </div>

        {/* Live Dispatch Panel */}
        <div style={{ background: "#fff", border: "2px solid #E24B4A", borderRadius: 16, padding: "20px", marginBottom: 20, boxShadow: "0 8px 24px rgba(226,75,74,0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1a1a18", display: "flex", alignItems: "center", gap: 8 }}>
              🚑 Live Ambulance Dispatch
            </h3>
            <span style={{ fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 20, background: dispatchStatus === 'SEARCHING' ? '#fef3c7' : dispatchStatus === 'ASSIGNED' || dispatchStatus === 'EN_ROUTE' ? '#dbeafe' : '#dcfce7', color: dispatchStatus === 'SEARCHING' ? '#92400e' : dispatchStatus === 'ASSIGNED' || dispatchStatus === 'EN_ROUTE' ? '#1e40af' : '#166534' }}>
              {dispatchStatus === 'SEARCHING' ? 'SEARCHING FOR DRIVER...' : 
               dispatchStatus === 'ASSIGNED' ? 'DRIVER ASSIGNED' :
               dispatchStatus === 'EN_ROUTE' ? 'AMBULANCE ON THE WAY' :
               dispatchStatus === 'driver_arrived' ? 'AMBULANCE ARRIVED' :
               dispatchStatus === 'patient_picked_up' ? 'HEADING TO HOSPITAL' : 
               dispatchStatus === 'trip_completed' ? 'TRIP COMPLETED' : dispatchStatus}
            </span>
          </div>
          
          {dispatchStatus === 'SEARCHING' && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ display: "inline-block", width: 40, height: 40, border: "4px solid #f3f3f3", borderTopColor: "#E24B4A", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 12 }}></div>
              <p style={{ margin: 0, color: "#555", fontWeight: 500 }}>Locating the nearest available ambulance for you...</p>
            </div>
          )}

          {dispatchData && (dispatchStatus === 'EN_ROUTE' || dispatchStatus === 'driver_arrived' || dispatchStatus === 'patient_picked_up') && (
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
              
              {dispatchStatus === 'EN_ROUTE' && dispatchData.eta_minutes && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Estimated Time of Arrival</p>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#2563eb" }}>{dispatchData.eta_minutes} min</p>
                </div>
              )}
              {dispatchStatus === 'driver_arrived' && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#16a34a", animation: "pulse 2s infinite" }}>🚨 The ambulance is waiting outside!</p>
                </div>
              )}
              {dispatchStatus === 'patient_picked_up' && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>🏥 Patient Picked Up — Routing to Hospital</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map */}
        <div style={{ height: 400, borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", border: "1px solid #e5e4dc" }}>
          {pLat && pLng ? (
            <MapContainer center={[pLat, pLng]} zoom={14} style={{ height: "100%", width: "100%" }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[pLat, pLng]}>
                <Popup><strong>📍 Your Location</strong></Popup>
              </Marker>
              
              {driverLocation && (
                <>
                  <Marker position={[driverLocation.lat, driverLocation.lng]} icon={ambulanceIcon}>
                    <Popup><strong>🚑 Ambulance Location</strong></Popup>
                  </Marker>
                  <Polyline 
                    positions={[[pLat, pLng], [driverLocation.lat, driverLocation.lng]]}
                    color="#E24B4A" 
                    dashArray="8,8" 
                    weight={3} 
                  />
                  <RecenterMap center={[driverLocation.lat, driverLocation.lng]} />
                </>
              )}
            </MapContainer>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f7f5", color: "#888" }}>
              Location data not available.
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
