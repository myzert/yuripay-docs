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
  Check
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
  Check
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

// ============================================================================
// Render Documentation Layout
// ============================================================================
const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
<!-- Sticky Top Navigation Bar -->
<header class="sticky top-0 z-50 backdrop-blur-md bg-white/85 dark:bg-[#09090b]/85 border-b border-zinc-200 dark:border-zinc-800 transition-colors">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
    
    <!-- Brand / Logo & Version -->
    <div class="flex items-center gap-3">
      <button id="mobileMenuBtn" class="lg:hidden p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Toggle menu">
        <i data-lucide="menu" class="w-5 h-5"></i>
      </button>

      <a href="#intro" class="flex items-center gap-2.5 group">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
          <i data-lucide="zap" class="w-4 h-4 fill-white"></i>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-lg tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-700 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent">YURIPAY</span>
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60">
            v1.2 Docs
          </span>
        </div>
      </a>
    </div>

    <!-- Center Search Bar -->
    <div class="hidden md:flex items-center flex-1 max-w-md mx-4">
      <div class="relative w-full">
        <i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
        <input 
          type="text" 
          id="globalSearchInput"
          placeholder="Cari dokumentasi, API, simulator..." 
          class="w-full pl-9 pr-12 py-1.5 text-sm bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 dark:focus:ring-rose-400 focus:bg-white dark:focus:bg-zinc-950 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
        />
        <kbd class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">Ctrl K</kbd>
      </div>
    </div>

    <!-- Right Header Actions -->
    <div class="flex items-center gap-2.5">
      <!-- GitHub Stats Button -->
      <a 
        href="https://github.com/myzert/YURIPAY-GOPAY" 
        target="_blank" 
        rel="noopener"
        class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 transition-colors shadow-sm"
      >
        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        <span>Star</span>
        <span id="topStarCount" class="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono font-semibold text-rose-600 dark:text-rose-400">120+</span>
      </a>

      <!-- Fork Button -->
      <a 
        href="https://github.com/myzert/YURIPAY-GOPAY/fork" 
        target="_blank" 
        rel="noopener"
        class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 transition-colors shadow-sm"
      >
        <i data-lucide="git-fork" class="w-3.5 h-3.5 text-zinc-500"></i>
        <span>Fork</span>
        <span id="topForkCount" class="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono font-semibold">15+</span>
      </a>

      <!-- Theme Switcher -->
      <button 
        id="themeToggleBtn" 
        class="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        title="Ganti Tema (Gelap / Terang)"
      >
        <i data-lucide="sun" id="sunIcon" class="w-4 h-4 hidden dark:block text-rose-400"></i>
        <i data-lucide="moon" id="moonIcon" class="w-4 h-4 block dark:hidden text-zinc-600"></i>
      </button>
    </div>
  </div>
</header>

