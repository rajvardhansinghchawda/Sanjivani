import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCw, ArrowRight, Pill, ShieldCheck, LayoutGrid,
  X, Cpu, Loader2, CheckCircle2, Sun, Moon, Play,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import {
  useCaregiverDevices, useDispenserCompartments,
  useQueueCommand, useCompleteFill,
} from '@/hooks/useIoT';

const SLOT_META = {
  morning_before: { label: 'Morning — Before Food', icon: Sun,  color: 'text-amber-500',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30' },
  morning_after:  { label: 'Morning — After Food',  icon: Sun,  color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  night_before:   { label: 'Night — Before Food',   icon: Moon, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  night_after:    { label: 'Night — After Food',    icon: Moon, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
};

// session states
const S = {
  IDLE:     'idle',      // before start — show Start button
  ROTATING: 'rotating',  // command sent, ESP32 rotating (up to 30s)
  OPEN:     'open',      // lid open, user filling pills
  SAVING:   'saving',    // completeFill API call in progress
  DONE:     'done',      // all compartments filled
};

export default function FillingMode() {
  const navigate = useNavigate();
  const { data: devices = [] } = useCaregiverDevices();
  const activeDevice = devices[0];
  const { data: compartments = [], isLoading } = useDispenserCompartments(activeDevice?.id);
  const queueCommand = useQueueCommand();
  const completeFill = useCompleteFill();

  const [sessionState, setSessionState] = useState(S.IDLE);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filled, setFilled] = useState({});  // { [compartmentNum]: true }

  const sorted = [...compartments].sort((a, b) => a.compartment_number - b.compartment_number);
  const total  = sorted.length;
  const current = sorted[currentIndex];
  const meta    = SLOT_META[current?.time_slot] || {};
  const isLast  = currentIndex === total - 1;
  const progress = total > 0 ? (Object.keys(filled).length / total) * 100 : 0;

  // Queue PREPARE_COMPARTMENT → ESP32 closes lid, rotates, opens lid
  async function rotateTo(compartmentNumber) {
    await queueCommand.mutateAsync({
      deviceId: activeDevice.id,
      commandType: 'PREPARE_COMPARTMENT',
      payload: { compartment_number: compartmentNumber },
      expiresInMinutes: 10,
    });
  }

  // Step 1: "Start Filling" — rotate to compartment 1
  async function handleStart() {
    if (!activeDevice || !current) return;
    setSessionState(S.ROTATING);
    try {
      await rotateTo(current.compartment_number);
      setSessionState(S.OPEN);
    } catch {
      setSessionState(S.IDLE);
    }
  }

  // Step N: "Next Compartment" — save current, rotate to next
  async function handleNext() {
    if (!activeDevice || !current) return;
    setSessionState(S.SAVING);
    try {
      // Mark current compartment as filled
      await completeFill.mutateAsync({
        deviceId: activeDevice.id,
        compartmentNumber: current.compartment_number,
      });
      setFilled(f => ({ ...f, [current.compartment_number]: true }));

      // Rotate to next compartment
      const nextIndex = currentIndex + 1;
      const next = sorted[nextIndex];
      setCurrentIndex(nextIndex);
      setSessionState(S.ROTATING);
      await rotateTo(next.compartment_number);
      setSessionState(S.OPEN);
    } catch {
      setSessionState(S.OPEN);
    }
  }

  // Last step: "Finish" — save last, send END_FILL_MODE
  async function handleFinish() {
    if (!activeDevice || !current) return;
    setSessionState(S.SAVING);
    try {
      await completeFill.mutateAsync({
        deviceId: activeDevice.id,
        compartmentNumber: current.compartment_number,
      });
      setFilled(f => ({ ...f, [current.compartment_number]: true }));
      // Tell ESP32 to close lid and end fill session
      await queueCommand.mutateAsync({
        deviceId: activeDevice.id,
        commandType: 'END_FILL_MODE',
        payload: {},
        expiresInMinutes: 10,
      });
      setSessionState(S.DONE);
    } catch {
      setSessionState(S.OPEN);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isLoading && total === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-muted-foreground font-medium mb-4">No compartments set up. Go to Device Manager first.</p>
          <Button onClick={() => navigate('/caregiver/devices')} className="h-11 px-6 rounded-xl font-bold">Open Device Manager</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vw] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl flex flex-col gap-8 relative z-10">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/caregiver/devices')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group">
            <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
            <span className="font-black text-[10px] uppercase tracking-[0.2em]">Exit Fill Mode</span>
          </button>
          <div className="flex items-center gap-1.5 bg-success/10 text-success px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-success/20">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {activeDevice?.device_name || 'No device'}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div className="h-full bg-primary" initial={{ width: 0 }}
            animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
        </div>

        {/* ── DONE state ── */}
        {sessionState === S.DONE && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center gap-6 py-8">
            <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-3xl mb-2">All Slots Filled!</h2>
              <p className="text-muted-foreground font-medium">Dispenser lid is closing. Your device is ready.</p>
            </div>
            <Button onClick={() => navigate('/caregiver/devices')} className="h-12 px-8 rounded-xl font-bold shadow-lg shadow-primary/20">
              <Cpu className="w-4 h-4 mr-2" /> Back to Device Manager
            </Button>
          </motion.div>
        )}

        {/* ── IDLE state — Before session starts ── */}
        {sessionState === S.IDLE && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center gap-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-3">Ready to fill {total} compartments</p>
              <h1 className="text-4xl font-display font-extrabold text-foreground tracking-tight mb-3">Fill Mode</h1>
              <p className="text-muted-foreground font-medium max-w-sm mx-auto">
                The dispenser will rotate each slot under the lid one by one. Fill pills when lid opens.
              </p>
            </div>

            {/* Dispenser preview */}
            <div className="w-48 h-48 rounded-full border-[10px] border-muted bg-card shadow-elevation-2 relative flex items-center justify-center">
              <LayoutGrid className="w-10 h-10 text-muted-foreground/20" />
              {sorted.map((c) => {
                const angle = ((c.compartment_number * 90) - 90) * (Math.PI / 180);
                return (
                  <div key={c.compartment_number}
                    className="absolute w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground"
                    style={{ top: `${50 + 40 * Math.sin(angle)}%`, left: `${50 + 40 * Math.cos(angle)}%`, transform: 'translate(-50%,-50%)' }}>
                    {c.compartment_number}
                  </div>
                );
              })}
            </div>

            <Button onClick={handleStart} className="h-16 px-10 text-xl rounded-3xl shadow-2xl shadow-primary/30 group">
              <Play className="w-6 h-6 mr-3" />
              Start Filling
              <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        )}

        {/* ── ROTATING / OPEN / SAVING states ── */}
        {(sessionState === S.ROTATING || sessionState === S.OPEN || sessionState === S.SAVING) && sessionState !== S.DONE && (
          <AnimatePresence mode="wait">
            <motion.div key={currentIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-8">

              {/* Step label */}
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">
                  Slot {currentIndex + 1} of {total}
                </p>
                <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground tracking-tight mb-2">
                  {meta.label || `Compartment ${current?.compartment_number}`}
                </h1>
              </div>

              {/* Dispenser diagram */}
              <div className="relative flex justify-center py-4">
                <div className="relative w-56 h-56 md:w-72 md:h-72">
                  <motion.div
                    animate={{ rotate: (current?.compartment_number || 1) * 90 }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    className="w-full h-full border-[12px] border-muted rounded-full relative flex items-center justify-center bg-card shadow-elevation-2">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 bg-primary rounded-full shadow-lg" />
                    <LayoutGrid className="w-10 h-10 text-muted-foreground/20" />
                    {sorted.map((c) => {
                      const angle = ((c.compartment_number * 90) - 90) * (Math.PI / 180);
                      const isDone = filled[c.compartment_number];
                      const isActive = c.compartment_number === current?.compartment_number;
                      return (
                        <div key={c.compartment_number}
                          className={`absolute w-8 h-8 flex items-center justify-center rounded-full text-[10px] font-black transition-all
                            ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-primary text-white scale-110' : 'bg-muted text-muted-foreground'}`}
                          style={{ top: `${50 + 40 * Math.sin(angle)}%`, left: `${50 + 40 * Math.cos(angle)}%`, transform: 'translate(-50%,-50%) scale(1)' }}>
                          {isDone ? '✓' : c.compartment_number}
                        </div>
                      );
                    })}
                  </motion.div>

                  {/* ROTATING overlay */}
                  <AnimatePresence>
                    {sessionState === S.ROTATING && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm rounded-full z-20">
                        <RotateCw className="w-10 h-10 text-primary animate-spin mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Rotating...</span>
                        <span className="text-[9px] text-muted-foreground mt-1">ESP32 picks up in ~30s</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Status message */}
              {sessionState === S.ROTATING && (
                <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-5 py-4">
                  <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Command sent to dispenser</p>
                    <p className="text-xs text-muted-foreground font-medium">Lid closing → rotating to slot {current?.compartment_number} → lid will open. Takes up to 30s.</p>
                  </div>
                </div>
              )}

              {sessionState === S.OPEN && (
                <div className={`flex items-center gap-3 ${meta.bg} border ${meta.border} rounded-2xl px-5 py-4`}>
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Lid is open — fill the pills now</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {(current?.sub_compartments || []).map(s => s.medicine_name).join(', ') || 'Add medicines for this slot'}
                    </p>
                  </div>
                </div>
              )}

              {/* Medicines list */}
              {(current?.sub_compartments || []).length > 0 && (
                <div className="space-y-2">
                  {current.sub_compartments.map(sub => (
                    <div key={sub.id} className="flex items-center gap-3 bg-muted/30 rounded-xl p-3 border border-border/40">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Pill className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{sub.medicine_name}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">{sub.total_pills} pills · {sub.quantity_per_dose}× per dose</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Main action button */}
              <Button
                onClick={isLast ? handleFinish : handleNext}
                disabled={sessionState !== S.OPEN}
                className="h-16 text-xl rounded-3xl shadow-2xl shadow-primary/30 group"
              >
                {sessionState === S.SAVING
                  ? <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                  : sessionState === S.ROTATING
                    ? <RotateCw className="w-6 h-6 mr-2 animate-spin" />
                    : isLast
                      ? <CheckCircle2 className="w-6 h-6 mr-2" />
                      : <ArrowRight className="w-6 h-6 mr-2" />
                }
                {sessionState === S.ROTATING
                  ? 'Waiting for dispenser...'
                  : sessionState === S.SAVING
                    ? 'Saving...'
                    : isLast
                      ? 'Done — Close Lid & Finish'
                      : `Done — Next: Slot ${(currentIndex + 2)}`
                }
              </Button>

              {/* Dot progress */}
              <div className="flex justify-center gap-2">
                {sorted.map((c, i) => (
                  <div key={c.compartment_number}
                    className={`h-2 rounded-full transition-all ${i === currentIndex ? 'w-6 bg-primary' : filled[c.compartment_number] ? 'w-2 bg-emerald-500' : 'w-2 bg-muted'}`} />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        <div className="flex items-center justify-center gap-3 opacity-40">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Secure fill workflow</span>
        </div>
      </div>
    </div>
  );
}
