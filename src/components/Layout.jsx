import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, List, Plus, BarChart2, MoreHorizontal,
  TrendingUp, CreditCard, Building, BookOpen, Settings,
  HelpCircle, Info, X, Sparkles, Users,
  ChevronLeft, CalendarCheck, PiggyBank, ChevronRight,
  Wallet, ShieldCheck
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import InternetBanner from './InternetBanner';
import TrialBanner from './TrialBanner';
import { usePendingCount } from '@/hooks/usePendingCount';
import { useFamily } from '@/lib/FamilyContext';
import { useSessionManager } from '@/hooks/useSessionManager';
import IdleWarningDialog from './IdleWarningDialog';
import SessionExpiredDialog from './SessionExpiredDialog';

const PRIMARY_TABS = ['/Dashboard', '/Transactions', '/Capture', '/Reports', '/Assistant'];

const navItems = [
  { to: '/Dashboard', icon: Home, label: 'Inicio' },
  { to: '/Transactions', icon: List, label: 'Movimientos' },
  { to: '/Capture', icon: Plus, label: '', isCenter: true },
  { to: '/Reports', icon: BarChart2, label: 'Reportes' },
  { to: '/more', icon: MoreHorizontal, label: 'Más' },
];

// Groups for the "Más" drawer (mobile) and sidebar groups (desktop)
const MORE_GROUPS = [
  {
    label: 'Herramientas',
    items: [
      { to: '/Assistant', icon: Sparkles, label: 'Asistente IA', color: 'text-primary', bg: 'bg-primary/10' },
      { to: '/Budget', icon: PiggyBank, label: 'Presupuesto', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    ],
  },
  {
    label: 'Compromisos',
    items: [
      { to: '/ScheduledPayments', icon: CalendarCheck, label: 'Pagos del Mes', color: 'text-teal-600', bg: 'bg-teal-500/10' },
      { to: '/Investments', icon: TrendingUp, label: 'Inversiones', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
      { to: '/MSI', icon: CreditCard, label: 'MSI', color: 'text-purple-500', bg: 'bg-purple-500/10' },
      { to: '/Rentals', icon: Building, label: 'Rentas', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { to: '/Catalogs', icon: BookOpen, label: 'Catálogos', color: 'text-orange-500', bg: 'bg-orange-500/10' },
      { to: '/FamilySettings', icon: Wallet, label: 'Mi Familia', color: 'text-rose-500', bg: 'bg-rose-500/10' },
      { to: '/AccountSettings', icon: Settings, label: 'Mi Cuenta', color: 'text-pink-500', bg: 'bg-pink-500/10' },
      { to: '/FamilyAdmin', icon: Users, label: 'Admin', color: 'text-amber-500', bg: 'bg-amber-500/10', adminOnly: true },
    ],
  },
  {
    label: 'Información',
    items: [
      { to: '/UserManual', icon: HelpCircle, label: 'Manual', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
      { to: '/About', icon: Info, label: 'Acerca de', color: 'text-muted-foreground', bg: 'bg-muted' },
    ],
  },
];

// Flat list for sidebar — with group section headers
const SIDEBAR_GROUPS = [
  {
    label: null,
    items: [
      { to: '/Dashboard', icon: Home, label: 'Inicio' },
      { to: '/Transactions', icon: List, label: 'Movimientos' },
      { to: '/Reports', icon: BarChart2, label: 'Reportes' },
    ],
  },
  {
    label: 'Herramientas',
    items: [
      { to: '/Assistant', icon: Sparkles, label: 'Asistente IA' },
      { to: '/Budget', icon: PiggyBank, label: 'Presupuesto' },
    ],
  },
  {
    label: 'Compromisos',
    items: [
      { to: '/ScheduledPayments', icon: CalendarCheck, label: 'Pagos del Mes' },
      { to: '/Investments', icon: TrendingUp, label: 'Inversiones' },
      { to: '/MSI', icon: CreditCard, label: 'MSI' },
      { to: '/Rentals', icon: Building, label: 'Rentas' },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { to: '/Catalogs', icon: BookOpen, label: 'Catálogos' },
      { to: '/FamilySettings', icon: Wallet, label: 'Mi Familia' },
      { to: '/AccountSettings', icon: Settings, label: 'Mi Cuenta' },
      { to: '/FamilyAdmin', icon: Users, label: 'Admin Familia', adminOnly: true },
    ],
  },
  {
    label: 'Información',
    items: [
      { to: '/UserManual', icon: HelpCircle, label: 'Manual' },
      { to: '/About', icon: Info, label: 'Acerca de' },
    ],
  },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);
  const pendingCount = usePendingCount();
  const { family, isAdmin, currentUser } = useFamily();
  const { idleState, sessionExpired, continueSession } = useSessionManager();
  const isAssistantPage = location.pathname === '/Assistant';
  const showBack = !PRIMARY_TABS.includes(location.pathname);

  const handleNavClick = (path) => {
    if (path !== location.pathname) navigate(path);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/Dashboard');
    }
  };

  const isMoreActive = MORE_GROUPS.flatMap(g => g.items)
    .some(item => location.pathname === item.to);

  return (
    <div className="min-h-screen bg-background flex flex-col overscroll-none" id="main-app-wrapper">
      <InternetBanner />
      <TrialBanner />
      <IdleWarningDialog open={idleState === 'idle_warning'} onContinue={continueSession} />
      <SessionExpiredDialog open={sessionExpired} />
      <div className="flex flex-1 overflow-hidden">

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-60 h-screen sticky top-0 border-r border-border bg-card/60 backdrop-blur-xl overscroll-none">
          {/* Logo */}
          <div className="p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md bg-black">
                <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/0206f467d_FlowFin_logo.png" alt="FlowFin" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="font-bold text-foreground text-sm leading-tight">FlowFin</h1>
                <p className="text-xs text-muted-foreground truncate max-w-[130px]">{family?.name || 'Finanzas Familiares'}</p>
              </div>
            </div>
          </div>

          {/* Nav groups */}
          <nav className="flex-1 py-3 overflow-y-auto overscroll-none hide-scrollbar">
            {SIDEBAR_GROUPS.map((group, gi) => (
              <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
                {group.label && (
                  <p className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                    {group.label}
                  </p>
                )}
                <div className="px-3 space-y-0.5">
                  {group.items.filter(item => !item.adminOnly || isAdmin).map(item => {
                    const Icon = item.icon;
                    const active = location.pathname === item.to;
                    const showBadge = item.to === '/Transactions' && pendingCount > 0;
                    return (
                      <button key={item.to} onClick={() => handleNavClick(item.to)}
                        aria-label={item.label}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 w-full text-left touch-target
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
                </div>
              </div>
            ))}
          </nav>

          {/* System Admin — only visible for app-level admins */}
          {currentUser?.role === 'admin' && (
            <div className="px-3 border-t border-amber-200/60 dark:border-amber-800/40 pt-2 pb-1">
              <p className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600/80">Sistema</p>
              <button
                onClick={() => handleNavClick('/LicenseAdmin')}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium w-full text-left transition-all touch-target
                  ${location.pathname === '/LicenseAdmin'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              >
                <ShieldCheck className="w-4 h-4" />
                Licencias
              </button>
            </div>
          )}

          {/* Bottom actions */}
          <div className="p-4 border-t border-border space-y-2">
            <ThemeToggle showLabel />
            <button onClick={() => handleNavClick('/Capture')}
              className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              Registrar
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
          {showBack && (
            <div className="md:hidden flex items-center gap-2 px-3 pt-safe border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30 h-12 flex-shrink-0">
              <button onClick={handleBack} aria-label="Regresar"
                className="flex items-center gap-1 text-primary text-sm font-medium active:opacity-60 transition-opacity">
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                Atrás
              </button>
            </div>
          )}
          <div className="flex-1 mb-nav md:mb-0 overflow-y-auto hide-scrollbar" id="main-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
            <Outlet />
          </div>
        </main>

        {/* Floating Assistant Button — mobile only (desktop uses sidebar) */}
        {!isAssistantPage && (
          <button onClick={() => handleNavClick('/Assistant')}
            className="md:hidden fixed right-4 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform hover:scale-105 touch-target"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
            aria-label="Abrir asistente inteligente">
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        {/* Mobile Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-card/95 backdrop-blur-xl border-t border-border z-40 overscroll-none"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {family?.name && (
            <div className="flex justify-center pt-1">
              <span className="text-[9px] font-semibold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">{family.name}</span>
            </div>
          )}
          <div className="grid grid-cols-5 items-center px-1 pt-1 pb-1">
            {navItems.map(item => {
              if (item.to === '/more') {
                return (
                  <button key="more" onClick={() => setShowMore(true)}
                    aria-label="Abrir más opciones"
                    aria-haspopup="dialog"
                    aria-expanded={showMore}
                    className={`flex flex-col items-center gap-0.5 py-1 w-full transition-all touch-target
                      ${isMoreActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
                    <span className="text-[10px] font-medium">Más</span>
                  </button>
                );
              }
              if (item.isCenter) {
                return (
                  <button key={item.to} onClick={() => handleNavClick(item.to)} aria-label="Registrar nuevo movimiento"
                    className="flex items-center justify-center w-full py-1 transition-transform active:scale-95">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary shadow-lg shadow-primary/30">
                      <Plus className="w-6 h-6 text-primary-foreground" aria-hidden="true" />
                    </div>
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
                  className={`flex flex-col items-center gap-0.5 py-1 w-full transition-all touch-target
                    ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className="relative">
                    <Icon className="w-5 h-5" aria-hidden="true" />
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

        {/* More Drawer (Mobile) */}
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
                className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card rounded-t-3xl border-t border-border overscroll-none"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', maxHeight: '88vh', overflowY: 'auto' }}>

                <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3" aria-hidden="true" />

                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <h3 id="more-options-title" className="font-semibold text-foreground">Más opciones</h3>
                  <button onClick={() => setShowMore(false)} aria-label="Cerrar" className="p-1.5 rounded-lg bg-muted text-muted-foreground touch-target">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-4 pt-2 pb-1">
                  <ThemeToggle showLabel />
                </div>

                {/* Grouped items */}
                {MORE_GROUPS.map((group, gi) => {
                  const filteredItems = group.items.filter(item => !item.adminOnly || isAdmin);
                  if (filteredItems.length === 0) return null;
                  return (
                    <div key={gi} className="px-4 pb-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 mt-3">{group.label}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {filteredItems.map(item => {
                          const Icon = item.icon;
                          const active = location.pathname === item.to;
                          return (
                            <button key={item.to}
                              onClick={() => { handleNavClick(item.to); setShowMore(false); }}
                              aria-label={item.label}
                              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-colors touch-target
                                ${active ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted/50 hover:bg-muted'}`}>
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${item.bg} ${item.color}`}>
                                <Icon className="w-5 h-5" aria-hidden="true" />
                              </div>
                              <span className="text-[10px] font-medium text-foreground text-center leading-tight">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Sistema — solo visible para el app-admin (owner) */}
                {currentUser?.role === 'admin' && (
                  <div className="px-4 pb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600/80 mb-2 mt-3">Sistema</p>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => { handleNavClick('/LicenseAdmin'); setShowMore(false); }}
                        aria-label="Licencias"
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-colors touch-target
                          ${location.pathname === '/LicenseAdmin' ? 'bg-amber-100 dark:bg-amber-900/30 ring-1 ring-amber-400/40' : 'bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/80 dark:hover:bg-amber-900/30'}`}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm bg-amber-500/10 text-amber-600">
                          <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 text-center leading-tight">Licencias</span>
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}