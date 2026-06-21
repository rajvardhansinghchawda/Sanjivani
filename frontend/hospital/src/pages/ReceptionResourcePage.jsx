import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../services/auth';
import { apiFetch } from '../services/api';
import '../css/styles.css';

const ReceptionResourcePage = () => {
    const navigate = useNavigate();
    const user = Auth.user;
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    
    const [formData, setFormData] = useState({
        resource_type: 'bed',
        total_count: '',
        available_count: ''
    });

    useEffect(() => {
        if (!user) navigate('/signin');
        loadHistory();
    }, []);

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
    };

    const loadHistory = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`/api/supervisor/resources/?hospital=${user.hospital}`);
            if (res.ok) {
                const data = await res.json();
                setHistory(Array.isArray(data) ? data : data.results || []);
            }
        } catch (err) {
            showToast('Error loading resource history', 'error');
        }
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await apiFetch('/api/supervisor/resources/', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    total_count: parseInt(formData.total_count),
                    available_count: parseInt(formData.available_count),
                    hospital: user.hospital,
                    availability_status: 'available' // default
                })
            });
            if (res.ok) {
                showToast('Resource snapshot logged successfully');
                setFormData({ ...formData, total_count: '', available_count: '' });
                loadHistory();
            } else {
                showToast('Failed to log snapshot', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        }
    };

    const getTimeStatus = (timestamp) => {
        const hours = (new Date() - new Date(timestamp)) / (1000 * 60 * 60);
        if (hours < 12) return { label: 'Up to Date', color: '#0E6655', bg: '#D5F5E3' };
        if (hours < 24) return { label: 'Due Soon', color: '#BA4A00', bg: '#FAD7A0' };
        return { label: 'Alert Triggered', color: '#922B21', bg: '#FADBD8' };
    };

    return (
        <div className="min-h-screen bg-[#EBF5FB] font-sans text-[#2C3E50] pb-20">
            {/* Header */}
            <header className="bg-[#0D1B2A] text-white px-10 py-10 flex justify-between items-center shadow-xl">
                 <div className="flex items-center gap-6">
                    <button onClick={() => navigate('/reception-portal')} className="w-12 h-12 rounded-2xl bg-[#1B4F72] flex items-center justify-center hover:bg-[#2471A3] transition-all font-black text-white">←</button>
                    <div>
                        <h1 className="text-3xl font-black text-[#AED6F1] tracking-tight">Resource Coordination</h1>
                        <p className="font-bold text-[#AED6F1]/60 italic">Shift handover & resource snapshot logging</p>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-10 mt-12 grid grid-cols-1 md:grid-cols-3 gap-10">
                {/* Log Form */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white rounded-[40px] p-10 shadow-xl border border-[#D5D8DC]">
                        <h2 className="text-2xl font-black text-[#0D1B2A] mb-2 uppercase tracking-tight">Log Snapshot</h2>
                        <p className="text-xs font-bold text-[#566573] mb-8">Maintain record honesty for the Supervisor.</p>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-[#566573] uppercase tracking-widest ml-4">Resource Category</label>
                                <select 
                                    value={formData.resource_type} 
                                    onChange={e => setFormData({...formData, resource_type: e.target.value})}
                                    className="w-full bg-[#EBF5FB] border-none outline-none p-5 rounded-3xl font-bold text-[#1B4F72]"
                                >
                                    <option value="bed">Hospital Beds</option>
                                    <option value="ventilator">Ventilators</option>
                                    <option value="oxygen">Oxygen Concentration</option>
                                    <option value="equipment">Medical Equipment</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-[#566573] uppercase tracking-widest ml-4">Total Capacity</label>
                                <input 
                                    required type="number" 
                                    value={formData.total_count}
                                    onChange={e => setFormData({...formData, total_count: e.target.value})}
                                    className="w-full bg-[#EBF5FB] border-none outline-none p-5 rounded-3xl font-bold text-[#1B4F72]" 
                                    placeholder="Ex: 100"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-[#566573] uppercase tracking-widest ml-4">Available Now</label>
                                <input 
                                    required type="number" 
                                    value={formData.available_count}
                                    onChange={e => setFormData({...formData, available_count: e.target.value})}
                                    className="w-full bg-[#EBF5FB] border-none outline-none p-5 rounded-3xl font-bold text-[#1B4F72]" 
                                    placeholder="Ex: 34"
                                />
                            </div>

                            <button type="submit" className="w-full bg-[#1B4F72] text-white py-6 rounded-[32px] font-black hover:bg-[#2471A3] transition-all shadow-xl shadow-[#1B4F72]/20 mt-4">
                                Log Resource Audit
                            </button>
                        </form>
                    </div>

                    <div className="bg-[#1B4F72] rounded-[40px] p-10 text-white">
                        <h3 className="text-xl font-black mb-4">Why is this logged?</h3>
                        <p className="text-sm font-bold text-[#AED6F1] leading-relaxed opacity-80">
                            The Supervisor Portal automatically monitors the time since your last log. If you fail to update for 12 hours, a <span className="text-white font-black underline underline-offset-4">MISSING_DATA</span> alert is raised.
                        </p>
                    </div>
                </div>

                {/* History List */}
                <div className="md:col-span-2 space-y-6">
                    {history.length > 0 && (
                        <div className="flex bg-white p-6 rounded-[32px] justify-between items-center shadow-sm border border-[#D5D8DC]">
                            <div>
                                <p className="text-[10px] font-black text-[#566573] uppercase mb-1">Last Logged Status</p>
                                <p className="text-xl font-black text-[#0D1B2A]">
                                    {new Date(history[0].logged_at).toLocaleString()}
                                </p>
                            </div>
                            <div 
                                className="px-6 py-3 rounded-2xl font-black uppercase text-sm"
                                style={{ backgroundColor: getTimeStatus(history[0].logged_at).bg, color: getTimeStatus(history[0].logged_at).color }}
                            >
                                {getTimeStatus(history[0].logged_at).label}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        {history.map((log, idx) => (
                            <div key={idx} className="bg-white rounded-[40px] p-8 shadow-sm border border-[#D5D8DC] flex justify-between items-center group hover:bg-white transition-all">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-[#F4F6F7] rounded-3xl flex items-center justify-center text-2xl">
                                        {log.resource_type === 'beds' ? '🛏️' : log.resource_type === 'ventilators' ? '🫁' : '📦'}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-[#0D1B2A] capitalize">{log.resource_type.replace('_', ' ')}</h3>
                                        <p className="font-bold text-[#566573] text-sm">Reported by Hospital Admin</p>
                                    </div>
                                </div>

                                <div className="flex gap-8 text-center items-center">
                                    <div>
                                        <p className="text-[10px] font-black text-[#566573] uppercase mb-1">Available</p>
                                        <p className="text-2xl font-black text-[#0E6655]">{log.available_count} / {log.total_count}</p>
                                    </div>
                                    <div className="h-10 w-px bg-[#D5D8DC]"></div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-[#566573] uppercase mb-1">Utilized</p>
                                        <p className="text-xl font-black text-[#1B4F72]">
                                            {Math.round(( (log.total_count - log.available_count) / log.total_count) * 100)}%
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {history.length === 0 && (
                            <div className="bg-white p-20 rounded-[40px] text-center border-2 border-dashed border-[#D5D8DC]">
                                <p className="text-[#566573] font-bold">No resource snapshots logged yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Toast */}
            {toast.show && (
                <div className={`fixed bottom-10 right-10 px-10 py-5 rounded-3xl shadow-2xl z-50 font-black text-white animate-in slide-in-from-right-10 duration-300 ${toast.type === 'error' ? 'bg-[#922B21]' : 'bg-[#1B4F72]'}`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default ReceptionResourcePage;
