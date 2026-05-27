import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';

export const StreakBadge = ({ streakCount = 0 }) => {
  // Fire color gets more intense as streak increases
  const getFireColor = () => {
    if (streakCount >= 30) return 'text-purple-500 bg-purple-500/10 border-purple-200';
    if (streakCount >= 7) return 'text-orange-500 bg-orange-500/10 border-orange-200';
    if (streakCount >= 3) return 'text-amber-500 bg-amber-500/10 border-amber-200';
    return 'text-muted-foreground bg-secondary border-border';
  };

  return (
    <motion.div 
      className={`inline-flex items-center px-3 py-1.5 rounded-full border ${getFireColor()} shadow-elevation-1`}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      <motion.div
        animate={{ 
          scale: streakCount >= 3 ? [1, 1.2, 1] : 1,
          rotate: streakCount >= 3 ? [0, -5, 5, 0] : 0
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity, 
          repeatType: 'reverse' 
        }}
      >
        <Flame className={`w-4 h-4 mr-1.5 ${streakCount >= 3 ? 'fill-current' : ''}`} />
      </motion.div>
      <span className="font-display font-bold text-sm tracking-tight">
        {streakCount} Day Streak
      </span>
    </motion.div>
  );
};
