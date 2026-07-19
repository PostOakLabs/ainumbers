// check-compute-proof-coverage.mjs — §18 Compute-Integrity coverage gate (profile ocg-p18-deterministic).
//
// WHY: §18 (SPEC.md) makes a zkVM compute-integrity proof OPTIONAL at the base-standard level. But for the
// AINumbers reference deployment we want it to be an ENFORCEABLE trust signal, not an optional decoration —
// an OPTIONAL proof an agent can't assume is present is worthless as a credential. This gate is the machine
// check behind the SPEC §18.6 "deterministic-node proof profile": every gpu:false LIVE node must either
//   (a) carry a well-formed, self-consistent `audit_signature.compute_proof` (a real receipt is separately
//       cryptographically verified by chaingraph/kernels/compute-proof.test.mjs — this gate checks the
//       binding/shape + coverage, not the pairing math), OR
//   (b) be explicitly parked with `compute_proof_ready:"deferred"`.
// A gpu:false node that is neither proven nor deferred FAILS. gpu:true nodes are OUT OF SCOPE (heavy /
// Monte-Carlo compute whose in-guest proving cost is prohibitive per SPEC §18.2) and reported informationally.
//
// RATCHET: the count of deferred gpu:false nodes must be <= the pinned baseline (scripts/compute-proof-baseline.json).
// Counts only go DOWN. Proving a deferred node (attach compute_proof, drop the deferred flag) lowers the count;
// the baseline is then tightened with --update-baseline. Once the baseline reaches 0, every new gpu:false node
// must ship a proof or an explicit deferral — no silent backsliding. This mirrors the copy-hallmarks-baseline
// and dead-link-baseline patterns already in this repo.
//
// This is the §18 analogue of check-kernel-coverage.mjs (§17 registration) and verify-proof-surface.mjs (§16
// page surface). Zero-dependency. Wired into scripts/preflight.mjs + .github/workflows/deploy-to-dreamhost.yml.
//
// Usage:
//   node scripts/check-compute-proof-coverage.mjs                  strict (CI): exit 1 on any violation
//   node scripts/check-compute-proof-coverage.mjs --summary        counts only, exit 0
//   node scripts/check-compute-proof-coverage.mjs --list-deferred  print the deferred gpu:false set, exit 0
//   node scripts/check-compute-proof-coverage.mjs --update-baseline rewrite the baseline to the current state

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CG_PATH = resolve(REPO, 'chaingraph', 'chaingraph.json');
const FIXTURES_DIR = resolve(REPO, 'chaingraph', 'kernels', 'fixtures');
const BASELINE_PATH = resolve(HERE, 'compute-proof-baseline.json');

const SUMMARY = process.argv.includes('--summary');
const LIST_DEFERRED = process.argv.includes('--list-deferred');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');

const VALID_RECEIPT_FORMATS = new Set(['groth16-bn254', 'stark']);

// §18.6(b): a deferred node's reason must be a real, non-empty, non-placeholder string — not just present.
const PLACEHOLDER_REASONS = new Set(['todo', 'tbd', 'n/a', 'na', 'placeholder', 'reason', 'deferred', 'pending', 'xxx', 'tk', '...', '-']);
function isPlaceholderReason(s) {
  return PLACEHOLDER_REASONS.has(s.trim().toLowerCase());
}

