// check-engine-parity.mjs — cross-engine compute() output parity runner.
//
// WHY: OCG execution_hash values must be byte-identical whether compute() runs
// in V8 (Node/Bun), QuickJS-ng (the §18 zkVM guest), or any other ECMA-262
// host. This runner verifies it. Divergence = a finding for the kernel owner.
//
// WHAT IT DOES:
//   For every gpu:false kernel that has a fixture file, it calls compute(pp)
//   for each fixture vector, canonicalizes the output_payload via cgCanon,
//   SHA-256s the canonical JSON string (pure-JS, no WebCrypto), and writes a
//   manifest { kernelId: { vectorName: hexDigest } } to stdout or --out FILE.
//
//   The CI job (cross-engine-parity.yml) runs this on Node, Bun, and QuickJS-ng
//   and diffs the three manifests byte-for-byte. Any difference is reported as
//   a finding — the kernel owner decides whether it is acceptable and, if so,
//   whether the §18 guest needs re-pinning.
//
// MODES:
//   node scripts/check-engine-parity.mjs               → manifest to stdout
//   node scripts/check-engine-parity.mjs --out FILE    → manifest to file
//   node scripts/check-engine-parity.mjs --bundle FILE → self-contained
//       bundle for QuickJS-ng qjs (no file I/O, no imports at runtime)
//
// SHA-256: pure-JS, no node:crypto, no WebCrypto — identical result in all engines.
// cgCanon: inlined from _hash.mjs (no import needed, pure ECMA-262).

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KERNELS_DIR = resolve(REPO, 'chaingraph', 'kernels');
const FIXTURES_DIR = resolve(KERNELS_DIR, 'fixtures');

// --- Inline cgCanon (verbatim from _hash.mjs — must stay in sync) ---
const cgCanon = (v) =>
  Array.isArray(v) ? v.map(cgCanon)
  : (v && typeof v === 'object')
    ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {})
    : v;

// --- Pure-JS SHA-256 (no WebCrypto / no node:crypto — works in any ECMA-262 engine) ---
function sha256hex(str) {
  // UTF-8 encode the input string
  const bytes = [];
  for (let i = 0; i < str.length; ) {
    const cp = str.codePointAt(i);
    if (cp < 0x80) { bytes.push(cp); i++; }
    else if (cp < 0x800) { bytes.push(0xC0 | (cp >> 6), 0x80 | (cp & 63)); i++; }
    else if (cp < 0x10000) { bytes.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)); i++; }
    else { bytes.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)); i += 2; }
  }
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  let [h0,h1,h2,h3,h4,h5,h6,h7] = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const L = bytes.length;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const bl = L * 8;
  bytes.push(0, 0, 0, 0, (bl >>> 24) & 0xFF, (bl >>> 16) & 0xFF, (bl >>> 8) & 0xFF, bl & 0xFF);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < bytes.length; i += 64) {
    const w = new Array(64);
    for (let j = 0; j < 16; j++) w[j] = (bytes[i+j*4]<<24)|(bytes[i+j*4+1]<<16)|(bytes[i+j*4+2]<<8)|bytes[i+j*4+3];
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j-15],7) ^ rotr(w[j-15],18) ^ (w[j-15] >>> 3);
      const s1 = rotr(w[j-2],17) ^ rotr(w[j-2],19) ^ (w[j-2] >>> 10);
      w[j] = (w[j-16] + s0 + w[j-7] + s1) | 0;
    }
    let [a,b,c,d,e,f,g,h] = [h0,h1,h2,h3,h4,h5,h6,h7];
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[j] + w[j]) | 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      [a,b,c,d,e,f,g,h] = [(t1+t2)|0, a, b, c, (d+t1)|0, e, f, g];
    }
    h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0;
    h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+h)|0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map(x => (x>>>0).toString(16).padStart(8,'0')).join('');
}

// --- Canonical preimage: { policy_parameters, output_payload } sorted recursively ---
function preimage(pp, output_payload) {
  return JSON.stringify(cgCanon({ output_payload, policy_parameters: pp }));
}

