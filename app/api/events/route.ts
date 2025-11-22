import crypto from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { cacheService } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { type SearchFilters, searchDatabase } from "@/lib/searchService";
import { scrapingQueue } from "@/lib/queue";
import type { EventWithCategories } from "@/app/types/events";

// CONSTANTS

const DEFAULT_CITY = "San Francisco";
const DEFAULT_DB_SEARCH_LIMIT = 50;
const CACHE_TTL_SECONDS = 30;
const DEFAULT_PLATFORMS = ["luma", "eventbrite"] as const;

// REDIS SETUP

function generateCacheKey(params: Record<string, unknown>): string {
	const sortedKeys = Object.keys(params).sort();
	const sortedParams = sortedKeys
		.map((key) => `${key}:${JSON.stringify(params[key])}`)
		.join("|");
	return crypto.createHash("md5").update(sortedParams).digest("hex");
}


// BULLMQ WORKER (processes scraping jobs)


// RATE LIMITING

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetTime: number;
	limit: number;
}

class RateLimiter {
	private limit: number;
	private windowSeconds: number;

	constructor(limit: number = 10, windowSeconds: number = 900) {
		this.limit = limit;
		this.windowSeconds = windowSeconds;
	}

	async check(request: NextRequest): Promise<RateLimitResult> {
		const identifier = this.getClientIdentifier(request);

		const result = await cacheService.checkRateLimit(
			identifier,
			this.limit,
			this.windowSeconds,
		);

		return {
			...result,
			limit: this.limit,
		};
	}

	private getClientIdentifier(request: NextRequest): string {
		const forwarded = request.headers.get("x-forwarded-for");
		const realIp = request.headers.get("x-real-ip");
		const cfConnectingIp = request.headers.get("cf-connecting-ip");

		let ip = forwarded?.split(",")[0] || realIp || cfConnectingIp;

		if (!ip) {
			ip = "unknown";
		}

		return ip;
	}
}

const searchRateLimiter = new RateLimiter(100, 900);
const apiRateLimiter = new RateLimiter(100, 900);

function addRateLimitHeaders(
	response: Response,
	rateLimit: RateLimitResult,
): Response {
	response.headers.set("X-RateLimit-Limit", rateLimit.limit.toString());
	response.headers.set("X-RateLimit-Remaining", rateLimit.remaining.toString());
	response.headers.set(
		"X-RateLimit-Reset",
		new Date(rateLimit.resetTime).toISOString(),
	);

	return response;
}

function createRateLimitResponse(rateLimit: RateLimitResult): Response {
	const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
	const response = new Response(
		JSON.stringify({
			error: "Rate limit exceeded",
			message: `Too many requests. Try again in ${retryAfter} seconds.`,
			retryAfter,
		}),
		{
			status: 429,
			headers: {
				"Content-Type": "application/json",
				"Retry-After": retryAfter.toString(),
			},
		},
	);

	return addRateLimitHeaders(response, rateLimit);
}

// HELPER FUNCTIONS

function buildDateFilter(
	date: string,
	now: Date,
): { gte: Date; lt: Date } | null {
	if (date === "today") {
		const tomorrow = new Date(now);
		tomorrow.setDate(tomorrow.getDate() + 1);
		return { gte: now, lt: tomorrow };
	} else if (date === "thisWeek") {
		const nextWeek = new Date(now);
		nextWeek.setDate(nextWeek.getDate() + 7);
		return { gte: now, lt: nextWeek };
	} else if (date === "thisMonth") {
		const nextMonth = new Date(now);
		nextMonth.setMonth(nextMonth.getMonth() + 1);
		return { gte: now, lt: nextMonth };
	}
	return null;
}

// SEARCH HANDLER (for query parameter)

