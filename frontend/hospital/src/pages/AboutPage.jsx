import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { aboutPageConfig } from '../services/aboutPageConfig';
import '../css/styles.css';

const AboutPage = () => {
  // State for backend-fetched content
  const [team, setTeam] = useState([]);
  const [companyInfo, setCompanyInfo] = useState({ founded: 2024, uptime: 99.9 });
  const [values, setValues] = useState([]);
  const [stats, setStats] = useState({ uptime: 99.9, hospitals: 200, transfers: 50000 });
  const [contentLoading, setContentLoading] = useState(true);

  // Fetch about page content from backend
  useEffect(() => {
    const fetchContent = async () => {
      setContentLoading(true);
      try {
        const [teamRes, infoRes, valuesRes, statsRes] = await Promise.all([
          aboutPageConfig.getTeam(),
          aboutPageConfig.getCompanyInfo(),
          aboutPageConfig.getValues(),
          aboutPageConfig.getStats(),
        ]);

        if (teamRes.success && teamRes.data.length > 0) setTeam(teamRes.data);
        if (infoRes.success && infoRes.data) setCompanyInfo(infoRes.data);
        if (valuesRes.success && valuesRes.data.length > 0) setValues(valuesRes.data);
        if (statsRes.success && statsRes.data) setStats(statsRes.data);
      } catch (error) {
        console.error('Error fetching about page content:', error);
      } finally {
        setContentLoading(false);
      }
    };
    fetchContent();
  }, []);

  useEffect(() => {
    // Scroll reveal
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    return () => revealObserver.disconnect();
  }, []);

  return (
    <>
      {/* Inline styles specific to about page */}
      <style>{`
        body { background-color: #FDFCF7; }
        .team-card { background: white; border-radius: 32px; overflow: hidden; transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1); border: 1px solid rgba(27,67,50,0.05); }
        .team-card:hover { transform: translateY(-12px); box-shadow: 0 40px 80px -20px rgba(27,67,50,0.15); }
        .member-photo { width: 100%; aspect-ratio: 1/1; object-fit: cover; filter: grayscale(100%); transition: filter 0.5s ease; }
        .team-card:hover .member-photo { filter: grayscale(0%); }
        .hero-accent-about { color: #2D6A4F; position: relative; display: inline-block; }
        .hero-accent-about::after { content: ''; position: absolute; bottom: 10px; left: 0; width: 100%; height: 20px; background: #9FE1CB; z-index: -1; opacity: 0.3; transform: skewX(-15deg); }
        .blob-bg-about { position: absolute; width: 600px; height: 600px; background: radial-gradient(circle, rgba(74,222,128,0.15) 0%, transparent 70%); z-index: -1; filter: blur(60px); animation: blob-float 20s infinite alternate; }
        @keyframes blob-float { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(50px,30px) scale(1.1); } }
        .hero-float { animation: float 5s ease-in-out infinite; }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
        .reveal { opacity: 0; transform: translateY(30px); transition: all 0.8s cubic-bezier(0.23,1,0.32,1); }
        .reveal.visible { opacity: 1; transform: translateY(0); }
      `}</style>

      {/* Navbar */}
      <nav id="navbar" className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-[1440px] z-50 bg-[#FDFCF7]/85 backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] px-4 py-3 rounded-full flex items-center justify-between transition-all duration-300">
        <div className="flex items-center gap-3 pl-2">
          <div className="w-10 h-10 bg-[#2D6A4F] rounded-full flex items-center justify-center shadow-lg shadow-[#2D6A4F]/20">
            <span className="text-white font-bold text-lg">+</span>
          </div>
          <span className="text-xl font-bold text-[#1B4332] tracking-tight">SANJIVNI</span>
        </div>
        <div className="hidden lg:flex items-center gap-1 bg-black/5 p-1 rounded-full border border-white/60 shadow-inner">
          <Link to="/" className="px-5 py-2 rounded-full text-sm font-semibold text-gray-700 hover:text-[#1B4332] hover:bg-white hover:shadow-sm transition-all">Home</Link>
          <Link to="/about" className="px-5 py-2 rounded-full text-sm font-semibold text-[#1B4332] bg-white shadow-sm transition-all">About</Link>
          <a href="/#features" className="px-5 py-2 rounded-full text-sm font-semibold text-gray-700 hover:text-[#1B4332] hover:bg-white hover:shadow-sm transition-all">Features</a>
          <a href="/#hospital-search" className="px-5 py-2 rounded-full text-sm font-semibold text-gray-700 hover:text-[#1B4332] hover:bg-white hover:shadow-sm transition-all">Find Care</a>
        </div>
        <div className="flex items-center gap-2 pr-1">
          <Link to="/signin" className="text-sm font-bold text-gray-700 hover:text-[#1B4332] px-4 py-2.5 rounded-full hover:bg-black/5 transition-colors">Sign in</Link>
          <Link to="/signup" className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white px-7 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-[#1B4332]/25 hover:shadow-[#1B4332]/40 hover:-translate-y-0.5 transition-all">Request demo</Link>
        </div>
      </nav>

      <main className="pt-40">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-8 relative mb-20 reveal">
          <div className="blob-bg-about" style={{ top: '-160px', left: '-80px', opacity: 0.4 }}></div>
          <div className="blob-bg-about" style={{ top: '160px', right: '-80px', opacity: 0.3, animationDelay: '-5s' }}></div>
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <div>
              <span className="inline-block px-4 py-1.5 bg-[#E9EDC9] text-[#1B4332] rounded-full text-[10px] font-black uppercase tracking-widest mb-8">Established {companyInfo.founded}</span>
              <h1 className="text-6xl md:text-8xl font-black hero-heading leading-[0.9] mb-10">
                The heartbeat of <br /><span className="hero-accent-about">medical agility.</span>
              </h1>
              <p className="text-xl text-gray-500 leading-relaxed font-medium mb-12 max-w-xl">
                SANJIVNI was founded on a single premise: in a crisis, time is the only resource that cannot be replenished. Our platform connects hospitals, ambulances, and patients in a living network of life-critical data.
              </p>
              <div className="flex gap-4">
                <button className="bg-[#1B4332] text-white px-10 py-5 rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-xl">Join the Network</button>
              </div>
            </div>
            <div className="relative hero-float">
              <img src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800" alt="SANJIVNI Technology" className="rounded-[40px] shadow-[0_40px_80px_-20px_rgba(27,67,50,0.3)] border border-white/50" />
              <div className="absolute -bottom-10 -left-10 bg-white p-6 rounded-[32px] shadow-2xl border border-gray-100 animate-[float_4s_ease-in-out_infinite]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-bold">{stats.uptime}%</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-400">Reliability</p>
                    <p className="text-sm font-black text-[#1B4332]">System Uptime</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="bg-[#1B4332] py-32 mb-32 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="text-center mb-20">
              <h2 className="text-4xl text-white hero-heading italic mb-4">Why we do it.</h2>
              <div className="w-24 h-1 bg-green-400 mx-auto rounded-full"></div>
            </div>
            <div className="grid md:grid-cols-3 gap-12">
              <div className="bg-white/5 border border-white/10 p-10 rounded-[32px] backdrop-blur-sm">
                <div className="text-3xl mb-6">⏱️</div>
                <h3 className="text-xl text-white font-bold mb-4 italic">Zero Latency</h3>
                <p className="text-green-100/60 leading-relaxed">Reducing the gap between a medical emergency and professional care through real-time resource tracking.</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-10 rounded-[32px] backdrop-blur-sm">
                <div className="text-3xl mb-6">🤝</div>
                <h3 className="text-xl text-white font-bold mb-4 italic">Coordinated Care</h3>
                <p className="text-green-100/60 leading-relaxed">Breaking hospital silos to ensure patients are routed to the nearest facility with exact matching capabilities.</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-10 rounded-[32px] backdrop-blur-sm">
                <div className="text-3xl mb-6">🛡️</div>
                <h3 className="text-xl text-white font-bold mb-4 italic">Platform Integrity</h3>
                <p className="text-green-100/60 leading-relaxed">Ensuring every byte of data on the grid is verified, secured, and ready to save a life.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="max-w-[1440px] mx-auto px-8 py-20 bg-white rounded-[64px] shadow-sm mb-32 reveal">
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
            <div className="max-w-2xl">
              <h2 className="text-5xl font-black hero-heading italic mb-6 leading-tight">Behind the Grid.</h2>
              <p className="text-xl text-gray-400 font-medium">Meet the architects ensuring Bhopal's medical resources are always in sync.</p>
            </div>
            <span className="px-6 py-3 bg-gray-50 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-gray-100">Core Engineering Unit</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.length > 0 ? (
              team.map(member => (
                <div key={member.id || member.name} className="bg-white rounded-[40px] border border-gray-100 overflow-hidden group hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 flex flex-col h-full">
                  <div className="relative h-64 overflow-hidden">
                    <img src={member.image || member.img || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400'} alt={member.name} className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                  <div className="p-8">
                    <p className="text-[10px] font-black text-[#2D6A4F] uppercase tracking-[0.2em] mb-2">{member.role || member.title}</p>
                    <h3 className="text-2xl font-black text-[#1B4332] hero-heading mb-4">{member.name}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{member.description || member.desc}</p>
                  </div>
                </div>
              ))
            ) : (
              // Fallback hardcoded team
              [
                { name: 'Arjun Varma', role: 'Founder & Lead Architect', desc: 'Pioneering the logic of distributed medical emergency response.', img: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400' },
                { name: 'Sara Khan', role: 'CTO & Data Strategist', desc: 'Ensuring zero-latency sync across 500+ active resource points.', img: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400' },
                { name: 'Rohan Mehta', role: 'Ops & Logistics', desc: 'Bridging the gap between the digital grid and physical response.', img: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400' },
                { name: 'Anya Singh', role: 'Lead Product Designer', desc: 'Crafting intuitive interfaces for high-stress medical environments.', img: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400' },
              ].map(member => (
                <div key={member.name} className="bg-white rounded-[40px] border border-gray-100 overflow-hidden group hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 flex flex-col h-full">
                  <div className="relative h-64 overflow-hidden">
                    <img src={member.img} alt={member.name} className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                  <div className="p-8">
                    <p className="text-[10px] font-black text-[#2D6A4F] uppercase tracking-[0.2em] mb-2">{member.role}</p>
                    <h3 className="text-2xl font-black text-[#1B4332] hero-heading mb-4">{member.name}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{member.desc}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#1B4332] text-white py-20">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-20 border-b border-white/10 pb-20">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#2D6A4F] rounded-full flex items-center justify-center"><span className="text-white font-bold">+</span></div>
                <span className="text-2xl font-bold tracking-tight">SANJIVNI</span>
              </div>
              <p className="text-green-100/60 leading-relaxed text-sm max-w-xs">Real-time healthcare resource coordination for hospitals, doctors, and emergency services.</p>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-8">Navigation</h4>
              <ul className="space-y-4 text-sm font-bold text-green-100/80">
                <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
                <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><a href="/#features" className="hover:text-white transition-colors">Features</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-8">Support</h4>
              <ul className="space-y-4 text-sm font-bold text-green-100/80">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Knowledge Base</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-8">Stay Updated</h4>
              <p className="text-sm text-green-100/60 mb-6">Join 400+ administrators subscribed to our network updates.</p>
              <div className="flex gap-2">
                <input type="email" placeholder="you@hospital.org" className="bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm flex-1 outline-none focus:border-white/30 transition-all" />
                <button className="bg-[#E9EDC9] text-[#1B4332] w-12 h-12 rounded-full flex items-center justify-center font-bold">→</button>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            <p>© 2026 SANJIVNI. All Rights Reserved.</p>
            <div className="flex gap-10">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">HIPAA</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default AboutPage;
