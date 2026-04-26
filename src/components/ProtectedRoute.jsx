import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { useCanView } from '@/lib/permissions/usePermission';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

/**
 * PermissionGate — inner component that calls useCanView (a hook) safely
 * after auth has resolved. Only rendered when auth is confirmed.
 */
function PermissionGate({ permission, children }) {
  const canView = useCanView(permission);
  if (!canView) return <Navigate to="/Dashboard" replace />;
  return children;
}

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement, permission }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  if (permission) {
    return (
      <PermissionGate permission={permission}>
        <Outlet />
      </PermissionGate>
    );
  }

  return <Outlet />;
}
