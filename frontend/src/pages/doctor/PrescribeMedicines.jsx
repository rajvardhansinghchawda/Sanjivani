import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Pill, Save, ArrowLeft, LayoutGrid,
  Info, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { useDoctorPatients, useCreateDigitalPrescription } from '@/hooks/useDoctor';

const TIMING_OPTIONS = [
  { label: 'Empty Stomach', value: 'Empty Stomach' },
  { label: 'After Food',    value: 'After Food' },
  { label: 'Before Sleep',  value: 'Before Sleep' },
  { label: 'With Food',     value: 'With Food' },
];

const FREQ_OPTIONS = [
  { label: '1 Time Daily',  value: '1' },
  { label: '2 Times Daily', value: '2' },
  { label: '3 Times Daily', value: '3' },
];

const SLOT_OPTIONS = [1, 2, 3, 4].map(n => ({ label: `Slot ${n}`, value: String(n) }));

const today = () => new Date().toISOString().split('T')[0];

export default function PrescribeMedicines() {
  const { id }     = useParams();  // link ID
  const navigate   = useNavigate();
  const mutation   = useCreateDigitalPrescription();

  const { data: patients = [] } = useDoctorPatients();
  const patient = patients.find(p => String(p.id) === String(id));

  const [prescriptions, setPrescriptions] = useState([
    { _key: Date.now(), name: '', dosage: '', frequency: '1', timing: 'After Food', slot: '1', pillCount: '', startDate: today(), endDate: '', notes: '' },
  ]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]   = useState('');

  const addRow = () => setPrescriptions(prev => [
    ...prev,
    { _key: Date.now(), name: '', dosage: '', frequency: '1', timing: 'After Food', slot: String((prev.length % 4) + 1), pillCount: '', startDate: today(), endDate: '', notes: '' },
  ]);

  const removeRow = (key) => setPrescriptions(prev => prev.filter(p => p._key !== key));

  const update = (key, field, value) =>
    setPrescriptions(prev => prev.map(p => p._key === key ? { ...p, [field]: value } : p));

  const handleSave = async () => {
    setError('');
    if (!patient) { setError('Patient not found.'); return; }

    const invalid = prescriptions.find(p => !p.name.trim() || !p.dosage.trim());
    if (invalid) { setError('All medications must have a name and dosage.'); return; }

    try {
      await Promise.all(prescriptions.map(p =>
        mutation.mutateAsync({
          patient:         patient.patientId,
          medication_name: p.name.trim(),
          dosage:          p.dosage.trim(),
          instructions:    `${p.timing} • ${p.frequency}x daily • Slot ${p.slot}${p.notes ? ' — ' + p.notes : ''}`,
          start_date:      p.startDate,
          end_date:        p.endDate || null,
          notes:           p.notes || null,
          compartment_number: p.slot ? parseInt(p.slot, 10) : null,
          current_pill_count: p.pillCount ? parseInt(p.pillCount, 10) : null,
        })
      ));
      setSubmitted(true);
      setTimeout(() => navigate(`/doctor/patient/${id}`), 1800);
    } catch (err) {
      setError(err?.message || 'Failed to save prescriptions. Please try again.');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 text-center p-12"
        >
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-2xl font-display font-black text-foreground">Prescription Sent!</h2>
          <p className="text-muted-foreground font-medium">Redirecting to patient profile…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-4 max-w-5xl mx-auto">
      <div className="flex flex-col gap-6">
        <button
          onClick={() => navigate(`/doctor/patient/${id}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Patient Profile</span>
        </button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-4xl font-display font-extrabold text-foreground tracking-tight flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Pill className="w-6 h-6 text-primary" />
              </div>
              New Prescription
            </h2>
            <p className="text-muted-foreground font-medium text-lg mt-1">
              {patient ? `For ${patient.name}` : `Patient #${id}`}
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="h-14 px-10 rounded-2xl shadow-2xl shadow-primary/30 font-black uppercase tracking-widest text-xs"
          >
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Finalize &amp; Send</>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-2xl border border-destructive/20 text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <AnimatePresence mode="popLayout">
            {prescriptions.map((p, idx) => (
              <motion.div
                key={p._key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                layout
              >
                <Card className="rounded-[2.5rem] border-border/60 hover:border-primary/30 transition-all shadow-sm">
                  <CardContent className="p-8">
                    <div className="flex justify-between items-center mb-8">
                      <Badge variant="primary" className="h-8 px-4 rounded-full font-black text-xs uppercase tracking-widest">
                        Medication {idx + 1}
                      </Badge>
                      <button
                        onClick={() => removeRow(p._key)}
                        disabled={prescriptions.length === 1}
                        className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input
                        label="Medicine Name"
                        placeholder="e.g. Atorvastatin"
                        value={p.name}
                        onChange={(e) => update(p._key, 'name', e.target.value)}
                      />
                      <Input
                        label="Dosage"
                        placeholder="e.g. 20mg"
                        value={p.dosage}
                        onChange={(e) => update(p._key, 'dosage', e.target.value)}
                      />
                      <Select
                        label="Daily Frequency"
                        options={FREQ_OPTIONS}
                        value={p.frequency}
                        onChange={(e) => update(p._key, 'frequency', e.target.value)}
                      />
                      <Select
                        label="Hardware Slot Mapping"
                        options={SLOT_OPTIONS}
                        value={p.slot}
                        onChange={(e) => update(p._key, 'slot', e.target.value)}
                      />
                      <Input
                        label="Initial Pill Count"
                        type="number"
                        placeholder="e.g. 30"
                        value={p.pillCount}
                        onChange={(e) => update(p._key, 'pillCount', e.target.value)}
                      />
                      <Select
                        label="Timing Preference"
                        options={TIMING_OPTIONS}
                        value={p.timing}
                        onChange={(e) => update(p._key, 'timing', e.target.value)}
                      />
                      <Input
                        label="Start Date"
                        type="date"
                        value={p.startDate}
                        onChange={(e) => update(p._key, 'startDate', e.target.value)}
                      />
                      <div className="md:col-span-2">
                        <Input
                          label="Notes (optional)"
                          placeholder="Additional instructions for patient"
                          value={p.notes}
                          onChange={(e) => update(p._key, 'notes', e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          <button
            onClick={addRow}
            className="w-full py-6 rounded-[2rem] border-2 border-dashed border-border/60 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-3 font-display font-bold text-xl"
          >
            <Plus className="w-6 h-6" /> Add Another Medication
          </button>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Dispenser Map */}
          <Card className="rounded-[2.5rem] bg-secondary/30 border-primary/20">
            <CardHeader className="p-8 pb-0">
              <h3 className="font-display font-bold text-lg flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-primary" /> Dispenser Mapping
              </h3>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(slot => {
                  const assigned = prescriptions.find(p => p.slot === String(slot));
                  return (
                    <div key={slot} className={`aspect-square rounded-2xl border flex flex-col items-center justify-center gap-1 p-2 text-center
                      ${assigned ? 'bg-primary/10 border-primary/30' : 'bg-white border-border/40 border-dashed'}`}>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${assigned ? 'text-primary' : 'text-muted-foreground'}`}>
                        Slot {slot}
                      </span>
                      {assigned ? (
                        <p className="text-[10px] font-bold text-foreground truncate w-full text-center">{assigned.name || 'Untitled'}</p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground opacity-40">Empty</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex items-start gap-3 p-4 bg-white rounded-2xl border border-primary/10">
                <Info className="w-5 h-5 text-primary shrink-0" />
                <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                  Mapping medicines to physical slots ensures the dispenser rotates correctly during the patient's schedule.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Patient Info */}
          {patient && (
            <Card className="rounded-[2.5rem]">
              <CardContent className="p-8">
                <h3 className="font-display font-bold text-lg mb-4">Prescribing For</h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl">
                    {patient.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{patient.name}</p>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{patient.patientCode}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
