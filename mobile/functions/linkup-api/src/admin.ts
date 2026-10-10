/**
 * App-admin privileged mutations: matches, results, statistics, rankings, settings.
 * Every write is authorised (app-admins team), validated against the fixed registry, and audited.
 */
import { getRankingBoardDefinition, getSportDefinition } from '../../../lib/competition/registry.ts';
import { rankEntries } from '../../../lib/competition/standings.ts';
import { assertMatchTransition, DomainError } from '../../../lib/competition/states.ts';
import type { CompetitionSport, MatchStatus } from '../../../lib/competition/types.ts';
import { assertSport, isIsoDateTime, validateReason, validateScore, validateStatLine } from '../../../lib/competition/validation.ts';
import { recalculateSeason } from './competition.ts';
import { COL, detId, int, mustGet, publicDoc, randomId, requireAdmin, str, type AppContext, type RequestContext } from './context.ts';
import type { Doc } from './db.ts';

type Body = Record<string, unknown>;

async function audit(
  ctx: AppContext,
  req: RequestContext,
  actorId: string,
  entry: { match_id?: string; target_type: string; target_id?: string; stat_code?: string; before: unknown; after: unknown; reason: string },
) {
  await ctx.db.create(COL.corrections, randomId('cr'), {
    match_id: entry.match_id ?? null,
    target_type: entry.target_type,
    target_id: entry.target_id ?? null,
    stat_code: entry.stat_code ?? null,
    before_json: JSON.stringify(entry.before ?? null).slice(0, 20000),
    after_json: JSON.stringify(entry.after ?? null).slice(0, 20000),
    reason: entry.reason,
    actor_id: actorId,
    correlation_id: req.correlationId,
    created_at: ctx.now().toISOString(),
  });
}

async function sportOf(ctx: AppContext, competitionId: string): Promise<CompetitionSport> {
  const c = mustGet(await ctx.db.get(COL.competitions, competitionId), 'Competition');
  assertSport(c.sport);
  return c.sport;
}

export async function createMatch(ctx: AppContext, req: RequestContext, body: Body) {
  const actor = await requireAdmin(ctx, req);
  const competition_id = str(body.competition_id, 'competition_id')!;
  const season_id = str(body.season_id, 'season_id')!;
  const home_team_id = str(body.home_team_id, 'home_team_id')!;
  const away_team_id = str(body.away_team_id, 'away_team_id')!;
  const venue_id = str(body.venue_id, 'venue_id', { optional: true });
  const kickoff_at = body.kickoff_at;
  if (!isIsoDateTime(kickoff_at)) throw new DomainError('invalid_input', 'kickoff_at must be an ISO datetime');
  if (home_team_id === away_team_id) throw new DomainError('invalid_input', 'Home and away teams must differ');
  const season = mustGet(await ctx.db.get(COL.seasons, season_id), 'Season');
  if (season.competition_id !== competition_id) throw new DomainError('invalid_input', 'Season does not belong to competition');
  const sport = await sportOf(ctx, competition_id);
  if (!getSportDefinition(sport).features.fixtures) throw new DomainError('unsupported', `${sport} has no fixtures in V1`);
  for (const tid of [home_team_id, away_team_id]) {
    const t = mustGet(await ctx.db.get(COL.teams, tid), `Team ${tid}`);
    if (t.competition_id !== competition_id) throw new DomainError('invalid_input', `Team ${tid} is not in this competition`);
  }
  if (venue_id) mustGet(await ctx.db.get(COL.venues, venue_id), 'Venue');
  const id = randomId('m');
  const data = {
    competition_id,
    season_id,
    home_team_id,
    away_team_id,
    venue_id: venue_id ?? null,
    kickoff_at: new Date(kickoff_at).toISOString(),
    matchweek: int(body.matchweek, 'matchweek', { optional: true, min: 1 }) ?? null,
    round_label: str(body.round_label, 'round_label', { optional: true, max: 80 }) ?? null,
    status: 'scheduled',
    published: body.published === false ? false : true,
    result_version: 0,
    note: str(body.note, 'note', { optional: true, max: 500 }) ?? null,
  };
  const doc = await ctx.db.create(COL.matches, id, data);
  await audit(ctx, req, actor, { match_id: id, target_type: 'match', target_id: id, before: null, after: data, reason: 'create match' });
  return publicDoc(doc);
}

