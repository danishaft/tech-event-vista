"use client";

import {
	AlertCircle,
	CheckCircle,
	Clock,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { BottomNavigation } from "@/components/BottomNavigation";
import { EventCard } from "@/components/EventCard";
import { EventDialog } from "@/components/EventDialog";
import { FilterBar } from "@/components/FilterBar";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { Event } from "@/hooks/useEvents";
import { useEventsData } from "@/hooks/useEventsData";

function EventsPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [activeTab, setActiveTab] = useState("home");
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	// Read all values from URL params as source of truth
	const searchQuery = searchParams.get("q") || searchParams.get("query") || "";

	// Derive filters from URL params
	const filters = useMemo(
		() => ({
			eventType: searchParams.get("eventType") || "all",
			city: searchParams.get("city") || "all",
			price: searchParams.get("price") || "all",
			date: searchParams.get("date") || "all",
		}),
		[searchParams],
	);

	// Unified hook that handles both browse and search modes
	const {
		events,
		isLoading,
		isLoadingMore,
		hasMore,
		loadMore,
		error,
		totalEvents,
		source,
		isComplete,
		retry,
		mode,
	} = useEventsData({
		searchQuery,
		filters,
		limit: 20,
	});

	// Update URL params when filters change
	const handleFilterChange = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		if (value === "all") {
			params.delete(key);
		} else {
			params.set(key, value);
		}
		router.push(`/events?${params.toString()}`);
	};

	const handleClearFilters = () => {
		const params = new URLSearchParams(searchParams.toString());
		// Keep search query, remove filter params
		params.delete("eventType");
		params.delete("city");
		params.delete("price");
		params.delete("date");
		router.push(`/events?${params.toString()}`);
	};

	// Search is handled by FilterBar directly updating URL
	const handleSearch = (query: string) => {
		const params = new URLSearchParams(searchParams.toString());
		if (query.trim()) {
			params.set("q", query.trim());
		} else {
			params.delete("q");
		}
		router.push(`/events?${params.toString()}`);
	};

	return (
		<div className="min-h-screen bg-background">
			<Header />

			<main className="pb-20 md:pb-8" id="events-scroll-container">
				<section
					className="max-w-7xl mx-auto px-6 py-spacing-section"
					aria-labelledby="all-events-heading"
				>
					<header className="mb-8">
						<h1
							id="all-events-heading"
							className="font-heading text-3xl md:text-4xl font-bold mb-2 text-foreground"
						>
							All Events
						</h1>
						<p className="text-muted-foreground text-lg">
							Discover and explore all available tech events
						</p>
					</header>

					{/* Filters with Search */}
					<FilterBar
						selectedFilters={filters}
						onFilterChange={handleFilterChange}
						onClearFilters={handleClearFilters}
						onSearch={handleSearch}
						isSearching={mode === "search" && isLoading}
					/>

					{/* Search Query Display */}
					{mode === "search" && (
						<div className="mb-6">
							<div className="flex items-center gap-2 mb-2">
								<h2 className="font-heading text-xl font-bold">
									Search results for &quot;{searchQuery}&quot;
								</h2>
							</div>
							<div className="flex items-center gap-4">
								{source && (
									<Badge variant="outline" className="text-xs">
										{source === "database"
											? "Database"
											: source === "live_scraping"
												? "Live Scraping"
												: "Cache"}
									</Badge>
								)}
								{totalEvents !== undefined && totalEvents > 0 && (
									<Badge variant="secondary" className="text-xs">
										{totalEvents} events found
									</Badge>
								)}
							</div>
						</div>
					)}

					{/* Error State (only for search) */}
					{mode === "search" && error && retry && (
						<div
							className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
							role="alert"
						>
							<div className="flex items-center gap-2 mb-2">
								<AlertCircle className="h-4 w-4 text-red-500" />
								<span className="font-medium text-red-800">Search Error</span>
							</div>
							<p className="text-red-700 text-sm mb-3">{error}</p>
							<Button onClick={retry} size="sm" variant="outline">
								<RefreshCw className="h-4 w-4 mr-2" />
								Retry Search
							</Button>
						</div>
					)}

					{/* Loading State (for live scraping) */}
					{mode === "search" && isLoading && (
						<div className="mb-6" role="status" aria-label="Searching">
							<div className="flex items-center gap-2 mb-2">
								<RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
								<span className="text-sm font-medium">Searching...</span>
							</div>
							<Progress value={undefined} className="h-2" />
							<p className="text-xs text-muted-foreground mt-2">
								{source === "database"
									? "Searching database..."
									: "Live scraping in progress..."}
							</p>
						</div>
					)}

					{isLoading && events.length === 0 ? (
						<div
							className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
							role="status"
							aria-label="Loading events"
						>
							{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
								<Card key={i} className="rounded-lg overflow-hidden">
									<CardContent className="p-0">
										<Skeleton className="h-56 w-full" />
										<div className="p-5 space-y-3">
											<Skeleton className="h-6 w-full" />
											<Skeleton className="h-4 w-3/4" />
											<Skeleton className="h-4 w-1/2" />
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					) : (
						<>
							{events.length > 0 ? (
								mode === "search" ? (
									// Search results (no infinite scroll, shows all results from SSE)
									<ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 list-none m-0 p-0">
										{events.map((event) => (
											<li key={event.id} className="h-full">
												<EventCard
													event={event}
													onClick={() => {
														setSelectedEvent(event);
														setIsDialogOpen(true);
													}}
												/>
											</li>
										))}
									</ul>
								) : (
									// Database browsing (with infinite scroll)
									<InfiniteScroll
										dataLength={events.length}
										next={loadMore!}
										hasMore={hasMore ?? false}
										loader={
											<div
												className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6"
												role="status"
												aria-label="Loading more events"
											>
												{[1, 2, 3, 4].map((i) => (
													<Card key={i} className="rounded-lg overflow-hidden">
														<CardContent className="p-0">
															<Skeleton className="h-56 w-full" />
															<div className="p-5 space-y-3">
																<Skeleton className="h-6 w-full" />
																<Skeleton className="h-4 w-3/4" />
																<Skeleton className="h-4 w-1/2" />
															</div>
														</CardContent>
													</Card>
												))}
											</div>
										}
										endMessage={
											<div className="text-center py-8" role="status">
												<p className="text-muted-foreground">
													{events.length > 0
														? "You've reached the end! No more events to load."
														: ""}
												</p>
											</div>
										}
										scrollThreshold={0.8}
									>
										<ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 list-none m-0 p-0">
											{events.map((event) => (
												<li key={event.id} className="h-full">
													<EventCard
														event={event}
														onClick={() => {
															setSelectedEvent(event);
															setIsDialogOpen(true);
														}}
													/>
												</li>
											))}
										</ul>
									</InfiniteScroll>
								)
							) : (
								<div className="text-center py-16" role="status">
									<p className="text-muted-foreground text-lg mb-2">
										{mode === "search"
											? `No events found for "${searchQuery}". Try another query.`
											: events.length === 0
												? "No events available at the moment."
												: "No events found matching your filters."}
									</p>
									<p className="text-muted-foreground-light text-sm mb-4">
										{mode === "search"
											? "Try adjusting your search terms or filters."
											: events.length === 0
												? "Check back later for new events."
												: `Showing ${events.length} total events. Try adjusting your filters.`}
									</p>
									{mode === "search" && retry ? (
										<Button onClick={retry} variant="outline" className="mt-4">
											<RefreshCw className="h-4 w-4 mr-2" />
											Search Again
										</Button>
									) : (
										events.length > 0 && (
											<button
												onClick={handleClearFilters}
												className="text-primary hover:underline text-sm font-medium"
											>
												Clear all filters
											</button>
										)
									)}
								</div>
							)}

							{/* Search Complete Indicator */}
							{mode === "search" &&
								isComplete &&
								events.length > 0 &&
								totalEvents !== undefined &&
								source && (
									<div className="text-center py-8" role="status">
										<div className="flex items-center justify-center gap-2 mb-2">
											<CheckCircle className="h-4 w-4 text-green-500" />
											<span className="text-sm font-medium text-green-700">
												Search Complete
											</span>
										</div>
										<p className="text-xs text-muted-foreground">
											Found {totalEvents} events from{" "}
											{source === "database" ? "database" : "live scraping"}
										</p>
									</div>
								)}
						</>
					)}

					<EventDialog
						event={selectedEvent}
						open={isDialogOpen}
						onOpenChange={setIsDialogOpen}
					/>
				</section>
			</main>

			<Footer />

			<BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
		</div>
	);
}

export default function EventsPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-background">
					<Header />
					<main className="pb-20 md:pb-8">
						<section className="max-w-7xl mx-auto px-6 py-spacing-section">
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
								{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
									<Card key={i} className="rounded-lg overflow-hidden">
										<CardContent className="p-0">
											<Skeleton className="h-56 w-full" />
											<div className="p-5 space-y-3">
												<Skeleton className="h-6 w-full" />
												<Skeleton className="h-4 w-3/4" />
												<Skeleton className="h-4 w-1/2" />
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</section>
					</main>
					<Footer />
				</div>
			}
		>
			<EventsPageContent />
		</Suspense>
	);
}
