// exporters/qr.mjs — minimal, dependency-free QR Code encoder.
// Byte mode, EC level M, versions 1–7 (auto). Enough to encode a verify URL.
// Returns a boolean module matrix; pdf.mjs renders it as filled squares.
//
// NOT a general QR library (no kanji/alphanumeric/ECI, no v8+ mixed blocks).
// ⚠ Unverified against a scanner in this environment — SCAN the sample PDF to confirm.
// Algorithm per ISO/IEC 18004. If a code won't scan, the most likely culprits are the
// mask-penalty selection or the data zigzag; the text URL fallback in the PDF still works.

// --- GF(256) tables (primitive 0x11D) ------------------------------------
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

function rsGenPoly(deg) {
  let g = [1];
  for (let i = 0; i < deg; i++) {
    const ng = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { ng[j] ^= gmul(g[j], EXP[i]); ng[j + 1] ^= g[j]; }
    g = ng;
  }
  return g;
}
function rsEncode(data, ecLen) {
  const gen = rsGenPoly(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ res[0];
    res.shift(); res.push(0);
    for (let j = 0; j < ecLen; j++) res[j] ^= gmul(gen[j], factor);
  }
  return res;
}

// --- Version tables (EC level M, uniform blocks) -------------------------
// [blocks, dataPerBlock, ecPerBlock]
const VER = {
  1: [1, 16, 10], 2: [1, 28, 16], 3: [1, 44, 26], 4: [2, 32, 18],
  5: [2, 43, 24], 6: [4, 27, 16], 7: [4, 31, 18],
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38] };
const REMAINDER = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0 };
const FORMAT_M = [0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0]; // EC=M, mask 0..7
const VERSION_INFO = { 7: 0x07C94 };
const sizeOf = (v) => 17 + 4 * v;

// --- Encode data codewords -----------------------------------------------
function encodeData(bytes) {
  let version = 0;
  for (let v = 1; v <= 7; v++) { const [b, d] = VER[v]; if (b * d - 2 >= bytes.length) { version = v; break; } } // -2: mode+count overhead
  if (!version) throw new Error(`QR: data too long (${bytes.length} bytes) for v1–7 EC-M; shorten the verify URL.`);
  const [blocks, dataPerBlock, ecPerBlock] = VER[version];
  const totalData = blocks * dataPerBlock;

  // Bit stream: mode(0100) + count(8 bits, v1–9) + data + terminator + pad.
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const b of bytes) push(b, 8);
  const cap = totalData * 8;
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0); // terminator
  while (bits.length % 8) bits.push(0);                          // byte align
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  const PAD = [0xEC, 0x11];                                      // alternating pad codewords
  for (let p = 0; data.length < totalData; p++) data.push(PAD[p % 2]);

  // Split into blocks, compute EC, interleave.
  const dBlocks = [], eBlocks = [];
  for (let i = 0; i < blocks; i++) {
    const blk = data.slice(i * dataPerBlock, (i + 1) * dataPerBlock);
    dBlocks.push(blk); eBlocks.push(rsEncode(blk, ecPerBlock));
  }
  const out = [];
  for (let i = 0; i < dataPerBlock; i++) for (const b of dBlocks) out.push(b[i]);
  for (let i = 0; i < ecPerBlock; i++) for (const b of eBlocks) out.push(b[i]);
  return { version, codewords: out };
}

