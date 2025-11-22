import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { z } from "zod";
import { prisma } from "./prisma";

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Realistic user agents to rotate
const USER_AGENTS = [
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
];

// Get random user agent
function getRandomUserAgent(): string {
	return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Create browser with stealth configuration
async function createBrowser() {
	// Try multiple possible paths for Chromium
	let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
	
	if (!executablePath) {
		const fs = require('fs');
		const possiblePaths = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
		for (const path of possiblePaths) {
			try {
				if (fs.existsSync(path)) {
					executablePath = path;
					break;
				}
			} catch {
				continue;
			}
		}
	}
	
	return await puppeteer.launch({
		headless: true,
		executablePath, // Use system Chromium in Docker
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-blink-features=AutomationControlled",
			"--disable-features=IsolateOrigins,site-per-process",
			"--disable-web-security",
			"--disable-dev-shm-usage",
			"--disable-gpu",
			"--disable-software-rasterizer",
			"--disable-extensions",
			"--no-first-run",
			"--disable-default-apps",
			"--disable-background-networking",
			// Additional flags for Docker/Chromium compatibility
			"--single-process", // Run in single process mode (helps with Docker)
			"--disable-zygote", // Disable zygote process (helps with crashpad)
			// Disable crashpad reporting (fixes crashpad handler database error)
			"--disable-crash-reporter",
			"--disable-breakpad",
			"--disable-background-timer-throttling",
			"--disable-backgrounding-occluded-windows",
			"--disable-renderer-backgrounding",
		],
		ignoreDefaultArgs: ["--disable-extensions"],
	});
}

// Configure page with stealth settings
async function configurePage(page: any) {
	// Set realistic user agent
	await page.setUserAgent(getRandomUserAgent());

	// Set viewport
	await page.setViewport({
		width: 1920,
		height: 1080,
		deviceScaleFactor: 1,
	});

	// Override webdriver property
	await page.evaluateOnNewDocument(() => {
		Object.defineProperty(navigator, "webdriver", {
			get: () => false,
		});
	});

	// Override plugins
	await page.evaluateOnNewDocument(() => {
		Object.defineProperty(navigator, "plugins", {
			get: () => [1, 2, 3, 4, 5],
		});
	});

	// Override languages
	await page.evaluateOnNewDocument(() => {
		Object.defineProperty(navigator, "languages", {
			get: () => ["en-US", "en"],
		});
	});

	// Set extra headers
	await page.setExtraHTTPHeaders({
		"Accept-Language": "en-US,en;q=0.9",
		Accept:
			"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
		"Accept-Encoding": "gzip, deflate, br",
		Connection: "keep-alive",
		"Upgrade-Insecure-Requests": "1",
	});
}

// Add realistic delay
function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scrape Eventbrite events using Puppeteer with stealth
 */
async function scrapeEventbriteEventsPuppeteer(
	city: string,
	query: string,
	maxItems: number = 20,
): Promise<any[]> {
	const browser = await createBrowser();
	const events: any[] = [];

	try {
		const page = await browser.newPage();
		await configurePage(page);

		// Build search URL
		const citySlug = city.toLowerCase().replace(/\s+/g, "-");
		const searchUrl = `https://www.eventbrite.com/d/${citySlug}/?q=${encodeURIComponent(query)}&page=1`;

		// Navigate with retry logic for network errors
		let retries = 3;
		let lastError: Error | null = null;

		while (retries > 0) {
			try {
				await page.goto(searchUrl, {
					waitUntil: "domcontentloaded",
					timeout: 60000,
				});
				break; // Success, exit retry loop
			} catch (error: any) {
				lastError = error;
				retries--;
				if (
					error.message?.includes("ERR_NETWORK_CHANGED") ||
					error.message?.includes("net::ERR") ||
					error.message?.includes("Navigation timeout")
				) {
					if (retries > 0) {
						await delay(2000 * (4 - retries)); // Exponential backoff
						continue;
					}
				}
				throw error; 
			}
		}

		if (lastError && retries === 0) {
			throw lastError;
		}

		// Wait for page to load
		await delay(3000 + Math.random() * 2000); 

		// Scroll to load more content
		await page.evaluate(async () => {
			await new Promise<void>((resolve) => {
				let totalHeight = 0;
				const distance = 100;
				const timer = setInterval(() => {
					const scrollHeight = document.body.scrollHeight;
					window.scrollBy(0, distance);
					totalHeight += distance;

					if (totalHeight >= scrollHeight) {
						clearInterval(timer);
						resolve();
					}
				}, 100);
			});
		});

		await delay(2000);

		// Extract events
		const scrapedEvents = await page.evaluate((maxItems) => {
			const events: any[] = [];

			// Try multiple selectors for Eventbrite event cards
			const selectors = [
				'article[class*="event-card"]',
				'div[class*="event-card"]',
				'[data-testid="event-card"]',
				"article.eds-event-card-content",
				"div.eds-event-card-content",
			];

			let cards: NodeListOf<Element> | null = null;

			for (const selector of selectors) {
				const elements = document.querySelectorAll(selector);
				if (elements.length > 0) {
					cards = elements;
					break;
				}
			}

			if (!cards || cards.length === 0) {
				// Check if we're blocked
				const bodyText = document.body?.textContent || "";
				if (
					bodyText.includes("blocked") ||
					bodyText.includes("captcha") ||
					bodyText.includes("access denied") ||
					bodyText.includes("rate limit")
				) {
					console.error(
						"[PUPPETEER] Possible blocking detected - page contains blocking keywords",
					);
				}
				return events;
			}


			const limit = Math.min(maxItems, cards.length);

			for (let i = 0; i < limit; i++) {
				const card = cards[i];

				try {
					// Extract title
					const titleEl = card.querySelector(
						'h3, h2, [class*="title"], [class*="name"]',
					);
					const title = titleEl?.textContent?.trim() || "";

					if (!title || title.length < 3) continue;

					// Extract link
					const linkEl = card.querySelector('a[href*="/e/"]');
					const href = linkEl?.getAttribute("href") || "";
					const fullUrl = href.startsWith("http")
						? href
						: `https://www.eventbrite.com${href}`;

					// Extract source ID
					const sourceId =
						href.match(/\/e\/([^/]+)/)?.[1] || `eventbrite-${Date.now()}-${i}`;

					// Extract date (simplified - would need more parsing in production)
					const dateEl = card.querySelector('[class*="date"], [class*="time"]');
					const dateText = dateEl?.textContent?.trim() || "";

					// Extract image
					const imgEl = card.querySelector("img");
					const imageUrl =
						imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";

					// Extract price
					const priceEl = card.querySelector(
						'[class*="price"], [class*="cost"]',
					);
					const priceText = priceEl?.textContent?.trim() || "";
					const isFree =
						priceText.toLowerCase().includes("free") || priceText === "";

					// Extract venue
					const venueEl = card.querySelector(
						'[class*="venue"], [class*="location"]',
					);
					const venueName = venueEl?.textContent?.trim() || "";

					// Extract description from card if available
					const descEl = card.querySelector(
						'[class*="description"], [class*="summary"], [class*="details"]',
					);
					const description = descEl?.textContent?.trim() || "";

					// Extract organizer from card if available
					const orgEl = card.querySelector(
						'[class*="organizer"], [class*="host"], [class*="by"]',
					);
					const organizerName = orgEl?.textContent?.trim() || "";

					// Extract date/time if available
					const dateTimeEl = card.querySelector(
						'[class*="date"], [class*="time"], [data-testid*="date"]',
					);
					const dateTimeText = dateTimeEl?.textContent?.trim() || "";

					events.push({
						name: title,
						title: title,
						id: sourceId,
						api_id: sourceId,
						url: fullUrl,
						event_url: fullUrl,
						start_date: new Date(
							Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000,
						)
							.toISOString()
							.split("T")[0],
						start_time: "18:00",
						end_date: null,
						end_time: null,
						summary: description || `Technology event: ${title}`,
						full_description: description || `Technology event: ${title}`,
						is_online_event: venueName.toLowerCase().includes("online"),
						primary_venue: {
							name: venueName || "TBD",
							address: {
								localized_address_display: venueName || "TBD",
							},
						},
						image: {
							url: imageUrl,
						},
						ticket_info: {
							is_free: isFree,
							price: isFree
								? 0
								: parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0,
						},
						organizer: {
							name: organizerName || "Unknown",
						},
					});
				} catch (error) {
					console.error(`Error extracting event ${i}:`, error);
				}
			}

			return events;
		}, maxItems);

		return scrapedEvents;
	} catch (error) {
		console.error("[PUPPETEER] Eventbrite scraping failed:", error);
		console.error("   Error details:", {
			message: (error as Error).message,
			stack: (error as Error).stack,
			city,
			query,
		});
		return [];
	} finally {
		await browser.close();
	}
}

