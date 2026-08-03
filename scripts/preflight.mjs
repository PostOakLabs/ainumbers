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

// HELMGATE-DECOUPLE-1 (2026-07-31): the 4 helm drift/freshness gates below
// assert helm.html against helm/version.json + helm/guide-freshness.json —
// state that goes stale on a schedule set by a SEPARATE repo's release job,
// not by anything in a given site push. Blocking every unrelated site push
// on that staleness caused --no-verify once already (board/done/AVAX-PERM-1.md)
// and blocked PR #766. Scope them to pushes that actually touch helm-relevant
// paths — the release job's own push to helm/version.json IS such a push, so
// the gate still fires exactly where drift can originate; a PR touching only
// tools/guides/kernels never trips it. Undeterminable (e.g. no git history to
// diff) fails OPEN (gates still run) — this narrows blast radius, it never
// weakens what the gate itself checks.
function helmPathsTouched() {
  const isHelmPath = (f) => f === 'helm.html' || f.startsWith('helm/') ||
    f === 'scripts/check-helm-version-drift.mjs' || f === 'scripts/gen-helm-guide-freshness.mjs';
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
    } catch { /* no upstream configured — local/staged diff above is what we have */ }
    return [...touched].some(isHelmPath);
  } catch {
    return true; // can't determine — fail open, run the gates
  }
}
const HELM_SCOPE_TOUCHED = helmPathsTouched();

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
  ['Quantization parity (§24.6)',  'node chaingraph/kernels/quantization-parity.test.mjs'],
  ['Seed replay (§24.6.2)',        'node chaingraph/kernels/seed-replay.test.mjs'],
  ['Kernel determinism lint',      'node scripts/check-kernel-determinism.mjs'],
  // WARN-ONLY BY DESIGN (PAGEDET-GATE-1): 28 pre-existing page defects are
  // baselined, and the flag makes even a NEW one report rather than block. A gate
  // that reds main on a pre-existing condition gets switched off; this one is here
  // to be read. Drop --warn-only once the baseline is worked down.
  ['Page determinism (preimage-reachable, warn-only)', 'node scripts/check-page-determinism.mjs --warn-only'],
  ['Page determinism gate controls', 'node scripts/check-page-determinism.test.mjs'],
  ['Kernel index current',         'node chaingraph/kernels/gen-index.mjs --check'],
  ['Kernel coverage (node↔index)', 'node scripts/check-kernel-coverage.mjs'],
  ['Hash art-01 parity',           'node chaingraph/kernels/parity-art-01.test.mjs'],
  ['Inline hash equality (AUD-C3)', 'node chaingraph/kernels/inline-hash-equality.test.mjs'],
  ['Canon block ordering (CANON-ORDER-1)', 'node scripts/check-canon-order.mjs'],
  ['Inline SSOT sync (INLINESYNC-1)', 'node scripts/check-inline-ssot-sync.mjs --check'],
  ['DAG helper resolvability (ESCDAG-FIX-1)', 'node scripts/check-dag-idents.mjs'],
  ['Index sync (tools↔homepage)',  'python scripts/check_index_sync.py --strict --no-color'],
  // SSOTPREFLIGHT-WIRE-1 (2026-07-27): registry of the 6 SSOT-writing producers
  // this gate defends against (SSOTGUARD-VERIFY-1). None of the 6 has a --check
  // flag or idempotency guard of its own — this gate is the only thing standing
  // between them and a malformed chaingraph.json/chaingraph.meta.json landing on
  // main, so their names are recorded here for traceability even though the gate
  // command below doesn't take arguments naming them.
  //   scripts/patch-wave38.mjs              — direct chaingraph.json writeFileSync
  //   scripts/add-wave43-nodes.mjs          — direct chaingraph.json writeFileSync
  //   scripts/add-cc-g-tvm-nodes.mjs        — direct chaingraph.json writeFileSync
  //   scripts/add-rhc-wave-a-nodes.mjs      — direct chaingraph.json writeFileSync
  //   scripts/add-rhc-wave-b-node.mjs       — direct chaingraph.json writeFileSync
  //   scripts/migrate-chaingraph-shards.mjs — writes chaingraph.meta.json + shards,
  //     NOT chaingraph.json directly. Same gate still covers it: assemble-chaingraph.mjs
  //     reads chaingraph.meta.json (META_PATH) as its input and diffs the assembled
  //     result against the committed chaingraph.json (CG_PATH) — a meta.json/shard
  //     corruption from this script surfaces as an assemble --check mismatch exactly
  //     like a direct-appender divergence would. One gate, two write targets, reasoned
  //     not assumed (assemble-chaingraph.mjs META_PATH read + CG_PATH diff).
  // ⚠ This registry is documentation, not enforcement, and does NOT close the
  // `--no-verify` bypass — the pre-push hook (and this gate) simply doesn't run
  // if a push skips hooks.
  ['chaingraph.json shard freshness (CGSHARD-1)', 'node scripts/assemble-chaingraph.mjs --check'],
  ['Unassembled-shard scan (ASSEMBLE-COVER-1, advisory)', 'node scripts/check-shard-assembly.mjs'],
  ['Dead-link gate',               'node scripts/dead-link-check.mjs'],
  ['Nav reachability (NAV-ISLAND-1)', 'node scripts/check-nav-reachability.mjs'],
  ['Count-drift gate',             'node scripts/verify-counts.mjs --check'],
  ['MCP protocol-version drift', 'node scripts/verify-mcp-protocol-version.mjs'],
  ['Deadline-wall freshness (SI-DEADLINE-FRESH-1)', 'node scripts/check-deadline-freshness.mjs'],
  ['Bank-fact freshness (REVERIFY-BANK-1)', 'node scripts/check-bank-fact-freshness.mjs'],
  ['Tool-number uniqueness',       'node scripts/check-tool-number-unique.mjs'],
  ['Tool-node pairing registry',   'node scripts/check-tool-node-pairings.mjs'],
  ['Topic cross-link registry (TOOLS-GRAPH-BRIDGE-1)', 'node scripts/check-topic-links.mjs'],
  ['Topic cross-link block freshness (TOOLS-GRAPH-BRIDGE-1)', 'node scripts/apply-topic-links.mjs --check'],
  ['Shipped-prose (no build jargon)', 'node scripts/check-shipped-prose.mjs'],
  ['Copy hallmarks (§1.4)',           'node scripts/check-copy-hallmarks.mjs'],
  ['MANIFEST name parity',         'node scripts/check-manifest-parity.mjs'],
  ['Manifest schema (SSOT-SCHEMA-1)', 'node scripts/check-manifest-schema.mjs'],
  ['Node-manifest generator dry-run (MFSTGEN-1)', 'node scripts/generate-node-manifest.mjs --all --check'],
  ['Evidence-profile manifest (EF-2)', 'node scripts/validate-evidence-profiles.mjs'],
  ['Chain domain taxonomy',        'node scripts/check-chain-domain.mjs'],
  ['Chain composer-url existence (CHAINURL-GATE-1)', 'node scripts/check-chain-composer-urls.mjs'],
  ['Hub freshness (chains↔hub)',   'node scripts/gen-chain-index.mjs --check'],
  ['Chain-builder catalog freshness (CHAINBUILDER-CATALOG-GEN-1)', 'node scripts/gen-chainbuilder-catalog.mjs --check'],
  ['Hub node-card coverage (HUB-GEN-1)', 'node scripts/gen-chaingraph-hub.mjs --check'],
  ['Guides index coverage (GUIDES-INDEX-GEN-1)', 'node scripts/gen-guides-index.mjs --check'],
  ['llms-full.txt freshness (§M2.3)', 'node scripts/gen-llms-full.mjs --check'],
  ['llms.txt estate map freshness', 'node scripts/gen-estate-map.mjs --check'],
  ['start.html search index freshness', 'node scripts/gen-start-index.mjs --check'],
  ['sitemap.xml freshness (DISCOVER-1)', 'node scripts/regen-sitemap.mjs --check'],
  ['sitemap.html freshness (SITEMAP-1)', 'node scripts/gen-sitemap-html.mjs --check'],
  ['EUC register entries freshness (EUC-SITE-1)', 'node scripts/gen-euc-register.mjs --check'],
  ['EUC register page freshness (EUC-SITE-1)', 'node scripts/gen-euc-register-page.mjs --check'],
  ['OKF bundle freshness (chaingraph/okf)', 'node chaingraph/generate-okf.mjs --check'],
  ['Kernel VM page freshness',      'node chaingraph/vm/scripts/gen-kernel-vm-html.mjs --check'],
  ['Kernel VM widget freshness',    'node chaingraph/vm/scripts/gen-kernel-vm-widget.mjs --check'],
  ['Kernel VM explainer freshness', 'node chaingraph/vm/scripts/gen-kernel-vm-explainer.mjs --check'],
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
  ['§PPH-1 policy_parameters_hash', 'node chaingraph/kernels/policy-params-hash.test.mjs'],
  ['ocg-clause-binding@1 profile',  'node chaingraph/kernels/clause-binding.test.mjs'],
  ['§27 human-accountability records', 'node chaingraph/kernels/validate-ha-records.test.mjs'],
  ['§27.11 evidence verification',  'node chaingraph/kernels/hagate-evidence-verification.test.mjs'],
  ['Checklist/SOP runner (CHECKRUN-1)', 'node chaingraph/kernels/checklist-selftest.test.mjs'],
  ['§17 kernel identity (unit)',   'node chaingraph/kernels/kernel-identity.test.mjs'],
  ['§17 kernel-identity coverage', 'node chaingraph/kernels/gen-kernel-identity.mjs --check'],
  ['§17 kernel-identity coverage (shard, KERNELID-GATE-1)', 'node chaingraph/kernels/gen-kernel-identity.mjs --check --shard'],
  ['§18 compute-integrity (unit)', 'node chaingraph/kernels/compute-proof.test.mjs'],
  ['§18 compute-proof coverage',   'node scripts/check-compute-proof-coverage.mjs'],
  ['§18 digest-freshness ratchet (S18-DIGEST-GATE-1)', 'node scripts/check-s18-digest-freshness.mjs'],
  ['§18 digest-freshness fixture proof', 'node scripts/check-s18-digest-freshness.test.mjs'],
  ['Proof-badge freshness',        'node scripts/check-proof-badge.mjs'],
  ['Kernel as-of staleness ratchet (ASOF-GATE-1)', 'node scripts/check-kernel-asof-staleness.mjs'],
  ['Kernel as-of staleness fixture proof', 'node scripts/check-kernel-asof-staleness.test.mjs'],
  // Deliberately NOT inside the HELM_SCOPE_TOUCHED block below. That scoping exists
  // because the version-drift gate asserts against state the SEPARATE helm repo's
  // release job sets, so it goes stale on a cadence no site push controls. This gate
  // has no such dependency: it compares the vendored markdown against its own pinned
  // digest and the page against that markdown, both in this repo, both deterministic.
  // Scoping it would also silently ungate it, since isHelmPath() above does not match
  // helm-technical-design.html.
  ['Helm technical design page parity', 'node scripts/check-helm-techdoc-parity.mjs'],
  ['Helm technical design parity fixture proof', 'node scripts/check-helm-techdoc-parity.test.mjs'],
  // HELMGATE-DECOUPLE-1: scoped — only run when this push touches a helm-relevant
  // path (see helmPathsTouched() above). Undeterminable fails open (gates run).
  // HELMGATE-DECOUPLE-2: guide-freshness (the byte-identical-walkthrough check)
  // moved OFF this blocking path entirely — it now runs report-only on a schedule
  // (.github/workflows/helm-guide-freshness-schedule.yml), same shape as the
  // worker's Vendor Freshness. version-drift stays here unchanged: it's
  // machine-satisfiable and has never blocked on a human duty.
  ...(HELM_SCOPE_TOUCHED ? [
    ['Helm release/version drift (HELM-RELEASE-DRIFT-GATES-1)', 'node scripts/check-helm-version-drift.mjs'],
    ['Helm release/version drift fixture proof', 'node scripts/check-helm-version-drift.test.mjs'],
  ] : [
    ['Helm gates (HELMGATE-DECOUPLE-1: no helm-path changes, skipped)', 'node -e "1"'],
  ]),
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
  ['Internal-lang leak (INTERNAL-LANG-LEAK-1)', 'node scripts/check-internal-lang-leak.mjs'],
  ['Verify-path no-egress (AV-NOEGRESS-1)', 'node scripts/check-verify-no-egress.mjs'],
  ['Site static egress scan (EGRESS-SITE-1)', 'node scripts/check-site-egress.mjs'],
  ['Ledger hermetic',              'node scripts/check-ledger-hermetic.mjs'],
  ['Playground hermetic (A8)',     'node scripts/check-playground-hermetic.mjs'],
  ['Ledger codec round-trip',      'node scripts/codec-roundtrip.test.mjs'],
  ['Ledger gate-replay tamper',    'node scripts/gate-replay-tamper.test.mjs'],
  ['Ledger escalation-closure tamper', 'node scripts/escalation-closure-tamper.test.mjs'],
  ['OCG verify.html proven-to-reject (AV-REJECT-FIX-1)', 'node scripts/ocg-verify-hash-tamper.test.mjs'],
  ['tools/568 receipt verifier proven-to-reject (AV-REJECT-FIX-1)', 'node scripts/ocg-receipt-verifier-568-tamper.test.mjs'],
  ['art-424 witness checkpoint proven-to-reject (AV-REJECT-FIX-1)', 'node scripts/witness-checkpoint-424-tamper.test.mjs'],
  ['Generator coverage (meta-gate)', 'node scripts/check-generator-coverage.mjs'],
  ['Standards vectors (IBAN/LEI/BIC/UETR/ABA)', 'node scripts/standards-vectors.test.mjs'],
  ['Authority contradiction gate (CB4-CONTRADICTION-GATE-1)', 'node scripts/check-authority-contradiction.mjs'],
  ['Authority contradiction gate fixture proof', 'node scripts/check-authority-contradiction.test.mjs'],
  ['JSON-LD structural validity (JSONLD-1)', 'node scripts/check-jsonld.mjs'],
  ['Template integrity (advisory, TPL-GATE-1)', 'node scripts/check-template-integrity.mjs'],
  ['CSV-injection sanitization (WB-5)', 'node scripts/check-csv-injection.mjs'],
  ['Workbook unit fixtures (WB-1)',     'node chaingraph/workbook/workbook.test.mjs'],
  ['Workbook determinism fixture (WB-5)', 'node chaingraph/workbook/check-determinism-fixture.mjs'],
  ['Round-trip comparator unit fixtures (XLR-2)', 'node chaingraph/workbook/roundtrip-verify.test.mjs'],
  ['Round-trip golden-fixture determinism (XLR-5)', 'node chaingraph/workbook/check-roundtrip-determinism.mjs'],
  ['Proposals schema/slug/copy (AGENTPR-1)', 'node scripts/verify-proposals.mjs'],
  // Node leg of cross-engine parity: catches a kernel edit that makes the Node
  // parity-manifest generation itself crash/error. The cross-engine byte diff
  // (Bun + QuickJS legs) genuinely needs those runtimes and stays CI-only.
  ['Engine-parity node-leg (crash guard)', 'node scripts/check-engine-parity.mjs'],
  ['Workflow gate parity (no CI↔preflight drift)', 'node scripts/check-workflow-gate-parity.mjs'],
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