// --- Argument parsing ---
const argv = process.argv.slice(2);
const bundleIdx = argv.indexOf('--bundle');
const bundleFile = bundleIdx !== -1 ? argv[bundleIdx + 1] : null;
const outIdx = argv.indexOf('--out');
const outFile = outIdx !== -1 ? argv[outIdx + 1] : null;

// --- Fixture iterator ---
function* iterFixtures() {
  for (const f of readdirSync(FIXTURES_DIR).sort()) {
    if (!f.endsWith('.fixtures.json')) continue;
    const kernelId = f.replace('.fixtures.json', '');
    const kernelPath = resolve(KERNELS_DIR, kernelId + '.kernel.mjs');
    if (!existsSync(kernelPath)) continue;
    const vectors = JSON.parse(readFileSync(resolve(FIXTURES_DIR, f), 'utf8'));
    yield { kernelId, kernelPath, vectors };
  }
}

// ============================================================================
// BUNDLE MODE — generate a self-contained JS file for QuickJS-ng qjs.
// The bundle has NO imports at runtime: kernel source is inlined (with imports
// stripped and export keywords removed), fixtures are embedded as JSON, and
// sha256hex + cgCanon are included verbatim. Output: manifest JSON to stdout.
// ============================================================================
if (bundleFile) {
  const lines = [];
  lines.push('/* AUTO-GENERATED by check-engine-parity.mjs --bundle — DO NOT EDIT */');
  lines.push('/* Run: qjs <this-file> */');
  lines.push('');

  // Inline sha256hex (copy the source exactly — must stay in sync with above)
  lines.push('function sha256hex(str) {');
  lines.push('  const bytes = [];');
  lines.push('  for (let i = 0; i < str.length; ) {');
  lines.push('    const cp = str.codePointAt(i);');
  lines.push('    if (cp < 0x80) { bytes.push(cp); i++; }');
  lines.push('    else if (cp < 0x800) { bytes.push(0xC0|(cp>>6),0x80|(cp&63)); i++; }');
  lines.push('    else if (cp < 0x10000) { bytes.push(0xE0|(cp>>12),0x80|((cp>>6)&63),0x80|(cp&63)); i++; }');
  lines.push('    else { bytes.push(0xF0|(cp>>18),0x80|((cp>>12)&63),0x80|((cp>>6)&63),0x80|(cp&63)); i+=2; }');
  lines.push('  }');
  lines.push('  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];');
  lines.push('  let [h0,h1,h2,h3,h4,h5,h6,h7]=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];');
  lines.push('  const L=bytes.length; bytes.push(0x80);');
  lines.push('  while((bytes.length%64)!==56)bytes.push(0);');
  lines.push('  const bl=L*8; bytes.push(0,0,0,0,(bl>>>24)&0xFF,(bl>>>16)&0xFF,(bl>>>8)&0xFF,bl&0xFF);');
  lines.push('  const rotr=(x,n)=>(x>>>n)|(x<<(32-n));');
  lines.push('  for(let i=0;i<bytes.length;i+=64){');
  lines.push('    const w=new Array(64);');
  lines.push('    for(let j=0;j<16;j++)w[j]=(bytes[i+j*4]<<24)|(bytes[i+j*4+1]<<16)|(bytes[i+j*4+2]<<8)|bytes[i+j*4+3];');
  lines.push('    for(let j=16;j<64;j++){const s0=rotr(w[j-15],7)^rotr(w[j-15],18)^(w[j-15]>>>3);const s1=rotr(w[j-2],17)^rotr(w[j-2],19)^(w[j-2]>>>10);w[j]=(w[j-16]+s0+w[j-7]+s1)|0;}');
  lines.push('    let[a,b,c,d,e,f,g,h]=[h0,h1,h2,h3,h4,h5,h6,h7];');
  lines.push('    for(let j=0;j<64;j++){const S1=rotr(e,6)^rotr(e,11)^rotr(e,25);const ch=(e&f)^(~e&g);const t1=(h+S1+ch+K[j]+w[j])|0;const S0=rotr(a,2)^rotr(a,13)^rotr(a,22);const maj=(a&b)^(a&c)^(b&c);const t2=(S0+maj)|0;[a,b,c,d,e,f,g,h]=[(t1+t2)|0,a,b,c,(d+t1)|0,e,f,g];}');
  lines.push('    h0=(h0+a)|0;h1=(h1+b)|0;h2=(h2+c)|0;h3=(h3+d)|0;h4=(h4+e)|0;h5=(h5+f)|0;h6=(h6+g)|0;h7=(h7+h)|0;');
  lines.push('  }');
  lines.push('  return[h0,h1,h2,h3,h4,h5,h6,h7].map(x=>(x>>>0).toString(16).padStart(8,"0")).join("");');
  lines.push('}');
  lines.push('');

  // Inline cgCanon
  lines.push('const cgCanon=(v)=>Array.isArray(v)?v.map(cgCanon):(v&&typeof v==="object")?Object.keys(v).sort().reduce((o,k)=>(o[k]=cgCanon(v[k]),o),{}):v;');
  lines.push('function preimage(pp,op){return JSON.stringify(cgCanon({output_payload:op,policy_parameters:pp}));}');
  lines.push('');
  lines.push('const MANIFEST = {};');
  lines.push('');

  // Inline each kernel's compute() region + fixtures
  for (const { kernelId, kernelPath, vectors } of iterFixtures()) {
    const src = readFileSync(kernelPath, 'utf8');

    // Extract the region before buildArtifact (helpers + compute)
    const baPos = src.search(/\nexport\s+async\s+function\s+buildArtifact\b/);
    const region = (baPos > 0 ? src.slice(0, baPos) : src)
      .replace(/^import\s.*$/gm, '')                                    // strip imports
      .replace(/^export\s+((?:async\s+)?function)\s+/gm, '$1 ')        // strip export from functions
      .replace(/^export\s+(const|let|var)\s+/gm, '$1 ');               // strip export from consts

    const safeId = kernelId.replace(/-/g, '_');
    lines.push(`// ── ${kernelId} ──`);
    lines.push(`const _compute_${safeId} = (function(){`);
    lines.push(region);
    lines.push(`  return compute;`);
    lines.push(`})();`);
    lines.push(`{`);
    lines.push(`  const _v = ${JSON.stringify(vectors)};`);
    lines.push(`  MANIFEST[${JSON.stringify(kernelId)}] = {};`);
    lines.push(`  for (const [vname, vdata] of Object.entries(_v)) {`);
    lines.push(`    const pp = vdata.policy_parameters ?? {};`);
    lines.push(`    const result = _compute_${safeId}(pp);`);
    lines.push(`    const op = result && result.output_payload !== undefined ? result.output_payload : result;`);
    lines.push(`    MANIFEST[${JSON.stringify(kernelId)}][vname] = sha256hex(preimage(pp, op));`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');
  }

  lines.push('console.log(JSON.stringify(MANIFEST, null, 2));');

  writeFileSync(bundleFile, lines.join('\n'));
  console.log(`Bundle written to ${bundleFile} (${lines.length} lines)`);
  process.exit(0);
}

// ============================================================================
// NORMAL MODE — Node.js / Bun: dynamic-import each kernel, run fixtures.
// ============================================================================
const MANIFEST = {};

for (const { kernelId, kernelPath, vectors } of iterFixtures()) {
  let computeFn;
  try {
    const mod = await import(pathToFileURL(kernelPath).href);
    computeFn = mod.compute;
    if (typeof computeFn !== 'function') throw new Error('no export named compute');
  } catch (e) {
    console.error(`  ✗ ${kernelId}: import failed — ${e.message}`);
    process.exit(1);
  }

  MANIFEST[kernelId] = {};
  for (const [vname, vdata] of Object.entries(vectors)) {
    const pp = vdata.policy_parameters ?? {};
    let result;
    try {
      result = computeFn(pp);
      // buildArtifact returns a Promise (async); compute returns a plain object
      if (result && typeof result.then === 'function') result = await result;
    } catch (e) {
      console.error(`  ✗ ${kernelId}/${vname}: compute() threw — ${e.message}`);
      process.exit(1);
    }
    const op = (result && result.output_payload !== undefined) ? result.output_payload : result;
    MANIFEST[kernelId][vname] = sha256hex(preimage(pp, op));
  }
}

const json = JSON.stringify(MANIFEST, null, 2);
if (outFile) {
  writeFileSync(outFile, json);
} else {
  process.stdout.write(json + '\n');
}
