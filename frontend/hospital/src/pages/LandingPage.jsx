import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Auth } from '../services/auth';
import { apiFetch } from '../services/api';
import { landingPageConfig } from '../services/landingPageConfig';
import SanjivniLogo from '../components/SanjivniLogo';
import "../css/styles.css"

const LandingPage = () => {
  const navigate = useNavigate();
  const user = Auth.user;
  
  // State for backend-fetched content
  const [features, setFeatures] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [faqItems, setFaqItems] = useState([]);
  const [stats, setStats] = useState({ hospitals: 200, uptime: 99.9 });
  const [gridHospitals, setGridHospitals] = useState([]);
  const [gridLoading, setGridLoading] = useState(true);
  const [gridError, setGridError] = useState('');
  const [contentLoading, setContentLoading] = useState(true);

  useEffect(() => {
    // Scroll reveal
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Counter animation
    document.querySelectorAll('[data-target]').forEach(counter => {
      const target = +counter.getAttribute('data-target');
      const speed = +counter.getAttribute('data-speed') || 2000;
      let current = 0;
      const step = target / (speed / 16);
      const id = setInterval(() => {
        current = Math.min(current + step, target);
        counter.textContent = Math.floor(current).toLocaleString();
        if (current >= target) clearInterval(id);
      }, 16);
    });

    // FAQ toggle
    document.querySelectorAll('.faq-item').forEach(item => {
      const q = item.querySelector('.faq-question');
      const a = item.querySelector('.faq-answer');
      if (q && a) q.addEventListener('click', () => { item.classList.toggle('active'); });
    });

    return () => observer.disconnect();
  }, []);

  // Fetch landing page content from backend
  useEffect(() => {
    const fetchContent = async () => {
      setContentLoading(true);
      try {
        const [featuresRes, testimonialsRes, pricingRes, faqRes, statsRes] = await Promise.all([
          landingPageConfig.getFeatures(),
          landingPageConfig.getTestimonials(),
          landingPageConfig.getPricing(),
          landingPageConfig.getFAQ(),
          landingPageConfig.getStats(),
        ]);
        
        if (featuresRes.success && featuresRes.data.length > 0) setFeatures(featuresRes.data);
        if (testimonialsRes.success && testimonialsRes.data.length > 0) setTestimonials(testimonialsRes.data);
        if (pricingRes.success && pricingRes.data.length > 0) setPricing(pricingRes.data);
        if (faqRes.success && faqRes.data.length > 0) setFaqItems(faqRes.data);
        if (statsRes.success && statsRes.data) setStats(statsRes.data);
      } catch (error) {
        console.error('Error fetching landing page content:', error);
      } finally {
        setContentLoading(false);
      }
    };
    fetchContent();
  }, []);

  useEffect(() => {
    const fetchHospitals = async () => {
      setGridLoading(true);
      setGridError('');
      try {
        const selectedCity = new URLSearchParams(window.location.search).get('city') || 'Bhopal';
        const res = await apiFetch(`/api/hospitals/search/?city=${encodeURIComponent(selectedCity)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || 'Failed to load hospitals');
        const list = Array.isArray(data) ? data : data.results || [];
        setGridHospitals(list.slice(0, 6));
      } catch (error) {
        setGridHospitals([]);
        setGridError(error.message || 'Failed to load hospitals');
      } finally {
        setGridLoading(false);
      }
    };

    fetchHospitals();
  }, []);

  const handleSignIn = (e) => e.preventDefault();
  const handleSignUp = (e) => e.preventDefault();
  const handleChatSubmit = (e) => e.preventDefault();

  const handleDashboard = () => {
    if (user) navigate(Auth.redirectPath(user.role));
  };

  const handleLogout = async () => { await Auth.logout(); window.location.reload(); };

  return (
    <>
      <nav id="navbar" className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-[1440px] z-50 bg-[#FDFCF7]/85 backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] px-4 py-3 rounded-full flex items-center justify-between transition-all duration-300">
        <div className="flex items-center gap-3 pl-2">
          <SanjivniLogo size={42} />
        </div>
        <div className="hidden lg:flex items-center gap-1 bg-black/5 p-1 rounded-full border border-white/60 shadow-inner">
          <a href="#resource-mobility" className="px-5 py-2 rounded-full text-sm font-semibold text-gray-700 hover:text-[#1B4332] hover:bg-white hover:shadow-sm transition-all">Network</a>
          <Link to="/about" className="px-5 py-2 rounded-full text-sm font-semibold text-gray-700 hover:text-[#1B4332] hover:bg-white hover:shadow-sm transition-all">About</Link>
          <a href="#features" className="px-5 py-2 rounded-full text-sm font-semibold text-gray-700 hover:text-[#1B4332] hover:bg-white hover:shadow-sm transition-all">Features</a>
          <a href="#how-it-works" className="px-5 py-2 rounded-full text-sm font-semibold text-gray-700 hover:text-[#1B4332] hover:bg-white hover:shadow-sm transition-all">How it works</a>
          <a href="#testimonials" className="px-5 py-2 rounded-full text-sm font-semibold text-gray-700 hover:text-[#1B4332] hover:bg-white hover:shadow-sm transition-all">Testimonials</a>
          <a href="#pricing" className="px-5 py-2 rounded-full text-sm font-semibold text-gray-700 hover:text-[#1B4332] hover:bg-white hover:shadow-sm transition-all">Pricing</a>
          <a href="#faq" className="px-5 py-2 rounded-full text-sm font-semibold text-gray-700 hover:text-[#1B4332] hover:bg-white hover:shadow-sm transition-all">FAQ</a>
        </div>
        <div className="flex items-center gap-2 pr-1" id="authNav">
          {/* Emergency Button - Always Visible */}
          <a href="/emergency" className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-red-500 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-red-600/25 hover:shadow-red-600/40 hover:-translate-y-0.5 transition-all">
            🚨 Emergency
          </a>
          {/* Guest State */}
          <div id="guestNav" className="flex items-center gap-2">
            <Link to="/signin" id="signInBtn" className="text-sm font-bold text-gray-700 hover:text-[#1B4332] px-4 py-2.5 rounded-full hover:bg-black/5 transition-colors">Sign in</Link>
            <Link to="/signup" className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white px-7 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-[#1B4332]/25 hover:shadow-[#1B4332]/40 hover:-translate-y-0.5 transition-all">
              Request demo
            </Link>
          </div>
          {/* User State */}
          <div id="userNav" className="hidden flex items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-green-50 rounded-full border border-green-100">
              <div className="w-7 h-7 bg-[#1B4332] rounded-full flex items-center justify-center text-white text-[10px] font-black" id="userInitial">U</div>
              <span className="text-sm font-bold text-[#1B4332]" id="userNameDisplay">User Name</span>
            </div>
            <a href="#" id="dashboardBtn" className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-[#1B4332]/10 hover:-translate-y-0.5 transition-all">Dashboard</a>
            <button onClick={() => console.log('Sign Out')} className="text-xs font-bold text-red-500 hover:text-red-600 px-2 transition-colors">Sign Out</button>
          </div>
        </div>
      </nav>

      <section id="hero" className="reveal relative overflow-hidden px-8 py-20 max-w-[1440px] mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="blob-bg -top-20 -right-20"></div>
        <div>
          <span className="inline-block px-4 py-1 rounded-full bg-[#E9EDC9] text-[#1B4332] text-xs font-bold tracking-widest uppercase mb-6">
            Real-Time Hospital Network
          </span>
          <h1 className="hero-heading text-6xl md:text-7xl leading-tight mb-6">
            Smarter Care. <br />Faster Saves. <br /><span className="hero-accent">For Every Hospital.</span>
          </h1>
          <p className="font-sans text-xl text-gray-500 mb-10 max-w-lg leading-relaxed">
            Coordinate transfers, manage equipment, and sync ICU beds across your entire city in one unified live dashboard.
          </p>
          <div className="flex flex-wrap gap-4">
            <button className="bg-[#1B4332] text-white px-8 py-4 rounded-full font-semibold flex items-center gap-2">
              Join SANJIVNI <span className="text-xl">→</span>
            </button>
            <button className="border border-[#1B4332] text-[#1B4332] px-8 py-4 rounded-full font-semibold">
              How It Works
            </button>
          </div>
          <div className="mt-10 flex items-center gap-3">
            <div className="flex -space-x-3">
              <img src="https://i.pravatar.cc/100?u=1" className="w-10 h-10 rounded-full border-2 border-white" alt="Avatar" />
              <img src="https://i.pravatar.cc/100?u=2" className="w-10 h-10 rounded-full border-2 border-white" alt="Avatar" />
              <img src="https://i.pravatar.cc/100?u=3" className="w-10 h-10 rounded-full border-2 border-white" alt="Avatar" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Trusted by {stats.hospitals}+ hospitals nationwide</p>
          </div>
        </div>

        <div className="relative hero-float" style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.15))' }}>
          {/* Background Circle */}
          <img src="assets/images/circle.png" alt="Background Circle" className="absolute -z-10 w-[120%] max-w-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-40 blur-3xl saturate-150" />
          {/* Main Image */}
          <div className="relative overflow-hidden w-[90%] md:w-[85%] mx-auto rounded-2xl drop-shadow-2xl">
            <img src="assets/images/home1.png" alt="SANJIVNI Dashboard Preview" className="w-full h-auto rounded-2xl relative z-10" />
          </div>

          {/* Floating Badge: Top Left (Network Pulse) */}
          <div className="absolute top-12 -left-8 md:-left-12 scale-50 md:scale-100 origin-top-left bg-white px-5 py-3 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-3 z-20 animate-[float_4s_ease-in-out_infinite_reverse]">
            <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center relative">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
              <div className="absolute inset-0 border-2 border-green-400 rounded-full animate-ping opacity-50"></div>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800">Live Network</div>
              <div className="text-xs text-green-600 font-medium">99.9% Sync</div>
            </div>
          </div>

          {/* Floating Badge: Bottom Left (Doctor Chip) */}
          <div className="absolute bottom-16 -left-4 md:-left-16 scale-50 md:scale-100 origin-bottom-left bg-white/95 backdrop-blur-md p-2.5 pr-6 rounded-full shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-white/60 flex items-center gap-3.5 z-20 animate-[float_5s_ease-in-out_infinite]">
            <div className="relative w-12 h-12">
              <div className="w-12 h-12 rounded-full bg-blue-50 border-2 border-white shadow-sm flex items-center justify-center text-blue-600">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-[15px] font-bold text-gray-900 leading-tight">Dr. Amit Kumar</div>
              <div className="text-xs text-green-600 font-bold tracking-wide mt-0.5">Cardiology • Online</div>
            </div>
          </div>

          {/* Floating Badge: Bottom Right (Ambulance ETA) */}
          <div className="absolute -bottom-10 -right-2 md:-right-4 scale-50 md:scale-100 origin-bottom-right bg-white p-5 rounded-3xl shadow-2xl border border-gray-100 z-20 animate-[float_6s_ease-in-out_infinite_0.5s] w-64">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-[#FDF8EB] rounded-2xl flex items-center justify-center text-[#B97A1C]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"></path>
                </svg>
              </div>
              <div>
                <div className="text-base font-black text-[#1A2518]">AMB-02 en route</div>
                <div className="text-sm font-medium text-[#B97A1C]">ETA 8 min → H1</div>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="w-3/4 h-full bg-[#1B8D5E] rounded-full"></div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOSPITAL SEARCH ENGINE (PHASE 17) ===== */}
      <section id="hospital-search" className="reveal relative py-20 bg-white">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="bg-[#1B4332] rounded-[48px] p-10 md:p-16 shadow-2xl relative overflow-hidden group">
            {/* Abstract BG */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
            
            <div className="relative z-10 grid lg:grid-cols-[1fr_auto] gap-12 items-end">
              <div className="space-y-6">
                <h2 className="text-4xl md:text-5xl font-black text-white hero-heading italic">Find Care Near You.</h2>
                <p className="text-green-100/70 text-lg max-w-xl">Search 200+ hospitals across the SANJIVNI network. Filter by specialty, distance, and real-time ICU availability.</p>
                
                <div className="flex flex-col md:flex-row gap-4 bg-white/10 p-2 rounded-[32px] border border-white/10 backdrop-blur-md">
                  <div className="flex-1 relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-green-200">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </span>
                    <input type="text" id="hospitalSearchInput" placeholder="Hospital name or city..." className="w-full bg-transparent pl-14 pr-6 py-4 rounded-full text-white placeholder:text-green-200/50 outline-none font-bold" />
                  </div>
                  <select id="specialtyFilter" className="bg-white/10 text-white px-8 py-4 rounded-full border-none outline-none font-bold appearance-none cursor-pointer hover:bg-white/20 transition-all">
                    <option value="" className="bg-[#1B4332]">All Specialties</option>
                    <option value="cardiology" className="bg-[#1B4332]">Cardiology</option>
                    <option value="trauma" className="bg-[#1B4332]">Trauma Center</option>
                    <option value="pediatrics" className="bg-[#1B4332]">Pediatrics</option>
                    <option value="neurology" className="bg-[#1B4332]">Neurology</option>
                  </select>
                  <button id="searchBtn" className="bg-[#E9EDC9] text-[#1B4332] px-10 py-4 rounded-full font-black hover:scale-105 transition-all shadow-lg active:scale-95">SEARCH GRID</button>
                </div>

                {/* Aarohi AI Agent Call Me section */}
                <div className="mt-8 grid md:grid-cols-[2fr,1.2fr] gap-4 items-center bg-black/5 rounded-3xl p-4 md:p-5 border border-white/10">
                  <div className="space-y-1">
                    <p className="text-[11px] font-black tracking-[0.2em] text-green-100 uppercase">Aarohi · Voice Care Agent</p>
                    <p className="text-sm md:text-base text-green-50 font-medium">
                      Prefer talking to a human-like agent? Share your number and Aarohi will call you in a few seconds.
                    </p>
                  </div>
                  <AarohiCallForm />
                </div>
              </div>
              
              <div className="hidden lg:block pb-2">
                <div className="flex items-center gap-4 text-white">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-[0_0_15px_rgba(74,222,128,0.5)]"></div>
                  <span className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Network Live Sync</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LIVE NETWORK HUB ===== */}
      <section id="live-network-hub" className="reveal py-20 bg-[#FDFCF7]/50">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="flex justify-between items-end mb-16">
            <div className="space-y-2">
              <h2 className="text-4xl font-black text-[#1B4332] hero-heading italic uppercase tracking-tight">Real-Time Grid.</h2>
              <p className="text-gray-400 font-medium">Synced hospitals in your current geographic cluster.</p>
            </div>
            <div className="flex items-center gap-4">
              <button className="px-6 py-2 rounded-full border border-gray-100 bg-white text-[10px] font-black uppercase tracking-widest text-[#1B4332] hover:bg-gray-50 transition-all flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Sort: Nearest
              </button>
            </div>
          </div>

          <div id="hospitalGrid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {gridLoading && (
              <div className="col-span-full py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-[#1B4332]/5 rounded-full flex items-center justify-center mx-auto">
                  <div className="w-8 h-8 border-4 border-[#1B4332] border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Initializing secure connection...</p>
              </div>
            )}

            {!gridLoading && gridError && (
              <div className="col-span-full py-14 text-center">
                <p className="text-red-500 font-bold">{gridError}</p>
              </div>
            )}

            {!gridLoading && !gridError && gridHospitals.map((hospital) => (
              <div key={hospital.id} className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm hover:shadow-lg transition-all">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-black text-[#1B4332] leading-tight">{hospital.name}</h3>
                    <p className="text-sm text-gray-500 font-medium mt-1">
                      {hospital.city || 'Unknown city'}{hospital.category ? ` · ${hospital.category}` : ''}
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-[#1B4332]/5 text-[#1B4332] text-[10px] font-black uppercase tracking-widest">
                    Live
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-[#F7FAF8] p-3">
                    <div className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Beds</div>
                    <div className="text-[#0F172A] font-black mt-1">{hospital.total_beds ?? '—'}</div>
                  </div>
                  <div className="rounded-2xl bg-[#F7FAF8] p-3">
                    <div className="text-[10px] uppercase tracking-widest text-gray-400 font-black">ICU</div>
                    <div className="text-[#0F172A] font-black mt-1">{hospital.icu_capacity ?? '—'}</div>
                  </div>
                </div>
              </div>
            ))}

            {!gridLoading && !gridError && gridHospitals.length === 0 && (
              <div className="col-span-full py-14 text-center">
                <p className="text-gray-400 font-black uppercase tracking-widest text-xs">No hospitals found for this cluster.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== TRUST LOGOS MARQUEE ===== */}
      <section className="bg-white/60 backdrop-blur border-y border-black/5 py-8">
        <div className="max-w-[1440px] mx-auto overflow-hidden relative">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">Trusted & compliant with leading standards</p>
          <div className="logo-track-container">
            <div className="logo-track">
              {/* Set 1 */}
              <div className="logo-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">HIPAA Compliant</span>
              </div>
              <div className="logo-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">SOC 2 Type II</span>
              </div>
              <div className="logo-item text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">HL7 FHIR Ready</span>
              </div>
              <div className="logo-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><line x1="12" y1="22" x2="12" y2="12"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">NABH Certified</span>
              </div>
              <div className="logo-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">ISO 27001</span>
              </div>
              <div className="logo-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6 a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">GDPR Ready</span>
              </div>
              <div className="logo-item text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94 a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">99.99% Uptime SLA</span>
              </div>

              {/* Set 2 (Duplicate for seamless loop) */}
              <div className="logo-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">HIPAA Compliant</span>
              </div>
              <div className="logo-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">SOC 2 Type II</span>
              </div>
              <div className="logo-item text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">HL7 FHIR Ready</span>
              </div>
              <div className="logo-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><line x1="12" y1="22" x2="12" y2="12"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">NABH Certified</span>
              </div>
              <div className="logo-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">ISO 27001</span>
              </div>
              <div className="logo-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6 a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">GDPR Ready</span>
              </div>
              <div className="logo-item text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94 a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span className="font-bold text-sm tracking-widest uppercase">99.99% Uptime SLA</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOSPITAL TRANSFER ANIMATION SECTION ===== */}
      <section id="resource-mobility" className="reveal py-24 bg-[#FDFCF7]/50 relative overflow-hidden">
        {/* Parallax Background Layers */}
        <div className="sky-layer absolute top-20 left-0 w-full opacity-20 pointer-events-none">
          <div className="absolute top-0 left-[10%] w-32 h-12 bg-white rounded-full blur-2xl animate-[float_8s_ease-in-out_infinite]"></div>
          <div className="absolute top-10 left-[60%] w-48 h-16 bg-white rounded-full blur-3xl animate-[float_12s_ease-in-out_infinite_reverse]"></div>
        </div>
        <div className="city-skyline absolute bottom-24 left-0 w-[200%] h-48 opacity-[0.03] pointer-events-none"></div>

        <div className="max-w-[1440px] mx-auto px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4 hero-heading uppercase tracking-tight">Inter-Network <span className="text-[#2D6A4F] italic underline decoration-green-200/50 underline-offset-8">Mobility.</span></h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">Watch real-time coordination in action. SANJIVNI manages seamless patient and equipment transfers across your entire network, reducing critical waiting times.</p>
          </div>

          <div className="relative w-full max-w-5xl mx-auto h-[400px] flex flex-col justify-end pb-8">
            {/* Status Markers (Synced with Animation) */}
            <div className="absolute top-20 left-20 status-marker marker-h1">
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur px-4 py-2 rounded-full border border-green-100 shadow-xl shadow-green-900/5">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black text-[#1B4332] uppercase tracking-[0.2em] status-text">Provider Ready</span>
              </div>
            </div>
            <div className="absolute top-20 right-20 status-marker marker-h2">
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur px-4 py-2 rounded-full border border-blue-100 shadow-xl shadow-blue-900/5">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black text-[#1B4332] uppercase tracking-[0.2em] status-text">Receiver Awaiting</span>
              </div>
            </div>

            {/* Container for buildings and ambulance */}
            <div className="relative w-full flex items-end justify-between px-10 pb-4">
              {/* Hospital 1 (Side View) */}
              <div className="hospital-card w-[240px] text-center z-20 group cursor-default">
                <div className="relative">
                  <img src="assets/images/hospital1.png" alt="Hospital 1" className="w-full drop-shadow-2xl mb-4 group-hover:drop-shadow-[0_25px_35px_rgba(74,222,128,0.3)] transition-all" />
                  {/* Signal Pulse */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-green-400/20 rounded-full animate-ping opacity-0 group-hover:opacity-100"></div>
                </div>
                <div className="font-bold text-[#1B4332] text-sm md:text-base">City Regional Hospital</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-1">Resource Provider</div>
              </div>

              {/* Ambulance Movement Track */}
              <div className="absolute inset-x-0 bottom-4 h-24 pointer-events-none z-30">
                <div className="relative w-full h-full max-w-4xl mx-auto">
                  <div className="ambulance-container">
                    <img src="assets/images/ambulance.png" alt="Emergency Ambulance" className="ambulance-sprite" />
                    {/* Siren Glow */}
                    <div className="siren-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Hospital 2 (Side View) */}
              <div className="hospital-card w-[240px] text-center z-20 group cursor-default">
                <div className="relative">
                  <img src="assets/images/hospital2.png" alt="Hospital 2" className="w-full drop-shadow-2xl mb-4 group-hover:drop-shadow-[0_25px_35px_rgba(96,165,250,0.3)] transition-all" />
                  {/* Signal Pulse */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-400/20 rounded-full animate-ping opacity-0 group-hover:opacity-100"></div>
                </div>
                <div className="font-bold text-[#1B4332] text-sm md:text-base">Westwood Clinical Center</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-1">Resource Receiver</div>
              </div>
            </div>

            {/* High-Tech Digital Road */}
            <div className="transfer-road-wrapper">
              <div className="transfer-road-premium">
                <div className="road-surface"></div>
                <div className="road-markings"></div>
                <div className="road-glow-strip"></div>
              </div>
            </div>

            {/* Background accent line */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[110%] h-[1px] bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
          </div>
        </div>
      </section>

      <section id="features" className="reveal max-w-[1440px] mx-auto px-8 py-24">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#E9EDC9]/20 to-transparent pointer-events-none"></div>
        <div className="text-center mb-20 relative z-10">
          <h2 className="text-5xl md:text-6xl font-black mb-6 hero-heading">A Unified <span className="hero-accent">Command Center</span></h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">Eliminate phone tag and spreadsheets. SANJIVNI provides a single, breathtakingly fast source of truth for city-wide medical resource coordination.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-6 auto-rows-[320px] relative z-10">
          {/* Large Card 1 (Map) */}
          <div className="md:col-span-2 md:row-span-2 p-10 rounded-[32px] border border-black/5 bg-white hover:border-green-200 hover:shadow-[0_20px_80px_-20px_rgba(34,197,94,0.2)] transition-all duration-700 overflow-hidden relative group">
            {/* Background visual */}
            <div className="absolute inset-0 bg-[#F8FAF9] z-0"></div>
            <div className="absolute top-1/2 left-1/2 w-[150%] h-[150%] -translate-x-1/2 -translate-y-1/2 opacity-30 z-0 bg-[radial-gradient(circle_at_center,_transparent_20%,_#F8FAF9_70%),_repeating-linear-gradient(rgba(34,197,94,0.2)_0_1px,_transparent_1px_100%),_repeating-linear-gradient(90deg,rgba(34,197,94,0.2)_0_1px,_transparent_1px_100%)] bg-[size:100%_100%,_24px_24px,_24px_24px] group-hover:scale-110 group-hover:opacity-50 transition-all duration-1000"></div>

            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-md border border-gray-100 group-hover:-translate-y-2 transition-transform duration-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <h3 className="text-3xl font-black mb-4 tracking-tight hero-heading">Live City-Wide Map</h3>
                <p className="text-gray-600 leading-relaxed max-w-sm text-lg">Visualize bed availability and active ambulance fleet locations across the entire network in real-time, down to the second.</p>
              </div>

              {/* Radar UI Mockup */}
              <div className="w-full h-56 bg-white/40 backdrop-blur-xl rounded-2xl border border-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] mt-8 relative overflow-hidden flex items-center justify-center group-hover:bg-white/70 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-500">
                {/* Map Rings */}
                <div className="absolute w-72 h-72 border border-green-200/50 rounded-full"></div>
                <div className="absolute w-44 h-44 border border-green-300/50 rounded-full"></div>
                <div className="absolute w-20 h-20 border border-green-400/50 rounded-full"></div>
                <div className="absolute w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,1)]"></div>
                {/* Radar Sweep */}
                <div className="radar-sweep"></div>
                {/* Pins */}
                <div className="absolute top-[25%] left-[30%] w-3 h-3 bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse"></div>
                <div className="absolute top-[65%] left-[75%] w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-pulse delay-300"></div>

                {/* Floating Data Chip */}
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur px-3 py-2 rounded-xl border border-white/50 shadow flex items-center gap-2 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-100">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-bold text-gray-800">AMB-02: 3 min away</span>
                </div>
              </div>
            </div>
          </div>

          {/* Small Card 1 (Transfer) */}
          <div className="md:col-span-1 p-8 rounded-[32px] border border-black/5 bg-white hover:border-blue-200 hover:shadow-[0_20px_80px_-20px_rgba(59,130,246,0.2)] transition-all duration-700 relative overflow-hidden group flex flex-col justify-between">
            <div className="relative z-10">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 text-2xl shadow-sm border border-blue-100 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14 a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h3 className="text-2xl font-bold mb-3 hero-heading">Smart Match</h3>
              <p className="text-[15px] text-gray-500 leading-relaxed pr-4">AI routing matches patients with the nearest available specialist instantly.</p>
            </div>
            {/* Animation Mockup */}
            <div className="relative h-20 w-full mt-6 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between px-4 overflow-hidden group-hover:bg-blue-50/50 transition-colors">
              <img src="https://i.pravatar.cc/100?u=patient" className="w-10 h-10 rounded-full border border-white shadow z-10" alt="Patient" />
              <svg className="absolute inset-0 w-full h-full text-blue-300 group-hover:text-blue-500 transition-colors" preserveAspectRatio="none">
                <path d="M 40,40 Q 100,20 160,40" fill="none" stroke="currentColor" strokeWidth="2" className="animate-dash" />
              </svg>
              <div className="w-10 h-10 rounded-full bg-white border border-blue-200 flex items-center justify-center text-blue-600 z-10 shadow">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><line x1="12" y1="22" x2="12" y2="12"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>
              </div>
            </div>
          </div>

          {/* Small Card 2 (Marketplace) */}
          <div className="md:col-span-1 p-8 rounded-[32px] border border-black/5 bg-white hover:border-amber-200 hover:shadow-[0_20px_80px_-20px_rgba(245,158,11,0.2)] transition-all duration-700 relative overflow-hidden group flex flex-col justify-between">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-gradient-to-br from-amber-100/60 to-transparent rounded-full blur-3xl opacity-50 group-hover:scale-150 transition-transform duration-1000"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 text-2xl shadow-sm border border-amber-100 group-hover:-translate-y-2 transition-all duration-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6 a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
              </div>
              <h3 className="text-2xl font-bold mb-3 hero-heading">Marketplace</h3>
              <p className="text-[15px] text-gray-500 leading-relaxed pr-4">Request or lend life-saving equipment between partnered hospitals.</p>
            </div>
            {/* Floating tags mockup */}
            <div className="relative h-24 w-full mt-6 overflow-hidden flex flex-col gap-3 mask-fade-y">
              <div className="flex gap-2 animate-[scroll_10s_linear_infinite] group-hover:[animation-duration:5s]">
                <span className="bg-amber-50 text-amber-700 text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap border border-amber-100 shadow-sm">Ventilator</span>
                <span className="bg-white text-gray-600 text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap border border-gray-200 shadow-sm">Defibrillator</span>
                <span className="bg-amber-50 text-amber-700 text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap border border-amber-100 shadow-sm">Ventilator</span>
              </div>
              <div className="flex gap-2 justify-end animate-[scroll_12s_linear_infinite_reverse] group-hover:[animation-duration:8s]">
                <span className="bg-white text-gray-600 text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap border border-gray-200 shadow-sm">MRI Time</span>
                <span className="bg-rose-50 text-rose-700 text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap border border-rose-100 shadow-sm">Blood Units</span>
                <span className="bg-white text-gray-600 text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap border border-gray-200 shadow-sm">MRI Time</span>
              </div>
            </div>
          </div>

          {/* Medium Wide Card (Alerts) */}
          <div className="md:col-span-2 p-10 rounded-[32px] border border-[#2D6A4F] bg-[#1B4332] text-white hover:shadow-[0_20px_80px_-20px_rgba(27,67,50,0.5)] hover:-translate-y-1 transition-all duration-700 relative overflow-hidden group">
            {/* Glowing circles background */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 group-hover:scale-125 transition-all duration-1000"></div>
            <div className="absolute right-12 md:right-32 top-1/2 -translate-y-1/2 opacity-30 group-hover:opacity-100 transition-opacity duration-500">
              <div className="w-48 h-48 border border-red-500/40 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
              <div className="w-24 h-24 border border-red-500/60 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]"></div>
            </div>

            <div className="relative z-10 flex flex-col justify-between h-full w-full md:w-2/3">
              <div>
                <div className="w-16 h-16 bg-white/10 text-red-400 rounded-2xl flex items-center justify-center text-3xl backdrop-blur-md border border-white/10 mb-8 group-hover:rotate-12 group-hover:bg-red-500/20 transition-all duration-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94 a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <h3 className="text-4xl font-black mb-4 text-white hero-heading">Critical Mass Alerts</h3>
                <p className="text-[#E9EDC9] text-xl leading-relaxed mix-blend-luminosity opacity-90 max-w-sm">
                  Trigger network-wide alerts overriding silent modes on all staff devices instantly.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section id="how-it-works" className="reveal bg-white py-24 px-8 border-y border-black/5">
        <div className="max-w-[1440px] mx-auto grid md:grid-cols-2 gap-20 items-center">
          <div className="relative z-10 pr-0 md:pr-10">
            <h2 className="text-4xl md:text-5xl font-black mb-16 hero-heading leading-tight">From Setup to Live in <span className="text-[#2D6A4F] italic">Days, Not Months.</span></h2>

            <div className="space-y-10 relative before:content-[''] before:absolute before:left-[23px] before:top-4 before:bottom-4 before:w-[2px] before:bg-gradient-to-b before:from-green-200 before:via-green-100 before:to-transparent">
              {/* Step 1 */}
              <div className="flex gap-6 group relative">
                <div className="flex-none w-12 h-12 rounded-full bg-white border-2 border-green-200 flex items-center justify-center font-bold text-green-700 text-lg shadow-[0_0_15px_rgba(187,247,208,0.5)] group-hover:scale-110 group-hover:border-green-400 group-hover:bg-green-50 transition-all duration-300 z-10 relative">
                  1
                </div>
                <div className="pt-2 pb-4 group-hover:-translate-y-1 transition-transform duration-300">
                  <h4 className="text-2xl font-bold mb-2 text-gray-900 group-hover:text-[#1B4332] transition-colors">Connect your hospital</h4>
                  <p className="text-gray-500 leading-relaxed text-[15px]">Integrate with your existing EMR/EHR system via our secure, zero-trust, HIPAA-compliant API bridge.</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-6 group relative">
                <div className="flex-none w-12 h-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center font-bold text-gray-400 text-lg group-hover:scale-110 group-hover:border-green-400 group-hover:text-green-700 group-hover:bg-green-50 group-hover:shadow-[0_0_15px_rgba(187,247,208,0.5)] transition-all duration-300 z-10 relative">
                  2
                </div>
                <div className="pt-2 pb-4 group-hover:-translate-y-1 transition-transform duration-300">
                  <h4 className="text-2xl font-bold mb-2 text-gray-900 group-hover:text-[#1B4332] transition-colors">Sync resources live</h4>
                  <p className="text-gray-500 leading-relaxed text-[15px]">Bed counts, ICU availability, and ventilator status update dynamically. Absolutely no manual data entry required.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-6 group relative">
                <div className="flex-none w-12 h-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center font-bold text-gray-400 text-lg group-hover:scale-110 group-hover:border-green-400 group-hover:text-green-700 group-hover:bg-green-50 group-hover:shadow-[0_0_15px_rgba(187,247,208,0.5)] transition-all duration-300 z-10 relative">
                  3
                </div>
                <div className="pt-2 pb-4 group-hover:-translate-y-1 transition-transform duration-300">
                  <h4 className="text-2xl font-bold mb-2 text-gray-900 group-hover:text-[#1B4332] transition-colors">Coordinate the network</h4>
                  <p className="text-gray-500 leading-relaxed text-[15px]">Instantly visualize which nearby facilities can immediately safely accept your patient or provide the needed medical device.</p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-6 group relative">
                <div className="flex-none w-12 h-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center font-bold text-gray-400 text-lg group-hover:scale-110 group-hover:border-green-400 group-hover:text-green-700 group-hover:bg-green-50 group-hover:shadow-[0_0_15px_rgba(187,247,208,0.5)] transition-all duration-300 z-10 relative">
                  4
                </div>
                <div className="pt-2 pb-0 group-hover:-translate-y-1 transition-transform duration-300">
                  <h4 className="text-2xl font-bold mb-2 text-gray-900 group-hover:text-[#1B4332] transition-colors">Measure the impact</h4>
                  <p className="text-gray-500 leading-relaxed text-[15px]">Access deep-dive analytical reports detailing exact time saved, operational cost reductions, and ultimately, lives impacted.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative card-stack-container w-full max-w-lg mx-auto md:max-w-none mt-10 md:mt-0">
            {/* Background decorative element */}
            <div className="absolute inset-0 bg-[#E9EDC9] rounded-3xl rotate-3 scale-105 shadow-inner"></div>

            {/* Card 1 (Step 1) */}
            <div className="stacked-card bg-[#1B4332] p-8 rounded-3xl border border-white/10 text-white">
              <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                <span className="font-medium italic opacity-80">Step 01: Connect EMR</span>
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(96,165,250,0.5)]"></div>
              </div>
              <div className="space-y-4">
                <div className="h-4 bg-white/10 rounded w-3/4"></div>
                <div className="h-4 bg-white/10 rounded w-1/2"></div>
                <div className="h-20 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-white/50 text-xs italic tracking-widest uppercase mt-6">
                  [ HL7 FHIR Handshake ]
                </div>
              </div>
            </div>

            {/* Card 2 (Step 2) */}
            <div className="stacked-card bg-[#1B4332] p-8 rounded-3xl border border-white/10 text-white">
              <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                <span className="font-medium italic opacity-80">Step 02: Resource Sync</span>
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
              </div>
              <div className="space-y-4">
                <div className="h-4 bg-white/10 rounded w-2/3"></div>
                <div className="h-4 bg-white/10 rounded w-4/5"></div>
                <div className="h-20 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center justify-center gap-3 mt-6">
                  <span className="text-white/50 text-xs italic tracking-widest uppercase">[ API Connection Established ]</span>
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full delay-75"></span>
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full delay-150"></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3 (Step 3) */}
            <div className="stacked-card bg-[#1B4332] p-8 rounded-3xl border border-white/10 text-white">
              <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                <span className="font-medium italic opacity-80">Step 03: Network Match</span>
                <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.5)]"></div>
              </div>
              <div className="space-y-4 mt-6">
                <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
                  <span className="text-white/70 text-sm">Patient Transport</span>
                  <span className="text-amber-400 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                    <span className="w-2 h-2 bg-amber-400 rounded-full"></span> Matched
                  </span>
                </div>
                <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
                  <span className="text-white/70 text-sm">ICU Bed (H1)</span>
                  <span className="text-amber-400 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                    <span className="w-2 h-2 bg-amber-400 rounded-full"></span> Reserved
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4 (Step 4) */}
            <div className="stacked-card bg-[#1B4332] p-8 rounded-3xl border border-white/10 text-white">
              <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                <span className="font-medium italic opacity-80">Step 04: Analytics & Impact</span>
                <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(192,132,252,0.5)]"></div>
              </div>
              <div className="flex items-end gap-3 h-28 mt-4 pt-6 border-t border-transparent">
                <div className="flex-1 bg-white/10 rounded-t-lg h-[30%] hover:h-[40%] transition-all"></div>
                <div className="flex-1 bg-white/10 rounded-t-lg h-[50%] hover:h-[60%] transition-all"></div>
                <div className="flex-1 bg-white/10 rounded-t-lg h-[40%] hover:h-[50%] transition-all"></div>
                <div className="flex-1 bg-purple-400/60 rounded-t-lg h-full relative">
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-purple-300 text-xs font-bold whitespace-nowrap bg-purple-900/50 px-2 py-1 rounded">
                    +42% Saved
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== IMPACT / BY THE NUMBERS ===== */}
      <section id="impact" className="reveal bg-[#1B4332] text-white py-32 px-8 relative overflow-hidden">
        {/* Background accents */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[30%] -right-[10%] w-[70%] h-[70%] bg-green-500/10 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-[30%] -left-[10%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[100px]"></div>
          {/* Subtle dot grid */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-30"></div>
        </div>

        <div className="max-w-[1440px] mx-auto relative z-10">
          <div className="text-center mb-16 md:mb-24">
            <h2 className="text-4xl md:text-6xl font-black mb-6 hero-heading">System-Wide <span className="text-green-400 italic font-light">Impact.</span></h2>
            <p className="text-[#E9EDC9] text-xl opacity-80 max-w-2xl mx-auto leading-relaxed">Real numbers from our network of 200+ hospitals optimizing their operations with SANJIVNI.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Stat 1 */}
            <div className="relative group p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden hover:-translate-y-2 transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(74,222,128,0.2)]">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center mb-6 border border-green-500/30 text-green-400 group-hover:scale-110 transition-transform">
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><line x1="12" y1="22" x2="12" y2="12"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>
                </div>
                <div className="text-6xl md:text-7xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 group-hover:from-green-200 group-hover:to-green-400 transition-colors">
                  <span className="anim-counter" data-target="42" data-speed="1500">0</span>%
                </div>
                <div className="text-sm font-bold tracking-[0.2em] uppercase text-green-300 mb-3">Space Optimized</div>
                <p className="text-white/60 text-sm leading-relaxed">Increase in effective ICU capacity across top-tier partner networks.</p>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="relative group p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden hover:-translate-y-2 transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(96,165,250,0.2)]">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/30 text-blue-400 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div className="text-6xl md:text-7xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 group-hover:from-blue-200 group-hover:to-blue-400 transition-colors">
                  <span className="anim-counter" data-target="18" data-speed="1500">0</span><span className="text-4xl text-white/50">m</span>
                </div>
                <div className="text-sm font-bold tracking-[0.2em] uppercase text-blue-300 mb-3">Time Saved</div>
                <p className="text-white/60 text-sm leading-relaxed">Average reduction in critical patient door-to-door transfer times.</p>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="relative group p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden hover:-translate-y-2 transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(251,191,36,0.2)]">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/30 text-amber-400 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </div>
                <div className="text-6xl md:text-7xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 group-hover:from-amber-200 group-hover:to-amber-400 transition-colors">
                  <span className="text-5xl text-white/50">$</span><span className="anim-counter float-counter" data-target="2.4" data-speed="1500">0</span><span className="text-4xl tracking-normal text-white/50">M</span>
                </div>
                <div className="text-sm font-bold tracking-[0.2em] uppercase text-amber-300 mb-3">Cost Reduced</div>
                <p className="text-white/60 text-sm leading-relaxed">Annual savings via shared equipment marketplaces preventing rentals.</p>
              </div>
            </div>

            {/* Stat 4 */}
            <div className="relative group p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden hover:-translate-y-2 transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(192,132,252,0.2)]">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/30 text-purple-400 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94 a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <div className="text-6xl md:text-7xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 group-hover:from-purple-200 group-hover:to-purple-400 transition-colors">
                  <span className="anim-counter float-counter" data-target="99.9" data-speed="1500">0</span><span className="text-4xl text-white/50">%</span>
                </div>
                <div className="text-sm font-bold tracking-[0.2em] uppercase text-purple-300 mb-3">Accuracy & Uptime</div>
                <p className="text-white/60 text-sm leading-relaxed">Zero-trust architecture ensuring live, reliable data 24/7/365.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="testimonials" className="reveal max-w-[1440px] mx-auto px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl mb-4">Trusted by the Frontline</h2>
          <p className="text-gray-600">Real outcomes from the administrators and doctors using SANJIVNI daily.</p>
        </div>

        <div className="relative overflow-hidden -mx-8 px-8">
          {/* Left Fade */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-cream to-transparent z-10 pointer-events-none"></div>
          {/* Right Fade */}
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-cream to-transparent z-10 pointer-events-none"></div>

          <div className="testimonial-track py-4">
            {/* Render testimonials from backend */}
            {testimonials.length > 0 ? (
              testimonials.map((testimonial, idx) => (
                <div key={idx} className="testimonial-card-width bg-[#FDFCF7] p-8 rounded-2xl border border-black/5 flex flex-col justify-between hover:border-black/10 transition-colors shadow-sm">
                  <p className="text-[17px] italic text-[#1B4332] mb-8 leading-relaxed">"{testimonial.content || testimonial.message}"</p>
                  <div className="flex items-center gap-4">
                    <img src={testimonial.image || `https://i.pravatar.cc/100?u=${testimonial.id}`} className="w-12 h-12 rounded-full grayscale" alt={testimonial.author} />
                    <div>
                      <div className="font-bold text-sm">{testimonial.author || testimonial.name}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-tighter">{testimonial.role || testimonial.title}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              // Fallback hardcoded testimonials
              <>
                <div className="testimonial-card-width bg-[#FDFCF7] p-8 rounded-2xl border border-black/5 flex flex-col justify-between hover:border-black/10 transition-colors shadow-sm">
                  <p className="text-[17px] italic text-[#1B4332] mb-8 leading-relaxed">"SANJIVNI reduced our ER-to-ICU transfer time by 18 minutes. In cardiac cases, those minutes are the difference between recovery and loss."</p>
                  <div className="flex items-center gap-4">
                    <img src="https://i.pravatar.cc/100?u=dr1" className="w-12 h-12 rounded-full grayscale" alt="Dr. Sarah" />
                    <div>
                      <div className="font-bold text-sm">Dr. Sarah Chen</div>
                      <div className="text-xs text-gray-500 uppercase tracking-tighter">Chief of Surgery, St. Jude Medical</div>
                    </div>
                  </div>
                </div>
                <div className="testimonial-card-width bg-[#FDFCF7] p-8 rounded-2xl border border-black/5 flex flex-col justify-between hover:border-black/10 transition-colors shadow-sm">
                  <p className="text-[17px] italic text-[#1B4332] mb-8 leading-relaxed">"The equipment marketplace is a game changer. We sourced two ventilators from a neighboring clinic in under an hour during a peak surge."</p>
                  <div className="flex items-center gap-4">
                    <img src="https://i.pravatar.cc/100?u=admin1" className="w-12 h-12 rounded-full grayscale" alt="Admin" />
                    <div>
                      <div className="font-bold text-sm">James Miller</div>
                      <div className="text-xs text-gray-500 uppercase tracking-tighter">Hospital Administrator, Metro General</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section id="pricing" className="reveal bg-white py-24 px-8 border-t border-black/5">
        <div className="max-w-[1200px] mx-auto text-center">
          <h2 className="text-4xl mb-8">Transparent Pricing</h2>

          <div className="flex items-center justify-center gap-4 mb-16">
            <span className="text-sm font-medium text-gray-500">Monthly</span>
            <button id="priceToggle" className="w-14 h-7 bg-[#1B4332] rounded-full p-1 relative transition-all">
              <div id="toggleDot" className="w-5 h-5 bg-white rounded-full transition-all translate-x-0"></div>
            </button>
            <span className="text-sm font-medium text-[#1B4332]">Annual (Save 20%)</span>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-end">
            {pricing.length > 0 ? (
              pricing.map((plan, idx) => (
                <div key={idx} className={`p-8 rounded-3xl text-left ${plan.isPopular ? 'border-2 border-[#1B4332] bg-white shadow-2xl scale-110 z-10' : 'border border-gray-100 bg-[#FDFCF7]'}`}>
                  {plan.isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#1B4332] text-[#FDFCF7] text-[10px] px-4 py-1 rounded-full uppercase font-bold tracking-widest">Most Popular</div>
                  )}
                  <h4 className="font-bold mb-2">{plan.name}</h4>
                  <div className="text-3xl font-bold mb-6">${plan.price}<span className="text-sm font-normal text-gray-400">/mo</span></div>
                  <ul className="space-y-4 mb-8 text-sm" style={{ color: plan.isPopular ? '#1F2937' : '#4B5563' }}>
                    {(plan.features || []).map((feature, fidx) => (
                      <li key={fidx}>✓ {feature}</li>
                    ))}
                  </ul>
                  <button className={`w-full py-3 rounded-full font-semibold ${plan.isPopular ? 'bg-[#1B4332] text-white shadow-lg shadow-green-900/20' : 'border border-[#1B4332] text-[#1B4332]'}`}>
                    {plan.cta || 'Get Started'}
                  </button>
                </div>
              ))
            ) : (
              // Fallback hardcoded pricing
              <>
                <div className="p-8 border border-gray-100 rounded-3xl text-left bg-[#FDFCF7]">
                  <h4 className="font-bold mb-2">Starter</h4>
                  <div className="text-3xl font-bold mb-6">$499<span className="text-sm font-normal text-gray-400">/mo</span></div>
                  <ul className="space-y-4 mb-8 text-sm text-gray-600">
                    <li>✓ 1 Hospital Location</li>
                    <li>✓ Live Bed Tracking</li>
                    <li>✓ Basic Analytics</li>
                  </ul>
                  <button className="w-full py-3 rounded-full border border-[#1B4332] text-[#1B4332] font-semibold">Start Pilot</button>
                </div>

                <div className="p-8 border-2 border-[#1B4332] rounded-3xl text-left bg-white shadow-2xl relative scale-110 z-10">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#1B4332] text-[#FDFCF7] text-[10px] px-4 py-1 rounded-full uppercase font-bold tracking-widest">Most Popular</div>
                  <h4 className="font-bold mb-2">Network</h4>
                  <div className="text-4xl font-bold mb-6">$1,250<span className="text-sm font-normal text-gray-400">/mo</span></div>
                  <ul className="space-y-4 mb-8 text-sm text-gray-700">
                    <li>✓ Up to 20 Hospitals</li>
                    <li>✓ Equipment Marketplace</li>
                    <li>✓ AI Smart Matching</li>
                    <li>✓ 24/7 Priority Support</li>
                  </ul>
                  <button className="w-full py-4 rounded-full bg-[#1B4332] text-white font-bold shadow-lg shadow-green-900/20">Get Started</button>
                </div>

                <div className="p-8 border border-gray-100 rounded-3xl text-left bg-[#FDFCF7]">
                  <h4 className="font-bold mb-2">Enterprise</h4>
                  <div className="text-3xl font-bold mb-6">Custom</div>
                  <ul className="space-y-4 mb-8 text-sm text-gray-600">
                    <li>✓ Unlimited Facilities</li>
                    <li>✓ Government-level SLA</li>
                    <li>✓ On-premise Deployment</li>
                  </ul>
                  <button className="w-full py-3 rounded-full border border-[#1B4332] text-[#1B4332] font-semibold">Contact Sales</button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section id="faq" className="reveal max-w-4xl mx-auto px-8 py-24">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-[#E9EDC9] text-[#1B4332] text-xs font-bold tracking-widest uppercase mb-4">Support</span>
          <h2 className="text-4xl mb-4">Frequently Asked Questions</h2>
          <p className="text-gray-600">Everything you need to know about SANJIVNI</p>
        </div>

        <div className="space-y-4" id="faqContainer">
          {faqItems.length > 0 ? (
            faqItems.map((item, idx) => (
              <div key={idx} className="faq-item border border-black/5 rounded-2xl overflow-hidden bg-white">
                <button className="faq-toggle w-full text-left px-8 py-5 flex items-center justify-between">
                  <span className="font-semibold text-[#1B4332]">{item.question || item.title}</span>
                  <span className="faq-icon text-xl text-gray-400 transition-transform">+</span>
                </button>
                <div className="faq-answer px-8 pb-5 text-gray-600 text-sm leading-relaxed" style={{ display: 'none' }}>
                  {item.answer || item.content}
                </div>
              </div>
            ))
          ) : (
            // Fallback hardcoded FAQ
            <div className="faq-item border border-black/5 rounded-2xl overflow-hidden bg-white">
              <button className="faq-toggle w-full text-left px-8 py-5 flex items-center justify-between">
                <span className="font-semibold text-[#1B4332]">Is SANJIVNI HIPAA compliant?</span>
                <span className="faq-icon text-xl text-gray-400 transition-transform">+</span>
              </button>
              <div className="faq-answer px-8 pb-5 text-gray-600 text-sm leading-relaxed" style={{ display: 'none' }}>
                Absolutely. SANJIVNI is fully HIPAA compliant with end-to-end encryption.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#1B4332] text-white">
        <div className="max-w-[1440px] mx-auto px-8 py-16">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[#2D6A4F] rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">+</span>
                </div>
                <span className="text-xl font-bold">SANJIVNI</span>
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-6">Real-time healthcare resource coordination for hospitals, doctors, and emergency services.</p>
            </div>
            {/* Product */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-widest text-white/40 mb-6">Product</h4>
              <ul className="space-y-3 text-sm text-white/70">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
              </ul>
            </div>
            {/* Newsletter */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-widest text-white/40 mb-6">Stay Updated</h4>
              <p className="text-sm text-white/60 mb-4">Get the latest on healthcare coordination technology.</p>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); console.log('Subscribed'); }}>
                <input type="email" placeholder="you@email.com" className="flex-1 bg-white/10 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-white/30 transition" required />
                <button type="submit" className="bg-white text-[#1B4332] px-5 py-2.5 rounded-full text-sm font-bold hover:bg-[#E9EDC9] transition">→</button>
              </form>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/40">© 2026 SANJIVNI. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ===== BACK TO TOP ===== */}
      <button id="backToTop" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} title="Back to top">
        ↑
      </button>

      {/* ===== SIGN IN MODAL ===== */}
      <div id="signInModal" className="modal-overlay" style={{ display: 'none' }}>
        <div className="modal-container">
          <div className="modal-header">
            <button className="modal-close" onClick={() => console.log('Close Modal')}>&times;</button>
            <div className="modal-logo">+</div>
            <h2>Welcome Back</h2>
          </div>

          <form id="signInForm" onSubmit={handleSignIn}>
            <div className="form-group">
              <label htmlFor="signinEmail">Email Address</label>
              <input type="email" id="signinEmail" placeholder="you@hospital.org" required />
            </div>
            <div className="form-group">
              <label htmlFor="signinPassword">Password</label>
              <div className="password-wrapper">
                <input type="password" id="signinPassword" placeholder="Enter your password" required />
                <button type="button" className="password-toggle">👁</button>
              </div>
            </div>
            <button type="submit" className="btn-primary">Sign In →</button>
          </form>
        </div>
      </div>

    </>
  );
};

const AarohiCallForm = () => {
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    try {
      setLoading(true);
      setStatus('');
      const res = await fetch('http://127.0.0.1:8000/api/calls/user-agent/request/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), city: city.trim() || undefined }),
      });
      if (!res.ok) {
        setStatus('Something went wrong. Please try again.');
        return;
      }
      const data = await res.json();
      setStatus(`Aarohi is calling your number ${data.phone || phone.trim()}`);
    } catch {
      setStatus('Unable to reach the call service right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3 md:items-center">
      <div className="flex-1 flex flex-col md:flex-row gap-3">
        <input
          type="tel"
          placeholder="Your phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-green-200/60 outline-none"
          required
        />
        <input
          type="text"
          placeholder="City (optional)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-green-50 placeholder:text-green-200/50 outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="bg-[#E9EDC9] text-[#1B4332] px-6 py-2.5 rounded-2xl text-xs md:text-sm font-black tracking-[0.16em] uppercase shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {loading ? 'SCHEDULING...' : 'CALL ME NOW'}
      </button>
      {status && (
        <p className="md:col-span-2 text-[11px] text-green-100 font-medium mt-1">
          {status}
        </p>
      )}
    </form>
  );
};

export default LandingPage;