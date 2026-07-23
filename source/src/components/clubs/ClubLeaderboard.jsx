import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trophy, Medal, Loader2 } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';

const rankBadge = (index) => {
  if (index === 0) return <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center"><Trophy className="w-4 h-4 text-amber-500" /></div>;
  if (index === 1) return <div className="w-8 h-8 rounded-full bg-slate-400/20 flex items-center justify-center"><Medal className="w-4 h-4 text-slate-400" /></div>;
  if (index === 2) return <div className="w-8 h-8 rounded-full bg-amber-700/20 flex items-center justify-center"><Medal className="w-4 h-4 text-amber-700" /></div>;
  return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{index + 1}</div>;
};

export default function ClubLeaderboard({ clubId, currentUserEmail }) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['club-activities', clubId],
    queryFn: () => base44.entities.Activity.filter({ club_id: clubId }, '-date', 200),
    enabled: !!clubId,
  });

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  // Aggregate by user
  const userMap = {};
  activities.forEach(a => {
    const key = a.user_email;
    if (!userMap[key]) {
      userMap[key] = { email: key, name: a.user_name || a.user_email?.split('@')[0], total_km: 0, total_activities: 0 };
    }
    userMap[key].total_km += a.distance_km || 0;
    userMap[key].total_activities += 1;
  });

  const ranked = Object.values(userMap).sort((a, b) => b.total_km - a.total_km);

  if (ranked.length === 0) {
    return <EmptyState icon={Trophy} title="No activity yet" description="Log activities linked to this club to appear on the leaderboard!" />;
  }

  return (
    <div className="space-y-2 mt-4">
      <p className="text-xs text-muted-foreground mb-3">Ranked by total km logged for this club</p>
      {ranked.map((p, i) => (
        <div key={p.email} className={`flex items-center gap-3 p-3 rounded-2xl border ${
          i === 0 ? 'border-amber-500/30 bg-amber-500/5' :
          p.email === currentUserEmail ? 'border-primary/30 bg-primary/5' :
          'border-border bg-card'
        }`}>
          {rankBadge(i)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {p.name}
              {p.email === currentUserEmail && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">You</span>}
            </p>
            <p className="text-xs text-muted-foreground">{p.total_activities} activities</p>
          </div>
          <div className="text-right">
            <p className="font-heading font-bold text-sm">{p.total_km.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">km</p>
          </div>
        </div>
      ))}
    </div>
  );
}