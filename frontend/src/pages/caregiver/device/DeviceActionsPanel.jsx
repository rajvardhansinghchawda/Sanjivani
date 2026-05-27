import { Loader2, LockKeyhole, LockOpen, RotateCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useQueueCommand, useUnlockDevice, useDoseAlerts } from '@/hooks/useIoT';

const COMMAND_BUTTONS = [
  { type: 'GATE_UNLOCK', label: 'Unlock Gate', icon: LockOpen, variant: 'outline', desc: 'Remotely open dispenser gate' },
  { type: 'GATE_LOCK',   label: 'Lock Gate',   icon: LockKeyhole, variant: 'outline', desc: 'Secure the dispenser gate' },
  { type: 'SYNC_SCHEDULE', label: 'Sync Schedule', icon: RotateCw, variant: 'outline', desc: 'Push schedule to device' },
  { type: 'RESET_FLAGS', label: 'Reset Daily Flags', icon: CheckCircle2, variant: 'outline', desc: 'Clear dispense flags for today' },
];

function CommandPanel({ deviceId }) {
  const queueCmd = useQueueCommand();
  function send(type) {
    queueCmd.mutate({ deviceId, commandType: type, payload: {}, expiresInMinutes: 5 });
  }
  return (
    <div className="bg-card rounded-[2rem] border border-border/50 overflow-hidden">
      <div className="p-6 border-b border-border/40 bg-muted/10">
        <h3 className="font-display font-bold text-lg">Manual Commands</h3>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Queued to device on next poll (≤30s)</p>
      </div>
      <div className="p-5 grid sm:grid-cols-2 gap-3">
        {COMMAND_BUTTONS.map(cmd => {
          const Icon = cmd.icon;
          return (
            <button key={cmd.type} onClick={() => send(cmd.type)} disabled={queueCmd.isPending}
              className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group">
              <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{cmd.label}</p>
                <p className="text-[10px] text-muted-foreground font-medium">{cmd.desc}</p>
              </div>
              {queueCmd.isPending && queueCmd.variables?.commandType === cmd.type && <Loader2 className="w-4 h-4 animate-spin text-primary ml-auto" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AlertRow({ alert, onUnlock }) {
  const statusColor = alert.dose_status === 'missed' ? 'destructive' : 'warning';
  return (
    <div className="flex items-start gap-3 p-4 bg-muted/20 rounded-2xl border border-border/40">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${alert.dose_status === 'missed' ? 'bg-destructive/10' : 'bg-amber-500/10'}`}>
        <AlertTriangle className={`w-4 h-4 ${alert.dose_status === 'missed' ? 'text-destructive' : 'text-amber-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-foreground">{alert.device_name}</p>
          <Badge variant={statusColor} className="h-4 px-2 text-[9px] uppercase tracking-wider">{alert.dose_status}</Badge>
          {alert.gate_locked && <Badge variant="secondary" className="h-4 px-2 text-[9px]">Gate Locked</Badge>}
        </div>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">
          Compartment {alert.compartment_number} · {alert.time_slot?.replace('_', ' ')} ·{' '}
          {alert.scheduled_time ? new Date(alert.scheduled_time).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '—'}
        </p>
        {alert.actual_reduction_grams !== null && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Expected: {alert.expected_reduction_grams?.toFixed(1)}g · Actual: {alert.actual_reduction_grams?.toFixed(1) ?? '—'}g
          </p>
        )}
      </div>
      {alert.gate_locked && (
        <Button size="sm" variant="outline" className="h-8 px-3 text-xs font-bold shrink-0 border-primary/20 text-primary hover:bg-primary hover:text-white"
          onClick={() => onUnlock(alert.device_id)}>
          <LockOpen className="w-3 h-3 mr-1" />Unlock
        </Button>
      )}
    </div>
  );
}

export function DeviceActionsPanel({ deviceId }) {
  const { data: alertsData, isLoading } = useDoseAlerts();
  const unlockDevice = useUnlockDevice();
  const alerts = alertsData?.alerts || [];
  const filtered = deviceId ? alerts.filter(a => a.device_id === deviceId || !deviceId) : alerts;

  return (
    <div className="space-y-6">
      <CommandPanel deviceId={deviceId} />

      <div className="bg-card rounded-[2rem] border border-border/50 overflow-hidden">
        <div className="p-6 border-b border-border/40 bg-muted/10 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-lg">Dose Alerts</h3>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Missed & partial doses requiring attention</p>
          </div>
          {filtered.length > 0 && <Badge variant="destructive" className="h-6 px-3 text-xs font-bold">{filtered.length} alert{filtered.length !== 1 ? 's' : ''}</Badge>}
        </div>
        <div className="p-5 space-y-3">
          {isLoading && <div className="text-sm text-muted-foreground p-4 text-center font-medium">Loading alerts...</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="w-7 h-7 text-emerald-500" /></div>
              <p className="text-sm text-muted-foreground font-semibold">No active alerts — all doses on track!</p>
            </div>
          )}
          {filtered.map(alert => <AlertRow key={alert.session_id} alert={alert} onUnlock={id => unlockDevice.mutate(id)} />)}
        </div>
      </div>
    </div>
  );
}
