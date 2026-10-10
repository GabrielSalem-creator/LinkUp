/**
 * Server-derived standings / leaderboards. Recomputed after every accepted result or stat correction.
 */
import { computeLeaderboards, computeStandings } from '../../../lib/competition/standings.ts';
import type { CompetitionSport } from '../../../lib/competition/types.ts';
import { assertSport } from '../../../lib/competition/validation.ts';
import { COL, detId, mustGet, type AppContext } from './context.ts';
import type { Doc } from './db.ts';

export async function recalculateSeason(ctx: AppContext, seasonId: string): Promise<{ standings: number; leaderboards: number }> {
  const season = mustGet(await ctx.db.get(COL.seasons, seasonId), 'Season');
  const competition = mustGet(await ctx.db.get(COL.competitions, String(season.competition_id)), 'Competition');
  const sport = competition.sport;
  assertSport(sport);

  const teams = await ctx.db.list(COL.teams, { where: [['competition_id', 'eq', competition.$id]] });
  const matches = await ctx.db.list(COL.matches, { where: [['season_id', 'eq', seasonId]] });
  const published = matches.filter((m) => m.published !== false);

  /* ---- standings ---- */
  const rows = computeStandings(
    sport as CompetitionSport,
    teams.map((t) => ({ id: t.$id, name: String(t.name) })),
    published.map((m) => ({
      home_team_id: String(m.home_team_id),
      away_team_id: String(m.away_team_id),
      home_score: m.home_score as number | undefined,
      away_score: m.away_score as number | undefined,
      status: m.status as never,
      kickoff_at: String(m.kickoff_at),
    })),
  );
  const existing = await ctx.db.list(COL.standings, { where: [['season_id', 'eq', seasonId]] });
  const keep = new Set<string>();
  for (const r of rows) {
    const id = detId('st', seasonId, r.team_id);
    keep.add(id);
    const data = { season_id: seasonId, ...r };
    const cur = existing.find((e) => e.$id === id);
    if (cur) await ctx.db.update(COL.standings, id, data);
    else await ctx.db.create(COL.standings, id, data);
  }
  for (const e of existing) if (!keep.has(e.$id)) await ctx.db.delete(COL.standings, e.$id);

  /* ---- leaderboards ---- */
  const lines: Doc[] = [];
  for (const m of published) {
    lines.push(...(await ctx.db.list(COL.playerStats, { where: [['match_id', 'eq', m.$id]] })));
  }
  const playerIds = [...new Set(lines.map((l) => String(l.player_id)))];
  const players: { id: string; is_lebanese: boolean }[] = [];
  for (const pid of playerIds) {
    const p = await ctx.db.get(COL.players, pid);
    if (p) players.push({ id: p.$id, is_lebanese: Boolean(p.is_lebanese) });
  }
  const boards = computeLeaderboards(
    sport as CompetitionSport,
    players,
    published.map((m) => ({ id: m.$id, status: m.status as never })),
    lines.map((l) => ({
      match_id: String(l.match_id),
      team_id: String(l.team_id),
      player_id: String(l.player_id),
      stat_code: String(l.stat_code),
      value: Number(l.value),
    })),
  );
  const existingLb = await ctx.db.list(COL.leaderboards, { where: [['season_id', 'eq', seasonId]] });
  const keepLb = new Set<string>();
  for (const b of boards) {
    const id = detId('lb', seasonId, b.board_code, b.player_id);
    keepLb.add(id);
    const data = { season_id: seasonId, board_code: b.board_code, player_id: b.player_id, team_id: b.team_id ?? null, rank: b.rank, value: b.value, games: b.games };
    const cur = existingLb.find((e) => e.$id === id);
    if (cur) await ctx.db.update(COL.leaderboards, id, data);
    else await ctx.db.create(COL.leaderboards, id, data);
  }
  for (const e of existingLb) if (!keepLb.has(e.$id)) await ctx.db.delete(COL.leaderboards, e.$id);

  return { standings: rows.length, leaderboards: boards.length };
}
