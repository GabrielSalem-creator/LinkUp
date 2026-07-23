import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Rss, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import PostCard from '@/components/feed/PostCard';
import EmptyState from '@/components/shared/EmptyState';

export default function ClubPortalPosts({ club, user }) {
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const [sportTag, setSportTag] = useState(club.sport || '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: posts = [] } = useQuery({
    queryKey: ['portal-posts', club.id],
    queryFn: () => base44.entities.Post.filter({ club_id: club.id }, '-created_date', 30),
  });

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const handleCreate = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    let image_url = '';
    if (imageFile) {
      const res = await base44.integrations.Core.UploadFile({ file: imageFile });
      image_url = res.file_url;
    }
    await base44.entities.Post.create({
      author_email: user.email,
      author_name: club.name,
      content: content.trim(),
      image_url,
      sport_tag: sportTag || undefined,
      club_id: club.id,
      club_name: club.name,
      is_club_post: true,
      post_type: image_url ? 'photo' : 'announcement',
    });
    toast.success('Post published!');
    setContent('');
    setImageFile(null);
    setImagePreview(null);
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['portal-posts', club.id] });
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    setIsSaving(false);
  };

  return (
    <div className="space-y-4">
      {!showForm ? (
        <Button className="w-full rounded-full" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Post
        </Button>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">New Club Post</h3>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <Textarea
            placeholder="Share news, motivation, or announcements with your community..."
            value={content}
            onChange={e => setContent(e.target.value)}
            className="resize-none h-24"
          />
          <Select value={sportTag} onValueChange={setSportTag}>
            <SelectTrigger><SelectValue placeholder="Tag a sport (optional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="biking">Biking</SelectItem>
              <SelectItem value="swimming">Swimming</SelectItem>
            </SelectContent>
          </Select>
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={imagePreview} alt="" className="w-full aspect-video object-cover" />
              <button onClick={() => { setImageFile(null); setImagePreview(null); }} className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 p-3 border border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Add a photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </label>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="rounded-full flex-1" onClick={handleCreate} disabled={!content.trim() || isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Publish
            </Button>
          </div>
        </div>
      )}
      {posts.length === 0 ? (
        <EmptyState icon={Rss} title="No posts yet" description="Publish your first club post" />
      ) : (
        posts.map(post => (
          <PostCard key={post.id} post={post} currentUserEmail={user?.email} userLikes={[]} onLikeToggle={() => {}} />
        ))
      )}
    </div>
  );
}