// EVENT PROCESSING UTILITIES (moved from eventProcessing.ts - only used here)

/**
 * Extract tech stack from title and description
 * Focus on software engineering, development, AI/ML technologies
 */
function extractTechStack(title: string, description: string): string[] {
	const techKeywords = [
		"react",
		"vue",
		"angular",
		"next.js",
		"svelte",
		"remix",
		// Languages
		"javascript",
		"typescript",
		"node.js",
		"python",
		"java",
		"c++",
		"c#",
		"php",
		"ruby",
		"golang",
		"go language",
		"rust",
		"swift",
		"kotlin",
		"scala",
		"clojure",
		// Backend/Infrastructure
		"docker",
		"kubernetes",
		"aws",
		"azure",
		"gcp",
		"terraform",
		"ansible",
		// AI/ML
		"machine learning",
		"deep learning",
		"neural network",
		"tensorflow",
		"pytorch",
		"scikit-learn",
		"nlp",
		"computer vision",
		// Data
		"data science",
		"data engineering",
		"big data",
		"spark",
		"hadoop",
		// Blockchain/Web3
		"blockchain",
		"web3",
		"solidity",
		"ethereum",
		"smart contract",
		// Mobile
		"react native",
		"flutter",
		"ios development",
		"android development",
		// Development practices
		"software engineering",
		"software development",
		"web development",
		"frontend development",
		"backend development",
		"fullstack development",
		"frontend",
		"backend",
		"fullstack",
		"devops",
		"ci/cd",
		"agile",
		"scrum",
	];

	const aiKeywords = [
		/\bai\b/i,
		/\bartificial intelligence\b/i,
		/\bmachine learning\b/i,
		/\bml\b/i,
		/\bdeep learning\b/i,
		/\bneural network\b/i,
	];

	const text = `${title} ${description}`.toLowerCase();
	const matchedKeywords: string[] = [];

	for (const keyword of techKeywords) {
		if (keyword === "ai" || keyword.includes("ai ")) {
			if (aiKeywords.some((pattern) => pattern.test(text))) {
				matchedKeywords.push("ai");
			}
		} else if (keyword === "go" || keyword === "golang") {
			const goPatterns = [
				/\bgolang\b/i,
				/\bgo\s+(language|programming|developer|development|code|coding)\b/i,
				/\bgo\s+(workshop|meetup|conference|training)\b/i,
				/\bgo\s+(backend|server|api)\b/i,
			];
			if (goPatterns.some((pattern) => pattern.test(text))) {
				matchedKeywords.push("go");
			}
		} else {
			if (keyword.includes(" ")) {
				if (text.includes(keyword.toLowerCase())) {
					matchedKeywords.push(keyword);
				}
			} else {
				const escapedKeyword = keyword
					.toLowerCase()
					.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const pattern = new RegExp(`\\b${escapedKeyword}\\b`, "i");
				if (pattern.test(text)) {
					matchedKeywords.push(keyword);
				}
			}
		}
	}

	return [...new Set(matchedKeywords)];
}

/**
 * Assign event type based on title and description
 */
function assignEventType(title: string, description: string): string {
	const text = `${title} ${description}`.toLowerCase();

	if (text.includes("conference") || text.includes("summit"))
		return "conference";
	if (text.includes("workshop") || text.includes("training")) return "workshop";
	if (text.includes("meetup") || text.includes("networking")) return "meetup";
	if (text.includes("hackathon") || text.includes("hack")) return "hackathon";

	return "workshop"; // default
}

/**
 * Calculate quality score (0-100) based on event completeness
 */
function calculateQualityScore(event: any): number {
	let score = 0;

	if (event.title && event.title.length > 10) score += 20;
	if (event.description && event.description.length > 50) score += 20;
	if (event.eventDate && event.eventDate > new Date()) score += 20;
	if (event.city && event.venueName) score += 15;
	if (event.organizerName && event.organizerName !== "Unknown") score += 15;
	if (event.techStack && event.techStack.length > 0) score += 10;

	return Math.min(score, 100);
}

/**
 * Zod schema for event validation
 */
const EventSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().min(10, "Description must be at least 10 characters"),
	eventType: z.enum([
		"workshop",
		"conference",
		"meetup",
		"hackathon",
		"networking",
	]),
	eventDate: z.date(),
	eventEndDate: z.date().nullable().optional(),
	venueName: z.string().optional(),
	venueAddress: z.string().optional(),
	city: z.string().min(1, "City is required"),
	country: z.string().min(1, "Country is required"),
	isOnline: z.boolean(),
	isFree: z.boolean(),
	priceMin: z.number().min(0).optional(),
	priceMax: z.number().min(0).optional(),
	currency: z.string().min(3).max(3),
	organizerName: z.string().optional(),
	organizerDescription: z.string().optional(),
	organizerRating: z.number().min(0).max(5).optional(),
	capacity: z.number().min(1).nullable().optional(),
	registeredCount: z.number().min(0),
	techStack: z.array(z.string()),
	qualityScore: z.number().min(0).max(100),
	externalUrl: z.string().url("Invalid URL"),
	imageUrl: z.string().url("Invalid image URL").optional(),
	sourcePlatform: z.enum(["eventbrite", "meetup", "luma"]),
	sourceId: z.string().min(1, "Source ID is required"),
});

/**
 * Validate event data using Zod schema
 */
function validateEvent(data: any) {
	try {
		return EventSchema.parse(data);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return null;
		}
		throw error;
	}
}

// EVENT PROCESSING HELPERS (only used here)

/**
 * Normalize sourceId by removing query parameters and aff codes
 * This ensures same event from different queries gets same normalized ID
 */
function normalizeSourceId(sourceId: string, platform: string): string {
	if (!sourceId) return sourceId;

	if (platform === "eventbrite") {
		// Remove query parameters: "event-tickets-123?aff=ebdssbdestsearch" → "event-tickets-123"
		return sourceId.split("?")[0].split("&")[0].trim();
	}

	// Luma IDs are already clean: "evt-abc123"
	if (platform === "luma") {
		return sourceId.trim();
	}

	return sourceId.trim();
}

/**
 * Normalize URL by removing query parameters
 * Used for cross-platform duplicate detection
 */
function normalizeUrl(url: string): string {
	if (!url) return "";

	try {
		const parsed = new URL(url);
		// Return just origin + pathname (no query params)
		return `${parsed.origin}${parsed.pathname}`;
	} catch {
		// If URL parsing fails, try simple string manipulation
		return url.split("?")[0].split("#")[0].trim();
	}
}

/**
 * Calculate completeness score (0-100)
 */
