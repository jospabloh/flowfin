// Cache buster
import { useState, useEffect } from 'react';
import { usePermission } from '@/lib/permissions/usePermission';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, X, Pencil, Save } from 'lucide-react';
import NativeSelect from '@/components/NativeSelect';
import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCatalog } from '@/hooks/useCatalog';
import { useFamily } from '@/lib/FamilyContext';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm.jsx';

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

function InlineForm({ fields, mutation, onCancel, existingItems = [] }) {
  const [data, setData] = useState(fields.reduce((acc, f) => ({ ...acc, [f.key]: f.default || '' }), {}));
  const [error, setError] = useState('');
  const handleSave = () => {
    const nameField = fields.find(f => f.key === 'name');
    if (nameField && !data.name?.trim()) {
      setError('El nombre es requerido');
      return;
    }
    const isDuplicate = existingItems.some(item => item.name.toLowerCase() === data.name.toLowerCase());
    if (isDuplicate) {
      setError('Este elemento ya existe');
      return;
    }
    setError('');
    mutation.mutate(data, {
      onError: (err) => {
        console.error('Error guardando:', err);
        setError(err?.message || 'Error al guardar. Intenta de nuevo.');
      },
    });
  };
  return (
    <div className="bg-accent/30 rounded-xl p-3 border border-border space-y-2">
      {fields.map(f => (
        f.type === 'tags' ? (
          <div key={f.key}>
            <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
            <TagInput value={data[f.key] || []} onChange={v => setData(d => ({...d, [f.key]: v}))} />
          </div>
        ) : f.type === 'select' ? (
          <NativeSelect
            key={f.key}
            value={data[f.key]}
            onChange={e => setData(d => ({...d, [f.key]: e.target.value}))}
            placeholder={f.label}
            options={f.options.map(o => ({ value: o.v, label: o.l }))}
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm"
          />
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
          <input key={f.key} placeholder={f.label} value={data[f.key]} onChange={e => { setData(d => ({...d, [f.key]: e.target.value})); setError(''); }}
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none" />
        )
      ))}
      {error && <div className="text-xs text-destructive font-medium">{error}</div>}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} disabled={mutation.isPending} className="flex-1 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-medium disabled:opacity-50">Cancelar</button>
        <button onClick={handleSave} disabled={mutation.isPending} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">{mutation.isPending ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </div>
  );
}

