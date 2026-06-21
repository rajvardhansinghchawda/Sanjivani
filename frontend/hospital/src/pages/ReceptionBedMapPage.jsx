import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../services/auth';
import { apiFetch } from '../services/api';
import '../css/styles.css';

const ReceptionBedMapPage = () => {
    const navigate = useNavigate();
    const user = Auth.user;
    const [activeWard, setActiveWard] = useState('general_ward');
    const [beds, setBeds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    
    // Modals
    const [selectedBed, setSelectedBed] = useState(null);
    const [showAdmitModal, setShowAdmitModal] = useState(false);
    const [showDischargeModal, setShowDischargeModal] = useState(false);
    const [patientData, setPatientData] = useState({ name: '', phone: '', age: '', condition: '' });
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registerLoading, setRegisterLoading] = useState(false);
    const [registerError, setRegisterError] = useState('');
    const [registerForm, setRegisterForm] = useState({
        ward_type: 'general_ward',
        bed_type: 'general',
        department: '',
        notes: '',
        bed_number: '',
    });

    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkBeds, setBulkBeds] = useState([]);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkError, setBulkError] = useState('');

    const WARD_TYPES = [
        { id: 'general_ward', label: 'General Ward', bed_type: 'general' },
        { id: 'icu_ward', label: 'ICU Ward', bed_type: 'icu' },
        { id: 'emergency', label: 'Emergency', bed_type: 'emergency' },
        { id: 'private_room', label: 'Private', bed_type: 'private' },
        { id: 'semi_private', label: 'Semi-Private', bed_type: 'semi_pvt' },
        { id: 'ventilator', label: 'Ventilator', bed_type: 'ventilator' },
    ];

    const THEME = {
        navy: '#0D1B2A',
        blue: '#1B4F72',
        lightBlue: '#2471A3',
        sky: '#AED6F1',
        teal: '#0E6655',
        bg: '#EBF5FB',
        border: '#D5D8DC',
        orange: '#BA4A00',
        red: '#922B21',
        text2: '#566573',
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'available': return '#1ABC9C'; // green
            case 'occupied': return '#E74C3C'; // red
            case 'reserved': return '#F39C12'; // yellow
            case 'maintenance': return '#95A5A6'; // grey
            default: return '#D5D8DC';
        }
    };

    useEffect(() => {
        if (!user) navigate('/signin');
        loadBeds();
    }, [activeWard]);

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
    };

    const loadBeds = async () => {
        setLoading(true);
        try {
            if (!user?.hospital) return;
            const ward = WARD_TYPES.find(w => w.id === activeWard);
            const qs = new URLSearchParams();
            if (activeWard === 'ventilator' || activeWard === 'semi_private') {
                qs.set('bed_type', ward?.bed_type || '');
            } else {
                qs.set('ward_type', activeWard);
            }
            const res = await apiFetch(`/api/beds/hospital/${user.hospital}/?${qs.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setBeds(Array.isArray(data) ? data : data.results || []);
            }
        } catch (err) {
            showToast('Error loading beds', 'error');
        }
        setLoading(false);
    };

    const wardPrefix = (ward_type) => {
        const map = {
            general_ward: 'GEN',
            icu_ward: 'ICU',
            emergency: 'EMR',
            private_room: 'PRI',
            semi_private: 'SEMI',
            ventilator: 'VENT',
        };
        return map[ward_type] || 'BED';
    };

    const suggestNextBedNumber = async ({ ward_type, bed_type }) => {
        if (!user?.hospital) return '';
        try {
            const qs = new URLSearchParams();
            if (ward_type === 'ventilator' || ward_type === 'semi_private') {
                qs.set('bed_type', bed_type);
            } else {
                qs.set('ward_type', ward_type);
            }
            qs.set('ordering', 'bed_number');
            const res = await apiFetch(`/api/beds/hospital/${user.hospital}/?${qs.toString()}`);
            const prefix = wardPrefix(ward_type);
            if (!res.ok) return `${prefix}-01`;
            const data = await res.json();
            const list = Array.isArray(data) ? data : data.results || [];
            let maxN = 0;
            for (const b of list) {
                const bn = String(b.bed_number || '');
                if (!bn.toUpperCase().startsWith(prefix)) continue;
                const m = bn.match(/(\d+)\s*$/);
                const n = m ? parseInt(m[1], 10) : 0;
                if (!Number.isNaN(n)) maxN = Math.max(maxN, n);
            }
            const next = maxN + 1;
            return `${prefix}-${String(next).padStart(2, '0')}`;
        } catch {
            return `${wardPrefix(ward_type)}-01`;
        }
    };

    const openRegister = async () => {
        const ward = WARD_TYPES.find(w => w.id === activeWard) || WARD_TYPES[0];
        const ward_type = ward.id;
        const bed_type = ward.bed_type;
        const bed_number = await suggestNextBedNumber({ ward_type, bed_type });
        setRegisterError('');
        setRegisterForm({ ward_type, bed_type, department: '', notes: '', bed_number });
        setShowRegisterModal(true);
    };

    const openBulkUpdate = () => {
        setBulkError('');
        setBulkBeds(beds.map(b => ({ id: b.id, bed_number: b.bed_number, status: b.status })));
        setShowBulkModal(true);
    };

    const submitRegisterBed = async (e) => {
        e.preventDefault();
        setRegisterError('');
        if (!user?.hospital) return;
        if (!registerForm.department.trim()) {
            setRegisterError('department is required (UUID).');
            return;
        }
        setRegisterLoading(true);
        try {
            const ward_type_payload =
                registerForm.ward_type === 'ventilator' ? 'icu_ward' :
                registerForm.ward_type === 'semi_private' ? 'general_ward' :
                registerForm.ward_type;

            const res = await apiFetch(`/api/beds/hospital/${user.hospital}/`, {
                method: 'POST',
                body: JSON.stringify({
                    bed_number: registerForm.bed_number,
                    bed_type: registerForm.bed_type,
                    ward_type: ward_type_payload,
                    department: registerForm.department,
                    notes: registerForm.notes || undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || 'Failed to register bed');
            showToast(`Bed ${registerForm.bed_number} registered`);
            setShowRegisterModal(false);
            await loadBeds();
        } catch (err) {
            setRegisterError(err.message || 'Failed to register bed');
        }
        setRegisterLoading(false);
    };

    const submitBulkUpdate = async () => {
        if (!user?.hospital) return;
        setBulkLoading(true);
        setBulkError('');
        try {
            const res = await apiFetch(`/api/beds/hospital/${user.hospital}/bulk-update/`, {
                method: 'PATCH',
                body: JSON.stringify({ beds: bulkBeds.map(b => ({ id: b.id, status: b.status })) }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || 'Bulk update failed');
            showToast('Bulk bed update saved');
            setShowBulkModal(false);
            await loadBeds();
        } catch (err) {
            setBulkError(err.message || 'Bulk update failed');
        }
        setBulkLoading(false);
    };

    const handleAdmit = async (e) => {
        e.preventDefault();
        try {
            // Register/Find patient logic usually goes here - simplified for map view
            // Assuming we have a patient ID or registering they new
            const res = await apiFetch('/api/beds/admit/', {
                method: 'POST',
                body: JSON.stringify({
                    bed_id: selectedBed.id,
                    patient_id: patientData.patient_id, // needs to be selected or registered
                    notes: patientData.condition
                })
            });
            if (res.ok) {
                showToast('Patient admitted to bed ' + selectedBed.bed_number);
                setShowAdmitModal(false);
                loadBeds();
            }
        } catch (err) {
            showToast('Admission failed', 'error');
        }
    };

    const handleDischarge = async (allocationId) => {
        try {
            const res = await apiFetch('/api/beds/discharge/', {
                method: 'POST',
                body: JSON.stringify({ allocation_id: allocationId })
            });
            if (res.ok) {
                showToast('Patient discharged successfully');
                setShowDischargeModal(false);
                loadBeds();
            }
        } catch (err) {
            showToast('Discharge failed', 'error');
        }
    };

    const bedCounts = useMemo(() => {
        const total = beds.length;
        const available = beds.filter(b => b.status === 'available').length;
        const occupied = beds.filter(b => b.status === 'occupied').length;
        const reserved = beds.filter(b => b.status === 'reserved').length;
        const maintenance = beds.filter(b => b.status === 'maintenance').length;
        return { total, available, occupied, reserved, maintenance };
    }, [beds]);

    return (
        <div className="min-h-screen pb-20" style={{ background: THEME.bg }}>
            {/* Header */}
            <header className="sticky top-0 z-40 px-10 py-8 flex justify-between items-center shadow-xl" style={{ background: THEME.navy, borderBottom: `1px solid ${THEME.border}` }}>
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate('/reception-portal')} className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all font-black text-white" style={{ background: THEME.blue }}>←</button>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight" style={{ color: THEME.sky }}>Bed Map</h1>
                        <p className="text-sm font-bold opacity-70" style={{ color: THEME.sky }}>
                            Visual status tracking · {WARD_TYPES.find(w => w.id === activeWard)?.label || activeWard}
                        </p>
                    </div>
                </div>
                
                <div className="flex gap-3">
                    <button onClick={openBulkUpdate} className="px-6 py-4 rounded-[24px] font-black transition-all text-white hover:opacity-95" style={{ background: THEME.lightBlue }}>
                        Bulk Update
                    </button>
                    <button onClick={openRegister} className="px-6 py-4 rounded-[24px] font-black transition-all text-white hover:opacity-95" style={{ background: THEME.blue }}>
                        Register New Bed
                    </button>
                    <button onClick={() => navigate('/reception/resources')} className="px-6 py-4 rounded-[24px] font-black transition-all text-white hover:opacity-95" style={{ background: THEME.blue }}>
                        Log Shift Resource Snapshot
                    </button>
                </div>
            </header>

            {/* Ward Tabs */}
            <div className="max-w-[1600px] mx-auto px-10 mt-10">
                <div className="flex bg-white p-2 rounded-[32px] shadow-sm border mb-6 overflow-hidden" style={{ borderColor: THEME.border }}>
                    {WARD_TYPES.map(ward => (
                        <button
                            key={ward.id}
                            onClick={() => setActiveWard(ward.id)}
                            className={`flex-1 py-5 rounded-[24px] font-black transition-all ${
                                activeWard === ward.id ? 'text-white' : 'hover:bg-[#EBF5FB]'
                            }`}
                            style={activeWard === ward.id ? { background: THEME.navy } : { color: THEME.text2 }}
                        >
                            {ward.label}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-[32px] p-6 border shadow-sm mb-10 flex flex-wrap items-center justify-between gap-4" style={{ borderColor: THEME.border }}>
                    <div className="flex items-center gap-3">
                        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: THEME.text2 }}>Beds</div>
                        <div className="text-3xl font-black" style={{ color: THEME.navy }}>{bedCounts.available}/{bedCounts.total}</div>
                        <div className="text-xs font-bold" style={{ color: THEME.text2 }}>available</div>
                    </div>
                    <div className="flex gap-3 text-xs font-black">
                        <span className="px-3 py-2 rounded-2xl" style={{ background: '#D5F5E3', color: THEME.teal }}>Occupied: {bedCounts.occupied}</span>
                        <span className="px-3 py-2 rounded-2xl" style={{ background: '#FAD7A0', color: THEME.orange }}>Reserved: {bedCounts.reserved}</span>
                        <span className="px-3 py-2 rounded-2xl" style={{ background: '#EAECEE', color: '#2C3E50' }}>Maintenance: {bedCounts.maintenance}</span>
                    </div>
                </div>

                {/* Bed Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6">
                    {beds.map(bed => {
                        const isLongStay = bed.current_admission?.days_occupied > 20;
                        return (
                            <div 
                                key={bed.id}
                                onClick={() => {
                                    setSelectedBed(bed);
                                    if (bed.status === 'available') setShowAdmitModal(true);
                                    else setShowDischargeModal(true);
                                }}
                                className={`relative aspect-square rounded-[40px] p-6 cursor-pointer transition-all hover:scale-105 group border-4 ${
                                    isLongStay ? 'border-[#BA4A00] animate-pulse' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: getStatusColor(bed.status) }}
                            >
                                {isLongStay && (
                                    <div
                                        className="absolute -top-3 -right-3 bg-[#BA4A00] text-white p-2 rounded-full text-[10px] font-black shadow-xl"
                                        title={`This bed has been occupied for ${bed.current_admission.days_occupied} days. Supervisor has been notified.`}
                                    >
                                        ⚠️ {bed.current_admission.days_occupied}d
                                    </div>
                                )}
                                
                                <div className="h-full flex flex-col justify-between">
                                    <span className="text-2xl font-black text-white/40 group-hover:text-white/60 transition-all">{bed.bed_number}</span>
                                    <div>
                                        <p className="text-white font-black text-lg leading-tight uppercase">{bed.status}</p>
                                        <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">{bed.bed_type}</p>
                                    </div>
                                </div>
                                
                                {bed.status === 'occupied' && (
                                    <div className="absolute inset-x-6 bottom-16 bg-white/20 backdrop-blur-md rounded-2xl p-2">
                                        <p className="text-[10px] font-black text-white uppercase truncate">{bed.current_admission?.patient_name || 'Patient'}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modals */}
            {showDischargeModal && selectedBed && (
                <div className="fixed inset-0 bg-[#1B4332]/80 backdrop-blur-xl z-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-[56px] p-12 max-w-xl w-full shadow-2xl">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-3xl font-black text-[#1B4332] hero-heading italic">Bed {selectedBed.bed_number}</h3>
                                <p className="text-[#2D6A4F] font-bold">Patient Details & Discharge</p>
                            </div>
                            <button onClick={() => setShowDischargeModal(false)} className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-black">×</button>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-gray-50 rounded-[32px] p-8">
                                <p className="text-[10px] font-black text-[#2D6A4F]/40 uppercase tracking-widest mb-1">Patient Name</p>
                                <p className="text-2xl font-black text-[#1B4332] mb-4">{selectedBed.current_admission?.patient_name || 'Not Available'}</p>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white p-4 rounded-2xl border border-gray-100">
                                        <p className="text-[10px] font-black text-[#2D6A4F]/40 uppercase mb-1">Stay Duration</p>
                                        <p className="text-xl font-black text-[#1B4332]">{selectedBed.current_admission?.days_occupied || 0} Days</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border border-gray-100">
                                        <p className="text-[10px] font-black text-[#2D6A4F]/40 uppercase mb-1">Admitted On</p>
                                        <p className="text-lg font-black text-[#1B4332]">{new Date(selectedBed.current_admission?.admitted_at).toLocaleDateString() || '—'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button onClick={() => setShowDischargeModal(false)} className="flex-1 py-5 rounded-[24px] font-black text-[#2D6A4F] bg-gray-100 hover:bg-gray-200 transition-all">Back</button>
                                <button 
                                    onClick={() => handleDischarge(selectedBed.current_admission?.allocation_id)}
                                    className="flex-1 py-5 rounded-[24px] font-black text-white bg-[#D00000] hover:bg-[#9D0208] transition-all shadow-xl shadow-[#D00000]/20"
                                >
                                    Discharge Patient
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Admit Modal Simplified */}
            {showAdmitModal && selectedBed && (
                <div className="fixed inset-0 bg-[#1B4332]/80 backdrop-blur-xl z-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-[56px] p-12 max-w-xl w-full shadow-2xl">
                        <h3 className="text-3xl font-black text-[#1B4332] hero-heading italic mb-2">Admit to {selectedBed.bed_number}</h3>
                        <p className="text-[#2D6A4F] font-bold mb-8 italic">Assign a patient to this available bed</p>
                        
                        <div className="space-y-6">
                            <p className="text-sm font-bold text-gray-500 text-center py-10 bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200">
                                [ Admission Form Integration ]<br/>
                                Use the main Admit Patient flow to register patient details.
                            </p>
                            <button onClick={() => setShowAdmitModal(false)} className="w-full py-5 rounded-[24px] font-black text-[#2D6A4F] bg-gray-100 hover:bg-gray-200 transition-all">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Register Bed Modal */}
            {showRegisterModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="bg-white rounded-[48px] p-12 w-full max-w-2xl shadow-2xl border" style={{ borderColor: THEME.border }}>
                        <div className="flex justify-between items-start gap-4 mb-8">
                            <div>
                                <h3 className="text-3xl font-black hero-heading italic" style={{ color: THEME.navy }}>Register New Bed</h3>
                                <p className="text-sm font-bold" style={{ color: THEME.text2 }}>
                                    Bed number is auto-assigned by ward type.
                                </p>
                            </div>
                            <button onClick={() => setShowRegisterModal(false)} className="w-12 h-12 rounded-2xl bg-[#EBF5FB] font-black text-xl" style={{ color: THEME.navy }}>×</button>
                        </div>

                        <form onSubmit={submitRegisterBed} className="space-y-5">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>Ward type</label>
                                    <select
                                        value={registerForm.ward_type}
                                        onChange={async (e) => {
                                            const ward_type = e.target.value;
                                            const ward = WARD_TYPES.find(w => w.id === ward_type);
                                            const bed_type = ward?.bed_type || registerForm.bed_type;
                                            const bed_number = await suggestNextBedNumber({ ward_type, bed_type });
                                            setRegisterForm(f => ({ ...f, ward_type, bed_type, bed_number }));
                                        }}
                                        className="w-full mt-1 bg-[#EBF5FB] rounded-2xl p-4 font-bold outline-none border"
                                        style={{ borderColor: THEME.border }}
                                    >
                                        {WARD_TYPES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>Bed type</label>
                                    <select
                                        value={registerForm.bed_type}
                                        onChange={async (e) => {
                                            const bed_type = e.target.value;
                                            const bed_number = await suggestNextBedNumber({ ward_type: registerForm.ward_type, bed_type });
                                            setRegisterForm(f => ({ ...f, bed_type, bed_number }));
                                        }}
                                        className="w-full mt-1 bg-[#EBF5FB] rounded-2xl p-4 font-bold outline-none border"
                                        style={{ borderColor: THEME.border }}
                                    >
                                        {[
                                            { id: 'general', label: 'general' },
                                            { id: 'icu', label: 'icu' },
                                            { id: 'emergency', label: 'emergency' },
                                            { id: 'private', label: 'private' },
                                            { id: 'semi_pvt', label: 'semi_pvt' },
                                            { id: 'ventilator', label: 'ventilator' },
                                        ].map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>Auto bed_number</label>
                                    <input
                                        value={registerForm.bed_number}
                                        readOnly
                                        className="w-full mt-1 bg-[#EBF5FB] rounded-2xl p-4 font-black outline-none border font-mono"
                                        style={{ borderColor: THEME.border, color: THEME.navy }}
                                    />
                                    <p className="text-[11px] font-bold mt-2" style={{ color: THEME.text2 }}>
                                        Pattern: <span className="font-black">{wardPrefix(registerForm.ward_type)}-NN</span>
                                    </p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>department (uuid)</label>
                                    <input
                                        value={registerForm.department}
                                        onChange={(e) => setRegisterForm(f => ({ ...f, department: e.target.value }))}
                                        className="w-full mt-1 bg-[#EBF5FB] rounded-2xl p-4 font-bold outline-none border"
                                        style={{ borderColor: THEME.border }}
                                        placeholder="dept-uuid"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: THEME.text2 }}>notes (optional)</label>
                                <textarea
                                    value={registerForm.notes}
                                    onChange={(e) => setRegisterForm(f => ({ ...f, notes: e.target.value }))}
                                    className="w-full mt-1 bg-[#EBF5FB] rounded-2xl p-4 font-bold outline-none border min-h-[110px]"
                                    style={{ borderColor: THEME.border }}
                                    placeholder="Optional"
                                />
                            </div>

                            {registerError && <div className="text-sm font-black" style={{ color: THEME.red }}>{registerError}</div>}

                            <div className="flex gap-4 pt-2">
                                <button type="button" onClick={() => setShowRegisterModal(false)} className="flex-1 py-4 rounded-2xl font-black border hover:bg-white transition-all" style={{ borderColor: THEME.border, color: THEME.navy }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={registerLoading} className={`flex-1 py-4 rounded-2xl font-black text-white transition-all ${registerLoading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-95'}`} style={{ background: THEME.blue }}>
                                    {registerLoading ? 'Registering…' : 'Register bed'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Update Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="bg-white rounded-[48px] p-12 w-full max-w-4xl shadow-2xl border" style={{ borderColor: THEME.border }}>
                        <div className="flex justify-between items-start gap-4 mb-8">
                            <div>
                                <h3 className="text-3xl font-black hero-heading italic" style={{ color: THEME.navy }}>Bulk Bed Update</h3>
                                <p className="text-sm font-bold" style={{ color: THEME.text2 }}>Shift handover update for multiple beds.</p>
                            </div>
                            <button onClick={() => setShowBulkModal(false)} className="w-12 h-12 rounded-2xl bg-[#EBF5FB] font-black text-xl" style={{ color: THEME.navy }}>×</button>
                        </div>

                        <div className="max-h-[55vh] overflow-auto rounded-[32px] border" style={{ borderColor: THEME.border }}>
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-[#EBF5FB]">
                                        <th className="text-left text-[10px] font-black uppercase tracking-widest px-6 py-4" style={{ color: THEME.text2 }}>Bed</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-widest px-6 py-4" style={{ color: THEME.text2 }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bulkBeds.map((b, idx) => (
                                        <tr key={b.id} className="border-t" style={{ borderColor: THEME.border }}>
                                            <td className="px-6 py-4 font-black text-[#0D1B2A]">{b.bed_number}</td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={b.status}
                                                    onChange={(e) => {
                                                        const next = [...bulkBeds];
                                                        next[idx] = { ...next[idx], status: e.target.value };
                                                        setBulkBeds(next);
                                                    }}
                                                    className="bg-[#EBF5FB] rounded-2xl p-3 font-bold outline-none border"
                                                    style={{ borderColor: THEME.border }}
                                                >
                                                    {['available', 'occupied', 'reserved', 'maintenance'].map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                    {bulkBeds.length === 0 && (
                                        <tr><td colSpan={2} className="px-6 py-10 text-center text-sm font-bold" style={{ color: THEME.text2 }}>No beds loaded.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {bulkError && <div className="mt-4 text-sm font-black" style={{ color: THEME.red }}>{bulkError}</div>}

                        <div className="mt-8 flex gap-4">
                            <button type="button" onClick={() => setShowBulkModal(false)} className="flex-1 py-4 rounded-2xl font-black border hover:bg-white transition-all" style={{ borderColor: THEME.border, color: THEME.navy }}>
                                Cancel
                            </button>
                            <button onClick={submitBulkUpdate} disabled={bulkLoading} className={`flex-1 py-4 rounded-2xl font-black text-white transition-all ${bulkLoading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-95'}`} style={{ background: THEME.lightBlue }}>
                                {bulkLoading ? 'Saving…' : 'Save bulk update'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast.show && (
                <div
                    className="fixed bottom-10 right-10 px-10 py-5 rounded-3xl shadow-2xl z-50 font-black text-white animate-in slide-in-from-bottom-10 duration-300"
                    style={{ background: toast.type === 'error' ? THEME.red : THEME.blue }}
                >
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default ReceptionBedMapPage;
