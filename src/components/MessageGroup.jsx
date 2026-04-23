import { motion } from 'framer-motion';
import MessageBubble from './MessageBubble';

export default function MessageGroup({ userMsg, assistantMsg, showConfirmButtons, onConfirm, onModify }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="bg-muted/20 rounded-2xl p-3.5 border border-border/25 shadow-sm"
    >
      {userMsg && (
        <div className={assistantMsg ? 'mb-2' : ''}>
          {userMsg.kind === 'receipt' ? (
            <div className="flex justify-end">
              <div className="max-w-[70%] bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-sm overflow-hidden">
                {userMsg.thumbnailDataUrl && (
                  <img src={userMsg.thumbnailDataUrl} alt={userMsg.content} className="w-full max-h-40 object-cover" />
                )}
                <p className="text-xs text-primary px-3 py-1.5 font-medium">{userMsg.content}</p>
              </div>
            </div>
          ) : (
            <MessageBubble message={userMsg} />
          )}
        </div>
      )}

      {userMsg && assistantMsg && <div className="border-t border-border/20 my-2.5" />}

      {assistantMsg && (
        <>
          <MessageBubble message={assistantMsg} />
          {showConfirmButtons && (
            <div className="flex gap-2 mt-3 ml-10">
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-lg bg-income text-white text-sm font-semibold hover:bg-income/90 transition-colors"
              >
                Sí, guardar
              </button>
              <button
                onClick={onModify}
                className="flex-1 py-2.5 rounded-lg bg-muted text-foreground text-sm font-semibold hover:bg-border transition-colors"
              >
                No, modificar
              </button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
