# 🤝 Panduan Kontribusi YuriPay (Contributing Guidelines)

Terima kasih atas minat Anda untuk berkontribusi pada **YURIPAY by myzert**! Proyek ini terbuka untuk siapa saja yang ingin membantu memajukan ekosistem teknologi pembayaran mandiri open-source di Indonesia.

---

## 🌟 Cara Mendukung Proyek

Selain berkontribusi kode, Anda juga dapat mendukung proyek ini dengan cara:
1. **Berikan Bintang (Star ⭐)** di [GitHub YuriPay](https://github.com/myzert/YURIPAY-GOPAY). Bintang Anda sangat berharga untuk menaikkan reputasi open-source ini!
2. **Bagikan YuriPay** kepada komunitas pengembang web, pegiat e-commerce, UMKM, dan forum programmer.
3. **Laporkan Bug** atau usulkan fitur baru melalui [GitHub Issues](https://github.com/myzert/YURIPAY-GOPAY/issues).
4. **Bantu Menjawab Pertanyaan** pengguna lain di grup diskusi Telegram [@nuxysproject](https://t.me/nuxysproject).

---

## 🛠️ Alur Kerja Pengembangan (Workflow)

Ikuti langkah-langkah berikut untuk mengajukan perubahan kode:

### 1. Fork Repositori
Klik tombol **Fork** di pojok kanan atas halaman repositori [https://github.com/myzert/YURIPAY-GOPAY](https://github.com/myzert/YURIPAY-GOPAY) ke akun GitHub Anda pribadi.

### 2. Kloning ke Komputer / Server Lokal
```bash
git clone https://github.com/<username-anda>/YURIPAY-GOPAY.git
cd YURIPAY-GOPAY
```

### 3. Buat Branch Fitur Baru
Gunakan format nama branch yang jelas dan deskriptif:
- Fitur baru: `feature/nama-fitur` (contoh: `feature/telegram-bot-notifier`)
- Perbaikan bug: `fix/nama-bug` (contoh: `fix/qris-crc-padding`)
- Dokumentasi: `docs/nama-dokumen` (contoh: `docs/laravel-webhook-guide`)

```bash
git checkout -b feature/nama-fitur
```

### 4. Pasang Dependensi & Uji Coba
```bash
npm install
npm test # atau uji coba fungsi terkait
```

### 5. Komit Perubahan
Gunakan format Conventional Commits:
- `feat: deskripsi fitur baru`
- `fix: deskripsi perbaikan bug`
- `docs: pembaruan dokumentasi`
- `refactor: pembersihan kode tanpa mengubah fungsionalitas`
- `perf: peningkatan performa kode`

```bash
git commit -m "feat(webhook): add configurable backoff retry interval"
```

### 6. Push ke Branch Fork Anda
```bash
git push origin feature/nama-fitur
```

### 7. Buat Pull Request (PR)
Buka repositori utama [https://github.com/myzert/YURIPAY-GOPAY](https://github.com/myzert/YURIPAY-GOPAY) dan klik tombol **Compare & pull request**. Jelaskan apa yang Anda ubah dan mengapa perubahan tersebut dibutuhkan.

---

## 📋 Standar Kode & Aturan Arsitektur

Agar kode tetap bersih dan stabil, perhatikan aturan berikut:
1. **Dilarang Menghancurkan Kompatibilitas Dual-Port**: Port 3000 (Internal) dan Port 3001 (Publik) harus tetap terisolasi demi keamanan kredensial.
2. **Preservasi SQLite WAL**: Jangan mengganti engine database tanpa persetujuan tim inti. Write-Ahead Logging menjamin integritas transaksi tinggi.
3. **Standar EMVCo QRIS**: Modifikasi pada fungsi parser QRIS (`src/gateway/qrisHelper.js`) wajib lolos validasi checksum CRC16-CCITT standar Bank Indonesia.
4. **Keamanan Token GoBiz**: Jangan pernah mengekspos token otentikasi `.GOPAY_SESI_JANGAN_DIHAPUS.json` ke respon API publik (Port 3001).

---

## 🏆 Hall of Fame Kontributor

Seluruh kontributor yang PR-nya disetujui (*merged*) akan dicantumkan namanya pada halaman resmi dokumentasi [https://yuripay.pages.dev/](https://yuripay.pages.dev/) dan berkas `README.md`.

Terima kasih atas dedikasi Anda untuk kemajuan ekosistem open source Indonesia! 🚀
