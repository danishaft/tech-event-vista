import { Redis as UpstashRedis } from "@upstash/redis";
import Redis from "ioredis";

// Simple Redis connection - just like friend's implementation
// You can get the REDIS_URL from your environment variables
const REDIS_URL =
	process.env.REDIS_URL ||
	process.env.UPSTASH_REDIS_URL ||
	"redis://localhost:6379";

// Debug: Log what URL we're using (hide password)
console.log(`🔌 [REDIS] Initializing connection with URL: ${REDIS_URL.replace(/:[^:@]+@/, ':****@')}`);
console.log(`🔌 [REDIS] REDIS_URL env var: ${process.env.REDIS_URL ? 'SET' : 'NOT SET'}`);
console.log(`🔌 [REDIS] UPSTASH_REDIS_URL env var: ${process.env.UPSTASH_REDIS_URL ? 'SET' : 'NOT SET'}`);

const connection = new Redis(REDIS_URL, {
	maxRetriesPerRequest: null, // Required for workers (official BullMQ requirement)
	enableReadyCheck: false,
	connectTimeout: 10000,
	retryStrategy: (times) => {
		const delay = Math.min(times * 50, 5000);
		console.log(`🔄 Redis reconnecting (attempt ${times}) in ${delay}ms...`);
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
	try {
		const urlObj = new URL(REDIS_URL);
		console.log(`✅ Redis connected to ${urlObj.hostname}:${urlObj.port || 6379}`);
	} catch {
		console.log(`✅ Redis connected`);
	}
});

connection.on("ready", () => {
	console.log("✅ Redis ready for operations");
});

connection.on("close", () => {
	console.log("⚠️ Redis connection closed");
});

connection.on("reconnecting", (delay: number) => {
	console.log(`🔄 Redis reconnecting in ${delay}ms...`);
});

export { connection };

// Upstash Redis for caching (HTTP-based, serverless-friendly)
// Graceful fallback: Return null if Redis is unavailable
let _cacheConnection: UpstashRedis | null = null;
const _redisAvailable: boolean = true;

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
		return withTimeout(_cacheConnection.get(key), 1000, null);
	},
	set: async (key: string, value: string, options?: any) => {
		if (!_cacheConnection) {
			if (
				!process.env.UPSTASH_REDIS_REST_URL ||
				!process.env.UPSTASH_REDIS_REST_TOKEN
			) {
				return "OK"; // Redis not configured, pretend success
			}
			_cacheConnection = new UpstashRedis({
				url: process.env.UPSTASH_REDIS_REST_URL,
				token: process.env.UPSTASH_REDIS_REST_TOKEN,
			});
		}
		return withTimeout(_cacheConnection.set(key, value, options), 1000, "OK");
	},
	del: async (key: string) => {
		if (!_cacheConnection) {
			if (
				!process.env.UPSTASH_REDIS_REST_URL ||
				!process.env.UPSTASH_REDIS_REST_TOKEN
			) {
				return 0;
			}
			_cacheConnection = new UpstashRedis({
				url: process.env.UPSTASH_REDIS_REST_URL,
				token: process.env.UPSTASH_REDIS_REST_TOKEN,
			});
		}
		return withTimeout(_cacheConnection.del(key), 1000, 0);
	},
	exists: async (key: string) => {
		if (!_cacheConnection) {
			if (
				!process.env.UPSTASH_REDIS_REST_URL ||
				!process.env.UPSTASH_REDIS_REST_TOKEN
			) {
				return 0;
			}
			_cacheConnection = new UpstashRedis({
				url: process.env.UPSTASH_REDIS_REST_URL,
				token: process.env.UPSTASH_REDIS_REST_TOKEN,
			});
		}
		return withTimeout(_cacheConnection.exists(key), 1000, 0);
	},
	incr: async (key: string) => {
		if (!_cacheConnection) {
			if (
				!process.env.UPSTASH_REDIS_REST_URL ||
				!process.env.UPSTASH_REDIS_REST_TOKEN
			) {
				return 1; // Fallback: allow request
			}
			_cacheConnection = new UpstashRedis({
				url: process.env.UPSTASH_REDIS_REST_URL,
				token: process.env.UPSTASH_REDIS_REST_TOKEN,
			});
		}
		return withTimeout(_cacheConnection.incr(key), 500, 1);
	},
	expire: async (key: string, seconds: number) => {
		if (!_cacheConnection) {
			if (
				!process.env.UPSTASH_REDIS_REST_URL ||
				!process.env.UPSTASH_REDIS_REST_TOKEN
			) {
				return 0;
			}
			_cacheConnection = new UpstashRedis({
				url: process.env.UPSTASH_REDIS_REST_URL,
				token: process.env.UPSTASH_REDIS_REST_TOKEN,
			});
		}
		return withTimeout(_cacheConnection.expire(key, seconds), 500, 0);
	},
	ttl: async (key: string) => {
		if (!_cacheConnection) {
			if (
				!process.env.UPSTASH_REDIS_REST_URL ||
				!process.env.UPSTASH_REDIS_REST_TOKEN
			) {
				return -1;
			}
			_cacheConnection = new UpstashRedis({
				url: process.env.UPSTASH_REDIS_REST_URL,
				token: process.env.UPSTASH_REDIS_REST_TOKEN,
			});
		}
		return withTimeout(_cacheConnection.ttl(key), 500, -1);
	},
	keys: async (pattern: string) => {
		if (!_cacheConnection) {
			if (
				!process.env.UPSTASH_REDIS_REST_URL ||
				!process.env.UPSTASH_REDIS_REST_TOKEN
			) {
				return [];
			}
			_cacheConnection = new UpstashRedis({
				url: process.env.UPSTASH_REDIS_REST_URL,
				token: process.env.UPSTASH_REDIS_REST_TOKEN,
			});
		}
		return withTimeout(_cacheConnection.keys(pattern), 1000, []);
	},
	ping: async () => {
		if (!_cacheConnection) {
			if (
				!process.env.UPSTASH_REDIS_REST_URL ||
				!process.env.UPSTASH_REDIS_REST_TOKEN
			) {
				return "PONG";
			}
			_cacheConnection = new UpstashRedis({
				url: process.env.UPSTASH_REDIS_REST_URL,
				token: process.env.UPSTASH_REDIS_REST_TOKEN,
			});
		}
		return withTimeout(_cacheConnection.ping(), 1000, "PONG");
	},
};

// Graceful shutdown handling
// Only set handlers if NOT in worker process (worker has its own handlers)
const isWorker = process.env.CREATE_WORKER === "true";
if (!isWorker) {
	process.on("SIGINT", async () => {
		console.log("🔄 [REDIS] Gracefully closing Redis connections (SIGINT)...");
		await connection.quit();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		console.log("🔄 [REDIS] Gracefully closing Redis connections (SIGTERM)...");
		await connection.quit();
		process.exit(0);
	});
}
