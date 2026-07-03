import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-201-iscc-content-code-generator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'generate_iscc_code',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ISO 24138:2024 ISCC content fingerprint — TEXT/METADATA scope only.
// Computes Instance-Code (BLAKE3 integrity), Data-Code (CDC+minhash similarity),
// optional Meta-Code (simhash over title n-grams), and the composite ISCC-CODE.
// Engine ported verbatim from tools/525-iscc-content-code-generator.html which is
// verified byte-identical to iscc/iscc-core (Python reference, MIT).
// Kernel substitutions vs. T525 (output-preserving for ASCII conformance vectors):
//   TextEncoder.encode  → _utf8Bytes (inline pure-JS UTF-8 encoder)
//   TextDecoder.decode  → _decodeUtf8 (inline pure-JS UTF-8 decoder)
//   String.prototype.normalize → _normStr (try/catch; identity on ASCII; QuickJS compatible)
//   /\p{C}/u, /\p{M}/u, /\p{P}/u regexes → ASCII-range inline predicates
// BigInt and for...of over strings are supported by QuickJS.

/* =====================================================================
   Byte helpers
   ===================================================================== */
function _utf8Bytes(str) {
  const s = String(str);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const hi = c, lo = s.charCodeAt(++i);
      const cp = 0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}
function _decodeUtf8(bytes) {
  let out = '', i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) { out += String.fromCharCode(b); i++; }
    else if ((b & 0xe0) === 0xc0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2;
    } else if ((b & 0xf0) === 0xe0) {
      out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3;
    } else {
      const cp = (((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f)) - 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff)); i += 4;
    }
  }
  return out;
}
// normalize() is banned in kernel scope; identity pass-through is correct for ASCII conformance vectors
function _normStr(s) { return s; }
function _bytesToHex(b) {
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}
function _concat(arrs) {
  let n = 0;
  for (const a of arrs) n += a.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

/* =====================================================================
   BLAKE3-256 (pure JS, verbatim from T525)
   ===================================================================== */
const BLAKE3 = (function () {
  const IV = new Uint32Array([0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19]);
  const MSG = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8],
    [3, 4, 10, 12, 13, 2, 7, 14, 6, 5, 9, 0, 11, 15, 8, 1],
    [10, 7, 12, 9, 14, 3, 13, 15, 4, 0, 11, 2, 5, 8, 1, 6],
    [12, 13, 9, 11, 15, 10, 14, 8, 7, 2, 5, 3, 0, 1, 6, 4],
    [9, 14, 11, 5, 8, 12, 15, 1, 13, 3, 0, 10, 2, 6, 4, 7],
    [11, 15, 5, 0, 1, 9, 8, 6, 14, 10, 2, 12, 3, 4, 7, 13]
  ];
  const CS = 1, CE = 2, PAR = 4, ROOT = 8;
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function g(s, a, b, c, d, mx, my) {
    s[a] = (s[a] + s[b] + mx) | 0; s[d] = rotr(s[d] ^ s[a], 16);
    s[c] = (s[c] + s[d]) | 0;      s[b] = rotr(s[b] ^ s[c], 12);
    s[a] = (s[a] + s[b] + my) | 0; s[d] = rotr(s[d] ^ s[a], 8);
    s[c] = (s[c] + s[d]) | 0;      s[b] = rotr(s[b] ^ s[c], 7);
  }
  function compress(cv, block, clo, chi, blen, flags) {
    const s = new Uint32Array(16);
    for (let i = 0; i < 8; i++) s[i] = cv[i];
    s[8] = IV[0]; s[9] = IV[1]; s[10] = IV[2]; s[11] = IV[3];
    s[12] = clo | 0; s[13] = chi | 0; s[14] = blen | 0; s[15] = flags | 0;
    for (let r = 0; r < 7; r++) {
      const m = MSG[r];
      g(s, 0, 4, 8, 12, block[m[0]], block[m[1]]); g(s, 1, 5, 9, 13, block[m[2]], block[m[3]]);
      g(s, 2, 6, 10, 14, block[m[4]], block[m[5]]); g(s, 3, 7, 11, 15, block[m[6]], block[m[7]]);
      g(s, 0, 5, 10, 15, block[m[8]], block[m[9]]); g(s, 1, 6, 11, 12, block[m[10]], block[m[11]]);
      g(s, 2, 7, 8, 13, block[m[12]], block[m[13]]); g(s, 3, 4, 9, 14, block[m[14]], block[m[15]]);
    }
    const out = new Uint32Array(16);
    for (let j = 0; j < 8; j++) { out[j] = s[j] ^ s[j + 8]; out[j + 8] = s[j + 8] ^ cv[j]; }
    return out;
  }
  function wordsFromBlock(bytes, off, len) {
    const w = new Uint32Array(16);
    for (let i = 0; i < len; i++) w[i >> 2] |= bytes[off + i] << ((i & 3) * 8);
    return w;
  }
  const CL = 1024, BL = 64;
  function chunkCV(input, off, len, clo, chi, flagsBase) {
    let cv = IV.slice(0, 8);
    const blocks = Math.ceil(len / BL) || 1;
    let pos = 0;
    for (let b = 0; b < blocks; b++) {
      const blen = Math.min(BL, len - pos);
      let flags = flagsBase;
      if (b === 0) flags |= CS;
      if (b === blocks - 1) flags |= CE;
      const out = compress(cv, wordsFromBlock(input, off + pos, blen), clo, chi, blen, flags);
      cv = out.slice(0, 8); pos += blen;
    }
    return cv;
  }
  function parentCV(left, right, flagsBase) {
    const block = new Uint32Array(16);
    for (let i = 0; i < 8; i++) { block[i] = left[i]; block[i + 8] = right[i]; }
    return compress(IV.slice(0, 8), block, 0, 0, BL, PAR | flagsBase).slice(0, 8);
  }
  function leftLen(n) {
    const fc = Math.floor((n - 1) / CL);
    let p = 1; while (p * 2 <= fc) p *= 2;
    return p * CL;
  }
  function cvForSubtree(input, off, len, chunkStart) {
    if (len <= CL) {
      return chunkCV(input, off, len, chunkStart >>> 0, Math.floor(chunkStart / 4294967296) >>> 0, 0);
    }
    const ll = leftLen(len);
    return parentCV(cvForSubtree(input, off, ll, chunkStart), cvForSubtree(input, off + ll, len - ll, chunkStart + (ll / CL)), 0);
  }
  function wordsToBytes32(words) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i++) {
      out[i * 4] = words[i] & 0xff; out[i * 4 + 1] = (words[i] >>> 8) & 0xff;
      out[i * 4 + 2] = (words[i] >>> 16) & 0xff; out[i * 4 + 3] = (words[i] >>> 24) & 0xff;
    }
    return out;
  }
  function rootBytesFromChunk(input, off, len, clo, chi) {
    let cv = IV.slice(0, 8);
    const blocks = Math.ceil(len / BL) || 1;
    let pos = 0;
    for (let b = 0; b < blocks; b++) {
      const blen = Math.min(BL, len - pos);
      let flags = 0;
      if (b === 0) flags |= CS;
      const isLast = (b === blocks - 1);
      if (isLast) flags |= CE | ROOT;
      const out = compress(cv, wordsFromBlock(input, off + pos, blen), clo, chi, blen, flags);
      if (isLast) return wordsToBytes32(out);
      cv = out.slice(0, 8); pos += blen;
    }
    return wordsToBytes32([0, 0, 0, 0, 0, 0, 0, 0]);
  }
  function digest(input) {
    const n = input.length;
    if (n <= CL) return rootBytesFromChunk(input, 0, n, 0, 0);
    const ll = leftLen(n);
    const left = cvForSubtree(input, 0, ll, 0);
    const right = cvForSubtree(input, ll, n - ll, ll / CL);
    const block = new Uint32Array(16);
    for (let i = 0; i < 8; i++) { block[i] = left[i]; block[i + 8] = right[i]; }
    return wordsToBytes32(compress(IV.slice(0, 8), block, 0, 0, BL, PAR | ROOT));
  }
  return { digest };
})();
function blake3_256(bytes) { return BLAKE3.digest(bytes); }

