import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Phone, MessageCircle, Star, Search, Clock, Shield, MapPin,
  Video, Heart, X, Stethoscope, Activity, Sparkles, Mic, MicOff,
  Loader2, LogIn, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { axiosInstance } from '@/lib/axios';
import { useAuthStore } from '@/stores/auth.store';
import DoctorChatRoom from '@/components/doctor/DoctorChatRoom';
import { useNavigate } from 'react-router-dom';

const VOICE_LANGUAGES = [
  { code: 'hi-IN', label: 'हिंदी' },
  { code: 'en-IN', label: 'English' },
  { code: 'mr-IN', label: 'मराठी' },
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'ta-IN', label: 'தமிழ்' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ' },
];

/* ───── Voice Input Hook ───── */
function useSpeechInput(onResult, lang) {
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = useRef(null);

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    if (!supported) return;
    setVoiceError('');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;
    r.onstart = () => setIsListening(true);
    r.onresult = (e) => { onResult(e.results[0][0].transcript); };
    r.onerror = (e) => {
      setVoiceError(e.error === 'not-allowed' ? 'Microphone permission denied.' : 'Could not recognise speech. Please try again.');
      setIsListening(false);
    };
    r.onend = () => setIsListening(false);
    recognitionRef.current = r;
    r.start();
  }, [supported, lang, onResult]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, voiceError, supported, startListening, stopListening };
}

const FadeIn = ({ children, className = '', delay = 0 }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }} className={className}
    >{children}</motion.div>
  );
};

const AVATAR_COLORS = [
  'from-blue-500 to-cyan-500',
  'from-violet-500 to-purple-500',
  'from-emerald-500 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-indigo-500 to-blue-500',
];

