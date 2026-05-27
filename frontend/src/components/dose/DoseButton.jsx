import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useLogDose } from '@/hooks/useAdherence';
import { offlineDoseQueue } from '@/lib/offline';
import { frontendOrchestrator, ORC_EVENTS } from '@/agents/orchestrator';

export const DoseButton = ({ patientId, dose }) => {
  const [swipeState, setSwipeState] = useState('idle'); // idle, loading, success, error
  const { mutateAsync: logDose } = useLogDose(patientId);

  const handleAction = async (status) => {
    // Optimistic UI state
    setSwipeState('loading');
    
    // Haptic feedback if supported
    if (navigator.vibrate) navigator.vibrate(50);
    
    const doseData = {
      prescriptionId: dose.prescriptionId,
      scheduledAt: dose.scheduledAt,
      status: status, // 'taken' | 'missed'
      takenAt: new Date().toISOString(),
      isOfflineSync: !navigator.onLine
    };

    try {
      if (!navigator.onLine) {
        // Enqueue for background sync
        await offlineDoseQueue.enqueue(doseData);
        setSwipeState('success');
        return;
      }

      await logDose(doseData);
      setSwipeState('success');
      
      // Fire orchestrator event for cross-component effects (e.g. streaks)
      frontendOrchestrator.emit(ORC_EVENTS.DOSE_LOGGED, doseData);
      
    } catch (error) {
      // 409 ALREADY_LOGGED treated as success
      if (error.code === 'ALREADY_LOGGED') {
        setSwipeState('success');
      } else {
        setSwipeState('error');
        // Vibrate error pattern
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        // Reset after 3 seconds
        setTimeout(() => setSwipeState('idle'), 3000);
      }
    }
  };

  // Status already logged
  if (dose.status === 'taken') {
    return (
      <div className="flex items-center justify-center w-full py-4 bg-primary-50 rounded-xl border border-primary-100">
        <Check className="w-5 h-5 text-primary-600 mr-2" />
        <span className="font-sans font-medium text-primary-900">Taken at {new Date(dose.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-card border border-border shadow-elevation-1">
      <AnimatePresence mode="wait">
        {swipeState === 'idle' && (
          <motion.div 
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-between p-4"
          >
            <div className="flex flex-col">
              <span className="font-display font-semibold text-foreground text-lg">{dose.medicationName}</span>
              <span className="font-sans text-sm text-muted-foreground">{dose.dosage} • {new Date(dose.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => handleAction('missed')}
                className="p-3 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                aria-label="Mark as missed"
              >
                <X className="w-5 h-5" />
              </button>
              <button 
                onClick={() => handleAction('taken')}
                className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium shadow-elevation-2 hover:bg-primary-600 transition-colors flex items-center"
              >
                <Check className="w-5 h-5 mr-2" />
                Take
              </button>
            </div>
          </motion.div>
        )}

        {swipeState === 'loading' && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center w-full py-6"
          >
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </motion.div>
        )}

        {swipeState === 'success' && (
          <motion.div 
            key="success"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center justify-center w-full py-6 bg-primary-50"
          >
            <Check className="w-6 h-6 text-primary-600 mr-2" />
            <span className="font-sans font-medium text-primary-900">Logged successfully</span>
          </motion.div>
        )}

        {swipeState === 'error' && (
          <motion.div 
            key="error"
            initial={{ x: [-10, 10, -10, 10, 0] }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center w-full py-6 bg-destructive/10"
          >
            <X className="w-6 h-6 text-destructive mr-2" />
            <span className="font-sans font-medium text-destructive">Failed to log. Try again.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
