import { useState } from 'react';
import { Heart, MessageCircle, Share2, MapPin } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SportBadge from '../shared/SportBadge';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export default function PostCard({ post, currentUserEmail, userLikes, onLikeToggle }) {
  const [isLiking, setIsLiking] = useState(false);
  const isLiked = userLikes?.includes(post.id);

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    try {
      if (isLiked) {
        const likes = await base44.entities.Like.filter({ post_id: post.id, user_email: currentUserEmail });
        if (likes.length > 0) {
          await base44.entities.Like.delete(likes[0].id);
        }
        await base44.entities.Post.update(post.id, { likes_count: Math.max(0, (post.likes_count || 0) - 1) });
      } else {
        await base44.entities.Like.create({ post_id: post.id, user_email: currentUserEmail });
        await base44.entities.Post.update(post.id, { likes_count: (post.likes_count || 0) + 1 });
      }
      onLikeToggle(post.id, !isLiked);
    } finally {
      setIsLiking(false);
    }
  };

  const timeAgo = post.created_date ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true }) : '';

  return (
    <article className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
          {(post.author_name || post.author_email || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-foreground truncate">
              {post.is_club_post ? post.club_name : (post.author_name || post.author_email?.split('@')[0])}
            </p>
            {post.is_club_post && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Club</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
            {post.sport_tag && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <SportBadge sport={post.sport_tag} size="sm" />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <p className="px-4 pb-3 text-sm text-foreground leading-relaxed">{post.content}</p>
      )}

      {/* Image */}
      {post.image_url && (
        <div className="relative">
          <img
            src={post.image_url}
            alt=""
            className="w-full aspect-[4/3] object-cover"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 p-4 pt-3">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
            isLiked ? 'text-red-500 bg-red-50' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          <span>{post.likes_count || 0}</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-muted-foreground hover:bg-muted transition-all">
          <Share2 className="w-4 h-4" />
        </button>
        {post.club_id && (
          <Link
            to={`/clubs/${post.club_id}`}
            className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <MapPin className="w-3 h-3" />
            {post.club_name}
          </Link>
        )}
      </div>
    </article>
  );
}