function calculateCompleteness(event: any): number {
	let score = 0;

	if (event.title && event.title.length >= 3) score += 10;

	if (event.description) {
		if (event.description.length >= 100) score += 20;
		else if (event.description.length >= 50) score += 10;
	}

	if (event.eventDate) score += 10;

	if (event.city && event.city.length > 0) score += 10;

	if (event.techStack && event.techStack.length > 0) score += 15;

	if (
		event.organizerName &&
		event.organizerName !== "Organizer not available" &&
		event.organizerName !== "Unknown"
	) {
		score += 10;
	}

	if (event.externalUrl && event.externalUrl.length > 0) {
		try {
			new URL(event.externalUrl);
			score += 10;
		} catch {}
	}

	if (event.venueName && event.venueName !== event.city) score += 5;

	return Math.min(100, score);
}


export interface EventDetails {
	description?: string;
	organizerName?: string;
	organizerDescription?: string;
	fullDescription?: string;
}

/**
 * Fetch event details from Eventbrite event page
 */
async function fetchEventbriteDetails(
	url: string,
): Promise<EventDetails | null> {
	const browser = await createBrowser();

	try {
		const page = await browser.newPage();
		await configurePage(page);

    
    await page.goto(url, { 
			waitUntil: "domcontentloaded",
			timeout: 30000,
		});

		await delay(3000); // Wait for content to load
    
    const details = await page.evaluate(() => {
      // Try to find description
      const descSelectors = [
        '[data-testid="event-description"]',
        '[class*="event-description"]',
        '[class*="description"]',
        '[data-automation="event-description"]',
				'div[class*="RichText"]',
			];
      
			let description = "";
      for (const selector of descSelectors) {
				const el = document.querySelector(selector);
        if (el) {
					description = el.textContent?.trim() || "";
					if (description.length > 100) break;
        }
      }
      
      // Try to find organizer
      const orgSelectors = [
        '[data-testid="organizer-name"]',
        '[class*="organizer"]',
        '[class*="host"]',
				'a[href*="/organizer/"]',
			];
      
			let organizerName = "";
      for (const selector of orgSelectors) {
				const el = document.querySelector(selector);
        if (el) {
					organizerName = el.textContent?.trim() || "";
					if (organizerName.length > 0 && organizerName.length < 100) break;
        }
      }
      
      return {
				description: description || "",
				organizerName: organizerName || "",
			};
		});

		await browser.close();
    
    if (details.description && details.description.length >= 100) {
			return details;
    }
    
		return null;
  } catch (error) {
		console.error(`Error fetching details from ${url}:`, error);
		await browser.close();
		return null;
  }
}

/**
 * Fetch event details from Luma event page
 */
async function fetchLumaDetails(url: string): Promise<EventDetails | null> {
	const browser = await createBrowser();
  
  try {
		const page = await browser.newPage();
		await configurePage(page);
        
    await page.goto(url, { 
			waitUntil: "domcontentloaded",
			timeout: 30000,
		});

		await delay(3000);
    
    const details = await page.evaluate(() => {
      // Luma description selectors
      const descSelectors = [
        '[class*="description"]',
        '[class*="event-description"]',
				'div[class*="RichText"]',
			];
      
			let description = "";
      for (const selector of descSelectors) {
				const el = document.querySelector(selector);
        if (el) {
					description = el.textContent?.trim() || "";
					if (description.length > 100) break;
        }
      }
      
      // Luma organizer/host selectors
      const orgSelectors = [
        '[class*="host"]',
        '[class*="organizer"]',
				'a[href*="/calendar/"]',
			];
      
			let organizerName = "";
      for (const selector of orgSelectors) {
				const el = document.querySelector(selector);
        if (el) {
					organizerName = el.textContent?.trim() || "";
					if (organizerName.length > 0 && organizerName.length < 100) break;
        }
      }
      
      return {
				description: description || "",
				organizerName: organizerName || "",
			};
		});

		await browser.close();
    
    if (details.description && details.description.length >= 100) {
			return details;
    }
    
		return null;
  } catch (error) {
		console.error(`   ❌ Error fetching details from ${url}:`, error);
		await browser.close();
		return null;
  }
}

// LUMA EFFICIENT SCRAPING (inlined from lumaEfficientScraping.ts)

/**
 * MOST EFFICIENT: Intercept Luma API calls to get events directly
 */
