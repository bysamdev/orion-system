import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useUserRole, UserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

const RedirectWithToast = () => {
  useEffect(() => {
    toast.error('Você não tem permissão para acessar essa área.');
  }, []);
  return <Navigate to={{ pathname: "/", search: window.location.search }} replace />;
};

export const ProtectedRoute = ({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) => {
  const { user, loading } = useAuth();
  const { data: role, isLoading: isRoleLoading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={{ pathname: "/auth", search: window.location.search }} replace />;
  }

  if (isRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const effectiveRole = role || 'customer';

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(effectiveRole)) {
      return <RedirectWithToast />;
    }
  }

  return <>{children}</>;
};
