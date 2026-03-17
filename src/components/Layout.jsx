import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, List, Plus, BarChart2, MoreHorizontal, TrendingUp, CreditCard, Building, BookOpen, Settings, HelpCircle, Info, X, Sparkles, Users, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import { usePendingCount } from '@/hooks/usePendingCount';

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
  { to: '/FamilyAdmin', icon: Users, label: 'Admin Familia' },
  { to: '/UserManual', icon: HelpCircle, label: 'Manual' },
  { to: '/About', icon: Info, label: 'Acerca de' },
];

export default function Layout() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const pendingCount = usePendingCount();
  const isAssistantPage = location.pathname === '/Assistant';

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r border-border bg-card/60 backdrop-blur-xl">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <span className="text-primary-foreground font-bold text-lg">F</span>
            </div>
            <div>
              <h1 className="font-bold text-foreground text-sm leading-tight">FamilyFlow</h1>
              <p className="text-xs text-muted-foreground">Finanzas Familiares</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {sideNavItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                  ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <ThemeToggle />
          </div>
          <Link to="/Capture"
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            Registrar
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto mb-nav md:mb-0">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-card/90 backdrop-blur-xl border-t border-border pb-safe z-40">
        <div className="flex items-end justify-around px-2 pt-2 pb-1">
          {navItems.map(item => {
            if (item.to === '/more') {
              const active = ['Investments','MSI','Rentals','Catalogs','FamilySettings','UserManual','About']
                .some(p => location.pathname.includes(p));
              return (
                <button key="more" onClick={() => setShowMore(true)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[52px] transition-all
                    ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                  <MoreHorizontal className="w-6 h-6" />
                  <span className="text-[10px] font-medium">Más</span>
                </button>
              );
            }
            if (item.isCenter) {
              return (
                <Link key={item.to} to={item.to}
                  className="flex items-center justify-center w-14 h-14 rounded-full bg-primary shadow-lg shadow-primary/30 -mt-4 transition-transform active:scale-95">
                  <Plus className="w-7 h-7 text-primary-foreground" />
                </Link>
              );
            }
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[52px] transition-all
                  ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                <Icon className="w-6 h-6" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
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
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card rounded-t-3xl border-t border-border pb-safe">
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3 mb-4" />
              <div className="flex items-center justify-between px-6 mb-4">
                <h3 className="font-semibold text-foreground">Más opciones</h3>
                <button onClick={() => setShowMore(false)} className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3 px-4 pb-6">
                {moreItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.to} to={item.to} onClick={() => setShowMore(false)}
                      className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-muted/50 hover:bg-muted transition-colors">
                      <div className={`w-10 h-10 rounded-xl bg-card flex items-center justify-center shadow-sm ${item.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-medium text-foreground text-center leading-tight">{item.label}</span>
                    </Link>
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