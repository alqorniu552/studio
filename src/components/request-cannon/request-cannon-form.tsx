
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

const proxyEntryRegex = /^(([^:]+:[^@]+@)?([a-zA-Z0-9.-]+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}))(:[0-9]{1,5})$/;

const formSchema = z.object({
  targetUrl: z.string().url({ message: "Please enter a valid URL (e.g., http://example.com or https://example.com)." }),
  method: z.enum(HTTP_METHODS).default("GET"),
  headers: z.string().optional(),
  body: z.string().optional(),
  proxies: z.string().optional().refine(val => {
    if (!val || val.trim() === "") return true;
    return val.split('\n').filter(line => line.trim() !== "").every(line => {
        return proxyEntryRegex.test(line.trim());
    });
  }, { message: "One or more proxy entries are not in the recognized format (e.g., host:port, IP:PORT, or user:pass@host:port). Do not include http:// or https://." }),
  concurrency: z.coerce.number().int().min(1, "Min 1").max(500, "Max 500").default(50),
  rate: z.coerce.number().int().min(1, "Min 1").max(500, "Max 500").default(50),
  duration: z.coerce.number().int().min(5, "Min 5s").max(60, "Max 60s").default(10),
});

type FormValues = z.infer<typeof formSchema>;

const METHODS_WITH_BODY: readonly string[] = ["POST", "PUT", "PATCH"];

export function RequestCannonForm() {
  const [isFlooding, setIsFlooding] = useState(false); // Used to control overall UI disable state for attack
  const [stats, setStats] = useState<FloodStats | null>(null);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition(); // Specific to the server action transition
  const { toast } = useToast();

  const [proxyApiUrl, setProxyApiUrl] = useState<string>("https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt");
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
    // Note: isFlooding state is set true immediately, isPending becomes true when startTransition starts.
    // We primarily use isPending to reflect the server action's busy state.
    if (isFlooding && isPending) {
      toast({ title: "Flood Stop Requested", description: "The attack will complete its current duration on the server." });
      // Potentially, one might implement a server-side cancellation token here if the backend supports it.
      // For now, we let the current server action complete.
      return;
    }

    setIsFlooding(true); // Disable form fields immediately
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
        setStats({ totalSent: 0, successful: 0, failed: 0, error: errorMessage }); // Ensure stats reflects error
        toast({ variant: "destructive", title: "Failed to Start Flood", description: errorMessage });
      } finally {
         setIsFlooding(false); // Re-enable form fields once server action is done
         setCurrentAttackDuration(null); // Clear duration after attack finishes or fails
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
        toast({ title: "Proxies Fetched", description: "Proxy list populated. Ensure they are in host:port format and consider checking them." });
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

  const handleCheckProxies = async () => {
    const proxiesToTest = form.getValues("proxies");
    if (!proxiesToTest || !proxiesToTest.trim()) {
      toast({ variant: "destructive", title: "No Proxies", description: "Proxy list is empty. Nothing to check." });
      return;
    }
    setIsCheckingProxies(true);
    setCurrentError(null);
    toast({ title: "Checking Proxies", description: "This may take a moment depending on the number of proxies..." });
    try {
      const result = await checkProxies(proxiesToTest);
      if (result.error && result.totalChecked === 0) { 
         toast({ variant: "destructive", title: "Proxy Check Error", description: result.error, duration: 5000 });
      } else if (result.error) {
        toast({ variant: "destructive", title: "Proxy Check Error", description: result.error, duration: 5000 });
      }else {
        form.setValue("proxies", result.liveProxiesString, { shouldValidate: true });
        toast({
          title: "Proxy Check Completed",
          description: `Checked ${result.totalChecked} proxies. Found ${result.liveCount} live. ${result.deadCount} were unresponsive or invalid and have been removed. Proxy list updated.`,
          duration: 7000,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during proxy check.";
      toast({ variant: "destructive", title: "Error Checking Proxies", description: errorMessage, duration: 5000 });
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
              <FormLabel className="flex items-center"><Target className="mr-2 h-4 w-4" />Target URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com" {...field} disabled={isAnyOperationActive} />
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
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isAnyOperationActive}>
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
                  disabled={isAnyOperationActive}
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
                    disabled={isAnyOperationActive}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        <div className="space-y-2">
            <FormLabel className="flex items-center"><Globe className="mr-2 h-4 w-4 text-primary" />Proxy API URL</FormLabel>
            <Input
                placeholder="Enter proxy list API URL"
                value={proxyApiUrl}
                onChange={(e) => setProxyApiUrl(e.target.value)}
                disabled={isAnyOperationActive}
                className="flex-grow"
                aria-label="Proxy API URL"
            />
            <FormDescription>
            Enter a URL that returns a plain text list of proxies (one per line, e.g. IP:PORT).
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
                  placeholder="user:pass@host1.com:port\n123.45.67.89:8080\nproxy.example.com:3128"
                  className="resize-y h-24"
                  {...field}
                  disabled={isAnyOperationActive}
                  aria-label="Proxy List"
                />
              </FormControl>
              <FormDescription>
                Enter one proxy per line (e.g., myproxy.com:8080, 1.2.3.4:8888, or user:pass@proxy.example.com:3128). Do not include http:// or https://.
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
                Fetch Proxies
            </Button>
            <Button
                type="button"
                onClick={handleCheckProxies}
                disabled={isAnyOperationActive || !currentProxies?.trim()}
                variant="outline"
                className="w-full sm:flex-1"
            >
                {isCheckingProxies ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-4 w-4" />}
                Check Proxies
            </Button>
        </div>


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
                  disabled={isAnyOperationActive}
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
                  disabled={isAnyOperationActive}
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
                  disabled={isAnyOperationActive}
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
          disabled={isAnyOperationActive}
          variant={isPending ? "destructive" : "default"} // Use isPending for attack button visual state
        >
          {isPending ? <StopCircle className="mr-2 h-4 w-4 animate-pulse" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          {isPending ? "Attack in Progress..." : "Start Attack"}
        </Button>
      </form>

      {(isPending || stats || currentError) && ( // Show ProgressDisplay if attack is pending, or if there are stats/errors
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