<!-- Main Documentation Layout -->
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex">
  
  <!-- Left Sidebar (Navigation Tree) -->
  <aside id="docSidebar" class="fixed inset-y-0 left-0 z-40 w-72 lg:w-64 bg-white dark:bg-[#09090b] lg:bg-transparent lg:dark:bg-transparent border-r border-zinc-200 dark:border-zinc-800 pt-20 lg:pt-6 pb-10 px-4 shrink-0 -translate-x-full lg:translate-x-0 transition-transform duration-200 lg:static overflow-y-auto max-h-screen">
    
    <div class="space-y-6 text-sm" id="navSectionsContainer">
      <!-- Group 1: Getting Started -->
      <div>
        <div class="font-semibold text-xs tracking-wider uppercase text-zinc-400 dark:text-zinc-500 px-2.5 mb-2 flex items-center gap-1.5">
          <i data-lucide="book-open" class="w-3.5 h-3.5 text-rose-500"></i>
          <span>Getting Started</span>
        </div>
        <ul class="space-y-1">
          <li>
            <a href="#intro" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <i data-lucide="sparkles" class="w-4 h-4"></i>
              <span>Pengantar & Ikhtisar</span>
            </a>
          </li>
          <li>
            <a href="#architecture" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <i data-lucide="layers" class="w-4 h-4"></i>
              <span>Arsitektur Dual-Port</span>
            </a>
          </li>
          <li>
            <a href="#workflow" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i>
              <span>Alur Transaksi 100%</span>
            </a>
          </li>
        </ul>
      </div>

      <!-- Group 2: Interactive Playground -->
      <div>
        <div class="font-semibold text-xs tracking-wider uppercase text-zinc-400 dark:text-zinc-500 px-2.5 mb-2 flex items-center gap-1.5">
          <i data-lucide="zap" class="w-3.5 h-3.5 text-rose-500"></i>
          <span>Playground & Tools</span>
        </div>
        <ul class="space-y-1">
          <li>
            <a href="#generator" class="nav-link active flex items-center justify-between px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <span class="flex items-center gap-2">
                <i data-lucide="qr-code" class="w-4 h-4 text-rose-500"></i>
                <span>Generator Dinamis</span>
              </span>
              <span class="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500 text-white font-bold">Live</span>
            </a>
          </li>
          <li>
            <a href="#checker" class="nav-link flex items-center justify-between px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <span class="flex items-center gap-2">
                <i data-lucide="scan-line" class="w-4 h-4"></i>
                <span>Cek Code QRIS</span>
              </span>
              <span class="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">Scanner</span>
            </a>
          </li>
          <li>
            <a href="#webhook" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
              <span>Midtrans Webhook Tester</span>
            </a>
          </li>
        </ul>
      </div>

      <!-- Group 3: Codebase Deep Dive -->
      <div>
        <div class="font-semibold text-xs tracking-wider uppercase text-zinc-400 dark:text-zinc-500 px-2.5 mb-2 flex items-center gap-1.5">
          <i data-lucide="cpu" class="w-3.5 h-3.5 text-rose-500"></i>
          <span>Bedah Kode Backend</span>
        </div>
        <ul class="space-y-1">
          <li>
            <a href="#code-structure" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <i data-lucide="file-text" class="w-4 h-4"></i>
              <span>Struktur Repositori</span>
            </a>
          </li>
          <li>
            <a href="#gobiz-auth" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <i data-lucide="key" class="w-4 h-4"></i>
              <span>Otentikasi GoBiz OTP</span>
            </a>
          </li>
          <li>
            <a href="#polling-checker" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i>
              <span>Worker Polling 2.5 Detik</span>
            </a>
          </li>
          <li>
            <a href="#emvco-spec" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <i data-lucide="check-circle-2" class="w-4 h-4"></i>
              <span>Spesifikasi EMVCo & Tag 54</span>
            </a>
          </li>
          <li>
            <a href="#database" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <i data-lucide="database" class="w-4 h-4"></i>
              <span>Database SQLite WAL</span>
            </a>
          </li>
        </ul>
      </div>

      <!-- Group 4: Deployment -->
      <div>
        <div class="font-semibold text-xs tracking-wider uppercase text-zinc-400 dark:text-zinc-500 px-2.5 mb-2 flex items-center gap-1.5">
          <i data-lucide="server" class="w-3.5 h-3.5 text-rose-500"></i>
          <span>Panduan Deployment</span>
        </div>
        <ul class="space-y-1">
          <li>
            <a href="#deploy-termux" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <i data-lucide="smartphone" class="w-4 h-4"></i>
              <span>Termux Android</span>
            </a>
          </li>
          <li>
            <a href="#deploy-vps" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <i data-lucide="cloud" class="w-4 h-4"></i>
              <span>VPS Linux & PM2</span>
            </a>
          </li>
          <li>
            <a href="#deploy-cpanel" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
              <i data-lucide="server" class="w-4 h-4"></i>
              <span>cPanel Node.js Selector</span>
            </a>
          </li>
        </ul>
      </div>

      <!-- Group 5: Community -->
      <div>
        <div class="font-semibold text-xs tracking-wider uppercase text-zinc-400 dark:text-zinc-500 px-2.5 mb-2 flex items-center gap-1.5">
          <i data-lucide="star" class="w-3.5 h-3.5 text-rose-500"></i>
          <span>Komunitas & Repo</span>
        </div>
        <ul class="space-y-1">
          <li>
            <a href="#github" class="nav-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
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

  <!-- Center Content Area (Documentation Pages) -->
  <main class="flex-1 min-w-0 py-8 lg:px-8 max-w-4xl">

    <!-- ==================================================================== -->
    <!-- SECTION 1: PENGANTAR                                                 -->
    <!-- ==================================================================== -->
    <article id="intro" class="mb-16 scroll-mt-24">
      <div class="flex items-center gap-2 text-xs font-medium text-rose-600 dark:text-rose-400 mb-2">
        <span>Docs</span>
        <i data-lucide="chevron-right" class="w-3 h-3 text-zinc-400"></i>
        <span>Getting Started</span>
        <i data-lucide="chevron-right" class="w-3 h-3 text-zinc-400"></i>
        <span class="text-zinc-500">Pengantar</span>
      </div>

      <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-4">
        Dokumentasi Resmi YURIPAY
      </h1>
      <p class="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
        Payment gateway QRIS Dinamis mandiri (<em>self-hosted</em>) untuk merchant GoBiz. Memungkinkan Anda menerima pembayaran otomatis dengan <strong>0% fee potongan pihak ketiga</strong>, mutasi realtime 2.5 detik, dan kompatibilitas 100% webhook Midtrans.
      </p>

      <!-- Highlight Banner -->
      <div class="callout-box callout-info flex items-start gap-3">
        <i data-lucide="sparkles" class="w-5 h-5 text-rose-500 shrink-0 mt-0.5"></i>
        <div>
          <div class="font-semibold text-zinc-900 dark:text-white mb-1">Misi YuriPay: 100% Bebas Biaya Transaksi Gateway</div>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">
            Payment gateway komersial memotong 0.7% s/d 1.5% per transaksi. Dengan YuriPay, transaksi langsung masuk ke rekening GoPay / GoBiz resmi Anda dengan verifikasi mutasi realtime 24/7.
          </p>
        </div>
      </div>
    </article>

    <!-- ==================================================================== -->
    <!-- SECTION 2: ARSITEKTUR DUAL-PORT                                      -->
    <!-- ==================================================================== -->
    <article id="architecture" class="mb-16 scroll-mt-24">
      <h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
        <i data-lucide="layers" class="w-6 h-6 text-rose-500"></i>
        <span>Arsitektur Dual-Port Isolation</span>
      </h2>
      <p class="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
        YuriPay menerapkan isolasi jaringan dua port untuk memisahkan operasional sensitif dari akses pelanggan publik.
      </p>

      <div class="grid sm:grid-cols-2 gap-4 my-6">
        <div class="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
          <div class="inline-flex p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mb-3">
            <i data-lucide="lock" class="w-5 h-5"></i>
          </div>
          <h3 class="font-bold text-base text-zinc-900 dark:text-white mb-1">Port 3000: Admin & Kasir</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Hanya untuk pemilik toko / kasir.</p>
          <ul class="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 font-mono">
            <li>• Dashboard analitik & riwayat transaksi</li>
            <li>• Manajemen stok voucher & digital goods</li>
            <li>• Status sesi aktif GoBiz & auto-refresh token</li>
          </ul>
        </div>

        <div class="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
          <div class="inline-flex p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mb-3">
            <i data-lucide="shield-check" class="w-5 h-5"></i>
          </div>
          <h3 class="font-bold text-base text-zinc-900 dark:text-white mb-1">Port 3001: Customer Checkout</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Port publik untuk pembeli bayar QRIS.</p>
          <ul class="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 font-mono">
            <li>• Route: <code class="text-rose-500">/pay/:invoice</code></li>
            <li>• Bebas cookie sesi admin (Zero Attack Surface)</li>
            <li>• Ringan, cepat, dan aman diekspos via Tunnel/Nginx</li>
          </ul>
        </div>
      </div>
    </article>

    <!-- ==================================================================== -->
    <!-- SECTION 3: WORKFLOW ALUR TRANSAKSI                                   -->
    <!-- ==================================================================== -->
    <article id="workflow" class="mb-16 scroll-mt-24">
      <h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
        <i data-lucide="refresh-cw" class="w-6 h-6 text-rose-500"></i>
        <span>Alur Kerja Transaksi 100%</span>
      </h2>
      <p class="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
        Berikut alur bagaimana pesanan dibuat hingga stok diserahkan secara instan:
      </p>

      <ol class="relative border-l border-zinc-200 dark:border-zinc-800 ml-3 space-y-6">
        <li class="ml-6">
          <span class="absolute -left-3 flex items-center justify-center w-6 h-6 bg-rose-500 text-white text-xs font-bold rounded-full">1</span>
          <h4 class="font-semibold text-zinc-900 dark:text-white text-sm">Pembeli Membuka Invoice</h4>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Sistem menyuntikkan nominal + kode unik anti-bentrok (<code class="text-rose-500">qrisHelper.js</code>) dan merender QR Code dinamis.</p>
        </li>
        <li class="ml-6">
          <span class="absolute -left-3 flex items-center justify-center w-6 h-6 bg-rose-500 text-white text-xs font-bold rounded-full">2</span>
          <h4 class="font-semibold text-zinc-900 dark:text-white text-sm">Pembeli Scan via E-Wallet / Mobile Banking</h4>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Pembeli membayar melalui BCA, Mandiri, BRI, GoPay, OVO, ShopeePay, Dana, dll. Nominal sudah terkunci otomatis.</p>
        </li>
        <li class="ml-6">
          <span class="absolute -left-3 flex items-center justify-center w-6 h-6 bg-rose-500 text-white text-xs font-bold rounded-full">3</span>
          <h4 class="font-semibold text-zinc-900 dark:text-white text-sm">Polling Mutasi 2.5 Detik</h4>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Background worker (<code class="text-rose-500">paymentChecker.js</code>) mendeteksi saldo masuk di GoBiz, menandai order jadi <strong class="text-emerald-500">PAID</strong>, dan mengklaim item digital.</p>
        </li>
        <li class="ml-6">
          <span class="absolute -left-3 flex items-center justify-center w-6 h-6 bg-rose-500 text-white text-xs font-bold rounded-full">4</span>
          <h4 class="font-semibold text-zinc-900 dark:text-white text-sm">Notifikasi Webhook & Penyerahan Barang</h4>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">YuriPay menembak webhook Midtrans SHA-512 ke toko online Anda detik itu juga!</p>
        </li>
      </ol>
    </article>

    <!-- ==================================================================== -->
    <!-- SECTION 4: REAL DYNAMIC QRIS GENERATOR                               -->
    <!-- ==================================================================== -->
    <article id="generator" class="mb-16 scroll-mt-24">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
          <i data-lucide="qr-code" class="w-6 h-6 text-rose-500"></i>
          <span>Live Dynamic QRIS Generator</span>
        </h2>
        <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Scannable Real QR
        </span>
      </div>
      <p class="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
        Simulasi pembentukan QRIS dinamis dari QRIS statis merchant. Dilengkapi dengan preset toko contoh (Mister Dompu 2 & GoBiz Zero Shop) dan kalkulasi EMVCo CRC-16 otomatis.
      </p>

      <!-- Generator Widget Container -->
      <div class="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-sm">
        <div class="grid lg:grid-cols-12 gap-8">
          
          <!-- Left Controls (7 cols) -->
          <div class="lg:col-span-7 space-y-5">
            <!-- Preset Buttons -->
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">1. Pilih Preset Merchant Contoh:</label>
              <div class="flex flex-wrap gap-2">
                <button id="presetDompuBtn" class="px-3 py-1.5 rounded-lg text-xs font-medium border border-rose-500 bg-rose-500 text-white shadow-sm transition-all flex items-center gap-1.5">
                  <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                  <span>Mister Dompu 2 (CIMB)</span>
                </button>
                <button id="presetZeroBtn" class="px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 transition-all">
                  ZERO SHOP (GoBiz)
                </button>
                <button id="presetCustomBtn" class="px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 transition-all">
                  Custom QRIS
                </button>
              </div>
            </div>

            <!-- Static Template Input -->
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">String QRIS Statis Sumber:</label>
              <textarea id="staticQrisInput" rows="3" class="w-full p-3 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-zinc-900 dark:text-zinc-100">${PRESET_MISTER_DOMPU}</textarea>
            </div>

            <!-- Nominal Input & Chips -->
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">2. Nominal Transaksi (Rp):</label>
              <input type="number" id="nominalInput" value="1000" min="1" class="w-full px-3 py-2 text-sm font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-zinc-900 dark:text-zinc-100" />
              <div class="flex flex-wrap gap-1.5 mt-2">
                <button class="nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-rose-400" data-nom="500">Rp 500</button>
                <button class="nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400" data-nom="1000">Rp 1.000</button>
                <button class="nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-rose-400" data-nom="5000">Rp 5.000</button>
                <button class="nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-rose-400" data-nom="10000">Rp 10.000</button>
                <button class="nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-rose-400" data-nom="25000">Rp 25.000</button>
                <button class="nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-rose-400" data-nom="50000">Rp 50.000</button>
              </div>
            </div>

            <!-- Unique Code Mode -->
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">3. Aturan Kode Unik (Anti-Tabrakan Order):</label>
              <select id="uniqueModeSelect" class="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-zinc-900 dark:text-zinc-100">
                <option value="yuripay">⚡ Algoritma YuriPay Resmi (&lt;1000: +1 perak, &ge;1000: acak 1..199)</option>
                <option value="exact">🎯 Nominal Pas (Offset 0)</option>
                <option value="custom">🛠️ Custom Offset Tambahan</option>
              </select>
              <div id="customOffsetBox" class="hidden mt-2">
                <input type="number" id="customOffsetInput" placeholder="Nilai offset (contoh: 88)" value="0" class="w-full px-3 py-1.5 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg" />
              </div>
            </div>

            <!-- Fee Setting -->
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">4. Biaya Layanan / Admin (Opsional):</label>
              <div class="grid grid-cols-2 gap-2">
                <select id="feeTypeSelect" class="px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100">
                  <option value="none">Gratis (Tanpa Biaya Admin)</option>
                  <option value="flat">Biaya Tetap (Rp)</option>
                  <option value="percent">Persentase (%)</option>
                </select>
                <input type="number" id="feeValInput" placeholder="Nilai fee" value="0" disabled class="px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 disabled:opacity-50" />
              </div>
            </div>

            <button id="generateDynamicBtn" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-colors">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i>
              <span>Re-Generate QRIS Dinamis</span>
            </button>
          </div>

          <!-- Right QR Preview & Summary (5 cols) -->
          <div class="lg:col-span-5 flex flex-col items-center justify-between p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
            <div class="text-center w-full">
              <div class="p-3 bg-white rounded-xl shadow-md border border-zinc-200 inline-block mb-3">
                <canvas id="dynamicQrCanvas" class="w-48 h-48 block"></canvas>
              </div>
              <div id="displayTotalAmount" class="text-2xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">Rp 1.000</div>
              <div id="displayMerchantInfo" class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Mister Dompu 2 • Dompu</div>
            </div>

            <!-- Breakdown list -->
            <div class="w-full my-4 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs space-y-1.5 font-mono">
              <div class="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Nominal Asli:</span>
                <span id="lblBaseNominal" class="font-bold text-zinc-900 dark:text-white">Rp 1.000</span>
              </div>
              <div class="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Kode Unik:</span>
                <span id="lblUniqueOffset" class="font-bold text-rose-500">+Rp 0</span>
              </div>
              <div class="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Biaya Layanan:</span>
                <span id="lblFeeAmount" class="font-bold text-zinc-900 dark:text-white">+Rp 0</span>
              </div>
              <div class="pt-1.5 border-t border-zinc-200 dark:border-zinc-800 flex justify-between text-sm font-bold text-rose-600 dark:text-rose-400">
                <span>Total Terkunci (Tag 54):</span>
                <span id="lblFinalAmount">Rp 1.000</span>
              </div>
            </div>

            <div class="flex gap-2 w-full">
              <button id="downloadQrBtn" class="flex-1 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-colors">
                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                <span>Download PNG</span>
              </button>
              <button id="copyDynamicTextBtn" class="flex-1 py-2 rounded-lg text-xs font-semibold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-1.5 transition-colors">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                <span>Copy String</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Raw String Box -->
        <div class="mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-800">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Raw Dynamic QRIS String:</span>
            <span id="dynamicCrcBadge" class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500/20">CRC16: OK</span>
          </div>
          <pre id="dynamicRawOutput" class="p-3 rounded-lg bg-zinc-900 text-rose-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-24"></pre>
        </div>

        <!-- EMVCo Breakdown Table -->
        <div class="mt-6">
          <h3 class="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-3">Tabel Bedah Struktur Tag EMVCo (TLV Decomposition)</h3>
          <div class="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table class="w-full text-left text-xs" id="dynamicTlvTable">
              <thead class="bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th class="py-2.5 px-3">Tag</th>
                  <th class="py-2.5 px-3">Len</th>
                  <th class="py-2.5 px-3">Value</th>
                  <th class="py-2.5 px-3">Field Name</th>
                  <th class="py-2.5 px-3">Keterangan</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800 font-mono text-[11px]">
                <!-- Populated by JS -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </article>

    <!-- ==================================================================== -->
    <!-- SECTION 5: CEK CODE QR (SCANNER & INSPECTOR)                         -->
    <!-- ==================================================================== -->
    <article id="checker" class="mb-16 scroll-mt-24">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
          <i data-lucide="scan-line" class="w-6 h-6 text-rose-500"></i>
          <span>Cek Code QRIS (Image Decoder & Scanner)</span>
        </h2>
        <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-500/20">
          Client-Side jsQR
        </span>
      </div>
      <p class="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
        Unggah foto atau screenshot QRIS toko Anda untuk mengekstrak string teks mentah, memvalidasi checksum CRC-16, dan langsung mentransfernya ke Generator.
      </p>

      <div class="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-sm">
        <!-- Drag & Drop Zone -->
        <div id="qrDropzone" class="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-rose-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-zinc-50/50 dark:bg-zinc-950/40">
          <input type="file" id="qrFileInput" accept="image/*" class="hidden" />
          <div class="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mx-auto mb-3">
            <i data-lucide="upload-cloud" class="w-6 h-6"></i>
          </div>
          <h3 class="font-bold text-sm text-zinc-900 dark:text-white mb-1">Upload atau Tarik Gambar QRIS ke Sini</h3>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">Mendukung format PNG, JPG, JPEG, WebP. Bisa juga langsung paste screenshot (<kbd class="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px]">Ctrl + V</kbd>).</p>
        </div>

        <!-- Alert Status -->
        <div id="checkerStatusAlert" class="hidden mt-4 p-3 rounded-lg text-xs font-medium border"></div>

        <!-- Decoded Result Box -->
        <div id="checkerResultBox" class="hidden mt-6 space-y-6">
          <div class="grid md:grid-cols-2 gap-6">
            <!-- Left: Scanned Image & Summary -->
            <div class="space-y-4">
              <div class="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-center">
                <span class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">Preview Gambar:</span>
                <img id="checkerImagePreview" class="max-h-48 mx-auto rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm" alt="Decoded QR" />
              </div>

              <div class="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-2 text-xs">
                <div class="font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-2">Metadata Toko Terdeteksi:</div>
                <div class="flex justify-between"><span class="text-zinc-500">Merchant Name:</span> <strong id="chkMerchantName" class="text-rose-600 dark:text-rose-400 font-bold">-</strong></div>
                <div class="flex justify-between"><span class="text-zinc-500">Kota Domisili:</span> <strong id="chkMerchantCity" class="text-zinc-800 dark:text-zinc-200">-</strong></div>
                <div class="flex justify-between"><span class="text-zinc-500">Kode Pos:</span> <strong id="chkPostalCode" class="text-zinc-800 dark:text-zinc-200">-</strong></div>
                <div class="flex justify-between"><span class="text-zinc-500">Tipe QR:</span> <span id="chkQrType" class="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800">-</span></div>
                <div class="flex justify-between"><span class="text-zinc-500">Nominal:</span> <strong id="chkAmount" class="text-emerald-500">-</strong></div>
                <div class="flex justify-between"><span class="text-zinc-500">Acquirer:</span> <strong id="chkAcquirer">-</strong></div>
                <div class="flex justify-between items-center pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <span class="text-zinc-500">Validasi Checksum:</span>
                  <span id="chkCrcStatus" class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white">-</span>
                </div>
              </div>
            </div>

            <!-- Right: Raw Text & Transfer Button -->
            <div class="flex flex-col justify-between space-y-4">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Raw String QRIS:</span>
                  <button id="copyScannedRawBtn" class="px-2.5 py-1 rounded text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1">
                    <i data-lucide="copy" class="w-3 h-3"></i>
                    <span>Copy Text</span>
                  </button>
                </div>
                <pre id="chkRawTextOutput" class="p-3.5 rounded-xl bg-zinc-900 text-emerald-400 font-mono text-xs overflow-y-auto whitespace-pre-wrap break-all max-h-52 border border-zinc-800"></pre>
              </div>

              <!-- Action Card -->
              <div class="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20">
                <div class="font-bold text-sm text-zinc-900 dark:text-white mb-1">Gunakan Sebagai Template Dinamis</div>
                <p class="text-xs text-zinc-600 dark:text-zinc-400 mb-3">Pindahkan string ini ke Live Generator untuk membuat QRIS nominal dari toko Anda.</p>
                <button id="transferToGeneratorBtn" class="w-full py-2.5 rounded-lg text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-colors">
                  <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                  <span>Transfer ke Generator Dinamis</span>
                </button>
              </div>
            </div>
          </div>

          <!-- TLV Breakdown of Scanned QR -->
          <div>
            <h4 class="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-2">Tabel Dekomposisi Tag EMVCo Hasil Scan</h4>
            <div class="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table class="w-full text-left text-xs" id="checkerTlvTable">
                <thead class="bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th class="py-2.5 px-3">Tag</th>
                    <th class="py-2.5 px-3">Len</th>
                    <th class="py-2.5 px-3">Value</th>
                    <th class="py-2.5 px-3">Field Name</th>
                    <th class="py-2.5 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800 font-mono text-[11px]">
                  <!-- Populated by JS -->
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </article>

    <!-- ==================================================================== -->
    <!-- SECTION 6: BEDAH KODE REPOSITORY                                     -->
    <!-- ==================================================================== -->
    <article id="code-structure" class="mb-16 scroll-mt-24">
      <h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
        <i data-lucide="cpu" class="w-6 h-6 text-rose-500"></i>
        <span>Bedah Struktur Kode myzert/YURIPAY-GOPAY</span>
      </h2>
      <p class="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
        Hasil analisis 100% dari repositori resmi yang telah di-clone:
      </p>

      <div class="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-950 text-zinc-200 font-mono text-xs my-4 shadow-sm">
        <div class="px-4 py-2 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-zinc-400">
          <span>Struktur File Repositori</span>
          <span class="text-rose-400">Node.js 22 LTS</span>
        </div>
        <pre class="p-4 overflow-x-auto text-[11px] leading-relaxed">
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
    </article>

    <!-- Sub-article: GoBiz Auth -->
    <article id="gobiz-auth" class="mb-12 scroll-mt-24">
      <h3 class="text-xl font-bold text-zinc-900 dark:text-white mb-2">1. Otentikasi GoBiz & Sesi OTP (login.js)</h3>
      <p class="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed mb-3">
        Merchant menjalankan <code class="text-rose-500 font-mono">node login.js</code>. Sistem menghubungi endpoint resmi <code class="font-mono text-xs">https://api.gojekapi.com/v3/auth/token/request</code>. Setelah memasukkan 4-digit OTP, sesi disimpan di file lokal yang otomatis diperbarui setiap 6 jam oleh <code class="text-rose-500 font-mono">sessionManager.js</code>.
      </p>
    </article>

    <!-- Sub-article: Polling Checker -->
    <article id="polling-checker" class="mb-12 scroll-mt-24">
      <h3 class="text-xl font-bold text-zinc-900 dark:text-white mb-2">2. Worker Polling Mutasi 2.5 Detik (paymentChecker.js)</h3>
      <p class="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed mb-3">
        Worker berjalan di latar belakang setiap 2.500 ms (2.5 detik) memanggil endpoint analitik transaksi GoBiz. Jika mutasi persis ditemukan, status order diubah menjadi <strong>PAID</strong> dan produk digital di tabel <code class="font-mono text-xs">stocks</code> langsung diserahkan detik itu juga.
      </p>
    </article>

    <!-- Sub-article: EMVCo Spec -->
    <article id="emvco-spec" class="mb-12 scroll-mt-24">
      <h3 class="text-xl font-bold text-zinc-900 dark:text-white mb-2">3. Algoritma EMVCo & Tag 54 (qrisHelper.js)</h3>
      <p class="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed mb-3">
        Fungsi <code class="font-mono text-xs text-rose-500">generateDynamicQRIS()</code> memotong Tag 63 lama, mengubah Tag 01 menjadi <code>12</code>, menyuntikkan Tag 54 (nominal tagihan), dan menghitung ulang CRC16 CCITT menggunakan polinom <code class="font-mono text-xs">0x1021</code> dengan initial value <code class="font-mono text-xs">0xFFFF</code>.
      </p>
    </article>

    <!-- Sub-article: Database -->
    <article id="database" class="mb-16 scroll-mt-24">
      <h3 class="text-xl font-bold text-zinc-900 dark:text-white mb-2">4. Database SQLite WAL (db.js)</h3>
      <p class="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed mb-3">
        Ditenagai oleh <code class="font-mono text-xs text-rose-500">better-sqlite3</code> dengan mode <strong>Write-Ahead Logging (WAL)</strong> untuk konkurensi ACID tinggi, bebas race condition saat banyak pesanan masuk serentak.
      </p>
    </article>

    <!-- ==================================================================== -->
    <!-- SECTION 7: MIDTRANS WEBHOOK TESTER                                   -->
    <!-- ==================================================================== -->
    <article id="webhook" class="mb-16 scroll-mt-24">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
          <i data-lucide="shield-check" class="w-6 h-6 text-rose-500"></i>
          <span>Midtrans Webhook & Signature Tester</span>
        </h2>
        <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-500/20">
          SHA-512 RFC-6234
        </span>
      </div>
      <p class="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
        Format notifikasi webhook YuriPay 100% kompatibel dengan Midtrans API, termasuk perhitungan <code class="font-mono text-xs">SHA512(order_id + status_code + gross_amount + ServerKey)</code>.
      </p>

      <div class="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-sm">
        <div class="grid md:grid-cols-2 gap-6">
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Order ID (Invoice):</label>
              <input type="text" id="sigOrderId" value="INV-20261106-9921" class="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100" />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Status Code:</label>
              <input type="text" id="sigStatusCode" value="200" class="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100" />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Gross Amount (Rp):</label>
              <input type="text" id="sigGrossAmount" value="10087.00" class="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100" />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Server Key (Secret):</label>
              <input type="text" id="sigServerKey" value="SB-Mid-server-YuriPayKeySample2026" class="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100" />
            </div>
            <button id="calcSignatureBtn" class="w-full py-2.5 rounded-lg text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20 flex items-center justify-center gap-2">
              <i data-lucide="zap" class="w-3.5 h-3.5"></i>
              <span>Hitung Signature SHA-512</span>
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-bold uppercase tracking-wider text-zinc-500">Signature Key Result:</span>
                <button id="copySignatureBtn" class="text-xs text-rose-500 hover:underline flex items-center gap-1">
                  <i data-lucide="copy" class="w-3 h-3"></i>
                  <span>Copy</span>
                </button>
              </div>
              <pre id="sigOutputPre" class="p-3 rounded-lg bg-zinc-900 text-rose-300 font-mono text-xs break-all whitespace-pre-wrap max-h-24"></pre>
            </div>

            <div>
              <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-bold uppercase tracking-wider text-zinc-500">Contoh Callback Settlement JSON:</span>
                <button id="copyWebhookPayloadBtn" class="text-xs text-rose-500 hover:underline flex items-center gap-1">
                  <i data-lucide="copy" class="w-3 h-3"></i>
                  <span>Copy JSON</span>
                </button>
              </div>
              <pre id="webhookPayloadPre" class="p-3 rounded-lg bg-zinc-900 text-zinc-300 font-mono text-xs overflow-y-auto max-h-48"></pre>
            </div>
          </div>
        </div>
      </div>
    </article>

    <!-- ==================================================================== -->
    <!-- SECTION 8: PANDUAN DEPLOYMENT                                        -->
    <!-- ==================================================================== -->
    <article id="deploy-termux" class="mb-12 scroll-mt-24">
      <h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
        <i data-lucide="server" class="w-6 h-6 text-rose-500"></i>
        <span>Panduan Deployment 24/7</span>
      </h2>
      
      <!-- Termux -->
      <div class="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 my-4">
        <div class="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-white mb-2">
          <i data-lucide="smartphone" class="w-4 h-4 text-rose-500"></i>
          <span>1. Termux Android (Gratis Tanpa Biaya Server)</span>
        </div>
        <pre class="p-3 rounded-lg bg-zinc-950 text-zinc-200 font-mono text-xs overflow-x-auto">
