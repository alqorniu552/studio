
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useTransition } from "react";
import { startFloodAttack, fetchProxiesFromUrl, checkProxies, type FloodStats } from "@/app/actions";
import { ProgressDisplay } from "./progress-display";
import { Target, Users, Zap, PlayCircle, StopCircle, ArrowRightLeft, ListPlus, FileText, Timer, ShieldQuestion, Globe, DownloadCloud, Loader2, ListChecks } from "lucide-react";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;

// Regex to validate proxy entries:
// Optional user:pass@, then host (hostname or IP), then :port
// Does NOT allow http(s):// scheme here as it should be stripped or cause validation failure.
const proxyEntryRegex = /^(?:([^:]+:[^@]+@)?)?(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?|[a-zA-Z]{2,6})|(?:\d{1,3}\.){3}\d{1,3})(?::\d{1,5})$/;


const formSchema = z.object({
  targetUrl: z.string().url({ message: "Silakan masukkan URL yang valid (mis., http://contoh.com atau https://contoh.com)." }),
  method: z.enum(HTTP_METHODS).default("GET"),
  headers: z.string().optional(),
  body: z.string().optional(),
  proxies: z.string().optional().refine(val => {
    if (!val || val.trim() === "") return true; // Optional field, empty is fine
    return val.split('\n').filter(line => line.trim() !== "").every(line => {
        const trimmedLine = line.trim();
        // Disallow http(s):// schemes directly in the textarea
        if (trimmedLine.startsWith("http://") || trimmedLine.startsWith("https://")) {
            return false;
        }
        return proxyEntryRegex.test(trimmedLine);
    });
  }, { message: "Satu atau lebih entri proksi tidak valid. Gunakan format host:port, IP:PORT, atau user:pass@host:port. Jangan sertakan skema http:// atau https://." }),
  concurrency: z.coerce.number().int().min(1, "Min 1").max(500, "Maks 500").default(50),
  rate: z.coerce.number().int().min(1, "Min 1").max(500, "Maks 500").default(50),
  duration: z.coerce.number().int().min(5, "Min 5d").max(60, "Maks 60d").default(10),
});

type FormValues = z.infer<typeof formSchema>;

const METHODS_WITH_BODY: readonly string[] = ["POST", "PUT", "PATCH"];

export function RequestCannonForm() {
  const [isFlooding, setIsFlooding] = useState(false);
  const [stats, setStats] = useState<FloodStats | null>(null);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [proxyApiUrl, setProxyApiUrl] = useState<string>("");
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

  const selectedMethod = form.watch("method");
  const currentProxies = form.watch("proxies");

  const onSubmit = (values: FormValues) => {
    if (isFlooding && isPending) { // isFlooding is technically the same as isPending here
      toast({ title: "Permintaan Penghentian Banjir", description: "Serangan akan menyelesaikan durasi saat ini di server." });
      // We don't actually stop it here, as startFloodAttack runs until its duration.
      // This is more of a user feedback if they click again.
      return;
    }

    setIsFlooding(true);
    setStats(null);
    setCurrentError(null);
    setCurrentAttackDuration(values.duration);

    startTransition(async () => {
      try {
        const result = await startFloodAttack(
          values.targetUrl,
          values.method,
          values.headers,
          METHODS_WITH_BODY.includes(values.method) ? values.body : undefined,
          values.concurrency,
          values.rate,
          values.duration,
          values.proxies, // Proxies from textarea (should be scheme-less due to validation)
          proxyApiUrl.trim() ? proxyApiUrl.trim() : undefined // API URL for dynamic fetching
        );
        setStats(result);
        if (result.error) {
          setCurrentError(result.error);
          toast({ variant: "destructive", title: "Kesalahan Banjir", description: result.error });
        } else {
          toast({ title: "Banjir Selesai", description: `Mengirim ${result.totalSent} permintaan selama ${values.duration}d. Berhasil: ${result.successful}, Gagal: ${result.failed}.` });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.";
        setCurrentError(errorMessage);
        setStats({ totalSent: 0, successful: 0, failed: 0, error: errorMessage });
        toast({ variant: "destructive", title: "Gagal Memulai Banjir", description: errorMessage });
      } finally {
         setIsFlooding(false); // same as !isPending
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
    setCurrentError(null); // Clear previous errors
    try {
      const result = await fetchProxiesFromUrl(proxyApiUrl); // This action now strips schemes
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
    // Zod validation should have already caught schemes. This is an extra safeguard.
    if (proxiesToTest.split('\n').some(line => line.trim().startsWith("http://") || line.trim().startsWith("https://"))) {
        toast({ variant: "destructive", title: "Format Proksi Tidak Valid", description: "Daftar proksi tidak boleh mengandung skema http:// atau https://. Harap hapus sebelum memeriksa.", duration: 7000});
        return;
    }

    setIsCheckingProxies(true);
    setCurrentError(null); // Clear previous errors
    toast({ title: "Memeriksa Proksi", description: "Ini mungkin memerlukan beberapa saat tergantung pada jumlah proksi..." });
    try {
      const result = await checkProxies(proxiesToTest); // Expects scheme-less proxies
      if (result.error && result.totalChecked === 0 && !result.liveCount) { // No valid proxies found to even check
         toast({ variant: "destructive", title: "Kesalahan Pemeriksaan Proksi", description: result.error, duration: 5000 });
      } else if (result.error) { // Other errors during check
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
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="method"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><ArrowRightLeft className="mr-2 h-4 w-4" />Metode HTTP</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isAnyOperationActive}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih metode HTTP" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {HTTP_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="headers"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><ListPlus className="mr-2 h-4 w-4" />Header Kustom (Opsional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Content-Type: application/json&#x0a;Authorization: Bearer token&#x0a;User-Agent: MyCustomAgent/1.0"
                  className="resize-y"
                  {...field}
                  disabled={isAnyOperationActive}
                />
              </FormControl>
              <FormDescription>
                Masukkan satu header per baris (Kunci: Nilai). Untuk target yang dilindungi (misalnya oleh Cloudflare), pertimbangkan untuk menggunakan header browser yang realistis (misalnya, User-Agent, Accept-Language, Sec-CH-UA) dan gunakan proxy berkualitas tinggi. Jika User-Agent tidak ditentukan, agen pengguna acak akan dipilih dari daftar internal.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {METHODS_WITH_BODY.includes(selectedMethod) && (
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4" />Isi Permintaan (Opsional untuk {selectedMethod})</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='{"kunci": "nilai"}'
                    className="resize-y"
                    {...field}
                    disabled={isAnyOperationActive}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        <div className="space-y-2">
            <FormLabel className="flex items-center"><Globe className="mr-2 h-4 w-4 text-primary" />URL API Proksi (Opsional - Untuk Pembaruan Dinamis)</FormLabel>
            <Input
                placeholder="https://api.proxyscrape.com/v2/?request=getproxies..."
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
                  placeholder="user:pass@host1.com:port&#x0a;123.45.67.89:8080&#x0a;proxy.example.com:3128"
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
                  max={500}
                  step={1}
                  onValueChange={(vals) => onChange(vals[0])}
                  disabled={isAnyOperationActive}
                  aria-label="Permintaan Bersamaan"
                  {...restField}
                />
              </FormControl>
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
                  max={500}
                  step={1}
                  onValueChange={(vals) => onChange(vals[0])}
                  disabled={isAnyOperationActive}
                  aria-label="Tingkat Permintaan"
                  {...restField}
                />
              </FormControl>
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
            error={currentError || (stats?.error ?? null)}
            attackDuration={currentAttackDuration}
          />
        </div>
      )}
    </Form>
  );
}
