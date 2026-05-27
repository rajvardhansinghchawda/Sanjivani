import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pill, X, Loader2, Plus, Trash2, Weight, Scale, CheckCircle2, Clock, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAddMedicineToCompartment, useRemoveMedicineFromCompartment, useTriggerWeightMeasure, useCompleteFill } from '@/hooks/useIoT';

const SLOT_META = {
  morning_before: { label: 'Morning — Before Food', icon: Sun, time: '08:00', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  morning_after:  { label: 'Morning — After Food',  icon: Sun, time: '09:00', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  night_before:   { label: 'Night — Before Food',   icon: Moon, time: '20:00', color: 'text-violet-500', bg: 'bg-violet-500/10' },
  night_after:    { label: 'Night — After Food',    icon: Moon, time: '21:00', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
};

function AddMedicineModal({ deviceId, compartment, onClose }) {
  const [form, setForm] = useState({ medicine_name: '', quantity_per_dose: 1, duration_days: 7, total_pills: 7, instructions: '' });
  const addMedicine = useAddMedicineToCompartment();
  const [success, setSuccess] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await addMedicine.mutateAsync({ deviceId, compartmentNum: compartment.compartment_number, data: { ...form, total_pills: Number(form.total_pills), quantity_per_dose: Number(form.quantity_per_dose), duration_days: Number(form.duration_days) } });
    setSuccess(result?.message || 'Medicine added. Now add pills and measure weight.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-card rounded-[2rem] border border-border/60 shadow-2xl p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-display font-extrabold text-xl">Add Medicine</h3>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Compartment {compartment.compartment_number} · {SLOT_META[compartment.time_slot]?.label}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted/40 hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        {success ? (
          <div className="flex flex-col items-center text-center py-6 gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="w-8 h-8 text-emerald-500" /></div>
            <p className="text-sm font-semibold text-foreground">{success}</p>
            <Button onClick={onClose} className="h-10 px-6 rounded-xl font-bold">Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground">Medicine Name<input required value={form.medicine_name} onChange={e => set('medicine_name', e.target.value)} className="mt-2 w-full h-12 px-4 rounded-xl border border-border/80 bg-muted/30 outline-none font-semibold text-foreground focus:border-primary/80" /></label>
            <div className="grid grid-cols-3 gap-3">
              <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground">Qty/Dose<input type="number" min={1} value={form.quantity_per_dose} onChange={e => set('quantity_per_dose', e.target.value)} className="mt-2 w-full h-12 px-4 rounded-xl border border-border/80 bg-muted/30 outline-none font-semibold text-foreground focus:border-primary/80" /></label>
              <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground">Days<input type="number" min={1} value={form.duration_days} onChange={e => set('duration_days', e.target.value)} className="mt-2 w-full h-12 px-4 rounded-xl border border-border/80 bg-muted/30 outline-none font-semibold text-foreground focus:border-primary/80" /></label>
              <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground">Total Pills<input type="number" min={1} value={form.total_pills} onChange={e => set('total_pills', e.target.value)} className="mt-2 w-full h-12 px-4 rounded-xl border border-border/80 bg-muted/30 outline-none font-semibold text-foreground focus:border-primary/80" /></label>
            </div>
            <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground">Instructions (optional)<textarea value={form.instructions} onChange={e => set('instructions', e.target.value)} rows={2} className="mt-2 w-full px-4 py-3 rounded-xl border border-border/80 bg-muted/30 outline-none font-medium text-foreground text-sm focus:border-primary/80 resize-none" /></label>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl font-bold" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1 h-11 rounded-xl font-bold shadow-lg shadow-primary/20" disabled={addMedicine.isPending}>
                {addMedicine.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Add Medicine
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

function SubMedicineRow({ deviceId, compartmentNum, sub }) {
  const remove = useRemoveMedicineFromCompartment();
  const measureWeight = useTriggerWeightMeasure();
  const [measured, setMeasured] = useState(false);

  async function handleMeasure() {
    await measureWeight.mutateAsync({ deviceId, compartmentNum, medicineId: sub.id });
    setMeasured(true);
  }

  const isWeighed = sub.pill_weight_grams > 0;
  return (
    <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border border-border/40">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5"><Pill className="w-4 h-4 text-primary" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">{sub.medicine_name}</p>
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          {sub.quantity_per_dose}× · {sub.duration_days}d · {sub.total_pills} pills
          {isWeighed && ` · ${sub.pill_weight_grams}g/pill`}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!isWeighed && (
          <button onClick={handleMeasure} disabled={measureWeight.isPending} title="Measure weight via load cell"
            className="flex items-center gap-1 h-7 px-2 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary hover:text-white transition-all">
            {measureWeight.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scale className="w-3 h-3" />}
            {measured ? 'Sent' : 'Weigh'}
          </button>
        )}
        {isWeighed && <div className="flex items-center gap-1 h-7 px-2 rounded-lg bg-emerald-500/10 text-emerald-600 text-[10px] font-black"><Weight className="w-3 h-3" />{sub.pill_weight_grams}g</div>}
        <button onClick={() => remove.mutateAsync({ deviceId, compartmentNum, medicineId: sub.id })}
          className="w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all">
          {remove.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}

function CompartmentCard({ deviceId, comp }) {
  const [addOpen, setAddOpen] = useState(false);
  const completeFill = useCompleteFill();
  const meta = SLOT_META[comp.time_slot] || {};
  const Icon = meta.icon || Clock;
  const subs = comp.sub_compartments || [];
  const allWeighed = subs.length > 0 && subs.every(s => s.pill_weight_grams > 0);

  return (
    <>
      <div className="bg-card rounded-[2rem] border border-border/50 overflow-hidden shadow-sm hover:shadow-elevation-2 transition-all">
        <div className={`p-5 flex items-center gap-3 border-b border-border/40 ${meta.bg}`}>
          <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center`}><Icon className={`w-5 h-5 ${meta.color}`} /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2"><span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Slot {comp.compartment_number}</span>
              {comp.last_filled_at && <Badge variant="success" className="h-4 px-2 text-[9px]">Filled</Badge>}
            </div>
            <p className="text-sm font-bold text-foreground truncate">{meta.label}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{meta.time} · {subs.length} medicine{subs.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {subs.length === 0 && <p className="text-xs text-muted-foreground text-center py-3 font-medium">No medicines added yet</p>}
          {subs.map(sub => <SubMedicineRow key={sub.id} deviceId={deviceId} compartmentNum={comp.compartment_number} sub={sub} />)}
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <Button variant="outline" className="flex-1 h-9 rounded-xl text-xs font-bold border-primary/20 text-primary" onClick={() => setAddOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Add Medicine
          </Button>
          {allWeighed && !comp.last_filled_at && (
            <Button className="h-9 px-4 rounded-xl text-xs font-bold shadow-md shadow-primary/20"
              onClick={() => completeFill.mutateAsync({ deviceId, compartmentNumber: comp.compartment_number })}
              disabled={completeFill.isPending}>
              {completeFill.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
              Confirm Fill
            </Button>
          )}
        </div>
      </div>
      <AnimatePresence>{addOpen && <AddMedicineModal deviceId={deviceId} compartment={comp} onClose={() => setAddOpen(false)} />}</AnimatePresence>
    </>
  );
}

export function DispenserGrid({ deviceId, compartments }) {
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
      {compartments.map(comp => <CompartmentCard key={comp.id} deviceId={deviceId} comp={comp} />)}
    </div>
  );
}
