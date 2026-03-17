import ThemeToggle from './ThemeToggle';

export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2 md:px-6 md:pt-6">
      <div>
        <h1 className="text-xl font-bold text-foreground leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <div className="md:hidden">
          <ThemeToggle />
        </div>
        {action}
      </div>
    </div>
  );
}