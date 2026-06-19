// fix-hash-scheme.mjs — detect and remediate execution_hash canonicalization
// across every live ChainGraph node, converting Schemes A/C/D to the single
// RFC 8785/JCS-aligned scheme (recursive key sort + real SHA-256).
//
// SAFE BY DEFAULT. Dry-run unless --apply is passed. Scheme A (the 50-file
// array-replacer bug) is auto-fixed with a surgical, idempotent expression swap.
// Schemes C (fake simpleHash) and D (shallow manual sort) are REPORTED with a
// proposed edit but NOT auto-applied — they change call-site/async shape and
// need a human glance (the audit's ~18-tool tail).
//
// Usage:
//   node repo/chaingraph/kernels/fix-hash-scheme.mjs            # dry-run, full report
//   node repo/chaingraph/kernels/fix-hash-scheme.mjs --apply    # apply Scheme A fixes in place
//   node repo/chaingraph/kernels/fix-hash-scheme.mjs --json     # machine-readable report
//
// Re-runnable: a fixed file is detected as Scheme B and skipped.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');            // .../repo
const CHAINGRAPH_JSON = resolve(REPO, 'chaingraph', 'chaingraph.json');
const APPLY = process.argv.includes('--apply');
const JSON_OUT = process.argv.includes('--json');

// The canonical helpers injected into a tool that lacks them. Minified, JCS-aligned,
// byte-equivalent to kernels/_hash.mjs and worker.mjs cgCanon. Marker comment lets
// us detect prior injection (idempotency) and lets the forbidden-pattern lint allow it.
const OCG_MARK = '/* OCG-CANON v1 — managed by fix-hash-scheme.mjs; RFC 8785/JCS (I-JSON). DO NOT hand-edit. */';
const OCG_BLOCK = `${OCG_MARK}
function __ocgCanon(v){return Array.isArray(v)?v.map(__ocgCanon):(v&&typeof v==='object')?Object.keys(v).sort().reduce((o,k)=>(o[k]=__ocgCanon(v[k]),o),{}):v;}
function __ocgAssertIJson(v){if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('OCG: non-finite number is not I-JSON');if(Number.isInteger(v)&&!Number.isSafeInteger(v))throw new Error('OCG: integer exceeds 2^53; pass as string');}else if(Array.isArray(v)){v.forEach(__ocgAssertIJson);}else if(v&&typeof v==='object'){for(const k of Object.keys(v))__ocgAssertIJson(v[k]);}}
function __ocgCanonStr(x){__ocgAssertIJson(x);return JSON.stringify(__ocgCanon(x));}
async function __ocgHash(policy_parameters,output_payload){const b=new TextEncoder().encode(__ocgCanonStr({policy_parameters,output_payload}));const h=await crypto.subtle.digest('SHA-256',b);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join('');}`;

// Scheme A signature: the array-replacer expression. Tolerant of the identifier name.
const SCHEME_A_RE = /JSON\.stringify\(\s*([A-Za-z_$][\w$]*)\s*,\s*Object\.keys\(\s*\1\s*\)\.sort\(\)\s*\)/g;
const SCHEME_C_RE = /function\s+simpleHash\s*\(/;
const SCHEME_D_RE = /\bsortedObj\b|\bfunction\s+computeHash\s*\(/;
const SCHEME_B_RE = /\bcgCanon\b|__ocgCanonStr/;

function nodeFiles() {
  const cg = JSON.parse(readFileSync(CHAINGRAPH_JSON, 'utf8'));
  const out = [];
  for (const n of (cg.nodes ?? [])) {
    if (n.status !== 'live') continue;
    let rel;
    try { rel = new URL(n.url).pathname.replace(/^\//, ''); } // chaingraph/x.html or tools/x.html
    catch { rel = `chaingraph/${n.tool_id}.html`; }
    const abs = resolve(REPO, rel);
    out.push({ tool_id: n.tool_id, gpu: !!n.gpu, file: abs, exists: existsSync(abs) });
  }
  return out;
}

function classify(src) {
  if (SCHEME_B_RE.test(src)) return 'B'; // already canonical / already fixed
  if (SCHEME_C_RE.test(src)) return 'C';
  if (SCHEME_A_RE.test(src)) { SCHEME_A_RE.lastIndex = 0; return 'A'; }
  if (SCHEME_D_RE.test(src)) return 'D';
  return 'UNKNOWN';
}

// Surgical Scheme-A fix: swap every array-replacer expression for __ocgCanonStr(<id>)
// and inject the helper block once (before the first <script> body close or end of file).
function fixSchemeA(src) {
  let count = 0;
  let out = src.replace(SCHEME_A_RE, (_, id) => { count++; return `__ocgCanonStr(${id})`; });
  if (count === 0) return { changed: false, count: 0, out: src };
  if (!out.includes(OCG_MARK)) {
    // inject helpers just before the last </script> (kept inside the tool's own script scope)
    const idx = out.lastIndexOf('</script>');
    out = idx >= 0 ? out.slice(0, idx) + `\n${OCG_BLOCK}\n` + out.slice(idx) : out + `\n<script>\n${OCG_BLOCK}\n</script>\n`;
  }
  return { changed: true, count, out };
}

const files = nodeFiles();
const report = { generated_at: new Date().toISOString(), apply: APPLY, counts: {}, rows: [] };
const tally = (s) => (report.counts[s] = (report.counts[s] || 0) + 1);

for (const f of files) {
  if (!f.exists) { report.rows.push({ ...f, scheme: 'MISSING', action: 'file not found at node.url path' }); tally('MISSING'); continue; }
  const src = readFileSync(f.file, 'utf8');
  const scheme = classify(src);
  let action = '';
  if (scheme === 'B') action = 'already canonical — skip';
  else if (scheme === 'A') {
    const r = fixSchemeA(src);
    action = `AUTO-FIX: swap ${r.count} array-replacer expr -> __ocgCanonStr + inject helpers`;
    if (APPLY && r.changed) { writeFileSync(f.file, r.out); action += ' [APPLIED]'; }
    else if (r.changed) action += ' [dry-run]';
  } else if (scheme === 'C') action = 'REVIEW: replace simpleHash() with await __ocgHash(pp,op); make caller async; verify pp includes inputs (Bug 3)';
  else if (scheme === 'D') action = 'REVIEW: replace shallow sortedObj canonicalization with __ocgCanonStr; confirm policy_parameters is included (Bug 2)';
  else action = 'MANUAL: no known hash scheme detected — inspect by hand';
  tally(scheme);
  report.rows.push({ tool_id: f.tool_id, gpu: f.gpu, scheme, action });
}

if (JSON_OUT) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }

console.log(`\n# execution_hash remediation — ${APPLY ? 'APPLY' : 'DRY-RUN'} — ${report.generated_at}\n`);
const order = { A: 0, C: 1, D: 2, UNKNOWN: 3, MISSING: 4, B: 5 };
for (const r of report.rows.sort((a, b) => (order[a.scheme] - order[b.scheme]) || a.tool_id.localeCompare(b.tool_id))) {
  console.log(`  [${r.scheme}] ${r.tool_id}${r.gpu ? ' (gpu)' : ''}\n        ${r.action}`);
}
console.log('\n# Summary');
for (const [k, v] of Object.entries(report.counts)) console.log(`  Scheme ${k}: ${v}`);
console.log(`\n  A = auto-fixed (run with --apply). C/D = review tail. B = clean. ` +
  `After --apply, run the forbidden-pattern lint and the golden parity tests.\n`);