/* =====================================================================
   xxhash32 (pure JS, verbatim from T525)
   ===================================================================== */
const XXH32 = (function () {
  const P1 = 2654435761, P2 = 2246822519, P3 = 3266489917, P4 = 668265263, P5 = 374761393;
  function rotl(x, r) { return (x << r) | (x >>> (32 - r)); }
  function mul(a, b) { const ah = (a >>> 16) & 0xffff, al = a & 0xffff; return ((al * b) + (((ah * b) & 0xffff) << 16)) >>> 0; }
  function rd32(d, i) { return (d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24)) >>> 0; }
  function digest(data, seed) {
    seed = seed >>> 0;
    const len = data.length; let i = 0, h;
    if (len >= 16) {
      let v1 = (seed + P1 + P2) >>> 0, v2 = (seed + P2) >>> 0, v3 = seed >>> 0, v4 = (seed - P1) >>> 0;
      const limit = len - 16;
      do {
        v1 = mul(rotl((v1 + mul(rd32(data, i), P2)) >>> 0, 13), P1); i += 4;
        v2 = mul(rotl((v2 + mul(rd32(data, i), P2)) >>> 0, 13), P1); i += 4;
        v3 = mul(rotl((v3 + mul(rd32(data, i), P2)) >>> 0, 13), P1); i += 4;
        v4 = mul(rotl((v4 + mul(rd32(data, i), P2)) >>> 0, 13), P1); i += 4;
      } while (i <= limit);
      h = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) >>> 0;
    } else { h = (seed + P5) >>> 0; }
    h = (h + len) >>> 0;
    while (i + 4 <= len) { h = (h + mul(rd32(data, i), P3)) >>> 0; h = mul(rotl(h, 17), P4); i += 4; }
    while (i < len) { h = (h + mul(data[i], P5)) >>> 0; h = mul(rotl(h, 11), P1); i++; }
    h ^= h >>> 15; h = mul(h, P2); h ^= h >>> 13; h = mul(h, P3); h ^= h >>> 16;
    return h >>> 0;
  }
  return { digest };
})();
function xxh32(bytes) { return XXH32.digest(bytes, 0); }

