/**
 * Read API for published competition data (public collections) + typed wrappers for the server function.
 * Community events/clubs APIs in lib/api.ts are untouched.
 */
import type { Models } from 'appwrite';

import { Query, databases, dbId } from '@/lib/appwrite';
import type {
  Competition,
  CompetitionTeam,
  LeaderboardEntry,
  Match,
  MatchPlayerStat,
  MatchTeamStat,
  Player,
  RankingEntry,
  Season,
  StandingRow,
  TeamMedia,
  TeamPlayer,
  Venue,
} from '@/lib/competition';
import { callApi } from '@/lib/serverApi';
import type { Currency, MatchTicketStatus, Order, OrderItem, PaymentAttempt, Ticket, TicketDelivery, TicketHold, TicketOffer, VenueSeat, VenueSection } from '@/lib/ticketing';

type Doc = Models.Document & Record<string, unknown>;
const s = (v: unknown) => (v == null ? undefined : String(v));
const n = (v: unknown) => (v == null ? undefined : Number(v));

async function list(collectionId: string, queries: string[] = [], max = 500): Promise<Doc[]> {
  const out: Doc[] = [];
  let cursor: string | undefined;
  while (out.length < max) {
    const page = Math.min(100, max - out.length);
    const q = [...queries, Query.limit(page)];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments({ databaseId: dbId, collectionId, queries: q });
    out.push(...(res.documents as Doc[]));
    if (res.documents.length < page) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return out;
}

async function get(collectionId: string, id: string): Promise<Doc | null> {
  try {
    return (await databases.getDocument({ databaseId: dbId, collectionId, documentId: id })) as Doc;
  } catch {
    return null;
  }
}

/* ---------------------------------- mappers ---------------------------------- */
export const mapCompetition = (d: Doc): Competition => ({
  id: d.$id,
  name: String(d.name),
  slug: String(d.slug),
  sport: d.sport as Competition['sport'],
  status: (d.status as Competition['status']) || 'published',
  division: s(d.division),
  category: s(d.category),
  gender: d.gender as Competition['gender'],
  format: s(d.format),
  logo_url: s(d.logo_url),
  country: String(d.country || 'LB'),
  tiebreak_note: s(d.tiebreak_note),
  sort: Number(d.sort || 0),
});
export const mapSeason = (d: Doc): Season => ({
  id: d.$id,
  competition_id: String(d.competition_id),
  name: String(d.name),
  start_date: String(d.start_date),
  end_date: String(d.end_date),
  status: (d.status as Season['status']) || 'active',
  is_current: Boolean(d.is_current),
  matchweeks: Number(d.matchweeks || 0),
});
export const mapTeam = (d: Doc): CompetitionTeam => ({
  id: d.$id,
  competition_id: String(d.competition_id),
  club_id: s(d.club_id),
  name: String(d.name),
  short_name: String(d.short_name || String(d.name).slice(0, 3).toUpperCase()),
  logo_url: s(d.logo_url),
  primary_color: String(d.primary_color || '#133440'),
  secondary_color: String(d.secondary_color || '#5ABDB7'),
  city: s(d.city),
});
export const mapPlayer = (d: Doc): Player => ({
  id: d.$id,
  full_name: String(d.full_name),
  nationality: String(d.nationality || ''),
  is_lebanese: Boolean(d.is_lebanese),
  position: s(d.position),
  gender: d.gender as Player['gender'],
  photo_url: s(d.photo_url),
  birth_year: n(d.birth_year),
});
export const mapTeamPlayer = (d: Doc): TeamPlayer => ({
  id: d.$id,
  season_id: String(d.season_id),
  team_id: String(d.team_id),
  player_id: String(d.player_id),
  shirt_number: n(d.shirt_number),
  role: s(d.role),
});
export const mapVenue = (d: Doc): Venue => ({
  id: d.$id,
  name: String(d.name),
  city: String(d.city),
  address: s(d.address),
  capacity: Number(d.capacity || 0),
  image_url: s(d.image_url),
});
export const mapMatch = (d: Doc): Match => ({
  id: d.$id,
  competition_id: String(d.competition_id),
  season_id: String(d.season_id),
  home_team_id: String(d.home_team_id),
  away_team_id: String(d.away_team_id),
  venue_id: s(d.venue_id),
  kickoff_at: String(d.kickoff_at),
  matchweek: n(d.matchweek),
  round_label: s(d.round_label),
  status: (d.status as Match['status']) || 'scheduled',
  home_score: n(d.home_score),
  away_score: n(d.away_score),
  score_detail: s(d.score_detail),
  published: d.published !== false,
  media_override_home: s(d.media_override_home),
  media_override_away: s(d.media_override_away),
  result_version: Number(d.result_version || 0),
  note: s(d.note),
});
export const mapTeamStat = (d: Doc): MatchTeamStat => ({ id: d.$id, match_id: String(d.match_id), team_id: String(d.team_id), stat_code: String(d.stat_code), value: Number(d.value) });
export const mapPlayerStat = (d: Doc): MatchPlayerStat => ({
  id: d.$id,
  match_id: String(d.match_id),
  team_id: String(d.team_id),
  player_id: String(d.player_id),
  stat_code: String(d.stat_code),
  value: Number(d.value),
});
export const mapStanding = (d: Doc): StandingRow => ({
  id: d.$id,
  season_id: String(d.season_id),
  team_id: String(d.team_id),
  rank: Number(d.rank),
  played: Number(d.played),
  won: Number(d.won),
  drawn: Number(d.drawn),
  lost: Number(d.lost),
  scored: Number(d.scored),
  conceded: Number(d.conceded),
  diff: Number(d.diff),
  points: Number(d.points),
  form: String(d.form || ''),
});
export const mapLeaderboard = (d: Doc): LeaderboardEntry => ({
  id: d.$id,
  season_id: String(d.season_id),
  board_code: String(d.board_code),
  player_id: String(d.player_id),
  team_id: s(d.team_id),
  rank: Number(d.rank),
  value: Number(d.value),
  games: Number(d.games),
});
export const mapRanking = (d: Doc): RankingEntry => ({
  id: d.$id,
  season_id: String(d.season_id),
  board_code: String(d.board_code),
  player_id: String(d.player_id),
  rank: Number(d.rank),
  points: Number(d.points),
  previous_rank: n(d.previous_rank),
});
export const mapMedia = (d: Doc): TeamMedia => ({
  id: d.$id,
  team_id: String(d.team_id),
  kind: d.kind as TeamMedia['kind'],
  competition_id: s(d.competition_id),
  venue_id: s(d.venue_id),
  image_url: String(d.image_url),
  sort: Number(d.sort || 0),
});
export const mapSection = (d: Doc): VenueSection => ({
  id: d.$id,
  venue_id: String(d.venue_id),
  code: String(d.code),
  name: String(d.name),
  kind: d.kind as VenueSection['kind'],
  capacity: Number(d.capacity || 0),
  rows: Number(d.rows || 0),
  seats_per_row: Number(d.seats_per_row || 0),
  geometry: String(d.geometry || '{}'),
  accessible: Boolean(d.accessible),
  sort: Number(d.sort || 0),
});
export const mapSeat = (d: Doc): VenueSeat => ({
  id: d.$id,
  venue_id: String(d.venue_id),
  section_id: String(d.section_id),
  row_label: String(d.row_label),
  seat_number: Number(d.seat_number),
  kind: (d.kind as VenueSeat['kind']) || 'standard',
  label: String(d.label),
});
export const mapOffer = (d: Doc): TicketOffer => ({
  id: d.$id,
  match_id: String(d.match_id),
  section_id: String(d.section_id),
  name: String(d.name),
  kind: d.kind as TicketOffer['kind'],
  price_minor: Number(d.price_minor),
  fee_minor: Number(d.fee_minor || 0),
  currency: String(d.currency) as Currency,
  sale_start: String(d.sale_start),
  sale_end: String(d.sale_end),
  status: d.status as TicketOffer['status'],
  max_per_order: Number(d.max_per_order || 6),
  capacity: Number(d.capacity || 0),
});

/* ----------------------------------- reads ----------------------------------- */
export const competitionApi = {
  async competitions(): Promise<Competition[]> {
    const docs = await list('competitions', [Query.equal('status', 'published'), Query.orderAsc('sort')]);
    return docs.map(mapCompetition);
  },
  async competition(id: string): Promise<Competition | null> {
    const d = await get('competitions', id);
    return d ? mapCompetition(d) : null;
  },
  async seasons(competitionId: string): Promise<Season[]> {
    const docs = await list('seasons', [Query.equal('competition_id', competitionId), Query.orderDesc('start_date')]);
    return docs.map(mapSeason);
  },
  async season(id: string): Promise<Season | null> {
    const d = await get('seasons', id);
    return d ? mapSeason(d) : null;
  },
  async teams(competitionId: string): Promise<CompetitionTeam[]> {
    const docs = await list('competition_teams', [Query.equal('competition_id', competitionId), Query.orderAsc('name')]);
    return docs.map(mapTeam);
  },
  async team(id: string): Promise<CompetitionTeam | null> {
    const d = await get('competition_teams', id);
    return d ? mapTeam(d) : null;
  },
  async matches(seasonId: string): Promise<Match[]> {
    const docs = await list('matches', [Query.equal('season_id', seasonId), Query.equal('published', true), Query.orderAsc('kickoff_at')], 1000);
    return docs.map(mapMatch);
  },
  async match(id: string): Promise<Match | null> {
    const d = await get('matches', id);
    return d && d.published !== false ? mapMatch(d) : null;
  },
  async standings(seasonId: string): Promise<StandingRow[]> {
    const docs = await list('standings', [Query.equal('season_id', seasonId), Query.orderAsc('rank')]);
    return docs.map(mapStanding);
  },
  async leaderboards(seasonId: string): Promise<LeaderboardEntry[]> {
    const docs = await list('leaderboard_entries', [Query.equal('season_id', seasonId)], 2000);
    return docs.map(mapLeaderboard).sort((a, b) => a.rank - b.rank);
  },
  async rankings(seasonId: string): Promise<RankingEntry[]> {
    const docs = await list('ranking_entries', [Query.equal('season_id', seasonId)], 2000);
    return docs.map(mapRanking).sort((a, b) => a.rank - b.rank);
  },
  async players(ids: string[]): Promise<Player[]> {
    const unique = [...new Set(ids)].filter(Boolean);
    const out: Player[] = [];
    for (let i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100);
      const docs = await list('players', [Query.equal('$id', chunk)], 100);
      out.push(...docs.map(mapPlayer));
    }
    return out;
  },
  async squad(seasonId: string, teamId: string): Promise<{ roster: TeamPlayer[]; players: Player[] }> {
    const roster = (await list('team_players', [Query.equal('season_id', seasonId), Query.equal('team_id', teamId)])).map(mapTeamPlayer);
    const players = await this.players(roster.map((r) => r.player_id));
    return { roster, players };
  },
  async venue(id: string): Promise<Venue | null> {
    const d = await get('venues', id);
    return d ? mapVenue(d) : null;
  },
  async sections(venueId: string): Promise<VenueSection[]> {
    const docs = await list('venue_sections', [Query.equal('venue_id', venueId), Query.orderAsc('sort')]);
    return docs.map(mapSection);
  },
  async seats(sectionId: string): Promise<VenueSeat[]> {
    const docs = await list('venue_seats', [Query.equal('section_id', sectionId)], 2000);
    return docs.map(mapSeat).sort((a, b) => a.row_label.localeCompare(b.row_label) || a.seat_number - b.seat_number);
  },
  async matchStats(matchId: string): Promise<{ team: MatchTeamStat[]; players: MatchPlayerStat[] }> {
    const [t, p] = await Promise.all([list('match_team_stats', [Query.equal('match_id', matchId)]), list('match_player_stats', [Query.equal('match_id', matchId)], 1000)]);
    return { team: t.map(mapTeamStat), players: p.map(mapPlayerStat) };
  },
  async media(teamIds: string[]): Promise<TeamMedia[]> {
    const unique = [...new Set(teamIds)].filter(Boolean);
    if (!unique.length) return [];
    const docs = await list('team_media', [Query.equal('team_id', unique)], 500);
    return docs.map(mapMedia);
  },
  /** IDs of matches that currently have an on-sale offer (sale window open). */
  async ticketedMatches(matchIds: string[]): Promise<Set<string>> {
    const out = new Set<string>();
    const now = Date.now();
    for (let i = 0; i < matchIds.length; i += 100) {
      const chunk = matchIds.slice(i, i + 100);
      if (!chunk.length) continue;
      const docs = await list('ticket_offers', [Query.equal('match_id', chunk), Query.equal('status', 'on_sale')], 1000);
      for (const d of docs.map(mapOffer)) {
        if (Date.parse(d.sale_start) <= now && Date.parse(d.sale_end) >= now) out.add(d.match_id);
      }
    }
    return out;
  },
  async offers(matchId: string): Promise<TicketOffer[]> {
    const docs = await list('ticket_offers', [Query.equal('match_id', matchId)]);
    return docs.map(mapOffer);
  },
  async settings(): Promise<{ competition_enabled: boolean; checkout_enabled: boolean; provider: string; hold_ttl_seconds: number; currency: Currency } | null> {
    const d = await get('app_settings', 'ticketing');
    if (!d) return null;
    return {
      competition_enabled: Boolean(d.competition_enabled),
      checkout_enabled: Boolean(d.checkout_enabled),
      provider: String(d.provider || 'none'),
      hold_ttl_seconds: Number(d.hold_ttl_seconds || 600),
      currency: String(d.currency || 'USD') as Currency,
    };
  },
};

