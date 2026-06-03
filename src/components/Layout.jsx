import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, List, Plus, BarChart2, MoreHorizontal,
  TrendingUp, CreditCard, Building, BookOpen, Settings,
  HelpCircle, Info, X, Sparkles, Users,
  ChevronLeft, ChevronDown, CalendarCheck, PiggyBank,
  Wallet, ShieldCheck, KeyRound, BadgeCheck,
  PanelLeftClose, PanelLeftOpen, Plane, Coins, Target, ScrollText,
  MessageCircle
} from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import InternetBanner from './InternetBanner';
import TrialBanner from './TrialBanner';
import FloatingActionButton from './FloatingActionButton';
import { usePendingCount } from '@/hooks/usePendingCount';
import { useFamily } from '@/lib/FamilyContext';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import IdleWarningDialog from './IdleWarningDialog';
import SessionExpiredDialog from './SessionExpiredDialog';
import { useCanView } from '@/lib/permissions/usePermission';

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
      { to: '/SavingsDashboard', icon: Coins, label: 'Ahorro', color: 'text-yellow-600', bg: 'bg-yellow-500/10' },
      { to: '/Goals', icon: Target, label: 'Metas', color: 'text-rose-600', bg: 'bg-rose-500/10' },
      { to: '/Trips', icon: Plane, label: 'Viajes', color: 'text-sky-600', bg: 'bg-sky-500/10' },
      { to: '/Messages', icon: MessageCircle, label: 'Mensajes', color: 'text-blue-600', bg: 'bg-blue-500/10' },
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
      { to: '/PermissionAdmin', icon: KeyRound, label: 'Permisos', color: 'text-violet-500', bg: 'bg-violet-500/10', adminOnly: true },
      { to: '/LicenseAdmin', icon: BadgeCheck, label: 'Mi Licencia', color: 'text-teal-600', bg: 'bg-teal-500/10', adminOnly: true },
      { to: '/ReleaseNotes', icon: ScrollText, label: 'Release Notes', color: 'text-indigo-500', bg: 'bg-indigo-500/10', adminOnly: true },
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
      { to: '/SavingsDashboard', icon: Coins, label: 'Ahorro' },
      { to: '/Goals', icon: Target, label: 'Metas' },
      { to: '/Trips', icon: Plane, label: 'Viajes' },
      { to: '/Messages', icon: MessageCircle, label: 'Mensajes' },
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
      { to: '/PermissionAdmin', icon: KeyRound, label: 'Permisos', adminOnly: true },
      { to: '/LicenseAdmin', icon: BadgeCheck, label: 'Mi Licencia', adminOnly: true },
      { to: '/ReleaseNotes', icon: ScrollText, label: 'Release Notes', adminOnly: true },
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

