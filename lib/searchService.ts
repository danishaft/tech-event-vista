import { prisma } from "./prisma";
import type { EventWithCategories, EventWithSelectedFields } from "@/app/types/events";

export interface SearchFilters {
	city?: string;
	eventType?: string;
	price?: string;
	date?: string;
	platforms?: string[];
}

const EVENT_SELECT = {
	id: true,
	title: true,
	description: true,
	eventType: true,
	status: true,
	eventDate: true,
	eventEndDate: true,
	venueName: true,
	venueAddress: true,
	city: true,
	country: true,
	isOnline: true,
	isFree: true,
	priceMin: true,
	priceMax: true,
	currency: true,
	organizerName: true,
	organizerDescription: true,
	organizerRating: true,
	capacity: true,
	registeredCount: true,
	techStack: true,
	qualityScore: true,
	externalUrl: true,
	imageUrl: true,
	sourcePlatform: true,
	sourceId: true,
	scrapedAt: true,
	lastUpdated: true,
	createdAt: true,
} as const;

export interface SearchResult {
	events: EventWithCategories[];
	total: number;
	source: "database";
}

// Manual types for Prisma where clauses (to avoid Prisma type imports)
interface DateTimeFilter {
	gte?: Date;
	lt?: Date;
	lte?: Date;
	gt?: Date;
}

interface StringFilter {
	contains?: string;
	mode?: "insensitive" | "default";
	equals?: string;
}

interface EventWhereInput {
	status?: string;
	eventDate?: DateTimeFilter;
	city?: StringFilter | string;
	eventType?: string;
	isFree?: boolean;
	OR?: Array<{
		title?: StringFilter;
		description?: StringFilter;
		techStack?: { hasSome: string[] };
		organizerName?: StringFilter;
		venueName?: StringFilter;
	}>;
}

/**
 * Build Prisma where clause for event search
 */
function buildSearchWhereClause(
	query: string | undefined,
	filters: SearchFilters,
	now: Date,
): EventWhereInput {
	const where: EventWhereInput = {
		status: "active",
		eventDate: { gte: now },
	};

	// Full-text search across multiple fields
	if (query?.trim()) {
		const searchTerm = query.trim();
		where.OR = [
			{ title: { contains: searchTerm, mode: "insensitive" } },
			{ description: { contains: searchTerm, mode: "insensitive" } },
			{ techStack: { hasSome: [searchTerm] } },
			{ organizerName: { contains: searchTerm, mode: "insensitive" } },
			{ venueName: { contains: searchTerm, mode: "insensitive" } },
		];
	}

	// Apply filters
	if (filters.city && filters.city !== "all") {
		where.city = { equals: filters.city, mode: "insensitive" };
	}

	if (filters.eventType && filters.eventType !== "all") {
		where.eventType = filters.eventType;
	}

	if (filters.price && filters.price !== "all") {
		where.isFree = filters.price === "free";
	}

	// Date filter - properly merge with future events constraint
	if (filters.date && filters.date !== "all") {
		const dateFilter = buildDateFilter(filters.date, now);
		if (dateFilter) {
			// Merge date filter with existing future events constraint
			where.eventDate = {
				...dateFilter,
				gte: dateFilter.gte || now,
			};
		}
	}

	return where;
}

/**
 * Build date range filter
 */
function buildDateFilter(
	dateFilter: string,
	now: Date,
): DateTimeFilter | null {
	switch (dateFilter) {
		case "today": {
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			return {
				gte: now,
				lt: tomorrow,
			};
		}
		case "thisWeek": {
			const nextWeek = new Date(now);
			nextWeek.setDate(nextWeek.getDate() + 7);
			return {
				gte: now,
				lt: nextWeek,
			};
		}
		case "thisMonth": {
			const nextMonth = new Date(now);
			nextMonth.setMonth(nextMonth.getMonth() + 1);
			return {
				gte: now,
				lt: nextMonth,
			};
		}
		case "nextMonth": {
			const nextMonth = new Date(now);
			nextMonth.setMonth(nextMonth.getMonth() + 1);
			const monthAfterNext = new Date(nextMonth);
			monthAfterNext.setMonth(monthAfterNext.getMonth() + 1);
			return {
				gte: nextMonth,
				lt: monthAfterNext,
			};
		}
		default:
			return null;
	}
}

/**
 * Search events in database with full-text search and filtering
 */
export async function searchDatabase(
	query: string | undefined,
	filters: SearchFilters = {},
	limit: number = 50,
): Promise<SearchResult> {
	const now = new Date();
	const where = buildSearchWhereClause(query, filters, now);

	// Execute search query with proper ordering
	// Type assertion needed because Prisma types aren't available in build context
	const [eventsRaw, total] = await Promise.all([
		prisma.event.findMany({
			where: where as any,
			orderBy: [{ qualityScore: "desc" }, { eventDate: "asc" }],
			take: limit,
			select: EVENT_SELECT,
		}),
		prisma.event.count({ where: where as any }),
	]);

	// Batch fetch EventCategory to avoid N+1 queries
	const eventIds = eventsRaw.map((e: EventWithSelectedFields) => e.id);
	const categories =
		eventIds.length > 0
			? await prisma.eventCategory.findMany({
					where: { eventId: { in: eventIds } },
					select: {
						eventId: true,
						category: true,
						value: true,
					},
				})
			: [];

	// Group categories by eventId
	const categoriesByEventId = new Map<
		string,
		Array<{ category: string; value: string }>
	>();
	for (const cat of categories) {
		if (!categoriesByEventId.has(cat.eventId)) {
			categoriesByEventId.set(cat.eventId, []);
		}
		categoriesByEventId.get(cat.eventId)!.push({
			category: cat.category,
			value: cat.value,
		});
	}

	// Map events with their categories
	const events = eventsRaw.map((event: EventWithSelectedFields) => ({
		...event,
		eventCategories: categoriesByEventId.get(event.id) || [],
	}));

	return {
		events,
		total,
		source: "database",
	};
}
