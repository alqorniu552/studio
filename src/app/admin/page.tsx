import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getUsers } from '@/lib/auth-actions';
import { Shield, Users, UserPlus } from 'lucide-react';
import { AddUserForm } from './_components/add-user-form';

export default async function AdminDashboardPage() {
  const users = await getUsers();

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline text-primary flex items-center">
          <Shield className="mr-3 h-8 w-8" />
          Panel Administratif
        </h1>
      </div>
      <p className="text-muted-foreground">
        Kelola pengguna dan pengaturan sistem dari dasbor ini.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <UserPlus className="mr-2 h-5 w-5" />
                Tambah Pengguna Baru
              </CardTitle>
              <CardDescription>
                Buat akun pengguna baru untuk sistem.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AddUserForm />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
           <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Daftar Pengguna
                </CardTitle>
                 <CardDescription>
                  Menampilkan semua pengguna yang terdaftar dalam sistem.
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Tanggal Dibuat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.length > 0 ? users.map(user => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{new Date(user.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground">
                            Belum ada pengguna yang terdaftar.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
