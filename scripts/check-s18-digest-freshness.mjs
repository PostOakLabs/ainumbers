#!/usr/bin/env node
// check-s18-digest-freshness.mjs — §18 receipt digest-freshness ratchet gate (S18-DIGEST-GATE-1).
//
// WHY: `check-compute-proof-coverage.mjs` (§18 coverage gate) checks that every gpu:false live
// node carries a well-formed compute_proof — receipt type/format, imageId shape, imageId present
// in compute_images, journal.output present. It never compares `journal.kernel_digest` (the digest
// the zkVM guest committed at prove time) against a fresh recompute of the CURRENTLY-DEPLOYED kernel
// source. That is a real, distinct blind spot: a node's kernel can change after it was proven and the
// coverage gate stays green, because it was never checking that axis. Confirmed by two independent
// adjudications (STALE-PROOF-VERIFY-1 CONFIRMED 132/454; S18-CONFIRM-1 independently reached 129/454
// post-#622 via git-history ordering + live verifySeal). See STALE-PROOF-AUDIT-2026-07-25.md,
// S18-CONFIRM-2026-07-25.md, S18-DENY-2026-07-25.md at workspace root for the full adjudication.
//
// ⚠ THIS IS NOT A VALIDITY CHECK. A "stale" node here still has a REAL, cryptographically valid
// Groth16 seal — CONFORMANCE-STATEMENT-1 verified 427/427 seals and that result stands; S18-CONFIRM-1
// re-ran verifySeal and got 454/454 PASS. Digest freshness (this gate) and seal validity (the §18
// coverage gate + compute-proof.test.mjs) are ORTHOGONAL axes. A stale receipt means "this proof
// attests to an earlier revision of the kernel," never "this proof is fake/invalid/broken." Every
// message this gate prints must say exactly that — see FRESH_LABEL/STALE_LABEL below.
//
// CANONICAL PRODUCER: `chaingraph/kernels/_buildid.mjs` exports `sourceDigest()`, the single named
// "SOURCE OF TRUTH for the §17 kernel_digest" — the same function `gen-kernel-identity.mjs` calls to
// stamp `compute_images[].image_id`. This gate imports and calls that exact function; it never
// hand-rolls a second canonicalization (the failure mode that produced false findings four-plus times
// on this project — see memory project-ainumbers-lc-mletr-disputed).
//
// RATCHET (mirrors check-compute-proof-coverage.mjs): the stale count must not RISE above the pinned
// baseline (scripts/s18-digest-freshness-baseline.json). 129 nodes are stale on `origin/main` right
// now (post-#622) — a strict red-on-any-mismatch gate would break every deploy on day one. The
// baseline is COMPUTED at --update-baseline time, never hand-typed, and tightens as a reprove
// campaign lands (S18-DEFERRED-COVERAGE-1 territory — not this row's job).
//
// Usage:
//   node scripts/check-s18-digest-freshness.mjs                  strict (CI): exit 1 if stale count > baseline
//   node scripts/check-s18-digest-freshness.mjs --summary        counts only, exit 0
//   node scripts/check-s18-digest-freshness.mjs --list-stale     print every stale node with both digests, exit 0
//   node scripts/check-s18-digest-freshness.mjs --update-baseline  rewrite the baseline to the current computed count

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadRatchetBaselineOrExit } from './ratchet-baseline.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CG_PATH = resolve(REPO, 'chaingraph', 'chaingraph.json');
const KDIR = resolve(REPO, 'chaingraph', 'kernels');
const BASELINE_PATH = resolve(HERE, 's18-digest-freshness-baseline.json');

// RATCHET-BASELINE-LOADER-1: the keys this gate reads out of the baseline, declared for the shared
// hard-failing loader. `stale_nodes` is required, not optional — it is what names the NEW stale node(s)
// in the failure output, and `stale_nodes ?? []` would degrade that report to "all of them are new".
const BASELINE_REQUIRED_KEYS = [
  'stale',
  { key: 'stale_nodes', type: 'name-list' },
];
const BASELINE_OPTS = {
  label: '§18 digest-freshness ratchet (S18-DIGEST-GATE-1)',
  repinCommand: 'node scripts/check-s18-digest-freshness.mjs --update-baseline',
};

const SUMMARY = process.argv.includes('--summary');
const LIST_STALE = process.argv.includes('--list-stale');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');

