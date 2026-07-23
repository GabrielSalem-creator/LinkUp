import { MapPin, Clock, Users, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SportBadge from '@/components/shared/SportBadge';

export default function EventCard({ event, club }) {
  const hasImage = event.cover_url || club?.cover_url || club?.logo_url;

  return (
    <Link to={`/clubs/${event.club_id}`} className="block">
      <div className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-all active:scale-[0.99]">
        {/* Cover Image */}
        {hasImage && (
          <div className="relative h-36 overflow-hidden">
            <img
              src={event.cover_url || club?.cover_url || club?.logo_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            {/* Club branding overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {club?.logo_url && !event.cover_url && (
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <img src={club.logo_url} alt={club.name} className="w-7 h-7 rounded-full object-cover border-2 border-white/30" />
                <span className="text-white text-xs font-semibold drop-shadow">{club?.name}</span>
              </div>
            )}
            {event.cover_url && club?.logo_url && (
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <img src={club.logo_url} alt={club.name} className="w-7 h-7 rounded-full object-cover border-2 border-white/30" />
                <span className="text-white text-xs font-semibold drop-shadow">{club?.name}</span>
              </div>
            )}
          </div>
        )}

        <div className="p-3.5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              {!hasImage && club && (
                <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{club.name}</p>
              )}
              <h3 className="font-heading font-semibold text-sm leading-tight">{event.title}</h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {event.sport && <SportBadge sport={event.sport} size="sm" />}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {event.time && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {event.time}
              </span>
            )}
            {event.meeting_point && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[140px]">{event.meeting_point}</span>
              </span>
            )}
            {event.max_participants && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                {event.max_participants} spots
              </span>
            )}
            {event.distance_km && (
              <span className="text-xs text-muted-foreground font-medium">
                {event.distance_km} km
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}