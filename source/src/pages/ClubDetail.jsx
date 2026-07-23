import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, CheckCircle, Calendar, ShoppingBag, Loader2, UserPlus, LogOut, Instagram, Trophy } from 'lucide-react';
import ClubLeaderboard from '@/components/clubs/ClubLeaderboard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SportBadge from '@/components/shared/SportBadge';
import PostCard from '@/components/feed/PostCard';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';

export default function ClubDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [membershipId, setMembershipId] = useState(null);
  const [joining, setJoining] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: club, isLoading } = useQuery({
    queryKey: ['club', id],
    queryFn: () => base44.entities.Club.filter({ id }),
    select: (data) => data[0],
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['club-posts', id],
    queryFn: () => base44.entities.Post.filter({ club_id: id }, '-created_date', 20),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['club-events', id],
    queryFn: () => base44.entities.ClubEvent.filter({ club_id: id }, '-date', 10),
  });

  const { data: myEventRsvps = [] } = useQuery({
    queryKey: ['my-event-rsvps', user?.email],
    queryFn: () => base44.entities.EventParticipant.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });

  const isGoingToEvent = (eventId) => myEventRsvps.some(r => r.event_id === eventId);

  const handleRsvp = async (event) => {
    if (!user) return;
    if (isGoingToEvent(event.id)) {
      const rsvp = myEventRsvps.find(r => r.event_id === event.id);
      if (rsvp) await base44.entities.EventParticipant.delete(rsvp.id);
      toast.success("Removed from your events");
    } else {
      await base44.entities.EventParticipant.create({
        event_id: event.id,
        user_email: user.email,
        user_name: user.full_name,
        club_id: id,
        club_name: club?.name,
        event_title: event.title,
        event_date: event.date,
        event_time: event.time,
        meeting_point: event.meeting_point,
        distance_km: event.distance_km,
        sport: club?.sport,
      });
      toast.success("Added to your upcoming events!");
    }
    queryClient.invalidateQueries({ queryKey: ['my-event-rsvps'] });
  };

  const { data: merch = [] } = useQuery({
    queryKey: ['club-merch', id],
    queryFn: () => base44.entities.MerchItem.filter({ club_id: id }),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['club-members', id],
    queryFn: () => base44.entities.ClubMembership.filter({ club_id: id, status: 'active' }),
  });

  useEffect(() => {
    if (!user?.email || !members.length) return;
    const m = members.find(m => m.user_email === user.email);
    if (m) { setIsMember(true); setMembershipId(m.id); }
  }, [user?.email, members]);

  const handleJoin = async () => {
    if (!user) return;
    setJoining(true);
    await base44.entities.ClubMembership.create({
      user_email: user.email,
      user_name: user.full_name,
      club_id: id,
      club_name: club?.name,
      role: 'member',
      status: 'active',
    });
    await base44.entities.Club.update(id, { member_count: (club?.member_count || 0) + 1 });
    setIsMember(true);
    toast.success(`Welcome to ${club?.name}!`);
    queryClient.invalidateQueries({ queryKey: ['club-members', id] });
    queryClient.invalidateQueries({ queryKey: ['club', id] });
    setJoining(false);
  };

  const handleLeave = async () => {
    if (!membershipId) return;
    setJoining(true);
    await base44.entities.ClubMembership.delete(membershipId);
    await base44.entities.Club.update(id, { member_count: Math.max(0, (club?.member_count || 0) - 1) });
    setIsMember(false);
    setMembershipId(null);
    toast.success('Left the club');
    queryClient.invalidateQueries({ queryKey: ['club-members', id] });
    queryClient.invalidateQueries({ queryKey: ['club', id] });
    setJoining(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!club) {
    return <EmptyState title="Club not found" />;
  }

  return (
    <div className="min-h-screen">
      {/* Cover */}
      <div className="relative h-48">
        <img
          src={club.cover_url || 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&q=80'}
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <Link to="/clubs" className="absolute top-4 left-4 w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>

      {/* Info */}
      <div className="px-5 -mt-12 relative z-10">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-bold text-xl">{club.name}</h1>
                {club.is_verified && <CheckCircle className="w-5 h-5 text-primary fill-primary/20" />}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{club.city}</p>
            </div>
            <SportBadge sport={club.sport} size="sm" />
          </div>
          {club.description && (
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{club.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-sm">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-semibold">{club.member_count || 0}</span>
              <span className="text-muted-foreground">members</span>
            </div>
            {club.instagram_link && (
              <a
                href={club.instagram_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-pink-500 hover:underline"
              >
                <Instagram className="w-3.5 h-3.5" />
                Instagram
              </a>
            )}
          </div>
          <div className="mt-4">
            {isMember ? (
              <Button variant="outline" className="w-full rounded-full" onClick={handleLeave} disabled={joining}>
                {joining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                Leave Club
              </Button>
            ) : (
              <Button className="w-full rounded-full" onClick={handleJoin} disabled={joining}>
                {joining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Join Club
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 mt-5 pb-4">
        <Tabs defaultValue="posts">
          <TabsList className="w-full bg-muted rounded-full p-1">
            <TabsTrigger value="posts" className="rounded-full flex-1 text-xs">Posts</TabsTrigger>
            <TabsTrigger value="events" className="rounded-full flex-1 text-xs">Events</TabsTrigger>
            <TabsTrigger value="merch" className="rounded-full flex-1 text-xs">Merch</TabsTrigger>
            <TabsTrigger value="members" className="rounded-full flex-1 text-xs">Members</TabsTrigger>
            <TabsTrigger value="leaderboard" className="rounded-full flex-1 text-xs">Board</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4 space-y-4">
            {posts.length === 0 ? (
              <EmptyState title="No posts yet" description="This club hasn't posted yet" />
            ) : (
              posts.map(post => (
                <PostCard key={post.id} post={post} currentUserEmail={user?.email} userLikes={[]} onLikeToggle={() => {}} />
              ))
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-4 space-y-3">
            {events.length === 0 ? (
              <EmptyState icon={Calendar} title="No upcoming events" />
            ) : (
              events.map(event => (
                <div key={event.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">{event.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{event.date}{event.time ? ` · ${event.time}` : ''}</p>
                      {event.meeting_point && (
                        <p className="text-xs text-muted-foreground mt-0.5">📍 {event.meeting_point}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {event.distance_km && (
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
                          {event.distance_km} km
                        </span>
                      )}
                      <button
                        onClick={() => handleRsvp(event)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                          isGoingToEvent(event.id)
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border text-muted-foreground hover:border-primary hover:text-primary'
                        }`}
                      >
                        {isGoingToEvent(event.id) ? '✓ Going' : "I'm Going"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="merch" className="mt-4">
            {merch.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="No merch available" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {merch.map(item => (
                  <div key={item.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                    {item.image_url && (
                      <img src={item.image_url} alt="" className="w-full aspect-square object-cover" />
                    )}
                    <div className="p-3">
                      <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                      <p className="text-primary font-bold text-sm mt-1">${item.price_usd}</p>
                      {!item.in_stock && <p className="text-xs text-destructive mt-1">Sold out</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="members" className="mt-4 space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold">
                  {(m.user_name || m.user_email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.user_name || m.user_email?.split('@')[0]}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="leaderboard">
            <ClubLeaderboard clubId={id} currentUserEmail={user?.email} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}