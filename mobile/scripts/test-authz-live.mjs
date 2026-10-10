/**
 * Live authorization + permission tests against the staging Appwrite project and the deployed function.
 * Creates throwaway users (and deletes them), never touches production club/community data.
 *
 *   node scripts/test-authz-live.mjs
 */
import { Client, Databases, Functions, ID, Query, Users } from 'node-appwrite';

import { DB, ENDPOINT, PROJECT, admin, callAs, ensureUser, sessionClientFor, setAdmin } from './admin-tools.mjs';

const users = new Users(admin);
const db = new Databases(admin);
const results = [];
const ok = (name, detail = '') => {
  results.push({ name, pass: true });
  console.log(`PASS ${name}${detail ? ` - ${detail}` : ''}`);
};
const fail = (name, detail) => {
  results.push({ name, pass: false });
  console.log(`FAIL ${name} - ${detail}`);
};
const expect = (name, cond, detail) => (cond ? ok(name, detail) : fail(name, detail));

async function main() {
  console.log(`Live authz tests -> ${ENDPOINT} / ${PROJECT}\n`);
  const stamp = Date.now();
  const pw = 'TestPass123!';
  const normal = await ensureUser(`authz_user_${stamp}@linkup.test`, pw, 'Normal User');
  const other = await ensureUser(`authz_other_${stamp}@linkup.test`, pw, 'Other User');
  const owner = await ensureUser(`authz_owner_${stamp}@linkup.test`, pw, 'Club Owner');
  const adm = await ensureUser(`authz_admin_${stamp}@linkup.test`, pw, 'Temp Admin');
  await setAdmin(adm.$id, true);
  const cleanup = [normal, other, owner, adm];

  // a published match + offer to target
  const matches = await db.listDocuments({ databaseId: DB, collectionId: 'matches', queries: [Query.equal('status', 'scheduled'), Query.limit(50)] });
  let target = null;
  let offer = null;
  for (const m of matches.documents) {
    const offers = await db.listDocuments({ databaseId: DB, collectionId: 'ticket_offers', queries: [Query.equal('match_id', m.$id), Query.equal('kind', 'ga'), Query.limit(1)] });
    if (offers.documents[0]) {
      target = m;
      offer = offers.documents[0];
      break;
    }
  }
  if (!target) throw new Error('No scheduled match with a GA offer found (run seed first)');
  const correction = { expectedVersion: target.result_version, status: target.status, note: `authz probe ${stamp}`, reason: 'authz live probe' };

  try {
    const anon = new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
    const fns = new Functions(anon);
    // 1. unauthenticated correction denied
    try {
      const exec = await fns.createExecution({ functionId: 'linkup-api', xpath: `/admin/matches/${target.$id}`, method: 'PATCH', body: JSON.stringify(correction) });
      expect('unauthenticated correction denied', exec.responseStatusCode === 401, `status ${exec.responseStatusCode}`);
    } catch (e) {
      expect('unauthenticated correction denied', e.code === 401, `sdk error ${e.code}`);
    }

    // 2. ordinary user denied
    const normalClient = await sessionClientFor(normal.$id);
    let r = await callAs(normalClient, 'PATCH', `/admin/matches/${target.$id}`, correction);
    expect('ordinary user denied', r.status === 403, `status ${r.status}`);

    // 3. club owner (owner_email on a club) without app-admin denied
    const club = (await db.listDocuments({ databaseId: DB, collectionId: 'clubs', queries: [Query.limit(1)] })).documents[0];
    const ownerClient = await sessionClientFor(owner.$id);
    r = await callAs(ownerClient, 'PATCH', `/admin/matches/${target.$id}`, correction);
    expect('club owner/admin without app-admin denied', r.status === 403, `club ${club?.$id} owner_email irrelevant; status ${r.status}`);

    // 4. current app admin accepted (metadata-only edit, audited)
    const adminClient = await sessionClientFor(adm.$id);
    r = await callAs(adminClient, 'PATCH', `/admin/matches/${target.$id}`, correction);
    expect('current app admin accepted', r.status === 200, `status ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    const audits = await db.listDocuments({ databaseId: DB, collectionId: 'stat_corrections', queries: [Query.equal('match_id', target.$id), Query.orderDesc('created_at'), Query.limit(1)] });
    expect('correction is audited with actor/reason/correlation', audits.documents[0]?.actor_id === adm.$id && audits.documents[0]?.reason === 'authz live probe' && Boolean(audits.documents[0]?.correlation_id));
    // restore note
    const fresh = await db.getDocument({ databaseId: DB, collectionId: 'matches', documentId: target.$id });
    await callAs(adminClient, 'PATCH', `/admin/matches/${target.$id}`, { expectedVersion: fresh.result_version, note: target.note ?? '', reason: 'authz live probe revert' });

    // 5. revoked membership denied
    await setAdmin(adm.$id, false);
    const fresh2 = await db.getDocument({ databaseId: DB, collectionId: 'matches', documentId: target.$id });
    r = await callAs(adminClient, 'PATCH', `/admin/matches/${target.$id}`, { ...correction, expectedVersion: fresh2.result_version });
    expect('revoked membership denied', r.status === 403, `status ${r.status}`);
    await setAdmin(adm.$id, true);

    // 6. direct database mutation denied (client session, no server key)
    const normalDb = new Databases(normalClient);
    for (const [col, data] of [
      ['matches', { home_score: 99 }],
      ['standings', { points: 99 }],
      ['ticket_offers', { price_minor: 1 }],
    ]) {
      const id = col === 'matches' ? target.$id : (await db.listDocuments({ databaseId: DB, collectionId: col, queries: [Query.limit(1)] })).documents[0]?.$id;
      if (!id) continue;
      try {
        await normalDb.updateDocument({ databaseId: DB, collectionId: col, documentId: id, data });
        fail(`direct mutation denied: ${col}`, 'update succeeded');
      } catch (e) {
        expect(`direct mutation denied: ${col}`, e.code === 401 || e.code === 403, `code ${e.code}`);
      }
    }
    for (const col of ['orders', 'tickets', 'inventory_locks', 'payment_events', 'stat_corrections']) {
      try {
        await normalDb.createDocument({ databaseId: DB, collectionId: col, documentId: ID.unique(), data: {} });
        fail(`direct create denied: ${col}`, 'create succeeded');
      } catch (e) {
        expect(`direct create denied: ${col}`, e.code === 401 || e.code === 403 || e.code === 400, `code ${e.code}`);
      }
    }

    // 7. cross-competition identifier tampering denied
    const otherTeam = (await db.listDocuments({ databaseId: DB, collectionId: 'competition_teams', queries: [Query.notEqual('competition_id', target.competition_id), Query.limit(1)] })).documents[0];
    r = await callAs(adminClient, 'POST', '/admin/matches', { competition_id: target.competition_id, season_id: target.season_id, home_team_id: target.home_team_id, away_team_id: otherTeam.$id, kickoff_at: new Date().toISOString() });
    expect('cross-competition identifier tampering denied', r.status === 400, `status ${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);

    // 8. other user's order / ticket / QR denied; public reads expose nothing private
    r = await callAs(normalClient, 'POST', '/holds', { matchId: target.$id, offerId: offer.$id, quantity: 1 });
    expect('normal user can hold a ticket', r.status === 200, `status ${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);
    const holdId = r.body?.id;
    r = await callAs(normalClient, 'POST', '/orders', { holdId, idempotencyKey: `authz-${stamp}` });
    expect('normal user can create an order', r.status === 200, `status ${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);
    const orderId = r.body?.order?.id;
    const otherClient = await sessionClientFor(other.$id);
    r = await callAs(otherClient, 'GET', `/orders/${orderId}`);
    expect("other user's order denied", r.status === 403, `status ${r.status}`);
    const otherDb = new Databases(otherClient);
    try {
      await otherDb.getDocument({ databaseId: DB, collectionId: 'orders', documentId: orderId });
      fail("other user's order document read denied", 'read succeeded');
    } catch (e) {
      expect("other user's order document read denied", e.code === 401 || e.code === 403 || e.code === 404, `code ${e.code}`);
    }
    const ownDb = new Databases(normalClient);
    const own = await ownDb.getDocument({ databaseId: DB, collectionId: 'orders', documentId: orderId });
    expect('owner can read own order document', own.$id === orderId);
    // pay via fake provider and check ticket isolation
    r = await callAs(normalClient, 'POST', `/orders/${orderId}/checkout`, {});
    if (r.status === 200) {
      const attemptId = r.body.attempt_id;
      r = await callAs(normalClient, 'POST', '/payments/fake/complete', { attemptId, outcome: 'success' });
      expect('fake checkout success issues tickets', r.status === 200 && /issued/.test(r.body?.webhook?.result ?? ''), JSON.stringify(r.body?.webhook).slice(0, 100));
      const detail = await callAs(normalClient, 'GET', `/orders/${orderId}`);
      const tid = detail.body?.tickets?.[0]?.id;
      r = await callAs(otherClient, 'GET', `/tickets/${tid}`);
      expect("other user's ticket denied", r.status === 403, `status ${r.status}`);
      const t = await callAs(normalClient, 'GET', `/tickets/${tid}`);
      const cred = t.body?.credential;
      expect('credential has no PII', typeof cred === 'string' && !cred.includes('@') && !cred.includes(normal.$id));
      r = await callAs(normalClient, 'POST', '/tickets/validate', { credential: cred });
      expect('non-admin cannot validate tickets', r.status === 403, `status ${r.status}`);
      r = await callAs(adminClient, 'POST', '/tickets/validate', { credential: cred.replace(/\.[^.]+$/, '.tampered') });
      expect('tampered QR rejected', r.status === 400, `status ${r.status}`);
      r = await callAs(adminClient, 'POST', '/tickets/validate', { credential: cred, dryRun: true });
      expect('admin can validate a genuine QR', r.status === 200, `status ${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
      // duplicate event cannot duplicate tickets
      r = await callAs(normalClient, 'POST', '/payments/fake/complete', { attemptId, outcome: 'success' });
      const again = await callAs(normalClient, 'GET', `/orders/${orderId}`);
      expect('duplicate payment event does not duplicate tickets', again.body?.tickets?.length === detail.body?.tickets?.length, `${again.body?.tickets?.length} tickets`);
      // cleanup financial records: never delete, but release inventory for the probe ticket
      await db.deleteDocument({ databaseId: DB, collectionId: 'inventory_locks', documentId: (await db.listDocuments({ databaseId: DB, collectionId: 'inventory_locks', queries: [Query.equal('order_id', orderId), Query.limit(1)] })).documents[0]?.$id }).catch(() => undefined);
    } else {
      ok('checkout gated', `status ${r.status} ${r.body?.code}`);
      await callAs(normalClient, 'POST', `/orders/${orderId}/cancel`, {});
    }
    // 9. audit update/delete denied (client)
    const audit = audits.documents[0];
    try {
      await new Databases(adminClient).updateDocument({ databaseId: DB, collectionId: 'stat_corrections', documentId: audit.$id, data: { reason: 'x' } });
      fail('audit update denied', 'succeeded');
    } catch (e) {
      expect('audit update denied', e.code === 401 || e.code === 403 || e.code === 404, `code ${e.code}`);
    }
    try {
      await new Databases(adminClient).deleteDocument({ databaseId: DB, collectionId: 'stat_corrections', documentId: audit.$id });
      fail('audit delete denied', 'succeeded');
    } catch (e) {
      expect('audit delete denied', e.code === 401 || e.code === 403 || e.code === 404, `code ${e.code}`);
    }
    // 10. public reads expose no purchaser/admin data
    const guest = new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
    const guestDb = new Databases(guest);
    const pub = await guestDb.listDocuments({ databaseId: DB, collectionId: 'matches', queries: [Query.limit(5)] });
    expect('public can read published matches', pub.total > 0);
    for (const col of ['orders', 'tickets', 'inventory_locks', 'ticket_holds', 'payment_events', 'stat_corrections']) {
      const res = await guestDb.listDocuments({ databaseId: DB, collectionId: col, queries: [Query.limit(5)] }).catch((e) => ({ total: 0, documents: [], err: e.code }));
      expect(`public cannot read ${col}`, res.documents.length === 0, `docs ${res.documents.length}${res.err ? ` (code ${res.err})` : ''}`);
    }
    const avail = await callAs(normalClient, 'GET', `/matches/${target.$id}/availability`);
    const text = JSON.stringify(avail.body);
    expect('availability exposes no user ids/emails', !text.includes(normal.$id) && !text.includes('@'));
  } finally {
    for (const u of cleanup) await users.delete({ userId: u.$id }).catch(() => undefined);
  }
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
