
import { RequestCannonForm } from '@/components/request-cannon/request-cannon-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Rocket } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-background">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Rocket className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline text-primary">Request Cannon</CardTitle>
          <CardDescription className="text-muted-foreground">
            Configure and launch Layer 4 (TCP/UDP) & Layer 7 (HTTP) flood attacks. Use responsibly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequestCannonForm />
        </CardContent>
      </Card>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Request Cannon. For educational purposes only.</p>
      </footer>
    </main>
  );
}
