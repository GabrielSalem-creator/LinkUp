import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Trash2, Calendar, X } from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '@/components/shared/EmptyState';

export default function ClubPortalEvents({ club }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', date: '', time: '', meeting_point: '', distance_km: '', sport: club.sport, attendance_password: '', max_participants: '' });
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ['portal-events', club.id],
    queryFn: () => base44.entities.ClubEvent.filter({ club_id: club.id }, '-date', 20),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.title || !form.date) return;
    setIsSaving(true);
    await base44.entities.ClubEvent.create({
      ...form,
      distance_km: form.distance_km ? parseFloat(form.distance_km) : undefined,
      max_participants: form.max_participants ? parseInt(form.max_participants) : undefined,
      club_id: club.id,
      club_name: club.name,
    });
    toast.success('Event created!');
    setForm({ title: '', description: '', date: '', time: '', meeting_point: '', distance_km: '', sport: club.sport, attendance_password: '', max_participants: '' });
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['portal-events', club.id] });
    queryClient.invalidateQueries({ queryKey: ['club-events', club.id] });
    setIsSaving(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.ClubEvent.delete(id);
    toast.success('Event deleted');
    queryClient.invalidateQueries({ queryKey: ['portal-events', club.id] });
  };

  return (
    <div className="space-y-4">
      {!showForm ? (
        <Button className="w-full rounded-full" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Event
        </Button>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-sm">New Event</h3>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input placeholder="e.g. Saturday Morning Run" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Time</Label>
              <Input placeholder="6:30 AM" value={form.time} onChange={e => set('time', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Meeting Point</Label>
            <Input placeholder="e.g. Raouche Rock, Beirut" value={form.meeting_point} onChange={e => set('meeting_point', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Distance (km)</Label>
              <Input type="number" placeholder="10" value={form.distance_km} onChange={e => set('distance_km', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Sport</Label>
              <Select value={form.sport} onValueChange={v => set('sport', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="walking">Walking</SelectItem>
                  <SelectItem value="biking">Biking</SelectItem>
                  <SelectItem value="swimming">Swimming</SelectItem>
                  <SelectItem value="hyrox">Hyrox</SelectItem>
                  <SelectItem value="triathlon">Triathlon</SelectItem>
                  <SelectItem value="crossfit">CrossFit</SelectItem>
                  <SelectItem value="yoga">Yoga</SelectItem>
                  <SelectItem value="hiking">Hiking</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Max Participants <span className="text-muted-foreground text-[10px]">(optional)</span></Label>
            <Input type="number" placeholder="e.g. 30 (leave empty for unlimited)" value={form.max_participants} onChange={e => set('max_participants', e.target.value)} min="1" />
          </div>
          <div className="space-y-1">
            <Label>Attendance Password <span className="text-destructive">*</span></Label>
            <Input
              placeholder="Min 4 characters (shared after event)"
              value={form.attendance_password}
              onChange={e => set('attendance_password', e.target.value)}
              maxLength={20}
            />
            <p className="text-[10px] text-muted-foreground">Share this password with participants after the event to confirm attendance.</p>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} className="resize-none h-16" placeholder="Additional details..." />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="rounded-full flex-1" onClick={handleCreate} disabled={!form.title || !form.date || !form.attendance_password || form.attendance_password.length < 4 || isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create
            </Button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState icon={Calendar} title="No events yet" description="Create your first club event" />
      ) : (
        events.map(event => (
          <div key={event.id} className="bg-card border border-border rounded-2xl p-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm">{event.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{event.date}{event.time ? ` · ${event.time}` : ''}</p>
              {event.meeting_point && <p className="text-xs text-muted-foreground">📍 {event.meeting_point}</p>}
              {event.distance_km && <p className="text-xs text-primary font-medium mt-1">{event.distance_km} km</p>}
              {event.max_participants && (
                <p className="text-xs text-muted-foreground mt-1">👥 Limit: <span className="font-semibold text-foreground">{event.max_participants} participants</span></p>
              )}
              {event.attendance_password && (
                <p className="text-xs text-muted-foreground mt-1">🔑 Password: <span className="font-mono font-bold text-foreground">{event.attendance_password}</span></p>
              )}
            </div>
            <button onClick={() => handleDelete(event.id)} className="text-muted-foreground hover:text-destructive p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}