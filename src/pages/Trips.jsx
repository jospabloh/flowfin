import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { useCatalog } from '@/hooks/useCatalog';
import { Plane, Plus, History } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import TripCard from '@/components/trips/TripCard';
import TripFormModal from '@/components/trips/TripFormModal';
import Spinner from '@/components/Spinner';
import { useFeatureGate } from '@/lib/permissions/useFeatureGate';
import PaywallPrompt from '@/components/billing/PaywallPrompt';

export default function Trips() {
  const { familyId } = useFamily();
  const { persons } = useCatalog(familyId);
  const gate = useFeatureGate('page.Trips');
  const [trips, setTrips] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  const load = async () => {
    if (!familyId) return;
    setLoading(true);
    try {
      const [t, tx] = await Promise.all([
        base44.entities.Trip.filter({ family_id: familyId }),
        base44.entities.Transaction.filter({ family_id: familyId }),
      ]);
      setTrips(t || []);
      setTransactions((tx || []).filter(x => x.trip_id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gate.status !== 'allowed') return;
    load();
  }, [familyId, gate.status]);

  if (gate.status === 'loading') {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (gate.status === 'denied') {
    return (
      <div className="pb-8">
        <PageHeader title="Viajes" subtitle="Viajes y gastos por destino" />
        <PaywallPrompt feature="page.Trips" requiredPlan={gate.requiredPlan} />
      </div>
    );
  }

  const activeTrips = trips.filter(t => t.status === 'active');
  const closedTrips = trips.filter(t => t.status === 'closed');

  const TripsGrid = ({ items }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map(trip => (
        <TripCard
          key={trip.id}
          trip={trip}
          transactions={transactions}
          persons={persons}
          onClick={() => setSelectedTrip(trip)}
        />
      ))}
    </div>
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Viajes"
        subtitle="Viajes y gastos por destino"
        action={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo Viaje
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="px-4 space-y-6">
          {/* Active */}
          {activeTrips.length > 0 ? (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-3">Activos</h2>
              <TripsGrid items={activeTrips} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Plane className="w-8 h-8 text-primary" />
              </div>
              <p className="font-semibold text-foreground mb-1">No tienes viajes activos</p>
              <p className="text-sm text-muted-foreground mb-4">¡Crea uno para empezar a rastrear tus gastos por destino!</p>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Crear mi primer viaje
              </button>
            </div>
          )}

          {/* History */}
          {closedTrips.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-3 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Historial
              </h2>
              <div className="space-y-2">
                {closedTrips.map(trip => (
                  <button
                    key={trip.id}
                    onClick={() => setSelectedTrip(trip)}
                    className="w-full text-left bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-foreground text-sm">{trip.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {trip.destination_countries?.join(', ')} · {trip.start_date} — {trip.end_date}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">Cerrado</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <TripFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {selectedTrip && (
        <TripDetailModalLazy
          trip={selectedTrip}
          transactions={transactions}
          persons={persons}
          onClose={() => setSelectedTrip(null)}
          onTripUpdated={load}
        />
      )}
    </div>
  );
}

// Lazy-loaded detail modal to avoid circular deps at module init
function TripDetailModalLazy(props) {
  const [Modal, setModal] = useState(null);
  useEffect(() => {
    import('@/components/trips/TripDetailModal').then(m => setModal(() => m.default));
  }, []);
  if (!Modal) return null;
  return <Modal {...props} />;
}
