import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, Medal, Loader2, Plus, Link as LinkIcon, Copy, UserPlus, ChevronLeft, Calendar, Bike, Footprints, Waves, Users, PersonStanding, Zap, Dumbbell, Mountain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import CreateLeagueModal from '@/components/leagues/CreateLeagueModal';
import { toast } from 'sonner';
import { format, isAfter, isBefore, parseISO } from 'date-fns';

const sportConfig = {
  running_walking: { label: 'Running / Walking', icon: Footprints, color: 'bg-emerald-500/10 text-emerald-600' },
  walking: { label: 'Walking', icon: PersonStanding, color: 'bg-lime-500/10 text-lime-600' },
  biking: { label: 'Biking', icon: Bike, color: 'bg-blue-500/10 text-blue-600' },
  swimming: { label: 'Swimming', icon: Waves, color: 'bg-cyan-500/10 text-cyan-600' },
  hyrox: { label: 'Hyrox', icon: Zap, color: 'bg-orange-500/10 text-orange-600' },
  triathlon: { label: 'Triathlon', icon: Footprints, color: 'bg-purple-500/10 text-purple-600' },
  crossfit: { label: 'CrossFit', icon: Dumbbell, color: 'bg-red-500/10 text-red-600' },
  yoga: { label: 'Yoga', icon: PersonStanding, color: 'bg-pink-500/10 text-pink-600' },
  hiking: { label: 'Hiking', icon: Mountain, color: 'bg-amber-500/10 text-amber-600' },
  other: { label: 'Other', icon: Dumbbell, color: 'bg-slate-500/10 text-slate-600' },
};

const rankBadge = (index) => {
  if (index === 0) return <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center"><Trophy className="w-4 h-4 text-amber-500" /></div>;
  if (index === 1) return <div className="w-8 h-8 rounded-full bg-slate-400/20 flex items-center justify-center"><Medal className="w-4 h-4 text-slate-400" /></div>;
  if (index === 2) return <div className="w-8 h-8 rounded-full bg-amber-700/20 flex items-center justify-center"><Medal className="w-4 h-4 text-amber-700" /></div>;
  return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{index + 1}</div>;
};

