# ⚡ YURIPAY by myzert

<p align="center">
  <img src="https://raw.githubusercontent.com/myzert/yuripay/main/public/images/thank-you.webp" alt="YuriPay Banner" width="160" style="border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.15);" />
</p>

<p align="center">
  <strong>Enterprise Self-Hosted Dynamic QRIS Payment Gateway for GoBiz Merchants</strong><br>
  <em>Stateful High-Performance • Dual-Port Isolation • Midtrans SHA-512 Webhook • Idempotent • OpenAPI 3.0</em>
</p>

<p align="center">
  <a href="https://github.com/myzert/YURIPAY-GOPAY"><img src="https://img.shields.io/badge/YURIPAY-by%20myzert-0284c7?style=for-the-badge&logo=shield" alt="YuriPay by myzert" /></a>
  <a href="https://github.com/myzert/YURIPAY-GOPAY/stargazers"><img src="https://img.shields.io/github/stars/myzert/YURIPAY-GOPAY?style=for-the-badge&logo=github&color=0284c7" alt="GitHub Stars" /></a>
  <a href="https://github.com/myzert/YURIPAY-GOPAY/network/members"><img src="https://img.shields.io/github/forks/myzert/YURIPAY-GOPAY?style=for-the-badge&logo=github&color=38bdf8" alt="GitHub Forks" /></a>
  <img src="https://img.shields.io/badge/QRIS-Bank%20Indonesia%20Standard-red?style=for-the-badge" alt="QRIS Standard" />
  <img src="https://img.shields.io/badge/Runtime-Stateful%20Only%20(VPS%20%7C%20cPanel%20%7C%20Docker)-success?style=for-the-badge" alt="Stateful Only" />
  <img src="https://img.shields.io/badge/Serverless-STRICTLY%20UNSUPPORTED-critical?style=for-the-badge" alt="No Serverless" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-ISC-blue?style=for-the-badge" alt="ISC License" /></a>
</p>

<p align="center">
  🌐 <strong>Dokumentasi Interaktif & Live Simulator:</strong><br>
  <a href="https://yuripay.pages.dev/"><strong>https://yuripay.pages.dev/</strong></a> &nbsp;•&nbsp; 
  <a href="https://yuripay.projectt.my.id/"><strong>https://yuripay.projectt.my.id/</strong></a>
</p>

---

## ⚖️ PERNYATAAN PENOLAKAN & KEPATUHAN HUKUM (LEGAL DISCLAIMER)

> [!IMPORTANT]
> **PEMBERITAHUAN RESMI HUKUM:**
> 1. **Proyek Komunitas Mandiri (Unofficial Project)**: **YURIPAY** adalah perangkat lunak sumber terbuka (*open source*) independen yang dikembangkan oleh **myzert** untuk tujuan penelitian, edukasi, dan integrasi kasir mandiri (*self-hosted gateway*). Perangkat lunak ini **TIDAK berafiliasi, didukung, disponsori, atau disetujui secara resmi oleh PT GoTo Gojek Tokopedia Tbk (Gojek / GoPay / GoBiz), Bank Indonesia, maupun Asosiasi Sistem Pembayaran Indonesia (ASPI)**.
> 2. **Kepatuhan Pedagang (Merchant Compliance)**: Seluruh penggunaan API GoBiz dan pemrosesan dana operasional adalah tanggung jawab mutlak masing-masing pedagang (*merchant*) pemilik akun. Pengguna wajib mematuhi Syarat & Ketentuan Layanan GoBiz dan peraturan Bank Indonesia mengenai transaksi pembayaran QRIS (PADG No. 21/18/PADG/2019).
> 3. **Tanpa Jaminan (No Warranty)**: Perangkat lunak ini disediakan di bawah lisensi terbuka [ISC License](LICENSE) "sebagaimana adanya" (*as-is*) tanpa jaminan dalam bentuk apa pun, dan penulis dibebaskan dari segala bentuk tuntutan ganti rugi atau liabilitas operasional.

---

