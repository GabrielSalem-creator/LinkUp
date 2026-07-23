import {
  COLLECTION,
  ID,
  Query,
  account,
  databases,
  dbId,
} from '@/lib/appwrite';
import {
  mapActivity,
  mapClub,
  mapEvent,
  mapEventParticipant,
  mapFriendship,
  mapLeague,
  mapLeagueParticipant,
  mapMembership,
  mapMemory,
  mapMerch,
  mapPost,
  mapUser,
} from '@/lib/mappers';
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

async function listAll(collectionId: string, queries: string[] = []) {
  const res = await databases.listDocuments({
    databaseId: dbId,
    collectionId,
    queries: [...queries, Query.limit(100)],
  });
  return res.documents;
}

async function ensureProfile(authUser: {
  $id: string;
  email?: string;
  name?: string;
}): Promise<User> {
  const email = authUser.email || `guest-${authUser.$id.slice(0, 8)}@linkup.app`;
  try {
    const existing = await databases.getDocument({
      databaseId: dbId,
      collectionId: COLLECTION.profiles,
      documentId: authUser.$id,
    });
    return mapUser(existing as never, email);
  } catch {
    const created = await databases.createDocument({
      databaseId: dbId,
      collectionId: COLLECTION.profiles,
      documentId: authUser.$id,
      data: {
        email,
        full_name: authUser.name || 'LinkUp Athlete',
        city: 'Beirut',
        total_distance_km: 0,
        total_activities: 0,
        current_streak: 0,
        longest_streak: 0,
      },
    });
    return mapUser(created as never, email);
  }
}

