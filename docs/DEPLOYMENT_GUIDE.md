# 🚀 Panduan Lengkap Deployment Produksi (Deployment Guide)

YuriPay membutuhkan lingkungan *stateful* dengan disk permanen dan background process 24/7. Berikut panduan langkah demi langkah untuk 4 skenario deployment utama:

---

## 1. Linux VPS (Ubuntu 20.04/22.04/24.04 atau Debian 11/12)

### A. Persiapan Server
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential sqlite3 nginx

# Pasang Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Pasang PM2 Process Manager
sudo npm install -g pm2
```

### B. Kloning & Instalasi
```bash
cd /var/www
sudo git clone https://github.com/myzert/YURIPAY-GOPAY.git yuripay
sudo chown -R $USER:$USER /var/www/yuripay
cd yuripay
npm install --production
cp .env.example .env
nano .env # Sesuaikan konfigurasi toko & API key Anda
```

### C. Login GoBiz Merchant
```bash
npm run login
# Masukkan nomor HP dan 4 digit kode OTP yang masuk ke SMS/WhatsApp
```

### D. Konfigurasi PM2
```bash
pm2 start server.js --name "yuripay"
pm2 save
pm2 startup
```

### E. Konfigurasi Nginx & SSL (Certbot)
```nginx
# /etc/nginx/sites-available/yuripay
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
    }
}
```
Aktifkan dan pasang sertifikat SSL gratis:
```bash
sudo ln -s /etc/nginx/sites-available/yuripay /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d bayar.tokosaya.com
```

---

## 2. cPanel Web Hosting (Setup Node.js App / CloudLinux)

1. Masuk ke **cPanel Dashboard** Anda.
2. Cari dan klik menu **Setup Node.js App**.
3. Klik tombol **Create Application**:
   - **Node.js version**: Pilih `18.x`, `20.x`, atau `22.x`.
   - **Application mode**: `Production`.
   - **Application root**: `yuripay`.
   - **Application URL**: Subdomain atau domain utama Anda.
   - **Application startup file**: `server.js`.
4. Unggah seluruh file repositori YuriPay ke folder `/home/username/yuripay` (Gunakan Git Version Control di cPanel atau File Manager).
5. Buka **Terminal** di cPanel:
   ```bash
   cd yuripay
   npm install --production
   node login.js # Lakukan otentikasi OTP
   ```
6. Buka kembali halaman **Setup Node.js App**, masukkan variabel environment (`STORE_NAME`, `API_KEY`, `QRIS_STATIC`, dll) pada bagian **Environment Variables**.
7. Klik tombol **Restart Application**. Selesai!

---

## 3. Docker & Docker Compose

Jalankan container mandiri dengan isolasi penuh:

```bash
git clone https://github.com/myzert/YURIPAY-GOPAY.git
cd YURIPAY-GOPAY
cp .env.example .env
npm run login # Dapatkan token sesi terlebih dahulu
docker compose up -d --build
```

Periksa log:
```bash
docker compose logs -f
```

---

## 4. Termux di Android Smartphone

Ubah HP Android bekas menjadi server pembayaran fisik hemat energi:

```bash
pkg update && pkg upgrade -y
pkg install nodejs git python make clang sqlite -y

git clone https://github.com/myzert/YURIPAY-GOPAY.git
cd YURIPAY-GOPAY
npm install
cp .env.example .env

# Login GoBiz
npm run login

# Jalankan daemon background
npm start
```
*(Gunakan fitur **Acquire Wakelock** di Termux agar Android tidak mematikan CPU saat layar mati).*
