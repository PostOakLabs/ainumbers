#!/usr/bin/env node
// check-fv-floor-coverage.mjs — FV property-test floor coverage + freshness ratchet (FV-COVERAGE-GATE-1).
//
// SCOPE (state this on every read): "FV floor" here means the PBT-floor / enumeration-artifact tier
// (FV-PBT-FLOOR-BUILD-SPEC.md) — a hand-rolled, zero-dep property-test file per kernel
// (chaingraph/kernels/__proptests__/<tool_id>.proptest.mjs), run by scripts/run-proptests.mjs. This is
// NOT Dafny. Blanket class-C Dafny proving stays FROZEN (flagship/C1-only, FV-PBT-FLOOR-BUILD-SPEC.md
// §7) — this gate must never be read as requiring a Dafny proof per kernel. Internal engineering QC
// only, no assurance-grade vocabulary, no reliance framing (FV-PBT-FLOOR-BUILD-SPEC.md §1).
//
// WHY: FV-PROPFLOOR-INFRA-1 built run-proptests.mjs (runs whatever *.proptest.mjs files exist; an empty
// directory is a no-op PASS) but deliberately left coverage/digest-matching unbuilt — "chosen here, NOT
// built here" (run-proptests.mjs header). Without a ratchet, the campaign floors 578 kernels over weeks
// while new kernels keep landing un-floored, and the gap refills behind the rollout. This gate is that
// ratchet, modeled directly on check-compute-proof-coverage.mjs (§18) and its provenance discriminator
// (S18-BASELINE-GUARD-1) plus check-s18-digest-freshness.mjs's digest-recompute shape.
//
// WHAT COUNTS AS FLOORED (never on file presence alone):
//   A live kernel is FLOORED only if chaingraph/kernels/__proptests__/<tool_id>.proptest.mjs exists AND
//   carries a header line `// kernel_digest_at_authoring: sha256:<hex>` (FV-PBT-FLOOR-BUILD-SPEC.md §5's
//   own maintenance-wiring vocabulary) whose value equals sourceDigest() of the CURRENT kernel source
//   (the same canonical §17 digest function every other identity/freshness gate in this repo uses — see
//   chaingraph/kernels/_buildid.mjs). Three states:
//     - missing : no floor file, or a floor file with no valid header digest (a floor file that never
//                 recorded which kernel revision it was authored against is not a binding claim — treated
//                 exactly like absence, per the "gate on the artifact AND its digest, never on presence
//                 alone" instruction).
//     - stale   : floor file present with a header digest, but it does not match the kernel as it stands
//                 now (the kernel moved after the floor was authored, and nobody re-verified it).
//     - floored : header digest matches the current kernel source.
//   unfloored = missing ∪ stale.
//
// DENOMINATOR: derived LIVE from the kernel tree every run — chaingraph.meta.json's order.nodes cross-
// referenced against chaingraph/graph/nodes/<id>.json (the per-node SHARD files, not the assembled
// monolith — same reasoning as gen-kernel-identity.mjs's --shard mode: a brand-new kernel's shard file
// exists before the next assemble-and-land step folds it into chaingraph.json, and this gate must see it
// on THAT push, not one push later). Never hardcode a count; never quote one in prose.
//
// RATCHET, honest (mirrors check-compute-proof-coverage.mjs): baseline = the un-floored set pinned at
// --update-baseline time. It may only SHRINK. Two independent checks guard against silent growth hiding
// inside a flat or shrinking total (the "swap" failure mode S18-BASELINE-GUARD-1 named):
//   (1) REGRESSION — any node present in baseline.known_live_nodes but NOT in baseline.unfloored_nodes,
//       now appearing unfloored: it was floored (or not yet live) before and lost its floor. ALWAYS
//       fails, independent of the ceiling, and --update-baseline REFUSES to absorb it.
//   (2) NEW-UNFLOORED — any node NOT present in baseline.known_live_nodes, now appearing unfloored: a
//       brand-new kernel shipped without its floor artifact in the same push. Unlike §18's legitimate
//       gpu:true/deferred carve-out, this row's own instruction is unconditional — "every kernel that
//       gets BUILT must ship its FV floor artifact in the same push" — so there is no legitimate new-node
//       deferral here. ALWAYS fails, independent of the ceiling, and --update-baseline REFUSES to absorb
//       it. (Contrast with check-compute-proof-coverage.mjs, where a brand-new gpu:false node MAY
//       legitimately defer with a reason — that asymmetry is deliberate, not a copy-paste gap.)
//   (3) CEILING — unfloored.length > baseline.unfloored is also checked as a backstop, in case a
//       renamed/removed node produces a count change that (1)/(2) don't name individually.
//
// Usage:
//   node scripts/check-fv-floor-coverage.mjs                  strict (CI + preflight): exit 1 on violation
//   node scripts/check-fv-floor-coverage.mjs --summary         counts only, exit 0
//   node scripts/check-fv-floor-coverage.mjs --list-unfloored  print every unfloored node + reason, exit 0
//   node scripts/check-fv-floor-coverage.mjs --update-baseline rewrite the baseline to the current state

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CG_DIR = resolve(REPO, 'chaingraph');
const META_PATH = resolve(CG_DIR, 'chaingraph.meta.json');
const NODES_DIR = resolve(CG_DIR, 'graph', 'nodes');
const KDIR = resolve(CG_DIR, 'kernels');
const PROPTESTS_DIR = resolve(KDIR, '__proptests__');
const BASELINE_PATH = resolve(HERE, 'fv-floor-coverage-baseline.json');

