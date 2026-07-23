import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Footprints, Bike, Waves, PersonStanding, Zap, Dumbbell, Mountain } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const sports = [
  { value: 'running_walking', label: 'Running / Walking', icon: Footprints, desc: 'Counts running & walking activities' },
  { value: 'biking', label: 'Biking', icon: Bike, desc: 'Counts cycling activities' },
  { value: 'swimming', label: 'Swimming', icon: Waves, desc: 'Counts swimming activities' },
  { value: 'hyrox', label: 'Hyrox', icon: Zap, desc: 'Counts Hyrox activities' },
  { value: 'triathlon', label: 'Triathlon', icon: Footprints, desc: 'Counts triathlon activities' },
  { value: 'crossfit', label: 'CrossFit', icon: Dumbbell, desc: 'Counts CrossFit activities' },
  { value: 'yoga', label: 'Yoga', icon: PersonStanding, desc: 'Counts yoga activities' },
  { value: 'hiking', label: 'Hiking', icon: Mountain, desc: 'Counts hiking activities' },
  { value: 'other', label: 'Other', icon: Dumbbell, desc: 'Counts other activities' },
];

function generateCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function CreateLeagueModal({ open, onClose, user, onCreated }) {
  const [form, setForm] = useState({ name: '', sport: '', description: '', start_date: '', end_date: '' });
  const [loading, setLoading] = useState(false);

  const isValid = form.name && form.sport && form.start_date && form.end_date;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    const invite_code = generateCode();
    const league = await base44.entities.League.create({
      name: form.name,
      sport: form.sport,
      description: form.description,
      start_date: form.start_date,
      end_date: form.end_date,
      created_by: user.email,
      creator_name: user.full_name,
      invite_code,
      status: 'upcoming',
      max_members: 50,
      member_count: 1,
    });
    await base44.entities.LeagueParticipant.create({
      league_id: league.id,
      user_email: user.email,
      user_name: user.full_name,
      total_distance_km: 0,
      total_activities: 0,
    });
    toast.success('League created! Share the invite code with friends.');
    setLoading(false);
    onCreated(league);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Create a League</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">League name</Label>
            <Input placeholder="e.g. Weekend Warriors" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Sport</Label>
            <div className="grid grid-cols-1 gap-2">
              {sports.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.value}
                    onClick={() => setForm(p => ({ ...p, sport: s.value }))}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      form.sport === s.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Start date</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">End date</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Description (optional)</Label>
            <Textarea placeholder="What's this league about?" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="h-20 resize-none" />
          </div>

          <p className="text-xs text-muted-foreground bg-muted rounded-xl p-3">
            Up to <strong>50 members</strong> can join. An invite code will be generated — share it however you like.
          </p>

          <Button className="w-full rounded-full" disabled={!isValid || loading} onClick={handleSubmit}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create League
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}