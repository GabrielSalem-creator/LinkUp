import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Building2, Crown, Instagram, ExternalLink, Trash2, LogOut, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SportBadge from '@/components/shared/SportBadge';
import ClubPortalEvents from '@/components/club-portal/ClubPortalEvents';
import ClubPortalMerch from '@/components/club-portal/ClubPortalMerch';
import ClubPortalPosts from '@/components/club-portal/ClubPortalPosts';
import ClubPortalSettings from '@/components/club-portal/ClubPortalSettings';
import ClubSubscriptionGate from '@/components/club-portal/ClubSubscriptionGate';
import CreateClubModal from '@/components/club-portal/CreateClubModal';
import ClubLoginGate from '@/components/club-portal/ClubLoginGate';

export default function ClubPortal() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [unlockedClub, setUnlockedClub] = useState(null);
  const [showCreateClub, setShowCreateClub] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  // Re-fetch the unlocked club to get latest data
  const { data: freshClub, isLoading } = useQuery({
    queryKey: ['club-portal-club', unlockedClub?.id],
    queryFn: () => base44.entities.Club.filter({ id: unlockedClub.id }).then(r => r[0]),
    enabled: !!unlockedClub?.id,
  });

  const myClub = freshClub || unlockedClub;
  const isSubscribed = myClub?.subscription_status === 'active';

  const handleDeleteClub = async () => {
    if (!window.confirm(`Are you sure you want to delete "${myClub.name}"? This cannot be undone.`)) return;
    await base44.entities.Club.delete(myClub.id);
    toast.success('Club deleted');
    setUnlockedClub(null);
  };

  if (!user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Show login gate if not yet unlocked
  if (!unlockedClub) {
    return (
      <>
        <ClubLoginGate
          onUnlocked={(club) => setUnlockedClub(club)}
          onRegisterClub={() => setShowCreateClub(true)}
        />
        {showCreateClub && (
          <CreateClubModal
            open={showCreateClub}
            onClose={() => setShowCreateClub(false)}
            user={user}
            onCreated={(club) => {
              setShowCreateClub(false);
              // After creating, ask them to log in
              toast.success('Club registered! Now enter your club name and password to access the portal.');
            }}
          />
        )}
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-5 h-14">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground p-1 -ml-1">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Building2 className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-heading font-bold">Club Portal</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-1.5"
            onClick={() => setUnlockedClub(null)}
          >
            <LogOut className="w-4 h-4" /> Exit
          </Button>
        </div>
      </div>

      <div className="p-5">
        {/* Club Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-5">
          {myClub.cover_url && (
            <img src={myClub.cover_url} alt="" className="w-full h-28 object-cover" />
          )}
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-heading font-bold text-lg">{myClub.name}</h2>
                  {isSubscribed && <Crown className="w-4 h-4 text-amber-500" />}
                </div>
                <p className="text-sm text-muted-foreground">{myClub.city}</p>
              </div>
              <SportBadge sport={myClub.sport} size="sm" />
            </div>
            {myClub.instagram_link && (
              <a
                href={myClub.instagram_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-pink-500 mt-2 hover:underline"
              >
                <Instagram className="w-3.5 h-3.5" />
                Instagram
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {!isSubscribed && (
              <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                <p className="text-xs text-amber-700 font-medium">⚡ Activate your Official Club for $30/month — unlock events, merch, and the verified badge.</p>
              </div>
            )}
            {isSubscribed && (
              <div className="mt-3 bg-primary/10 border border-primary/20 rounded-xl p-3">
                <p className="text-xs text-primary font-medium">✓ Official Club — All features unlocked</p>
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-border">
              <Button variant="destructive" size="sm" className="w-full rounded-full" onClick={handleDeleteClub}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete Club
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={isSubscribed ? "posts" : "subscribe"}>
          <TabsList className="w-full bg-muted rounded-full p-1 mb-4">
            {isSubscribed ? (
              <>
                <TabsTrigger value="posts" className="rounded-full flex-1 text-xs">Posts</TabsTrigger>
                <TabsTrigger value="events" className="rounded-full flex-1 text-xs">Events</TabsTrigger>
                <TabsTrigger value="merch" className="rounded-full flex-1 text-xs">Merch</TabsTrigger>
                <TabsTrigger value="settings" className="rounded-full flex-1 text-xs">Settings</TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="subscribe" className="rounded-full flex-1 text-xs">Subscribe</TabsTrigger>
                <TabsTrigger value="settings" className="rounded-full flex-1 text-xs">Settings</TabsTrigger>
              </>
            )}
          </TabsList>

          {isSubscribed ? (
            <>
              <TabsContent value="posts">
                <ClubPortalPosts club={myClub} user={user} />
              </TabsContent>
              <TabsContent value="events">
                <ClubPortalEvents club={myClub} />
              </TabsContent>
              <TabsContent value="merch">
                <ClubPortalMerch club={myClub} />
              </TabsContent>
              <TabsContent value="settings">
                <ClubPortalSettings club={myClub} onUpdated={() => queryClient.invalidateQueries({ queryKey: ['club-portal-club'] })} />
              </TabsContent>
            </>
          ) : (
            <>
              <TabsContent value="subscribe">
                <ClubSubscriptionGate club={myClub} onSubscribed={() => queryClient.invalidateQueries({ queryKey: ['club-portal-club'] })} />
              </TabsContent>
              <TabsContent value="settings">
                <ClubPortalSettings club={myClub} onUpdated={() => queryClient.invalidateQueries({ queryKey: ['club-portal-club'] })} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}