// --- Matrix construction --------------------------------------------------
function build(version, codewords) {
  const n = sizeOf(version);
  const m = Array.from({ length: n }, () => new Array(n).fill(null)); // null=unset
  const fn = Array.from({ length: n }, () => new Array(n).fill(false)); // function module?

  const setF = (r, c, v) => { m[r][c] = v ? 1 : 0; fn[r][c] = true; };
  // Finder + separators
  const finder = (r, c) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const rr = r + i, cc = c + j; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const inRing = (i >= 0 && i <= 6 && (j === 0 || j === 6)) || (j >= 0 && j <= 6 && (i === 0 || i === 6));
      const inCore = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      setF(rr, cc, inRing || inCore);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  // Timing
  for (let i = 8; i < n - 8; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
  // Alignment
  const ap = ALIGN[version];
  for (const r of ap) for (const c of ap) {
    if ((r <= 7 && c <= 7) || (r <= 7 && c >= n - 8) || (r >= n - 8 && c <= 7)) continue;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const ring = Math.max(Math.abs(i), Math.abs(j));
      setF(r + i, c + j, ring !== 1);
    }
  }
  // Dark module
  setF(n - 8, 8, true);
  // Reserve format areas (set later)
  for (let i = 0; i <= 8; i++) { if (i !== 6) { fn[8][i] = true; fn[i][8] = true; } }
  for (let i = 0; i < 8; i++) { fn[8][n - 1 - i] = true; fn[n - 1 - i][8] = true; }
  // Reserve version info (v7)
  if (version >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { fn[i][n - 11 + j] = true; fn[n - 11 + j][i] = true; }

  // Place data in zigzag
  let bitIdx = 0;
  const totalBits = codewords.length * 8 + (REMAINDER[version] || 0);
  const bitAt = (k) => k < codewords.length * 8 ? (codewords[k >> 3] >> (7 - (k & 7))) & 1 : 0;
  let up = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col = 5; // skip timing column
    for (let t = 0; t < n; t++) {
      const row = up ? n - 1 - t : t;
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (fn[row][cc]) continue;
        m[row][cc] = bitAt(bitIdx++);
        if (bitIdx > totalBits) m[row][cc] = m[row][cc]; // safety no-op
      }
    }
    up = !up;
  }

  // Masking: pick the mask (0–7) with the lowest penalty.
  const maskFns = [
    (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];
  const applyMask = (grid, fnGrid, mk) => grid.map((row, r) => row.map((v, c) => fnGrid[r][c] ? v : (v ^ (maskFns[mk](r, c) ? 1 : 0))));

  const penalty = (g) => {
    let p = 0;
    // Rule 1: runs of 5+
    for (let r = 0; r < n; r++) for (const line of [g[r], g.map((row) => row[r])]) {
      let run = 1; for (let i = 1; i < n; i++) { if (line[i] === line[i - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; } else run = 1; }
    }
    // Rule 2: 2x2 blocks
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) p += 3;
    // Rule 3: finder-like pattern 1011101 + 4 light
    const pat = [1, 0, 1, 1, 1, 0, 1];
    const check = (line) => { for (let i = 0; i + 11 <= n; i++) {
      const seg = line.slice(i, i + 7); if (pat.every((b, k) => b === seg[k])) {
        const before = line.slice(Math.max(0, i - 4), i), after = line.slice(i + 7, i + 11);
        if ((after.length === 4 && after.every((b) => b === 0)) || (before.length === 4 && before.every((b) => b === 0))) p += 40;
      } } };
    for (let r = 0; r < n; r++) { check(g[r]); check(g.map((row) => row[r])); }
    // Rule 4: dark ratio
    let dark = 0; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dark += g[r][c];
    const ratio = (dark * 100) / (n * n); p += Math.floor(Math.abs(ratio - 50) / 5) * 10;
    return p;
  };

  let best = null, bestMask = 0, bestPen = Infinity;
  for (let mk = 0; mk < 8; mk++) {
    const g = applyMask(m, fn, mk);
    // place format info for this mask before scoring (format modules affect penalty minimally; place after is fine)
    const pen = penalty(g);
    if (pen < bestPen) { bestPen = pen; best = g; bestMask = mk; }
  }

  // Format info (EC=M + mask), 15 bits.
  const fmt = FORMAT_M[bestMask];
  const fbits = []; for (let i = 14; i >= 0; i--) fbits.push((fmt >> i) & 1);
  // Top-left around (8,*)/( *,8); copy 2 (split) per spec.
  const fmtCoords = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  fmtCoords.forEach(([r, c], i) => { best[r][c] = fbits[i]; });
  const fmtCoords2 = [
    [n - 1, 8], [n - 2, 8], [n - 3, 8], [n - 4, 8], [n - 5, 8], [n - 6, 8], [n - 7, 8],
    [8, n - 8], [8, n - 7], [8, n - 6], [8, n - 5], [8, n - 4], [8, n - 3], [8, n - 2], [8, n - 1],
  ];
  fmtCoords2.forEach(([r, c], i) => { best[r][c] = fbits[i]; });
  best[n - 8][8] = 1; // dark module stays

  // Version info (v7) 18 bits.
  if (VERSION_INFO[version]) {
    const vi = VERSION_INFO[version]; const vbits = []; for (let i = 17; i >= 0; i--) vbits.push((vi >> i) & 1);
    let k = 0;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { best[i][n - 11 + j] = vbits[k]; best[n - 11 + j][i] = vbits[k]; k++; }
  }

  return best.map((row) => row.map((v) => v === 1));
}

/** qrMatrix(text) -> { size, modules: boolean[][] } (true = dark). */
export function qrMatrix(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const { version, codewords } = encodeData(bytes);
  const modules = build(version, codewords);
  return { size: modules.length, modules, version };
}
