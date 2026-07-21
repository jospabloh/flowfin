const VARIANTS = {
  success: 'text-success bg-success/15',
  warning: 'text-warning bg-warning/15',
  danger: 'text-destructive bg-destructive/15',
  info: 'text-info bg-info/15',
  neutral: 'text-muted-foreground bg-muted',
  ai: 'text-secondary bg-secondary/15',
};

// Small status pill reused across list items (scheduled payments, trips, etc.)
// instead of every screen re-implementing its own color/spacing recipe.
export default function StatusBadge({ variant = 'neutral', icon: Icon = null, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${VARIANTS[variant] || VARIANTS.neutral} ${className}`}>
      {Icon && <Icon className="w-2.5 h-2.5" />}
      {children}
    </span>
  );
}
