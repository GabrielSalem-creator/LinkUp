import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Calendar, SlidersHorizontal, MapPin, Clock, Users, ChevronRight, Bell, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { format, addDays, startOfWeek, endOfWeek, isToday, isTomorrow, parseISO, isSameDay } from 'date-fns';
import EventCard from '@/components/events/EventCard';
import EventFiltersOverlay from '@/components/events/EventFiltersOverlay';
import EventCalendarPicker from '@/components/events/EventCalendarPicker';

const SPORTS = ['Running', 'Walking', 'Biking', 'Swimming', 'Hyrox', 'Triathlon', 'CrossFit', 'Yoga', 'Hiking', 'Other'];

function getDayLabel(dateStr) {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return format(d, 'EEEE, MMM d');
  return format(d, 'EEEE, MMM d');
}

function getDayShortLabel(dateStr) {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEE, MMM d');
}

function toDateStr(date) {
  return format(date, 'yyyy-MM-dd');
}

export default function Events() {
  const [user, setUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [focusDate, setFocusDate] = useState(toDateStr(new Date()));
  const [visibleDate, setVisibleDate] = useState(toDateStr(new Date()));
  const [filters, setFilters] = useState({ sports: [], cities: [], timeFrom: 0, timeTo: 24, capacityMin: 0, capacityMax: 999 });
  const dayRefs = useRef({});
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    base44.entities.Friendship.filter({ addressee_email: user.email, status: 'pending' }).then(r => setPendingCount(r.length));
  }, [user]);

  // Generate 30 days from focusDate
  const days = Array.from({ length: 30 }, (_, i) => toDateStr(addDays(parseISO(focusDate), i)));

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['all-events-feed'],
    queryFn: () => base44.entities.ClubEvent.list('date', 200),
  });

  const { data: clubs = [] } = useQuery({
    queryKey: ['all-clubs-for-events'],
    queryFn: () => base44.entities.Club.list('name', 200),
  });

  const clubMap = Object.fromEntries(clubs.map(c => [c.id, c]));

  // Filter events
  const filteredEvents = events.filter(ev => {
    if (filters.sports.length > 0) {
      const evSport = (ev.sport || '').toLowerCase();
      if (!filters.sports.some(s => s.toLowerCase() === evSport)) return false;
    }
    if (filters.cities.length > 0) {
      const club = clubMap[ev.club_id];
      if (!club || !filters.cities.includes(club.city)) return false;
    }
    if (ev.time) {
      const [h] = ev.time.split(':').map(Number);
      const hour = isNaN(h) ? 12 : h;
      if (hour < filters.timeFrom || hour > filters.timeTo) return false;
    }
    if (filters.capacityMax < 999 && ev.max_participants) {
      if (ev.max_participants < filters.capacityMin || ev.max_participants > filters.capacityMax) return false;
    }
    return true;
  });

  // Group by date
  const eventsByDay = {};
  filteredEvents.forEach(ev => {
    if (!ev.date) return;
    if (!eventsByDay[ev.date]) eventsByDay[ev.date] = [];
    eventsByDay[ev.date].push(ev);
  });

  // Only days that have events OR are in our window
  const daysWithEvents = days.filter(d => eventsByDay[d]?.length > 0);

  // Scroll to a day
  const scrollToDay = useCallback((dateStr) => {
    const el = dayRefs.current[dateStr];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFocusDate(dateStr);
  }, []);

  // Observe visible day for sticky header
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const date = entry.target.dataset.date;
            if (date) setVisibleDate(date);
          }
        });
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 }
    );
    Object.values(dayRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [daysWithEvents.length]);

  const allCities = [...new Set(clubs.map(c => c.city).filter(Boolean))];
  const activeFilterCount = filters.sports.length + filters.cities.length + (filters.timeFrom > 0 || filters.timeTo < 24 ? 1 : 0);

  return (
    <div className="min-h-screen">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-bold text-lg">
              {getDayShortLabel(visibleDate)}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Pending requests bell */}
            <Link to="/people" className="relative">
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                <Bell className="w-4 h-4" />
                {pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 relative" onClick={() => setShowFilters(true)}>
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" onClick={() => setShowCalendar(true)}>
              <Calendar className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Events Feed */}
      <div className="pb-24" ref={scrollContainerRef}>
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : daysWithEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-heading font-semibold">No events found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or check back later.</p>
          </div>
        ) : (
          daysWithEvents.map(dateStr => (
            <div key={dateStr} ref={el => dayRefs.current[dateStr] = el} data-date={dateStr}>
              {/* Day separator */}
              <div className="sticky top-14 z-30 bg-background/90 backdrop-blur-sm border-b border-border/50 px-4 py-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {getDayLabel(dateStr)}
                </span>
              </div>

              {/* Events for this day */}
              <div className="px-4 py-3 space-y-3">
                {(eventsByDay[dateStr] || []).map(ev => (
                  <EventCard key={ev.id} event={ev} club={clubMap[ev.club_id]} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Calendar Picker */}
      {showCalendar && (
        <EventCalendarPicker
          onClose={() => setShowCalendar(false)}
          onSelectDate={(d) => { setFocusDate(toDateStr(d)); scrollToDay(toDateStr(d)); setShowCalendar(false); }}
        />
      )}

      {/* Filters Overlay */}
      {showFilters && (
        <EventFiltersOverlay
          filters={filters}
          onApply={(f) => { setFilters(f); setShowFilters(false); }}
          onClose={() => setShowFilters(false)}
          availableCities={allCities}
          sports={SPORTS}
        />
      )}
    </div>
  );
}