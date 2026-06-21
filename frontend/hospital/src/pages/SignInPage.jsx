import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Auth } from '../services/auth';
import { authConfig } from '../services/authConfig';
import { getEmailPlaceholder } from '../config/uiConfig';
import SanjivniLogo from '../components/SanjivniLogo';
import '../css/styles.css';

const SignInPage = () => {
  const navigate = useNavigate();
  const [currentRole, setCurrentRole] = useState('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  const handleRoleSwitch = (role) => {
    setCurrentRole(role);
    setError('');
  };

  // Fetch available roles from backend
  useEffect(() => {
    const fetchRoles = async () => {
      setRolesLoading(true);
      const result = await authConfig.getSigninRoles();
      if (result.success && result.data) {
        setRoles(result.data);
        // Set first role as default if current role not in list
        const roleIds = result.data.map(r => r.id || r);
        if (!roleIds.includes(currentRole)) {
          setCurrentRole(roleIds[0] || 'patient');
        }
      }
      setRolesLoading(false);
    };
    fetchRoles();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await Auth.signin(email, password, currentRole === 'patient' ? 'patient' : currentRole === 'ambulance' ? 'ambulance' : null);
    setLoading(false);
    if (!res.success) {
      setError(res.error === 'Role mismatch'
        ? `This account is not registered as a ${currentRole}.`
        : 'Identity verification failed. Please check your credentials.');
      return;
    }
    const user = res.user;
    const target = Auth.redirectPath(user.role);
    navigate(target);
  };

  return (
    <>
      <style>{`
        body { background-color: #FDFCF7; min-height: 100vh; display: flex; align-items: center; justify-content: center; overflow-x: hidden; position: relative; }
        .pulse-bg { position: fixed; inset: 0; pointer-events: none; z-index: 1; overflow: hidden; opacity: 0.4; }
        .pulse-circle { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); border: 1px solid #2D6A4F; border-radius: 50%; animation: pulse-out 12s linear infinite; }
        .pulse-circle:nth-child(2) { animation-delay: 4s; }
        .pulse-circle:nth-child(3) { animation-delay: 8s; }
        @keyframes pulse-out { 0% { width: 0; height: 0; opacity: 0.8; } 100% { width: 250vw; height: 250vw; opacity: 0; } }
        .signin-card { width: 100%; max-width: 540px; background: rgba(255,255,255,0.9); backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.5); border-radius: 48px; padding: 64px; position: relative; z-index: 10; box-shadow: 0 40px 100px -20px rgba(27,67,50,0.12), 0 0 0 1px rgba(27,67,50,0.05); animation: card-appear 0.8s cubic-bezier(0.23,1,0.32,1); }
        @keyframes card-appear { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .input-wrapper { position: relative; margin-bottom: 24px; }
        .input-field { width: 100%; background: #fff; border: 2px solid #F1F5F9; border-radius: 24px; padding: 20px 28px 20px 60px; font-size: 0.95rem; font-weight: 600; color: #1E293B; transition: all 0.3s ease; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); outline: none; box-sizing: border-box; }
        .input-field:focus { border-color: #2D6A4F; box-shadow: 0 0 0 4px rgba(45,106,79,0.1); }
        .field-icon { position: absolute; left: 24px; top: 50%; transform: translateY(-50%); font-size: 1.25rem; color: #94A3B8; }
        .input-label { display: block; margin-left: 20px; margin-bottom: 8px; font-size: 0.7rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #64748B; }
        .btn-premium { background: #1B4332; color: white; width: 100%; padding: 22px; border-radius: 24px; font-weight: 800; font-size: 1rem; letter-spacing: 0.02em; transition: all 0.4s cubic-bezier(0.23,1,0.32,1); box-shadow: 0 20px 40px -10px rgba(27,67,50,0.4); border: none; cursor: pointer; }
        .btn-premium:hover { transform: translateY(-4px); box-shadow: 0 30px 60px -12px rgba(27,67,50,0.5); background: #23513e; }
        .btn-premium:active { transform: translateY(0); }
        .blob-signin { position: fixed; width: 600px; height: 600px; background: #D8E2DC; filter: blur(120px); border-radius: 50%; z-index: 0; opacity: 0.5; }
        .role-btn { flex: 1; padding: 12px; font-size: 0.65rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; border-radius: 12px; transition: all 0.2s; cursor: pointer; border: none; }
        .role-btn.active { background: white; color: #1B4332; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .role-btn.inactive { background: transparent; color: #9CA3AF; }
      `}</style>

      <div className="blob-signin" style={{ top: '-200px', right: '-200px' }}></div>
      <div className="blob-signin" style={{ bottom: '-200px', left: '-200px' }}></div>
      <div className="pulse-bg">
        <div className="pulse-circle"></div>
        <div className="pulse-circle"></div>
        <div className="pulse-circle"></div>
      </div>

      <main className="signin-card" style={{ margin: '0 auto' }}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <SanjivniLogo size={44} />
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-3 hero-heading italic">Access Portal.</h1>
          <p className="text-gray-500 text-sm font-medium">Select your role to enter the network.</p>
        </div>

        {/* Role Switcher */}
        <div className="flex p-1.5 bg-gray-100 rounded-2xl mb-10">
          {rolesLoading ? (
            <div className="w-full text-center py-2 text-gray-500 text-sm">Loading roles...</div>
          ) : roles.length > 0 ? (
            roles.map(role => (
              <button
                key={role.id || role}
                type="button"
                onClick={() => handleRoleSwitch(role.id || role)}
                className={`role-btn ${currentRole === (role.id || role) ? 'active' : 'inactive'}`}
              >
                {role.label || role}
              </button>
            ))
          ) : (
            <>
              <button type="button" onClick={() => handleRoleSwitch('patient')} className={`role-btn ${currentRole === 'patient' ? 'active' : 'inactive'}`}>Patient</button>
              <button type="button" onClick={() => handleRoleSwitch('hospital')} className={`role-btn ${currentRole === 'hospital' ? 'active' : 'inactive'}`}>Hospital</button>
              <button type="button" onClick={() => handleRoleSwitch('ambulance')} className={`role-btn ${currentRole === 'ambulance' ? 'active' : 'inactive'}`}>Ambulance</button>
            </>
          )}
        </div>

        {/* Form */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="input-wrapper">
            <label className="input-label">Identity</label>
            <div className="relative">
              <input type="email" required placeholder={getEmailPlaceholder(currentRole)} className="input-field" value={email} onChange={e => setEmail(e.target.value)} />
              <span className="field-icon">📧</span>
            </div>
          </div>
          <div className="input-wrapper">
            <div className="flex justify-between items-center mb-2 px-5">
              <label className="text-[0.7rem] font-black text-gray-500 uppercase tracking-widest">Access Key</label>
              <a href="#" className="text-[0.7rem] font-bold text-[#1B4332] hover:underline uppercase tracking-tight">Forgot?</a>
            </div>
            <div className="relative">
              <input type="password" required placeholder="••••••••" className="input-field" value={password} onChange={e => setPassword(e.target.value)} />
              <span className="field-icon">🔒</span>
            </div>
          </div>

          <div className="flex items-center py-2 px-5 mb-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative w-6 h-6 border-2 border-gray-200 rounded-xl group-hover:border-[#1B4332] transition-colors overflow-hidden">
                <input type="checkbox" className="peer absolute inset-0 opacity-0 cursor-pointer" />
                <div className="absolute inset-0 bg-[#1B4332] items-center justify-center hidden peer-checked:flex text-white text-[10px]">✓</div>
              </div>
              <span className="text-sm text-gray-400 font-bold">Keep me authenticated</span>
            </label>
          </div>

          {error && <p className="text-red-500 text-sm text-center font-semibold">{error}</p>}

          <button type="submit" className="btn-premium" disabled={loading}>
            {loading ? 'Signing in...' : 'Enter Network Portal'}
          </button>
        </form>

        {(currentRole === 'patient' || currentRole === 'ambulance') && (
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-400 font-bold tracking-tight">
              New to the grid?{' '}
              <Link to="/signup" className="text-[#1B4332] font-black hover:underline ml-1 underline-offset-4">
                {currentRole === 'ambulance' ? 'Register as Ambulance Driver' : 'Register as Patient'}
              </Link>
            </p>
          </div>
        )}

        {/* Trust Section */}
        <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col items-center gap-4">
          <p className="text-[9px] text-gray-400 uppercase tracking-[0.4em] font-black">Secure Healthcare Infrastructure</p>
          <div className="flex gap-8 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500">
            <img src="https://upload.wikimedia.org/wikipedia/commons/b/b1/HIPAA_Logo.svg" alt="HIPAA" className="h-6" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[8px] font-black text-gray-900 uppercase">ISO 27001</span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default SignInPage;
