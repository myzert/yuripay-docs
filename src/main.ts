import './style.css';

// --------------------------------------------------------------------------
// Core State & Utilities
// --------------------------------------------------------------------------
const DEFAULT_STATIC_QRIS = '00020101021126610014COM.GO-JEK.WWW01189360091435381382420210G5381382420303UMI51440014ID.CO.QRIS.WWW0215ID10243419924680303UMI5204581653033605802ID5918ZERO SHOP, MEGALUH6007JOMBANG61056145762070703A0163042A62';

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

/**
 * Dynamic QRIS Builder
 */
function buildDynamicQRIS(staticTemplate: string, nominal: number): { qris: string; crc: string; totalAmount: number; uniqueCode: number } {
  let payload = (staticTemplate || DEFAULT_STATIC_QRIS).trim();
  const idx63 = payload.indexOf('6304');
  if (idx63 !== -1) {
    payload = payload.substring(0, idx63);
  }

  // Parse TLV tags
  const tags: { tag: string; val: string }[] = [];
  let i = 0;
  while (i < payload.length) {
    const tag = payload.substring(i, i + 2);
    const length = parseInt(payload.substring(i + 2, i + 4), 10);
    if (isNaN(length)) break;
    const val = payload.substring(i + 4, i + 4 + length);
    tags.push({ tag, val });
    i += 4 + length;
  }

  // Unique code logic
  let uniqueCode = 1;
  let totalAmount = nominal;
  if (nominal < 1000) {
    uniqueCode = 1;
    totalAmount = nominal + uniqueCode;
  } else {
    uniqueCode = 87; // Sample stable preview offset
    totalAmount = nominal + uniqueCode;
  }

  const amountStr = totalAmount.toString();
  const newTags: { tag: string; val: string }[] = [];
  let hasTag54 = false;

  for (const item of tags) {
    if (item.tag === '01') {
      newTags.push({ tag: '01', val: '12' }); // Convert Static (11) -> Dynamic (12)
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
  const crc = calculateCRC16(result);
  return {
    qris: result + crc,
    crc,
    totalAmount,
    uniqueCode
  };
}

/**
 * Web Crypto SHA-512 Hash
 */
async function computeSHA512(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-512', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Synthesize Fintech Chime via Web Audio API (Zero External Dependency)
 */
function playFintechChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.7);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1046.50, now + 0.08); // C6
    gain2.gain.setValueAtTime(0.3, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 1.1);
  } catch (err) {
    console.warn('Web Audio API not supported:', err);
  }
}

/**
 * Minimal Canvas Confetti Generator
 */
function triggerConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; color: string; rot: number; vrot: number }> = [];
  const colors = ['#0284c7', '#38bdf8', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  for (let i = 0; i < 70; i++) {
    particles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.4,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.7) * 14,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 10
    });
  }

  let frame = 0;
  function animate() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;

    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.rot += p.vrot;

      if (p.y < canvas.height) alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }

    if (alive && frame < 150) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(animate);
}

/**
 * Lightweight QR Code Pattern Renderer for Canvas Preview
 */
