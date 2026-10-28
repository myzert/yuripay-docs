# 🔔 Spesifikasi Webhook Midtrans-Compatible & Tanda Tangan SHA-512

YuriPay mengadopsi format notifikasi webhook yang 100% kompatibel dengan **Midtrans Payment Gateway**. Seluruh pustaka atau plugin yang menerima webhook Midtrans dapat digunakan langsung dengan YuriPay tanpa perubahan struktur data.

---

## 1. Format Payload Notifikasi Webhook

Saat status pembayaran berubah menjadi `settlement` (lunas), `expire` (kedaluwarsa), atau `pending`, YuriPay mengirimkan permintaan `HTTP POST` ke `webhook_url` merchant.

### Headers:
```http
POST /api/midtrans-webhook HTTP/1.1
Host: tokosaya.com
Content-Type: application/json
User-Agent: YuriPay-Webhook-Engine/1.0 (Midtrans Compatible)
X-YuriPay-Signature: 63b4f9c1b2e3456789abcdef...
```

### Body Payload (JSON):
```json
{
  "transaction_time": "2026-10-28 14:32:00",
  "transaction_status": "settlement",
  "transaction_id": "TX-99812401",
  "status_message": "Midtrans payment notification: Transaksi berhasil diselesaikan dan diverifikasi lunas (SETTLEMENT/PAID)",
  "status_code": "200",
  "signature_key": "63b4f9c1b2e3456789abcdef0123456789abcdef0123456789abcdef01234567",
  "payment_type": "qris",
  "order_id": "INV-20261028-001",
  "merchant_id": "G538138242",
  "gross_amount": "10001.00",
  "currency": "IDR",
  "settlement_time": "2026-10-28 14:32:15",
  "issuer": "gopay",
  "acquirer": "gopay",
  "fraud_status": "accept",
  "expiry_time": "2026-10-28 14:42:00"
}
```

---

## 2. Kalkulasi Signature Key (Keamanan Kriptografi)

Tanda tangan digital dihitung menggunakan hashing SHA-512 dengan rumus:

$$\text{signature\_key} = \text{SHA512}(\text{order\_id} + \text{status\_code} + \text{gross\_amount} + \text{ServerKey})$$

*Keterangan:*
- `order_id`: ID pesanan toko Anda.
- `status_code`: Kode status HTTP (contoh: `200`).
- `gross_amount`: Total nominal dengan format dua desimal (contoh: `10001.00`).
- `ServerKey`: Nilai rahasia `API_KEY` yang diatur di berkas `.env` YuriPay.

---

## 3. Contoh Verifikasi di Berbagai Bahasa Pemrograman

### PHP (Laravel / Native)
```php
<?php
$payload = json_decode(file_get_contents('php://input'), true);

$orderId = $payload['order_id'];
$statusCode = $payload['status_code'];
$grossAmount = $payload['gross_amount'];
$serverKey = env('YURIPAY_SERVER_KEY', 'yuripay_live_key_9981248712');

$signature = hash('sha512', $orderId . $statusCode . $grossAmount . $serverKey);

if ($payload['signature_key'] === $signature) {
    if ($payload['transaction_status'] === 'settlement') {
        // Tandai pesanan lunas di database toko Anda
    }
    http_response_code(200);
    echo json_encode(['status' => 'OK']);
} else {
    http_response_code(403);
    echo "Invalid Signature";
}
```

### Node.js (Express)
```javascript
const crypto = require('crypto');

app.post('/api/webhook', (req, res) => {
    const { order_id, status_code, gross_amount, signature_key, transaction_status } = req.body;
    const serverKey = process.env.API_KEY || 'yuripay_live_key_9981248712';

    const rawString = `${order_id}${status_code}${gross_amount}${serverKey}`;
    const computedSignature = crypto.createHash('sha512').update(rawString).digest('hex');

    if (signature_key === computedSignature) {
        if (transaction_status === 'settlement') {
            console.log(`[ORDER PAID] Pesanan ${order_id} lunas!`);
        }
        return res.status(200).json({ status: 'OK' });
    }

    return res.status(403).json({ error: 'Signature Mismatch' });
});
```

### Python (FastAPI / Flask)
```python
import hashlib
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()

@app.post("/api/webhook")
async def receive_webhook(request: Request):
    data = await request.json()
    server_key = "yuripay_live_key_9981248712"
    
    raw = f"{data['order_id']}{data['status_code']}{data['gross_amount']}{server_key}"
    computed = hashlib.sha512(raw.encode('utf-8')).hexdigest()
    
    if data['signature_key'] == computed:
        if data['transaction_status'] == 'settlement':
            pass # Proses produk
        return {"status": "OK"}
    
    raise HTTPException(status_code=403, detail="Invalid Signature")
```

---

## 4. Kebijakan Pengulangan (Retry Policy)

Jika server merchant mengembalikan status selain `2xx` atau mengalami *timeout* (> 7 detik), YuriPay akan mencoba mengirim ulang webhook:
- **Percobaan 1**: Seketika saat mutasi terverifikasi.
- **Percobaan 2**: Jeda 1.5 detik setelah kegagalan pertama.
- **Percobaan 3**: Jeda 3.0 detik setelah kegagalan kedua.

Seluruh riwayat percobaan tersimpan di tabel SQLite `webhook_logs` dan dapat dipantau langsung melalui dashboard Kasir Port 3000.
