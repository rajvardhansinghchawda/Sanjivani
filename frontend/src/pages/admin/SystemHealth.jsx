import { useAdminSystemJobs, useAdminNotificationRates, useAdminTestNotification, useAdminUsers } from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Activity, Send, CheckCircle2, AlertTriangle, Settings, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function AdminSystemHealth() {
  const { data: jobs, isLoading: isJobsLoading } = useAdminSystemJobs();
  const { data: rates, isLoading: isRatesLoading } = useAdminNotificationRates();
  const { data: users, isLoading: isUsersLoading } = useAdminUsers();
  const testNotification = useAdminTestNotification();
  
  const [testUserId, setTestUserId] = useState('');
  const [testChannel, setTestChannel] = useState('push');

  // Automatically select the first user when users are loaded
  useEffect(() => {
    if (users && users.length > 0 && !testUserId) {
      setTestUserId(users[0].id);
    }
  }, [users, testUserId]);
  
  const handleTestDispatch = async (e) => {
    e.preventDefault();
    if (!testUserId) return;
    try {
      await testNotification.mutateAsync({
        user_id: testUserId,
        channel: testChannel,
        message: 'Test notification from MedAdhere admin diagnostics.',
      });
      alert('Test notification dispatched successfully!');
    } catch (err) {
      alert('Failed to dispatch notification. Please check the User ID.');
    }
  };

  if (isJobsLoading || isRatesLoading || isUsersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Health & Diagnostics</h1>
        <p className="text-slate-500 mt-1">Monitor background workers and communication pipelines.</p>
      </div>

      {/* Notifications Pipeline Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-primary" />
              Notification Delivery Pipeline
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span className="text-slate-600">Overall Success Rate</span>
                  <span className="text-slate-900">{rates?.rate_pct || 0}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${rates?.rate_pct >= 95 ? 'bg-emerald-500' : 'bg-orange-500'}`} 
                    style={{ width: `${rates?.rate_pct || 0}%` }}
                  ></div>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <div className="text-center">
                  <p className="text-slate-500 mb-1">Total</p>
                  <p className="font-bold text-lg text-slate-900">{rates?.total || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-500 mb-1">Delivered</p>
                  <p className="font-bold text-lg text-emerald-600">{rates?.delivered || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-500 mb-1">Failed</p>
                  <p className="font-bold text-lg text-red-600">{rates?.failed || 0}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Notification Tool */}
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <Send className="w-5 h-5 mr-2 text-primary" />
              Dispatch Test Message
            </h2>
            <form onSubmit={handleTestDispatch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target User</label>
                <select 
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                  required
                >
                  <option value="" disabled>Select a user</option>
                  {users?.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Channel</label>
                <select 
                  value={testChannel}
                  onChange={(e) => setTestChannel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                >
                  <option value="push">Push Notification (FCM)</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <Button type="submit" disabled={testNotification.isPending} className="w-full">
                {testNotification.isPending ? 'Dispatching...' : 'Send Test Payload'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Background Jobs (Celery) */}
      <Card className="border-slate-200/60 shadow-sm overflow-hidden mt-6">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-primary" />
            Background Tasks (Celery Beat)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
              <tr>
                <th className="py-3 px-6">Task Name</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">Last Run At</th>
                <th className="py-3 px-6 text-right">Run Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs?.map((job, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-6 font-medium text-slate-900">{job.name}</td>
                  <td className="py-3 px-6">
                    {job.enabled ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Disabled
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-6 text-slate-500">
                    {job.last_run_at ? (
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(job.last_run_at).toLocaleString()}</span>
                      </div>
                    ) : (
                      'Never'
                    )}
                  </td>
                  <td className="py-3 px-6 text-right font-medium">
                    {job.total_run_count}
                  </td>
                </tr>
              ))}
              {jobs?.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-slate-500">
                    No background tasks registered.
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
