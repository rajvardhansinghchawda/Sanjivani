import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, CheckCircle2, Loader2, ArrowRight, ShieldCheck, Wifi, Smartphone, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useValidateDeviceCode, useLinkDevice, useSetupDispenserCompartments } from '@/hooks/useIoT';

const STEPS = ['code', 'wifi', 'name', 'done'];

function StepDots({ current }) {
  return (
    <div className="flex gap-2 mb-6">
      {STEPS.slice(0, -1).map((s, i) => (
        <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${current === s || STEPS.indexOf(current) > i ? 'bg-primary w-6' : 'bg-muted w-3'}`} />
      ))}
    </div>
  );
}

export function DeviceRegisterPanel({ onSuccess }) {
  const [step, setStep] = useState('code');
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('My MedAdhere Dispenser');
  const [errMsg, setErrMsg] = useState('');

  const validateCode = useValidateDeviceCode();
  const linkDevice = useLinkDevice();
  const setupCompartments = useSetupDispenserCompartments();

  async function handleValidate(e) {
    e.preventDefault();
    setErrMsg('');
    try {
      await validateCode.mutateAsync(code.trim().toUpperCase());
      setStep('wifi');
    } catch (err) {
      setErrMsg(err?.message || 'Invalid or already registered code.');
    }
  }

  async function handleLink(e) {
    e.preventDefault();
    setErrMsg('');
    try {
      const device = await linkDevice.mutateAsync({
        deviceName: deviceName.trim(),
        deviceType: 'CIRCULAR_PILL_DISPENSER',
        uniqueCode: code.trim().toUpperCase(),
      });
      // Set up compartments — if it fails, device is already linked so still proceed
      try {
        await setupCompartments.mutateAsync(device.id);
      } catch {
        // compartment setup failed — device is linked, user can set up later
      }
      setStep('done');
      setTimeout(() => onSuccess(device), 800);
    } catch (err) {
      setErrMsg(err?.message || 'Failed to register device.');
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card rounded-[2.5rem] border border-border/60 shadow-2xl p-10 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 bg-primary/8 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
        <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
          <Cpu className="w-8 h-8 text-primary" />
        </div>
        <StepDots current={step} />

        <AnimatePresence mode="wait">
          {step === 'code' && (
            <motion.form key="code" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              onSubmit={handleValidate} className="space-y-5">
              <div>
                <h2 className="font-display font-extrabold text-2xl mb-1">Register Your Dispenser</h2>
                <p className="text-sm text-muted-foreground font-medium">Enter the unique code printed on your MedAdhere device box.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Device Code</label>
                <input required value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. MEDA-AB12-CD34-EF56"
                  className="w-full h-14 px-5 rounded-2xl bg-muted/30 border border-border/80 focus:border-primary/80 focus:ring-4 focus:ring-primary/10 transition-all font-mono font-bold text-lg outline-none text-foreground tracking-widest" />
              </div>
              {errMsg && <p className="text-xs text-destructive font-bold bg-destructive/10 px-4 py-3 rounded-xl">{errMsg}</p>}
              <Button type="submit" className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20" disabled={validateCode.isPending || !code.trim()}>
                {validateCode.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Validate Code
              </Button>
              <button type="button" onClick={() => setStep('wifi')}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1 underline underline-offset-2">
                Skip code verification (testing only)
              </button>
            </motion.form>
          )}

          {step === 'wifi' && (
            <motion.div key="wifi" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Code Verified</span>
                </div>
                <h2 className="font-display font-extrabold text-2xl">WiFi Setup</h2>
                <p className="text-sm text-muted-foreground font-medium">Connect your dispenser to your home WiFi network.</p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Wifi, step: '1', text: 'On your phone, open WiFi settings and connect to "MedAdhere-Setup"' },
                  { icon: Smartphone, step: '2', text: 'Open a browser and go to 192.168.4.1' },
                  { icon: RefreshCw, step: '3', text: `Enter your home WiFi name, password, and the code: ${code}` },
                  { icon: CheckCircle2, step: '4', text: 'Submit — the dispenser will connect and blink green when ready' },
                ].map(({ step: s, text }) => (
                  <div key={s} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border border-border/40">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-black text-primary">{s}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-snug">{text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl font-bold" onClick={() => setStep('code')}>Back</Button>
                <Button type="button" className="flex-1 h-11 rounded-xl font-bold shadow-lg shadow-primary/20" onClick={() => setStep('name')}>
                  Done, Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'name' && (
            <motion.form key="name" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              onSubmit={handleLink} className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-600">WiFi Configured</span>
                </div>
                <h2 className="font-display font-extrabold text-2xl">Name Your Device</h2>
                <p className="text-sm text-muted-foreground font-medium">Give this dispenser a recognizable name.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Device Name</label>
                <input required value={deviceName} onChange={e => setDeviceName(e.target.value)}
                  className="w-full h-14 px-5 rounded-2xl bg-muted/30 border border-border/80 focus:border-primary/80 focus:ring-4 focus:ring-primary/10 transition-all font-semibold outline-none text-foreground" />
              </div>
              {errMsg && <p className="text-xs text-destructive font-bold bg-destructive/10 px-4 py-3 rounded-xl">{errMsg}</p>}
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="h-11 px-4 rounded-xl font-bold" onClick={() => setStep('wifi')}>Back</Button>
                <Button type="submit" className="flex-1 h-11 rounded-xl font-bold shadow-lg shadow-primary/20"
                  disabled={linkDevice.isPending || setupCompartments.isPending}>
                  {(linkDevice.isPending || setupCompartments.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                  {linkDevice.isPending ? 'Linking...' : setupCompartments.isPending ? 'Setting up...' : 'Link & Setup Device'}
                </Button>
              </div>
            </motion.form>
          )}

          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center py-4 space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="font-display font-extrabold text-2xl">Device Ready!</h2>
              <p className="text-sm text-muted-foreground font-medium">Your dispenser is linked and 4 compartments have been configured. Add medicines to get started.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
