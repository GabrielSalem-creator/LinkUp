import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function FollowStats({ userEmail }) {
  const [sheet, setSheet] = useState(null); // 'followers' | 'following' | null

  const { data: allFriendships = [] } = useQuery({
    queryKey: ['all-friendships', userEmail],
    queryFn: () => base44.entities.Friendship.filter({ status: 'accepted' }),
    enabled: !!userEmail,
  });

  const followers = allFriendships.filter(f => f.addressee_email === userEmail);
  const following = allFriendships.filter(f => f.requester_email === userEmail);

  const list = sheet === 'followers' ? followers : following;

  return (
    <>
      <div className="flex items-center gap-6 mt-3">
        <button onClick={() => setSheet('followers')} className="text-left group">
          <p className="font-heading font-bold text-base">{followers.length}</p>
          <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Followers</p>
        </button>
        <div className="w-px h-8 bg-border" />
        <button onClick={() => setSheet('following')} className="text-left group">
          <p className="font-heading font-bold text-base">{following.length}</p>
          <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Following</p>
        </button>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setSheet(null)}>
          <div className="bg-card border border-border rounded-t-3xl w-full max-w-md max-h-[60vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-heading font-bold text-base capitalize">{sheet}</h3>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No {sheet} yet</p>
            ) : (
              list.map(f => {
                const name = sheet === 'followers' ? f.requester_name : f.addressee_name;
                const email = sheet === 'followers' ? f.requester_email : f.addressee_email;
                return (
                  <div key={f.id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {(name || email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{name || email?.split('@')[0]}</p>
                      <p className="text-xs text-muted-foreground">{email}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}