const SUMMARY = process.argv.includes('--summary');
const LIST_UNFLOORED = process.argv.includes('--list-unfloored');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');

const HEADER_RE = /kernel_digest_at_authoring:\s*(sha256:[0-9a-f]{64})/i;

// ── classifyFloor ────────────────────────────────────────────────────────────────────────────────
// Pure function: given a kernel's current source text, its floor file's text (or null if absent), and
// the canonical sourceDigest() function, return one of missing/stale/floored + a human reason. Injectable
// so the unit test can construct fixtures without touching disk (mirrors computeStaleness() in
// check-s18-digest-freshness.mjs).
export async function classifyFloor(kernelSource, floorSource, sourceDigestFn) {
  if (floorSource == null) return { state: 'missing', reason: 'no __proptests__ floor file' };
  const m = floorSource.match(HEADER_RE);
  if (!m) return { state: 'missing', reason: 'floor file present but has no valid "kernel_digest_at_authoring: sha256:…" header — presence alone is not a binding claim' };
  const recorded = m[1];
  const current = await sourceDigestFn(kernelSource);
  if (recorded !== current) {
    return { state: 'stale', reason: `floor file's recorded digest (${recorded}) does not match the kernel as it stands now (${current}) — the kernel moved since the floor was authored`, recorded, current };
  }
  return { state: 'floored', reason: 'floor file digest matches current kernel source', recorded, current };
}

