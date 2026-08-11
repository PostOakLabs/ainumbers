// recompute-lib.mjs — the SHARED INDEPENDENT-DERIVATION primitive (STANDING ORDER #34).
//
// SO #34: "a gate may never read the value it validates from the artifact under test; it must RECOMPUTE
// that value from the primary source." Three defects of 2026-08-11 were the same shape — SELF-ATTESTED
// PROVENANCE VALIDATED BY A SELF-CONSISTENT CHECKER:
//   (1) 26 floor files carried a kernel_digest_at_authoring that was never computed;
//   (2) 20 counted-proven nodes carried a §18 proof over an EMPTY journal, because the host repeated the
//       guest's un-awaited compute(pp) byte-for-byte — checker and checked sharing the identical bug;
//   (3) a stale-reason string asserted "the kernel moved" when git proved it had not.
// SO #34's ruling is explicit that the answer is ONE shared recompute helper, not three detectors. This is
// that helper. Case (2) — journal-output recompute — is implemented here and consumed by
// scripts/check-recompute-equality.mjs. The digest case (1) and the cause-string case (3) are meant to be
// added as further recomputeX() exports beside recomputeJournalOutput(), reusing jcsEqual/isDeterministic.
//
// ⛔ SECURITY RIDER (SO #34, non-optional; phil 2026-08-11). Recomputation means EXECUTING the artifact's
// own kernel JavaScript. The estate's zero-npm rule is a DEPENDENCY policy, NOT a SANDBOX policy: nothing
// stops a kernel containing require('fs') / process.env / network access from running with full CI
// privileges the moment a gate require()s or eval()s it (same class as npm-postinstall RCE, self-authored
// variant). Every recompute in this module therefore runs inside the vendored QuickJS-ng WebAssembly VM
// (chaingraph/vm/kernel-vm.mjs, profile ocg-deterministic-compute@2) — the SAME engine the §18 zkVM guest
// is pinned to, which is SO #34's preferred mechanism ("identical semantics, and it kills an
// engine-divergence class too"). That VM is a WASM sandbox with NO fs, NO net, NO process and NO require
// binding of any kind, so a hostile kernel cannot reach the host: it throws inside the guest instead.
// ⛔ There is deliberately NO bare require()/eval()/vm.runInThisContext path in this file, and no dynamic
// import() of kernel source. The canary negative control lives in check-recompute-equality.test.mjs.
//
// Zero dependencies (node: builtins + the already-vendored in-repo VM only).

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runKernelArtifactInVM } from '../chaingraph/vm/kernel-vm.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..');
export const KERNELS_DIR = resolve(REPO, 'chaingraph', 'kernels');
export const FIXTURES_DIR = resolve(KERNELS_DIR, 'fixtures');

// ── JCS-canonical comparison ────────────────────────────────────────────────────────────────────────
// RFC 8785 key ordering, so a pure key-order difference between the guest's committed journal and a
// host recompute is NOT reported as a mismatch. This is the same canonical form §4/§18 already use.
export function jcs(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(jcs).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + jcs(v[k])).join(',') + '}';
}
export const jcsEqual = (a, b) => jcs(a) === jcs(b);

// ── sandboxed kernel execution ──────────────────────────────────────────────────────────────────────
/**
 * Execute a kernel's canonical buildArtifact(policy_parameters) inside the QuickJS-ng WASM sandbox and
 * return its output_payload. Throws on any guest-side failure — a kernel reaching for a host capability
 * (require, process, fetch, fs) throws INSIDE the guest and never touches the host.
 *
 * buildArtifact — not compute — is the canonical entry point: two compute() return conventions exist
 * across the corpus (bare output_payload vs { output_payload, compliance_flags }) and some kernels fold a
 * host SHA-256 into output_payload only inside buildArtifact. vm-parity-gate.mjs learned this the hard way
 * (running compute() produced false "golden drift" on the envelope kernels); this module reuses its answer.
 */
export async function recomputeInSandbox(kernelSource, policyParameters) {
  const res = await runKernelArtifactInVM(kernelSource, policyParameters);
  return res.output_payload;
}

export const SANDBOX_MECHANISM = 'quickjs-ng WASM (chaingraph/vm/kernel-vm.mjs, ocg-deterministic-compute@2) — no fs, no net, no process, no require';