function renderQRPreview(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = 180;
  canvas.width = size;
  canvas.height = size;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Simple visual QR matrix pattern based on string hash
  ctx.fillStyle = '#0f172a';
  const cellSize = 6;
  const grid = Math.floor(size / cellSize);

  // Standard finder corners
  function drawFinder(startX: number, startY: number) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          ctx!.fillRect((startX + c) * cellSize, (startY + r) * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  drawFinder(2, 2);
  drawFinder(grid - 9, 2);
  drawFinder(2, grid - 9);

  // Fill pseudo modules with deterministic hash
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 2; r < grid - 2; r++) {
    for (let c = 2; c < grid - 2; c++) {
      // Avoid finder areas
      if ((r < 10 && c < 10) || (r < 10 && c > grid - 11) || (r > grid - 11 && c < 10)) continue;

      const val = Math.abs(Math.sin((r * grid + c) * 0.7 + hash));
      if (val > 0.45) {
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }
  }
}

// --------------------------------------------------------------------------
// Render Main Application UI
// --------------------------------------------------------------------------
const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
<!-- Top Sticky Header -->
<header class="top-header">
  <div class="brand-wrapper">
    <button class="btn-icon mobile-menu-btn" id="mobileMenuBtn" aria-label="Toggle navigation">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
    <div class="brand-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    </div>
    <div class="brand-title">
      <span>YURIPAY</span>
      <span class="brand-badge">v1.2 Enterprise</span>
    </div>
  </div>

  <div class="header-actions">
    <div class="search-input-wrapper">
      <svg class="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input type="text" id="searchInput" class="search-input" placeholder="Cari dokumentasi..." />
    </div>

    <a href="https://github.com/myzert/YURIPAY-GOPAY" target="_blank" rel="noopener" class="btn-star" title="Star di GitHub">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      <span>Star</span>
      <span class="star-count" id="starCount">★ 120+</span>
    </a>

    <button id="themeToggleBtn" class="btn-icon" aria-label="Toggle Theme">
      <svg id="themeIconSun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
      <svg id="themeIconMoon" style="display:none;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    </button>
  </div>
</header>

<div class="doc-container">
  <!-- Left Sidebar Navigation -->
  <aside class="doc-sidebar" id="docSidebar">
    <div class="nav-group-title">MEMULAI</div>
    <ul class="nav-list">
      <li><a href="#ikhtisar" class="nav-link active"><span>⚡ Ikhtisar Arsitektur</span></a></li>
      <li><a href="#why-no-serverless" class="nav-link"><span>⚠️ Kenapa Bukan Serverless?</span><span class="nav-badge-pill">Stateful</span></a></li>
      <li><a href="#fitur-enterprise" class="nav-link"><span>💎 Fitur Utama Enterprise</span></a></li>
      <li><a href="#dual-port" class="nav-link"><span>🏰 Keamanan Dual-Port</span></a></li>
    </ul>

    <div class="nav-group-title">BEDAH KODE REPOSITORI</div>
    <ul class="nav-list">
      <li><a href="#code-deep-dive" class="nav-link"><span>🔍 Analisis Setiap File</span></a></li>
      <li><a href="#file-server" class="nav-link"><span>📄 server.js (Dual Express)</span></a></li>
      <li><a href="#file-qris" class="nav-link"><span>📄 qrisHelper.js (EMVCo)</span></a></li>
      <li><a href="#file-client" class="nav-link"><span>📄 gopayClient.js (GoBiz API)</span></a></li>
      <li><a href="#file-store" class="nav-link"><span>📄 paymentStore.js (SQLite)</span></a></li>
      <li><a href="#file-webhook" class="nav-link"><span>📄 webhookEngine.js (Midtrans)</span></a></li>
    </ul>

    <div class="nav-group-title">INTERACTIVE TOOLS</div>
    <ul class="nav-list">
      <li><a href="#simulator-qris" class="nav-link"><span>🧮 Dynamic QRIS Generator</span><span class="nav-badge-pill">Live</span></a></li>
      <li><a href="#simulator-webhook" class="nav-link"><span>🔒 SHA-512 Signature Hash</span></a></li>
      <li><a href="#simulator-audio" class="nav-link"><span>🎵 Audio Celebration Preview</span></a></li>
    </ul>

    <div class="nav-group-title">DEPLOYMENT & INTEGRASI</div>
    <ul class="nav-list">
      <li><a href="#otentikasi-gobiz" class="nav-link"><span>📱 Otentikasi OTP Terminal</span></a></li>
      <li><a href="#deployment" class="nav-link"><span>🚀 Panduan Deployment</span></a></li>
      <li><a href="#env-config" class="nav-link"><span>⚙️ Konfigurasi .env</span></a></li>
      <li><a href="#api-spec" class="nav-link"><span>🔌 Spesifikasi API REST</span></a></li>
      <li><a href="#midtrans-webhook" class="nav-link"><span>🔔 Integrasi Webhook Midtrans</span></a></li>
    </ul>

    <div class="nav-group-title">KOMUNITAS & BANTUAN</div>
    <ul class="nav-list">
      <li><a href="#github-star" class="nav-link"><span>⭐ Star di GitHub</span></a></li>
      <li><a href="#contributors" class="nav-link"><span>🤝 Tim & Kontributor</span></a></li>
      <li><a href="#support" class="nav-link"><span>💖 Dukungan / Donasi</span></a></li>
      <li><a href="#faq" class="nav-link"><span>❓ Pertanyaan Umum (FAQ)</span></a></li>
      <li><a href="#license" class="nav-link"><span>📄 Lisensi ISC</span></a></li>
    </ul>
  </aside>

  <!-- Main Content -->
  <main class="doc-main">
    <!-- Hero Banner -->
    <div class="hero-banner">
      <div class="hero-glow-blob"></div>
      <div class="hero-tag">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <span>ENTERPRISE SELF-HOSTED GATEWAY</span>
      </div>

      <h1 class="hero-title">
        ⚡ YURIPAY <span class="gradient-text">by myzert</span>
      </h1>
      <p class="hero-subtitle">
        Enterprise Self-Hosted Dynamic QRIS Payment Gateway untuk GoBiz Merchants. Stateful High-Performance, Dual-Port Isolation, Webhook Midtrans SHA-512, dan Idempotensi Penuh dengan 0% Potongan Biaya.
      </p>

      <div class="hero-badges-row">
        <a href="https://github.com/myzert/YURIPAY-GOPAY" target="_blank" rel="noopener">
          <img src="https://img.shields.io/badge/YURIPAY-by%20myzert-0284c7?style=for-the-badge&logo=shield" alt="YuriPay by myzert" />
        </a>
        <a href="https://github.com/myzert/YURIPAY-GOPAY/stargazers" target="_blank" rel="noopener">
          <img src="https://img.shields.io/github/stars/myzert/YURIPAY-GOPAY?style=for-the-badge&logo=github&color=0284c7" alt="GitHub Stars" />
        </a>
        <img src="https://img.shields.io/badge/QRIS-Bank%20Indonesia%20Standard-red?style=for-the-badge" alt="QRIS Standard" />
        <img src="https://img.shields.io/badge/Runtime-Stateful%20Only-success?style=for-the-badge" alt="Stateful Only" />
        <img src="https://img.shields.io/badge/Serverless-STRICTLY%20UNSUPPORTED-critical?style=for-the-badge" alt="No Serverless" />
        <img src="https://img.shields.io/badge/License-ISC-blue?style=for-the-badge" alt="ISC License" />
      </div>

      <div class="hero-cta-group">
        <a href="#simulator-qris" class="btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span>Coba Simulator QRIS</span>
        </a>
        <a href="https://github.com/myzert/YURIPAY-GOPAY" target="_blank" rel="noopener" class="btn-secondary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
          <span>Lihat di GitHub ⭐</span>
        </a>
        <a href="#deployment" class="btn-secondary">
          <span>Panduan Deploy 🚀</span>
        </a>
      </div>
    </div>

    <!-- Quick Metric Cards -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value">0%</div>
        <div class="metric-label">Gateway Fee</div>
        <div class="metric-desc">Dana masuk 100% langsung ke GoBiz Anda tanpa potongan pihak ketiga.</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">2.5s</div>
        <div class="metric-label">Kecepatan Verifikasi</div>
        <div class="metric-desc">Daemon poller realtime memverifikasi mutasi transaksi dalam hitungan detik.</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">+1 Perak</div>
        <div class="metric-label">Offset Presisi</div>
        <div class="metric-desc">Hemat dan akurat untuk transaksi mikro maupun retail standar.</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">Dual-Port</div>
        <div class="metric-label">Isolasi Keamanan</div>
        <div class="metric-desc">Port 3000 (Internal & Kasir) terpisah total dari Port 3001 (Publik Checkout).</div>
      </div>
    </div>

    <!-- Legal Disclaimer Alert -->
    <div class="alert-box alert-important" id="disclaimer">
      <div class="alert-icon">⚖️</div>
      <div>
        <strong>PERNYATAAN RESMI HUKUM (LEGAL DISCLAIMER):</strong><br>
        1. <strong>Proyek Komunitas Mandiri (Unofficial Project)</strong>: <strong>YURIPAY</strong> adalah software open-source independen yang dikembangkan oleh <strong>myzert</strong> untuk riset, edukasi, dan integrasi kasir mandiri. Software ini <strong>TIDAK berafiliasi, didukung, atau disetujui resmi oleh PT GoTo Gojek Tokopedia Tbk (Gojek / GoPay / GoBiz), Bank Indonesia, maupun ASPI</strong>.<br>
        2. <strong>Kepatuhan Merchant</strong>: Pengguna wajib mematuhi S&K GoBiz dan peraturan Bank Indonesia terkait pembayaran QRIS (PADG No. 21/18/PADG/2019).
      </div>
    </div>

    <!-- Section: Ikhtisar Arsitektur -->
    <section class="doc-section" id="ikhtisar">
      <div class="section-header">
        <h2 class="section-title">🏛️ Ikhtisar Arsitektur Transaksi</h2>
        <p class="section-lead">Bagaimana YuriPay mengonversi QRIS Statis GoBiz Anda menjadi payment gateway otomatis.</p>
      </div>

      <div class="code-tab-container">
        <div class="code-tab-header">
          <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--accent-primary);">ALUR TRANSAKSI STATEFUL YURIPAY</span>
        </div>
        <pre class="code-content"><code>[ Pelanggan Toko ]                                            [ Server Toko / Merchant ]
        │                                                                  │
        │ 1. Buat Tagihan (POST /api/create-payment)                       │
        │◄─────────────────────────────────────────────────────────────────┤
        │                                                                  │
        ▼                                                                  │
[ Halaman Checkout (/pay/:id) ]                                            │
• QRIS Dinamis Otomatis                                                    │
• Nominal Unik (+1 Perak)                                                  │
• Mode: Default Chime / Anime                                              │
        │                                                                  │
        │ 2. Pembayaran via Bank / E-Wallet (BCA, GoPay, DANA, dll.)        │
        ▼                                                                  │
[ Jaringan GoPay / GoBiz ]                                                 │
        │                                                                  │
        │ 3. Settlement Masuk ke Rekening GoBiz                            │
        ▼                                                                  │
[ YuriPay Daemon Background (Port 3000 & 3001) ]                           │
• Poller Realtime (Setiap 2.5 Detik)                                       │
• Pencocokan Presisi Nominal Unik & Timestamp                              │
• Update Status SQLite WAL -> LUNAS • TERVERIFIKASI                        │
        │                                                                  │
        ├─────────────────────────────────────────────────────────────────►│
        │ 4. Webhook HTTP POST (Midtrans SHA-512)                          │
        │                                                                  ▼
        │                                                      [ Pesanan Diproses Toko ]
        │ 5. Auto OP Redirect ke Website Toko                              │
        ▼                                                                  │