async function scrapeLumaEventsViaAPI(
	query: string,
	maxItems: number = 20,
): Promise<any[]> {
	const browser = await createBrowser();
	const events: any[] = [];

	try {
		const page = await browser.newPage();
		await configurePage(page);


		const apiResponses: any[] = [];
    
    // Set up response interception BEFORE navigation
		page.on("response", async (response) => {
			const url = response.url();
      
      // Luma uses various API endpoints - capture all JSON responses
			if (
				url.includes("lu.ma") ||
				url.includes("luma.com") ||
				url.includes("api") ||
				url.includes("graphql") ||
				url.includes("/events") ||
				url.includes("search") ||
				url.includes("explore")
			) {
				try {
					const contentType = response.headers()["content-type"] || "";
					if (
						contentType.includes("json") ||
						url.includes(".json") ||
						url.includes("api")
					) {
						const data = await response.json().catch(() => null);
            if (data) {
							apiResponses.push({ url, data });
            }
          }
        } catch (e) {
          // Not JSON or failed to parse, skip
        }
      }
		});

		const lat = 37.7749;
		const lon = -122.4194;
		const paginatedApiUrl = `https://api2.luma.com/discover/get-paginated-events?latitude=${lat}&longitude=${lon}&pagination_limit=${maxItems}&slug=${encodeURIComponent(query)}`;
    
    try {
      const directResponse = await page.evaluate(async (url) => {
        const response = await fetch(url, {
          headers: {
						Accept: "application/json",
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					},
				});
				return response.ok ? await response.json() : null;
			}, paginatedApiUrl);

			if (
				directResponse &&
				directResponse.entries &&
				Array.isArray(directResponse.entries)
			) {
				apiResponses.push({ url: paginatedApiUrl, data: directResponse });
      }
    } catch (e) {
			console.error("[LUMA-API] Direct API call failed:", e);
    }
    
    
    for (const response of apiResponses) {
      try {
				const data = response.data;
				const url = response.url;
        
        // Log what we're parsing for debugging
				if (
					url.includes("bootstrap") ||
					url.includes("discover") ||
					url.includes("search")
				) {

        }
        
				if (url.includes("get-paginated-events")) {
          
          // Events are in 'entries' array!
          if (data?.entries && Array.isArray(data.entries)) {
						
            
            // Log first event structure to see what fields it has
            if (data.entries.length > 0) {
						}

						events.push(...data.entries);
          } else if (data?.events && Array.isArray(data.events)) {
						events.push(...data.events);
          } else if (data?.data?.events && Array.isArray(data.data.events)) {
						
						events.push(...data.data.events);
          } else if (data?.results && Array.isArray(data.results)) {
						
						events.push(...data.results);
          } else {
            // Log structure to debug
						
            if (data?.entries) {
							
            }
          }
        }
        
        // Handle bootstrap-page response - check for events in various locations
				if (
					url.includes("bootstrap-page") ||
					(url.includes("discover") && !url.includes("get-paginated-events")) ||
					url.includes("search")
				) {
          // Check all possible event locations
          const possiblePaths = [
            data?.events,
            data?.data?.events,
            data?.results?.events,
            data?.discover?.events,
            data?.page?.events,
            data?.content?.events,
            data?.items,
            data?.data?.items,
            data?.results,
            data?.data?.results,
            data?.search?.results,
            data?.search?.events,
            data?.query?.results,
            data?.query?.events,
					];
          
          for (const path of possiblePaths) {
            if (Array.isArray(path) && path.length > 0) {
							const firstItem = path[0];
							if (
								firstItem &&
								(firstItem.name ||
									firstItem.title ||
									firstItem.id ||
									firstItem.slug ||
									firstItem.api_id)
							) {
								
								events.push(...path);
								break;
              }
            }
          }
          
          // Also check places array - might contain events
          if (data?.places && Array.isArray(data.places)) {
            for (const place of data.places) {
              if (place?.events && Array.isArray(place.events)) {
								
								events.push(...place.events);
              }
              if (place?.place?.events && Array.isArray(place.place.events)) {
								
								events.push(...place.place.events);
              }
            }
          }
        }
        
        // Handle different API response formats
        if (data.data?.events) {
					events.push(
						...(Array.isArray(data.data.events) ? data.data.events : []),
					);
        } else if (data.events) {
					events.push(...(Array.isArray(data.events) ? data.events : []));
        } else if (data.data?.searchEvents) {
					events.push(
						...(Array.isArray(data.data.searchEvents)
							? data.data.searchEvents
							: []),
					);
        } else if (data.data?.results) {
					events.push(
						...(Array.isArray(data.data.results) ? data.data.results : []),
					);
        } else if (Array.isArray(data)) {
					events.push(...data);
        } else if (data.items) {
					events.push(...(Array.isArray(data.items) ? data.items : []));
        } else if (data.results) {
					events.push(...(Array.isArray(data.results) ? data.results : []));
        }
        
        // Also check nested structures recursively
        function extractEvents(obj: any, depth = 0): any[] {
					if (depth > 3) return []; // Prevent infinite recursion
					const found: any[] = [];
          
          if (Array.isArray(obj)) {
            for (const item of obj) {
							if (item && typeof item === "object") {
								if (
									item.name ||
									item.title ||
									item.id ||
									item.slug ||
									item.api_id
								) {
									found.push(item);
                } else {
									found.push(...extractEvents(item, depth + 1));
                }
              }
            }
					} else if (obj && typeof obj === "object") {
            for (const key in obj) {
							if (
								key.toLowerCase().includes("event") ||
								key.toLowerCase().includes("item")
							) {
								found.push(...extractEvents(obj[key], depth + 1));
							}
						}
					}

					return found;
        }
        
        // Deep search for events
				const deepEvents = extractEvents(data);
        if (deepEvents.length > 0) {
					
					events.push(...deepEvents);
				}
      } catch (e) {
      }
    }
    
    
    // If no events found, return empty (API method is reliable)
    if (events.length === 0) {
			return [];
    }
    
    // Normalize events to consistent format (handle nested structure)
		const normalizedEvents = events.map((event) => {
      // If event has nested structure, flatten it
      if (event.event) {
        return {
          ...event,
          name: event.event.name || event.name,
          title: event.event.name || event.name,
          description: event.event.description || event.description,
          start_at: event.start_at || event.event.start_at,
          end_at: event.end_at || event.event.end_at,
          api_id: event.api_id || event.event.api_id,
					url:
						event.url ||
						event.event.url ||
						`https://lu.ma/${event.api_id || event.event.api_id}`,
					imageUrl:
						event.cover_url || event.event.cover_url || event.cover_image,
          hosts: event.hosts || event.event.hosts,
          calendar: event.calendar || event.event.calendar,
          ticket_info: event.ticket_info || event.event.ticket_info,
          location: event.location || event.event.location,
				};
        }
			return event;
		});
    
    // Deduplicate and limit
    const uniqueEvents = Array.from(
			new Map(
				normalizedEvents.map((e) => [e.api_id || e.id || e.slug, e]),
			).values(),
		).slice(0, maxItems);

		return uniqueEvents;
  } catch (error) {
		console.error("❌ [LUMA-API] Luma API scraping failed:", error);
		return [];
  } finally {
		await browser.close();
  }
}

// APIFY SCRAPING 

import { ApifyClient } from "apify-client";

// Initialize Apify client
let apifyClient: ApifyClient | null = null;

/**
 * Extract plain text from ProseMirror document structure
 * ProseMirror uses a nested structure: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "..." }] }] }
 */
function extractTextFromProseMirror(doc: any): string {
	if (!doc) return "";
  
  // If it's already a string, return it
	if (typeof doc === "string") return doc;
  
  // If it has a text property, return it
	if (doc.text && typeof doc.text === "string") return doc.text;
  
  if (doc.content && Array.isArray(doc.content)) {
    return doc.content
      .map((node: any) => {
        // If node has text directly, use it
				if (node.text && typeof node.text === "string") {
					return node.text;
        }
        // If node has content array, recurse
        if (node.content && Array.isArray(node.content)) {
					return extractTextFromProseMirror({ content: node.content });
        }
				return "";
      })
      .filter((text: string) => text.length > 0)
			.join("\n");
  }
  
	return "";
}

function getApifyClient(): ApifyClient {
  if (!apifyClient) {
		const token = process.env.APIFY_API_TOKEN;
    if (!token) {
			throw new Error(
				"APIFY_API_TOKEN environment variable is required for Apify scraping",
			);
    }
		apifyClient = new ApifyClient({ token });
  }
	return apifyClient;
}

/**
 * Default Apify actors (you can replace these with your own actor IDs)
 * These are common actors available on Apify platform
 */
const DEFAULT_ACTORS = {
  // Actor: https://console.apify.com/actors/PmxIAXfwo0gUUNdG4
	eventbrite: process.env.APIFY_EVENTBRITE_ACTOR_ID || "PmxIAXfwo0gUUNdG4",
  // Actor: https://console.apify.com/actors/r5gMxLV2rOF3J1fxu
	luma: process.env.APIFY_LUMA_ACTOR_ID || "r5gMxLV2rOF3J1fxu",
};

/**
 * Wait for Apify actor run to complete and return results
 */
async function waitForRunAndGetResults(
  runId: string,
  actorId: string,
	timeoutMs: number = 300000, // 5 minutes default
): Promise<any[]> {
	const client = getApifyClient();
	const startTime = Date.now();
  
  
  while (Date.now() - startTime < timeoutMs) {
		const run = await client.run(runId).get();
    
    if (!run) {
			throw new Error(`Apify actor run ${runId} not found`);
    }
    
		if (run.status === "SUCCEEDED") {
      
      // Get results from dataset
      if (!run.defaultDatasetId) {
				throw new Error(`Apify actor run ${runId} has no default dataset`);
			}
			const dataset = await client.dataset(run.defaultDatasetId).listItems();
			
			return dataset.items;
		} else if (run.status === "FAILED" || run.status === "ABORTED") {
			throw new Error(
				`Apify actor run ${runId} ${run.status.toLowerCase()}: ${run.statusMessage || "Unknown error"}`,
			);
		} else if (run.status === "RUNNING" || run.status === "READY") {
      // Still running, wait a bit
			await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
    } else {
			throw new Error(`Unexpected actor run status: ${run.status}`);
    }
  }
  
	throw new Error(`Apify actor run ${runId} timed out after ${timeoutMs}ms`);
}

/**
 * Scrape Eventbrite events using Apify actor
 */
