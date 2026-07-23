import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CreatePostModal({ open, onClose, user, onCreated }) {
  const [content, setContent] = useState('');
  const [sportTag, setSportTag] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true);
    let image_url = '';
    if (imageFile) {
      const result = await base44.integrations.Core.UploadFile({ file: imageFile });
      image_url = result.file_url;
    }
    await base44.entities.Post.create({
      author_email: user.email,
      author_name: user.full_name,
      content: content.trim(),
      image_url,
      sport_tag: sportTag || undefined,
      post_type: image_url ? 'photo' : 'activity',
    });
    toast.success('Post published!');
    setContent('');
    setSportTag('');
    setImageFile(null);
    setImagePreview(null);
    setIsSubmitting(false);
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Create Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Share your run, ride or swim..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px] resize-none"
          />
          <Select value={sportTag} onValueChange={setSportTag}>
            <SelectTrigger>
              <SelectValue placeholder="Tag a sport (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="biking">Biking</SelectItem>
              <SelectItem value="swimming">Swimming</SelectItem>
            </SelectContent>
          </Select>

          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={imagePreview} alt="" className="w-full aspect-video object-cover" />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 p-3 border border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
              <ImagePlus className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Add a photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}