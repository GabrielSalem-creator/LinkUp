import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { COL } from '../functions/linkup-api/src/context.ts';
import { Harness } from './server.harness.ts';

let h: Harness;
beforeEach(async () => {
  h = new Harness();
  await h.seedFootball();
});

const correction = { expectedVersion: 0, status: 'final', home_score: 2, away_score: 1, reason: 'full-time result' };

describe('authorization (Task 2/3 gates)', () => {
  it('unauthenticated correction is denied', async () => {
    const r = await h.call('PATCH', '/admin/matches/m1', correction, null);
    assert.equal(r.status, 401);
  });
  it('ordinary user is denied', async () => {
    const r = await h.call('PATCH', '/admin/matches/m1', correction, 'alice');
    assert.equal(r.status, 403);
  });
  it('club owner/admin without app-admin membership is denied', async () => {
    // club ownership / club password confer nothing here: "owner" is just another user id
    const r = await h.call('PATCH', '/admin/matches/m1', correction, 'club-owner');
    assert.equal(r.status, 403);
    const s = await h.call('PUT', '/admin/matches/m1/stats', { expectedVersion: 0, reason: 'x', players: [] }, 'club-owner');
    assert.equal(s.status, 403);
  });
  it('current app admin is accepted and the change is audited', async () => {
    const r = await h.call('PATCH', '/admin/matches/m1', correction, 'admin1');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const audit = await h.db.list(COL.corrections);
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actor_id, 'admin1');
    assert.equal(audit[0].reason, 'full-time result');
    assert.ok(String(audit[0].correlation_id).length > 0);
    assert.deepEqual(JSON.parse(String(audit[0].before_json)).home_score, undefined);
    assert.equal(JSON.parse(String(audit[0].after_json)).home_score, 2);
  });
  it('revoked membership is denied', async () => {
    h.admins.delete('admin1');
    const r = await h.call('PATCH', '/admin/matches/m1', correction, 'admin1');
    assert.equal(r.status, 403);
  });
  it('cross-competition identifier tampering is denied', async () => {
    const r = await h.call(
      'POST',
      '/admin/matches',
      { competition_id: 'cmp-lpl', season_id: 'ssn-lpl', home_team_id: 't-ansar', away_team_id: 't-riyadi', kickoff_at: '2026-04-01T18:00:00Z' },
      'admin1',
    );
    assert.equal(r.status, 400);
    assert.match(String((r.body as { error: string }).error), /not in this competition/);
    const s = await h.call('POST', '/admin/matches', { competition_id: 'cmp-lpl', season_id: 'ssn-lbl', home_team_id: 't-ansar', away_team_id: 't-nejmeh', kickoff_at: '2026-04-01T18:00:00Z' }, 'admin1');
    assert.equal(s.status, 400);
  });
  it("other user's order, ticket and QR are denied; public responses expose no purchaser data", async () => {
    const buy = await h.buyGa('alice', 1);
    assert.equal(buy.checkout!.status, 200);
    await h.call('POST', '/payments/fake/complete', { attemptId: buy.attemptId, outcome: 'success' }, 'alice');
    const mine = await h.call('GET', `/orders/${buy.orderId}`, undefined, 'alice');
    assert.equal(mine.status, 200);
    const other = await h.call('GET', `/orders/${buy.orderId}`, undefined, 'bob');
    assert.equal(other.status, 403);
    const tickets = (mine.body as { tickets: { id: string }[] }).tickets;
    assert.equal(tickets.length, 1);
    assert.equal((await h.call('GET', `/tickets/${tickets[0].id}`, undefined, 'bob')).status, 403);
    assert.equal((await h.call('GET', `/tickets/${tickets[0].id}`, undefined, null)).status, 401);
    assert.equal((await h.call('POST', `/orders/${buy.orderId}/cancel`, {}, 'bob')).status, 403);
    assert.equal((await h.call('POST', `/orders/${buy.orderId}/sync`, {}, 'bob')).status, 403);
    // public availability never includes user ids / emails
    const avail = await h.call('GET', '/matches/m1/availability', undefined, null);
    const text = JSON.stringify(avail.body);
    assert.ok(!text.includes('alice'), 'no purchaser identity in public availability');
    assert.ok(!text.includes('@'));
  });
  it('ticket validation requires app admin; QR tampering is rejected', async () => {
    const buy = await h.buyGa('alice', 1);
    await h.call('POST', '/payments/fake/complete', { attemptId: buy.attemptId, outcome: 'success' }, 'alice');
    const mine = await h.call('GET', `/orders/${buy.orderId}`, undefined, 'alice');
    const tid = (mine.body as { tickets: { id: string }[] }).tickets[0].id;
    const t = await h.call('GET', `/tickets/${tid}`, undefined, 'alice');
    const credential = (t.body as { credential: string }).credential;
    assert.match(credential, /^LKT1\./);
    assert.ok(!credential.includes('alice'), 'credential carries no PII');
    assert.equal((await h.call('POST', '/tickets/validate', { credential }, 'alice')).status, 403);
    const tampered = credential.replace(/\.[^.]+$/, '.AAAA');
    assert.equal((await h.call('POST', '/tickets/validate', { credential: tampered }, 'admin1')).status, 400);
    const swapped = credential.replace(tid, 'tk_other');
    assert.equal((await h.call('POST', '/tickets/validate', { credential: swapped }, 'admin1')).status, 400);
    const ok = await h.call('POST', '/tickets/validate', { credential }, 'admin1');
    assert.equal(ok.status, 200);
    assert.equal((ok.body as { state: string }).state, 'used');
    const again = await h.call('POST', '/tickets/validate', { credential }, 'admin1');
    assert.equal(again.status, 409);
  });
  it('audit records are never updated or deleted by any route', async () => {
    await h.call('PATCH', '/admin/matches/m1', correction, 'admin1');
    const before = await h.db.list(COL.corrections);
    for (const p of [`/admin/corrections/${before[0].$id}`, `/stat_corrections/${before[0].$id}`]) {
      assert.equal((await h.call('PATCH', p, { reason: 'x' }, 'admin1')).status, 404);
      assert.equal((await h.call('DELETE', p, undefined, 'admin1')).status, 404);
    }
    const list = await h.call('GET', '/admin/corrections?match_id=m1', undefined, 'admin1');
    assert.equal(list.status, 200);
    assert.equal((list.body as unknown[]).length, 1);
    assert.equal((await h.call('GET', '/admin/corrections', undefined, 'alice')).status, 403);
  });
});
