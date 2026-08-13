#!/usr/bin/env node
// fv-policy-sign-gate.mjs — FV-POLICY-SIGN-GATE-1
//
// WHAT THIS IS: the auto-sign ELIGIBILITY gate named in
// research/FV-SIGNING-AUTOMATION-2026-08-13.md §stack-1 ("Node policy gate
// ... preflight.mjs pattern"). It answers one question — "may this FV
// artifact be machine-signed right now?" — from explicit, named predicates,
// and returns a machine-readable verdict. Consumed by the signing step
// (FV-SSHSIG-POLICY-KEY-1's helper). ⛔ THIS SCRIPT SIGNS NOTHING and wires
// to no signer — that is out of fence for this WU.
//
// WHY NATIVE, NOT OPA/CONFTEST: same boolean-predicate semantics, a brand
// new toolchain + Rego corpus this estate would have to carry forever —
// fails survives-the-maintainer (Standing Order #0) worse than five
// hand-written JS functions.
//
// CONSUME, DON'T REIMPLEMENT: every predicate below takes its evidence as
// an EXPLICIT INPUT FIELD, already computed by the tool that owns that
// check — this gate never re-derives CI status, kernel-identity freshness,
// or challenge-window expiry itself:
//   - ciChecks         <- caller's own CI query (e.g. `gh pr checks --json`)
//   - kernelIdentity    <- `node chaingraph/kernels/gen-kernel-identity.mjs --check [--shard=<id>]`
//                          (exit 0 => clean:true; nonzero => clean:false)
//   - samplingQuota     <- research/FV-SAMPLING-REGIME-SPEC-2026-08-09.md §4/§6 switching-state
//                          record, ONCE THAT MACHINERY EXISTS (it does not yet — §6: "No script
//                          currently exists to run this"). Until it does, no caller can honestly
//                          supply {current:true}, so this predicate fails closed by construction —
//                          that IS the enforcement described in the row: no sampling infra means
//                          no auto-sign, full stop.
//   - challengeWindow   <- `node scripts/check-fv-provisional-expiry.mjs --dry-run --json <out>`,
//                          this artifact's entry from the result set
//   - artifactClass     <- the artifact's own declared class field
//
// FAIL-CLOSED THROUGHOUT: a missing, malformed, or absent evidence field is
// always a FAILING predicate, never a silent pass. There is no "assume
// eligible" path anywhere in this file.
//
// Usage:
//   node scripts/fv-policy-sign-gate.mjs --input <evidence.json>   # verdict to stdout, exit 0 eligible / 1 ineligible / 2 bad input
//   import { evaluateEligibility } from './fv-policy-sign-gate.mjs'  # pure function, no I/O

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- Named predicates ----------
// Each returns { pass: boolean, message: string }. `message` is always
// populated (both pass and fail) so a caller can log the full evidence
// trail, not just the failures.

function checkCiGatesGreen(input) {
  const checks = input.ciChecks;
  if (!Array.isArray(checks) || checks.length === 0) {
    return { pass: false, message: 'no CI check evidence supplied (ciChecks missing/empty) — cannot confirm green, fails closed' };
  }
  const notGreen = checks.filter((c) => c && c.conclusion !== 'success');
  if (notGreen.length > 0) {
    const names = notGreen.map((c) => `${c.name ?? '(unnamed)'}:${c.conclusion ?? '(no conclusion)'}`).join(', ');
    return { pass: false, message: `${notGreen.length} of ${checks.length} CI check(s) not green: ${names}` };
  }
  return { pass: true, message: `all ${checks.length} CI check(s) green` };
}

function checkKernelIdentityFresh(input) {
  const ki = input.kernelIdentity;
  if (!ki || typeof ki !== 'object') {
    return { pass: false, message: 'no kernelIdentity evidence supplied — run gen-kernel-identity.mjs --check and pass its result, fails closed' };
  }
  if (ki.clean !== true) {
    return { pass: false, message: `kernel-identity check not clean: ${ki.detail ?? '(no detail supplied)'}` };
  }
  return { pass: true, message: 'kernel-identity digest fresh (gen-kernel-identity.mjs --check clean)' };
}

