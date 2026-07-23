import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

const cities = ['Beirut', 'Jounieh', 'Batroun', 'Byblos', 'Tripoli', 'Sidon', 'Tyre', 'Zahle', 'Bsharri', 'Broummana', 'Other'];

const SPORTS = ['running', 'walking', 'biking', 'swimming', 'hyrox', 'triathlon', 'crossfit', 'yoga', 'hiking', 'other'];

export default function EditProfileModal({ open, onClose, user, onUpdated }) {
  const [bio, setBio] = useState(user?.bio || '');
  const [city, setCity] = useState(user?.city || '');
  const isCustomSport = user?.favorite_sport && !SPORTS.includes(user.favorite_sport);
  const [favSport, setFavSport] = useState(isCustomSport ? 'custom' : (user?.favorite_sport || ''));
  const [customSport, setCustomSport] = useState(isCustomSport ? user.favorite_sport : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const resolvedSport = favSport === 'custom' ? customSport : favSport;
    const updates = { bio, city, favorite_sport: resolvedSport || undefined };
    if (avatarFile) {
      const result = await base44.integrations.Core.UploadFile({ file: avatarFile });
      updates.avatar_url = result.file_url;
    }
    await base44.auth.updateMe(updates);
    toast.success('Profile updated!');
    setIsSubmitting(false);
    onUpdated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Avatar</Label>
            <label className="mt-2 flex items-center gap-3 p-3 border border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50">
              <ImagePlus className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {avatarFile ? avatarFile.name : 'Upload profile photo'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setAvatarFile(e.target.files?.[0])} />
            </label>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              className="mt-2 resize-none"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">City</Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Favorite Sport</Label>
            <Select value={favSport} onValueChange={setFavSport}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select sport" />
              </SelectTrigger>
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
            {favSport === 'custom' && (
              <Input
                className="mt-2"
                placeholder="Enter your sport"
                value={customSport}
                onChange={e => setCustomSport(e.target.value)}
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full rounded-full">
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}