// exporters/qr.mjs — QR Code encoder (byte mode), faithful port of Nayuki's
// public-domain "QR Code generator" (https://www.nayuki.io/page/qr-code-generator-library,
// MIT / public-domain). Supports versions 1–40, EC level configurable (default M).
// Dependency-free, Workers-safe. Returns a boolean module matrix; pdf.mjs renders it.
//
// ⚠ Unverified against a scanner in this build environment — confirm with qr-preview.mjs.

// ── Reed–Solomon over GF(2^8), primitive 0x11D ───────────────────────────
function rsMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xFF;
}
function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = rsMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
}
function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= rsMultiply(coef, factor); });
  }
  return result;
}

// ── ECC tables (rows = L,M,Q,H; col = version 1..40; index 0 unused) ──────
const ECL = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const MIN_VER = 1, MAX_VER = 40;

function numRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}
function numDataCodewords(ver, ecl) {
  return Math.floor(numRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
}

// ── Bit buffer ───────────────────────────────────────────────────────────
function appendBits(val, len, bb) { for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); }

// ── Encode (byte-mode segment) → data codewords for a chosen version ──────
function makeDataCodewords(bytes, ecl) {
  // choose smallest version that fits
  let version = 0, dataUsedBits = 0;
  for (let v = MIN_VER; v <= MAX_VER; v++) {
    const cap = numDataCodewords(v, ecl) * 8;
    const ccBits = v <= 9 ? 8 : 16;            // byte-mode char-count bits
    const used = 4 + ccBits + bytes.length * 8;
    if (used <= cap) { version = v; dataUsedBits = used; break; }
  }
  if (!version) throw new Error(`QR: data too long (${bytes.length} bytes) for v1–40 EC-${Object.keys(ECL)[ecl]}`);

  const bb = [];
  appendBits(0x4, 4, bb);                       // byte mode
  appendBits(bytes.length, version <= 9 ? 8 : 16, bb);
  for (const b of bytes) appendBits(b, 8, bb);

  const capacityBits = numDataCodewords(version, ecl) * 8;
  appendBits(0, Math.min(4, capacityBits - bb.length), bb); // terminator
  appendBits(0, (8 - bb.length % 8) % 8, bb);               // byte align
  for (let pad = 0xEC; bb.length < capacityBits; pad ^= 0xEC ^ 0x11) appendBits(pad, 8, bb);

  const dataCw = [];
  for (let i = 0; i < bb.length; i += 8) dataCw.push(parseInt(bb.slice(i, i + 8).join(''), 2));
  return { version, dataCw };
}

// ── Interleave data + ECC blocks ─────────────────────────────────────────
function addEccAndInterleave(data, ver, ecl) {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][ver];
  const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - rawCodewords % numBlocks;
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks = [];
  const rsDiv = rsDivisor(blockEccLen);
  let k = 0;
  for (let i = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + datLen);
    k += datLen;
    const ecc = rsRemainder(dat, rsDiv);
    if (i < numShortBlocks) dat.push(0); // pad short blocks so columns line up
    blocks.push({ dat, ecc });
  }

  const result = [];
  for (let i = 0; i < blocks[0].dat.length; i++) {
    blocks.forEach((blk, j) => {
      // skip the padding cell of short blocks
      if (!(i === shortBlockLen - blockEccLen && j < numShortBlocks)) result.push(blk.dat[i]);
    });
  }
  for (let i = 0; i < blockEccLen; i++) blocks.forEach((blk) => result.push(blk.ecc[i]));
  return result;
}

// ── Matrix build ─────────────────────────────────────────────────────────
function buildMatrix(ver, ecl, allCodewords) {
  const size = ver * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { modules[y][x] = dark; isFn[y][x] = true; };

  // timing
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  // finders
  const finder = (x, y) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, dist !== 2 && dist !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  // alignment
  const aligns = alignmentPositions(ver);
  for (let i = 0; i < aligns.length; i++) for (let j = 0; j < aligns.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === aligns.length - 1) || (i === aligns.length - 1 && j === 0)) continue;
    const cx = aligns[i], cy = aligns[j];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  // reserve format + version areas (drawn later)
  drawFormatBits(modules, isFn, size, ecl, 0, true);
  if (ver >= 7) drawVersion(modules, isFn, size, ver, true);

  // draw data (zigzag)
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let k = 0; k < 2; k++) {
        const x = right - k;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFn[y][x] && i < allCodewords.length * 8) {
          modules[y][x] = ((allCodewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }

  // choose mask
  let bestMask = 0, minPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(modules, isFn, size, mask);
    drawFormatBits(modules, isFn, size, ecl, mask, false);
    const p = penalty(modules, size);
    if (p < minPenalty) { minPenalty = p; bestMask = mask; }
    applyMask(modules, isFn, size, mask); // XOR again to undo
  }
  applyMask(modules, isFn, size, bestMask);
  drawFormatBits(modules, isFn, size, ecl, bestMask, false);

  return modules;
}

