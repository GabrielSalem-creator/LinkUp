import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Calendar, Lock, Loader2, CheckCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, isPast, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';

export default function EventsCalendar({ events = [], user, onEventConfirmed }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [confirmingEvent, setConfirmingEvent] = useState(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = startOfMonth(currentMonth).getDay();

  const [selectedDay, setSelectedDay] = useState(null);

  const getEventsForDay = (day) =>
    events.filter(e => e.event_date && isSameDay(parseISO(e.event_date), day));

  const handleConfirmAttendance = async () => {
    if (!confirmingEvent || password.length < 4) return;
    setLoading(true);

    // Fetch the original ClubEvent to check password
    const clubEvents = await base44.entities.ClubEvent.filter({ id: confirmingEvent.event_id });
    const clubEvent = clubEvents[0];

    if (!clubEvent || clubEvent.attendance_password !== password.trim()) {
      toast.error('Incorrect password. Ask the event creator for it.');
      setLoading(false);
      return;
    }

    // Create activity from event
    const activityData = {
      user_email: user.email,
      user_name: user.full_name,
      club_id: confirmingEvent.club_id,
      club_name: confirmingEvent.club_name,
      sport: confirmingEvent.sport || clubEvent.sport,
      distance_km: confirmingEvent.distance_km || clubEvent.distance_km || 0,
      duration_minutes: null,
      date: confirmingEvent.event_date,
      notes: `Attended event: ${confirmingEvent.event_title}`,
    };

    await base44.entities.Activity.create(activityData);

    // Update user stats
    const currentStats = {
      total_distance_km: (user.total_distance_km || 0) + (activityData.distance_km || 0),
      total_activities: (user.total_activities || 0) + 1,
    };
    await base44.auth.updateMe(currentStats);

    // Delete the event participant record
    await base44.entities.EventParticipant.delete(confirmingEvent.id);

    toast.success('Attendance confirmed! Activity added to your profile 🎉');
    queryClient.invalidateQueries({ queryKey: ['my-upcoming-events'] });
    queryClient.invalidateQueries({ queryKey: ['my-activities'] });

    setConfirmingEvent(null);
    setPassword('');
    setLoading(false);
    if (onEventConfirmed) onEventConfirmed();
  };

  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1.5 rounded-full hover:bg-muted">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="font-heading font-semibold text-sm">{format(currentMonth, 'MMMM yyyy')}</h3>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1.5 rounded-full hover:bg-muted">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
        {days.map(day => {
          const dayEvents = getEventsForDay(day);
          const hasEvents = dayEvents.length > 0;
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className="flex flex-col items-center py-1"
            >
              <div className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium transition-colors
                ${isSelected ? 'bg-accent text-accent-foreground' : ''}
                ${isToday && !isSelected ? 'bg-primary text-primary-foreground' : ''}
                ${hasEvents && !isToday && !isSelected ? 'font-bold text-foreground' : ''}
                ${!hasEvents && !isToday && !isSelected ? 'text-muted-foreground' : ''}
              `}>
                {format(day, 'd')}
              </div>
              {hasEvents && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((_, i) => (
                    <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-accent' : 'bg-accent'}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Event list */}
      <div className="mt-2 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {selectedDay ? format(selectedDay, 'MMMM d') : 'My Events'}
          </p>
          {selectedDay && (
            <button onClick={() => setSelectedDay(null)} className="text-xs text-primary hover:underline">
              Show all
            </button>
          )}
        </div>
        {(() => {
          const visibleEvents = selectedDay ? events.filter(e => e.event_date && isSameDay(parseISO(e.event_date), selectedDay)) : events;
          return visibleEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
              {selectedDay ? 'No events on this day.' : 'No upcoming events. Join club events to see them here!'}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleEvents.map(e => {
                const eventPast = e.event_date && isPast(parseISO(e.event_date));
                return (
                  <div key={e.id} className={`bg-card border rounded-2xl overflow-hidden ${eventPast ? 'border-accent/40' : 'border-border'}`}>
                    {eventPast && (
                      <div className="bg-accent/10 px-4 pt-2 pb-0">
                        <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">Past · Confirm attendance</span>
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-heading font-semibold text-sm leading-tight">{e.event_title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{e.club_name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {e.event_date}{e.event_time ? ` · ${e.event_time}` : ''}
                            </span>
                            {e.meeting_point && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                📍 {e.meeting_point}
                              </span>
                            )}
                            {e.distance_km && (
                              <span className="text-xs text-muted-foreground font-medium">{e.distance_km} km</span>
                            )}
                          </div>
                        </div>
                        {eventPast && (
                          <button
                            onClick={() => { setConfirmingEvent(e); setPassword(''); }}
                            className="flex items-center gap-1 text-xs bg-accent text-accent-foreground px-3 py-1.5 rounded-full font-medium shrink-0"
                          >
                            <Lock className="w-3 h-3" /> Confirm
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Confirm attendance modal */}
      {confirmingEvent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-8">
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-bold">Confirm Attendance</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter the password shared by the event creator to confirm you attended <strong>{confirmingEvent.event_title}</strong>.
            </p>
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter event password..."
              className="w-full h-10 px-3 rounded-xl border border-input bg-muted text-sm font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-ring uppercase"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              Confirming will convert this event into an activity on your profile.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingEvent(null)}
                className="flex-1 h-9 rounded-full border border-border text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAttendance}
                disabled={password.length < 4 || loading}
                className="flex-1 h-9 rounded-full bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}