import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ClubCard from '@/components/clubs/ClubCard';
import EmptyState from '@/components/shared/EmptyState';

const sportFilters = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'walking', label: 'Walking' },
  { value: 'biking', label: 'Biking' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'hyrox', label: 'Hyrox' },
  { value: 'triathlon', label: 'Triathlon' },
  { value: 'crossfit', label: 'CrossFit' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'hiking', label: 'Hiking' },
  { value: 'other', label: 'Other' },
];

export default function Clubs() {
  const [search, setSearch] = useState('');
  const [activeSport, setActiveSport] = useState('all');

  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => base44.entities.Club.list('-created_date', 100),
  });

  const filtered = clubs.filter(club => {
    const matchesSport = activeSport === 'all' || club.sport === activeSport;
    const matchesSearch = !search || 
      club.name.toLowerCase().includes(search.toLowerCase()) ||
      club.city?.toLowerCase().includes(search.toLowerCase());
    return matchesSport && matchesSearch;
  });

  // Group by city
  const groupedByCity = filtered.reduce((acc, club) => {
    const city = club.city || 'Other';
    if (!acc[city]) acc[city] = [];
    acc[city].push(club);
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-5 pt-4 pb-3 space-y-3">
        <h1 className="text-xl font-heading font-bold">Discover Clubs</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clubs or cities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full bg-muted border-0"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {sportFilters.map(f => (
            <button
              key={f.value}
              onClick={() => setActiveSport(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeSport === f.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : Object.keys(groupedByCity).length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No clubs found"
            description="Try adjusting your search or filters"
          />
        ) : (
          Object.entries(groupedByCity).map(([city, cityClubs]) => (
            <div key={city} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-primary" />
                <h2 className="font-heading font-semibold text-foreground">{city}</h2>
                <span className="text-xs text-muted-foreground">({cityClubs.length})</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {cityClubs.map(club => (
                  <ClubCard key={club.id} club={club} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}