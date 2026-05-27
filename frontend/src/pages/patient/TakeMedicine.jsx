import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pill, Volume2, ShieldCheck, Clock, Info,
  ChevronRight, ArrowLeft, CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTodayReminders, useReminderActions } from '@/hooks/useReminders';

export default function TakeMedicine() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [step, setStep]               = useState(1);
  const [isVoiceActive, setIsVoice]   = useState(true);
  const [isLogging, setIsLogging]     = useState(false);
  const [logError, setLogError]       = useState('');

  const { data: schedule = [], isLoading } = useTodayReminders();
  const { logDose } = useReminderActions();

  // Find today's reminder by ID
  const reminder = useMemo(() => {
    if (!schedule) return null;
    const list = Array.isArray(schedule) ? schedule : (schedule?.data ?? schedule?.results ?? []);
    return list.find(r => String(r.id) === String(id)) || list[0] || null;
  }, [schedule, id]);

  const medications = useMemo(() => {
    if (!reminder) return [];
    // Backend may return medications as nested array or comma-separated
    if (Array.isArray(reminder.medications)) return reminder.medications;
    if (reminder.medication_name) {
      return [{ name: reminder.medication_name, dosage: reminder.dosage ?? '', quantity: 1 }];
    }
    if (reminder.schedule?.prescription?.medication_name) {
      return [{
        name:     reminder.schedule.prescription.medication_name,
        dosage:   reminder.schedule.prescription.dosage ?? '',
        quantity: reminder.schedule.quantity ?? 1,
      }];
    }
    return [];
  }, [reminder]);

  const compartment = reminder?.compartment_number
    ?? reminder?.schedule?.compartment_number
    ?? reminder?.compartment
    ?? '—';

  const scheduledTime = reminder?.scheduled_at
    ? new Date(reminder.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : reminder?.time ?? '—';

  const handleComplete = async () => {
    setLogError('');
    setIsLogging(true);
    try {
      if (reminder?.id) {
        await logDose.mutateAsync({
          reminderId: reminder.id,
          status:     'TAKEN',
          source:     'APP',
          takenAt:    new Date().toISOString(),
        });
      }
      navigate(`/patient/dose/${id}/status`, { state: { status: 'taken', reminderId: id } });
    } catch (err) {
      setLogError(err?.message || 'Failed to log dose. Please try again.');
      setIsLogging(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="font-bold">Loading your dose…</p>
        </div>
      </div>
    );
  }

  if (!reminder && !isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm">
          <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-display font-bold">Reminder Not Found</h3>
          <p className="text-muted-foreground font-medium">This dose reminder doesn't exist or has already been completed.</p>
          <Button onClick={() => navigate('/patient/home')} className="h-12 px-8 rounded-xl">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/patient/home')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold text-sm uppercase tracking-widest">Back</span>
          </button>
          <Badge variant="primary" className="h-8 px-4 rounded-full font-black uppercase tracking-widest">
            Compartment {compartment}
          </Badge>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="prep"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex flex-col gap-8"
            >
              <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground tracking-tight mb-3">Preparation</h1>
                <p className="text-muted-foreground font-medium text-lg">Please gather your water and sit comfortably.</p>
              </div>

              <Card className="bg-primary/5 border-primary/20 rounded-[2.5rem] overflow-hidden">
                <CardContent className="p-8 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-xl text-primary">
                      {medications.length > 0 ? `Medications in Slot ${compartment}` : 'Today\'s Dose'}
                    </h3>
                    <button
                      onClick={() => setIsVoice(!isVoiceActive)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isVoiceActive ? 'bg-primary text-white shadow-lg' : 'bg-muted text-muted-foreground'}`}
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>

                  {medications.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {medications.map((m, idx) => (
                        <div key={idx} className="bg-white p-5 rounded-3xl border border-border/50 flex items-center gap-4 shadow-elevation-1">
                          <div className="text-2xl w-12 h-12 bg-muted/30 rounded-2xl flex items-center justify-center">💊</div>
                          <div className="flex-1">
                            <h4 className="font-bold text-foreground">{m.name}</h4>
                            <p className="text-xs text-muted-foreground font-medium">
                              {m.dosage}{m.quantity && m.quantity > 1 ? ` × ${m.quantity}` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white p-5 rounded-3xl border border-border/50 flex items-center gap-4">
                      <Pill className="w-8 h-8 text-primary" />
                      <p className="font-medium text-muted-foreground">Medication details loading…</p>
                    </div>
                  )}

                  {reminder?.instructions && (
                    <div className="p-5 rounded-2xl bg-white/50 border border-white flex items-start gap-3">
                      <Info className="w-5 h-5 text-primary mt-0.5" />
                      <p className="text-sm text-foreground/80 leading-relaxed font-medium">{reminder.instructions}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button onClick={() => setStep(2)} className="h-16 text-xl rounded-3xl shadow-2xl shadow-primary/30">
                Ready to Take <ChevronRight className="ml-2 w-6 h-6" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="taking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col gap-8 items-center"
            >
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-primary rounded-full blur-3xl -z-10"
                />
                <div className="w-64 h-64 md:w-80 md:h-80 rounded-full border-8 border-primary/20 flex flex-col items-center justify-center p-8 text-center bg-card shadow-2xl">
                  <div className="animate-bounce mb-4">
                    <Pill className="w-16 h-16 text-primary" />
                  </div>
                  <h3 className="text-2xl font-display font-extrabold text-foreground mb-2">Take Your Dose</h3>
                  <p className="text-sm text-muted-foreground font-medium">Pick up the medicine and confirm below.</p>
                </div>
              </div>

              {logError && (
                <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-2xl border border-destructive/20 text-destructive w-full max-w-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-bold">{logError}</p>
                </div>
              )}

              <Button
                onClick={handleComplete}
                disabled={isLogging}
                className="w-full h-16 text-xl rounded-3xl mt-4"
              >
                {isLogging ? (
                  <><Loader2 className="mr-2 w-6 h-6 animate-spin" /> Confirming…</>
                ) : (
                  <>I've Taken It <CheckCircle2 className="ml-2 w-6 h-6" /></>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex flex-col items-center gap-4 opacity-60">
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-1">
              <Clock className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">{scheduledTime}</span>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex flex-col items-center gap-1">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Secured</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
