import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, UserCheck, Clock, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

export default function FriendButton({ currentUser, targetEmail, targetName }) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: friendships = [] } = useQuery({
    queryKey: ['friendships', currentUser?.email, targetEmail],
    queryFn: () => base44.entities.Friendship.filter({
      $or: [
        { requester_email: currentUser.email, addressee_email: targetEmail },
        { requester_email: targetEmail, addressee_email: currentUser.email },
      ],
    }),
    enabled: !!currentUser?.email && !!targetEmail,
  });

  const friendship = friendships[0];
  const isAccepted = friendship?.status === 'accepted';
  const isPending = friendship?.status === 'pending';
  const iRequested = friendship?.requester_email === currentUser?.email;

  const handleAction = async () => {
    setLoading(true);
    if (!friendship) {
      await base44.entities.Friendship.create({
        requester_email: currentUser.email,
        requester_name: currentUser.full_name,
        addressee_email: targetEmail,
        addressee_name: targetName,
        status: 'pending',
      });
      toast.success('Friend request sent!');
    } else if (isPending && !iRequested) {
      // Accept
      await base44.entities.Friendship.update(friendship.id, { status: 'accepted' });
      toast.success('Friend request accepted!');
    } else {
      // Cancel / unfriend
      await base44.entities.Friendship.delete(friendship.id);
      toast.success(isAccepted ? 'Unfriended' : 'Request cancelled');
    }
    queryClient.invalidateQueries({ queryKey: ['friendships'] });
    queryClient.invalidateQueries({ queryKey: ['my-friends'] });
    setLoading(false);
  };

  if (isAccepted) {
    return (
      <button onClick={handleAction} disabled={loading}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition-all">
        <UserCheck className="w-3.5 h-3.5" /> Friends
      </button>
    );
  }
  if (isPending && iRequested) {
    return (
      <button onClick={handleAction} disabled={loading}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground transition-all">
        <Clock className="w-3.5 h-3.5" /> Pending
      </button>
    );
  }
  if (isPending && !iRequested) {
    return (
      <button onClick={handleAction} disabled={loading}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground transition-all">
        <UserPlus className="w-3.5 h-3.5" /> Accept
      </button>
    );
  }
  return (
    <button onClick={handleAction} disabled={loading}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-primary text-primary hover:bg-primary/10 transition-all">
      <UserPlus className="w-3.5 h-3.5" /> Add Friend
    </button>
  );
}