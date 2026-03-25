import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function InternetBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-destructive/90 text-destructive-foreground px-4 py-3 flex items-center gap-2 text-sm">
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span>Sin conexión a internet. Algunas funciones pueden no estar disponibles.</span>
    </div>
  );
}