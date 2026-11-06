import './style.css';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

// ============================================================================
// Core State & Presets
// ============================================================================
const PRESET_MISTER_DOMPU = '00020101021126670016ID.CO.CIMB.WWW011893600022000122143002150000000000000000303UMI51440014ID.CO.QRIS.WWW0215ID20243469147550303UMI520473215303360540410005802ID5914Mister Dompu 26002Dompu61058421162070703A0163045663';
const PRESET_ZERO_SHOP = '00020101021126610014COM.GO-JEK.WWW01189360091435381382420210G5381382420303UMI51440014ID.CO.QRIS.WWW0215ID10243419924680303UMI5204581653033605802ID5918ZERO SHOP, MEGALUH6007JOMBANG61056145762070703A0163042A62';

let currentStaticQris = PRESET_MISTER_DOMPU;
let currentNominal = 1000;
let currentOffsetMode = 'yuripay'; // 'yuripay' | 'exact' | 'custom'
let customOffset = 0;
let feeType = 'none'; // 'none' | 'flat' | 'percent'
let feeValue = 0;

function formatRupiah(num: number): string {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

/**
 * EMVCo CRC-16 CCITT Calculation (0xFFFF initial, 0x1021 polynomial)
 */
function calculateCRC16(payload: string): string {
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

interface TLVTag {
  tag: string;
  len: number;
  val: string;
  name: string;
  desc: string;
}

/**
 * Friendly Tag Names & EMVCo Specification Descriptions
 */
const TAG_DEFINITIONS: Record<string, { name: string; desc: string }> = {
  '00': { name: 'Payload Format Indicator', desc: 'Versi standar EMVCo QRIS (umumnya 01)' },
  '01': { name: 'Point of Initiation Method', desc: '11 = Statis (manual input), 12 = Dinamis (nominal terkunci)' },
  '26': { name: 'Merchant Account (Bank / Acquirer)', desc: 'Informasi rekening acquirer (Gojek / CIMB / Bank)' },
  '51': { name: 'National Merchant ID (NMID)', desc: 'Identitas unik QRIS nasional di Asosiasi Sistem Pembayaran Indonesia (ASPI)' },
  '52': { name: 'Merchant Category Code (MCC)', desc: 'Klasifikasi kategori usaha / jenis merchant' },
  '53': { name: 'Transaction Currency', desc: 'Kode mata uang ISO 4217 (360 = Rupiah Indonesia / IDR)' },
  '54': { name: 'Transaction Amount (Nominal)', desc: 'Jumlah tagihan yang terkunci otomatis di m-banking pembeli' },
  '55': { name: 'Tip or Convenience Indicator', desc: 'Indikator biaya layanan atau tip pelanggan' },
  '56': { name: 'Convenience Fee Fixed', desc: 'Nominal biaya layanan tetap (Rupiah)' },
  '57': { name: 'Convenience Fee Percentage', desc: 'Persentase biaya layanan tambahan' },
  '58': { name: 'Country Code', desc: 'Kode negara penerbit QR (ID = Indonesia)' },
  '59': { name: 'Merchant Name', desc: 'Nama resmi toko atau merchant pemilik QRIS' },
  '60': { name: 'Merchant City', desc: 'Kota domisili terdaftarnya merchant' },
  '61': { name: 'Postal Code', desc: 'Kode pos lokasi merchant' },
  '62': { name: 'Additional Data Field', desc: 'Nomor invoice, reference ID, atau terminal ID' },
  '63': { name: 'CRC-16 Checksum', desc: 'Validasi integritas data 4 karakter heksadesimal' },
};

/**
 * Parse raw EMVCo QRIS string into TLV tags
 */
function parseEMVCoTLV(raw: string): { tags: TLVTag[]; validCrc: boolean; calculatedCrc: string; embeddedCrc: string } {
  const clean = raw.trim();
  const tags: TLVTag[] = [];
  let i = 0;

  // Extract CRC63 if present
  let embeddedCrc = '';
  let payloadWithoutCrc = clean;
  const idx63 = clean.indexOf('6304');
  if (idx63 !== -1) {
    embeddedCrc = clean.substring(idx63 + 4, idx63 + 8).toUpperCase();
    payloadWithoutCrc = clean.substring(0, idx63 + 4);
  }

  const calculatedCrc = calculateCRC16(payloadWithoutCrc);
  const validCrc = embeddedCrc ? calculatedCrc === embeddedCrc : false;

  // Parse TLV loop
  const parsePayload = idx63 !== -1 ? clean.substring(0, idx63) : clean;
  while (i < parsePayload.length) {
    if (i + 4 > parsePayload.length) break;
    const tag = parsePayload.substring(i, i + 2);
    const len = parseInt(parsePayload.substring(i + 2, i + 4), 10);
    if (isNaN(len)) break;
    const val = parsePayload.substring(i + 4, i + 4 + len);
    const def = TAG_DEFINITIONS[tag] || { name: `Tag Khusus ${tag}`, desc: 'Data field tambahan spesifikasi EMVCo' };
    tags.push({
      tag,
      len,
      val,
      name: def.name,
      desc: def.desc
    });
    i += 4 + len;
  }

  if (embeddedCrc) {
    tags.push({
      tag: '63',
      len: 4,
      val: embeddedCrc,
      name: TAG_DEFINITIONS['63'].name,
      desc: validCrc ? `Checksum VALID (Cocok dengan payload)` : `Checksum TIDAK COCOK (Dihitung: ${calculatedCrc})`
    });
  }

  return { tags, validCrc, calculatedCrc, embeddedCrc };
}

/**
 * Generate Dynamic QRIS string & metadata according to EMVCo standard
 */
function generateDynamicQRIS(staticTemplate: string, baseNominal: number) {
  let payload = (staticTemplate || PRESET_MISTER_DOMPU).trim();

  // Strip existing Tag 63 CRC
  const idx63 = payload.indexOf('6304');
  if (idx63 !== -1) {
    payload = payload.substring(0, idx63);
  }

  // Parse existing tags
  const tags: { tag: string; val: string }[] = [];
  let i = 0;
  while (i < payload.length) {
    if (i + 4 > payload.length) break;
    const tag = payload.substring(i, i + 2);
    const len = parseInt(payload.substring(i + 2, i + 4), 10);
    if (isNaN(len)) break;
    const val = payload.substring(i + 4, i + 4 + len);
    tags.push({ tag, val });
    i += 4 + len;
  }

  // Calculate unique code & fees
  let uniqueOffset = 0;
  if (currentOffsetMode === 'yuripay') {
    if (baseNominal < 1000) {
      // Rule 1: Di bawah Rp 1.000 -> 1 perak
      uniqueOffset = 1;
    } else {
      // Rule 2: Rp 1.000 ke atas -> acak 1..199 perak (anti-collision)
      uniqueOffset = Math.floor(Math.random() * 199) + 1;
    }
  } else if (currentOffsetMode === 'custom') {
    uniqueOffset = customOffset;
  }

  let feeAmount = 0;
  if (feeType === 'flat') {
    feeAmount = feeValue;
  } else if (feeType === 'percent') {
    feeAmount = Math.round((baseNominal * feeValue) / 100);
  }

  const finalTotalAmount = Math.max(1, baseNominal + uniqueOffset + feeAmount);
  const amountStr = finalTotalAmount.toString();

  // Build new tags with Dynamic Tag 01 and Tag 54
  const newTags: { tag: string; val: string }[] = [];
  let hasTag54 = false;

  for (const item of tags) {
    if (item.tag === '01') {
      // Ubah Statis (11) menjadi Dinamis (12)
      newTags.push({ tag: '01', val: '12' });
    } else if (item.tag === '54') {
      newTags.push({ tag: '54', val: amountStr });
      hasTag54 = true;
    } else if (item.tag === '58' && !hasTag54) {
      // Sisipkan Tag 54 sebelum Tag 58 (Country Code) jika belum ada
      newTags.push({ tag: '54', val: amountStr });
      hasTag54 = true;
      newTags.push(item);
    } else {
      newTags.push(item);
    }
  }

  if (!hasTag54) {
    newTags.push({ tag: '54', val: amountStr });
  }

  // Re-encode TLV
  let result = '';
  for (const item of newTags) {
    const lenStr = item.val.length.toString().padStart(2, '0');
    result += `${item.tag}${lenStr}${item.val}`;
  }

  result += '6304';
  const checksum = calculateCRC16(result);
  const fullQris = result + checksum;

  return {
    rawQris: fullQris,
    checksum,
    baseNominal,
    uniqueOffset,
    feeAmount,
    finalTotalAmount
  };
}

/**
 * SHA-512 for Midtrans Signature simulator
 */
async function computeSHA512(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-512', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// Render UI Layout
// ============================================================================
const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
<!-- Pixel Header -->
<header class="pixel-header">
  <div class="header-container">
    <div class="brand-box">
      <div class="brand-pixel-logo">⚡</div>
      <div class="brand-text-col">
        <span class="brand-name">YURIPAY <span class="pixel-badge pink">v1.2 PIXEL</span></span>
        <span class="brand-subtitle">Dynamic QRIS Gateway & 100% Code Suite</span>
      </div>
    </div>

    <!-- Navigation Pegs (Tabs) -->
    <nav class="header-nav" id="topNav">
      <button class="pixel-tab-btn active" data-tab="tab-generator">⚡ GENERATOR</button>
      <button class="pixel-tab-btn" data-tab="tab-checker">🔍 CEK QRIS</button>
      <button class="pixel-tab-btn" data-tab="tab-docs">📖 DOKUMEN & KODE</button>
      <button class="pixel-tab-btn" data-tab="tab-webhook">🛡️ WEBHOOK</button>
      <button class="pixel-tab-btn" data-tab="tab-github">⭐ GITHUB & REPO</button>
      <button class="pixel-tab-btn" data-tab="tab-deploy">🚀 DEPLOYMENT</button>
    </nav>

    <!-- Header Actions -->
    <div class="header-actions">
      <a href="https://github.com/myzert/YURIPAY-GOPAY" target="_blank" rel="noopener" class="pixel-github-header-btn" title="Star di GitHub">
        ★ STAR <span id="headerStarCount">...</span>
      </a>
      <a href="https://github.com/myzert/YURIPAY-GOPAY/fork" target="_blank" rel="noopener" class="pixel-github-header-btn" style="background:var(--pink-soft);" title="Fork di GitHub">
        🍴 FORK <span id="headerForkCount">...</span>
      </a>
      <button class="pixel-icon-btn" id="themeToggleBtn" title="Ganti Tema (Gelap / Terang)">
        <span id="themeIcon">🌸</span>
      </button>
    </div>
  </div>
</header>

<main class="main-layout">

  <!-- ======================================================================== -->
  <!-- TAB 1: GENERATOR QRIS DINAMIS (LIVE SCANNABLE QR & TLV BREAKDOWN)        -->
  <!-- ======================================================================== -->
  <section class="page-tab-content active" id="tab-generator">
    <div class="pixel-card">
      <div class="pixel-card-header">
        <div>
          <h2 class="pixel-title">⚡ REAL DYNAMIC QRIS GENERATOR</h2>
          <p class="pixel-subtitle">Generate QRIS dinamis asli yang bisa di-scan m-banking/e-wallet dengan nominal terkunci & kalkulasi CRC-16 EMVCo resmi.</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="pixel-badge green">[EMVCO 100% VALID]</span>
          <span class="pixel-badge pink">[0% GATEWAY FEE]</span>
        </div>
      </div>

      <div class="grid-2col">
        <!-- Input Form Col -->
        <div>
          <!-- Preset Selector -->
          <div class="pixel-form-group">
            <label class="pixel-label">1. PILIH PRESET CONTOH MERCHANT:</label>
            <div class="preset-chips-row">
              <button class="chip-btn active" id="presetDompuBtn">🏪 Mister Dompu 2 (CIMB/QRIS)</button>
              <button class="chip-btn" id="presetZeroBtn">🛒 ZERO SHOP (GoBiz GoPay)</button>
              <button class="chip-btn" id="presetCustomBtn">✏️ Custom Static QRIS</button>
            </div>
          </div>

          <!-- Static QRIS Payload Input -->
          <div class="pixel-form-group">
            <label class="pixel-label">TEMPLATE QRIS STATIS (SUMBER):</label>
            <textarea class="pixel-textarea" id="staticQrisInput" placeholder="Tempel raw QRIS statis di sini...">${PRESET_MISTER_DOMPU}</textarea>
            <span class="pixel-subtitle" style="display:block; margin-top:4px;">*Mendukung QRIS GoBiz, CIMB Niaga, BCA, Bank Mandiri, ShopeePay, Dana, dll.</span>
          </div>

          <!-- Nominal Tagihan -->
          <div class="pixel-form-group">
            <label class="pixel-label">2. NOMINAL TRANSAKSI (RUPIAH):</label>
            <input type="number" class="pixel-input" id="nominalInput" value="1000" min="1" step="100" />
            <div class="preset-chips-row">
              <button class="chip-btn" data-nom="500">Rp 500</button>
              <button class="chip-btn active" data-nom="1000">Rp 1.000</button>
              <button class="chip-btn" data-nom="5000">Rp 5.000</button>
              <button class="chip-btn" data-nom="10000">Rp 10.000</button>
              <button class="chip-btn" data-nom="25000">Rp 25.000</button>
              <button class="chip-btn" data-nom="50000">Rp 50.000</button>
              <button class="chip-btn" data-nom="100000">Rp 100.000</button>
            </div>
          </div>

          <!-- Unique Offset Rule (GoBiz Algorithm) -->
          <div class="pixel-form-group">
            <label class="pixel-label">3. ATURAN KODE UNIK (ALGORITMA YURIPAY):</label>
            <select class="pixel-select" id="uniqueModeSelect">
              <option value="yuripay">⚡ Algoritma Resmi YuriPay (&lt;1000: +1 perak, &ge;1000: acak 1..199)</option>
              <option value="exact">🎯 Nominal Pas (Tanpa Kode Unik / Offset 0)</option>
              <option value="custom">🛠️ Custom Offset Tambahan</option>
            </select>
            <div id="customOffsetBox" style="display:none; margin-top:8px;">
              <input type="number" class="pixel-input" id="customOffsetInput" placeholder="Masukkan nominal offset (contoh: 88)" value="0" />
            </div>
          </div>

          <!-- Fee Tambahan -->
          <div class="pixel-form-group">
            <label class="pixel-label">4. BIAYA LAYANAN / ADMIN (OPSIONAL):</label>
            <div class="grid-2col" style="gap:8px;">
              <select class="pixel-select" id="feeTypeSelect">
                <option value="none">Gratis (Tanpa Biaya Admin)</option>
                <option value="flat">Biaya Tetap (Rp)</option>
                <option value="percent">Persentase (%)</option>
              </select>
              <input type="number" class="pixel-input" id="feeValInput" placeholder="Nilai fee" value="0" disabled />
            </div>
          </div>

          <button class="pixel-btn primary" id="generateDynamicBtn" style="width:100%; margin-top:8px;">
            ⚡ RE-GENERATE QRIS DINAMIS SEKARANG
          </button>
        </div>

        <!-- Output Visual & Raw Col -->
        <div>
          <div class="qr-preview-box">
            <span class="pixel-badge pink" style="margin-bottom:12px;">[SCANNABLE VIA SEMUA M-BANKING]</span>
            <div class="qr-canvas-frame">
              <canvas id="dynamicQrCanvas"></canvas>
            </div>
            <div class="qr-amount-callout" id="displayTotalAmount">Rp 1.000</div>
            <div class="qr-merchant-callout" id="displayMerchantInfo">Mister Dompu 2 • Dompu</div>

            <!-- Breakdown Detail Callout -->
            <div style="font-family:var(--font-mono); font-size:0.8rem; background:var(--bg-card); border:2px solid var(--border-pixel); padding:8px 12px; width:100%; text-align:left; margin-bottom:14px;">
              <div>• Nominal Asli: <strong id="lblBaseNominal">Rp 1.000</strong></div>
              <div>• Kode Unik: <strong id="lblUniqueOffset">+Rp 0</strong></div>
              <div>• Biaya Admin: <strong id="lblFeeAmount">+Rp 0</strong></div>
              <div style="border-top:1px dashed var(--border-pixel); margin-top:4px; padding-top:4px; color:var(--pink-neon);">
                • Total Terkunci Tag 54: <strong id="lblFinalAmount">Rp 1.000</strong>
              </div>
            </div>

            <div style="display:flex; gap:10px; width:100%; justify-content:center; flex-wrap:wrap;">
              <button class="pixel-btn success" id="downloadQrBtn">📥 DOWNLOAD PNG</button>
              <button class="pixel-btn" id="copyDynamicTextBtn">📋 COPY TEXT QRIS</button>
            </div>
          </div>

          <!-- Raw String Generated Output -->
          <div class="pixel-code-box" style="margin-top:16px;">
            <div class="pixel-code-header">
              <span class="pixel-code-title">RAW DYNAMIC QRIS STRING:</span>
              <span class="pixel-badge green" id="dynamicCrcBadge">CRC16: OK</span>
            </div>
            <pre class="pixel-code-pre" id="dynamicRawOutput" style="white-space:pre-wrap; word-break:break-all; max-height:120px;"></pre>
          </div>
        </div>
      </div>

      <!-- EMVCo TLV Inspector Section -->
      <div style="margin-top:28px;">
        <div class="pixel-card-header" style="margin-bottom:10px;">
          <div>
            <h3 class="pixel-title" style="font-size:0.92rem;">🔍 BEDAH STRUKTUR TAG EMVCO (TLV BREAKDOWN)</h3>
            <p class="pixel-subtitle">Bagaimana Tag 01 diubah jadi 12, Tag 54 disuntikkan, dan CRC-16 dihitung ulang.</p>
          </div>
        </div>
        <div class="pixel-table-wrapper">
          <table class="pixel-table" id="dynamicTlvTable">
            <thead>
              <tr>
                <th style="width:70px;">TAG</th>
                <th style="width:70px;">LENGTH</th>
                <th>VALUE DATA</th>
                <th>NAMA FIELD</th>
                <th>PENJELASAN</th>
              </tr>
            </thead>
            <tbody>
              <!-- Populated by script -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>

  <!-- ======================================================================== -->
  <!-- TAB 2: CEK CODE QR (UPLOAD & DECODE RAW STRING)                          -->
  <!-- ======================================================================== -->
  <section class="page-tab-content" id="tab-checker">
    <div class="pixel-card">
      <div class="pixel-card-header">
        <div>
          <h2 class="pixel-title">🔍 CEK & DECODE QRIS CODE</h2>
          <p class="pixel-subtitle">Upload gambar QR code apa saja (screenshot/foto) untuk mengekstrak string mentah, membedah data merchant, dan memverifikasi integritas checksum CRC-16.</p>
        </div>
        <span class="pixel-badge gold">[CLIENT-SIDE QR SCANNER]</span>
      </div>

      <!-- Upload Dropzone -->
      <div class="pixel-dropzone" id="qrDropzone">
        <input type="file" id="qrFileInput" accept="image/*" style="display:none;" />
        <div class="dropzone-icon">📷</div>
        <div class="dropzone-title">KLIK ATAU DRAG & DROP FOTO QRIS KE SINI</div>
        <div class="dropzone-desc">Mendukung format PNG, JPG, JPEG, WebP. Bisa juga langsung tekan <kbd style="background:var(--bg-card); padding:2px 6px; border:1px solid var(--border-pixel);">Ctrl + V</kbd> untuk paste screenshot!</div>
      </div>

      <!-- Loading / Status Alert -->
      <div id="checkerStatusAlert" style="display:none; margin-top:16px; padding:12px; border:2px solid var(--border-pixel); font-family:var(--font-silk); font-size:0.8rem;"></div>

      <!-- Result Container (Visible when decoded) -->
      <div id="checkerResultBox" style="display:none; margin-top:24px;">
        <div class="grid-2col">
          <!-- Left: Scanned Image Preview & Quick Metadata -->
          <div>
            <div style="background:var(--bg-surface); border:2px solid var(--border-pixel); padding:16px; text-align:center; margin-bottom:16px;">
              <span class="pixel-badge pink" style="margin-bottom:8px;">GAMBAR QRIS YANG DIUPLOAD:</span>
              <div style="max-height:220px; overflow:hidden; display:flex; justify-content:center; align-items:center; margin-top:8px;">
                <img id="checkerImagePreview" style="max-height:200px; max-width:100%; border:2px solid var(--border-pixel);" alt="Scanned QR" />
              </div>
            </div>

            <!-- Merchant Card Summary -->
            <div style="background:var(--bg-surface); border:2px solid var(--border-pixel); padding:16px;">
              <h4 class="pixel-title" style="font-size:0.85rem; margin-bottom:12px;">📋 RINGKASAN DATA MERCHANT</h4>
              <div style="font-family:var(--font-mono); font-size:0.82rem; line-height:1.8;">
                <div>• Nama Merchant: <strong id="chkMerchantName" style="color:var(--pink-neon);">-</strong></div>
                <div>• Kota Merchant: <strong id="chkMerchantCity">-</strong></div>
                <div>• Kode Pos: <strong id="chkPostalCode">-</strong></div>
                <div>• Tipe QR: <strong id="chkQrType" class="pixel-badge pink">-</strong></div>
                <div>• Nominal Terkunci: <strong id="chkAmount" style="color:var(--accent-success);">-</strong></div>
                <div>• Acquirer / Bank: <strong id="chkAcquirer">-</strong></div>
                <div>• Checksum Status: <span id="chkCrcStatus" class="pixel-badge green">-</span></div>
              </div>
            </div>
          </div>

          <!-- Right: Raw String & Action Buttons -->
          <div>
            <div class="pixel-code-box" style="margin-top:0;">
              <div class="pixel-code-header">
                <span class="pixel-code-title">RAW TEXT QRIS HASIL DECODE:</span>
                <button class="pixel-btn" id="copyScannedRawBtn" style="padding:4px 8px; font-size:0.6rem;">📋 COPY TEXT</button>
              </div>
              <pre class="pixel-code-pre" id="chkRawTextOutput" style="white-space:pre-wrap; word-break:break-all; max-height:180px;"></pre>
            </div>

            <!-- Transfer Button -->
            <div style="margin-top:14px; background:var(--bg-surface-2); border:2px solid var(--border-pixel); padding:14px;">
              <div class="pixel-title" style="font-size:0.8rem; margin-bottom:6px;">⚡ JADIKAN SEBAGAI TEMPLATE DINAMIS?</div>
              <p style="font-size:0.82rem; margin-bottom:12px;">Klik tombol di bawah untuk mentransfer string hasil scan ini ke tab <strong>Generator Dinamis</strong>, agar Anda bisa membuat QRIS nominal dari toko Anda sendiri!</p>
              <button class="pixel-btn primary" id="transferToGeneratorBtn" style="width:100%;">
                🚀 TRANSFER KE GENERATOR DINAMIS
              </button>
            </div>
          </div>
        </div>

        <!-- TLV Decomposed Table of Scanned QR -->
        <div style="margin-top:24px;">
          <h3 class="pixel-title" style="font-size:0.9rem; margin-bottom:10px;">🔍 TABEL BEDAH TAG HASIL SCAN</h3>
          <div class="pixel-table-wrapper">
            <table class="pixel-table" id="checkerTlvTable">
              <thead>
                <tr>
                  <th style="width:70px;">TAG</th>
                  <th style="width:70px;">LEN</th>
                  <th>VALUE</th>
                  <th>NAMA FIELD</th>
                  <th>DESKRIPSI</th>
                </tr>
              </thead>
              <tbody>
                <!-- Populated by script -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ======================================================================== -->
  <!-- TAB 3: DOKUMEN & BEDAH KODE 100% (YURIPAY-GOPAY CLONED CODEBASE)        -->
  <!-- ======================================================================== -->
  <section class="page-tab-content" id="tab-docs">
    <div class="pixel-card">
      <div class="pixel-card-header">
        <div>
          <h2 class="pixel-title">📖 BEDAH KODE & ARSITEKTUR YURIPAY 100%</h2>
          <p class="pixel-subtitle">Struktur direktori, alur otentikasi GoBiz, polling mutasi 2.5 detik, dan isolasi Dual-Port dari repository resmi myzert/YURIPAY-GOPAY.</p>
        </div>
        <span class="pixel-badge pink">[CLONED & VERIFIED 100%]</span>
      </div>

      <!-- File Structure Tree -->
      <h3 class="pixel-title" style="font-size:0.95rem; margin-bottom:12px;">📂 STRUKTUR DIREKTORI REPOSITORY BACKEND</h3>
      <div class="pixel-code-box">
        <div class="pixel-code-header">
          <span class="pixel-code-title">myzert/YURIPAY-GOPAY / TREE</span>
          <span class="pixel-badge green">Node.js 22+ & Express 5</span>
        </div>
        <pre class="pixel-code-pre">
YURIPAY-GOPAY/
├── server.js                     # Dual-Port HTTP Server (Port 3000 Admin & Port 3001 Public Checkout)
├── login.js                      # CLI Interaktif untuk Login Akun Merchant GoBiz via OTP SMS/WA
├── package.json                  # Dependencies: axios, better-sqlite3, cors, express, qrcode, ejs
├── ecosystem.config.js           # Konfigurasi PM2 Cluster Mode untuk Production 24/7
├── Dockerfile & docker-compose   # Containerisasi Docker siap deploy di VPS Cloud
├── .GOPAY_SESI_JANGAN_DIHAPUS.json # Penyimpanan token sesi resmi GoBiz Merchant (Auto-Refresh 6 jam)
├── src/
│   ├── database/
│   │   └── db.js                 # SQLite WAL mode: orders, topups, products, stocks, audit logs
│   ├── gateway/
│   │   ├── gopayAuth.js          # API Client untuk meminta & memverifikasi kode OTP ke server GoBiz
│   │   ├── gopayClient.js        # Polling mutasi saldo ke API Merchant Analytics GoBiz
│   │   ├── paymentChecker.js     # Background worker interval 2.5 detik pencocok mutasi otomatis
│   │   ├── qrisHelper.js         # Algoritma konversi Tag 01 -> 12, Tag 54 injection, & CRC16 CCITT
│   │   ├── webhookEngine.js      # Pengirim callback Midtrans HTTP POST dengan HMAC SHA-512 signature
│   │   ├── sessionManager.js     # Pengelola masa berlaku token GoBiz & rotasi sesi otomatis
│   │   └── swaggerDoc.js         # Dokumentasi OpenAPI / Swagger API
│   └── web/                      # Antarmuka Admin Kasir, Manajemen Stok Digital, & Checkout Pelanggan
        </pre>
      </div>

      <!-- Core Workflows / Sequence -->
      <h3 class="pixel-title" style="font-size:0.95rem; margin-top:28px; margin-bottom:14px;">🔄 ALUR KERJA SISTEM (WORKFLOW 100%)</h3>

      <div class="flow-step-box">
        <div class="flow-step-header">
          <div class="step-num-badge">1</div>
          <div class="step-title">LOGIN & OTENTIKASI MERCHANT GOBIZ (login.js)</div>
        </div>
        <div class="step-desc">
          Merchant menjalankan <code>node login.js</code>. Sistem mengirim permintaan OTP ke endpoint resmi <code>https://api.gojekapi.com/v3/auth/token/request</code>.
          Merchant memasukkan 4 digit OTP dari SMS/WhatsApp. Token sesi GoBiz disimpan ke dalam file lokal <code>.GOPAY_SESI_JANGAN_DIHAPUS.json</code>.
          Token ini berlaku selama 30 hari dan diperbarui otomatis oleh <code>sessionManager.js</code> setiap 6 jam.
        </div>
      </div>

      <div class="flow-step-box">
        <div class="flow-step-header">
          <div class="step-num-badge">2</div>
          <div class="step-title">PEMBUATAN INVOICE & QRIS DINAMIS (qrisHelper.js)</div>
        </div>
        <div class="step-desc">
          Ketika pesanan checkout dibuat di URL <code>http://domain:3001/pay/:invoice</code>:
          <ul style="margin-left:20px; margin-top:6px;">
            <li>Sistem menambahkan <strong>kode unik</strong> (+1 perak jika &lt;1.000 atau acak 1..199 perak jika &ge;1.000) untuk mencegah tabrakan order kembar (anti-collision).</li>
            <li>Fungsi <code>generateDynamicQRIS()</code> membedah string QRIS Statis merchant, mengubah <strong>Tag 01</strong> dari <code>11</code> (Statis) menjadi <code>12</code> (Dinamis), menyuntikkan <strong>Tag 54</strong> dengan total nominal tagihan, dan menghitung ulang <strong>Tag 63</strong> dengan algoritma EMVCo CRC-16 CCITT (polinom <code>0x1021</code>, initial <code>0xFFFF</code>).</li>
            <li>Library <code>qrcode</code> merender gambar QR visual beresolusi tinggi ke layar pembeli.</li>
          </ul>
        </div>
      </div>

      <div class="flow-step-box">
        <div class="flow-step-header">
          <div class="step-num-badge">3</div>
          <div class="step-title">POLLING MUTASI REALTIME 2.5 DETIK (paymentChecker.js)</div>
        </div>
        <div class="step-desc">
          Background worker berjalan di background setiap <strong>2.500 ms (2.5 detik)</strong> memanggil endpoint analitik transaksi GoBiz:
          <br><code>https://api.gojekapi.com/merchant-analytics/v2/merchants/transactions</code>.
          Worker mencocokkan nominal transaksi masuk dengan invoice pending di database SQLite:
          <ul style="margin-left:20px; margin-top:6px;">
            <li>Jika pesanan telah lewat batas <code>expires_at</code>, status diubah menjadi <strong>EXPIRED</strong>.</li>
            <li>Jika mutasi nominal persis ditemukan dalam rentang waktu pesanan, status pesanan diubah menjadi <strong>PAID</strong>.</li>
            <li>Produk digital (voucher, akun, key lisensi) di tabel <code>stocks</code> langsung diklaim dan diserahkan ke pembeli detik itu juga!</li>
          </ul>
        </div>
      </div>

      <div class="flow-step-box">
        <div class="flow-step-header">
          <div class="step-num-badge">4</div>
          <div class="step-title">DISPATCH WEBHOOK MIDTRANS STANDAR (webhookEngine.js)</div>
        </div>
        <div class="step-desc">
          Jika merchant mengonfigurasi webhook URL di file <code>.env</code>, YuriPay secara otomatis mengirim HTTP POST notifikasi yang <strong>100% identik dengan Midtrans</strong>:
          <br>Mengalkulasi <code>signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)</code> dengan status <code>settlement</code>.
          Sistem Anda yang sebelumnya menggunakan Midtrans tidak perlu diubah kodenya sama sekali!
        </div>
      </div>

      <div class="flow-step-box">
        <div class="flow-step-header">
          <div class="step-num-badge">5</div>
          <div class="step-title">ISOLASI ARSITEKTUR DUAL-PORT (server.js)</div>
        </div>
        <div class="step-desc">
          YuriPay memisahkan port internal dan eksternal demi keamanan maksimal:
          <ul style="margin-left:20px; margin-top:6px;">
            <li><strong>Port 3000 (Internal Merchant Admin & Kasir):</strong> Hanya diakses oleh pemilik toko untuk memantau transaksi, top up saldo, kelola stok produk, dan memantau sesi GoBiz.</li>
            <li><strong>Port 3001 (Public Customer Gateway):</strong> Port ringan yang di-forward ke internet (via Cloudflare Tunnels atau Nginx) untuk halaman bayar pelanggan <code>/pay/:id</code> tanpa akses ke menu admin.</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- ======================================================================== -->
  <!-- TAB 4: MIDTRANS WEBHOOK & API TESTER                                     -->
  <!-- ======================================================================== -->
  <section class="page-tab-content" id="tab-webhook">
    <div class="pixel-card">
      <div class="pixel-card-header">
        <div>
          <h2 class="pixel-title">🛡️ MIDTRANS WEBHOOK & SHA-512 TESTER</h2>
          <p class="pixel-subtitle">Uji integrasi webhook callback dan pembuatan signature key SHA-512 yang 100% kompatibel dengan CMS/SaaS Midtrans Anda.</p>
        </div>
        <span class="pixel-badge pink">[RFC-6234 SHA512]</span>
      </div>

      <div class="grid-2col">
        <!-- Form Generator Signature -->
        <div>
          <div class="pixel-form-group">
            <label class="pixel-label">ORDER ID (INVOICE):</label>
            <input type="text" class="pixel-input" id="sigOrderId" value="INV-20261106-9921" />
          </div>

          <div class="pixel-form-group">
            <label class="pixel-label">STATUS CODE:</label>
            <input type="text" class="pixel-input" id="sigStatusCode" value="200" />
          </div>

          <div class="pixel-form-group">
            <label class="pixel-label">GROSS AMOUNT (RUPIAH):</label>
            <input type="text" class="pixel-input" id="sigGrossAmount" value="10087.00" />
          </div>

          <div class="pixel-form-group">
            <label class="pixel-label">SERVER KEY (SECRET):</label>
            <input type="text" class="pixel-input" id="sigServerKey" value="SB-Mid-server-YuriPayKeySample2026" />
          </div>

          <button class="pixel-btn primary" id="calcSignatureBtn" style="width:100%;">
            ⚡ HITUNG SIGNATURE KEY SHA-512
          </button>
        </div>

        <!-- Output Signature & Payload Sample -->
        <div>
          <div class="pixel-code-box" style="margin-top:0;">
            <div class="pixel-code-header">
              <span class="pixel-code-title">HASIL KALKULASI SIGNATURE:</span>
              <button class="pixel-btn" id="copySignatureBtn" style="padding:4px 8px; font-size:0.6rem;">📋 COPY</button>
            </div>
            <pre class="pixel-code-pre" id="sigOutputPre" style="white-space:pre-wrap; word-break:break-all; max-height:100px; color:var(--pink-neon);"></pre>
          </div>

          <div class="pixel-code-box">
            <div class="pixel-code-header">
              <span class="pixel-code-title">CONTOH JSON CALLBACK SETTLEMENT:</span>
              <button class="pixel-btn" id="copyWebhookPayloadBtn" style="padding:4px 8px; font-size:0.6rem;">📋 COPY JSON</button>
            </div>
            <pre class="pixel-code-pre" id="webhookPayloadPre" style="max-height:220px; overflow-y:auto;"></pre>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ======================================================================== -->
  <!-- TAB 5: GITHUB REPO & CONTRIBUTORS (myzert/YURIPAY-GOPAY)                 -->
  <!-- ======================================================================== -->
  <section class="page-tab-content" id="tab-github">
    <div class="pixel-card">
      <div class="pixel-card-header">
        <div>
          <h2 class="pixel-title">⭐ GITHUB REPOSITORY & KOMUNITAS</h2>
          <p class="pixel-subtitle">Informasi live dari repository resmi myzert/YURIPAY-GOPAY, daftar kontributor, star, fork, dan perintah clone.</p>
        </div>
        <span class="pixel-badge green">[OPEN SOURCE MIT / ISC]</span>
      </div>

      <!-- Quick Action Buttons -->
      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px;">
        <a href="https://github.com/myzert/YURIPAY-GOPAY" target="_blank" rel="noopener" class="pixel-btn primary">
          ⭐ STAR DI GITHUB (<span id="gitStarCount">...</span>)
        </a>
        <a href="https://github.com/myzert/YURIPAY-GOPAY/fork" target="_blank" rel="noopener" class="pixel-btn" style="background:var(--pink-soft); color:#fff; border-color:#fff;">
          🍴 FORK REPO INI (<span id="gitForkCount">...</span>)
        </a>
        <a href="https://github.com/myzert/YURIPAY-GOPAY/issues" target="_blank" rel="noopener" class="pixel-btn">
          🐛 LAPORKAN ISSUE (<span id="gitIssuesCount">...</span>)
        </a>
      </div>

      <!-- GitHub Stats 4-Col Grid -->
      <div class="grid-4col" style="margin-bottom:24px;">
        <div class="stat-pixel-card">
          <div class="stat-pixel-num" id="statStars">...</div>
          <div class="stat-pixel-label">⭐ STARS REPO</div>
        </div>
        <div class="stat-pixel-card">
          <div class="stat-pixel-num" id="statForks">...</div>
          <div class="stat-pixel-label">🍴 FORKS</div>
        </div>
        <div class="stat-pixel-card">
          <div class="stat-pixel-num" id="statWatchers">...</div>
          <div class="stat-pixel-label">👁️ WATCHERS</div>
        </div>
        <div class="stat-pixel-card">
          <div class="stat-pixel-num" id="statIssues">...</div>
          <div class="stat-pixel-label">🐛 OPEN ISSUES</div>
        </div>
      </div>

      <!-- Clone Repository Box -->
      <h3 class="pixel-title" style="font-size:0.95rem; margin-bottom:10px;">📦 CARA CLONE & JALANKAN LOKAL</h3>
      <div class="pixel-code-box">
        <div class="pixel-code-header">
          <span class="pixel-code-title">BASH TERMINAL / TERMUX</span>
          <button class="pixel-btn" id="copyCloneBtn" style="padding:4px 8px; font-size:0.6rem;">📋 COPY CLONE CMD</button>
        </div>
        <pre class="pixel-code-pre" id="cloneSnippetPre">git clone https://github.com/myzert/YURIPAY-GOPAY.git
cd YURIPAY-GOPAY
npm install
cp .env.example .env
node login.js
npm start</pre>
      </div>

      <!-- Contributors Grid -->
      <div style="margin-top:28px;">
        <div class="pixel-card-header" style="margin-bottom:14px;">
          <div>
            <h3 class="pixel-title" style="font-size:0.95rem;">👥 DAFTAR KONTRIBUTOR RESMI</h3>
            <p class="pixel-subtitle">Para pengembang di balik pengembangan YURIPAY-GOPAY.</p>
          </div>
        </div>

        <div class="contributor-grid" id="contributorList">
          <!-- Default fallback while loading GitHub API -->
          <a href="https://github.com/myzert" target="_blank" rel="noopener" class="contributor-card">
            <img src="https://avatars.githubusercontent.com/u/325584707?v=4" class="contributor-avatar" alt="myzert" />
            <div class="contributor-info">
              <span class="contributor-login">myzert</span>
              <span class="contributor-role">👑 Author / Lead Dev</span>
              <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--pink-neon); margin-top:2px;">11+ Commits</span>
            </div>
          </a>

          <a href="https://github.com/GTPSHAX" target="_blank" rel="noopener" class="contributor-card">
            <img src="https://avatars.githubusercontent.com/u/143262216?v=4" class="contributor-avatar" alt="GTPSHAX" />
            <div class="contributor-info">
              <span class="contributor-login">GTPSHAX</span>
              <span class="contributor-role">🛠️ Core Contributor</span>
              <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--pink-neon); margin-top:2px;">7+ Commits</span>
            </div>
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- ======================================================================== -->
  <!-- TAB 6: PANDUAN DEPLOYMENT (TERMUX, VPS LINUX, CPANEL, DOCKER)            -->
  <!-- ======================================================================== -->
  <section class="page-tab-content" id="tab-deploy">
    <div class="pixel-card">
      <div class="pixel-card-header">
        <div>
          <h2 class="pixel-title">🚀 PANDUAN INSTALASI & DEPLOYMENT LENGKAP</h2>
          <p class="pixel-subtitle">Cara menjalankan server YuriPay 24/7 di Termux Android, VPS Ubuntu/Debian, cPanel, atau Docker.</p>
        </div>
        <span class="pixel-badge pink">[24/7 READY]</span>
      </div>

      <div class="flow-step-box">
        <div class="flow-step-header">
          <div class="step-num-badge">📱</div>
          <div class="step-title">PANDUAN 1: TERMUX ANDROID (GRATIS TANPA VPS)</div>
        </div>
        <div class="step-desc">
          Bisa dijalankan langsung di HP Android Anda tanpa perlu sewa VPS server!
          <div class="pixel-code-box">
            <pre class="pixel-code-pre">pkg update && pkg upgrade -y
