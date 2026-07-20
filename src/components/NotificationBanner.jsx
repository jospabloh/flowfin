import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const VARIANTS = {
  warning: { box: 'bg-warning/10 border-warning/40 hover:bg-warning/15', iconBox: 'bg-warning/15', icon: 'text-warning', title: 'text-warning', subtitle: 'text-warning/90' },
  danger: { box: 'bg-destructive/10 border-destructive/40 hover:bg-destructive/15', iconBox: 'bg-destructive/15', icon: 'text-destructive', title: 'text-destructive', subtitle: 'text-destructive/90' },
  info: { box: 'bg-info/10 border-info/40 hover:bg-info/15', iconBox: 'bg-info/15', icon: 'text-info', title: 'text-info', subtitle: 'text-info/90' },
};

// Dashboard-style "see more" banner: icon square + title + subtitle + chevron.
// Centralizes a row shape that was previously hand-copied per alert type.
export default function NotificationBanner({ to, variant = 'info', icon: Icon, title, subtitle, className = '' }) {
  const v = VARIANTS[variant] || VARIANTS.info;
  return (
    <Link to={to} className={`flex items-center gap-3 p-3 border rounded-2xl transition-colors ${v.box} ${className}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${v.iconBox}`}>
        {typeof Icon === 'string' ? <span className="text-base">{Icon}</span> : <Icon className={`w-4 h-4 ${v.icon}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${v.title}`}>{title}</p>
        {subtitle && <p className={`text-xs truncate ${v.subtitle}`}>{subtitle}</p>}
      </div>
      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${v.icon}`} />
    </Link>
  );
}
