import { useAdminMetrics, useAdminAdherence } from '@/hooks/useAdmin';
import { Users, CreditCard, Cpu, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

export default function AdminDashboard() {
  const { data: metrics, isLoading: isMetricsLoading } = useAdminMetrics();
  const { data: adherence, isLoading: isAdherenceLoading } = useAdminAdherence();

  if (isMetricsLoading || isAdherenceLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const adherenceRate = adherence?.avg_adherence_rate_7d || 0;

  const statCards = [
    {
      title: 'Total Users',
      value: metrics?.total_users || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      trend: `+${metrics?.new_users_today || 0} today`,
    },
    {
      title: 'Active Subscriptions',
      value: metrics?.active_subscriptions || 0,
      icon: CreditCard,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      trend: 'Premium Tier',
    },
    {
      title: 'Active IoT Devices',
      value: metrics?.active_devices || 0,
      icon: Cpu,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
      trend: 'Online & Syncing',
    },
    {
      title: 'Global Adherence',
      value: `${adherenceRate}%`,
      icon: adherenceRate >= 80 ? TrendingUp : AlertTriangle,
      color: adherenceRate >= 80 ? 'text-green-600' : 'text-orange-600',
      bgColor: adherenceRate >= 80 ? 'bg-green-50' : 'bg-orange-50',
      trend: '7-Day Average',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Overview</h1>
        <p className="text-slate-500 mt-1">High-level metrics for the entire Aarogyam system.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <Card key={idx} className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{stat.title}</p>
                  <h3 className="text-3xl font-bold text-slate-900">{stat.value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm font-medium text-slate-600">
                <span>{stat.trend}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Placeholder for future charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-6 h-80 flex flex-col items-center justify-center text-slate-400">
            <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
            <p>Adherence Trend Chart (Coming Soon)</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-6 h-80 flex flex-col items-center justify-center text-slate-400">
            <Users className="w-12 h-12 mb-4 opacity-20" />
            <p>User Growth Chart (Coming Soon)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
