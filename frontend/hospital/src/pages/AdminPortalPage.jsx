import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../services/auth';
import { apiFetch } from '../services/api';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import SanjivniLogo from '../components/SanjivniLogo';
import '../css/styles.css';

const kpiData = [
  { label: 'Total Beds Available', value: '142', trend: '↑ 8.2%', trendClass: 'text-green-500', pct: '65%', barColor: 'bg-green-500' },
  { label: 'ICU Occupancy Rate', value: '88.4%', trend: '↑ 12.1%', trendClass: 'text-red-500', pct: '88%', barColor: 'bg-red-500' },
  { label: 'Avg Patient Stay', value: '6.4d', trend: 'Stable', trendClass: 'text-gray-400', pct: '45%', barColor: 'bg-blue-500' },
];

const AdminPortalPage = () => {
  const navigate = useNavigate();
  const user = Auth.user;
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffRole, setStaffRole] = useState('supervisor');
  const [staffForm, setStaffForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [staffError, setStaffError] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [showCredModal, setShowCredModal] = useState(false);
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [hospitalSettings, setHospitalSettings] = useState({
    hospitalName: '',
    category: 'Private',
    hospitalType: 'Multispecialty',
    address: '',
    city: '',
    area: '',
    district: '',
    state: '',
    pincode: '',
    latitude: '',
    longitude: '',
    email: '',
    website: '',
    status: '',
    verificationStatus: '',
    licenseNumber: ''
  });
  const [hospitalId, setHospitalId] = useState(user?.hospital || '');
  const [msg, setMsg] = useState('');
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 20.5937, lng: 78.9629 }); // Default to India center

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });
  
  // Dashboard Metrics
  const [dashboardData, setDashboardData] = useState({ beds: {}, patients: {}, transfers: {} });
  // Staff List
  const [managementTeam, setManagementTeam] = useState([]);

  const fetchDashboardData = async () => {
    try {
      const res = await apiFetch('/api/analytics/my-hospital/');
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await apiFetch('/api/auth/users/');
      if (res.ok) {
        const data = await res.json();
        setManagementTeam(Array.isArray(data) ? data : data.results || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchHospitalConfig = async (id) => {
    try {
      const res = await apiFetch(`/api/hospitals/manage/${id}/`);
      if (res.ok) {
        const data = await res.json();
        setHospitalSettings({
          hospitalName: data.name || '',
          category: data.category || 'Private',
          hospitalType: data.hospital_type || 'Multispecialty',
          totalBeds: data.total_beds || '',
          icu_capacity: data.icu_capacity || '',
          address: data.address || '',
          city: data.city || '',
          area: data.area || '',
          district: data.district || '',
          state: data.state || '',
          pincode: data.pincode || '',
          latitude: data.latitude || '',
          longitude: data.longitude || '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          status: data.status || '',
          verificationStatus: data.verification_status || '',
          licenseNumber: data.license_number || ''
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;
    try {
      const res = await apiFetch(`/api/auth/users/${staffId}/`, { method: 'DELETE' });
      if (res.ok) {
        setMsg('Staff member deleted successfully');
        fetchStaff();
        setTimeout(() => setMsg(''), 3000);
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to delete staff member');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    
    // Fetch dashboard stats
    fetchDashboardData();

    // Fetch staff list
    fetchStaff();

    // Fetch admin profile to get hospital UUID if not already in stored user
    if (!hospitalId) {
      apiFetch('/api/auth/profile/').then(async (res) => {
        if (res.ok) {
          const profile = await res.json();
          if (profile.hospital) {
            setHospitalId(profile.hospital);
            fetchHospitalConfig(profile.hospital);
          }
        }
      }).catch(() => {});
    } else {
      fetchHospitalConfig(hospitalId);
    }
  }, []);

  const handleLogout = async () => { await Auth.logout(); navigate('/'); };

  const openStaffModal = (role) => {
    setStaffRole(role);
    setShowStaffModal(true);
    setStaffForm({ name: '', email: '', phone: '', password: '' });
    setStaffError('');
  };

  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    setStaffError('');
    setStaffLoading(true);
    try {
      const payload = {
        full_name: staffForm.name,
        email: staffForm.email,
        phone: staffForm.phone,
        password: staffForm.password,
        password2: staffForm.password,
        role: staffRole === 'receptionist' ? 'reception' : staffRole,
        hospital: hospitalId,
      };
      const res = await apiFetch('/api/auth/register/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setShowStaffModal(false);
        setCredentials({ email: staffForm.email, password: staffForm.password });
        setShowCredModal(true);
      } else {
        // Parse Django validation errors
        let errorMsg = data.detail;
        if (!errorMsg && typeof data === 'object') {
          const firstKey = Object.keys(data)[0];
          const val = data[firstKey];
          errorMsg = `${firstKey}: ${Array.isArray(val) ? val[0] : val}`;
        }
        setStaffError(errorMsg || 'Registration failed. Check fields and try again.');
      }
    } catch (err) {
      setStaffError(err.message);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    if (!hospitalId) return;
    try {
      const res = await apiFetch(`/api/hospitals/manage/${hospitalId}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: hospitalSettings.hospitalName,
          category: hospitalSettings.category,
          hospital_type: hospitalSettings.hospitalType,
          total_beds: hospitalSettings.totalBeds,
          icu_capacity: hospitalSettings.icu_capacity,
          address: hospitalSettings.address,
          city: hospitalSettings.city,
          area: hospitalSettings.area,
          district: hospitalSettings.district,
          state: hospitalSettings.state,
          pincode: hospitalSettings.pincode,
          latitude: hospitalSettings.latitude,
          longitude: hospitalSettings.longitude,
          phone: hospitalSettings.phone,
          email: hospitalSettings.email,
          website: hospitalSettings.website,
          license_number: hospitalSettings.licenseNumber
        }),
      });
      if (res.ok) {
        setMsg('Configuration saved successfully!');
        setTimeout(() => setMsg(''), 3000);
      } else {
        const error = await res.json();
        setMsg(error.detail || 'Failed to update configuration.');
        setTimeout(() => setMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const navLinks = [
    { id: 'dashboard', label: 'Executive Hub', icon: '📊' },
    { id: 'staff', label: 'Staffing Control', icon: '👥' },
    { id: 'settings', label: 'Core Settings', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#FDFCF7' }}>
      <style>{`
        .kpi-card { transition: all 0.3s cubic-bezier(0.23,1,0.32,1); background: white; border: 1px solid rgba(27,67,50,0.05); }
        .kpi-card:hover { transform: translateY(-8px); box-shadow: 0 25px 50px -12px rgba(27,67,50,0.1); }
        .glass-header { background: rgba(253,252,247,0.85); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(27,67,50,0.05); }
        .sidebar-link { border-left: 3px solid transparent; }
        .sidebar-link.active { border-left-color: #1B4332; background: #f0fdf4; color: #1B4332 !important; font-weight: 700; }
        .hero-heading { font-family: 'Playfair Display', serif; }
      `}</style>

      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-gray-100 flex flex-col z-50">
        <div className="p-8 pb-12 flex items-center gap-3">
          <SanjivniLogo size={40} showWordmark={false} />
          <span className="text-xl font-black text-[#1B4332] max-w-[200px] truncate" title={user?.hospitalName || 'SANJIVNI'}>
            {user?.hospitalName || 'SANJIVNI'}
          </span>
        </div>
        <nav className="flex-1 space-y-1">
          {navLinks.map(link => (
            <button key={link.id} onClick={() => setActiveSection(link.id)}
              className={`sidebar-link w-full flex items-center gap-4 px-8 py-4 text-sm font-bold text-gray-500 transition-all hover:bg-gray-50 ${activeSection === link.id ? 'active' : ''}`}>
              <span>{link.icon}</span> {link.label}
            </button>
          ))}
        </nav>
        <div className="p-8 border-t border-gray-50">
          <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-2xl">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">A</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-gray-900 truncate">{user?.name || 'Admin User'}</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Medical Director</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 text-red-500 font-bold text-xs uppercase hover:bg-red-50 rounded-xl transition-all">
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#FDFCF7]">
        <header className="h-20 glass-header flex items-center justify-between px-10">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black text-[#1B4332] hero-heading italic">
              {navLinks.find(n => n.id === activeSection)?.label || 'Executive Hub'}
            </h1>
            <span className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-green-100">Analytics Live</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/triage-dashboard')} className="text-sm font-bold text-red-600 bg-red-50 rounded-full px-4 py-1.5 border border-red-100 shadow-sm hover:bg-red-100 transition-all flex items-center gap-2">
              🚨 Live Triage
            </button>
            <button className="bg-gray-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-black transition-all">Export (CSV)</button>
            <button className="bg-white border border-gray-100 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all">Date Range</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 space-y-10">
          {/* Dashboard Section */}
          {activeSection === 'dashboard' && (
            <div className="space-y-10">
              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="kpi-card p-8 rounded-[32px] shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Beds Available</p>
                  <div className="flex items-end justify-between">
                    <h3 className="text-4xl font-black text-gray-900">{dashboardData.beds?.available ?? '—'}</h3>
                    <span className={`text-green-500 text-xs font-bold mb-1`}>Available</span>
                  </div>
                  <div className="mt-4 w-full bg-gray-50 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: `${100 - (dashboardData.beds?.occupancy_rate || 0)}%` }}></div>
                  </div>
                </div>
                <div className="kpi-card p-8 rounded-[32px] shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Occupancy Rate</p>
                  <div className="flex items-end justify-between">
                    <h3 className="text-4xl font-black text-gray-900">{dashboardData.beds?.occupancy_rate ?? 0}%</h3>
                    <span className={`text-red-500 text-xs font-bold mb-1`}>Of {dashboardData.beds?.total ?? 0} Beds</span>
                  </div>
                  <div className="mt-4 w-full bg-gray-50 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full" style={{ width: `${dashboardData.beds?.occupancy_rate || 0}%` }}></div>
                  </div>
                </div>
                <div className="kpi-card p-8 rounded-[32px] shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Current Patients</p>
                  <div className="flex items-end justify-between">
                    <h3 className="text-4xl font-black text-gray-900">{dashboardData.patients?.still_in ?? '—'}</h3>
                    <span className={`text-blue-500 text-xs font-bold mb-1`}>Admitted</span>
                  </div>
                  <div className="mt-4 w-full bg-gray-50 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `75%` }}></div>
                  </div>
                </div>
              </section>

              <section className="grid lg:grid-cols-2 gap-10">
                <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-6">Bed Utilization Trend</h3>
                  <div className="space-y-4">
                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, i) => (
                      <div key={day} className="flex items-center gap-4">
                        <span className="text-xs text-gray-400 w-8">{day}</span>
                        <div className="flex-1 bg-gray-50 h-3 rounded-full overflow-hidden">
                          <div className="bg-green-500 h-full rounded-full" style={{ width: `${60 + i*4}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-gray-500">{60 + i*4}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-6">ICU vs General Split</h3>
                  <div className="space-y-6">
                    {[{ label: 'ICU', pct: 88, color: 'bg-red-400' }, { label: 'General Ward', pct: 65, color: 'bg-green-400' }, { label: 'Emergency', pct: 72, color: 'bg-yellow-400' }, { label: 'OT', pct: 50, color: 'bg-blue-400' }].map(item => (
                      <div key={item.label} className="flex items-center gap-4">
                        <span className="text-sm font-bold text-gray-600 w-28">{item.label}</span>
                        <div className="flex-1 bg-gray-50 h-4 rounded-full overflow-hidden">
                          <div className={`${item.color} h-full rounded-full`} style={{ width: `${item.pct}%` }}></div>
                        </div>
                        <span className="text-sm font-black text-gray-700 w-10">{item.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Staff Section */}
          {activeSection === 'staff' && (
            <div className="space-y-12">
              <div className="flex justify-between items-end">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-[#1B4332] hero-heading italic">Staffing Control</h2>
                  <p className="text-gray-400 font-medium">Manage hierarchical access for hospital supervisors.</p>
                </div>
              </div>
              <div className="grid lg:grid-cols-2 gap-10">
                <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-xl space-y-10">
                  <div>
                    <h3 className="text-2xl font-black text-[#1B4332] italic">Register Supervisor</h3>
                    <p className="text-gray-400 text-sm font-medium">Step 2 of the SANJIVNI Auth Hierarchy.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    {['supervisor', 'receptionist'].map(role => (
                      <button key={role} onClick={() => openStaffModal(role)}
                        className="p-8 bg-gray-50 rounded-[40px] border border-gray-100 flex flex-col items-center gap-4 group hover:bg-[#1B4332] transition-all">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-3xl">{role === 'supervisor' ? '👥' : '📅'}</div>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-green-200">{role === 'supervisor' ? 'Management' : 'Operations'}</p>
                          <p className="text-lg font-black text-[#1B4332] group-hover:text-white">Create {role.charAt(0).toUpperCase() + role.slice(1)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm">
                  <h3 className="text-2xl font-black text-[#1B4332] italic mb-8">Management Team</h3>
                  <div className="space-y-4">
                    {managementTeam.length === 0 ? (
                      <div className="text-gray-400 text-sm font-bold p-4">No staff members found.</div>
                    ) : (
                      managementTeam.map(m => (
                        <div key={m.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">
                            {(m.full_name || m.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{m.full_name || m.email}</p>
                            <p className="text-xs text-gray-400">{m.role}</p>
                          </div>
                          <button onClick={() => handleDeleteStaff(m.id)} className="ml-2 p-2 text-red-400 hover:text-red-600 transition-colors" title="Delete Staff">
                            🗑️
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Section */}
          {activeSection === 'settings' && (
            <div className="space-y-12">
              <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-xl space-y-10">
                <h2 className="text-3xl font-black text-[#1B4332] hero-heading italic">Facility Configuration</h2>
                <form onSubmit={handleSettingsSubmit} className="space-y-12">
                  {/* section 1: identity */}
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-[#1B4332] border-l-4 border-green-500 pl-4">Identity & Classification</h3>
                    <div className="grid lg:grid-cols-3 gap-6">
                      <div className="space-y-2 lg:col-span-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hospital Identity</label>
                        <input type="text" value={hospitalSettings.hospitalName} onChange={e => setHospitalSettings(s => ({ ...s, hospitalName: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332]" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">License Number</label>
                        <input type="text" value={hospitalSettings.licenseNumber} onChange={e => setHospitalSettings(s => ({ ...s, licenseNumber: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332]" />
                      </div>
                    </div>
                    <div className="grid lg:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</label>
                        <select value={hospitalSettings.category} onChange={e => setHospitalSettings(s => ({ ...s, category: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332]">
                          <option value="government">Government</option>
                          <option value="private">Private</option>
                          <option value="trust">Trust</option>
                          <option value="trauma">Trauma Center</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hospital Type</label>
                        <select value={hospitalSettings.hospitalType} onChange={e => setHospitalSettings(s => ({ ...s, hospitalType: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332]">
                          <option value="multispecialty">Multispecialty</option>
                          <option value="specialty">Specialty</option>
                          <option value="clinic">Clinic</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* section 2: location */}
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-[#1B4332] border-l-4 border-green-500 pl-4">Location & Geo-Mapping</h3>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Full Address</label>
                      <textarea rows="2" value={hospitalSettings.address} onChange={e => setHospitalSettings(s => ({ ...s, address: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332] resize-none" />
                    </div>
                    <div className="grid lg:grid-cols-2 gap-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Area</label>
                          <input type="text" value={hospitalSettings.area} onChange={e => setHospitalSettings(s => ({ ...s, area: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">City</label>
                          <input type="text" value={hospitalSettings.city} onChange={e => setHospitalSettings(s => ({ ...s, city: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332]" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">District</label>
                          <input type="text" value={hospitalSettings.district} onChange={e => setHospitalSettings(s => ({ ...s, district: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">State</label>
                          <input type="text" value={hospitalSettings.state} onChange={e => setHospitalSettings(s => ({ ...s, state: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332]" />
                        </div>
                      </div>
                    </div>
                    <div className="grid lg:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pincode</label>
                        <input type="text" value={hospitalSettings.pincode} onChange={e => setHospitalSettings(s => ({ ...s, pincode: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332]" />
                      </div>
                      <div className="space-y-2 relative">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Latitude</label>
                        <input type="text" value={hospitalSettings.latitude} onChange={e => setHospitalSettings(s => ({ ...s, latitude: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332]" />
                        <button 
                          type="button"
                          onClick={() => {
                            if (hospitalSettings.latitude && hospitalSettings.longitude) {
                              setMapCenter({ lat: parseFloat(hospitalSettings.latitude), lng: parseFloat(hospitalSettings.longitude) });
                              setShowMapModal(true);
                            } else if (navigator.geolocation) {
                              navigator.geolocation.getCurrentPosition((pos) => {
                                setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                                setShowMapModal(true);
                              }, () => setShowMapModal(true));
                            } else {
                              setShowMapModal(true);
                            }
                          }}
                          className="absolute right-4 top-[42px] bg-[#1B4332] text-white p-3 rounded-2xl text-xs font-bold hover:scale-105 transition-all shadow-md"
                        >
                          📍 Pick
                        </button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Longitude</label>
                        <input type="text" value={hospitalSettings.longitude} onChange={e => setHospitalSettings(s => ({ ...s, longitude: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332]" />
                      </div>
                    </div>
                  </div>

                  {/* section 3: contact & status */}
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-[#1B4332] border-l-4 border-green-500 pl-4">Contact & Network Status</h3>
                    <div className="grid lg:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Platform Email</label>
                        <input type="email" value={hospitalSettings.email} onChange={e => setHospitalSettings(s => ({ ...s, email: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332]" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Website URL</label>
                        <input type="text" value={hospitalSettings.website} onChange={e => setHospitalSettings(s => ({ ...s, website: e.target.value }))} className="w-full bg-gray-50 p-6 rounded-3xl border-none outline-none font-black text-lg text-[#1B4332]" />
                      </div>
                    </div>
                    <div className="grid lg:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Network Node Status</label>
                        <div className={`w-full p-6 rounded-3xl font-black text-lg uppercase ${hospitalSettings.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {hospitalSettings.status || 'UNKNOWN'}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Verification Lifecycle</label>
                        <div className={`w-full p-6 rounded-3xl font-black text-lg uppercase ${hospitalSettings.verificationStatus === 'verified' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                          {hospitalSettings.verificationStatus || 'PENDING'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    {msg && <p className="text-green-600 font-bold text-center mb-4">{msg}</p>}
                    <button type="submit" className="w-full bg-[#1B4332] text-white py-8 rounded-full font-black text-xl shadow-2xl hover:-translate-y-2 transition-all">SYNCHRONIZE CORE DATA</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xl rounded-[60px] p-12 space-y-10">
            <div className="text-center space-y-4">
              <h3 className="text-3xl font-black text-[#1B4332] hero-heading italic">Initialize Node</h3>
              <p className="text-gray-400 text-sm font-medium">Generate hierarchical credentials for the SANJIVNI network.</p>
            </div>
            <form onSubmit={handleStaffSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Full Name</label>
                <input type="text" required className="w-full bg-gray-50 p-5 rounded-3xl border-none outline-none font-semibold text-base text-[#1B4332]" placeholder="Ex: Sarah Connor" value={staffForm.name} onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Access Email</label>
                <input type="email" required className="w-full bg-gray-50 p-5 rounded-3xl border-none outline-none font-semibold text-base text-[#1B4332]" placeholder="reception@hospital.com" value={staffForm.email} onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Phone Number</label>
                <input type="tel" required className="w-full bg-gray-50 p-5 rounded-3xl border-none outline-none font-semibold text-base text-[#1B4332]" placeholder="9876543210" value={staffForm.phone} onChange={e => setStaffForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Handover Key (Password)</label>
                <input type="password" required className="w-full bg-gray-50 p-5 rounded-3xl border-none outline-none font-semibold text-base text-[#1B4332]" placeholder="••••••••" value={staffForm.password} onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              {!hospitalId && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-2xl px-4 py-3 font-semibold">
                  ⚠️ Hospital ID not found in your profile. Make sure you're signed in as admin.
                </p>
              )}
              {staffError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-2xl px-4 py-3 font-semibold">{staffError}</p>
              )}
              <button type="submit" disabled={staffLoading || !hospitalId} className="w-full bg-[#1B4332] text-white py-5 rounded-full font-black text-base shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {staffLoading ? 'Initializing...' : 'CONFIRM INITIALIZATION'}
              </button>
              <button type="button" onClick={() => setShowStaffModal(false)} className="w-full py-4 text-gray-400 font-bold text-xs uppercase tracking-widest">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[40px] p-10 space-y-8">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl">✅</div>
              <h3 className="text-2xl font-black text-gray-900">Supervisor Initialized</h3>
              <p className="text-gray-400 text-sm font-medium">Please share these credentials with the supervisor. This step confirms the auth hierarchy.</p>
            </div>
            <div className="space-y-4">
              <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Email</p>
                <p className="font-bold text-gray-900 break-all">{credentials.email}</p>
              </div>
              <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Temporary Password</p>
                <p className="font-bold text-gray-900">{credentials.password}</p>
              </div>
            </div>
            <button onClick={() => setShowCredModal(false)} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all">Handover Complete</button>
          </div>
        </div>
      )}
      {/* Map Picker Modal */}
      {showMapModal && isLoaded && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-3xl rounded-[60px] p-10 space-y-8 overflow-hidden">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-3xl font-black text-[#1B4332] hero-heading italic">Select Location</h3>
                <p className="text-gray-400 text-sm font-medium">Click on the map to pin the hospital's precise location.</p>
              </div>
              <button onClick={() => setShowMapModal(false)} className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 transition-all">✕</button>
            </div>
            
            <div className="rounded-[40px] overflow-hidden border-8 border-gray-50 shadow-inner h-[450px]">
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={15}
                onClick={(e) => {
                  const lat = e.latLng.lat().toFixed(6);
                  const lng = e.latLng.lng().toFixed(6);
                  setHospitalSettings(s => ({ ...s, latitude: lat, longitude: lng }));
                  setMapCenter({ lat: parseFloat(lat), lng: parseFloat(lng) });
                }}
              >
                {hospitalSettings.latitude && hospitalSettings.longitude && (
                  <Marker position={{ lat: parseFloat(hospitalSettings.latitude), lng: parseFloat(hospitalSettings.longitude) }} />
                )}
              </GoogleMap>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 p-6 bg-green-50 rounded-3xl border border-green-100">
                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Pinned Coordinates</p>
                <p className="font-black text-[#1B4332] text-lg">
                  {hospitalSettings.latitude || '0.000'} , {hospitalSettings.longitude || '0.000'}
                </p>
              </div>
              <button 
                onClick={() => setShowMapModal(false)}
                className="bg-[#1B4332] text-white px-12 rounded-3xl font-black text-lg shadow-xl hover:-translate-y-1 transition-all"
              >
                DONE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPortalPage;
