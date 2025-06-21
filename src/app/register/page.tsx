"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createSessionCookie } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { UserPlus } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      const result = await createSessionCookie(idToken);
      if(result.success) {
        toast({
          title: "Pendaftaran Berhasil",
          description: "Anda sekarang akan diarahkan ke halaman utama.",
        });
        router.push("/");
      } else {
        throw new Error("Gagal membuat sesi.");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Pendaftaran Gagal",
        description: error.message?.replace('Firebase: ', '') || "Terjadi kesalahan. Silakan coba lagi.",
      });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-background">
      <Card className="w-full max-w-sm shadow-2xl">
        <form onSubmit={handleRegister}>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center"><UserPlus className="mr-2"/> Daftar Akun Baru</CardTitle>
            <CardDescription>Buat akun baru untuk menggunakan Flooder L7</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
               <FormDescription>
                Minimal 6 karakter.
              </FormDescription>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Memproses..." : "Daftar"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Sudah punya akun?{" "}
              <Link href="/login" className="underline text-primary">
                Login di sini
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
