import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../services/auth';
import { apiFetch } from '../services/api';
import { dashboardConfig } from '../services/dashboardConfig';
import SanjivniLogo from '../components/SanjivniLogo';
import './dashboard.css';

// ===== Default role configs (fallback) - can be customized backend =====
const DEFAULT_ROLE_CONFIG = {
  icon: '🏥',
  label: 'Dashboard',
  title: 'Dashboard',
  navItems: [
    { icon: '📊', label: 'Overview', active: true },
  ],
  metrics: [],
  mapTitle: 'Overview',
  mapBadge: 'Live',
  markers: [],
  legend: [],
  alerts: [],
  bottomPanels: [],
};

// Role mapping from auth roles to dashboard config keys
const roleMap = {
  'admin': 'hospital-admin',
  'hospital-admin': 'hospital-admin',
  'doctor': 'doctor',
  'supervisor': 'coordinator',
  'dispatcher': 'dispatcher',
  'patient': 'doctor', // fallback
};

// Status badge renderer
const StatusBadge = ({ value }) => {
  if (!value || !value.includes(':')) return <span>{value}</span>;
  const [cls, label] = value.split(':');
  return <span className={`status-badge ${cls}`}>{label}</span>;
};

// Render panel body
const PanelBody = ({ panel, onAction }) => {
  if (panel.type === 'table') {
    return (
      <table className="data-table">
        <thead><tr>{panel.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{panel.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}><StatusBadge value={cell} /></td>)}</tr>)}</tbody>
      </table>
    );
  }
  if (panel.type === 'stats') {
    return (
      <ul className="quick-stat-list">
        {panel.items.map(item => (
          <li key={item.label} className="quick-stat-item">
            <div className="stat-left">
              <div className="stat-icon" style={{ background: item.bg }}>{item.icon}</div>
              <span className="stat-label">{item.label}</span>
            </div>
            <span className="stat-value">{item.value}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (panel.type === 'actions') {
    return (
      <div style={{ display: 'grid', gap: '10px', padding: '4px 0' }}>
        {panel.actions.map(a => (
          <button key={a.label} className={`action-btn ${a.style}`} onClick={() => onAction(a.label)}>
            <span>{a.icon}</span> {a.label}
          </button>
        ))}
      </div>
    );
  }
  return null;
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const user = Auth.user;
  const session = (() => { try { return JSON.parse(localStorage.getItem('medgrid_session') || 'null'); } catch { return null; } })();

  useEffect(() => {
    if (!user && !session) {
      navigate('/');
    }
  }, []);

  const ROLE = session?.role || user?.role || 'hospital-admin';
  const USER_NAME = session?.name || user?.name || 'User';
  const userHospitalId = session?.hospital || user?.hospital || null;

  // State for dashboard config (fetched from backend)
  const [config, setConfig] = useState(DEFAULT_ROLE_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);

  const [metrics, setMetrics] = useState([]);
  const [mapMeta, setMapMeta] = useState({ title: 'Loading...', badge: 'Live' });
  const [alerts, setAlerts] = useState([]);
  const [bottomPanels, setBottomPanels] = useState([]);
  const [gridHospitals, setGridHospitals] = useState([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [gridError, setGridError] = useState('');

  const [time, setTime] = useState('');
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });

  // Fetch dashboard configuration from backend
  useEffect(() => {
    const fetchConfig = async () => {
      setConfigLoading(true);
      try {
        const result = await dashboardConfig.getConfig(ROLE, userHospitalId);
        if (result.success && result.data) {
          setConfig(result.data);
        } else {
          setConfig(DEFAULT_ROLE_CONFIG);
        }
      } catch (error) {
        console.error('Error fetching dashboard config:', error);
        setConfig(DEFAULT_ROLE_CONFIG);
      }
      setConfigLoading(false);
    };
    fetchConfig();
  }, [ROLE, userHospitalId]);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setPageLoading(true);
      try {
        // Fetch metrics from backend
        const metricsResult = await dashboardConfig.getMetrics(ROLE, userHospitalId);
        if (metricsResult.success && metricsResult.data) {
          setMetrics(Array.isArray(metricsResult.data) ? metricsResult.data : metricsResult.data.metrics || []);
        }

        // Fetch alerts from backend
        const alertsResult = await dashboardConfig.getAlerts(ROLE, userHospitalId);
        if (alertsResult.success && alertsResult.data) {
          setAlerts(Array.isArray(alertsResult.data) ? alertsResult.data : []);
        }

        // Update map metadata from config
        if (config.mapTitle && config.mapBadge) {
          setMapMeta({ title: config.mapTitle, badge: config.mapBadge });
        }

        // Use config bottom panels if available
        if (config.bottomPanels && config.bottomPanels.length > 0) {
          setBottomPanels(config.bottomPanels);
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setPageLoading(false);
      }
    };
    fetchAnalytics();
  }, [ROLE, userHospitalId, config.mapTitle, config.mapBadge, config.bottomPanels]);

  // Public "Real-Time Grid" hospitals list for dashboard
  useEffect(() => {
    const fetchGridHospitals = async () => {
      setGridLoading(true);
      setGridError('');
      try {
        const city = (configKey === 'coordinator' || configKey === 'dispatcher') ? 'Indore' : 'Bhopal';
        const res = await apiFetch(`/api/hospitals/search/?city=${encodeURIComponent(city)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || 'Failed to load hospitals');
        const list = Array.isArray(data) ? data : data.results || [];

        // attach live bed availability (Redis TTL)
        const enriched = await Promise.all(list.slice(0, 12).map(async (h) => {
          try {
            const bedsRes = await apiFetch(`/api/beds/availability/${h.id}/`);
            if (bedsRes.ok) {
              const beds = await bedsRes.json();
              return { ...h, bed_snapshot: beds };
            }
          } catch {}
          return { ...h, bed_snapshot: null };
        }));
        setGridHospitals(enriched);
      } catch (e) {
        setGridHospitals([]);
        setGridError(e.message || 'Failed to load grid hospitals');
      }
      setGridLoading(false);
    };
    fetchGridHospitals();
  }, [configKey]);

  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3500);
  }, []);

  const handleAction = (action) => {
    if (action === 'Activate Emergency Mode') {
      setEmergencyActive(v => {
        showToast(!v ? '🚨 Emergency Mode ACTIVATED' : 'Emergency Mode deactivated');
        return !v;
      });
    } else {
      showToast(`${action} — Feature coming soon`);
    }
  };

  const handleLogout = async () => {
    await Auth.logout();
    navigate('/');
  };

  if (pageLoading) {
    return (
      <div className="dashboard-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loader-pulse">
            <div style={{ width: 60, height: 60, margin: '0 auto 20px' }}><SanjivniLogo size={60} showWordmark={false} /></div>
          </div>
          <h2 style={{ color: '#1B4332', fontStyle: 'italic', fontWeight: 900 }}>Synchronizing Grid Analytics...</h2>
          <p style={{ color: '#64748b', fontSize: 13, fontWeight: 600, marginTop: 8 }}>Securing your session and fetching live metrics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {emergencyActive && <div className="emergency-banner active">⚠️ EMERGENCY MODE ACTIVE — All units on high alert</div>}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <SanjivniLogo size={38} />
          <span>SANJIVNI</span>
        </div>
        <div className="sidebar-role">
          <span className="role-emoji">{config.icon}</span>
          <div className="role-info">
            <div className="role-name">{config.label}</div>
            <div className="role-user">{USER_NAME}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {config.navItems.map(item => (
            <a key={item.label} className={`nav-item ${item.active ? 'active' : ''}`} href="#">
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1>{config.title}</h1>
            <div className="live-badge">
              <div className="live-dot"></div>
              LIVE
            </div>
          </div>
          <div className="topbar-right">
            <span className="topbar-time">{time}</span>
            <button className="topbar-btn" title="Notifications">🔔<span className="notif-dot"></span></button>
            <button className="topbar-btn" title="Settings">⚙️</button>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="dashboard-body">
          {/* Metrics Row */}
          <div className="metrics-row">
            {metrics.map(m => (
              <div key={m.label} className="metric-card">
                <div className="metric-icon">{m.icon}</div>
                <div className="metric-label">{m.label}</div>
                <div className="metric-value">{m.value}</div>
                <div className="metric-subtext">{m.subtext}</div>
                <div className={`metric-trend ${m.trend}`}>{m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→'} {m.trendText}</div>
              </div>
            ))}
          </div>

          {/* Main Grid */}
          <div className="main-grid">
            {/* Map Panel */}
            <div className="panel map-panel">
              <div className="panel-header">
                <h3>{mapMeta.title}</h3>
                <span className="panel-badge">{mapMeta.badge}</span>
              </div>
              <div className="panel-body">
                <div className="map-container">
                  <div className="map-grid"></div>
                  {config.markers.map(m => (
                    <div key={m.label} className="map-marker" style={{ top: m.top, left: m.left }}>
                      <div className={`marker-dot ${m.type}`}>{m.icon}</div>
                      <span className="marker-label">{m.label}</span>
                    </div>
                  ))}
                  <div className="map-legend">
                    {config.legend.map(l => (
                      <div key={l.label} className="legend-item">
                        <div className="legend-dot" style={{ background: l.color }}></div>
                        {l.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Real-Time Grid (public hospitals API) */}
                <div style={{ marginTop: 14, padding: 12, background: '#fff', borderRadius: 14, border: '1px solid rgba(27,67,50,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#1B4332' }}>Real-Time Grid</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                        Synced hospitals in your current geographic cluster.
                      </div>
                    </div>
                    <button
                      className="action-btn outline"
                      onClick={() => window.location.reload()}
                      title="Refresh grid list"
                      style={{ padding: '8px 10px' }}
                    >
                      🔄 Refresh
                    </button>
                  </div>

                  {gridLoading && <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Loading hospitals…</div>}
                  {!gridLoading && gridError && <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700 }}>{gridError}</div>}
                  {!gridLoading && !gridError && (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {gridHospitals.map((h) => {
                        const snap = h.bed_snapshot;
                        const available = snap?.available_beds ?? h.available_beds ?? 0;
                        const total = snap?.total_beds ?? h.total_beds ?? 0;
                        const icuAvail = snap?.by_type?.icu?.available ?? 0;
                        const badgeBg = available > 0 ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)';
                        const badgeFg = available > 0 ? '#16a34a' : '#dc2626';
                        return (
                          <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 12, border: '1px solid rgba(2,6,23,0.06)' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                🏥 {h.name}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
                                {h.city || ''}{h.category ? ` · ${h.category}` : ''}{icuAvail ? ` · ICU ${icuAvail}` : ''}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              <div style={{ padding: '6px 10px', borderRadius: 999, background: badgeBg, color: badgeFg, fontSize: 11, fontWeight: 900 }}>
                                {available}/{total} beds
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {gridHospitals.length === 0 && (
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>No hospitals found for this cluster.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Alerts Panel */}
            <div className="panel alerts-panel">
              <div className="panel-header">
                <h3>Alerts & Activity</h3>
                <span className="panel-badge">{alerts.length} Active</span>
              </div>
              <div className="panel-body">
                {alerts.map((a, i) => (
                  <div key={i} className={`alert-item ${a.type}`}>
                    <div className="alert-title">{a.title}</div>
                    <div className="alert-desc">{a.desc}</div>
                    <div className="alert-time">{a.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Panels */}
          <div className="bottom-grid">
            {bottomPanels.map((p, i) => (
              <div key={i} className="panel">
                <div className="panel-header">
                  <h3>{p.title}</h3>
                  {p.badge && <span className="panel-badge">{p.badge}</span>}
                </div>
                <div className="panel-body">
                  <PanelBody panel={p} onAction={handleAction} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast success ${toast.show ? 'show' : ''}`}>{toast.message}</div>
    </div>
  );
};

export default DashboardPage;