pkg update && pkg upgrade -y
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
    </article>

    <article id="deploy-vps" class="mb-12 scroll-mt-24">
      <!-- VPS Ubuntu -->
      <div class="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 my-4">
        <div class="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-white mb-2">
          <i data-lucide="cloud" class="w-4 h-4 text-rose-500"></i>
          <span>2. VPS Linux (Ubuntu / Debian) dengan PM2 & SSL</span>
        </div>
        <pre class="p-3 rounded-lg bg-zinc-950 text-zinc-200 font-mono text-xs overflow-x-auto">
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
    </article>

    <article id="deploy-cpanel" class="mb-16 scroll-mt-24">
      <!-- cPanel -->
      <div class="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 my-4">
        <div class="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-white mb-2">
          <i data-lucide="server" class="w-4 h-4 text-rose-500"></i>
          <span>3. cPanel Node.js Selector</span>
        </div>
        <p class="text-xs text-zinc-600 dark:text-zinc-400 mb-2">Pilih Node.js versi 20.x atau 22.x, set Application Root ke <code>yuripay</code>, startup file <code class="text-rose-500">server.js</code>, dan jalankan <code class="font-mono">node login.js</code> melalui menu Terminal cPanel.</p>
      </div>
    </article>

    <!-- ==================================================================== -->
    <!-- SECTION 9: GITHUB REPO & CONTRIBUTORS                                -->
    <!-- ==================================================================== -->
    <article id="github" class="mb-16 scroll-mt-24">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
          <i data-lucide="star" class="w-6 h-6 text-rose-500"></i>
          <span>GitHub Repository & Kontributor</span>
        </h2>
        <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-500/20">
          myzert/YURIPAY-GOPAY
        </span>
      </div>
      <p class="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
        Proyek open-source komunitas. Anda dapat mendukung proyek ini dengan memberikan Star atau berkontribusi via Pull Request.
      </p>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
        <div class="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-center">
          <div id="statStars" class="text-2xl font-extrabold text-rose-500">...</div>
          <div class="text-xs text-zinc-500 font-medium uppercase mt-0.5">Stars</div>
        </div>
        <div class="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-center">
          <div id="statForks" class="text-2xl font-extrabold text-zinc-800 dark:text-zinc-200">...</div>
          <div class="text-xs text-zinc-500 font-medium uppercase mt-0.5">Forks</div>
        </div>
        <div class="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-center">
          <div id="statWatchers" class="text-2xl font-extrabold text-zinc-800 dark:text-zinc-200">...</div>
          <div class="text-xs text-zinc-500 font-medium uppercase mt-0.5">Watchers</div>
        </div>
        <div class="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-center">
          <div id="statIssues" class="text-2xl font-extrabold text-zinc-800 dark:text-zinc-200">...</div>
          <div class="text-xs text-zinc-500 font-medium uppercase mt-0.5">Open Issues</div>
        </div>
      </div>

      <!-- Clone snippet -->
      <div class="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 my-6">
        <div class="flex justify-between items-center mb-2 text-xs text-zinc-400 font-mono">
          <span>Clone Perintah Cepat:</span>
          <button id="copyCloneBtn" class="text-rose-400 hover:underline flex items-center gap-1">
            <i data-lucide="copy" class="w-3 h-3"></i>
            <span>Copy</span>
          </button>
        </div>
        <pre class="text-rose-300 font-mono text-xs overflow-x-auto" id="cloneSnippetPre">git clone https://github.com/myzert/YURIPAY-GOPAY.git</pre>
      </div>

      <!-- Contributors Grid -->
      <div class="my-6">
        <h4 class="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-3">Daftar Kontributor Resmi</h4>
        <div id="contributorList" class="grid sm:grid-cols-2 gap-4">
          <!-- Fallback cards -->
          <a href="https://github.com/myzert" target="_blank" rel="noopener" class="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex items-center gap-3.5 hover:border-rose-400 transition-colors">
            <img src="https://avatars.githubusercontent.com/u/325584707?v=4" class="w-12 h-12 rounded-full border border-zinc-200" alt="myzert" />
            <div>
              <div class="font-bold text-sm text-zinc-900 dark:text-white">myzert</div>
              <div class="text-xs text-rose-500 font-medium">👑 Author / Lead Developer</div>
              <div class="text-[11px] text-zinc-500 font-mono">11+ Contributions</div>
            </div>
          </a>

          <a href="https://github.com/GTPSHAX" target="_blank" rel="noopener" class="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex items-center gap-3.5 hover:border-rose-400 transition-colors">
            <img src="https://avatars.githubusercontent.com/u/143262216?v=4" class="w-12 h-12 rounded-full border border-zinc-200" alt="GTPSHAX" />
            <div>
              <div class="font-bold text-sm text-zinc-900 dark:text-white">GTPSHAX</div>
              <div class="text-xs text-rose-500 font-medium">🛠️ Core Contributor</div>
              <div class="text-[11px] text-zinc-500 font-mono">7+ Contributions</div>
            </div>
          </a>
        </div>
      </div>
    </article>

  </main>

  <!-- Right Sidebar (On This Page / Table of Contents) -->
  <aside class="hidden xl:block w-56 shrink-0 py-8 pl-6 text-xs sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto">
    <div class="font-bold uppercase tracking-wider text-zinc-400 mb-3 text-[11px]">Pada Halaman Ini</div>
    <ul class="space-y-2 border-l border-zinc-200 dark:border-zinc-800 pl-3 text-zinc-500 dark:text-zinc-400" id="tocList">
      <li><a href="#intro" class="hover:text-rose-500 transition-colors block">Pengantar</a></li>
      <li><a href="#architecture" class="hover:text-rose-500 transition-colors block">Arsitektur Dual-Port</a></li>
      <li><a href="#workflow" class="hover:text-rose-500 transition-colors block">Alur Transaksi 100%</a></li>
      <li><a href="#generator" class="hover:text-rose-500 transition-colors block font-semibold text-rose-500">Live Generator Dinamis</a></li>
      <li><a href="#checker" class="hover:text-rose-500 transition-colors block">Cek Code QRIS</a></li>
      <li><a href="#code-structure" class="hover:text-rose-500 transition-colors block">Bedah Kode Repository</a></li>
      <li><a href="#webhook" class="hover:text-rose-500 transition-colors block">Midtrans Webhook Tester</a></li>
      <li><a href="#deploy-termux" class="hover:text-rose-500 transition-colors block">Panduan Deployment</a></li>
      <li><a href="#github" class="hover:text-rose-500 transition-colors block">GitHub & Kontributor</a></li>
    </ul>
  </aside>

