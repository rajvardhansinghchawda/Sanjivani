import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import logoMedicine from '@/assets/logo medicine.png';

export default function SplashScreen() {
  const navigate = useNavigate();
  const { user, accessToken, isInitialized } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) return;

    const timer = setTimeout(() => {
      if (accessToken && user) {
        // Role-based routing
        if (user.role === 'DOCTOR') navigate('/doctor/home');
        else if (user.role === 'CAREGIVER') navigate('/caregiver/home');
        else navigate('/patient/home');
      } else {
        navigate('/login');
      }
    }, 2500); // Animation duration + buffer

    return () => clearTimeout(timer);
  }, [isInitialized, accessToken, user, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center gap-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ 
            duration: 0.8, 
            ease: [0.16, 1, 0.3, 1],
            scale: { type: "spring", stiffness: 200, damping: 15 }
          }}
          className="relative"
        >
          <img src={logoMedicine} alt="Aarogyam Logo" className="w-24 h-24 md:w-32 md:h-32 object-contain" />
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-primary/20 rounded-full blur-xl -z-10"
          />
        </motion.div>

        <div className="flex flex-col items-center">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-4xl md:text-5xl font-display font-extrabold text-primary tracking-tight"
          >
            Aarogyam
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="text-muted-foreground font-medium mt-2 tracking-widest uppercase text-[10px]"
          >
            Your Trusted Health Companion
          </motion.p>
        </div>

        {/* Loading Bar */}
        <div className="mt-12 w-48 h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "0%" }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="h-full bg-primary"
          />
        </div>
      </div>

      <footer className="absolute bottom-10 text-muted-foreground text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">
        Clinical Grade Health Systems
      </footer>
    </div>
  );
}
