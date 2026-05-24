import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function assertFamilyMember(base44, familyId) {
  const user = await base44.auth.me();
  if (!user) { const err = new Error('Unauthorized'); err.httpStatus = 401; throw err; }
  if (user.role === 'admin') return { user, membership: null };
  let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_id: user.id, family_id: familyId, status: 'approved' });
  if (!memberships.length) memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_email: user.email, family_id: familyId, status: 'approved' });
  if (!memberships.length) { const err = new Error('forbidden'); err.httpStatus = 403; throw err; }
  return { user, membership: memberships[0] };
}

function errorResponse(err) {
  const status = (err && err.httpStatus) || 500;
  const message = status === 500 ? 'internal' : err?.message || 'error';
  return Response.json({ error: message }, { status });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { familyId, description, type = 'expense' } = body;

    if (!familyId) {
      return Response.json({ error: 'Missing familyId' }, { status: 400 });
    }

    try {
      await assertFamilyMember(base44, familyId);
    } catch (e) {
      return errorResponse(e);
    }

    // Use service role (RLS enforced by entities)
    const entities = base44.asServiceRole.entities;
    
    // Fetch all transactions for this family
    const transactions = await entities.Transaction.filter({ family_id: familyId }, '-date', 500);

    // Fetch catalog data
    const [categories, subcategories, persons, paymentMethods] = await Promise.all([
      entities.Category.filter({ family_id: familyId }),
      entities.Subcategory.filter({ family_id: familyId }),
      entities.Person.filter({ family_id: familyId }),
      entities.PaymentMethod.filter({ family_id: familyId }),
    ]);

    // Filter transactions by type
    const filteredTxs = transactions.filter(t => t.type === type);

    // Score categories, persons and payment methods by frequency/recency
    const categoryScores = {};
    const personScores = {};
    const paymentMethodScores = {};
    const descriptionPatterns = {};

    filteredTxs.forEach((tx, index) => {
      const recencyBoost = 1 + (index / filteredTxs.length) * 0.5;

      if (tx.category_id) {
        categoryScores[tx.category_id] = (categoryScores[tx.category_id] || 0) + recencyBoost;
      }
      if (tx.person_id) {
        personScores[tx.person_id] = (personScores[tx.person_id] || 0) + recencyBoost;
      }
      if (tx.payment_method_id) {
        paymentMethodScores[tx.payment_method_id] = (paymentMethodScores[tx.payment_method_id] || 0) + recencyBoost;
      }
      if (tx.description && tx.category_id) {
        const descKey = tx.description.toLowerCase().trim();
        if (!descriptionPatterns[descKey]) {
          descriptionPatterns[descKey] = { category_id: tx.category_id, count: 0 };
        }
        descriptionPatterns[descKey].count++;
      }
    });

    // Match description to find related category/person
    let matchedCategoryId = null;
    let matchedPersonId = null;

    if (description && description.length > 2) {
      const descLower = description.toLowerCase();

      for (const [pattern, data] of Object.entries(descriptionPatterns)) {
        if (pattern.includes(descLower) || descLower.includes(pattern.split(' ')[0])) {
          matchedCategoryId = data.category_id;
          break;
        }
      }

      const relatedTxs = filteredTxs.filter(t =>
        t.description && t.description.toLowerCase().includes(descLower)
      );

      if (relatedTxs.length > 0) {
        const personFreq = {};
        relatedTxs.forEach(tx => {
          if (tx.person_id) {
            personFreq[tx.person_id] = (personFreq[tx.person_id] || 0) + 1;
          }
        });
        const sortedPersons = Object.keys(personFreq).sort((a, b) => personFreq[b] - personFreq[a]);
        matchedPersonId = sortedPersons[0] || null;
      }
    }

    // Build top suggestions
    const topCategories = Object.entries(categoryScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => categories.find(c => c.id === id))
      .filter(Boolean);

    const topPersons = Object.entries(personScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => {
        const person = persons.find(p => p.id === id);
        if (!person) return null;

        // Calculate most-frequently-used payment method for this person
        const personTxs = filteredTxs.filter(t => t.person_id === id && t.payment_method_id);
        const methodFreq = {};
        personTxs.forEach(tx => {
          methodFreq[tx.payment_method_id] = (methodFreq[tx.payment_method_id] || 0) + 1;
        });
        const sortedMethods = Object.keys(methodFreq).sort((a, b) => methodFreq[b] - methodFreq[a]);
        const preferredMethodId = sortedMethods[0] ?? null;

        return { ...person, preferredMethodId };
      })
      .filter(Boolean);

    const topPaymentMethods = Object.entries(paymentMethodScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => paymentMethods.find(m => m.id === id))
      .filter(Boolean);

    // Stats for matched category
    let avgAmount = null;
    let matchedCategory = null;
    let categoryStats = null;
    let matchedSubcategory = null;

    if (matchedCategoryId) {
      const categoryTxs = filteredTxs.filter(t => t.category_id === matchedCategoryId);
      if (categoryTxs.length > 0) {
        const amounts = categoryTxs.map(t => t.amount || 0);
        const count = amounts.length;
        const mean = amounts.reduce((sum, a) => sum + a, 0) / count;
        const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / count;
        const stddev = Math.sqrt(variance);

        avgAmount = Math.round(mean);
        categoryStats = {
          mean: Math.round(mean * 100) / 100,
          stddev: Math.round(stddev * 100) / 100,
          count,
        };
      }

      matchedCategory = categories.find(c => c.id === matchedCategoryId) ?? null;

      if (description && description.length > 2) {
        const descLower = description.toLowerCase();
        const relevantTxs = filteredTxs.filter(t =>
          t.category_id === matchedCategoryId &&
          t.subcategory_id &&
          t.description &&
          t.description.toLowerCase().includes(descLower)
        );

        if (relevantTxs.length > 0) {
          const subFreq = {};
          relevantTxs.forEach(tx => {
            subFreq[tx.subcategory_id] = (subFreq[tx.subcategory_id] || 0) + 1;
          });
          const topSubId = Object.keys(subFreq).sort((a, b) => subFreq[b] - subFreq[a])[0];
          matchedSubcategory = subcategories.find(s => s.id === topSubId) ?? null;
        } else {
          const catSubTxs = filteredTxs.filter(t => t.category_id === matchedCategoryId && t.subcategory_id);
          if (catSubTxs.length > 0) {
            const subFreq = {};
            catSubTxs.forEach(tx => {
              subFreq[tx.subcategory_id] = (subFreq[tx.subcategory_id] || 0) + 1;
            });
            const topSubId = Object.keys(subFreq).sort((a, b) => subFreq[b] - subFreq[a])[0];
            matchedSubcategory = subcategories.find(s => s.id === topSubId) ?? null;
          }
        }
      }
    }

    return Response.json({
      suggestedCategories: topCategories,
      suggestedPersons: topPersons,
      suggestedPaymentMethods: topPaymentMethods,
      matchedCategory,
      categoryStats,
      matchedSubcategory,
      matchedPerson: matchedPersonId ? persons.find(p => p.id === matchedPersonId) : null,
      avgAmount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});