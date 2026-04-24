import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

async function fetchAllTransactions(base44, { familyId, start, end, type, personId }) {
  const PAGE = 200;
  let all = [];
  let skip = 0;
  let truncated = false;
  const filter = { family_id: familyId };
  if (start) filter.date = { ...filter.date, $gte: start };
  if (end) filter.date = { ...filter.date, $lte: end };
  if (type && type !== 'all') filter.type = type;
  if (personId) filter.person_id = personId;

  while (true) {
    const page = await base44.asServiceRole.entities.Transaction.filter(filter, '-date', PAGE, skip);
    all = all.concat(page || []);
    if (!page || page.length < PAGE) break;
    skip += PAGE;
    if (all.length >= 2000) { truncated = true; break; }
  }
  return { transactions: all, truncated };
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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { familyId, start, end, granularity = 'day', type = 'expense', personId } = body;

    if (!familyId) return Response.json({ error: 'familyId required' }, { status: 400 });
    if (!start || !end || new Date(start) > new Date(end)) {
      return Response.json({ error: 'invalid date range' }, { status: 400 });
    }

    const validGranularities = ['day', 'week', 'month'];
    if (!validGranularities.includes(granularity)) {
      return Response.json({ error: 'invalid granularity' }, { status: 400 });
    }

    const { transactions, truncated } = await fetchAllTransactions(base44, { familyId, start, end, type, personId });
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