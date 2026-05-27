import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pill, TrendingDown, AlertCircle,
  Stethoscope, Clock, Calendar, ShieldCheck, Loader2, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useDoctorPatients, useDoctorPatientsData } from '@/hooks/useDoctor';

export default function DoctorPatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: patients = [], isLoading: loadingPatients } = useDoctorPatients();
  const patient = patients.find(p => String(p.id) === String(id));

  const patientsData = useDoctorPatientsData(patient ? [patient] : []);
  const patientData  = patient ? (patientsData[patient.id] || {}) : {};

  const adherence = patientData.adherence;
  const alerts    = Array.isArray(patientData.alerts) ? patientData.alerts : [];

  const adherencePct = Math.round(
    adherence?.adherence_pct ?? adherence?.adherence_rate ?? adherence?.summary?.adherence_pct ?? 0
  );

  const chartData = useMemo(() => {
    const timeline = adherence?.timeline ?? adherence?.data ?? [];
    if (Array.isArray(timeline) && timeline.length > 0) {
      return timeline.slice(-7).map((pt, i) => ({
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i % 7],
        adherence: Math.round(pt.pct ?? pt.adherence_pct ?? pt.rate ?? 0),
      }));
    }
    // Fallback: flat line at computed adherence
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
      day,
      adherence: adherencePct,
    }));
  }, [adherence, adherencePct]);

  const missedThisWeek = alerts.filter(a => {
    const d = new Date(a.scheduled_at);
    return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
  }).length;

  if (loadingPatients) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Loading patient data…</span>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-10 h-10 text-destructive/50" />
        <p className="font-bold text-foreground">Patient not found</p>
        <Button variant="outline" onClick={() => navigate('/doctor/home')}>Back to Registry</Button>
      </div>
    );
  }

  const initials = patient.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-8 py-4">
      {/* Back */}
      <button onClick={() => navigate('/doctor/home')} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Registry Overview</span>
      </button>

      {/* Profile Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-[2rem] bg-primary flex items-center justify-center text-white font-display font-black text-3xl shadow-xl">
            {initials}
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-display font-extrabold tracking-tight text-foreground">{patient.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-xs font-bold uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5 text-primary" /> Code: {patient.patientCode || '—'}</span>
              <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Linked {patient.linkedAt ? new Date(patient.linkedAt).toLocaleDateString() : '—'}</span>
              <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
              <Badge
                variant={adherencePct >= 70 ? 'success' : 'danger'}
                className="h-5 px-2 text-[8px] rounded-lg"
              >
                {adherencePct >= 70 ? 'STABLE' : 'AT RISK'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Button
            onClick={() => navigate(`/doctor/prescribe/${id}`)}
            className="flex-1 md:flex-none h-12 px-6 rounded-xl shadow-lg shadow-primary/20 font-bold"
          >
            <Pill className="w-4 h-4 mr-2" /> New Prescription
          </Button>
        </div>
      </div>

      {/* Clinical Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: 'Weekly Adherence',
            value: `${adherencePct}%`,
            sub: adherencePct < 80 ? 'Below target' : 'On track',
            icon: adherencePct < 80 ? TrendingDown : CheckCircle2,
            color: adherencePct >= 85 ? 'text-success' : adherencePct >= 70 ? 'text-accent' : 'text-destructive',
          },
          {
            label: 'Missed (30d)',
            value: String(adherence?.missed ?? '—'),
            sub: 'Doses missed',
            icon: AlertCircle,
            color: 'text-destructive',
          },
          {
            label: 'Taken (30d)',
            value: String(adherence?.taken ?? '—'),
            sub: 'Doses confirmed',
            icon: ShieldCheck,
            color: 'text-success',
          },
          {
            label: 'Open Alerts',
            value: String(alerts.length),
            sub: 'Missed dose alerts',
            icon: Calendar,
            color: 'text-primary',
          },
        ].map((stat, i) => (
          <Card key={i} className="rounded-3xl border-border/50">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">{stat.label}</p>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-2xl font-display font-black ${stat.color}`}>{stat.value}</h3>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{stat.sub}</p>
                </div>
                <stat.icon className={`w-6 h-6 ${stat.color} opacity-40`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Adherence Chart */}
        <Card className="lg:col-span-2 rounded-[2.5rem] overflow-hidden">
          <CardHeader className="p-8 pb-0 flex flex-row items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-xl">Adherence Trend</h3>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">Last 7 days</p>
            </div>
            <Badge variant="primary" className="bg-primary/10 text-primary border-none text-[9px] font-black uppercase">7 Days</Badge>
          </CardHeader>
          <CardContent className="p-8 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAdh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0B6E7A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0B6E7A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#7A8A99', fontSize: 11, fontWeight: 700 }} dy={10} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#7A8A99', fontSize: 11, fontWeight: 700 }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="adherence" stroke="#0B6E7A" strokeWidth={3} fillOpacity={1} fill="url(#colorAdh)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Missed Doses */}
        <Card className="rounded-[2.5rem] overflow-hidden">
          <CardHeader className="p-8 pb-0 flex flex-row items-center justify-between">
            <h3 className="font-display font-bold text-xl">Recent Alerts</h3>
            <Badge variant="danger" className="text-[9px] h-5 px-2 rounded-full">{alerts.length} total</Badge>
          </CardHeader>
          <CardContent className="p-8 flex flex-col gap-4">
            {patientData.isLoading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-8 h-8 text-success/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground font-medium">No missed dose alerts</p>
              </div>
            ) : (
              alerts.slice(0, 5).map((alert, i) => (
                <div key={i} className="p-4 bg-destructive/5 rounded-2xl border border-destructive/10">
                  <p className="text-sm font-bold text-foreground">
                    {alert.medication_name ?? alert.schedule?.prescription?.medication_name ?? 'Medication'}
                  </p>
                  <p className="text-[10px] text-destructive font-bold uppercase tracking-widest mt-1">
                    Missed · {alert.scheduled_at ? new Date(alert.scheduled_at).toLocaleString() : '—'}
                  </p>
                </div>
              ))
            )}
            <Button
              onClick={() => navigate(`/doctor/prescribe/${id}`)}
              variant="outline"
              className="w-full h-11 rounded-xl text-primary border-primary/20 hover:bg-primary/5 font-bold text-xs uppercase tracking-widest mt-2"
            >
              Prescribe Medication
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