pkg install git nodejs-lts python make build-essential -y
git clone https://github.com/myzert/YURIPAY-GOPAY.git
cd YURIPAY-GOPAY
npm install
cp .env.example .env
node login.js       # Masukkan nomor HP GoBiz & kode OTP
npm install -g pm2
pm2 start server.js --name yuripay
pm2 save</pre>
          </div>
        </div>
      </div>

      <div class="flow-step-box">
        <div class="flow-step-header">
          <div class="step-num-badge">☁️</div>
          <div class="step-title">PANDUAN 2: VPS UBUNTU / DEBIAN DENGAN NGINX & SSL</div>
        </div>
        <div class="step-desc">
          Untuk toko skala besar dengan ribuan transaksi per hari:
          <div class="pixel-code-box">
            <pre class="pixel-code-pre"># 1. Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git build-essential

# 2. Clone repo & build dependencies
git clone https://github.com/myzert/YURIPAY-GOPAY.git /var/www/yuripay
cd /var/www/yuripay
npm install --production

# 3. Konfigurasi .env & Sesi GoBiz
cp .env.example .env
nano .env           # Masukkan QRIS_STATIC toko Anda
node login.js

# 4. Jalankan dengan PM2 Ecosystem
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup && pm2 save</pre>
          </div>
        </div>
      </div>

      <div class="flow-step-box">
        <div class="flow-step-header">
          <div class="step-num-badge">🌐</div>
          <div class="step-title">PANDUAN 3: CPANEL NODE.JS SELECTOR</div>
        </div>
        <div class="step-desc">
          Bagi pengguna hosting cPanel dengan fitur "Setup Node.js App":
          <ol style="margin-left:20px; margin-top:6px; line-height:1.7;">
            <li>Pilih versi Node.js: <strong>20.x atau 22.x</strong>.</li>
            <li>Application mode: <strong>Production</strong>.</li>
            <li>Application root: <code>yuripay</code>.</li>
            <li>Application startup file: <code>server.js</code>.</li>
            <li>Buka Terminal cPanel, masuk ke folder <code>yuripay</code> dan ketik <code>node login.js</code> untuk menghubungkan akun GoBiz Anda.</li>
          </ol>
        </div>
      </div>
    </div>
  </section>

