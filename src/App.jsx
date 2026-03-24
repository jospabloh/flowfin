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
import Dashboard from '@/pages/Dashboard';
import Capture from '@/pages/Capture';
import Transactions from '@/pages/Transactions';
import Reports from '@/pages/Reports';
import Investments from '@/pages/Investments';
import MSIPage from '@/pages/MSIPage';
import Rentals from '@/pages/Rentals';
import Catalogs from '@/pages/Catalogs';
import FamilySettings from '@/pages/FamilySettings';
import UserManual from '@/pages/UserManual';
import About from '@/pages/About';
import Onboarding from '@/pages/Onboarding';
import FamilyAdmin from '@/pages/FamilyAdmin';
import Assistant from '@/pages/Assistant';

const FamilyGate = ({ children }) => {
  const { isLoading, membership, family } = useFamily();
  const { isLoadingAuth } = useAuth();

  if (isLoading || isLoadingAuth) {
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

  if (!membership || !family) return <Onboarding />;
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
        <Routes>
          <Route path="/" element={<Navigate to="/Dashboard" replace />} />
          <Route element={<Layout />}>
            <Route path="/Dashboard" element={<Dashboard />} />
            <Route path="/Capture" element={<Capture />} />
            <Route path="/Assistant" element={<Assistant />} />
            <Route path="/Transactions" element={<Transactions />} />
            <Route path="/Reports" element={<Reports />} />
            <Route path="/Investments" element={<Investments />} />
            <Route path="/MSI" element={<MSIPage />} />
            <Route path="/Rentals" element={<Rentals />} />
            <Route path="/Catalogs" element={<Catalogs />} />
            <Route path="/FamilySettings" element={<FamilySettings />} />
            <Route path="/FamilyAdmin" element={<FamilyAdmin />} />
            <Route path="/UserManual" element={<UserManual />} />
            <Route path="/About" element={<About />} />
          </Route>
          <Route path="*" element={<PageNotFound />} />
        </Routes>
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