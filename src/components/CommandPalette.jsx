import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator, CommandShortcut,
} from '@/components/ui/command';
import {
  Plus, Sparkles, Target, Plane, Sun, Moon, Monitor, Search as SearchIcon,
} from 'lucide-react';

/**
 * CommandPalette — global ⌘K / Ctrl+K launcher.
 *
 * Gives keyboard-first access to every destination the current user is allowed
 * to see (passed in via `navGroups`, already permission-filtered by Layout) plus
 * a set of high-frequency quick actions. Open state is owned by the parent so a
 * visible "Buscar… ⌘K" trigger can share it.
 *
 * `navGroups`: [{ heading, items: [{ to, label, icon, keywords? }] }]
 * `onNavigate(path)`: navigate helper from Layout (no-ops if already there).
 */
export default function CommandPalette({ open, onOpenChange, navGroups = [], onNavigate }) {
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  const go = (path) => {
    onOpenChange(false);
    if (onNavigate) onNavigate(path);
    else navigate(path);
  };

  // Global keyboard shortcuts.
  //  • ⌘K / Ctrl+K  → toggle the palette (works everywhere, even while typing)
  //  • N            → jump to "Registrar movimiento" (ignored while typing)
  useEffect(() => {
    const isTyping = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (open || e.metaKey || e.ctrlKey || e.altKey) return;
      // Don't hijack single-key shortcuts while a modal/sheet/drawer is open —
      // the user is mid-task and focus may sit on a button rather than an input.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if ((e.key === 'n' || e.key === 'N') && !isTyping(e.target)) {
        e.preventDefault();
        go('/Capture');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  // The palette offers the three modes as separate commands rather than one
  // toggle: a toggle can only ever reach two of them, and "seguir al
  // dispositivo" is the one people look for by name.
  const themeActions = [
    { id: 'theme-light', label: 'Tema: claro', icon: Sun, value: 'light' },
    { id: 'theme-dark', label: 'Tema: oscuro', icon: Moon, value: 'dark' },
    { id: 'theme-system', label: 'Tema: seguir al dispositivo', icon: Monitor, value: 'system' },
  ].map((action) => ({
    ...action,
    keywords: 'tema theme oscuro claro dark light modo sistema dispositivo automatico',
    run: () => { setTheme(action.value); onOpenChange(false); },
  }));

  const quickActions = [
    { id: 'capture', label: 'Registrar movimiento', icon: Plus, keywords: 'gasto ingreso nuevo agregar capturar expense income add', run: () => go('/Capture') },
    { id: 'assistant', label: 'Preguntar a Finia (Asistente IA)', icon: Sparkles, keywords: 'ia ai chat asistente finia ayuda pregunta', run: () => go('/Assistant') },
    { id: 'goal', label: 'Crear una meta de ahorro', icon: Target, keywords: 'meta ahorro objetivo goal saving nueva', run: () => go('/Goals') },
    { id: 'trip', label: 'Planear un viaje', icon: Plane, keywords: 'viaje trip vacaciones nuevo', run: () => go('/Trips') },
    ...themeActions,
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar página o acción…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>

        <CommandGroup heading="Acciones rápidas">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <CommandItem key={a.id} value={`${a.label} ${a.keywords}`} onSelect={a.run}>
                <Icon className="mr-2 h-4 w-4 text-primary" aria-hidden="true" />
                <span>{a.label}</span>
                {a.id === 'capture' && <CommandShortcut>N</CommandShortcut>}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {navGroups.map((group, gi) => {
          if (!group.items?.length) return null;
          return (
            <div key={group.heading || gi}>
              <CommandSeparator />
              <CommandGroup heading={group.heading || 'Navegación'}>
                {group.items.map((item) => {
                  const Icon = item.icon || SearchIcon;
                  return (
                    <CommandItem
                      key={item.to}
                      value={`${item.label} ${item.keywords || ''}`}
                      onSelect={() => go(item.to)}
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span>{item.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
