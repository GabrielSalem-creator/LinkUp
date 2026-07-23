import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, Medal, Loader2, UserPlus, Calendar, Target, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SportBadge from '@/components/shared/SportBadge';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';

export default function Leaderboard() {
  const [user, setUser] = useState(null);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: leagues = [], isLoading } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list('-created_date', 50),
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['league-participants', selectedLeague?.id],
    queryFn: () => base44.entities.LeagueParticipant.filter({ league_id: selectedLeague?.id }),
    enabled: !!selectedLeague?.id,
  });

  const { data: myParticipations = [] } = useQuery({
    queryKey: ['my-participations', user?.email],
    queryFn: () => base44.entities.LeagueParticipant.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });

  const isJoined = (leagueId) => myParticipations.some(p => p.league_id === leagueId);

  const handleJoinLeague = async (league) => {
    if (!user) return;
    await base44.entities.LeagueParticipant.create({
      league_id: league.id,
      user_email: user.email,
      user_name: user.full_name,
      total_distance_km: 0,
      total_activities: 0,
    });
    toast.success(`Joined ${league.name}!`);
    queryClient.invalidateQueries({ queryKey: ['my-participations'] });
    queryClient.invalidateQueries({ queryKey: ['league-participants'] });
  };

  const sortedParticipants = [...participants].sort((a, b) => (b.total_distance_km || 0) - (a.total_distance_km || 0));

  const activeLeagues = leagues.filter(l => l.status === 'active');
  const upcomingLeagues = leagues.filter(l => l.status === 'upcoming');
  const completedLeagues = leagues.filter(l => l.status === 'completed');

  const rankBadge = (index) => {
    if (index === 0) return <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center"><Trophy className="w-4 h-4 text-amber-500" /></div>;
    if (index === 1) return <div className="w-8 h-8 rounded-full bg-slate-400/20 flex items-center justify-center"><Medal className="w-4 h-4 text-slate-400" /></div>;
    if (index === 2) return <div className="w-8 h-8 rounded-full bg-amber-700/20 flex items-center justify-center"><Medal className="w-4 h-4 text-amber-700" /></div>;
    return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{index + 1}</div>;
  };

  if (selectedLeague) {
    return (
      <div className="min-h-screen">
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-5 h-14 flex items-center gap-3">
          <button onClick={() => setSelectedLeague(null)} className="text-muted-foreground hover:text-foreground">
            ←
          </button>
          <h1 className="text-lg font-heading font-bold truncate">{selectedLeague.name}</h1>
        </div>

        <div className="p-5">
          <div className="bg-card border border-border rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <SportBadge sport={selectedLeague.sport} />
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                selectedLeague.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' :
                selectedLeague.status === 'upcoming' ? 'bg-blue-500/10 text-blue-600' :
                'bg-muted text-muted-foreground'
              }`}>
                {selectedLeague.status}
              </span>
            </div>
            {selectedLeague.description && <p className="text-sm text-muted-foreground mb-2">{selectedLeague.description}</p>}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{selectedLeague.start_date} → {selectedLeague.end_date}</span>
              {selectedLeague.target_km && <span className="flex items-center gap-1"><Target className="w-3 h-3" />{selectedLeague.target_km} km</span>}
            </div>
            {selectedLeague.prize_description && (
              <div className="mt-3 p-3 bg-accent/10 rounded-xl">
                <p className="text-xs font-medium text-accent">🏆 {selectedLeague.prize_description}</p>
              </div>
            )}
            {!isJoined(selectedLeague.id) && selectedLeague.status !== 'completed' && (
              <Button className="w-full mt-3 rounded-full" onClick={() => handleJoinLeague(selectedLeague)}>
                <UserPlus className="w-4 h-4 mr-2" /> Join League
              </Button>
            )}
          </div>

          {/* Leaderboard */}
          <h2 className="font-heading font-semibold mb-3">Leaderboard</h2>
          {sortedParticipants.length === 0 ? (
            <EmptyState title="No participants yet" description="Be the first to join!" />
          ) : (
            <div className="space-y-2">
              {sortedParticipants.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${
                  i === 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card'
                }`}>
                  {rankBadge(i)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.user_name || p.user_email?.split('@')[0]}</p>
                    <p className="text-xs text-muted-foreground">{p.total_activities || 0} activities</p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading font-bold text-sm">{(p.total_distance_km || 0).toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">km</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const LeagueList = ({ items }) => {
    if (items.length === 0) return <EmptyState icon={Trophy} title="No leagues" description="Check back soon!" />;
    return (
      <div className="space-y-3">
        {items.map(league => (
          <button
            key={league.id}
            onClick={() => setSelectedLeague(league)}
            className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{league.name}</h3>
                  <SportBadge sport={league.sport} size="sm" />
                </div>
                {league.club_name && <p className="text-xs text-muted-foreground mt-0.5">by {league.club_name}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{league.start_date} → {league.end_date}</span>
                  {league.prize_description && <span className="text-accent">🏆 Prize</span>}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground mt-1" />
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-5 h-14 flex items-center">
        <h1 className="text-xl font-heading font-bold">Leagues</h1>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="active">
            <TabsList className="w-full bg-muted rounded-full p-1 mb-4">
              <TabsTrigger value="active" className="rounded-full flex-1 text-xs">Active</TabsTrigger>
              <TabsTrigger value="upcoming" className="rounded-full flex-1 text-xs">Upcoming</TabsTrigger>
              <TabsTrigger value="completed" className="rounded-full flex-1 text-xs">Completed</TabsTrigger>
            </TabsList>
            <TabsContent value="active"><LeagueList items={activeLeagues} /></TabsContent>
            <TabsContent value="upcoming"><LeagueList items={upcomingLeagues} /></TabsContent>
            <TabsContent value="completed"><LeagueList items={completedLeagues} /></TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}