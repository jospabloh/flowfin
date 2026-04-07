import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const APP_BUILD_VERSION = '2.9.0';
const DISMISSED_VERSION_KEY = 'dismissedAppVersion';

export default function AppUpdateBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const autoHideRef = useRef(null);

  const { data: appVersionData } = useQuery({
    queryKey: ['appVersion'],
    queryFn: async () => {
      const response = await base44.entities.AppVersion.list();
      return response?.[0];
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!appVersionData) return;

    const serverVersion = appVersionData.version;

    // If client is already on the latest version, auto-dismiss and never show
    if (serverVersion === APP_BUILD_VERSION) {
      localStorage.setItem(DISMISSED_VERSION_KEY, serverVersion);
      setIsVisible(false);
      return;
    }

    const dismissedVersion = localStorage.getItem(DISMISSED_VERSION_KEY);
    const notDismissed = serverVersion !== dismissedVersion;

    if (notDismissed) {
      setIsVisible(true);
      autoHideRef.current = setTimeout(() => setIsVisible(false), 5000);
    }
    return () => { if (autoHideRef.current) clearTimeout(autoHideRef.current); };
  }, [appVersionData?.version]);

  const handleDismiss = () => {
    if (appVersionData?.version) {
      localStorage.setItem(DISMISSED_VERSION_KEY, appVersionData.version);
    }
    setIsVisible(false);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground shadow-lg"
        >
          <div className="max-w-full px-4 py-3 sm:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <p className="text-xs sm:text-sm font-medium truncate">
                Nueva versión disponible. Actualiza para obtener las últimas mejoras.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleRefresh}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-md text-xs sm:text-sm font-semibold transition-colors active:bg-white/40"
              >
                Actualizar
              </button>
              <button
                onClick={handleDismiss}
                className="p-1.5 hover:bg-white/20 rounded-md transition-colors active:bg-white/30"
                aria-label="Descartar notificación"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}