async function handleSearchRequest(
	request: NextRequest,
	options: {
		query: string;
		city?: string;
		eventType?: string;
		price?: string;
		date?: string;
		platforms?: string[];
		limit: number;
		requestId: string;
	},
) {
	const { query, city, eventType, price, date, platforms, limit, requestId } =
		options;

	const searchRateLimit = await searchRateLimiter.check(request);
	if (!searchRateLimit.allowed) {
		return createRateLimitResponse(searchRateLimit);
	}

	const filters: SearchFilters = {
		city,
		eventType,
		price,
		date,
		platforms,
	};

	try {
		const dbResults = await searchDatabase(query, filters, limit);

		if (dbResults.events.length > 0) {
			const result = {
				events: dbResults.events,
				pagination: {
					page: 1,
					limit,
					total: dbResults.total,
					pages: Math.ceil(dbResults.total / limit),
				},
				source: dbResults.source,
			};

			const response = NextResponse.json(result);
			return addRateLimitHeaders(response, searchRateLimit);
		}

		// No database results - create scraping job
		const jobId = `search-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
		const searchCity = city && city !== 'all' ? city : DEFAULT_CITY;
		const searchPlatforms = platforms && Array.isArray(platforms) && platforms.length > 0
			? platforms
			: [...DEFAULT_PLATFORMS];

		// Create job record in database
		try {
			await prisma.scrapingJob.create({
				data: {
					id: jobId,
					platform: 'multi',
					status: 'running',
					query,
					city: searchCity,
					platforms: searchPlatforms,
					startedAt: new Date(),
					eventsScraped: 0,
				},
			});

			// Add job to BullMQ queue
			try {
				await scrapingQueue.add('scrape-events', {
					jobId,
					query,
					platforms: searchPlatforms,
					city: searchCity,
				});
			} catch (queueError) {
				console.error('[SEARCH] Failed to queue job:', queueError);
				// Update job status to failed if queue fails
				try {
					await prisma.scrapingJob.update({
						where: { id: jobId },
						data: {
							status: 'failed',
							completedAt: new Date(),
							errorMessage: 'Failed to queue job',
						},
					});
				} catch {
					throw queueError;
				}
				return NextResponse.json(
					{ success: false, error: 'Failed to create scraping job' },
					{ status: 500 },
				);
			}
		} catch (dbError: any) {
			console.error('[SEARCH] Failed to create job record:', dbError);
			return NextResponse.json(
				{ success: false, error: 'Failed to create scraping job' },
				{ status: 500 },
			);
		}

		// Return job ID to frontend
		const response = NextResponse.json({
			success: true,
			jobId,
			status: 'running',
			message: 'Scraping job created and queued',
			events: [],
			pagination: {
				page: 1,
				limit,
				total: 0,
				pages: 0,
			},
		});
		return addRateLimitHeaders(response, searchRateLimit);
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to search events" },
			{ status: 500 },
		);
	}
}

export async function GET(request: NextRequest) {
	const requestId = `events-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

	try {
		const rateLimit = await apiRateLimiter.check(request);
		if (!rateLimit.allowed) {
			return createRateLimitResponse(rateLimit);
		}

		const { searchParams } = new URL(request.url);

		const query = searchParams.get("query")?.trim() || undefined;
		const city = searchParams.get("city") || undefined;
		const eventType = searchParams.get("eventType") || undefined;
		const price = searchParams.get("price") || undefined;
		const date = searchParams.get("date") || undefined;
		const platforms =
			searchParams.get("platforms")?.split(",").filter(Boolean) || undefined;
		const page = parseInt(searchParams.get("page") || "1");
		const limit = parseInt(searchParams.get("limit") || "20");
		const skip = (page - 1) * limit;

		if (query) {
			return handleSearchRequest(request, {
				query,
				city,
				eventType,
				price,
				date,
				platforms,
				limit,
				requestId,
			});
		}

		const cacheKey = `events:${generateCacheKey({ city, eventType, price, date, page, limit })}`;
		const cached = await cacheService.get(cacheKey);

		if (cached) {
			const response = NextResponse.json(cached);
			return addRateLimitHeaders(response, rateLimit);
		}

		const now = new Date();
		const where: {
			status: string;
			eventDate: { gte: Date };
			city?: { equals: string; mode: "insensitive" };
			eventType?: string;
			isFree?: boolean;
		} = {
			status: "active",
			eventDate: {
				gte: now,
			},
		};

		if (city && city !== "all") {
			where.city = { equals: city, mode: "insensitive" };
		}

		if (eventType && eventType !== "all") {
			where.eventType = eventType;
		}

		if (price && price !== "all") {
			if (price === "free") {
				where.isFree = true;
			} else if (price === "paid") {
				where.isFree = false;
			}
		}

		if (date && date !== "all") {
			const dateFilter = buildDateFilter(date, now);
			if (dateFilter) {
				where.eventDate = dateFilter;
			}
		}

		let events: EventWithCategories[] = [];
		let total = 0;

		try {
			const [eventsRaw, totalCount] = await Promise.all([
				prisma.event.findMany({
					where,
					orderBy: [{ qualityScore: "desc" }, { eventDate: "asc" }],
					skip,
					take: limit,
					select: {
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
					},
				}),
				prisma.event.count({ where }),
			]);

			const eventIds = eventsRaw.map((e) => e.id);
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

			events = eventsRaw.map((event) => ({
				...event,
				eventCategories: categoriesByEventId.get(event.id) || [],
			}));

			total = totalCount;
		} catch (dbError: unknown) {
			if (
				dbError &&
				typeof dbError === "object" &&
				"code" in dbError &&
				(dbError.code === "P1001" ||
					(typeof dbError === "object" &&
						"message" in dbError &&
						typeof dbError.message === "string" &&
						dbError.message.includes("Can't reach database server")))
			) {
				const emptyResult = {
					events: [],
					pagination: {
						page,
						limit,
						total: 0,
						pages: 0,
					},
				};
				const response = NextResponse.json(emptyResult);
				return addRateLimitHeaders(response, rateLimit);
			}
			throw dbError;
		}

		const result = {
			events,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit),
			},
		};

		await cacheService.set(cacheKey, result, CACHE_TTL_SECONDS);

		const response = NextResponse.json(result);
		return addRateLimitHeaders(response, rateLimit);
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to fetch events" },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		const event = await prisma.event.create({
			data: {
				title: body.title,
				description: body.description,
				eventType: body.eventType,
				eventDate: new Date(body.eventDate),
				eventEndDate: body.eventEndDate ? new Date(body.eventEndDate) : null,
				venueName: body.venueName,
				venueAddress: body.venueAddress,
				city: body.city,
				country: body.country || "US",
				isOnline: body.isOnline || false,
				isFree: body.isFree || false,
				priceMin: body.priceMin,
				priceMax: body.priceMax,
				currency: body.currency || "USD",
				organizerName: body.organizerName,
				organizerDescription: body.organizerDescription,
				organizerRating: body.organizerRating,
				capacity: body.capacity,
				registeredCount: body.registeredCount || 0,
				techStack: body.techStack || [],
				qualityScore: body.qualityScore || 0,
				externalUrl: body.externalUrl,
				imageUrl: body.imageUrl,
				sourcePlatform: body.sourcePlatform,
				sourceId: body.sourceId,
			},
		});

		return NextResponse.json(event, { status: 201 });
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to create event" },
			{ status: 500 },
		);
	}
}