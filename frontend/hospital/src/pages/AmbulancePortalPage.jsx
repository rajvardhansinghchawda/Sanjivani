import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../services/auth';
import { apiFetch } from '../services/api';
import SanjivniLogo from '../components/SanjivniLogo';
import '../css/styles.css';

const AmbulancePortalPage = () => {
  const navigate = useNavigate();
  const user = Auth.user;
  const [fleet, setFleet] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('fleet');
  const [toast, setToast] = useState('');
  const [showRegModal, setShowRegModal] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regForm, setRegForm] = useState({
    vehicle_number: '', ambulance_type: 'basic',
    driver_name: '', driver_phone: '', driver_license: '',
    city: '', area: '', hospital: '',
  });
  const [regError, setRegError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fleetRes, reqRes] = await Promise.all([
        apiFetch('/api/ambulances/manage/'),
        apiFetch('/api/ambulances/requests/?ordering=-requested_at'),
      ]);

      if (fleetRes.ok) {
        const data = await fleetRes.json();
        const list = Array.isArray(data) ? data : data.results || [];
        setFleet(list.map(a => ({
          id: a.id,
          vehicle: a.vehicle_number,
          driver: a.driver_name,
          status: a.status,
          city: a.city,
          type: a.ambulance_type,
        })));
      }

      if (reqRes.ok) {
        const data = await reqRes.json();
        const list = Array.isArray(data) ? data : data.results || [];
        setRequests(list);
      }
    } catch {
      // keep existing state on error
    }
    setLoading(false);
  };

  const handleLogout = async () => { await Auth.logout(); navigate('/'); };
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const statusStyles = {
    'on_trip': 'bg-yellow-50 text-yellow-600',
    'available': 'bg-green-50 text-green-600',
    'maintenance': 'bg-amber-50 text-amber-700',
    'inactive': 'bg-gray-100 text-gray-400',
  };

  const statusLabel = (status) => {
    if (!status) return 'Unknown';
    const map = {
      on_trip: 'On Trip',
      available: 'Available',
      maintenance: 'Maintenance',
      inactive: 'Offline',
    };
    return map[status] || status;
  };

  const handleStatusUpdate = async (unit, newStatus) => {
    try {
      const res = await apiFetch(`/api/ambulances/${unit.id}/status/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to update status');
        return;
      }
      showToast(`Status updated for ${unit.vehicle}`);
      await loadData();
    } catch {
      showToast('Network error while updating status');
    }
  };

  const registerAmbulance = async (e) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError('');
    try {
      const body = { ...regForm };
      if (!body.hospital) delete body.hospital;
      if (!body.driver_license) delete body.driver_license;
      if (!body.area) delete body.area;
      const res = await apiFetch('/api/ambulances/manage/', {
        method: 'POST', body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRegError(err.vehicle_number?.[0] || err.detail || JSON.stringify(err));
        setRegLoading(false);
        return;
      }
      showToast('Ambulance registered successfully!');
      setShowRegModal(false);
      setRegForm({ vehicle_number: '', ambulance_type: 'basic', driver_name: '', driver_phone: '', driver_license: '', city: '', area: '', hospital: '' });
      await loadData();
    } catch {
      setRegError('Network error');
    }
    setRegLoading(false);
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#FDFCF7', minHeight: '100vh' }}>
      <style>{`.hero-heading { font-family: 'Playfair Display', serif; }`}</style>

      <header style={{ background: 'rgba(253,252,247,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(27,67,50,0.1)', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}>
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SanjivniLogo size={40} showWordmark={false} />
            <span className="text-xl font-black text-[#1B4332]">SANJIVNI <span className="text-gray-400 font-medium text-sm">· Fleet Management</span></span>
          </div>
          <div className="flex gap-2">
            {[['fleet', '🚑 Fleet'], ['dispatch', '📡 Dispatch'], ['reports', '📊 Reports']].map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)} className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${activeTab === id ? 'bg-[#1B4332] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-600">{user?.name || 'Fleet Manager'}</span>
            <button onClick={handleLogout} className="text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-full">Sign Out</button>
          </div>
        </div>
      </header>

      <div className="pt-24 max-w-7xl mx-auto px-8 py-8">
        {/* Fleet Overview Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Fleet', value: fleet.length, icon: '🚑', color: 'bg-blue-50 text-blue-600' },
            { label: 'On Trip', value: fleet.filter(u => u.status === 'on_trip').length, icon: '🟡', color: 'bg-yellow-50 text-yellow-600' },
            { label: 'Available', value: fleet.filter(u => u.status === 'available').length, icon: '🟢', color: 'bg-green-50 text-green-600' },
            { label: 'Offline', value: fleet.filter(u => u.status === 'inactive').length, icon: '⚫', color: 'bg-gray-50 text-gray-600' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className={`inline-flex px-3 py-1.5 rounded-full text-xs font-black mb-3 ${item.color}`}>{item.icon} {item.label}</div>
              <p className="text-4xl font-black text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>

        {activeTab === 'fleet' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic">Fleet Status</h1>
              <button className="bg-[#1B4332] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#2D6A4F] transition-all" onClick={() => setShowRegModal(true)}>+ Add Unit</button>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-gray-50">{['Unit ID', 'Driver', 'Status', 'City', 'Type', 'Actions'].map(h => <th key={h} className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest px-6 py-4">{h}</th>)}</tr></thead>
                <tbody>
                  {fleet.map(unit => (
                    <tr key={unit.id} className="border-b border-gray-50 hover:bg-gray-50 transition-all">
                      <td className="px-6 py-4 font-black text-gray-900 font-mono">{unit.vehicle}</td>
                      <td className="px-6 py-4 font-medium text-gray-700">{unit.driver || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black ${statusStyles[unit.status] || 'bg-gray-50 text-gray-500'}`}>
                          {statusLabel(unit.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{unit.city || '—'}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm font-medium">{unit.type || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => handleStatusUpdate(unit, 'available')} className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100">Mark Available</button>
                          <button onClick={() => handleStatusUpdate(unit, 'maintenance')} className="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-bold hover:bg-yellow-100">Maintenance</button>
                          <button onClick={() => handleStatusUpdate(unit, 'inactive')} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200">Offline</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {fleet.length === 0 && !loading && (
                    <tr>
                      <td className="px-6 py-6 text-center text-gray-400 text-sm" colSpan={6}>
                        No ambulances found. Configure them via the backend `/api/ambulances/manage/` endpoint.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'dispatch' && (
          <div className="space-y-6">
            <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic">Dispatch Center</h1>
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                <h3 className="text-xl font-black text-[#1B4332] italic mb-6">Create Dispatch</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Emergency Type</label>
                    <select className="w-full mt-2 bg-gray-50 rounded-2xl p-4 font-semibold text-gray-700 border-none outline-none">
                      <option>Cardiac Emergency</option><option>Accident</option><option>Respiratory</option><option>General Transport</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Location</label>
                    <input type="text" placeholder="Enter pickup location..." className="w-full mt-2 bg-gray-50 rounded-2xl p-4 font-semibold border-none outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assign Unit</label>
                    <select className="w-full mt-2 bg-gray-50 rounded-2xl p-4 font-semibold text-gray-700 border-none outline-none">
                      {fleet.filter(f => f.status === 'Available').map(f => <option key={f.id}>{f.id} — {f.driver}</option>)}
                    </select>
                  </div>
                  <button onClick={() => showToast('Dispatch created successfully!')} className="w-full bg-[#1B4332] text-white py-4 rounded-2xl font-black hover:bg-[#2D6A4F] transition-all mt-4">🚑 DISPATCH UNIT</button>
                </div>
              </div>
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                <h3 className="text-xl font-black text-[#1B4332] italic mb-6">Active Dispatches</h3>
                <div className="space-y-3">
                  {requests.filter(r => r.status !== 'completed' && r.status !== 'cancelled').map(u => (
                    <div key={u.id} className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-black text-gray-900">{u.ambulance?.vehicle_number || 'Unassigned'}</p>
                          <p className="text-sm text-gray-500">→ {u.destination_hospital?.name || u.pickup_city}</p>
                          <p className="text-xs text-gray-400">Requested: {new Date(u.requested_at).toLocaleString()}</p>
                        </div>
                        <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-lg text-[10px] font-black">{u.status}</span>
                      </div>
                    </div>
                  ))}
                  {requests.filter(r => r.status !== 'completed' && r.status !== 'cancelled').length === 0 && (
                    <div className="text-gray-400 text-sm">No active dispatches right now.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic">Fleet Reports</h1>
            <div className="grid md:grid-cols-3 gap-6">
              {[{ label: 'Total Dispatches Today', value: '28', icon: '🚑', sub: '+4 vs yesterday' }, { label: 'Avg Response Time', value: '8.2 min', icon: '⏱️', sub: '-0.8 min improvement' }, { label: 'Patient Deliveries', value: '26', icon: '✅', sub: '2 in progress' }].map(item => (
                <div key={item.label} className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                  <div className="text-4xl mb-4">{item.icon}</div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{item.label}</p>
                  <p className="text-4xl font-black text-[#1B4332]">{item.value}</p>
                  <p className="text-xs text-green-600 font-bold mt-2">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {toast && <div className="fixed bottom-8 right-8 bg-[#1B4332] text-white px-6 py-4 rounded-2xl font-bold text-sm shadow-xl z-[200]">{toast}</div>}

      {/* Registration Modal */}
      {showRegModal && (
        <div className="modal-overlay active" style={{zIndex:150}}>
          <div className="modal-container max-w-lg">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-black text-[#1B4332] hero-heading italic">Register Ambulance</h3>
                <p className="text-gray-400 text-sm font-medium">Enter vehicle and driver details.</p>
              </div>
              <button onClick={() => setShowRegModal(false)} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-lg font-black hover:bg-gray-100 transition-colors">×</button>
            </div>

            <form onSubmit={registerAmbulance} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vehicle Number *</label>
                  <input type="text" required value={regForm.vehicle_number} onChange={e => setRegForm(f => ({...f, vehicle_number: e.target.value}))} placeholder="MH-12-AB-1234" className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold text-[#1B4332] outline-none border border-gray-100 focus:border-green-600 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type *</label>
                  <select required value={regForm.ambulance_type} onChange={e => setRegForm(f => ({...f, ambulance_type: e.target.value}))} className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold text-[#1B4332] outline-none border border-gray-100 focus:border-green-600 transition-all">
                    <option value="basic">Basic Life Support</option>
                    <option value="advanced">Advanced Life Support</option>
                    <option value="icu">ICU Ambulance</option>
                    <option value="neonatal">Neonatal</option>
                    <option value="mortuary">Mortuary</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Driver Name *</label>
                  <input type="text" required value={regForm.driver_name} onChange={e => setRegForm(f => ({...f, driver_name: e.target.value}))} placeholder="Full name" className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold text-[#1B4332] outline-none border border-gray-100 focus:border-green-600 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Driver Phone *</label>
                  <input type="tel" required value={regForm.driver_phone} onChange={e => setRegForm(f => ({...f, driver_phone: e.target.value}))} placeholder="9876543210" className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold text-[#1B4332] outline-none border border-gray-100 focus:border-green-600 transition-all" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Driver License</label>
                <input type="text" value={regForm.driver_license} onChange={e => setRegForm(f => ({...f, driver_license: e.target.value}))} placeholder="DL-12345678" className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold text-[#1B4332] outline-none border border-gray-100 focus:border-green-600 transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">City *</label>
                  <input type="text" required value={regForm.city} onChange={e => setRegForm(f => ({...f, city: e.target.value}))} placeholder="e.g. Indore" className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold text-[#1B4332] outline-none border border-gray-100 focus:border-green-600 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Area</label>
                  <input type="text" value={regForm.area} onChange={e => setRegForm(f => ({...f, area: e.target.value}))} placeholder="e.g. Vijay Nagar" className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold text-[#1B4332] outline-none border border-gray-100 focus:border-green-600 transition-all" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hospital ID (Optional)</label>
                <input type="text" value={regForm.hospital} onChange={e => setRegForm(f => ({...f, hospital: e.target.value}))} placeholder="UUID of hospital if affiliated" className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold text-[#1B4332] outline-none border border-gray-100 focus:border-green-600 transition-all" />
              </div>

              {regError && <p className="text-red-500 text-sm font-bold">{regError}</p>}

              <button type="submit" disabled={regLoading} className={`w-full bg-[#1B4332] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${regLoading ? 'opacity-60' : 'hover:bg-[#2D6A4F] hover:shadow-lg'}`}>
                {regLoading ? 'Registering...' : '🚑 Register Ambulance'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AmbulancePortalPage;