async function scrapeEventbriteEventsApify(
  city: string,
  query: string,
	maxItems: number = 50,
): Promise<any[]> {
  try {
		const client = getApifyClient();
		const actorId = DEFAULT_ACTORS.eventbrite;

		
    
    // Build Eventbrite search URL based on city and query
		const locationSlug = city.toLowerCase().replace(/\s+/g, "-");
		const querySlug = query.toLowerCase().replace(/\s+/g, "-");
    
    // Construct the search URL
    const searchUrl = query 
      ? `https://www.eventbrite.com/d/${locationSlug}/${querySlug}/?page=1`
			: `https://www.eventbrite.com/d/${locationSlug}/all-events/?page=1`;
    
    // Eventbrite actor input schema
    const input = {
      start_urls: [
        {
					url: searchUrl,
				},
      ],
			max_depth: 1,
		};
    
  
    
		const run = await client.actor(actorId).call(input);
    
    
    // Wait for run to complete and get results
		const items = await waitForRunAndGetResults(run.id, actorId);
    
    const events = items.map((item: any) => {
      return {
        name: item.name,
        title: item.name, 
        id: item.eventbrite_event_id || item.id || item.eid,
        api_id: item.eventbrite_event_id || item.id || item.eid,
        url: item.url,
        event_url: item.url, 
        start_date: item.start_date,
        start_time: item.start_time,
        end_date: item.end_date,
        end_time: item.end_time,
				summary: item.summary || "",
				full_description: item.full_description || item.summary || "",
        is_online_event: item.is_online_event || false,
        primary_venue: item.primary_venue || {
          name: city,
          address: {
						localized_address_display: city,
					},
        },
        image: item.image || {
					url: item.image?.url || item.image?.original?.url || "",
        },
        ticket_info: {
          is_free: false, 
					price: 0, 
        },
        organizer: {
					name: "Organizer not available", 
				},
			};
		});

		return events.slice(0, maxItems); 
  } catch (error: any) {
    
    // If actor doesn't exist or is invalid, provide helpful error
		if (
			error.message?.includes("not found") ||
			error.message?.includes("404")
		) {
      throw new Error(
        `Apify actor "${DEFAULT_ACTORS.eventbrite}" not found. ` +
        `Please set APIFY_EVENTBRITE_ACTOR_ID to a valid actor ID, ` +
					`or create your own Eventbrite scraper actor on Apify.`,
			);
    }
    
		throw error;
  }
}

/**
 * Scrape Luma events using Apify actor
 */
async function scrapeLumaEventsApify(
  query: string,
	maxItems: number = 50,
): Promise<any[]> {
  try {
		const client = getApifyClient();
		const actorId = DEFAULT_ACTORS.luma;
    
    // Start actor run with input parameters
    const input = {
      // Primary parameters (most common)
      query: query,
      searchQuery: query,
      searchTerm: query,
      // Result limits
      maxResults: maxItems,
      maxItems: maxItems,
      limit: maxItems,
      // Optional parameters
      includeOnline: true,
			sortBy: "date",
		};
    
		const run = await client.actor(actorId).call(input);
        
		const items = await waitForRunAndGetResults(run.id, actorId);
    
    // Transform items to match expected format
    const events = items.map((item: any) => {
			const eventData = item.event || item; // Use nested event if available, otherwise top-level
      
			const locationInfo = eventData?.geo_address_info || {};
			const venueName =
				locationInfo.address ||
				locationInfo.full_address ||
				locationInfo.city ||
				"";
			const venueAddress =
				locationInfo.full_address || locationInfo.address || "";
      
      return {
        api_id: item.api_id || eventData?.api_id,
        name: item.name || eventData?.name,
        title: item.name || eventData?.name,
				description:
					extractTextFromProseMirror(item.description_mirror) ||
					eventData?.description ||
					"",
				description_mirror:
					item.description_mirror || eventData?.description || "",
        start_at: item.start_at || eventData?.start_at,
        end_at: item.end_at || eventData?.end_at,
				url: item.url?.startsWith("http")
					? item.url
					: item.url
						? `https://lu.ma/${item.url}`
						: item.api_id
							? `https://lu.ma/${item.api_id}`
							: "",
				cover_url: item.mainImageUrl || eventData?.cover_url || "",
				cover_image: item.mainImageUrl || eventData?.cover_url || "",
				event_type: eventData?.event_type || "independent",
				location_type: eventData?.location_type || "offline",
        location: {
          name: venueName,
					address: venueAddress,
        },
        venue: {
          name: venueName,
					address: venueAddress,
        },
        calendar: item.calendar || {
					name: "Unknown",
					description: "",
        },
        hosts: item.hosts || [],
        capacity: null,
        registered_count: item.guest_count || 0,
        guest_count: item.guest_count || 0,
        ticket_info: item.ticket_info || {
          is_free: false, 
					price: 0,
        },
        event: eventData || {
          api_id: item.api_id,
          name: item.name,
          start_at: item.start_at,
          end_at: item.end_at,
          location_type: eventData?.location_type,
					event_type: eventData?.event_type,
				},
			};
		});
		return events.slice(0, maxItems); // Ensure we don't exceed maxItems
  } catch (error: any) {
    console.error(`❌ [APIFY] Luma scraping failed:`, {
      error: error.message,
      stack: error.stack,
			query,
		});
    
    // If actor doesn't exist or is invalid, provide helpful error
		if (
			error.message?.includes("not found") ||
			error.message?.includes("404")
		) {
      throw new Error(
        `Apify actor "${DEFAULT_ACTORS.luma}" not found. ` +
        `Please set APIFY_LUMA_ACTOR_ID to a valid actor ID, ` +
        `or create your own Luma scraper actor on Apify. ` +
					`Alternatively, you can use the direct Luma API via lumaEfficientScraping.ts`,
			);
    }
    
		throw error;
  }
}

/**
 * Check if Apify is configured and available
 */
function isApifyConfigured(): boolean {
	return !!process.env.APIFY_API_TOKEN;
}

// Using Puppeteer with stealth plugin instead of Apify (FREE)

/**
 * Get list of missing fields for logging
 */
function getMissingFields(event: any): string[] {
	const missing: string[] = [];
	if (!event.description || event.description.length < 100)
		missing.push("description");
	if (!event.techStack || event.techStack.length === 0)
		missing.push("techStack");
	if (
		!event.organizerName ||
		event.organizerName === "Organizer not available" ||
		event.organizerName === "Unknown"
	)
		missing.push("organizerName");
	if (!event.externalUrl) missing.push("externalUrl");
	return missing;
}

// Scrape Luma events - Try Apify first, fallback to API (for batch scraping only)
export async function scrapeLumaEvents(
	query: string,
	maxItems: number = 50,
): Promise<{ events: any[]; source: "apify" | "puppeteer" }> {
    // Try Apify first if configured (for batch scraping)
    if (isApifyConfigured()) {
      try {
			const events = await scrapeLumaEventsApify(query, maxItems);
        if (events.length > 0) {
				return { events, source: "apify" };
        } else {
        }
      } catch (error) {
			console.warn(
				`⚠️ [LUMA-APIFY] Apify scraping failed, falling back to API method:`,
				(error as Error).message,
			);
      }
    }
    
    // Fallback to direct API call (Puppeteer-based)
    try {
      // Use direct API call to get-paginated-events endpoint (PROVEN TO WORK)
		const events = await scrapeLumaEventsViaAPI(query, maxItems);
      
		return { events, source: "puppeteer" };
    } catch (error) {
		console.error("❌ Luma scraping failed:", error);
		return { events: [], source: "puppeteer" };
  }
}

// Scrape Eventbrite events - Try Apify first, fallback to Puppeteer (for batch scraping only)
export async function scrapeEventbriteEvents(
	city: string,
	techQuery: string,
	maxItems: number = 50,
): Promise<{ events: any[]; source: "apify" | "puppeteer" }> {
    // Try Apify first if configured (for batch scraping)
    if (isApifyConfigured()) {
      try {
        // Use higher limit for Apify to get all available events (Apify will return all it finds)
			const events = await scrapeEventbriteEventsApify(
				city,
				techQuery,
				maxItems || 200,
			);
        if (events.length > 0) {
				return { events, source: "apify" };
        }
      } catch (error) {
			console.warn(
				`⚠️ [EVENTBRITE-APIFY] Apify scraping failed, falling back to Puppeteer:`,
				(error as Error).message,
			);
      }
    }
    
    // Fallback to Puppeteer scraping
    try {
		const events = await scrapeEventbriteEventsPuppeteer(
			city,
			techQuery,
			maxItems || 50,
		);
		return { events, source: "puppeteer" };
    } catch (error) {
		console.error(
			`❌ Eventbrite tech scraping failed for "${techQuery}":`,
			error,
		);
		return { events: [], source: "puppeteer" };
  }
}

