import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { ShieldAlert } from 'lucide-react';

export default function SessionExpiredDialog({ open }) {
  const handleLogin = () => base44.auth.redirectToLogin();
  const handleLogout = () => base44.auth.logout();

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-sm mx-auto" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center justify-center mb-3">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-destructive" />
            </div>
          </div>
          <DialogTitle className="text-center">Sesión expirada</DialogTitle>
          <DialogDescription className="text-center">
            Tu sesión ha expirado por inactividad. Vuelve a iniciar sesión para continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={handleLogin} className="w-full">
            Volver a iniciar sesión
          </Button>
          <Button variant="outline" onClick={handleLogout} className="w-full">
            Cerrar sesión completamente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}