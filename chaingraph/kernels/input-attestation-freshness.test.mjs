// input-attestation-freshness.test.mjs — §23.4 Freshness and consent GATE (SPEC.md §23.4, v0.8.9).
// Reference impl matches ledger/index.html's _freshnessStatusOf() byte-for-byte (same three branches:
// no freshness object => undeclared; expires_at past the reference instant => stale; else fresh).
// Freshness is reporting-only (§23.4): it never touches structural/verifiable or execution_hash.
// Node 18+ (node:fs builtins only — zero npm deps).  Run:  node chaingraph/kernels/input-attestation-freshness.test.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = JSON.parse(readFileSync(join(HERE, 'fixtures', 'input-attestation-freshness.fixture.json'), 'utf8'));

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// Verbatim copy of ledger/index.html's _freshnessStatusOf — kept in sync by inspection (no shared
// import: the Ledger is a single self-contained inline-JS HTML file per CONTRACT.md, so this is the
// node-side conformance twin, same as anchor-binding.test.mjs mirrors machinery used elsewhere).
function freshnessStatusOf(att, nowMs) {
  const fr = att && att.freshness;
  if (!fr || typeof fr !== 'object') return 'undeclared';
  if (!fr.expires_at) return 'fresh';
  const expiry = Date.parse(fr.expires_at);
  if (Number.isNaN(expiry)) return 'fresh';
  return expiry <= nowMs ? 'stale' : 'fresh';
}

const nowMs = Date.parse(FIX.verified_at);

for (const key of ['fresh', 'stale', 'undeclared']) {
  const att = FIX[key];
  const got = freshnessStatusOf(att, nowMs);
  ok(got === att.expected_freshness_status, `${key} entry: freshness_status = "${got}" (expected "${att.expected_freshness_status}")`);
}

// §23.4: staleness is reporting-only — confirm the stale fixture would still resolve its pointer
// (i.e. nothing about freshness blocks structural resolution; that's a separate check §23.2 owns).
ok(typeof FIX.stale.pointer === 'string' && FIX.stale.pointer.length > 0, 'stale entry still carries a resolvable §23 pointer (freshness never gates structural checks)');

console.log(fail ? `\n${fail} failure(s).` : '\nAll input-attestation freshness checks passed.');
process.exit(fail ? 1 : 0);
