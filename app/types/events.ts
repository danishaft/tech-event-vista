/**
 * Event type definitions
 * Shared types for events used across the application
 */

// Type for event with selected fields (matches Prisma EVENT_SELECT structure)
export interface EventWithSelectedFields {
	id: string;
	title: string;
	description: string | null;
	eventType: string;
	status: string;
	eventDate: Date;
	eventEndDate: Date | null;
	venueName: string | null;
	venueAddress: string | null;
	city: string;
	country: string;
	isOnline: boolean;
	isFree: boolean;
	priceMin: number | null;
	priceMax: number | null;
	currency: string;
	organizerName: string | null;
	organizerDescription: string | null;
	organizerRating: number | null;
	capacity: number | null;
	registeredCount: number;
	techStack: string[];
	qualityScore: number;
	externalUrl: string | null;
	imageUrl: string | null;
	sourcePlatform: string;
	sourceId: string;
	scrapedAt: Date;
	lastUpdated: Date;
	createdAt: Date;
}

// Type for event with categories
export type EventWithCategories = EventWithSelectedFields & {
	eventCategories: Array<{ category: string; value: string }>;
};


