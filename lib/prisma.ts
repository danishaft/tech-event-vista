import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

// Production-ready Prisma Client with connection pooling and query logging
// In worker context, suppress connection errors (they're handled on first query)
// Prisma will automatically read DATABASE_URL from environment
export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log:
			process.env.CREATE_WORKER === "true"
				? [] // Suppress logs in worker - handle errors manually
				: process.env.NODE_ENV === "development"
					? [{ emit: "event", level: "query" }]
					: ["error", "warn"],
		// Don't explicitly pass datasources - let Prisma read DATABASE_URL from env
		// This prevents build-time errors when DATABASE_URL is not set
	});

// Add connection retry logic
let connectionRetries = 0;
const MAX_RETRIES = 3;

async function ensureConnection() {
	try {
		await prisma.$connect();
		connectionRetries = 0; // Reset on success
	} catch (error: any) {
		connectionRetries++;
		if (connectionRetries < MAX_RETRIES) {
			console.warn(
				`⚠️ [DB] Connection failed (attempt ${connectionRetries}/${MAX_RETRIES}), retrying...`,
			);
			await new Promise((resolve) =>
				setTimeout(resolve, 1000 * connectionRetries),
			); // Exponential backoff
			return ensureConnection();
		}
		throw error;
	}
}

// Try to establish connection on startup (non-blocking)
// Skip automatic connection in worker context - let it connect on first use
if (process.env.NODE_ENV !== "test" && process.env.CREATE_WORKER !== "true") {
	ensureConnection().catch((error) => {
		console.error(
			"❌ [DB] Failed to establish initial connection:",
			error.message,
		);
	});
}

// Log slow queries in development
// Use a flag stored in global to prevent duplicate listeners (fixes MaxListenersExceededWarning)
// This persists across hot reloads in Next.js
const globalForQueryListener = globalThis as unknown as {
	queryListenerAdded?: boolean;
};

if (
	process.env.NODE_ENV === "development" &&
	!globalForQueryListener.queryListenerAdded
) {
	globalForQueryListener.queryListenerAdded = true;

	// Increase max listeners before adding listener to prevent warnings
	const eventEmitter = prisma.$on as any;
	if (eventEmitter && typeof eventEmitter.setMaxListeners === "function") {
		eventEmitter.setMaxListeners(20);
	}

	prisma.$on("query" as never, (e: any) => {
		const duration = e.duration;
		if (duration > 100) {
			console.warn(
				`⚠️ [DB] Slow query (${duration}ms):`,
				e.query.substring(0, 200),
			);
		}
	});
}
