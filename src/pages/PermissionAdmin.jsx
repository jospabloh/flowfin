import { useState, useMemo } from 'react';
import { useFamily } from '@/lib/FamilyContext';
import { PERMISSION_REGISTRY, PERMISSION_COLUMNS, DEFAULT_MATRIX, getDefaultPermission } from '@/lib/permissions/registry';
import PageHeader from '@/components/PageHeader';
import { ShieldCheck, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

// Devuelve los permisos efectivos para un rol sobre una key
function getEffectivePermission(overrides, role, key) {
  return overrides?.[role]?.[key] ?? getDefaultPermission(role, key);
}

// Componente para una celda de checkbox
function PermCell({ value, onChange, disabled }) {
  return (
    <td className="text-center px-2 py-2">
      <input
        type="checkbox"
        checked={!!value}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
      />
    </td>
  );
}

// Fila de artefacto
function ArtifactRow({ item, role, overrides, onToggle, depth = 0 }) {
  const perm = getEffectivePermission(overrides, role, item.key);
  const isDefault = !overrides?.[role]?.[item.key];
  const indent = depth * 16;

  return (
    <tr className={`border-b border-border/40 transition-colors hover:bg-muted/30 ${depth > 0 ? 'bg-muted/10' : ''}`}>
      <td className="py-2 pr-2" style={{ paddingLeft: `${12 + indent}px` }}>
        <div className="flex items-center gap-1.5">
          {depth > 0 && <span className="text-muted-foreground/40 text-xs">└</span>}
          <span className={`text-sm ${depth === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
            {item.label}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
            item.kind === 'page'    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
            item.kind === 'section' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
          }`}>
            {item.kind === 'page' ? 'Página' : item.kind === 'section' ? 'Sección' : 'Acción'}
          </span>
          {!isDefault && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
              Modificado
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/60 ml-0" style={{ paddingLeft: depth > 0 ? '10px' : '0' }}>
          {item.key}
        </p>
      </td>
      {PERMISSION_COLUMNS.map(col => (
        <PermCell
          key={col.key}
          value={perm[col.key]}
          disabled={false}
          onChange={val => onToggle(role, item.key, col.key, val)}
        />
      ))}
    </tr>
  );
}

export default function PermissionAdmin() {
  const { currentUser, isAdmin, membership } = useFamily();
  const { toast } = useToast();

  // Solo admin de plataforma o admin de familia pueden entrar
  const isPlatformAdmin = currentUser?.role === 'admin';
  const isFamilyAdmin = isAdmin;

  if (!isPlatformAdmin && !isFamilyAdmin) {
    return <Navigate to="/Dashboard" replace />;
  }

  const [selectedRole, setSelectedRole] = useState('member');
  const [overrides, setOverrides] = useState({});
  const [expandedPages, setExpandedPages] = useState(new Set());

  // Construye el árbol: páginas raíz + sus hijos (sections y actions)
  const tree = useMemo(() => {
    const pages = PERMISSION_REGISTRY.filter(i => i.kind === 'page').sort((a, b) => a.order - b.order);
    return pages.map(page => ({
      ...page,
      children: PERMISSION_REGISTRY
        .filter(i => i.parent === page.key)
        .sort((a, b) => a.order - b.order),
    }));
  }, []);

  const toggleExpand = (key) => {
    setExpandedPages(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggle = (role, permKey, colKey, value) => {
    setOverrides(prev => {
      const current = getEffectivePermission(prev, role, permKey);
      const updated = { ...current, [colKey]: value };
      return {
        ...prev,
        [role]: {
          ...(prev[role] ?? {}),
          [permKey]: updated,
        },
      };
    });

    toast({
      title: 'Permiso actualizado',
      description: `${PERMISSION_COLUMNS.find(c => c.key === colKey)?.label} — ${PERMISSION_REGISTRY.find(r => r.key === permKey)?.label}`,
      duration: 2000,
    });
  };

  const handleReset = () => {
    setOverrides(prev => ({ ...prev, [selectedRole]: {} }));
    toast({ title: 'Permisos restablecidos', description: `Rol "${selectedRole}" vuelve a los valores predeterminados.`, duration: 2000 });
  };

  const hasPendingChanges = Object.keys(overrides[selectedRole] ?? {}).length > 0;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Administración de Permisos"
        subtitle="Controla qué puede ver y hacer cada rol en FlowFin"
        icon={<ShieldCheck className="w-5 h-5" />}
      />

      <div className="px-4 pb-8 max-w-5xl mx-auto">

        {/* Info banner */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 mb-4">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            Los permisos controlan qué secciones, páginas y acciones son visibles o ejecutables por cada rol.
            Los cambios se guardan automáticamente. Si un rol no tiene un permiso configurado, se aplica el comportamiento predeterminado de la app.
          </p>
        </div>

        {/* Selector de rol */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-medium text-muted-foreground">Rol:</span>
          <div className="flex gap-2">
            {['member', 'admin'].map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                  selectedRole === role
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {role === 'admin' ? 'Admin Familia' : 'Miembro'}
              </button>
            ))}
          </div>
          {hasPendingChanges && (
            <button
              onClick={handleReset}
              className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
            >
              Restablecer valores predeterminados
            </button>
          )}
        </div>

        {/* Leyenda de columnas */}
        <div className="flex gap-4 mb-3 flex-wrap">
          {PERMISSION_COLUMNS.map(col => (
            <div key={col.key} className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground">{col.label}</span>
              <span className="text-[10px] text-muted-foreground">— {col.description}</span>
            </div>
          ))}
        </div>

        {/* Tabla de permisos */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Artefacto
                  </th>
                  {PERMISSION_COLUMNS.map(col => (
                    <th key={col.key} className="text-center py-3 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[72px]">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tree.map(page => {
                  const hasChildren = page.children.length > 0;
                  const isExpanded = expandedPages.has(page.key);
                  const perm = getEffectivePermission(overrides, selectedRole, page.key);

                  return [
                    // Fila de página
                    <tr key={page.key} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          {hasChildren && (
                            <button
                              onClick={() => toggleExpand(page.key)}
                              className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground"
                            >
                              {isExpanded
                                ? <ChevronDown className="w-3.5 h-3.5" />
                                : <ChevronRight className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}
                          {!hasChildren && <span className="w-5" />}
                          <span className="font-semibold text-foreground text-sm">{page.label}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Página
                          </span>
                          {!overrides?.[selectedRole]?.[page.key] ? null : (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                              Modificado
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground/50 ml-6">{page.key}</p>
                      </td>
                      {PERMISSION_COLUMNS.map(col => (
                        <PermCell
                          key={col.key}
                          value={perm[col.key]}
                          onChange={val => handleToggle(selectedRole, page.key, col.key, val)}
                        />
                      ))}
                    </tr>,

                    // Filas hijas (secciones y acciones)
                    ...(isExpanded ? page.children.map(child => (
                      <ArtifactRow
                        key={child.key}
                        item={child}
                        role={selectedRole}
                        overrides={overrides}
                        onToggle={handleToggle}
                        depth={1}
                      />
                    )) : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nota sobre restricciones de sistema */}
        {isPlatformAdmin && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <span className="font-semibold">Nota para admin de plataforma:</span> Las páginas de Sistema (Licencias, Uso de IA) solo son accesibles para usuarios con rol de plataforma y no pueden ser habilitadas desde este panel.
            </p>
          </div>
        )}

        {/* Nota sobre persistencia */}
        <div className="mt-3 p-3 rounded-xl bg-muted/40 border border-border/60">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold">Próximamente:</span> Los cambios de permisos se sincronizarán con la base de datos y aplicarán en tiempo real para todos los miembros de tu familia. Por ahora, los cambios son locales a esta sesión.
          </p>
        </div>
      </div>
    </div>
  );
}
