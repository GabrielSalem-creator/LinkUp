export type Sport =
  | 'running'
  | 'walking'
  | 'biking'
  | 'swimming'
  | 'hyrox'
  | 'triathlon'
  | 'crossfit'
  | 'yoga'
  | 'hiking'
  | 'tennis'
  | 'pilates'
  | 'other';

export type LeagueSport =
  | 'running_walking'
  | 'walking'
  | 'biking'
  | 'swimming'
  | 'hyrox'
  | 'triathlon'
  | 'crossfit'
  | 'yoga'
  | 'hiking'
  | 'tennis'
  | 'pilates'
  | 'other';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  favorite_sport?: Sport;
  total_distance_km: number;
  total_activities: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date?: string;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  sport: Sport;
  city: string;
  description?: string;
  logo_url?: string;
  cover_url?: string;
  owner_email: string;
  contact_email?: string;
  club_password?: string;
  member_count: number;
  is_verified: boolean;
  subscription_status: 'inactive' | 'active' | 'cancelled';
  payment_intent?: boolean;
  instagram_link?: string;
}

export interface ClubEvent {
  id: string;
  club_id: string;
  club_name?: string;
  title: string;
  description?: string;
  sport?: Sport;
  date: string;
  time?: string;
  meeting_point?: string;
  distance_km?: number;
  cover_url?: string;
  attendance_password?: string;
  max_participants?: number;
}

export interface ClubMembership {
  id: string;
  club_id: string;
  user_email: string;
  status: 'active' | 'pending' | 'left';
}

export interface Activity {
  id: string;
  user_email: string;
  user_name?: string;
  club_id?: string;
  club_name?: string;
  sport: Sport;
  distance_km: number;
  duration_minutes?: number;
  date: string;
  notes?: string;
  photo_url?: string;
}

export interface League {
  id: string;
  name: string;
  sport: LeagueSport;
  description?: string;
  created_by: string;
  creator_name?: string;
  invite_code: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'active' | 'completed';
  max_members: number;
  member_count: number;
}

export interface LeagueParticipant {
  id: string;
  league_id: string;
  user_email: string;
  user_name?: string;
}

export interface EventParticipant {
  id: string;
  event_id: string;
  user_email: string;
  event_date: string;
  event_title?: string;
  club_name?: string;
  confirmed?: boolean;
}

export interface Friendship {
  id: string;
  requester_email: string;
  addressee_email: string;
  status: 'pending' | 'accepted' | 'declined';
  requester_name?: string;
}

export interface Memory {
  id: string;
  user_email: string;
  title: string;
  location?: string;
  photo_url: string;
  date: string;
  event_id?: string;
  event_title?: string;
  club_name?: string;
}

export interface MerchItem {
  id: string;
  club_id: string;
  name: string;
  price: number;
  image_url?: string;
  description?: string;
}

export interface Post {
  id: string;
  user_email: string;
  user_name?: string;
  club_id?: string;
  content: string;
  photo_url?: string;
  created_date: string;
  like_count: number;
}
