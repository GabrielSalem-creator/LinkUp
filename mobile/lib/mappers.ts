import type { Models } from 'appwrite';

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

type Doc = Models.Document & Record<string, unknown>;

export function mapUser(doc: Doc, fallbackEmail?: string): User {
  return {
    id: doc.$id,
    email: String(doc.email || fallbackEmail || ''),
    full_name: String(doc.full_name || 'Athlete'),
    avatar_url: doc.avatar_url ? String(doc.avatar_url) : undefined,
    bio: doc.bio ? String(doc.bio) : undefined,
    city: doc.city ? String(doc.city) : undefined,
    favorite_sport: doc.favorite_sport as User['favorite_sport'],
    total_distance_km: Number(doc.total_distance_km || 0),
    total_activities: Number(doc.total_activities || 0),
    current_streak: Number(doc.current_streak || 0),
    longest_streak: Number(doc.longest_streak || 0),
    last_activity_date: doc.last_activity_date ? String(doc.last_activity_date) : undefined,
  };
}

export function mapClub(doc: Doc): Club {
  return {
    id: doc.$id,
    name: String(doc.name || ''),
    slug: String(doc.slug || ''),
    sport: doc.sport as Club['sport'],
    city: String(doc.city || ''),
    description: doc.description ? String(doc.description) : undefined,
    logo_url: doc.logo_url ? String(doc.logo_url) : undefined,
    cover_url: doc.cover_url ? String(doc.cover_url) : undefined,
    owner_email: String(doc.owner_email || ''),
    contact_email: doc.contact_email ? String(doc.contact_email) : undefined,
    club_password: doc.club_password ? String(doc.club_password) : undefined,
    member_count: Number(doc.member_count || 0),
    is_verified: Boolean(doc.is_verified),
    subscription_status: (doc.subscription_status as Club['subscription_status']) || 'inactive',
    payment_intent: Boolean(doc.payment_intent),
    instagram_link: doc.instagram_link ? String(doc.instagram_link) : undefined,
  };
}

export function mapEvent(doc: Doc): ClubEvent {
  return {
    id: doc.$id,
    club_id: String(doc.club_id || ''),
    club_name: doc.club_name ? String(doc.club_name) : undefined,
    title: String(doc.title || ''),
    description: doc.description ? String(doc.description) : undefined,
    sport: doc.sport as ClubEvent['sport'],
    date: String(doc.date || ''),
    time: doc.time ? String(doc.time) : undefined,
    meeting_point: doc.meeting_point ? String(doc.meeting_point) : undefined,
    distance_km: doc.distance_km != null ? Number(doc.distance_km) : undefined,
    cover_url: doc.cover_url ? String(doc.cover_url) : undefined,
    attendance_password: doc.attendance_password ? String(doc.attendance_password) : undefined,
    max_participants: doc.max_participants != null ? Number(doc.max_participants) : undefined,
  };
}

export function mapMembership(doc: Doc): ClubMembership {
  return {
    id: doc.$id,
    club_id: String(doc.club_id || ''),
    user_email: String(doc.user_email || ''),
    status: (doc.status as ClubMembership['status']) || 'active',
  };
}

export function mapActivity(doc: Doc): Activity {
  return {
    id: doc.$id,
    user_email: String(doc.user_email || ''),
    user_name: doc.user_name ? String(doc.user_name) : undefined,
    club_id: doc.club_id ? String(doc.club_id) : undefined,
    club_name: doc.club_name ? String(doc.club_name) : undefined,
    sport: doc.sport as Activity['sport'],
    distance_km: Number(doc.distance_km || 0),
    duration_minutes: doc.duration_minutes != null ? Number(doc.duration_minutes) : undefined,
    date: String(doc.date || ''),
    notes: doc.notes ? String(doc.notes) : undefined,
    photo_url: doc.photo_url ? String(doc.photo_url) : undefined,
  };
}

export function mapLeague(doc: Doc): League {
  return {
    id: doc.$id,
    name: String(doc.name || ''),
    sport: doc.sport as League['sport'],
    description: doc.description ? String(doc.description) : undefined,
    created_by: String(doc.created_by || ''),
    creator_name: doc.creator_name ? String(doc.creator_name) : undefined,
    invite_code: String(doc.invite_code || ''),
    start_date: String(doc.start_date || ''),
    end_date: String(doc.end_date || ''),
    status: (doc.status as League['status']) || 'active',
    max_members: Number(doc.max_members || 50),
    member_count: Number(doc.member_count || 1),
  };
}

export function mapLeagueParticipant(doc: Doc): LeagueParticipant {
  return {
    id: doc.$id,
    league_id: String(doc.league_id || ''),
    user_email: String(doc.user_email || ''),
    user_name: doc.user_name ? String(doc.user_name) : undefined,
  };
}

export function mapEventParticipant(doc: Doc): EventParticipant {
  return {
    id: doc.$id,
    event_id: String(doc.event_id || ''),
    user_email: String(doc.user_email || ''),
    event_date: String(doc.event_date || ''),
    event_title: doc.event_title ? String(doc.event_title) : undefined,
    club_name: doc.club_name ? String(doc.club_name) : undefined,
    confirmed: Boolean(doc.confirmed),
  };
}

export function mapFriendship(doc: Doc): Friendship {
  return {
    id: doc.$id,
    requester_email: String(doc.requester_email || ''),
    addressee_email: String(doc.addressee_email || ''),
    status: (doc.status as Friendship['status']) || 'pending',
    requester_name: doc.requester_name ? String(doc.requester_name) : undefined,
  };
}

export function mapMemory(doc: Doc): Memory {
  return {
    id: doc.$id,
    user_email: String(doc.user_email || ''),
    title: String(doc.title || doc.event_title || 'Memory'),
    location: doc.location ? String(doc.location) : undefined,
    photo_url: String(doc.photo_url || ''),
    date: String(doc.date || doc.event_date || ''),
    event_id: doc.event_id ? String(doc.event_id) : undefined,
    event_title: doc.event_title ? String(doc.event_title) : undefined,
    club_name: doc.club_name ? String(doc.club_name) : undefined,
  };
}

export function mapMerch(doc: Doc): MerchItem {
  return {
    id: doc.$id,
    club_id: String(doc.club_id || ''),
    name: String(doc.name || ''),
    price: Number(doc.price || 0),
    image_url: doc.image_url ? String(doc.image_url) : undefined,
    description: doc.description ? String(doc.description) : undefined,
  };
}

export function mapPost(doc: Doc): Post {
  return {
    id: doc.$id,
    user_email: String(doc.user_email || ''),
    user_name: doc.user_name ? String(doc.user_name) : undefined,
    club_id: doc.club_id ? String(doc.club_id) : undefined,
    content: String(doc.content || ''),
    photo_url: doc.photo_url ? String(doc.photo_url) : undefined,
    created_date: String(doc.created_date || doc.$createdAt || ''),
    like_count: Number(doc.like_count || 0),
  };
}
