import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

const CITIES = ['Beirut', 'Tripoli', 'Sidon', 'Tyre', 'Jounieh', 'Jbeil', 'Zahle', 'Batroun', 'Aley'];

export default function ClubPortalSettings({ club, onUpdated }) {
  const [form, setForm] = useState({
    name: club.name || '',
    description: club.description || '',
    city: club.city || '',
    sport: club.sport || '',
    instagram_link: club.instagram_link || '',
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(club.cover_url || null);
  const [isSaving, setIsSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCover = (e) => {
    const file = e.target.files?.[0];
    if (file) { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); }
  };

  const handleSave = async () => {
    setIsSaving(true);
    let cover_url = club.cover_url;
    if (coverFile) {
      const res = await base44.integrations.Core.UploadFile({ file: coverFile });
      cover_url = res.file_url;
    }
    await base44.entities.Club.update(club.id, { ...form, cover_url });
    toast.success('Club profile updated!');
    onUpdated();
    setIsSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Cover photo */}
      <div className="space-y-1">
        <Label>Cover Photo</Label>
        <label className="block cursor-pointer relative rounded-2xl overflow-hidden border-2 border-dashed border-border bg-muted h-32 hover:border-primary transition-colors">
          {coverPreview ? (
            <img src={coverPreview} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-1">
              <ImagePlus className="w-6 h-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Upload cover image</span>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handleCover} />
        </label>
      </div>

      <div className="space-y-1">
        <Label>Club Name</Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)} className="resize-none h-20" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>City</Label>
          <Select value={form.city} onValueChange={v => set('city', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Sport</Label>
          <Select value={form.sport} onValueChange={v => set('sport', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="biking">Biking</SelectItem>
              <SelectItem value="swimming">Swimming</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Instagram URL</Label>
        <Input placeholder="https://instagram.com/yourclub" value={form.instagram_link} onChange={e => set('instagram_link', e.target.value)} />
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="w-full rounded-full">
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Save Changes
      </Button>
    </div>
  );
}