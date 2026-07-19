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

// --changed <ref>: incremental mode for local/pre-push runs only (PREFLIGHT-BUDGET-1 §1).
// Scopes verify_repo.py to files touched vs <ref>. CI never passes this — the
// land-verify.yml / deploy-to-dreamhost.yml workflows call the gates directly with a
// full-estate scan, so nothing here weakens what CI checks.
const changedIdx = process.argv.indexOf('--changed');
const changedRef = changedIdx !== -1 ? process.argv[changedIdx + 1] : null;
const BUDGET_MS = 60_000;

// [label, command] — exact CI hard gates, in CI order, + the hub-freshness gate.
const GATES = [
  ['JS syntax (tool HTML)',        'node scripts/check_tools.js'],
  ['Kernel JS syntax',             'node chaingraph/kernels/syntax-check.mjs'],
  ['Protected-path guard (CONTRACT-GUARD-1)', 'node scripts/check-protected-paths.mjs'],
  ['Kernel exports (meta+compute)','node scripts/check-kernel-exports.mjs'],
  ['Forbidden-hash lint',          'node chaingraph/kernels/lint-forbidden-hash.mjs'],
  ['Hash golden-parity',           'node chaingraph/kernels/golden-parity.test.mjs'],
  ['Determinism replay (N=3 + JCS)', 'node chaingraph/kernels/determinism-replay.test.mjs'],
  ['VM↔worker parity (§24)',       'node chaingraph/kernels/vm-parity-gate.mjs --strict'],
  ['Kernel empty-input finite',    'node chaingraph/kernels/empty-input-finite.test.mjs'],
  ['Quantization parity (§24.6)',  'node chaingraph/kernels/quantization-parity.test.mjs'],
  ['Seed replay (§24.6.2)',        'node chaingraph/kernels/seed-replay.test.mjs'],
  ['Kernel determinism lint',      'node scripts/check-kernel-determinism.mjs'],
  ['Kernel index current',         'node chaingraph/kernels/gen-index.mjs --check'],
  ['Kernel coverage (node↔index)', 'node scripts/check-kernel-coverage.mjs'],
  ['Hash art-01 parity',           'node chaingraph/kernels/parity-art-01.test.mjs'],
  ['Inline hash equality (AUD-C3)', 'node chaingraph/kernels/inline-hash-equality.test.mjs'],
  ['Index sync (tools↔homepage)',  'python scripts/check_index_sync.py --strict --no-color'],
  ['chaingraph.json shard freshness (CGSHARD-1)', 'node scripts/assemble-chaingraph.mjs --check'],
  ['Unassembled-shard scan (ASSEMBLE-COVER-1, advisory)', 'node scripts/check-shard-assembly.mjs'],
  ['Dead-link gate',               'node scripts/dead-link-check.mjs'],
  ['Count-drift gate',             'node scripts/verify-counts.mjs --check'],
  ['Tool-number uniqueness',       'node scripts/check-tool-number-unique.mjs'],
  ['Tool-node pairing registry',   'node scripts/check-tool-node-pairings.mjs'],
  ['Shipped-prose (no build jargon)', 'node scripts/check-shipped-prose.mjs'],
  ['Copy hallmarks (§1.4)',           'node scripts/check-copy-hallmarks.mjs'],
  ['MANIFEST name parity',         'node scripts/check-manifest-parity.mjs'],
  ['Manifest schema (SSOT-SCHEMA-1)', 'node scripts/check-manifest-schema.mjs'],
  ['Evidence-profile manifest (EF-2)', 'node scripts/validate-evidence-profiles.mjs'],
  ['Chain domain taxonomy',        'node scripts/check-chain-domain.mjs'],
  ['Chain composer-url existence (CHAINURL-GATE-1)', 'node scripts/check-chain-composer-urls.mjs'],
  ['Hub freshness (chains↔hub)',   'node scripts/gen-chain-index.mjs --check'],
  ['llms-full.txt freshness (§M2.3)', 'node scripts/gen-llms-full.mjs --check'],
  ['llms.txt estate map freshness', 'node scripts/gen-estate-map.mjs --check'],
  ['start.html search index freshness', 'node scripts/gen-start-index.mjs --check'],
  ['sitemap.xml freshness (DISCOVER-1)', 'node scripts/regen-sitemap.mjs --check'],
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
  ['verify_repo (PII/sitemap/AP2)', changedRef ? `python scripts/verify_repo.py --changed ${changedRef}` : 'python scripts/verify_repo.py'],
  ['§16 proof surface (chains)',   'node scripts/verify-proof-surface.mjs --chains-only'],
  ['§16 proof binding (unit)',     'node chaingraph/kernels/proof-binding.test.mjs'],
  ['Checklist/SOP runner (CHECKRUN-1)', 'node chaingraph/kernels/checklist-selftest.test.mjs'],
  ['§17 kernel identity (unit)',   'node chaingraph/kernels/kernel-identity.test.mjs'],
  ['§17 kernel-identity coverage', 'node chaingraph/kernels/gen-kernel-identity.mjs --check'],
  ['§18 compute-integrity (unit)', 'node chaingraph/kernels/compute-proof.test.mjs'],
  ['§18 compute-proof coverage',   'node scripts/check-compute-proof-coverage.mjs'],
  ['Proof-badge freshness',        'node scripts/check-proof-badge.mjs'],
  ['§20 anchor binding (unit)',    'node chaingraph/kernels/anchor-binding.test.mjs'],
  ['§13.12 SD-JWT round-trip',     'node chaingraph/exporters/sd-export-roundtrip.test.mjs'],
  ['Chain runners up-to-date',    'node scripts/gen-chain-runners.mjs --check'],
  ['Workbench up-to-date',        'node scripts/gen-workbench.mjs --check'],
  ['Canvas up-to-date',           'node scripts/gen-canvas.mjs --check'],
  ['Wayfinder freshness',         'node scripts/gen-wayfinder.mjs --check'],
  ['Node-page chrome (nav/footer)', 'node scripts/check-node-page-chrome.mjs'],
  ['Root-page chrome freshness (INDEX-SIMPLIFY-1)', 'node scripts/gen-root-chrome.mjs --check'],
  ['No copyright-year splash (INDEX-SIMPLIFY-1)', 'node scripts/check-no-copyright-year.mjs'],
  ['CSP consistency (FOOTER-1)',   'node scripts/check-csp-consistency.mjs'],
  ['Ledger hermetic',              'node scripts/check-ledger-hermetic.mjs'],
  ['Ledger codec round-trip',      'node scripts/codec-roundtrip.test.mjs'],
  ['Ledger gate-replay tamper',    'node scripts/gate-replay-tamper.test.mjs'],
  ['Ledger escalation-closure tamper', 'node scripts/escalation-closure-tamper.test.mjs'],
  ['Generator coverage (meta-gate)', 'node scripts/check-generator-coverage.mjs'],
  ['Standards vectors (IBAN/LEI/BIC/UETR/ABA)', 'node scripts/standards-vectors.test.mjs'],
  ['JSON-LD structural validity (JSONLD-1)', 'node scripts/check-jsonld.mjs'],
];

