import './style.css';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  createIcons,
  Zap,
  Menu,
  Search,
  GitFork,
  Sun,
  Moon,
  BookOpen,
  Sparkles,
  Layers,
  RefreshCw,
  QrCode,
  ScanLine,
  ShieldCheck,
  Cpu,
  FileText,
  Key,
  CheckCircle2,
  Database,
  Server,
  Smartphone,
  Cloud,
  Star,
  UploadCloud,
  Lock,
  Copy,
  Download,
  ChevronRight,
  ChevronLeft,
  Check,
  ExternalLink,
  ArrowRight,
  Home,
  Code2
} from 'lucide';

const appIcons = {
  Zap,
  Menu,
  Search,
  GitFork,
  Sun,
  Moon,
  BookOpen,
  Sparkles,
  Layers,
  RefreshCw,
  QrCode,
  ScanLine,
  ShieldCheck,
  Cpu,
  FileText,
  Key,
  CheckCircle2,
  Database,
  Server,
  Smartphone,
  Cloud,
  Star,
  UploadCloud,
  Lock,
  Copy,
  Download,
  ChevronRight,
  ChevronLeft,
  Check,
  ExternalLink,
  ArrowRight,
  Home,
  Code2
};

// ============================================================================
// Core State & Presets
// ============================================================================
const PRESET_MISTER_DOMPU = '00020101021126670016ID.CO.CIMB.WWW011893600022000122143002150000000000000000303UMI51440014ID.CO.QRIS.WWW0215ID20243469147550303UMI520473215303360540410005802ID5914Mister Dompu 26002Dompu61058421162070703A0163045663';
const PRESET_ZERO_SHOP = '00020101021126610014COM.GO-JEK.WWW01189360091435381382420210G5381382420303UMI51440014ID.CO.QRIS.WWW0215ID10243419924680303UMI5204581653033605802ID5918ZERO SHOP, MEGALUH6007JOMBANG61056145762070703A0163042A62';

let currentOffsetMode = 'yuripay'; // 'yuripay' | 'exact' | 'custom'
let customOffset = 0;
let feeType = 'none'; // 'none' | 'flat' | 'percent'
let feeValue = 0;
let lastScannedRawText = '';

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

const TAG_DEFINITIONS: Record<string, { name: string; desc: string }> = {
  '00': { name: 'Payload Format Indicator', desc: 'Versi standar EMVCo QRIS (umumnya 01)' },
  '01': { name: 'Point of Initiation Method', desc: '11 = Statis (manual input), 12 = Dinamis (nominal terkunci)' },
  '26': { name: 'Merchant Account (Bank / Acquirer)', desc: 'Informasi rekening acquirer (Gojek / CIMB / Bank)' },
  '51': { name: 'National Merchant ID (NMID)', desc: 'Identitas unik QRIS nasional di Asosiasi Sistem Pembayaran Indonesia (ASPI)' },
  '52': { name: 'Merchant Category Code (MCC)', desc: 'Klasifikasi kategori usaha merchant' },
  '53': { name: 'Transaction Currency', desc: 'Mata uang ISO 4217 (360 = Rupiah Indonesia / IDR)' },
  '54': { name: 'Transaction Amount (Nominal)', desc: 'Jumlah tagihan yang terkunci otomatis di m-banking pembeli' },
  '55': { name: 'Tip or Convenience Indicator', desc: 'Indikator biaya layanan tambahan' },
  '56': { name: 'Convenience Fee Fixed', desc: 'Biaya layanan tetap (Rp)' },
  '57': { name: 'Convenience Fee Percentage', desc: 'Persentase biaya layanan tambahan' },
  '58': { name: 'Country Code', desc: 'Kode negara penerbit QR (ID = Indonesia)' },
  '59': { name: 'Merchant Name', desc: 'Nama resmi toko atau merchant' },
  '60': { name: 'Merchant City', desc: 'Kota domisili toko' },
  '61': { name: 'Postal Code', desc: 'Kode pos merchant' },
  '62': { name: 'Additional Data Field', desc: 'Invoice / reference ID / terminal' },
  '63': { name: 'CRC-16 Checksum', desc: 'Integritas data 4 karakter heksadesimal' },
};

