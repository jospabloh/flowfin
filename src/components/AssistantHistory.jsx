import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { X, Trash2, ChevronDown, ChevronUp, AlertTriangle, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Ícono de WhatsApp (SVG inline, color verde oficial #25D366)
const WhatsAppIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-label="WhatsApp">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// Filtros de mensajes que no deben mostrarse al usuario
const HIDDEN_PREFIXES = ['[LOCALE:', '[SYSTEM_CONTEXT:', '[HISTORIAL:'];
const isVisible = (msg) =>
  msg?.role && msg?.content && !HIDDEN_PREFIXES.some(p => msg.content.startsWith(p));

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
};

const getExcerpt = (session) => {
  if (session.summary) return session.summary;
  const msgs = Array.isArray(session.messages) ? session.messages : [];
  const first = msgs.find(m => m.role === 'user' && m.content);
  return first?.content?.slice(0, 90) || 'Sin mensajes';
};

export default function AssistantHistory({ onClose }) {
  const { currentUser } = useFamily();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    loadHistory();
  }, [currentUser?.id]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await base44.entities.ConversationSession.filter(
        { user_id: currentUser.id },
        '-session_date',
        60
      );
      setSessions(data);
    } catch (e) {
      console.error('[AssistantHistory] Error cargando historial:', e);
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    try {
      await base44.entities.ConversationSession.delete(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (expanded === sessionId) setExpanded(null);
    } catch (e) {
      console.error('[AssistantHistory] Error eliminando sesión:', e);
    }
  };

  const deleteAll = async () => {
    setDeleting(true);
    try {
      await Promise.all(sessions.map(s => base44.entities.ConversationSession.delete(s.id)));
      setSessions([]);
      setShowDeleteWarning(false);
    } catch (e) {
      console.error('[AssistantHistory] Error eliminando todo:', e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
        <div>
          <h2 className="font-bold text-foreground">Historial</h2>
          <p className="text-xs text-muted-foreground">El Asistente IA usa este historial como contexto</p>
        </div>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <button
              onClick={() => setShowDeleteWarning(true)}
              className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
              title="Eliminar todo el historial"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lista de sesiones */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-foreground">Sin historial aún</p>
              <p className="text-xs text-muted-foreground mt-1">
                Las conversaciones de días anteriores aparecerán aquí
              </p>
            </div>
          </div>
        ) : (
          sessions.map((session) => {
            const visibleMsgs = (Array.isArray(session.messages) ? session.messages : []).filter(isVisible);
            const isOpen = expanded === session.id;

            return (
              <div key={session.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* Fila resumen */}
                <button
                  onClick={() => setExpanded(isOpen ? null : session.id)}
                  className="w-full text-left px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {session.channel === 'whatsapp' && (
                          <span className="text-[#25D366]" title="Desde WhatsApp">
                            <WhatsAppIcon />
                          </span>
                        )}
                        <span className="text-xs font-semibold text-foreground">
                          {formatDate(session.session_date)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · {session.message_count || visibleMsgs.length} msgs
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{getExcerpt(session)}</p>
                    </div>
                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    }
                  </div>
                </button>

                {/* Mensajes expandidos */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 border-t border-border">
                        {visibleMsgs.length === 0 ? (
                          <p className="text-xs text-muted-foreground mt-3">Sin mensajes visibles</p>
                        ) : (
                          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                            {visibleMsgs.map((msg, i) => (
                              <div
                                key={i}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`rounded-xl px-3 py-2 text-xs max-w-[85%] ${
                                    msg.role === 'user'
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted text-foreground'
                                  }`}
                                >
                                  {msg.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-end mt-3">
                          <button
                            onClick={(e) => deleteSession(session.id, e)}
                            className="text-xs text-destructive hover:underline flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Eliminar esta sesión
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: confirmar borrar todo */}
      <AnimatePresence>
        {showDeleteWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-end z-10"
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ duration: 0.2 }}
              className="w-full bg-card border-t border-border rounded-t-3xl p-6 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">¿Eliminar todo el historial?</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    El Asistente IA usa tu historial para recordar tus patrones, preferencias y transacciones
                    frecuentes. Sin historial, empezará desde cero cada día.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteWarning(false)}
                  className="flex-1 py-3 rounded-xl bg-muted text-foreground text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={deleteAll}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl bg-destructive text-white text-sm font-semibold disabled:opacity-50"
                >
                  {deleting ? 'Eliminando…' : 'Sí, eliminar todo'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
