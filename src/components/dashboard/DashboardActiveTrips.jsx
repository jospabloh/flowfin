import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { useCatalog } from '@/hooks/useCatalog';
import TripCard from '@/components/trips/TripCard';
import { useNavigate } from 'react-router-dom';

export default function DashboardActiveTrips() {
  const { familyId } = useFamily();
  const { persons } = useCatalog(familyId);
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [Modal, setModal] = useState(null);

  useEffect(() => {
    if (!familyId) return;
    Promise.all([
      base44.entities.Trip.filter({ family_id: familyId }),
      base44.entities.Transaction.filter({ family_id: familyId }),
    ]).then(([t, tx]) => {
      const active = (t || []).filter(x => x.status === 'active' || x.status === 'planned');
      setTrips(active);
      setTransactions((tx || []).filter(x => x.trip_id));
    }).catch(() => {});
  }, [familyId]);

  useEffect(() => {
    if (selectedTrip) {
      import('@/components/trips/TripDetailModal').then(m => setModal(() => m.default));
    }
  }, [selectedTrip]);

  if (trips.length === 0) return null;

  return (
    <>
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Viajes Activos</h2>
          <button
            onClick={() => navigate('/Trips')}
            className="text-xs text-primary font-medium hover:underline"
          >
            Ver todos
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {trips.map(trip => (
            <TripCard
              key={trip.id}
              trip={trip}
              transactions={transactions}
              persons={persons}
              onClick={() => setSelectedTrip(trip)}
            />
          ))}
        </div>
      </div>

      {selectedTrip && Modal && (
        <Modal
          trip={selectedTrip}
          transactions={transactions}
          persons={persons}
          onClose={() => { setSelectedTrip(null); setModal(null); }}
          onTripUpdated={() => {
            base44.entities.Trip.filter({ family_id: familyId }).then(t => {
              setTrips((t || []).filter(x => x.status === 'active' || x.status === 'planned'));
            });
          }}
        />
      )}
    </>
  );
}
