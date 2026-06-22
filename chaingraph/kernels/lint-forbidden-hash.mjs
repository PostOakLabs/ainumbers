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

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));

// Banned patterns -> human reason. The OCG-CANON marker block is explicitly allowed.
// NOTE: a literal "sha256:" prefix is a LEGITIMATE OCG convention (the spec emits
// execution_hash as "sha256:"+hex, and the verifier normalizes it), so it is NOT
// banned. We ban only the two patterns that produce a WRONG hash.
const BANNED = [
  // Scheme A (array-replacer): JSON.stringify(<anything>, Object.keys(<anything>).sort()) — the 2nd arg is a
  // recursive-property allowlist, NOT a sort, so it collapses nested data into an input-independent hash.
  // Broadened 2026-06-21 to catch the inline-object form `JSON.stringify({...a,...b}, Object.keys({...a,...b}).sort())`
  // (the cry-04 variant the identifier-only regex missed). There is no legitimate use of Object.keys().sort()
  // as a JSON.stringify replacer — canonical OCG sorts INSIDE cgCanon, then JSON.stringify(canon) with no replacer.
  { re: /JSON\.stringify\([\s\S]{0,200}?,\s*Object\.keys\([\s\S]{0,160}?\)\.sort\(\)\s*\)/, why: 'Scheme A: array-replacer collapses nested data (input-independent hash). Use cgCanon/_hash.mjs: JSON.stringify(cgCanon({policy_parameters, output_payload})).' },
  { re: /function\s+simpleHash\s*\(/, why: 'Scheme C: simpleHash is a 32-bit FNV mislabeled "sha256:". Not SHA-256. Use real crypto.subtle SHA-256 via __ocgHash.' },
  // Scheme E (no canon): JSON.stringify({policy_parameters, output_payload}) hashed WITHOUT a recursive
  // key-sort — the cry-04/Wave-16-17 class (added 2026-06-21). A direct object-literal preimage starting
  // with policy_parameters means the page hashes unsorted JSON, so its hash won't match the canonical
  // kernel (cgCanon sorts recursively). The canonical form wraps it: JSON.stringify(cgCanon({...})) — which
  // is `stringify(cgCanon(` not `stringify({`, so this only fires on the unwrapped (wrong) form. Export
  // blobs are unaffected (they start with mandate_type/spread, not policy_parameters).
  { re: /JSON\.stringify\(\s*\{\s*policy_parameters\b/, why: 'Scheme E: non-canonical preimage — {policy_parameters, output_payload} hashed without recursive key-sort. Wrap it: JSON.stringify(cgCanon({policy_parameters, output_payload})) (cgCanon = the recursive sorter from _hash.mjs).' },
];

let violations = 0;
for (const n of (cg.nodes ?? [])) {
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

if (violations === 0) {
  console.log('✓ hash lint clean — no forbidden canonicalization/hash patterns in any live node.');
  process.exit(0);
}
console.error(`\n✗ ${violations} forbidden-hash violation(s). Run fix-hash-scheme.mjs and re-check.`);
process.exit(1);
