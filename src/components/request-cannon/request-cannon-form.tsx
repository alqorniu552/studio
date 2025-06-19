
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
import { startFloodAttack, type FloodStats } from "@/app/actions";
import { ProgressDisplay } from "./progress-display";
import { Target, Users, Zap, PlayCircle, StopCircle, ArrowRightLeft, ListPlus, FileText } from "lucide-react";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;

const formSchema = z.object({
  targetUrl: z.string().url({ message: "Please enter a valid URL (e.g., http://example.com or https://example.com)." }),
  method: z.enum(HTTP_METHODS).default("GET"),
  headers: z.string().optional(),
  body: z.string().optional(),
  concurrency: z.coerce.number().int().min(1, "Min 1").max(100, "Max 100").default(10),
  rate: z.coerce.number().int().min(1, "Min 1").max(100, "Max 100").default(10),
});

type FormValues = z.infer<typeof formSchema>;

const METHODS_WITH_BODY: readonly string[] = ["POST", "PUT", "PATCH"];

export function RequestCannonForm() {
  const [isFlooding, setIsFlooding] = useState(false);
  const [stats, setStats] = useState<FloodStats | null>(null);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetUrl: "",
      method: "GET",
      headers: "",
      body: "",
      concurrency: 10,
      rate: 10,
    },
  });

  const selectedMethod = form.watch("method");

  const onSubmit = (values: FormValues) => {
    // This part of the logic for stopping is client-side only.
    // The server-side attack runs for a fixed duration.
    if (isFlooding && isPending) { 
      // User clicked "Stop Attack" while it was running (but button is disabled during isPending)
      // This branch is unlikely to be hit if button is disabled by isPending
      toast({ title: "Flood Stop Requested", description: "The attack will complete its current duration on the server." });
      // setIsFlooding(false); // Let the finally block of startTransition handle this
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
          values.rate
        );
        setStats(result);
        if (result.error) {
          setCurrentError(result.error);
          toast({ variant: "destructive", title: "Flood Error", description: result.error });
        } else {
          toast({ title: "Flood Completed", description: `Sent ${result.totalSent} requests. Successful: ${result.successful}, Failed: ${result.failed}.` });
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

  const isAttackRunning = isPending; // isPending is true while the server action is executing

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
                  max={100}
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
                  max={100}
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
        
        <Button 
          type="submit" 
          className="w-full" 
          disabled={isAttackRunning} // Button is disabled while attack is running
          variant={isAttackRunning ? "destructive" : "default"}
        >
          {isAttackRunning ? <StopCircle className="mr-2 h-4 w-4 animate-pulse" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          {isAttackRunning ? "Attack in Progress..." : "Start Attack"}
        </Button>
      </form>

      {(isFlooding || isPending || stats || currentError) && ( // Show progress if transitioning, or if there are stats/errors
        <div className="mt-8">
          <ProgressDisplay
            isLoading={isPending} //isLoading should primarily depend on isPending
            stats={stats}
            error={currentError} // This will be result.error if server action returns an error
          />
        </div>
      )}
    </Form>
  );
}