// ============================================================================
// SHARED VALIDATION AND SAVING LOGIC (used by all processors)
// ============================================================================

/**
 * Shared validation and saving logic for all event sources
 * This ensures consistent quality gates, deduplication, and database operations
 */
async function validateAndSaveEvent(
  processedEvent: any,
	platform: "luma" | "eventbrite",
	city: string,
): Promise<{ saved: boolean; reason?: string }> {
  // FETCH MISSING DATA: If description is short or organizer missing, try to fetch from URL
	const descriptionStr =
		typeof processedEvent.description === "string"
			? processedEvent.description
			: processedEvent.description?.text || "";
	if (
		(!descriptionStr ||
			descriptionStr.length < 100 ||
			descriptionStr.includes("Technology event:")) &&
		processedEvent.externalUrl
	) {
		let fetchedDetails = null;
		if (platform === "eventbrite") {
			fetchedDetails = await fetchEventbriteDetails(processedEvent.externalUrl);
		} else if (platform === "luma") {
			fetchedDetails = await fetchLumaDetails(processedEvent.externalUrl);
    }
    
    if (fetchedDetails) {
			if (
				fetchedDetails.description &&
				fetchedDetails.description.length >= 100
			) {
				processedEvent.description = fetchedDetails.description;
			}
			if (
				fetchedDetails.organizerName &&
				fetchedDetails.organizerName !== "Unknown" &&
				fetchedDetails.organizerName.length > 0
			) {
				processedEvent.organizerName = fetchedDetails.organizerName;
      }
      if (fetchedDetails.organizerDescription) {
				processedEvent.organizerDescription =
					fetchedDetails.organizerDescription;
      }
    }
  }
  
  // Extract tech stack and assign event type (using existing methods - NO LLM cost)
	processedEvent.techStack = extractTechStack(
		processedEvent.title,
		processedEvent.description,
	) as string[];
	processedEvent.eventType = assignEventType(
		processedEvent.title,
		processedEvent.description,
	);
	processedEvent.qualityScore = calculateQualityScore(processedEvent);
  
  // Calculate completeness score (no LLM calls - just validation)
	processedEvent.completenessScore = calculateCompleteness(processedEvent);
  
  // QUALITY GATE: Reject if completeness < 50
  if (processedEvent.completenessScore < 50) {
		return { saved: false, reason: "completeness" };
  }
  
  // Validate event data using Zod
	const validatedEvent = validateEvent(processedEvent);
  if (!validatedEvent) {
		return { saved: false, reason: "validation" };
  }
  
  // REMOVED: Tech event filtering - now saving ALL events regardless of tech/non-tech
  // All events from scraping will be saved (tech filtering removed per user request)

  // COMMENTED OUT: Skip past events (older than 1 week) - temporarily disabled
  // const oneWeekAgo = new Date()
  // oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  // if (validatedEvent.eventDate < oneWeekAgo) {
  //   console.log(`⚠️ Skipping past ${platform} event: ${validatedEvent.title}`)
  //   return { saved: false, reason: 'past-event' }
  // }
  
  // Only keep events in 2025 or later
	const year2025 = new Date("2025-01-01");
  if (validatedEvent.eventDate < year2025) {
		return { saved: false, reason: "old-date" };
  }

  // Normalize sourceId for deduplication
	const normalizedSourceId = normalizeSourceId(
		validatedEvent.sourceId,
		platform,
	);
  
  // Enhanced deduplication: Check multiple conditions in single query
	let existingEvent;
  try {
    existingEvent = await prisma.event.findFirst({
      where: {
        OR: [
          // Primary: Normalized sourceId (fastest, most reliable)
          {
            sourcePlatform: platform,
						sourceId: normalizedSourceId,
          },
          // Fallback 1: Same title + date + city (catches different sourceIds)
          {
						title: { equals: validatedEvent.title, mode: "insensitive" },
            eventDate: {
							gte: new Date(
								validatedEvent.eventDate.getTime() - 2 * 60 * 60 * 1000,
							), // 2 hours before
							lte: new Date(
								validatedEvent.eventDate.getTime() + 2 * 60 * 60 * 1000,
							), // 2 hours after
            },
            city: validatedEvent.city,
						sourcePlatform: platform,
          },
          // Fallback 2: Normalized URL match (catches cross-platform duplicates)
					...(validatedEvent.externalUrl
						? [
								{
            externalUrl: {
										startsWith: normalizeUrl(validatedEvent.externalUrl).split(
											"?",
										)[0],
									},
								},
							]
						: []),
				],
			},
		});
  } catch (dbError: any) {
		if (
			dbError.message?.includes("Can't reach database") ||
			dbError.code === "P1001"
		) {
			console.error(
				`❌ [DB] Database connection failed during deduplication check`,
			);
			return { saved: false, reason: "db-error" };
		}
		throw dbError;
  }
  
  if (existingEvent) {
		return { saved: false, reason: "duplicate" };
  }
  
  // Save to database with normalized sourceId and enrichment fields
	let savedEvent;
  try {
    savedEvent = await prisma.event.create({
      data: {
        title: validatedEvent.title,
				description: validatedEvent.description || "No description available",
        eventType: validatedEvent.eventType,
        eventDate: validatedEvent.eventDate,
        eventEndDate: validatedEvent.eventEndDate,
        venueName: validatedEvent.venueName,
        venueAddress: validatedEvent.venueAddress,
        city: validatedEvent.city,
        country: validatedEvent.country,
        isOnline: validatedEvent.isOnline,
        isFree: validatedEvent.isFree,
        priceMin: validatedEvent.priceMin,
        priceMax: validatedEvent.priceMax,
        currency: validatedEvent.currency,
        organizerName: validatedEvent.organizerName,
        organizerDescription: validatedEvent.organizerDescription,
        organizerRating: validatedEvent.organizerRating,
        capacity: validatedEvent.capacity,
        registeredCount: validatedEvent.registeredCount,
        techStack: validatedEvent.techStack,
        qualityScore: validatedEvent.qualityScore,
        completenessScore: processedEvent.completenessScore,
        externalUrl: validatedEvent.externalUrl,
        imageUrl: validatedEvent.imageUrl,
        sourcePlatform: validatedEvent.sourcePlatform,
        sourceId: normalizedSourceId,
        // Enrichment fields (empty for now - can add later if needed)
        dataEnriched: false,
        enrichmentAttempts: 0,
        topics: [],
        audienceLevel: null,
        format: null,
        summary: null,
        keyPoints: [],
        scrapedAt: new Date(),
        createdAt: new Date(),
				lastUpdated: new Date(),
			},
		});
  } catch (dbError: any) {
		if (
			dbError.message?.includes("Can't reach database") ||
			dbError.code === "P1001"
		) {
			console.error(
				`❌ [DB] Database connection failed while saving event: ${validatedEvent.title}`,
			);
			return { saved: false, reason: "db-error" };
		}
		throw dbError;
  }
  
  // Populate EventCategory from tech stack (no LLM cost)
  if (validatedEvent.techStack && validatedEvent.techStack.length > 0) {
    try {
			const categories = validatedEvent.techStack.map((tech) => ({
				category: "technology",
        value: tech.toLowerCase(),
				confidence: 1.0,
			}));
      
      // Add event type as category
      categories.push({
				category: "event_type",
        value: validatedEvent.eventType,
				confidence: 1.0,
			});
      
      await prisma.eventCategory.createMany({
				data: categories.map((cat) => ({
          eventId: savedEvent.id,
          category: cat.category,
          value: cat.value,
					confidence: cat.confidence,
				})),
			});
    } catch (dbError: any) {
			if (
				dbError.message?.includes("Can't reach database") ||
				dbError.code === "P1001"
			) {
				console.error(
					`❌ [DB] Database connection failed while saving categories`,
				);
        // Event is saved but categories failed - continue anyway
      } else {
				throw dbError;
			}
		}
	}

	return { saved: true };
}

