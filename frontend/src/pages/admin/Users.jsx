import { useAdminUsers, useAdminDeactivateUser } from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShieldAlert, UserX, CheckCircle, Clock } from 'lucide-react';
import { useState } from 'react';

export default function AdminUsers() {
  const { data: users, isLoading } = useAdminUsers();
  const deactivateUser = useAdminDeactivateUser();
  const [selectedUser, setSelectedUser] = useState(null);

  const handleDeactivate = async (userId) => {
    if (window.confirm("Are you sure you want to deactivate this user? They will immediately lose access to the platform.")) {
      await deactivateUser.mutateAsync(userId);
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
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Directory</h1>
          <p className="text-slate-500 mt-1">Manage all platform users (Top 100 most recent).</p>
        </div>
      </div>

      <Card className="border-slate-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
              <tr>
                <th className="py-3 px-4">Name / Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users?.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{user.full_name || 'No Name'}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(user.date_joined).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {user.is_active ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3 mr-1" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700">
                        <ShieldAlert className="w-3 h-3 mr-1" /> Deactivated
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {user.is_active && user.role !== 'SUPER_ADMIN' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-0"
                        onClick={() => handleDeactivate(user.id)}
                        disabled={deactivateUser.isPending}
                      >
                        <UserX className="w-3 h-3 mr-1" /> Ban User
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {users?.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    No users found.
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
