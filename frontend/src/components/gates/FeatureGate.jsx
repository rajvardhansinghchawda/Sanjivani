import { Lock } from 'lucide-react';
import { useSubscriptionStore } from '@/stores/subscription.store';

export const FeatureGate = ({ 
  feature, 
  children, 
  fallback = null,
  blur = true 
}) => {
  const hasFeature = useSubscriptionStore((state) => state.hasFeature);
  const isPremium = useSubscriptionStore((state) => state.isPremium());

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Premium Blurred Preview
  if (blur) {
    return (
      <div className="relative group overflow-hidden rounded-xl bg-card border border-border">
        {/* Blurred Content */}
        <div className="blur-sm opacity-60 pointer-events-none select-none transition-all group-hover:blur-md">
          {children}
        </div>
        
        {/* Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background/40 backdrop-blur-[2px]">
          <div className="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center mb-4 text-accent-600 shadow-elevation-1">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="font-display font-semibold text-lg text-foreground mb-2">
            Premium Feature
          </h3>
          <p className="font-sans text-sm text-muted-foreground mb-4">
            Upgrade to unlock this and other advanced capabilities.
          </p>
          <button 
            className="px-5 py-2.5 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors"
            onClick={() => {
              // Trigger Upgrade Modal
              console.log('Open Upgrade Modal for feature:', feature);
            }}
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    );
  }

  return null; // Completely hide if not blurred and no fallback
};