// ── classifyNode ──────────────────────────────────────────────────────────────────────────────────
// Returns { state: 'proven' | 'deferred' | 'missing', problems: string[] } where a 'proven' node with a
// malformed proof is downgraded to 'missing' with the specific defects listed. Works for any live node
// (gpu:false or gpu:true) — exported so scripts/counts.mjs can derive the ZK100 figure from the same
// classifier this gate uses, per ZK100-MESSAGING-SPEC.md §1.2 ("one classifier, two callers").
export function classifyNode(node) {
  const name = node.mcp_name || node.tool_id || '(unnamed)';
  const cp = node.audit_signature?.compute_proof ?? node.compute_proof; // canonical home is audit_signature (§18.0)
  if (cp) {
    const problems = [];
    if (cp.type !== 'ZkVmReceipt') problems.push(`type must be "ZkVmReceipt" (got ${JSON.stringify(cp.type)})`);
    if (!VALID_RECEIPT_FORMATS.has(cp.receiptFormat)) problems.push(`receiptFormat must be one of ${[...VALID_RECEIPT_FORMATS].join('/')} (got ${JSON.stringify(cp.receiptFormat)})`);
    if (typeof cp.imageId !== 'string' || !cp.imageId.startsWith('sha256:')) problems.push('imageId missing or not sha256:-form');
    if (typeof cp.seal !== 'string' || cp.seal.length === 0) problems.push('seal missing or empty');
    if (!cp.journal || typeof cp.journal !== 'object') problems.push('journal missing');
    else if (cp.journal.output === undefined) problems.push('journal.output missing (the committed public output — MUST equal output_payload, §18.0)');
    // Binding: imageId MUST be published in the node's compute_images (§18.1). Skip only if the images list is
    // absent (a §17 gap that check-kernel-identity coverage owns, not this gate).
    const imgIds = (node.compute_images ?? []).map((i) => i.image_id);
    if (imgIds.length && cp.imageId && !imgIds.includes(cp.imageId)) {
      problems.push(`imageId ${cp.imageId} not present in compute_images (§18.1 binding)`);
    }
    return problems.length ? { name, state: 'missing', problems } : { name, state: 'proven', problems: [] };
  }
  if (node.compute_proof_ready === 'deferred') {
    const reason = node.deferred_reason;
    // §18.6(b): deferral is only a valid park state when a stated, non-empty, non-placeholder reason accompanies it.
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      return { name, state: 'missing', problems: ['compute_proof_ready:"deferred" but deferred_reason is missing or empty (§18.6(b))'] };
    }
    if (isPlaceholderReason(reason)) {
      return { name, state: 'missing', problems: [`deferred_reason is a placeholder (${JSON.stringify(reason)}), needs a true, per-node reason (§18.6(b))`] };
    }
    return { name, state: 'deferred', problems: [] };
  }
  return { name, state: 'missing', problems: ['no compute_proof and no compute_proof_ready:"deferred"'] };
}

// ── zkCoverage ────────────────────────────────────────────────────────────────────────────────────
// Pure function over an already-loaded chaingraph object — the ZK100 figure (ZK100-MESSAGING-SPEC.md §1.1):
// count of ALL live nodes (gpu:false or gpu:true) carrying a valid compute_proof, out of all live nodes in
// scope. Unlike the §18 gate below (which only enforces gpu:false), this counts any live node's proof state —
// the gpu flag is irrelevant to whether a node HAS a real receipt, only to whether the gate mandates one.
export function zkCoverage(chaingraph) {
  const liveNodes = (chaingraph.nodes ?? []).filter((n) => n.status === 'live');
  const states = liveNodes.map(classifyNode);
  const provenNodes = states.filter((r) => r.state === 'proven').length;
  const provenTotal = liveNodes.length;
  const provenPct = provenTotal ? Math.round((100 * provenNodes) / provenTotal) : 0;
  return { provenNodes, provenTotal, provenPct };
}

