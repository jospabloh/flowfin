import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, List, Plus, BarChart2, MoreHorizontal, TrendingUp, CreditCard, Building, BookOpen, Settings, HelpCircle, Info, X, Sparkles, Users, MessageCircle, ChevronLeft } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import { usePendingCount } from '@/hooks/usePendingCount';
import PageTransition from './PageTransition';
import { navigateTo, goBack, getNavigationDirection, saveScrollPosition, getScrollPosition, isRootTab } from '@/lib/navigationStack';

const navItems = [
  { to: '/Dashboard', icon: Home, label: 'Inicio' },
  { to: '/Transactions', icon: List, label: 'Movimientos' },
  { to: '/Capture', icon: Plus, label: '', isCenter: true },
  { to: '/Reports', icon: BarChart2, label: 'Reportes' },
  { to: '/more', icon: MoreHorizontal, label: 'Más' },
];

const moreItems = [
  { to: '/Assistant', icon: Sparkles, label: 'Asistente IA', color: 'text-primary' },
  { to: '/Investments', icon: TrendingUp, label: 'Inversiones', color: 'text-emerald-500' },
  { to: '/MSI', icon: CreditCard, label: 'MSI', color: 'text-purple-500' },
  { to: '/Rentals', icon: Building, label: 'Rentas', color: 'text-blue-500' },
  { to: '/Catalogs', icon: BookOpen, label: 'Catálogos', color: 'text-orange-500' },
  { to: '/FamilySettings', icon: Settings, label: 'Mi Familia', color: 'text-rose-500' },
  { to: '/AccountSettings', icon: Settings, label: 'Mi Cuenta', color: 'text-pink-500' },
  { to: '/FamilyAdmin', icon: Users, label: 'Admin', color: 'text-amber-500' },
  { to: '/UserManual', icon: HelpCircle, label: 'Manual', color: 'text-cyan-500' },
  { to: '/About', icon: Info, label: 'Acerca de', color: 'text-muted-foreground' },
];

