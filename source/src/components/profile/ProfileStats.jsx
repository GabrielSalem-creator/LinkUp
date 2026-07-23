import { Route, Flame, Activity, Award } from 'lucide-react';
import StatCard from '../shared/StatCard';

export default function ProfileStats({ user }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        icon={Route}
        label="Total Distance"
        value={(user.total_distance_km || 0).toFixed(1)}
        unit="km"
      />
      <StatCard
        icon={Activity}
        label="Activities"
        value={user.total_activities || 0}
      />
      <StatCard
        icon={Flame}
        label="Current Streak"
        value={user.current_streak || 0}
        unit="days"
      />
      <StatCard
        icon={Award}
        label="Best Streak"
        value={user.longest_streak || 0}
        unit="days"
      />
    </div>
  );
}