## 📑 Daftar Isi
1. [Ikhtisar Arsitektur](#-ikhtisar-arsitektur)
2. [⚠️ MENGAPA YURIPAY TIDAK BISA DI-DEPLOY DI VERCEL / SERVERLESS?](#-mengapa-yuripay-tidak-bisa-di-deploy-di-vercel--serverless)
3. [Fitur Utama Enterprise](#-fitur-utama-enterprise)
4. [Arsitektur Keamanan Dual-Port](#-arsitektur-keamanan-dual-port)
5. [Bedah Kode & Arsitektur File (Code Deep Dive)](#-bedah-kode--arsitektur-file-code-deep-dive)
6. [Otentikasi Akun GoBiz Merchant](#-otentikasi-akun-gobiz-merchant)
7. [Panduan Deployment Produksi (VPS, cPanel, Docker, Termux)](#-panduan-deployment-produksi)
8. [Kustomisasi Logo & Identitas Merchant](#-kustomisasi-logo--identitas-merchant)
9. [Konfigurasi Environment (.env)](#-konfigurasi-environment-env)
10. [Spesifikasi API & Integrasi Midtrans](#-spesifikasi-api--integrasi-midtrans)
11. [Dokumentasi Swagger UI](#-dokumentasi-swagger-ui)
12. [⭐ Dukung YuriPay & Star di GitHub](#-dukung-yuripay--star-di-github)
13. [🤝 Tim Pengembang & Kontributor](#-tim-pengembang--kontributor)
14. [💖 Donasi & Dukungan Pengembang](#-donasi--dukungan-pengembang)
15. [Pertanyaan Umum (FAQ)](#-pertanyaan-umum-faq)
16. [Lisensi & Hak Cipta](#-lisensi--hak-cipta)

---

## 🏛️ Ikhtisar Arsitektur

**YURIPAY by myzert** menjembatani akun merchant **GoBiz** reguler menjadi payment gateway QRIS dinamis mandiri (*on-premise / self-hosted*) yang mampu memproses tagihan secara otomatis dalam hitungan detik tanpa potongan gateway pihak ketiga (0% gateway fee).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ALUR TRANSAKSI YURIPAY                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘

  [ Pelanggan Toko ]                                            [ Merchant Server / Store ]
          │                                                                  │
          │ 1. Buat Tagihan (POST /api/create-payment)                       │
          │◄─────────────────────────────────────────────────────────────────┤
          │                                                                  │
          ▼                                                                  │
  [ Halaman Checkout (/pay/:id) ]                                            │
  • QRIS Dinamis Otomatis                                                    │
  • Nominal Unik (+1 Perak)                                                  │
  • Mode: Default Chime / Anime                                              │
          │                                                                  │
          │ 2. Pembayaran via Bank / E-Wallet (BCA, GoPay, DANA, dll.)        │
          ▼                                                                  │
  [ GoPay / GoBiz Network ]                                                  │
          │                                                                  │
          │ 3. Settlement Masuk ke Rekening GoBiz                            │
          ▼                                                                  │
  [ YuriPay Background Daemon (Port 3000 & 3001) ]                           │
  • Poller Realtime (Setiap 2.5 Detik)                                       │
  • Pencocokan Presisi Nominal Unik & Timestamp                              │
  • Update Status SQLite WAL -> LUNAS • TERVERIFIKASI                        │
          │                                                                  │
          ├─────────────────────────────────────────────────────────────────►│
          │ 4. Webhook HTTP POST (Midtrans SHA-512)                          │
          │                                                                  ▼
          │                                                      [ Pesanan Diproses Toko ]
          │ 5. Auto OP Redirect ke Website Toko                              │
          ▼                                                                  │
  [ Toko Selesai (https://tokosaya.com/finish?order_id=...&status_code=200) ]│
```

---

## ⚠️ MENGAPA YURIPAY TIDAK BISA DI-DEPLOY DI VERCEL / SERVERLESS?

> [!CAUTION]
> **YuriPay dirancang secara fundamental sebagai DAEMON STATEFUL. YuriPay TIDAK DAPAT BERJALAN di Vercel, Netlify, Cloudflare Workers, AWS Lambda, atau platform Serverless sejenis.**

Secara arsitektur perangkat lunak, sistem gateway membutuhkan empat pilar runtime yang tidak dimiliki lingkungan serverless:

| Kebutuhan Sistem YuriPay | ❌ Platform Serverless (Vercel / Lambda) | ✔️ Lingkungan Stateful (VPS / cPanel / Docker / Termux) |
| :--- | :--- | :--- |
| **Realtime Daemon Poller** | **Container dibekukan (*frozen*)** seketika setelah respons HTTP selesai dikirim. Event loop berhenti total dan mutasi tidak akan pernah terverifikasi. | **Node.js Process berjalan 24/7**, memverifikasi mutasi GoPay setiap 2.5 detik secara non-blocking. |
| **Penyimpanan SQLite WAL** | Filesystem bersifat **read-only dan sementara (*ephemeral*)**. Database terhapus otomatis saat instance mati (*scale-to-zero*). | Database SQLite tersimpan permanen pada disk POSIX dengan konkurensi tinggi (**Write-Ahead Logging**). |
| **Arsitektur Dual-Port** | Hanya mendukung single-port HTTP router standar. | Membuka dua socket port terisolasi secara simultan (**Port 3000** Internal & **Port 3001** Publik). |
| **In-Memory Mutex Lock** | Instance serverless di-spawn secara acak (multi-instans tanpa sinkronisasi memori), menyebabkan tabrakan kode unik. | Menjaga memori sesi aktif terpusat, menjamin offset +1 perak tidak bertabrakan antar pelanggan. |

**Platform Deployment yang Didukung Penuh:**
- **Linux VPS**: Ubuntu 20.04 / 22.04 / 24.04 LTS, Debian 11 / 12, AlmaLinux, Rocky Linux.
- **cPanel Web Hosting**: Menggunakan fitur **Setup Node.js App** (CloudLinux / Phusion Passenger).
- **Docker & Docker Compose**: Container mandiri dengan persistensi volume POSIX.
- **Termux di Android**: Server mandiri hemat energi pada smartphone Android fisik 24/7.

---

## 💎 Fitur Utama Enterprise

### 1. 🧮 Algoritma Offset Kode Unik Presisi (+1 Perak)
- **Pembelian Mikro (Rp 50 s/d < Rp 1.000)**: Dikenakan offset tetap **+Rp 1 perak** (contoh: Rp 50 &rarr; Rp 51, Rp 500 &rarr; Rp 501, Rp 75 &rarr; Rp 76) agar sangat hemat dan tepat.
- **Pembelian Standar (Rp 1.000 ke atas)**: Offset dinamis acak antara **1 s/d 199 perak** (**maksimal tidak lebih dari 200 perak**).
- **Anti-Tabrakan Otomatis (*Collision Prevention*)**: Apabila ada transaksi gantung pada nominal yang sama, sistem secara cerdas menggeser offset (+2, +3, dst.) sehingga mutasi transfer tidak akan pernah tertukar antar pembeli.

### 2. 🎭 Dual Success Celebration Theme (Default & Anime)
Merchant dan pelanggan dapat memilih gaya perayaan pembayaran sesuai kebutuhan bisnis:
- **Mode Default (Corporate Fintech)**:
  - Tampilan struk formal profesional bergaya Stripe / Apple Pay.
  - Efek audio *Fintech Chime* elegan yang disintesis secara murni via **Web Audio API** (tanpa ketergantungan file eksternal, latensi nol).
  - Konfeti perayaan halus tanpa pop-up karakter.
- **Mode Anime (Playful Store)**:
  - Pop-up modal karakter Marin Kitagawa dengan animasi selebrasi.
  - Efek audio selebrasi *"Cute Arigato"*.
  - Konfeti warna-warni dinamis (*Canvas Confetti*).
- **Fleksibilitas Konfigurasi**:
  - Diatur global via `.env` (`DEFAULT_SUCCESS_THEME="anime"` atau `"default"`).
  - Diatur per transaksi via REST API (`success_theme: "default"` atau `"anime"`).
  - Dilengkapi tombol toggle interaktif di bilah navigasi checkout.

### 3. 🖼️ Kustomisasi Logo & Identitas Brand
- Mendukung logo kustom merchant melalui variabel `STORE_LOGO_URL` di file `.env`.
- Jika dikosongkan, YuriPay otomatis menggunakan ikon lencana perisai SVG berkualitas tinggi.
- Terintegrasi penuh pada halaman **Kasir Admin**, **Customer Checkout**, dan **Login Admin**.

### 4. 🛡️ Idempotensi Transaksi Penuh
- Pembeli yang me-refresh browser atau mengalami gangguan koneksi tidak akan membuat tagihan baru.
- Sistem mengikat transaksi berdasarkan `order_id` yang sama, menjaga integritas mutasi GoPay.
- Halaman `/pay/:id` yang sudah berstatus `PAID` akan **tetap berstatus LUNAS** saat dibuka kembali di kemudian hari.

### 5. 🕶️ Stealth Auto-Redirect Port Pembayaran (Anti-Probe & Bot Scanner)
- Demi keamanan operasional dari pemindaian bot, web crawler, atau penyerang otomatis, akses langsung ke root port pembayaran publik (`http://localhost:3001/` atau rute yang tidak dikenal) **otomatis dialihkan (302 Redirect)** ke `https://www.google.com` atau repository GitHub resmi `https://github.com/myzert/YURIPAY-GOPAY`.
- Hanya pelanggan yang memiliki link resmi tagihan (`/pay/YURI-XXXXXX`) yang dapat mengakses halaman checkout.
- URL pengalihan ini dapat dikonfigurasi melalui variabel `PAYMENT_ROOT_REDIRECT_URL` di file `.env`.

### 6. 🚀 Tautan Pengalihan Otomatis (OP Redirect ala Midtrans)
Setelah pembayaran lunas, pelanggan otomatis dialihkan ke `redirect_url` dengan parameter status lengkap:
```
https://tokosaya.com/finish?order_id=INV-9901&status_code=200&transaction_status=settlement&payment_type=qris&gross_amount=10001.00&payment_id=YURI-AB12CD&transaction_id=TX-892182
```

### 7. 🔔 Webhook HTTP POST 100% Identik Midtrans
- Format notifikasi dan kalkulasi signature identik dengan standar Midtrans:
  $$\text{signature\_key} = \text{SHA512}(\text{order\_id} + \text{status\_code} + \text{gross\_amount} + \text{ServerKey})$$
- Kompatibel langsung dengan modul penerima notifikasi Midtrans pada berbagai framework web (Laravel, Express, Django, Spring Boot, FastAPI, WordPress/WooCommerce).
- Dilengkapi sistem **exponential retry** hingga 3 kali percobaan dan tabel log pengiriman di SQLite.

---

## 🏰 Arsitektur Keamanan Dual-Port

YuriPay memisahkan lalu lintas jaringan menjadi dua zona keamanan terisolasi:

```
                            ┌────────────────────────┐
                            │    LALU LINTAS WEB     │
                            └───────────┬────────────┘
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             │                                                     │
     [PORT 3000] INTERNAL                                  [PORT 3001] PUBLIK
┌────────────────────────────┐                        ┌────────────────────────────┐
│ 📊 Dashboard Kasir & Admin │                        │ 💳 Customer Checkout       │
│ 🔐 Login Email & Password  │                        │ 🌐 Public Create Payment   │
│ 📜 Log Mutasi GoBiz        │                        │ ⚡ Public Status Poller    │
│ 📖 Swagger UI Docs         │                        │ 🚫 Zero Access ke Token    │
│ 🛠️ Webhook Inspector       │                        │ 🚫 Tanpa Middleware Sesi   │
└────────────────────────────┘                        └────────────────────────────┘
```

- **Port 3000 (Internal & Admin Management)**:
  - Dilindungi middleware sesi admin (`express-session` dengan proteksi cookie `httpOnly` dan `sameSite: lax`).
  - Menampilkan dashboard analitik transaksi, saldo, mutasi terkini, dan konfigurasi sistem.
  - Akses Swagger UI & OpenAPI Specification.
- **Port 3001 (Public Checkout)**:
  - Port publik yang diekspos ke internet untuk pelanggan bayar tagihan (`/pay/:id`).
  - Tidak memiliki akses ke kredensial admin maupun file sesi GoBiz.
  - Ringan, stateless di sisi HTTP handler, dilindungi fitur *Stealth Auto-Redirect*.

---

## 🔍 Bedah Kode & Arsitektur File (Code Deep Dive)

Berikut penjelasan mendalam mengenai struktur dan alur kerja setiap berkas dalam repositori **YURIPAY**:

```
yuripay/
├── server.js                      # Dual Express server initializer & router
├── login.js                       # Interactive CLI for GoBiz OTP login
├── .GOPAY_SESI_JANGAN_DIHAPUS.json # Encrypted active GoBiz auth token & cookies
├── package.json                   # Dependencies: better-sqlite3, axios, qrcode, express
├── database/
│   └── yuripay.db                 # SQLite WAL database (transactions & webhook logs)
├── views/                         # EJS templates (checkout, dashboard, login, swagger)
├── public/                        # Static assets (images, sounds, stylesheets)
└── src/
    └── gateway/
        ├── qrisHelper.js          # EMVCo dynamic QR parser & CRC16 calculation
        ├── paymentStore.js        # Transaction model & in-memory mutex store
        ├── gopayClient.js         # GoBiz Analytics API client & mutation matcher
        ├── gopayAuth.js           # OTP challenge & token extractor
        ├── sessionManager.js      # Session lifecycle & auto-refresh daemon
        ├── webhookEngine.js       # Midtrans payload builder & SHA-512 dispatcher
        ├── paymentChecker.js      # Background polling worker daemon
        ├── swaggerDoc.js          # OpenAPI 3.0 specification definition
        └── discordLogger.js       # Discord rich embed notification dispatcher
```

### 1. `server.js` — Inisialisasi Server Dual-Port
- Menginstansiasi dua Express app: `dashboardApp` (port 3000) dan `paymentApp` (port 3001).
- Menyediakan middleware CORS, JSON body parser, dan file statis publik.
- Mengatur session store admin dengan cookie berdurasi 7 hari.
- Menangani rute pembayaran `/pay/:id`, validasi kadaluwarsa transaksi, render invoice, dan redirect stealth di root port publik.

### 2. `src/gateway/qrisHelper.js` — Parser EMVCo & Kalkulasi CRC16
- **`calculateCRC16(payload)`**: Menghitung CRC16-CCITT standar EMVCo dengan nilai inisial `0xFFFF` dan polinomial `0x1021`. Setiap byte di-XOR dan digeser bit demi bit.
- **`generateDynamicQRIS(staticTemplate, amount)`**: Membaca string QRIS statis dari GoBiz, membedah Tag-Length-Value (TLV), mengubah Tag `01` dari `11` (statis) menjadi `12` (dinamis), menyisipkan Tag `54` (nominal tagihan), dan memperbarui Tag `63` (CRC16 4 karakter heksadesimal kapital).
- **`generateUniqueAmount(baseAmount, existingPendingAmounts)`**:
  - Jika nominal < Rp 1.000: Mengatur offset tetap **+Rp 1 perak**. Jika ada tabrakan dengan transaksi pending lain, menaikkan offset (+2, +3, dst. maksimal +5).
  - Jika nominal >= Rp 1.000: Menghasilkan offset acak antara 1 s/d 199 perak (tidak pernah melebihi 200 perak).
- **`generateQRBuffer(text)`**: Mengonversi teks QRIS dinamis menjadi buffer gambar PNG beresolusi tajam dengan margin 2 dan level koreksi 'M'.

### 3. `src/gateway/paymentStore.js` — Manajemen Transaksi & SQLite WAL
- Mengelola tabel `yuripay_payments` pada SQLite dengan mode `WAL` (*Write-Ahead Logging*) untuk performa konkurensi tinggi.
- Memelihara `activePayments` berupa in-memory Map untuk caching status instan tanpa membebani disk I/O.
- Mengikat setiap pesanan dengan `order_id` unik untuk menjamin idempotensi transaksi.
- Memproses perubahan status dari `PENDING` menjadi `PAID` atau `EXPIRED`.
- Memicu eksekusi webhook Midtrans dan Discord logger saat transaksi diverifikasi lunas.

### 4. `src/gateway/gopayClient.js` — Klien GoBiz & Pencocokan Mutasi
- Menghubungkan gateway ke endpoint Gojek Merchant Analytics:
  `https://api.gojekapi.com/merchant-analytics/v2/merchants/transactions`
- Menerapkan rentang pencarian mutasi secara presisi berdasarkan timestamp pembuatan invoice (`startTimeISO` s/d `endTimeISO`).
- Memeriksa kecocokan nominal transfer (baik format nominal murni Rupiah maupun format sen).
- Mencegah *double claim* mutasi dengan mendaftarkan ID mutasi ke dalam cache memori `claimedTransactions`.
- Mendeteksi respon `401 Unauthorized` dan secara otomatis memicu `sessionManager.refreshSession()` untuk memperbarui token tanpa gangguan operasional.

### 5. `src/gateway/sessionManager.js` — Siklus Sesi & Auto-Refresh Token
- Membaca dan menulis kredensial sesi GoBiz secara aman di file `.GOPAY_SESI_JANGAN_DIHAPUS.json`.
- Menyediakan *getter* header otentikasi resmi GoBiz (`Authorization: Bearer <token>`, `X-UniqueId`, `User-Agent`).
- Menjalankan interval pengecekan otomatis setiap 6 jam untuk me-refresh access token sebelum batas kedaluwarsa habis.

### 6. `src/gateway/webhookEngine.js` — Engine Webhook SHA-512 Ala Midtrans
- Membangun payload notifikasi JSON yang 100% identik dengan skema Midtrans (*settlement*, *pending*, *expire*).
- Menghitung kunci tanda tangan digital:
  ```javascript
  const signatureRaw = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const signatureKey = crypto.createHash('sha512').update(signatureRaw).digest('hex');
  ```
- Mengirimkan HTTP POST ke `webhook_url` merchant dengan timeout 7 detik.
- Mengimplementasikan pengulangan otomatis (*exponential retry*) hingga 3 kali jika server merchant mengalami gangguan (5xx / timeout).
- Menyimpan riwayat log pengiriman webhook pada tabel SQLite `webhook_logs` untuk audit Kasir.

### 7. `src/gateway/paymentChecker.js` — Background Poller Daemon
- Berjalan 24/7 di latar belakang sebagai *worker thread* / timer non-blocking.
- Memeriksa seluruh transaksi berstatus `PENDING` dan mencocokkannya ke mutasi GoPay.
- Membatalkan transaksi yang telah melewati batas waktu (`TRANSACTION_TIMEOUT_MINUTES`) dan menandainya sebagai `EXPIRED`.

---

## 📱 Otentikasi Akun GoBiz Merchant

YuriPay menyediakan alat bantu terminal interaktif untuk otentikasi resmi akun GoBiz Anda:

```bash
npm run login
```

1. Jalankan perintah di atas melalui terminal server Anda.
2. Masukkan nomor ponsel yang terdaftar aktif di aplikasi GoBiz / GoFood Merchant (contoh: `085119772671`).
3. Masukkan 4 digit kode OTP yang diterima melalui SMS atau WhatsApp dari Gojek.
4. Sesi token akan diekstraksi dan disimpan secara otomatis ke dalam file terproteksi:
   `📂 .GOPAY_SESI_JANGAN_DIHAPUS.json`
5. YuriPay memiliki sistem **auto-refresh token** yang memperbarui akses token secara berkala sebelum kedaluwarsa tanpa perlu login ulang.

---

## 🚀 Panduan Deployment Produksi

### Metode 1: Deployment di Linux VPS (Ubuntu / Debian) dengan PM2 & Nginx

1. **Pasang Dependensi Sistem**:
   ```bash
   sudo apt update && sudo apt install -y nodejs npm git build-essential sqlite3
   sudo npm install -g pm2
   ```

2. **Kloning Repositori**:
   ```bash
   git clone https://github.com/myzert/YURIPAY-GOPAY.git yuripay
   cd yuripay
   npm install --production
   cp .env.example .env
   ```

3. **Login Akun GoBiz**:
   ```bash
   npm run login
   ```

4. **Jalankan via PM2**:
   ```bash
   pm2 start server.js --name "yuripay"
   pm2 save
   pm2 startup
   ```

5. **Konfigurasi Reverse Proxy Nginx**:
   ```nginx
   # Port 3001 untuk Pembayaran Publik
   server {
       server_name bayar.tokosaya.com;

       location / {
           proxy_pass http://127.0.0.1:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_cache_bypass $http_upgrade;
       }
   }

   # Port 3000 untuk Admin & Kasir (Internal)
   server {
       server_name kasir.tokosaya.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```

---

### Metode 2: Deployment di cPanel Web Hosting (Setup Node.js App)

Banyak merchant menggunakan hosting cPanel dengan fitur CloudLinux Node.js Selector:

1. **Masuk ke cPanel** &rarr; Buka menu **Setup Node.js App**.
2. Klik tombol **Create Application**:
   - **Node.js version**: Pilih versi `18.x`, `20.x`, atau `22.x`.
   - **Application mode**: Pilih `Production`.
   - **Application root**: Isi folder aplikasi (misal: `yuripay`).
   - **Application startup file**: Isi `server.js`.
3. Unggah seluruh berkas proyek YuriPay ke folder `yuripay` (kecuali folder `node_modules`).
4. Klik tombol **Run NPM Install** pada panel cPanel atau jalankan via Terminal cPanel:
   ```bash
   npm install --production
   ```
5. Buka Terminal cPanel, masuk ke folder aplikasi dan jalankan otentikasi GoBiz:
   ```bash
   cd yuripay
   node login.js
   ```
6. Masukkan variabel environment pada bagian **Environment Variables** di menu cPanel atau simpan file `.env`.
7. Klik **Restart Application**. Layanan YuriPay Anda kini aktif secara stateful di cPanel!

---

### Metode 3: Deployment dengan Docker & Docker Compose

Buat file `docker-compose.yml`:
```yaml
version: '3.8'

services:
  yuripay:
    build: .
    container_name: yuripay-gateway
    restart: always
    ports:
      - "3000:3000"
      - "3001:3001"
    volumes:
      - ./database:/app/database
      - ./.GOPAY_SESI_JANGAN_DIHAPUS.json:/app/.GOPAY_SESI_JANGAN_DIHAPUS.json
      - ./.env:/app/.env
    environment:
      - NODE_ENV=production
```

Jalankan container:
```bash
# Build dan jalankan di latar belakang
docker compose up -d --build

# Periksa status kontainer
docker compose ps

# Memantau log transaksi realtime
docker compose logs -f
```

---

### Metode 4: Deployment di Termux (Android OS)

Smartphone Android bekas dapat dijadikan server pembayaran 24/7 yang sangat hemat energi:

```bash
# Update paket termux
pkg update && pkg upgrade -y
pkg install nodejs git python make clang sqlite -y

# Kloning repo
git clone https://github.com/myzert/YURIPAY-GOPAY.git yuripay
cd yuripay
npm install
cp .env.example .env

# Login GoBiz
npm run login

# Jalankan server
npm start
```

---

## ⚙️ Konfigurasi Environment (.env)

| Variabel | Tipe | Wajib | Contoh / Default | Deskripsi |
| :--- | :--- | :--- | :--- | :--- |
| `DASHBOARD_PORT` | Integer | Ya | `3000` | Port listen dashboard kasir, admin, dan Swagger UI. |
| `PAYMENT_PORT` | Integer | Ya | `3001` | Port listen publik untuk checkout pelanggan (`/pay/:id`). |
| `STORE_NAME` | String | Ya | `YuriDev` | Nama toko merchant yang tertera pada invoice. |
| `APP_NAME` | String | Ya | `YURIPAY by myzert` | Nama resmi aplikasi payment gateway. |
| `STORE_LOGO_URL` | String | Tidak | `https://tokosaya.com/logo.png` | URL / path gambar logo kustom merchant. |
| `DEFAULT_SUCCESS_THEME`| String | Ya | `anime` | Tema default pembayaran: `anime` atau `default`. |
| `API_KEY` | String | Ya | `yuripay_live_key_xxx` | Kunci server rahasia untuk kalkulasi signature SHA-512. |
| `ADMIN_EMAIL` | String | Ya | `admin@example.com` | Email login panel kontrol kasir. |
| `ADMIN_PASSWORD` | String | Ya | `your_secure_password` | Kata sandi login panel kontrol kasir. |
| `SESSION_SECRET` | String | Ya | `random_secret_hash` | Kunci enkripsi cookie sesi Express. |
| `GOPAY_MERCHANT_ID` | String | Ya | `G123456789` | ID Merchant GoBiz Anda. |
| `QRIS_STATIC` | String | Ya | `000201010211...63042A62` | String QRIS Statis resmi dari aplikasi GoBiz. |
| `MIN_NOMINAL` | Integer | Ya | `50` | Batas pembayaran minimum (Rupiah). |
| `TRANSACTION_TIMEOUT_MINUTES` | Integer | Ya | `10` | Batas waktu berlakunya QRIS (menit). |
| `PAYMENT_ROOT_REDIRECT_URL` | String | Tidak | `https://github.com/myzert/YURIPAY-GOPAY` | URL pengalihan stealth root port publik. |
| `DISCORD_WEBHOOK_URL` | String | Tidak | `https://discord.com/api/...` | URL webhook Discord untuk notifikasi realtime. |

---

## 🔌 Spesifikasi API & Integrasi Midtrans

### 1. Membuat Tagihan Pembayaran (Create Payment)

- **URL**: `POST /api/create-payment` (Port 3001 atau Port 3000)
- **Headers**: `Content-Type: application/json`

#### Payload Request:
```json
{
  "amount": 10000,
  "order_id": "INV-20261026-001",
  "custom_name": "Langganan Premium 1 Bulan",
  "redirect_url": "https://tokosaya.com/finish",
  "webhook_url": "https://tokosaya.com/api/midtrans-webhook",
  "success_theme": "default",
  "use_unique_code": true
}
```

#### Payload Response (HTTP 200):
```json
{
  "success": true,
  "data": {
    "payment_id": "YURI-X89KLA2",
    "order_id": "INV-20261026-001",
    "amount": 10087,
    "custom_name": "Langganan Premium 1 Bulan",
    "payment_url": "http://localhost:3001/pay/YURI-X89KLA2",
    "qr_image": "data:image/png;base64,iVBORw0KGgo...",
    "status": "PENDING",
    "success_theme": "default",
    "redirect_url": "https://tokosaya.com/finish",
    "webhook_url": "https://tokosaya.com/api/midtrans-webhook",
    "created_at": "2026-10-26T08:00:00.000Z",
    "expires_at": "2026-10-26T08:10:00.000Z",
    "paid_at": null
  }
}
```

---

### 2. Notifikasi Webhook HTTP POST (Midtrans Identical)

Saat pembayaran sukses terverifikasi, YuriPay mengirimkan HTTP POST dengan payload berikut:

```json
{
  "transaction_time": "2026-10-26 15:05:22",
  "transaction_status": "settlement",
  "transaction_id": "TX-99812401",
  "status_message": "YuriPay payment settlement successfully verified",
  "status_code": "200",
  "signature_key": "d7a8f9c1b2e3456789abcdef...",
  "payment_type": "qris",
  "order_id": "INV-20261026-001",
  "merchant_id": "G538138242",
  "gross_amount": "10087.00",
  "currency": "IDR",
  "fraud_status": "accept"
}
```

#### Verifikasi Signature Key di PHP (Laravel / Native):
```php
<?php
$rawPayload = file_get_contents('php://input');
$notification = json_decode($rawPayload, true);

$orderId = $notification['order_id'];
$statusCode = $notification['status_code'];
$grossAmount = $notification['gross_amount'];
$serverKey = 'yuripay_live_key_9981248712'; // Sesuai API_KEY di .env

$computedSignature = hash('sha512', $orderId . $statusCode . $grossAmount . $serverKey);

if ($notification['signature_key'] === $computedSignature) {
    if ($notification['transaction_status'] === 'settlement') {
        // Pembayaran Berhasil! Berikan produk/layanan ke pengguna.
    }
    http_response_code(200);
    echo json_encode(['status' => 'OK']);
} else {
    http_response_code(403);
    echo "Invalid Signature Key";
}
```

#### Verifikasi Signature Key di Node.js (Express):
```javascript
const crypto = require('crypto');

app.post('/api/midtrans-webhook', (req, res) => {
    const { order_id, status_code, gross_amount, signature_key, transaction_status } = req.body;
    const serverKey = process.env.API_KEY || 'yuripay_live_key_9981248712';

    const rawString = `${order_id}${status_code}${gross_amount}${serverKey}`;
    const computedSignature = crypto.createHash('sha512').update(rawString).digest('hex');

    if (signature_key === computedSignature) {
        if (transaction_status === 'settlement') {
            console.log(`[PAID] Tagihan ${order_id} lunas terverifikasi!`);
        }
        return res.status(200).json({ status: 'OK' });
    }

    return res.status(403).json({ error: 'Signature Mismatch' });
});
```

---

## 📖 Dokumentasi Swagger UI

YuriPay menyertakan dokumentasi antarmuka interaktif **OpenAPI 3.0**:
- **Swagger UI**: [http://localhost:3000/docs](http://localhost:3000/docs) (atau Port 3001)
- **OpenAPI JSON Spec**: [http://localhost:3000/swagger.json](http://localhost:3000/swagger.json)
- Dilengkapi fitur pengujian langsung (*Try it out*) untuk seluruh endpoint REST API.

---

## ⭐ Dukung YuriPay & Star di GitHub

Jika proyek ini bermanfaat bagi bisnis dan integrasi toko Anda, tolong berikan **Star ⭐** di repository resmi kami:

<p align="center">
  <a href="https://github.com/myzert/YURIPAY-GOPAY">
    <img src="https://img.shields.io/github/stars/myzert/YURIPAY-GOPAY?style=for-the-badge&logo=github&color=0284c7&label=STAR%20YURIPAY%20DI%20GITHUB" alt="Star YuriPay" />
  </a>
</p>

Setiap bintang dari Anda membantu meningkatkan visibilitas proyek open-source Indonesia ini di kancah global!

---

## 🤝 Tim Pengembang & Kontributor

Terima kasih sebesar-besarnya kepada seluruh kontributor yang telah membangun, menguji, dan menyempurnakan ekosistem YuriPay!

<p align="center">
  <a href="https://github.com/myzert">
    <img src="https://github.com/myzert.png" width="80" height="80" style="border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" alt="myzert" />
  </a>
</p>

<p align="center">
  <strong>myzert (YuriDev)</strong><br>
  <em>Lead Developer & Maintainer</em><br>
  <a href="https://github.com/myzert">GitHub: @myzert</a> • <a href="https://t.me/ahmadzakiyo">Telegram: @ahmadzakiyo</a>
</p>

### Cara Menjadi Kontributor
Kami sangat menyambut kontribusi dari komunitas! Silakan baca panduan lengkap di [CONTRIBUTING.md](CONTRIBUTING.md):
1. Fork repository [https://github.com/myzert/YURIPAY-GOPAY](https://github.com/myzert/YURIPAY-GOPAY).
2. Buat branch fitur baru (`git checkout -b feature/fitur-keren`).
3. Lakukan commit perubahan Anda (`git commit -m 'feat: tambah webhook retry timeout'`).
4. Push ke branch Anda (`git push origin feature/fitur-keren`).
5. Buat **Pull Request** di GitHub.

---

## 💖 Donasi & Dukungan Pengembang

Pengembangan YuriPay dilakukan secara independen untuk mendukung UMKM dan developer Indonesia memiliki payment gateway mandiri tanpa potongan biaya. Dukung biaya kopi & server riset pengembang melalui tautan berikut:

- ☕ **YuriSupport / Donasi Mandiri**: [https://yuripay.pages.dev/#support](https://yuripay.pages.dev/#support)
- 📢 **Telegram Channel Updates**: [@nuxysproject](https://t.me/nuxysproject)
- 💬 **Telegram Developer Support**: [@ahmadzakiyo](https://t.me/ahmadzakiyo)

---

## ❓ Pertanyaan Umum (FAQ)

<details>
<summary><strong>1. Mengapa YuriPay tidak dapat di-deploy di Vercel?</strong></summary>
<p>Vercel menggunakan arsitektur serverless function yang membekukan (freeze) container seketika setelah respons HTTP selesai dikirim. Akibatnya, background polling daemon yang bertugas memeriksa mutasi GoPay akan mati seketika. Selain itu, filesystem serverless bersifat sementara (ephemeral), sehingga file database SQLite dan token sesi akan terhapus secara acak.</p>
</details>

<details>
<summary><strong>2. Berapa lama token sesi GoBiz bertahan dan apakah perlu login berulang kali?</strong></summary>
<p>Token sesi GoBiz bertahan hingga 30 hari. YuriPay memiliki fitur <em>auto-refresh token</em> di <code>sessionManager.js</code> yang secara otomatis memperbarui token akses di latar belakang sebelum masa berlakunya habis. Login ulang (<code>npm run login</code>) hanya diperlukan jika Anda sengaja melakukan logout dari aplikasi ponsel GoBiz.</p>
</details>

<details>
<summary><strong>3. Di mana letak string QRIS_STATIC toko saya?</strong></summary>
<p>Buka aplikasi <strong>GoBiz</strong> di ponsel Anda &rarr; Pilih menu <strong>Lainnya / QRIS</strong> &rarr; Tampilkan QR Toko Anda &rarr; Scan gambar QR tersebut menggunakan pemindai QR biasa (misal Google Lens). Teks string panjang yang diawali <code>000201010211...6304XXXX</code> adalah kode QRIS Statis Anda.</p>
</details>

<details>
<summary><strong>4. Mengapa nominal pembayaran bertambah Rp 1 perak?</strong></summary>
<p>Penambahan Rp 1 perak adalah kode unik verifikasi otomatis. Karena sistem QRIS menerima transfer dari berbagai aplikasi perbankan nasional tanpa identitas nama pengirim yang seragam, kode unik ini menjadi acuan mutlak bagi sistem untuk mencocokkan pembayaran dengan pesanan pelanggan secara 100% presisi tanpa tertukar.</p>
</details>

<details>
<summary><strong>5. Apakah aman menggunakan YuriPay untuk toko online skala produksi?</strong></summary>
<p>Sangat aman. YuriPay menggunakan arsitektur dual-port yang mengisolasi antarmuka publik kasir (Port 3001) dari dashboard manajemen dan file sesi token GoBiz (Port 3000). Selain itu, sistem dilindungi anti-probe redirect, HMAC SHA-512 signature, serta database SQLite dengan Write-Ahead Logging yang tahan crash.</p>
</details>

---

## 📄 Lisensi & Hak Cipta

Perangkat lunak ini dilisensikan di bawah lisensi terbuka resmi **[ISC License](LICENSE)**.

```
ISC License

Copyright (c) 2026 myzert (YuriDev)

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

---

<p align="center">
  Dikembangkan dengan dedikasi untuk ekosistem open-source Indonesia oleh <strong>myzert (YuriDev)</strong>.<br>
  Kunjungi dokumentasi resmi di <a href="https://yuripay.pages.dev/"><strong>yuripay.pages.dev</strong></a> atau <a href="https://yuripay.projectt.my.id/"><strong>yuripay.projectt.my.id</strong></a>
</p>
