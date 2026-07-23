import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Users, Loader2 } from 'lucide-react';
import PostCard from '@/components/feed/PostCard';
import CreatePostModal from '@/components/feed/CreatePostModal';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function Home() {
  const [user, setUser] = useState(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [userLikes, setUserLikes] = useState([]);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  // Get accepted friendships
  const { data: friendships = [] } = useQuery({
    queryKey: ['friendships', user?.email],
    queryFn: () => base44.entities.Friendship.filter({ status: 'accepted' }),
    enabled: !!user?.email,
  });

  // Get clubs the user is a member of
  const { data: memberships = [] } = useQuery({
    queryKey: ['my-clubs', user?.email],
    queryFn: () => base44.entities.ClubMembership.filter({ user_email: user.email, status: 'active' }),
    enabled: !!user?.email,
  });

  // Get all posts
  const { data: allPosts = [], isLoading } = useQuery({
    queryKey: ['feed-posts'],
    queryFn: () => base44.entities.Post.list('-created_date', 50),
    enabled: !!user?.email,
  });

  // Get user's likes
  const { data: likes = [] } = useQuery({
    queryKey: ['my-likes', user?.email],
    queryFn: () => base44.entities.Like.filter({ user_email: user.email }),
    enabled: !!user?.email,
    onSuccess: (data) => setUserLikes(data.map(l => l.post_id)),
  });

  useEffect(() => {
    setUserLikes(likes.map(l => l.post_id));
  }, [likes]);

  // Filter feed: own posts + friends' posts + club posts from member clubs
  const feedPosts = allPosts.filter(post => {
    if (post.author_email === user?.email) return true;

    const friendEmails = friendships
      .filter(f => f.requester_email === user?.email || f.addressee_email === user?.email)
      .map(f => f.requester_email === user?.email ? f.addressee_email : f.requester_email);

    if (!post.is_club_post && friendEmails.includes(post.author_email)) return true;

    const memberClubIds = memberships.map(m => m.club_id);
    if (post.is_club_post && memberClubIds.includes(post.club_id)) return true;

    return false;
  });

  const handleLikeToggle = (postId, isNowLiked) => {
    setUserLikes(prev =>
      isNowLiked ? [...prev, postId] : prev.filter(id => id !== postId)
    );
    queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-5 py-3 flex items-center justify-between">
        <h1 className="font-heading font-bold text-lg">1COM Feed</h1>
        <div className="flex items-center gap-2">
          <Link to="/people">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Users className="w-5 h-5" />
            </Button>
          </Link>
          <Button size="sm" className="rounded-full" onClick={() => setShowCreatePost(true)}>
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Post
          </Button>
        </div>
      </div>

      {/* Feed */}
      <div className="px-4 py-4 space-y-4 pb-24">
        {isLoading || !user ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : feedPosts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Your feed is empty"
            description="Follow friends or join clubs to see their posts here"
            action={
              <Link to="/people">
                <Button className="rounded-full">Find Friends</Button>
              </Link>
            }
          />
        ) : (
          feedPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUserEmail={user.email}
              userLikes={userLikes}
              onLikeToggle={handleLikeToggle}
            />
          ))
        )}
      </div>

      {showCreatePost && (
        <CreatePostModal
          open={showCreatePost}
          onClose={() => setShowCreatePost(false)}
          user={user}
          onPostCreated={() => queryClient.invalidateQueries({ queryKey: ['feed-posts'] })}
        />
      )}
    </div>
  );
}