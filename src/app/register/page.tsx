"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, isFirebaseClientConfigured } from "@/lib/firebase";
import { createSessionCookie } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { UserPlus, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isFirebaseClientConfigured) {
    return (
        <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-background">
            <Card className="w-full max-w-md shadow-2xl">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl flex items-center justify-center"><AlertCircle className="mr-2 text-destructive"/>Kesalahan Konfigurasi</CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Konfigurasi Firebase Klien Hilang</AlertTitle>
                        <AlertDescription>
                            Aplikasi tidak dapat terhubung ke Firebase karena kredensial klien (client-side) tidak diatur.
                            <br/><br/>
                            Silakan periksa apakah file <strong>.env.local</strong> Anda ada dan berisi semua variabel <strong>NEXT_PUBLIC_FIREBASE_*</strong> yang diperlukan seperti yang dijelaskan dalam file README.md.
                        </AlertDescription>
                    </Alert>
                </CardContent>
                 <CardFooter className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                        Sudah punya akun?{" "}
                        <Link href="/login" className="underline text-primary">
                            Login di sini
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </main>
    );
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth!, email, password);
      const idToken = await userCredential.user.getIdToken();

      const result = await createSessionCookie(idToken);
      if(result.success) {
        toast({
          title: "Pendaftaran Berhasil",
          description: "Anda sekarang akan diarahkan ke halaman utama.",
        });
        router.push("/");
      } else {
        // This handles server-side session creation errors, including config issues.
        toast({
          variant: "destructive",
          title: "Pendaftaran Gagal",
          description: result.error || "Berhasil mendaftar, tetapi gagal membuat sesi server.",
        });
      }
    } catch (error: any) {
      // This catches client-side errors like email already in use.
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
               <p className="text-sm text-muted-foreground">
                Minimal 6 karakter.
              </p>
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
