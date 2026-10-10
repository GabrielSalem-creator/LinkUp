/**
 * Server-derived standings and leaderboards. Clients never submit rankings.
 */
import { getSportDefinition } from './registry.ts';
import type {
  CompetitionSport,
  CompetitionTeam,
  LeaderboardEntry,
  Match,
  MatchPlayerStat,
  Player,
  RankingEntry,
  StandingRow,
} from './types.ts';

export type StandingComputed = Omit<StandingRow, 'id' | 'season_id'>;

function setPointsFor(sport: CompetitionSport, winnerSets: number, loserSets: number): [number, number] {
  const rule = getSportDefinition(sport).standings;
  if (!rule) return [0, 0];
  const key = `${winnerSets}-${loserSets}`;
  const sp = rule.setPoints?.[key];
  if (sp) return [sp[0], sp[1]];
  return [rule.win, rule.loss];
}

export function computeStandings(
  sport: CompetitionSport,
  teams: Pick<CompetitionTeam, 'id' | 'name'>[],
  matches: Pick<Match, 'home_team_id' | 'away_team_id' | 'home_score' | 'away_score' | 'status' | 'kickoff_at'>[],
): StandingComputed[] {
  const rule = getSportDefinition(sport).standings;
  if (!rule) return [];
  type Row = StandingComputed & { formList: string[] };
  const rows = new Map<string, Row>();
  for (const t of teams) {
    rows.set(t.id, {
      team_id: t.id,
      rank: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      scored: 0,
      conceded: 0,
      diff: 0,
      points: 0,
      form: '',
      formList: [],
    });
  }
  const finals = matches
    .filter((m) => m.status === 'final' && m.home_score != null && m.away_score != null)
    .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));

  for (const m of finals) {
    const h = rows.get(m.home_team_id);
    const a = rows.get(m.away_team_id);
    if (!h || !a) continue;
    const hs = m.home_score as number;
    const as = m.away_score as number;
    h.played++;
    a.played++;
    h.scored += hs;
    h.conceded += as;
    a.scored += as;
    a.conceded += hs;
    if (hs > as) {
      h.won++;
      a.lost++;
      const [wp, lp] = rule.setPoints ? setPointsFor(sport, hs, as) : [rule.win, rule.loss];
      h.points += wp;
      a.points += lp;
      h.formList.push('W');
      a.formList.push('L');
    } else if (as > hs) {
      a.won++;
      h.lost++;
      const [wp, lp] = rule.setPoints ? setPointsFor(sport, as, hs) : [rule.win, rule.loss];
      a.points += wp;
      h.points += lp;
      a.formList.push('W');
      h.formList.push('L');
    } else {
      h.drawn++;
      a.drawn++;
      const d = rule.draw ?? 0;
      h.points += d;
      a.points += d;
      h.formList.push('D');
      a.formList.push('D');
    }
  }

  const nameOf = new Map(teams.map((t) => [t.id, t.name]));
  const list = [...rows.values()].map((r) => ({
    ...r,
    diff: r.scored - r.conceded,
    form: r.formList.slice(-5).join(''),
  }));
  list.sort((x, y) => {
    for (const key of rule.tiebreak) {
      let c = 0;
      if (key === 'points') c = y.points - x.points;
      else if (key === 'diff') c = y.diff - x.diff;
      else if (key === 'for') c = y.scored - x.scored;
      else if (key === 'wins') c = y.won - x.won;
      else if (key === 'name') c = (nameOf.get(x.team_id) ?? '').localeCompare(nameOf.get(y.team_id) ?? '');
      if (c !== 0) return c;
    }
    return 0;
  });
  return list.map((r, i) => {
    const { formList: _f, ...row } = r;
    return { ...row, rank: i + 1 };
  });
}

export type LeaderboardComputed = Omit<LeaderboardEntry, 'id' | 'season_id'>;

export function computeLeaderboards(
  sport: CompetitionSport,
  players: Pick<Player, 'id' | 'is_lebanese'>[],
  matches: Pick<Match, 'id' | 'status'>[],
  lines: Pick<MatchPlayerStat, 'match_id' | 'team_id' | 'player_id' | 'stat_code' | 'value'>[],
): LeaderboardComputed[] {
  const def = getSportDefinition(sport);
  if (!def.leaderboards.length) return [];
  const finalIds = new Set(matches.filter((m) => m.status === 'final').map((m) => m.id));
  const lebanese = new Map(players.map((p) => [p.id, p.is_lebanese]));
  const knownPlayers = new Set(players.map((p) => p.id));

  const totals = new Map<string, Map<string, number>>();
  const games = new Map<string, Set<string>>();
  const team = new Map<string, string>();
  for (const l of lines) {
    if (!finalIds.has(l.match_id) || !knownPlayers.has(l.player_id)) continue;
    if (!totals.has(l.player_id)) totals.set(l.player_id, new Map());
    const t = totals.get(l.player_id)!;
    t.set(l.stat_code, (t.get(l.stat_code) ?? 0) + l.value);
    if (!games.has(l.player_id)) games.set(l.player_id, new Set());
    games.get(l.player_id)!.add(l.match_id);
    team.set(l.player_id, l.team_id);
  }
  for (const s of def.playerStats) {
    if (!s.derivedFrom) continue;
    for (const [, t] of totals) {
      t.set(s.code, s.derivedFrom.reduce((acc, c) => acc + (t.get(c) ?? 0), 0));
    }
  }

  const out: LeaderboardComputed[] = [];
  for (const b of def.leaderboards) {
    const rows: LeaderboardComputed[] = [];
    for (const [pid, t] of totals) {
      if (b.lebaneseOnly && !lebanese.get(pid)) continue;
      const raw = t.get(b.statCode) ?? 0;
      const g = games.get(pid)?.size ?? 0;
      if (g === 0) continue;
      const value = b.aggregate === 'avg_per_game' ? raw / g : raw;
      if (value <= 0) continue;
      rows.push({ board_code: b.code, player_id: pid, team_id: team.get(pid), rank: 0, value, games: g });
    }
    rows.sort((x, y) => y.value - x.value || y.games - x.games || x.player_id.localeCompare(y.player_id));
    rows.slice(0, b.limit).forEach((r, i) => out.push({ ...r, rank: i + 1, value: Number(r.value.toFixed(3)) }));
  }
  return out;
}

/** Rankings are manual points; rank is derived by points desc then name. */
export function rankEntries<T extends Pick<RankingEntry, 'player_id' | 'points'>>(
  entries: T[],
  nameOf: (playerId: string) => string,
  limit: number,
): (T & { rank: number })[] {
  return [...entries]
    .sort((a, b) => b.points - a.points || nameOf(a.player_id).localeCompare(nameOf(b.player_id)))
    .slice(0, limit)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}