</div>

<!-- Toast Alert -->
<div id="toastEl" class="fixed bottom-6 right-6 z-50 hidden px-4 py-2.5 rounded-lg text-xs font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl border border-zinc-800 dark:border-zinc-200 transition-all flex items-center gap-2">
  <i data-lucide="check" class="w-4 h-4 text-emerald-400"></i>
  <span id="toastMsg">Tersalin!</span>
</div>
`;

// Initialize Lucide Icons
createIcons({ icons: appIcons });

// ============================================================================
// Interactive Handlers
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

// ----------------------------------------------------------------------------
// Theme Switcher
// ----------------------------------------------------------------------------
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

themeToggleBtn.addEventListener('click', () => {
  const isDark = document.documentElement.classList.contains('dark');
  applyTheme(!isDark);
});

// ----------------------------------------------------------------------------
// Mobile Sidebar Toggle
// ----------------------------------------------------------------------------
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

// Close mobile sidebar when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    if (window.innerWidth < 1024) toggleSidebar(false);
  });
});

// ----------------------------------------------------------------------------
// Active Navigation Highlight (ScrollSpy)
// ----------------------------------------------------------------------------
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-link');
const articles = document.querySelectorAll<HTMLElement>('article[id]');

window.addEventListener('scroll', () => {
  let currentId = '';
  articles.forEach(art => {
    const top = art.offsetTop - 120;
    if (window.scrollY >= top) {
      currentId = art.id;
    }
  });

  if (currentId) {
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${currentId}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
});

// ----------------------------------------------------------------------------
// Search Input Filter
// ----------------------------------------------------------------------------
const globalSearchInput = document.getElementById('globalSearchInput') as HTMLInputElement;
globalSearchInput?.addEventListener('input', () => {
  const q = globalSearchInput.value.toLowerCase().trim();
  navLinks.forEach(link => {
    const text = link.innerText.toLowerCase();
    const parent = link.closest('li');
    if (!parent) return;
    if (!q || text.includes(q)) {
      parent.style.display = '';
    } else {
      parent.style.display = 'none';
    }
  });
});

// Keyboard shortcut for search
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    globalSearchInput?.focus();
  }
});

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

// Presets
const presetDompuBtn = document.getElementById('presetDompuBtn') as HTMLButtonElement;
const presetZeroBtn = document.getElementById('presetZeroBtn') as HTMLButtonElement;
const presetCustomBtn = document.getElementById('presetCustomBtn') as HTMLButtonElement;

presetDompuBtn?.addEventListener('click', () => {
  staticQrisInput.value = PRESET_MISTER_DOMPU;
  presetDompuBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-rose-500 bg-rose-500 text-white shadow-sm transition-all flex items-center gap-1.5';
  presetZeroBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 transition-all';
  presetCustomBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 transition-all';
  updateDynamicGenerator();
});

presetZeroBtn?.addEventListener('click', () => {
  staticQrisInput.value = PRESET_ZERO_SHOP;
  presetZeroBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-rose-500 bg-rose-500 text-white shadow-sm transition-all flex items-center gap-1.5';
  presetDompuBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 transition-all';
  presetCustomBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 transition-all';
  updateDynamicGenerator();
});

presetCustomBtn?.addEventListener('click', () => {
  presetCustomBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-rose-500 bg-rose-500 text-white shadow-sm transition-all flex items-center gap-1.5';
  presetDompuBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 transition-all';
  presetZeroBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 transition-all';
  staticQrisInput.focus();
});

// Nominal Chips
document.querySelectorAll('.nom-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.nom-chip').forEach(c => {
      c.className = 'nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-rose-400';
    });
    chip.className = 'nom-chip px-2.5 py-1 rounded text-xs font-mono font-medium border border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400';
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

function updateDynamicGenerator() {
  const baseNom = parseInt(nominalInput.value, 10) || 1000;
  const staticStr = staticQrisInput.value.trim() || PRESET_MISTER_DOMPU;

  const result = generateDynamicQRIS(staticStr, baseNom);

  displayTotalAmount.innerText = formatRupiah(result.finalTotalAmount);
  lblBaseNominal.innerText = formatRupiah(result.baseNominal);
  lblUniqueOffset.innerText = `+Rp ${result.uniqueOffset}`;
  lblFeeAmount.innerText = `+Rp ${result.feeAmount}`;
  lblFinalAmount.innerText = formatRupiah(result.finalTotalAmount);

  dynamicRawOutput.innerText = result.rawQris;
  dynamicCrcBadge.innerText = `CRC16: ${result.checksum}`;

  const parsed = parseEMVCoTLV(result.rawQris);
  const tag59 = parsed.tags.find(t => t.tag === '59')?.val || 'Merchant QRIS';
  const tag60 = parsed.tags.find(t => t.tag === '60')?.val || 'Indonesia';
  displayMerchantInfo.innerText = `${tag59} • ${tag60}`;

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

  dynamicTlvTableBody.innerHTML = '';
  parsed.tags.forEach(t => {
    const row = document.createElement('tr');
    const isSpecial = t.tag === '01' || t.tag === '54' || t.tag === '63';
    row.className = isSpecial ? 'bg-rose-50/50 dark:bg-rose-950/20' : '';
    row.innerHTML = `
      <td class="py-2 px-3 font-bold ${isSpecial ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500'}">Tag ${t.tag}</td>
      <td class="py-2 px-3 text-zinc-500">${t.len}</td>
      <td class="py-2 px-3 break-all max-w-xs ${isSpecial ? 'text-rose-600 dark:text-rose-300 font-bold' : 'text-zinc-800 dark:text-zinc-200'}">${escapeHtml(t.val)}</td>
      <td class="py-2 px-3 font-sans font-medium text-zinc-900 dark:text-zinc-100">${escapeHtml(t.name)}</td>
      <td class="py-2 px-3 font-sans text-zinc-500 dark:text-zinc-400">${escapeHtml(t.desc)}</td>
    `;
    dynamicTlvTableBody.appendChild(row);
  });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

downloadQrBtn?.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `QRIS-YURIPAY-${Date.now()}.png`;
  link.href = dynamicQrCanvas.toDataURL('image/png');
  link.click();
  showToast('📥 Gambar QRIS PNG berhasil didownload!');
});

copyDynamicTextBtn?.addEventListener('click', () => {
  navigator.clipboard.writeText(dynamicRawOutput.innerText);
  showToast('📋 Raw text QRIS berhasil disalin!');
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

qrDropzone?.addEventListener('click', () => qrFileInput.click());

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

window.addEventListener('paste', (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile();
      if (file) {
        window.location.hash = 'checker';
        handleQRFile(file);
      }
      break;
    }
  }
});

function handleQRFile(file: File) {
  if (!file.type.startsWith('image/')) {
    showCheckerAlert('⚠️ File yang dipilih bukan gambar valid!', 'error');
    return;
  }

  showCheckerAlert('⏳ Memindai gambar QRIS...', 'info');

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target?.result as string;
    checkerImagePreview.src = dataUrl;

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
        showCheckerAlert('✕ Tidak ditemukan QR code dalam gambar. Pastikan gambar jelas dan tidak terlalu buram.', 'error');
        checkerResultBox.classList.add('hidden');
      }
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function showCheckerAlert(msg: string, type: 'info' | 'error') {
  checkerStatusAlert.classList.remove('hidden');
  checkerStatusAlert.innerText = msg;
  if (type === 'error') {
    checkerStatusAlert.className = 'mt-4 p-3 rounded-lg text-xs font-medium border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400';
  } else {
    checkerStatusAlert.className = 'mt-4 p-3 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300';
  }
}

function processDecodedQR(raw: string) {
  lastScannedRawText = raw;
  checkerStatusAlert.classList.add('hidden');
  checkerResultBox.classList.remove('hidden');

  chkRawTextOutput.innerText = raw;
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
    chkQrType.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-500/20';
  } else if (tag01 === '11') {
    chkQrType.innerText = 'STATIS (11)';
    chkQrType.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-500/20';
  }

  chkAmount.innerText = tag54 ? formatRupiah(parseInt(tag54, 10)) : 'Bebas (Input Manual)';

  let acquirerName = 'National QRIS';
  if (tag26.includes('GO-JEK') || tag26.includes('GOPAY')) {
    acquirerName = 'GoBiz / GoPay';
  } else if (tag26.includes('CIMB')) {
    acquirerName = 'CIMB Niaga';
  } else if (tag26.includes('BCA')) {
    acquirerName = 'BCA';
  }
  chkAcquirer.innerText = acquirerName;

  if (parsed.validCrc) {
    chkCrcStatus.innerText = `✓ VALID (${parsed.embeddedCrc})`;
    chkCrcStatus.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white';
  } else {
    chkCrcStatus.innerText = `MISMATCH (Calc: ${parsed.calculatedCrc})`;
    chkCrcStatus.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white';
  }

  checkerTlvTableBody.innerHTML = '';
  parsed.tags.forEach(t => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="py-2 px-3 font-bold text-zinc-500">Tag ${t.tag}</td>
      <td class="py-2 px-3 text-zinc-500">${t.len}</td>
      <td class="py-2 px-3 break-all max-w-xs text-zinc-800 dark:text-zinc-200">${escapeHtml(t.val)}</td>
      <td class="py-2 px-3 font-sans font-medium text-zinc-900 dark:text-zinc-100">${escapeHtml(t.name)}</td>
      <td class="py-2 px-3 font-sans text-zinc-500 dark:text-zinc-400">${escapeHtml(t.desc)}</td>
    `;
    checkerTlvTableBody.appendChild(row);
  });

  showToast('✓ Berhasil mendecode QRIS code!');
}

