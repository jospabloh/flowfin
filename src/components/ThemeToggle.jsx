import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: 'light', icon: Sun, label: 'Claro' },
    { value: 'dark', icon: Moon, label: 'Oscuro' },
    { value: 'system', icon: Monitor, label: 'Auto' },
  ];

  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      {themes.map(t => {
        const Icon = t.icon;
        return (
          <button key={t.value} onClick={() => setTheme(t.value)}
            title={t.label}
            className={`p-1.5 rounded-md transition-all ${theme === t.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}