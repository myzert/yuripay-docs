# 📱 Otentikasi GoBiz Merchant & Manajemen Sesi

Dokumen ini menjelaskan mekanisme otentikasi akun GoBiz pedagang pada `login.js` dan manajemen pembaruan token di `src/gateway/sessionManager.js`.

---

## 1. Mengapa Menggunakan OTP Terminal (`node login.js`)?

Metode lama yang mengharuskan merchant menyalin (*copy-paste*) cookie browser atau token authorization sangat rawan kesalahan penulisan dan cepat kedaluwarsa (dalam hitungan jam).

Dengan sistem **OTP Terminal**:
- Merchant cukup memasukkan nomor HP GoBiz terdaftar satu kali.
- Server berkomunikasi langsung dengan gateway otentikasi Gojek untuk mengirim SMS / WhatsApp OTP resmi.
- Token otentikasi lengkap, refresh token, dan sidik jari perangkat diekstrak secara otomatis ke dalam file `.GOPAY_SESI_JANGAN_DIHAPUS.json`.

---

## 2. Struktur File Sesi (`.GOPAY_SESI_JANGAN_DIHAPUS.json`)

Berkas ini menyimpan kredensial sesi aktif:
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "def50200...",
  "expires_in": 2592000,
  "token_type": "Bearer",
  "merchant_id": "G538138242",
  "phone_number": "085119772671",
  "updated_at": "2026-10-28T07:15:00.000Z"
}
```

> [!CAUTION]
> **JANGAN PERNAH MEMBAGIKAN ATAU MENGUNGGAH BERKAS INI KE GITHUB ATAU REPOSITORI PUBLIK.** Berkas ini secara otomatis dikecualikan dalam `.gitignore`.

---

## 3. Mekanisme Auto-Refresh Token 24/7

Agar gateway dapat berjalan tanpa intervensi manual selama berbulan-bulan:
1. **Background Refresh Interval**:
   `sessionManager.js` memeriksa masa berlaku token secara periodik setiap 6 jam.
2. **On-Demand 401 Recovery**:
   Jika request mutasi transaksi ke Gojek API mengembalikan respon `401 Unauthorized`, `gopayClient.js` seketika memanggil `refreshSession()`.
3. Setelah sesi baru diterima dari Gojek API, file JSON langsung diperbarui dan request transaksi yang tadi tertahan diulang secara otomatis.