// ── the §18 journal-output recompute ────────────────────────────────────────────────────────────────
/**
 * RECOMPUTE-EQUALITY for a §18 receipt (SO #34 case 2).
 *
 * The receipt's own claim is "journal.output = f(inputs) for the published program f". This re-executes f
 * from the PRIMARY SOURCE (the kernel bytes on disk) over the node's published conformance vectors and
 * requires jcs(journal.output) === jcs(recompute). It is EXACT BY CONSTRUCTION — the test is the claim's
 * definition, not a proxy for it.
 *
 * ⛔ Deliberately NOT a key-count/non-empty heuristic. A "<2 keys is vacuous" threshold false-fails the two
 * legitimate single-key nodes (510-digital-asset-regulatory-classifier, art-274-compile-work-mandate), and
 * ANY threshold is a classifier, which produces the next false green. A single-key node passes here for
 * free, because recompute returns its single key.
 *
 * Vectors: §18 receipts do not record their own inputs (the journal carries only chaingraph_version,
 * kernel_digest and output), so the candidate input set is the node's published conformance vectors — the
 * only inputs the estate publishes for that kernel, and the set every other §18/§24 gate proves against.
 * The receipt passes if ANY published vector reproduces the committed journal exactly. Measured on the
 * merged estate: 561 of 586 receipts reproduce on vector 0 alone.
 *
 * Returns { state, detail, vectorIndex, vectorName, recomputed }:
 *   'match'       — a published vector reproduces journal.output exactly.
 *   'mismatch'    — no published vector reproduces it. Either the receipt is vacuous/malformed, or the
 *                   kernel has moved since proving (a STALE proof). Both are real §18 defects.
 *   'unreproducible' — every vector threw in the guest. Reported, never silently passed.
 *   'no-fixtures' / 'no-kernel' — the inputs to the test itself are absent; reported as its own state so a
 *                   missing fixture can never read as a pass.
 */
export async function recomputeJournalOutput(node, { kernelsDir = KERNELS_DIR, fixturesDir = FIXTURES_DIR } = {}) {
  const id = node.tool_id;
  const committed = node?.compute_proof?.journal?.output ?? node?.audit_signature?.compute_proof?.journal?.output;
  const kernelPath = resolve(kernelsDir, `${id}.kernel.mjs`);
  const fixturePath = resolve(fixturesDir, `${id}.fixtures.json`);
  if (!existsSync(kernelPath)) return { state: 'no-kernel', detail: `no kernel source at kernels/${id}.kernel.mjs`, vectorIndex: -1 };
  if (!existsSync(fixturePath)) return { state: 'no-fixtures', detail: `no conformance fixtures at kernels/fixtures/${id}.fixtures.json`, vectorIndex: -1 };

  const kernelSource = readFileSync(kernelPath, 'utf8');
  let vectors;
  try { vectors = JSON.parse(readFileSync(fixturePath, 'utf8')).vectors ?? []; }
  catch (e) { return { state: 'no-fixtures', detail: `fixtures unparseable: ${e.message}`, vectorIndex: -1 }; }
  if (!vectors.length) return { state: 'no-fixtures', detail: 'fixtures file has zero vectors', vectorIndex: -1 };

  const throws = [];
  let firstRecompute;
  for (let i = 0; i < vectors.length; i++) {
    let out;
    try { out = await recomputeInSandbox(kernelSource, vectors[i].policy_parameters); }
    catch (e) { throws.push(`${vectors[i].name ?? i}: ${e.message}`); continue; }
    if (firstRecompute === undefined) firstRecompute = out;
    if (jcsEqual(out, committed)) {
      return { state: 'match', detail: '', vectorIndex: i, vectorName: vectors[i].name ?? String(i), recomputed: out };
    }
  }
  if (throws.length === vectors.length) {
    return { state: 'unreproducible', detail: `every published vector threw in the sandbox — ${throws[0]}`, vectorIndex: -1 };
  }
  return {
    state: 'mismatch',
    detail: `journal.output matches NO published vector's recompute (${vectors.length} tried${throws.length ? `, ${throws.length} threw` : ''}); committed=${jcs(committed).slice(0, 100)}`,
    vectorIndex: -1,
    recomputed: firstRecompute,
  };
}
