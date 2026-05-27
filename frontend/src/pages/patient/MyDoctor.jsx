import { useState } from 'react';
import {
  Stethoscope, Search, MessageCircle, CheckCircle2, XCircle,
  Loader2, Pill, AlertCircle, MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  useAllDoctors,
  useConsultations,
  useRequestConsultation,
  useMyDoctorPrescriptions,
  useRespondToPrescription,
} from '@/hooks/useDoctorConsultation';
import DoctorChatRoom from '@/components/doctor/DoctorChatRoom';

const STATUS_BADGE = {
  REQUESTED: { variant: 'warning', label: 'Awaiting Doctor' },
  ACCEPTED:  { variant: 'primary', label: 'Accepted' },
  ACTIVE:    { variant: 'success', label: 'Active' },
  COMPLETED: { variant: 'secondary', label: 'Completed' },
  REJECTED:  { variant: 'danger', label: 'Rejected' },
};

// ─── Doctor card (Find Doctor tab) ───────────────────────────────────────────
function DoctorCard({ doctor, onRequest, isPending }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="p-6 rounded-[1.5rem] border border-border/50 bg-card shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-display font-black text-2xl flex-shrink-0">
          {(doctor.user_name || 'Dr')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-foreground text-lg truncate">{doctor.user_name || `Dr. ${doctor.registration_number}`}</h4>
          <p className="text-sm text-primary font-semibold">{doctor.specialization || 'General Physician'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{doctor.hospital_name || 'Private Practice'}</p>
        </div>
        <Badge variant="success" className="h-5 px-2 text-[9px] font-black uppercase flex-shrink-0">Verified</Badge>
      </div>
      <Button
        className="w-full h-10 rounded-xl text-xs font-black uppercase tracking-wider"
        onClick={() => onRequest(doctor.id)}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageCircle className="w-4 h-4 mr-2" />}
        Request Consultation
      </Button>
    </motion.div>
  );
}

