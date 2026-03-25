import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { Save, Plus, X, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useToast } from '@/components/ui/use-toast';
import LocaleSelector from '@/components/LocaleSelector';

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

export default function FamilySettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [config, setConfig] = useState({
    family_name: 'Mi Familia', currency: 'MXN', currency_symbol: '$',
    locale: 'es-MX',
    required_types: ['Necesario', 'Gusto', 'Urgente', 'Inversión', 'Otro'],
    transfer_destinations: ['Actinver', 'Ahorro'], week_start: 'monday',
  });

  const { familyId } = useFamily();

  const { data: configs = [] } = useQuery({
    queryKey: ['familyConfig', familyId],
    queryFn: () => familyId ? base44.entities.FamilyConfig.filter({ family_id: familyId }) : Promise.resolve([]),
    enabled: !!familyId,
  });

  useEffect(() => {
    if (configs.length > 0) setConfig(prev => ({ ...prev, ...configs[0] }));
  }, [configs]);

  // FamilyConfig save mutation
  const saveFamilyConfigMutation = useMutation({
    mutationFn: (configData) => {
      const dataWithFamily = { ...configData, family_id: familyId };
      return configs.length > 0
        ? base44.entities.FamilyConfig.update(configs[0].id, dataWithFamily)
        : base44.entities.FamilyConfig.create(dataWithFamily);
    },
    onMutate: async (newConfig) => {
      await queryClient.cancelQueries({ queryKey: ['familyConfig'] });
      const previous = queryClient.getQueryData(['familyConfig']);
      // Optimistic update
      if (configs.length > 0) {
        queryClient.setQueryData(['familyConfig'], (old = []) => 
          old.map(c => c.id === configs[0].id ? { ...c, ...newConfig } : c)
        );
      } else {
        queryClient.setQueryData(['familyConfig'], (old = []) => 
          [...old, { ...newConfig, id: `opt_${Date.now()}` }]
        );
      }
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['familyConfig'], ctx.previous);
      toast({
        title: 'Error al guardar',
        description: err?.message || 'No se pudo guardar la configuración. Intenta de nuevo.',
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['familyConfig'] });
    },
  });

  // Account deletion mutation
  const deleteAccountMutation = useMutation({
    mutationFn: () => base44.functions.invoke('deleteAccount', {}),
    onError: (err) => {
      toast({
        title: 'Error al eliminar cuenta',
        description: err?.message || 'No se pudo eliminar tu cuenta. Intenta de nuevo.',
        variant: 'destructive',
      });
      setConfirmDelete(false);
    },
    onSuccess: () => {
      toast({
        title: 'Cuenta eliminada',
        description: 'Tu cuenta ha sido eliminada exitosamente. Serás desconectado.',
      });
      setTimeout(() => base44.auth.logout(), 1500);
    },
  });

  const handleSave = () => {
    saveFamilyConfigMutation.mutate(config);
  };

  const handleDeleteAccount = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    deleteAccountMutation.mutate();
  };

  const Field = ({ label, field, type = 'text', placeholder = '' }) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <input type={type} value={config[field] || ''} onChange={e => setConfig(c => ({...c, [field]: e.target.value}))}
        placeholder={placeholder}
        className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30" />
    </div>
  );

  return (
    <div className="pb-6">
      {/* Modal de configuración guardada */}
      {showSaveSuccess && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-income/10 flex items-center justify-center">
                  <span className="text-lg">✓</span>
                </div>
                <h3 className="font-semibold text-foreground">Configuración guardada ✓</h3>
              </div>
              <button
                onClick={() => setShowSaveSuccess(false)}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">Los cambios se han guardado exitosamente.</p>
          </div>
        </div>
      )}
      
      <PageHeader title="Mi Familia" subtitle="Configuración personal"
        action={
          <button onClick={handleSave} disabled={saveFamilyConfigMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saveFamilyConfigMutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        } />

      <div className="px-4 space-y-5">
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground">🏠 Datos de la Familia</h3>
          <Field label="Nombre de la familia" field="family_name" placeholder="Mi Familia" />
          <LocaleSelector
            value={config.locale}
            onChange={locale => setConfig(c => ({ ...c, locale }))}
            onLocaleChange={({ currency, symbol }) =>
              setConfig(c => ({ ...c, currency, currency_symbol: symbol }))
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Moneda" field="currency" placeholder="MXN" />
            <Field label="Símbolo" field="currency_symbol" placeholder="$" />
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1 ml-1">Puedes ajustar manualmente la moneda y símbolo si lo necesitas.</p>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Inicio de semana</label>
            <div className="flex gap-2">
              {[{ v: 'monday', l: 'Lunes' }, { v: 'sunday', l: 'Domingo' }].map(o => (
                <button key={o.v} onClick={() => setConfig(c => ({...c, week_start: o.v}))}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all
                    ${config.week_start === o.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground">📊 Tipos de Gasto</h3>
          <p className="text-xs text-muted-foreground">Define cómo clasifican sus gastos (Necesario, Gusto, etc.)</p>
          <TagField label="Tipos de requerido" value={config.required_types || []} onChange={v => setConfig(c => ({...c, required_types: v}))} />
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground">💰 Destinos de Transferencia</h3>
          <p className="text-xs text-muted-foreground">Lugares a donde mueven su dinero (ej: Actinver, DAYMAC, etc.)</p>
          <TagField label="Destinos" value={config.transfer_destinations || []} onChange={v => setConfig(c => ({...c, transfer_destinations: v}))} />
        </div>

        <div className="bg-muted/50 rounded-2xl p-4">
          <p className="text-xs text-muted-foreground text-center">
            Esta configuración es exclusiva de su familia y no afecta a otros usuarios de la plataforma.
          </p>
        </div>

        {/* Danger zone */}
        <div className="bg-card border border-destructive/30 rounded-2xl p-4 space-y-3 shadow-sm">
          <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Zona de Peligro
          </h3>
          <p className="text-xs text-muted-foreground">
            Al eliminar tu cuenta, se borrarán tus membresías familiares y serás desconectado. Los datos compartidos de la familia no se eliminan.
          </p>
          {confirmDelete && (
            <p className="text-xs font-semibold text-destructive bg-destructive/10 rounded-xl px-3 py-2">
              ¿Estás seguro? Esta acción no se puede deshacer. Presiona nuevamente para confirmar.
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={handleDeleteAccount} disabled={deleteAccountMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold disabled:opacity-50 transition-colors hover:bg-destructive/90">
              <Trash2 className="w-3.5 h-3.5" />
              {deleteAccountMutation.isPending ? 'Eliminando...' : confirmDelete ? 'Confirmar eliminación' : 'Eliminar mi cuenta'}
            </button>
            {confirmDelete && (
              <button onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-semibold hover:bg-muted/70 transition-colors">
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}