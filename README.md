
# Flooder L7

Ini adalah aplikasi Next.js yang berfungsi sebagai alat untuk melakukan serangan banjir HTTP (Layer 7). Aplikasi ini dirancang untuk menguji ketahanan server dan infrastruktur jaringan terhadap beban permintaan yang tinggi.

## Fitur Utama

-   **Konfigurasi Serangan Fleksibel**: Atur URL target, metode HTTP, header kustom, dan isi permintaan.
-   **Kontrol Beban**: Sesuaikan jumlah permintaan bersamaan (konkurensi) dan tingkat permintaan per detik (RPS).
-   **Dukungan Proksi Dinamis**: Gunakan proksi dari daftar statis atau perbarui secara dinamis dari URL API selama serangan berlangsung.
-   **Pemeriksa Proksi**: Verifikasi proksi yang aktif sebelum digunakan.
-   **Dasbor Pengguna & Admin**: Pantau riwayat serangan, kelola serangan otomatis periodik, dan lihat status sistem.
-   **Laporan Real-time**: Dapatkan umpan balik visual tentang status serangan, termasuk rincian kode respons.
-   **Otentikasi Admin**: Panel administrator dilindungi oleh sistem login khusus.

---

## Panduan Deployment ke VPS atau Hosting Lain

Aplikasi ini dibangun dengan Next.js dan dapat di-deploy di server Node.js mana pun (seperti VPS dari DigitalOcean, Vultr, AWS, dll.).

### Prasyarat

-   **Node.js** (versi 18.x atau lebih baru direkomendasikan)
-   **npm** (biasanya terinstal bersama Node.js)
-   `git` (untuk mengkloning repositori)

### Konfigurasi Lingkungan

Sebelum menjalankan aplikasi, Anda harus membuat file `.env.local` di direktori utama (root) proyek dan mengisinya dengan kredensial yang diperlukan.

```bash
# Salin contoh ke file .env.local
cp .env.example .env.local
```

Kemudian, edit file `.env.local` dan ganti nilainya:

```
# Kredensial untuk login ke panel /admin.
# Ganti dengan nilai yang kuat dan aman untuk produksi.
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your-strong-password"

# Kunci rahasia untuk menandatangani sesi (JWT).
# Untuk produksi, buat kunci yang sangat aman dengan menjalankan perintah berikut di terminal Anda:
# openssl rand -base64 32
JWT_SECRET="your-super-secret-jwt-key-generated-from-openssl"
```

### Langkah-langkah Deployment

1.  **Hubungkan ke Server Anda**
    Gunakan SSH untuk masuk ke VPS Anda.
    ```bash
    ssh username@alamat_ip_vps_anda
    ```

2.  **Kloning Repositori (atau Salin File)**
    Kloning kode aplikasi dari repositori Git Anda atau salin file proyek ke server Anda.
    ```bash
    git clone <URL_REPOSITORI_ANDA>
    cd <nama-direktori-proyek>
    ```

3.  **Instal Dependensi**
    Instal semua paket yang diperlukan oleh aplikasi.
    ```bash
    npm install
    ```

4.  **Bangun Aplikasi untuk Produksi (Build)**
    Buat versi produksi yang telah dioptimalkan dari aplikasi Anda.
    ```bash
    npm run build
    ```
    Perintah ini akan membuat direktori `.next` yang berisi build produksi.

### Menjalankan Aplikasi di Produksi (Sangat Direkomendasikan)

Untuk menjalankan aplikasi Next.js di lingkungan produksi, sangat disarankan untuk menggunakan manajer proses seperti **PM2**. PM2 akan menjaga aplikasi Anda tetap berjalan, me-restart secara otomatis jika terjadi *crash*, dan memungkinkan Anda memanfaatkan semua inti CPU (mode cluster) untuk performa maksimal.

1.  **Instal PM2 Secara Global**
    Jika Anda belum memiliki PM2, instal di server Anda.
    ```bash
    npm install pm2 -g
    ```

2.  **Jalankan Aplikasi dengan PM2**
    Mulai aplikasi menggunakan PM2 dalam **mode cluster**. Ini akan secara otomatis membuat proses untuk setiap inti CPU yang tersedia di VPS Anda, memaksimalkan performa dan stabilitas.
    ```bash
    pm2 start npm --name "flooder-l7" -- run start -- -i max
    ```
    -   `--name "flooder-l7"`: Memberi nama pada proses Anda agar mudah dikelola.
    -   `-- run start`: Menjalankan skrip `start` dari `package.json`.
    -   `-i max`: (atau `--instances max`) Memberi tahu PM2 untuk menjalankan aplikasi dalam mode cluster menggunakan semua inti CPU yang tersedia.

3.  **Simpan Konfigurasi PM2**
    Agar PM2 secara otomatis memulai ulang aplikasi Anda setelah server reboot, jalankan perintah berikut:
    ```bash
    pm2 save
    pm2 startup
    ```
    PM2 akan memberikan perintah yang perlu Anda salin dan jalankan untuk menyelesaikan pengaturan startup.

Aplikasi Anda sekarang berjalan di latar belakang, biasanya di port `3000`. Anda dapat memeriksa statusnya dengan `pm2 list` atau melihat log dengan `pm2 logs flooder-l7`.
