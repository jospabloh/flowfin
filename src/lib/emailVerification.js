// Helpers for the email-code (OTP) verification step shared by Register and
// Login. Kept out of VerifyEmailStep.jsx so that file only exports a component
// (react-refresh: a hook/helper and a component from one file breaks lint).

// Base44 answers a password login for an unverified account with a message
// like "Please verify your email" / mentions the verification code. When that
// happens the person needs the code screen, not the raw error.
export const needsEmailVerification = (error) =>
  /verify your email|email (is )?not verified|verification code|verificaci[oó]n/i.test(
    String(error?.message || error?.data?.message || error?.detail || ''),
  );

// Base44's messages are English; the person reads Spanish. Unknown messages
// fall back to a generic Spanish line instead of leaking the raw text.
export function otpErrorMessage(error, fallback = 'No pudimos verificar el código. Intenta de nuevo.') {
  const raw = String(error?.message || error?.data?.message || error?.detail || '').toLowerCase();
  if (!raw) return fallback;
  if (/expired|vencid/.test(raw)) return 'El código venció. Pide uno nuevo con "Reenviar código".';
  if (/invalid|incorrect|wrong|not match|inv[aá]lid/.test(raw)) return 'Código incorrecto. Revísalo e intenta de nuevo.';
  if (/too many|rate limit|429/.test(raw)) return 'Demasiados intentos. Espera un momento e intenta de nuevo.';
  if (/network|failed to fetch/.test(raw)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  return fallback;
}
