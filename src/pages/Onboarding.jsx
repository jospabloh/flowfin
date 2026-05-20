import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Key, Plus, Loader2, CheckCircle } from 'lucide-react';
import { defaultCategories, defaultSubcategoriesByCategory, defaultPaymentMethods } from '@/lib/seedData';
import InviteShareCard from '@/components/family/InviteShareCard';
import { track } from '@/lib/analytics';

function readUrlParams() {
  try {
    const params = new URLSearchParams(globalThis.location?.search || '');
    return {
      code: (params.get('code') || '').trim().toUpperCase(),
      ref: (params.get('ref') || '').trim(),
    };
  } catch {
    return { code: '', ref: '' };
  }
}

export default function Onboarding() {
  const familyCtx = useFamily();
  const currentUser = familyCtx?.currentUser;
  const refetchMembership = familyCtx?.refetchMembership;
  const urlParams = readUrlParams();
  const [mode, setMode] = useState(urlParams.code ? 'join' : null); // 'create' | 'join' | 'invite'
  const [familyName, setFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState(urlParams.code || '');
  const [referrerId] = useState(urlParams.ref || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingApproval, setPendingApproval] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // On mount, check via backend function (bypasses RLS/token caching)
  useEffect(() => {
    if (!currentUser) return;
    base44.functions.invoke('getMyMembership', {})
      .then(res => {
        const { membership } = res.data || {};
        if (membership) {
          refetchMembership();
        }
      })
      .catch(() => {})
      .finally(() => setCheckingExisting(false));
  }, [currentUser]);

  if (checkingExisting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg animate-pulse-ring">
          <span className="text-white font-bold text-2xl">F</span>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!familyName.trim()) return;
    setLoading(true);
    setError('');

    // Flatten subcategories with _category_name for the backend
    const flatSubs = [];
    Object.entries(defaultSubcategoriesByCategory).forEach(([catName, subs]) => {
      subs.forEach(s => flatSubs.push({ ...s, _category_name: catName }));
    });

    const res = await base44.functions.invoke('createFamily', {
      family_name: familyName.trim(),
      default_categories: defaultCategories,
      default_subcategories: flatSubs,
      default_payment_methods: defaultPaymentMethods,
    });

    if (res.data?.error) {
      setError(res.data.error);
      setLoading(false);
      return;
    }

    track('family_created', { family_id: res.data?.family_id || null });

    // Refresh context so the InviteShareCard can read the new join_code,
    // then move to the invite step instead of reloading immediately.
    await refetchMembership();
    setLoading(false);
    setMode('invite');
  };

  const finishOnboarding = () => {
    globalThis.location.reload();
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await base44.functions.invoke('selfJoin', {
        join_code: joinCode.trim().toUpperCase(),
        user_email: currentUser.email,
        user_name: currentUser.full_name,
        ...(referrerId ? { ref: referrerId } : {}),
      });

      if (res.data?.already_member) {
        track('invite_join_completed', { had_referrer: Boolean(referrerId), outcome: 'already_member' });
        refetchMembership();
        return;
      }

      if (res.data?.success || res.data?.pending) {
        track('invite_join_completed', { had_referrer: Boolean(referrerId), outcome: 'pending' });
        setPendingApproval(true);
      } else {
        track('invite_join_failed', { had_referrer: Boolean(referrerId), reason: res.data?.error || 'unknown' });
        setError(res.data?.error || 'Código no encontrado. Verifica e intenta de nuevo.');
      }
    } catch {
      setError('Error al conectar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Solicitud enviada</h2>
          <p className="text-muted-foreground text-sm">Tu solicitud fue enviada al administrador de la familia. Una vez que la apruebe, podrás acceder a la app.</p>
          <button onClick={() => refetchMembership()} className="mt-6 w-full py-3 rounded-2xl bg-muted text-muted-foreground font-medium text-sm">
            Ya me aprobaron, recargar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/e0e86c747_FlowFin_logo.png" alt="FlowFin" className="w-32 h-32 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-foreground">FlowFin</h1>
          <p className="text-muted-foreground text-sm mt-1">Finanzas Familiares Inteligentes</p>
        </div>

        <AnimatePresence mode="wait">
          {!mode ? (
            <motion.div key="choose" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="space-y-3">
              <p className="text-center text-sm text-muted-foreground mb-6">¡Bienvenido, {currentUser?.full_name?.split(' ')[0]}! Para empezar, crea tu familia o únete a una existente.</p>
              <button onClick={() => setMode('create')}
                className="w-full flex items-center gap-4 p-4 bg-card border-2 border-primary/30 rounded-2xl hover:border-primary transition-all hover:shadow-md">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-foreground text-sm">Crear mi familia</p>
                  <p className="text-xs text-muted-foreground">Soy el administrador y quiero iniciar</p>
                </div>
              </button>
              <button onClick={() => setMode('join')}
                className="w-full flex items-center gap-4 p-4 bg-card border-2 border-border rounded-2xl hover:border-primary/50 transition-all hover:shadow-md">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Key className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-foreground text-sm">Unirme a una familia</p>
                  <p className="text-xs text-muted-foreground">Tengo un código de invitación</p>
                </div>
              </button>
            </motion.div>
          ) : mode === 'create' ? (
            <motion.div key="create" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="space-y-4">
              <h2 className="text-lg font-bold text-foreground text-center">Crear mi familia</h2>
              <input type="text" value={familyName} onChange={e => setFamilyName(e.target.value)}
                placeholder="Ej: Familia García"
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30" />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button onClick={handleCreate} disabled={loading || !familyName.trim()}
                className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                {loading ? 'Creando...' : 'Crear familia'}
              </button>
              <button onClick={() => setMode(null)} className="w-full py-2 text-sm text-muted-foreground">← Volver</button>
            </motion.div>
          ) : mode === 'invite' ? (
            <motion.div key="invite" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="space-y-4">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-foreground">¡Tu familia está lista!</h2>
                <p className="text-xs text-muted-foreground max-w-[16rem]">
                  Antes de empezar, invita al menos a una persona con quien compartes gastos. Vas a ver el bucle completo desde el primer día.
                </p>
              </div>
              <InviteShareCard
                title="Comparte el código"
                subtitle="Pega el link en WhatsApp y olvídate del trámite."
                onSkip={finishOnboarding}
                skipLabel="Lo invito después"
              />
              <button onClick={finishOnboarding}
                className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 flex items-center justify-center gap-2">
                Entrar a la app
              </button>
            </motion.div>
          ) : (
            <motion.div key="join" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="space-y-4">
              <h2 className="text-lg font-bold text-foreground text-center">Unirme a una familia</h2>
              <p className="text-xs text-muted-foreground text-center">Pídele el código al administrador de tu familia</p>
              <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Ej: GARCIA123"
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 tracking-widest font-mono text-center uppercase" />
              {error && <p className="text-xs text-destructive text-center">{error}</p>}
              <button onClick={handleJoin} disabled={loading || !joinCode.trim()}
                className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {loading ? 'Buscando...' : 'Solicitar acceso'}
              </button>
              <button onClick={() => setMode(null)} className="w-full py-2 text-sm text-muted-foreground">← Volver</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}