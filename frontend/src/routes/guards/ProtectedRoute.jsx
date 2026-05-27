import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

export const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, hasRole, isInitialized } = useAuthStore();
  const location = useLocation();

  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-screen">Loading session...</div>;
  }

  if (!isAuthenticated()) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    // If they are logged in but do not have the required role, 
    // redirect to their specific home page or an unauthorized page
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};
