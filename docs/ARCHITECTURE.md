# 🏛️ Arsitektur Mendalam YuriPay (Architecture Deep Dive)

Dokumen ini menjelaskan rancangan rekayasa perangkat lunak dan arsitektur internal **YURIPAY by myzert**.

---

## 1. Arsitektur Dual-Port Isolation

YuriPay tidak menggunakan arsitektur port tunggal konvensional, melainkan memisahkan aplikasi ke dalam dua socket HTTP terisolasi:

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

### Keunggulan Isolasi Ini:
- **Zero Token Leakage**: Port 3001 tidak memiliki handler atau middleware yang membaca token otentikasi GoBiz `.GOPAY_SESI_JANGAN_DIHAPUS.json`.
- **Stateless Front-End**: Pengguna publik tidak membebani memori session store Express di Port 3000.
- **Stealth Anti-Probe**: Port 3001 dilengkapi auto-redirect 302 jika ada bot crawler yang mencoba memindai rute acak.

---

## 2. Stateful Worker vs Serverless Limitation

Sistem payment gateway berbasis mutasi mutlak membutuhkan status persisten (*stateful*):

1. **Daemon Event Loop**:
   Proses `paymentChecker.js` berjalan dengan interval `setInterval` konstan di latar belakang. Pada arsitektur Serverless (Vercel, AWS Lambda), container dibekukan (*frozen*) segera setelah respon HTTP dikirim. Akibatnya, interval poller mati total.
2. **SQLite Write-Ahead Logging (WAL)**:
   YuriPay menggunakan `better-sqlite3` dalam mode `PRAGMA journal_mode = WAL;`. Mode WAL memungkinkan pembacaan (*reads*) dan penulisan (*writes*) berjalan secara simultan tanpa lock contention. Serverless menggunakan disk ephemeral yang menghapus database setiap kali fungsi mengalami *cold restart*.
3. **In-Memory Mutex Lock & Cache**:
   Objek `activePayments = new Map()` dan `claimedTransactions = new Map()` menjaga agar dua transaksi yang terjadi di detik yang sama tidak menggunakan kode unik yang identik, dan mutasi GoPay yang sudah diklaim tidak dapat diklaim ulang (*anti double-claim*).

---

## 3. Alur Idempotensi Transaksi

Setiap pembuatan transaksi mengikat `order_id` dari toko merchant:

1. Klien mengirim `POST /api/create-payment` dengan `order_id: "INV-1001"`.
2. `paymentStore.js` memeriksa apakah ada transaksi yang berstatus `PENDING` dengan `order_id` tersebut.
3. Jika ditemukan, sistem langsung mengembalikan URL dan data pembayaran yang sudah ada tanpa menaikkan kode unik baru.
4. Jika transaksi sudah berstatus `PAID`, sistem mengembalikan data berstatus lunas.
5. Hal ini mencegah pelanggan yang menekan tombol *Checkout* berkali-kali membuat tagihan QR ganda.

---

## 4. Diagram Status Transaksi

```
    [ Pembeli Membuat Pesanan ]
                 │
                 ▼
          [ Status: PENDING ]
                 │
        ┌────────┴────────┐
        │                 │
  [ Waktu Habis ]    [ Mutasi GoBiz Cocok ]
        │                 │
        ▼                 ▼
[ Status: EXPIRED ] [ Status: PAID ]
                          │
                          ├─► Webhook Midtrans HTTP POST
                          ├─► OP Redirect ke redirect_url
                          └─► Broadcaster Discord Notifier
```
