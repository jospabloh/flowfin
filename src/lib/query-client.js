import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 2 * 60 * 1000, // 2 min global — prevents re-fetching on every navigation
		},
	},
});