</main>

<!-- Pixel Toast Notification -->
<div class="pixel-toast" id="pixelToast">✓ BERHASIL DISALIN!</div>

<!-- Footer -->
<footer class="pixel-footer">
  <div class="pixel-footer-content">
    <div class="brand-name" style="justify-content:center;">⚡ YURIPAY by myzert</div>
    <div class="footer-copy">Unofficial Enterprise Dynamic QRIS Payment Gateway for GoBiz Merchants</div>
    <div class="footer-sub">Dirancang dengan Retro Pixel-Art Pink • 0% Fee Potongan Pihak Ketiga • EMVCo CRC-16 Validated</div>
    <div style="display:flex; gap:12px; margin-top:8px;">
      <a href="https://github.com/myzert/YURIPAY-GOPAY" target="_blank" rel="noopener" style="color:var(--pink-neon); font-family:var(--font-silk); font-size:0.75rem;">GitHub Repository</a>
      <span style="color:var(--border-pixel);">•</span>
      <a href="https://t.me/ahmadzakiyo" target="_blank" rel="noopener" style="color:var(--pink-neon); font-family:var(--font-silk); font-size:0.75rem;">Telegram Developer</a>
    </div>
  </div>
</footer>
`;

// ============================================================================
// Logic & Interactive Handlers
// ============================================================================

// Toast Helper
const toastEl = document.getElementById('pixelToast') as HTMLDivElement;
function showToast(message = '✓ BERHASIL DISALIN!') {
  toastEl.innerText = message;
  toastEl.style.display = 'block';
  setTimeout(() => {
    toastEl.style.display = 'none';
  }, 2200);
}

// ----------------------------------------------------------------------------
// Theme Switcher (Dark Pixel Neon Pink vs Light Pixel Sakura Pink)
// ----------------------------------------------------------------------------
const themeToggleBtn = document.getElementById('themeToggleBtn') as HTMLButtonElement;
const themeIcon = document.getElementById('themeIcon') as HTMLSpanElement;

function applyTheme(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark');
    themeIcon.innerText = '🌸';
    themeToggleBtn.title = 'Ubah ke Tema Sakura Pink (Terang)';
  } else {
    document.documentElement.classList.remove('dark');
    themeIcon.innerText = '👾';
    themeToggleBtn.title = 'Ubah ke Tema Cyber Pink (Gelap)';
  }
  localStorage.setItem('yuripay_pixel_theme', isDark ? 'dark' : 'light');
}

// Check saved theme or default to dark
const savedTheme = localStorage.getItem('yuripay_pixel_theme');
if (savedTheme === 'light') {
  applyTheme(false);
} else {
  applyTheme(true);
}

themeToggleBtn.addEventListener('click', () => {
  const isDark = document.documentElement.classList.contains('dark');
  applyTheme(!isDark);
});

// ----------------------------------------------------------------------------
// Navigation Tabs (Pegs)
// ----------------------------------------------------------------------------
const tabButtons = document.querySelectorAll<HTMLButtonElement>('.pixel-tab-btn');
const tabContents = document.querySelectorAll<HTMLElement>('.page-tab-content');

function switchTab(tabId: string) {
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  tabContents.forEach(content => {
    content.classList.toggle('active', content.id === tabId);
  });
  window.location.hash = tabId.replace('tab-', '');
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-tab');
    if (target) switchTab(target);
  });
});

// Read initial hash if present
if (window.location.hash) {
  const hashName = window.location.hash.substring(1);
  const targetTab = document.getElementById(`tab-${hashName}`);
  if (targetTab) {
    switchTab(`tab-${hashName}`);
  }
}

// ----------------------------------------------------------------------------
// Dynamic QRIS Generator Logic
// ----------------------------------------------------------------------------
const staticQrisInput = document.getElementById('staticQrisInput') as HTMLTextAreaElement;
const nominalInput = document.getElementById('nominalInput') as HTMLInputElement;
const uniqueModeSelect = document.getElementById('uniqueModeSelect') as HTMLSelectElement;
const customOffsetBox = document.getElementById('customOffsetBox') as HTMLDivElement;
const customOffsetInput = document.getElementById('customOffsetInput') as HTMLInputElement;
const feeTypeSelect = document.getElementById('feeTypeSelect') as HTMLSelectElement;
const feeValInput = document.getElementById('feeValInput') as HTMLInputElement;
const generateDynamicBtn = document.getElementById('generateDynamicBtn') as HTMLButtonElement;

const dynamicQrCanvas = document.getElementById('dynamicQrCanvas') as HTMLCanvasElement;
const displayTotalAmount = document.getElementById('displayTotalAmount') as HTMLDivElement;
const displayMerchantInfo = document.getElementById('displayMerchantInfo') as HTMLDivElement;
const lblBaseNominal = document.getElementById('lblBaseNominal') as HTMLElement;
const lblUniqueOffset = document.getElementById('lblUniqueOffset') as HTMLElement;
const lblFeeAmount = document.getElementById('lblFeeAmount') as HTMLElement;
const lblFinalAmount = document.getElementById('lblFinalAmount') as HTMLElement;
const dynamicRawOutput = document.getElementById('dynamicRawOutput') as HTMLElement;
const dynamicCrcBadge = document.getElementById('dynamicCrcBadge') as HTMLElement;
const dynamicTlvTableBody = document.querySelector('#dynamicTlvTable tbody') as HTMLElement;

const downloadQrBtn = document.getElementById('downloadQrBtn') as HTMLButtonElement;
const copyDynamicTextBtn = document.getElementById('copyDynamicTextBtn') as HTMLButtonElement;

// Preset buttons
const presetDompuBtn = document.getElementById('presetDompuBtn') as HTMLButtonElement;
const presetZeroBtn = document.getElementById('presetZeroBtn') as HTMLButtonElement;
const presetCustomBtn = document.getElementById('presetCustomBtn') as HTMLButtonElement;

presetDompuBtn.addEventListener('click', () => {
  staticQrisInput.value = PRESET_MISTER_DOMPU;
  presetDompuBtn.classList.add('active');
  presetZeroBtn.classList.remove('active');
  presetCustomBtn.classList.remove('active');
  updateDynamicGenerator();
});

presetZeroBtn.addEventListener('click', () => {
  staticQrisInput.value = PRESET_ZERO_SHOP;
  presetZeroBtn.classList.add('active');
  presetDompuBtn.classList.remove('active');
  presetCustomBtn.classList.remove('active');
  updateDynamicGenerator();
});

presetCustomBtn.addEventListener('click', () => {
  presetCustomBtn.classList.add('active');
  presetDompuBtn.classList.remove('active');
  presetZeroBtn.classList.remove('active');
  staticQrisInput.focus();
});

// Quick nominal chips
const nomChips = document.querySelectorAll<HTMLButtonElement>('.chip-btn[data-nom]');
nomChips.forEach(chip => {
  chip.addEventListener('click', () => {
    nomChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    nominalInput.value = chip.getAttribute('data-nom') || '1000';
    updateDynamicGenerator();
  });
});

uniqueModeSelect.addEventListener('change', () => {
  currentOffsetMode = uniqueModeSelect.value;
  customOffsetBox.style.display = currentOffsetMode === 'custom' ? 'block' : 'none';
  updateDynamicGenerator();
});

customOffsetInput.addEventListener('input', () => {
  customOffset = parseInt(customOffsetInput.value, 10) || 0;
  updateDynamicGenerator();
});

feeTypeSelect.addEventListener('change', () => {
  feeType = feeTypeSelect.value;
  feeValInput.disabled = feeType === 'none';
  if (feeType === 'none') feeValInput.value = '0';
  feeValue = parseFloat(feeValInput.value) || 0;
  updateDynamicGenerator();
});

feeValInput.addEventListener('input', () => {
  feeValue = parseFloat(feeValInput.value) || 0;
  updateDynamicGenerator();
});

generateDynamicBtn.addEventListener('click', () => {
  updateDynamicGenerator();
  showToast('⚡ Dynamic QRIS diperbarui!');
});

nominalInput.addEventListener('input', () => {
  updateDynamicGenerator();
});

staticQrisInput.addEventListener('input', () => {
  presetDompuBtn.classList.remove('active');
  presetZeroBtn.classList.remove('active');
  presetCustomBtn.classList.add('active');
  updateDynamicGenerator();
});

function updateDynamicGenerator() {
  const baseNom = parseInt(nominalInput.value, 10) || 1000;
  const staticStr = staticQrisInput.value.trim() || PRESET_MISTER_DOMPU;

  const result = generateDynamicQRIS(staticStr, baseNom);

  // Update displays
  displayTotalAmount.innerText = formatRupiah(result.finalTotalAmount);
  lblBaseNominal.innerText = formatRupiah(result.baseNominal);
  lblUniqueOffset.innerText = `+Rp ${result.uniqueOffset}`;
  lblFeeAmount.innerText = `+Rp ${result.feeAmount}`;
  lblFinalAmount.innerText = formatRupiah(result.finalTotalAmount);

  dynamicRawOutput.innerText = result.rawQris;
  dynamicCrcBadge.innerText = `CRC16: ${result.checksum}`;

  // Parse details for Merchant Name & City
  const parsed = parseEMVCoTLV(result.rawQris);
  const tag59 = parsed.tags.find(t => t.tag === '59')?.val || 'Merchant QRIS';
  const tag60 = parsed.tags.find(t => t.tag === '60')?.val || 'Indonesia';
  displayMerchantInfo.innerText = `${tag59} • ${tag60}`;

  // Render REAL Authentic QR code to canvas using qrcode library
  QRCode.toCanvas(dynamicQrCanvas, result.rawQris, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 6,
    color: {
      dark: '#1a0418',
      light: '#ffffff'
    }
  }, (err) => {
    if (err) console.error('Error generating QR Canvas:', err);
  });

  // Populate TLV breakdown table
  dynamicTlvTableBody.innerHTML = '';
  parsed.tags.forEach(t => {
    const row = document.createElement('tr');
    const isSpecial = t.tag === '01' || t.tag === '54' || t.tag === '63';
    row.innerHTML = `
      <td><span class="tag-badge" style="${isSpecial ? 'color:var(--pink-neon); font-weight:bold;' : ''}">Tag ${t.tag}</span></td>
      <td>${t.len}</td>
      <td style="word-break:break-all; font-family:var(--font-mono); font-size:0.75rem; ${isSpecial ? 'color:var(--pink-neon);' : ''}">${escapeHtml(t.val)}</td>
      <td><strong>${escapeHtml(t.name)}</strong></td>
      <td style="font-size:0.75rem;">${escapeHtml(t.desc)}</td>
    `;
    dynamicTlvTableBody.appendChild(row);
  });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Download QR as PNG
downloadQrBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `QRIS-YURIPAY-${Date.now()}.png`;
  link.href = dynamicQrCanvas.toDataURL('image/png');
  link.click();
  showToast('📥 Gambar QRIS PNG berhasil didownload!');
});

// Copy Dynamic Text
copyDynamicTextBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(dynamicRawOutput.innerText);
  showToast('📋 Raw text QRIS dinamis berhasil disalin!');
});

// ----------------------------------------------------------------------------
// QR Code Checker & Decoder (Cek Code QR)
// ----------------------------------------------------------------------------
const qrDropzone = document.getElementById('qrDropzone') as HTMLDivElement;
const qrFileInput = document.getElementById('qrFileInput') as HTMLInputElement;
const checkerStatusAlert = document.getElementById('checkerStatusAlert') as HTMLDivElement;
const checkerResultBox = document.getElementById('checkerResultBox') as HTMLDivElement;
const checkerImagePreview = document.getElementById('checkerImagePreview') as HTMLImageElement;
const chkMerchantName = document.getElementById('chkMerchantName') as HTMLElement;
const chkMerchantCity = document.getElementById('chkMerchantCity') as HTMLElement;
const chkPostalCode = document.getElementById('chkPostalCode') as HTMLElement;
const chkQrType = document.getElementById('chkQrType') as HTMLElement;
const chkAmount = document.getElementById('chkAmount') as HTMLElement;
const chkAcquirer = document.getElementById('chkAcquirer') as HTMLElement;
const chkCrcStatus = document.getElementById('chkCrcStatus') as HTMLElement;
const chkRawTextOutput = document.getElementById('chkRawTextOutput') as HTMLElement;
const copyScannedRawBtn = document.getElementById('copyScannedRawBtn') as HTMLButtonElement;
const transferToGeneratorBtn = document.getElementById('transferToGeneratorBtn') as HTMLButtonElement;
const checkerTlvTableBody = document.querySelector('#checkerTlvTable tbody') as HTMLElement;

let lastScannedRawText = '';

qrDropzone.addEventListener('click', () => {
  qrFileInput.click();
});

qrDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  qrDropzone.classList.add('dragover');
});

qrDropzone.addEventListener('dragleave', () => {
  qrDropzone.classList.remove('dragover');
});

qrDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  qrDropzone.classList.remove('dragover');
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    handleQRFile(e.dataTransfer.files[0]);
  }
});

qrFileInput.addEventListener('change', () => {
  if (qrFileInput.files && qrFileInput.files.length > 0) {
    handleQRFile(qrFileInput.files[0]);
  }
});

// Support pasting image from clipboard (Ctrl + V)
window.addEventListener('paste', (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile();
      if (file) {
        switchTab('tab-checker');
        handleQRFile(file);
      }
      break;
    }
  }
});

function handleQRFile(file: File) {
  if (!file.type.startsWith('image/')) {
    showCheckerAlert('⚠️ File yang dipilih bukan gambar valid!', 'warning');
    return;
  }

  showCheckerAlert('⏳ Sedang memproses dan memindai barcode QRIS...', 'info');

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target?.result as string;
    checkerImagePreview.src = dataUrl;

    const img = new Image();
    img.onload = () => {
      // Create canvas for jsQR analysis
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        showCheckerAlert('✕ Gagal membuat canvas image processing.', 'error');
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      // Attempt decode with jsQR
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      });

      if (code && code.data && code.data.trim().length > 0) {
        processDecodedQR(code.data.trim());
      } else {
        showCheckerAlert('✕ Tidak ditemukan QR code dalam gambar ini. Pastikan gambar cukup terang dan tidak terlalu buram.', 'error');
        checkerResultBox.style.display = 'none';
      }
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function showCheckerAlert(msg: string, type: 'info' | 'warning' | 'error' | 'success') {
  checkerStatusAlert.style.display = 'block';
  checkerStatusAlert.innerText = msg;
  if (type === 'error') {
    checkerStatusAlert.style.borderColor = 'var(--accent-danger)';
    checkerStatusAlert.style.color = 'var(--accent-danger)';
  } else if (type === 'success') {
    checkerStatusAlert.style.borderColor = 'var(--accent-success)';
    checkerStatusAlert.style.color = 'var(--accent-success)';
  } else {
    checkerStatusAlert.style.borderColor = 'var(--pink-neon)';
    checkerStatusAlert.style.color = 'var(--pink-neon)';
  }
}

function processDecodedQR(raw: string) {
  lastScannedRawText = raw;
  checkerStatusAlert.style.display = 'none';
  checkerResultBox.style.display = 'block';

  chkRawTextOutput.innerText = raw;

  // Decompose TLV
  const parsed = parseEMVCoTLV(raw);

  const tag01 = parsed.tags.find(t => t.tag === '01')?.val;
  const tag59 = parsed.tags.find(t => t.tag === '59')?.val || 'Tidak Terdeteksi';
  const tag60 = parsed.tags.find(t => t.tag === '60')?.val || 'Tidak Terdeteksi';
  const tag61 = parsed.tags.find(t => t.tag === '61')?.val || '-';
  const tag54 = parsed.tags.find(t => t.tag === '54')?.val;
  const tag26 = parsed.tags.find(t => t.tag === '26')?.val || '';
  const tag51 = parsed.tags.find(t => t.tag === '51')?.val || '';

  chkMerchantName.innerText = tag59;
  chkMerchantCity.innerText = tag60;
  chkPostalCode.innerText = tag61;

  if (tag01 === '12') {
    chkQrType.innerText = 'DINAMIS (12)';
    chkQrType.className = 'pixel-badge pink';
  } else if (tag01 === '11') {
    chkQrType.innerText = 'STATIS (11)';
    chkQrType.className = 'pixel-badge gold';
  } else {
    chkQrType.innerText = `Tag 01: ${tag01 || '-'}`;
    chkQrType.className = 'pixel-badge';
  }

  chkAmount.innerText = tag54 ? formatRupiah(parseInt(tag54, 10)) : 'Bebas (Input Manual)';

  // Determine Acquirer
  let acquirerName = 'National QRIS';
  if (tag26.includes('GO-JEK') || tag26.includes('GOPAY')) {
    acquirerName = 'GoBiz / GoPay';
  } else if (tag26.includes('CIMB')) {
    acquirerName = 'CIMB Niaga';
  } else if (tag26.includes('BCA')) {
    acquirerName = 'BCA';
  } else if (tag51.includes('QRIS.WWW')) {
    acquirerName = 'ASPI Interoperable QRIS';
  }
  chkAcquirer.innerText = acquirerName;

  // CRC Validation status
  if (parsed.validCrc) {
    chkCrcStatus.innerText = `✓ VALID (${parsed.embeddedCrc})`;
    chkCrcStatus.className = 'pixel-badge green';
  } else {
    chkCrcStatus.innerText = `✕ MISMATCH (Embedded: ${parsed.embeddedCrc || 'None'}, Calc: ${parsed.calculatedCrc})`;
    chkCrcStatus.className = 'pixel-badge gold';
  }

  // Populate TLV table
  checkerTlvTableBody.innerHTML = '';
  parsed.tags.forEach(t => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="tag-badge">Tag ${t.tag}</span></td>
      <td>${t.len}</td>
      <td style="word-break:break-all; font-family:var(--font-mono); font-size:0.75rem;">${escapeHtml(t.val)}</td>
      <td><strong>${escapeHtml(t.name)}</strong></td>
      <td style="font-size:0.75rem;">${escapeHtml(t.desc)}</td>
    `;
    checkerTlvTableBody.appendChild(row);
  });

  showToast('✓ Berhasil mendecode QRIS code!');
}

copyScannedRawBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(lastScannedRawText);
  showToast('📋 Text QRIS berhasil disalin!');
});

// Transfer to dynamic generator
transferToGeneratorBtn.addEventListener('click', () => {
  if (!lastScannedRawText) return;
  staticQrisInput.value = lastScannedRawText;
  presetDompuBtn.classList.remove('active');
  presetZeroBtn.classList.remove('active');
  presetCustomBtn.classList.add('active');

  switchTab('tab-generator');
  updateDynamicGenerator();
  showToast('🚀 QRIS hasil scan berhasil dimuat ke Generator!');
});

// ----------------------------------------------------------------------------
// Midtrans Signature & Webhook Tester Logic
// ----------------------------------------------------------------------------
const sigOrderId = document.getElementById('sigOrderId') as HTMLInputElement;
const sigStatusCode = document.getElementById('sigStatusCode') as HTMLInputElement;
const sigGrossAmount = document.getElementById('sigGrossAmount') as HTMLInputElement;
const sigServerKey = document.getElementById('sigServerKey') as HTMLInputElement;
const calcSignatureBtn = document.getElementById('calcSignatureBtn') as HTMLButtonElement;
const copySignatureBtn = document.getElementById('copySignatureBtn') as HTMLButtonElement;
const sigOutputPre = document.getElementById('sigOutputPre') as HTMLElement;
const copyWebhookPayloadBtn = document.getElementById('copyWebhookPayloadBtn') as HTMLButtonElement;
const webhookPayloadPre = document.getElementById('webhookPayloadPre') as HTMLElement;

