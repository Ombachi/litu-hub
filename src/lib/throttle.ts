/**
 * Simple token-bucket rate limiter for client-side request throttling.
 * Prevents excessive API calls from rapid user interactions.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number = 10,
    private refillRate: number = 2, // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  tryConsume(count: number = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  get remaining(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

// Global buckets for different operation types
export const mutationBucket = new TokenBucket(15, 3);   // 15 burst, 3/sec refill
export const queryBucket = new TokenBucket(30, 5);       // 30 burst, 5/sec refill
export const aiRequestBucket = new TokenBucket(5, 0.5);  // 5 burst, 1 per 2sec

/**
 * Wraps an async function with throttle check.
 * Throws if rate limit exceeded.
 */
export function withThrottle<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  bucket: TokenBucket = mutationBucket,
  errorMessage = "Too many requests. Please wait a moment."
): T {
  return ((...args: any[]) => {
    if (!bucket.tryConsume()) {
      return Promise.reject(new Error(errorMessage));
    }
    return fn(...args);
  }) as T;
}
