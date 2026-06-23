import { useState, useMemo, useEffect } from 'react';
import { useFamily } from '@/lib/FamilyContext';
import { PERMISSION_REGISTRY, PERMISSION_COLUMNS, getDefaultPermission } from '@/lib/permissions/registry';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { ShieldCheck, ChevronDown, ChevronRight, Info, Loader2, Pencil, Check, Minus } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

function getEffectivePermission(overrides, role, key) {
  return overrides?.[role]?.[key] ?? getDefaultPermission(role, key);
}

// Aggregate a module's column across its sections: 'on' (all), 'off' (none), 'mixed' (some).
function groupState(sections, role, overrides, colKey) {
  if (!sections.length) return 'off';
  let on = 0;
  for (const s of sections) {
    if (getEffectivePermission(overrides, role, s.key)[colKey]) on++;
  }
  if (on === 0) return 'off';
  if (on === sections.length) return 'on';
  return 'mixed';
}

// Tri-state checkbox styled to match the granular matrix.
function PermCheckbox({ state, disabled, onClick, label }) {
  const isOn = state === 'on';
  const isMixed = state === 'mixed';
  const filled = isOn || isMixed;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isMixed ? 'mixed' : isOn}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`w-5 h-5 rounded-[6px] border flex items-center justify-center transition-colors
        ${filled
          ? 'bg-primary border-primary text-primary-foreground'
          : 'bg-card border-border'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/60'}`}
    >
      {isOn && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      {isMixed && <Minus className="w-3.5 h-3.5" strokeWidth={3} />}
    </button>
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

  // Build modules with their sections.
  const modules = useMemo(() => {
    return PERMISSION_REGISTRY.filter(i => i.kind === 'module').map(mod => ({
      ...mod,
      sections: PERMISSION_REGISTRY.filter(i => i.parent === mod.key),
    }));
  }, []);

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

  // Persist one (role, permission_key) row to the backend.
  const persistPermission = async (role, permKey, updated) => {
    const existing = await base44.entities.RolePermission.filter({
      family_id: familyId,
      role,
      permission_key: permKey,
    });
    if (existing && existing.length > 0) {
      await base44.entities.RolePermission.update(existing[0].id, updated);
    } else {
      await base44.entities.RolePermission.create({
        family_id: familyId,
        role,
        permission_key: permKey,
        ...updated,
      });
    }
  };

  // Toggle a single section/column.
  const handleToggle = async (role, permKey, colKey, value) => {
    setOverrides(prev => {
      const current = getEffectivePermission(prev, role, permKey);
      return {
        ...prev,
        [role]: { ...(prev[role] ?? {}), [permKey]: { ...current, [colKey]: value } },
      };
    });

    if (!familyId) return;
    try {
      setIsSaving(true);
      const current = getEffectivePermission(overrides, role, permKey);
      await persistPermission(role, permKey, { ...current, [colKey]: value });
    } catch (error) {
      toast({ title: 'Error al guardar', description: error.message || 'No se pudo guardar', variant: 'destructive', duration: 3000 });
      setOverrides(prev => {
        const current = getEffectivePermission(prev, role, permKey);
        return {
          ...prev,
          [role]: { ...(prev[role] ?? {}), [permKey]: { ...current, [colKey]: !value } },
        };
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle a whole module column across all its sections (group checkbox).
  const handleGroupToggle = async (role, sections, colKey) => {
    if (!sections.length) return;
    const allOn = sections.every(s => getEffectivePermission(overrides, role, s.key)[colKey]);
    const target = !allOn;

    setOverrides(prev => {
      const roleMap = { ...(prev[role] ?? {}) };
      for (const s of sections) {
        const current = getEffectivePermission(prev, role, s.key);
        roleMap[s.key] = { ...current, [colKey]: target };
      }
      return { ...prev, [role]: roleMap };
    });

    if (!familyId) return;
    try {
      setIsSaving(true);
      await Promise.all(sections.map(s => {
        const current = getEffectivePermission(overrides, role, s.key);
        return persistPermission(role, s.key, { ...current, [colKey]: target });
      }));
    } catch (error) {
      toast({ title: 'Error al guardar', description: error.message || 'No se pudo guardar', variant: 'destructive', duration: 3000 });
    } finally {
      setIsSaving(false);
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
              isEditMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-border'
            }`}
          >
            <Pencil className="w-4 h-4" />
            {isEditMode ? 'Hecho' : 'Editar'}
          </button>
        }
      />

      <div className="px-4 pb-8 max-w-5xl mx-auto">
        {/* Role selector */}
        <div className="mb-5 max-w-xs">
          <label htmlFor="perm-role" className="block text-xs font-medium text-muted-foreground mb-1.5">Rol</label>
          <div className="relative">
            <select
              id="perm-role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-card px-3 py-2.5 pr-9 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="admin">Administrador</option>
              <option value="member">Miembro de familia</option>
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Granular permission matrix card */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-bold text-foreground">Matriz de permisos granular</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isEditMode ? 'Marca o desmarca cada permiso por módulo y acción.' : 'Activa "Editar" para modificar los permisos.'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="bg-primary/5 text-xs font-semibold text-muted-foreground">
                  <th className="text-left font-semibold px-5 py-3 sticky left-0 bg-primary/5 z-10">Permisos</th>
                  {PERMISSION_COLUMNS.map(col => (
                    <th key={col.key} className="px-3 py-3 text-center font-semibold whitespace-nowrap" title={col.description}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map(module => {
                  const expanded = expandedModules.has(module.key);
                  return (
                    <ModuleRows
                      key={module.key}
                      module={module}
                      expanded={expanded}
                      role={selectedRole}
                      overrides={overrides}
                      editable={isEditMode}
                      onToggleExpand={toggleExpandModule}
                      onToggleSection={handleToggle}
                      onToggleGroup={handleGroupToggle}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><PermCheckbox state="on" disabled label="activado" /> Activado</span>
          <span className="flex items-center gap-1.5"><PermCheckbox state="mixed" disabled label="parcial" /> Parcial (algunos)</span>
          <span className="flex items-center gap-1.5"><PermCheckbox state="off" disabled label="desactivado" /> Desactivado</span>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 mt-4">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Los permisos controlan qué puede ver y hacer cada rol. Los cambios se guardan automáticamente.
          </p>
        </div>

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

// A module group row + (when expanded) its section rows.
function ModuleRows({ module, expanded, role, overrides, editable, onToggleExpand, onToggleSection, onToggleGroup }) {
  const sections = module.sections;
  return (
    <>
      <tr className="border-t border-border hover:bg-muted/30 transition-colors">
        <td className="px-5 py-3 sticky left-0 bg-card z-10">
          <button
            onClick={() => onToggleExpand(module.key)}
            className="flex items-center gap-2 text-left font-semibold text-foreground"
          >
            {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            {module.label}
            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{sections.length}</span>
          </button>
        </td>
        {PERMISSION_COLUMNS.map(col => (
          <td key={col.key} className="px-3 py-3 text-center">
            <div className="flex justify-center">
              <PermCheckbox
                state={groupState(sections, role, overrides, col.key)}
                disabled={!editable || sections.length === 0}
                label={`${module.label} · ${col.label}`}
                onClick={() => onToggleGroup(role, sections, col.key)}
              />
            </div>
          </td>
        ))}
      </tr>

      {expanded && sections.map(section => {
        const perm = getEffectivePermission(overrides, role, section.key);
        return (
          <tr key={section.key} className="border-t border-border/60 hover:bg-muted/20 transition-colors">
            <td className="pl-12 pr-5 py-2.5 sticky left-0 bg-card z-10">
              <span className="text-sm text-foreground">{section.label}</span>
            </td>
            {PERMISSION_COLUMNS.map(col => (
              <td key={col.key} className="px-3 py-2.5 text-center">
                <div className="flex justify-center">
                  <PermCheckbox
                    state={perm[col.key] ? 'on' : 'off'}
                    disabled={!editable}
                    label={`${section.label} · ${col.label}`}
                    onClick={() => onToggleSection(role, section.key, col.key, !perm[col.key])}
                  />
                </div>
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}
