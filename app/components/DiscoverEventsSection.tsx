"use client";

import { ArrowRight } from "lucide-react";
import moment from "moment";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EventCard } from "@/components/EventCard";
import { EventDialog } from "@/components/EventDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type Event, useEvents } from "@/hooks/useEvents";
import { cn } from "@/lib/utils";

// Quick filter types and constants
export type QuickFilter = "all" | "this-week" | "this-month" | "free";

export const QUICK_FILTERS = [
	{ label: "All", value: "all" as QuickFilter },
	{ label: "This Week", value: "this-week" as QuickFilter },
	{ label: "This Month", value: "this-month" as QuickFilter },
	{ label: "Free Events", value: "free" as QuickFilter },
] as const;

/**
 * Filters events based on the selected quick filter
 */
function filterEventsByQuickFilter(
	events: Event[],
	filter: QuickFilter,
): Event[] {
	if (filter === "all") {
		return events;
	}

	const now = moment();

	if (filter === "this-week") {
		const weekFromNow = moment().add(7, "days");
		return events.filter((event) => {
			const eventDate = moment(event.eventDate);
			return (
				eventDate.isSameOrAfter(now) && eventDate.isSameOrBefore(weekFromNow)
			);
		});
	}

	if (filter === "this-month") {
		const monthFromNow = moment().endOf("month");
		return events.filter((event) => {
			const eventDate = moment(event.eventDate);
			return (
				eventDate.isSameOrAfter(now) && eventDate.isSameOrBefore(monthFromNow)
			);
		});
	}

	if (filter === "free") {
		return events.filter((event) => event.isFree);
	}

	return events;
}

const MAX_DISPLAYED_EVENTS = 8;
const SKELETON_COUNT = 8;

export function DiscoverEventsSection() {
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

	const { events, isLoading } = useEvents();

	const filteredEvents = useMemo(
		() => filterEventsByQuickFilter(events, quickFilter),
		[events, quickFilter],
	);

	const displayedEvents = filteredEvents.slice(0, MAX_DISPLAYED_EVENTS);
	const hasMoreEvents = filteredEvents.length > MAX_DISPLAYED_EVENTS;

	const handleEventClick = (event: Event) => {
		setSelectedEvent(event);
		setIsDialogOpen(true);
	};

	return (
		<section
			className="max-w-7xl mx-auto px-6 pt-spacing-section pb-spacing-section"
			aria-labelledby="discover-events-heading"
		>
			{/* Section Header */}
			<header className="flex items-center justify-between mb-6">
				<div>
					<h2
						id="discover-events-heading"
						className="font-heading text-2xl md:text-3xl font-bold mb-2 text-foreground"
					>
						Discover Events
					</h2>
					<p className="text-muted-foreground text-base md:text-lg">
						Popular events recommended for you
					</p>
				</div>
				<Link href="/events">
					<Button
						variant="outline"
						className="border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-doow-sm md:rounded-doow-md"
					>
						View All
						<ArrowRight className="ml-2 h-4 w-4" />
					</Button>
				</Link>
			</header>

			{/* Quick Filters */}
			<div className="flex items-center gap-3 mb-6 flex-wrap">
				{QUICK_FILTERS.map((filter) => (
					<Button
						key={filter.value}
						onClick={() => setQuickFilter(filter.value)}
						variant={quickFilter === filter.value ? "default" : "outline"}
						size="sm"
						className={cn(
							"rounded-doow-sm md:rounded-doow-md text-sm font-medium transition-all",
							quickFilter === filter.value
								? "bg-primary text-primary-foreground shadow-md"
								: "bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
						)}
					>
						{filter.label}
					</Button>
				))}
			</div>

			{isLoading ? (
				<div
					className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
					role="status"
					aria-label="Loading events"
				>
					{Array.from({ length: SKELETON_COUNT }).map((_, i) => (
						<Card key={i} className="rounded-lg overflow-hidden">
							<div className="p-0">
								<Skeleton className="h-56 w-full" />
								<div className="p-5 space-y-3">
									<Skeleton className="h-6 w-full" />
									<Skeleton className="h-4 w-3/4" />
									<Skeleton className="h-4 w-1/2" />
								</div>
							</div>
						</Card>
					))}
				</div>
			) : filteredEvents.length === 0 ? (
				<div className="text-center py-16" role="status">
					<p className="text-muted-foreground text-lg mb-2">
						No events found matching your filters.
					</p>
					<p className="text-muted-foreground-light">
						Try adjusting your search criteria.
					</p>
				</div>
			) : (
				<>
					<ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 list-none m-0 p-0">
						{displayedEvents.map((event) => (
							<li key={event.id}>
								<EventCard
									event={event}
									onClick={() => handleEventClick(event)}
								/>
							</li>
						))}
					</ul>
					{hasMoreEvents && (
						<nav className="mt-8 text-center" aria-label="View more events">
							<Link href="/events">
								<Button
									variant="outline"
									className="border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-doow-sm md:rounded-doow-md"
								>
									View All Events ({filteredEvents.length})
									<ArrowRight className="ml-2 h-4 w-4" />
								</Button>
							</Link>
						</nav>
					)}
				</>
			)}

			<EventDialog
				event={selectedEvent}
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
			/>
		</section>
	);
}
