import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  assertFamilyMember,
  fetchAllTransactions,
  toISODate,
  daysBetween,
} from '../_txAggregateHelper.ts';

// Returns the ISO date string of the Monday of the given date's week
function getWeekBucket(dateStr: string): string {
  const d = new Date(dateStr);
  const dow = d.getUTCDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow; // shift to Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return toISODate(monday);
}

// Returns 'YYYY-MM-01' for the month bucket
function getMonthBucket(dateStr: string): string {
  return dateStr.slice(0, 7) + '-01';
}

// Generate all expected bucket keys for a range given a granularity
function generateBuckets(start: string, end: string, granularity: string): string[] {
  const buckets: string[] = [];
  const endDate = new Date(end);
  let cursor = new Date(start);

  if (granularity === 'day') {
    while (cursor <= endDate) {
      buckets.push(toISODate(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else if (granularity === 'week') {
    // Start from the Monday of the start date's week
    const dow = cursor.getUTCDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    cursor.setUTCDate(cursor.getUTCDate() + diff);
    while (cursor <= endDate) {
      buckets.push(toISODate(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  } else {
    // month
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
      return Response.json({ error: 'invalid date range' }, { status: 400 });
    }

    // Auth check before any data query
    try {
      await assertFamilyMember(base44, familyId);
    } catch {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    const { transactions, truncated } = await fetchAllTransactions(base44, { familyId, start, end, type, personId });

    const filtered = type === 'all' ? transactions : transactions.filter(t => t.type === type);

    // Aggregate by bucket
    const bucketMap: Record<string, { total: number; count: number }> = {};

    filtered.forEach(t => {
      if (!t.date) return;
      let bucket: string;
      if (granularity === 'day') bucket = t.date.slice(0, 10);
      else if (granularity === 'week') bucket = getWeekBucket(t.date);
      else bucket = getMonthBucket(t.date);

      if (!bucketMap[bucket]) bucketMap[bucket] = { total: 0, count: 0 };
      bucketMap[bucket].total += t.amount || 0;
      bucketMap[bucket].count++;
    });

    // Fill empty buckets and sort ascending
    const allBuckets = generateBuckets(start, end, granularity);
    const buckets = allBuckets.map(bucket => ({
      bucket,
      total: bucketMap[bucket]?.total ?? 0,
      count: bucketMap[bucket]?.count ?? 0,
    }));

    return Response.json({
      period: { start, end },
      granularity,
      type,
      buckets,
      truncated,
    });
  } catch (err) {
    console.error('getTimeSeries error:', err);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
