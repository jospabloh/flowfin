import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import { useToast } from '@/components/ui/use-toast';

const DELETION_STEPS = ['Selecciona', 'Confirma email', 'Verifica', 'Completo'];

export default function AccountSettings() {
  const { toast } = useToast();
  const [showDeleteFlow, setShowDeleteFlow] = useState(false);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');

  // Load user email on mount
  useEffect(() => {
    base44.auth.me().then(user => {
      if (user?.email) setEmail(user.email);
    }).catch(() => {});
  }, []);

  // Start deletion mutation
  const startDeletionMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      return user.email;
    },
    onSuccess: (userEmail) => {
      setEmail(userEmail);
      setStep(1);
      setError('');
    },
    onError: (err) => {
      setError('Error al verificar tu cuenta: ' + (err?.message || 'Intenta de nuevo'));
      toast({
        title: 'Error de verificación',
        description: 'No pudimos verificar tu cuenta. Intenta de nuevo.',
        variant: 'destructive',
      });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: (code) => base44.functions.invoke('deleteAccount', { verification_code: code }),
    onSuccess: () => {
      setStep(3);
      toast({
        title: 'Cuenta eliminada ✓',
        description: 'Tu cuenta ha sido eliminada exitosamente.',
      });
      setTimeout(() => {
        base44.auth.logout('/');
      }, 2000);
    },
    onError: (err) => {
      setError(err?.message || 'Error al eliminar la cuenta. Intenta de nuevo.');
      toast({
        title: 'Error al eliminar cuenta',
        description: err?.message || 'No se pudo eliminar tu cuenta.',
        variant: 'destructive',
      });
    },
  });

  const handleStartDeletion = async () => {
    startDeletionMutation.mutate();
  };

  const handleConfirmEmail = () => {
    if (!email) {
      setError('Email no verificado');
      return;
    }
    setStep(2);
    setError('');
  };

  const handleDeleteAccount = () => {
    if (!verificationCode) {
      setError('Ingresa el código de verificación');
      return;
    }
    deleteAccountMutation.mutate(verificationCode);
  };

  const handleCancel = () => {
    setShowDeleteFlow(false);
    setStep(0);
    setEmail('');
    setVerificationCode('');
    setError('');
  };

  return (
    <div className="pb-4">
      <PageHeader title="Configuración de cuenta" subtitle="Gestión de tu perfil y datos" />

      <div className="px-4 space-y-4">
        {/* Account Info Card */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Información de cuenta</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="text-foreground font-medium" id="account-email">—</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado</span>
              <span className="text-foreground font-medium">Activo</span>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Zona de peligro</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Estas acciones son irreversibles. Procede con cuidado.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowDeleteFlow(true)}
            aria-label="Eliminar cuenta de forma permanente"
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition-colors touch-target"
          >
            <LogOut className="w-4 h-4" />
            Eliminar cuenta
          </button>
        </div>
      </div>

      {/* Deletion Flow Modal */}
      <AnimatePresence>
        {showDeleteFlow && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={handleCancel}
            />
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-title"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border pb-safe max-h-[90vh] overflow-y-auto overscroll-none"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-card border-b border-border p-4 rounded-t-3xl">
                <h2 id="delete-title" className="text-base font-bold text-destructive">
                  Eliminar cuenta
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Esta acción no se puede deshacer
                </p>
              </div>

              {/* Progress Steps */}
              <div className="px-4 pt-4">
                <div className="flex gap-2 mb-6">
                  {DELETION_STEPS.map((label, i) => (
                    <div key={i} className="flex-1">
                      <div
                        className={`h-1 rounded-full transition-colors ${
                          i <= step ? 'bg-destructive' : 'bg-muted'
                        }`}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1 text-center">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="px-4 pb-6 space-y-4">
                {/* Step 0: Warning */}
                {step === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
                      <p className="text-sm text-foreground font-medium mb-2">
                        ¿Estás seguro?
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Se eliminarán todos tus datos familiares</li>
                        <li>• Tu familia perderá acceso a tus registros</li>
                        <li>• No podrás recuperar esta información</li>
                      </ul>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-border transition-colors touch-target"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleStartDeletion}
                        disabled={startDeletionMutation.isPending}
                        className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors touch-target"
                      >
                        {startDeletionMutation.isPending ? 'Verificando...' : 'Continuar'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 1: Email Confirmation */}
                {step === 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="bg-muted/50 rounded-xl p-4">
                      <p className="text-xs text-muted-foreground mb-2">Email de tu cuenta:</p>
                      <p className="text-sm font-semibold text-foreground">{email}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Te enviaremos un código de verificación a este email.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-border transition-colors touch-target"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleConfirmEmail}
                        className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors touch-target"
                      >
                        Enviar código
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Verification Code */}
                {step === 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <p className="text-xs text-muted-foreground">
                      Hemos enviado un código a {email}. Ingresa el código para continuar.
                    </p>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={e => {
                        setVerificationCode(e.target.value);
                        setError('');
                      }}
                      placeholder="Código de 6 dígitos"
                      maxLength="6"
                      inputMode="numeric"
                      className="w-full bg-muted rounded-xl px-4 py-3 text-center text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-destructive/30"
                    />
                    {error && (
                      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                        <p className="text-xs text-destructive font-medium">{error}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-border transition-colors touch-target"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteAccountMutation.isPending || !verificationCode}
                        className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors touch-target"
                      >
                        {deleteAccountMutation.isPending ? 'Eliminando...' : 'Eliminar cuenta'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Success */}
                {step === 3 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-4 py-6"
                  >
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                      <AlertTriangle className="w-8 h-8 text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Cuenta eliminada</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Serás desconectado en unos momentos
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}