import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Pill, Calendar, Clock,
  Trash2, PauseCircle, PlayCircle, AlertTriangle, Loader2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  usePrescriptions,
  usePatchPrescription,
  useDeletePrescription,
} from '@/hooks/usePrescriptions';

// ─── Normalise a backend prescription to what the card needs ─────────────────

function normalise(rx) {
  return {
    id:            rx.id,
    name:          rx.medication?.name ?? '(unknown)',
    dosage:        `${rx.dosage_value ?? ''} ${rx.dosage_unit ?? ''}`.trim(),
    frequency:     rx.schedules?.[0]?.frequency_type ?? 'As prescribed',
    startDate:     rx.start_date?.slice(0, 10) ?? '—',
    prescribedBy:  rx.prescribed_by ?? '—',
    instructions:  rx.special_instructions ?? rx.instructions ?? '',
    status:        rx.is_active ? 'active' : 'paused',
    medicationId:  rx.medication?.id,
    raw:           rx,
  };
}

// ─── Medicine Card ────────────────────────────────────────────────────────────

const MedicineCard = ({ med, onDelete, onTogglePause, isUpdating }) => (
  <Card className="group">
    <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0 shadow-sm">
        <Pill className="w-8 h-8" />
      </div>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-display font-bold text-foreground truncate">{med.name}</h3>
          <Badge variant={med.status === 'active' ? 'primary' : 'warning'}>{med.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary/60" /> {med.dosage} • {med.frequency}</span>
          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-primary/60" /> Since {med.startDate}</span>
          {med.prescribedBy && med.prescribedBy !== '—' && (
            <span className="flex items-center gap-1.5 text-foreground/70 font-semibold italic">Dr. {med.prescribedBy}</span>
          )}
        </div>
        {med.instructions ? (
          <p className="text-xs text-muted-foreground mt-1 italic">{med.instructions}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <Button
          variant="ghost"
          className="p-2 h-10 w-10 rounded-full"
          title={med.status === 'active' ? 'Pause' : 'Resume'}
          onClick={() => onTogglePause(med.id, med.status)}
          disabled={isUpdating}
        >
          {med.status === 'active' ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4 text-emerald-500" />}
        </Button>
        <Button
          variant="ghost"
          className="p-2 h-10 w-10 rounded-full text-destructive"
          title="Remove"
          onClick={() => onDelete(med.id)}
          disabled={isUpdating}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </CardContent>
  </Card>
);

export default function MedicineManagement() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'paused'

  const { data: prescriptions = [], isLoading, isError } = usePrescriptions();
  const patchMutation    = usePatchPrescription();
  const deleteMutation   = useDeletePrescription();

  const isMutating = patchMutation.isPending || deleteMutation.isPending;

  // Normalise and filter
  const allMeds = prescriptions.map(normalise);
  const filtered = allMeds
    .filter(m => filterStatus === 'all' || m.status === filterStatus)
    .filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.prescribedBy.toLowerCase().includes(search.toLowerCase()));

  const handleTogglePause = async (id, currentStatus) => {
    try {
      await patchMutation.mutateAsync({ id, is_active: currentStatus !== 'active' });
    } catch { /* silent – UI reverts via react-query */ }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this prescription? This cannot be undone.')) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch { /* silent */ }
  };

  return (
    <div className="flex flex-col gap-8 py-4">
      <Card className="bg-background border-border/40 p-2">
        <div className="flex flex-col md:flex-row gap-4 p-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, doctor or dosage..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card border border-border/50 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-sans font-medium"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex bg-muted p-1 rounded-xl">
              {['all', 'active', 'paused'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-all capitalize ${filterStatus === s ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading prescriptions…</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 bg-destructive/10 text-destructive rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="font-medium">Could not load prescriptions. Check your connection and try again.</span>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
          <Pill className="w-12 h-12 opacity-30" />
          <p className="font-medium">{search ? 'No matches found.' : 'No medications available.'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map(med => (
            <motion.div
              key={med.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              layout
            >
              <MedicineCard
                med={med}
                onDelete={handleDelete}
                onTogglePause={handleTogglePause}
                isUpdating={isMutating}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
