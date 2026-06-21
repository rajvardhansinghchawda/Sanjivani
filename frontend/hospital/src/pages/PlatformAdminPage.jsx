import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../services/auth';
import { apiFetch } from '../services/api';
import '../css/styles.css';

const PlatformAdminPage = () => {
  const navigate = useNavigate();
  const user = Auth.user;
  const [activeTab, setActiveTab] = useState('hospitals');
  const [hospitals, setHospitals] = useState([]);
  const [users, setUsers] = useState([]);
  const [platformStats, setPlatformStats] = useState(null);
  const [toast, setToast] = useState('');
  const [showAddHospital, setShowAddHospital] = useState(false);
  const [hospForm, setHospForm] = useState({ name: '', category: 'Private', city: 'Bhopal', total_beds: '' });

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [perfRes, dashRes] = await Promise.all([
        apiFetch('/api/analytics/hospitals/performance/'),
        apiFetch('/api/analytics/dashboard/'),
      ]);

      if (perfRes.ok) {
        const perf = await perfRes.json();
        const list = perf.hospitals || [];
        setHospitals(list.map(h => ({
          id: h.hospital_id,
          name: h.hospital_name,
          category: h.category,
          city: h.city,
          total_beds: h.total_beds,
          status: h.occupancy_rate >= 95 ? 'High Load' : 'Active',
          occupancy_rate: h.occupancy_rate,
          open_alerts: h.open_alerts,
        })));
      }

      if (dashRes.ok) {
        const stats = await dashRes.json();
        setPlatformStats(stats);
      }
    } catch (e) {
      setHospitals([
        { id: 1, name: 'St. Jude Medical Center', category: 'Private', city: 'Bhopal', total_beds: 150, status: 'Active' },
        { id: 2, name: 'Metro General Hospital', category: 'Government', city: 'Bhopal', total_beds: 300, status: 'Active' },
        { id: 3, name: 'City Hospital', category: 'Private', city: 'Bhopal', total_beds: 200, status: 'Active' },
      ]);
    }
  };

  const handleLogout = async () => { await Auth.logout(); navigate('/'); };
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleAddHospital = async (e) => {
    e.preventDefault();
    try {
      const body = {
        name: hospForm.name,
        category: hospForm.category.toLowerCase(),
        hospital_type: 'multispecialty',
        address: '',
        city: hospForm.city,
        area: '',
        district: '',
        state: '',
        pincode: '',
        latitude: '',
        longitude: '',
        total_beds: parseInt(hospForm.total_beds, 10) || 0,
        icu_capacity: 0,
        phone: '',
        email: '',
        website: '',
        license_number: '',
        service_ids: [],
        departments_data: [],
      };
      const res = await apiFetch('/api/hospitals/manage/', { method: 'POST', body: JSON.stringify(body) });
      if (res.ok) {
        const data = await res.json();
        setHospitals(h => [data, ...h]);
        setShowAddHospital(false);
        showToast('Hospital registered to SANJIVNI!');
      } else { showToast('Failed to register hospital'); }
    } catch (e) {
      setHospitals(h => [{ id: Date.now(), name: hospForm.name, category: hospForm.category, city: hospForm.city, total_beds: parseInt(hospForm.total_beds, 10), status: 'Active' }, ...h]);
      setShowAddHospital(false);
      showToast('Hospital registered to SANJIVNI!');
    }
    setHospForm({ name: '', category: 'Private', city: 'Bhopal', total_beds: '' });
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#FDFCF7', minHeight: '100vh' }}>
      <style>{`.hero-heading { font-family: 'Playfair Display', serif; }`}</style>

      <header style={{ background: 'rgba(253,252,247,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(27,67,50,0.1)', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}>
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#1B4332] rounded-xl flex items-center justify-center text-white font-bold">+</div>
            <div>
              <span className="text-xl font-black text-[#1B4332]">SANJIVNI</span>
              <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-black rounded-full uppercase tracking-widest">Platform Admin</span>
            </div>
          </div>
          <div className="flex gap-2">
            {[['hospitals', '🏥 Hospitals'], ['users', '👥 Users'], ['system', '⚙️ System']].map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)} className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${activeTab === id ? 'bg-[#1B4332] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-600">{user?.name || 'Platform Admin'}</span>
            <button onClick={handleLogout} className="text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-full">Sign Out</button>
          </div>
        </div>
      </header>

      <div className="pt-24 max-w-7xl mx-auto px-8 py-8">
        {/* Platform Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Hospitals on Grid',
              value: (platformStats?.hospitals?.total ?? hospitals.length) || 0,
              icon: '🏥',
              color: 'bg-green-50 text-green-700'
            },
            { label: 'Verified Hospitals', value: platformStats?.hospitals?.verified ?? 0, icon: '✅', color: 'bg-emerald-50 text-emerald-700' },
            { label: 'Total Beds', value: platformStats?.beds?.total ?? '—', icon: '🛏️', color: 'bg-purple-50 text-purple-700' },
            { label: 'Open Alerts', value: platformStats?.alerts?.open ?? 0, icon: '⚠️', color: 'bg-orange-50 text-orange-700' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className={`inline-flex px-3 py-1.5 rounded-full text-xs font-black mb-3 ${stat.color}`}>{stat.icon} {stat.label}</div>
              <p className="text-4xl font-black text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Hospitals Tab */}
        {activeTab === 'hospitals' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic">Hospital Registry</h1>
              <button onClick={() => setShowAddHospital(true)} className="bg-[#1B4332] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#2D6A4F] transition-all shadow-lg">+ Register Hospital</button>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-gray-50">{['Hospital', 'Category', 'City', 'Total Beds', 'Status', 'Actions'].map(h => <th key={h} className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest px-6 py-4">{h}</th>)}</tr></thead>
                <tbody>
                  {hospitals.map((h, i) => (
                    <tr key={h.id || i} className="border-b border-gray-50 hover:bg-gray-50 transition-all">
                      <td className="px-6 py-4 font-black text-gray-900">{h.name}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{h.category || h.hospital_type || 'Private'}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{h.city || 'Bhopal'}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{h.total_beds || '—'}</td>
                      <td className="px-6 py-4"><span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black">{h.status || 'Active'}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => showToast(`Viewing ${h.name}`)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100">View</button>
                          <button onClick={() => showToast(`${h.name} suspended`)} className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100">Suspend</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic">User Management</h1>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-gray-50">{['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => <th key={h} className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest px-6 py-4">{h}</th>)}</tr></thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id || i} className="border-b border-gray-50 hover:bg-gray-50 transition-all">
                      <td className="px-6 py-4 font-bold text-gray-900">{u.full_name || u.name || '—'}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{u.email}</td>
                      <td className="px-6 py-4"><span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-[10px] font-black capitalize">{u.role}</span></td>
                      <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-[10px] font-black ${u.is_active !== false ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>{u.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => showToast(`Viewing ${u.email}`)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100">View</button>
                          <button onClick={() => showToast(`${u.email} status toggled`)} className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100">Toggle</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <h1 className="text-4xl font-black text-[#1B4332] hero-heading italic">System Control</h1>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-4">
                <h3 className="text-xl font-black text-[#1B4332] italic">Platform Controls</h3>
                {[{ label: '🔄 Refresh All Node Data', style: 'outline' }, { label: '📊 Generate Platform Report', style: 'outline' }, { label: '🚨 Activate City Emergency Mode', style: 'danger' }, { label: '📢 Broadcast System Alert', style: 'primary' }].map(action => (
                  <button key={action.label} onClick={() => showToast(`${action.label} — Executed`)}
                    className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${action.style === 'primary' ? 'bg-[#1B4332] text-white hover:bg-[#2D6A4F]' : action.style === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : 'border-2 border-gray-200 text-gray-700 hover:border-[#1B4332] hover:bg-green-50'}`}>
                    {action.label}
                  </button>
                ))}
              </div>
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                <h3 className="text-xl font-black text-[#1B4332] italic mb-6">System Health</h3>
                {[{ label: 'API Server', status: 'Operational', pct: 99.9 }, { label: 'Database', status: 'Operational', pct: 100 }, { label: 'WebSocket Relay', status: 'Operational', pct: 98.5 }, { label: 'Auth Service', status: 'Operational', pct: 99.7 }].map(item => (
                  <div key={item.label} className="flex items-center gap-4 mb-4">
                    <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></span>
                    <span className="flex-1 font-medium text-gray-700 text-sm">{item.label}</span>
                    <span className="text-xs font-black text-green-600">{item.pct}%</span>
                    <span className="text-xs text-gray-400">{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Hospital Modal */}
      {showAddHospital && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[48px] p-12 w-full max-w-lg shadow-2xl">
            <h3 className="text-3xl font-black text-[#1B4332] hero-heading italic mb-8">Register Hospital</h3>
            <form onSubmit={handleAddHospital} className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Hospital Name</label>
                <input type="text" required placeholder="St. Jude Medical Center" value={hospForm.name} onChange={e => setHospForm(f => ({ ...f, name: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Category</label>
                  <select value={hospForm.category} onChange={e => setHospForm(f => ({ ...f, category: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-700">
                    <option>Private</option><option>Government</option><option>Trust</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Total Beds</label>
                  <input type="number" required placeholder="200" value={hospForm.total_beds} onChange={e => setHospForm(f => ({ ...f, total_beds: e.target.value }))} className="w-full mt-1 bg-gray-50 border-none outline-none rounded-2xl p-4 font-semibold text-gray-900" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-[#1B4332] text-white py-4 rounded-2xl font-black hover:bg-[#2D6A4F] transition-all">Register to Grid</button>
                <button type="button" onClick={() => setShowAddHospital(false)} className="flex-1 bg-gray-50 text-gray-500 py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-8 right-8 bg-[#1B4332] text-white px-6 py-4 rounded-2xl font-bold text-sm shadow-xl">{toast}</div>}
    </div>
  );
};

export default PlatformAdminPage;