function EditForm({ fields, initialData, mutation, onCancel, categories = [] }) {
  const [data, setData] = useState({ ...initialData });
  return (
    <div className="bg-accent/30 rounded-xl p-3 border border-primary/30 space-y-2 mt-1">
      {fields.map(f => (
        f.type === 'toggle' ? (
          <div key={f.key} className="flex items-center justify-between py-1">
            <label className="text-xs text-foreground">{f.label}</label>
            <button
              type="button"
              onClick={() => setData(d => ({ ...d, [f.key]: !d[f.key] }))}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${data[f.key] ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${data[f.key] ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        ) : f.type === 'tags' ? (
          <div key={f.key}>
            <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
            <TagInput value={data[f.key] || []} onChange={v => setData(d => ({...d, [f.key]: v}))} />
          </div>
        ) : f.type === 'select' ? (
          <NativeSelect
            key={f.key}
            value={data[f.key]}
            onChange={e => setData(d => ({...d, [f.key]: e.target.value}))}
            placeholder={f.label}
            options={f.options.map(o => ({ value: o.v, label: o.l }))}
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm"
          />
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
          <input key={f.key} placeholder={f.label} value={data[f.key] || ''} onChange={e => setData(d => ({...d, [f.key]: e.target.value}))}
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none" />
        )
      ))}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} disabled={mutation.isPending} className="flex-1 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-medium disabled:opacity-50">Cancelar</button>
        <button onClick={() => mutation.mutate(data, { onSuccess: onCancel })} disabled={mutation.isPending} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
          {mutation.isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

function TagField({ label, value = [], onChange }) {
  const [input, setInput] = useState('');
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex flex-wrap gap-1.5 p-2.5 bg-muted rounded-xl min-h-[42px]">
        {value.map((tag, i) => (
          <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-card rounded-full text-xs border border-border text-foreground">
            {tag}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive ml-0.5"><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && input.trim()) { e.preventDefault(); onChange([...value, input.trim()]); setInput(''); } }}
          placeholder="Escribe y presiona Enter" className="bg-transparent outline-none text-xs text-foreground placeholder-muted-foreground min-w-[120px] flex-1" />
      </div>
    </div>
  );
}

export default function Catalogs() {
  const queryClient = useQueryClient();
  const { familyId } = useFamily();
  const { categories, subcategories, persons, paymentMethods, isLoading } = useCatalog(familyId);
  const { confirmDelete, ConfirmDialog } = useDeleteConfirm();
  const [addingTab, setAddingTab] = useState(null);
  const [editing, setEditing] = useState(null); // { entity, id }

  const { can_write: canCreateCat }    = usePermission('catalog.categories.create');
  const { can_modify: canEditCat }     = usePermission('catalog.categories.edit');
  const { can_delete: canDeleteCat }   = usePermission('catalog.categories.delete');
  const { can_modify: canToggleExclude } = usePermission('catalog.categories.exclude_from_totals');
  const { can_write: canCreateSub }  = usePermission('catalog.subcategories.create');
  const { can_modify: canEditSub }   = usePermission('catalog.subcategories.edit');
  const { can_delete: canDeleteSub } = usePermission('catalog.subcategories.delete');
  const { can_write: canCreatePer }  = usePermission('catalog.persons.create');
  const { can_modify: canEditPer }   = usePermission('catalog.persons.edit');
  const { can_delete: canDeletePer } = usePermission('catalog.persons.delete');
  const { can_write: canCreateMet }  = usePermission('catalog.methods.create');
  const { can_modify: canEditMet }   = usePermission('catalog.methods.edit');
  const { can_delete: canDeleteMet } = usePermission('catalog.methods.delete');

  // FamilyConfig for tipos de gasto and destinos de transferencia
  const { data: configs = [] } = useQuery({
    queryKey: ['familyConfig', familyId],
    queryFn: () => familyId ? base44.entities.FamilyConfig.filter({ family_id: familyId }) : Promise.resolve([]),
    enabled: !!familyId,
  });
  const [requiredTypes, setRequiredTypes] = useState(['Necesario', 'Gusto', 'Urgente', 'Inversión', 'Otro']);
  const [transferDestinations, setTransferDestinations] = useState(['Actinver', 'Ahorro']);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savedConfig, setSavedConfig] = useState(false);

  useEffect(() => {
    if (configs.length > 0) {
      if (configs[0].required_types) setRequiredTypes(configs[0].required_types);
      if (configs[0].transfer_destinations) setTransferDestinations(configs[0].transfer_destinations);
    }
  }, [configs]);

  const saveConfig = async (field, value) => {
    setSavingConfig(true);
    const update = { family_id: familyId, [field]: value };
    if (configs.length > 0) {
      await base44.entities.FamilyConfig.update(configs[0].id, update);
    } else {
      await base44.entities.FamilyConfig.create(update);
    }
    queryClient.invalidateQueries({ queryKey: ['familyConfig', familyId] });
    setSavingConfig(false);
    setSavedConfig(true);
    setTimeout(() => setSavedConfig(false), 2000);
  };

  const createCategoryMutation = useMutation({
    mutationFn: (data) => {
      if (!familyId) throw new Error('family_id no disponible');
      return base44.entities.Category.create({ ...data, family_id: familyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', familyId], exact: true });
      setAddingTab(null);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id) => base44.entities.Category.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', familyId], exact: true });
    },
  });

  const createSubcategoryMutation = useMutation({
    mutationFn: (data) => base44.entities.Subcategory.create({ ...data, family_id: familyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcategories', familyId], exact: true });
      setAddingTab(null);
    },
  });

  const deleteSubcategoryMutation = useMutation({
    mutationFn: (id) => base44.entities.Subcategory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcategories', familyId], exact: true });
    },
  });

  const createPersonMutation = useMutation({
    mutationFn: (data) => base44.entities.Person.create({ ...data, family_id: familyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons', familyId], exact: true });
      setAddingTab(null);
    },
  });

  const deletePersonMutation = useMutation({
    mutationFn: (id) => base44.entities.Person.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons', familyId], exact: true });
    },
  });

  const createPaymentMethodMutation = useMutation({
    mutationFn: (data) => base44.entities.PaymentMethod.create({ ...data, family_id: familyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods', familyId], exact: true });
      setAddingTab(null);
    },
  });

  const deletePaymentMethodMutation = useMutation({
    mutationFn: (id) => base44.entities.PaymentMethod.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods', familyId], exact: true });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Category.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories', familyId], exact: true }); },
  });

  const updateSubcategoryMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Subcategory.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subcategories', familyId], exact: true }); },
  });

  const updatePersonMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Person.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['persons', familyId], exact: true }); },
  });

  const updatePaymentMethodMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PaymentMethod.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['paymentMethods', familyId], exact: true }); },
  });

  const deleteItem = async (entity, id) => {
    if (!await confirmDelete('¿Eliminar este elemento? Esta acción no se puede deshacer.')) return;
    switch (entity) {
      case 'Category':
        deleteCategoryMutation.mutate(id);
        break;
      case 'Subcategory':
        deleteSubcategoryMutation.mutate(id);
        break;
      case 'Person':
        deletePersonMutation.mutate(id);
        break;
      case 'PaymentMethod':
        deletePaymentMethodMutation.mutate(id);
        break;
    }
  };

  return (
    <div className="pb-4">
      <ConfirmDialog />
      <PageHeader title="Catálogos" subtitle="Gestión de datos maestros" aria-label="Página de catálogos" />

      <Tabs defaultValue="categories" className="px-4">
        <TabsList className="w-full mb-4 grid grid-cols-3 h-auto p-1">
          <TabsTrigger data-tutorial="catalogs-tab-categories" value="categories" className="text-xs py-1.5">Rubros</TabsTrigger>
          <TabsTrigger data-tutorial="catalogs-tab-subcategories" value="subcategories" className="text-xs py-1.5">SubRubros</TabsTrigger>
          <TabsTrigger data-tutorial="catalogs-tab-persons" value="persons" className="text-xs py-1.5">Personas</TabsTrigger>
        </TabsList>
        <TabsList className="w-full mb-4 grid grid-cols-3 h-auto p-1">
          <TabsTrigger data-tutorial="catalogs-tab-methods" value="methods" className="text-xs py-1.5">Formas de Pago</TabsTrigger>
          <TabsTrigger value="required_types" className="text-xs py-1.5">Tipos de Gasto</TabsTrigger>
          <TabsTrigger value="transfer_dest" className="text-xs py-1.5">Transferencias</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-2">
          {canCreateCat && (
            <button onClick={() => setAddingTab('cat')} aria-label="Agregar nueva categoría" className="flex items-center gap-2 text-primary text-sm font-medium mb-2 touch-target">
              <Plus className="w-4 h-4" /> Nueva categoría
            </button>
          )}
          {addingTab === 'cat' && (
            <InlineForm
              fields={[
                { key: 'name', label: 'Nombre', default: '' },
                { key: 'icon', label: 'Emoji (ej: 🍽️)', default: '' },
                { key: 'color', label: 'Color', type: 'color', default: '#059669' },
                { key: 'type', label: 'Tipo', type: 'select', default: 'expense', options: [{ v: 'expense', l: 'Egreso' }, { v: 'income', l: 'Ingreso' }, { v: 'both', l: 'Ambos' }] },
              ]}
              mutation={createCategoryMutation}
              onCancel={() => setAddingTab(null)}
              existingItems={categories}
            />
          )}
          {isLoading ? (
            <div className="text-center py-6 text-sm text-muted-foreground">Cargando rubros...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 bg-muted/30 rounded-xl">
              <p className="text-sm text-muted-foreground mb-2">No hay rubros aún</p>
              <p className="text-xs text-muted-foreground">Crea uno para comenzar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: cat.color + '20' }}>
                      {cat.icon || '📁'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">{cat.type === 'expense' ? 'Egreso' : cat.type === 'income' ? 'Ingreso' : 'Ambos'}</p>
                    </div>
                    {cat.exclude_from_totals && (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">
                        💳 no suma
                      </span>
                    )}
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    {canEditCat && (
                      <button onClick={() => setEditing(editing?.id === cat.id ? null : { entity: 'Category', id: cat.id })} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors touch-target">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDeleteCat && (
                      <button onClick={() => deleteItem('Category', cat.id)} aria-label={`Eliminar categoría ${cat.name}`} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors touch-target">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {editing?.id === cat.id && editing?.entity === 'Category' && (
                    <div className="px-3 pb-3">
                      <EditForm
                        initialData={{ name: cat.name, icon: cat.icon || '', color: cat.color, type: cat.type, exclude_from_totals: cat.exclude_from_totals || false }}
                        fields={[
                          { key: 'name', label: 'Nombre' },
                          { key: 'icon', label: 'Emoji (ej: 🍽️)' },
                          { key: 'color', label: 'Color', type: 'color' },
                          { key: 'type', label: 'Tipo', type: 'select', options: [{ v: 'expense', l: 'Egreso' }, { v: 'income', l: 'Ingreso' }, { v: 'both', l: 'Ambos' }] },
                          ...(canToggleExclude ? [{ key: 'exclude_from_totals', label: 'No sumar en totales (ej: Pago TDC)', type: 'toggle' }] : []),
                        ]}
                        mutation={{ ...updateCategoryMutation, mutate: (data, opts) => updateCategoryMutation.mutate({ id: cat.id, data }, opts), isPending: updateCategoryMutation.isPending }}
                        onCancel={() => setEditing(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="subcategories" className="space-y-2">
          {canCreateSub && (
            <button onClick={() => setAddingTab('sub')} aria-label="Agregar nueva subcategoría" className="flex items-center gap-2 text-primary text-sm font-medium mb-2 touch-target">
              <Plus className="w-4 h-4" /> Nueva subcategoría
            </button>
          )}
          {addingTab === 'sub' && (
            <InlineForm
              fields={[
                { key: 'name', label: 'Nombre', default: '' },
                { key: 'category_id', label: 'Categoría', type: 'select', default: categories[0]?.id || '', options: categories.map(c => ({ v: c.id, l: `${c.icon} ${c.name}` })) },
                { key: 'keywords', label: 'Palabras clave', type: 'tags', default: [] },
              ]}
              mutation={createSubcategoryMutation}
              onCancel={() => setAddingTab(null)}
              existingItems={subcategories}
            />
          )}
          {isLoading ? (
            <div className="text-center py-6 text-sm text-muted-foreground">Cargando subrubros...</div>
          ) : subcategories.length === 0 ? (
            <div className="text-center py-8 bg-muted/30 rounded-xl">
              <p className="text-sm text-muted-foreground mb-2">No hay subrubros aún</p>
              <p className="text-xs text-muted-foreground">Crea uno para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map(cat => {
                const subs = subcategories.filter(s => s.category_id === cat.id);
                if (subs.length === 0) return null;
                return (
                  <div key={cat.id} className="mb-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">{cat.icon} {cat.name}</p>
                    <div className="space-y-1.5 pl-2">
                      {subs.map(sub => (
                        <div key={sub.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2.5">
                            <p className="text-sm font-medium text-foreground flex-1">{sub.name}</p>
                            {canEditSub && (
                              <button onClick={() => setEditing(editing?.id === sub.id ? null : { entity: 'Subcategory', id: sub.id })} className="p-1.5 text-muted-foreground hover:text-primary transition-colors touch-target">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDeleteSub && (
                              <button onClick={() => deleteItem('Subcategory', sub.id)} aria-label={`Eliminar subcategoría ${sub.name}`} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors touch-target">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {sub.keywords?.length > 0 && editing?.id !== sub.id && (
                            <div className="flex flex-wrap gap-1 px-3 pb-2">
                              {sub.keywords.map((kw, i) => (
                                <span key={i} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{kw}</span>
                              ))}
                            </div>
                          )}
                          {editing?.id === sub.id && editing?.entity === 'Subcategory' && (
                            <div className="px-3 pb-3">
                              <EditForm
                                initialData={{ name: sub.name, category_id: sub.category_id, keywords: sub.keywords || [] }}
                                fields={[
                                  { key: 'name', label: 'Nombre' },
                                  { key: 'category_id', label: 'Categoría', type: 'select', options: categories.map(c => ({ v: c.id, l: `${c.icon} ${c.name}` })) },
                                  { key: 'keywords', label: 'Palabras clave', type: 'tags' },
                                ]}
                                mutation={{ ...updateSubcategoryMutation, mutate: (data, opts) => updateSubcategoryMutation.mutate({ id: sub.id, data }, opts), isPending: updateSubcategoryMutation.isPending }}
                                onCancel={() => setEditing(null)}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="persons" className="space-y-2">
          {canCreatePer && (
            <button onClick={() => setAddingTab('person')} aria-label="Agregar nueva persona" className="flex items-center gap-2 text-primary text-sm font-medium mb-2 touch-target">
              <Plus className="w-4 h-4" /> Nueva persona
            </button>
          )}
          {addingTab === 'person' && (
            <InlineForm
              fields={[
                { key: 'name', label: 'Nombre', default: '' },
                { key: 'avatar_initial', label: 'Inicial (ej: P)', default: '' },
                { key: 'color', label: 'Color', type: 'color', default: '#059669' },
              ]}
              mutation={createPersonMutation}
              onCancel={() => setAddingTab(null)}
              existingItems={persons}
            />
          )}
          {isLoading ? (
            <div className="text-center py-6 text-sm text-muted-foreground">Cargando personas...</div>
          ) : persons.length === 0 ? (
            <div className="text-center py-8 bg-muted/30 rounded-xl">
              <p className="text-sm text-muted-foreground mb-2">No hay personas aún</p>
              <p className="text-xs text-muted-foreground">Crea una para comenzar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {persons.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: p.color }}>
                      {p.avatar_initial || p.name?.charAt(0)}
                    </div>
                    <p className="flex-1 text-sm font-medium text-foreground">{p.name}</p>
                    {canEditPer && (
                      <button onClick={() => setEditing(editing?.id === p.id ? null : { entity: 'Person', id: p.id })} className="p-1.5 text-muted-foreground hover:text-primary transition-colors touch-target">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDeletePer && (
                      <button onClick={() => deleteItem('Person', p.id)} aria-label={`Eliminar persona ${p.name}`} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors touch-target">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {editing?.id === p.id && editing?.entity === 'Person' && (
                    <div className="px-3 pb-3">
                      <EditForm
                        initialData={{ name: p.name, avatar_initial: p.avatar_initial || '', color: p.color }}
                        fields={[
                          { key: 'name', label: 'Nombre' },
                          { key: 'avatar_initial', label: 'Inicial (ej: P)' },
                          { key: 'color', label: 'Color', type: 'color' },
                        ]}
                        mutation={{ ...updatePersonMutation, mutate: (data, opts) => updatePersonMutation.mutate({ id: p.id, data }, opts), isPending: updatePersonMutation.isPending }}
                        onCancel={() => setEditing(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="methods" className="space-y-2">
          {canCreateMet && (
            <button onClick={() => setAddingTab('method')} aria-label="Agregar nueva forma de pago" className="flex items-center gap-2 text-primary text-sm font-medium mb-2 touch-target">
              <Plus className="w-4 h-4" /> Nueva forma de pago
            </button>
          )}
          {addingTab === 'method' && (
            <InlineForm
              fields={[
                { key: 'name', label: 'Nombre (ej: TDC Like U)', default: '' },
                { key: 'bank', label: 'Banco', default: '' },
                { key: 'type', label: 'Tipo', type: 'select', default: 'credit', options: [{ v: 'credit', l: 'Crédito' }, { v: 'debit', l: 'Débito' }, { v: 'cash', l: 'Efectivo' }, { v: 'transfer', l: 'Transferencia' }] },
                { key: 'identifier', label: 'Últimos 4 dígitos', default: '' },
              ]}
              mutation={createPaymentMethodMutation}
              onCancel={() => setAddingTab(null)}
              existingItems={paymentMethods}
            />
          )}
          {isLoading ? (
            <div className="text-center py-6 text-sm text-muted-foreground">Cargando formas de pago...</div>
          ) : paymentMethods.length === 0 ? (
            <div className="text-center py-8 bg-muted/30 rounded-xl">
              <p className="text-sm text-muted-foreground mb-2">No hay formas de pago aún</p>
              <p className="text-xs text-muted-foreground">Crea una para comenzar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paymentMethods.map(m => {
                const typeLabel = { credit: '💳 Crédito', debit: '🏧 Débito', cash: '💵 Efectivo', transfer: '📲 Transferencia' }[m.type] || m.type;
                return (
                  <div key={m.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{typeLabel}{m.bank ? ` · ${m.bank}` : ''}{m.identifier ? ` ···${m.identifier}` : ''}</p>
                      </div>
                      {canEditMet && (
                        <button onClick={() => setEditing(editing?.id === m.id ? null : { entity: 'PaymentMethod', id: m.id })} className="p-1.5 text-muted-foreground hover:text-primary transition-colors touch-target">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteMet && (
                        <button onClick={() => deleteItem('PaymentMethod', m.id)} aria-label={`Eliminar forma de pago ${m.name}`} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors touch-target">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editing?.id === m.id && editing?.entity === 'PaymentMethod' && (
                      <div className="px-3 pb-3">
                        <EditForm
                          initialData={{ name: m.name, bank: m.bank || '', type: m.type, identifier: m.identifier || '' }}
                          fields={[
                            { key: 'name', label: 'Nombre (ej: TDC Like U)' },
                            { key: 'bank', label: 'Banco' },
                            { key: 'type', label: 'Tipo', type: 'select', options: [{ v: 'credit', l: 'Crédito' }, { v: 'debit', l: 'Débito' }, { v: 'cash', l: 'Efectivo' }, { v: 'transfer', l: 'Transferencia' }] },
                            { key: 'identifier', label: 'Últimos 4 dígitos' },
                          ]}
                          mutation={{ ...updatePaymentMethodMutation, mutate: (data, opts) => updatePaymentMethodMutation.mutate({ id: m.id, data }, opts), isPending: updatePaymentMethodMutation.isPending }}
                          onCancel={() => setEditing(null)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="required_types" className="space-y-3">
          <p className="text-xs text-muted-foreground">Define cómo clasifican sus gastos (Necesario, Gusto, etc.)</p>
          <TagField
            label="Tipos de gasto requerido"
            value={requiredTypes}
            onChange={setRequiredTypes}
          />
          <button
            onClick={() => saveConfig('required_types', requiredTypes)}
            disabled={savingConfig}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {savedConfig ? '¡Guardado!' : savingConfig ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </TabsContent>

        <TabsContent value="transfer_dest" className="space-y-3">
          <p className="text-xs text-muted-foreground">Destinos frecuentes para el campo "Transferido a" (ej: Actinver, DAYMAC)</p>
          <TagField
            label="Destinos de transferencia"
            value={transferDestinations}
            onChange={setTransferDestinations}
          />
          <button
            onClick={() => saveConfig('transfer_destinations', transferDestinations)}
            disabled={savingConfig}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {savedConfig ? '¡Guardado!' : savingConfig ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </TabsContent>
      </Tabs>
    </div>
  );
}