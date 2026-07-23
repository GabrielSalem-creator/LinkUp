import { useState } from 'react';
import { ChevronRight, ChevronDown, Calendar, MapPin } from 'lucide-react';
import SportBadge from '@/components/shared/SportBadge';
import EmptyState from '@/components/shared/EmptyState';

const sportOrder = ['running', 'biking', 'swimming', 'walking', 'hyrox', 'triathlon', 'crossfit', 'yoga', 'hiking', 'other'];

export default function HistoryTab({ activities }) {
  const [expanded, setExpanded] = useState(null);

  if (activities.length === 0) {
    return <EmptyState title="No history yet" description="Complete events to build your history!" />;
  }

  // Group by sport, sum distances, collect events
  const grouped = {};
  activities.forEach(a => {
    const sport = a.sport || 'other';
    if (!grouped[sport]) grouped[sport] = { sport, total: 0, items: [] };
    grouped[sport].total += a.distance_km || 0;
    grouped[sport].items.push(a);
  });

  const sports = sportOrder.filter(s => grouped[s]);

  return (
    <div className="space-y-2 mt-4">
      {sports.map(sport => {
        const g = grouped[sport];
        const isOpen = expanded === sport;
        return (
          <div key={sport} className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : sport)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <SportBadge sport={sport} size="sm" />
                <span className="font-heading font-bold text-sm">
                  {g.total.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">km total</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-xs">{g.items.length} event{g.items.length !== 1 ? 's' : ''}</span>
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border divide-y divide-border">
                {g.items.map(a => (
                  <div key={a.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {a.notes?.replace('Attended event: ', '') || a.club_name || 'Activity'}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {a.date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {a.date}
                            </span>
                          )}
                          {a.club_name && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {a.club_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-heading font-bold text-primary shrink-0">
                        {a.distance_km} <span className="text-xs font-normal text-muted-foreground">km</span>
                      </span>
                    </div>
                    {a.duration_minutes && (
                      <p className="text-xs text-muted-foreground mt-1">{a.duration_minutes} min</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}