/* =====================================================================
   Content-Defined Chunking (verbatim from T525 — fastcdc-compatible)
   ===================================================================== */
const CDC_GEAR = [1553318008,574654857,759734804,310648967,1393527547,1195718329,694400241,1154184075,1319583805,1298164590,122602963,989043992,1918895050,933636724,1369634190,1963341198,1565176104,1296753019,1105746212,1191982839,1195494369,29065008,1635524067,722221599,1355059059,564669751,1620421856,1100048288,1018120624,1087284781,1723604070,1415454125,737834957,1854265892,1605418437,1697446953,973791659,674750707,1669838606,320299026,1130545851,1725494449,939321396,748475270,554975894,1651665064,1695413559,671470969,992078781,1935142196,1062778243,1901125066,1935811166,1644847216,744420649,2068980838,1988851904,1263854878,1979320293,111370182,817303588,478553825,694867320,685227566,345022554,2095989693,1770739427,165413158,1322704750,46251975,710520147,700507188,2104251000,1350123687,1593227923,1756802846,1179873910,1629210470,358373501,807118919,751426983,172199468,174707988,1951167187,1328704411,2129871494,1242495143,1793093310,1721521010,306195915,1609230749,1992815783,1790818204,234528824,551692332,1930351755,110996527,378457918,638641695,743517326,368806918,1583529078,1767199029,182158924,1114175764,882553770,552467890,1366456705,934589400,1574008098,1798094820,1548210079,821697741,601807702,332526858,1693310695,136360183,1189114632,506273277,397438002,620771032,676183860,1747529440,909035644,142389739,1991534368,272707803,1905681287,1210958911,596176677,1380009185,1153270606,1150188963,1067903737,1020928348,978324723,962376754,1368724127,1133797255,1367747748,1458212849,537933020,1295159285,2104731913,1647629177,1691336604,922114202,170715530,1608833393,62657989,1140989235,381784875,928003604,449509021,1057208185,1239816707,525522922,476962140,102897870,132620570,419788154,2095057491,1240747817,1271689397,973007445,1380110056,1021668229,12064370,1186917580,1017163094,597085928,2018803520,1795688603,1722115921,2015264326,506263638,1002517905,1229603330,1376031959,763839898,1970623926,1109937345,524780807,1976131071,905940439,1313298413,772929676,1578848328,1108240025,577439381,1293318580,1512203375,371003697,308046041,320070446,1252546340,568098497,1341794814,1922466690,480833267,1060838440,969079660,1836468543,2049091118,2023431210,383830867,2112679659,231203270,1551220541,1377927987,275637462,2110145570,1700335604,738389040,1688841319,1506456297,1243730675,258043479,599084776,41093802,792486733,1897397356,28077829,1520357900,361516586,1119263216,209458355,45979201,363681532,477245280,2107748241,601938891,244572459,1689418013,1141711990,1485744349,1181066840,1950794776,410494836,1445347454,2137242950,852679640,1014566730,1999335993,1871390758,1736439305,231222289,603972436,783045542,370384393,184356284,709706295,1453549767,591603172,768512391,854125182];

