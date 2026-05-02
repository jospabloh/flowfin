import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			staleTime: 2 * 60 * 1000, // 2 min global — prevents re-fetching on every navigation
			retry: (failCount, error) => {
				// Never retry on 429 — it only makes the rate limit worse
				const msg = error?.message || '';
				if (msg.includes('429') || msg.includes('Rate limit')) return false;
				return failCount < 1;
			},
			retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 10000),
		},
	},
});