function alignmentPositions(ver) {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.floor((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function drawFormatBits(modules, isFn, size, ecl, mask, reserveOnly) {
  // EC level bits per spec: M=00, L=01, H=10, Q=11
  const eclBits = [1, 0, 3, 2][ecl];
  const data = (eclBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const get = (i) => reserveOnly ? false : ((bits >>> i) & 1) !== 0;
  const put = (x, y, i) => { modules[y][x] = get(i); isFn[y][x] = true; };
  // first copy
  for (let i = 0; i <= 5; i++) put(8, i, i);
  put(8, 7, 6); put(8, 8, 7); put(7, 8, 8);
  for (let i = 9; i < 15; i++) put(14 - i, 8, i);
  // second copy
  for (let i = 0; i < 8; i++) put(size - 1 - i, 8, i);
  for (let i = 8; i < 15; i++) put(8, size - 15 + i, i);
  modules[size - 8][8] = true; isFn[size - 8][8] = true; // always-dark
}

function drawVersion(modules, isFn, size, ver, reserveOnly) {
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
  const bits = (ver << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const bit = reserveOnly ? false : ((bits >>> i) & 1) !== 0;
    const a = size - 11 + i % 3, b = Math.floor(i / 3);
    modules[b][a] = bit; isFn[b][a] = true;
    modules[a][b] = bit; isFn[a][b] = true;
  }
}

function maskFn(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return (x * y) % 2 + (x * y) % 3 === 0;
    case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
    case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
  }
}
function applyMask(modules, isFn, size, mask) {
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!isFn[y][x] && maskFn(mask, x, y)) modules[y][x] = !modules[y][x];
  }
}

function penalty(m, size) {
  let p = 0;
  const PER = [3, 10, 40]; // S1 run base, S2 box, S3 finder-like
  // S1 rows + cols
  for (let dir = 0; dir < 2; dir++) {
    for (let a = 0; a < size; a++) {
      let run = 0, last = false;
      for (let b = 0; b < size; b++) {
        const v = dir === 0 ? m[a][b] : m[b][a];
        if (v === last) { run++; if (run === 5) p += PER[0]; else if (run > 5) p++; }
        else { last = v; run = 1; }
      }
    }
  }
  // S2 boxes
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += PER[1];
  }
  // S3 finder-like 1:1:3:1:1 + 4 light
  const pat = [true, false, true, true, true, false, true];
  const scan = (get) => {
    for (let i = 0; i + 7 <= size; i++) {
      let ok = true; for (let k = 0; k < 7; k++) if (get(i + k) !== pat[k]) { ok = false; break; }
      if (!ok) continue;
      const before = []; for (let k = 1; k <= 4; k++) before.push(i - k >= 0 ? get(i - k) : false);
      const after = []; for (let k = 0; k < 4; k++) after.push(i + 7 + k < size ? get(i + 7 + k) : false);
      if (before.every((v) => !v) || after.every((v) => !v)) p += PER[2];
    }
  };
  for (let a = 0; a < size; a++) { scan((b) => m[a][b]); scan((b) => m[b][a]); }
  // S4 dark ratio
  let dark = 0; for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m[y][x]) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  p += Math.max(0, k) * 10;
  return p;
}

/** qrMatrix(text, eclName='M') -> { size, modules: boolean[][] (true=dark), version } */
export function qrMatrix(text, eclName = 'M') {
  const ecl = ECL[eclName] ?? ECL.M;
  const bytes = Array.from(new TextEncoder().encode(text));
  const { version, dataCw } = makeDataCodewords(bytes, ecl);
  const allCodewords = addEccAndInterleave(dataCw, version, ecl);
  const modules = buildMatrix(version, ecl, allCodewords);
  return { size: modules.length, modules, version };
}
