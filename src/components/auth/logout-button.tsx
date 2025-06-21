'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    await signOut();
    toast({ title: 'Logout Berhasil' });
    router.push('/login');
    // We call refresh to ensure server components depending on the session are re-rendered.
    router.refresh(); 
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleLogout} disabled={isLoading} aria-label="Logout">
      {isLoading ? (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
      ) : (
        <LogOut className="h-5 w-5" />
      )}
    </Button>
  );
}
