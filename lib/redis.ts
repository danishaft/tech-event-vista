import { Redis as UpstashRedis } from "@upstash/redis";
import Redis from "ioredis";

// Simple Redis connection - just like friend's implementation
// You can get the REDIS_URL from your environment variables
const REDIS_URL =
	process.env.REDIS_URL ||
	process.env.UPSTASH_REDIS_URL ||
	"redis://localhost:6379";

const connection = new Redis(REDIS_URL, {
	maxRetriesPerRequest: null, // Required for workers (official BullMQ requirement)
	enableReadyCheck: false,
	connectTimeout: 10000,
	retryStrategy: (times) => {
		const delay = Math.min(times * 50, 5000);
		return delay;
	},
});

// Event handlers
connection.on("error", (err) => {
	if (err instanceof Error) {
		if (
			err.message.includes("ETIMEDOUT") ||
			err.message.includes("ECONNREFUSED")
		) {
			console.error("❌ Redis connection timeout/refused. Check:");
			console.error("   1. REDIS_URL is correct");
			console.error("   2. Redis server is running (if local)");
			console.error("   3. Network/firewall allows connection");
		} else {
			console.error("❌ Redis error:", err.message);
		}
	}
});

connection.on("connect", () => {
	// Redis connected
});

connection.on("ready", () => {
	// Redis ready
});

connection.on("close", () => {
	// Redis closed
});

connection.on("reconnecting", (delay: number) => {
	// Redis reconnecting
});

export { connection };

// Upstash Redis for caching (HTTP-based, serverless-friendly)
// Graceful fallback: Return null if Redis is unavailable
let _cacheConnection: UpstashRedis | null = null;

// Helper to get or initialize cache connection
function getCacheConnection(): UpstashRedis | null {
	if (!_cacheConnection) {
		if (
			!process.env.UPSTASH_REDIS_REST_URL ||
			!process.env.UPSTASH_REDIS_REST_TOKEN
		) {
			return null; // Redis not configured
		}
		_cacheConnection = new UpstashRedis({
			url: process.env.UPSTASH_REDIS_REST_URL,
			token: process.env.UPSTASH_REDIS_REST_TOKEN,
		});
	}
	return _cacheConnection;
}

// Helper to wrap Redis calls with timeout and error handling
async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number = 1000,
	fallback: T,
): Promise<T> {
	try {
		return await Promise.race([
			promise,
			new Promise<T>((_, reject) =>
				setTimeout(() => reject(new Error("Redis timeout")), timeoutMs),
			),
		]);
	} catch (error) {
		return fallback;
	}
}

export const cacheConnection = {
	get: async (key: string) => {
		const conn = getCacheConnection();
		if (!conn) return null;
		return withTimeout(conn.get(key), 1000, null);
	},
	set: async (key: string, value: string, options?: any) => {
		const conn = getCacheConnection();
		if (!conn) return "OK"; // Redis not configured, pretend success
		return withTimeout(conn.set(key, value, options), 1000, "OK");
	},
	incr: async (key: string) => {
		const conn = getCacheConnection();
		if (!conn) return 1; // Fallback: allow request
		return withTimeout(conn.incr(key), 500, 1);
	},
	expire: async (key: string, seconds: number) => {
		const conn = getCacheConnection();
		if (!conn) return 0;
		return withTimeout(conn.expire(key, seconds), 500, 0);
	},
	ttl: async (key: string) => {
		const conn = getCacheConnection();
		if (!conn) return -1;
		return withTimeout(conn.ttl(key), 500, -1);
	},
};

// Graceful shutdown handling
// Only set handlers if NOT in worker process (worker has its own handlers)
const isWorker = process.env.CREATE_WORKER === "true";
if (!isWorker) {
	process.on("SIGINT", async () => {
		await connection.quit();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		await connection.quit();
		process.exit(0);
	});
}
