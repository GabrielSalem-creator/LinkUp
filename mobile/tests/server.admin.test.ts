import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { COL } from '../functions/linkup-api/src/context.ts';
import { Harness } from './server.harness.ts';

let h: Harness;
beforeEach(async () => {
  h = new Harness();
  await h.seedFootball();
});

describe('admin match & statistics management (Task 3)', () => {
  it('records a result, recalculates standings, and rejects stale versions (concurrent conflict)', async () => {
    const r = await h.call('PATCH', '/admin/matches/m1', { expectedVersion: 0, status: 'final', home_score: 2, away_score: 1, reason: 'Full time' }, 'admin1');
    assert.equal(r.status, 200);
    const standings = await h.db.list(COL.standings, { where: [['season_id', 'eq', 'ssn-lpl']], orderBy: [{ field: 'rank', dir: 'asc' }] });
    assert.deepEqual(standings.map((s) => [s.team_id, s.points, s.played]), [
      ['t-ansar', 3, 1],
      ['t-ahed', 0, 0],
      ['t-nejmeh', 0, 1],
    ]);
    const stale = await h.call('PATCH', '/admin/matches/m1', { expectedVersion: 0, status: 'final', home_score: 3, away_score: 1, reason: 'late goal' }, 'admin1');
    assert.equal(stale.status, 409);
    const fresh = await h.call('PATCH', '/admin/matches/m1', { expectedVersion: 1, status: 'final', home_score: 3, away_score: 1, reason: 'late goal' }, 'admin1');
    assert.equal(fresh.status, 200);
    const m = await h.db.get(COL.matches, 'm1');
    assert.equal(m?.home_score, 3);
    assert.equal(m?.result_version, 2);
    const audit = await h.db.list(COL.corrections, { where: [['match_id', 'eq', 'm1']] });
    assert.equal(audit.length, 2);
  });
  it('requires a reason and valid transitions', async () => {
    assert.equal((await h.call('PATCH', '/admin/matches/m1', { expectedVersion: 0, status: 'final', home_score: 2, away_score: 1 }, 'admin1')).status, 400);
    await h.call('PATCH', '/admin/matches/m1', { expectedVersion: 0, status: 'cancelled', reason: 'storm' }, 'admin1');
    const r = await h.call('PATCH', '/admin/matches/m1', { expectedVersion: 1, status: 'live', reason: 'oops' }, 'admin1');
    assert.equal(r.status, 400);
    assert.equal((r.body as { code: string }).code, 'invalid_transition');
  });
  it('rejects invalid scores per sport', async () => {
    const r = await h.call('PATCH', '/admin/matches/m1', { expectedVersion: 0, status: 'final', home_score: -1, away_score: 1, reason: 'x' }, 'admin1');
    assert.equal(r.status, 400);
    assert.equal((await h.call('PATCH', '/admin/matches/m1', { expectedVersion: 0, status: 'final', reason: 'missing scores' }, 'admin1')).status, 400);
  });
  it('validates and audits stat lines, derives leaderboards, and rejects unknown/derived/GK-only codes', async () => {
    await h.call('PATCH', '/admin/matches/m1', { expectedVersion: 0, status: 'final', home_score: 2, away_score: 0, reason: 'Full time' }, 'admin1');
    const bad = await h.call('PUT', '/admin/matches/m1/stats', { expectedVersion: 1, reason: 'x', players: [{ team_id: 't-ansar', player_id: 'p-fw', stat_code: 'ppg', value: 1 }] }, 'admin1');
    assert.equal(bad.status, 400);
    const derived = await h.call('PUT', '/admin/matches/m1/stats', { expectedVersion: 1, reason: 'x', players: [{ team_id: 't-ansar', player_id: 'p-fw', stat_code: 'goal_involvements', value: 1 }] }, 'admin1');
    assert.equal(derived.status, 400);
    const gk = await h.call('PUT', '/admin/matches/m1/stats', { expectedVersion: 1, reason: 'x', players: [{ team_id: 't-ansar', player_id: 'p-fw', stat_code: 'clean_sheets', value: 1 }] }, 'admin1');
    assert.equal(gk.status, 400);
    const wrongTeam = await h.call('PUT', '/admin/matches/m1/stats', { expectedVersion: 1, reason: 'x', players: [{ team_id: 't-ahed', player_id: 'p-fw', stat_code: 'goals', value: 1 }] }, 'admin1');
    assert.equal(wrongTeam.status, 400);
    const ok = await h.call(
      'PUT',
      '/admin/matches/m1/stats',
      {
        expectedVersion: 1,
        reason: 'match sheet',
        team: [{ team_id: 't-ansar', stat_code: 'corners', value: 6 }],
        players: [
          { team_id: 't-ansar', player_id: 'p-fw', stat_code: 'goals', value: 2 },
          { team_id: 't-ansar', player_id: 'p-gk', stat_code: 'clean_sheets', value: 1 },
          { team_id: 't-nejmeh', player_id: 'p-foreign', stat_code: 'yellow_cards', value: 1 },
        ],
      },
      'admin1',
    );
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const boards = await h.db.list(COL.leaderboards, { where: [['season_id', 'eq', 'ssn-lpl']] });
    const goals = boards.filter((b) => b.board_code === 'goals');
    assert.deepEqual(goals.map((b) => [b.player_id, b.value]), [['p-fw', 2]]);
    assert.deepEqual(boards.filter((b) => b.board_code === 'goal_involvements').map((b) => b.value), [2]);
    assert.deepEqual(boards.filter((b) => b.board_code === 'clean_sheets').map((b) => b.player_id), ['p-gk']);
    // correction: remove a goal -> leaderboards recalc; audit has before/after
    const fix = await h.call('PUT', '/admin/matches/m1/stats', { expectedVersion: 2, reason: 'own goal reassigned', players: [{ team_id: 't-ansar', player_id: 'p-fw', stat_code: 'goals', value: 1 }] }, 'admin1');
    assert.equal(fix.status, 200);
    const after = await h.db.list(COL.leaderboards, { where: [['board_code', 'eq', 'goals']] });
    assert.deepEqual(after.map((b) => b.value), [1]);
    const audit = await h.db.list(COL.corrections, { where: [['target_type', 'eq', 'player_stat']] });
    assert.equal(audit.length, 2);
    assert.equal(JSON.parse(String(audit[1].before_json)).players.length, 3);
    assert.equal(JSON.parse(String(audit[1].after_json)).players.length, 1);
    // settings toggle audited
    const st = await h.call('PATCH', '/admin/settings', { checkout_enabled: false, reason: 'pause sales' }, 'admin1');
    assert.equal(st.status, 200);
    assert.equal((await h.db.get(COL.settings, 'ticketing'))?.checkout_enabled, false);
  });
  it('rankings: manual points produce derived ranks capped at board limit; unknown boards rejected', async () => {
    await h.db.create(COL.competitions, 'cmp-ten', { name: 'Tennis', slug: 'ten', sport: 'tennis', status: 'published', country: 'LB', sort: 9 });
    await h.db.create(COL.seasons, 'ssn-ten', { competition_id: 'cmp-ten', name: '2026', start_date: '2026-01-01', end_date: '2026-12-31', status: 'active', is_current: true, matchweeks: 0 });
    await h.db.create(COL.players, 'p-t1', { full_name: 'A Player', nationality: 'LB', is_lebanese: true, gender: 'men' });
    await h.db.create(COL.players, 'p-t2', { full_name: 'B Player', nationality: 'LB', is_lebanese: true, gender: 'men' });
    await h.db.create(COL.players, 'p-t3', { full_name: 'C Player', nationality: 'LB', is_lebanese: true, gender: 'women' });
    const bad = await h.call('PUT', '/admin/rankings', { season_id: 'ssn-ten', board_code: 'padel_men_a', reason: 'x', entries: [] }, 'admin1');
    assert.equal(bad.status, 400);
    const wrongGender = await h.call('PUT', '/admin/rankings', { season_id: 'ssn-ten', board_code: 'tennis_men', reason: 'x', entries: [{ player_id: 'p-t3', points: 10 }] }, 'admin1');
    assert.equal(wrongGender.status, 400);
    const ok = await h.call('PUT', '/admin/rankings', { season_id: 'ssn-ten', board_code: 'tennis_men', reason: 'weekly update', entries: [{ player_id: 'p-t1', points: 120 }, { player_id: 'p-t2', points: 300 }] }, 'admin1');
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const rows = await h.db.list(COL.rankings, { orderBy: [{ field: 'rank', dir: 'asc' }] });
    assert.deepEqual(rows.map((r) => [r.rank, r.player_id]), [[1, 'p-t2'], [2, 'p-t1']]);
    assert.equal((await h.call('PUT', '/admin/rankings', { season_id: 'ssn-ten', board_code: 'tennis_men', reason: 'x', entries: [] }, 'alice')).status, 403);
  });
});
