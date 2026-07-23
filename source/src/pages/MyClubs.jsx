import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin, Calendar, ChevronRight, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SportBadge from '@/components/shared/SportBadge';
import EmptyState from '@/components/shared/EmptyState';
import { format, parseISO, isAfter } from 'date-fns';

const SPORT_ORDER = ['running', 'walking', 'biking', 'swimming', 'hyrox', 'triathlon', 'crossfit', 'yoga', 'hiking', 'other'];

function groupByCategory(clubs) {
  const groups = {};
  clubs.forEach(c => {
    const sport = c.sport || 'other';
    if (!groups[sport]) groups[sport] = [];
    groups[sport].push(c);
  });
  return Object.entries(groups).sort(([a], [b]) => {
    return SPORT_ORDER.indexOf(a) - SPORT_ORDER.indexOf(b);
  });
}

export default function MyClubs() {
  const [user, setUser] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: memberships = [], isLoading: loadingMemberships } = useQuery({
    queryKey: ['my-clubs-member', user?.email],
    queryFn: () => base44.entities.ClubMembership.filter({ user_email: user.email, status: 'active' }),
    enabled: !!user?.email,
  });

  const clubIds = memberships.map(m => m.club_id);

  const { data: allClubs = [], isLoading: loadingClubs } = useQuery({
    queryKey: ['clubs-for-myclubs'],
    queryFn: () => base44.entities.Club.list('name', 200),
    enabled: clubIds.length > 0,
  });

  const myClubs = allClubs.filter(c => clubIds.includes(c.id));

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ['upcoming-events-myclubs'],
    queryFn: () => base44.entities.ClubEvent.list('date', 100),
    enabled: clubIds.length > 0,
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  const eventsByClub = {};
  upcomingEvents
    .filter(ev => ev.date >= today)
    .forEach(ev => {
      if (!eventsByClub[ev.club_id]) eventsByClub[ev.club_id] = [];
      eventsByClub[ev.club_id].push(ev);
    });

  const isLoading = loadingMemberships || loadingClubs;
  const grouped = groupByCategory(myClubs);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="font-heading font-bold text-lg">My Clubs</h1>
          <Link to="/clubs">
            <Button variant="ghost" size="sm" className="rounded-full gap-1.5 text-xs">
              <Search className="w-3.5 h-3.5" /> Explore
            </Button>
          </Link>
        </div>
      </div>

      <div className="pb-24">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : myClubs.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No clubs yet"
            description="Join clubs to see them here and stay updated with their events."
            action={
              <Link to="/clubs">
                <Button className="rounded-full">Explore Clubs</Button>
              </Link>
            }
          />
        ) : (
          <div className="px-4 pt-4 space-y-6">
            {grouped.map(([sport, clubs]) => (
              <div key={sport}>
                {/* Category Header */}
                <div className="flex items-center gap-2 mb-3">
                  <SportBadge sport={sport} size="sm" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {clubs.length} club{clubs.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Club Cards */}
                <div className="space-y-3">
                  {clubs.map(club => (
                    <ClubCard key={club.id} club={club} events={eventsByClub[club.id] || []} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClubCard({ club, events }) {
  const nextEvents = events.slice(0, 2);

  return (
    <Link to={`/clubs/${club.id}`} className="block group">
      <div className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all active:scale-[0.99] duration-200">
        {/* Cover Image */}
        <div className="relative h-28 bg-muted overflow-hidden">
          {club.cover_url ? (
            <img src={club.cover_url} alt={club.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

          {/* Club logo + name overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="flex items-center gap-2">
              {club.logo_url ? (
                <img src={club.logo_url} alt={club.name} className="w-9 h-9 rounded-xl object-cover border-2 border-white/20 shadow" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center border-2 border-white/20">
                  <span className="text-white font-bold text-sm">{club.name[0]}</span>
                </div>
              )}
              <div>
                <h3 className="text-white font-heading font-bold text-sm leading-tight drop-shadow">{club.name}</h3>
                {club.is_verified && (
                  <span className="text-white/70 text-[9px]">✓ Verified</span>
                )}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/70" />
          </div>
        </div>

        {/* Info Section */}
        <div className="p-3">
          {/* Location */}
          <div className="flex items-center gap-3 mb-2.5">
            {club.city && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {club.city}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {club.member_count || 0} members
            </span>
          </div>

          {/* Upcoming Events */}
          {nextEvents.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Upcoming</p>
              {nextEvents.map(ev => (
                <div key={ev.id} className="flex items-center gap-2 bg-muted rounded-xl px-2.5 py-1.5">
                  <Calendar className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-xs font-medium truncate flex-1">{ev.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{ev.date}</span>
                </div>
              ))}
              {events.length > 2 && (
                <p className="text-[10px] text-primary text-right">+{events.length - 2} more</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No upcoming events</p>
          )}
        </div>
      </div>
    </Link>
  );
}