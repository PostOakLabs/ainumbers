#!/usr/bin/env node
// check-recompute-equality.mjs — §18 RECOMPUTE-EQUALITY gate (STANDING ORDER #34, first implementation).
//
// WHY THIS EXISTS. On 2026-08-11, 20 counted-proven nodes were found carrying a §18 proof over
// journal.output = {}. Every gate was green: check-compute-proof-coverage.mjs accepts a journal whose
// output is "any non-null non-array object", and {} satisfies that. The seals were real and verified —
// they simply proved that an un-awaited async compute(pp) had committed nothing. The host repeated the
// guest's bug byte-for-byte, so checker and checked shared the identical defect. That is SO #34's named
// shape: SELF-ATTESTED PROVENANCE VALIDATED BY A SELF-CONSISTENT CHECKER.
//
// ⛔ WHY NOT A THRESHOLD. A "journal.output must have >= 2 keys" heuristic false-fails two legitimate
// single-key nodes (510-digital-asset-regulatory-classifier, art-274-compile-work-mandate) — and any
// threshold is a classifier, which produces the next false green. This gate uses no threshold, no key
// count, and no emptiness test anywhere.
//
// ✅ THE TEST: RECOMPUTE-EQUALITY. Re-execute the kernel from the PRIMARY SOURCE (the bytes on disk) over
// the node's published conformance vectors, and require jcs(journal.output) === jcs(recompute). Exact by
// construction: the receipt's claim IS "journal = f(inputs)", so the test is the claim's definition rather
// than a proxy for it. The two single-key nodes pass automatically, because recompute returns their single
// key. It can only false-fail on a NONDETERMINISTIC kernel — which is itself a defect this gate should catch.
//
// ⛔ SANDBOXED. Recompute executes kernel JavaScript, so it runs inside the vendored QuickJS-ng WASM VM
// (the same engine the §18 guest is pinned to) with no fs, no net, no process and no require. There is no
// bare require/eval/dynamic-import of kernel source anywhere in this gate or in scripts/recompute-lib.mjs.
// The canary negative control (a kernel containing require('fs')) is in check-recompute-equality.test.mjs.
//
// SCOPE. Live nodes carrying a compute_proof. Two structural exclusions, both pre-existing and both shared
// with vm-parity-gate.mjs — never conveniences:
//   - OCG §25 ocg-private-input@1 nodes: buildArtifact's first argument is the caller's PRIVATE WITNESS,
//     never the artifact's own policy_parameters, so replaying a published vector cannot succeed BY
//     CONSTRUCTION (SPEC §18.3: "recompute becomes unavailable to third parties"). Detected by a static
//     scan of the kernel source — this gate never imports kernel source into its own process.
//   - gpu:true nodes are not excluded here: the gpu flag governs whether §18 MANDATES a proof, not whether
//     a receipt that EXISTS must be honest.
//
// QUARANTINE (scripts/recompute-equality-quarantine.json). Nodes whose receipts are known NOT to reproduce
// today, each named individually with its diagnosed cause. Counts only go DOWN: if a quarantined node
// starts reproducing, the gate FAILS telling you to delete the entry, so the list can never quietly outlive
// the defect. ⛔ It is not a threshold and not a classifier — no node is ever excluded by a rule, only by
// name plus a written cause.
//
// Usage:
//   node scripts/check-recompute-equality.mjs              strict (CI): exit 1 on any unquarantined failure
//   node scripts/check-recompute-equality.mjs --summary    counts only, exit 0
//   node scripts/check-recompute-equality.mjs --only <id>  run a single tool_id (diagnosis)
//   node scripts/check-recompute-equality.mjs --json       machine-readable report on stdout

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recomputeJournalOutput, SANDBOX_MECHANISM, KERNELS_DIR } from './recompute-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CG_PATH = resolve(REPO, 'chaingraph', 'chaingraph.json');
const QUARANTINE_PATH = resolve(HERE, 'recompute-equality-quarantine.json');

