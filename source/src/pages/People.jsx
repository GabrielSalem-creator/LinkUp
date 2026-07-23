import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, Users, Loader2, Bell, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FriendButton from '@/components/social/FriendButton';
import EmptyState from '@/components/shared/EmptyState';
import SportBadge from '@/components/shared/SportBadge';

export default function People() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });

  const { data: friendships = [] } = useQuery({
    queryKey: ['my-friends', user?.email],
    queryFn: () => base44.entities.Friendship.filter({ status: 'accepted' }),
    enabled: !!user?.email,
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pending-requests', user?.email],
    queryFn: () => base44.entities.Friendship.filter({ addressee_email: user.email, status: 'pending' }),
    enabled: !!user?.email,
  });

  const friendEmails = new Set(
    friendships.flatMap(f => [f.requester_email, f.addressee_email]).filter(e => e !== user?.email)
  );

  const otherUsers = allUsers.filter(u => u.email !== user?.email);
  const filtered = otherUsers.filter(u =>
    !search || (u.full_name || u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const friends = filtered.filter(u => friendEmails.has(u.email));
  const others = filtered.filter(u => !friendEmails.has(u.email));

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground p-1 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-heading font-bold">People</h1>
        </div>
        {pendingRequests.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs bg-accent/20 text-accent-foreground px-2.5 py-1 rounded-full font-medium">
            <Bell className="w-3 h-3" /> {pendingRequests.length} request{pendingRequests.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search athletes..."
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Pending requests */}
        {pendingRequests.length > 0 && !search && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Friend Requests</p>
            <div className="space-y-2">
              {pendingRequests.map(req => (
                <div key={req.id} className="flex items-center gap-3 bg-accent/10 border border-accent/20 rounded-2xl p-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {(req.requester_name || req.requester_email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{req.requester_name || req.requester_email?.split('@')[0]}</p>
                    <p className="text-xs text-muted-foreground">Wants to be friends</p>
                  </div>
                  <FriendButton currentUser={user} targetEmail={req.requester_email} targetName={req.requester_name} />
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Friends */}
            {friends.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Friends ({friends.length})</p>
                <div className="space-y-2">
                  {friends.map(u => <UserCard key={u.id} u={u} currentUser={user} />)}
                </div>
              </div>
            )}

            {/* Discover */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {search ? 'Results' : 'Discover Athletes'}
              </p>
              {others.length === 0 ? (
                <EmptyState icon={Users} title="No athletes found" />
              ) : (
                <div className="space-y-2">
                  {others.map(u => <UserCard key={u.id} u={u} currentUser={user} />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function UserCard({ u, currentUser }) {
  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden">
        {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : (u.full_name || u.email || '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{u.full_name || u.email?.split('@')[0]}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {u.city && <span className="text-xs text-muted-foreground">{u.city}</span>}
          {u.favorite_sport && <SportBadge sport={u.favorite_sport} size="sm" />}
        </div>
      </div>
      <FriendButton currentUser={currentUser} targetEmail={u.email} targetName={u.full_name} />
    </div>
  );
}