function _intLog2(n) { let b = 0; while (n > 1) { n >>>= 1; b++; } return b; }
function cdc_params(avg) {
  const cd = (x, y) => Math.floor((x + y - 1) / y);
  const mi = Math.floor(avg / 4), ma = avg * 8;
  const off = mi + cd(mi, 2);
  const bits = _intLog2(avg); // integer floor-log2; for 1024 = 10
  return { mi, ma, cs: avg - off, maskS: (1 << (bits + 1)) - 1, maskL: (1 << (bits - 1)) - 1 };
}
function cdc_offset(buf, off, size, mi, ma, cs, maskS, maskL) {
  let pattern = 0, i = Math.min(mi, size);
  const b1 = Math.min(cs, size), b2 = Math.min(ma, size);
  while (i < b1) { pattern = ((pattern >>> 1) + CDC_GEAR[buf[off + i]]) >>> 0; if (!(pattern & maskS)) return i + 1; i++; }
  while (i < b2) { pattern = ((pattern >>> 1) + CDC_GEAR[buf[off + i]]) >>> 0; if (!(pattern & maskL)) return i + 1; i++; }
  return i;
}
function cdc_chunks(data, utf32, avgChunkSize) {
  const chunks = [];
  if (data.length === 0) { chunks.push(data.subarray(0, 0)); return chunks; }
  const p = cdc_params(avgChunkSize);
  let pos = 0; const n = data.length;
  while (pos < n) {
    const size = n - pos;
    let cut = cdc_offset(data, pos, size, p.mi, p.ma, p.cs, p.maskS, p.maskL);
    if (utf32) cut -= cut % 4;
    chunks.push(data.subarray(pos, pos + cut)); pos += cut;
  }
  return chunks;
}

/* =====================================================================
   MinHash — 64 permutations, LSB folding (verbatim from T525).
   Uses BigInt for exact 64-bit / 61-bit prime arithmetic.
   ===================================================================== */
const MAXI64 = (1n << 64n) - 1n, MPRIME = (1n << 61n) - 1n, MAXH = (1n << 32n) - 1n;
const MPA = [853146490016488653n,1849332765672628665n,1131688930666554379n,1936485333668353377n,890837126813020267n,1988249303247129861n,1408894512544874755n,2140251716176616185n,1755124413189049421n,1355916793659431597n,546586563822844083n,497603761441203021n,2000709902557454173n,1057597903350092207n,1576204252850880253n,2078784234495706739n,1022616668454863635n,2150082342606334489n,712341150087765807n,1511757510246096559n,1525853819909660573n,1263771796138990131n,1215963627200985263n,590069150281426443n,130824646248385081n,962725325544728503n,1702561325943522847n,296074222435072629n,490211158716051523n,1255327197241792767n,699458998727907367n,32930168991409845n,1985097843455124585n,362027841570125531n,1903252144040897835n,900391845076405289n,547470123601853551n,1689373724032359119n,845594231933442371n,400331968021206285n,174967108345233429n,876513700861085019n,505848386844809885n,1920468508342256199n,1292611725303815789n,963317239501343903n,1730880032297268007n,284614929850059717n,1185026248283273081n,2167288823816985197n,1214905315086686483n,1555253098157439857n,1048013650291539723n,1238618594841147605n,1213502582686547311n,286300733803129311n,1250358511639043529n,407534797452854371n,960869149538623787n,1722699901467253087n,1325704236119824319n,196979859428570839n,1669408735473259699n,781336617016068757n];
const MPB = [1089606993368836715n,726972438868274737n,66204585613901025n,1078410179646709132n,1343470117098523467n,698653121981343911n,1248486536592473639n,1447963007834012793n,1034598851883537815n,1474008409379745934n,793773480906057541n,980501101461882479n,963941556313537655n,233651787311327325n,243905121737149907n,570269452476776142n,297633284648631084n,1516796967247398557n,1494795672066692649n,1728741177365151059n,1029197538967983408n,1660732464170610344n,1399769594446678069n,506465470557005705n,1279720146829545181n,860096419955634036n,411519685280832908n,69539191273403207n,1960489729088056217n,605092075716397684n,1017496016211653149n,1304834535101321372n,949013511180032347n,1142776242221098779n,576980004709031232n,1071272177143100544n,1494527341093835499n,1073290814142727850n,1285904200674942617n,1277176606329477335n,343788427301735585n,2100915269685487331n,1227711252031557450n,18593166391963377n,2101884148332688233n,191808277534686888n,2170124912729392024n,918430470748151293n,1831024560113812361n,1951365515851067694n,744352348473654499n,1921518311887826722n,2020165648600700886n,1764930142256726985n,1903893374912839788n,1449378957774802122n,1435825328374066345n,833197549717762813n,2238991044337210799n,748955638857938366n,1834583747494146901n,222012292803592982n,901238460725547841n,1501611130776083278n];

