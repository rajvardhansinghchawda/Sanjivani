import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Heart, Droplet, Activity, Thermometer, Plus, Trash2, Target, TrendingUp, TrendingDown
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { useVitalReadings, useAddVitalReading, useVitalTargets } from '@/hooks/useVitals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const VITAL_TYPES = [
  { key: 'HEART_RATE',    label: 'Heart Rate',    unit: 'bpm',    Icon: Heart,       color: '#ef4444', chartColor: '#f87171' },
  { key: 'BLOOD_PRESSURE',label: 'Blood Pressure', unit: 'mmHg',   Icon: Activity,    color: '#8b5cf6', chartColor: '#a78bfa' },
  { key: 'BLOOD_GLUCOSE', label: 'Blood Glucose',  unit: 'mg/dL',  Icon: Droplet,     color: '#f59e0b', chartColor: '#fbbf24' },
  { key: 'TEMPERATURE',   label: 'Temperature',    unit: '°C',     Icon: Thermometer, color: '#10b981', chartColor: '#34d399' },
];

const FIELD_MAP = {
  HEART_RATE:     ['value'],
  BLOOD_PRESSURE: ['systolic', 'diastolic'],
  BLOOD_GLUCOSE:  ['value'],
  TEMPERATURE:    ['value'],
};

function VitalCard({ vt, readings, targets }) {
  const { key, label, unit, Icon, color, chartColor } = vt;
  const myReadings = readings.filter(r => r.vital_type === key).slice(-14);
  const myTarget   = targets.find(t => t.vital_type === key);

  const latest = myReadings[myReadings.length - 1];
  const prev   = myReadings[myReadings.length - 2];
  const diff   = latest && prev ? (latest.value - prev.value) : null;

  const chartData = myReadings.map(r => ({
    time:     new Date(r.recorded_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    value:    r.value,
    systolic: r.systolic,
    diastolic:r.diastolic,
  }));

  return (
    <Card className="flex flex-col gap-0 overflow-hidden border-border/50 hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2 pt-5 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <CardTitle className="text-base font-bold">{label}</CardTitle>
              <p className="text-xs text-muted-foreground">{unit}</p>
            </div>
          </div>
          {latest && (
            <div className="text-right">
              <p className="text-2xl font-display font-bold" style={{ color }}>
                {key === 'BLOOD_PRESSURE' ? `${latest.systolic}/${latest.diastolic}` : latest.value}
              </p>
              {diff !== null && (
                <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  {diff > 0 ? <TrendingUp className="w-3 h-3 text-rose-500" /> : <TrendingDown className="w-3 h-3 text-emerald-500" />}
                  <span>{diff > 0 ? '+' : ''}{diff.toFixed(1)} since last</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        {myTarget && (
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Target: {myTarget.min_value}–{myTarget.max_value} {unit}
            </span>
          </div>
        )}
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
              <XAxis dataKey="time" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--color-border)' }}
              />
              {myTarget && (
                <>
                  <ReferenceLine y={myTarget.max_value} stroke={color} strokeDasharray="4 4" opacity={0.5} />
                  <ReferenceLine y={myTarget.min_value} stroke={color} strokeDasharray="4 4" opacity={0.5} />
                </>
              )}
              {key === 'BLOOD_PRESSURE' ? (
                <>
                  <Line type="monotone" dataKey="systolic"  stroke={chartColor} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="diastolic" stroke={color}      strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </>
              ) : (
                <Line type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-24 flex items-center justify-center text-xs text-muted-foreground bg-muted/30 rounded-xl">
            {myReadings.length === 0 ? 'No readings yet' : 'Log more readings to see trends'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddReadingModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ vital_type: 'HEART_RATE', value: '', systolic: '', diastolic: '', notes: '' });
  const { mutate, isPending } = onAdd;
  const isBP = form.vital_type === 'BLOOD_PRESSURE';

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { vital_type: form.vital_type, notes: form.notes };
    if (isBP) {
      payload.systolic  = parseFloat(form.systolic);
      payload.diastolic = parseFloat(form.diastolic);
      payload.value     = parseFloat(form.systolic); // backend may require a single value
    } else {
      payload.value = parseFloat(form.value);
    }
    mutate(payload, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md"
      >
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Log Vital Reading</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Vital Type</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.vital_type}
                onChange={e => setForm(f => ({ ...f, vital_type: e.target.value }))}
              >
                {VITAL_TYPES.map(vt => (
                  <option key={vt.key} value={vt.key}>{vt.label}</option>
                ))}
              </select>
            </div>

            {isBP ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Systolic (mmHg)</label>
                  <input required type="number" placeholder="e.g. 120"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    value={form.systolic} onChange={e => setForm(f => ({ ...f, systolic: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Diastolic (mmHg)</label>
                  <input required type="number" placeholder="e.g. 80"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    value={form.diastolic} onChange={e => setForm(f => ({ ...f, diastolic: e.target.value }))} />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Value ({VITAL_TYPES.find(v => v.key === form.vital_type)?.unit})
                </label>
                <input required type="number" step="0.1" placeholder="Enter reading"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
              <textarea rows={2} placeholder="Any notes..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save Reading'}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function VitalsDashboard() {
  const [showModal, setShowModal] = useState(false);
  const { data: readings = [], isLoading } = useVitalReadings();
  const { data: targets  = [] } = useVitalTargets();
  const addReading = useAddVitalReading();

  return (
    <div className="flex flex-col gap-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Vitals</h1>
          <p className="text-muted-foreground mt-1">Monitor your health metrics over time.</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Log Reading
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="h-64 animate-pulse bg-muted/40 border-0" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {VITAL_TYPES.map(vt => (
            <motion.div key={vt.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <VitalCard vt={vt} readings={readings} targets={targets} />
            </motion.div>
          ))}
        </div>
      )}

      {showModal && (
        <AddReadingModal onClose={() => setShowModal(false)} onAdd={addReading} />
      )}
    </div>
  );
}