// ── deriveLiveKernels ────────────────────────────────────────────────────────────────────────────
// Denominator, derived live every run from chaingraph.meta.json order.nodes + the per-node SHARD files
// (never the assembled monolith — a brand-new kernel's shard exists before the next assemble-and-land
// step, and this gate must see it on the push that adds it, not one push later). Returns [{tool_id}].
// A node id with no shard file on disk yet, or whose shard has status !== 'live', is out of scope (same
// "not yet a coverage subject" reasoning gen-kernel-identity.mjs --shard applies).
function deriveLiveKernels() {
  if (!existsSync(META_PATH)) return { liveKernels: [], note: `no chaingraph.meta.json at ${META_PATH}` };
  const meta = JSON.parse(readFileSync(META_PATH, 'utf8'));
  const orderIds = meta.order?.nodes ?? [];
  const live = [];
  for (const id of orderIds) {
    const shardPath = resolve(NODES_DIR, `${id}.json`);
    if (!existsSync(shardPath)) continue; // no shard file yet — not this gate's job (gen-kernel-identity owns the skip-gap cross-check)
    let node;
    try { node = JSON.parse(readFileSync(shardPath, 'utf8')); } catch { continue; }
    if (node.status !== 'live') continue;
    const tool_id = node.tool_id || id;
    if (!existsSync(resolve(KDIR, `${tool_id}.kernel.mjs`))) continue; // no kernel implementation — nothing to floor
    live.push({ tool_id, name: node.mcp_name || tool_id });
  }
  return { liveKernels: live, note: null };
}

// ── evaluateCoverage ─────────────────────────────────────────────────────────────────────────────
// Pure over an already-derived live-kernel list + injectable file readers, so the unit test can feed a
// small fixture set instead of the full tree.
export async function evaluateCoverage(liveKernels, readKernelSource, readFloorSource, sourceDigestFn) {
  const results = [];
  for (const k of liveKernels) {
    const kernelSource = readKernelSource(k.tool_id);
    const floorSource = readFloorSource(k.tool_id);
    const classified = await classifyFloor(kernelSource, floorSource, sourceDigestFn);
    results.push({ ...k, ...classified });
  }
  const unfloored = results.filter((r) => r.state === 'missing' || r.state === 'stale');
  const floored = results.filter((r) => r.state === 'floored');
  return { results, unfloored, floored, total: results.length };
}

// ── findProvenanceViolations ─────────────────────────────────────────────────────────────────────
// Mirrors findRegressions() in check-compute-proof-coverage.mjs, split into the two named failure modes
// this row requires (see header comment): a REGRESSION (was known + floored, now unfloored) and a
// NEW-UNFLOORED (never seen before, ships unfloored) are both always-fail, independent of the ceiling.
function findProvenanceViolations(currentUnfloored, oldBaseline) {
  const unfilooredBefore = new Set(oldBaseline?.unfloored_nodes ?? []);
  const knownBefore = new Set(oldBaseline?.known_live_nodes ?? []);
  const regressions = [];
  const newUnfloored = [];
  for (const r of currentUnfloored) {
    if (unfilooredBefore.has(r.name)) continue; // already unfloored at the last pin — no change to judge
    if (knownBefore.has(r.name)) regressions.push(r);
    else newUnfloored.push(r);
  }
  return { regressions, newUnfloored };
}

