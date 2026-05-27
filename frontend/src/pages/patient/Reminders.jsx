import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Clock3, CalendarDays, CheckCircle2, Hourglass, BellRing, Loader2, Pill, ShieldAlert, RefreshCcw, Clock, TimerReset, CircleCheckBig } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { useTodayReminders, useUpcomingReminders, useReminderActions } from '@/hooks/useReminders';

const statusMeta = {
  PENDING: { label: 'Pending', variant: 'warning', icon: Hourglass },
  SNOOZED: { label: 'Snoozed', variant: 'primary', icon: TimerReset },
  TAKEN: { label: 'Taken', variant: 'success', icon: CircleCheckBig },
  MISSED: { label: 'Missed', variant: 'danger', icon: ShieldAlert },
  SKIPPED: { label: 'Skipped', variant: 'default', icon: ShieldAlert },
};

const stateColor = (status) => {
  if (status === 'TAKEN') return 'bg-success/10 text-success border-success/20';
  if (status === 'SNOOZED') return 'bg-primary/10 text-primary border-primary/20';
  if (status === 'MISSED') return 'bg-destructive/10 text-destructive border-destructive/20';
  if (status === 'SKIPPED') return 'bg-muted text-muted-foreground border-border';
  return 'bg-accent/10 text-accent border-accent/20';
};

const formatTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const ReminderCard = ({ item, onTake, onMiss, onSnooze, onOpenNotes, busyId }) => {
  const meta = statusMeta[item.status] || statusMeta.PENDING;
  const Icon = meta.icon;
  const canAct = ['PENDING', 'SNOOZED'].includes(item.status);

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <Card className="overflow-hidden">
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${stateColor(item.status)}`}>
                <Pill className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center flex-wrap gap-2 mb-1">
                  <h3 className="font-display font-bold text-lg text-foreground truncate">{item.medication_name}</h3>
                  <Badge variant={meta.variant} className="gap-1">
                    <Icon className="w-3.5 h-3.5" /> {meta.label}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground font-medium">
                  <span className="flex items-center gap-1.5"><Clock3 className="w-4 h-4 text-primary/70" /> {formatTime(item.scheduled_at)}</span>
                  <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-primary/70" /> {formatDateTime(item.scheduled_at)}</span>
                  <span>{item.dose_value} {item.dose_unit}</span>
                  {item.label ? <span>{item.label}</span> : null}
                </div>
                {item.snooze_until ? (
                  <p className="text-xs text-muted-foreground mt-1">Snoozed until {formatDateTime(item.snooze_until)}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center justify-start lg:justify-end">
              {item.status === 'TAKEN' ? (
                <Badge variant="success">Completed</Badge>
              ) : item.status === 'MISSED' ? (
                <Badge variant="danger">Action needed</Badge>
              ) : null}

              {canAct ? (
                <>
                  <Button variant="secondary" className="h-10 px-4" isLoading={busyId === `take-${item.id}`} onClick={() => onTake(item)}>
                    <CheckCircle2 className="w-4 h-4" /> Take
                  </Button>
                  <Button variant="outline" className="h-10 px-4" isLoading={busyId === `miss-${item.id}`} onClick={() => onMiss(item)}>
                    <BellRing className="w-4 h-4" /> Miss
                  </Button>
                  <Button variant="ghost" className="h-10 px-4" isLoading={busyId === `snooze-${item.id}`} onClick={() => onSnooze(item)}>
                    <RefreshCcw className="w-4 h-4" /> Snooze
                  </Button>
                </>
              ) : null}

              <Button variant="ghost" className="h-10 px-4" onClick={() => onOpenNotes(item)}>
                Notes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const ManualDoseCard = ({ prescriptions = [], onSubmit, isLoading }) => {
  const [form, setForm] = useState({ prescription_id: '', taken_at: '', dose_value: '', notes: '', source: 'APP' });

  const submit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-xl font-display font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Manual Dose Entry</h3>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Prescription"
            value={form.prescription_id}
            onChange={(e) => setForm((prev) => ({ ...prev, prescription_id: e.target.value }))}
            options={[{ label: 'Select prescription', value: '' }, ...prescriptions.map((rx) => ({ label: `${rx.medication?.name || 'Medication'} (${rx.dosage_value || ''}${rx.dosage_unit || ''})`, value: rx.id }))]}
            required
          />
          <Input label="Taken At" type="datetime-local" value={form.taken_at} onChange={(e) => setForm((prev) => ({ ...prev, taken_at: e.target.value }))} />
          <Input label="Dose Value" type="number" value={form.dose_value} onChange={(e) => setForm((prev) => ({ ...prev, dose_value: e.target.value }))} placeholder="Optional" />
          <Select
            label="Source"
            value={form.source}
            onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}
            options={[
              { label: 'App', value: 'APP' },
              { label: 'Voice', value: 'VOICE' },
              { label: 'NFC', value: 'NFC' },
            ]}
          />
          <div className="md:col-span-2">
            <Input label="Notes" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Optional note" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" isLoading={isLoading}>Log Manual Dose</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default function Reminders() {
  const [days, setDays] = useState(7);
  const [snoozeMinutes, setSnoozeMinutes] = useState(10);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [busyId, setBusyId] = useState('');

  const todayQuery = useTodayReminders();
  const upcomingQuery = useUpcomingReminders(days);
  const { logDose, snooze, manualDose } = useReminderActions();

  const todayReminders = Array.isArray(todayQuery.data) ? todayQuery.data : (todayQuery.data?.results || todayQuery.data?.data || []);
  const upcomingReminders = Array.isArray(upcomingQuery.data) ? upcomingQuery.data : (upcomingQuery.data?.results || upcomingQuery.data?.data || []);

  const prescriptionOptions = useMemo(() => {
    const map = new Map();
    [...todayReminders, ...upcomingReminders].forEach((item) => {
      if (item.prescription_id && !map.has(item.prescription_id)) {
        map.set(item.prescription_id, { id: item.prescription_id, medication: { name: item.medication_name }, dosage_value: item.dose_value, dosage_unit: item.dose_unit });
      }
    });
    return Array.from(map.values());
  }, [todayReminders, upcomingReminders]);

  const handleDose = async (item, status) => {
    setBusyId(`${status === 'TAKEN' ? 'take' : 'miss'}-${item.id}`);
    try {
      await logDose.mutateAsync({ reminderId: item.id, status, takenAt: new Date().toISOString(), source: 'APP' });
    } finally {
      setBusyId('');
    }
  };

  const handleSnooze = async (item) => {
    setBusyId(`snooze-${item.id}`);
    try {
      await snooze.mutateAsync({ reminderId: item.id, minutes: snoozeMinutes });
    } finally {
      setBusyId('');
    }
  };

  const handleManualDose = async (form) => {
    await manualDose.mutateAsync({
      prescription_id: form.prescription_id,
      taken_at: form.taken_at ? new Date(form.taken_at).toISOString() : undefined,
      dose_value: form.dose_value ? Number(form.dose_value) : undefined,
      notes: form.notes || undefined,
      source: form.source,
    });
  };

  const pendingCount = todayReminders.filter((item) => ['PENDING', 'SNOOZED'].includes(item.status)).length;
  const takenCount = todayReminders.filter((item) => item.status === 'TAKEN').length;
  const missedCount = todayReminders.filter((item) => item.status === 'MISSED').length;

  return (
    <div className="flex flex-col gap-8 py-4">
      <div className="flex justify-end items-center gap-3 flex-wrap">
        <div className="flex bg-muted p-1 rounded-xl">
          {[7, 14, 30].map((value) => (
            <button
              key={value}
              onClick={() => setDays(value)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${days === value ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {value}D
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-card border border-border/50 rounded-xl px-3 py-2">
          <span className="text-sm text-muted-foreground font-semibold">Snooze</span>
          <Select
            className="w-24"
            value={snoozeMinutes}
            onChange={(e) => setSnoozeMinutes(Number(e.target.value))}
            options={[
              { label: '5m', value: 5 },
              { label: '10m', value: 10 },
              { label: '15m', value: 15 },
              { label: '30m', value: 30 },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary text-white border-none shadow-elevation-2">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Pending Today</p>
            <div className="flex items-end gap-3">
              <h3 className="text-4xl font-display font-bold">{pendingCount}</h3>
              <p className="text-sm text-white/80 font-medium mb-1">reminders left</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Taken Today</p>
            <div className="flex items-end gap-3">
              <h3 className="text-4xl font-display font-bold text-success">{takenCount}</h3>
              <p className="text-sm text-muted-foreground font-medium mb-1">logged</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Missed Today</p>
            <div className="flex items-end gap-3">
              <h3 className="text-4xl font-display font-bold text-destructive">{missedCount}</h3>
              <p className="text-sm text-muted-foreground font-medium mb-1">needs action</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <h3 className="text-xl font-display font-bold flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> Today’s Reminders</h3>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {todayQuery.isLoading ? (
                <div className="py-10 flex items-center justify-center text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading reminders...</div>
              ) : todayReminders.length ? (
                <AnimatePresence>
                  {todayReminders.map((item) => (
                    <ReminderCard
                      key={item.id}
                      item={item}
                      busyId={busyId}
                      onTake={(reminder) => handleDose(reminder, 'TAKEN')}
                      onMiss={(reminder) => handleDose(reminder, 'MISSED')}
                      onSnooze={handleSnooze}
                      onOpenNotes={setSelectedReminder}
                    />
                  ))}
                </AnimatePresence>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <CircleCheckBig className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  No reminders for today.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h3 className="text-xl font-display font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Upcoming Reminders</h3>
              <Badge variant="primary">Next {days} days</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {upcomingQuery.isLoading ? (
                <div className="py-10 flex items-center justify-center text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading upcoming reminders...</div>
              ) : upcomingReminders.length ? (
                upcomingReminders.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-background">
                    <div>
                      <h4 className="font-semibold text-foreground">{item.medication_name}</h4>
                      <p className="text-sm text-muted-foreground">{formatDateTime(item.scheduled_at)} • {item.dose_value} {item.dose_unit}</p>
                    </div>
                    <Badge variant={item.status === 'PENDING' ? 'warning' : 'primary'}>{item.status}</Badge>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-muted-foreground">No upcoming reminders found.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader>
              <h3 className="text-lg font-display font-bold flex items-center gap-2 text-foreground"><BellRing className="w-5 h-5 text-accent" /> Quick Actions</h3>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Use the cards to mark taken/missed, snooze, or add a manual dose. This works directly with your backend reminder endpoints.</p>
              <div className="grid grid-cols-1 gap-2 pt-2">
                <Button variant="secondary" className="justify-start" onClick={() => todayQuery.refetch()}>
                  <RefreshCcw className="w-4 h-4" /> Refresh reminders
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => upcomingQuery.refetch()}>
                  <CalendarDays className="w-4 h-4" /> Refresh upcoming
                </Button>
              </div>
            </CardContent>
          </Card>

          <ManualDoseCard prescriptions={prescriptionOptions} onSubmit={handleManualDose} isLoading={manualDose.isPending} />
        </div>
      </div>

      {selectedReminder ? (
        <Card className="border-dashed border-border/60">
          <CardHeader>
            <h3 className="text-lg font-display font-bold">Reminder Notes</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><span className="text-muted-foreground block">Medication</span><span className="font-semibold">{selectedReminder.medication_name}</span></div>
              <div><span className="text-muted-foreground block">Status</span><span className="font-semibold">{selectedReminder.status}</span></div>
              <div><span className="text-muted-foreground block">Scheduled</span><span className="font-semibold">{formatDateTime(selectedReminder.scheduled_at)}</span></div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Backend reminder detail data is already available. You can extend this panel later with notes, history, and caregiver escalation.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