function parseEMVCoTLV(raw: string): { tags: TLVTag[]; validCrc: boolean; calculatedCrc: string; embeddedCrc: string } {
  const clean = raw.trim();
  const tags: TLVTag[] = [];
  let i = 0;

  let embeddedCrc = '';
  let payloadWithoutCrc = clean;
  const idx63 = clean.indexOf('6304');
  if (idx63 !== -1) {
    embeddedCrc = clean.substring(idx63 + 4, idx63 + 8).toUpperCase();
    payloadWithoutCrc = clean.substring(0, idx63 + 4);
  }

  const calculatedCrc = calculateCRC16(payloadWithoutCrc);
  const validCrc = embeddedCrc ? calculatedCrc === embeddedCrc : false;

  const parsePayload = idx63 !== -1 ? clean.substring(0, idx63) : clean;
  while (i < parsePayload.length) {
    if (i + 4 > parsePayload.length) break;
    const tag = parsePayload.substring(i, i + 2);
    const len = parseInt(parsePayload.substring(i + 2, i + 4), 10);
    if (isNaN(len)) break;
    const val = parsePayload.substring(i + 4, i + 4 + len);
    const def = TAG_DEFINITIONS[tag] || { name: `Tag Khusus ${tag}`, desc: 'Data field tambahan spesifikasi EMVCo' };
    tags.push({ tag, len, val, name: def.name, desc: def.desc });
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

function generateDynamicQRIS(staticTemplate: string, baseNominal: number) {
  let payload = (staticTemplate || PRESET_MISTER_DOMPU).trim();

  const idx63 = payload.indexOf('6304');
  if (idx63 !== -1) {
    payload = payload.substring(0, idx63);
  }

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

  let uniqueOffset = 0;
  if (currentOffsetMode === 'yuripay') {
    if (baseNominal < 1000) {
      uniqueOffset = 1;
    } else {
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

  const newTags: { tag: string; val: string }[] = [];
  let hasTag54 = false;

  for (const item of tags) {
    if (item.tag === '01') {
      newTags.push({ tag: '01', val: '12' }); // Dynamic
    } else if (item.tag === '54') {
      newTags.push({ tag: '54', val: amountStr });
      hasTag54 = true;
    } else if (item.tag === '58' && !hasTag54) {
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

async function computeSHA512(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-512', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================================
// Multi-Page Routing Architecture (Google & Consumet / Nextra Style)
// ============================================================================

interface DocPage {
  id: string;
  title: string;
  category: string;
  prevPage?: { id: string; title: string };
  nextPage?: { id: string; title: string };
  render: () => string;
  init?: () => void;
}

const PAGES: Record<string, DocPage> = {
  // --------------------------------------------------------------------------
  // HOME / GET STARTED LANDING (Google Developers Style)
  // --------------------------------------------------------------------------
  'home': {
    id: 'home',
    title: 'Overview',
    category: 'Getting Started',
    nextPage: { id: 'intro', title: 'Pengenalan & Fitur' },
    render: () => `
      <div class="py-4 max-w-full overflow-hidden">
        <!-- Hero Section (Google Developers / Consumet Style) -->
        <div class="rounded-3xl border border-blue-100 dark:border-blue-900/40 bg-gradient-to-b from-blue-50/70 via-white to-white dark:from-blue-950/20 dark:via-[#0b0f19] dark:to-[#0b0f19] p-8 sm:p-12 text-center mb-10 shadow-sm relative overflow-hidden">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100/80 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 mb-5">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"></i>
            <span>YuriPay Enterprise Documentation & Simulator</span>
          </div>

          <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-2xl mx-auto leading-tight mb-4">
            Payment Gateway QRIS Mandiri untuk GoBiz
          </h1>
          <p class="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
            Dapatkan kontrol penuh pembayaran digital Anda dengan <strong>0% fee potongan pihak ketiga</strong>, mutasi 2.5 detik, dan arsitektur Dual-Port Isolation.
          </p>

          <!-- Action Buttons (Google Style) -->
          <div class="flex flex-wrap items-center justify-center gap-3">
            <button onclick="navigateTo('intro')" class="px-6 py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all cursor-pointer">
              <span>Get Started</span>
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
            <button onclick="navigateTo('generator')" class="px-6 py-3 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2 transition-all cursor-pointer">
              <i data-lucide="qr-code" class="w-4 h-4 text-blue-600 dark:text-blue-400"></i>
              <span>Live Generator QRIS</span>
            </button>
            <button onclick="navigateTo('checker')" class="px-6 py-3 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2 transition-all cursor-pointer">
              <i data-lucide="scan-line" class="w-4 h-4 text-emerald-600"></i>
              <span>Cek / Scan QR</span>
            </button>
          </div>
        </div>

        <!-- 4 Core Pillars Grid (Google Developers Style) -->
        <div class="grid sm:grid-cols-2 gap-5 mb-10">
          <div onclick="navigateTo('intro')" class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer group shadow-sm">
            <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <i data-lucide="zap" class="w-5 h-5"></i>
            </div>
            <h3 class="font-bold text-base text-slate-900 dark:text-white mb-2 flex items-center justify-between">
              <span>0% Gateway Transaction Fee</span>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform"></i>
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Dana langsung masuk ke rekening GoBiz resmi toko Anda tanpa perantara aggregator yang memotong margin keuntungan Anda.
            </p>
          </div>

          <div onclick="navigateTo('dual-port')" class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer group shadow-sm">
            <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <i data-lucide="layers" class="w-5 h-5"></i>
            </div>
            <h3 class="font-bold text-base text-slate-900 dark:text-white mb-2 flex items-center justify-between">
              <span>Arsitektur Dual-Port Isolation</span>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform"></i>
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Pemisahan ketat Port 3000 (Internal Merchant Admin) dan Port 3001 (Customer Public Checkout) demi keamanan zero attack surface.
            </p>
          </div>

          <div onclick="navigateTo('polling-checker')" class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer group shadow-sm">
            <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <i data-lucide="refresh-cw" class="w-5 h-5"></i>
            </div>
            <h3 class="font-bold text-base text-slate-900 dark:text-white mb-2 flex items-center justify-between">
              <span>Mutasi Realtime 2.5 Detik</span>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform"></i>
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Background worker polling memeriksa mutasi GoBiz setiap 2.500 ms dengan algoritma pencegah bentrok pesanan kembar.
            </p>
          </div>

          <div onclick="navigateTo('webhook')" class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer group shadow-sm">
            <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <i data-lucide="shield-check" class="w-5 h-5"></i>
            </div>
            <h3 class="font-bold text-base text-slate-900 dark:text-white mb-2 flex items-center justify-between">
              <span>Midtrans Webhook Compatible</span>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform"></i>
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              100% identik dengan skema Midtrans SHA-512 signature. Sistem toko Anda tidak perlu dirombak kodenya sama sekali.
            </p>
          </div>
        </div>
      </div>
    `
  },

  // --------------------------------------------------------------------------
  // INTRO & OVERVIEW
  // --------------------------------------------------------------------------
  'intro': {
    id: 'intro',
    title: 'Pengenalan & Ikhtisar',
    category: 'Getting Started',
    prevPage: { id: 'home', title: 'Overview' },
    nextPage: { id: 'dual-port', title: 'Arsitektur Dual-Port' },
    render: () => `
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
          Pengantar YURIPAY
        </h1>
        <p class="text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          <strong>YURIPAY by myzert</strong> adalah payment gateway QRIS dinamis mandiri (<em>self-hosted</em>) yang dibangun untuk merchant GoBiz (GoPay / GoFood). Perangkat lunak ini mengubah QRIS Statis merchant menjadi QRIS Dinamis dengan nominal terkunci otomatis pada aplikasi m-banking pelanggan.
        </p>

        <div class="callout-box callout-info">
          <strong class="text-blue-900 dark:text-blue-200 block mb-1">Mengapa Menggunakan Gateway Mandiri?</strong>
          Payment gateway komersial membebankan MDR/fee 0.7% s/d 1.5% dan menahan dana pencairan (settlement H+1 hingga H+3). YuriPay langsung memproses dana ke rekening GoBiz Anda secara instan 24/7 tanpa potongan pihak ketiga.
        </div>

        <h2 class="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-3">Fitur Utama</h2>
        <ul class="space-y-2 text-sm text-slate-600 dark:text-slate-400 list-disc list-inside leading-relaxed">
          <li><strong>0% Fee Gateway:</strong> Bebas biaya bulanan dan bebas potongan per transaksi.</li>
          <li><strong>Dinamis Otomatis:</strong> Tag 01 statis (11) diubah jadi dinamis (12) dan Tag 54 menyuntikkan nominal pas.</li>
          <li><strong>Pencocokan Mutasi 2.5 Detik:</strong> Worker polling ke API analitik GoBiz mendeteksi transfer masuk seketika.</li>
          <li><strong>Kode Unik Anti-Bentrok:</strong> Nominal kecil (&lt;1000) offset +1 perak; nominal besar acak 1..199 perak.</li>
          <li><strong>Dual-Port Isolation:</strong> Port 3000 Admin terlindungi, Port 3001 aman diekspos ke publik.</li>
          <li><strong>Database SQLite WAL:</strong> Bebas race-condition berkat mode Write-Ahead Logging yang ringan dan cepat.</li>
        </ul>
      </div>
    `
  },

  // --------------------------------------------------------------------------
  // DUAL PORT ARCHITECTURE
  // --------------------------------------------------------------------------
  'dual-port': {
    id: 'dual-port',
    title: 'Arsitektur Dual-Port',
    category: 'Getting Started',
    prevPage: { id: 'intro', title: 'Pengenalan & Ikhtisar' },
    nextPage: { id: 'workflow', title: 'Alur Transaksi 100%' },
    render: () => `
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
          Arsitektur Dual-Port Isolation
        </h1>
        <p class="text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          Salah satu inovasi keamanan utama dalam YuriPay adalah pemisahan fisik antara port internal admin toko dan port publik checkout customer.
        </p>

        <div class="grid sm:grid-cols-2 gap-5 my-6">
          <div class="p-6 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm">
            <div class="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center mb-3">
              <i data-lucide="lock" class="w-4 h-4"></i>
            </div>
            <h3 class="font-bold text-base text-slate-900 dark:text-white mb-1">Port 3000: Admin & Kasir</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-3 font-mono">http://localhost:3000</p>
            <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Hanya dapat diakses oleh pemilik toko / kasir internal. Mengelola produk, stok lisensi digital, audit mutasi saldo, serta pemantauan sesi aktif GoBiz.
            </p>
          </div>

          <div class="p-6 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm">
            <div class="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-3">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
            </div>
            <h3 class="font-bold text-base text-slate-900 dark:text-white mb-1">Port 3001: Public Checkout</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-3 font-mono">http://domain.com/pay/:id</p>
            <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Port ringan yang di-forward ke internet (via Cloudflare Tunnels atau Nginx Reverse Proxy). Menampilkan invoice pembayaran tanpa akses ke menu sensitif.
            </p>
          </div>
        </div>

        <div class="callout-box callout-tip">
          <strong class="text-emerald-900 dark:text-emerald-200 block mb-1">Manfaat Keamanan Zero Attack Surface:</strong>
          Jika port 3001 diserang atau di-DDoS oleh pihak tidak bertanggung jawab, port 3000 admin kasir dan background worker di server Anda tetap berjalan normal tanpa gangguan sesi.
        </div>
      </div>
    `
  },

  // --------------------------------------------------------------------------
  // WORKFLOW ALUR TRANSAKSI
  // --------------------------------------------------------------------------
  'workflow': {
    id: 'workflow',
    title: 'Alur Transaksi 100%',
    category: 'Getting Started',
    prevPage: { id: 'dual-port', title: 'Arsitektur Dual-Port' },
    nextPage: { id: 'generator', title: 'Live Generator Dinamis' },
    render: () => `
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
          Alur Transaksi End-to-End
        </h1>
        <p class="text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          Berikut tahapan teknis bagaimana transaksi diproses dari pesanan baru hingga penyerahan barang digital:
        </p>

        <div class="space-y-4 my-6">
          <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-start gap-3.5">
            <span class="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
            <div>
              <h4 class="font-bold text-sm text-slate-900 dark:text-white">Customer Membuat Pesanan (Checkout)</h4>
              <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Sistem menghasilkan invoice di tabel <code>orders</code> dengan status <strong>PENDING</strong> dan menyematkan kode unik.</p>
            </div>
          </div>

          <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-start gap-3.5">
            <span class="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
            <div>
              <h4 class="font-bold text-sm text-slate-900 dark:text-white">Injeksi Tag 54 & Kalkulasi CRC-16</h4>
              <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Fungsi <code>qrisHelper.js</code> menyuntikkan nominal pas ke Tag 54, mengubah Tag 01 ke Dinamis (12), dan menghitung ulang CRC16 CCITT.</p>
            </div>
          </div>

          <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-start gap-3.5">
            <span class="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
            <div>
              <h4 class="font-bold text-sm text-slate-900 dark:text-white">Pembeli Scan via E-Wallet / Mobile Banking</h4>
              <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Aplikasi perbankan pelanggan otomatis mendeteksi nominal pas tanpa perlu diketik manual.</p>
            </div>
          </div>

          <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-start gap-3.5">
            <span class="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">4</span>
            <div>
              <h4 class="font-bold text-sm text-slate-900 dark:text-white">Worker Polling 2.5 Detik Menemukan Mutasi</h4>
              <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Worker <code>paymentChecker.js</code> mendeteksi transaksi masuk pada GoBiz, mengklaim item pada tabel <code>stocks</code>, dan mengubah status jadi <strong>PAID</strong>.</p>
            </div>
          </div>

          <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-start gap-3.5">
            <span class="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">5</span>
            <div>
              <h4 class="font-bold text-sm text-slate-900 dark:text-white">Webhook Midtrans Dispatched</h4>
              <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5">YuriPay mengirim notifikasi HTTP POST settlement dengan signature SHA-512 ke backend toko Anda.</p>
            </div>
          </div>
        </div>
      </div>
    `
  },

  // --------------------------------------------------------------------------
  // LIVE QRIS GENERATOR
  // --------------------------------------------------------------------------
  'generator': {
    id: 'generator',
    title: 'Live Generator Dinamis',
    category: 'Playground & Tools',
    prevPage: { id: 'workflow', title: 'Alur Transaksi 100%' },
    nextPage: { id: 'checker', title: 'Cek Code QRIS' },
    render: () => `
      <div class="max-w-full overflow-hidden">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
          ⚡ Live Dynamic QRIS Generator
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          Uji coba pembuatan QRIS dinamis asli yang bisa di-scan m-banking dengan kalkulasi EMVCo resmi.
        </p>

        <!-- Generator Widget -->
        <div class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm mb-8">
          <div class="grid lg:grid-cols-12 gap-8">
            <!-- Left Config -->
            <div class="lg:col-span-7 space-y-5">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">1. Pilih Preset Merchant Contoh:</label>
                <div class="flex flex-wrap gap-2">
                  <button id="presetDompuBtn" class="px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-600 bg-blue-600 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer">
                    <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                    <span>Mister Dompu 2 (CIMB/QRIS)</span>
                  </button>
                  <button id="presetZeroBtn" class="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 transition-all cursor-pointer">
                    ZERO SHOP (GoBiz)
                  </button>
                  <button id="presetCustomBtn" class="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 transition-all cursor-pointer">
                    Custom Template
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Template QRIS Statis Sumber:</label>
                <textarea id="staticQrisInput" rows="3" class="w-full p-3 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100">${PRESET_MISTER_DOMPU}</textarea>
              </div>

              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">2. Nominal Transaksi (Rp):</label>
                <input type="number" id="nominalInput" value="1000" min="1" class="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100" />
                <div class="flex flex-wrap gap-1.5 mt-2">
                  <button class="nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 cursor-pointer" data-nom="500">Rp 500</button>
                  <button class="nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 cursor-pointer" data-nom="1000">Rp 1.000</button>
                  <button class="nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 cursor-pointer" data-nom="5000">Rp 5.000</button>
                  <button class="nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 cursor-pointer" data-nom="10000">Rp 10.000</button>
                  <button class="nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 cursor-pointer" data-nom="25000">Rp 25.000</button>
                  <button class="nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 cursor-pointer" data-nom="50000">Rp 50.000</button>
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">3. Aturan Kode Unik (Anti-Bentrok):</label>
                <select id="uniqueModeSelect" class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100">
                  <option value="yuripay">⚡ Algoritma YuriPay Resmi (&lt;1000: +1 perak, &ge;1000: acak 1..199)</option>
                  <option value="exact">🎯 Nominal Pas (Offset 0)</option>
                  <option value="custom">🛠️ Custom Offset Tambahan</option>
                </select>
                <div id="customOffsetBox" class="hidden mt-2">
                  <input type="number" id="customOffsetInput" placeholder="Nilai offset (contoh: 88)" value="0" class="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg" />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">4. Biaya Layanan / Admin (Opsional):</label>
                <div class="grid grid-cols-2 gap-2">
                  <select id="feeTypeSelect" class="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100">
                    <option value="none">Gratis (Tanpa Biaya Admin)</option>
                    <option value="flat">Biaya Tetap (Rp)</option>
                    <option value="percent">Persentase (%)</option>
                  </select>
                  <input type="number" id="feeValInput" placeholder="Nilai fee" value="0" disabled class="px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 disabled:opacity-50" />
                </div>
              </div>

              <button id="generateDynamicBtn" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-colors cursor-pointer">
                <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                <span>Re-Generate QRIS Dinamis</span>
              </button>
            </div>

            <!-- Right QR Preview -->
            <div class="lg:col-span-5 flex flex-col items-center justify-between p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <div class="text-center w-full">
                <div class="p-3 bg-white rounded-xl shadow-md border border-slate-200 inline-block mb-3">
                  <canvas id="dynamicQrCanvas" class="w-48 h-48 block"></canvas>
                </div>
                <div id="displayTotalAmount" class="text-2xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">Rp 1.000</div>
                <div id="displayMerchantInfo" class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Mister Dompu 2 • Dompu</div>
              </div>

              <div class="w-full my-4 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs space-y-1.5 font-mono">
                <div class="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Nominal Asli:</span>
                  <span id="lblBaseNominal" class="font-bold text-slate-900 dark:text-white">Rp 1.000</span>
                </div>
                <div class="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Kode Unik:</span>
                  <span id="lblUniqueOffset" class="font-bold text-blue-600 dark:text-blue-400">+Rp 0</span>
                </div>
                <div class="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Biaya Layanan:</span>
                  <span id="lblFeeAmount" class="font-bold text-slate-900 dark:text-white">+Rp 0</span>
                </div>
                <div class="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex justify-between text-sm font-bold text-blue-600 dark:text-blue-400">
                  <span>Total Terkunci (Tag 54):</span>
                  <span id="lblFinalAmount">Rp 1.000</span>
                </div>
              </div>

              <div class="flex gap-2 w-full">
                <button id="downloadQrBtn" class="flex-1 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                  <i data-lucide="download" class="w-3.5 h-3.5"></i>
                  <span>Download PNG</span>
                </button>
                <button id="copyDynamicTextBtn" class="flex-1 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                  <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                  <span>Copy String</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Raw String -->
          <div class="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Raw Dynamic QRIS String:</span>
              <span id="dynamicCrcBadge" class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500/20">CRC16: OK</span>
            </div>
            <pre id="dynamicRawOutput" class="p-3 rounded-lg bg-slate-950 text-blue-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-24 max-w-full"></pre>
          </div>

          <!-- TLV Table -->
          <div class="mt-6">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Tabel Bedah Struktur Tag EMVCo (TLV Breakdown)</h3>
            <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 max-w-full">
              <table class="w-full text-left text-xs" id="dynamicTlvTable">
                <thead class="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th class="py-2.5 px-3">Tag</th>
                    <th class="py-2.5 px-3">Len</th>
                    <th class="py-2.5 px-3">Value</th>
                    <th class="py-2.5 px-3">Field Name</th>
                    <th class="py-2.5 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `,
    init: () => {
      setupGeneratorListeners();
      updateDynamicGenerator();
    }
  },

  // --------------------------------------------------------------------------
  // CEK CODE QRIS (SCANNER & INSPECTOR)
  // --------------------------------------------------------------------------
  'checker': {
    id: 'checker',
    title: 'Cek Code QRIS',
    category: 'Playground & Tools',
    prevPage: { id: 'generator', title: 'Live Generator Dinamis' },
    nextPage: { id: 'webhook', title: 'Midtrans Webhook Tester' },
    render: () => `
      <div class="max-w-full overflow-hidden">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
          🔍 Cek Code QRIS (Image Decoder & Inspector)
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          Upload gambar atau screenshot QR code toko Anda untuk mengekstrak string mentah, memeriksa validitas checksum CRC-16, dan mendekomposisi seluruh tag perbankan.
        </p>

        <div class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm mb-8">
          <!-- Dropzone -->
          <div id="qrDropzone" class="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-950/40">
            <input type="file" id="qrFileInput" accept="image/*" class="hidden" />
            <div class="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <i data-lucide="upload-cloud" class="w-6 h-6"></i>
            </div>
            <h3 class="font-bold text-sm text-slate-900 dark:text-white mb-1">Upload atau Drag & Drop Foto QRIS ke Sini</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Format PNG, JPG, JPEG, WebP. Bisa juga langsung paste screenshot (<kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px]">Ctrl + V</kbd>).</p>
          </div>

          <div id="checkerStatusAlert" class="hidden mt-4 p-3 rounded-lg text-xs font-medium border"></div>

          <!-- Result Box -->
          <div id="checkerResultBox" class="hidden mt-6 space-y-6">
            <div class="grid md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center">
                  <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">Preview Gambar:</span>
                  <img id="checkerImagePreview" class="max-h-48 mx-auto rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm" alt="Decoded QR" />
                </div>

                <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2 text-xs">
                  <div class="font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">Metadata Toko:</div>
                  <div class="flex justify-between"><span class="text-slate-500">Merchant Name:</span> <strong id="chkMerchantName" class="text-blue-600 dark:text-blue-400 font-bold">-</strong></div>
                  <div class="flex justify-between"><span class="text-slate-500">Kota Domisili:</span> <strong id="chkMerchantCity" class="text-slate-800 dark:text-slate-200">-</strong></div>
                  <div class="flex justify-between"><span class="text-slate-500">Kode Pos:</span> <strong id="chkPostalCode" class="text-slate-800 dark:text-slate-200">-</strong></div>
                  <div class="flex justify-between"><span class="text-slate-500">Tipe QR:</span> <span id="chkQrType" class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800">-</span></div>
                  <div class="flex justify-between"><span class="text-slate-500">Nominal:</span> <strong id="chkAmount" class="text-emerald-500">-</strong></div>
                  <div class="flex justify-between"><span class="text-slate-500">Acquirer:</span> <strong id="chkAcquirer">-</strong></div>
                  <div class="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span class="text-slate-500">Validasi Checksum:</span>
                    <span id="chkCrcStatus" class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white">-</span>
                  </div>
                </div>
              </div>

              <div class="flex flex-col justify-between space-y-4">
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Raw String QRIS:</span>
                    <button id="copyScannedRawBtn" class="px-2.5 py-1 rounded text-xs font-medium border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer">
                      <i data-lucide="copy" class="w-3 h-3"></i>
                      <span>Copy Text</span>
                    </button>
                  </div>
                  <pre id="chkRawTextOutput" class="p-3.5 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-y-auto whitespace-pre-wrap break-all max-h-52 border border-slate-800"></pre>
                </div>

                <div class="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/20">
                  <div class="font-bold text-sm text-slate-900 dark:text-white mb-1">Gunakan Sebagai Template Dinamis</div>
                  <p class="text-xs text-slate-600 dark:text-slate-400 mb-3">Pindahkan string ini ke Live Generator untuk membuat QRIS nominal dari toko Anda.</p>
                  <button id="transferToGeneratorBtn" class="w-full py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-colors cursor-pointer">
                    <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                    <span>Transfer ke Generator Dinamis</span>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h4 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">Tabel Dekomposisi Tag EMVCo Hasil Scan</h4>
              <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 max-w-full">
                <table class="w-full text-left text-xs" id="checkerTlvTable">
                  <thead class="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th class="py-2.5 px-3">Tag</th>
                      <th class="py-2.5 px-3">Len</th>
                      <th class="py-2.5 px-3">Value</th>
                      <th class="py-2.5 px-3">Field Name</th>
                      <th class="py-2.5 px-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
    init: () => {
      setupCheckerListeners();
    }
  },

  // --------------------------------------------------------------------------
  // MIDTRANS WEBHOOK TESTER
  // --------------------------------------------------------------------------
  'webhook': {
    id: 'webhook',
    title: 'Midtrans Webhook Tester',
    category: 'Playground & Tools',
    prevPage: { id: 'checker', title: 'Cek Code QRIS' },
    nextPage: { id: 'code-structure', title: 'Bedah Struktur Repositori' },
    render: () => `
      <div class="max-w-full overflow-hidden">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
          🛡️ Midtrans Webhook & Signature Tester
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          Format callback notifikasi YuriPay 100% kompatibel dengan Midtrans API, termasuk perhitungan <code class="font-mono text-xs">SHA512(order_id + status_code + gross_amount + ServerKey)</code>.
        </p>

        <div class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm mb-8">
          <div class="grid md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Order ID (Invoice):</label>
                <input type="text" id="sigOrderId" value="INV-20261106-9921" class="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Status Code:</label>
                <input type="text" id="sigStatusCode" value="200" class="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Gross Amount (Rp):</label>
                <input type="text" id="sigGrossAmount" value="10087.00" class="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Server Key (Secret):</label>
                <input type="text" id="sigServerKey" value="SB-Mid-server-YuriPayKeySample2026" class="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100" />
              </div>
              <button id="calcSignatureBtn" class="w-full py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer">
                <i data-lucide="zap" class="w-3.5 h-3.5"></i>
                <span>Hitung Signature SHA-512</span>
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Signature Key Result:</span>
                  <button id="copySignatureBtn" class="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer">
                    <i data-lucide="copy" class="w-3 h-3"></i>
                    <span>Copy</span>
                  </button>
                </div>
                <pre id="sigOutputPre" class="p-3 rounded-lg bg-slate-950 text-blue-300 font-mono text-xs break-all whitespace-pre-wrap max-h-24 max-w-full"></pre>
              </div>

              <div>
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Contoh Callback Settlement JSON:</span>
                  <button id="copyWebhookPayloadBtn" class="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer">
                    <i data-lucide="copy" class="w-3 h-3"></i>
                    <span>Copy JSON</span>
                  </button>
                </div>
                <pre id="webhookPayloadPre" class="p-3 rounded-lg bg-slate-950 text-slate-300 font-mono text-xs overflow-y-auto max-h-48 max-w-full"></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
    init: () => {
      setupWebhookListeners();
      updateSignatureSimulator();
    }
  },

  // --------------------------------------------------------------------------
  // CODE STRUCTURE
  // --------------------------------------------------------------------------
  'code-structure': {
    id: 'code-structure',
    title: 'Struktur Repositori',
    category: 'Bedah Kode Backend',
    prevPage: { id: 'webhook', title: 'Midtrans Webhook Tester' },
    nextPage: { id: 'gobiz-auth', title: 'Otentikasi GoBiz OTP' },
    render: () => `
      <div class="max-w-full overflow-hidden">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
          Bedah Struktur Kode myzert/YURIPAY-GOPAY
        </h1>
        <p class="text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          Hasil clone dan bedah kode 100% dari repositori resmi backend YuriPay:
        </p>

        <div class="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950 text-slate-200 font-mono text-xs my-4 shadow-sm max-w-full">
          <div class="px-4 py-2 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between text-slate-400">
            <span>YURIPAY-GOPAY / Tree</span>
            <span class="text-blue-400">Node.js 22 LTS</span>
          </div>
          <pre class="p-4 overflow-x-auto text-[11px] leading-relaxed max-w-full whitespace-pre-wrap break-all">
YURIPAY-GOPAY/
├── server.js                     # Dual-Port HTTP Server (3000 Admin & 3001 Public Checkout)
├── login.js                      # CLI Interaktif Login GoBiz via SMS/WA OTP
├── package.json                  # better-sqlite3, axios, express 5, qrcode, ejs
├── ecosystem.config.js           # PM2 Cluster Production Config 24/7
├── Dockerfile & docker-compose   # Containerisasi Cloud Deployment
├── .GOPAY_SESI_JANGAN_DIHAPUS.json # Sesi token GoBiz (Auto-Refresh 6 jam)
└── src/
    ├── database/db.js            # SQLite WAL mode: orders, topups, stocks, products
    └── gateway/
        ├── gopayAuth.js          # API Client meminta & verifikasi OTP ke server GoBiz
        ├── gopayClient.js        # Polling mutasi saldo ke API Merchant Analytics
        ├── paymentChecker.js     # Background worker interval 2.5s pencocok mutasi otomatis
        ├── qrisHelper.js         # Manipulasi Tag 01 -> 12, Tag 54 injection & CRC16 CCITT
        ├── webhookEngine.js      # Pengirim callback Midtrans SHA-512 signature
        └── sessionManager.js     # Pengelola masa aktif sesi token</pre>
        </div>
      </div>
    `
  },

  // --------------------------------------------------------------------------
  // GOBIZ AUTH
  // --------------------------------------------------------------------------
  'gobiz-auth': {
    id: 'gobiz-auth',
    title: 'Otentikasi GoBiz OTP',
    category: 'Bedah Kode Backend',
    prevPage: { id: 'code-structure', title: 'Struktur Repositori' },
    nextPage: { id: 'polling-checker', title: 'Worker Polling 2.5s' },
    render: () => `
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
          Otentikasi GoBiz & Sesi Token (login.js)
        </h1>
        <p class="text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          YuriPay menggunakan autentikasi resmi GoBiz merchant melalui nomor HP dan OTP:
        </p>

        <div class="callout-box callout-info mb-6">
          <strong>Perintah Login Interaktif:</strong>
          <pre class="mt-2 font-mono text-xs bg-slate-900 text-blue-300 p-2.5 rounded">node login.js</pre>
        </div>

        <ol class="space-y-3 text-sm text-slate-600 dark:text-slate-400 list-decimal list-inside leading-relaxed">
          <li><strong>Request OTP:</strong> Menghubungi endpoint resmi <code>https://api.gojekapi.com/v3/auth/token/request</code>.</li>
          <li><strong>Verifikasi OTP:</strong> Merchant mengetikkan 4-digit kode OTP dari SMS/WhatsApp.</li>
          <li><strong>Penyimpanan Sesi:</strong> Token disimpan di <code>.GOPAY_SESI_JANGAN_DIHAPUS.json</code>.</li>
          <li><strong>Auto-Refresh 6 Jam:</strong> Modul <code>sessionManager.js</code> otomatis memperbarui token setiap 6 jam agar sesi tidak pernah kedaluwarsa.</li>
        </ol>
      </div>
    `
  },

  // --------------------------------------------------------------------------
  // POLLING CHECKER
  // --------------------------------------------------------------------------
  'polling-checker': {
    id: 'polling-checker',
    title: 'Worker Polling 2.5s',
    category: 'Bedah Kode Backend',
    prevPage: { id: 'gobiz-auth', title: 'Otentikasi GoBiz OTP' },
    nextPage: { id: 'emvco-spec', title: 'Algoritma EMVCo & Tag 54' },
    render: () => `
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
          Worker Polling Mutasi 2.5 Detik (paymentChecker.js)
        </h1>
        <p class="text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          Bagian inti dari otomasi YuriPay adalah interval loop yang berjalan setiap 2.500 ms di server:
        </p>

        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs mb-6">
          <code>setInterval(async () => { await checkPendingPayments(); }, 2500);</code>
        </div>

        <h3 class="font-bold text-base text-slate-900 dark:text-white mb-2">Mekanisme Pencocokan:</h3>
        <ul class="space-y-2 text-sm text-slate-600 dark:text-slate-400 list-disc list-inside leading-relaxed">
          <li>Memanggil <code>https://api.gojekapi.com/merchant-analytics/v2/merchants/transactions</code> dengan token GoBiz.</li>
          <li>Mencocokkan transaksi nominal unik dengan invoice pending di database SQLite.</li>
          <li>Mengubah status menjadi <strong>PAID</strong> dan menyerahkan item digital (voucher/key) detik itu juga.</li>
        </ul>
      </div>
    `
  },

  // --------------------------------------------------------------------------
  // EMVCO SPEC
  // --------------------------------------------------------------------------
  'emvco-spec': {
    id: 'emvco-spec',
    title: 'Algoritma EMVCo & Tag 54',
    category: 'Bedah Kode Backend',
    prevPage: { id: 'polling-checker', title: 'Worker Polling 2.5s' },
    nextPage: { id: 'deployment', title: 'Panduan Deployment' },
    render: () => `
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
          Spesifikasi EMVCo & Injeksi Tag 54
        </h1>
        <p class="text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          Di balik konversi QRIS statis menjadi dinamis terdapat standar internasional EMVCo QR Code Specification for Payment Systems:
        </p>

        <div class="space-y-4 my-6 text-sm">
          <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            <h4 class="font-bold text-blue-600 dark:text-blue-400 mb-1">Tag 01 (Point of Initiation Method)</h4>
            <p class="text-slate-600 dark:text-slate-400">Nilai awal <code>11</code> (Statis / input manual) diubah menjadi <code>12</code> (Dinamis / locked amount).</p>
          </div>

          <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            <h4 class="font-bold text-blue-600 dark:text-blue-400 mb-1">Tag 54 (Transaction Amount)</h4>
            <p class="text-slate-600 dark:text-slate-400">Disuntikkan sebelum Tag 58 (Country Code ID). Contoh: nominal Rp 10.087 ditulis sebagai <code>540510087</code>.</p>
          </div>

          <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            <h4 class="font-bold text-blue-600 dark:text-blue-400 mb-1">Tag 63 (CRC-16 CCITT)</h4>
            <p class="text-slate-600 dark:text-slate-400">Dihitung ulang dengan polinom <code>0x1021</code> dan initial <code>0xFFFF</code> agar QRIS diterima oleh seluruh sistem perbankan nasional.</p>
          </div>
        </div>
      </div>
    `
  },

  // --------------------------------------------------------------------------
  // DEPLOYMENT GUIDES
  // --------------------------------------------------------------------------
  'deployment': {
    id: 'deployment',
    title: 'Panduan Deployment',
    category: 'Deployment',
    prevPage: { id: 'emvco-spec', title: 'Algoritma EMVCo & Tag 54' },
    nextPage: { id: 'github', title: 'GitHub & Kontributor' },
    render: () => `
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
          Panduan Deployment 24/7
        </h1>
        <p class="text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          YuriPay dapat dijalankan secara gratis di HP Android (Termux), VPS Linux, atau cPanel:
        </p>

        <!-- Termux -->
        <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 mb-6">
          <div class="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white mb-2">
            <i data-lucide="smartphone" class="w-4 h-4 text-blue-600"></i>
            <span>1. Termux Android (Gratis)</span>
          </div>
          <pre class="p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all max-w-full">
pkg update && pkg upgrade -y
pkg install git nodejs-lts python make build-essential -y
git clone https://github.com/myzert/YURIPAY-GOPAY.git
cd YURIPAY-GOPAY
npm install
cp .env.example .env
node login.js
npm install -g pm2
pm2 start server.js --name yuripay
pm2 save</pre>
        </div>

        <!-- VPS Linux -->
        <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 mb-6">
          <div class="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white mb-2">
            <i data-lucide="cloud" class="w-4 h-4 text-blue-600"></i>
            <span>2. VPS Ubuntu / Debian (PM2 & Nginx)</span>
          </div>
          <pre class="p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all max-w-full">
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git build-essential
git clone https://github.com/myzert/YURIPAY-GOPAY.git /var/www/yuripay
cd /var/www/yuripay
npm install --production
cp .env.example .env
node login.js
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup && pm2 save</pre>
        </div>

        <!-- cPanel -->
        <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          <div class="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white mb-2">
            <i data-lucide="server" class="w-4 h-4 text-blue-600"></i>
            <span>3. cPanel Node.js Selector</span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Pilih Node.js versi 20.x atau 22.x, set Application Root ke <code>yuripay</code>, startup file <code>server.js</code>, dan buka Terminal cPanel untuk menjalankan <code>node login.js</code>.
          </p>
        </div>
      </div>
    `
  },

  // --------------------------------------------------------------------------
  // GITHUB & COMMUNITY
  // --------------------------------------------------------------------------
  'github': {
    id: 'github',
    title: 'GitHub & Kontributor',
    category: 'Komunitas & Repo',
    prevPage: { id: 'deployment', title: 'Panduan Deployment' },
    render: () => `
      <div class="max-w-full overflow-hidden">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
          ⭐ GitHub Repository & Kontributor
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          Dukung proyek open-source resmi <strong>myzert/YURIPAY-GOPAY</strong> dengan memberikan Star dan Fork di GitHub.
        </p>

        <!-- Stats Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
          <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-center">
            <div id="statStars" class="text-2xl font-extrabold text-blue-600 dark:text-blue-400">...</div>
            <div class="text-xs text-slate-500 font-medium uppercase mt-0.5">Stars</div>
          </div>
          <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-center">
            <div id="statForks" class="text-2xl font-extrabold text-slate-800 dark:text-slate-200">...</div>
            <div class="text-xs text-slate-500 font-medium uppercase mt-0.5">Forks</div>
          </div>
          <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-center">
            <div id="statWatchers" class="text-2xl font-extrabold text-slate-800 dark:text-slate-200">...</div>
            <div class="text-xs text-slate-500 font-medium uppercase mt-0.5">Watchers</div>
          </div>
          <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-center">
            <div id="statIssues" class="text-2xl font-extrabold text-slate-800 dark:text-slate-200">...</div>
            <div class="text-xs text-slate-500 font-medium uppercase mt-0.5">Open Issues</div>
          </div>
        </div>

        <!-- Clone snippet -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 my-6">
          <div class="flex justify-between items-center mb-2 text-xs text-slate-400 font-mono">
            <span>Clone Perintah:</span>
            <button id="copyCloneBtn" class="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer">
              <i data-lucide="copy" class="w-3 h-3"></i>
              <span>Copy</span>
            </button>
          </div>
          <pre class="text-blue-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all max-w-full" id="cloneSnippetPre">git clone https://github.com/myzert/YURIPAY-GOPAY.git</pre>
        </div>

        <!-- Contributors Grid -->
        <div class="my-6">
          <h4 class="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Daftar Kontributor Resmi</h4>
          <div id="contributorList" class="grid sm:grid-cols-2 gap-4">
            <a href="https://github.com/myzert" target="_blank" rel="noopener" class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center gap-3.5 hover:border-blue-400 transition-colors shadow-sm">
              <img src="https://avatars.githubusercontent.com/u/325584707?v=4" class="w-12 h-12 rounded-full border border-slate-200" alt="myzert" />
              <div>
                <div class="font-bold text-sm text-slate-900 dark:text-white">myzert</div>
                <div class="text-xs text-blue-600 font-medium">👑 Author / Lead Developer</div>
                <div class="text-[11px] text-slate-500 font-mono">11+ Contributions</div>
              </div>
            </a>

            <a href="https://github.com/GTPSHAX" target="_blank" rel="noopener" class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center gap-3.5 hover:border-blue-400 transition-colors shadow-sm">
              <img src="https://avatars.githubusercontent.com/u/143262216?v=4" class="w-12 h-12 rounded-full border border-slate-200" alt="GTPSHAX" />
              <div>
                <div class="font-bold text-sm text-slate-900 dark:text-white">GTPSHAX</div>
                <div class="text-xs text-blue-600 font-medium">🛠️ Core Contributor</div>
                <div class="text-[11px] text-slate-500 font-mono">7+ Contributions</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    `,
    init: () => {
      setupGitHubListeners();
      fetchGitHubData();
    }
  }
};

// ============================================================================
// Layout Shell Render (Consumet & Google Developers Style)
// ============================================================================
app.innerHTML = `
<!-- Sticky Top Navigation Bar -->
<header class="sticky top-0 z-50 backdrop-blur-md bg-white/90 dark:bg-[#0b0f19]/90 border-b border-slate-200 dark:border-slate-800 transition-colors max-w-full overflow-hidden">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
    
    <!-- Brand / Logo -->
    <div class="flex items-center gap-3">
      <button id="mobileMenuBtn" class="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" aria-label="Toggle menu">
        <i data-lucide="menu" class="w-5 h-5"></i>
      </button>

      <a href="#/home" onclick="navigateTo('home'); return false;" class="flex items-center gap-2.5 group cursor-pointer">
        <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
          <i data-lucide="zap" class="w-4 h-4 fill-white"></i>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-lg tracking-tight text-slate-900 dark:text-white">YURIPAY</span>
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
            Docs
          </span>
        </div>
      </a>
    </div>

    <!-- Center Search Bar (Consumet / Google Style) -->
    <div class="hidden md:flex items-center flex-1 max-w-md mx-4">
      <div class="relative w-full">
        <i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input 
          type="text" 
          id="globalSearchInput"
          placeholder="Cari dokumentasi, API, simulator..." 
          class="w-full pl-9 pr-12 py-1.5 text-sm bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
        />
        <kbd class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">Ctrl K</kbd>
      </div>
    </div>

    <!-- Right Header Actions -->
    <div class="flex items-center gap-2.5">
      <a 
        href="https://github.com/myzert/YURIPAY-GOPAY" 
        target="_blank" 
        rel="noopener"
        class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
      >
        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        <span>Star</span>
        <span id="topStarCount" class="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">120+</span>
      </a>

      <button 
        id="themeToggleBtn" 
        class="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title="Ganti Tema (Gelap / Terang)"
      >
        <i data-lucide="sun" id="sunIcon" class="w-4 h-4 hidden dark:block text-amber-400"></i>
        <i data-lucide="moon" id="moonIcon" class="w-4 h-4 block dark:hidden text-slate-600"></i>
      </button>
    </div>
  </div>
</header>

<!-- Main Page Shell (Consumet & Google Layout) -->
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex max-w-full overflow-hidden">
  
  <!-- Left Navigation Sidebar -->
  <aside id="docSidebar" class="fixed inset-y-0 left-0 z-40 w-72 lg:w-64 bg-white dark:bg-[#0b0f19] lg:bg-transparent lg:dark:bg-transparent border-r border-slate-200 dark:border-slate-800 pt-20 lg:pt-6 pb-10 px-4 shrink-0 -translate-x-full lg:translate-x-0 transition-transform duration-200 lg:static overflow-y-auto max-h-screen">
    
    <div class="space-y-6 text-sm" id="sidebarNavContent">
      <!-- Getting Started -->
      <div>
        <div class="font-semibold text-xs tracking-wider uppercase text-slate-400 dark:text-slate-500 px-2.5 mb-2 flex items-center gap-1.5">
          <i data-lucide="book-open" class="w-3.5 h-3.5 text-blue-600"></i>
          <span>Getting Started</span>
        </div>
        <ul class="space-y-1">
          <li>
            <a href="#/home" onclick="navigateTo('home'); return false;" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" data-page="home">
              <i data-lucide="home" class="w-4 h-4"></i>
              <span>Overview</span>
            </a>
          </li>
          <li>
            <a href="#/docs/intro" onclick="navigateTo('intro'); return false;" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" data-page="intro">
              <i data-lucide="sparkles" class="w-4 h-4"></i>
              <span>Pengantar & Ikhtisar</span>
            </a>
          </li>
          <li>
            <a href="#/docs/dual-port" onclick="navigateTo('dual-port'); return false;" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" data-page="dual-port">
              <i data-lucide="layers" class="w-4 h-4"></i>
              <span>Arsitektur Dual-Port</span>
            </a>
          </li>
          <li>
            <a href="#/docs/workflow" onclick="navigateTo('workflow'); return false;" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" data-page="workflow">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i>
              <span>Alur Transaksi 100%</span>
            </a>
          </li>
        </ul>
      </div>

      <!-- Playground & Tools -->
      <div>
        <div class="font-semibold text-xs tracking-wider uppercase text-slate-400 dark:text-slate-500 px-2.5 mb-2 flex items-center gap-1.5">
          <i data-lucide="zap" class="w-3.5 h-3.5 text-blue-600"></i>
          <span>Playground & Tools</span>
        </div>
        <ul class="space-y-1">
          <li>
            <a href="#/docs/generator" onclick="navigateTo('generator'); return false;" class="nav-link flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" data-page="generator">
              <span class="flex items-center gap-2">
                <i data-lucide="qr-code" class="w-4 h-4 text-blue-600"></i>
                <span>Live Generator Dinamis</span>
              </span>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold">Live</span>
            </a>
          </li>
          <li>
            <a href="#/docs/checker" onclick="navigateTo('checker'); return false;" class="nav-link flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" data-page="checker">
              <span class="flex items-center gap-2">
                <i data-lucide="scan-line" class="w-4 h-4"></i>
                <span>Cek Code QRIS</span>
              </span>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold">Scan</span>
            </a>
          </li>
          <li>
            <a href="#/docs/webhook" onclick="navigateTo('webhook'); return false;" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" data-page="webhook">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
              <span>Midtrans Webhook Tester</span>
            </a>
          </li>
        </ul>
      </div>

      <!-- Bedah Kode Backend -->
      <div>
        <div class="font-semibold text-xs tracking-wider uppercase text-slate-400 dark:text-slate-500 px-2.5 mb-2 flex items-center gap-1.5">
          <i data-lucide="cpu" class="w-3.5 h-3.5 text-blue-600"></i>
          <span>Bedah Kode Backend</span>
        </div>
        <ul class="space-y-1">
          <li>
            <a href="#/docs/code-structure" onclick="navigateTo('code-structure'); return false;" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" data-page="code-structure">
              <i data-lucide="file-text" class="w-4 h-4"></i>
              <span>Struktur Repositori</span>
            </a>
          </li>
          <li>
            <a href="#/docs/gobiz-auth" onclick="navigateTo('gobiz-auth'); return false;" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" data-page="gobiz-auth">
              <i data-lucide="key" class="w-4 h-4"></i>
              <span>Otentikasi GoBiz OTP</span>
            </a>
          </li>
          <li>
            <a href="#/docs/polling-checker" onclick="navigateTo('polling-checker'); return false;" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" data-page="polling-checker">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i>
              <span>Worker Polling 2.5s</span>
            </a>
          </li>
          <li>
            <a href="#/docs/emvco-spec" onclick="navigateTo('emvco-spec'); return false;" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" data-page="emvco-spec">
              <i data-lucide="check-circle-2" class="w-4 h-4"></i>
              <span>Algoritma EMVCo & Tag 54</span>
            </a>
          </li>
        </ul>
      </div>

      <!-- Deployment -->
      <div>
        <div class="font-semibold text-xs tracking-wider uppercase text-slate-400 dark:text-slate-500 px-2.5 mb-2 flex items-center gap-1.5">
          <i data-lucide="server" class="w-3.5 h-3.5 text-blue-600"></i>
          <span>Deployment</span>
        </div>
        <ul class="space-y-1">
          <li>
            <a href="#/docs/deployment" onclick="navigateTo('deployment'); return false;" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" data-page="deployment">
              <i data-lucide="cloud" class="w-4 h-4"></i>
              <span>Panduan Deployment</span>
            </a>
          </li>
        </ul>
      </div>

      <!-- Komunitas -->
      <div>
        <div class="font-semibold text-xs tracking-wider uppercase text-slate-400 dark:text-slate-500 px-2.5 mb-2 flex items-center gap-1.5">
          <i data-lucide="star" class="w-3.5 h-3.5 text-blue-600"></i>
          <span>Komunitas & Repo</span>
        </div>
        <ul class="space-y-1">
          <li>
            <a href="#/docs/github" onclick="navigateTo('github'); return false;" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" data-page="github">
              <i data-lucide="star" class="w-4 h-4"></i>
              <span>GitHub & Kontributor</span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  </aside>

  <!-- Mobile Backdrop Overlay -->
  <div id="mobileBackdrop" class="fixed inset-0 bg-black/50 z-30 hidden lg:hidden backdrop-blur-sm"></div>

  <!-- Dedicated Main Page Content (Isolated Single Page at a Time) -->
  <main class="flex-1 min-w-0 max-w-full overflow-hidden py-8 lg:px-8">
    <div id="pageContentContainer" class="max-w-full overflow-hidden">
      <!-- Injected by navigateTo() -->
    </div>

    <!-- Page Pagination Navigation (Previous / Next) (Consumet Style) -->
    <div id="pagePaginationBox" class="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 max-w-full">
      <div id="prevPageBtnSlot"></div>
      <div id="nextPageBtnSlot"></div>
    </div>
  </main>

</div>

<!-- Toast Alert -->
<div id="toastEl" class="fixed bottom-6 right-6 z-50 hidden px-4 py-2.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl border border-slate-800 dark:border-slate-200 transition-all flex items-center gap-2">
  <i data-lucide="check" class="w-4 h-4 text-emerald-400"></i>
  <span id="toastMsg">Tersalin!</span>
</div>
`;

// ============================================================================
// Router & Page Navigation
// ============================================================================

function navigateTo(pageId: string) {
  const page = PAGES[pageId] || PAGES['home'];

  // Update hash
  window.location.hash = page.id === 'home' ? '/home' : `/docs/${page.id}`;

  // Update active sidebar link
  document.querySelectorAll('.nav-link').forEach(link => {
    const target = link.getAttribute('data-page');
    if (target === page.id) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Render Page Content into container
  const container = document.getElementById('pageContentContainer')!;
  container.innerHTML = `
    <!-- Breadcrumb (Consumet Style) -->
    <div class="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 mb-3">
      <a href="#/home" onclick="navigateTo('home'); return false;" class="hover:underline text-slate-500">Docs</a>
      <i data-lucide="chevron-right" class="w-3 h-3 text-slate-400"></i>
      <span class="text-slate-500">${page.category}</span>
      <i data-lucide="chevron-right" class="w-3 h-3 text-slate-400"></i>
      <span class="font-semibold text-slate-800 dark:text-slate-200">${page.title}</span>
    </div>

    <!-- Main Content -->
    ${page.render()}
  `;

  // Render Previous & Next buttons
  const prevSlot = document.getElementById('prevPageBtnSlot')!;
  const nextSlot = document.getElementById('nextPageBtnSlot')!;

  if (page.prevPage) {
    prevSlot.innerHTML = `
      <button onclick="navigateTo('${page.prevPage.id}')" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-white dark:bg-slate-900 text-left transition-all cursor-pointer group">
        <div class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
          <i data-lucide="chevron-left" class="w-3 h-3"></i>
          <span>Previous</span>
        </div>
        <div class="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600">${page.prevPage.title}</div>
      </button>
    `;
  } else {
    prevSlot.innerHTML = '';
  }

  if (page.nextPage) {
    nextSlot.innerHTML = `
      <button onclick="navigateTo('${page.nextPage.id}')" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-white dark:bg-slate-900 text-right transition-all cursor-pointer group">
        <div class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center justify-end gap-1">
          <span>Next</span>
          <i data-lucide="chevron-right" class="w-3 h-3"></i>
        </div>
        <div class="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600">${page.nextPage.title}</div>
      </button>
    `;
  } else {
    nextSlot.innerHTML = '';
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Close mobile sidebar if open
  toggleSidebar(false);

  // Initialize page-specific logic
  if (page.init) {
    page.init();
  }

  // Re-run Lucide icons
  createIcons({ icons: appIcons });
}

// Make navigateTo globally accessible for inline onclick
(window as any).navigateTo = navigateTo;

// ============================================================================
// Interactive Page Logic Implementations
// ============================================================================

// Toast Helper
const toastEl = document.getElementById('toastEl') as HTMLDivElement;
const toastMsg = document.getElementById('toastMsg') as HTMLSpanElement;
function showToast(msg: string) {
  toastMsg.innerText = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2200);
}

// Theme Switcher
const themeToggleBtn = document.getElementById('themeToggleBtn') as HTMLButtonElement;
function applyTheme(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem('yuripay_theme_mode', isDark ? 'dark' : 'light');
  createIcons({ icons: appIcons });
}

const savedTheme = localStorage.getItem('yuripay_theme_mode');
applyTheme(savedTheme !== 'light');

themeToggleBtn?.addEventListener('click', () => {
  const isDark = document.documentElement.classList.contains('dark');
  applyTheme(!isDark);
});

// Mobile Sidebar Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn') as HTMLButtonElement;
const docSidebar = document.getElementById('docSidebar') as HTMLElement;
const mobileBackdrop = document.getElementById('mobileBackdrop') as HTMLDivElement;

function toggleSidebar(open: boolean) {
  if (open) {
    docSidebar.classList.remove('-translate-x-full');
    mobileBackdrop.classList.remove('hidden');
  } else {
    docSidebar.classList.add('-translate-x-full');
    mobileBackdrop.classList.add('hidden');
  }
}

mobileMenuBtn?.addEventListener('click', () => toggleSidebar(true));
mobileBackdrop?.addEventListener('click', () => toggleSidebar(false));

// Search Filter
const globalSearchInput = document.getElementById('globalSearchInput') as HTMLInputElement;
globalSearchInput?.addEventListener('input', () => {
  const q = globalSearchInput.value.toLowerCase().trim();
  document.querySelectorAll('#sidebarNavContent .nav-link').forEach(link => {
    const text = link.textContent?.toLowerCase() || '';
    const parent = link.closest('li');
    if (!parent) return;
    if (!q || text.includes(q)) {
      parent.style.display = '';
    } else {
      parent.style.display = 'none';
    }
  });
});

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    globalSearchInput?.focus();
  }
});

// ----------------------------------------------------------------------------
// Generator Page Logic
// ----------------------------------------------------------------------------
function setupGeneratorListeners() {
  const presetDompuBtn = document.getElementById('presetDompuBtn') as HTMLButtonElement;
  const presetZeroBtn = document.getElementById('presetZeroBtn') as HTMLButtonElement;
  const presetCustomBtn = document.getElementById('presetCustomBtn') as HTMLButtonElement;
  const staticQrisInput = document.getElementById('staticQrisInput') as HTMLTextAreaElement;
  const nominalInput = document.getElementById('nominalInput') as HTMLInputElement;
  const uniqueModeSelect = document.getElementById('uniqueModeSelect') as HTMLSelectElement;
  const customOffsetBox = document.getElementById('customOffsetBox') as HTMLDivElement;
  const customOffsetInput = document.getElementById('customOffsetInput') as HTMLInputElement;
  const feeTypeSelect = document.getElementById('feeTypeSelect') as HTMLSelectElement;
  const feeValInput = document.getElementById('feeValInput') as HTMLInputElement;
  const generateDynamicBtn = document.getElementById('generateDynamicBtn') as HTMLButtonElement;
  const downloadQrBtn = document.getElementById('downloadQrBtn') as HTMLButtonElement;
  const copyDynamicTextBtn = document.getElementById('copyDynamicTextBtn') as HTMLButtonElement;

  presetDompuBtn?.addEventListener('click', () => {
    staticQrisInput.value = PRESET_MISTER_DOMPU;
    presetDompuBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-600 bg-blue-600 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer';
    presetZeroBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 transition-all cursor-pointer';
    presetCustomBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 transition-all cursor-pointer';
    updateDynamicGenerator();
  });

  presetZeroBtn?.addEventListener('click', () => {
    staticQrisInput.value = PRESET_ZERO_SHOP;
    presetZeroBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-600 bg-blue-600 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer';
    presetDompuBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 transition-all cursor-pointer';
    presetCustomBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 transition-all cursor-pointer';
    updateDynamicGenerator();
  });

  presetCustomBtn?.addEventListener('click', () => {
    presetCustomBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-600 bg-blue-600 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer';
    presetDompuBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 transition-all cursor-pointer';
    presetZeroBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 transition-all cursor-pointer';
    staticQrisInput.focus();
  });

  document.querySelectorAll('.nom-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.nom-chip').forEach(c => {
        c.className = 'nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 cursor-pointer';
      });
      chip.className = 'nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 cursor-pointer';
      nominalInput.value = chip.getAttribute('data-nom') || '1000';
      updateDynamicGenerator();
    });
  });

  uniqueModeSelect?.addEventListener('change', () => {
    currentOffsetMode = uniqueModeSelect.value;
    customOffsetBox.classList.toggle('hidden', currentOffsetMode !== 'custom');
    updateDynamicGenerator();
  });

  customOffsetInput?.addEventListener('input', () => {
    customOffset = parseInt(customOffsetInput.value, 10) || 0;
    updateDynamicGenerator();
  });

  feeTypeSelect?.addEventListener('change', () => {
    feeType = feeTypeSelect.value;
    feeValInput.disabled = feeType === 'none';
    if (feeType === 'none') feeValInput.value = '0';
    feeValue = parseFloat(feeValInput.value) || 0;
    updateDynamicGenerator();
  });

  feeValInput?.addEventListener('input', () => {
    feeValue = parseFloat(feeValInput.value) || 0;
    updateDynamicGenerator();
  });

  generateDynamicBtn?.addEventListener('click', () => {
    updateDynamicGenerator();
    showToast('✓ Dynamic QRIS diperbarui!');
  });

  nominalInput?.addEventListener('input', updateDynamicGenerator);
  staticQrisInput?.addEventListener('input', updateDynamicGenerator);

  downloadQrBtn?.addEventListener('click', () => {
    const canvas = document.getElementById('dynamicQrCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `QRIS-YURIPAY-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('📥 Gambar QRIS PNG berhasil didownload!');
  });

  copyDynamicTextBtn?.addEventListener('click', () => {
    const output = document.getElementById('dynamicRawOutput') as HTMLElement;
    if (!output) return;
    navigator.clipboard.writeText(output.innerText);
    showToast('📋 Raw text QRIS berhasil disalin!');
  });
}

function updateDynamicGenerator() {
  const staticQrisInput = document.getElementById('staticQrisInput') as HTMLTextAreaElement;
  const nominalInput = document.getElementById('nominalInput') as HTMLInputElement;
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

  if (!staticQrisInput || !nominalInput || !dynamicQrCanvas) return;

  const baseNom = parseInt(nominalInput.value, 10) || 1000;
  const staticStr = staticQrisInput.value.trim() || PRESET_MISTER_DOMPU;

  const result = generateDynamicQRIS(staticStr, baseNom);

  if (displayTotalAmount) displayTotalAmount.innerText = formatRupiah(result.finalTotalAmount);
  if (lblBaseNominal) lblBaseNominal.innerText = formatRupiah(result.baseNominal);
  if (lblUniqueOffset) lblUniqueOffset.innerText = `+Rp ${result.uniqueOffset}`;
  if (lblFeeAmount) lblFeeAmount.innerText = `+Rp ${result.feeAmount}`;
  if (lblFinalAmount) lblFinalAmount.innerText = formatRupiah(result.finalTotalAmount);

  if (dynamicRawOutput) dynamicRawOutput.innerText = result.rawQris;
  if (dynamicCrcBadge) dynamicCrcBadge.innerText = `CRC16: ${result.checksum}`;

  const parsed = parseEMVCoTLV(result.rawQris);
  const tag59 = parsed.tags.find(t => t.tag === '59')?.val || 'Merchant QRIS';
  const tag60 = parsed.tags.find(t => t.tag === '60')?.val || 'Indonesia';
  if (displayMerchantInfo) displayMerchantInfo.innerText = `${tag59} • ${tag60}`;

  QRCode.toCanvas(dynamicQrCanvas, result.rawQris, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  }, (err) => {
    if (err) console.error('Canvas error:', err);
  });

  if (dynamicTlvTableBody) {
    dynamicTlvTableBody.innerHTML = '';
    parsed.tags.forEach(t => {
      const row = document.createElement('tr');
      const isSpecial = t.tag === '01' || t.tag === '54' || t.tag === '63';
      row.className = isSpecial ? 'bg-blue-50/50 dark:bg-blue-950/20' : '';
      row.innerHTML = `
        <td class="py-2 px-3 font-bold ${isSpecial ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}">Tag ${t.tag}</td>
        <td class="py-2 px-3 text-slate-500">${t.len}</td>
        <td class="py-2 px-3 break-all max-w-xs ${isSpecial ? 'text-blue-600 dark:text-blue-300 font-bold' : 'text-slate-800 dark:text-slate-200'}">${escapeHtml(t.val)}</td>
        <td class="py-2 px-3 font-sans font-medium text-slate-900 dark:text-slate-100">${escapeHtml(t.name)}</td>
        <td class="py-2 px-3 font-sans text-slate-500 dark:text-slate-400">${escapeHtml(t.desc)}</td>
      `;
      dynamicTlvTableBody.appendChild(row);
    });
  }
}

// ----------------------------------------------------------------------------
// Checker Page Logic
// ----------------------------------------------------------------------------
function setupCheckerListeners() {
  const qrDropzone = document.getElementById('qrDropzone') as HTMLDivElement;
  const qrFileInput = document.getElementById('qrFileInput') as HTMLInputElement;
  const copyScannedRawBtn = document.getElementById('copyScannedRawBtn') as HTMLButtonElement;
  const transferToGeneratorBtn = document.getElementById('transferToGeneratorBtn') as HTMLButtonElement;

  qrDropzone?.addEventListener('click', () => qrFileInput?.click());

  qrDropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    qrDropzone.classList.add('dropzone-active');
  });

  qrDropzone?.addEventListener('dragleave', () => {
    qrDropzone.classList.remove('dropzone-active');
  });

  qrDropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    qrDropzone.classList.remove('dropzone-active');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      handleQRFile(e.dataTransfer.files[0]);
    }
  });

  qrFileInput?.addEventListener('change', () => {
    if (qrFileInput.files && qrFileInput.files.length > 0) {
      handleQRFile(qrFileInput.files[0]);
    }
  });

  copyScannedRawBtn?.addEventListener('click', () => {
    navigator.clipboard.writeText(lastScannedRawText);
    showToast('📋 Text QRIS berhasil disalin!');
  });

  transferToGeneratorBtn?.addEventListener('click', () => {
    if (!lastScannedRawText) return;
    navigateTo('generator');
    setTimeout(() => {
      const staticInput = document.getElementById('staticQrisInput') as HTMLTextAreaElement;
      if (staticInput) {
        staticInput.value = lastScannedRawText;
        updateDynamicGenerator();
        showToast('🚀 QRIS dimuat ke Generator Dinamis!');
      }
    }, 100);
  });
}