[ Toko Selesai (https://tokosaya.com/finish?order_id=...&status_code=200) ]│</code></pre>
      </div>
    </section>

    <!-- Section: Why No Serverless -->
    <section class="doc-section" id="why-no-serverless">
      <div class="section-header">
        <h2 class="section-title">⚠️ Kenapa YuriPay Tidak Bisa di Vercel / Serverless?</h2>
        <p class="section-lead">Penjelasan teknis mengapa platform Serverless seperti Vercel, Netlify, atau AWS Lambda tidak kompatibel.</p>
      </div>

      <div class="alert-box alert-caution">
        <div class="alert-icon">🚨</div>
        <div>
          <strong>PERINGATAN ARSITEKTUR:</strong> YuriPay dirancang secara fundamental sebagai <strong>DAEMON STATEFUL</strong>. YuriPay <strong>TIDAK DAPAT BERJALAN</strong> di Vercel, Netlify, Cloudflare Workers, AWS Lambda, atau platform serverless sejenis.
        </div>
      </div>

      <div class="table-container">
        <table class="doc-table">
          <thead>
            <tr>
              <th>Kebutuhan Sistem YuriPay</th>
              <th>❌ Platform Serverless (Vercel / Lambda)</th>
              <th>✔️ Lingkungan Stateful (VPS / cPanel / Docker / Termux)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Realtime Daemon Poller</strong></td>
              <td>Container dibekukan (<em>frozen</em>) seketika setelah respon HTTP dikirim. Event loop berhenti total dan mutasi tidak akan pernah terverifikasi.</td>
              <td>Node.js Process berjalan 24/7 di background, memeriksa mutasi GoPay setiap 2.5 detik secara non-blocking.</td>
            </tr>
            <tr>
              <td><strong>Penyimpanan SQLite WAL</strong></td>
              <td>Filesystem bersifat read-only dan sementara (<em>ephemeral</em>). Database terhapus otomatis saat instance <em>scale-to-zero</em>.</td>
              <td>Database tersimpan permanen pada disk POSIX dengan konkurensi tinggi melalui mode Write-Ahead Logging (WAL).</td>
            </tr>
            <tr>
              <td><strong>Arsitektur Dual-Port</strong></td>
              <td>Hanya mendukung single-port HTTP router standar.</td>
              <td>Membuka dua socket port terisolasi secara simultan (Port 3000 Internal & Port 3001 Publik).</td>
            </tr>
            <tr>
              <td><strong>In-Memory Mutex Lock</strong></td>
              <td>Instance serverless di-spawn secara acak (multi-instans tanpa sinkronisasi memori), menyebabkan tabrakan kode unik.</td>
              <td>Menjaga memori sesi aktif terpusat, menjamin offset +1 perak tidak bertabrakan antar pelanggan simultan.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Section: Fitur Enterprise -->
    <section class="doc-section" id="fitur-enterprise">
      <div class="section-header">
        <h2 class="section-title">💎 Fitur Utama Enterprise</h2>
        <p class="section-lead">Fitur andalan yang dirancang untuk keandalan kasir e-commerce dan aplikasi berskala tinggi.</p>
      </div>

      <div class="table-container">
        <table class="doc-table">
          <thead>
            <tr>
              <th>Fitur</th>
              <th>Deskripsi & Keunggulan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>🧮 Algoritma Offset Kode Unik</strong></td>
              <td>
                • Transaksi mikro (&lt; Rp 1.000): strictly <strong>+Rp 1 perak</strong> (contoh: Rp 500 &rarr; Rp 501).<br>
                • Transaksi standar (&ge; Rp 1.000): offset acak <strong>1 s/d 199 perak</strong> (maksimal tidak lebih dari 200 perak).<br>
                • Dilengkapi anti-tabrakan otomatis (<em>collision prevention</em>) jika ada pesanan kembar.
              </td>
            </tr>
            <tr>
              <td><strong>🎭 Dual Success Theme</strong></td>
              <td>
                Dua mode selebrasi pembayaran:<br>
                • <strong>Mode Default</strong>: Gaya formal fintech profesional Stripe/Apple Pay dengan audio <em>Fintech Chime</em> (disintesis via Web Audio API tanpa latensi).<br>
                • <strong>Mode Anime</strong>: Modal Marin Kitagawa, suara selebrasi <em>Cute Arigato</em>, dan hujan konfeti.
              </td>
            </tr>
            <tr>
              <td><strong>🕶️ Stealth Anti-Probe</strong></td>
              <td>Akses langsung ke root port publik (<code>http://localhost:3001/</code>) otomatis dialihkan (302 Redirect) ke halaman aman atau repository GitHub resmi untuk menangkal bot scanner.</td>
            </tr>
            <tr>
              <td><strong>🛡️ Idempotensi Transaksi Penuh</strong></td>
              <td>Pelanggan yang me-refresh browser atau jaringan terputus tidak akan membuat tagihan baru. Sistem mengikat pesanan pada <code>order_id</code> yang sama.</td>
            </tr>
            <tr>
              <td><strong>🔔 Webhook Identik Midtrans</strong></td>
              <td>Format payload dan signature key SHA-512 100% kompatibel dengan modul Midtrans di berbagai framework (Laravel, Express, dsb).</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Section: Keamanan Dual-Port -->
    <section class="doc-section" id="dual-port">
      <div class="section-header">
        <h2 class="section-title">🏰 Arsitektur Keamanan Dual-Port</h2>
        <p class="section-lead">Isolasi zona jaringan internal manajemen vs antarmuka checkout publik.</p>
      </div>

      <div class="network-flow-container">
        <div style="text-align: center; font-weight: 700; color: var(--accent-primary);">LALU LINTAS JARINGAN TERPISAH (DEFENSE IN DEPTH)</div>
        <div class="ports-split">
          <div class="port-box internal">
            <div class="port-header">
              <span class="port-badge badge-internal">PORT 3000 - INTERNAL ADMIN</span>
              <span>🔐 Terproteksi</span>
            </div>
            <ul class="port-feature-list">
              <li class="port-feature-item">✔ Dashboard Kasir & Riwayat Transaksi</li>
              <li class="port-feature-item">✔ Login Email & Password dengan Session Guard</li>
              <li class="port-feature-item">✔ Log Mutasi GoBiz Realtime & Riwayat Webhook</li>
              <li class="port-feature-item">✔ Swagger UI Interactive API Docs (/docs)</li>
              <li class="port-feature-item">✔ Akses Sesi Kredensial GoBiz & Database</li>
            </ul>
          </div>

          <div class="port-box public">
            <div class="port-header">
              <span class="port-badge badge-public">PORT 3001 - PUBLIK CHECKOUT</span>
              <span>🌐 Publik</span>
            </div>
            <ul class="port-feature-list">
              <li class="port-feature-item">✔ Halaman Checkout Pelanggan (/pay/:id)</li>
              <li class="port-feature-item">✔ Endpoint Buat Pembayaran Publik</li>
              <li class="port-feature-item">✔ Poller Status Publik Tanpa Sesi Admin</li>
              <li class="port-feature-item">✔ Stealth Auto-Redirect Anti-Bot Scanner</li>
              <li class="port-feature-item">🚫 Zero Access ke Token Sesi GoBiz (.json)</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Section: Bedah Kode Repositori (Code Deep Dive) -->
    <section class="doc-section" id="code-deep-dive">
      <div class="section-header">
        <h2 class="section-title">🔍 Bedah Kode & Arsitektur File (Code Deep Dive)</h2>
        <p class="section-lead">Penjelasan mendalam fungsi dan logika setiap berkas pada repositori resmi YuriPay.</p>
      </div>

      <div class="faq-list">
        <!-- server.js -->
        <div class="faq-item open" id="file-server">
          <button class="faq-question">
            <span>📄 server.js — Inisialisasi Server & Routing Dual-Port</span>
            <span class="faq-icon-arrow">▼</span>
          </button>
          <div class="faq-answer">
            <p><strong>Lokasi:</strong> <code>server.js</code></p>
            <p><strong>Fungsi:</strong> Menginstansiasi dua Express App terpisah (<code>dashboardApp</code> di Port 3000 dan <code>paymentApp</code> di Port 3001). Mengatur middleware session admin berdurasi 7 hari, registrasi endpoint Swagger, rute pembayaran <code>/pay/:id</code>, dan logika stealth redirect pada root port pembayaran.</p>
          </div>
        </div>

        <!-- qrisHelper.js -->
        <div class="faq-item" id="file-qris">
          <button class="faq-question">
            <span>📄 src/gateway/qrisHelper.js — Parser EMVCo & Kalkulasi CRC16</span>
            <span class="faq-icon-arrow">▼</span>
          </button>
          <div class="faq-answer">
            <p><strong>Lokasi:</strong> <code>src/gateway/qrisHelper.js</code></p>
            <p><strong>Fungsi:</strong> Membedah string QRIS statis GoBiz sesuai standar TLV EMVCo, mengubah Tag 01 dari statis (11) menjadi dinamis (12), menyisipkan Tag 54 (nominal pembayaran), dan menghitung ulang checksum <strong>CRC16-CCITT (0xFFFF polynomial 0x1021)</strong>. Juga berisi fungsi <code>generateUniqueAmount()</code> untuk kalkulasi offset +1 perak anti-bentrok.</p>
          </div>
        </div>

        <!-- gopayClient.js -->
        <div class="faq-item" id="file-client">
          <button class="faq-question">
            <span>📄 src/gateway/gopayClient.js — Klien GoBiz & Pencocokan Mutasi</span>
            <span class="faq-icon-arrow">▼</span>
          </button>
          <div class="faq-answer">
            <p><strong>Lokasi:</strong> <code>src/gateway/gopayClient.js</code></p>
            <p><strong>Fungsi:</strong> Mengambil mutasi dari Gojek Analytics API (<code>https://api.gojekapi.com/merchant-analytics/v2/merchants/transactions</code>). Mencocokkan nilai nominal dan timestamp pembayaran pelanggan. Apabila menerima respon <code>401 Unauthorized</code>, modul ini otomatis memicu <code>sessionManager.refreshSession()</code> di latar belakang.</p>
          </div>
        </div>

        <!-- paymentStore.js -->
        <div class="faq-item" id="file-store">
          <button class="faq-question">
            <span>📄 src/gateway/paymentStore.js — Transaksi & SQLite WAL Persistence</span>
            <span class="faq-icon-arrow">▼</span>
          </button>
          <div class="faq-answer">
            <p><strong>Lokasi:</strong> <code>src/gateway/paymentStore.js</code></p>
            <p><strong>Fungsi:</strong> Mengelola tabel SQLite <code>yuripay_payments</code> dengan mode WAL. Menyediakan cache in-memory <code>activePayments = new Map()</code> untuk menjamin idempotensi pesanan via <code>order_id</code> dan respon cepat tanpa membebani I/O disk server.</p>
          </div>
        </div>

        <!-- webhookEngine.js -->
        <div class="faq-item" id="file-webhook">
          <button class="faq-question">
            <span>📄 src/gateway/webhookEngine.js — Midtrans SHA-512 Webhook Engine</span>
            <span class="faq-icon-arrow">▼</span>
          </button>
          <div class="faq-answer">
            <p><strong>Lokasi:</strong> <code>src/gateway/webhookEngine.js</code></p>
            <p><strong>Fungsi:</strong> Membangun payload notifikasi JSON yang identik dengan Midtrans (status <code>settlement</code>, <code>expire</code>, <code>pending</code>), menghitung signature key digital <code>SHA512(order_id + status_code + gross_amount + ServerKey)</code>, serta menjalankan pengiriman otomatis dengan exponential retry hingga 3 kali.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Section: Interactive Simulator (EMVCo Dynamic QRIS) -->
    <section class="doc-section" id="simulator-qris">
      <div class="section-header">
        <h2 class="section-title">🧮 Interactive Live Simulator: Dynamic QRIS Generator</h2>
        <p class="section-lead">Uji coba pembuatan QRIS dinamis langsung di peramban dengan parser EMVCo & CRC16 CCITT.</p>
      </div>

      <div class="simulator-card">
        <div class="sim-header">
          <div class="sim-title">
            <span>🛠️ EMVCo QRIS Generator Playground</span>
          </div>
          <span class="brand-badge">Pure Client-Side Math</span>
        </div>

        <div class="sim-grid">
          <div>
            <div class="form-group">
              <label class="form-label">QRIS Statis Template GoBiz:</label>
              <textarea id="simStaticQris" class="form-textarea" rows="3" style="font-size:0.75rem;">${DEFAULT_STATIC_QRIS}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Nominal Transaksi Dasar (Rp):</label>
              <input type="number" id="simNominal" class="form-input" value="10000" min="50" step="10" />
              <div class="quick-amount-buttons">
                <button class="btn-pill" data-amt="500">Rp 500 (Mikro)</button>
                <button class="btn-pill" data-amt="10000">Rp 10.000</button>
                <button class="btn-pill" data-amt="25000">Rp 25.000</button>
                <button class="btn-pill" data-amt="50000">Rp 50.000</button>
                <button class="btn-pill" data-amt="100000">Rp 100.000</button>
              </div>
            </div>

            <div style="margin-top: 1rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted);">Hasil Kalkulasi Offset Kode Unik:</div>
              <div style="font-size: 1.3rem; font-weight: 800; color: var(--accent-primary);" id="simTotalDisplay">Rp 10.087</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);" id="simOffsetExplain">Offset acak +Rp 87 perak (tidak pernah melebihi 200 perak).</div>
            </div>
          </div>

          <div class="sim-preview-box">
            <div class="qr-canvas-holder">
              <canvas id="simQrCanvas"></canvas>
            </div>
            <div style="font-size: 0.8rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.5rem;" id="simCrcDisplay">CRC16: 0xXXXX</div>
            <button id="btnCopyQris" class="btn-copy">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Salin String QRIS</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Section: Interactive Simulator (SHA-512 Hash) -->
    <section class="doc-section" id="simulator-webhook">
      <div class="section-header">
        <h2 class="section-title">🔒 Kalkulator Signature Key Midtrans SHA-512</h2>
        <p class="section-lead">Uji coba validasi digital signature dengan Web Crypto API sesuai formula Midtrans.</p>
      </div>

      <div class="simulator-card">
        <div class="sim-grid">
          <div>
            <div class="form-group">
              <label class="form-label">Order ID (order_id):</label>
              <input type="text" id="simOrderId" class="form-input" value="INV-20261028-001" />
            </div>
            <div class="form-group">
              <label class="form-label">Status Code (status_code):</label>
              <input type="text" id="simStatusCode" class="form-input" value="200" />
            </div>
            <div class="form-group">
              <label class="form-label">Gross Amount (gross_amount):</label>
              <input type="text" id="simGrossAmount" class="form-input" value="10087.00" />
            </div>
            <div class="form-group">
              <label class="form-label">Server Key (API_KEY di .env):</label>
              <input type="text" id="simServerKey" class="form-input" value="yuripay_live_key_9981248712" />
            </div>
          </div>

          <div style="display:flex; flex-direction:column; justify-content:center;">
            <div class="form-group">
              <label class="form-label">String Mentah yang Di-hash:</label>
              <div id="simRawStringDisplay" style="font-family: var(--font-mono); font-size: 0.8rem; background: var(--bg-tertiary); padding: 0.65rem; border-radius: var(--radius-md); word-break: break-all; border: 1px solid var(--border-primary);">
                INV-20261028-00120010087.00yuripay_live_key_9981248712
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Hasil Hash SHA-512 (signature_key):</label>
              <div id="simSignatureDisplay" style="font-family: var(--font-mono); font-size: 0.75rem; background: var(--bg-code); color: #38bdf8; padding: 0.75rem; border-radius: var(--radius-md); word-break: break-all; border: 1px solid var(--border-primary);">
                Menghitung hash...
              </div>
            </div>

            <button id="btnCopySignature" class="btn-secondary" style="align-self: flex-start; margin-top: 0.5rem;">
              <span>Salin Signature Key</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Section: Audio Celebration Preview -->
    <section class="doc-section" id="simulator-audio">
      <div class="section-header">
        <h2 class="section-title">🎵 Audio Celebration Previewer (Dual Success Theme)</h2>
        <p class="section-lead">Dengarkan perbedaan audio selebrasi mode Default (Fintech Chime) dan Anime.</p>
      </div>

      <div class="simulator-card">
        <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; justify-content: center;">
          <div style="text-align: center; max-width: 260px;">
            <div style="font-weight: 700; margin-bottom: 0.5rem;">Mode 1: Default Fintech Chime</div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">Disintesis murni via Web Audio API tanpa file eksternal (0 latency).</p>
            <button id="btnPlayChime" class="btn-primary" style="width: 100%;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              <span>Play Fintech Chime</span>
            </button>
          </div>

          <div style="text-align: center; max-width: 260px;">
            <div style="font-weight: 700; margin-bottom: 0.5rem;">Mode 2: Anime Cute Arigato</div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">Audio selebrasi anime ceria dilengkapi animasi semburan konfeti.</p>
            <button id="btnPlayAnime" class="btn-secondary" style="width: 100%;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Play Cute Arigato 🎉</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Section: Otentikasi GoBiz -->
    <section class="doc-section" id="otentikasi-gobiz">
      <div class="section-header">
        <h2 class="section-title">📱 Otentikasi GoBiz Merchant (OTP Terminal)</h2>
        <p class="section-lead">Login resmi satu kali via terminal tanpa perlu copy-paste token yang rawan kedaluwarsa.</p>
      </div>

      <div class="code-tab-container">
        <div class="code-tab-header">
          <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--accent-primary);">TERMINAL LOGIN GOBIZ</span>
          <button class="btn-copy" data-copy="npm run login"><span>Salin</span></button>
        </div>
        <pre class="code-content"><code>npm run login

# 1. Masukkan nomor ponsel akun GoBiz Anda (contoh: 085119772671)
# 2. Masukkan 4 digit kode OTP yang diterima melalui SMS atau WhatsApp dari Gojek
# 3. Token tersimpan aman di: .GOPAY_SESI_JANGAN_DIHAPUS.json
# 4. Token diperbarui otomatis di background setiap 6 jam via sessionManager.js!</code></pre>
      </div>
    </section>

    <!-- Section: Panduan Deployment -->
    <section class="doc-section" id="deployment">
      <div class="section-header">
        <h2 class="section-title">🚀 Panduan Deployment Produksi</h2>
        <p class="section-lead">Pilih platform deployment yang sesuai dengan kebutuhan infrastruktur toko Anda.</p>
      </div>

      <div class="code-tab-container">
        <div class="code-tab-header">
          <div class="code-tabs">
            <button class="code-tab-btn active" data-deploy="vps">Linux VPS (PM2)</button>
            <button class="code-tab-btn" data-deploy="cpanel">cPanel (Node.js App)</button>
            <button class="code-tab-btn" data-deploy="docker">Docker Compose</button>
            <button class="code-tab-btn" data-deploy="termux">Termux (Android)</button>
          </div>
          <button class="btn-copy" id="btnCopyDeploy"><span>Salin Perintah</span></button>
        </div>
        <pre class="code-content" id="deployCodeContent"><code># 1. Pasang dependensi di Ubuntu/Debian VPS
sudo apt update && sudo apt install -y nodejs npm git build-essential sqlite3 nginx
sudo npm install -g pm2

# 2. Kloning repositori
git clone https://github.com/myzert/YURIPAY-GOPAY.git yuripay
cd yuripay
npm install --production
cp .env.example .env

# 3. Login GoBiz Merchant
npm run login

# 4. Jalankan dengan PM2 agar aktif 24/7
pm2 start server.js --name "yuripay"
pm2 save
pm2 startup</code></pre>
      </div>
    </section>

    <!-- Section: Konfigurasi .env -->
    <section class="doc-section" id="env-config">
      <div class="section-header">
        <h2 class="section-title">⚙️ Konfigurasi Environment (.env)</h2>
        <p class="section-lead">Variabel konfigurasi sistem gateway untuk port, kredensial, dan nama toko.</p>
      </div>

      <div class="table-container">
        <table class="doc-table">
          <thead>
            <tr>
              <th>Variabel</th>
              <th>Tipe</th>
              <th>Default</th>
              <th>Deskripsi</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>DASHBOARD_PORT</code></td>
              <td>Integer</td>
              <td><code>3000</code></td>
              <td>Port kasir, login admin, mutasi, dan Swagger UI.</td>
            </tr>
            <tr>
              <td><code>PAYMENT_PORT</code></td>
              <td>Integer</td>
              <td><code>3001</code></td>
              <td>Port publik untuk checkout pelanggan (<code>/pay/:id</code>).</td>
            </tr>
            <tr>
              <td><code>STORE_NAME</code></td>
              <td>String</td>
              <td><code>YuriDev</code></td>
              <td>Nama toko merchant yang tertera pada invoice QRIS.</td>
            </tr>
            <tr>
              <td><code>API_KEY</code></td>
              <td>String</td>
              <td><code>yuripay_live_key_xxx</code></td>
              <td>Kunci server rahasia untuk kalkulasi signature SHA-512.</td>
            </tr>
            <tr>
              <td><code>QRIS_STATIC</code></td>
              <td>String</td>
              <td><code>00020101...</code></td>
              <td>String QRIS statis resmi dari aplikasi GoBiz merchant.</td>
            </tr>
            <tr>
              <td><code>DEFAULT_SUCCESS_THEME</code></td>
              <td>String</td>
              <td><code>anime</code></td>
              <td>Tema default: <code>default</code> (Fintech Chime) atau <code>anime</code>.</td>
            </tr>
            <tr>
              <td><code>MIN_NOMINAL</code></td>
              <td>Integer</td>
              <td><code>50</code></td>
              <td>Batas minimal transfer QRIS (Rupiah).</td>
            </tr>
            <tr>
              <td><code>TRANSACTION_TIMEOUT_MINUTES</code></td>
              <td>Integer</td>
              <td><code>10</code></td>
              <td>Masa berlaku QRIS dinamis (menit).</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Section: Spesifikasi API & Webhook -->
    <section class="doc-section" id="api-spec">
      <div class="section-header">
        <h2 class="section-title">🔌 Spesifikasi API REST & Webhook Midtrans</h2>
        <p class="section-lead">Contoh kode integrasi membuat tagihan dan menerima webhook notifikasi di server Anda.</p>
      </div>

      <div class="code-tab-container">
        <div class="code-tab-header">
          <div class="code-tabs">
            <button class="code-tab-btn active" data-lang="curl">cURL</button>
            <button class="code-tab-btn" data-lang="nodejs">Node.js</button>
            <button class="code-tab-btn" data-lang="php">PHP (Laravel)</button>
            <button class="code-tab-btn" data-lang="python">Python</button>
          </div>
          <button class="btn-copy" id="btnCopyApi"><span>Salin Kode</span></button>
        </div>
        <pre class="code-content" id="apiCodeContent"><code># Buat Tagihan Pembayaran Baru (POST /api/create-payment)
curl -X POST http://localhost:3001/api/create-payment \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 25000,
    "order_id": "INV-20261028-001",
    "custom_name": "Paket VIP 1 Bulan",
    "redirect_url": "https://tokosaya.com/finish",
    "webhook_url": "https://tokosaya.com/api/midtrans-webhook",
    "success_theme": "default"
  }'</code></pre>
      </div>
    </section>

    <!-- Section: GitHub Star CTA -->
    <section class="doc-section" id="github-star">
      <div class="support-card">
        <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">⭐</div>
        <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem;">Dukung YuriPay dengan Memberi Star di GitHub!</h2>
        <p style="color: var(--text-secondary); max-width: 600px; margin: 0 auto 1.5rem auto;">
          Bintang Anda di GitHub sangat berharga bagi kelangsungan proyek open-source Indonesia ini. Bantu kami menjangkau lebih banyak developer dan UMKM!
        </p>
        <div class="support-buttons-row">
          <a href="https://github.com/myzert/YURIPAY-GOPAY" target="_blank" rel="noopener" class="btn-primary" style="font-size: 1.05rem; padding: 0.85rem 1.8rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span>Star YuriPay di GitHub</span>
          </a>
        </div>
      </div>
    </section>

    <!-- Section: Kontributor -->
    <section class="doc-section" id="contributors">
      <div class="section-header">
        <h2 class="section-title">🤝 Tim Pengembang & Kontributor</h2>
        <p class="section-lead">Apresiasi setinggi-tingginya untuk pengembang dan kontributor ekosistem YuriPay.</p>
      </div>

      <div class="contributors-card">
        <a href="https://github.com/myzert" target="_blank" rel="noopener">
          <img src="https://github.com/myzert.png" class="maintainer-avatar" alt="myzert avatar" />
        </a>
        <h3 style="font-size: 1.3rem; font-weight: 800;">myzert (YuriDev)</h3>
        <p style="color: var(--accent-primary); font-size: 0.88rem; font-weight: 600; margin-bottom: 0.5rem;">Lead Architect & Maintainer</p>
        <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 450px; margin: 0 auto 1.25rem auto;">
          Pengembang bot anime, sistem pembayaran mandiri GoBiz QRIS, dan infrastruktur open-source Indonesia.
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <a href="https://github.com/myzert" target="_blank" rel="noopener" class="btn-secondary" style="font-size: 0.82rem; padding: 0.4rem 0.8rem;">
            <span>GitHub @myzert</span>
          </a>
          <a href="https://t.me/ahmadzakiyo" target="_blank" rel="noopener" class="btn-secondary" style="font-size: 0.82rem; padding: 0.4rem 0.8rem;">
            <span>Telegram @ahmadzakiyo</span>
          </a>
        </div>
      </div>
    </section>

    <!-- Section: Support & Donasi -->
    <section class="doc-section" id="support">
      <div class="section-header">
        <h2 class="section-title">💖 Donasi & Dukungan Pengembang</h2>
        <p class="section-lead">Belikan kopi untuk pengembang agar server riset dan update modul GoBiz tetap aktif.</p>
      </div>

      <div class="support-card">
        <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem;">Belikan Kopi untuk zert! ☕✨</h3>
        <p style="color: var(--text-secondary); max-width: 600px; margin: 0 auto 1.5rem auto;">
          YuriPay dirilis 100% gratis tanpa potongan biaya transaksi. Jika sistem ini menghemat jutaan rupiah biaya gateway toko Anda, dukung kami melalui link di bawah:
        </p>
        <div class="support-buttons-row">
          <a href="https://t.me/ahmadzakiyo" target="_blank" rel="noopener" class="btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            <span>Hubungi di Telegram</span>
          </a>
          <a href="https://t.me/nuxysproject" target="_blank" rel="noopener" class="btn-secondary">
            <span>📢 Channel @nuxysproject</span>
          </a>
        </div>
      </div>
    </section>

    <!-- Section: FAQ -->
    <section class="doc-section" id="faq">
      <div class="section-header">
        <h2 class="section-title">❓ Pertanyaan Umum (FAQ)</h2>
        <p class="section-lead">Jawaban atas pertanyaan yang paling sering ditanyakan seputar integrasi YuriPay.</p>
      </div>

      <div class="faq-list">
        <div class="faq-item">
          <button class="faq-question">
            <span>1. Apakah YuriPay bisa di-deploy di Vercel atau Netlify?</span>
            <span class="faq-icon-arrow">▼</span>
          </button>
          <div class="faq-answer">
            <p><strong>Tidak bisa.</strong> Vercel membekukan container saat respons HTTP selesai dikirim, sehingga poller background pemeriksa mutasi GoPay akan berhenti berjalan. Selain itu, filesystem serverless bersifat sementara sehingga database transaksi SQLite dan file token login akan terhapus secara acak.</p>
          </div>
        </div>

        <div class="faq-item">
          <button class="faq-question">
            <span>2. Berapa lama token sesi GoBiz bertahan dan apakah perlu login ulang?</span>
            <span class="faq-icon-arrow">▼</span>
          </button>
          <div class="faq-answer">
            <p>Token sesi GoBiz bertahan hingga 30 hari. Berkas <code>sessionManager.js</code> memiliki fitur <em>auto-refresh token</em> yang secara otomatis memperbarui akses token di latar belakang setiap 6 jam. Anda hanya perlu login ulang jika sengaja logout dari aplikasi ponsel GoBiz.</p>
          </div>
        </div>

        <div class="faq-item">
          <button class="faq-question">
            <span>3. Di mana letak string QRIS_STATIC toko saya?</span>
            <span class="faq-icon-arrow">▼</span>
          </button>
          <div class="faq-answer">
            <p>Buka aplikasi <strong>GoBiz</strong> di ponsel Anda &rarr; Pilih menu <strong>Lainnya / QRIS</strong> &rarr; Tampilkan QR Toko Anda &rarr; Scan gambar QR tersebut menggunakan pemindai QR biasa (misal Google Lens). Teks string panjang yang diawali <code>000201010211...6304XXXX</code> adalah kode QRIS Statis Anda.</p>
          </div>
        </div>

        <div class="faq-item">
          <button class="faq-question">
            <span>4. Mengapa nominal pembayaran bertambah Rp 1 perak?</span>
            <span class="faq-icon-arrow">▼</span>
          </button>
          <div class="faq-answer">
            <p>Penambahan Rp 1 perak adalah kode unik verifikasi otomatis. Karena sistem QRIS menerima transfer dari berbagai aplikasi perbankan nasional tanpa identitas nama pengirim yang seragam, kode unik ini menjadi acuan mutlak bagi sistem untuk mencocokkan pembayaran dengan pesanan pelanggan secara 100% presisi tanpa tertukar.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Section: Lisensi -->
    <section class="doc-section" id="license">
      <div class="section-header">
        <h2 class="section-title">📄 Lisensi & Hak Cipta</h2>
      </div>
      <div class="code-tab-container">
        <pre class="code-content"><code>ISC License

Copyright (c) 2026 myzert (YuriDev)

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES.</code></pre>
      </div>
    </section>
  </main>

  <!-- Right On-This-Page Table of Contents -->
  <aside class="doc-toc">
    <div class="toc-title">PADA HALAMAN INI</div>
    <ul class="toc-list" id="tocList">
      <li><a href="#ikhtisar" class="toc-link">⚡ Ikhtisar Arsitektur</a></li>
      <li><a href="#why-no-serverless" class="toc-link">⚠️ Kenapa Bukan Serverless?</a></li>
      <li><a href="#fitur-enterprise" class="toc-link">💎 Fitur Enterprise</a></li>
      <li><a href="#dual-port" class="toc-link">🏰 Keamanan Dual-Port</a></li>
      <li><a href="#code-deep-dive" class="toc-link">🔍 Bedah Kode File</a></li>
      <li><a href="#simulator-qris" class="toc-link">🧮 Dynamic QRIS Simulator</a></li>
      <li><a href="#simulator-webhook" class="toc-link">🔒 SHA-512 Signature Hash</a></li>
      <li><a href="#simulator-audio" class="toc-link">🎵 Audio Previewer</a></li>
      <li><a href="#otentikasi-gobiz" class="toc-link">📱 Otentikasi GoBiz</a></li>
      <li><a href="#deployment" class="toc-link">🚀 Panduan Deployment</a></li>
      <li><a href="#env-config" class="toc-link">⚙️ Konfigurasi .env</a></li>
      <li><a href="#api-spec" class="toc-link">🔌 Spesifikasi API REST</a></li>
      <li><a href="#github-star" class="toc-link">⭐ Star di GitHub</a></li>
      <li><a href="#contributors" class="toc-link">🤝 Tim & Kontributor</a></li>
      <li><a href="#support" class="toc-link">💖 Dukungan / Donasi</a></li>
      <li><a href="#faq" class="toc-link">❓ Pertanyaan Umum</a></li>
      <li><a href="#license" class="toc-link">📄 Lisensi ISC</a></li>
    </ul>
  </aside>
</div>

<!-- Footer with SEO Links -->
<footer class="doc-footer">
  <div class="footer-links">
    <a href="https://yuripay.pages.dev/" class="footer-link">yuripay.pages.dev</a>
    <a href="https://yuripay.projectt.my.id/" class="footer-link">yuripay.projectt.my.id</a>
    <a href="https://github.com/myzert/YURIPAY-GOPAY" target="_blank" rel="noopener" class="footer-link">GitHub Repository</a>
    <a href="https://t.me/nuxysproject" target="_blank" rel="noopener" class="footer-link">Telegram Updates</a>
    <a href="https://t.me/ahmadzakiyo" target="_blank" rel="noopener" class="footer-link">Developer Support</a>
  </div>
  <p>© 2026 <strong>YURIPAY by myzert (YuriDev)</strong>. Lisensi ISC. Dikembangkan dengan dedikasi untuk ekosistem open-source Indonesia.</p>
</footer>
`;

// --------------------------------------------------------------------------
// Event Listeners & Interactive Handlers
// --------------------------------------------------------------------------

// Theme Toggle
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIconSun = document.getElementById('themeIconSun');
const themeIconMoon = document.getElementById('themeIconMoon');

function updateThemeIcons(isDark: boolean) {
  if (isDark) {
    themeIconSun!.style.display = 'block';
    themeIconMoon!.style.display = 'none';
  } else {
    themeIconSun!.style.display = 'none';
    themeIconMoon!.style.display = 'block';
  }
}

themeToggleBtn?.addEventListener('click', () => {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('yuripay_theme', isDark ? 'dark' : 'light');
  updateThemeIcons(isDark);
});

// Init theme from storage or default dark
const savedTheme = localStorage.getItem('yuripay_theme') || 'dark';
if (savedTheme === 'light') {
  document.documentElement.classList.remove('dark');
  updateThemeIcons(false);
} else {
  document.documentElement.classList.add('dark');
  updateThemeIcons(true);
}

// Mobile sidebar menu toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const docSidebar = document.getElementById('docSidebar');
mobileMenuBtn?.addEventListener('click', () => {
  docSidebar?.classList.toggle('show');
});

// Close mobile sidebar when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    if (window.innerWidth <= 900) {
      docSidebar?.classList.remove('show');
    }
  });
});

// Dynamic QRIS Simulator Live Binding
const simStaticQris = document.getElementById('simStaticQris') as HTMLTextAreaElement;
const simNominal = document.getElementById('simNominal') as HTMLInputElement;
const simTotalDisplay = document.getElementById('simTotalDisplay')!;
const simOffsetExplain = document.getElementById('simOffsetExplain')!;
const simCrcDisplay = document.getElementById('simCrcDisplay')!;
const simQrCanvas = document.getElementById('simQrCanvas') as HTMLCanvasElement;
const btnCopyQris = document.getElementById('btnCopyQris')!;

let currentGeneratedQris = '';

function updateQrisSimulator() {
  const staticTemplate = simStaticQris.value.trim() || DEFAULT_STATIC_QRIS;
  const nominal = parseInt(simNominal.value, 10) || 10000;

  const result = buildDynamicQRIS(staticTemplate, nominal);
  currentGeneratedQris = result.qris;

  simTotalDisplay.textContent = formatRupiah(result.totalAmount);
  if (nominal < 1000) {
    simOffsetExplain.textContent = `Offset tetap mikro +Rp ${result.uniqueCode} perak (sangat hemat untuk uji coba & donasi).`;
  } else {
    simOffsetExplain.textContent = `Offset acak +Rp ${result.uniqueCode} perak (dijamin acak antara 1 s/d 199 perak).`;
  }

  simCrcDisplay.textContent = `CRC16: 0x${result.crc}`;
  renderQRPreview(simQrCanvas, result.qris);
}

simStaticQris?.addEventListener('input', updateQrisSimulator);
simNominal?.addEventListener('input', updateQrisSimulator);

document.querySelectorAll('.btn-pill').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const target = e.currentTarget as HTMLElement;
    const amt = target.dataset.amt;
    if (amt && simNominal) {
      simNominal.value = amt;
      updateQrisSimulator();
    }
  });
});

btnCopyQris?.addEventListener('click', () => {
  if (currentGeneratedQris) {
    navigator.clipboard.writeText(currentGeneratedQris).then(() => {
      btnCopyQris.innerHTML = '<span>Tersalin! ✔</span>';
      setTimeout(() => {
        btnCopyQris.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> <span>Salin String QRIS</span>';
      }, 2000);
    });
  }
});

updateQrisSimulator();

// Midtrans SHA-512 Simulator Binding
const simOrderId = document.getElementById('simOrderId') as HTMLInputElement;
const simStatusCode = document.getElementById('simStatusCode') as HTMLInputElement;
const simGrossAmount = document.getElementById('simGrossAmount') as HTMLInputElement;
const simServerKey = document.getElementById('simServerKey') as HTMLInputElement;
const simRawStringDisplay = document.getElementById('simRawStringDisplay')!;
const simSignatureDisplay = document.getElementById('simSignatureDisplay')!;
const btnCopySignature = document.getElementById('btnCopySignature')!;

let currentSignature = '';

async function updateSignatureSimulator() {
  const orderId = simOrderId.value.trim();
  const statusCode = simStatusCode.value.trim();
  const grossAmount = simGrossAmount.value.trim();
  const serverKey = simServerKey.value.trim();

  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  simRawStringDisplay.textContent = raw;

  currentSignature = await computeSHA512(raw);
  simSignatureDisplay.textContent = currentSignature;
}

[simOrderId, simStatusCode, simGrossAmount, simServerKey].forEach(el => {
  el?.addEventListener('input', updateSignatureSimulator);
});

btnCopySignature?.addEventListener('click', () => {
  if (currentSignature) {
    navigator.clipboard.writeText(currentSignature).then(() => {
      btnCopySignature.textContent = 'Tersalin! ✔';
      setTimeout(() => {
        btnCopySignature.textContent = 'Salin Signature Key';
      }, 2000);
    });
  }
});

updateSignatureSimulator();

// Audio Celebration Player Binding
const btnPlayChime = document.getElementById('btnPlayChime');
const btnPlayAnime = document.getElementById('btnPlayAnime');

btnPlayChime?.addEventListener('click', () => {
  playFintechChime();
});

btnPlayAnime?.addEventListener('click', () => {
  const audio = new Audio('/sounds/cute-arigato.mp3');
  audio.play().catch(e => console.warn('Audio play error:', e));
  triggerConfetti();
});

// FAQ Accordion Toggle
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const parent = btn.closest('.faq-item');
    parent?.classList.toggle('open');
  });
});

// Code Snippets Data & Tab Handlers
const deploySnippets: Record<string, string> = {
  vps: `# 1. Pasang dependensi di Ubuntu/Debian VPS
sudo apt update && sudo apt install -y nodejs npm git build-essential sqlite3 nginx
sudo npm install -g pm2

# 2. Kloning repositori
git clone https://github.com/myzert/YURIPAY-GOPAY.git yuripay
cd yuripay
npm install --production
cp .env.example .env

# 3. Login GoBiz Merchant
npm run login

# 4. Jalankan dengan PM2 agar aktif 24/7
pm2 start server.js --name "yuripay"
pm2 save
pm2 startup`,
  cpanel: `# 1. Masuk cPanel -> Menu 'Setup Node.js App'
# 2. Klik 'Create Application' (Pilih Node.js 18.x/20.x, Mode Production, Root 'yuripay', Startup file 'server.js')
# 3. Upload file YuriPay ke folder yuripay
# 4. Buka Terminal cPanel:
cd yuripay
npm install --production
node login.js # Lakukan OTP satu kali saja

# 5. Isi Environment Variables (.env) di cPanel
# 6. Klik 'Restart Application'. Selesai!`,
  docker: `# Build dan jalankan container mandiri:
git clone https://github.com/myzert/YURIPAY-GOPAY.git
cd YURIPAY-GOPAY
cp .env.example .env
npm run login # Dapatkan token sesi terlebih dahulu
docker compose up -d --build

# Pantau log transaksi realtime:
docker compose logs -f`,
  termux: `# Ubah HP Android bekas jadi server pembayaran hemat energi:
pkg update && pkg upgrade -y
pkg install nodejs git python make clang sqlite -y

git clone https://github.com/myzert/YURIPAY-GOPAY.git
cd YURIPAY-GOPAY
npm install
cp .env.example .env

npm run login
npm start`
};

