import { useMemo } from "react";
import { type Event, useEvents } from "./useEvents";
import { type SearchFilters, useSearch } from "./useSearch";

export interface UseEventsDataOptions {
	searchQuery?: string;
	filters: {
		eventType: string;
		city: string;
		price: string;
		date: string;
	};
	limit?: number;
}

export interface EventsDataResult {
	events: Event[];
	isLoading: boolean;
	isLoadingMore?: boolean;
	hasMore?: boolean;
	loadMore?: () => void;
	error: string | null;
	// Search-specific properties
	totalEvents?: number;
	source?: "database" | "live_scraping" | "cache";
	isComplete?: boolean;
	retry?: () => void;
	mode: "browse" | "search";
}

/**
 * Unified hook for fetching events data
 * Automatically switches between database browsing and live search based on search query
 *
 * IMPORTANT: Always calls both hooks to follow React's Rules of Hooks, but:
 * - useSearch is disabled when there's no search query (via enabled flag)
 * - useEvents is disabled when searching (via enablePolling: false and React Query's enabled)
 *
 * This ensures we don't make unnecessary API calls while maintaining hook call consistency.
 *
 * @example
 * const { events, isLoading, mode } = useEventsData({
 *   searchQuery: 'react',
 *   filters: { eventType: 'all', city: 'all', price: 'all', date: 'all' },
 *   platform: 'eventbrite'
 * });
 */
export const useEventsData = (
	options: UseEventsDataOptions,
): EventsDataResult => {
	const { searchQuery = "", filters, limit = 20 } = options;

	const hasSearchQuery = !!searchQuery.trim();

	// Normalize filters for search hook
	const searchFilters: SearchFilters = useMemo(
		() => ({
			city: filters.city !== "all" ? filters.city : undefined,
			eventType: filters.eventType !== "all" ? filters.eventType : undefined,
			price: filters.price !== "all" ? filters.price : undefined,
			date: filters.date !== "all" ? filters.date : undefined,
		}),
		[filters],
	);

	// Always call both hooks (React Rules of Hooks requirement)
	// But disable the inactive one to prevent unnecessary work
	const searchResult = useSearch(searchQuery, searchFilters, {
		maxResults: 50,
		enabled: hasSearchQuery, // Prevents search from running when browsing
	});

	// Disable browse when searching to prevent unnecessary API calls
	const browseResult = useEvents({
		city: filters.city,
		eventType: filters.eventType,
		price: filters.price,
		date: filters.date,
		limit,
		enabled: !hasSearchQuery, // Only enable when not searching
		enablePolling: false,
	});

	// Return the appropriate result based on mode
	// When searching, browseResult will still have cached data but we ignore it
	if (hasSearchQuery) {
		return {
			events: searchResult.events,
			isLoading: searchResult.isLoading,
			error: searchResult.error,
			totalEvents: searchResult.totalEvents,
			source: searchResult.source,
			isComplete: searchResult.isComplete,
			retry: searchResult.retry,
			mode: "search",
		};
	}

	return {
		events: browseResult.events,
		isLoading: browseResult.isLoading,
		isLoadingMore: browseResult.isLoadingMore,
		hasMore: browseResult.hasMore,
		loadMore: browseResult.loadMore,
		error:
			browseResult.error instanceof Error
				? browseResult.error.message
				: browseResult.error
					? String(browseResult.error)
					: null,
		mode: "browse",
	};
};
