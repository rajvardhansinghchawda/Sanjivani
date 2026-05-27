import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Share2, Download, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import demoVideo from '@/assets/demo_video.mp4';
import logoMedicine from '@/assets/logo medicine.png';

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10 text-white">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <img src={logoMedicine} alt="Aarogyam" className="w-8 h-8 object-contain" />
            <span className="font-display font-bold text-xl tracking-tight">Aarogyam Demo</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" className="hidden sm:flex border-white/20 text-white hover:bg-white/10 rounded-xl gap-2">
            <Share2 className="w-4 h-4" /> Share
          </Button>
          <Link to="/register">
            <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl px-6">
              Get Started Free
            </Button>
          </Link>
        </div>
      </header>

      {/* Video Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-6xl aspect-video bg-black rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(11,110,122,0.2)] border border-white/10 relative group"
        >
          <video 
            src={demoVideo} 
            controls 
            autoPlay 
            className="w-full h-full object-contain"
            poster={logoMedicine}
          >
            Your browser does not support the video tag.
          </video>
        </motion.div>

        {/* Video Info */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-6xl mt-12 grid md:grid-cols-3 gap-8 pb-12"
        >
          <div className="md:col-span-2">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Aarogyam: The Future of Digital Adherence
            </h1>
            <p className="text-white/60 text-lg leading-relaxed">
              Discover how our integrated platform combines smart reminders, caregiver connectivity, 
              and clinical-grade reporting to ensure you never miss a dose. This demo walks you 
              through the patient dashboard, the doctor portal, and our IoT pillbox integration.
            </p>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" /> Key Features Shown
              </h3>
              <ul className="text-sm text-white/50 space-y-2">
                <li>• Real-time Dose Tracking</li>
                <li>• Caregiver Alert System</li>
                <li>• Clinical Adherence Reports</li>
                <li>• Smart Pillbox Connection</li>
              </ul>
            </div>
            <Button variant="outline" className="w-full border-white/10 text-white hover:bg-white/5 rounded-xl gap-2 h-12">
              <Download className="w-4 h-4" /> Download Feature Guide
            </Button>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="p-8 text-center text-white/30 text-sm border-t border-white/5">
        © 2026 Aarogyam Health Systems. Video content is for demonstration purposes only.
      </footer>
    </div>
  );
}
