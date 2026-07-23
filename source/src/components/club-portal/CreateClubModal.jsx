import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';

const CITIES = ['Beirut', 'Tripoli', 'Sidon', 'Tyre', 'Jounieh', 'Jbeil', 'Zahle', 'Batroun', 'Aley'];

const KNOWN_SPORTS = ['running', 'walking', 'biking', 'swimming', 'hyrox', 'triathlon', 'crossfit', 'yoga', 'hiking', 'other'];

export default function CreateClubModal({ open, onClose, user, onCreated }) {
  const [form, setForm] = useState({ name: '', sport: '', city: '', description: '', instagram_link: '', club_password: '' });
  const [customSport, setCustomSport] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.sport || !form.city || !form.club_password) return;
    setIsSubmitting(true);
    let logo_url = '';
    if (logoFile) {
      const res = await base44.integrations.Core.UploadFile({ file: logoFile });
      logo_url = res.file_url;
    }
    const resolvedSport = form.sport === 'custom' ? customSport : form.sport;
    await base44.entities.Club.create({
      ...form,
      sport: resolvedSport,
      logo_url,
      owner_email: user.email,
      member_count: 0,
      is_verified: false,
      subscription_status: 'inactive',
    });
    toast.success('Club registered! Activate your subscription to unlock all features.');
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Register Your Club</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <label className="cursor-pointer text-sm text-primary hover:underline font-medium">
                Upload Logo
                <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">Square image recommended</p>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Club Name *</Label>
            <Input placeholder="e.g. Beirut Trail Runners" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Sport *</Label>
              <Select value={form.sport} onValueChange={v => set('sport', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
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
                  <SelectItem value="custom">Type my own...</SelectItem>
                </SelectContent>
              </Select>
              {form.sport === 'custom' && (
                <Input
                  className="mt-2"
                  placeholder="Enter your sport"
                  value={customSport}
                  onChange={e => setCustomSport(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-1">
              <Label>City *</Label>
              <Select value={form.city} onValueChange={v => set('city', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea placeholder="Tell athletes about your club..." value={form.description} onChange={e => set('description', e.target.value)} className="resize-none h-20" />
          </div>

          <div className="space-y-1">
            <Label>Instagram URL</Label>
            <Input placeholder="https://instagram.com/yourclub" value={form.instagram_link} onChange={e => set('instagram_link', e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Club Portal Password *</Label>
            <Input
              type="password"
              placeholder="Set a password to access your club portal"
              value={form.club_password}
              onChange={e => set('club_password', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Share this password with your club admins only.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-full flex-1">Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.name || !form.sport || !form.city || !form.club_password || (form.sport === 'custom' && !customSport) || isSubmitting}
            className="rounded-full flex-1"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Register Club
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}