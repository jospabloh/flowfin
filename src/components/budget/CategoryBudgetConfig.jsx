import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { useCatalog } from '@/hooks/useCatalog';
import { formatCurrency } from '@/lib/formatters';
import { guardedCreate, guardedUpdate, guardedDelete } from '@/lib/guardedWrite';
import { PlusCircle, Trash2, Pencil, Check, X } from 'lucide-react';

export default function CategoryBudgetConfig() {
  const { familyId, currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const { categories } = useCatalog(familyId);
  const queryClient = useQueryClient();
  const fmt = (v) => formatCurrency(v, { locale, currency });

  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [newCatId, setNewCatId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['category_budgets', familyId],
    queryFn: () => base44.entities.CategoryBudget.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 2 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => guardedCreate('CategoryBudget', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['category_budgets', familyId] }); setShowAdd(false); setNewCatId(''); setNewAmount(''); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, amount }) => guardedUpdate('CategoryBudget', id, { amount }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['category_budgets', familyId] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => guardedDelete('CategoryBudget', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['category_budgets', familyId] }),
  });

  const existingCatIds = new Set(budgets.map(b => b.category_id));
  const availableCategories = categories.filter(c => c.type !== 'income' && !existingCatIds.has(c.id));

  const handleCreate = () => {
    if (!newCatId || !newAmount || isNaN(parseFloat(newAmount))) return;
    createMutation.mutate({ family_id: familyId, category_id: newCatId, amount: parseFloat(newAmount) });
  };

  const handleUpdate = (id) => {
    if (!editAmount || isNaN(parseFloat(editAmount))) return;
    updateMutation.mutate({ id, amount: parseFloat(editAmount) });
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Límites por categoría</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Recibirás alertas al alcanzar el 80% y 100%</p>
        </div>
        {availableCategories.length > 0 && (
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold">
            <PlusCircle className="w-3.5 h-3.5" />
            Agregar
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="px-4 py-3 bg-muted/40 border-b border-border flex flex-col sm:flex-row gap-2">
          <select
            value={newCatId}
            onChange={e => setNewCatId(e.target.value)}
            className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Selecciona categoría…</option>
            {availableCategories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              placeholder="Monto máximo"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              className="w-36 bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button onClick={handleCreate} disabled={createMutation.isPending}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-3 py-2 bg-muted text-muted-foreground rounded-xl text-sm">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="p-4 space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : budgets.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Sin límites configurados.</p>
          <p className="text-xs text-muted-foreground mt-1">Agrega un límite para recibir alertas en el Dashboard.</p>
        </div>
      ) : (
        <div>
          {budgets.map((b, i) => {
            const cat = categories.find(c => c.id === b.category_id);
            const isEditing = editingId === b.id;
            return (
              <div key={b.id} className={`flex items-center gap-3 px-4 py-3 ${i < budgets.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                  style={{ backgroundColor: `${cat?.color || '#059669'}20` }}>
                  {cat?.icon || '📁'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{cat?.name || b.category_id}</p>
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      value={editAmount}
                      onChange={e => setEditAmount(e.target.value)}
                      autoFocus
                      className="mt-1 w-full bg-muted border border-border rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Límite: <span className="font-semibold text-foreground">{fmt(b.amount)}</span>/mes</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <button onClick={() => handleUpdate(b.id)} disabled={updateMutation.isPending}
                        className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(b.id); setEditAmount(String(b.amount)); }}
                        className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(b.id)} disabled={deleteMutation.isPending}
                        className="p-1.5 rounded-lg bg-muted text-rose-500 hover:bg-rose-50 disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}