// ============================================================================
// PUPPETEER PROCESSING FUNCTIONS (PRESERVE EXISTING LOGIC)
// ============================================================================

/**
 * Process Puppeteer Eventbrite events - PRESERVED ORIGINAL LOGIC
 * Puppeteer returns: { name, title, id, api_id, url, event_url, start_date, start_time, summary, full_description, is_online_event, primary_venue, image, ticket_info, organizer }
 */
async function processPuppeteerEventbriteEvent(
	event: any,
	city: string,
): Promise<any> {
	const description = event.full_description || event.summary || "";
  
  // Parse date - Puppeteer returns ISO date string or we generate a future date
	let eventDate: Date;
  if (event.start_date) {
    try {
      // If start_date is already a Date or ISO string
			eventDate =
				typeof event.start_date === "string"
					? new Date(
							event.start_date.includes("T")
								? event.start_date
								: `${event.start_date}T${event.start_time || "18:00"}`,
						)
					: new Date(event.start_date);
    } catch {
      // Fallback to future date if parsing fails
			eventDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    }
  } else {
    // Generate a future date (7-30 days from now)
		eventDate = new Date(
			Date.now() + (7 + Math.random() * 23) * 24 * 60 * 60 * 1000,
		);
  }
  
  return {
		title: event.name || event.title || "Untitled Event",
		description:
			description.length >= 100
				? description
				: `${description} This event brings together technology enthusiasts, developers, and industry professionals. Don't miss this opportunity to network and learn.`,
		eventType: "workshop", // Default, will be assigned by assignEventType
    eventDate: eventDate,
    eventEndDate: event.end_date ? new Date(event.end_date) : null,
    venueName: event.primary_venue?.name || city,
		venueAddress:
			event.primary_venue?.address?.localized_address_display || city,
    city: city,
		country: "US",
    isOnline: event.is_online_event || false,
    isFree: event.ticket_info?.is_free || false,
    priceMin: event.ticket_info?.price || 0,
    priceMax: event.ticket_info?.price || 0,
		currency: "USD",
		organizerName: event.organizer?.name || "Organizer not available",
		organizerDescription: "",
    capacity: null,
    registeredCount: 0,
    techStack: [] as string[], // Will be extracted by extractTechStack
    qualityScore: 0, // Will be calculated by calculateQualityScore
		externalUrl: event.url || event.event_url || "",
		imageUrl: event.image?.url || "",
		sourcePlatform: "eventbrite",
		sourceId: event.id || event.api_id || `eventbrite-${Date.now()}`,
	};
}

/**
 * Process Puppeteer Luma events - PRESERVED ORIGINAL LOGIC
 * Puppeteer Luma (via API) returns: { api_id, event: { name, description, start_at, end_at, ... }, start_at, calendar, hosts }
 */
async function processPuppeteerLumaEvent(
	event: any,
	city: string,
): Promise<any> {
	const nestedEvent = event.event || {}; // The nested event object
	const topLevel = event; // Top level fields
  
  return {
		title: nestedEvent.name || topLevel.name || "Untitled Event",
		description:
			nestedEvent.description ||
			topLevel.description ||
			(typeof event.description_mirror === "string"
				? event.description_mirror
				: "") ||
			"No description available",
		eventType: "workshop", // Default, will be assigned by assignEventType
		eventDate: topLevel.start_at
			? new Date(topLevel.start_at)
			: nestedEvent.start_at
				? new Date(nestedEvent.start_at)
				: new Date(),
		eventEndDate: topLevel.end_at
			? new Date(topLevel.end_at)
			: nestedEvent.end_at
				? new Date(nestedEvent.end_at)
				: null,
		venueName:
			nestedEvent.location?.name ||
			nestedEvent.venue?.name ||
			topLevel.location?.name ||
			city,
		venueAddress:
			nestedEvent.location?.address ||
			nestedEvent.venue?.address ||
			topLevel.location?.address ||
			city,
    city: city,
		country: "US",
		isOnline:
			nestedEvent.event_type === "online" ||
			nestedEvent.location_type === "online" ||
			topLevel.event_type === "online",
		isFree:
			nestedEvent.ticket_info?.is_free ||
			topLevel.ticket_info?.is_free ||
			false,
		priceMin:
			nestedEvent.ticket_info?.price || topLevel.ticket_info?.price || 0,
		priceMax:
			nestedEvent.ticket_info?.price || topLevel.ticket_info?.price || 0,
		currency: "USD",
		organizerName:
			topLevel.calendar?.name ||
			nestedEvent.calendar?.name ||
			topLevel.hosts?.[0]?.name ||
			nestedEvent.hosts?.[0]?.name ||
			"Unknown",
		organizerDescription:
			topLevel.calendar?.description ||
			nestedEvent.calendar?.description ||
			topLevel.hosts?.[0]?.bio_short ||
			"",
    capacity: nestedEvent.capacity || topLevel.capacity || null,
		registeredCount:
			nestedEvent.registered_count ||
			topLevel.registered_count ||
			topLevel.guest_count ||
			0,
    techStack: [] as string[], // Will be extracted by extractTechStack
    qualityScore: 0, // Will be calculated by calculateQualityScore
    externalUrl: (() => {
			const url = nestedEvent.url || topLevel.url;
			if (url?.startsWith("http")) return url;
			if (url) return `https://lu.ma/${url}`;
			const apiId = nestedEvent.api_id || topLevel.api_id;
			return apiId ? `https://lu.ma/${apiId}` : "";
    })(),
		imageUrl:
			nestedEvent.cover_url ||
			topLevel.cover_url ||
			topLevel.cover_image ||
			event.mainImageUrl ||
			event.imageUrl ||
			"",
		sourcePlatform: "luma",
		sourceId: nestedEvent.api_id || topLevel.api_id || `luma-${Date.now()}`,
	};
}

// ============================================================================
// APIFY PROCESSING FUNCTIONS (NEW - APIFY-SPECIFIC LOGIC)
// ============================================================================

/**
 * Process Apify Eventbrite events - NEW APIFY-SPECIFIC LOGIC
 * Apify returns: { name, title, id, api_id, url, event_url, start_date, start_time, end_date, end_time, summary, full_description, is_online_event, primary_venue, image, ticket_info, organizer }
 */
async function processApifyEventbriteEvent(
	event: any,
	city: string,
): Promise<any> {
  // Apify provides actual descriptions - use them directly, don't add generic text
	const description = event.full_description || event.summary || "";
  
  // Parse date from Apify format
	let eventDate: Date;
  if (event.start_date) {
    try {
			eventDate =
				typeof event.start_date === "string"
					? new Date(
							event.start_date.includes("T")
								? event.start_date
								: `${event.start_date}T${event.start_time || "18:00"}`,
						)
					: new Date(event.start_date);
    } catch {
			eventDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    }
  } else {
		eventDate = new Date(
			Date.now() + (7 + Math.random() * 23) * 24 * 60 * 60 * 1000,
		);
  }
  
  return {
		title: event.name || event.title || "Untitled Event",
    description: description, // Use Apify description as-is, no generic text added
		eventType: "workshop",
    eventDate: eventDate,
    eventEndDate: event.end_date ? new Date(event.end_date) : null,
    venueName: event.primary_venue?.name || city,
		venueAddress:
			event.primary_venue?.address?.localized_address_display || city,
    city: city,
		country: "US",
    isOnline: event.is_online_event || false,
    isFree: event.ticket_info?.is_free || false,
    priceMin: event.ticket_info?.price || 0,
    priceMax: event.ticket_info?.price || 0,
		currency: "USD",
		organizerName: event.organizer?.name || "Organizer not available",
		organizerDescription: "",
    capacity: null,
    registeredCount: 0,
    techStack: [] as string[],
    qualityScore: 0,
		externalUrl: event.url || event.event_url || "",
		imageUrl: event.image?.url || event.image?.original?.url || "",
		sourcePlatform: "eventbrite",
		sourceId: event.id || event.api_id || `eventbrite-${Date.now()}`,
	};
}

