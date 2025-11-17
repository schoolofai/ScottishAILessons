/**
 * Rate Limiting Utility
 *
 * Provides simple in-memory rate limiting for API routes.
 * For production with multiple servers, upgrade to Redis-based solution (e.g., @upstash/ratelimit)
 *
 * Security: Prevents abuse of payment and authentication endpoints
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

// In-memory store for rate limit tracking
// Key format: `${identifier}:${endpoint}`
const store = new Map<string, RateLimitStore>();

// Cleanup old entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.resetTime < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Endpoint identifier (used in error messages and logging)
   */
  endpoint: string;
}

/**
 * Get client identifier from request (IP address or fallback)
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers (consider reverse proxy setup)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  // Fallback to request IP (may not work behind proxies)
  return request.ip || 'unknown';
}

/**
 * Rate limit middleware for Next.js API routes
 *
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await rateLimit(request, {
 *     maxRequests: 5,
 *     windowMs: 60 * 1000, // 1 minute
 *     endpoint: '/api/stripe/checkout'
 *   });
 *
 *   if (!rateLimitResult.success) {
 *     return rateLimitResult.response;
 *   }
 *
 *   // ... rest of endpoint logic
 * }
 * ```
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ success: true } | { success: false; response: NextResponse }> {
  const identifier = getClientIdentifier(request);
  const key = `${identifier}:${config.endpoint}`;
  const now = Date.now();

  // Get or create rate limit entry
  let entry = store.get(key);

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired one
    entry = {
      count: 1,
      resetTime: now + config.windowMs
    };
    store.set(key, entry);

    console.log(`[RateLimit] ${config.endpoint} - New window started for ${identifier}`);
    return { success: true };
  }

  // Increment request count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

    console.warn(
      `[RateLimit] ${config.endpoint} - Rate limit exceeded for ${identifier} ` +
      `(${entry.count}/${config.maxRequests} requests, retry after ${retryAfter}s)`
    );

    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
          }
        }
      )
    };
  }

  console.log(
    `[RateLimit] ${config.endpoint} - Request ${entry.count}/${config.maxRequests} for ${identifier}`
  );

  return { success: true };
}

/**
 * Predefined rate limit configurations for common use cases
 */
export const RateLimitPresets = {
  /**
   * Strict limit for payment operations (5 requests per minute)
   */
  PAYMENT: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
  },

  /**
   * Moderate limit for authentication (10 requests per minute)
   */
  AUTH: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },

  /**
   * Lenient limit for read-only operations (60 requests per minute)
   */
  READ: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
  },

  /**
   * Very strict limit for sensitive operations (3 requests per 5 minutes)
   */
  SENSITIVE: {
    maxRequests: 3,
    windowMs: 5 * 60 * 1000, // 5 minutes
  }
};