// ── CLI entry point ──────────────────────────────────────────────────────────────────────────────
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {

const { sourceDigest } = await import(pathToFileURL(resolve(KDIR, '_buildid.mjs')).href);
const { liveKernels, note } = deriveLiveKernels();
if (note) { console.error(`⚠ ${note}`); }

function readKernelSource(tool_id) {
  const p = resolve(KDIR, `${tool_id}.kernel.mjs`);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}
function readFloorSource(tool_id) {
  const p = resolve(PROPTESTS_DIR, `${tool_id}.proptest.mjs`);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

const { results, unfloored, floored, total } = await evaluateCoverage(liveKernels, readKernelSource, readFloorSource, sourceDigest);

if (UPDATE_BASELINE) {
  const oldBaseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : null;
  // First-ever pin: nothing to discriminate against yet — every live kernel is simply "known now."
  const { regressions, newUnfloored } = oldBaseline ? findProvenanceViolations(unfloored, oldBaseline) : { regressions: [], newUnfloored: [] };
  if (regressions.length || newUnfloored.length) {
    console.error(`✗ --update-baseline REFUSED — provenance violation(s) found; a baseline rewrite must never absorb these silently:`);
    for (const r of regressions) console.error(`  • REGRESSION: ${r.name} — was floored (or not yet live) at the last pin, now unfloored (${r.reason})`);
    for (const r of newUnfloored) console.error(`  • NEW-UNFLOORED: ${r.name} — brand-new live kernel with no floor artifact (every new kernel must ship its floor in the same push)`);
    console.error('  If this is deliberate, that is a Tim call — do not run --update-baseline to absorb it.');
    process.exit(1);
  }
  const baseline = {
    _comment: 'Ratchet ceiling for the FV property-test floor coverage gate (FV-COVERAGE-GATE-1). Counts only go DOWN as the FV-PROPFLOOR-SHARD-* rollout lands. known_live_nodes is the provenance snapshot the regression/new-unfloored discriminators read — every live kernel name as of this pin. Regenerate with: node scripts/check-fv-floor-coverage.mjs --update-baseline',
    unfloored: unfloored.length,
    unfloored_nodes: unfloored.map((r) => r.name).sort(),
    known_live_nodes: liveKernels.map((k) => k.name).sort(),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`✓ baseline written: ${unfloored.length} unfloored kernel(s) of ${total} live → ${BASELINE_PATH}`);
  process.exit(0);
}

if (SUMMARY || LIST_UNFLOORED) {
  console.log(`FV floor coverage (PBT-floor tier, not Dafny) — live kernels: ${total} | floored: ${floored.length} | unfloored: ${unfloored.length}`);
  if (LIST_UNFLOORED) for (const r of unfloored) console.log(`  ${r.state.toUpperCase()}: ${r.name} — ${r.reason}`);
  process.exit(0);
}

// ── strict gate ──────────────────────────────────────────────────────────────────────────────────
let failed = false;

if (existsSync(BASELINE_PATH)) {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const ceiling = baseline.unfloored ?? Infinity;
  const { regressions, newUnfloored } = findProvenanceViolations(unfloored, baseline);

  if (regressions.length) {
    failed = true;
    console.error(`\n✗ FV floor coverage REGRESSION — ${regressions.length} node(s) were floored (or not yet live) at the last pin and are now unfloored:`);
    for (const r of regressions) console.error(`  • ${r.name} — ${r.reason}`);
    console.error('  If deliberate, that is a Tim call — do not run --update-baseline to absorb it silently.');
  }
  if (newUnfloored.length) {
    failed = true;
    console.error(`\n✗ FV floor coverage NEW-UNFLOORED — ${newUnfloored.length} brand-new live kernel(s) shipped with no floor artifact:`);
    for (const r of newUnfloored) console.error(`  • ${r.name} — ${r.reason}`);
    console.error('  Every kernel that gets BUILT must ship its floor artifact (chaingraph/kernels/__proptests__/<tool_id>.proptest.mjs, header-stamped) in the SAME push. This is unconditional — unlike §18, there is no legitimate deferral for a new kernel here.');
  }
  if (unfloored.length > ceiling) {
    failed = true;
    console.error(`\n✗ FV floor coverage ratchet FAILED — unfloored count is ${unfloored.length}, baseline ceiling is ${ceiling} (counts only go DOWN).`);
    console.error('  Either author the floor file(s) now, or if this is a deliberate, Tim-approved addition: node scripts/check-fv-floor-coverage.mjs --update-baseline');
  }
} else {
  console.error('⚠ no fv-floor-coverage-baseline.json — run --update-baseline to pin the ratchet (not blocking).');
}

if (unfloored.length) {
  console.error(`\nFV floor coverage — ${unfloored.length} of ${total} live kernel(s) unfloored:`);
  for (const r of unfloored) console.error(`  • ${r.name} — ${r.state} — ${r.reason}`);
}

if (failed) process.exit(1);
console.log(`✓ FV floor coverage clean (ratchet) — ${floored.length}/${total} live kernels floored, ${unfloored.length} unfloored (≤ baseline). Scope: PBT-floor tier only, not Dafny.`);

} // IS_MAIN