function handleQRFile(file: File) {
  const checkerImagePreview = document.getElementById('checkerImagePreview') as HTMLImageElement;
  const checkerResultBox = document.getElementById('checkerResultBox') as HTMLDivElement;
  const checkerStatusAlert = document.getElementById('checkerStatusAlert') as HTMLDivElement;

  if (!file.type.startsWith('image/')) {
    if (checkerStatusAlert) {
      checkerStatusAlert.classList.remove('hidden');
      checkerStatusAlert.innerText = '⚠️ File yang dipilih bukan gambar valid!';
      checkerStatusAlert.className = 'mt-4 p-3 rounded-lg text-xs font-medium border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400';
    }
    return;
  }

  if (checkerStatusAlert) {
    checkerStatusAlert.classList.remove('hidden');
    checkerStatusAlert.innerText = '⏳ Memindai gambar QRIS...';
    checkerStatusAlert.className = 'mt-4 p-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300';
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target?.result as string;
    if (checkerImagePreview) checkerImagePreview.src = dataUrl;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      });

      if (code && code.data && code.data.trim().length > 0) {
        processDecodedQR(code.data.trim());
      } else {
        if (checkerStatusAlert) {
          checkerStatusAlert.classList.remove('hidden');
          checkerStatusAlert.innerText = '✕ Tidak ditemukan QR code dalam gambar. Pastikan gambar cukup jelas dan tidak buram.';
          checkerStatusAlert.className = 'mt-4 p-3 rounded-lg text-xs font-medium border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400';
        }
        if (checkerResultBox) checkerResultBox.classList.add('hidden');
      }
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function processDecodedQR(raw: string) {
  lastScannedRawText = raw;
  const checkerStatusAlert = document.getElementById('checkerStatusAlert') as HTMLDivElement;
  const checkerResultBox = document.getElementById('checkerResultBox') as HTMLDivElement;
  const chkMerchantName = document.getElementById('chkMerchantName') as HTMLElement;
  const chkMerchantCity = document.getElementById('chkMerchantCity') as HTMLElement;
  const chkPostalCode = document.getElementById('chkPostalCode') as HTMLElement;
  const chkQrType = document.getElementById('chkQrType') as HTMLElement;
  const chkAmount = document.getElementById('chkAmount') as HTMLElement;
  const chkAcquirer = document.getElementById('chkAcquirer') as HTMLElement;
  const chkCrcStatus = document.getElementById('chkCrcStatus') as HTMLElement;
  const chkRawTextOutput = document.getElementById('chkRawTextOutput') as HTMLElement;
  const checkerTlvTableBody = document.querySelector('#checkerTlvTable tbody') as HTMLElement;

  if (checkerStatusAlert) checkerStatusAlert.classList.add('hidden');
  if (checkerResultBox) checkerResultBox.classList.remove('hidden');

  if (chkRawTextOutput) chkRawTextOutput.innerText = raw;
  const parsed = parseEMVCoTLV(raw);

  const tag01 = parsed.tags.find(t => t.tag === '01')?.val;
  const tag59 = parsed.tags.find(t => t.tag === '59')?.val || 'Tidak Terdeteksi';
  const tag60 = parsed.tags.find(t => t.tag === '60')?.val || 'Tidak Terdeteksi';
  const tag61 = parsed.tags.find(t => t.tag === '61')?.val || '-';
  const tag54 = parsed.tags.find(t => t.tag === '54')?.val;
  const tag26 = parsed.tags.find(t => t.tag === '26')?.val || '';

  if (chkMerchantName) chkMerchantName.innerText = tag59;
  if (chkMerchantCity) chkMerchantCity.innerText = tag60;
  if (chkPostalCode) chkPostalCode.innerText = tag61;

  if (chkQrType) {
    if (tag01 === '12') {
      chkQrType.innerText = 'DINAMIS (12)';
      chkQrType.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-500/20';
    } else if (tag01 === '11') {
      chkQrType.innerText = 'STATIS (11)';
      chkQrType.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-500/20';
    }
  }

  if (chkAmount) chkAmount.innerText = tag54 ? formatRupiah(parseInt(tag54, 10)) : 'Bebas (Input Manual)';

  let acquirerName = 'National QRIS';
  if (tag26.includes('GO-JEK') || tag26.includes('GOPAY')) {
    acquirerName = 'GoBiz / GoPay';
  } else if (tag26.includes('CIMB')) {
    acquirerName = 'CIMB Niaga';
  } else if (tag26.includes('BCA')) {
    acquirerName = 'BCA';
  }
  if (chkAcquirer) chkAcquirer.innerText = acquirerName;

  if (chkCrcStatus) {
    if (parsed.validCrc) {
      chkCrcStatus.innerText = `✓ VALID (${parsed.embeddedCrc})`;
      chkCrcStatus.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white';
    } else {
      chkCrcStatus.innerText = `MISMATCH (Calc: ${parsed.calculatedCrc})`;
      chkCrcStatus.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white';
    }
  }

  if (checkerTlvTableBody) {
    checkerTlvTableBody.innerHTML = '';
    parsed.tags.forEach(t => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="py-2 px-3 font-bold text-slate-500">Tag ${t.tag}</td>
        <td class="py-2 px-3 text-slate-500">${t.len}</td>
        <td class="py-2 px-3 break-all max-w-xs text-slate-800 dark:text-slate-200">${escapeHtml(t.val)}</td>
        <td class="py-2 px-3 font-sans font-medium text-slate-900 dark:text-slate-100">${escapeHtml(t.name)}</td>
        <td class="py-2 px-3 font-sans text-slate-500 dark:text-slate-400">${escapeHtml(t.desc)}</td>
      `;
      checkerTlvTableBody.appendChild(row);
    });
  }

  showToast('✓ Berhasil mendecode QRIS code!');
}

// ----------------------------------------------------------------------------
// Webhook Tester Logic
// ----------------------------------------------------------------------------
function setupWebhookListeners() {
  const calcSignatureBtn = document.getElementById('calcSignatureBtn') as HTMLButtonElement;
  const copySignatureBtn = document.getElementById('copySignatureBtn') as HTMLButtonElement;
  const copyWebhookPayloadBtn = document.getElementById('copyWebhookPayloadBtn') as HTMLButtonElement;

  calcSignatureBtn?.addEventListener('click', () => {
    updateSignatureSimulator();
    showToast('⚡ Signature SHA-512 dihitung!');
  });

  copySignatureBtn?.addEventListener('click', () => {
    const pre = document.getElementById('sigOutputPre') as HTMLElement;
    if (pre) {
      navigator.clipboard.writeText(pre.innerText);
      showToast('📋 Signature berhasil disalin!');
    }
  });

  copyWebhookPayloadBtn?.addEventListener('click', () => {
    const pre = document.getElementById('webhookPayloadPre') as HTMLElement;
    if (pre) {
      navigator.clipboard.writeText(pre.innerText);
      showToast('📋 JSON callback berhasil disalin!');
    }
  });
}

async function updateSignatureSimulator() {
  const sigOrderId = document.getElementById('sigOrderId') as HTMLInputElement;
  const sigStatusCode = document.getElementById('sigStatusCode') as HTMLInputElement;
  const sigGrossAmount = document.getElementById('sigGrossAmount') as HTMLInputElement;
  const sigServerKey = document.getElementById('sigServerKey') as HTMLInputElement;
  const sigOutputPre = document.getElementById('sigOutputPre') as HTMLElement;
  const webhookPayloadPre = document.getElementById('webhookPayloadPre') as HTMLElement;

  if (!sigOrderId || !sigStatusCode || !sigGrossAmount || !sigServerKey) return;

  const orderId = sigOrderId.value.trim();
  const statusCode = sigStatusCode.value.trim();
  const grossAmount = sigGrossAmount.value.trim();
  const serverKey = sigServerKey.value.trim();

  const rawString = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const signature = await computeSHA512(rawString);

  if (sigOutputPre) sigOutputPre.innerText = signature;

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
    currency: 'IDR',
    acquirer: 'gopay'
  };

  if (webhookPayloadPre) webhookPayloadPre.innerText = JSON.stringify(mockPayload, null, 2);
}

// ----------------------------------------------------------------------------
// GitHub Logic
// ----------------------------------------------------------------------------
function setupGitHubListeners() {
  const copyCloneBtn = document.getElementById('copyCloneBtn') as HTMLButtonElement;
  const cloneSnippetPre = document.getElementById('cloneSnippetPre') as HTMLElement;

  copyCloneBtn?.addEventListener('click', () => {
    if (cloneSnippetPre) {
      navigator.clipboard.writeText(cloneSnippetPre.innerText);
      showToast('📋 Perintah clone berhasil disalin!');
    }
  });
}

async function fetchGitHubData() {
  const topStarCount = document.getElementById('topStarCount');
  const statStars = document.getElementById('statStars');
  const statForks = document.getElementById('statForks');
  const statWatchers = document.getElementById('statWatchers');
  const statIssues = document.getElementById('statIssues');
  const contributorList = document.getElementById('contributorList');

  try {
    const repoRes = await fetch('https://api.github.com/repos/myzert/YURIPAY-GOPAY');
    if (repoRes.ok) {
      const repoData = await repoRes.json();
      const stars = repoData.stargazers_count ?? 120;
      const forks = repoData.forks_count ?? 15;
      const watchers = repoData.watchers_count ?? 120;
      const issues = repoData.open_issues_count ?? 2;

      if (topStarCount) topStarCount.innerText = stars.toString();
      if (statStars) statStars.innerText = stars.toString();
      if (statForks) statForks.innerText = forks.toString();
      if (statWatchers) statWatchers.innerText = watchers.toString();
      if (statIssues) statIssues.innerText = issues.toString();
    }
  } catch {
    if (topStarCount) topStarCount.innerText = '120+';
  }

  try {
    const contribRes = await fetch('https://api.github.com/repos/myzert/YURIPAY-GOPAY/contributors');
    if (contribRes.ok && contributorList) {
      const contributors = await contribRes.json();
      if (Array.isArray(contributors) && contributors.length > 0) {
        contributorList.innerHTML = '';
        contributors.forEach((c: any) => {
          const card = document.createElement('a');
          card.href = c.html_url;
          card.target = '_blank';
          card.rel = 'noopener';
          card.className = 'p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center gap-3.5 hover:border-blue-400 transition-colors shadow-sm';
          card.innerHTML = `
            <img src="${c.avatar_url}" class="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700" alt="${c.login}" />
            <div>
              <div class="font-bold text-sm text-slate-900 dark:text-white">${escapeHtml(c.login)}</div>
              <div class="text-xs text-blue-600 font-medium">${c.login === 'myzert' ? '👑 Author / Lead Developer' : '🛠️ Core Contributor'}</div>
              <div class="text-[11px] text-slate-500 font-mono">${c.contributions} Commits</div>
            </div>
          `;
          contributorList.appendChild(card);
        });
      }
    }
  } catch {
    // Keep fallback
  }
}

// ----------------------------------------------------------------------------
// Window Hash Change Router Listener
// ----------------------------------------------------------------------------
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace(/^#\/?(docs\/)?/, '');
  navigateTo(hash || 'home');
});

// Initial load
const initialHash = window.location.hash.replace(/^#\/?(docs\/)?/, '');
navigateTo(initialHash || 'home');
fetchGitHubData();