/**
 * Process Apify Luma events - NEW APIFY-SPECIFIC LOGIC
 * Apify returns: { api_id, name, title, description (already extracted from ProseMirror), url (full URL), start_at, end_at, event: {...}, calendar, hosts, ... }
 */
async function processApifyLumaEvent(event: any, city: string): Promise<any> {
	const nestedEvent = event.event || {};
	const topLevel = event;
  
  // Apify already extracts ProseMirror to string in apifyScraping.ts, so description is already a string
  // URL is already a full URL from apifyScraping.ts
  
  // Helper to extract numeric price from Apify ticket_info (can be number or object)
  const extractPrice = (ticketInfo: any): number => {
		if (!ticketInfo) return 0;
		const price = ticketInfo.price;
		if (typeof price === "number") return price;
		if (typeof price === "object" && price !== null) {
      // Handle object format like { cents: 0, currency: 'USD' } or { price: 0 }
			if (typeof price.cents === "number") return price.cents / 100;
			if (typeof price.price === "number") return price.price;
    }
		return 0;
	};
  
	const ticketInfo = nestedEvent.ticket_info || topLevel.ticket_info;
	const price = extractPrice(ticketInfo);
  
  return {
		title: nestedEvent.name || topLevel.name || "Untitled Event",
		description:
			nestedEvent.description ||
			topLevel.description ||
			(typeof event.description_mirror === "string"
				? event.description_mirror
				: "") ||
			"No description available",
		eventType: "workshop",
		eventDate: topLevel.start_at
			? new Date(topLevel.start_at)
			: nestedEvent.start_at
				? new Date(nestedEvent.start_at)
				: new Date(),
		eventEndDate: topLevel.end_at
			? new Date(topLevel.end_at)
			: nestedEvent.end_at
				? new Date(nestedEvent.end_at)
				: null,
		venueName:
			nestedEvent.location?.name ||
			nestedEvent.venue?.name ||
			topLevel.location?.name ||
			city,
		venueAddress:
			nestedEvent.location?.address ||
			nestedEvent.venue?.address ||
			topLevel.location?.address ||
			city,
    city: city,
		country: "US",
		isOnline:
			nestedEvent.event_type === "online" ||
			nestedEvent.location_type === "online" ||
			topLevel.event_type === "online",
		isFree:
			nestedEvent.ticket_info?.is_free ||
			topLevel.ticket_info?.is_free ||
			false,
    priceMin: price,
    priceMax: price,
		currency: "USD",
		organizerName:
			topLevel.calendar?.name ||
			nestedEvent.calendar?.name ||
			topLevel.hosts?.[0]?.name ||
			nestedEvent.hosts?.[0]?.name ||
			"Unknown",
		organizerDescription:
			topLevel.calendar?.description ||
			nestedEvent.calendar?.description ||
			topLevel.hosts?.[0]?.bio_short ||
			"",
    capacity: nestedEvent.capacity || topLevel.capacity || null,
		registeredCount:
			nestedEvent.registered_count ||
			topLevel.registered_count ||
			topLevel.guest_count ||
			0,
    techStack: [] as string[],
    qualityScore: 0,
    // Apify already provides full URL, but double-check
    externalUrl: (() => {
			const url = nestedEvent.url || topLevel.url;
			if (url?.startsWith("http")) return url;
			if (url) return `https://lu.ma/${url}`;
			const apiId = nestedEvent.api_id || topLevel.api_id;
			return apiId ? `https://lu.ma/${apiId}` : "";
    })(),
		imageUrl:
			nestedEvent.cover_url ||
			topLevel.cover_url ||
			topLevel.cover_image ||
			event.mainImageUrl ||
			event.imageUrl ||
			"",
		sourcePlatform: "luma",
		sourceId: nestedEvent.api_id || topLevel.api_id || `luma-${Date.now()}`,
	};
}

// ============================================================================
// MAIN PROCESSING FUNCTIONS (CALL CORRECT PROCESSOR BASED ON SOURCE)
// ============================================================================

/**
 * Process Puppeteer Eventbrite events - PRESERVED ORIGINAL LOGIC
 */
export async function processPuppeteerEventbriteEvents(
	events: any[],
	city: string,
) {
	return processEventsWithSource(
		events,
		"eventbrite",
		city,
		"puppeteer",
		processPuppeteerEventbriteEvent,
	);
}

/**
 * Process Puppeteer Luma events - PRESERVED ORIGINAL LOGIC
 */
export async function processPuppeteerLumaEvents(events: any[], city: string) {
	return processEventsWithSource(
		events,
		"luma",
		city,
		"puppeteer",
		processPuppeteerLumaEvent,
	);
}

/**
 * Process Apify Eventbrite events - NEW APIFY-SPECIFIC LOGIC
 */
export async function processApifyEventbriteEvents(
	events: any[],
	city: string,
) {
	return processEventsWithSource(
		events,
		"eventbrite",
		city,
		"apify",
		processApifyEventbriteEvent,
	);
}

/**
 * Process Apify Luma events - NEW APIFY-SPECIFIC LOGIC
 */
export async function processApifyLumaEvents(events: any[], city: string) {
	return processEventsWithSource(
		events,
		"luma",
		city,
		"apify",
		processApifyLumaEvent,
	);
}

/**
 * Generic processor that calls the correct event mapper and shared validation/saving logic
 */
async function processEventsWithSource(
  events: any[],
	platform: "luma" | "eventbrite",
  city: string,
	source: "puppeteer" | "apify",
	eventMapper: (event: any, city: string) => Promise<any>,
) {
	let savedCount = 0;
	let rejectedCount = 0;
	const rejectedReasons: Record<string, number> = {};
  
  for (const event of events) {
    try {
      // Map event to processed format using source-specific mapper
			const processedEvent = await eventMapper(event, city);
      
      // Use shared validation and saving logic
			const result = await validateAndSaveEvent(processedEvent, platform, city);
      
      if (result.saved) {
				savedCount++;
      } else {
				rejectedCount++;
        if (result.reason) {
					rejectedReasons[result.reason] =
						(rejectedReasons[result.reason] || 0) + 1;
        }
      }
    } catch (error: any) {
      // Handle non-database errors
			if (
				error.message?.includes("Can't reach database") ||
				error.code === "P1001"
			) {
				console.error(`❌ [DB] Database connection error: ${error.message}`);
				rejectedCount++;
				rejectedReasons["db-error"] = (rejectedReasons["db-error"] || 0) + 1;
      } else {
				console.error(
					`❌ Error processing ${source} ${platform} event:`,
					error,
				);
				rejectedCount++;
				rejectedReasons["error"] = (rejectedReasons["error"] || 0) + 1;
			}
		}
	}
  
  // Warn if database connection issues occurred
	const dbErrors = rejectedReasons["db-error"] || 0;
  if (dbErrors > 0) {
		console.error(
			`   ⚠️ Database connection failed - ${dbErrors} events could not be saved`,
		);
		console.error(
			`   Please check DATABASE_URL and ensure the database is accessible`,
		);
	}

	return savedCount;
}