const EDITABLE = ['kickoff_at', 'venue_id', 'matchweek', 'round_label', 'note', 'media_override_home', 'media_override_away', 'published'] as const;

export async function updateMatch(ctx: AppContext, req: RequestContext, matchId: string, body: Body) {
  const actor = await requireAdmin(ctx, req);
  const match = mustGet(await ctx.db.get(COL.matches, matchId), 'Match');
  const expectedVersion = int(body.expectedVersion, 'expectedVersion', { min: 0 })!;
  if (Number(match.result_version) !== expectedVersion) {
    throw new DomainError('conflict', 'This match was changed by someone else. Reload and try again.', 409);
  }
  const sport = await sportOf(ctx, String(match.competition_id));
  const from = match.status as MatchStatus;
  const to = (body.status as MatchStatus | undefined) ?? from;
  const reason = validateReason(body.reason);
  assertMatchTransition(from, to);

  const patch: Record<string, unknown> = {};
  const touchesResult = body.home_score != null || body.away_score != null || body.score_detail != null || to !== from;

  if (touchesResult) {
    if (to === 'final' || to === 'live' || body.home_score != null || body.away_score != null) {
      const home = int(body.home_score ?? match.home_score, 'home_score', { min: 0 });
      const away = int(body.away_score ?? match.away_score, 'away_score', { min: 0 });
      if (to === 'final' && (home == null || away == null)) throw new DomainError('invalid_input', 'A final match needs both scores');
      if (home != null && away != null) {
        let sets: [number, number][] | undefined;
        const detailRaw = body.score_detail ?? match.score_detail;
        if (detailRaw) {
          try {
            const parsed = typeof detailRaw === 'string' ? JSON.parse(detailRaw) : detailRaw;
            if (parsed && Array.isArray(parsed.sets)) sets = parsed.sets;
            patch.score_detail = JSON.stringify(parsed).slice(0, 4000);
          } catch {
            throw new DomainError('invalid_input', 'score_detail must be JSON');
          }
        }
        validateScore(sport, { home, away, sets }, to);
        patch.home_score = home;
        patch.away_score = away;
      }
    }
    if (to === 'scheduled' || to === 'postponed' || to === 'cancelled') {
      if (body.clear_scores === true) {
        patch.home_score = null;
        patch.away_score = null;
        patch.score_detail = null;
      }
    }
    patch.status = to;
  }

  for (const k of EDITABLE) {
    if (body[k] === undefined) continue;
    if (k === 'kickoff_at') {
      if (!isIsoDateTime(body[k])) throw new DomainError('invalid_input', 'kickoff_at must be an ISO datetime');
      patch[k] = new Date(body[k] as string).toISOString();
    } else if (k === 'matchweek') patch[k] = int(body[k], k, { optional: true, min: 1 }) ?? null;
    else if (k === 'published') patch[k] = Boolean(body[k]);
    else if (k === 'venue_id') {
      const v = str(body[k], k, { optional: true });
      if (v) mustGet(await ctx.db.get(COL.venues, v), 'Venue');
      patch[k] = v ?? null;
    } else patch[k] = str(body[k], k, { optional: true, max: 2048 }) ?? null;
  }
  if (!Object.keys(patch).length) throw new DomainError('invalid_input', 'Nothing to update');

  patch.result_version = expectedVersion + 1;
  const before = Object.fromEntries(Object.keys(patch).map((k) => [k, match[k]]));
  const updated = await ctx.db.update(COL.matches, matchId, patch);
  await audit(ctx, req, actor, {
    match_id: matchId,
    target_type: touchesResult ? (to !== from ? 'status' : 'score') : 'match',
    target_id: matchId,
    before,
    after: patch,
    reason,
  });
  let recalculated = null;
  if (touchesResult || body.published !== undefined) recalculated = await recalculateSeason(ctx, String(match.season_id));
  return { match: publicDoc(updated), recalculated };
}