export const appwriteApi = {
  auth: {
    async me(): Promise<User | null> {
      try {
        const authUser = await account.get();
        return ensureProfile(authUser);
      } catch {
        return null;
      }
    },

    async loginDemo(): Promise<User> {
      try {
        await account.deleteSession({ sessionId: 'current' });
      } catch {
        /* no session */
      }
      await account.createAnonymousSession();
      const authUser = await account.get();
      return ensureProfile({ ...authUser, name: 'Demo Athlete' });
    },

    async register(email: string, password: string, name: string): Promise<User> {
      await account.create({
        userId: ID.unique(),
        email,
        password,
        name,
      });
      await account.createEmailPasswordSession({ email, password });
      const authUser = await account.get();
      return ensureProfile({ ...authUser, name });
    },

    async login(email: string, password: string): Promise<User> {
      await account.createEmailPasswordSession({ email, password });
      const authUser = await account.get();
      return ensureProfile(authUser);
    },

    async logout(): Promise<void> {
      try {
        await account.deleteSession({ sessionId: 'current' });
      } catch {
        /* ignore */
      }
    },

    async updateProfile(patch: Partial<User>): Promise<User> {
      const authUser = await account.get();
      const data: Record<string, unknown> = {};
      if (patch.full_name != null) data.full_name = patch.full_name;
      if (patch.bio != null) data.bio = patch.bio;
      if (patch.city != null) data.city = patch.city;
      if (patch.avatar_url != null) data.avatar_url = patch.avatar_url;
      if (patch.favorite_sport != null) data.favorite_sport = patch.favorite_sport;

      if (patch.full_name) {
        try {
          await account.updateName({ name: patch.full_name });
        } catch {
          /* ignore */
        }
      }

      const updated = await databases.updateDocument({
        databaseId: dbId,
        collectionId: COLLECTION.profiles,
        documentId: authUser.$id,
        data,
      });
      return mapUser(updated as never, authUser.email);
    },
  },

  clubs: {
    async list(): Promise<Club[]> {
      const docs = await listAll(COLLECTION.clubs, [Query.orderAsc('name')]);
      return docs.map((d) => mapClub(d as never));
    },
    async get(id: string): Promise<Club | null> {
      try {
        const doc = await databases.getDocument({
          databaseId: dbId,
          collectionId: COLLECTION.clubs,
          documentId: id,
        });
        return mapClub(doc as never);
      } catch {
        return null;
      }
    },
  },

  events: {
    async list(): Promise<ClubEvent[]> {
      const docs = await listAll(COLLECTION.club_events, [Query.orderAsc('date')]);
      return docs.map((d) => mapEvent(d as never));
    },
    async forClub(clubId: string): Promise<ClubEvent[]> {
      const docs = await listAll(COLLECTION.club_events, [
        Query.equal('club_id', clubId),
        Query.orderAsc('date'),
      ]);
      return docs.map((d) => mapEvent(d as never));
    },
  },

  memberships: {
    async mine(email: string): Promise<ClubMembership[]> {
      const docs = await listAll(COLLECTION.club_memberships, [
        Query.equal('user_email', email),
        Query.equal('status', 'active'),
      ]);
      return docs.map((d) => mapMembership(d as never));
    },
    async join(clubId: string, email: string): Promise<ClubMembership> {
      const existing = await listAll(COLLECTION.club_memberships, [
        Query.equal('club_id', clubId),
        Query.equal('user_email', email),
        Query.limit(1),
      ]);
      if (existing[0]) {
        const updated = await databases.updateDocument({
          databaseId: dbId,
          collectionId: COLLECTION.club_memberships,
          documentId: existing[0].$id,
          data: { status: 'active' },
        });
        return mapMembership(updated as never);
      }
      const created = await databases.createDocument({
        databaseId: dbId,
        collectionId: COLLECTION.club_memberships,
        documentId: ID.unique(),
        data: { club_id: clubId, user_email: email, status: 'active' },
      });
      try {
        const club = await databases.getDocument({
          databaseId: dbId,
          collectionId: COLLECTION.clubs,
          documentId: clubId,
        });
        await databases.updateDocument({
          databaseId: dbId,
          collectionId: COLLECTION.clubs,
          documentId: clubId,
          data: { member_count: Number(club.member_count || 0) + 1 },
        });
      } catch {
        /* ignore count bump failures */
      }
      return mapMembership(created as never);
    },
    async leave(clubId: string, email: string): Promise<void> {
      const existing = await listAll(COLLECTION.club_memberships, [
        Query.equal('club_id', clubId),
        Query.equal('user_email', email),
        Query.limit(1),
      ]);
      if (existing[0]) {
        await databases.updateDocument({
          databaseId: dbId,
          collectionId: COLLECTION.club_memberships,
          documentId: existing[0].$id,
          data: { status: 'left' },
        });
      }
    },
  },

  activities: {
    async forUser(email: string): Promise<Activity[]> {
      const docs = await listAll(COLLECTION.activities, [
        Query.equal('user_email', email),
        Query.orderDesc('date'),
      ]);
      return docs.map((d) => mapActivity(d as never));
    },
    async list(): Promise<Activity[]> {
      const docs = await listAll(COLLECTION.activities, [Query.orderDesc('date')]);
      return docs.map((d) => mapActivity(d as never));
    },
  },

  leagues: {
    async list(): Promise<League[]> {
      const docs = await listAll(COLLECTION.leagues, [Query.orderDesc('$createdAt')]);
      return docs.map((d) => mapLeague(d as never));
    },
    async mine(email: string): Promise<League[]> {
      const parts = await listAll(COLLECTION.league_participants, [
        Query.equal('user_email', email),
      ]);
      const ids = new Set(parts.map((p) => String(p.league_id)));
      const all = await this.list();
      return all.filter((l) => ids.has(l.id) || l.created_by === email);
    },
    async participants(leagueId: string): Promise<LeagueParticipant[]> {
      const docs = await listAll(COLLECTION.league_participants, [
        Query.equal('league_id', leagueId),
      ]);
      return docs.map((d) => mapLeagueParticipant(d as never));
    },
    async joinByCode(code: string, user: User): Promise<League> {
      const docs = await listAll(COLLECTION.leagues, [
        Query.equal('invite_code', code.trim().toUpperCase()),
        Query.limit(1),
      ]);
      if (!docs[0]) throw new Error('Invalid invite code');
      const league = mapLeague(docs[0] as never);
      const already = await listAll(COLLECTION.league_participants, [
        Query.equal('league_id', league.id),
        Query.equal('user_email', user.email),
        Query.limit(1),
      ]);
      if (!already[0]) {
        await databases.createDocument({
          databaseId: dbId,
          collectionId: COLLECTION.league_participants,
          documentId: ID.unique(),
          data: {
            league_id: league.id,
            user_email: user.email,
            user_name: user.full_name,
          },
        });
        await databases.updateDocument({
          databaseId: dbId,
          collectionId: COLLECTION.leagues,
          documentId: league.id,
          data: { member_count: league.member_count + 1 },
        });
        league.member_count += 1;
      }
      return league;
    },
    async create(input: Omit<League, 'id' | 'member_count' | 'status'>): Promise<League> {
      const created = await databases.createDocument({
        databaseId: dbId,
        collectionId: COLLECTION.leagues,
        documentId: ID.unique(),
        data: {
          ...input,
          invite_code: input.invite_code.toUpperCase(),
          member_count: 1,
          status: 'active',
        },
      });
      const league = mapLeague(created as never);
      await databases.createDocument({
        databaseId: dbId,
        collectionId: COLLECTION.league_participants,
        documentId: ID.unique(),
        data: {
          league_id: league.id,
          user_email: input.created_by,
          user_name: input.creator_name,
        },
      });
      return league;
    },
  },

  eventParticipants: {
    async mine(email: string): Promise<EventParticipant[]> {
      const docs = await listAll(COLLECTION.event_participants, [
        Query.equal('user_email', email),
        Query.orderAsc('event_date'),
      ]);
      return docs.map((d) => mapEventParticipant(d as never));
    },
    async join(event: ClubEvent, email: string): Promise<EventParticipant> {
      const existing = await listAll(COLLECTION.event_participants, [
        Query.equal('event_id', event.id),
        Query.equal('user_email', email),
        Query.limit(1),
      ]);
      if (existing[0]) return mapEventParticipant(existing[0] as never);
      const created = await databases.createDocument({
        databaseId: dbId,
        collectionId: COLLECTION.event_participants,
        documentId: ID.unique(),
        data: {
          event_id: event.id,
          user_email: email,
          event_date: event.date,
          event_title: event.title,
          club_name: event.club_name || '',
          confirmed: false,
        },
      });
      return mapEventParticipant(created as never);
    },
  },

  friendships: {
    async pendingFor(email: string): Promise<Friendship[]> {
      const docs = await listAll(COLLECTION.friendships, [
        Query.equal('addressee_email', email),
        Query.equal('status', 'pending'),
      ]);
      return docs.map((d) => mapFriendship(d as never));
    },
    async acceptedFor(email: string): Promise<Friendship[]> {
      const asAddressee = await listAll(COLLECTION.friendships, [
        Query.equal('addressee_email', email),
        Query.equal('status', 'accepted'),
      ]);
      const asRequester = await listAll(COLLECTION.friendships, [
        Query.equal('requester_email', email),
        Query.equal('status', 'accepted'),
      ]);
      const map = new Map<string, Friendship>();
      [...asAddressee, ...asRequester].forEach((d) => {
        const f = mapFriendship(d as never);
        map.set(f.id, f);
      });
      return [...map.values()];
    },
    async accept(id: string): Promise<void> {
      await databases.updateDocument({
        databaseId: dbId,
        collectionId: COLLECTION.friendships,
        documentId: id,
        data: { status: 'accepted' },
      });
    },
    async decline(id: string): Promise<void> {
      await databases.updateDocument({
        databaseId: dbId,
        collectionId: COLLECTION.friendships,
        documentId: id,
        data: { status: 'declined' },
      });
    },
  },

  people: {
    async list(): Promise<User[]> {
      const me = await appwriteApi.auth.me();
      const docs = await listAll(COLLECTION.profiles, [Query.orderAsc('full_name')]);
      return docs
        .map((d) => mapUser(d as never))
        .filter((u) => u.email && u.email !== me?.email);
    },
  },

  memories: {
    async forUser(email: string): Promise<Memory[]> {
      const docs = await listAll(COLLECTION.memories, [
        Query.equal('user_email', email),
        Query.orderDesc('date'),
      ]);
      return docs.map((d) => mapMemory(d as never));
    },
  },

  merch: {
    async forClub(clubId: string): Promise<MerchItem[]> {
      const docs = await listAll(COLLECTION.merch, [Query.equal('club_id', clubId)]);
      return docs.map((d) => mapMerch(d as never));
    },
  },

  posts: {
    async list(): Promise<Post[]> {
      const docs = await listAll(COLLECTION.posts, [Query.orderDesc('$createdAt')]);
      return docs.map((d) => mapPost(d as never));
    },
  },

  async verifyClubPassword(clubId: string, password: string): Promise<boolean> {
    const club = await this.clubs.get(clubId);
    if (!club?.club_password) return password === 'demo1234';
    return club.club_password === password;
  },
};
