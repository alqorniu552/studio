
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
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
  targetUrl: z.string().url({ message: "Please enter a valid URL." }),
  method: z.enum(HTTP_METHODS).default("GET"),
  headers: z.string().optional(),
  body: z.string().optional(),
  concurrency: z.coerce.number().int().min(1, "Min 1").max(100, "Max 100"),
  rate: z.coerce.number().int().min(1, "Min 1").max(100, "Max 100"),
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
    if (isFlooding) {
      setIsFlooding(false);
      toast({ title: "Flood Stoped", description: "The attack has been requested to stop." });
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
          toast({ title: "Flood Completed", description: `Sent ${result.totalSent} requests.` });
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
                <Input placeholder="https://example.com" {...field} disabled={isFlooding || isPending} />
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
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isFlooding || isPending}>
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
                  disabled={isFlooding || isPending}
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
                <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4" />Request Body (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='{"key": "value"}'
                    className="resize-y"
                    {...field}
                    disabled={isFlooding || isPending}
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
                  disabled={isFlooding || isPending}
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
                  disabled={isFlooding || isPending}
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
          disabled={isPending}
          variant={isFlooding || isPending ? "destructive" : "default"}
        >
          {isFlooding || isPending ? <StopCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          {isFlooding || isPending ? "Stop Attack" : "Start Attack"}
        </Button>
      </form>

      {(isFlooding || isPending || stats || currentError) && (
        <div className="mt-8">
          <ProgressDisplay
            isLoading={isFlooding || isPending}
            stats={stats}
            error={currentError}
          />
        </div>
      )}
    </Form>
  );
}