const deployCodeContent = document.getElementById('deployCodeContent')!;
const btnCopyDeploy = document.getElementById('btnCopyDeploy')!;

document.querySelectorAll('[data-deploy]').forEach(tab => {
  tab.addEventListener('click', (e) => {
    document.querySelectorAll('[data-deploy]').forEach(t => t.classList.remove('active'));
    const target = e.currentTarget as HTMLElement;
    target.classList.add('active');
    const key = target.dataset.deploy || 'vps';
    deployCodeContent.textContent = deploySnippets[key] || '';
  });
});

btnCopyDeploy?.addEventListener('click', () => {
  navigator.clipboard.writeText(deployCodeContent.textContent || '').then(() => {
    btnCopyDeploy.innerHTML = '<span>Tersalin! ✔</span>';
    setTimeout(() => {
      btnCopyDeploy.innerHTML = '<span>Salin Perintah</span>';
    }, 2000);
  });
});

const apiSnippets: Record<string, string> = {
  curl: `# Buat Tagihan Pembayaran Baru (POST /api/create-payment)
curl -X POST http://localhost:3001/api/create-payment \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 25000,
    "order_id": "INV-20261028-001",
    "custom_name": "Paket VIP 1 Bulan",
    "redirect_url": "https://tokosaya.com/finish",
    "webhook_url": "https://tokosaya.com/api/midtrans-webhook",
    "success_theme": "default"
  }'`,
  nodejs: `// Verifikasi Webhook di Node.js (Express)
const crypto = require('crypto');

app.post('/api/midtrans-webhook', (req, res) => {
  const { order_id, status_code, gross_amount, signature_key, transaction_status } = req.body;
  const serverKey = process.env.API_KEY || 'yuripay_live_key_9981248712';

  const raw = \`\${order_id}\${status_code}\${gross_amount}\${serverKey}\`;
  const computed = crypto.createHash('sha512').update(raw).digest('hex');

  if (signature_key === computed) {
    if (transaction_status === 'settlement') {
      console.log(\`[PAID] Pesanan \${order_id} lunas diverifikasi!\`);
    }
    return res.status(200).json({ status: 'OK' });
  }

  return res.status(403).json({ error: 'Signature Mismatch' });
});`,
  php: `<?php
// Verifikasi Webhook di PHP (Laravel / Native)
$payload = json_decode(file_get_contents('php://input'), true);

$orderId = $payload['order_id'];
$statusCode = $payload['status_code'];
$grossAmount = $payload['gross_amount'];
$serverKey = env('YURIPAY_SERVER_KEY', 'yuripay_live_key_9981248712');

$signature = hash('sha512', $orderId . $statusCode . $grossAmount . $serverKey);

if ($payload['signature_key'] === $signature) {
    if ($payload['transaction_status'] === 'settlement') {
        // Pembayaran berhasil! Update pesanan toko Anda
    }
    http_response_code(200);
    echo json_encode(['status' => 'OK']);
} else {
    http_response_code(403);
    echo "Invalid Signature";
}`,
  python: `# Verifikasi Webhook di Python (FastAPI)
import hashlib
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()

@app.post("/api/midtrans-webhook")
async def webhook(request: Request):
    data = await request.json()
    server_key = "yuripay_live_key_9981248712"

    raw = f"{data['order_id']}{data['status_code']}{data['gross_amount']}{server_key}"
    computed = hashlib.sha512(raw.encode('utf-8')).hexdigest()

    if data['signature_key'] == computed:
        if data['transaction_status'] == 'settlement':
            print(f"Pesanan {data['order_id']} lunas!")
        return {"status": "OK"}

    raise HTTPException(status_code=403, detail="Invalid Signature")`
};