copyScannedRawBtn?.addEventListener('click', () => {
  navigator.clipboard.writeText(lastScannedRawText);
  showToast('📋 Text QRIS berhasil disalin!');
});

transferToGeneratorBtn?.addEventListener('click', () => {
  if (!lastScannedRawText) return;
  staticQrisInput.value = lastScannedRawText;
  presetCustomBtn.click();
  updateDynamicGenerator();
  window.location.hash = 'generator';
  showToast('🚀 QRIS dimuat ke Generator Dinamis!');
});

// ----------------------------------------------------------------------------
// Webhook & Signature Tester
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
    currency: 'IDR',
    acquirer: 'gopay'
  };

  webhookPayloadPre.innerText = JSON.stringify(mockPayload, null, 2);
}

calcSignatureBtn?.addEventListener('click', () => {
  updateSignatureSimulator();
  showToast('⚡ Signature SHA-512 dihitung!');
});

copySignatureBtn?.addEventListener('click', () => {
  navigator.clipboard.writeText(sigOutputPre.innerText);
  showToast('📋 Signature berhasil disalin!');
});

copyWebhookPayloadBtn?.addEventListener('click', () => {
  navigator.clipboard.writeText(webhookPayloadPre.innerText);
  showToast('📋 JSON callback berhasil disalin!');
});