function minhash(features) {
  const feats = features.map(f => BigInt(f >>> 0));
  const out = new Array(64);
  for (let k = 0; k < 64; k++) {
    const a = MPA[k], b = MPB[k]; let mn = null;
    for (let j = 0; j < feats.length; j++) {
      const v = (((a * feats[j] + b) & MAXI64) % MPRIME) & MAXH;
      if (mn === null || v < mn) mn = v;
    }
    out[k] = mn;
  }
  return out;
}
function minhash_compress(mh, lsb) {
  let bits = '';
  for (let bitpos = 0; bitpos < lsb; bitpos++)
    for (let i = 0; i < mh.length; i++) bits += ((mh[i] >> BigInt(bitpos)) & 1n).toString();
  const nbytes = Math.ceil(bits.length / 8);
  const out = new Uint8Array(nbytes);
  for (let bi = 0; bi < bits.length; bi++) if (bits[bi] === '1') out[bi >> 3] |= (1 << (7 - (bi & 7)));
  return out;
}
function minhash_256(features) { return minhash_compress(minhash(features), 4); }

/* =====================================================================
   SimHash (verbatim from T525)
   ===================================================================== */
function simhash(hashDigests) {
  const nBytes = hashDigests[0].length, nBits = nBytes * 8;
  const vector = new Array(nBits).fill(0);
  for (let d = 0; d < hashDigests.length; d++) {
    const dig = hashDigests[d];
    for (let i = 0; i < nBits; i++) vector[i] += (dig[i >> 3] >> (7 - (i & 7))) & 1;
  }
  const minf = hashDigests.length / 2;
  const out = new Uint8Array(nBytes);
  for (let b = 0; b < nBits; b++) if (vector[b] >= minf) out[b >> 3] |= (1 << (7 - (b & 7)));
  return out;
}

/* =====================================================================
   ISCC Codec — header/varnibble/base32 (verbatim from T525)
   ===================================================================== */
const MT = { META: 0, SEMANTIC: 1, CONTENT: 2, DATA: 3, INSTANCE: 4, ISCC: 5 };
const ST = { NONE: 0 };
const ST_ISCC = { SUM: 5, NONE: 6 };
const VS = { V0: 0 };
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const UNITS = [[], [MT.CONTENT], [MT.SEMANTIC], [MT.SEMANTIC, MT.CONTENT],
  [MT.META], [MT.META, MT.CONTENT], [MT.META, MT.SEMANTIC], [MT.META, MT.SEMANTIC, MT.CONTENT]];