// §25 ocg-private-input@1 — static source scan, never an import (see the SCOPE note above).
export function isPrivateInputKernel(kernelSource) {
  return /private_input_profile\s*:\s*['"]ocg-private-input@\d+['"]/.test(kernelSource);
}

/**
 * Pure evaluator — given the recompute results and the quarantine, decide the gate's verdict.
 * Separated from I/O so the test file can drive it with synthetic inputs (and so a mutation test can
 * confirm every path actually fails when a value is flipped).
 */
export function evaluateResults(results, quarantine) {
  const quarantined = new Map((quarantine?.nodes ?? []).map((q) => [q.tool_id, q]));
  const failures = [];   // a receipt that does not reproduce and is NOT quarantined
  const cured = [];      // a quarantined receipt that DOES reproduce now — ratchet says remove the entry
  const excused = [];    // quarantined and still not reproducing
  const matched = [];
  for (const r of results) {
    if (r.state === 'match') {
      if (quarantined.has(r.tool_id)) cured.push(r);
      else matched.push(r);
      continue;
    }
    if (quarantined.has(r.tool_id)) excused.push({ ...r, cause: quarantined.get(r.tool_id).cause });
    else failures.push(r);
  }
  const stale = [...quarantined.keys()].filter((id) => !results.some((r) => r.tool_id === id));
  return { failures, cured, excused, matched, staleQuarantineEntries: stale, ok: failures.length === 0 && cured.length === 0 && stale.length === 0 };
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const SUMMARY = process.argv.includes('--summary');
  const JSON_OUT = process.argv.includes('--json');
  const onlyIdx = process.argv.indexOf('--only');
  const ONLY = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;

  const cg = JSON.parse(readFileSync(CG_PATH, 'utf8'));
  const quarantine = existsSync(QUARANTINE_PATH) ? JSON.parse(readFileSync(QUARANTINE_PATH, 'utf8')) : { nodes: [] };

  let candidates = (cg.nodes ?? []).filter((n) => n.status === 'live' && (n.compute_proof || n.audit_signature?.compute_proof));
  if (ONLY) candidates = candidates.filter((n) => n.tool_id === ONLY);

  const t0 = Date.now();
  const results = [];
  let skippedPrivate = 0;
  for (const node of candidates) {
    const kp = resolve(KERNELS_DIR, `${node.tool_id}.kernel.mjs`);
    if (existsSync(kp) && isPrivateInputKernel(readFileSync(kp, 'utf8'))) { skippedPrivate++; continue; }
    const r = await recomputeJournalOutput(node);
    results.push({ tool_id: node.tool_id, mcp_name: node.mcp_name, ...r });
  }
  const elapsed = Date.now() - t0;

  // Under --only the examined set is deliberately a subset, so "this quarantine entry names a node the
  // gate did not examine" is meaningless there — the stale-entry check is a FULL-RUN invariant.
  const verdict = evaluateResults(results, ONLY ? { nodes: (quarantine.nodes ?? []).filter((q) => q.tool_id === ONLY) } : quarantine);

  if (JSON_OUT) {
    console.log(JSON.stringify({ elapsed_ms: elapsed, examined: results.length, skippedPrivate, ...verdict }, null, 2));
    process.exit(verdict.ok ? 0 : 1);
  }

  // DENOMINATOR FIRST — a gate that examined zero receipts passes vacuously and reads identically to one
  // that works. This line is the difference (SO #34 / this row's "state your denominator").
  console.log(`§18 recompute-equality — EXAMINED ${results.length} receipt(s) in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`  sandbox: ${SANDBOX_MECHANISM}`);
  console.log(`  reproduced: ${verdict.matched.length} · quarantined-and-still-failing: ${verdict.excused.length} · unquarantined failures: ${verdict.failures.length} · §25 private-input skipped: ${skippedPrivate}`);

  if (verdict.excused.length && !SUMMARY) {
    console.log('\n  QUARANTINED (named, cause on record — counts only go down):');
    for (const e of verdict.excused) console.log(`    · ${e.tool_id} [${e.state}] — ${e.cause}`);
  }
  for (const f of verdict.failures) {
    console.error(`\n✗ ${f.tool_id} (${f.mcp_name}) — ${f.state}: ${f.detail}`);
  }
  for (const c of verdict.cured) {
    console.error(`\n✗ ${c.tool_id}: quarantined, but its receipt REPRODUCES now — delete its entry from scripts/recompute-equality-quarantine.json (the ratchet only goes down).`);
  }
  for (const s of verdict.staleQuarantineEntries) {
    console.error(`\n✗ quarantine entry ${s} names a node this gate did not examine — remove it or fix the id.`);
  }

  if (SUMMARY) process.exit(0);
  if (!verdict.ok) {
    console.error('\n§18 recompute-equality FAILED. A receipt whose journal.output cannot be reproduced by re-executing its own kernel is not evidence of computation — it is either vacuous, malformed, or STALE (the kernel moved after proving). Re-prove the node, or quarantine it by name with a written cause.');
    process.exit(1);
  }
  console.log(verdict.excused.length
    ? `\n✓ no NEW non-reproducing receipt: ${verdict.matched.length} reproduce, ${verdict.excused.length} remain quarantined by name.`
    : '\n✓ every examined receipt reproduces from its own kernel.');
}
