import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, AlertTriangle, Trash2, Hospital, Activity, Calendar,
  Loader2, Check
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  useConditions,
  useCreateCondition,
  useDeleteCondition,
  useHospitalize,
  useDischarge,
  usePatientHospitalizationStatus,
} from '@/hooks/useConditions';

const ConditionForm = ({ onSubmit, onClose, isLoading }) => {
  const [formData, setFormData] = useState({
    name: '',
    diagnosed_date: new Date().toISOString().split('T')[0],
    description: '',
    severity: 'MODERATE',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ name: '', diagnosed_date: new Date().toISOString().split('T')[0], description: '', severity: 'MODERATE' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card w-full max-w-md rounded-2xl shadow-elevation-3 relative z-10 overflow-hidden"
      >
        <div className="p-6 border-b border-border/50 flex justify-between items-center bg-primary text-white">
          <h2 className="text-xl font-display font-bold">Add Health Condition</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-5">
          <Input
            label="Condition Name"
            placeholder="e.g. Hypertension, Diabetes"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <Input
            label="Diagnosed Date"
            type="date"
            value={formData.diagnosed_date}
            onChange={(e) => setFormData((prev) => ({ ...prev, diagnosed_date: e.target.value }))}
          />
          <div>
            <label className="text-sm font-bold text-foreground mb-2 block">Severity</label>
            <select
              value={formData.severity}
              onChange={(e) => setFormData((prev) => ({ ...prev, severity: e.target.value }))}
              className="w-full px-4 py-2 bg-background border border-border/50 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-sans"
            >
              <option value="MILD">Mild</option>
              <option value="MODERATE">Moderate</option>
              <option value="SEVERE">Severe</option>
            </select>
          </div>
          <Input
            label="Notes (optional)"
            placeholder="Additional details..."
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          />
          <div className="flex gap-4 mt-2">
            <Button variant="outline" type="button" className="flex-1 h-12" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 h-12" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Condition
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const ConditionCard = ({ condition, onDelete, isDeleting }) => {
  const severityColor = {
    'MILD': 'bg-success/10 border-success/30 text-success',
    'MODERATE': 'bg-accent/10 border-accent/30 text-accent',
    'SEVERE': 'bg-destructive/10 border-destructive/30 text-destructive',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      layout
    >
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-display font-bold text-foreground">{condition.name}</h3>
                <Badge className={`${severityColor[condition.severity] || 'bg-muted'} border`}>
                  {condition.severity}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground font-medium">
                {condition.diagnosed_date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> Diagnosed: {new Date(condition.diagnosed_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              {condition.description && (
                <p className="text-sm text-muted-foreground mt-2 italic">{condition.description}</p>
              )}
            </div>
            <Button
              variant="ghost"
              className="p-2 h-10 w-10 rounded-full text-destructive"
              onClick={() => onDelete(condition.id)}
              disabled={isDeleting}
              title="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const HospitalizationStatus = ({ status, onHospitalize, onDischarge, isUpdating }) => {
  const isHospitalized = status?.is_hospitalized;

  return (
    <Card className={`border-2 ${isHospitalized ? 'border-accent/40 bg-accent/5' : 'border-success/40 bg-success/5'}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Hospital className={`w-5 h-5 ${isHospitalized ? 'text-accent' : 'text-success'}`} />
          <h3 className="text-xl font-display font-bold">Hospitalization Status</h3>
        </div>
      </CardHeader>
      <CardContent className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Current Status</p>
            <div className="flex items-center gap-2">
              {isHospitalized ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-accent" />
                  <span className="font-bold text-accent">Currently Hospitalized</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 text-success" />
                  <span className="font-bold text-success">Not Hospitalized</span>
                </>
              )}
            </div>
          </div>
        </div>

        {isHospitalized && status?.hospitalized_since && (
          <div className="p-3 bg-background rounded-lg text-sm text-muted-foreground">
            Hospitalized since: <span className="font-semibold text-foreground">{new Date(status.hospitalized_since).toLocaleDateString()}</span>
            {status?.hospital_name && <div className="mt-1">Hospital: <span className="font-semibold">{status.hospital_name}</span></div>}
            {status?.discharge_expected_at && <div className="mt-1">Expected discharge: <span className="font-semibold">{new Date(status.discharge_expected_at).toLocaleDateString()}</span></div>}
          </div>
        )}

        <div className="flex gap-3">
          {!isHospitalized ? (
            <Button
              className="flex-1 h-11"
              onClick={() => onHospitalize({ hospitalized_since: new Date().toISOString() })}
              disabled={isUpdating}
              variant="secondary"
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
              Mark as Hospitalized
            </Button>
          ) : (
            <Button
              className="flex-1 h-11"
              onClick={() => onDischarge()}
              disabled={isUpdating}
              variant="outline"
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Mark as Discharged
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function Conditions() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: conditions = [], isLoading, isError } = useConditions();
  const { data: patientStatus } = usePatientHospitalizationStatus();
  const createCondition = useCreateCondition();
  const deleteCondition = useDeleteCondition();
  const hospitalize = useHospitalize();
  const discharge = useDischarge();

  const filtered = conditions.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = async (formData) => {
    try {
      await createCondition.mutateAsync(formData);
      setIsModalOpen(false);
    } catch (err) {
      alert(err?.message || 'Failed to add condition');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this condition?')) return;
    try {
      await deleteCondition.mutateAsync(id);
    } catch (err) {
      alert(err?.message || 'Failed to delete condition');
    }
  };

  const handleHospitalize = async (data) => {
    try {
      await hospitalize.mutateAsync(data);
    } catch (err) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDischarge = async () => {
    if (!window.confirm('Mark as discharged?')) return;
    try {
      await discharge.mutateAsync();
    } catch (err) {
      alert(err?.message || 'Failed to update status');
    }
  };

  return (
    <div className="flex flex-col gap-8 py-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsModalOpen(true)} className="h-12 px-6 rounded-xl shadow-lg">
          <Plus className="w-5 h-5 mr-2" /> Add Condition
        </Button>
      </div>

      {/* Hospitalization Status Card */}
      <HospitalizationStatus
        status={patientStatus}
        onHospitalize={handleHospitalize}
        onDischarge={handleDischarge}
        isUpdating={hospitalize.isPending || discharge.isPending}
      />

      {/* Conditions List */}
      <Card className="bg-background border-border/40 p-2">
        <div className="p-4">
          <input
            type="text"
            placeholder="Search conditions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-card border border-border/50 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-sans font-medium"
          />
        </div>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading conditions…</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 bg-destructive/10 text-destructive rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="font-medium">Could not load conditions. Try again.</span>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
          <Activity className="w-12 h-12 opacity-30" />
          <p className="font-medium">{searchTerm ? 'No matches found.' : 'No conditions recorded yet.'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((condition) => (
            <ConditionCard
              key={condition.id}
              condition={condition}
              onDelete={handleDelete}
              isDeleting={deleteCondition.isPending}
            />
          ))}
        </AnimatePresence>
      </div>

      {isModalOpen && (
        <ConditionForm
          onSubmit={handleAdd}
          onClose={() => setIsModalOpen(false)}
          isLoading={createCondition.isPending}
        />
      )}
    </div>
  );
}
