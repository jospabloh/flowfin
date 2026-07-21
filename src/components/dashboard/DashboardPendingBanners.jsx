import { Bell, TrendingUp } from 'lucide-react';
import NotificationBanner from '@/components/NotificationBanner';

export default function DashboardPendingBanners({ pendingScheduled, pendingInvestments, pendingRentals }) {
  return (
    <>
      {pendingScheduled.length > 0 && (
        <div className="mx-4 mb-3">
          <NotificationBanner
            to="/ScheduledPayments"
            variant="warning"
            icon={Bell}
            title={`${pendingScheduled.length} pago${pendingScheduled.length > 1 ? 's' : ''} programado${pendingScheduled.length > 1 ? 's' : ''} pendiente${pendingScheduled.length > 1 ? 's' : ''}`}
            subtitle={`${pendingScheduled.slice(0, 3).map(p => p.name).join(', ')}${pendingScheduled.length > 3 ? '…' : ''}`}
          />
        </div>
      )}

      {pendingInvestments.length > 0 && (
        <div className="mx-4 mb-3">
          <NotificationBanner
            to="/Investments"
            variant="danger"
            icon={TrendingUp}
            title={`${pendingInvestments.length} inversión${pendingInvestments.length > 1 ? 'es' : ''} con pago próximo`}
            subtitle={`${pendingInvestments.slice(0, 3).map(p => p.name).join(', ')}${pendingInvestments.length > 3 ? '…' : ''}`}
          />
        </div>
      )}

      {pendingRentals.length > 0 && (
        <div className="mx-4 mb-4">
          <NotificationBanner
            to="/Rentals"
            variant="info"
            icon="🏠"
            title={`${pendingRentals.length} renta${pendingRentals.length > 1 ? 's' : ''} sin confirmar este mes`}
            subtitle={`${pendingRentals.slice(0, 3).map(p => p.name).join(', ')}${pendingRentals.length > 3 ? '…' : ''}`}
          />
        </div>
      )}
    </>
  );
}