/* ------------------------------ server (function) ------------------------------ */
export type AvailabilityOffer = TicketOffer & {
  sellable: boolean;
  window_reason: string | null;
  available: number;
  unavailable_units?: string[];
  section: VenueSection | null;
  mine: string[] | null;
};
export type Availability = {
  match_id: string;
  status: { status: MatchTicketStatus; fromMinor?: number; currency?: Currency; available: number };
  offers: AvailabilityOffer[];
  server_time: string;
};
export type OrderDetail = {
  order: Order;
  items: OrderItem[];
  attempt: PaymentAttempt | null;
  tickets: Ticket[];
  deliveries: TicketDelivery[];
  hold: TicketHold | null;
  checkout: { enabled: boolean; provider: string; test_mode: boolean; refunds_enabled: boolean };
  server_time: string;
};
export type TicketDetail = {
  ticket: Ticket;
  credential: string | null;
  match: Match | null;
  order: { id: string; state: Order['state']; total_minor: number; currency: Currency } | null;
  delivery: TicketDelivery | null;
};

export const ticketingApi = {
  availability: (matchId: string) => callApi<Availability>('GET', `/matches/${encodeURIComponent(matchId)}/availability`),
  createHold: (input: { matchId: string; offerId: string; quantity?: number; unitKeys?: string[] }) => callApi<TicketHold>('POST', '/holds', input),
  cancelHold: (holdId: string) => callApi<{ ok: boolean }>('DELETE', `/holds/${encodeURIComponent(holdId)}`),
  createOrder: (input: { holdId: string; idempotencyKey: string; acceptRepricing?: boolean }) =>
    callApi<{ order: Order; repriced: { from: number; to: number } | null; idempotent: boolean }>('POST', '/orders', input),
  order: (id: string) => callApi<OrderDetail>('GET', `/orders/${encodeURIComponent(id)}`),
  orders: () => callApi<Order[]>('GET', '/orders'),
  checkout: (id: string, returnUrl?: string) =>
    callApi<{ attempt_id: string; checkout_url: string; provider: string; test_mode: boolean }>('POST', `/orders/${encodeURIComponent(id)}/checkout`, { returnUrl }),
  cancel: (id: string) => callApi<{ ok: boolean; state: Order['state']; refunds_enabled?: boolean }>('POST', `/orders/${encodeURIComponent(id)}/cancel`),
  sync: (id: string) => callApi<{ state: Order['state']; synced: boolean; provider_state?: string; result?: string }>('POST', `/orders/${encodeURIComponent(id)}/sync`),
  fakeComplete: (attemptId: string, outcome: 'success' | 'decline' | 'cancel' | 'pending') =>
    callApi<{ ok: boolean; webhook?: { result: string } }>('POST', '/payments/fake/complete', { attemptId, outcome }),
  tickets: () => callApi<Ticket[]>('GET', '/tickets'),
  ticket: (id: string) => callApi<TicketDetail>('GET', `/tickets/${encodeURIComponent(id)}`),
  validate: (credential: string, dryRun = false) =>
    callApi<{ ok: boolean; state: string; ticket: { id: string; match_id: string; section_name: string; seat_label: string | null } }>('POST', '/tickets/validate', { credential, dryRun }),
  retryDelivery: (id: string) => callApi<TicketDelivery>('POST', `/deliveries/${encodeURIComponent(id)}/retry`),
};

export const adminApi = {
  createMatch: (input: Record<string, unknown>) => callApi<Match>('POST', '/admin/matches', input),
  updateMatch: (id: string, input: Record<string, unknown>) => callApi<{ match: Match; recalculated: unknown }>('PATCH', `/admin/matches/${encodeURIComponent(id)}`, input),
  setStats: (id: string, input: Record<string, unknown>) => callApi<{ ok: boolean; result_version: number }>('PUT', `/admin/matches/${encodeURIComponent(id)}/stats`, input),
  setRankings: (input: Record<string, unknown>) => callApi<{ ok: boolean }>('PUT', '/admin/rankings', input),
  updateSettings: (input: Record<string, unknown>) => callApi<Record<string, unknown>>('PATCH', '/admin/settings', input),
  corrections: (matchId?: string) => callApi<Record<string, unknown>[]>('GET', `/admin/corrections${matchId ? `?match_id=${encodeURIComponent(matchId)}` : ''}`),
  recalc: (seasonId: string) => callApi<{ standings: number; leaderboards: number }>('POST', `/admin/seasons/${encodeURIComponent(seasonId)}/recalculate`),
  runJobs: () => callApi<Record<string, unknown>>('POST', '/admin/jobs/run'),
};