const FRESH_LABEL = 'fresh (journal.kernel_digest matches the currently-deployed kernel source)';
const STALE_LABEL = 'attests to an EARLIER kernel revision (seal is still cryptographically valid — this is a freshness gap, not a broken or fake proof)';

// Static, hand-curated — NOT derived by this gate (no compute-comparison here; §18.2 bars proving in
// CI). Per S18-STALE-SEMANTIC-2026-07-25.md's differential-execution sample: of the 129 stale nodes,
// 123 are non-semantic (only out-of-proof-scope fields like `compliance_flags`/citation text moved —
// `output_payload` itself is byte-identical). These 6 are the ones where `output_payload` differs —
// the only stale nodes anyone might actually act on. List it here so the raw 129-line wall has a
// pointer into it; update by hand if a future differential-execution pass changes the verdict.
const KNOWN_SEMANTIC_STALE = new Set([
  'assess_ai_act_conformity',            // art-05  — applicable_deadline/_note changed (ec72979 omnibus repin)
  'run_treasury_clearing_fit',           // art-48  — new exemption_claimed input + branch logic (70a7467)
  'model_clearing_access_economics',     // art-49  — same extension commit (70a7467)
  'estimate_cross_margin_benefit',       // art-51  — same extension commit (70a7467)
  'build_ai_decision_log_record',        // art-236 — same repin pattern (ec72979)
  'classify_annex3_decisioning_obligations', // art-238 — same repin pattern (ec72979)
]);

// ── computeStaleness ─────────────────────────────────────────────────────────────────────────────
// Pure function over an already-loaded chaingraph object + a tool_id -> kernel-source-text lookup, so
// the unit test can feed a fixture without touching disk. `sourceDigestFn` is injected so the test can
// call the REAL canonical `_buildid.mjs` function (never a stand-in) while still controlling the inputs.
export async function computeStaleness(chaingraph, kernelSourceByToolId, sourceDigestFn) {
  const live = (chaingraph.nodes ?? []).filter((n) => n.status === 'live' && n.gpu === false);
  const results = [];
  for (const node of live) {
    const cp = node.audit_signature?.compute_proof ?? node.compute_proof;
    if (!cp || !cp.journal || typeof cp.journal.kernel_digest !== 'string') continue; // out of scope for THIS gate (coverage gate owns malformed/missing proofs)
    const tool_id = node.tool_id;
    const name = node.mcp_name || tool_id || '(unnamed)';
    const src = kernelSourceByToolId[tool_id];
    if (src === undefined) {
      results.push({ name, tool_id, state: 'NO_KERNEL_FILE', journalDigest: cp.journal.kernel_digest, recomputed: null });
      continue;
    }
    const recomputed = await sourceDigestFn(src);
    const fresh = recomputed === cp.journal.kernel_digest;
    results.push({ name, tool_id, state: fresh ? 'fresh' : 'stale', journalDigest: cp.journal.kernel_digest, recomputed });
  }
  const stale = results.filter((r) => r.state === 'stale' || r.state === 'NO_KERNEL_FILE');
  const fresh = results.filter((r) => r.state === 'fresh');
  return { results, stale, fresh, total: results.length };
}

