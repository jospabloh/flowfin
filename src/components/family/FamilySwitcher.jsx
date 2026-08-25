import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { Home, Loader2, Check } from 'lucide-react';

// Renders in two places (acacia-app-standard STANDARD.md §18: "one switcher,
// reachable once it's needed" — same component, two entry points):
//   - compact, embedded in AccountSettings.jsx, for a user who wants to
//     switch families at any time;
//   - fullScreen, from App.jsx's FamilyGate, when a login resolves to 2+
//     approved memberships with none persisted as active yet.
// Renders nothing when there's nothing to choose between — a single-family
// user (the overwhelming majority) never sees this component render any UI.
export default function FamilySwitcher({ fullScreen = false }) {
  const { familyCandidates, membership } = useFamily();

  // getMyFamily already authorizes a caller against ANY of their approved
  // memberships, not just the currently-active one (see
  // family/handlers/getMyFamily.ts) — Family's own RLS would otherwise block
  // a direct client read of a family that isn't the caller's current active
  // one, which is exactly why this goes through the function instead of
  // base44.entities.Family.filter() directly.
  const { data: namedCandidates, isLoading } = useQuery({
    queryKey: ['family-switcher-names', familyCandidates.map(c => c.family_id).sort().join(',')],
    queryFn: async () => {
      const results = await Promise.all(familyCandidates.map(async (c) => {
        const res = await base44.functions.invoke('family', { action: 'getMyFamily', family_id: c.family_id });
        return {
          family_id: c.family_id,
          role: c.role,
          name: res.data?.family?.name || c.family_id,
        };
      }));
      return results;
    },
    enabled: familyCandidates.length > 1,
    staleTime: 5 * 60 * 1000,
  });

  const switchMutation = useMutation({
    mutationFn: (family_id) => base44.functions.invoke('family', { action: 'switchFamily', family_id }),
    onSuccess: () => {
      // Hard reload rather than an in-place cache reset — the one reset
      // that cannot leave a stale family_id behind in some closure
      // (acacia-app-standard STANDARD.md §18, point 3).
      globalThis.location.reload();
    },
  });

  if (familyCandidates.length <= 1) return null;

  const activeFamilyId = membership?.family_id || null;
  const wrapperClass = fullScreen
    ? 'min-h-screen bg-background flex items-center justify-center p-6'
    : '';
  const cardClass = fullScreen
    ? 'w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-sm'
    : 'bg-card border border-border rounded-2xl p-4 shadow-sm';

  return (
    <div className={wrapperClass}>
      <div className={cardClass}>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {fullScreen ? 'Elige tu familia' : 'Mis familias'}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {fullScreen
            ? 'Perteneces a más de una familia en FlowFin. Elige con cuál quieres entrar.'
            : 'Cambia entre las familias a las que perteneces.'}
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {(namedCandidates || []).map((c) => {
              const isActive = c.family_id === activeFamilyId;
              return (
                <button
                  key={c.family_id}
                  onClick={() => !isActive && switchMutation.mutate(c.family_id)}
                  disabled={isActive || switchMutation.isPending}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                    isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  } disabled:opacity-70`}
                >
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Home className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.role === 'admin' ? 'Administrador' : 'Integrante'}</p>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {switchMutation.isError && (
          <p className="text-xs text-destructive mt-3">No se pudo cambiar de familia. Intenta de nuevo.</p>
        )}
      </div>
    </div>
  );
}
