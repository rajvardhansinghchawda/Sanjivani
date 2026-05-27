import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth.store';

export default function Unauthorized() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const getDashboardPath = () => {
    if (user?.role === 'DOCTOR') return '/doctor';
    if (user?.role === 'CAREGIVER') return '/caregiver';
    return '/dashboard';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="p-10 text-center max-w-lg bg-card rounded-3xl border border-border/60 shadow-elevation-3 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-2 bg-destructive" />
        
        <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mx-auto mb-8 animate-pulse">
          <ShieldAlert className="w-10 h-10" />
        </div>
        
        <h1 className="text-3xl font-display font-black text-foreground mb-4">Restricted Access</h1>
        <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
          Oops! It looks like you don't have the required permissions to access this section of the <span className="text-primary font-bold">Aarogyam</span> portal.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            variant="outline" 
            onClick={() => navigate(-1)}
            className="h-12 px-6 rounded-xl font-bold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
          </Button>
          
          <Link to={getDashboardPath()}>
            <Button className="h-12 px-8 rounded-xl font-bold shadow-lg shadow-primary/20">
              <Home className="w-4 h-4 mr-2" /> My Dashboard
            </Button>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground mt-10 font-medium">
          Logged in as: <span className="text-foreground">{user?.firstName} {user?.lastName}</span> ({user?.role})
        </p>
      </div>
    </div>
  );
}