function toAvatar(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function normalizeDoctor(raw, idx) {
  return {
    id:         raw.id,
    name:       raw.full_name || 'Doctor',
    specialty:  raw.specialization || '',
    hospital:   raw.hospital_name || '',
    experience: `${raw.experience_years ?? 0} years`,
    rating:     Number(raw.rating ?? 5.0),
    reviews:    raw.review_count ?? 0,
    fee:        raw.consultation_fee ?? 300,
    available:  raw.is_available ?? true,
    nextSlot:   raw.next_slot || '',
    languages:  Array.isArray(raw.languages) ? raw.languages : [],
    avatar:     toAvatar(raw.full_name),
    color:      AVATAR_COLORS[idx % AVATAR_COLORS.length],
  };
}

const SYMPTOM_MAP = {
  'chest pain': 'Cardiologist', 'heart': 'Cardiologist', 'palpitations': 'Cardiologist',
  'sugar': 'Diabetologist', 'diabetes': 'Diabetologist', 'thirst': 'Endocrinologist',
  'cough': 'Pulmonologist', 'breath': 'Pulmonologist',
  'headache': 'Neurologist', 'migraine': 'Neurologist',
  'fever': 'General Physician', 'cold': 'General Physician', 'flu': 'General Physician', 'stomach': 'General Physician',
  'सीने में दर्द': 'Cardiologist', 'सीने': 'Cardiologist', 'दिल में दर्द': 'Cardiologist',
  'दिल': 'Cardiologist', 'धड़कन': 'Cardiologist',
  'मधुमेह': 'Diabetologist', 'चीनी': 'Diabetologist', 'शुगर': 'Diabetologist',
  'खांसी': 'Pulmonologist', 'खांसी आना': 'Pulmonologist', 'सांस': 'Pulmonologist', 'सांस लेने में': 'Pulmonologist',
  'सिर दर्द': 'Neurologist', 'सिरदर्द': 'Neurologist', 'माइग्रेन': 'Neurologist', 'आधा सिर': 'Neurologist',
  'बुखार': 'General Physician', 'जुकाम': 'General Physician', 'ठंड': 'General Physician',
  'पेट दर्द': 'General Physician', 'उल्टी': 'General Physician',
  'थकान': 'Endocrinologist', 'प्यास': 'Endocrinologist', 'ज्यादा प्यास': 'Endocrinologist',
};

/* ───── Real Consultation Chat Modal ───── */
const ConsultChatModal = ({ doctor, onClose }) => {
  const user     = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const didRun = useRef(false);

  useEffect(() => {
    if (!user) return;
    // StrictMode guard — only fire once per real mount
    if (didRun.current) return;
    didRun.current = true;

    setLoading(true);
    setError('');

    axiosInstance
      .post('/doctor/consultations/', { doctor: doctor.id })
      .then((res) => {
        const data = res.data?.data ?? res.data;
        setSession(data);
      })
      .catch((err) => {
        const data       = err.response?.data || {};
        const errorObj   = data.error || {};
        const details    = errorObj.details || {};
        
        const detail     = details.detail || errorObj.message || data.message || '';
        const existingId = details.session_id || data.session_id;
        if (existingId) {
          // Session already exists — fetch and open it
          axiosInstance.get(`/doctor/consultations/${existingId}/`)
            .then((r) => setSession(r.data?.data ?? r.data))
            .catch(() => setError('Failed to load existing session.'));
        } else {
          const msg = detail.toLowerCase().includes('only patients')
            ? 'Only patient accounts can request consultations. Please log in as a patient.'
            : (detail || 'Failed to start consultation.');
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [user, doctor.id]);

  /* Not logged in */
  if (!user) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
          className="bg-card rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-display font-bold text-xl text-foreground mb-2">Sign in to chat</h3>
          <p className="text-muted-foreground text-sm mb-6">
            You need to be logged in to consult {doctor.name}.
          </p>
          <div className="flex flex-col gap-3">
            <Button className="w-full h-12 rounded-xl" onClick={() => navigate('/login')}>
              <LogIn className="w-4 h-4 mr-2" /> Sign In
            </Button>
            <Button variant="ghost" className="w-full h-10 rounded-xl text-muted-foreground" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-card rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ height: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {(loading || (!session && !error)) && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Connecting you with {doctor.name}…</p>
          </div>
        )}
        {!loading && error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <p className="font-bold text-foreground">Could not start consultation</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" className="rounded-xl" onClick={onClose}>Close</Button>
          </div>
        )}
        {!loading && session && (
          <DoctorChatRoom session={session} isDoctor={false} onClose={onClose} />
        )}
      </motion.div>
    </motion.div>
  );
};

/* ───── Call Modal ───── */
const CallModal = ({ doctor, onClose }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onClose}
  >
    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
      className="bg-card rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center"
      onClick={e => e.stopPropagation()}
    >
      <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${doctor.color} flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4`}>
        {doctor.avatar}
      </div>
      <h3 className="font-display font-bold text-xl text-foreground">{doctor.name}</h3>
      <p className="text-muted-foreground text-sm mb-6">{doctor.specialty}</p>
      <div className="flex flex-col gap-3">
        <a href="tel:+919876543210">
          <Button className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white">
            <Phone className="w-4 h-4 mr-2" /> Voice Call
          </Button>
        </a>
        <Button variant="outline" className="w-full h-12 rounded-xl">
          <Video className="w-4 h-4 mr-2" /> Video Call
        </Button>
        <Button variant="ghost" className="w-full h-10 rounded-xl text-muted-foreground" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-4">Consultation fee: ₹{doctor.fee}</p>
    </motion.div>
  </motion.div>
);

/* ───── Doctor Card ───── */
const DoctorCard = ({ doctor, onChat, onCall, delay }) => (
  <FadeIn delay={delay}>
    <motion.div whileHover={{ y: -4 }}
      className="bg-card rounded-2xl border border-border/60 shadow-elevation-1 hover:shadow-elevation-3 transition-all overflow-hidden"
    >
      <div className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${doctor.color} flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0`}>
            {doctor.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-foreground">{doctor.name}</h3>
              {doctor.available && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />}
            </div>
            <p className="text-primary text-sm font-semibold">{doctor.specialty}</p>
            <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" /> {doctor.hospital}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground">Experience</p>
            <p className="font-bold text-foreground text-sm">{doctor.experience}</p>
          </div>
          <div className="text-center p-2 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground">Rating</p>
            <p className="font-bold text-foreground text-sm flex items-center justify-center gap-1">
              <Star className="w-3 h-3 fill-accent text-accent" /> {doctor.rating}
            </p>
          </div>
          <div className="text-center p-2 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground">Fee</p>
            <p className="font-bold text-foreground text-sm">₹{doctor.fee}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 text-xs">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className={`font-semibold ${doctor.available ? 'text-green-600' : 'text-muted-foreground'}`}>
            {doctor.available ? 'Available' : 'Next:'} {doctor.nextSlot}
          </span>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-10 rounded-xl text-sm" onClick={() => onCall(doctor)}>
            <Phone className="w-4 h-4 mr-1.5" /> Call
          </Button>
          <Button className="flex-1 h-10 rounded-xl text-sm" onClick={() => onChat(doctor)}>
            <MessageCircle className="w-4 h-4 mr-1.5" /> Message
          </Button>
        </div>
      </div>
    </motion.div>
  </FadeIn>
);

/* ═══════════ MAIN PAGE ═══════════ */
export default function ConsultDoctors() {
  const [doctors,    setDoctors]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [symptoms,   setSymptoms]   = useState('');
  const [specialty,  setSpecialty]  = useState('All');
  const [chatDoctor, setChatDoctor] = useState(null);
  const [callDoctor, setCallDoctor] = useState(null);
  const [voiceLang,  setVoiceLang]  = useState('hi-IN');

  useEffect(() => {
    axiosInstance.get('/doctor/profiles/')
      .then(res => {
        const raw = res.data?.data ?? res.data ?? [];
        setDoctors((Array.isArray(raw) ? raw : []).map(normalizeDoctor));
      })
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  }, []);

  const specialties = ['All', ...Array.from(new Set(doctors.map(d => d.specialty).filter(Boolean)))];

  const { isListening, voiceError, supported, startListening, stopListening } =
    useSpeechInput((transcript) => setSymptoms(prev => prev ? `${prev} ${transcript}` : transcript), voiceLang);

  const getRecommendedSpecialty = () => {
    if (!symptoms.trim()) return null;
    const lower = symptoms.toLowerCase();
    for (const [symptom, spec] of Object.entries(SYMPTOM_MAP)) {
      if (lower.includes(symptom)) return spec;
    }
    return null;
  };

  const recommendedSpec = getRecommendedSpecialty();

  const filtered = doctors.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.specialty.toLowerCase().includes(search.toLowerCase());
    const activeSpec = specialty !== 'All' ? specialty : recommendedSpec;
    const matchSpec = !activeSpec || d.specialty === activeSpec;
    return matchSearch && matchSpec;
  });

  return (
    <div className="flex flex-col gap-8 py-4">

      {/* Hero */}
      <section className="pt-10 pb-8 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <FadeIn>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold mb-5">
              <Stethoscope className="w-4 h-4" /> Consult a Doctor
            </span>
            <h1 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight mb-3">
              Talk to <span className="text-primary">Expert Doctors</span> Anytime
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Get instant medical advice via call or message from verified specialists across India.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 pb-8">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Shield, label: 'Verified',      value: '500+ Doctors' },
            { icon: Clock,  label: 'Avg Response',  value: '< 2 min' },
            { icon: Star,   label: 'Avg Rating',    value: '4.8 / 5' },
            { icon: Heart,  label: 'Consultations', value: '50,000+' },
          ].map((s, i) => (
            <FadeIn key={i} delay={i * 0.05}>
              <div className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border/60">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-primary">
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Search + Filter */}
      <section className="px-6 pb-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4">
          <div className="relative flex-[2]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search doctors by name or specialty..."
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-card border border-border/60 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="relative flex-[2] flex flex-col gap-1">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                <input value={symptoms} onChange={e => setSymptoms(e.target.value)}
                  placeholder={isListening ? 'Listening… speak your symptoms' : 'Enter symptoms (e.g. chest pain)...'}
                  className={`w-full pl-11 pr-4 py-3 rounded-xl bg-card text-foreground text-sm outline-none transition-all ${
                    isListening
                      ? 'border-2 border-red-400 ring-2 ring-red-400/30'
                      : 'border border-accent/20 focus:ring-2 focus:ring-accent/30 focus:border-accent'
                  }`}
                />
                <AnimatePresence>
                  {recommendedSpec && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-accent text-white px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-lg pointer-events-none"
                    >
                      <Sparkles className="w-3 h-3" /> Recommended: {recommendedSpec}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <select value={voiceLang} onChange={e => setVoiceLang(e.target.value)} disabled={isListening}
                title="Choose voice language"
                className="h-11 px-2 rounded-xl bg-card border border-border/60 text-foreground text-xs font-semibold outline-none focus:ring-2 focus:ring-accent/30 cursor-pointer disabled:opacity-50"
              >
                {VOICE_LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>

              <button type="button" onClick={isListening ? stopListening : startListening} disabled={!supported}
                title={!supported ? 'Voice not supported' : isListening ? 'Stop listening' : `Speak in ${VOICE_LANGUAGES.find(l => l.code === voiceLang)?.label}`}
                className={`h-11 w-11 flex-shrink-0 rounded-xl flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40'
                    : supported
                      ? 'bg-muted text-muted-foreground hover:bg-accent/20 hover:text-accent border border-border/60'
                      : 'opacity-30 cursor-not-allowed bg-muted text-muted-foreground border border-border/60'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>

            {voiceError && <p className="text-xs text-red-500 pl-1">{voiceError}</p>}
            {isListening && (
              <p className="text-xs text-red-500 pl-1 animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-ping" />
                Listening in {VOICE_LANGUAGES.find(l => l.code === voiceLang)?.label}… speak now
              </p>
            )}
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-4">
          <div className="flex gap-2 flex-wrap">
            {specialties.map(s => (
              <button key={s} onClick={() => { setSpecialty(s); setSymptoms(''); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  (specialty === s || (specialty === 'All' && recommendedSpec === s))
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40'
                }`}
              >{s}</button>
            ))}
          </div>
        </div>
      </section>

      {/* Doctor Cards */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-sm font-medium">Loading doctors…</span>
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((doc, i) => (
                <DoctorCard key={doc.id} doctor={doc} delay={i * 0.08}
                  onChat={setChatDoctor} onCall={setCallDoctor}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Search className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground font-semibold">No doctors found matching your criteria.</p>
              <button onClick={() => { setSearch(''); setSpecialty('All'); }}
                className="text-primary text-sm font-semibold mt-2 hover:underline"
              >Clear filters</button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8 text-center text-xs text-muted-foreground">
        © 2026 Aarogyam Health Systems India Pvt Ltd. All rights reserved.
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {chatDoctor && <ConsultChatModal doctor={chatDoctor} onClose={() => setChatDoctor(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {callDoctor && <CallModal doctor={callDoctor} onClose={() => setCallDoctor(null)} />}
      </AnimatePresence>
    </div>
  );
}
