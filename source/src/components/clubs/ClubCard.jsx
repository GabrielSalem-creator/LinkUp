import { Link } from 'react-router-dom';
import { Users, CheckCircle } from 'lucide-react';
import SportBadge from '../shared/SportBadge';

export default function ClubCard({ club }) {
  return (
    <Link
      to={`/clubs/${club.id}`}
      className="block bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
    >
      <div className="relative h-28">
        <img
          src={club.cover_url || `https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&q=80`}
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-heading font-bold text-white text-sm">{club.name}</h3>
              {club.is_verified && <CheckCircle className="w-3.5 h-3.5 text-primary fill-primary/20" />}
            </div>
            <p className="text-white/70 text-xs">{club.city}</p>
          </div>
        </div>
      </div>
      <div className="p-3 flex items-center justify-between">
        <SportBadge sport={club.sport} size="sm" />
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          {club.member_count || 0}
        </div>
      </div>
    </Link>
  );
}