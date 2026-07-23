import 'react-native-url-polyfill/auto';

import { Account, Client, Databases, ID, Permission, Query, Role, Storage } from 'appwrite';

import { config } from '@/lib/config';

export const client = new Client()
  .setEndpoint(config.appwriteEndpoint)
  .setProject(config.appwriteProjectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export { ID, Permission, Query, Role };

export const dbId = config.appwriteDatabaseId;

export const COLLECTION = {
  profiles: 'profiles',
  clubs: 'clubs',
  club_events: 'club_events',
  club_memberships: 'club_memberships',
  activities: 'activities',
  leagues: 'leagues',
  league_participants: 'league_participants',
  event_participants: 'event_participants',
  friendships: 'friendships',
  memories: 'memories',
  merch: 'merch',
  posts: 'posts',
} as const;

export type CollectionKey = keyof typeof COLLECTION;
