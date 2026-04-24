import { useState, useMemo, useEffect } from 'react';
import { useFamily } from '@/lib/FamilyContext';
import { PERMISSION_REGISTRY, PERMISSION_COLUMNS, DEFAULT_MATRIX, getDefaultPermission } from '@/lib/permissions/registry';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { ShieldCheck, ChevronDown, ChevronRight, Info, Loader2 } from 'lucide-react';
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
  const { currentUser, isAdmin, membership, familyId } = useFamily();
  const { toast } = useToast();

  const [selectedRole, setSelectedRole] = useState('member');
  const [overrides, setOverrides] = useState({});
  const [expandedPages, setExpandedPages] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPerms, setIsLoadingPerms] = useState(true);

  // Solo admin de plataforma o admin de familia pueden entrar
  const isPlatformAdmin = currentUser?.role === 'admin';
  const isFamilyAdmin = isAdmin;

  // Construye el árbol: páginas raíz + sus hijos (sections y actions) — ANTES de cualquier return
  const tree = useMemo(() => {
    const pages = PERMISSION_REGISTRY.filter(i => i.kind === 'page').sort((a, b) => a.order - b.order);
    return pages.map(page => ({
      ...page,
      children: PERMISSION_REGISTRY
        .filter(i => i.parent === page.key)
        .sort((a, b) => a.order - b.order),
    }));
  }, []);

  // Load permissions from database on mount
  useEffect(() => {
    const loadPermissions = async () => {
      if (!familyId) {
        setIsLoadingPerms(false);
        return;
      }
      try {
        const perms = await base44.entities.RolePermission.filter({ family_id: familyId });
        const byRole = {};
        for (const perm of perms || []) {
          if (!byRole[perm.role]) byRole[perm.role] = {};
          const { family_id, role, permission_key, created_date, updated_date, created_by, id, ...permData } = perm;
          byRole[perm.role][perm.permission_key] = permData;
        }
        setOverrides(byRole);
      } catch (error) {
        console.error('Error loading permissions:', error);
      } finally {
        setIsLoadingPerms(false);
      }
    };
    loadPermissions();
  }, [familyId]);

  if (!isPlatformAdmin && !isFamilyAdmin) {
    return <Navigate to="/Dashboard" replace />;
  }

  const toggleExpand = (key) => {
    setExpandedPages(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggle = async (role, permKey, colKey, value) => {
    // Update local state immediately (optimistic)
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

    // Save to database asynchronously
    if (familyId) {
      try {
        setIsSaving(true);
        const current = getEffectivePermission(overrides, role, permKey);
        const updated = { ...current, [colKey]: value };

        // Upsert: busca registro existente, sino crea uno
        const existing = await base44.entities.RolePermission.filter({
          family_id: familyId,
          role: role,
          permission_key: permKey,
        });

        if (existing && existing.length > 0) {
          // Update
          await base44.entities.RolePermission.update(existing[0].id, updated);
        } else {
          // Create
          await base44.entities.RolePermission.create({
            family_id: familyId,
            role: role,
            permission_key: permKey,
            ...updated,
          });
        }

        toast({
          title: 'Permiso guardado',
          description: `${PERMISSION_COLUMNS.find(c => c.key === colKey)?.label} — ${PERMISSION_REGISTRY.find(r => r.key === permKey)?.label}`,
          duration: 2000,
        });
      } catch (error) {
        toast({
          title: 'Error al guardar',
          description: error.message || 'No se pudo guardar el permiso',
          variant: 'destructive',
          duration: 3000,
        });
        // Rollback local state
        setOverrides(prev => {
          const current = getEffectivePermission(prev, role, permKey);
          const reverted = { ...current, [colKey]: !value };
          return {
            ...prev,
            [role]: {
              ...(prev[role] ?? {}),
              [permKey]: reverted,
            },
          };
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleReset = async () => {
    if (!familyId) return;
    try {
      setIsSaving(true);
      // Delete all RolePermission records for this family + role
      const existing = await base44.entities.RolePermission.filter({
        family_id: familyId,
        role: selectedRole,
      });

      for (const perm of existing || []) {
        await base44.entities.RolePermission.delete(perm.id);
      }

      setOverrides(prev => ({ ...prev, [selectedRole]: {} }));
      toast({ 
        title: 'Permisos restablecidos', 
        description: `Rol "${selectedRole}" vuelve a los valores predeterminados.`, 
        duration: 2000 
      });
    } catch (error) {
      toast({
        title: 'Error al restablecer',
        description: error.message || 'No se pudo restablecer los permisos',
        variant: 'destructive',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasPendingChanges = Object.keys(overrides[selectedRole] ?? {}).length > 0;

  if (isLoadingPerms) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando permisos...</p>
        </div>
      </div>
    );
  }

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

        {/* Estado de guardado */}
        {isSaving && (
          <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <p className="text-xs text-blue-700 dark:text-blue-300">Guardando permisos...</p>
          </div>
        )}

        {/* Nota sobre persistencia */}
        <div className="mt-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200/60 dark:border-green-800/40">
          <p className="text-xs text-green-700 dark:text-green-300">
            <span className="font-semibold">✓ Guardado en BD:</span> Los cambios de permisos se guardan automáticamente en la base de datos y aplican en tiempo real para todos los miembros de tu familia.
          </p>
        </div>
      </div>
    </div>
  );
}