function checkSamplingQuotaCurrent(input) {
  const sq = input.samplingQuota;
  if (!sq || typeof sq !== 'object' || sq.current !== true) {
    return {
      pass: false,
      message:
        sq && sq.reason
          ? `ISA-530 sampling quota not current: ${sq.reason}`
          : 'no sampling-quota evidence supplied — the draw/switching-state machinery (FV-SAMPLING-REGIME-SPEC-2026-08-09.md §6) is unbuilt as of this WU, so quota can never be current yet; fails closed by design, not by bug',
    };
  }
  return { pass: true, message: `ISA-530 sampling quota current (level=${sq.level ?? 'unknown'})` };
}

function checkChallengeWindowExpiredUnchallenged(input) {
  const cw = input.challengeWindow;
  const state = cw && typeof cw === 'object' ? cw.state : undefined;
  if (state !== 'PROVISIONAL-EXPIRED-UPGRADED') {
    const detail =
      state === 'PROVISIONAL-OPEN'
        ? 'challenge window has not yet expired'
        : state === 'PROVISIONAL-CHALLENGED'
          ? 'a challenge is on file — routes to human review, never auto-sign'
          : state === undefined
            ? 'no challengeWindow evidence supplied (run check-fv-provisional-expiry.mjs --dry-run --json)'
            : `unrecognized challengeWindow.state: ${String(state)}`;
    return { pass: false, message: `challenge window not expired-unchallenged: ${detail}` };
  }
  return { pass: true, message: `challenge window expired with no challenge on file (upgraded to ${cw.upgradedTo ?? 'canonical status'})` };
}

function checkArtifactClassRoutine(input) {
  const cls = input.artifactClass;
  if (cls !== 'routine-template-instance') {
    const detail = cls === 'novel-formalization'
      ? 'novel formalizations are PERMANENTLY ineligible for auto-sign — pre-signature stays human, already ruled'
      : `unrecognized or absent artifactClass (${cls === undefined ? '(missing)' : JSON.stringify(cls)}) — fails closed, never assumed routine`;
    return { pass: false, message: `artifact class not eligible: ${detail}` };
  }
  return { pass: true, message: 'artifact class is a routine template instance' };
}

export const PREDICATES = [
  { name: 'ci_gates_green', check: checkCiGatesGreen },
  { name: 'kernel_identity_fresh', check: checkKernelIdentityFresh },
  { name: 'sampling_quota_current', check: checkSamplingQuotaCurrent },
  { name: 'challenge_window_expired_unchallenged', check: checkChallengeWindowExpiredUnchallenged },
  { name: 'artifact_class_routine', check: checkArtifactClassRoutine },
];

// ---------- Pure evaluator ----------

export function evaluateEligibility(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('evaluateEligibility requires an evidence object');
  }
  const checked = PREDICATES.map(({ name, check }) => {
    const { pass, message } = check(input);
    return { name, pass, message };
  });
  const failed_predicates = checked.filter((c) => !c.pass).map(({ name, message }) => ({ name, message }));
  return {
    eligible: failed_predicates.length === 0,
    failed_predicates,
    checked,
  };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const out = { input: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input') out.input = argv[++i];
  }
  return out;
}

async function main() {
  const { input: inputPath } = parseArgs(process.argv.slice(2));
  if (!inputPath) {
    console.error('usage: fv-policy-sign-gate.mjs --input <evidence.json>');
    process.exitCode = 2;
    return;
  }
  let evidence;
  try {
    evidence = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (e) {
    console.error(`✗ could not read/parse --input ${inputPath}: ${e.message}`);
    process.exitCode = 2;
    return;
  }
  let verdict;
  try {
    verdict = evaluateEligibility(evidence);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exitCode = 2;
    return;
  }
  console.log(JSON.stringify(verdict, null, 2));
  if (verdict.eligible) {
    console.log(`\n✓ ELIGIBLE — all ${verdict.checked.length} predicates pass. Gate signs nothing; hand this verdict to the signing step.`);
    process.exitCode = 0;
  } else {
    console.log(`\n⛔ NOT ELIGIBLE — ${verdict.failed_predicates.length} predicate(s) failed. Routes to a board row, never to a signature.`);
    process.exitCode = 1;
  }
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  main();
}
