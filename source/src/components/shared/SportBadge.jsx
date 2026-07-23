import { Bike, Footprints, Waves, PersonStanding, Dumbbell, Mountain, Zap } from 'lucide-react';

const sportConfig = {
  running: { icon: Footprints, label: 'Running', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  walking: { icon: PersonStanding, label: 'Walking', color: 'bg-lime-500/10 text-lime-600 border-lime-500/20' },
  biking: { icon: Bike, label: 'Biking', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  swimming: { icon: Waves, label: 'Swimming', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' },
  hyrox: { icon: Zap, label: 'Hyrox', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  triathlon: { icon: Footprints, label: 'Triathlon', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  crossfit: { icon: Dumbbell, label: 'CrossFit', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  yoga: { icon: PersonStanding, label: 'Yoga', color: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
  hiking: { icon: Mountain, label: 'Hiking', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  other: { icon: Dumbbell, label: 'Other', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
};

export default function SportBadge({ sport, size = 'sm' }) {
  const config = sportConfig[sport];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 border rounded-full font-medium ${config.color} ${
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
    }`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {config.label}
    </span>
  );
}