import { useAdminSubscriptions, useAdminExtendSubscription } from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CreditCard, CalendarClock, ShieldCheck } from 'lucide-react';

export default function AdminSubscriptions() {
  const { data: subscriptions, isLoading } = useAdminSubscriptions();
  const extendSub = useAdminExtendSubscription();

  const handleExtend = async (subId) => {
    const daysStr = window.prompt("Enter number of days to extend this subscription:", "30");
    if (daysStr) {
      const days = parseInt(daysStr, 10);
      if (!isNaN(days) && days > 0) {
        await extendSub.mutateAsync({ id: subId, days });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subscription Management</h1>
        <p className="text-slate-500 mt-1">View active plans and issue manual extensions.</p>
      </div>

      <Card className="border-slate-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Expires At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subscriptions?.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{sub.user_name || 'User'}</div>
                    <div className="text-xs text-slate-500">ID: {sub.user?.substring(0, 8)}...</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center font-medium text-slate-900">
                      <CreditCard className="w-4 h-4 mr-2 text-primary" />
                      {sub.plan_name || 'Premium'}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {sub.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                        <ShieldCheck className="w-3 h-3 mr-1" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                        {sub.status}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'Lifetime'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-primary"
                      onClick={() => handleExtend(sub.id)}
                      disabled={extendSub.isPending}
                    >
                      <CalendarClock className="w-3 h-3 mr-1" /> Extend
                    </Button>
                  </td>
                </tr>
              ))}
              {subscriptions?.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    No active subscriptions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
