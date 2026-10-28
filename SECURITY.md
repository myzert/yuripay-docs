# 🛡️ Kebijakan Keamanan (Security Policy)

Keamanan integritas transaksi dan perlindungan data merchant adalah prioritas fundamental dalam pengembangan **YURIPAY by myzert**.

---

## 🔒 Prinsip Desain Keamanan YuriPay

YuriPay mengimplementasikan pendekatan *Defense-in-Depth* melalui prinsip-prinsip berikut:

1. **Isolasi Jaringan Dual-Port**:
   - Port 3000 (Internal Dashboard) dan Port 3001 (Publik Checkout) beroperasi pada instance router Express terpisah.
   - Sesi admin dan file token GoBiz tidak pernah dapat diakses melalui socket Port 3001.
2. **Stealth Anti-Reconnaissance Redirect**:
   - Permintaan HTTP yang mencoba memindai root Port 3001 (`/`) atau rute tidak dikenal otomatis dialihkan (302 Redirect) ke URL aman atau repository resmi untuk membingungkan bot scanner dan crawler otomatis.
3. **Kerahasiaan Token Sesi GoBiz**:
   - Berkas `.GOPAY_SESI_JANGAN_DIHAPUS.json` disimpan secara lokal di filesystem POSIX dengan hak akses terbatas dan diabaikan dari git (`.gitignore`).
4. **Verifikasi Hash Webhook SHA-512**:
   - Seluruh webhook dilengkapi kunci verifikasi kriptografis SHA-512 menggunakan `API_KEY` rahasia server untuk mencegah spoofing atau replay attack.
5. **Idempotensi Transaksi**:
   - Menggunakan identifier unik `order_id` untuk mencegah tagihan ganda atau double-spending.

---

## 🚨 Pelaporan Kerentanan (Reporting a Vulnerability)

Jika Anda menemukan potensi celah keamanan (*security vulnerability*) pada YuriPay, mohon **JANGAN MEMBUAT ISU PUBLIK DI GITHUB**.

Silakan hubungi tim pengembang secara langsung melalui kanal privat:
- 👤 **Telegram**: [@ahmadzakiyo](https://t.me/ahmadzakiyo)
- 📧 **Subjek**: `[VULNERABILITY REPORT] YuriPay Security Issue`

Mohon sertakan:
1. Deskripsi kerentanan dan potensi dampaknya.
2. Bukti konsep (Proof of Concept / PoC) atau langkah-langkah untuk mereproduksi celah tersebut.
3. Rekomendasi mitigasi jika ada.

Kami akan merespons dalam waktu maksimal 24 jam dan merilis patch perbaikan secepat mungkin. Terima kasih telah membantu menjaga keamanan ekosistem open source!
