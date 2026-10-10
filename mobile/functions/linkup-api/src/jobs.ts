/**
 * Housekeeping: expire holds/orders whose window passed, retry queued email deliveries.
 * Triggered by the function schedule or by an app admin.
 */
import { COL, type AppContext } from './context.ts';
import { expireOrder } from './ticketing.ts';
import { retryDeliveries } from './tickets.ts';

export async function runJobs(ctx: AppContext) {
  const now = ctx.now();
  const nowIso = now.toISOString();
  let holdsExpired = 0;
  const holds = await ctx.db.list(COL.holds, { where: [['state', 'eq', 'active']], limit: 500 });
  for (const h of holds) {
    if (String(h.expires_at) > nowIso) continue;
    const locks = await ctx.db.list(COL.locks, { where: [['hold_id', 'eq', h.$id]] });
    for (const l of locks) {
      if (l.state === 'held') {
        try {
          await ctx.db.delete(COL.locks, l.$id);
        } catch {
          /* gone */
        }
      }
    }
    await ctx.db.update(COL.holds, h.$id, { state: 'expired' });
    holdsExpired++;
  }
  let ordersExpired = 0;
  const orders = await ctx.db.list(COL.orders, { where: [['state', 'in', ['awaiting_checkout', 'failed', 'pending']]], limit: 500 });
  for (const o of orders) {
    if (!o.expires_at || String(o.expires_at) > nowIso) continue;
    try {
      await expireOrder(ctx, o);
      ordersExpired++;
    } catch {
      /* state changed meanwhile */
    }
  }
  const deliveriesRetried = await retryDeliveries(ctx);
  return { holdsExpired, ordersExpired, deliveriesRetried, ran_at: nowIso };
}
