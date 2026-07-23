import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Footprints, Bike, Waves, PersonStanding, Dumbbell, Mountain, Zap, Loader2, ImagePlus, X, Timer, Route, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const sports = [
  { value: 'running', label: 'Running', icon: Footprints, color: 'border-emerald-500 bg-emerald-500/10 text-emerald-600' },
  { value: 'walking', label: 'Walking', icon: PersonStanding, color: 'border-lime-500 bg-lime-500/10 text-lime-600' },
  { value: 'biking', label: 'Biking', icon: Bike, color: 'border-blue-500 bg-blue-500/10 text-blue-600' },
  { value: 'swimming', label: 'Swimming', icon: Waves, color: 'border-cyan-500 bg-cyan-500/10 text-cyan-600' },
  { value: 'hyrox', label: 'Hyrox', icon: Zap, color: 'border-orange-500 bg-orange-500/10 text-orange-600' },
  { value: 'triathlon', label: 'Triathlon', icon: Footprints, color: 'border-purple-500 bg-purple-500/10 text-purple-600' },
  { value: 'crossfit', label: 'CrossFit', icon: Dumbbell, color: 'border-red-500 bg-red-500/10 text-red-600' },
  { value: 'yoga', label: 'Yoga', icon: PersonStanding, color: 'border-pink-500 bg-pink-500/10 text-pink-600' },
  { value: 'hiking', label: 'Hiking', icon: Mountain, color: 'border-amber-500 bg-amber-500/10 text-amber-600' },
  { value: 'other', label: 'Other', icon: Dumbbell, color: 'border-slate-500 bg-slate-500/10 text-slate-600' },
];

export default function LogActivity() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [sport, setSport] = useState('running');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [clubId, setClubId] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: memberships = [] } = useQuery({
    queryKey: ['my-memberships', user?.email],
    queryFn: () => base44.entities.ClubMembership.filter({ user_email: user.email, status: 'active' }),
    enabled: !!user?.email,
  });

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!distance || !user) return;
    setIsSubmitting(true);

    let photo_url = '';
    if (imageFile) {
      const result = await base44.integrations.Core.UploadFile({ file: imageFile });
      photo_url = result.file_url;
    }

    const selectedClub = memberships.find(m => m.club_id === clubId);

    await base44.entities.Activity.create({
      user_email: user.email,
      user_name: user.full_name,
      sport,
      distance_km: parseFloat(distance),
      duration_minutes: duration ? parseFloat(duration) : undefined,
      date,
      notes,
      photo_url,
      club_id: clubId || undefined,
      club_name: selectedClub?.club_name || undefined,
    });

    // Update user stats
    const newTotal = (user.total_distance_km || 0) + parseFloat(distance);
    const newCount = (user.total_activities || 0) + 1;

    // Streak logic
    let newStreak = user.current_streak || 0;
    const lastDate = user.last_activity_date;
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

    if (!lastDate || lastDate === yesterday || lastDate === today) {
      if (lastDate !== today) newStreak += 1;
    } else {
      newStreak = 1;
    }

    await base44.auth.updateMe({
      total_distance_km: newTotal,
      total_activities: newCount,
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, user.longest_streak || 0),
      last_activity_date: today,
    });

    toast.success('Activity logged!');
    setDistance('');
    setDuration('');
    setNotes('');
    setImageFile(null);
    setImagePreview(null);
    setIsSubmitting(false);
    queryClient.invalidateQueries({ queryKey: ['activities'] });
  };

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-5 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-heading font-bold">Log Activity</h1>
      </div>

      <div className="p-5 space-y-6">
        {/* Sport Selection */}
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">Sport</Label>
          <div className="grid grid-cols-3 gap-2">
            {sports.map(s => {
              const Icon = s.icon;
              const isActive = sport === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => setSport(s.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                    isActive ? s.color : 'border-border bg-card hover:bg-muted'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? '' : 'text-muted-foreground'}`} />
                  <span className={`text-xs font-medium ${isActive ? '' : 'text-muted-foreground'}`}>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Distance & Duration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              <Route className="w-3 h-3 inline mr-1" />Distance (km)
            </Label>
            <Input
              type="number"
              step="0.1"
              placeholder="0.0"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="text-lg font-heading font-bold h-12"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              <Timer className="w-3 h-3 inline mr-1" />Duration (min)
            </Label>
            <Input
              type="number"
              placeholder="0"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="text-lg font-heading font-bold h-12"
            />
          </div>
        </div>

        {/* Date */}
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12" />
        </div>

        {/* Club */}
        {memberships.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Club (optional)</Label>
            <Select value={clubId} onValueChange={setClubId}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select a club" />
              </SelectTrigger>
              <SelectContent>
                {memberships.map(m => (
                  <SelectItem key={m.club_id} value={m.club_id}>{m.club_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Notes */}
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Notes</Label>
          <Textarea
            placeholder="How was your session?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="resize-none"
          />
        </div>

        {/* Photo */}
        {imagePreview ? (
          <div className="relative rounded-2xl overflow-hidden">
            <img src={imagePreview} alt="" className="w-full aspect-video object-cover" />
            <button
              onClick={() => { setImageFile(null); setImagePreview(null); }}
              className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 p-4 border border-dashed border-border rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
            <ImagePlus className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Add a photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </label>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!distance || isSubmitting}
          className="w-full h-12 rounded-full text-base font-semibold"
          size="lg"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
          Log Activity
        </Button>
      </div>
    </div>
  );
}