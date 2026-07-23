import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, MapPin, Edit3, Loader2, Moon, Sun, Building2 } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import EventsCalendar from '@/components/profile/EventsCalendar';
import FollowStats from '@/components/profile/FollowStats';
import HistoryTab from '@/components/profile/HistoryTab';
import MemoriesTab from '@/components/profile/MemoriesTab';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EditProfileModal from '@/components/profile/EditProfileModal';


export default function Profile() {
  const [user, setUser] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const queryClient = useQueryClient();
  const { isDark, toggle } = useTheme();

  const loadUser = async () => {
    const u = await base44.auth.me();
    setUser(u);
  };

  useEffect(() => { loadUser(); }, []);

  const { data: activities = [] } = useQuery({
    queryKey: ['my-activities', user?.email],
    queryFn: () => base44.entities.Activity.filter({ user_email: user.email }, '-date', 100),
    enabled: !!user?.email,
  });

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ['my-upcoming-events', user?.email],
    queryFn: () => base44.entities.EventParticipant.filter({ user_email: user.email }, 'event_date', 50),
    enabled: !!user?.email,
  });

  if (!user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative">
        <div className="h-28 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5" />
        <div className="px-5 -mt-10">
          <div className="flex items-end gap-4">
            <div className="w-20 h-20 rounded-2xl border-4 border-background bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-2xl font-bold overflow-hidden shrink-0">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (user.full_name || user.email || '?')[0].toUpperCase()
              )}
            </div>
            <div className="flex-1 pb-1 min-w-0">
              <h1 className="font-heading font-bold text-lg truncate">{user.full_name || 'User'}</h1>
              {user.city && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="w-3 h-3" /> {user.city}
                </span>
              )}
            </div>
          </div>

          {user.bio && <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{user.bio}</p>}

          {/* Followers / Following */}
          <FollowStats userEmail={user.email} />

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" className="rounded-full flex-1" onClick={() => setShowEdit(true)}>
              <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit Profile
            </Button>
            <Link to="/club-portal">
              <Button variant="outline" size="sm" className="rounded-full">
                <Building2 className="w-3.5 h-3.5" />
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="rounded-full" onClick={toggle}>
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => base44.auth.logout()}>
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 mt-6 pb-24">
        <Tabs defaultValue="events">
          <TabsList className="w-full bg-muted rounded-full p-1">
            <TabsTrigger value="events" className="rounded-full flex-1 text-xs">Events</TabsTrigger>
            <TabsTrigger value="history" className="rounded-full flex-1 text-xs">History</TabsTrigger>
            <TabsTrigger value="memories" className="rounded-full flex-1 text-xs">Memories</TabsTrigger>
          </TabsList>

          {/* Events = calendar + event cards */}
          <TabsContent value="events" className="mt-4">
            <EventsCalendar
              events={upcomingEvents}
              user={user}
              onEventConfirmed={loadUser}
            />
          </TabsContent>

          {/* History = sport groups with drill-down */}
          <TabsContent value="history">
            <HistoryTab activities={activities} />
          </TabsContent>

          {/* Memories = travel-card photo wall */}
          <TabsContent value="memories">
            <MemoriesTab user={user} completedEvents={activities} />
          </TabsContent>
        </Tabs>
      </div>

      {showEdit && (
        <EditProfileModal
          open={showEdit}
          onClose={() => setShowEdit(false)}
          user={user}
          onUpdated={loadUser}
        />
      )}
    </div>
  );
}