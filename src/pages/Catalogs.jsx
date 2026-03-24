import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCatalog } from '@/hooks/useCatalog';
import { useFamily } from '@/lib/FamilyContext';

const COLORS = ['#059669','#7C3AED','#F97316','#3B82F6','#EAB308','#EC4899','#14B8A6','#F43F5E','#64748B','#D97706'];

function TagInput({ value = [], onChange }) {
  const [input, setInput] = useState('');
  return (
    <div className="flex flex-wrap gap-1.5 p-2 bg-muted rounded-xl min-h-[40px]">
      {value.map((tag, i) => (
        <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-card rounded-full text-xs border border-border text-foreground">
          {tag}
          <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && input.trim()) { e.preventDefault(); onChange([...value, input.trim().toLowerCase()]); setInput(''); } }}
        placeholder={value.length === 0 ? 'Escribe y presiona Enter' : '+'}
        className="bg-transparent outline-none text-xs text-foreground placeholder-muted-foreground min-w-[80px] flex-1" />
    </div>
  );
}

function InlineForm({ fields, onSave, onCancel }) {
  const [data, setData] = useState(fields.reduce((acc, f) => ({ ...acc, [f.key]: f.default || '' }), {}));
  return (
    <div className="bg-accent/30 rounded-xl p-3 border border-border space-y-2">
      {fields.map(f => (
        f.type === 'tags' ? (
          <div key={f.key}>
            <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
            <TagInput value={data[f.key] || []} onChange={v => setData(d => ({...d, [f.key]: v}))} />
          </div>
        ) : f.type === 'select' ? (
          <select key={f.key} value={data[f.key]} onChange={e => setData(d => ({...d, [f.key]: e.target.value}))}
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm text-foreground outline-none">
            {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ) : f.type === 'color' ? (
          <div key={f.key}>
            <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
            <div className="flex gap-1.5 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setData(d => ({...d, [f.key]: c}))}
                  className={`w-7 h-7 rounded-full transition-transform ${data[f.key] === c ? 'scale-110 ring-2 ring-offset-1 ring-foreground' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        ) : (
          <input key={f.key} placeholder={f.label} value={data[f.key]} onChange={e => setData(d => ({...d, [f.key]: e.target.value}))}
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none" />
        )
      ))}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-medium">Cancelar</button>
        <button onClick={() => onSave(data)} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">Guardar</button>
      </div>
    </div>
  );
}

export default function Catalogs() {
  const queryClient = useQueryClient();
  const { familyId } = useFamily();
  const { categories, subcategories, persons, paymentMethods } = useCatalog(familyId);
  const [addingTab, setAddingTab] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['subcategories'] });
    queryClient.invalidateQueries({ queryKey: ['persons'] });
    queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
  };

  const deleteItem = async (entity, id) => {
    if (!confirm('¿Eliminar este elemento?')) return;
    await base44.entities[entity].delete(id);
    invalidate();
  };

  return (
    <div className="pb-4">
      <PageHeader title="Catálogos" subtitle="Gestión de datos maestros" />

      <Tabs defaultValue="categories" className="px-4">
        <TabsList className="w-full mb-4 grid grid-cols-4 h-auto p-1">
          <TabsTrigger value="categories" className="text-xs py-1.5">Rubros</TabsTrigger>
          <TabsTrigger value="subcategories" className="text-xs py-1.5">SubRubros</TabsTrigger>
          <TabsTrigger value="persons" className="text-xs py-1.5">Personas</TabsTrigger>
          <TabsTrigger value="methods" className="text-xs py-1.5">Formas</TabsTrigger>
        </TabsList>

        {/* Categories */}
        <TabsContent value="categories" className="space-y-2">
          <button onClick={() => setAddingTab('cat')} className="flex items-center gap-2 text-primary text-sm font-medium mb-2">
            <Plus className="w-4 h-4" /> Nueva categoría
          </button>
          {addingTab === 'cat' && (
            <InlineForm
              fields={[
                { key: 'name', label: 'Nombre', default: '' },
                { key: 'icon', label: 'Emoji (ej: 🍽️)', default: '' },
                { key: 'color', label: 'Color', type: 'color', default: '#059669' },
                { key: 'type', label: 'Tipo', type: 'select', default: 'expense', options: [{ v: 'expense', l: 'Egreso' }, { v: 'income', l: 'Ingreso' }, { v: 'both', l: 'Ambos' }] },
              ]}
              onSave={async (d) => { await base44.entities.Category.create(d); invalidate(); setAddingTab(null); }}
              onCancel={() => setAddingTab(null)}
            />
          )}
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5 shadow-sm">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: cat.color + '20' }}>
                {cat.icon || '📁'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{cat.name}</p>
                <p className="text-xs text-muted-foreground">{cat.type === 'expense' ? 'Egreso' : cat.type === 'income' ? 'Ingreso' : 'Ambos'}</p>
              </div>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <button onClick={() => deleteItem('Category', cat.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </TabsContent>

        {/* Subcategories */}
        <TabsContent value="subcategories" className="space-y-2">
          <button onClick={() => setAddingTab('sub')} className="flex items-center gap-2 text-primary text-sm font-medium mb-2">
            <Plus className="w-4 h-4" /> Nueva subcategoría
          </button>
          {addingTab === 'sub' && (
            <InlineForm
              fields={[
                { key: 'name', label: 'Nombre', default: '' },
                { key: 'category_id', label: 'Categoría', type: 'select', default: categories[0]?.id || '', options: categories.map(c => ({ v: c.id, l: `${c.icon} ${c.name}` })) },
                { key: 'keywords', label: 'Palabras clave', type: 'tags', default: [] },
              ]}
              onSave={async (d) => { await base44.entities.Subcategory.create(d); invalidate(); setAddingTab(null); }}
              onCancel={() => setAddingTab(null)}
            />
          )}
          {categories.map(cat => {
            const subs = subcategories.filter(s => s.category_id === cat.id);
            if (subs.length === 0) return null;
            return (
              <div key={cat.id} className="mb-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">{cat.icon} {cat.name}</p>
                <div className="space-y-1.5 pl-2">
                  {subs.map(sub => (
                    <div key={sub.id} className="bg-card border border-border rounded-xl px-3 py-2.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">{sub.name}</p>
                        <button onClick={() => deleteItem('Subcategory', sub.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {sub.keywords?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {sub.keywords.map((kw, i) => (
                            <span key={i} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* Persons */}
        <TabsContent value="persons" className="space-y-2">
          <button onClick={() => setAddingTab('person')} className="flex items-center gap-2 text-primary text-sm font-medium mb-2">
            <Plus className="w-4 h-4" /> Nueva persona
          </button>
          {addingTab === 'person' && (
            <InlineForm
              fields={[
                { key: 'name', label: 'Nombre', default: '' },
                { key: 'avatar_initial', label: 'Inicial (ej: P)', default: '' },
                { key: 'color', label: 'Color', type: 'color', default: '#059669' },
              ]}
              onSave={async (d) => { await base44.entities.Person.create(d); invalidate(); setAddingTab(null); }}
              onCancel={() => setAddingTab(null)}
            />
          )}
          {persons.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5 shadow-sm">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: p.color }}>
                {p.avatar_initial || p.name?.charAt(0)}
              </div>
              <p className="flex-1 text-sm font-medium text-foreground">{p.name}</p>
              <button onClick={() => deleteItem('Person', p.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </TabsContent>

        {/* Payment methods */}
        <TabsContent value="methods" className="space-y-2">
          <button onClick={() => setAddingTab('method')} className="flex items-center gap-2 text-primary text-sm font-medium mb-2">
            <Plus className="w-4 h-4" /> Nueva forma de pago
          </button>
          {addingTab === 'method' && (
            <InlineForm
              fields={[
                { key: 'name', label: 'Nombre (ej: TDC Like U)', default: '' },
                { key: 'bank', label: 'Banco', default: '' },
                { key: 'type', label: 'Tipo', type: 'select', default: 'credit', options: [{ v: 'credit', l: 'Crédito' }, { v: 'debit', l: 'Débito' }, { v: 'cash', l: 'Efectivo' }, { v: 'transfer', l: 'Transferencia' }] },
                { key: 'identifier', label: 'Últimos 4 dígitos', default: '' },
              ]}
              onSave={async (d) => { await base44.entities.PaymentMethod.create(d); invalidate(); setAddingTab(null); }}
              onCancel={() => setAddingTab(null)}
            />
          )}
          {paymentMethods.map(m => {
            const typeLabel = { credit: '💳 Crédito', debit: '🏧 Débito', cash: '💵 Efectivo', transfer: '📲 Transferencia' }[m.type] || m.type;
            return (
              <div key={m.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{typeLabel}{m.bank ? ` · ${m.bank}` : ''}{m.identifier ? ` ···${m.identifier}` : ''}</p>
                </div>
                <button onClick={() => deleteItem('PaymentMethod', m.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}