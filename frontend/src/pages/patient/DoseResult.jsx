import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ArrowRight, 
  Activity, 
  ShieldCheck,
  TrendingUp,
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function DoseResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('analyzing'); // analyzing, taken, partial, missed

  useEffect(() => {
    // Simulate backend weight analysis
    const timer = setTimeout(() => {
      setStatus('taken'); // Mock result
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const resultConfig = {
    analyzing: {
      icon: Activity,
      color: 'text-primary',
      bg: 'bg-primary/5',
      title: 'Analyzing Weight Data...',
      subtitle: 'Please wait while the system verifies your dose.',
      description: 'Checking smart dispenser sensor data and compartment weight variance.'
    },
    taken: {
      icon: CheckCircle2,
      color: 'text-success',
      bg: 'bg-success/5',
      title: 'Dose Taken ✓',
      subtitle: 'Great job! Your adherence is on track.',
      description: 'Weight analysis confirms all medicines were removed from the compartment.'
    },
    partial: {
      icon: AlertTriangle,
      color: 'text-accent',
      bg: 'bg-accent/5',
      title: 'Partial Dose ⚠',
      subtitle: 'Some medicines might have been left behind.',
      description: 'Sensor data suggests Metformin was taken, but Vitamin C remains in the tray.'
    },
    missed: {
      icon: XCircle,
      color: 'text-destructive',
      bg: 'bg-destructive/5',
      title: 'Dose Missed ✗',
      subtitle: 'No medicines were detected as taken.',
      description: 'The gate was opened, but no weight variance was recorded.'
    }
  };

  const config = resultConfig[status];
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-xl flex flex-col gap-8">
        <Card className={`rounded-[3rem] border-none shadow-2xl overflow-hidden ${config.bg} transition-colors duration-500`}>
          <CardContent className="p-12 flex flex-col items-center text-center gap-8">
            <div className="relative">
              {status === 'analyzing' && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full -m-4"
                />
              )}
              <div className={`w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center bg-white shadow-xl ${config.color}`}>
                <Icon className={`w-12 h-12 md:w-16 h-16 ${status === 'analyzing' ? 'animate-pulse' : ''}`} />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h1 className={`text-4xl font-display font-black tracking-tight ${config.color}`}>{config.title}</h1>
              <p className="text-xl font-bold text-foreground/80">{config.subtitle}</p>
              <p className="text-sm text-muted-foreground font-medium max-w-xs mx-auto leading-relaxed mt-2">
                {config.description}
              </p>
            </div>

            {status !== 'analyzing' && (
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-white/50 backdrop-blur-sm p-5 rounded-[2rem] border border-white flex flex-col items-center gap-1 shadow-sm">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Adherence</span>
                  <span className="text-xl font-black text-primary">92%</span>
                </div>
                <div className="bg-white/50 backdrop-blur-sm p-5 rounded-[2rem] border border-white flex flex-col items-center gap-1 shadow-sm">
                  <Share2 className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notify</span>
                  <span className="text-xl font-black text-primary">Caregiver</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {status !== 'analyzing' && (
          <div className="flex flex-col gap-4 w-full">
            <Button onClick={() => navigate('/patient/home')} className="h-16 text-lg rounded-3xl shadow-xl shadow-primary/20">
              Return to Dashboard <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button variant="ghost" onClick={() => navigate('/patient/reports')} className="h-12 text-sm font-bold uppercase tracking-widest text-muted-foreground hover:text-primary">
              View Detailed Analytics
            </Button>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 opacity-40">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Verified by Clinical AI Engine</span>
        </div>
      </div>
    </div>
  );
}
