import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ImagePlus, Loader2, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

export default function MemoriesTab({ user, completedEvents }) {
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState('');
  const queryClient = useQueryClient();

  const { data: memories = [] } = useQuery({
    queryKey: ['my-memories', user?.email],
    queryFn: () => base44.entities.Memory.filter({ user_email: user.email }, '-created_date', 50),
    enabled: !!user?.email,
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });

    const ev = completedEvents.find(e => e.id === selectedEvent);
    await base44.entities.Memory.create({
      user_email: user.email,
      photo_url: file_url,
      event_id: ev?.id || undefined,
      event_title: ev?.notes?.replace('Attended event: ', '') || ev?.club_name || undefined,
      event_date: ev?.date || undefined,
      club_name: ev?.club_name || undefined,
      sport: ev?.sport || undefined,
    });

    toast.success('Memory saved!');
    queryClient.invalidateQueries({ queryKey: ['my-memories'] });
    setShowForm(false);
    setSelectedFile(null);
    setPreview(null);
    setSelectedEvent('');
    setUploading(false);
  };

  return (
    <div className="mt-4 space-y-4">
      <Button
        variant="outline"
        size="sm"
        className="w-full rounded-full border-dashed"
        onClick={() => setShowForm(v => !v)}
      >
        <Camera className="w-4 h-4 mr-2" /> Add a Memory
      </Button>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          {preview ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={preview} alt="" className="w-full aspect-video object-cover" />
              <button
                onClick={() => { setSelectedFile(null); setPreview(null); }}
                className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
              <ImagePlus className="w-7 h-7 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tap to choose a photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          )}

          {completedEvents.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Link to a completed event (optional)</p>
              <select
                value={selectedEvent}
                onChange={e => setSelectedEvent(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">No event</option>
                {completedEvents.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.notes?.replace('Attended event: ', '') || e.club_name} · {e.date}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full rounded-full"
            size="sm"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Memory
          </Button>
        </div>
      )}

      {memories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No memories yet.</p>
          <p className="text-xs mt-1 opacity-70">Add photos from your events to keep them alive.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {memories.map(m => (
            <MemoryCard key={m.id} memory={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryCard({ memory }) {
  const dateStr = memory.event_date
    ? (() => { try { return format(parseISO(memory.event_date), 'MMM d, yyyy'); } catch { return memory.event_date; } })()
    : format(new Date(memory.created_date), 'MMM d, yyyy');

  return (
    <div className="relative rounded-2xl overflow-hidden aspect-[3/4] group">
      <img src={memory.photo_url} alt="" className="w-full h-full object-cover" />
      {/* Travel card overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {memory.event_title && (
          <p className="text-white text-xs font-semibold leading-tight drop-shadow line-clamp-2">
            {memory.event_title}
          </p>
        )}
        <p className="text-white/80 text-[10px] mt-0.5 drop-shadow">{dateStr}</p>
        {memory.club_name && (
          <p className="text-white/60 text-[10px] drop-shadow">{memory.club_name}</p>
        )}
      </div>
    </div>
  );
}