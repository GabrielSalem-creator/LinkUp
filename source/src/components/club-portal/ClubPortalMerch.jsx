import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Trash2, ShoppingBag, X, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '@/components/shared/EmptyState';

export default function ClubPortalMerch({ club }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price_usd: '', category: 'shirt' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: merch = [] } = useQuery({
    queryKey: ['portal-merch', club.id],
    queryFn: () => base44.entities.MerchItem.filter({ club_id: club.id }),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const handleCreate = async () => {
    if (!form.name || !form.price_usd) return;
    setIsSaving(true);
    let image_url = '';
    if (imageFile) {
      const res = await base44.integrations.Core.UploadFile({ file: imageFile });
      image_url = res.file_url;
    }
    await base44.entities.MerchItem.create({
      ...form,
      price_usd: parseFloat(form.price_usd),
      image_url,
      club_id: club.id,
      club_name: club.name,
      in_stock: true,
    });
    toast.success('Item added!');
    setForm({ name: '', description: '', price_usd: '', category: 'shirt' });
    setImageFile(null);
    setImagePreview(null);
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['portal-merch', club.id] });
    queryClient.invalidateQueries({ queryKey: ['club-merch', club.id] });
    setIsSaving(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.MerchItem.delete(id);
    toast.success('Item removed');
    queryClient.invalidateQueries({ queryKey: ['portal-merch', club.id] });
  };

  return (
    <div className="space-y-4">
      {!showForm ? (
        <Button className="w-full rounded-full" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Merch Item
        </Button>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-sm">New Merch Item</h3>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          {/* Image upload */}
          <label className="block cursor-pointer h-32 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
            {imagePreview ? (
              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Upload photo</span>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
          </label>
          <div className="space-y-1">
            <Label>Item Name *</Label>
            <Input placeholder="e.g. Club Running Tee" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Price (USD) *</Label>
              <Input type="number" placeholder="25" value={form.price_usd} onChange={e => set('price_usd', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shirt">Shirt</SelectItem>
                  <SelectItem value="shorts">Shorts</SelectItem>
                  <SelectItem value="cap">Cap</SelectItem>
                  <SelectItem value="accessories">Accessories</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} className="resize-none h-16" placeholder="Material, sizing, etc." />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="rounded-full flex-1" onClick={handleCreate} disabled={!form.name || !form.price_usd || isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Add Item
            </Button>
          </div>
        </div>
      )}

      {merch.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No merch yet" description="Add your first item to the store" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {merch.map(item => (
            <div key={item.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              {item.image_url ? (
                <img src={item.image_url} alt="" className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square bg-muted flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-3">
                <h3 className="font-semibold text-xs truncate">{item.name}</h3>
                <p className="text-primary font-bold text-sm mt-0.5">${item.price_usd}</p>
                <button onClick={() => handleDelete(item.id)} className="mt-2 text-xs text-destructive flex items-center gap-1 hover:underline">
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}