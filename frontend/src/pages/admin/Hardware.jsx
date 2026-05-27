import { useAdminDeviceInventory, useAdminGenerateDeviceIds } from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Cpu, Plus, Server, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export default function AdminHardware() {
  const { data: inventory, isLoading } = useAdminDeviceInventory();
  const generateIds = useAdminGenerateDeviceIds();
  const [generateResult, setGenerateResult] = useState(null);

  const handleGenerate = async () => {
    // In a real scenario, product_id would be selected from a dropdown. 
    // Here we might need a default or just send a dummy one depending on backend requirements.
    // The backend `AdminGenerateDeviceIDsView` expects `product_id`.
    const productId = window.prompt("Enter Hardware Product ID (UUID):");
    if (!productId) return;
    
    const batchStr = window.prompt("Enter batch size (max 1000):", "100");
    const batchSize = parseInt(batchStr, 10);
    
    if (productId && !isNaN(batchSize) && batchSize > 0) {
      try {
        const result = await generateIds.mutateAsync({ product_id: productId, batch_size: batchSize });
        setGenerateResult(result);
      } catch (err) {
        alert("Failed to generate IDs. Please ensure the Product ID is correct.");
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
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hardware & IoT Inventory</h1>
          <p className="text-slate-500 mt-1">Manage physical Smart Dispensers and provisioning.</p>
        </div>
        <Button onClick={handleGenerate} disabled={generateIds.isPending}>
          <Plus className="w-4 h-4 mr-2" />
          Generate Batch IDs
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total Manufactured</p>
                <h3 className="text-3xl font-bold text-slate-900">{inventory?.total || 0}</h3>
              </div>
              <div className="p-3 rounded-xl bg-blue-50">
                <Cpu className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Assigned to Patients</p>
                <h3 className="text-3xl font-bold text-slate-900">{inventory?.assigned || 0}</h3>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Available in Warehouse</p>
                <h3 className="text-3xl font-bold text-slate-900">{inventory?.available || 0}</h3>
              </div>
              <div className="p-3 rounded-xl bg-violet-50">
                <Server className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {generateResult && (
        <Card className="border-emerald-200 shadow-sm bg-emerald-50/30">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-emerald-800 flex items-center mb-4">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Successfully Generated {generateResult.generated} Device IDs
            </h3>
            <p className="text-sm text-slate-600 mb-2">Sample IDs from this batch (ready for printing/flashing):</p>
            <div className="flex flex-wrap gap-2">
              {generateResult.sample?.map(id => (
                <span key={id} className="font-mono text-xs bg-white border border-slate-200 px-2 py-1 rounded">
                  {id}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
