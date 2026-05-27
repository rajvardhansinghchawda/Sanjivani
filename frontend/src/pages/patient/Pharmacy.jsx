import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Store, Package, Truck, ToggleLeft, ToggleRight, RefreshCw, CheckCircle2,
  Clock, AlertTriangle, Building2, Phone, MapPin, Plus, ChevronRight
} from 'lucide-react';
import { usePharmacyPartners, useRefillOrders, useAutoRefillSettings, useToggleAutoRefill, useCreateRefillOrder } from '@/hooks/usePharmacy';
import { usePrescriptions } from '@/hooks/usePrescriptions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const STATUS_META = {
  PENDING:    { label: 'Pending',    icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50' },
  PROCESSING: { label: 'Processing', icon: RefreshCw,    color: 'text-blue-600',    bg: 'bg-blue-50' },
  DISPATCHED: { label: 'Dispatched', icon: Truck,        color: 'text-violet-600',  bg: 'bg-violet-50' },
  DELIVERED:  { label: 'Delivered',  icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  CANCELLED:  { label: 'Cancelled',  icon: AlertTriangle,color: 'text-rose-600',    bg: 'bg-rose-50' },
};

function PartnerCard({ partner }) {
  return (
    <Card className="border-border/40 hover:border-primary/40 hover:shadow-md transition-all group cursor-pointer">
      <CardContent className="p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
          <Building2 className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm mb-0.5 truncate">{partner.name}</h4>
          {partner.city && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <MapPin className="w-3 h-3" /> {partner.city}
            </p>
          )}
          {partner.phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="w-3 h-3" /> {partner.phone}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={partner.is_active ? 'success' : 'secondary'} className="text-xs">
            {partner.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </CardContent>
    </Card>
  );
}

function RefillOrderRow({ order }) {
  const meta = STATUS_META[order.status] || STATUS_META.PENDING;
  const StatusIcon = meta.icon;
  return (
    <div className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
      <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center shrink-0`}>
        <StatusIcon className={`w-5 h-5 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm truncate">{order.medication_name || 'Refill Order'}</h4>
        <p className="text-xs text-muted-foreground">
          {order.quantity && <span>{order.quantity} units · </span>}
          {order.pharmacy_name && <span>{order.pharmacy_name} · </span>}
          {new Date(order.created_at).toLocaleDateString()}
        </p>
      </div>
      <Badge variant="secondary" className={`${meta.bg} ${meta.color} border-0 text-xs font-bold`}>
        {meta.label}
      </Badge>
    </div>
  );
}

function AutoRefillToggle() {
  const { data: settings } = useAutoRefillSettings();
  const toggle = useToggleAutoRefill();
  const isEnabled = settings?.data?.enabled ?? settings?.enabled ?? false;

  return (
    <Card className="border-border/50 bg-gradient-to-r from-primary/5 to-background">
      <CardContent className="p-5 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold">Auto Refill</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically order refills when your IoT dispenser detects low stock.
            </p>
          </div>
        </div>
        <button
          onClick={() => toggle.mutate({ enabled: !isEnabled })}
          disabled={toggle.isPending}
          className="shrink-0 focus:outline-none"
          title={isEnabled ? 'Disable auto refill' : 'Enable auto refill'}
        >
          {isEnabled
            ? <ToggleRight className="w-10 h-10 text-primary transition-colors" />
            : <ToggleLeft  className="w-10 h-10 text-muted-foreground transition-colors" />
          }
        </button>
      </CardContent>
    </Card>
  );
}

function ManualRefillModal({ onClose }) {
  const { data: prescriptions = [] } = usePrescriptions({ isActive: true });
  const { data: partners = [] } = usePharmacyPartners();
  const createOrder = useCreateRefillOrder();
  const [form, setForm] = useState({ prescription_id: '', pharmacy_id: '', quantity: 30 });

  const handleSubmit = (e) => {
    e.preventDefault();
    createOrder.mutate(form, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md p-6"
      >
        <h2 className="text-xl font-bold mb-1">Order Refill</h2>
        <p className="text-sm text-muted-foreground mb-5">Select a prescription and pharmacy partner to place a refill order.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Prescription / Medicine</label>
            <select required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={form.prescription_id}
              onChange={e => setForm(f => ({ ...f, prescription_id: e.target.value }))}
            >
              <option value="">-- Select medicine --</option>
              {prescriptions.map(rx => (
                <option key={rx.id} value={rx.id}>{rx.medication_name || rx.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Pharmacy Partner</label>
            <select required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={form.pharmacy_id}
              onChange={e => setForm(f => ({ ...f, pharmacy_id: e.target.value }))}
            >
              <option value="">-- Select pharmacy --</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Quantity (pills / units)</label>
            <input type="number" min={1}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) }))}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={createOrder.isPending}>
              {createOrder.isPending ? 'Ordering…' : 'Place Order'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function Pharmacy() {
  const [showOrder, setShowOrder] = useState(false);
  const { data: partners = [], isLoading: partnersLoading } = usePharmacyPartners();
  const { data: orders = [], isLoading: ordersLoading } = useRefillOrders();

  return (
    <div className="flex flex-col gap-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Pharmacy</h1>
          <p className="text-muted-foreground mt-1">Manage refills and partner pharmacies connected to your dispenser.</p>
        </div>
        <Button onClick={() => setShowOrder(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Order Refill
        </Button>
      </div>

      {/* Auto Refill Toggle */}
      <AutoRefillToggle />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Partners */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> Pharmacy Partners
          </h2>
          {partnersLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map(i => <Card key={i} className="h-20 animate-pulse bg-muted/40 border-0" />)}
            </div>
          ) : partners.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-border/50 rounded-2xl bg-card">
              <Store className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No pharmacy partners configured yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {partners.map((p, i) => (
                <motion.div key={p.id || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                  <PartnerCard partner={p} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Refill Orders */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Refill Orders
          </h2>
          <Card>
            <CardContent className="p-0">
              {ordersLoading ? (
                <div className="p-6 text-center text-muted-foreground">Loading orders…</div>
              ) : orders.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Package className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="font-semibold">No refill orders yet</p>
                  <p className="text-sm mt-1">Place a manual order or enable auto-refill.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {orders.map((order, i) => (
                    <motion.div key={order.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>
                      <RefillOrderRow order={order} />
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {showOrder && <ManualRefillModal onClose={() => setShowOrder(false)} />}
    </div>
  );
}
