import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Key } from 'lucide-react';

export default function UserNotRegisteredError() {
  const [joinCode, setJoinCode] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleJoin = async () => {
    if (!joinCode.trim() || !email.trim()) return;
    setLoading(true);
    setError('');

    let userName = email;
    try {
      const me = await base44.auth.me();
      userName = me.full_name || me.email;
    } catch { /* ignore */ }

    const res = await base44.functions.invoke('selfJoin', {
      join_code: joinCode.trim().toUpperCase(),
      user_email: email.trim().toLowerCase(),
      user_name: userName,
    });

    if (res.data?.success) {
      setSuccess(true);
      // Reload to re-authenticate with the now-registered account
      setTimeout(() => globalThis.location.reload(), 1500);
    } else {
      setError(res.data?.error || 'Código no encontrado. Verifica e intenta de nuevo.');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-primary-foreground font-black text-3xl">F</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">¡Bienvenida!</h2>
          <p className="text-sm text-muted-foreground">Acceso concedido. Cargando la app...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
            <span className="text-primary-foreground font-black text-3xl">F</span>
          </div>
          <h1 className="text-2xl font-black text-foreground">FamilyFlow</h1>
          <p className="text-muted-foreground text-sm mt-1">Finanzas Familiares Inteligentes</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-foreground text-center">Unirme a una familia</h2>
          <p className="text-xs text-muted-foreground text-center">Ingresa tu correo y el código que te compartió el administrador</p>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Ej: GARCIA123"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 tracking-widest font-mono text-center uppercase"
          />
          {error && <p className="text-xs text-destructive text-center">{error}</p>}
          <button
            onClick={handleJoin}
            disabled={loading || !joinCode.trim() || !email.trim()}
            className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            {loading ? 'Verificando...' : 'Acceder a mi familia'}
          </button>
          <button onClick={handleLogout} className="w-full py-2 text-xs text-muted-foreground">
            Cerrar sesión y usar otra cuenta
          </button>
        </div>
      </div>
    </div>
  );
}