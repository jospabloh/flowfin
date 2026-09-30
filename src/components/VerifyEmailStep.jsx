import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { otpErrorMessage } from "@/lib/emailVerification";

// Paso del código de verificación por correo, compartido por Register y Login.
// El registro manda un código; sin este paso la cuenta nunca queda verificada y
// el login responde "Please verify your email".
//
// Al verificar: guarda el token si Base44 lo devuelve; si no, intenta iniciar
// sesión con la contraseña recién escrita. Si tampoco se puede, `onVerified`
// recibe { needsLogin: true } y quien llama manda a /login.
export default function VerifyEmailStep({ email, password, onVerified, onCancel }) {
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    let result;
    try {
      result = await base44.auth.verifyOtp({ email, otpCode });
    } catch (err) {
      setError(otpErrorMessage(err, "Código incorrecto. Revísalo e intenta de nuevo."));
      setBusy(false);
      return;
    }
    try {
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      } else if (password) {
        await base44.auth.loginViaEmailPassword(email, password);
      } else {
        onVerified({ needsLogin: true });
        return;
      }
      onVerified({ needsLogin: false });
    } catch {
      onVerified({ needsLogin: true });
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setResending(true);
    try {
      await base44.auth.resendOtp(email);
      toast({ title: "Código enviado", description: "Revisa tu correo para el nuevo código." });
    } catch (err) {
      setError(otpErrorMessage(err, "No se pudo reenviar el código. Intenta de nuevo."));
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <p className="mb-4 text-center text-sm text-muted-foreground">
        Enviamos un código a <strong className="text-foreground">{email}</strong>. Escríbelo para activar tu cuenta.
      </p>
      {error && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <div className="flex justify-center mb-6">
        <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button className="w-full h-12 font-medium" onClick={handleVerify} disabled={busy || otpCode.length < 6}>
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Verificando...
          </>
        ) : (
          "Verificar"
        )}
      </Button>
      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-primary font-medium hover:underline disabled:opacity-50"
        >
          {resending ? "Enviando..." : "Reenviar código"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            Usar otro correo
          </button>
        )}
      </div>
    </>
  );
}
