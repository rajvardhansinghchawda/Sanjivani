import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, Smartphone, ShieldCheck, RotateCw,
  ArrowLeft, AlertCircle, Key, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useCaregiverDevices, useDeviceEvents, useDoseAlerts, useUnlockDevice } from '@/hooks/useIoT';

export default function RemoteUnlock() {
  const navigate = useNavigate();
  const { data: devices = [] } = useCaregiverDevices();
  const activeDevice = devices[0];
  const { data: deviceEvents = [] } = useDeviceEvents(activeDevice?.id);
  const { data: doseAlerts } = useDoseAlerts();
  const unlockDevice = useUnlockDevice();
  const [status, setStatus] = useState('locked');

  const attempts = useMemo(() => {
    const events = Array.isArray(deviceEvents) ? deviceEvents : [];
    const tamperCount = events.filter((event) => ['TAMPER', 'COMPARTMENT_OPEN'].includes(event.event_type)).length;
    return tamperCount || (doseAlerts?.count ?? 0) || 0;
  }, [deviceEvents, doseAlerts]);

  const handleUnlock = async () => {
    if (!activeDevice) return;
    setStatus('unlocking');
    try {
      await unlockDevice.mutateAsync(activeDevice.id);
      setStatus('success');
    } catch {
      setStatus('locked');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      <AnimatePresence>
        {status !== 'success' && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-destructive/5 pointer-events-none" />}
      </AnimatePresence>

      <div className="w-full max-w-xl flex flex-col gap-8 relative z-10">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/caregiver/home')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-black text-[10px] uppercase tracking-[0.2em]">Dashboard</span>
          </button>
          <Badge variant="danger" className="h-7 px-3 rounded-full text-[9px] font-black uppercase tracking-widest border-destructive/20">Security Override</Badge>
        </div>

        <div className="text-center flex flex-col gap-3">
          <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground tracking-tight">Security Bypass</h1>
          <p className="text-muted-foreground font-medium text-lg max-w-md mx-auto leading-relaxed">Remote unlock command for the active dispenser gate.</p>
        </div>

        <Card className={`rounded-[3rem] border-none shadow-2xl overflow-hidden transition-all duration-700 ${status === 'success' ? 'bg-success/5 shadow-success/10' : 'bg-destructive/5 shadow-destructive/10'}`}>
          <CardContent className="p-12 flex flex-col items-center text-center gap-8">
            <div className="relative">
              <AnimatePresence mode="wait">
                {status === 'locked' && (
                  <motion.div key="locked" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }} className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] bg-destructive flex items-center justify-center text-white shadow-2xl shadow-destructive/40">
                    <Lock className="w-16 h-16" />
                  </motion.div>
                )}
                {status === 'unlocking' && (
                  <motion.div key="unlocking" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }} className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] bg-primary flex items-center justify-center text-white shadow-2xl shadow-primary/40 relative">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 border-8 border-white/20 border-t-white rounded-[2.5rem]" />
                    <RotateCw className="w-16 h-16" />
                  </motion.div>
                )}
                {status === 'success' && (
                  <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] bg-success flex items-center justify-center text-white shadow-2xl shadow-success/40">
                    <Unlock className="w-16 h-16 animate-pulse" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className={`text-2xl font-display font-black tracking-tight ${status === 'success' ? 'text-success' : 'text-destructive'}`}>
                {status === 'locked' ? 'Gate Securely Locked' : status === 'unlocking' ? 'Sending Remote Signal...' : 'Gate Unlocked ✓'}
              </h3>
              <p className="text-sm text-muted-foreground font-medium max-w-xs mx-auto leading-relaxed">
                {activeDevice ? `${activeDevice.device_name} · ${activeDevice.is_online ? 'Online' : 'Offline'} · ${attempts} recent anomaly events` : 'Link a dispenser to enable remote unlock.'}
              </p>
            </div>

            {status === 'locked' && (
              <div className="p-4 bg-destructive/10 rounded-2xl flex items-center gap-3 text-destructive border border-destructive/20 w-full">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-widest text-left">Confirming your identity via clinical account session...</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {status === 'locked' ? (
              <Button onClick={handleUnlock} className="h-16 text-lg rounded-3xl bg-destructive hover:bg-destructive/90 shadow-2xl shadow-destructive/20 group" disabled={!activeDevice || unlockDevice.isPending}>
                {unlockDevice.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                Unlock Device Gate <Key className="ml-2 w-5 h-5 group-hover:rotate-12 transition-transform" />
              </Button>
            ) : status === 'success' ? (
              <Button onClick={() => navigate('/caregiver/home')} className="h-16 text-lg rounded-3xl shadow-2xl shadow-primary/20">
                Return to Dashboard <ShieldCheck className="ml-2 w-5 h-5" />
              </Button>
            ) : null}
          </AnimatePresence>

          <div className="flex items-center justify-center gap-6 opacity-40">
            <div className="flex items-center gap-1.5"><Smartphone className="w-4 h-4" /><span className="text-[9px] font-black uppercase tracking-widest">Linked Device</span></div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /><span className="text-[9px] font-black uppercase tracking-widest">Session Verified</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