export async function setMatchStats(ctx: AppContext, req: RequestContext, matchId: string, body: Body) {
  const actor = await requireAdmin(ctx, req);
  const match = mustGet(await ctx.db.get(COL.matches, matchId), 'Match');
  const expectedVersion = int(body.expectedVersion, 'expectedVersion', { min: 0 })!;
  if (Number(match.result_version) !== expectedVersion) {
    throw new DomainError('conflict', 'This match was changed by someone else. Reload and try again.', 409);
  }
  if (match.status === 'cancelled') throw new DomainError('invalid_transition', 'Cannot record statistics for a cancelled match', 409);
  const reason = validateReason(body.reason);
  const sport = await sportOf(ctx, String(match.competition_id));
  const teamIds = new Set([String(match.home_team_id), String(match.away_team_id)]);

  const teamLines = Array.isArray(body.team) ? (body.team as Body[]) : [];
  const playerLines = Array.isArray(body.players) ? (body.players as Body[]) : [];
  if (teamLines.length > 200 || playerLines.length > 2000) throw new DomainError('invalid_input', 'Too many stat lines');

  const playerCache = new Map<string, Doc>();
  const wantTeam = new Map<string, Record<string, unknown>>();
  for (const l of teamLines) {
    const team_id = str(l.team_id, 'team_id')!;
    if (!teamIds.has(team_id)) throw new DomainError('invalid_input', `Team ${team_id} is not playing this match`);
    const stat_code = str(l.stat_code, 'stat_code')!;
    const value = Number(l.value);
    validateStatLine(sport, 'team', { stat_code, value });
    wantTeam.set(detId('mts', matchId, team_id, stat_code), { match_id: matchId, team_id, stat_code, value });
  }
  const wantPlayer = new Map<string, Record<string, unknown>>();
  for (const l of playerLines) {
    const team_id = str(l.team_id, 'team_id')!;
    const player_id = str(l.player_id, 'player_id')!;
    if (!teamIds.has(team_id)) throw new DomainError('invalid_input', `Team ${team_id} is not playing this match`);
    if (!playerCache.has(player_id)) playerCache.set(player_id, mustGet(await ctx.db.get(COL.players, player_id), `Player ${player_id}`));
    const player = playerCache.get(player_id)!;
    const stat_code = str(l.stat_code, 'stat_code')!;
    const value = Number(l.value);
    validateStatLine(sport, 'player', { stat_code, value, position: player.position ? String(player.position) : undefined });
    wantPlayer.set(detId('mps', matchId, player_id, stat_code), { match_id: matchId, team_id, player_id, stat_code, value });
  }

  const sync = async (collection: string, want: Map<string, Record<string, unknown>>) => {
    const existing = await ctx.db.list(collection, { where: [['match_id', 'eq', matchId]] });
    const before = existing.map((e) => publicDoc(e));
    const byId = new Map(existing.map((e) => [e.$id, e]));
    for (const [id, data] of want) {
      if (byId.has(id)) await ctx.db.update(collection, id, data);
      else await ctx.db.create(collection, id, data);
    }
    for (const e of existing) if (!want.has(e.$id)) await ctx.db.delete(collection, e.$id);
    return before;
  };
  const beforeTeam = await sync(COL.teamStats, wantTeam);
  const beforePlayer = await sync(COL.playerStats, wantPlayer);
  await ctx.db.update(COL.matches, matchId, { result_version: expectedVersion + 1 });
  await audit(ctx, req, actor, {
    match_id: matchId,
    target_type: playerLines.length ? 'player_stat' : 'team_stat',
    target_id: matchId,
    before: { team: beforeTeam, players: beforePlayer },
    after: { team: [...wantTeam.values()], players: [...wantPlayer.values()] },
    reason,
  });
  const recalculated = await recalculateSeason(ctx, String(match.season_id));
  return { ok: true, result_version: expectedVersion + 1, recalculated };
}

