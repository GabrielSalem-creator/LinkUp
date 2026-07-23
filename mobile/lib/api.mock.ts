/**
 * Local mock data layer (offline / no Appwrite).
 */

import {
  ACTIVITIES,
  CLUBS,
  CURRENT_USER,
  EVENT_PARTICIPANTS,
  EVENTS,
  FRIENDSHIPS,
  LEAGUE_PARTICIPANTS,
  LEAGUES,
  MEMBERSHIPS,
  MEMORIES,
  MERCH,
  POSTS,
  USERS,
} from '@/data/mock';
import type {
  Activity,
  Club,
  ClubEvent,
  ClubMembership,
  EventParticipant,
  Friendship,
  League,
  LeagueParticipant,
  Memory,
  MerchItem,
  Post,
  User,
} from '@/types';

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

let sessionUser: User | null = { ...CURRENT_USER };
let memberships = [...MEMBERSHIPS];
let friendships = [...FRIENDSHIPS];
let eventParticipants = [...EVENT_PARTICIPANTS];
let leagueParticipants = [...LEAGUE_PARTICIPANTS];
let leagues = [...LEAGUES];

export const mockApi = {
  auth: {
    async me(): Promise<User | null> {
      await delay(150);
      return sessionUser ? { ...sessionUser } : null;
    },
    async loginDemo(): Promise<User> {
      await delay(200);
      sessionUser = { ...CURRENT_USER };
      return { ...sessionUser };
    },
    async login(_email: string, _password: string): Promise<User> {
      return this.loginDemo();
    },
    async register(_email: string, _password: string, name: string): Promise<User> {
      await delay(200);
      sessionUser = { ...CURRENT_USER, full_name: name || CURRENT_USER.full_name };
      return { ...sessionUser };
    },
    async logout(): Promise<void> {
      await delay(100);
      sessionUser = null;
    },
    async updateProfile(patch: Partial<User>): Promise<User> {
      await delay(200);
      if (!sessionUser) throw new Error('Not authenticated');
      sessionUser = { ...sessionUser, ...patch };
      return { ...sessionUser };
    },
  },

  clubs: {
    async list(): Promise<Club[]> {
      await delay();
      return [...CLUBS].sort((a, b) => a.name.localeCompare(b.name));
    },
    async get(id: string): Promise<Club | null> {
      await delay();
      return CLUBS.find((c) => c.id === id) ?? null;
    },
  },

  events: {
    async list(): Promise<ClubEvent[]> {
      await delay();
      return [...EVENTS].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    },
    async forClub(clubId: string): Promise<ClubEvent[]> {
      await delay();
      return EVENTS.filter((e) => e.club_id === clubId).sort((a, b) => a.date.localeCompare(b.date));
    },
  },

  memberships: {
    async mine(email: string): Promise<ClubMembership[]> {
      await delay();
      return memberships.filter((m) => m.user_email === email && m.status === 'active');
    },
    async join(clubId: string, email: string): Promise<ClubMembership> {
      await delay(200);
      const existing = memberships.find((m) => m.club_id === clubId && m.user_email === email);
      if (existing) {
        existing.status = 'active';
        return { ...existing };
      }
      const m: ClubMembership = {
        id: `m-${Date.now()}`,
        club_id: clubId,
        user_email: email,
        status: 'active',
      };
      memberships.push(m);
      return { ...m };
    },
    async leave(clubId: string, email: string): Promise<void> {
      await delay(200);
      memberships = memberships.map((m) =>
        m.club_id === clubId && m.user_email === email ? { ...m, status: 'left' as const } : m
      );
    },
  },

  activities: {
    async forUser(email: string): Promise<Activity[]> {
      await delay();
      return ACTIVITIES.filter((a) => a.user_email === email).sort((a, b) => b.date.localeCompare(a.date));
    },
    async list(): Promise<Activity[]> {
      await delay();
      return [...ACTIVITIES];
    },
  },

  leagues: {
    async list(): Promise<League[]> {
      await delay();
      return [...leagues];
    },
    async mine(email: string): Promise<League[]> {
      await delay();
      const ids = new Set(leagueParticipants.filter((p) => p.user_email === email).map((p) => p.league_id));
      return leagues.filter((l) => ids.has(l.id) || l.created_by === email);
    },
    async participants(leagueId: string): Promise<LeagueParticipant[]> {
      await delay();
      return leagueParticipants.filter((p) => p.league_id === leagueId);
    },
    async joinByCode(code: string, user: User): Promise<League> {
      await delay(300);
      const league = leagues.find((l) => l.invite_code.toUpperCase() === code.trim().toUpperCase());
      if (!league) throw new Error('Invalid invite code');
      const already = leagueParticipants.some((p) => p.league_id === league.id && p.user_email === user.email);
      if (!already) {
        leagueParticipants.push({
          id: `lp-${Date.now()}`,
          league_id: league.id,
          user_email: user.email,
          user_name: user.full_name,
        });
        league.member_count += 1;
      }
      return { ...league };
    },
    async create(input: Omit<League, 'id' | 'member_count' | 'status'>): Promise<League> {
      await delay(300);
      const league: League = {
        ...input,
        id: `lg-${Date.now()}`,
        member_count: 1,
        status: 'active',
      };
      leagues = [league, ...leagues];
      leagueParticipants.push({
        id: `lp-${Date.now()}`,
        league_id: league.id,
        user_email: input.created_by,
        user_name: input.creator_name,
      });
      return league;
    },
  },

  eventParticipants: {
    async mine(email: string): Promise<EventParticipant[]> {
      await delay();
      return eventParticipants
        .filter((p) => p.user_email === email)
        .sort((a, b) => a.event_date.localeCompare(b.event_date));
    },
    async join(event: ClubEvent, email: string): Promise<EventParticipant> {
      await delay(200);
      const existing = eventParticipants.find((p) => p.event_id === event.id && p.user_email === email);
      if (existing) return { ...existing };
      const ep: EventParticipant = {
        id: `ep-${Date.now()}`,
        event_id: event.id,
        user_email: email,
        event_date: event.date,
        event_title: event.title,
        club_name: event.club_name,
      };
      eventParticipants.push(ep);
      return { ...ep };
    },
  },

  friendships: {
    async pendingFor(email: string): Promise<Friendship[]> {
      await delay();
      return friendships.filter((f) => f.addressee_email === email && f.status === 'pending');
    },
    async acceptedFor(email: string): Promise<Friendship[]> {
      await delay();
      return friendships.filter(
        (f) => f.status === 'accepted' && (f.addressee_email === email || f.requester_email === email)
      );
    },
    async accept(id: string): Promise<void> {
      await delay(200);
      friendships = friendships.map((f) => (f.id === id ? { ...f, status: 'accepted' as const } : f));
    },
    async decline(id: string): Promise<void> {
      await delay(200);
      friendships = friendships.map((f) => (f.id === id ? { ...f, status: 'declined' as const } : f));
    },
  },

  people: {
    async list(): Promise<User[]> {
      await delay();
      return USERS.filter((u) => u.email !== sessionUser?.email);
    },
  },

  memories: {
    async forUser(email: string): Promise<Memory[]> {
      await delay();
      return MEMORIES.filter((m) => m.user_email === email);
    },
  },

  merch: {
    async forClub(clubId: string): Promise<MerchItem[]> {
      await delay();
      return MERCH.filter((m) => m.club_id === clubId);
    },
  },

  posts: {
    async list(): Promise<Post[]> {
      await delay();
      return [...POSTS];
    },
  },

  /** Verify club portal password (demo: any club with club_password, or "demo1234" for club-1) */
  async verifyClubPassword(clubId: string, password: string): Promise<boolean> {
    await delay(200);
    const club = CLUBS.find((c) => c.id === clubId);
    if (!club?.club_password) return password === 'demo1234';
    return club.club_password === password;
  },
};
