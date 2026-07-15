#!/usr/bin/env node
/**
 * scripts/preflight.mjs — run EVERY hard CI gate locally, in CI order.
 *
 * Purpose: kill the push → CI-fail → fix → re-push churn. Green here ⇒ green in
 * the "Deploy to DreamHost" pre-flight job. Run before EVERY push:
 *   node scripts/preflight.mjs
 *
 * Mirrors .github/workflows/deploy-to-dreamhost.yml (the hard, blocking gates).
 * Soft/warn-only CI steps (line-ending guard, manifest-parity, count summaries)
 * are intentionally omitted — they don't fail the build. Stops on first failure.
 *
 * Worker repo (mcp-apps-poc) has its OWN CI gates — this is the SITE preflight.
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, PYTHONIOENCODING: 'utf-8' }; // Windows: python gates print ✓/✗

// [label, command] — exact CI hard gates, in CI order, + the hub-freshness gate.
const GATES = [
  ['JS syntax (tool HTML)',        'node scripts/check_tools.js'],
  ['Kernel JS syntax',             'node chaingraph/kernels/syntax-check.mjs'],
  ['Kernel exports (meta+compute)','node scripts/check-kernel-exports.mjs'],
  ['Forbidden-hash lint',          'node chaingraph/kernels/lint-forbidden-hash.mjs'],
  ['Hash golden-parity',           'node chaingraph/kernels/golden-parity.test.mjs'],
  ['Determinism replay (N=3 + JCS)', 'node chaingraph/kernels/determinism-replay.test.mjs'],
  ['VM↔worker parity (§24)',       'node chaingraph/kernels/vm-parity-gate.mjs --strict'],
  ['Kernel empty-input finite',    'node chaingraph/kernels/empty-input-finite.test.mjs'],
  ['Kernel determinism lint',      'node scripts/check-kernel-determinism.mjs'],
  ['Kernel index current',         'node chaingraph/kernels/gen-index.mjs --check'],
  ['Kernel coverage (node↔index)', 'node scripts/check-kernel-coverage.mjs'],
  ['Hash art-01 parity',           'node chaingraph/kernels/parity-art-01.test.mjs'],
  ['Inline hash equality (AUD-C3)', 'node chaingraph/kernels/inline-hash-equality.test.mjs'],
  ['Index sync (tools↔homepage)',  'python scripts/check_index_sync.py --strict --no-color'],
  ['Dead-link gate',               'node scripts/dead-link-check.mjs'],
  ['Count-drift gate',             'node scripts/verify-counts.mjs --check'],
  ['Shipped-prose (no build jargon)', 'node scripts/check-shipped-prose.mjs'],
  ['Copy hallmarks (§1.4)',           'node scripts/check-copy-hallmarks.mjs'],
  ['MANIFEST name parity',         'node scripts/check-manifest-parity.mjs'],
  ['Manifest schema (SSOT-SCHEMA-1)', 'node scripts/check-manifest-schema.mjs'],
  ['Hub freshness (chains↔hub)',   'node scripts/gen-chain-index.mjs --check'],
  ['llms-full.txt freshness (§M2.3)', 'node scripts/gen-llms-full.mjs --check'],
  ['llms.txt estate map freshness', 'node scripts/gen-estate-map.mjs --check'],
  ['start.html search index freshness', 'node scripts/gen-start-index.mjs --check'],
  ['sitemap.html freshness (SITEMAP-1)', 'node scripts/gen-sitemap-html.mjs --check'],
  ['OKF bundle freshness (chaingraph/okf)', 'node chaingraph/generate-okf.mjs --check'],
  ['Kernel VM page freshness',      'node chaingraph/vm/scripts/gen-kernel-vm-html.mjs --check'],
  ['Kernel VM widget freshness',    'node chaingraph/vm/scripts/gen-kernel-vm-widget.mjs --check'],
  ['OpenAPI freshness',             'node scripts/gen-openapi.mjs --check'],
  ['SSOT schema-validate',         'node chaingraph/standard/schema-validate.mjs'],
  ['SSOT version-consistency',     'node chaingraph/standard/spec-version-consistency.mjs'],
  ['SSOT gate-coverage',           'node chaingraph/standard/spec-gate-coverage.mjs'],
  ['SSOT catalog-parity (no orphans)', 'node scripts/check-catalog-parity.mjs'],
  ['SSOT spec-page parity',        'node chaingraph/standard/spec-page-parity.mjs'],
  ['SSOT spec-page subsections',   'node chaingraph/standard/spec-page-subsection-parity.mjs'],
  ['verify_repo (PII/sitemap/AP2)','python scripts/verify_repo.py'],
  ['§16 proof surface (chains)',   'node scripts/verify-proof-surface.mjs --chains-only'],
  ['§16 proof binding (unit)',     'node chaingraph/kernels/proof-binding.test.mjs'],
  ['§17 kernel identity (unit)',   'node chaingraph/kernels/kernel-identity.test.mjs'],
  ['§17 kernel-identity coverage', 'node chaingraph/kernels/gen-kernel-identity.mjs --check'],
  ['§18 compute-integrity (unit)', 'node chaingraph/kernels/compute-proof.test.mjs'],
  ['§18 compute-proof coverage',   'node scripts/check-compute-proof-coverage.mjs'],
  ['§20 anchor binding (unit)',    'node chaingraph/kernels/anchor-binding.test.mjs'],
  ['§13.12 SD-JWT round-trip',     'node chaingraph/exporters/sd-export-roundtrip.test.mjs'],
  ['Chain runners up-to-date',    'node scripts/gen-chain-runners.mjs --check'],
  ['Workbench up-to-date',        'node scripts/gen-workbench.mjs --check'],
  ['Canvas up-to-date',           'node scripts/gen-canvas.mjs --check'],
  ['Wayfinder freshness',         'node scripts/gen-wayfinder.mjs --check'],
  ['Node-page chrome (nav/footer)', 'node scripts/check-node-page-chrome.mjs'],
  ['CSP consistency (FOOTER-1)',   'node scripts/check-csp-consistency.mjs'],
  ['Ledger hermetic',              'node scripts/check-ledger-hermetic.mjs'],
  ['Ledger codec round-trip',      'node scripts/codec-roundtrip.test.mjs'],
  ['Ledger gate-replay tamper',    'node scripts/gate-replay-tamper.test.mjs'],
  ['Ledger escalation-closure tamper', 'node scripts/escalation-closure-tamper.test.mjs'],
  ['Generator coverage (meta-gate)', 'node scripts/check-generator-coverage.mjs'],
];

let failed = null;
for (const [label, cmd] of GATES) {
  process.stdout.write(`▶ ${label} … `);
  try {
    execSync(cmd, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('✓');
  } catch (e) {
    console.log('✗');
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    console.log('\n' + out.trim() + '\n');
    failed = label;
    break;
  }
}

// mfstSec presence — every tool HTML must carry the manifest panel (CI hard gate).
if (!failed) {
  process.stdout.write('▶ mfstSec presence (every tool) … ');
  const missing = readdirSync(resolve(REPO, 'tools'))
    .filter(f => f.endsWith('.html'))
    .filter(f => !readFileSync(resolve(REPO, 'tools', f), 'utf8').includes('mfstSec'));
  if (missing.length) {
    console.log('✗');
    console.log('\nTools missing the mfstSec manifest panel:\n  ' + missing.join('\n  ') + '\n');
    failed = 'mfstSec presence';
  } else {
    console.log('✓');
  }
}

if (failed) {
  console.error(`\n❌ preflight FAILED at: ${failed}. Fix it before pushing (this would have failed CI).`);
  process.exit(1);
}

// ── Advisory (non-blocking): version-prose drift ────────────────────────────
// The version-of-record gate (spec-version-consistency) enforces the <meta>
// marker. This --remnants pass surfaces stray vX.Y strings in PROSE so a spec
// bump doesn't leave the hub/spec pages describing an old version. It is NOISY
// (legitimately flags the AP2 *protocol* version + OCG layer versions), so it's
// ADVISORY, not a gate — eyeball it after a spec bump.
process.stdout.write('▶ version-prose drift (advisory) … ');
try {
  execSync('node chaingraph/standard/spec-version-consistency.mjs --remnants', { cwd: REPO, env, stdio: 'ignore' });
  console.log('see `node chaingraph/standard/spec-version-consistency.mjs --remnants` after any spec-version bump');
} catch { console.log('(advisory check unavailable — skipped)'); }

console.log('\n✅ preflight PASSED — all hard CI gates green. Safe to push.');