export async function setRankings(ctx: AppContext, req: RequestContext, body: Body) {
  const actor = await requireAdmin(ctx, req);
  const season_id = str(body.season_id, 'season_id')!;
  const board_code = str(body.board_code, 'board_code')!;
  const reason = validateReason(body.reason);
  const season = mustGet(await ctx.db.get(COL.seasons, season_id), 'Season');
  const sport = await sportOf(ctx, String(season.competition_id));
  const board = getRankingBoardDefinition(sport, board_code);
  if (!board) throw new DomainError('unknown_board', `Unknown ranking board ${board_code} for ${sport}`);
  const entries = Array.isArray(body.entries) ? (body.entries as Body[]) : [];
  if (entries.length > 500) throw new DomainError('invalid_input', 'Too many entries');
  const names = new Map<string, string>();
  const clean: { player_id: string; points: number; previous_rank?: number }[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const player_id = str(e.player_id, 'player_id')!;
    if (seen.has(player_id)) throw new DomainError('invalid_input', `Duplicate player ${player_id}`);
    seen.add(player_id);
    const points = Number(e.points);
    if (!Number.isFinite(points) || points < 0) throw new DomainError('invalid_value', 'Points must be a non-negative number');
    const p = mustGet(await ctx.db.get(COL.players, player_id), `Player ${player_id}`);
    if (board.gender && p.gender && p.gender !== board.gender) {
      throw new DomainError('invalid_input', `${p.full_name} cannot be ranked on a ${board.gender} board`);
    }
    names.set(player_id, String(p.full_name));
    clean.push({ player_id, points });
  }
  const existing = await ctx.db.list(COL.rankings, { where: [['season_id', 'eq', season_id], ['board_code', 'eq', board_code]] });
  const prevRank = new Map(existing.map((e) => [String(e.player_id), Number(e.rank)]));
  const ranked = rankEntries(clean, (id) => names.get(id) ?? id, board.limit);
  const keep = new Set<string>();
  for (const r of ranked) {
    const id = detId('rk', season_id, board_code, r.player_id);
    keep.add(id);
    const data = { season_id, board_code, player_id: r.player_id, rank: r.rank, points: r.points, previous_rank: prevRank.get(r.player_id) ?? null };
    if (existing.some((e) => e.$id === id)) await ctx.db.update(COL.rankings, id, data);
    else await ctx.db.create(COL.rankings, id, data);
  }
  for (const e of existing) if (!keep.has(e.$id)) await ctx.db.delete(COL.rankings, e.$id);
  await audit(ctx, req, actor, {
    target_type: 'ranking',
    target_id: `${season_id}:${board_code}`,
    before: existing.map((e) => publicDoc(e)),
    after: ranked,
    reason,
  });
  return { ok: true, entries: ranked };
}

export async function updateSettings(ctx: AppContext, req: RequestContext, body: Body) {
  const actor = await requireAdmin(ctx, req);
  const reason = validateReason(body.reason);
  const cur = mustGet(await ctx.db.get(COL.settings, 'ticketing'), 'Settings');
  const patch: Record<string, unknown> = {};
  for (const k of ['competition_enabled', 'checkout_enabled', 'refunds_enabled'] as const) {
    if (typeof body[k] === 'boolean') patch[k] = body[k];
  }
  if (body.hold_ttl_seconds != null) patch.hold_ttl_seconds = int(body.hold_ttl_seconds, 'hold_ttl_seconds', { min: 60, max: 3600 });
  if (!Object.keys(patch).length) throw new DomainError('invalid_input', 'Nothing to update');
  const updated = await ctx.db.update(COL.settings, 'ticketing', patch);
  await audit(ctx, req, actor, {
    target_type: 'match',
    target_id: 'settings',
    before: Object.fromEntries(Object.keys(patch).map((k) => [k, cur[k]])),
    after: patch,
    reason,
  });
  return publicDoc(updated);
}

export async function listCorrections(ctx: AppContext, req: RequestContext, matchId?: string) {
  await requireAdmin(ctx, req);
  const docs = await ctx.db.list(COL.corrections, {
    where: matchId ? [['match_id', 'eq', matchId]] : undefined,
    orderBy: [{ field: 'created_at', dir: 'desc' }],
    limit: 200,
  });
  return docs.map((d) => publicDoc(d));
}

export async function recalc(ctx: AppContext, req: RequestContext, seasonId: string) {
  await requireAdmin(ctx, req);
  return recalculateSeason(ctx, seasonId);
}
