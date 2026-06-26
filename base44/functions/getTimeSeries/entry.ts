import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { fetchFamilyTransactions } from './_txAggregateHelper.ts';

async function resolveAccess(base44, requestedFamilyId) {
  let user = null;
  try { user = await base44.auth.me(); } catch { user = null; }
  if (user) {
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    if (!memberships.length) { const err = new Error('forbidden'); err.httpStatus = 403; throw err; }
    let membership = memberships[0];
    if (!requestedFamilyId && memberships.length > 1) {
      const activeId = user.data?.family_id ?? user.data?.data?.family_id;
      membership = memberships.find(m => m.family_id === activeId) ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
    }
    if (requestedFamilyId) {
      const match = memberships.find(m => m.family_id === requestedFamilyId);
      if (!match) { const err = new Error('forbidden'); err.httpStatus = 403; throw err; }
      membership = match;
    }
    return { user, familyId: membership.family_id, selfPersonId: membership.person_id ?? null, membership };
  }
  if (!requestedFamilyId) { const err = new Error('whatsapp_session_expired'); err.httpStatus = 401; err.code = 'not_linked'; throw err; }
  return { user: null, familyId: requestedFamilyId, selfPersonId: null, membership: null };
}

function resolvePersonFilter(access, opts) {
  const personId = opts.personId?.trim();
  const scope = opts.scope?.trim().toLowerCase();
  if (personId && personId !== 'self') return personId;
  if (personId === 'self' || scope === 'self' || scope === 'me' || scope === 'mine') return access.selfPersonId ?? undefined;
  return undefined;
}

function errorResponse(err) {
  const status = (err && err.httpStatus) || 500;
  const message = status === 500 ? 'internal' : err?.message || 'error';
  return Response.json({ error: message }, { status });
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function getWeekBucket(dateStr) {
  const d = new Date(dateStr);
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return toISODate(monday);
}

function getMonthBucket(dateStr) {
  return dateStr.slice(0, 7) + '-01';
}

function generateBuckets(start, end, granularity) {
  const buckets = [];
  const endDate = new Date(end);
  let cursor = new Date(start);

  if (granularity === 'day') {
    while (cursor <= endDate) {
      buckets.push(toISODate(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else if (granularity === 'week') {
    const dow = cursor.getUTCDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    cursor.setUTCDate(cursor.getUTCDate() + diff);
    while (cursor <= endDate) {
      buckets.push(toISODate(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  } else {
    cursor = new Date(start.slice(0, 7) + '-01');
    const endMonth = end.slice(0, 7);
    while (toISODate(cursor).slice(0, 7) <= endMonth) {
      buckets.push(toISODate(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  return buckets;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { start, end, granularity = 'day', type = 'expense' } = body;

    let access;
    try {
      access = await resolveAccess(base44, body.familyId);
    } catch (err) {
      return errorResponse(err);
    }
    const familyId = access.familyId;
    const personId = resolvePersonFilter(access, { personId: body.personId, scope: body.scope });

    if (!start || !end || new Date(start) > new Date(end)) {
      return Response.json({ error: 'invalid date range' }, { status: 400 });
    }

    const validGranularities = ['day', 'week', 'month'];
    if (!validGranularities.includes(granularity)) {
      return Response.json({ error: 'invalid granularity' }, { status: 400 });
    }

    const transactions = await fetchFamilyTransactions(base44, { familyId, start, end, type, personId });
    const truncated = transactions.length >= 50000;
    const filtered = type === 'all' ? transactions : transactions.filter(t => t.type === type);

    const bucketMap = {};
    filtered.forEach(t => {
      if (!t.date) return;
      let bucket;
      if (granularity === 'day') bucket = t.date.slice(0, 10);
      else if (granularity === 'week') bucket = getWeekBucket(t.date);
      else bucket = getMonthBucket(t.date);

      if (!bucketMap[bucket]) bucketMap[bucket] = { total: 0, count: 0 };
      bucketMap[bucket].total += t.amount || 0;
      bucketMap[bucket].count++;
    });

    const allBuckets = generateBuckets(start, end, granularity);
    const buckets = allBuckets.map(bucket => ({
      bucket,
      total: bucketMap[bucket]?.total ?? 0,
      count: bucketMap[bucket]?.count ?? 0,
    }));

    return Response.json({ period: { start, end }, granularity, type, buckets, truncated });
  } catch (err) {
    console.error('getTimeSeries error:', err);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});