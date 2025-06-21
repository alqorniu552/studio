
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { Users, Shield } from 'lucide-react';

// Define a simple user type for this page
const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});
type UserForAdmin = z.infer<typeof UserSchema>;

async function getUsersForAdmin(): Promise<UserForAdmin[]> {
  const dbPath = path.join(process.cwd(), 'data', 'users.json');
  try {
    const data = await fs.readFile(dbPath, 'utf-8');
    const users = JSON.parse(data);
    // Validate and select only the fields we need, ignoring passwordHash
    return z.array(UserSchema.pick({ id: true, email: true })).parse(users);
  } catch (error) {
    console.error("Gagal membaca pengguna untuk panel admin:", error);
    // Return empty array on failure so the page doesn't crash
    return [];
  }
}

export default async function AdminDashboardPage() {
  const users = await getUsersForAdmin();
  const totalUsers = users.length;

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline text-primary flex items-center">
          <Shield className="mr-3 h-8 w-8" />
          Manajemen Pengguna
        </h1>
      </div>
      <p className="text-muted-foreground">
        Halaman ini untuk tugas-tugas administratif. Saat ini, halaman ini menampilkan semua pengguna yang terdaftar di sistem.
      </p>

      <div className="grid grid-cols-1 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5"/>
              Daftar Pengguna ({totalUsers})
            </CardTitle>
            <CardDescription>
              Berikut adalah semua akun yang telah terdaftar di aplikasi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">ID Pengguna</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-xs">{user.id}</TableCell>
                      <TableCell className="font-medium">{user.email}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center p-8 text-muted-foreground">
                      Tidak dapat memuat data pengguna atau tidak ada pengguna yang terdaftar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