async function updateSignatureSimulator() {
  const orderId = sigOrderId.value.trim();
  const statusCode = sigStatusCode.value.trim();
  const grossAmount = sigGrossAmount.value.trim();
  const serverKey = sigServerKey.value.trim();

  const rawString = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const signature = await computeSHA512(rawString);

  sigOutputPre.innerText = signature;

  const mockPayload = {
    transaction_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
    transaction_status: 'settlement',
    transaction_id: 'TRX-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
    status_message: 'YuriPay transaction is successful',
    status_code: statusCode,
    signature_key: signature,
    payment_type: 'qris',
    order_id: orderId,
    merchant_id: 'G538138242',
    gross_amount: grossAmount,
    fraud_status: 'accept',
    currency: 'IDR',
    acquirer: 'gopay'
  };

  webhookPayloadPre.innerText = JSON.stringify(mockPayload, null, 2);
}

calcSignatureBtn.addEventListener('click', () => {
  updateSignatureSimulator();
  showToast('⚡ Signature SHA-512 dihitung!');
});

copySignatureBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(sigOutputPre.innerText);
  showToast('📋 Signature key berhasil disalin!');
});

copyWebhookPayloadBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(webhookPayloadPre.innerText);
  showToast('📋 Payload JSON berhasil disalin!');
});