// ── CLI entry point (only runs when this file is executed directly, not when imported) ─────────────
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {

// ── load ──────────────────────────────────────────────────────────────────────────────────────────
const cg = JSON.parse(readFileSync(CG_PATH, 'utf8'));
const live = (cg.nodes ?? []).filter((n) => n.status === 'live');
const gpuFalse = live.filter((n) => n.gpu === false);
const gpuTrue = live.filter((n) => n.gpu === true);

const results = gpuFalse.map(classifyNode);
const proven = results.filter((r) => r.state === 'proven');
const deferred = results.filter((r) => r.state === 'deferred');
const missing = results.filter((r) => r.state === 'missing');

// ── conformance-fixture presence (§18.0 binding prerequisite) ───────────────────────────────────────
// A §18 proof binds journal.output == the fixture vector's output_payload; a node that declares
// conformance_fixtures:true but ships NO fixtures file (or an empty one) can never be legitimately proven
// and silently escapes golden-parity / engine-parity / prove (all of which iterate over existing fixture
// FILES and vacuously skip absent ones). W38 art-221..226 merged deferred with this exact gap. Every
// gpu:false live node claiming conformance_fixtures:true MUST have <tool_id>.fixtures.json with >=1 vector.
function fixtureGap(node) {
  if (node.conformance_fixtures !== true) return null;
  const name = node.mcp_name || node.tool_id || '(unnamed)';
  const fpath = resolve(FIXTURES_DIR, `${node.tool_id}.fixtures.json`);
  if (!existsSync(fpath)) return { name, reason: `declares conformance_fixtures:true but ${node.tool_id}.fixtures.json is MISSING` };
  let fx;
  try { fx = JSON.parse(readFileSync(fpath, 'utf8')); }
  catch (e) { return { name, reason: `${node.tool_id}.fixtures.json is not valid JSON (${e.message})` }; }
  if (!Array.isArray(fx.vectors) || fx.vectors.length === 0) return { name, reason: `${node.tool_id}.fixtures.json has zero vectors` };
  return null;
}
const fixtureGaps = gpuFalse.map(fixtureGap).filter(Boolean);

// ── --update-baseline ───────────────────────────────────────────────────────────────────────────
if (UPDATE_BASELINE) {
  const baseline = {
    _comment: 'Ratchet ceiling for §18 deferred gpu:false nodes (profile ocg-p18-deterministic). Counts only go DOWN. Regenerate with: node scripts/check-compute-proof-coverage.mjs --update-baseline',
    deferred: deferred.length,
    deferred_nodes: deferred.map((r) => r.name).sort(),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`✓ baseline written: ${deferred.length} deferred gpu:false node(s) → ${BASELINE_PATH}`);
  process.exit(0);
}

// ── --summary / --list-deferred (non-strict) ──────────────────────────────────────────────────────
if (SUMMARY || LIST_DEFERRED) {
  console.log(`§18 compute-proof coverage — gpu:false live: ${gpuFalse.length} | proven: ${proven.length} | deferred: ${deferred.length} | missing: ${missing.length}   (gpu:true out-of-scope: ${gpuTrue.length})`);
  if (LIST_DEFERRED) for (const r of deferred) console.log('  deferred: ' + r.name);
  if (missing.length) for (const r of missing) console.log('  MISSING:  ' + r.name + ' — ' + r.problems.join('; '));
  if (fixtureGaps.length) for (const g of fixtureGaps) console.log('  NO-FIXTURE: ' + g.name + ' — ' + g.reason);
  process.exit(0);
}

// ── strict gate ───────────────────────────────────────────────────────────────────────────────────
let failed = false;

// (1) every gpu:false live node must be proven or deferred; a malformed proof is a MISSING with defects.
if (missing.length) {
  failed = true;
  console.error(`✗ §18 coverage FAILED — ${missing.length} gpu:false live node(s) neither carry a valid compute_proof nor are marked compute_proof_ready:"deferred":`);
  for (const r of missing) console.error(`  • ${r.name} — ${r.problems.join('; ')}`);
  console.error('\nFix each: attach a verified audit_signature.compute_proof (see WAVE-V0.6-SECTION18-MANDATE-BUILD-SPEC.md §2),');
  console.error('or park it with compute_proof_ready:"deferred" (+ a deferred_reason) if its in-guest proving cost is prohibitive (SPEC §18.2/§18.6).');
}

// (1b) conformance-fixture presence: a node claiming conformance_fixtures:true MUST ship a non-empty
// fixtures file — otherwise it can never be legitimately proven and slips through every fixture-driven gate.
if (fixtureGaps.length) {
  failed = true;
  console.error(`\n✗ §18 conformance-fixture coverage FAILED — ${fixtureGaps.length} gpu:false live node(s) declare conformance_fixtures:true but have no usable fixtures file:`);
  for (const g of fixtureGaps) console.error(`  • ${g.name} — ${g.reason}`);
  console.error('\nAuthor chaingraph/kernels/fixtures/<tool_id>.fixtures.json with >=1 vector (policy_parameters + output_payload from compute()),');
  console.error('then run: node chaingraph/kernels/golden-parity.test.mjs --update. A deferred node still needs fixtures to be provable later.');
}

// (2) ratchet: deferred count must not exceed the pinned baseline.
if (existsSync(BASELINE_PATH)) {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const ceiling = baseline.deferred ?? Infinity;
  if (deferred.length > ceiling) {
    failed = true;
    const known = new Set(baseline.deferred_nodes ?? []);
    const added = deferred.filter((r) => !known.has(r.name)).map((r) => r.name);
    console.error(`\n✗ §18 deferred ratchet FAILED — deferred gpu:false count rose to ${deferred.length}, baseline ceiling is ${ceiling} (counts only go DOWN).`);
    if (added.length) console.error('  New deferred node(s): ' + added.join(', '));
    console.error('  Either prove the node(s) now, or — if a deliberate new deferral — raise the ceiling with: node scripts/check-compute-proof-coverage.mjs --update-baseline');
  }
} else {
  console.error('⚠ no compute-proof-baseline.json — run --update-baseline to pin the ratchet (not blocking).');
}

if (failed) process.exit(1);
console.log(`✓ §18 coverage clean — ${proven.length}/${gpuFalse.length} gpu:false live nodes proven, ${deferred.length} deferred (≤ baseline), ${gpuTrue.length} gpu:true out-of-scope.`);

} // IS_MAIN