// ── CLI entry point (only runs when this file is executed directly, not when imported) ─────────────
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {

const { sourceDigest } = await import(pathToFileURL(resolve(KDIR, '_buildid.mjs')).href);
const cg = JSON.parse(readFileSync(CG_PATH, 'utf8'));

// ── calibration (mandatory before trusting any mismatch, per row's done-criteria) ──────────────────
// Prove the instrument against a node whose kernel source has NOT changed since it was proven — any
// live gpu:false node currently classified 'fresh' by this same recompute serves as its own control
// (if the canonicalization were wrong, NOTHING would match and the calibration set would be empty).
async function loadKernelSources(nodes) {
  const map = {};
  for (const n of nodes) {
    const p = resolve(KDIR, `${n.tool_id}.kernel.mjs`);
    if (existsSync(p)) map[n.tool_id] = readFileSync(p, 'utf8');
  }
  return map;
}
const liveGpuFalse = (cg.nodes ?? []).filter((n) => n.status === 'live' && n.gpu === false);
const kernelSources = await loadKernelSources(liveGpuFalse);
const { results, stale, fresh, total } = await computeStaleness(cg, kernelSources, sourceDigest);

if (fresh.length === 0 && total > 0) {
  console.error('✗ CALIBRATION FAILED — zero nodes recomputed as fresh out of ' + total + '. The canonicalization');
  console.error('  path is almost certainly wrong (every mismatch would be a false positive). Refusing to report');
  console.error('  staleness until the instrument is proven sound. See STALE-PROOF-AUDIT-2026-07-25.md §"Calibration".');
  process.exit(1);
}

const trunc = (d) => (d ? d.slice(0, 18) + '…' + d.slice(-4) : '(none — no kernel file on disk)');

if (UPDATE_BASELINE) {
  const baseline = {
    _comment: 'Ratchet ceiling for §18 receipt digest-freshness (S18-DIGEST-GATE-1). Counts only go DOWN as a reprove campaign lands. Regenerate with: node scripts/check-s18-digest-freshness.mjs --update-baseline',
    stale: stale.length,
    stale_nodes: stale.map((r) => r.name).sort(),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`✓ baseline written: ${stale.length} stale node(s) (calibration: ${fresh.length}/${total} fresh, sound) → ${BASELINE_PATH}`);
  process.exit(0);
}

if (SUMMARY || LIST_STALE) {
  console.log(`§18 digest freshness — gpu:false live w/ receipt: ${total} | fresh: ${fresh.length} | stale: ${stale.length}`);
  if (LIST_STALE) {
    for (const r of stale) {
      const flag = KNOWN_SEMANTIC_STALE.has(r.name) ? ' [output_payload differs — see S18-STALE-SEMANTIC-2026-07-25.md]' : '';
      console.log(`  STALE: ${r.name} — journal=${trunc(r.journalDigest)} recomputed=${trunc(r.recomputed)} (${STALE_LABEL})${flag}`);
    }
  }
  process.exit(0);
}

// ── strict gate: ratchet only, never a hard zero-tolerance red (129 stale exist on main today) ─────
let failed = false;
// ⛔ NO existsSync() BRANCH AND NO `?? Infinity` — RATCHET-BASELINE-LOADER-1 (gate-integrity F-11).
// This block used to be `if (existsSync(BASELINE_PATH))` with an else printing "⚠ no baseline …
// (not blocking)", and the ceiling read `baseline.stale ?? Infinity`. Deleting the file — or just that
// one key — made `stale.length > ceiling` false for every conceivable count, so the ratchet stopped
// existing and the gate still printed its green line and exited 0. Both defaults are now hard failures.
// ⚠ This gate has no --update-baseline read path to exempt: its --update-baseline mode pins the current
// state outright and never consults the previous file, so the loader here is unconditional.
const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_REQUIRED_KEYS, BASELINE_OPTS);
{
  const ceiling = baseline.stale;
  if (stale.length > ceiling) {
    failed = true;
    const known = new Set(baseline.stale_nodes ?? []);
    const added = stale.filter((r) => !known.has(r.name));
    console.error(`\n✗ §18 digest-freshness ratchet FAILED — stale count rose to ${stale.length}, baseline ceiling is ${ceiling} (counts only go DOWN).`);
    console.error(`  Note: "stale" means the receipt ${STALE_LABEL} — it is NOT invalid or fake.`);
    if (added.length) {
      console.error('  New stale node(s):');
      for (const r of added) console.error(`    • ${r.name} — journal=${trunc(r.journalDigest)} recomputed=${trunc(r.recomputed)}`);
    }
    console.error('  Either reprove the node(s) now, or if this is an expected consequence of a kernel edit that');
    console.error('  has not yet been reproven, raise the ceiling deliberately: node scripts/check-s18-digest-freshness.mjs --update-baseline');
  }
}

// Always list every stale node, per row's REPORTING requirement — never just a count.
if (stale.length) {
  console.error(`\n§18 digest freshness — ${stale.length} of ${total} gpu:false proven node(s) ${STALE_LABEL}:`);
  for (const r of stale) {
    const flag = KNOWN_SEMANTIC_STALE.has(r.name) ? ' [output_payload differs — see S18-STALE-SEMANTIC-2026-07-25.md]' : '';
    console.error(`  • ${r.name} — journal=${trunc(r.journalDigest)} recomputed=${trunc(r.recomputed)}${flag}`);
  }
}

if (failed) process.exit(1);
console.log(`✓ §18 digest-freshness gate clean (ratchet) — ${fresh.length}/${total} fresh, ${stale.length} stale (≤ baseline). Calibration: ${fresh.length}/${total} nodes matched their own kernel source, instrument sound.`);

} // IS_MAIN