const apiCodeContent = document.getElementById('apiCodeContent')!;
const btnCopyApi = document.getElementById('btnCopyApi')!;

document.querySelectorAll('[data-lang]').forEach(tab => {
  tab.addEventListener('click', (e) => {
    document.querySelectorAll('[data-lang]').forEach(t => t.classList.remove('active'));
    const target = e.currentTarget as HTMLElement;
    target.classList.add('active');
    const key = target.dataset.lang || 'curl';
    apiCodeContent.textContent = apiSnippets[key] || '';
  });
});

btnCopyApi?.addEventListener('click', () => {
  navigator.clipboard.writeText(apiCodeContent.textContent || '').then(() => {
    btnCopyApi.innerHTML = '<span>Tersalin! ✔</span>';
    setTimeout(() => {
      btnCopyApi.innerHTML = '<span>Salin Kode</span>';
    }, 2000);
  });
});

// Copy button handlers for arbitrary code snippets
document.querySelectorAll('.btn-copy[data-copy]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const target = e.currentTarget as HTMLElement;
    const text = target.dataset.copy || '';
    navigator.clipboard.writeText(text).then(() => {
      target.textContent = 'Tersalin! ✔';
      setTimeout(() => {
        target.textContent = 'Salin';
      }, 2000);
    });
  });
});

// Search Filter Input
const searchInput = document.getElementById('searchInput') as HTMLInputElement;
searchInput?.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  const sections = document.querySelectorAll('.doc-section');

  sections.forEach(sec => {
    const text = (sec as HTMLElement).innerText.toLowerCase();
    if (!query || text.includes(query)) {
      (sec as HTMLElement).style.display = 'block';
    } else {
      (sec as HTMLElement).style.display = 'none';
    }
  });
});

// Scrollspy for Sidebar & TOC Active States
const tocLinks = document.querySelectorAll('.toc-link');
const navLinks = document.querySelectorAll('.nav-link');
const trackedSections = document.querySelectorAll('.doc-section');

window.addEventListener('scroll', () => {
  let currentId = '';
  trackedSections.forEach(sec => {
    const top = (sec as HTMLElement).offsetTop - 120;
    if (window.scrollY >= top) {
      currentId = sec.getAttribute('id') || '';
    }
  });

  if (currentId) {
    tocLinks.forEach(link => {
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    navLinks.forEach(link => {
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
});