// ─── Prescription card ────────────────────────────────────────────────────────
function PrescriptionCard({ rx, onRespond, isPending }) {
  const isAccepted = rx.is_accepted === true;
  const isRejected = rx.is_accepted === false;
  const isPending2 = rx.is_accepted === null || rx.is_accepted === undefined;

  return (
    <div className="p-5 rounded-2xl border border-border/50 bg-card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-foreground">{rx.medication_name || 'Medication'}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            From <span className="font-semibold text-foreground">{rx.doctor_name || 'Doctor'}</span>
            {rx.created_at && ` · ${new Date(rx.created_at).toLocaleDateString()}`}
          </p>
        </div>
        {isAccepted && <Badge variant="success"  className="h-5 px-2 text-[9px] font-black uppercase">Accepted</Badge>}
        {isRejected && <Badge variant="danger"   className="h-5 px-2 text-[9px] font-black uppercase">Rejected</Badge>}
        {isPending2 && <Badge variant="warning"  className="h-5 px-2 text-[9px] font-black uppercase">Pending</Badge>}
      </div>
      {rx.dosage       && <p className="text-sm text-muted-foreground">Dosage: <span className="font-semibold text-foreground">{rx.dosage}</span></p>}
      {rx.instructions && <p className="text-sm text-muted-foreground italic">"{rx.instructions}"</p>}
      {isPending2 && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1 h-9 rounded-xl text-xs font-black" onClick={() => onRespond({ prescriptionId: rx.id, accepted: true })} disabled={isPending}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Accept
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-9 rounded-xl text-xs font-black border-destructive/40 text-destructive hover:bg-destructive/5" onClick={() => onRespond({ prescriptionId: rx.id, accepted: false })} disabled={isPending}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Session list item ────────────────────────────────────────────────────────
function SessionItem({ session, isActive: isSelected, onClick }) {
  const badge     = STATUS_BADGE[session.status] || { variant: 'secondary', label: session.status };
  const lastMsg   = session.last_message;
  const isOnline  = session.status === 'ACTIVE' || session.status === 'ACCEPTED';

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left rounded-2xl ${
        isSelected
          ? 'bg-primary/10 border border-primary/20'
          : 'hover:bg-muted/50 border border-transparent'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
          {(session.doctor_name || 'Dr')[0].toUpperCase()}
        </div>
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-background" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-sm text-foreground truncate">{session.doctor_name || 'Doctor'}</p>
          {lastMsg?.created_at && (
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">
            {lastMsg?.content
              ? lastMsg.content.length > 40 ? lastMsg.content.slice(0, 40) + '…' : lastMsg.content
              : session.doctor_spec || 'Tap to open chat'}
          </p>
          <Badge variant={badge.variant} className="h-4 px-1.5 text-[8px] font-black uppercase flex-shrink-0">{badge.label}</Badge>
        </div>
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MyDoctor() {
  const [search,        setSearch]        = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [activeTab,     setActiveTab]     = useState('doctors');
  const [requestError,  setRequestError]  = useState(null);
  // On mobile: whether we're in "chat view" (true) or "session list" (false)
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const { data: doctors       = [], isLoading: loadingDoctors  } = useAllDoctors();
  const { data: consultations = [], isLoading: loadingConsults  } = useConsultations();
  const { data: prescriptions = [], isLoading: loadingPrescs    } = useMyDoctorPrescriptions();

  const requestMutation = useRequestConsultation();
  const respondMutation = useRespondToPrescription();

  const filteredDoctors = doctors.filter((d) => {
    const q = search.toLowerCase();
    return (
      (d.user_name      || '').toLowerCase().includes(q) ||
      (d.specialization || '').toLowerCase().includes(q) ||
      (d.hospital_name  || '').toLowerCase().includes(q)
    );
  });

  const activeSessions    = consultations.filter((s) => ['REQUESTED', 'ACCEPTED', 'ACTIVE'].includes(s.status));
  const completedSessions = consultations.filter((s) => ['COMPLETED', 'REJECTED'].includes(s.status));
  const allSessions       = [...activeSessions, ...completedSessions];

  const handleRequest = async (doctorId) => {
    setRequestError(null);
    try {
      const session = await requestMutation.mutateAsync(doctorId);
      setActiveSession(session);
      setActiveTab('sessions');
    } catch (err) {
      if (err?.details?.session_id) {
        const existing = consultations.find((s) => s.id === err.details.session_id);
        if (existing) { setActiveSession(existing); setActiveTab('sessions'); return; }
      }
      setRequestError(err?.message || 'Could not request consultation.');
    }
  };

  const openChat = (session) => {
    setActiveSession(session);
    setMobileChatOpen(true);
  };

  const closeChat = () => {
    setMobileChatOpen(false);
    // keep activeSession so desktop still shows it
  };

  const TABS = [
    { id: 'doctors',       label: 'Find Doctor',   count: null },
    { id: 'sessions',      label: 'My Chats',      count: activeSessions.length || null },
    { id: 'prescriptions', label: 'Prescriptions', count: prescriptions.filter(p => p.is_accepted === null || p.is_accepted === undefined).length || null },
  ];

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-foreground tracking-tight flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/20">
              <Stethoscope className="w-6 h-6" />
            </div>
            My Doctor
          </h2>
          <p className="text-muted-foreground font-medium mt-1">Connect with verified specialists and manage your consultations.</p>
        </div>
      </div>

      {/* Error banner */}
      {requestError && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-destructive/5 border border-destructive/20 text-destructive text-sm font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {requestError}
          <button className="ml-auto text-xs underline" onClick={() => setRequestError(null)}>Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-muted/40 rounded-2xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="w-5 h-5 bg-primary text-primary-foreground rounded-full text-[10px] font-black flex items-center justify-center">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── Find Doctor tab ──────────────────────────────────────────────── */}
        {activeTab === 'doctors' && (
          <motion.div key="doctors" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="relative mb-5 w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Search by name, specialty…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-card border border-border/60 rounded-2xl outline-none text-sm font-medium focus:border-primary/50 transition-all"
              />
            </div>
            {loadingDoctors ? (
              <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm font-medium">Loading doctors…</span>
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Stethoscope className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="font-bold text-foreground">No doctors found</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different search term.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDoctors.map((doc) => (
                  <DoctorCard key={doc.id} doctor={doc} onRequest={handleRequest} isPending={requestMutation.isPending} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── My Chats tab — WhatsApp-style split layout ───────────────────── */}
        {activeTab === 'sessions' && (
          <motion.div key="sessions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* ── Loading ── */}
            {loadingConsults && (
              <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading chats…</span>
              </div>
            )}

            {/* ── Empty state ── */}
            {!loadingConsults && allSessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="font-bold text-foreground text-lg">No consultations yet</p>
                <p className="text-sm text-muted-foreground mt-1 mb-6">Browse doctors and request a session to start chatting.</p>
                <Button onClick={() => setActiveTab('doctors')}>Find a Doctor</Button>
              </div>
            )}

            {/* ── Split pane ── */}
            {!loadingConsults && allSessions.length > 0 && (
              <div className="flex rounded-[2rem] border border-border/50 overflow-hidden bg-card shadow-xl" style={{ height: 'calc(100vh - 240px)', minHeight: 560 }}>

                {/* Left: conversation list — hidden on mobile when chat is open */}
                <div className={`flex flex-col border-r border-border/40 bg-background flex-shrink-0
                  ${mobileChatOpen ? 'hidden md:flex' : 'flex'}
                  w-full md:w-80 lg:w-96`}
                >
                  {/* List header */}
                  <div className="px-5 py-4 border-b border-border/40 flex-shrink-0">
                    <h3 className="font-display font-bold text-base text-foreground">Conversations</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{allSessions.length} session{allSessions.length !== 1 ? 's' : ''}</p>
                  </div>

                  {/* Session list */}
                  <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                    {/* Active sessions */}
                    {activeSessions.length > 0 && (
                      <>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 pt-2 pb-1">Active</p>
                        {activeSessions.map((s) => (
                          <SessionItem
                            key={s.id}
                            session={s}
                            isActive={activeSession?.id === s.id}
                            onClick={() => openChat(s)}
                          />
                        ))}
                      </>
                    )}
                    {/* Completed sessions */}
                    {completedSessions.length > 0 && (
                      <>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 pt-3 pb-1">Past</p>
                        {completedSessions.map((s) => (
                          <SessionItem
                            key={s.id}
                            session={s}
                            isActive={activeSession?.id === s.id}
                            onClick={() => openChat(s)}
                          />
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Right: chat area */}
                <div className={`flex-1 flex flex-col min-w-0
                  ${!mobileChatOpen && !activeSession ? 'hidden md:flex' : 'flex'}`}
                >
                  {activeSession ? (
                    <DoctorChatRoom
                      key={activeSession.id}
                      session={activeSession}
                      isDoctor={false}
                      onClose={() => { setActiveSession(null); setMobileChatOpen(false); }}
                    />
                  ) : (
                    /* Placeholder when nothing is selected (desktop only) */
                    <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-4 text-center px-8 bg-muted/10">
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <MessageSquare className="w-9 h-9 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">Select a conversation</p>
                        <p className="text-sm text-muted-foreground mt-1">Click any session on the left to open the chat.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Prescriptions tab ────────────────────────────────────────────── */}
        {activeTab === 'prescriptions' && (
          <motion.div key="prescriptions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
            {loadingPrescs ? (
              <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading prescriptions…</span>
              </div>
            ) : prescriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Pill className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="font-bold text-foreground">No prescriptions yet</p>
                <p className="text-sm text-muted-foreground mt-1">Your doctor will send prescriptions after a consultation.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prescriptions.map((rx) => (
                  <PrescriptionCard key={rx.id} rx={rx} onRespond={respondMutation.mutate} isPending={respondMutation.isPending} />
                ))}
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
