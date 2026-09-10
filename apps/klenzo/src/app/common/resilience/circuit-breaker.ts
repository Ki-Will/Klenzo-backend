import * as CircuitBreaker from 'opossum';

/**
 * Circuit breaker options for gRPC calls.
 * Prevents cascading failures when a downstream service is down.
 */
const circuitBreakerOptions: CircuitBreaker.Options = {
  timeout: 5000, // 5 second timeout
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 30000, // Try again after 30 seconds
  rollingCountTimeout: 10000, // Window for counting failures
  rollingCountBuckets: 10, // Number of buckets in the window
  volumeThreshold: 5, // Minimum requests before circuit can open
};

/**
 * Creates a circuit breaker wrapper for a gRPC client method.
 */
export function createCircuitBreaker<T extends (...args: any[]) => any>(
  fn: T,
  name: string,
  options?: Partial<CircuitBreaker.Options>,
): T {
  const breaker = new CircuitBreaker(fn, {
    ...circuitBreakerOptions,
    ...options,
  });

  breaker.on('open', () => {
    console.warn(
      JSON.stringify({
        event: 'circuit_breaker_open',
        circuit: name,
        timestamp: new Date().toISOString(),
      }),
    );
  });

  breaker.on('halfOpen', () => {
    console.log(
      JSON.stringify({
        event: 'circuit_breaker_half_open',
        circuit: name,
        timestamp: new Date().toISOString(),
      }),
    );
  });

  breaker.on('close', () => {
    console.log(
      JSON.stringify({
        event: 'circuit_breaker_close',
        circuit: name,
        timestamp: new Date().toISOString(),
      }),
    );
  });

  breaker.on('fallback', () => {
    console.warn(
      JSON.stringify({
        event: 'circuit_breaker_fallback',
        circuit: name,
        timestamp: new Date().toISOString(),
      }),
    );
  });

  return breaker.fire.bind(breaker) as T;
}

/**
 * Retry with exponential backoff.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 100,
    maxDelay = 5000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = Math.min(
          baseDelay * Math.pow(backoffMultiplier, attempt),
          maxDelay,
        );
        // Add jitter
        const jitter = Math.random() * delay * 0.1;
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      }
    }
  }

  throw lastError;
}
