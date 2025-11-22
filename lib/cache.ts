import { cacheConnection } from "./redis";

// Simple cache service - uses Redis directly
export class CacheService {
	// Generic cache operations
	async get<T>(key: string): Promise<T | null> {
		try {
			const value = (await cacheConnection.get(key)) as string | null;
			return value ? JSON.parse(value) : null;
		} catch (error) {
			// cacheConnection already handles timeouts/errors, but catch JSON parse errors
			return null;
		}
	}

	async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
		try {
			const serialized = JSON.stringify(value);
			if (ttlSeconds) {
				await cacheConnection.set(key, serialized, { ex: ttlSeconds });
			} else {
				await cacheConnection.set(key, serialized);
			}
			return true;
		} catch (error) {
			// cacheConnection already handles timeouts/errors gracefully
			return false;
		}
	}

	// Rate limit key generator
	static generateRateLimitKey(identifier: string, window: string): string {
		return `rate_limit:${identifier}:${window}`;
	}

	// Rate limiting using Redis
	// If Redis fails, fail open (allow request) - cacheConnection handles errors gracefully
	async checkRateLimit(
		identifier: string,
		limit: number,
		windowSeconds: number,
	): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
		const key = CacheService.generateRateLimitKey(
			identifier,
			windowSeconds.toString(),
		);

		try {
			// cacheConnection.incr returns 1 if Redis unavailable (fail open)
			const current = (await cacheConnection.incr(key)) as number;

			if (current === 1) {
				// First request in window - set expiration
				await cacheConnection.expire(key, windowSeconds);
			}

			// Get TTL to calculate reset time
			const ttl = (await cacheConnection.ttl(key)) as number;
			const resetTime =
				ttl > 0 ? Date.now() + ttl * 1000 : Date.now() + windowSeconds * 1000;

			return {
				allowed: current <= limit,
				remaining: Math.max(0, limit - current),
				resetTime,
			};
		} catch (error) {
			// If Redis fails, allow the request (fail open)
			// cacheConnection already handles timeouts, but catch any unexpected errors
			return {
				allowed: true,
				remaining: limit,
				resetTime: Date.now() + windowSeconds * 1000,
			};
		}
	}
}

export const cacheService = new CacheService();

