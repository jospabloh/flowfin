import { base44 } from '@/api/base44Client';
import { MessageCircle, Settings, Link, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function WhatsAppSetup() {
  const navigate = useNavigate();
  const whatsappURL = base44.agents.getWhatsAppConnectURL('finia');

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Settings className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Configuración de WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Reconectar Finia con WhatsApp</p>
          </div>
        </div>

        {/* Instrucciones */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Reconectar WhatsApp</h2>
              <p className="text-xs text-muted-foreground">Sigue estos pasos para reiniciar la conexión</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
              <p className="text-sm text-foreground">Ve al <strong>Dashboard de Base44</strong> → tu app → <strong>Agent Editor</strong></p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
              <p className="text-sm text-foreground">Selecciona el agente <strong>finia</strong> y ve a la pestaña <strong>WhatsApp</strong></p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
              <p className="text-sm text-foreground">Haz clic en <strong>Desconectar</strong> o <strong>Disconnect</strong></p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</div>
              <p className="text-sm text-foreground">Espera 5 segundos y luego haz clic en <strong>Conectar</strong> o <strong>Connect</strong></p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">5</div>
              <p className="text-sm text-foreground">Copia el nuevo código de activación que se genere</p>
            </div>
          </div>
        </div>

        {/* Enlace directo */}
        <div className="bg-[#25D366]/10 border border-[#25D366]/25 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center">
              <Link className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-[#128C7E] dark:text-[#25D366]">Enlace de activación</h2>
              <p className="text-xs text-muted-foreground">Úsalo después de reconectar</p>
            </div>
          </div>

          <div className="bg-white dark:bg-background rounded-xl p-4 border border-border mb-4">
            <p className="text-xs text-muted-foreground mb-2">Tu enlace de WhatsApp para Finia:</p>
            <code className="text-xs text-foreground break-all">{whatsappURL}</code>
          </div>

          <a
            href={whatsappURL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold py-3 rounded-xl transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Abrir WhatsApp
          </a>
        </div>

        {/* Verificación */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Verificar conexión</h2>
              <p className="text-xs text-muted-foreground">Después de reconectar</p>
            </div>
          </div>

          <ol className="space-y-2 text-sm text-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              Envía el nuevo código desde WhatsApp
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              Finia debería responder con su greeting en menos de 10 segundos
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              Si no responde, espera 1 minuto y vuelve a intentar
            </li>
          </ol>
        </div>

        {/* Alerta */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Importante</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                La reconexión es necesaria si Finia no responde después del código de activación. Esto reinicia el webhook de WhatsApp y soluciona problemas de comunicación.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}