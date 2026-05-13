import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';

const TYPE_LABELS = {
  fix:      'Fix',
  feature:  'Feature',
  security: 'Seguridad',
  system:   'Sistema',
  breaking: 'Breaking',
};

const TYPE_COLORS = {
  fix:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  feature:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  security: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  system:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  breaking: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

function TypeBadge({ type }) {
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${TYPE_COLORS[type] ?? TYPE_COLORS.system}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReleaseNotes() {
  const queryClient = useQueryClient();
  const [type, setType] = useState('fix');
  const [description, setDescription] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [publishedOpen, setPublishedOpen] = useState(false);

  const { data: pendingDrafts = [], isLoading: loadingPending } = useQuery({
    queryKey: ['changelog-drafts', 'pending'],
    queryFn: () => base44.entities.ChangelogDraft.filter({ is_published: false }, '-created_date'),
    staleTime: 30 * 1000,
  });

  const { data: publishedDrafts = [], isLoading: loadingPublished } = useQuery({
    queryKey: ['changelog-drafts', 'published'],
    queryFn: () => base44.entities.ChangelogDraft.filter({ is_published: true }, '-published_at', 20),
    enabled: publishedOpen,
    staleTime: 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ChangelogDraft.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changelog-drafts', 'pending'] });
      setDescription('');
      setType('fix');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim() || createMutation.isPending) return;
    createMutation.mutate({ type, description: description.trim(), is_published: false });
  };

  return (
    <div className="pb-10 max-w-2xl mx-auto">
      <PageHeader
        title="Release Notes"
        subtitle="Borradores para el próximo changelog automático"
      />

      <div className="px-4 md:px-6 space-y-6 mt-2">
        {/* ── Section 1: New Draft ── */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Nueva nota</h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Tipo
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Descripción
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                placeholder="Describe the change concisely"
                maxLength={200}
                required
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {description.length}/200
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!description.trim() || createMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? 'Guardando…' : 'Agregar nota'}
              </button>

              {showSuccess && (
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  ✓ Nota agregada
                </span>
              )}

              {createMutation.isError && (
                <span className="text-sm font-medium text-destructive">
                  Error al guardar
                </span>
              )}
            </div>
          </form>
        </section>

        {/* ── Section 2: Pending Drafts ── */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            Pendientes de publicar
            {pendingDrafts.length > 0 && (
              <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingDrafts.length}
              </span>
            )}
          </h2>

          {loadingPending ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Cargando…</div>
          ) : pendingDrafts.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center border border-border border-dashed rounded-2xl">
              No hay notas pendientes
            </div>
          ) : (
            <div className="space-y-2">
              {pendingDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex items-start gap-3 bg-card border border-border rounded-xl px-4 py-3"
                >
                  <div className="mt-0.5">
                    <TypeBadge type={draft.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{draft.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(draft.created_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Publicados (collapsed) ── */}
          <div className="mt-6">
            <button
              onClick={() => setPublishedOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              {publishedOpen
                ? <ChevronUp className="w-4 h-4" />
                : <ChevronDown className="w-4 h-4" />}
              Publicados
            </button>

            {publishedOpen && (
              <div className="mt-3">
                {loadingPublished ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">Cargando…</div>
                ) : publishedDrafts.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center border border-border border-dashed rounded-2xl">
                    No hay notas publicadas aún
                  </div>
                ) : (
                  <div className="space-y-2">
                    {publishedDrafts.map((draft) => (
                      <div
                        key={draft.id}
                        className="flex items-start gap-3 bg-muted/40 border border-border rounded-xl px-4 py-3"
                      >
                        <div className="mt-0.5">
                          <TypeBadge type={draft.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground/80 leading-snug">{draft.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(draft.published_at)}
                            {draft.published_in_version && (
                              <> · <span className="font-medium">v{draft.published_in_version}</span></>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