let failed = null;
const timings = []; // [label, ms]
const suiteStart = Date.now();

for (const [label, cmd] of GATES) {
  process.stdout.write(`▶ ${label} … `);
  const t0 = Date.now();
  try {
    execSync(cmd, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const ms = Date.now() - t0;
    timings.push([label, ms]);
    console.log(`✓ (${ms}ms)`);
  } catch (e) {
    const ms = Date.now() - t0;
    timings.push([label, ms]);
    console.log(`✗ (${ms}ms)`);
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    console.log('\n' + out.trim() + '\n');
    failed = label;
    break;
  }
}

// mfstSec presence — every tool HTML must carry the manifest panel (CI hard gate).
if (!failed) {
  process.stdout.write('▶ mfstSec presence (every tool) … ');
  const t0 = Date.now();
  const missing = readdirSync(resolve(REPO, 'tools'))
    .filter(f => f.endsWith('.html'))
    .filter(f => !readFileSync(resolve(REPO, 'tools', f), 'utf8').includes('mfstSec'));
  const ms = Date.now() - t0;
  timings.push(['mfstSec presence (every tool)', ms]);
  if (missing.length) {
    console.log(`✗ (${ms}ms)`);
    console.log('\nTools missing the mfstSec manifest panel:\n  ' + missing.join('\n  ') + '\n');
    failed = 'mfstSec presence';
  } else {
    console.log(`✓ (${ms}ms)`);
  }
}

const totalMs = Date.now() - suiteStart;
console.log(`\nTOTAL ${(totalMs / 1000).toFixed(1)}s`);

if (totalMs > BUDGET_MS) {
  const slowest = [...timings].sort((a, b) => b[1] - a[1]).slice(0, 3);
  console.log(`⚠️  BUDGET ADVISORY: preflight took ${(totalMs / 1000).toFixed(1)}s, over the ${(BUDGET_MS / 1000).toFixed(0)}s budget. Slowest 3 gates:`);
  for (const [label, ms] of slowest) console.log(`    ${ms}ms — ${label}`);
  console.log('    (advisory only — not a hard fail; wall-clock budgets are machine-dependent)');
}

if (failed) {
  console.error(`\n❌ preflight FAILED at: ${failed}. Fix it before pushing (this would have failed CI).`);
  process.exit(1);
}

// ── Advisory (non-blocking): worker vendor owed ─────────────────────────────
// VENDOR-OWED-ADVISORY-1: an assembled chaingraph.json change means the worker
// repo's freshness gate (check-vendor-fresh.mjs) will read RED until the batched
// vendor land runs — an expected window, not breakage. De-noise it here so a
// diagnosis isn't burned re-discovering that every time (see board/done/CW-1B.md).
// Exit 0 always — this NEVER blocks, NEVER fails, NEVER becomes a gate.
try {
  const touched = new Set();
  execSync('git diff --name-only HEAD', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString().split('\n').forEach(f => f && touched.add(f));
  execSync('git diff --name-only --cached', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString().split('\n').forEach(f => f && touched.add(f));
  try {
    const upstream = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const base = execSync(`git merge-base ${upstream} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    execSync(`git diff --name-only ${base} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split('\n').forEach(f => f && touched.add(f));
  } catch { /* no upstream configured — uncommitted/staged diff already covers local work */ }

  if (touched.has('chaingraph/chaingraph.json')) {
    console.log('\n📦 ADVISORY: assembled chaingraph.json changed — a worker vendor land is now OWED.');
    console.log('   Expect the worker freshness gate (check-vendor-fresh.mjs) to read RED until the');
    console.log('   batched ASSEMBLE+LAND vendor run lands. That window is expected, not breakage.');
  }
} catch { /* advisory best-effort only — never let it affect preflight's exit code */ }

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
