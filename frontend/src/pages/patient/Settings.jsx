import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, CreditCard, Lock, Pill, Bell, Smartphone,
  MessageCircle, MessageSquare, Moon, LogOut, Trash2,
  Loader2, Check, X, Eye, EyeOff,
  AlertTriangle, Crown,
} from 'lucide-react';
import {
  useSessions, useRevokeSession, useChangePassword,
  useCurrentSubscription,
  useNotificationPrefs, useUpdateNotificationPrefs,
  useAllPrescriptions,
} from '@/hooks/useSettings';
import { usePatientProfile, useUpdatePatientProfile } from '@/hooks/useUserProfile';

/* ── micro components ─────────────────────────────────────────────────────── */
const Toggle = ({ checked, onChange }) => (
  <label className="relative inline-flex items-center cursor-pointer shrink-0">
    <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
    <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
  </label>
);

const Spinner = () => <Loader2 className="w-4 h-4 animate-spin" />;

function Toast({ msg, ok }) {
  return (
    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
      className={`fixed top-6 right-6 z-[999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm text-white ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
      {ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}{msg}
    </motion.div>
  );
}

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="rounded-2xl bg-card border border-border/60 shadow-sm overflow-hidden">
    <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40 bg-secondary/20">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Icon className="w-4 h-4" /></div>
      <h3 className="font-bold text-base">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

/* ── SIDEBAR TABS ─────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'security',     icon: ShieldCheck, label: 'Account Security',  desc: 'Password & sessions' },
  { id: 'subscription', icon: CreditCard,  label: 'Subscription Plan', desc: 'Plans & billing' },
  { id: 'privacy',      icon: Lock,        label: 'Data Privacy',       desc: 'Notifications & consent' },
  { id: 'archives',     icon: Pill,        label: 'Medicine Archives',  desc: 'Full prescription history' },
];

/* ── TAB: Account Security ────────────────────────────────────────────────── */
function SecurityTab({ toast }) {
  const { data: sessions = [], isLoading } = useSessions();
  const revoke   = useRevokeSession();
  const changePwd = useChangePassword();
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handlePwd(e) {
    e.preventDefault();
    if (form.new_password !== form.confirm) { toast('Passwords do not match', false); return; }
    setSaving(true);
    try {
      await changePwd.mutateAsync({ old_password: form.old_password, new_password: form.new_password });
      toast('Password changed!', true);
      setForm({ old_password: '', new_password: '', confirm: '' });
    } catch (err) { toast(err?.message || 'Failed', false); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Change Password" icon={Lock}>
        <form onSubmit={handlePwd} className="flex flex-col gap-4 max-w-sm">
          {[
            { label: 'Current Password', key: 'old_password' },
            { label: 'New Password',     key: 'new_password' },
            { label: 'Confirm Password', key: 'confirm' },
          ].map((f, i) => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{f.label}</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} required
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 pr-10" />
                {i === 0 && (
                  <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="submit" disabled={saving}
            className="mt-2 flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-60">
            {saving ? <Spinner /> : <Lock className="w-4 h-4" />}Update Password
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Active Sessions" icon={Smartphone}>
        {isLoading ? <div className="flex items-center gap-2 text-muted-foreground text-sm"><Spinner />Loading…</div>
          : sessions.length === 0 ? <p className="text-sm text-muted-foreground">No other active sessions.</p>
          : <div className="flex flex-col gap-3">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/30">
                  <div>
                    <p className="font-bold text-sm">{s.device_name || s.device_type || 'Unknown device'}</p>
                    <p className="text-xs text-muted-foreground">{s.ip_address} · {new Date(s.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <button onClick={() => revoke.mutate(s.id)} disabled={revoke.isPending}
                    className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-all">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>}
      </SectionCard>
    </div>
  );
}

/* ── TAB: Subscription (read-only for patients) ───────────────────────────── */
function SubscriptionTab() {
  const { data: current, isLoading: lc } = useCurrentSubscription();

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Your Active Plan" icon={Crown}>
        {lc ? <Spinner /> : !current
          ? <p className="text-sm text-muted-foreground">No active subscription found.</p>
          : <div className="flex flex-col gap-3">
              <div className="flex items-center flex-wrap gap-3">
                <span className="px-4 py-2 rounded-xl bg-primary/10 text-primary font-black text-xl">{current.plan?.name}</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${current.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-yellow-500/10 text-yellow-600'}`}>{current.status}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                ₹{current.plan?.price_monthly}/mo · Expires: {current.expires_at ? new Date(current.expires_at).toLocaleDateString('en-IN') : 'Never'}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="p-3 rounded-xl bg-secondary/40 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Max Medications</p>
                  <p className="text-lg font-black text-foreground mt-1">{current.plan?.max_medications ?? '—'}</p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/40 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Max Caregivers</p>
                  <p className="text-lg font-black text-foreground mt-1">{current.plan?.max_caregivers ?? '—'}</p>
                </div>
              </div>
            </div>}
      </SectionCard>

      {/* Upgrade notice — only caregivers can manage plans */}
      <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300/50">
        <Crown className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Plan upgrades are managed by your caregiver</p>
          <p className="text-xs text-muted-foreground mt-1">
            To upgrade or change your subscription plan, please ask your caregiver to log in and manage the plan from their <strong>Settings → Subscription</strong> page.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── TAB: Data Privacy ────────────────────────────────────────────────────── */
function PrivacyTab({ toast }) {
  const { data: prefs, isLoading: isPrefsLoading } = useNotificationPrefs();
  const { data: patient, isLoading: isPatientLoading } = usePatientProfile();
  
  const updatePrefs = useUpdateNotificationPrefs();
  const updatePatient = useUpdatePatientProfile();
  
  const [local, setLocal] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { 
    if (prefs || patient) {
      setLocal({ ...prefs, is_travel_mode: patient?.is_travel_mode || false }); 
    }
  }, [prefs, patient]);

  async function handleSave() {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setSaving(true);
    try {
      await Promise.all([
        updatePrefs.mutateAsync({
          push_enabled: local.push_enabled,
          sms_enabled: local.sms_enabled,
          email_enabled: local.email_enabled,
          whatsapp_enabled: local.whatsapp_enabled,
          quiet_hours_start: local.quiet_hours_start || null,
          quiet_hours_end: local.quiet_hours_end || null,
          reminder_lead_mins: local.reminder_lead_mins,
        }),
        updatePatient.mutateAsync({
          is_travel_mode: local.is_travel_mode
        })
      ]);
      toast('Settings saved!', true);
    } catch (err) { toast(err?.message || 'Failed', false); }
    finally { setSaving(false); }
  }

  const notifRows = [
    { key: 'push_enabled',      icon: Smartphone,     label: 'Push Notifications', desc: 'Real-time device alerts' },
    { key: 'email_enabled',     icon: MessageSquare,  label: 'Email Alerts',        desc: 'Updates via email' },
    { key: 'sms_enabled',       icon: MessageSquare,  label: 'SMS Alerts',          desc: 'Text messages to your phone' },
    { key: 'whatsapp_enabled',  icon: MessageCircle,  label: 'WhatsApp Reminders',  desc: 'Dose reminders via WhatsApp' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Notification Channels" icon={Bell}>
        {isPrefsLoading || isPatientLoading ? <Spinner /> : (
          <div className="flex flex-col gap-1">
            {notifRows.map(r => (
              <div key={r.key} className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-primary"><r.icon className="w-4 h-4" /></div>
                  <div><p className="font-bold text-sm">{r.label}</p><p className="text-xs text-muted-foreground">{r.desc}</p></div>
                </div>
                <Toggle checked={!!local[r.key]} onChange={() => setLocal(p => ({ ...p, [r.key]: !p[r.key] }))} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="IoT Settings" icon={Zap}>
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20">
          <div>
            <p className="font-bold text-sm">Travel Mode</p>
            <p className="text-xs text-muted-foreground mt-1">When enabled, the physical pill dispenser will not alarm or dispense automatically.</p>
          </div>
          <Toggle checked={!!local.is_travel_mode} onChange={() => setLocal(p => ({ ...p, is_travel_mode: !p.is_travel_mode }))} />
        </div>
      </SectionCard>

      <SectionCard title="Quiet Hours" icon={Moon}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {[['quiet_hours_start','Start Time'],['quiet_hours_end','End Time']].map(([key, label]) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
                <input type="time" value={local[key]?.slice(0,5) || ''} onChange={e => setLocal(p => ({ ...p, [key]: e.target.value }))}
                  className="px-4 py-2.5 border border-border rounded-xl bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground">Reminder Lead (mins)</label>
            <input type="number" min={1} max={60} value={local.reminder_lead_mins || 5}
              onChange={e => setLocal(p => ({ ...p, reminder_lead_mins: +e.target.value }))}
              className="w-20 px-3 py-2 border border-border rounded-xl bg-background text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
      </SectionCard>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 w-fit px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-60">
        {saving ? <Spinner /> : <Check className="w-4 h-4" />}Save Privacy Settings
      </button>

      <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-destructive/20">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h3 className="font-bold text-destructive">Danger Zone</h3>
        </div>
        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-4">Permanently delete your account and all associated health data. This action cannot be undone.</p>
          <button onClick={() => toast('Contact support@aarogyam.in to delete your account.', false)}
            className="flex items-center gap-2 px-5 py-2.5 border-2 border-destructive text-destructive rounded-xl font-bold text-sm hover:bg-destructive/10 transition-all">
            <Trash2 className="w-4 h-4" />Request Account Deletion
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── TAB: Medicine Archives ───────────────────────────────────────────────── */
function ArchivesTab() {
  const { data: all = [], isLoading, isError } = useAllPrescriptions();
  const [filter, setFilter] = useState('all');

  const filtered = all.filter(rx => filter === 'all' ? true : filter === 'active' ? rx.is_active : !rx.is_active);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
        {['all','active','paused'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-5 py-2 rounded-lg text-sm font-bold capitalize transition-all ${filter === f ? 'bg-card shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Spinner />Loading prescriptions…</div>}
      {isError && <div className="flex items-center gap-2 text-destructive text-sm"><AlertTriangle className="w-4 h-4" />Could not load prescriptions.</div>}
      {!isLoading && !isError && filtered.length === 0 && (
        <div className="flex flex-col items-center py-20 text-muted-foreground gap-4">
          <Pill className="w-14 h-14 opacity-20" />
          <p className="font-medium">No medications found.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map(rx => (
          <div key={rx.id} className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-sm transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><Pill className="w-6 h-6" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-sm">{rx.medication?.name ?? 'Unknown Medication'}</h4>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${rx.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                  {rx.is_active ? 'Active' : 'Paused'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {rx.dosage_value} {rx.dosage_unit}
                {rx.start_date ? ` · Since ${rx.start_date.slice(0,10)}` : ''}
                {rx.prescribed_by ? ` · Dr. ${rx.prescribed_by}` : ''}
              </p>
              {rx.special_instructions && <p className="text-xs text-muted-foreground italic mt-1 truncate">{rx.special_instructions}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── MAIN ─────────────────────────────────────────────────────────────────── */
export default function Settings() {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  // Hide non-relevant tabs per role — doctors and caregivers see only the tabs that apply to them
  const visibleTabs = TABS.filter(t => {
    if (t.id === 'archives') return user?.role === 'PATIENT';
    return true;
  });

  const [active, setActive] = useState(() => {
    const tab = searchParams.get('tab');
    return tab && TABS.find(t => t.id === tab) ? tab : 'security';
  });
  const [toast, setToast]   = useState(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && visibleTabs.find(t => t.id === tab)) setActive(tab);
    else if (tab && !visibleTabs.find(t => t.id === tab)) setActive('security');
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(msg, ok) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const currentTab = visibleTabs.find(t => t.id === active);

  return (
    <div className="min-h-screen font-sans">
      <AnimatePresence>{toast && <Toast msg={toast.msg} ok={toast.ok} />}</AnimatePresence>


      {/* Content */}
      <main className="w-full">
        <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          <div className="mb-6">
            <h3 className="text-2xl font-display font-bold text-foreground">{currentTab?.label}</h3>
            <p className="text-sm text-muted-foreground mt-1">{currentTab?.desc}</p>
          </div>
          {active === 'security'     && <SecurityTab     toast={showToast} />}
          {active === 'subscription' && <SubscriptionTab />}
          {active === 'privacy'      && <PrivacyTab      toast={showToast} />}
          {active === 'archives'     && <ArchivesTab />}
        </motion.div>
      </main>
    </div>
  );
}
