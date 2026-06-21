// frontend/hospital/src/pages/DoctorPortalPage.jsx
import { useState, useEffect } from 'react';
import SanjivniLogo from '../components/SanjivniLogo';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
async function apiFetch(path) {
  const token = localStorage.getItem('medgrid_token') || '';
  return fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

const SPEC_ICONS = {
  cardiology:'❤️', neurology:'🧠', orthopedics:'🦴', oncology:'🔬',
  pediatrics:'👶', general:'🏥', surgery:'🔪', radiology:'📡',
  emergency:'🚨', icu:'💊', nephrology:'🫘', other:'👨‍⚕️',
};

const SPECIALIZATIONS = [
  { value:'', label:'All Specializations' },
  { value:'cardiology',  label:'❤️ Cardiology' },
  { value:'neurology',   label:'🧠 Neurology' },
  { value:'orthopedics', label:'🦴 Orthopedics' },
  { value:'oncology',    label:'🔬 Oncology' },
  { value:'pediatrics',  label:'👶 Pediatrics' },
  { value:'general',     label:'🏥 General Medicine' },
  { value:'surgery',     label:'🔪 Surgery' },
  { value:'radiology',   label:'📡 Radiology' },
  { value:'emergency',   label:'🚨 Emergency' },
  { value:'icu',         label:'💊 ICU' },
  { value:'nephrology',  label:'🫘 Nephrology' },
];

const STATUS_CFG = {
  active:   { label:'Active',   color:'#16a34a', bg:'#dcfce7' },
  inactive: { label:'Inactive', color:'#dc2626', bg:'#fee2e2' },
  on_leave: { label:'On Leave', color:'#d97706', bg:'#fef3c7' },
};

const MOCK_DOCTORS = [
  { id:'1',  full_name:'Dr. Arjun Sharma',  specialization:'cardiology',  qualification:'MBBS, MD Cardiology, DM', experience_years:14, status:'active',   hospital_name:'City Regional Hospital',   department_name:'Cardiology',       phone:'+91 98765 43210', email:'arjun.sharma@crh.in',   registration_no:'MCI-2010-0042', is_on_duty_now:true  },
  { id:'2',  full_name:'Dr. Priya Mehta',   specialization:'neurology',   qualification:'MBBS, DM Neurology',       experience_years:9,  status:'active',   hospital_name:'Westwood Clinical Center', department_name:'Neurology',         phone:'+91 87654 32109', email:'priya.mehta@wcc.in',    registration_no:'MCI-2015-0178', is_on_duty_now:false },
  { id:'3',  full_name:'Dr. Rahul Verma',   specialization:'orthopedics', qualification:'MBBS, MS Orthopedics',     experience_years:11, status:'active',   hospital_name:'City Regional Hospital',   department_name:'Orthopedics',      phone:'+91 76543 21098', email:'rahul.verma@crh.in',    registration_no:'MCI-2013-0295', is_on_duty_now:true  },
  { id:'4',  full_name:'Dr. Sunita Patel',  specialization:'pediatrics',  qualification:'MBBS, MD Pediatrics',      experience_years:7,  status:'active',   hospital_name:'Apollo Westend',           department_name:'Pediatrics',       phone:'+91 65432 10987', email:'sunita.p@apollo.in',    registration_no:'MCI-2017-0412', is_on_duty_now:false },
  { id:'5',  full_name:'Dr. Vikram Singh',  specialization:'emergency',   qualification:'MBBS, FCEM',               experience_years:12, status:'active',   hospital_name:'City Regional Hospital',   department_name:'Emergency',        phone:'+91 54321 09876', email:'vikram.s@crh.in',       registration_no:'MCI-2012-0531', is_on_duty_now:true  },
  { id:'6',  full_name:'Dr. Anita Joshi',   specialization:'general',     qualification:'MBBS, MD',                 experience_years:6,  status:'on_leave', hospital_name:'Westwood Clinical Center', department_name:'General Medicine', phone:'+91 43210 98765', email:'anita.j@wcc.in',        registration_no:'MCI-2018-0647', is_on_duty_now:false },
  { id:'7',  full_name:'Dr. Suresh Kumar',  specialization:'oncology',    qualification:'MBBS, MD, DM Oncology',   experience_years:18, status:'active',   hospital_name:'Apollo Westend',           department_name:'Oncology',         phone:'+91 32109 87654', email:'suresh.k@apollo.in',    registration_no:'MCI-2006-0763', is_on_duty_now:false },
  { id:'8',  full_name:'Dr. Kavya Reddy',   specialization:'icu',         qualification:'MBBS, MD Critical Care',   experience_years:8,  status:'active',   hospital_name:'City Regional Hospital',   department_name:'ICU',              phone:'+91 21098 76543', email:'kavya.r@crh.in',        registration_no:'MCI-2016-0891', is_on_duty_now:true  },
  { id:'9',  full_name:'Dr. Manish Gupta',  specialization:'nephrology',  qualification:'MBBS, MD, DM Nephrology', experience_years:15, status:'active',   hospital_name:'Westwood Clinical Center', department_name:'Nephrology',       phone:'+91 10987 65432', email:'manish.g@wcc.in',       registration_no:'MCI-2009-0924', is_on_duty_now:false },
  { id:'10', full_name:'Dr. Deepa Nair',    specialization:'radiology',   qualification:'MBBS, MD Radiology',       experience_years:10, status:'active',   hospital_name:'Apollo Westend',           department_name:'Radiology',        phone:'+91 09876 54321', email:'deepa.n@apollo.in',     registration_no:'MCI-2014-1037', is_on_duty_now:true  },
  { id:'11', full_name:'Dr. Rohit Saxena',  specialization:'surgery',     qualification:'MBBS, MS General Surgery', experience_years:13, status:'active',   hospital_name:'City Regional Hospital',   department_name:'General Surgery',  phone:'+91 98761 23450', email:'rohit.s@crh.in',        registration_no:'MCI-2011-1145', is_on_duty_now:false },
  { id:'12', full_name:'Dr. Neha Singh',    specialization:'neurology',   qualification:'MBBS, MD Neurology',       experience_years:5,  status:'inactive', hospital_name:'Apollo Westend',           department_name:'Neurology',        phone:'+91 87762 34501', email:'neha.s@apollo.in',      registration_no:'MCI-2019-1253', is_on_duty_now:false },
  { id:'13', full_name:'Dr. Amit Chouhan',  specialization:'cardiology',  qualification:'MBBS, DNB Cardiology',     experience_years:8,  status:'active',   hospital_name:'Westwood Clinical Center', department_name:'Cardiology',       phone:'+91 76653 45612', email:'amit.c@wcc.in',         registration_no:'MCI-2016-1381', is_on_duty_now:true  },
  { id:'14', full_name:'Dr. Rekha Tiwari',  specialization:'pediatrics',  qualification:'MBBS, MD, DCH',            experience_years:12, status:'active',   hospital_name:'Apollo Westend',           department_name:'Pediatrics',       phone:'+91 65544 56723', email:'rekha.t@apollo.in',     registration_no:'MCI-2012-1492', is_on_duty_now:false },
];

const MOCK_HOSPITALS = [
  { id:'h1', name:'City Regional Hospital',   city:'Indore', category:'government', total_beds:500, icu_capacity:50, phone:'+91 731 234 5678', address:'MG Road, Indore' },
  { id:'h2', name:'Westwood Clinical Center', city:'Indore', category:'private',    total_beds:280, icu_capacity:30, phone:'+91 731 876 5432', address:'Vijay Nagar, Indore' },
  { id:'h3', name:'Apollo Westend',           city:'Indore', category:'private',    total_beds:350, icu_capacity:45, phone:'+91 731 456 7890', address:'AB Road, Indore' },
];

export default function DoctorPortalPage() {
  const [doctors,    setDoctors]   = useState([]);
  const [hospitals,  setHospitals] = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [selected,   setSelected]  = useState(null);
  const [activeTab,  setActiveTab] = useState('doctors');
  const [filters,    setFilters]   = useState({ search:'', specialization:'', status:'', hospital:'', onDutyOnly:false });
  const [sortBy,     setSortBy]    = useState('full_name');
  const [sortDir,    setSortDir]   = useState('asc');
  const [page,       setPage]      = useState(1);
  const PER_PAGE = 10;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await apiFetch('/api/hospitals/doctors/public/');
        if (r.ok) { const d = await r.json(); setDoctors(Array.isArray(d) ? d : d.results || MOCK_DOCTORS); }
        else setDoctors(MOCK_DOCTORS);
      } catch { setDoctors(MOCK_DOCTORS); }
      try {
        const r = await apiFetch('/api/hospitals/search/?city=Indore');
        if (r.ok) { const d = await r.json(); setHospitals(Array.isArray(d) ? d : d.results || MOCK_HOSPITALS); }
        else setHospitals(MOCK_HOSPITALS);
      } catch { setHospitals(MOCK_HOSPITALS); }
      setLoading(false);
    })();
  }, []);

  const filtered = doctors.filter(d => {
    if (filters.search && ![d.full_name, d.hospital_name, d.specialization, d.qualification]
      .some(v => v?.toLowerCase().includes(filters.search.toLowerCase()))) return false;
    if (filters.specialization && d.specialization !== filters.specialization) return false;
    if (filters.status        && d.status !== filters.status)                  return false;
    if (filters.hospital      && d.hospital_name !== filters.hospital)         return false;
    if (filters.onDutyOnly    && !d.is_on_duty_now)                            return false;
    return true;
  }).sort((a, b) => {
    const av = a[sortBy] ?? ''; const bv = b[sortBy] ?? '';
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const uniqueHosp = [...new Set(doctors.map(d => d.hospital_name).filter(Boolean))];
  const handleSort = col => { if (sortBy===col) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortBy(col);setSortDir('asc');} setPage(1); };
  const stats = { total:doctors.length, onDuty:doctors.filter(d=>d.is_on_duty_now).length, active:doctors.filter(d=>d.status==='active').length, specs:[...new Set(doctors.map(d=>d.specialization))].length };

  return (
    <div style={{ minHeight:'100vh', background:'#f2f4f2', fontFamily:"'Inter',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,700&display=swap');
        .dr-row:hover{background:#f0fdf4!important;cursor:pointer;}
        .th-s{background:none;border:none;cursor:pointer;font-weight:700;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:2px;padding:0;white-space:nowrap;}
        .th-s:hover{color:#1B4332;}
        .fi{padding:8px 11px;border-radius:10px;border:1.5px solid #e0dfd8;font-size:13px;background:#fff;outline:none;transition:border-color .2s;font-family:inherit;}
        .fi:focus{border-color:#2D6A4F;}
        @keyframes slideR{from{opacity:0;transform:translateX(18px);}to{opacity:1;transform:translateX(0);}}
        @keyframes fadeU{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:translateY(0);}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      {/* ── Header ── */}
      <header style={{ background:'linear-gradient(135deg,#1B4332,#2D6A4F)', padding:'0 36px', display:'flex', alignItems:'center', justifyContent:'space-between', height:64, boxShadow:'0 4px 24px rgba(27,67,50,.3)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:42, height:42, borderRadius:14, background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>👨‍⚕️</div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:'#D8F3DC', fontFamily:'Playfair Display,serif', fontStyle:'italic' }}>Doctor Portal</div>
            <div style={{ fontSize:11, color:'rgba(216,243,220,.55)', fontWeight:500 }}>SANJIVNI · Physician Directory</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {[['doctors','👨‍⚕️ Doctors'],['hospitals','🏥 Hospitals']].map(([id,label])=>(
            <button key={id} onClick={()=>setActiveTab(id)} style={{ padding:'8px 18px', borderRadius:20, border:'none', cursor:'pointer', fontSize:13, fontWeight:700, background:activeTab===id?'#fff':'rgba(255,255,255,.12)', color:activeTab===id?'#1B4332':'#D8F3DC', transition:'all .2s' }}>{label}</button>
          ))}
          <button onClick={()=>window.history.back()} style={{ padding:'8px 16px', borderRadius:20, border:'1px solid rgba(255,255,255,.25)', background:'transparent', color:'#D8F3DC', cursor:'pointer', fontSize:13, fontWeight:600, marginLeft:8 }}>← Back</button>
        </div>
      </header>

      <div style={{ maxWidth:1440, margin:'0 auto', padding:'22px 26px' }}>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:13, marginBottom:20 }}>
          {[
            { label:'Total Physicians', val:stats.total,   icon:'👨‍⚕️', c:'#1B4332', bg:'#dcfce7', border:'#86efac' },
            { label:'On Duty Now',      val:stats.onDuty,  icon:'🟢',   c:'#16a34a', bg:'#f0fdf4', border:'#4ade80' },
            { label:'Active Status',    val:stats.active,  icon:'✅',   c:'#185FA5', bg:'#eff6ff', border:'#93c5fd' },
            { label:'Specializations',  val:stats.specs,   icon:'🔬',   c:'#7c3aed', bg:'#f5f3ff', border:'#c4b5fd' },
          ].map((s,i)=>(
            <div key={i} style={{ background:s.bg, borderRadius:16, padding:'18px 20px', border:`1px solid ${s.border}`, animation:`fadeU .4s ease ${i*.08}s both` }}>
              <div style={{ fontSize:28, fontWeight:800, color:s.c, lineHeight:1 }}>{loading?'…':s.val}</div>
              <div style={{ fontSize:12, color:s.c, fontWeight:600, marginTop:5, opacity:.75 }}>{s.icon} {s.label}</div>
            </div>
          ))}
        </div>

        {/* ══ DOCTORS TAB ══ */}
        {activeTab==='doctors' && (
          <div style={{ display:'flex', gap:18, alignItems:'flex-start' }}>

            {/* Table */}
            <div style={{ flex:1, minWidth:0 }}>

              {/* Filters */}
              <div style={{ background:'#fff', borderRadius:16, padding:'13px 16px', marginBottom:13, border:'1px solid #e5e4dc', display:'flex', gap:9, flexWrap:'wrap', alignItems:'center', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
                <div style={{ position:'relative', flex:2, minWidth:180 }}>
                  <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:13 }}>🔍</span>
                  <input className="fi" value={filters.search}
                    onChange={e=>{setFilters(f=>({...f,search:e.target.value}));setPage(1);}}
                    placeholder="Search doctor, hospital, specialty…"
                    style={{ width:'100%', paddingLeft:30, boxSizing:'border-box' }}
                  />
                </div>
                <select className="fi" value={filters.specialization} onChange={e=>{setFilters(f=>({...f,specialization:e.target.value}));setPage(1);}} style={{ cursor:'pointer', flex:1, minWidth:155 }}>
                  {SPECIALIZATIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select className="fi" value={filters.status} onChange={e=>{setFilters(f=>({...f,status:e.target.value}));setPage(1);}} style={{ cursor:'pointer' }}>
                  <option value="">All Status</option>
                  <option value="active">🟢 Active</option>
                  <option value="inactive">🔴 Inactive</option>
                  <option value="on_leave">🟡 On Leave</option>
                </select>
                <select className="fi" value={filters.hospital} onChange={e=>{setFilters(f=>({...f,hospital:e.target.value}));setPage(1);}} style={{ cursor:'pointer', flex:1, minWidth:155 }}>
                  <option value="">All Hospitals</option>
                  {uniqueHosp.map(h=><option key={h} value={h}>{h}</option>)}
                </select>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:'#1B4332', cursor:'pointer', whiteSpace:'nowrap', padding:'8px 12px', borderRadius:10, background:filters.onDutyOnly?'#dcfce7':'#f9f9f8', border:`1.5px solid ${filters.onDutyOnly?'#4ade80':'#e0dfd8'}`, transition:'all .2s' }}>
                  <input type="checkbox" checked={filters.onDutyOnly} onChange={e=>setFilters(f=>({...f,onDutyOnly:e.target.checked}))} style={{ accentColor:'#16a34a' }} />
                  🟢 On Duty
                </label>
                <span style={{ fontSize:12, color:'#9ca3af', whiteSpace:'nowrap' }}>{filtered.length} results</span>
              </div>

              {/* Table panel */}
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e4dc', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
                {loading ? (
                  <div style={{ padding:56, textAlign:'center', color:'#9ca3af', fontSize:14 }}>
                    <div style={{ width:30, height:30, border:'3px solid #e0dfd8', borderTopColor:'#1B4332', borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 12px' }} />
                    Loading physicians…
                  </div>
                ) : (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr style={{ background:'#f8f9f8', borderBottom:'1.5px solid #e5e4dc' }}>
                          {[['full_name','Doctor'],['specialization','Specialty'],['hospital_name','Hospital'],['department_name','Department'],['experience_years','Exp'],['status','Status'],['is_on_duty_now','Duty']].map(([col,label])=>(
                            <th key={col} style={{ padding:'10px 14px', textAlign:'left' }}>
                              <button className="th-s" onClick={()=>handleSort(col)}>
                                {label}<span style={{ opacity:sortBy===col?1:.25, fontSize:9 }}>{sortBy===col?(sortDir==='asc'?' ▲':' ▼'):' ▲'}</span>
                              </button>
                            </th>
                          ))}
                          <th style={{ padding:'10px 14px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((doc,idx)=>{
                          const sc  = STATUS_CFG[doc.status]||STATUS_CFG.inactive;
                          const ico = SPEC_ICONS[doc.specialization]||'👨‍⚕️';
                          const isSel = selected?.id===doc.id;
                          return (
                            <tr key={doc.id} className="dr-row" onClick={()=>setSelected(isSel?null:doc)}
                              style={{ borderBottom:'1px solid #f1efea', background:isSel?'#f0fdf4':idx%2===0?'#fff':'#fdfdf9', transition:'background .15s' }}>
                              <td style={{ padding:'12px 14px' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                  <div style={{ width:38, height:38, borderRadius:12, background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{ico}</div>
                                  <div>
                                    <div style={{ fontWeight:700, color:'#111827' }}>{doc.full_name}</div>
                                    <div style={{ fontSize:10, color:'#9ca3af', marginTop:1 }}>{doc.registration_no}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding:'12px 14px' }}>
                                <span style={{ fontSize:11, padding:'3px 9px', borderRadius:20, background:'#f0fdf4', color:'#1B4332', fontWeight:600, whiteSpace:'nowrap' }}>{ico} {doc.specialization}</span>
                              </td>
                              <td style={{ padding:'12px 14px', fontSize:12, fontWeight:600, color:'#374151' }}>{doc.hospital_name||'—'}</td>
                              <td style={{ padding:'12px 14px', fontSize:12, color:'#6b7280' }}>{doc.department_name||'—'}</td>
                              <td style={{ padding:'12px 14px', fontWeight:800, color:'#185FA5', fontSize:15 }}>{doc.experience_years}y</td>
                              <td style={{ padding:'12px 14px' }}>
                                <span style={{ fontSize:11, padding:'3px 9px', borderRadius:20, background:sc.bg, color:sc.color, fontWeight:700 }}>{sc.label}</span>
                              </td>
                              <td style={{ padding:'12px 14px' }}>
                                {doc.is_on_duty_now
                                  ? <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#16a34a', fontWeight:700 }}>
                                      <span style={{ width:7, height:7, borderRadius:'50%', background:'#16a34a', display:'inline-block', animation:'blink 2s infinite' }}/>On Duty
                                    </span>
                                  : <span style={{ fontSize:11, color:'#9ca3af' }}>Offline</span>}
                              </td>
                              <td style={{ padding:'12px 14px' }}>
                                <button onClick={e=>{e.stopPropagation();setSelected(isSel?null:doc);}}
                                  style={{ fontSize:11, padding:'5px 11px', borderRadius:8, border:`1px solid ${isSel?'#1B4332':'#e0dfd8'}`, background:isSel?'#1B4332':'#fff', color:isSel?'#fff':'#444', cursor:'pointer', fontWeight:600, transition:'all .2s' }}>
                                  {isSel?'✕ Close':'Details →'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {paginated.length===0 && (
                          <tr><td colSpan={8} style={{ padding:48, textAlign:'center', color:'#9ca3af', fontSize:13 }}>
                            <div style={{ fontSize:36, marginBottom:8 }}>👨‍⚕️</div>No doctors match current filters
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {totalPages>1 && (
                  <div style={{ padding:'11px 16px', borderTop:'1px solid #f1efea', display:'flex', alignItems:'center', gap:5, justifyContent:'center' }}>
                    <button disabled={page===1} onClick={()=>setPage(p=>p-1)} style={{ padding:'6px 13px', borderRadius:8, border:'1px solid #e0dfd8', background:page===1?'#f9f9f8':'#fff', cursor:page===1?'default':'pointer', fontSize:12, color:page===1?'#9ca3af':'#444' }}>← Prev</button>
                    {Array.from({length:totalPages},(_,i)=>(
                      <button key={i} onClick={()=>setPage(i+1)} style={{ width:30, height:30, borderRadius:8, border:'none', background:page===i+1?'#1B4332':'transparent', color:page===i+1?'#fff':'#6b7280', cursor:'pointer', fontWeight:700, fontSize:12, transition:'all .2s' }}>{i+1}</button>
                    ))}
                    <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} style={{ padding:'6px 13px', borderRadius:8, border:'1px solid #e0dfd8', background:page===totalPages?'#f9f9f8':'#fff', cursor:page===totalPages?'default':'pointer', fontSize:12, color:page===totalPages?'#9ca3af':'#444' }}>Next →</button>
                  </div>
                )}
              </div>
            </div>

            {/* Detail panel */}
            {selected && (
              <div style={{ width:310, flexShrink:0, background:'#fff', borderRadius:20, border:'1px solid #e5e4dc', boxShadow:'0 8px 28px rgba(0,0,0,.10)', animation:'slideR .3s ease', alignSelf:'flex-start', position:'sticky', top:20, overflow:'hidden' }}>
                <div style={{ background:'linear-gradient(135deg,#1B4332,#2D6A4F)', padding:'22px 20px', textAlign:'center' }}>
                  <div style={{ width:68, height:68, borderRadius:'50%', background:'rgba(255,255,255,.15)', margin:'0 auto 10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>{SPEC_ICONS[selected.specialization]||'👨‍⚕️'}</div>
                  <div style={{ fontSize:17, fontWeight:800, color:'#fff', fontFamily:'Playfair Display,serif' }}>{selected.full_name}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.6)', marginTop:4 }}>{selected.qualification||'MBBS'}</div>
                  {selected.is_on_duty_now && (
                    <div style={{ marginTop:9, display:'inline-flex', alignItems:'center', gap:5, padding:'3px 11px', borderRadius:20, background:'rgba(34,197,94,.18)', border:'1px solid rgba(74,222,128,.3)', color:'#86efac', fontSize:11, fontWeight:700 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', display:'inline-block', animation:'blink 2s infinite' }}/>Currently On Duty
                    </div>
                  )}
                </div>
                <div style={{ padding:18 }}>
                  {/* Hospital card */}
                  <div style={{ background:'#f0fdf4', borderRadius:12, padding:'11px 13px', marginBottom:14, border:'1px solid #bbf7d0' }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#1B4332', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>🏥 Associated Hospital</div>
                    <div style={{ fontSize:14, fontWeight:800, color:'#1B4332' }}>{selected.hospital_name||'—'}</div>
                    <div style={{ fontSize:12, color:'#16a34a', fontWeight:600, marginTop:2 }}>{selected.department_name} Dept.</div>
                  </div>
                  {[['🔬 Specialty',selected.specialization],['🎓 Experience',`${selected.experience_years} years`],['📋 Reg. No.',selected.registration_no],['📞 Phone',selected.phone||'—'],['📧 Email',selected.email||'—']].map(([l,v])=>(
                    <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #f1efea' }}>
                      <span style={{ fontSize:12, color:'#6b7280', fontWeight:500 }}>{l}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:'#111827', textAlign:'right', maxWidth:'58%', wordBreak:'break-word' }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:12 }}>
                    {(()=>{ const c=STATUS_CFG[selected.status]||STATUS_CFG.inactive; return <span style={{ padding:'4px 13px', borderRadius:20, background:c.bg, color:c.color, fontSize:12, fontWeight:700 }}>{c.label}</span>; })()}
                  </div>
                  <button onClick={()=>setSelected(null)} style={{ marginTop:16, width:'100%', padding:10, borderRadius:10, border:'none', background:'#f1efea', color:'#6b7280', cursor:'pointer', fontWeight:600, fontSize:13 }}>Close ✕</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ HOSPITALS TAB ══ */}
        {activeTab==='hospitals' && (
          <div style={{ animation:'fadeU .35s ease' }}>
            <p style={{ fontSize:13, color:'#6b7280', marginBottom:16, fontWeight:600 }}>Hospital directory with associated physician data</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(350px,1fr))', gap:15 }}>
              {(hospitals.length>0?hospitals:MOCK_HOSPITALS).map((h,i)=>{
                const hDocs  = doctors.filter(d=>d.hospital_name===h.name);
                const onDN   = hDocs.filter(d=>d.is_on_duty_now).length;
                const specs  = [...new Set(hDocs.map(d=>d.specialization))];
                return (
                  <div key={h.id||i} style={{ background:'#fff', borderRadius:20, border:'1px solid #e5e4dc', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,.06)', animation:`fadeU .4s ease ${i*.07}s both` }}>
                    <div style={{ padding:'19px 22px', borderBottom:'1px solid #f1efea', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontSize:16, fontWeight:800, color:'#1B4332', marginBottom:3 }}>{h.name}</div>
                        <div style={{ fontSize:12, color:'#6b7280' }}>📍 {h.city} · {h.category}</div>
                      </div>
                      <span style={{ fontSize:10, padding:'3px 10px', borderRadius:20, background:'#dcfce7', color:'#16a34a', fontWeight:700, textTransform:'uppercase' }}>Verified</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', padding:'14px 22px', gap:10, borderBottom:'1px solid #f1efea' }}>
                      {[['Beds',h.total_beds||'—'],['ICU',h.icu_capacity||'—'],['Doctors',hDocs.length||'?'],['On Duty',onDN]].map(([l,v])=>(
                        <div key={l} style={{ textAlign:'center' }}>
                          <div style={{ fontSize:22, fontWeight:800, color:'#1B4332' }}>{v}</div>
                          <div style={{ fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em', marginTop:2 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {specs.length>0 && (
                      <div style={{ padding:'11px 22px', display:'flex', flexWrap:'wrap', gap:5, borderBottom:'1px solid #f1efea' }}>
                        {specs.slice(0,5).map(s=>(
                          <span key={s} style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'#f0fdf4', color:'#1B4332', fontWeight:600 }}>{SPEC_ICONS[s]||'👨‍⚕️'} {s}</span>
                        ))}
                        {specs.length>5 && <span style={{ fontSize:11, color:'#9ca3af' }}>+{specs.length-5}</span>}
                      </div>
                    )}
                    <div style={{ padding:'11px 22px', fontSize:12, color:'#6b7280' }}>
                      {h.address && <div>📍 {h.address}</div>}
                      {h.phone   && <div style={{ marginTop:3 }}>📞 {h.phone}</div>}
                    </div>
                    {onDN>0 && (
                      <div style={{ padding:'8px 22px', background:'#f0fdf4', display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#16a34a', borderTop:'1px solid #bbf7d0' }}>
                        <span style={{ width:7, height:7, borderRadius:'50%', background:'#16a34a', animation:'blink 2s infinite', display:'inline-block' }}/>
                        {onDN} doctor{onDN!==1?'s':''} on duty now
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
