import {
	useInfiniteQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";

// Real API event interface matching the database schema
export interface Event {
	id: string;
	title: string;
	description?: string;
	eventType: string;
	status: string;
	eventDate: string;
	eventEndDate?: string;
	venueName?: string;
	venueAddress?: string;
	city?: string;
	country?: string;
	isOnline: boolean;
	isFree: boolean;
	priceMin?: number;
	priceMax?: number;
	currency?: string;
	organizerName?: string;
	organizerDescription?: string;
	organizerRating?: number;
	capacity?: number;
	registeredCount: number;
	techStack: string[];
	qualityScore?: number;
	externalUrl: string;
	imageUrl?: string;
	sourcePlatform: string;
	sourceId: string;
	scrapedAt: string;
	lastUpdated: string;
	createdAt: string;
}

interface UseEventsOptions {
	city?: string;
	eventType?: string;
	price?: string;
	date?: string;
	limit?: number;
	enablePolling?: boolean;
	enabled?: boolean; // Allow disabling the query
}

interface InfiniteEventsResponse {
	events: Event[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		pages: number;
	};
}

export const useEvents = (opts?: UseEventsOptions) => {
	const queryClient = useQueryClient();
	const limit = opts?.limit || 20;
	const enabled = opts?.enabled !== false; // Default to true, but allow disabling

	// Build base query params (without page)
	const buildBaseParams = () => {
		const params = new URLSearchParams();
		params.set("limit", String(limit));
		if (opts?.city && opts.city !== "all") params.set("city", opts.city);
		if (opts?.eventType && opts.eventType !== "all")
			params.set("eventType", opts.eventType);
		if (opts?.price && opts.price !== "all") params.set("price", opts.price);
		if (opts?.date && opts.date !== "all") params.set("date", opts.date);
		return params;
	};

	const baseParams = buildBaseParams();
	const queryKey = ["events", Object.fromEntries(baseParams)];

	const {
		data,
		isLoading,
		error,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		refetch,
	} = useInfiniteQuery<InfiniteEventsResponse>({
		queryKey,
		queryFn: async ({ pageParam = 1 }) => {
			const params = new URLSearchParams(baseParams);
			params.set("page", String(pageParam));

			const response = await fetch(`/api/events?${params.toString()}`);
			if (!response.ok) {
				throw new Error("Failed to fetch events");
			}
			return response.json();
		},
		getNextPageParam: (lastPage) => {
			const { page, pages } = lastPage.pagination;
			return page < pages ? page + 1 : undefined;
		},
		initialPageParam: 1,
		enabled, // Disable query when not needed
		refetchInterval: opts?.enablePolling ? 5000 : false,
		refetchIntervalInBackground: false,
		staleTime: 30000,
	});

	// Flatten all pages into a single events array
	const events = data?.pages.flatMap((page) => page.events) ?? [];

	// Scraping mutation
	const scrapeMutation = useMutation({
		mutationFn: async ({
			platform,
			city,
		}: {
			platform: string;
			city: string;
		}) => {
			const response = await fetch("/api/scraping/trigger", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ platform, city }),
			});
			if (!response.ok) {
				throw new Error("Failed to start scraping");
			}
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["events"] });
		},
	});

	return {
		// Events array - flattened from all pages
		events,
		// For homepage: use events (first page only if you don't call loadMore)
		// For listing page: use events (all accumulated pages)
		isLoading,
		isLoadingMore: isFetchingNextPage,
		error,
		// Infinite scroll support
		loadMore: () => fetchNextPage(),
		hasMore: hasNextPage ?? false,
		// Pagination info
		currentPage: data?.pages.length ?? 0,
		totalPages: data?.pages[0]?.pagination.pages ?? 0,
		// Manual refresh
		refetch,
		// Scraping functionality
		scrapeEvents: (platform: string, city: string) => {
			scrapeMutation.mutate({ platform, city });
		},
		isScraping: scrapeMutation.isPending,
		scrapingError: scrapeMutation.error,
	};
};