// ----------------------------------------------------------------------------
// GitHub Repo Integration
// ----------------------------------------------------------------------------
const topStarCount = document.getElementById('topStarCount') as HTMLElement;
const topForkCount = document.getElementById('topForkCount') as HTMLElement;
const statStars = document.getElementById('statStars') as HTMLElement;
const statForks = document.getElementById('statForks') as HTMLElement;
const statWatchers = document.getElementById('statWatchers') as HTMLElement;
const statIssues = document.getElementById('statIssues') as HTMLElement;
const contributorList = document.getElementById('contributorList') as HTMLElement;
const copyCloneBtn = document.getElementById('copyCloneBtn') as HTMLButtonElement;
const cloneSnippetPre = document.getElementById('cloneSnippetPre') as HTMLElement;

copyCloneBtn?.addEventListener('click', () => {
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

      topStarCount.innerText = stars.toString();
      topForkCount.innerText = forks.toString();
      statStars.innerText = stars.toString();
      statForks.innerText = forks.toString();
      statWatchers.innerText = watchers.toString();
      statIssues.innerText = issues.toString();
    } else {
      fallbackGitHubStats();
    }
  } catch {
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
          card.className = 'p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex items-center gap-3.5 hover:border-rose-400 transition-colors shadow-sm';
          card.innerHTML = `
            <img src="${c.avatar_url}" class="w-12 h-12 rounded-full border border-zinc-200 dark:border-zinc-700" alt="${c.login}" />
            <div>
              <div class="font-bold text-sm text-zinc-900 dark:text-white">${escapeHtml(c.login)}</div>
              <div class="text-xs text-rose-500 font-medium">${c.login === 'myzert' ? '👑 Author / Lead Developer' : '🛠️ Core Contributor'}</div>
              <div class="text-[11px] text-zinc-500 font-mono">${c.contributions} Commits</div>
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

function fallbackGitHubStats() {
  topStarCount.innerText = '120+';
  topForkCount.innerText = '15+';
  statStars.innerText = '120+';
  statForks.innerText = '15+';
  statWatchers.innerText = '120+';
  statIssues.innerText = '2';
}

// ----------------------------------------------------------------------------
// Boot
// ----------------------------------------------------------------------------
updateDynamicGenerator();
updateSignatureSimulator();
fetchGitHubData();
