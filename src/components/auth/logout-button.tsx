
'use client';

import { useTransition } from 'react';
import { adminLogout } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await adminLogout();
    });
  };

  return (
    <Button 
      variant="destructive"
      onClick={handleClick}
      disabled={isPending}
    >
      <LogOut className="mr-2 h-4 w-4" />
      {isPending ? 'Keluar...' : 'Logout'}
    </Button>
  );
}
