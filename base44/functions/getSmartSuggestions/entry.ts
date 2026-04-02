import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { familyId, description, type = 'expense' } = body;

    if (!familyId) {
      return Response.json({ error: 'Missing familyId' }, { status: 400 });
    }

    // Fetch all transactions for this family
    const transactions = await base44.entities.Transaction.filter({ family_id: familyId }, '-date', 500);
    
    // Fetch catalog data
    const [categories, subcategories, persons, paymentMethods] = await Promise.all([
      base44.entities.Category.filter({ family_id: familyId }),
      base44.entities.Subcategory.filter({ family_id: familyId }),
      base44.entities.Person.filter({ family_id: familyId }),
      base44.entities.PaymentMethod.filter({ family_id: familyId }),
    ]);

    // Analyze patterns
    const categoryScores = {};
    const personScores = {};
    const paymentMethodScores = {};
    const descriptionPatterns = {};

    // Filter transactions by type
    const filteredTxs = transactions.filter(t => t.type === type);

    // Score categories and persons based on frequency and recency
    filteredTxs.forEach((tx, index) => {
      const recencyBoost = 1 + (index / filteredTxs.length) * 0.5; // Recent = higher score
      
      // Category scoring
      if (tx.category_id) {
        categoryScores[tx.category_id] = (categoryScores[tx.category_id] || 0) + recencyBoost;
      }
      
      // Person scoring
      if (tx.person_id) {
        personScores[tx.person_id] = (personScores[tx.person_id] || 0) + recencyBoost;
      }
      
      // Payment method scoring
      if (tx.payment_method_id) {
        paymentMethodScores[tx.payment_method_id] = (paymentMethodScores[tx.payment_method_id] || 0) + recencyBoost;
      }

      // Description patterns
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
      
      // Find categories by description similarity
      for (const [pattern, data] of Object.entries(descriptionPatterns)) {
        if (pattern.includes(descLower) || descLower.includes(pattern.split(' ')[0])) {
          matchedCategoryId = data.category_id;
          break;
        }
      }

      // Find persons commonly associated with this description pattern
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
        matchedPersonId = Object.keys(personFreq).sort((a, b) => personFreq[b] - personFreq[a])[0];
      }
    }

    // Build suggestions
    const topCategories = Object.entries(categoryScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => categories.find(c => c.id === id))
      .filter(Boolean);

    const topPersons = Object.entries(personScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => persons.find(p => p.id === id))
      .filter(Boolean);

    const topPaymentMethods = Object.entries(paymentMethodScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => paymentMethods.find(m => m.id === id))
      .filter(Boolean);

    // Calculate average amount for matched category
    let avgAmount = null;
    if (matchedCategoryId) {
      const categoryTxs = filteredTxs.filter(t => t.category_id === matchedCategoryId);
      if (categoryTxs.length > 0) {
        avgAmount = Math.round(categoryTxs.reduce((sum, t) => sum + t.amount, 0) / categoryTxs.length);
      }
    }

    return Response.json({
      suggestedCategories: topCategories,
      suggestedPersons: topPersons,
      suggestedPaymentMethods: topPaymentMethods,
      matchedCategory: matchedCategoryId ? categories.find(c => c.id === matchedCategoryId) : null,
      matchedPerson: matchedPersonId ? persons.find(p => p.id === matchedPersonId) : null,
      avgAmount: avgAmount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});