// Simple tooltip wrapper for collapsed sidebar items
function NavTooltip({ label, collapsed, children }) {
  if (!collapsed) return children;
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
        opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150">
        <div className="bg-foreground text-background text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
          {label}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const [groupCollapsed, setGroupCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_groups_collapsed');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const pendingCount = usePendingCount();

  // Persist collapsed state
  useEffect(() => {
    try { localStorage.setItem('sidebar_collapsed', String(collapsed)); } catch { /* ignore quota/security errors */ }
  }, [collapsed]);

  // Persist group collapsed state
  useEffect(() => {
    try { localStorage.setItem('sidebar_groups_collapsed', JSON.stringify(groupCollapsed)); } catch { /* ignore quota/security errors */ }
  }, [groupCollapsed]);

  const toggleGroup = (label) => {
    setGroupCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Close mobile drawer on navigation
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  const { family, isAdmin, currentUser } = useFamily();
  const { idleState, sessionExpired, continueSession } = useSessionManager();
  useActivityTracker(family?.id);
  const navRef = useRef(null);

  // Dynamically measure the bottom nav height and expose it as a CSS variable
  useEffect(() => {
    const updateNavHeight = () => {
      if (navRef.current) {
        const h = navRef.current.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--nav-height', `${h}px`);
      }
    };
    updateNavHeight();
    const ro = new ResizeObserver(updateNavHeight);
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
  }, []);

  const isAssistantPage = location.pathname === '/Assistant';
  const showBack = !PRIMARY_TABS.includes(location.pathname);

  // Permission checks for nav items — called unconditionally (React hooks rules)
  const canViewDashboard       = useCanView('module.Dashboard');
  const canViewTransactions    = useCanView('module.Transactions');
  const canViewReports         = useCanView('module.Reports');
  const canViewAssistant       = useCanView('module.Assistant');
  const canViewBudget          = useCanView('module.Budget');
  const canViewScheduled       = useCanView('module.ScheduledPayments');
  const canViewInvestments     = useCanView('module.Investments');
  const canViewMSI             = useCanView('module.MSI');
  const canViewRentals         = useCanView('module.Rentals');
  const canViewCatalogs        = useCanView('module.Catalogs');
  const canViewFamilySettings  = useCanView('module.FamilySettings');
  const canViewAccountSettings = useCanView('module.AccountSettings');
  const canViewFamilyAdmin     = useCanView('module.FamilyAdmin');
  const canViewPermAdmin       = useCanView('module.PermissionAdmin');
  const canViewLicenseAdmin    = useCanView('module.LicenseAdmin');
  const canViewUserManual      = useCanView('module.UserManual');
  const canViewAbout           = useCanView('module.About');
  const canViewReleaseNotes    = useCanView('module.ReleaseNotes');

  // Map route → can_view so we can filter nav items
  const moduleVisibility = useMemo(() => ({
    '/Dashboard':       canViewDashboard,
    '/Transactions':    canViewTransactions,
    '/Capture':         true, // always visible
    '/Reports':         canViewReports,
    '/Assistant':       canViewAssistant,
    '/Budget':          canViewBudget,
    '/SavingsDashboard': true,
    '/Goals':           true,
    '/Trips':           true,
    '/Messages':        true,
    '/ScheduledPayments': canViewScheduled,
    '/Investments':     canViewInvestments,
    '/MSI':             canViewMSI,
    '/Rentals':         canViewRentals,
    '/Catalogs':        canViewCatalogs,
    '/FamilySettings':  canViewFamilySettings,
    '/AccountSettings': canViewAccountSettings,
    '/FamilyAdmin':     canViewFamilyAdmin,
    '/PermissionAdmin': canViewPermAdmin,
    '/LicenseAdmin':    canViewLicenseAdmin,
    '/UserManual':      canViewUserManual,
    '/About':           canViewAbout,
    '/ReleaseNotes':    canViewReleaseNotes,
  }), [canViewDashboard, canViewTransactions, canViewReports, canViewAssistant, canViewBudget,
       canViewScheduled, canViewInvestments, canViewMSI, canViewRentals, canViewCatalogs,
       canViewFamilySettings, canViewAccountSettings, canViewFamilyAdmin, canViewPermAdmin,
       canViewLicenseAdmin, canViewUserManual, canViewAbout, canViewReleaseNotes]);

  function canShowItem(item) {
    // adminOnly items are shown if isAdmin OR the permission matrix allows it
    if (item.adminOnly && !isAdmin) return false;
    const perm = moduleVisibility[item.to];
    return perm !== false; // undefined = not in map = show by default
  }

  const handleNavClick = (path) => {
    if (path !== location.pathname) navigate(path);
  };

  const handleBack = () => {
    if (globalThis.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/Dashboard');
    }
  };

  const isMoreActive = MORE_GROUPS.flatMap(g => g.items)
    .some(item => location.pathname === item.to);

  // Shared sidebar content — used both in desktop and mobile drawer
  const SidebarContent = ({ inDrawer = false }) => (
    <>
      {/* Logo + Toggle */}
      <div className={`border-b border-border flex items-center ${collapsed && !inDrawer ? 'justify-center p-3' : 'p-4'}`}>
        {collapsed && !inDrawer ? (
          <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md bg-black flex-shrink-0">
            <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/0206f467d_FlowFin_logo.png" alt="FlowFin" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md bg-black flex-shrink-0">
              <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/0206f467d_FlowFin_logo.png" alt="FlowFin" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-foreground text-sm leading-tight">FlowFin</h1>
              <p className="text-xs text-muted-foreground truncate max-w-[110px]">{family?.name || 'Finanzas Familiares'}</p>
            </div>
          </div>
        )}
        {!inDrawer && (
          <button
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            className={`p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0 ${collapsed ? 'mt-2' : ''}`}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 py-3 overflow-y-auto overscroll-none hide-scrollbar">
        {SIDEBAR_GROUPS.map((group, gi) => {
          const sidebarExpanded = !collapsed || inDrawer;
          const isGroupCollapsed = group.label && sidebarExpanded && !!groupCollapsed[group.label];
          const hasActiveItem = group.label && group.items.some(item => location.pathname === item.to);
          return (
            <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
              {group.label && sidebarExpanded && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-5 pt-3 pb-1 group/gh"
                  aria-expanded={!isGroupCollapsed}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 group-hover/gh:text-muted-foreground transition-colors">
                    {group.label}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {isGroupCollapsed && hasActiveItem && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" aria-label="Sección activa" />
                    )}
                    <ChevronDown className={`w-3 h-3 text-muted-foreground/50 transition-transform duration-200 ${isGroupCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                  </div>
                </button>
              )}
              {group.label && !sidebarExpanded && <div className="mx-3 mt-3 mb-1 border-t border-border" />}
              <AnimatePresence initial={false}>
                {!isGroupCollapsed && (
                  <motion.div
                    key="items"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className={`space-y-0.5 ${!sidebarExpanded ? 'px-2' : 'px-3'}`}>
                      {group.items.filter(item => canShowItem(item)).map(item => {
                        const Icon = item.icon;
                        const active = location.pathname === item.to;
                        const showBadge = item.to === '/Transactions' && pendingCount > 0;
                        return (
                          <NavTooltip key={item.to} label={item.label} collapsed={!sidebarExpanded}>
                            <button
                              onClick={() => { handleNavClick(item.to); if (inDrawer) setMobileOpen(false); }}
                              aria-label={item.label}
                              aria-current={active ? 'page' : undefined}
                              className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 w-full touch-target
                                ${!sidebarExpanded ? 'justify-center px-2 py-2.5' : 'px-3 py-2 text-left'}
                                ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                              <div className="relative flex-shrink-0">
                                <Icon className="w-4 h-4" aria-hidden="true" />
                                {showBadge && (
                                  <span aria-label={`${pendingCount} pendientes`} className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full bg-destructive text-[8px] text-white font-bold flex items-center justify-center">
                                    {pendingCount > 9 ? '9+' : pendingCount}
                                  </span>
                                )}
                              </div>
                              {sidebarExpanded && item.label}
                            </button>
                          </NavTooltip>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* System Admin */}
      {(currentUser?.role === 'admin' || canViewLicenseAdmin) && (() => {
        const sidebarExpanded = !collapsed || inDrawer;
        const sistemaItems = [
          { to: '/LicenseAdmin', icon: ShieldCheck, label: 'Licencias', visible: currentUser?.role === 'admin' || canViewLicenseAdmin },
        ].filter(x => x.visible);
        const isSistemaCollapsed = sidebarExpanded && !!groupCollapsed['Sistema'];
        const hasSistemaActive = sistemaItems.some(x => location.pathname === x.to);
        return (
          <div className={`border-t border-amber-200/60 dark:border-amber-800/40 pt-2 pb-1 ${!sidebarExpanded ? 'px-2' : 'px-3'}`}>
            {sidebarExpanded ? (
              <button
                onClick={() => toggleGroup('Sistema')}
                className="w-full flex items-center justify-between px-2 py-0.5 group/sh"
                aria-expanded={!isSistemaCollapsed}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600/80 group-hover/sh:text-amber-600 transition-colors">Sistema</p>
                <div className="flex items-center gap-1.5">
                  {isSistemaCollapsed && hasSistemaActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" aria-label="Sección activa" />
                  )}
                  <ChevronDown className={`w-3 h-3 text-amber-500/60 transition-transform duration-200 ${isSistemaCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                </div>
              </button>
            ) : (
              <div className="mb-1" />
            )}
            <AnimatePresence initial={false}>
              {!isSistemaCollapsed && (
                <motion.div
                  key="sistema-items"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  {sistemaItems.map(({ to, icon: Icon, label }) => (
                    <NavTooltip key={to} label={label} collapsed={!sidebarExpanded}>
                      <button
                        onClick={() => { handleNavClick(to); if (inDrawer) setMobileOpen(false); }}
                        className={`flex items-center gap-3 rounded-xl text-sm font-medium w-full transition-all touch-target
                          ${!sidebarExpanded ? 'justify-center px-2 py-2.5' : 'px-3 py-2 text-left'}
                          ${location.pathname === to
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                      >
                        <Icon className="w-4 h-4" />
                        {sidebarExpanded && label}
                      </button>
                    </NavTooltip>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })()}

      {/* Bottom actions */}
      <div className={`border-t border-border ${collapsed && !inDrawer ? 'p-2 space-y-2' : 'p-4 space-y-2'}`}>
        {(!collapsed || inDrawer) ? (
          <>
            <ThemeToggle showLabel />
            <button onClick={() => { handleNavClick('/Capture'); if (inDrawer) setMobileOpen(false); }}
              className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              Registrar
            </button>
          </>
        ) : (
          <>
            <NavTooltip label="Tema" collapsed>
              <div className="flex justify-center"><ThemeToggle /></div>
            </NavTooltip>
            <NavTooltip label="Registrar" collapsed>
              <button onClick={() => handleNavClick('/Capture')}
                className="flex items-center justify-center w-full bg-primary text-primary-foreground rounded-xl p-2.5 hover:bg-primary/90 transition-colors shadow-sm">
                <Plus className="w-4 h-4" />
              </button>
            </NavTooltip>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col overscroll-none" id="main-app-wrapper">
      <InternetBanner />
      <TrialBanner />
      <IdleWarningDialog open={idleState === 'idle_warning'} onContinue={continueSession} />
      <SessionExpiredDialog open={sessionExpired} />
      <div className="flex flex-1 overflow-hidden">

        {/* Desktop Sidebar */}
        <aside
          className={`hidden md:flex flex-col h-screen sticky top-0 border-r border-border bg-card/60 backdrop-blur-xl overscroll-none transition-all duration-300 overflow-hidden flex-shrink-0
            ${collapsed ? 'w-16' : 'w-60'}`}
        >
          <SidebarContent />
        </aside>

        {/* Mobile Drawer Overlay */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-40 md:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed left-0 top-0 bottom-0 w-72 z-50 md:hidden flex flex-col bg-card border-r border-border overscroll-none"
              >
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md bg-black flex-shrink-0">
                      <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/0206f467d_FlowFin_logo.png" alt="FlowFin" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h1 className="font-bold text-foreground text-sm leading-tight">FlowFin</h1>
                      <p className="text-xs text-muted-foreground truncate max-w-[140px]">{family?.name || 'Finanzas Familiares'}</p>
                    </div>
                  </div>
                  <button onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"
                    className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <SidebarContent inDrawer />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Mobile top bar — always shown, has back or menu toggle */}
          <div className="md:hidden flex items-center gap-2 px-3 pt-safe border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30 h-12 flex-shrink-0">
            {showBack ? (
              <button onClick={handleBack} aria-label="Regresar"
                className="flex items-center gap-1 text-primary text-sm font-medium active:opacity-60 transition-opacity">
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                Atrás
              </button>
            ) : (
              <button onClick={() => setMobileOpen(true)} aria-label="Abrir menú"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            )}
          </div>
          <div
            className={`flex-1 min-h-0 overflow-hidden ${isAssistantPage ? 'flex flex-col' : 'overflow-y-auto mb-nav md:mb-0 hide-scrollbar show-scrollbar-on-desktop'}`}
            id="main-scroll"
            style={!isAssistantPage ? { WebkitOverflowScrolling: 'touch' } : { display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
          >
            <Outlet />
          </div>
        </main>

        {/* Floating Action Button — mobile only (desktop uses sidebar) */}
        <FloatingActionButton isAssistantPage={isAssistantPage} handleNavClick={handleNavClick} />

        {/* Mobile Bottom Nav */}
        <nav ref={navRef} className="fixed bottom-0 left-0 right-0 md:hidden bg-card/95 backdrop-blur-xl border-t border-border z-40 overscroll-none"
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
                  const filteredItems = group.items.filter(item => canShowItem(item));
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

                {/* Sistema — solo visible para el app-admin (owner) o con permiso explícito */}
                {(currentUser?.role === 'admin' || canViewLicenseAdmin) && (
                  <div className="px-4 pb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600/80 mb-2 mt-3">Sistema</p>
                    <div className="grid grid-cols-4 gap-2">
                      {(currentUser?.role === 'admin' || canViewLicenseAdmin) && (
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
                      )}
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