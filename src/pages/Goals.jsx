import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import PageHeader from '@/components/PageHeader';
import GoalCard from '@/components/goals/GoalCard';
import GoalFormModal from '@/components/goals/GoalFormModal';
import GoalShareCard from '@/components/goals/GoalShareCard';
import { PlusCircle, Target } from 'lucide-react';

export default function Goals() {
  const { familyId, currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', familyId],
    queryFn: () => base44.entities.Goal.filter({ family_id: familyId }, '-created_date'),
    enabled: !!familyId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions_goals', familyId],
    queryFn: () => base44.entities.Transaction.filter({ family_id: familyId }, '-date', 500),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Goal.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals', familyId] }),
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['goals', familyId] });
    setShowForm(false);
    setEditingGoal(null);
  };

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingGoal(null);
  };

  function getSaved(goal) {
    if (!goal.category_id) return 0;
    return transactions
      .filter(t => t.category_id === goal.category_id && t.type === 'income')
      .reduce((s, t) => s + (t.amount || 0), 0);
  }

  const active = goals.filter(g => g.is_active !== false);
  const completed = goals.filter(g => {
    const total = (g.manual_saved || 0) + getSaved(g);
    return g.is_active !== false && g.target_amount > 0 && total >= g.target_amount;
  });

  return (
    <div className="pb-8">
      <PageHeader
        title="Metas financieras"
        subtitle={`${active.length} meta${active.length !== 1 ? 's' : ''} activa${active.length !== 1 ? 's' : ''}`}
        action={
          <button
            onClick={() => { setEditingGoal(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold shadow-sm">
            <PlusCircle className="w-4 h-4" />
            Nueva meta
          </button>
        }
      />

      {isLoading ? (
        <div className="px-4 space-y-3 mt-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Target className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">Sin metas todavía</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Define objetivos financieros y sigue tu progreso con una barra visual.
          </p>
          <button onClick={() => { setEditingGoal(null); setShowForm(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">
            <PlusCircle className="w-4 h-4" />
            Crear mi primera meta
          </button>
        </div>
      ) : (
        <div className="px-4 mt-4 space-y-3">
          {completed.length > 0 && (
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">
              ✓ {completed.length} meta{completed.length > 1 ? 's' : ''} alcanzada{completed.length > 1 ? 's' : ''}
            </p>
          )}
          {goals.map(g => {
            const saved = getSaved(g);
            const total = (g.manual_saved || 0) + saved;
            const isComplete = g.is_active !== false && g.target_amount > 0 && total >= g.target_amount;
            return (
              <div key={g.id} className="space-y-2">
                {isComplete && (
                  <GoalShareCard goal={g} savedAmount={saved} currency={currency} />
                )}
                <GoalCard
                  goal={g}
                  savedAmount={saved}
                  currency={currency}
                  locale={locale}
                  onEdit={() => handleEdit(g)}
                  onDelete={() => deleteMutation.mutate(g.id)}
                />
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <GoalFormModal
          goal={editingGoal}
          onClose={handleClose}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}