const sideNavItems = [
  { to: '/Dashboard', icon: Home, label: 'Inicio' },
  { to: '/Transactions', icon: List, label: 'Movimientos' },
  { to: '/Assistant', icon: Sparkles, label: 'Asistente IA' },
  { to: '/Reports', icon: BarChart2, label: 'Reportes' },
  { to: '/Investments', icon: TrendingUp, label: 'Inversiones' },
  { to: '/MSI', icon: CreditCard, label: 'MSI' },
  { to: '/Rentals', icon: Building, label: 'Rentas' },
  { to: '/Catalogs', icon: BookOpen, label: 'Catálogos' },
  { to: '/FamilySettings', icon: Settings, label: 'Mi Familia' },
  { to: '/AccountSettings', icon: Settings, label: 'Mi Cuenta' },
  { to: '/FamilyAdmin', icon: Users, label: 'Admin Familia' },
  { to: '/UserManual', icon: HelpCircle, label: 'Manual' },
  { to: '/About', icon: Info, label: 'Acerca de' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);
  const pendingCount = usePendingCount();
  const isAssistantPage = location.pathname === '/Assistant';
  const showBack = !isRootTab(location.pathname);
  const prevPath = useRef(location.pathname);

  // Handle page transitions with browser history sync
  useEffect(() => {
    // Save scroll position before leaving
    saveScrollPosition(prevPath.current, window.scrollY);

    // Determine direction and update stack
    const direction = getNavigationDirection(prevPath.current, location.pathname);
    
    // Restore scroll position for the new page
    const savedScroll = getScrollPosition(location.pathname);
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedScroll, behavior: 'instant' });
    });

    prevPath.current = location.pathname;
  }, [location.pathname]);

  // Handle system deep links and intent handling
  useEffect(() => {
    const handleAppIntent = (e) => {
      const path = e.detail?.path || new URLSearchParams(window.location.search).get('path');
      if (path && path !== location.pathname) {
        navigateTo(path);
        navigate(path);
      }
    };

    window.addEventListener('app-intent', handleAppIntent);
    return () => window.removeEventListener('app-intent', handleAppIntent);
  }, [navigate, location.pathname]);

  // Setup browser back gesture support
  useEffect(() => {
    const handlePopState = (e) => {
      const path = e.state?.path || location.pathname;
      navigate(path);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate, location.pathname]);

  const handleNavClick = (path) => {
    if (path !== location.pathname) {
      navigateTo(path);
      navigate(path);
    }
  };

  const handleBack = () => {
    goBack();
  };

  return (
    <div className="min-h-screen bg-background flex overscroll-none" id="main-app-wrapper">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r border-border bg-card/60 backdrop-blur-xl overscroll-none">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <span className="text-primary-foreground font-bold text-lg">F</span>
            </div>
            <div>
              <h1 className="font-bold text-foreground text-sm leading-tight">FlowFin</h1>
              <p className="text-xs text-muted-foreground">Finanzas Familiares</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto overscroll-none hide-scrollbar">
          {sideNavItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            const showBadge = item.to === '/Transactions' && pendingCount > 0;
            return (
              <button key={item.to} onClick={() => handleNavClick(item.to)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 w-full text-left touch-target
                  ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                <div className="relative flex-shrink-0">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  {showBadge && (
                    <span aria-label={`${pendingCount} pendientes`} className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full bg-destructive text-[8px] text-white font-bold flex items-center justify-center">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </div>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <ThemeToggle />
          </div>
          <button onClick={() => handleNavClick('/Capture')}
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            Registrar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile back header — only shown on non-root pages */}
        {showBack && (
          <div className="md:hidden flex items-center gap-2 px-3 pt-safe border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30 h-12 flex-shrink-0">
            <button
              onClick={handleBack}
              aria-label="Regresar"
              className="flex items-center gap-1 text-primary text-sm font-medium active:opacity-60 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              Atrás
            </button>
          </div>
        )}
        <div className="flex-1 mb-nav md:mb-0 overflow-y-auto overscroll-none hide-scrollbar" id="main-scroll">
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </div>
      </main>

      {/* Floating Assistant Button — hidden on Assistant page */}
      {!isAssistantPage && (
        <button onClick={() => handleNavClick('/Assistant')}
          className="fixed bottom-28 right-4 md:bottom-6 md:right-6 z-30 w-12 h-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow-lg shadow-secondary/30 active:scale-95 transition-transform hover:scale-105 touch-target"
          aria-label="Abrir asistente inteligente para consultas">
          <MessageCircle className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-card/90 backdrop-blur-xl border-t border-border pb-safe z-40 overscroll-none">
        <div className="flex items-end justify-around px-2 pt-2 pb-1">
          {navItems.map(item => {
            if (item.to === '/more') {
              const active = ['Investments','MSI','Rentals','Catalogs','FamilySettings','AccountSettings','UserManual','About']
                .some(p => location.pathname.includes(p));
              return (
                <button key="more" onClick={() => setShowMore(true)}
                    aria-label="Abrir más opciones de navegación"
                    aria-haspopup="dialog"
                    aria-expanded={showMore}
                    className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[52px] transition-all touch-target
                      ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                    <MoreHorizontal className="w-6 h-6" aria-hidden="true" />
                    <span className="text-[10px] font-medium">Más</span>
                  </button>
              );
            }
            if (item.isCenter) {
              return (
                <button key={item.to} onClick={() => handleNavClick(item.to)} aria-label="Registrar nuevo movimiento"
                  className="flex items-center justify-center w-14 h-14 rounded-full bg-primary shadow-lg shadow-primary/30 -mt-4 transition-transform active:scale-95">
                  <Plus className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
                </button>
              );
            }
            const Icon = item.icon;
            const active = location.pathname === item.to;
            const showBadge = item.to === '/Transactions' && pendingCount > 0;
            return (
              <button key={item.to} onClick={() => handleNavClick(item.to)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[52px] transition-all touch-target
                  ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className="relative">
                  <Icon className="w-6 h-6" aria-hidden="true" />
                  {showBadge && (
                    <span aria-label={`${pendingCount} movimientos pendientes`} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-[9px] text-white font-bold flex items-center justify-center">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* More Drawer */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 md:hidden"
              onClick={() => setShowMore(false)} />
            <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="more-options-title"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card rounded-t-3xl border-t border-border pb-safe overscroll-none">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3 mb-4" aria-hidden="true" />
            <div className="flex items-center justify-between px-6 mb-4">
              <h3 id="more-options-title" className="font-semibold text-foreground">Más opciones</h3>
              <button onClick={() => setShowMore(false)} aria-label="Cerrar panel de opciones adicionales" className="p-1.5 rounded-lg bg-muted text-muted-foreground touch-target">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
              <div className="grid grid-cols-4 gap-3 px-4 pb-6 overscroll-none">
                {moreItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <button key={item.to} onClick={() => { handleNavClick(item.to); setShowMore(false); }}
                      aria-label={item.label}
                      className="w-full flex flex-col items-center gap-2 p-3 rounded-2xl bg-muted/50 hover:bg-muted transition-colors touch-target">
                      <div className={`w-10 h-10 rounded-xl bg-card flex items-center justify-center shadow-sm ${item.color}`}>
                        <Icon className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <span className="text-[11px] font-medium text-foreground text-center leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}