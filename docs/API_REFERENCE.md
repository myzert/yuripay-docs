# 📖 Referensi REST API & OpenAPI 3.0 YuriPay

YuriPay menyediakan API RESTful yang bersih dan terdokumentasi rapi. Seluruh response berformat JSON.

---

## 1. Membuat Tagihan Baru (Create Payment)

Membuat tagihan QRIS dinamis baru dengan nominal unik dan pengembalian QR code.

- **Endpoint**: `POST /api/create-payment` (dapat dipanggil di Port 3000 maupun Port 3001)
- **Content-Type**: `application/json`

### Request Body
| Parameter | Tipe | Wajib | Keterangan |
| :--- | :--- | :--- | :--- |
| `amount` | Integer | Ya | Nominal pembayaran dalam Rupiah (min. 50). |
| `order_id` | String | Tidak | ID unik pesanan merchant (kunci idempotensi). |
| `custom_name` | String | Tidak | Deskripsi pesanan atau nama pelanggan. |
| `redirect_url` | String | Tidak | URL pengalihan setelah pembayaran sukses diverifikasi. |
| `webhook_url` | String | Tidak | URL HTTP POST notifikasi webhook ke server toko Anda. |
| `success_theme` | String | Tidak | Tema selebrasi checkout: `'default'` atau `'anime'`. |
| `use_unique_code` | Boolean | Tidak | Menambahkan kode unik verifikasi (default: `true`). |

#### Contoh Request (cURL):
```bash
curl -X POST https://bayar.tokosaya.com/api/create-payment \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25000,
    "order_id": "INV-20261028-0912",
    "custom_name": "Paket Hosting 1 Bulan",
    "redirect_url": "https://tokosaya.com/order/success",
    "webhook_url": "https://tokosaya.com/api/midtrans-webhook",
    "success_theme": "default"
  }'
```

#### Contoh Response (HTTP 200 OK):
```json
{
  "success": true,
  "data": {
    "payment_id": "YURI-K92XLA1",
    "order_id": "INV-20261028-0912",
    "amount": 25087,
    "base_amount": 25000,
    "unique_code": 87,
    "custom_name": "Paket Hosting 1 Bulan",
    "payment_url": "https://bayar.tokosaya.com/pay/YURI-K92XLA1",
    "qr_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "status": "PENDING",
    "success_theme": "default",
    "redirect_url": "https://tokosaya.com/order/success",
    "webhook_url": "https://tokosaya.com/api/midtrans-webhook",
    "created_at": "2026-10-28T07:30:00.000Z",
    "expires_at": "2026-10-28T07:40:00.000Z",
    "paid_at": null
  }
}
```

---

## 2. Mengecek Status Pembayaran (Get Payment Status)

Mendapatkan status terkini dari suatu transaksi pembayaran.

- **Endpoint**: `GET /api/payment-status/:id`
- **Method**: `GET`

#### Contoh Request:
```bash
curl https://bayar.tokosaya.com/api/payment-status/YURI-K92XLA1
```

#### Contoh Response (HTTP 200 OK):
```json
{
  "success": true,
  "status": "PAID",
  "paid": true,
  "order_id": "INV-20261028-0912",
  "amount": 25087,
  "paid_at": "2026-10-28T07:33:12.000Z",
  "redirect_url": "https://tokosaya.com/order/success?order_id=INV-20261028-0912&status_code=200&transaction_status=settlement..."
}
```

---

## 3. Swagger UI & OpenAPI Specification

Akses antarmuka dokumentasi interaktif OpenAPI 3.0:
- **Swagger UI Interactive**: `GET http://localhost:3000/docs`
- **Raw OpenAPI 3.0 JSON**: `GET http://localhost:3000/swagger.json`
