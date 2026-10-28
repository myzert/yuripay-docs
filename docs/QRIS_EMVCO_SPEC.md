# 🧾 Spesifikasi EMVCo Dynamic QRIS & CRC16 CCITT

Dokumen ini menjelaskan struktur data TLV (Tag-Length-Value) QRIS dan algoritma matematika pembuatan QRIS dinamis pada berkas `src/gateway/qrisHelper.js`.

---

## 1. Standar EMVCo QRIS Bank Indonesia (PADG No. 21/18/PADG/2019)

Kode QRIS disusun dari deretan Tag EMVCo dengan format:
`[Tag 2 Digit][Panjang Data 2 Digit][Nilai Data]`

Contoh:
- Tag `00` panjang `02` isi `01` &rarr; `000201` (Versi Format QR)
- Tag `01` panjang `02` isi `11` &rarr; `010211` (Jenis QR: 11 = Statis, 12 = Dinamis)
- Tag `53` panjang `03` isi `360` &rarr; `5303360` (Mata Uang IDR - Rupiah)
- Tag `54` panjang `05` isi `10050` &rarr; `540510050` (Nominal Pembayaran Rp 10.050)
- Tag `63` panjang `04` &rarr; `6304` diikuti 4 digit Hex Checksum CRC-16.

---

## 2. Alur Transformasi QRIS Statis ke Dinamis

1. **Pembersihan Checksum Awal**:
   Jika template QRIS GoBiz statis mengandung Tag 63, bagian `6304XXXX` di ujung string dipotong terlebih dahulu.
2. **Parsing Array TLV**:
   Looping membaca byte per byte untuk mengekstrak setiap Tag, panjangnya, dan nilainya.
3. **Konversi Tag `01`**:
   Nilai Tag `01` diubah dari `11` (Statis) menjadi `12` (Dinamis).
4. **Penyisipan Tag `54` (Nominal)**:
   - Nilai nominal dikonversi menjadi string bulat (contoh: `15001`).
   - Panjang string dihitung (`05`).
   - Tag disisipkan sebelum Tag `58` (Kode Negara `ID`) atau di posisi yang valid.
5. **Kalkulasi Ulang CRC16 CCITT**:
   String gabungan ditambah akhiran `6304`, kemudian dihitung checksum 16-bit-nya.

---

## 3. Algoritma Matematika CRC16-CCITT

YuriPay mengimplementasikan CRC16-CCITT dengan spesifikasi:
- **Polinomial**: `0x1021` ($x^{16} + x^{12} + x^5 + 1$)
- **Nilai Inisial**: `0xFFFF`
- **Output Padding**: 4 karakter heksadesimal kapital.

```javascript
function calculateCRC16(payload) {
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}
```

---

## 4. Logika Kode Unik (+1 Perak & Collision Handling)

Untuk mencegah tertukarnya pembayaran antar pengguna tanpa mengharuskan nama pengirim yang sama:
- **Nominal Mikro (< Rp 1.000)**:
  Ditambahkan kode unik minimalis **+Rp 1 perak**. Apabila pada saat yang sama sedang ada pesanan aktif lain dengan nominal tersebut, kode dinaikkan menjadi +2, +3, dst. (maksimal +5).
- **Nominal Standar (>= Rp 1.000)**:
  Ditambahkan offset acak antara **1 s/d 199 perak** (dijamin tidak melebihi Rp 200 perak).