export default function Leagues() {
  const [user, setUser] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: myParticipations = [], isLoading } = useQuery({
    queryKey: ['my-participations', user?.email],
    queryFn: () => base44.entities.LeagueParticipant.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });

  const myLeagueIds = myParticipations.map(p => p.league_id);

  const { data: allLeagues = [] } = useQuery({
    queryKey: ['all-leagues-detail'],
    queryFn: () => base44.entities.League.list('-created_date', 100),
    enabled: myLeagueIds.length > 0 || true,
  });

  const myLeagues = allLeagues.filter(l => myLeagueIds.includes(l.id) || l.created_by === user?.email);

  const { data: leagueParticipants = [] } = useQuery({
    queryKey: ['league-participants', selectedLeague?.id],
    queryFn: () => base44.entities.LeagueParticipant.filter({ league_id: selectedLeague?.id }),
    enabled: !!selectedLeague?.id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['all-activities-for-league', selectedLeague?.id],
    queryFn: async () => {
      if (!selectedLeague) return [];
      const participants = leagueParticipants;
      if (!participants.length) return [];
      return base44.entities.Activity.list('-date', 500);
    },
    enabled: !!selectedLeague?.id && leagueParticipants.length > 0,
  });

  const computeLeaderboard = () => {
    if (!selectedLeague || !leagueParticipants.length) return [];
    const sportMap = {
      running_walking: ['running', 'walking'],
      walking: ['walking'],
      biking: ['biking'],
      swimming: ['swimming'],
      hyrox: ['hyrox'],
      triathlon: ['triathlon'],
      crossfit: ['crossfit'],
      yoga: ['yoga'],
      hiking: ['hiking'],
      other: ['other'],
    };
    const validSports = sportMap[selectedLeague.sport] || [selectedLeague.sport];
    const start = parseISO(selectedLeague.start_date);
    const end = parseISO(selectedLeague.end_date);
    const participantEmails = new Set(leagueParticipants.map(p => p.user_email));

    const userMap = {};
    leagueParticipants.forEach(p => {
      userMap[p.user_email] = { email: p.user_email, name: p.user_name || p.user_email?.split('@')[0], total_km: 0, total_activities: 0 };
    });

    activities.forEach(a => {
      if (!participantEmails.has(a.user_email)) return;
      if (!validSports.includes(a.sport)) return;
      const aDate = parseISO(a.date);
      if (isBefore(aDate, start) || isAfter(aDate, end)) return;
      if (userMap[a.user_email]) {
        userMap[a.user_email].total_km += a.distance_km || 0;
        userMap[a.user_email].total_activities += 1;
      }
    });

    return Object.values(userMap).sort((a, b) => b.total_km - a.total_km);
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;
    setJoiningByCode(true);
    const leagues = await base44.entities.League.filter({ invite_code: joinCode.trim().toUpperCase() });
    if (!leagues.length) {
      toast.error('Invalid invite code');
      setJoiningByCode(false);
      return;
    }
    const league = leagues[0];
    const existing = await base44.entities.LeagueParticipant.filter({ league_id: league.id, user_email: user.email });
    if (existing.length) {
      toast('Already in this league!');
      setJoiningByCode(false);
      setSelectedLeague(league);
      return;
    }
    if ((league.member_count || 1) >= (league.max_members || 50)) {
      toast.error('This league is full (50 members max)');
      setJoiningByCode(false);
      return;
    }
    await base44.entities.LeagueParticipant.create({
      league_id: league.id,
      user_email: user.email,
      user_name: user.full_name,
      total_distance_km: 0,
      total_activities: 0,
    });
    await base44.entities.League.update(league.id, { member_count: (league.member_count || 1) + 1 });
    toast.success(`Joined "${league.name}"!`);
    queryClient.invalidateQueries({ queryKey: ['my-participations'] });
    queryClient.invalidateQueries({ queryKey: ['all-leagues-detail'] });
    setJoinCode('');
    setJoiningByCode(false);
  };

  const copyInviteLink = (league) => {
    const text = `Join my league "${league.name}" on 1COM! Use code: ${league.invite_code}`;
    navigator.clipboard.writeText(text);
    toast.success('Invite link copied!');
  };

  const getStatus = (league) => {
    const now = new Date();
    const start = parseISO(league.start_date);
    const end = parseISO(league.end_date);
    if (isBefore(now, start)) return 'upcoming';
    if (isAfter(now, end)) return 'ended';
    return 'active';
  };

  // League detail view
  if (selectedLeague) {
    const board = computeLeaderboard();
    const status = getStatus(selectedLeague);
    const sport = sportConfig[selectedLeague.sport];
    const SportIcon = sport?.icon || Trophy;

    return (
      <div className="min-h-screen">
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-5 h-14 flex items-center gap-3">
          <button onClick={() => setSelectedLeague(null)} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-heading font-bold truncate flex-1">{selectedLeague.name}</h1>
          <button onClick={() => copyInviteLink(selectedLeague)} className="flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-full px-3 py-1.5">
            <Copy className="w-3 h-3" /> Share
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${sport?.color}`}>
                <SportIcon className="w-3 h-3" />
                {sport?.label || selectedLeague.sport}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                status === 'active' ? 'bg-emerald-500/10 text-emerald-600' :
                status === 'upcoming' ? 'bg-blue-500/10 text-blue-600' :
                'bg-muted text-muted-foreground'
              }`}>
                {status === 'active' ? '🟢 Active' : status === 'upcoming' ? '⏳ Upcoming' : '🏁 Ended'}
              </span>
            </div>
            {selectedLeague.description && <p className="text-sm text-muted-foreground mb-3">{selectedLeague.description}</p>}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{selectedLeague.start_date} → {selectedLeague.end_date}</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{selectedLeague.member_count || 1} members</span>
            </div>
            <div className="mt-3 flex items-center gap-2 bg-muted rounded-xl p-2.5">
              <span className="text-xs text-muted-foreground">Invite code:</span>
              <span className="font-mono font-bold text-sm text-foreground tracking-widest">{selectedLeague.invite_code}</span>
              <button onClick={() => copyInviteLink(selectedLeague)} className="ml-auto">
                <Copy className="w-4 h-4 text-muted-foreground hover:text-primary" />
              </button>
            </div>
          </div>

          <div>
            <h2 className="font-heading font-semibold mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Leaderboard
            </h2>
            {board.length === 0 ? (
              <EmptyState title="No activity yet" description="Start logging activities to climb the board!" />
            ) : (
              <div className="space-y-2">
                {board.map((p, i) => (
                  <div key={p.email} className={`flex items-center gap-3 p-3 rounded-2xl border ${
                    i === 0 ? 'border-amber-500/30 bg-amber-500/5' :
                    p.email === user?.email ? 'border-primary/30 bg-primary/5' :
                    'border-border bg-card'
                  }`}>
                    {rankBadge(i)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.name}
                        {p.email === user?.email && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">You</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.total_activities} activities</p>
                    </div>
                    <div className="text-right">
                      <p className="font-heading font-bold text-sm">{p.total_km.toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground">km</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-5 h-14 flex items-center justify-between">
        <h1 className="text-xl font-heading font-bold">MyLeague</h1>
        <Button size="sm" className="rounded-full" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </div>

      <div className="p-5 space-y-5">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><LinkIcon className="w-4 h-4 text-primary" /> Join a League</p>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter invite code..."
              className="flex-1 h-9 px-3 rounded-xl border border-input bg-muted text-sm font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-ring uppercase"
              maxLength={8}
            />
            <Button size="sm" className="rounded-full" onClick={handleJoinByCode} disabled={joiningByCode || !joinCode.trim()}>
              {joiningByCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">My Leagues</h2>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : myLeagues.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No leagues yet"
              description="Create one and challenge your friends!"
              action={<Button size="sm" className="rounded-full" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> Create League</Button>}
            />
          ) : (
            <div className="space-y-3">
              {myLeagues.map(league => {
                const status = getStatus(league);
                const sport = sportConfig[league.sport];
                const SportIcon = sport?.icon || Trophy;
                return (
                  <button
                    key={league.id}
                    onClick={() => setSelectedLeague(league)}
                    className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{league.name}</h3>
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${sport?.color}`}>
                            <SportIcon className="w-2.5 h-2.5" />
                            {sport?.label || league.sport}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{league.start_date} → {league.end_date}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{league.member_count || 1}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        status === 'active' ? 'bg-emerald-500/10 text-emerald-600' :
                        status === 'upcoming' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {status === 'active' ? 'Active' : status === 'upcoming' ? 'Upcoming' : 'Ended'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateLeagueModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          user={user}
          onCreated={(league) => {
            queryClient.invalidateQueries({ queryKey: ['my-participations'] });
            queryClient.invalidateQueries({ queryKey: ['all-leagues-detail'] });
            setSelectedLeague(league);
          }}
        />
      )}
    </div>
  );
}