import { useState, useMemo, useEffect } from 'react';
import { useFamily } from '@/lib/FamilyContext';
import { PERMISSION_REGISTRY, getDefaultPermission } from '@/lib/permissions/registry';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { ShieldCheck, ChevronDown, ChevronRight, Info, Loader2, Pencil } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

function getEffectivePermission(overrides, role, key) {
  return overrides?.[role]?.[key] ?? getDefaultPermission(role, key);
}

function ModuleSection({ module, sections, role, overrides, onToggle, isExpanded, onToggleExpand }) {
  return (
    <div className="border-b border-border last:border-b-0">
      {/* Header del módulo */}
      <button
        onClick={() => onToggleExpand(module.key)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-foreground">{module.label}</span>
          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{sections.length}</span>
        </div>
      </button>

      {/* Secciones expandidas */}
      {isExpanded && (
        <div className="bg-muted/20 px-4 py-3 space-y-2">
          {sections.map(section => {
            const perm = getEffectivePermission(overrides, role, section.key);
            const isGranted = perm.can_view;
            return (
              <div
                key={section.key}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm text-foreground">{section.label}</span>
                  <span className="text-[10px] text-muted-foreground">({section.kind})</span>
                </div>
                <button
                  onClick={() => onToggle(role, section.key, 'can_view', !isGranted)}
                  className={`flex-shrink-0 p-1.5 rounded transition-colors ${
                    isGranted
                      ? 'bg-income/20 text-income'
                      : 'bg-muted text-muted-foreground hover:bg-border'
                  }`}
                >
                  {isGranted ? '✓' : '◯'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PermissionAdmin() {
  const { currentUser, isAdmin, familyId } = useFamily();
  const { toast } = useToast();

  const [selectedRole, setSelectedRole] = useState('admin');
  const [overrides, setOverrides] = useState({});
  const [expandedModules, setExpandedModules] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPerms, setIsLoadingPerms] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  const isPlatformAdmin = currentUser?.role === 'admin';
  const isFamilyAdmin = isAdmin;

  // Construye módulos con sus secciones
  const modules = useMemo(() => {
    return PERMISSION_REGISTRY.filter(i => i.kind === 'module').map(mod => ({
      ...mod,
      sections: PERMISSION_REGISTRY.filter(i => i.parent === mod.key),
    }));
  }, []);

  // Calcula conteos de permisos por rol
  const getPermissionCount = (role) => {
    const total = modules.reduce((acc, m) => acc + m.sections.length, 0);
    const granted = modules.reduce((acc, m) => {
      return acc + m.sections.filter(s => getEffectivePermission(overrides, role, s.key).can_view).length;
    }, 0);
    return { granted, total };
  };

  useEffect(() => {
    if (!familyId) {
      setIsLoadingPerms(false);
      return;
    }
    const loadPermissions = async () => {
      try {
        const perms = await base44.entities.RolePermission.filter({ family_id: familyId });
        const byRole = {};
        for (const perm of perms || []) {
          if (!byRole[perm.role]) byRole[perm.role] = {};
          const {
            family_id: _family_id,
            role: _role,
            permission_key: _permission_key,
            created_date: _created_date,
            updated_date: _updated_date,
            created_by: _created_by,
            id: _id,
            ...permData
          } = perm;
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

  const handleToggle = async (role, permKey, colKey, value) => {
    // Optimistic update
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

    if (familyId) {
      try {
        setIsSaving(true);
        const current = getEffectivePermission(overrides, role, permKey);
        const updated = { ...current, [colKey]: value };

        const existing = await base44.entities.RolePermission.filter({
          family_id: familyId,
          role: role,
          permission_key: permKey,
        });

        if (existing && existing.length > 0) {
          await base44.entities.RolePermission.update(existing[0].id, updated);
        } else {
          await base44.entities.RolePermission.create({
            family_id: familyId,
            role: role,
            permission_key: permKey,
            ...updated,
          });
        }

        toast({ title: 'Permiso guardado', duration: 2000 });
      } catch (error) {
        toast({
          title: 'Error al guardar',
          description: error.message || 'No se pudo guardar el permiso',
          variant: 'destructive',
          duration: 3000,
        });
        // Rollback
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

  const toggleExpandModule = (key) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
        title="Permisos"
        subtitle="Configura qué puede ver y hacer cada rol en el sistema."
        icon={<ShieldCheck className="w-5 h-5" />}
        action={
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isEditMode
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-border'
            }`}
          >
            <Pencil className="w-4 h-4" />
            {isEditMode ? 'Hecho' : 'Editar'}
          </button>
        }
      />

      <div className="px-4 pb-8 max-w-4xl mx-auto">
        {/* Info banner */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 mb-6">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Los permisos controlan qué puede ver y hacer cada rol en el sistema.
          </p>
        </div>

        {/* Matriz de Permisos header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground mb-1">Matriz de Permisos</h2>
          <p className="text-sm text-muted-foreground mb-4">Visualiza todos los permisos del sistema</p>

          {/* Role tabs with counters */}
          <div className="flex gap-2 flex-wrap">
            {['admin', 'member'].map(role => {
              const c = getPermissionCount(role);
              const isSelected = selectedRole === role;
              return (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-border'
                  }`}
                >
                  <span>{role === 'admin' ? 'Admin' : 'Miembro Familia'}</span>
                  <span className={isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                    {c.granted}/{c.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Leyenda */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-income/10 border border-income/20">
            <span className="text-xs text-income font-semibold">✓ Verde: Permiso otorgado</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
            <span className="text-xs text-muted-foreground font-semibold">◯ Gris: Permiso denegado</span>
          </div>
        </div>

        {/* Módulos */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {modules.map(module => (
            <ModuleSection
              key={module.key}
              module={module}
              sections={module.sections}
              role={selectedRole}
              overrides={overrides}
              onToggle={isEditMode ? handleToggle : () => {}}
              isExpanded={expandedModules.has(module.key)}
              onToggleExpand={toggleExpandModule}
            />
          ))}
        </div>

        {/* Estado de guardado */}
        {isSaving && (
          <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <p className="text-xs text-blue-700 dark:text-blue-300">Guardando permisos...</p>
          </div>
        )}
      </div>
    </div>
  );
}
