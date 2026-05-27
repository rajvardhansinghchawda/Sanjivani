import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { useAuthStore } from '@/stores/auth.store';

let _toastId = 0;

/**
 * ChatToastProvider — mount once at app root.
 * Listens to the personal notification WS and shows WhatsApp-style toast
 * banners when a new chat message arrives.
 */
export function ChatToastProvider() {
  const user                = useAuthStore((s) => s.user);
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleMsg = useCallback((msg) => {
    if (msg.type !== 'new_message') return;

    // Browser notification (if user granted permission)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(`💬 ${msg.from}`, { body: msg.preview, icon: '/favicon.ico' });
    }

    const id = ++_toastId;
    setToasts((prev) => [...prev.slice(-3), { id, from: msg.from, preview: msg.preview, session_id: msg.session_id }]);

    // Auto-dismiss after 5 s
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  useNotificationSocket(user ? handleMsg : null);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0,  scale: 1   }}
            exit   ={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="pointer-events-auto w-80 bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden flex items-start gap-3 p-4 cursor-pointer"
            onClick={() => { window.location.href = '/dashboard/my-doctor'; dismiss(t.id); }}
          >
            {/* Icon */}
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight truncate">{t.from}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{t.preview}</p>
            </div>

            {/* Dismiss */}
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Progress bar */}
            <motion.div
              className="absolute bottom-0 left-0 h-0.5 bg-primary"
              initial={{ width: '100%' }}
              animate={{ width: '0%'   }}
              transition={{ duration: 5, ease: 'linear' }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
