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
 *
 * ── MODES ───────────────────────────────────────────────────────────────────
 *   node scripts/preflight.mjs
 *       DEFAULT, UNCHANGED: fail-fast. Stops at the first red gate, exits 1, and
 *       reports nothing about the gates behind it. This is what CI
 *       (scripts-verify.yml), the pre-push hook and assemble-land.mjs run, and
 *       every line of that path is deliberately left exactly as it was.
 *
 *   node scripts/preflight.mjs --keep-going
 *       Runs EVERY gate, collects every result, prints a per-gate
 *       PASS / FAIL / DID-NOT-RUN list with totals derived from the gate list at
 *       runtime, and exits 1 if any unwaived gate failed.
 *
 *   node scripts/preflight.mjs --expect-red <gate-id>
 *       Declares a gate expected to be red on THIS invocation. Matched
 *       case-insensitively as a substring of the gate label; repeatable; implies
 *       --keep-going. The declaration is named in the output and lives only in
 *       this argv — there is deliberately NO waiver file, because a persisted
 *       waiver accumulates silently, which is the defect this flag answers
 *       rather than a second copy of it. An id matching no gate is a hard error.
 *
 * WHY --keep-going EXISTS (PREFLIGHT-KEEPGOING-1). On a shard branch a
 * hash-moving CGSHARD-1 red is expected BY CONSTRUCTION, and that gate sits
 * early in the list, so a fail-fast run proves nothing at all about the gates
 * behind it — while still LOOKING like preflight ran. STABLECOIN-3SRC-D-1 hit
 * exactly that and had to extract the gate list and run every gate by hand to
 * get real coverage. A command that stops proves nothing about what it never
 * reached, so under --keep-going "did not run" is reported as its own category
 * and is NEVER folded into "passed" (SO #34c: absence of a red is not a pass).
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

// PREFLIGHT-KEEPGOING-1 — run-all / report-all mode. STRICTLY ADDITIVE: with
// neither flag present KEEP_GOING is false, and every branch below that reads it
// collapses to exactly the code that was there before. Same gate list, same order,
// same fail-fast point, same exit code, same stdout on the default path.
const KEEP_GOING_FLAG = process.argv.includes('--keep-going');
// --expect-red <gate-id>, repeatable. PER-INVOCATION ONLY — resolved against the
// gate labels at startup, named in the output, and gone when the process exits.
// No file is read or written; nothing carries into the next run.
const EXPECT_RED = process.argv.reduce((acc, a, i) => {
  if (a === '--expect-red' && process.argv[i + 1]) acc.push(process.argv[i + 1]);
  return acc;
}, []);
const KEEP_GOING = KEEP_GOING_FLAG || EXPECT_RED.length > 0;
const expectedRedFor = (label) =>
  EXPECT_RED.find((id) => label.toLowerCase().includes(id.toLowerCase())) || null;

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

// FV-FLOOR-DIGEST-GATE-1: which __proptests__/*.proptest.mjs floor files this push touches, for the
// --verify-authoring scoped check below. Same union-of-diffs shape as helmPathsTouched() above (working
// tree + staged + committed-vs-upstream, deduped via a Set) — reused, not reinvented. UNLIKE
// helmPathsTouched(), an undeterminable diff fails CLOSED (empty list, gate no-ops) rather than open: this
// check's entire design is "scoped to the diff, never the full estate" (a floor file legitimately goes
// stale later when its kernel moves — see check-fv-floor-coverage.mjs's header comment), so falling back to
// "examine everything" on an undeterminable diff would be exactly the widening that design forbids.
function touchedFloorFiles() {
  const isFloorFile = (f) => /^chaingraph\/kernels\/__proptests__\/[^/]+\.proptest\.mjs$/.test(f);
  try {
    const touched = new Set();
    execSync('git diff --name-only --diff-filter=ACM HEAD', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split('\n').forEach(f => f && touched.add(f));
    execSync('git diff --name-only --diff-filter=ACM --cached', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split('\n').forEach(f => f && touched.add(f));
    try {
      const upstream = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      const base = execSync(`git merge-base ${upstream} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      execSync(`git diff --name-only --diff-filter=ACM ${base} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString().split('\n').forEach(f => f && touched.add(f));
    } catch { /* no upstream configured — working tree/staged diff above is what we have */ }
    return [...touched].filter(isFloorFile);
  } catch {
    return []; // undeterminable — fail CLOSED (empty, not a full-estate fallback); see comment above
  }
}
const TOUCHED_FLOOR_FILES = touchedFloorFiles();

// [label, command] — exact CI hard gates, in CI order, + the hub-freshness gate.
const GATES = [
  // BINARY-BYTE-GATE-1 runs FIRST, ahead of the JS syntax gate, on purpose.
  // The syntax gate is structurally BLIND to this class: DISE-SEG-T-2 shipped a
  // raw NUL inside a JS string delimiter in tools/582 and check_tools.js was
  // green both before and after the fix, because a NUL in a string literal is
  // valid JavaScript. Worse, that NUL makes the file read as BINARY to grep and
  // ripgrep, so every grep-based gate below silently stops matching it. A file
  // that has gone invisible to the instruments must be caught before anything
  // downstream reports a green it cannot actually see.
  ['Binary/control bytes (BINARY-BYTE-GATE-1)', 'node scripts/check-binary-bytes.mjs'],
  ['Binary-byte gate fixture proof', 'node scripts/check-binary-bytes.test.mjs'],
  ['JS syntax (tool HTML)',        'node scripts/check_tools.js'],
  ['Kernel JS syntax',             'node chaingraph/kernels/syntax-check.mjs'],
  ['Kernel exports (meta+compute)','node scripts/check-kernel-exports.mjs'],
  ['Forbidden-hash lint',          'node chaingraph/kernels/lint-forbidden-hash.mjs'],
  ['Hash golden-parity',           'node chaingraph/kernels/golden-parity.test.mjs'],
  ['Determinism replay (N=3 + JCS)', 'node chaingraph/kernels/determinism-replay.test.mjs'],
  ['VM↔worker parity (§24)',       'node chaingraph/kernels/vm-parity-gate.mjs --strict'],
  ['Guest builtin safety (GUEST-BUILTIN-GATE-1)', 'node chaingraph/kernels/check-guest-builtin-safety.mjs'],
  ['Guest builtin safety controls (canary + mutation)', 'node chaingraph/kernels/check-guest-builtin-safety.test.mjs'],
  ['Kernel empty-input finite',    'node chaingraph/kernels/empty-input-finite.test.mjs'],
  ['Quantization parity (§24.6)',  'node chaingraph/kernels/quantization-parity.test.mjs'],
  ['Seed replay (§24.6.2)',        'node chaingraph/kernels/seed-replay.test.mjs'],
  ['Kernel determinism lint',      'node scripts/check-kernel-determinism.mjs'],
  // WARN-ONLY BY DESIGN (PAGEDET-GATE-1): 28 pre-existing page defects are
  // baselined, and the flag makes even a NEW one report rather than block. A gate
  // that reds main on a pre-existing condition gets switched off; this one is here
  // to be read. Drop --warn-only once the baseline is worked down.
  ['Page determinism (preimage-reachable, warn-only)', 'node scripts/check-page-determinism.mjs --warn-only',
    { note: 'runs with --warn-only, which exits 0 even on a new defect — a green here reports, it does not verdict' }],
  ['Page determinism gate controls', 'node scripts/check-page-determinism.test.mjs'],
  ['Kernel index current',         'node chaingraph/kernels/gen-index.mjs --check'],
  ['Kernel coverage (node↔index)', 'node scripts/check-kernel-coverage.mjs'],
  ['Hash art-01 parity',           'node chaingraph/kernels/parity-art-01.test.mjs'],
  ['Inline hash equality (AUD-C3)', 'node chaingraph/kernels/inline-hash-equality.test.mjs'],
  ['Ed25519 noble↔WebCrypto equivalence (FV-ED25519-NOBLE-1)', 'node chaingraph/kernels/ed25519-webcrypto-equivalence.test.mjs'],
  ['Canon block ordering (CANON-ORDER-1)', 'node scripts/check-canon-order.mjs'],
  // INLINE-SSOT-PORTS-GATE-1: the self-test runs FIRST and is not optional. It
  // asserts, with negative controls, that the codeOnly normalizer still fails on
  // a changed operator/constant/identifier/string — a normalizer that quietly
  // widened would turn the sync check below green over a real divergence, so a
  // green sync check means nothing unless the normalizer itself is proven narrow.
  ['Inline SSOT normalizer self-test (INLINE-SSOT-PORTS-GATE-1)', 'node scripts/check-inline-ssot-sync.mjs --self-test'],
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
  ['Node/chain shard registration (NODE-REGISTRATION-GAP-1, node case blocking)', 'node scripts/check-shard-assembly.mjs'],
  ['Branch-aware shard-registration proof (SHARD-GATE-PRE-ASSEMBLE-1)', 'node scripts/check-shard-assembly.test.mjs'],
  ['Unassembled-shard diff fixture proof (CHAINORDER-GATE-1)', 'node scripts/lib-shard-order.test.mjs'],
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
  ['Credits registry coverage (vendored-code license gate)', 'node scripts/check-credits-coverage.mjs repo'],
  ['Credits page freshness (generated from registry)', 'node scripts/gen-credits.mjs repo --check'],
  ['MANIFEST name parity',         'node scripts/check-manifest-parity.mjs'],
  ['Manifest schema (SSOT-SCHEMA-1)', 'node scripts/check-manifest-schema.mjs'],
  ['Node-manifest generator dry-run (MFSTGEN-1)', 'node scripts/generate-node-manifest.mjs --all --check'],
  ['Evidence-profile manifest (EF-2)', 'node scripts/validate-evidence-profiles.mjs'],
  ['Chain domain taxonomy',        'node scripts/check-chain-domain.mjs'],
  ['Chain composer-url existence (CHAINURL-GATE-1)', 'node scripts/check-chain-composer-urls.mjs'],
  ['Chain handoff-register regression (CHAINNARRATIVE-CLARIFY-1)', 'node scripts/check-chain-handoff-register.mjs'],
  ['Hub freshness (chains↔hub)',   'node scripts/gen-chain-index.mjs --check'],
  ['OCG conformance roster self-claim (OCG-CONFROSTER-BUILD-1)', 'node scripts/gen-ocg-conformance-roster.mjs --check'],
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
  ['Clause edge report freshness (CLAUSE-EDGE-TYPES-1)', 'node scripts/gen-clause-edge-report.mjs --check'],
  ['Clause edge report page freshness (CLAUSE-EDGE-TYPES-1)', 'node scripts/gen-clause-edge-report-page.mjs --check'],
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
  ['Property-testing floor',       changedRef ? `node scripts/run-proptests.mjs --base ${changedRef}` : 'node scripts/run-proptests.mjs'],
  ['FV floor coverage ratchet (FV-COVERAGE-GATE-1)', 'node scripts/check-fv-floor-coverage.mjs'],
  ['FV floor coverage fixture proof', 'node scripts/check-fv-floor-coverage.test.mjs'],
  // FV-FLOOR-DIGEST-GATE-1: enforces the executed-digest authoring rule (FV-PBT-FLOOR-BUILD-SPEC.md §4,
  // amended by PR #1176) on ONLY the floor files THIS push touches (TOUCHED_FLOOR_FILES above) — never the
  // full floor estate, which would false-fail on legitimate later staleness. No-ops when nothing touched.
  ['FV floor digest authoring — touched files only (FV-FLOOR-DIGEST-GATE-1)',
    TOUCHED_FLOOR_FILES.length
      ? `node scripts/check-fv-floor-coverage.mjs --verify-authoring ${TOUCHED_FLOOR_FILES.map((f) => `"${f}"`).join(' ')}`
      : 'node -e "1"',
    TOUCHED_FLOOR_FILES.length
      ? null
      : { notRun: 'this push touches no __proptests__ floor file, so the authoring check had nothing to examine' }],
  ['§18 compute-integrity (unit)', 'node chaingraph/kernels/compute-proof.test.mjs'],
  ['§18 compute-proof coverage',   'node scripts/check-compute-proof-coverage.mjs'],
  ['§18 digest-freshness ratchet (S18-DIGEST-GATE-1)', 'node scripts/check-s18-digest-freshness.mjs'],
  ['§18 digest-freshness fixture proof', 'node scripts/check-s18-digest-freshness.test.mjs'],
  // §18 RECOMPUTE-EQUALITY (SO #34, ASYNC-VACUOUS-GATE-1). Re-executes every proven node's kernel in the
  // QuickJS sandbox and requires the receipt's journal.output to reproduce. ~8s over the full estate.
  ['§18 recompute-equality (SO #34)', 'node scripts/check-recompute-equality.mjs'],
  ['§18 recompute-equality controls (canary + mutation)', 'node scripts/check-recompute-equality.test.mjs'],
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
    ['Helm gates (HELMGATE-DECOUPLE-1: no helm-path changes, skipped)', 'node -e "1"',
      { notRun: 'HELMGATE-DECOUPLE-1 scoping — this push touches no helm path, so the drift gates were not executed' }],
  ]),
  ['§20 anchor binding (unit)',    'node chaingraph/kernels/anchor-binding.test.mjs'],
  ['§13.12 SD-JWT round-trip',     'node chaingraph/exporters/sd-export-roundtrip.test.mjs'],
  ['Chain runners up-to-date',    'node scripts/gen-chain-runners.mjs --check'],
  ['Workbench up-to-date',        'node scripts/gen-workbench.mjs --check'],
  ['Canvas up-to-date',           'node scripts/gen-canvas.mjs --check'],
  ['Wayfinder freshness',         'node scripts/gen-wayfinder.mjs --check'],
  ['Node-page chrome (nav/footer)', 'node scripts/check-node-page-chrome.mjs'],
  ['FV pilot badge freshness (FV-BADGE-1)', 'node scripts/inject-fv-pilot-badges.mjs --check'],
  ['FV pilot evidence-vector shape (FV-EVIDENCE-VECTOR-1)', 'node scripts/check-fv-pilot-badge.mjs --check'],
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
  ['Amendment detection gate (CB7-AMENDMENT-DETECT-1)', 'node scripts/check-amendment-detection.mjs'],
  ['Amendment detection gate fixture proof', 'node scripts/check-amendment-detection.test.mjs'],
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
  // The CONTROL for the L1 chain edge-contract checker — not a check on the estate. In-memory
  // fixture chains (right kernels / wrong edge must fail, known-good must pass) plus mutation
  // controls that flip each fact and require the verdict to move. Hard here because a red
  // selftest means the tool itself is broken — same shape as the "FV floor coverage fixture
  // proof" entry above. The checker's own chain verdicts stay ADVISORY (block below).
  ['Chain L1 edge-contract selftest (CHAIN-FV-L1-1)', 'node scripts/check-chain-edge-contracts.selftest.mjs'],
];

// The one inline gate that lives below the loop rather than in GATES. Named once
// here so the totals can be derived from the real run list instead of a literal.
const MFSTSEC_LABEL = 'mfstSec presence (every tool)';
// PREFLIGHT-KEEPGOING-1: the run list is GATES plus that inline check. DERIVED at
// runtime — a gate added to GATES raises this by itself, and nothing anywhere
// hardcodes how many gates preflight runs.
const RUN_LIST_SIZE = GATES.length + 1;

// PREFLIGHT-KEEPGOING-1: an --expect-red id that matches no gate would waive
// nothing while reading as diligence, so it is a hard error before any gate runs.
if (EXPECT_RED.length) {
  const labels = [...GATES.map(([l]) => l), MFSTSEC_LABEL];
  const unmatched = EXPECT_RED.filter((id) => !labels.some((l) => l.toLowerCase().includes(id.toLowerCase())));
  if (unmatched.length) {
    console.error(`❌ --expect-red: no gate label matches ${unmatched.map((u) => `"${u}"`).join(', ')}.`);
    console.error('   Match is a case-insensitive SUBSTRING of the gate label (e.g. "CGSHARD-1").');
    console.error('   Fix the id or drop the flag — a declaration that waives nothing is worse than none.');
    process.exit(2);
  }
}

let failed = null;
const timings = []; // [label, ms]
// PREFLIGHT-KEEPGOING-1: per-gate outcome ledger — { label, state, ms, note }.
// state ∈ PASS | FAIL | EXPECTED-RED | DID-NOT-RUN. Written on every path, read
// ONLY by the --keep-going summary, so it cannot affect default behaviour.
const results = [];
let waivedCount = 0;
const suiteStart = Date.now();

if (KEEP_GOING) {
  console.log('▶ preflight --keep-going: running EVERY gate and collecting every result.');
  console.log('  (the default no-flag run is unchanged and still stops at the first red)');
  if (EXPECT_RED.length) {
    console.log(`  --expect-red declared for THIS invocation only: ${EXPECT_RED.join(', ')}`);
  }
  console.log('');
}

for (const [label, cmd, meta] of GATES) {
  // A slot the runner itself replaced with a no-op (helm scoping, no touched floor
  // files) DID NOT RUN. Under --keep-going say exactly that; a no-op's exit 0 is
  // absence of a result, never a pass.
  if (KEEP_GOING && meta?.notRun) {
    console.log(`⊘ ${label} … DID NOT RUN`);
    results.push({ label, state: 'DID-NOT-RUN', ms: 0, note: meta.notRun });
    continue;
  }
  process.stdout.write(`▶ ${label} … `);
  const t0 = Date.now();
  try {
    execSync(cmd, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const ms = Date.now() - t0;
    timings.push([label, ms]);
    console.log(`✓ (${ms}ms)`);
    const declared = KEEP_GOING ? expectedRedFor(label) : null;
    results.push({
      label,
      state: 'PASS',
      ms,
      note: declared ? `declared --expect-red ${declared} but PASSED — the declaration was unnecessary` : meta?.note,
    });
  } catch (e) {
    const ms = Date.now() - t0;
    timings.push([label, ms]);
    const declared = KEEP_GOING ? expectedRedFor(label) : null;
    console.log(declared ? `✗ (${ms}ms) [EXPECTED-RED via --expect-red ${declared}]` : `✗ (${ms}ms)`);
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    console.log('\n' + out.trim() + '\n');
    results.push({
      label,
      state: declared ? 'EXPECTED-RED' : 'FAIL',
      ms,
      note: declared ? `red, waived for this invocation only by --expect-red ${declared}` : meta?.note,
    });
    if (failed === null) failed = label; // where a fail-fast run stops
    if (!KEEP_GOING) break;
  }
}

// mfstSec presence — every tool HTML must carry the manifest panel (CI hard gate).
// `!failed` keeps the default fail-fast path identical; `|| KEEP_GOING` is what
// makes the run-all mode actually run all.
if (!failed || KEEP_GOING) {
  process.stdout.write('▶ mfstSec presence (every tool) … ');
  const t0 = Date.now();
  const missing = readdirSync(resolve(REPO, 'tools'))
    .filter(f => f.endsWith('.html'))
    .filter(f => !readFileSync(resolve(REPO, 'tools', f), 'utf8').includes('mfstSec'));
  const ms = Date.now() - t0;
  timings.push(['mfstSec presence (every tool)', ms]);
  if (missing.length) {
    const declared = KEEP_GOING ? expectedRedFor(MFSTSEC_LABEL) : null;
    console.log(declared ? `✗ (${ms}ms) [EXPECTED-RED via --expect-red ${declared}]` : `✗ (${ms}ms)`);
    console.log('\nTools missing the mfstSec manifest panel:\n  ' + missing.join('\n  ') + '\n');
    results.push({
      label: MFSTSEC_LABEL,
      state: declared ? 'EXPECTED-RED' : 'FAIL',
      ms,
      note: declared ? `red, waived for this invocation only by --expect-red ${declared}` : undefined,
    });
    if (failed === null) failed = 'mfstSec presence';
  } else {
    console.log(`✓ (${ms}ms)`);
    results.push({ label: MFSTSEC_LABEL, state: 'PASS', ms });
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

// ── PREFLIGHT-KEEPGOING-1: run-all summary ──────────────────────────────────
// Only reached with --keep-going / --expect-red. The default path skips this
// entire block and falls straight through to the unchanged fail-fast exit below.
if (KEEP_GOING) {
  const of = (state) => results.filter((r) => r.state === state);
  const passed = of('PASS');
  const hardFails = of('FAIL');
  const waived = of('EXPECTED-RED');
  const didNotRun = of('DID-NOT-RUN');
  waivedCount = waived.length;

  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  const rule = '─'.repeat(78);
  console.log(`\n${rule}`);
  console.log('KEEP-GOING SUMMARY — every gate reached, nothing masked by an earlier red');
  console.log(rule);
  for (const r of results) {
    console.log(`  ${pad(r.state, 13)}${String(r.ms).padStart(7)}ms  ${r.label}`);
    if (r.note) console.log(`                             ↳ ${r.note}`);
  }
  console.log(rule);
  console.log('TOTALS — derived from the gate list at runtime, never hardcoded');
  console.log(`  gates in the run list ...... ${RUN_LIST_SIZE}  (GATES array + the inline ${MFSTSEC_LABEL} check)`);
  console.log(`  results recorded ........... ${results.length}`);
  console.log(`  PASS ....................... ${passed.length}`);
  console.log(`  FAIL (unwaived) ............ ${hardFails.length}`);
  console.log(`  EXPECTED-RED (waived) ...... ${waived.length}${waived.length ? `   [declared this run: ${EXPECT_RED.join(', ')}]` : ''}`);
  console.log(`  DID NOT RUN ................ ${didNotRun.length}   ⛔ its own category — never counted as a pass`);
  const accounted = passed.length + hardFails.length + waived.length + didNotRun.length;
  console.log(`  accounted for .............. ${accounted}`);
  console.log(rule);

  if (failed) {
    const firstRed = results.findIndex((r) => r.state === 'FAIL' || r.state === 'EXPECTED-RED');
    console.log(`  A bare fail-fast run would have STOPPED at: ${results[firstRed].label}`);
    console.log(`  and would have reported nothing about the ${results.length - firstRed - 1} gate(s) after it.`);
    console.log(rule);
  }

  // FAIL CLOSED (SO #34c): a result count that does not reconcile with the run
  // list means gates went unrecorded, and an unrecorded gate is not a green one.
  if (results.length !== RUN_LIST_SIZE || accounted !== results.length) {
    console.error(`\n❌ preflight --keep-going: RESULT ACCOUNTING MISMATCH — ${RUN_LIST_SIZE} gate(s) in the run list, ${results.length} result(s) recorded, ${accounted} categorised.`);
    console.error('   Some gate produced no result, so this run proves nothing. Treat it as unverified.');
    process.exit(1);
  }

  if (hardFails.length) {
    console.error(`\n❌ preflight --keep-going FAILED: ${hardFails.length} unwaived gate(s) red (of ${RUN_LIST_SIZE} in the run list).`);
    for (const r of hardFails) console.error(`   ✗ ${r.label}`);
    console.error('   Fix these before pushing (each would have failed CI).');
    process.exit(1);
  }
}

if (failed && !KEEP_GOING) {
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

// ── Advisory (non-blocking): L1 chain edge contracts ────────────────────────
// CHAIN-FV-L1-1. Ladder level L1 = "edge contracts machine-checked" — ⛔ NOT
// "formally verified" (L2 contract composition and L3 end-to-end properties are
// separate, unbuilt levels). Reports the per-chain verdict spread so a new or
// re-ordered chain that contradicts the node consumes/feeds map is visible
// pre-push. ADVISORY BY DESIGN, exit 0 always: the live baseline carries known
// L1-fail chains, and promotion to a hard gate is a SEPARATE later decision to
// be taken once that baseline is triaged — never a side effect of this line.
process.stdout.write('▶ L1 chain edge contracts (advisory) … ');
try {
  const out = execSync('node scripts/check-chain-edge-contracts.mjs --quiet --json', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const s = JSON.parse(out).summary;
  console.log(`${s['L1-pass']} pass / ${s['L1-fail']} fail / ${s['L1-indeterminate']} indeterminate across ${s.chains_walked} chains (${s.edges_decided}/${s.edges_total} edges decided)`);
} catch { console.log('(advisory check unavailable — skipped)'); }

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

if (KEEP_GOING && waivedCount) {
  // Reached only via --expect-red: every gate ran, the declared one(s) are still
  // red, and saying "PASSED" here would be the exact overclaim this mode removes.
  console.log(`\n⚠️  preflight COMPLETE — every gate reached; ${waivedCount} DECLARED-RED gate(s) waived (${EXPECT_RED.join(', ')}), every other gate green.`);
  console.log('   This is NOT an unqualified pass. The waived gate(s) above are still red.');
} else {
  console.log('\n✅ preflight PASSED — all hard CI gates green. Safe to push.');
}
