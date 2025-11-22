import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Event } from "./useEvents";

export interface SearchFilters {
	city?: string;
	eventType?: string;
	price?: string;
	date?: string;
}

export interface SearchResult {
	events: Event[];
	isLoading: boolean;
	error: string | null;
	totalEvents: number;
	source: "database" | "live_scraping" | "cache";
	platformStatus: PlatformStatus[];
	isComplete: boolean;
}

export interface PlatformStatus {
	platform: string;
	status: "pending" | "running" | "completed" | "failed";
	eventsFound: number;
	error?: string;
}

/**
 * Custom hook for advanced search with job queue pattern
 * Implements database-first search with background scraping via job queue
 */
export const useSearch = (
	query: string,
	filters: SearchFilters = {},
	options: {
		maxResults?: number;
		enabled?: boolean;
	} = {},
) => {
	const { maxResults = 50, enabled = true } = options;

	// State management
	const [events, setEvents] = useState<Event[]>([]);
	const [totalEvents, setTotalEvents] = useState(0);
	const [source, setSource] = useState<"database" | "live_scraping" | "cache">(
		"database",
	);
	const [platformStatus, setPlatformStatus] = useState<PlatformStatus[]>([]);
	const [isComplete, setIsComplete] = useState(false);
	const [jobId, setJobId] = useState<string | null>(null);
	const [isPolling, setIsPolling] = useState(false);

	// Ref to track polling interval for cleanup
	const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

	/**
	 * Start search job - POST to /api/events/search
	 */
	const startSearch = useCallback(async (): Promise<string | null> => {
		const trimmedQuery = query.trim();
		if (!trimmedQuery) {
			throw new Error("Query cannot be empty");
		}

		// Build request body
		const body = {
			query: trimmedQuery,
			city: filters.city && filters.city !== "all" ? filters.city : undefined,
			eventType:
				filters.eventType && filters.eventType !== "all"
					? filters.eventType
					: undefined,
			price: filters.price && filters.price !== "all" ? filters.price : undefined,
			date: filters.date && filters.date !== "all" ? filters.date : undefined,
			limit: maxResults,
		};

		const response = await fetch("/api/events/search", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.error || `Search failed: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();

		// If we got events directly (database results), return them
		if (data.events && Array.isArray(data.events)) {
			setEvents(data.events || []);
			setTotalEvents(data.total || data.events?.length || 0);
			setSource(data.source || "database");
			setIsComplete(true);
			return null; // No job ID needed
		}

		// Otherwise, we got a job ID for background scraping
		if (data.jobId) {
			setJobId(data.jobId);
			setSource("live_scraping");
			setIsComplete(false);
			return data.jobId;
		}

		throw new Error("Unexpected response format");
	}, [query, filters, maxResults]);

	/**
	 * Poll job status - GET /api/events/search/status?jobId=...
	 * Returns true if job completed, false if still running, throws if failed
	 */
	const pollJobStatus = useCallback(async (jobIdToPoll: string): Promise<boolean> => {
		const response = await fetch(`/api/events/search/status?jobId=${jobIdToPoll}`);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.error || `Status check failed: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();

		if (data.status === "completed") {
			setEvents(data.events || []);
			setTotalEvents(data.total || data.events?.length || 0);
			setSource("live_scraping");
			setIsComplete(true);
			setIsPolling(false);
			setJobId(null);

			// Stop polling
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
				pollIntervalRef.current = null;
			}
			return true; // Job completed
		} else if (data.status === "failed") {
			console.error(`❌ [CLIENT] Job failed:`, {
				jobId: jobIdToPoll,
				error: data.error,
			});
			setIsPolling(false);
			setJobId(null);

			// Stop polling
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
				pollIntervalRef.current = null;
			}

			throw new Error(data.error || "Scraping job failed");
		} else if (data.status === "running") {
			return false; // Still running, continue polling
		}
		
		return false; // Unknown status, continue polling
	}, []);

	/**
	 * Search mutation using React Query for proper lifecycle management
	 */
	const searchMutation = useMutation({
		mutationFn: async () => {
			// Start search and get job ID (or null if database results)
			const newJobId = await startSearch();

			// If we got database results immediately, we're done
			if (!newJobId) {
				return { type: "database" as const };
			}

			// Otherwise, start polling for job status
			setIsPolling(true);

			// Poll immediately first time
			const completed = await pollJobStatus(newJobId);
			if (completed) {
				return { type: "job" as const, jobId: newJobId };
			}

			// Keep polling until job completes or fails
			// This Promise resolves only when the job completes
			return new Promise<{ type: "job"; jobId: string }>((resolve, reject) => {
				if (pollIntervalRef.current) {
					clearInterval(pollIntervalRef.current);
				}

				pollIntervalRef.current = setInterval(async () => {
					try {
						const isCompleted = await pollJobStatus(newJobId);
						if (isCompleted) {
							// Job completed - resolve the promise
							if (pollIntervalRef.current) {
								clearInterval(pollIntervalRef.current);
								pollIntervalRef.current = null;
							}
							resolve({ type: "job", jobId: newJobId });
						}
						// If not completed, continue polling (interval continues)
					} catch (error) {
						console.error("❌ [CLIENT] Polling error:", error);
						setIsPolling(false);
						if (pollIntervalRef.current) {
							clearInterval(pollIntervalRef.current);
							pollIntervalRef.current = null;
						}
						reject(error);
					}
				}, 3000); // Poll every 3 seconds
			});
		},
		onMutate: () => {
			// Stop any existing polling
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
				pollIntervalRef.current = null;
			}

			// Reset state when starting new search
			setEvents([]);
			setTotalEvents(0);
			setIsComplete(false);
			setPlatformStatus([]);
			setJobId(null);
			setIsPolling(false);
		},
		onSettled: () => {
			// Cleanup polling on completion/error
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
				pollIntervalRef.current = null;
			}
			setIsPolling(false);
		},
	});

	/**
	 * Retry search
	 */
	const retry = useCallback(() => {
		searchMutation.mutate();
	}, [searchMutation]);

	/**
	 * Clear search results
	 */
	const clear = useCallback(() => {
		// Stop polling
		if (pollIntervalRef.current) {
			clearInterval(pollIntervalRef.current);
			pollIntervalRef.current = null;
		}

		searchMutation.reset();
		setEvents([]);
		setTotalEvents(0);
		setIsComplete(false);
		setPlatformStatus([]);
		setJobId(null);
		setIsPolling(false);
	}, [searchMutation]);

	// Start search when dependencies change
	useEffect(() => {
		// Skip if disabled or empty query
		if (!enabled || !query.trim()) {
			return;
		}

		// Don't trigger if mutation is already in progress
		if (searchMutation.isPending) {
			return;
		}

		searchMutation.mutate();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [query, JSON.stringify(filters), maxResults, enabled]);

	// Cleanup on unmount - stop polling
	useEffect(() => {
		return () => {
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
				pollIntervalRef.current = null;
			}
		};
	}, []);

	// Return search result interface
	const result: SearchResult = {
		events,
		isLoading: searchMutation.isPending || isPolling,
		error:
			searchMutation.error instanceof Error
				? searchMutation.error.message
				: searchMutation.error
					? String(searchMutation.error)
					: null,
		totalEvents,
		source,
		platformStatus: [], // Platform status removed from UI - kept for internal compatibility
		isComplete,
	};

	return {
		...result,
		retry,
		clear,
		startSearch: () => searchMutation.mutate(),
	};
};

export default useSearch;
