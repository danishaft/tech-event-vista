import { after, type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
	processApifyEventbriteEvents,
	processApifyLumaEvents,
	processPuppeteerEventbriteEvents,
	processPuppeteerLumaEvents,
	scrapeEventbriteEvents,
	scrapeLumaEvents,
} from "@/lib/scrapingService";


// Force dynamic execution to prevent caching
export const dynamic = "force-dynamic";
// Allow longer execution time for scraping (5 minutes max)
export const maxDuration = 300;

/**
 * Verify that the request is from Vercel Cron
 * Vercel sends a special authorization header when triggering cron jobs
 */
function verifyCronRequest(request: NextRequest): boolean {
	// Check for Vercel cron secret (if set)
	const cronSecret = process.env.CRON_SECRET;
	if (cronSecret) {
		const authHeader = request.headers.get("authorization");
		return authHeader === `Bearer ${cronSecret}`;
	}
	// For local development, we'll allow all requests
	if (process.env.NODE_ENV === "development") {
		return true;
	}

	// Vercel cron jobs are automatically authenticated by Vercel
	return true;
}

/**
 * Start scraping job 
 */
async function startScrapingJob(
	cities: string[],
	platforms: string[],
	maxEvents: number,
	body?: any,
) {
	// Create job record with retry logic for database connection
	const jobId = `scraping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

	let jobCreated = false;
	let retries = 0;
	const maxRetries = 3;

	while (!jobCreated && retries < maxRetries) {
		try {
			await prisma.scrapingJob.create({
				data: {
					id: jobId,
					platform: "multi",
					status: "running",
					query: "tech",
					city: cities.join(","),
					platforms,
					startedAt: new Date(),
					eventsScraped: 0,
				},
			});
			jobCreated = true;
		} catch (error: any) {
			retries++;
			if (error.message?.includes("Can't reach database")) {
				console.warn(
					`⚠️ [BATCH-SCRAPING] Database connection failed (attempt ${retries}/${maxRetries}), retrying...`,
				);
				if (retries < maxRetries) {
					await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
					continue;
				}
			}
			throw error;
		}
	}

	// Use Next.js after() to run scraping in background (non-blocking)
	after(async () => {
		try {
			let totalSaved = 0;
			const startTime = Date.now();

			// Process each city
			for (const city of cities) {
				// Process each platform
				for (const platform of platforms) {
					// Type guard: ensure platform is valid
					if (platform !== "luma" && platform !== "eventbrite") {
						console.warn(
							`⚠️ [BATCH-SCRAPING] Skipping invalid platform: ${platform}`,
						);
						continue;
					}

					const validPlatform: "luma" | "eventbrite" = platform;

					try {
						let events: any[] = [];
						let source: "apify" | "puppeteer" = "puppeteer";

						if (validPlatform === "luma") {
							// Use query from body if provided, otherwise default to 'tech'
							const lumaQuery = body?.query || body?.lumaQuery || "tech";
							const result = await scrapeLumaEvents(lumaQuery, maxEvents);
							events = result.events;
							source = result.source;
						} else if (validPlatform === "eventbrite") {

							// Use multiple tech-related search queries for better results
							const techQueries = [
								"ai",
								"data science",
								"python",
								"reactjs",
								"javascript",
								"machine learning",
							];
							const allEvents: any[] = [];
							const allSources: ("apify" | "puppeteer")[] = [];

							for (const query of techQueries) {
								const result = await scrapeEventbriteEvents(city, query);
								allEvents.push(...result.events);
								allSources.push(result.source);

								await new Promise((resolve) => setTimeout(resolve, 2000));
							}

							// Deduplicate by URL
							const uniqueEvents = allEvents.filter(
								(event, index, self) =>
									index ===
									self.findIndex(
										(e) =>
											(e.url || e.event_url) === (event.url || event.event_url),
									),
							);

							events = uniqueEvents;
							// Use the most common source (or 'apify' if any query used Apify)
							source = allSources.includes("apify") ? "apify" : "puppeteer";
						}

						if (events.length > 0) {

							// Call the correct processor based on source
							let saved = 0;
							if (validPlatform === "luma") {
								if (source === "apify") {
									saved = await processApifyLumaEvents(events, city);
								} else {
									saved = await processPuppeteerLumaEvents(events, city);
								}
							} else if (validPlatform === "eventbrite") {
								if (source === "apify") {
									saved = await processApifyEventbriteEvents(events, city);
								} else {
									saved = await processPuppeteerEventbriteEvents(events, city);
								}
							}

							totalSaved += saved;
						}
					} catch (platformError) {
						console.error(
							`[BATCH-SCRAPING] ${validPlatform} scraping failed for ${city}`,
							{
								jobId,
								platform: validPlatform,
								city,
								error: (platformError as Error).message,
							},
						);
						// Continue with other platforms
					}
				}
			}

			// Update job status to completed
			await prisma.scrapingJob.update({
				where: { id: jobId },
				data: {
					status: "completed",
					completedAt: new Date(),
					eventsScraped: totalSaved,
				},
			});

			const duration = Date.now() - startTime;
		} catch (error) {
			console.error(` [BATCH-SCRAPING] Job ${jobId} failed:`, {
				jobId,
				error: (error as Error).message,
				stack: (error as Error).stack,
			});

			// Update job status to failed
			await prisma.scrapingJob.update({
				where: { id: jobId },
				data: {
					status: "failed",
					completedAt: new Date(),
					errorMessage: (error as Error).message,
				},
			});
		}
	});

	return jobId;
}

/**
 * GET handler - called by Vercel Cron Jobs
 * Vercel automatically triggers this endpoint at the scheduled time
 * Uses rotation logic to vary cities and queries based on day
 */
export async function GET(request: NextRequest) {
	try {
		// Verify the request is from Vercel Cron (if CRON_SECRET is set)
		if (!verifyCronRequest(request)) {
			console.warn("⚠️ [CRON] Unauthorized cron request attempt");
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 },
			);
		}

		// Dynamic rotation based on day of week and day of month
		const now = new Date();
		const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
		const dayOfMonth = now.getDate(); // 1-31

		// Rotate cities by day of week (7 different city groups)
		const cityGroups = [
			["Seattle", "Portland"], // Sunday (0)
			["San Francisco", "Oakland"], // Monday (1)
			["New York", "Boston"], // Tuesday (2)
			["Austin", "Dallas"], // Wednesday (3)
			["Chicago", "Detroit"], // Thursday (4)
			["Los Angeles", "San Diego"], // Friday (5)
			["Denver", "Boulder"], // Saturday (6)
		];
		const cities = cityGroups[dayOfWeek] || cityGroups[0];

		// Rotate tech queries by day of month (cycles through queries)
		const techQueries = [
			"tech",
			"ai",
			"data science",
			"python",
			"reactjs",
			"javascript",
			"machine learning",
			"web development",
			"software engineering",
			"cloud computing",
			"devops",
			"cybersecurity",
			"blockchain",
			"mobile development",
			"frontend",
			"backend",
			"fullstack",
			"node.js",
			"typescript",
			"docker",
			"kubernetes",
			"aws",
			"azure",
			"gcp",
			"react native",
			"vue.js",
			"angular",
			"next.js",
			"graphql",
			"microservices",
			"api development",
		];
		const query = techQueries[(dayOfMonth - 1) % techQueries.length];

		const platforms = ["luma", "eventbrite"];
		const maxEvents = 50; // Scrape up to 50 events per platform per city

		const jobId = await startScrapingJob(cities, platforms, maxEvents, {
			query,
		});


		return NextResponse.json({
			success: true,
			message: "Cron job executed successfully",
			jobId,
			status: "running",
			triggeredBy: "vercel-cron",
			schedule: "0 6 * * *",
			rotation: {
				dayOfWeek,
				dayOfMonth,
				cities,
				query,
			},
		});
	} catch (error) {
		console.error("[CRON] Failed to start scraping job:", error);
		console.error("[CRON] Error stack:", (error as Error).stack);

		return NextResponse.json(
			{
				success: false,
				error: (error as Error).message,
			},
			{ status: 500 },
		);
	}
}

/**
 * POST handler - for manual triggers (testing, admin, etc.)
 */
export async function POST(request: NextRequest) {
	try {

		const body = await request.json().catch(() => ({}));
		const cities = body.cities || ["Seattle", "San Francisco", "New York"];
		const platforms = body.platforms || ["luma", "eventbrite"];
		const maxEvents = body.maxEvents || 50; // Default to 50 events per platform per city

		const jobId = await startScrapingJob(cities, platforms, maxEvents, body);

		return NextResponse.json({
			success: true,
			message: "Scraping job started successfully",
			jobId,
			status: "running",
			triggeredBy: "manual",
		});
	} catch (error) {
		console.error("[MANUAL] Failed to start scraping job:", error);
		console.error(" [MANUAL] Error stack:", (error as Error).stack);

		return NextResponse.json(
			{
				success: false,
				error: (error as Error).message,
			},
			{ status: 500 },
		);
	}
}