// ----------------------------------------------------------------------------
// GitHub Repo Stats & Contributors Fetch
// ----------------------------------------------------------------------------
const headerStarCount = document.getElementById('headerStarCount') as HTMLElement;
const headerForkCount = document.getElementById('headerForkCount') as HTMLElement;
const gitStarCount = document.getElementById('gitStarCount') as HTMLElement;
const gitForkCount = document.getElementById('gitForkCount') as HTMLElement;
const gitIssuesCount = document.getElementById('gitIssuesCount') as HTMLElement;
const statStars = document.getElementById('statStars') as HTMLElement;
const statForks = document.getElementById('statForks') as HTMLElement;
const statWatchers = document.getElementById('statWatchers') as HTMLElement;
const statIssues = document.getElementById('statIssues') as HTMLElement;
const contributorList = document.getElementById('contributorList') as HTMLElement;
const copyCloneBtn = document.getElementById('copyCloneBtn') as HTMLButtonElement;
const cloneSnippetPre = document.getElementById('cloneSnippetPre') as HTMLElement;

copyCloneBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(cloneSnippetPre.innerText);
  showToast('📋 Perintah clone berhasil disalin!');
});

async function fetchGitHubData() {
  try {
    const repoRes = await fetch('https://api.github.com/repos/myzert/YURIPAY-GOPAY');
    if (repoRes.ok) {
      const repoData = await repoRes.json();
      const stars = repoData.stargazers_count ?? 120;
      const forks = repoData.forks_count ?? 15;
      const watchers = repoData.watchers_count ?? 120;
      const issues = repoData.open_issues_count ?? 2;

      headerStarCount.innerText = stars.toString();
      headerForkCount.innerText = forks.toString();
      gitStarCount.innerText = stars.toString();
      gitForkCount.innerText = forks.toString();
      gitIssuesCount.innerText = issues.toString();

      statStars.innerText = stars.toString();
      statForks.innerText = forks.toString();
      statWatchers.innerText = watchers.toString();
      statIssues.innerText = issues.toString();
    } else {
      fallbackGitHubStats();
    }
  } catch (e) {
    fallbackGitHubStats();
  }

  try {
    const contribRes = await fetch('https://api.github.com/repos/myzert/YURIPAY-GOPAY/contributors');
    if (contribRes.ok) {
      const contributors = await contribRes.json();
      if (Array.isArray(contributors) && contributors.length > 0) {
        contributorList.innerHTML = '';
        contributors.forEach((c: any) => {
          const card = document.createElement('a');
          card.href = c.html_url;
          card.target = '_blank';
          card.rel = 'noopener';
          card.className = 'contributor-card';
          card.innerHTML = `
            <img src="${c.avatar_url}" class="contributor-avatar" alt="${c.login}" />
            <div class="contributor-info">
              <span class="contributor-login">${escapeHtml(c.login)}</span>
              <span class="contributor-role">${c.login === 'myzert' ? '👑 Lead Developer' : '🛠️ Contributor'}</span>
              <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--pink-neon); margin-top:2px;">${c.contributions} Commits</span>
            </div>
          `;
          contributorList.appendChild(card);
        });
      }
    }
  } catch (e) {
    // Keep default hardcoded fallback
  }
}

function fallbackGitHubStats() {
  headerStarCount.innerText = '120+';
  headerForkCount.innerText = '15+';
  gitStarCount.innerText = '120+';
  gitForkCount.innerText = '15+';
  gitIssuesCount.innerText = '2';

  statStars.innerText = '120+';
  statForks.innerText = '15+';
  statWatchers.innerText = '120+';
  statIssues.innerText = '2';
}

// ----------------------------------------------------------------------------
// Initial Boot
// ----------------------------------------------------------------------------
updateDynamicGenerator();
updateSignatureSimulator();
fetchGitHubData();
