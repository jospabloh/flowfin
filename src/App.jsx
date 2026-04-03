import { Suspense, lazy, useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { ThemeProvider } from 'next-themes';
import { FamilyProvider, useFamily } from '@/lib/FamilyContext';
import Layout from '@/components/Layout';
import LoadingFallback from '@/components/LoadingFallback';
import AppUpdateBanner from '@/components/AppUpdateBanner';

// Lazy-loaded pages
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Capture = lazy(() => import('@/pages/Capture'));
import Transactions from '@/pages/Transactions';
const Reports = lazy(() => import('@/pages/Reports'));
const Investments = lazy(() => import('@/pages/Investments'));
const MSIPage = lazy(() => import('@/pages/MSIPage'));
const Rentals = lazy(() => import('@/pages/Rentals'));
const Catalogs = lazy(() => import('@/pages/Catalogs'));
const FamilySettings = lazy(() => import('@/pages/FamilySettings'));
const UserManual = lazy(() => import('@/pages/UserManual'));
const About = lazy(() => import('@/pages/About'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const FamilyAdmin = lazy(() => import('@/pages/FamilyAdmin'));
const Assistant = lazy(() => import('@/pages/Assistant'));
const AccountSettings = lazy(() => import('@/pages/AccountSettings'));
const ScheduledPayments = lazy(() => import('@/pages/ScheduledPayments'));
const Budget = lazy(() => import('@/pages/Budget'));

const FamilyGate = ({ children }) => {
  const { isLoading, membership, family, currentUser } = useFamily();
  const { isLoadingAuth } = useAuth();

  // Safety timeout: if loading takes too long, show onboarding anyway
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  if ((isLoading || isLoadingAuth) && !timedOut) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center shadow-lg animate-pulse-ring">
            <span className="text-white font-bold text-4xl">F</span>
          </div>
          <p className="text-sm text-muted-foreground">Cargando FlowFin...</p>
        </div>
      </div>
    );
  }

  if (!membership || !family) return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center shadow-lg animate-pulse-ring">
          <span className="text-white font-bold text-2xl">F</span>
        </div>
      </div>
    }>
      <Onboarding />
    </Suspense>
  );
  return children;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center shadow-lg animate-pulse-ring">
            <span className="text-white font-bold text-4xl">F</span>
          </div>
          <p className="text-sm text-muted-foreground">Cargando FlowFin...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    else if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <FamilyProvider>
      <FamilyGate>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/Dashboard" replace />} />
            <Route element={<Layout />}>
              <Route path="/Dashboard" element={<Suspense fallback={<LoadingFallback />}><Dashboard /></Suspense>} />
              <Route path="/Capture" element={<Suspense fallback={<LoadingFallback />}><Capture /></Suspense>} />
              <Route path="/Assistant" element={<Suspense fallback={<LoadingFallback />}><Assistant /></Suspense>} />
              <Route path="/Transactions" element={<Transactions />} />
              <Route path="/Reports" element={<Suspense fallback={<LoadingFallback />}><Reports /></Suspense>} />
              <Route path="/Investments" element={<Suspense fallback={<LoadingFallback />}><Investments /></Suspense>} />
              <Route path="/MSI" element={<Suspense fallback={<LoadingFallback />}><MSIPage /></Suspense>} />
              <Route path="/Rentals" element={<Suspense fallback={<LoadingFallback />}><Rentals /></Suspense>} />
              <Route path="/Catalogs" element={<Suspense fallback={<LoadingFallback />}><Catalogs /></Suspense>} />
              <Route path="/FamilySettings" element={<Suspense fallback={<LoadingFallback />}><FamilySettings /></Suspense>} />
              <Route path="/AccountSettings" element={<Suspense fallback={<LoadingFallback />}><AccountSettings /></Suspense>} />
              <Route path="/FamilyAdmin" element={<Suspense fallback={<LoadingFallback />}><FamilyAdmin /></Suspense>} />
              <Route path="/UserManual" element={<Suspense fallback={<LoadingFallback />}><UserManual /></Suspense>} />
              <Route path="/About" element={<Suspense fallback={<LoadingFallback />}><About /></Suspense>} />
              <Route path="/ScheduledPayments" element={<Suspense fallback={<LoadingFallback />}><ScheduledPayments /></Suspense>} />
              <Route path="/Budget" element={<Suspense fallback={<LoadingFallback />}><Budget /></Suspense>} />
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
      </FamilyGate>
    </FamilyProvider>
  );
};

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AppUpdateBanner />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;