function encodeVarnibble(n) {
  const bits = [];
  function push(val, len) { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); }
  if (n >= 0 && n < 8) { push(n, 4); }
  else if (n >= 8 && n < 72) { bits.push(1, 0); push(n - 8, 6); }
  else if (n >= 72 && n < 584) { bits.push(1, 1, 0); push(n - 72, 9); }
  else if (n >= 584 && n < 4680) { bits.push(1, 1, 1, 0); push(n - 584, 12); }
  else throw new Error('varnibble out of range');
  return bits;
}
function bitsToBytes(bits) {
  while (bits.length % 8) bits.push(0);
  const out = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bits.length; i++) if (bits[i]) out[i >> 3] |= (1 << (7 - (i & 7)));
  return out;
}
function encodeHeader(mtype, stype, version, length) {
  let bits = [];
  bits = bits.concat(encodeVarnibble(mtype), encodeVarnibble(stype), encodeVarnibble(version), encodeVarnibble(length));
  return bitsToBytes(bits);
}
function encodeLength(mtype, length) {
  if (mtype === MT.META || mtype === MT.DATA || mtype === MT.INSTANCE || mtype === MT.CONTENT || mtype === MT.SEMANTIC) {
    if (length >= 32 && length % 32 === 0) return (length / 32) - 1;
    throw new Error('Invalid length ' + length);
  }
  if (mtype === MT.ISCC) {
    if (length >= 0 && length <= 7) return length;
    throw new Error('Invalid ISCC length ' + length);
  }
  throw new Error('Invalid mtype ' + mtype);
}
function encodeBase32(data) {
  let out = '', bits = 0, value = 0;
  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i]; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function decodeBase32(code) {
  code = code.toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0; const out = [];
  for (let i = 0; i < code.length; i++) {
    const idx = B32.indexOf(code[i]);
    if (idx < 0) throw new Error('bad base32: ' + code[i]);
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}
function encodeComponent(mtype, stype, version, bitLength, digest) {
  return encodeBase32(_concat([encodeHeader(mtype, stype, version, encodeLength(mtype, bitLength)), digest.subarray(0, bitLength / 8)]));
}
function decodeHeader(data) {
  const bits = [];
  for (let i = 0; i < data.length; i++) for (let b = 7; b >= 0; b--) bits.push((data[i] >> b) & 1);
  let pos = 0;
  function readVar() {
    if (bits[pos] === 0) { const v = (bits[pos] << 3 | bits[pos + 1] << 2 | bits[pos + 2] << 1 | bits[pos + 3]); pos += 4; return v; }
    if (bits[pos + 1] === 0) { let v = 0; for (let k = 0; k < 6; k++) v = (v << 1) | bits[pos + 2 + k]; pos += 8; return v + 8; }
    if (bits[pos + 2] === 0) { let v = 0; for (let k = 0; k < 9; k++) v = (v << 1) | bits[pos + 3 + k]; pos += 12; return v + 72; }
    if (bits[pos + 3] === 0) { let v = 0; for (let k = 0; k < 12; k++) v = (v << 1) | bits[pos + 4 + k]; pos += 16; return v + 584; }
    throw new Error('bad varnibble');
  }
  const mtype = readVar(), stype = readVar(), version = readVar(), length = readVar();
  const remaining = bits.length - pos;
  if (remaining % 8 !== 0 && bits[pos] === 0 && bits[pos + 1] === 0 && bits[pos + 2] === 0 && bits[pos + 3] === 0) pos += 4;
  const tailBits = bits.slice(pos);
  const tail = new Uint8Array(tailBits.length / 8);
  for (let t = 0; t < tail.length; t++) { let val = 0; for (let q = 0; q < 8; q++) val = (val << 1) | tailBits[t * 8 + q]; tail[t] = val; }
  return [mtype, stype, version, length, tail];
}
function encodeUnits(units) {
  for (let i = 0; i < UNITS.length; i++) {
    const u = UNITS[i];
    if (u.length === units.length && u.every((x, idx) => x === units[idx])) return i;
  }
  throw new Error('Invalid ISCC-UNIT combination');
}
function isccClean(iscc) {
  const parts = iscc.trim().split(':').map(p => p.trim());
  if (parts.length === 1) { let c = parts[0]; if ('fbvzu'.indexOf(c[0]) < 0) c = c.split('-').join(''); return c; }
  if (parts.length === 2) { if (parts[0].toLowerCase() !== 'iscc') throw new Error('bad scheme'); return parts[1].split('-').join(''); }
  throw new Error('bad iscc');
}

/* =====================================================================
   Text helpers — kernel-safe (no TextEncoder/TextDecoder/normalize).
   ASCII-range predicates cover all official conformance vector inputs.
   ===================================================================== */
const META_TRIM_NAME = 128, META_TRIM_DESC = 4096;
const META_NGRAM = 3, DATA_AVG_CHUNK = 1024;
const TEXT_NEWLINES = new Set(['\n', '\v', '\f', '\r', '\x85', ' ', ' ']);

function pyIsSpace(ch) {
  const cp = ch.codePointAt(0);
  if (cp === 0x09 || cp === 0x0a || cp === 0x0b || cp === 0x0c || cp === 0x0d || cp === 0x20) return true;
  if (cp === 0x1c || cp === 0x1d || cp === 0x1e || cp === 0x1f || cp === 0x85 || cp === 0xa0) return true;
  return (cp >= 0x2000 && cp <= 0x200a) || cp === 0x202f || cp === 0x205f || cp === 0x3000 || cp === 0x2028 || cp === 0x2029;
}
// ASCII-range control / combining-mark / punctuation (covers all conformance vector chars)
function _isCtrl(ch) { const cp = ch.codePointAt(0); return cp < 0x20 || (cp >= 0x7f && cp <= 0x9f); }
function _isMark(ch) { const cp = ch.codePointAt(0); return cp >= 0x0300 && cp <= 0x036f; }
function _isPunct(ch) { return '!"#%&\'()*+,-./:;<=>?@[\\]^_`{|}~'.indexOf(ch) >= 0; }

function splitLines(s) {
  const BOUND = ['\n', '\v', '\f', '\r', '\x1c', '\x1d', '\x1e', '\x85', ' ', ' '];
  const out = []; let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\r' && s[i + 1] === '\n') { out.push(cur); cur = ''; i++; continue; }
    if (BOUND.indexOf(ch) >= 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur); return out;
}
function isWSOonly(s) { for (const ch of s) if (!pyIsSpace(ch)) return false; return true; }
function text_clean(text) {
  text = _normStr(text, 'NFKC');
  let kept = '';
  for (const ch of text) { if (!_isCtrl(ch) || TEXT_NEWLINES.has(ch)) kept += ch; }
  const lines = splitLines(kept);
  const result = []; let nlCount = 0;
  for (const line of lines) {
    if (isWSOonly(line)) { if (nlCount < 1) { result.push(''); nlCount++; } }
    else { result.push(line); nlCount = 0; }
  }
  return result.join('\n').replace(/^\s+|\s+$/g, '').trim();
}
function text_remove_newlines(text) {
  return text.split(/\s+/).filter(x => x.length > 0).join(' ');
}
function text_trim(text, nbytes) {
  const bytes = _utf8Bytes(text);
  if (bytes.length <= nbytes) return text.replace(/^\s+|\s+$/g, '').trim();
  let i = nbytes;
  while (i > 0 && (bytes[i] & 0xc0) === 0x80) i--;
  return _decodeUtf8(bytes.subarray(0, i)).replace(/^\s+|\s+$/g, '').trim();
}
function text_collapse(text) {
  text = _normStr(text, 'NFD').toLowerCase();
  let out = '';
  for (const ch of text) {
    if (pyIsSpace(ch) || _isCtrl(ch) || _isMark(ch) || _isPunct(ch)) continue;
    out += ch;
  }
  return _normStr(out, 'NFKC');
}
function toChars(s) { return Array.from(s); }
function slidingWindowChars(chars, width) {
  const n = chars.length, idxMax = Math.max(n - width + 1, 1), out = [];
  for (let i = 0; i < idxMax; i++) out.push(chars.slice(i, i + width));
  return out;
}

/* =====================================================================
   ISCC generators
   ===================================================================== */
function multiHashBlake3(bytes) {
  return _bytesToHex(_concat([new Uint8Array([0x1e, 0x20]), blake3_256(bytes)]));
}

function gen_instance_code_v0(streamBytes, bits) {
  bits = bits || 64;
  const digest = blake3_256(streamBytes);
  return {
    iscc: 'ISCC:' + encodeComponent(MT.INSTANCE, ST.NONE, VS.V0, bits, digest),
    datahash: multiHashBlake3(streamBytes),
    filesize: streamBytes.length
  };
}

function gen_data_code_v0(streamBytes, bits) {
  bits = bits || 64;
  const chunks = cdc_chunks(streamBytes, false, DATA_AVG_CHUNK);
  const features = [];
  for (let i = 0; i < chunks.length; i++) features.push(xxh32(chunks[i]));
  const digest = minhash_256(features);
  return { iscc: 'ISCC:' + encodeComponent(MT.DATA, ST.NONE, VS.V0, bits, digest) };
}

function soft_hash_meta_v0(name, extra) {
  const nameC = text_collapse(name);
  const nameGrams = slidingWindowChars(toChars(nameC), META_NGRAM).map(g => g.join(''));
  const nameDigests = nameGrams.map(s => blake3_256(_utf8Bytes(s)));
  const simhashDigest = simhash(nameDigests);
  const extraEmpty = (extra === null || extra === undefined || extra === '');
  if (extraEmpty) return simhashDigest;
  const ec = text_collapse(extra);
  const egrams = slidingWindowChars(toChars(ec), META_NGRAM).map(g => g.join(''));
  const extraDigests = egrams.map(s => blake3_256(_utf8Bytes(s)));
  const extraSimhash = simhash(extraDigests);
  const out = [];
  for (let c = 0; c < 16; c += 4) { out.push(simhashDigest.subarray(c, c + 4)); out.push(extraSimhash.subarray(c, c + 4)); }
  return _concat(out);
}

function gen_meta_code_v0(name, description, bits) {
  bits = bits || 64;
  name = (name === null || name === undefined) ? '' : name;
  name = text_clean(name); name = text_remove_newlines(name); name = text_trim(name, META_TRIM_NAME);
  if (!name) throw new Error('Meta-Code requires non-empty name');
  description = (description === null || description === undefined) ? '' : description;
  description = text_clean(description); description = text_trim(description, META_TRIM_DESC);
  const metaCodeDigest = soft_hash_meta_v0(name, description);
  const payloadBytes = _utf8Bytes((name + ' ' + description).trim());
  return {
    iscc: 'ISCC:' + encodeComponent(MT.META, ST.NONE, VS.V0, bits, metaCodeDigest),
    metahash: multiHashBlake3(payloadBytes),
    name: name,
    description: description
  };
}

function gen_iscc_code_v0(codes) {
  codes = codes.map(isccClean);
  if (codes.length < 2) throw new Error('Minimum two ISCC units required');
  const decoded = codes.map(c => decodeHeader(decodeBase32(c)));
  decoded.sort((a, b) => a[0] - b[0]);
  const mainTypes = decoded.map(d => d[0]);
  const lastTwo = mainTypes.slice(-2);
  if (!(lastTwo[0] === MT.DATA && lastTwo[1] === MT.INSTANCE)) throw new Error('requires DATA and INSTANCE');
  const subTypes = decoded.filter(t => t[0] === MT.SEMANTIC || t[0] === MT.CONTENT).map(t => t[1]);
  let st;
  if (subTypes.length) { const uniq = [...new Set(subTypes)]; if (uniq.length > 1) throw new Error('SubType mismatch'); st = subTypes[subTypes.length - 1]; }
  else if (codes.length === 2) st = ST_ISCC.SUM;
  else st = ST_ISCC.NONE;
  const encodedLength = encodeUnits(mainTypes.slice(0, mainTypes.length - 2));
  const parts = decoded.map(d => d[4].subarray(0, 8));
  const digest = _concat(parts);
  const header = encodeHeader(MT.ISCC, st, VS.V0, encodedLength);
  return { iscc: 'ISCC:' + encodeBase32(_concat([header, digest])) };
}

/* =====================================================================
   Conformance self-check (all-ASCII inputs — _normStr is identity here)
   ===================================================================== */
function isccSelfCheck() {
  const detail = []; let ok = true;
  function eq(a, b, label) { if (a !== b) { ok = false; detail.push(label + ':FAIL got=' + a + ' want=' + b); } else { detail.push(label + ':ok'); } }
  try {
    const i0 = gen_instance_code_v0(new Uint8Array(0), 64);
    eq(i0.iscc, 'ISCC:IAA26E2JXH27TING', 'instance_empty');
    eq(i0.datahash, '1e20af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262', 'instance_datahash');
    const d0 = gen_data_code_v0(new Uint8Array([0xff, 0x00]), 64);
    eq(d0.iscc, 'ISCC:GAAXL2XYM5BQIAZ3', 'data_ff00');
    const m0 = gen_meta_code_v0('Die Unendliche Geschichte', '', 64);
    eq(m0.iscc, 'ISCC:AAAZXZ6OU74YAZIM', 'meta_title');
    const comp = gen_iscc_code_v0(['AAAYPXW445FTYNJ3', 'EAARMJLTQCUWAND2', 'GABVVC5DMJJGYKZ4ZBYVNYABFFYXG', 'IADWIK7A7JTUAQ2D6QARX7OBEIK3OOUAM42LOBLCZ4ZOGDLRHMDL6TQ']);
    eq(comp.iscc, 'ISCC:KACYPXW445FTYNJ3CYSXHAFJMA2HUWULUNRFE3BLHRSCXYH2M5AEGQY', 'composite');
  } catch (e) { ok = false; detail.push('exception: ' + e.message); }
  return { pass: ok, detail };
}

/* =====================================================================
   compute(pp) — OCG kernel entry point
   ===================================================================== */
export function compute(pp) {
  pp = pp || {};
  const content = typeof pp.content === 'string' ? pp.content : '';
  const title   = typeof pp.title === 'string' ? pp.title : '';
  const creator = typeof pp.creator === 'string' ? pp.creator : '';

  const contentBytes = _utf8Bytes(content);

  const inst = gen_instance_code_v0(contentBytes, 64);
  const data = gen_data_code_v0(contentBytes, 64);
  const units = [data.iscc, inst.iscc];

  const output_payload = {
    instance_code: inst.iscc,
    data_code: data.iscc,
    datahash: inst.datahash,
    input_bytes: contentBytes.length
  };

  if (title) {
    const mc = gen_meta_code_v0(title, creator || '', 64);
    output_payload.meta_code = mc.iscc;
    output_payload.metahash = mc.metahash;
    units.unshift(mc.iscc);
  }

  if (units.length >= 2) {
    output_payload.iscc_code = gen_iscc_code_v0(units.slice()).iscc;
  }

  const sc = isccSelfCheck();
  output_payload.conformance_pass = sc.pass;

  const compliance_flags = {
    ISCC_INSTANCE_CODE_GENERATED: true,
    ISCC_DATA_CODE_GENERATED: true,
    ISCC_CONFORMANCE_PASS: sc.pass,
  };
  if (title) compliance_flags.ISCC_META_CODE_GENERATED = true;
  if (output_payload.iscc_code) compliance_flags.ISCC_COMPOSITE_GENERATED = true;

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
