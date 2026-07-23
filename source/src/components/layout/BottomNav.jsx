import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, Users, Trophy, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const navItems = [
  { path: '/', icon: CalendarDays, label: 'Events' },
  { path: '/my-clubs', icon: Users, label: 'My Clubs' },
  { path: '/leaderboard', icon: Trophy, label: 'MyLeague' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let unsubscribe;
    const load = async () => {
      const user = await base44.auth.me().catch(() => null);
      if (!user?.email) return;
      const requests = await base44.entities.Friendship.filter({ addressee_email: user.email, status: 'pending' });
      setPendingCount(requests.length);

      unsubscribe = base44.entities.Friendship.subscribe(() => {
        base44.entities.Friendship.filter({ addressee_email: user.email, status: 'pending' })
          .then(r => setPendingCount(r.length));
      });
    };
    load();
    return () => unsubscribe?.();
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16 px-1">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
          const isProfile = path === '/profile';
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative">
                {isActive && (
                  <div className="absolute -inset-2 bg-primary/10 rounded-xl" />
                )}
                <Icon className={`relative w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                {isProfile && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none z-10">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}