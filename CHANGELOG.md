# 📝 Catatan Rilis & Riwayat Versi (Changelog)

Seluruh perubahan penting pada proyek **YURIPAY by myzert** dicatat di berkas ini berdasarkan format standar [Keep a Changelog](https://keepachangelog.com/id/1.0.0/).

---

## [1.2.0] - 2026-10-28
### Ditambahkan
- 🌐 Halaman dokumentasi interaktif resmi berbasis Vite di [https://yuripay.pages.dev/](https://yuripay.pages.dev/) & [https://yuripay.projectt.my.id/](https://yuripay.projectt.my.id/).
- 🧮 Interactive Live Simulator untuk Generator EMVCo Dynamic QRIS dan Midtrans SHA-512 Signature Calculator.
- 🎵 Audio preview player untuk *Fintech Chime* (Web Audio API murni) dan *Cute Arigato* sound effect.
- 🕶️ Stealth Root 302 Redirect pada port publik (3001) untuk melindungi server dari *bot crawlers* dan scanner otomatis.
- 📜 Dokumentasi teknis modular (`docs/ARCHITECTURE.md`, `docs/API_REFERENCE.md`, `docs/QRIS_EMVCO_SPEC.md`, `docs/WEBHOOK_SPEC.md`, `docs/GOBIZ_AUTH.md`, `docs/DEPLOYMENT_GUIDE.md`).

### Ditingkatkan
- ⚡ Algoritma offset kode unik: Micro-nominal (< Rp 1.000) strictly +Rp 1 perak dengan auto collision shift.
- 🔁 Penanganan respon 401 Unauthorized pada GoBiz Analytics API dengan instant session refresh trigger.
- 📦 Optimasi mode WAL (Write-Ahead Logging) SQLite untuk menangani lonjakan transaksi simultan tinggi.

---

## [1.1.0] - 2026-10-24
### Ditambahkan
- 🎭 Mode Dual Success Theme: Pilihan tema selebrasi **Default** (Stripe/Fintech style) dan **Anime** (Marin Kitagawa modal & suara cute arigato).
- 🖼️ Dukungan kustomisasi logo merchant via environment variable `STORE_LOGO_URL`.
- 🔐 Otentikasi OTP Terminal interaktif (`node login.js`) via SMS/WhatsApp resmi GoBiz.
- 🔄 Background session token auto-refresh daemon (siklus 6 jam).
- 🔔 Midtrans-identical webhook engine dengan kalkulasi digital signature SHA-512.

---

## [1.0.0] - 2026-10-20
### Rilis Perdana
- 🚀 Inisialisasi awal arsitektur Dual-Port Isolation (Port 3000 Internal, Port 3001 Public Checkout).
- 📱 Dynamic QRIS generation berbasis template static GoBiz menggunakan standar EMVCo CRC16-CCITT.
- 💾 SQLite database persistence untuk riwayat transaksi kasir dan mutasi.
- 📊 Dashboard manajemen admin berbasis template server-side EJS.
