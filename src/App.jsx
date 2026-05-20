import { Suspense, lazy, useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { ThemeProvider } from 'next-themes';
import { FamilyProvider, useFamily } from '@/lib/FamilyContext';
import Layout from '@/components/Layout';
import LoadingFallback from '@/components/LoadingFallback';
import TutorialController from '@/components/tutorial/TutorialController';
import { useCanView } from '@/lib/permissions/usePermission';


// Lazy-loaded pages
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Capture = lazy(() => import('@/pages/Capture'));
const Transactions = lazy(() => import('@/pages/Transactions'));
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
const LicenseAdmin = lazy(() => import('@/pages/LicenseAdmin'));
const Assistant = lazy(() => import('@/pages/Assistant'));
const AccountSettings = lazy(() => import('@/pages/AccountSettings'));
const ScheduledPayments = lazy(() => import('@/pages/ScheduledPayments'));
const Budget = lazy(() => import('@/pages/Budget'));
const AIUsage = lazy(() => import('@/pages/AIUsage'));
const PermissionAdmin = lazy(() => import('@/pages/PermissionAdmin'));
const Trips = lazy(() => import('@/pages/Trips'));
const SavingsDashboard = lazy(() => import('@/pages/SavingsDashboard'));
const Goals = lazy(() => import('@/pages/Goals'));
const ReleaseNotes = lazy(() => import('@/pages/ReleaseNotes'));
const PublicSnapshotPage = lazy(() => import('@/pages/PublicSnapshot'));
const LandingPage = lazy(() => import('@/pages/Landing'));
const WaitlistAdmin = lazy(() => import('@/pages/WaitlistAdmin'));

/**
 * PermissionRoute — wraps a page element and redirects to /Dashboard
 * if the user lacks can_view for the given permission key.
 */
function PermissionRoute({ permission, element }) {
  const canView = useCanView(permission);
  if (!canView) return <Navigate to="/Dashboard" replace />;
  return element;
}

const FamilyGate = ({ children }) => {
  const { isLoading, membership, family, membershipError, refetchMembership } = useFamily();
  const { isLoadingAuth } = useAuth();

  // Safety timeout: if loading takes too long AND there's an error, show retry UI (not Onboarding)
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 12000);
    return () => clearTimeout(t);
  }, []);

  if ((isLoading || isLoadingAuth) && !timedOut) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-lg animate-pulse-ring">
            <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/5dd910449_97d3fb29c_logo.png" alt="FlowFin" className="w-full h-full object-cover" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando FlowFin...</p>
        </div>
      </div>
    );
  }

  // If timed out due to a network error, show retry screen instead of Onboarding
  if (timedOut && membershipError && !membership) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 px-8 text-center">
          <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-lg">
            <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/5dd910449_97d3fb29c_logo.png" alt="FlowFin" className="w-full h-full object-cover" />
          </div>
          <p className="text-sm font-semibold text-foreground">No se pudo conectar</p>
          <p className="text-xs text-muted-foreground">Verifica tu conexión a internet e intenta de nuevo.</p>
          <button
            onClick={() => { setTimedOut(false); refetchMembership(); }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Only show Onboarding if we got a confirmed null result (no error) — user genuinely has no family
  if (!membership || !family) return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-16 h-16 rounded-3xl overflow-hidden shadow-lg animate-pulse-ring">
          <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/5dd910449_97d3fb29c_logo.png" alt="FlowFin" className="w-full h-full object-cover" />
        </div>
      </div>
    }>
      <Onboarding />
    </Suspense>
  );
  return children;
};

const AuthenticatedApp = () => {
  const location = useLocation();
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Public routes bypass auth + family gating entirely so visitors without
  // an account can land on share links and the waitlist page. Keep this
  // branch BEFORE any auth-state checks.
  const isPublicSnapshot = location.pathname.startsWith('/s/');
  const isPublicLanding = location.pathname.toLowerCase().startsWith('/landing');
  if (isPublicSnapshot || isPublicLanding) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/s/:slug" element={<PublicSnapshotPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/Landing" element={<LandingPage />} />
        </Routes>
      </Suspense>
    );
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-lg animate-pulse-ring bg-black">
            <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/5dd910449_97d3fb29c_logo.png" alt="FlowFin" className="w-full h-full object-cover" />
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
          <TutorialController />

          <Routes>
            <Route path="/" element={<Navigate to="/Dashboard" replace />} />
            <Route element={<Layout />}>
              <Route path="/Dashboard" element={<Suspense fallback={<LoadingFallback />}><Dashboard /></Suspense>} />
              <Route path="/Capture" element={<Suspense fallback={<LoadingFallback />}><Capture /></Suspense>} />
              <Route path="/Assistant" element={<Suspense fallback={<LoadingFallback />}><Assistant /></Suspense>} />
              <Route path="/Transactions" element={<Suspense fallback={<LoadingFallback />}><Transactions /></Suspense>} />
              <Route path="/Reports" element={<Suspense fallback={<LoadingFallback />}><Reports /></Suspense>} />
              <Route path="/Investments" element={<Suspense fallback={<LoadingFallback />}><Investments /></Suspense>} />
              <Route path="/MSI" element={<Suspense fallback={<LoadingFallback />}><MSIPage /></Suspense>} />
              <Route path="/Rentals" element={<Suspense fallback={<LoadingFallback />}><Rentals /></Suspense>} />
              <Route path="/Catalogs" element={<Suspense fallback={<LoadingFallback />}><Catalogs /></Suspense>} />
              <Route path="/FamilySettings" element={<Suspense fallback={<LoadingFallback />}><FamilySettings /></Suspense>} />
              <Route path="/AccountSettings" element={<Suspense fallback={<LoadingFallback />}><AccountSettings /></Suspense>} />
              <Route path="/FamilyAdmin" element={<Suspense fallback={<LoadingFallback />}><PermissionRoute permission="module.FamilyAdmin" element={<FamilyAdmin />} /></Suspense>} />
              <Route path="/LicenseAdmin" element={<Suspense fallback={<LoadingFallback />}><LicenseAdmin /></Suspense>} />
              <Route path="/WaitlistAdmin" element={<Suspense fallback={<LoadingFallback />}><WaitlistAdmin /></Suspense>} />
              <Route path="/UserManual" element={<Suspense fallback={<LoadingFallback />}><UserManual /></Suspense>} />
              <Route path="/About" element={<Suspense fallback={<LoadingFallback />}><About /></Suspense>} />
              <Route path="/ScheduledPayments" element={<Suspense fallback={<LoadingFallback />}><ScheduledPayments /></Suspense>} />
              <Route path="/Budget" element={<Suspense fallback={<LoadingFallback />}><Budget /></Suspense>} />
              <Route path="/Trips" element={<Suspense fallback={<LoadingFallback />}><Trips /></Suspense>} />
              <Route path="/SavingsDashboard" element={<Suspense fallback={<LoadingFallback />}><SavingsDashboard /></Suspense>} />
              <Route path="/Goals" element={<Suspense fallback={<LoadingFallback />}><Goals /></Suspense>} />
              <Route path="/AIUsage" element={<Suspense fallback={<LoadingFallback />}><AIUsage /></Suspense>} />
              <Route path="/PermissionAdmin" element={<Suspense fallback={<LoadingFallback />}><PermissionRoute permission="module.PermissionAdmin" element={<PermissionAdmin />} /></Suspense>} />
              <Route path="/ReleaseNotes" element={<Suspense fallback={<LoadingFallback />}><PermissionRoute permission="module.ReleaseNotes" element={<ReleaseNotes />} /></Suspense>} />
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
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;