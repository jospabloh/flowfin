# Optimistic Updates Implementation Guide

## Overview
Optimistic updates provide instant UI feedback by assuming mutations will succeed before server confirmation. This creates a snappy, lag-free user experience.

---

## Pattern: React Query Optimistic Update with Rollback

```javascript
const createItemMutation = useMutation({
  mutationFn: (data) => base44.entities.Item.create(data),
  
  // 1. BEFORE mutation starts: cancel pending queries & save snapshot
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['items'] });
    const previous = queryClient.getQueryData(['items']);
    
    // 2. OPTIMISTIC: immediately update cache with temp ID
    const optimistic = { ...newData, id: `opt_${Date.now()}` };
    queryClient.setQueryData(['items'], (old = []) => [...old, optimistic]);
    
    return { previous }; // Save snapshot for rollback
  },
  
  // 3. ON ERROR: restore previous state
  onError: (err, newData, ctx) => {
    if (ctx?.previous) {
      queryClient.setQueryData(['items'], ctx.previous);
    }
    // Show toast error: "Falló al crear item"
  },
  
  // 4. AFTER (success or error): refetch to sync real data
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['items'] });
  },
});

// Usage:
<button onClick={() => createItemMutation.mutate(formData)}>
  Crear
</button>
```

---

## Mutation Patterns by Entity

### CREATE Pattern
```javascript
const createMutation = useMutation({
  mutationFn: (data) => base44.entities.Entity.create(data),
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['entities'] });
    const previous = queryClient.getQueryData(['entities']);
    
    // Add to list with temp ID
    const optimistic = { ...newData, id: `opt_${Date.now()}` };
    queryClient.setQueryData(['entities'], (old = []) => [...old, optimistic]);
    
    return { previous };
  },
  onError: (_, __, ctx) => {
    if (ctx?.previous) queryClient.setQueryData(['entities'], ctx.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['entities'] }),
});
```

### UPDATE Pattern
```javascript
const updateMutation = useMutation({
  mutationFn: ({ id, data }) => base44.entities.Entity.update(id, data),
  onMutate: async ({ id, data }) => {
    await queryClient.cancelQueries({ queryKey: ['entities'] });
    const previous = queryClient.getQueryData(['entities']);
    
    // Update item in list
    queryClient.setQueryData(['entities'], (old = []) =>
      old.map(item => item.id === id ? { ...item, ...data } : item)
    );
    
    return { previous };
  },
  onError: (_, __, ctx) => {
    if (ctx?.previous) queryClient.setQueryData(['entities'], ctx.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['entities'] }),
});
```

### DELETE Pattern
```javascript
const deleteMutation = useMutation({
  mutationFn: (id) => base44.entities.Entity.delete(id),
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: ['entities'] });
    const previous = queryClient.getQueryData(['entities']);
    
    // Remove from list
    queryClient.setQueryData(['entities'], (old = []) =>
      old.filter(item => item.id !== id)
    );
    
    return { previous };
  },
  onError: (_, __, ctx) => {
    if (ctx?.previous) queryClient.setQueryData(['entities'], ctx.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['entities'] }),
});
```

---

## Implementation Checklist

- [ ] Import `useMutation` from @tanstack/react-query
- [ ] Define mutation with `mutationFn`
- [ ] Implement `onMutate` to update cache immediately
- [ ] Save snapshot in `onMutate` return value
- [ ] Implement `onError` to restore snapshot
- [ ] Implement `onSettled` to refetch/invalidate
- [ ] Call mutation with `.mutate()` on user action
- [ ] Close forms/dialogs immediately (optimistic)
- [ ] Show error toast if mutation fails

---

## Current Implementation Status

### ✅ Correctly Implemented (Optimistic)
- Capture.jsx - Transaction CREATE
- TransactionEditModal.jsx - Transaction UPDATE
- Investments.jsx - Investment/InvestmentPayment CREATE
- MSIPage.jsx - MSI/MSIPayment CREATE
- Rentals.jsx - RentalProperty/RentalPayment CREATE
- Catalogs.jsx - All CREATE/DELETE mutations (refactored)

### ⚠️ Legacy Pattern (No Optimistic - avoid)
```javascript
// OLD - DO NOT USE
const deleteItem = async (entity, id) => {
  await base44.entities[entity].delete(id);
  queryClient.invalidateQueries(...); // Wait for delete first
};
```

---

## Error Recovery & UX

### Handling Failures
```javascript
// In component:
const [error, setError] = useState(null);

const mutation = useMutation({
  mutationFn: ...,
  onMutate: ...,
  onError: (err, vars, ctx) => {
    if (ctx?.previous) {
      queryClient.setQueryData(['items'], ctx.previous);
    }
    setError(`Error: ${err.message}`);
    // Toast: "No se pudo crear item. Intenta de nuevo"
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['items'] });
  },
});

// Optional: show loading state
{mutation.isPending && <LoadingSpinner />}
```

---

## Performance Impact

**Without Optimistic Updates:**
- User clicks "Create" → Wait 200-500ms → Item appears

**With Optimistic Updates:**
- User clicks "Create" → Item appears instantly → Syncs with server

**Result:** Perceived latency eliminated, better perceived performance

---

## Notes

1. **Temp IDs**: Use `opt_${Date.now()}` for optimistic records. `onSettled` refetch replaces with real ID.
2. **Snapshot Pattern**: Always save `previous` state to handle rollbacks.
3. **Error Messages**: Inform user that mutation failed so they can retry.
4. **Validation**: Still validate on client before calling mutate (prevent invalid data).
5. **Race Conditions**: `cancelQueries` prevents cache conflicts from old queries.