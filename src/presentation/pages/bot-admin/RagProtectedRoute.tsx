import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ragAuthApi } from '../../../infrastructure/auth/ragAuthApi';
import AppLoader from '../../../shared/ui/AppLoader';

interface RagProtectedRouteProps {
  children: React.ReactNode;
}

export default function RagProtectedRoute({ children }: RagProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const verifyAuth = async () => {
      if (!ragAuthApi.isAuthenticated()) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        await ragAuthApi.getMe();
        setAuthenticated(true);
      } catch (err) {
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#070F19]">
        <AppLoader />
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/rag-admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
