// @ts-nocheck — plain CLI utility script, never meant to be type-checked; only
// swept into tsc --checkJs's program because it lives under chaingraph/kernels/
// and this edit makes it "touched" (JSDOC-CHECKJS-PREFLIGHT-1's own path filter,
// landed 2026-08-16, watches the whole directory, not just *.kernel.mjs). Without
// this it fails on bare node:fs/process usage — a directory-wide @types/node gap
// (SO #47's exemption only reaches chaingraph/kernels/__proptests__/) that would
// block ANY future edit to any of the ~40 non-kernel .mjs scripts in this
// directory, not something specific to this file's own logic.
// lint-forbidden-hash.mjs — CI/pre-deploy guard. Fails (exit 1) if any live
// ChainGraph tool reintroduces a non-canonical hashing pattern. This is the
// regression gate: once the suite is on the single OCG canonical scheme, this
// keeps it there. Wire into verify_repo.py and CI.
//
// Usage: node repo/chaingraph/kernels/lint-forbidden-hash.mjs
//
// Best-practice basis: a non-deterministic / mislabeled hash must never ship in
// a product whose value proposition is verifiable hashing. Cheapest possible
// guard = ban the byte-patterns that produced Schemes A and C.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));

// --only <tool-id>: KERNEL-PREFLIGHT-1 scope to ONE node (whole-estate run is unchanged
// when this flag is absent). A shard not yet assembled into chaingraph.json (PENDING-ASSEMBLE,
// per RIDER-KERNEL) has no entry here yet — that is reported, not a lint failure.
const onlyIdx = process.argv.indexOf('--only');
const ONLY_ID = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;

// Banned patterns -> human reason. The OCG-CANON marker block is explicitly allowed.
// NOTE: a literal "sha256:" prefix is a LEGITIMATE OCG convention (the spec emits
// execution_hash as "sha256:"+hex, and the verifier normalizes it), so it is NOT
// banned. We ban only the two patterns that produce a WRONG hash.
const BANNED = [
  // Scheme A (array-replacer): JSON.stringify(<anything>, Object.keys(<anything>).sort()) — the 2nd arg is a
  // recursive-property allowlist, NOT a sort, so it collapses nested data into an input-independent hash.
  // Broadened 2026-06-21 to catch the inline-object form `JSON.stringify({...a,...b}, Object.keys({...a,...b}).sort())`
  // (the cry-04 variant the identifier-only regex missed). There is no legitimate use of Object.keys().sort()
  // as a JSON.stringify replacer — canonical OCG serializes through jcsStringify (kernels/_hash.mjs), which
  // sorts member names by UTF-16 code unit and builds the string directly (JCS-CANON-FIX-1).
  { re: /JSON\.stringify\([\s\S]{0,200}?,\s*Object\.keys\([\s\S]{0,160}?\)\.sort\(\)\s*\)/, why: 'Scheme A: array-replacer collapses nested data (input-independent hash). Use jcsStringify/_hash.mjs: jcsStringify({policy_parameters, output_payload}).' },
  { re: /function\s+simpleHash\s*\(/, why: 'Scheme C: simpleHash is a 32-bit FNV mislabeled "sha256:". Not SHA-256. Use real crypto.subtle SHA-256 via __ocgHash.' },
  // Scheme E (no canon): JSON.stringify({policy_parameters, output_payload}) hashed WITHOUT a recursive
  // key-sort — the cry-04/Wave-16-17 class (added 2026-06-21). A direct object-literal preimage starting
  // with policy_parameters means the page hashes unsorted JSON, so its hash won't match the canonical
  // kernel (the shared canonicalizer sorts recursively). The canonical form is jcsStringify({...})
  // from kernels/_hash.mjs, so this only fires on the unwrapped (wrong) form. Export
  // blobs are unaffected (they start with mandate_type/spread, not policy_parameters).
  { re: /JSON\.stringify\(\s*\{\s*policy_parameters\b/, why: 'Scheme E: non-canonical preimage — {policy_parameters, output_payload} hashed without recursive key-sort. Hash through jcsStringify (kernels/_hash.mjs) instead.' },
];

let violations = 0;
let matchedOnly = false;
for (const n of (cg.nodes ?? [])) {
  if (ONLY_ID && n.tool_id !== ONLY_ID) continue;
  if (ONLY_ID) matchedOnly = true;
  if (n.status !== 'live') continue;
  let rel; try { rel = new URL(n.url).pathname.replace(/^\//, ''); } catch { rel = `chaingraph/${n.tool_id}.html`; }
  const abs = resolve(REPO, rel);
  if (!existsSync(abs)) continue;
  const src = readFileSync(abs, 'utf8');
  for (const b of BANNED) {
    if (b.re.test(src)) {
      console.error(`✗ ${n.tool_id}\n    ${b.why}`);
      violations++;
    }
  }
}

// ── Non-kernel MODULE rule (JCS-CANON-FIX-1) ────────────────────────────────────────
// The §4/§PPH-1 hash paths moved to jcsStringify (kernels/_hash.mjs), which is RFC 8785
// §3.2.3-exact for array-index member names: it orders member names by UTF-16 code unit
// and builds the string directly instead of through a sorted intermediate object. A
// non-kernel module must not hash through the legacy JSON.stringify(cgCanon(...)) wrap,
// so the old enumeration-order-dependent path cannot creep back.
// Exempt: kernel sources (*.kernel.mjs — byte-frozen by design, zero-re-proof), the
// __proptests__ directory (mirrors kernel behaviour byte-for-byte), this lint file
// itself (its strings document the banned forms), and every non-module file (pages'
// inline canonicalizers are JCS-CANON-PAGES-1's scope, policed by its own gates).
function walkModules(dir) {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = resolve(dir, e.name);
    if (e.isDirectory()) out = out.concat(walkModules(p));
    else if (e.name.endsWith('.mjs') || e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
const MODULE_BAN = /JSON\.stringify\(cgCanon\(/;
if (!ONLY_ID) {
  for (const abs of walkModules(REPO)) {
    const rel = abs.slice(REPO.length + 1).replace(/\\/g, '/');
    if (rel.endsWith('.kernel.mjs')) continue;
    if (rel.includes('__proptests__/')) continue;
    if (rel === 'chaingraph/kernels/lint-forbidden-hash.mjs') continue;
    let src; try { src = readFileSync(abs, 'utf8'); } catch { continue; }
    if (MODULE_BAN.test(src)) {
      console.error(`✗ (module) ${rel}\n    Legacy hash path JSON.stringify(cgCanon(...)) in a non-kernel module (enumeration order bites array-index member names). Hash through jcsStringify (kernels/_hash.mjs) instead.`);
      violations++;
    }
  }
}

if (ONLY_ID && !matchedOnly) {
  console.log(`⊘ hash lint --only ${ONLY_ID}: not present in chaingraph.json (PENDING-ASSEMBLE shard) — nothing to lint yet, not a failure.`);
  process.exit(0);
}
if (violations === 0) {
  console.log(ONLY_ID
    ? `✓ hash lint clean for ${ONLY_ID}.`
    : '✓ hash lint clean — no forbidden canonicalization/hash patterns in any live node.');
  process.exit(0);
}
console.error(`\n✗ ${violations} forbidden-hash violation(s). Run fix-hash-scheme.mjs and re-check.`);
process.exit(1);
