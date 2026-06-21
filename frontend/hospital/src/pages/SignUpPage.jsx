import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Auth } from '../services/auth';
import { authConfig } from '../services/authConfig';
import { UI_CONFIG } from '../config/uiConfig';
import SanjivniLogo from '../components/SanjivniLogo';
import '../css/styles.css';

const SignUpPage = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [typedText, setTypedText] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    // Fetch available signup roles from backend
    const fetchRoles = async () => {
      setRolesLoading(true);
      const result = await authConfig.getSignupRoles();
      if (result.success && result.data) {
        setRoles(result.data);
      }
      setRolesLoading(false);
    };
    fetchRoles();
  }, []);

  useEffect(() => {
    // Typing animation effect with configurable text and speed
    let fullText = UI_CONFIG.SIGNUP_TYPING_TEXT;
    let i = 0;
    const timer = setInterval(() => {
      if (i < fullText.length) {
        setTypedText(t => t + fullText[i]);
        i++;
      } else {
        clearInterval(timer);
        setTypingDone(true);
      }
    }, UI_CONFIG.TYPING_SPEED_MS);
    return () => clearInterval(timer);
  }, []);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedRole) { setError('Please select your operational role.'); return; }
    if (form.password !== form.confirmPassword) { setError('Keys do not match!'); return; }
    setLoading(true);
    const payload = {
      full_name: form.name,
      email: form.email,
      password: form.password,
      password2: form.confirmPassword,
      role: selectedRole,
      ...(form.phone && { phone: form.phone }),
    };
    const res = await Auth.register(payload, true);
    setLoading(false);
    if (!res.success) { setError(res.error); return; }
    if (res.user) navigate(Auth.redirectPath(res.user.role));
    else navigate('/signin');
  };

  const showAmbulanceFields = selectedRole === 'ambulance';

  return (
    <>
      <style>{`
        body { background-color: #FDFCF7; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px 20px; overflow-x: hidden; }
        .pulse-bg { position: fixed; inset: 0; pointer-events: none; z-index: 1; overflow: hidden; opacity: 0.3; }
        .pulse-circle { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); border: 1px solid #2D6A4F; border-radius: 50%; animation: pulse-out 15s linear infinite; }
        .pulse-circle:nth-child(2) { animation-delay: 5s; }
        @keyframes pulse-out { 0% { width: 0; height: 0; opacity: 0.8; } 100% { width: 300vw; height: 300vw; opacity: 0; } }
        .signup-card { width: 100%; max-width: 960px; background: rgba(255,255,255,0.9); backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.5); border-radius: 48px; overflow: hidden; position: relative; z-index: 10; box-shadow: 0 50px 100px -20px rgba(27,67,50,0.08); display: flex; animation: card-appear 0.8s cubic-bezier(0.23,1,0.32,1); }
        @keyframes card-appear { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .signup-side { width: 35%; background: #1B4332; padding: 64px 48px; color: white; display: flex; flex-direction: column; justify-content: space-between; }
        .signup-form-area { flex: 1; padding: 64px 80px; max-height: 90vh; overflow-y: auto; }
        .signup-form-area::-webkit-scrollbar { width: 5px; }
        .signup-form-area::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .input-wrapper-su { position: relative; margin-bottom: 24px; }
        .input-label-su { display: block; margin-left: 20px; margin-bottom: 8px; font-size: 0.65rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #64748B; }
        .input-field-su { width: 100%; background: #fff; border: 2px solid #F1F5F9; border-radius: 20px; padding: 16px 24px 16px 54px; font-size: 0.9rem; font-weight: 600; color: #1E293B; transition: all 0.3s ease; outline: none; box-sizing: border-box; }
        .input-field-su:focus { border-color: #2D6A4F; box-shadow: 0 0 0 4px rgba(45,106,79,0.05); }
        .field-icon-su { position: absolute; left: 20px; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: #94A3B8; }
        .role-selector { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; margin-bottom: 40px; }
        .role-option { background: #fff; border: 2px solid #F1F5F9; border-radius: 24px; padding: 20px 10px; text-align: center; cursor: pointer; transition: all 0.3s cubic-bezier(0.23,1,0.32,1); }
        .role-option:hover { border-color: #E2E8F0; transform: translateY(-2px); }
        .role-option.selected { border-color: #2D6A4F; background: #F0FDF4; box-shadow: 0 10px 25px -10px rgba(27,67,50,0.2); }
        .btn-premium-su { background: #1B4332; color: white; width: 100%; padding: 20px; border-radius: 20px; font-weight: 800; font-size: 0.95rem; transition: all 0.4s ease; box-shadow: 0 20px 40px -10px rgba(27,67,50,0.3); border: none; cursor: pointer; }
        .btn-premium-su:hover { transform: translateY(-3px); box-shadow: 0 30px 60px -12px rgba(27,67,50,0.4); }
        .typing-cursor { display: inline-block; width: 3px; height: 1em; background-color: #9FE1CB; margin-left: 4px; vertical-align: middle; animation: blink 0.7s infinite; }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @media (max-width: 768px) { .signup-card { flex-direction: column; } .signup-side { width: 100%; padding: 40px; } .signup-form-area { padding: 40px; } }
      `}</style>

      <div className="pulse-bg"><div className="pulse-circle"></div><div className="pulse-circle"></div></div>

      <main className="signup-card" style={{ margin: '0 auto' }}>
        {/* Brand Sidebar */}
        <div className="signup-side">
          <div className="space-y-12">
            <div className="flex items-center gap-3">
              <SanjivniLogo size={42} />
            </div>
            <div className="space-y-6">
              <h2 className="text-4xl font-bold leading-tight hero-heading italic" style={{ color: '#EAF5EC', minHeight: '120px' }}>
                {typedText}<span className="typing-cursor"></span>
              </h2>
              <p className="text-green-100/60 leading-relaxed font-medium">Register your facility or profile to start syncing life-critical resources across the city dynamic.</p>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-green-200/40 mb-3">Enterprise Grade Security</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-200 font-bold">HIPAA Compliant</span>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="signup-form-area">
          <div className="max-w-xl mx-auto">
            <div className="mb-10">
              <h1 className="text-3xl font-black text-gray-900 hero-heading italic mb-2">Create Account</h1>
              <p className="text-gray-400 text-sm font-medium">Already registered? <Link to="/signin" className="text-[#1B4332] font-black hover:underline">Sign In</Link></p>
            </div>

            <form className="space-y-8" onSubmit={handleSubmit}>
              {/* Role Picker */}
              <div>
                <label className="input-label-su">Select Your Role</label>
                <div className="role-selector" style={{gridTemplateColumns: 'repeat(2, 1fr)'}}>
                  {rolesLoading ? (
                    <div className="col-span-2 text-center py-4 text-gray-500 text-sm">Loading roles...</div>
                  ) : roles.length > 0 ? (
                    roles.map(r => (
                      <div key={r.id} className={`role-option ${selectedRole === r.id ? 'selected' : ''}`} onClick={() => setSelectedRole(r.id)}>
                        <span className="block mb-1 text-2xl text-center">{r.icon}</span>
                        <span className="text-[10px] font-black uppercase text-gray-400">{r.label}</span>
                        <span className="block text-[9px] font-medium text-gray-300 mt-0.5">{r.desc}</span>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="role-option" onClick={() => setSelectedRole('public/patient')}>
                        <span className="block mb-1 text-2xl text-center">🧑‍🤝‍🧑</span>
                        <span className="text-[10px] font-black uppercase text-gray-400">Patient</span>
                        <span className="block text-[9px] font-medium text-gray-300 mt-0.5">Find hospitals & book beds</span>
                      </div>
                      <div className="role-option" onClick={() => setSelectedRole('ambulance')}>
                        <span className="block mb-1 text-2xl text-center">🚑</span>
                        <span className="text-[10px] font-black uppercase text-gray-400">Ambulance</span>
                        <span className="block text-[9px] font-medium text-gray-300 mt-0.5">Register as a driver</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Personal Info */}
              <div className="grid md:grid-cols-2 gap-x-8">
                <div className="input-wrapper-su">
                  <label className="input-label-su">Full Name</label>
                  <div className="relative">
                    <input type="text" name="name" required placeholder="Dr. John Doe" className="input-field-su" value={form.name} onChange={handleChange} />
                    <span className="field-icon-su">👤</span>
                  </div>
                </div>
                <div className="input-wrapper-su">
                  <label className="input-label-su">Work Email</label>
                  <div className="relative">
                    <input type="email" name="email" required placeholder="john@hospital.com" className="input-field-su" value={form.email} onChange={handleChange} />
                    <span className="field-icon-su">📧</span>
                  </div>
                </div>
              </div>

              {showAmbulanceFields && (
                <div className="space-y-8 pt-4 border-t border-gray-100">
                  <div className="input-wrapper-su">
                    <label className="input-label-su">Phone Number</label>
                    <div className="relative">
                      <input type="tel" name="phone" required placeholder="9876543210" className="input-field-su" value={form.phone} onChange={handleChange} />
                      <span className="field-icon-su">📱</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Password */}
              <div className="grid md:grid-cols-2 gap-x-8">
                <div className="input-wrapper-su">
                  <label className="input-label-su">Secure Key</label>
                  <div className="relative">
                    <input type="password" name="password" required placeholder="••••••••" className="input-field-su" value={form.password} onChange={handleChange} />
                    <span className="field-icon-su">🔒</span>
                  </div>
                </div>
                <div className="input-wrapper-su">
                  <label className="input-label-su">Confirm Key</label>
                  <div className="relative">
                    <input type="password" name="confirmPassword" required placeholder="••••••••" className="input-field-su" value={form.confirmPassword} onChange={handleChange} />
                    <span className="field-icon-su">🛡️</span>
                  </div>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}

              <div className="pt-6">
                <button type="submit" className="btn-premium-su" disabled={loading}>
                  {loading ? 'Initializing...' : 'Initialize Grid Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
};

export default SignUpPage;
