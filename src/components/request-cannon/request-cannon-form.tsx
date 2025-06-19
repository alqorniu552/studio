"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useState, useTransition } from "react";
import { startFloodAttack, type FloodStats } from "@/app/actions";
import { ProgressDisplay } from "./progress-display";
import { Target, Users, Zap, PlayCircle, StopCircle } from "lucide-react";

const formSchema = z.object({
  targetUrl: z.string().url({ message: "Please enter a valid URL." }),
  concurrency: z.coerce.number().int().min(1, "Min 1").max(100, "Max 100"),
  rate: z.coerce.number().int().min(1, "Min 1").max(100, "Max 100"),
});

type FormValues = z.infer<typeof formSchema>;

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
      concurrency: 10,
      rate: 10,
    },
  });

  const onSubmit = (values: FormValues) => {
    if (isFlooding) { // Handle Stop
      setIsFlooding(false);
      // Actual stop logic for server action is complex, this primarily resets UI
      // and prevents further client-side actions if any were iterative.
      // Server action will run to its fixed duration.
      toast({ title: "Flood Stoped", description: "The attack has been requested to stop." });
      // Reset stats here or keep them from the last completed run
      // setStats(null); // Optional: clear stats on stop
      // setCurrentError(null);
      return;
    }

    setIsFlooding(true);
    setStats(null);
    setCurrentError(null);

    startTransition(async () => {
      try {
        // Duration is fixed server-side for this demo (e.g., 10 seconds)
        const result = await startFloodAttack(values.targetUrl, values.concurrency, values.rate);
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
        // Only set isFlooding to false if it wasn't manually stopped
        // For this version, the server action has a fixed duration, so it auto-stops.
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
          variant={isFlooding ? "destructive" : "default"}
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
