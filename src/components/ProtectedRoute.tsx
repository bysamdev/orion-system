import { useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useUserRole, UserRole } from '@/hooks/useUserRole';

export const ProtectedRoute = ({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) => {
  const { user, loading } = useAuth();
  const { data: role, isLoading: isRoleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || isRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Verifica RBAC se a rota exigir roles específicos
  if (allowedRoles && allowedRoles.length > 0) {
    console.log("ProtectedRoute RBAC check:", { role, allowedRoles });
    if (!role || !allowedRoles.includes(role)) {
      console.log("Redirecionando! Usuário não tem permissão.");
      return <Navigate to={{ pathname: "/", search: window.location.search }} replace />;
    }
  }

  return <>{children}</>;
};
