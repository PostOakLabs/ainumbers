// art-27-agentic-readiness-diagnostic.exhaustive.mjs — ART27-HARNESS-INREPO-1.
//
// WHY THIS FILE EXISTS: the `art-27` FV pilot record (`chaingraph/fv-pilot/
// art-27-agentic-readiness-diagnostic.json`) cites a class-A "verified by exhaustive
// enumeration (all 531,441 inputs)" claim. The original enumeration ran 2026-08-09 from a
// harness at workspace-root `research/FV-A2-AGENTIC-READINESS-enumeration-harness.mjs`
// (`board/done/FV-A2-AGENTIC-READINESS.md`) — OUTSIDE this repository, because that WU's
// fence (`board/done/FV-A2-AGENTIC-READINESS.md`) restricted it to
// WRITE-workspace-root-`research/`-only, no `repo/` writes. That was a correct, deliberate
// scope for a research-pilot row; the consequence, found and reported under SO #25 rather
// than silently fixed (`board/done/FV-EVIDENCE-VECTOR-1.md`), is that nobody outside that
// one session's machine can re-run the sweep the badge cites — a promise, not a proof (SO #0).
// This file is that sweep, ported in-repo and CI-rerunnable, per `ART27-HARNESS-INREPO-1`.
//
// THIS IS NOT A `.proptest.mjs` FLOOR FILE ON PURPOSE: `scripts/run-proptests.mjs` globs
// `__proptests__/*.proptest.mjs` only and treats every match as a 300-trial sample floor
// file for `FV-FLOOR-DIGEST-GATE-1`'s authoring-freshness check. This is a full 3^12
// enumeration, a different animal — the `.exhaustive.mjs` suffix keeps it out of that glob
// so it is never mistaken for (or folded into) the property-floor's digest bookkeeping.
// It is wired into `scripts/preflight.mjs` as its own step (see that file).
//
// INDEPENDENT ORACLE, NOT A SELF-CONSISTENT CHECKER (SO #34): specExpected() below is an
// independent restatement of the spec's postconditions from FV-A2-AGENTIC-READINESS-SPEC.md
// (workspace-root research/) — it recomputes domain totals from the raw answers array
// deliberately differently from the kernel's own single running-index loop, so a bug the two
// implementations happened to share would still show up as a divergence anywhere their
// approaches actually differ. It does not call into or re-use any kernel internals, and it
// does not hash anything (this kernel has no digest/crypto surface to independently oracle —
// unlike DISE-SEG-K-1/ACCT-RULEREG-K-1's node:crypto oracles, which exist because THEIR
// kernels compute digests; art-27 computes a scoring rubric, so the independent oracle here
// is an independently-authored implementation of that rubric, not a second hash function).
//
// PORTING NOTE (kept for the reusability claim the original artifact made): the original
// header describes this as a reusable template for ~10 sibling 12-question diagnostics via a
// 4-value swap (import path, N_QUESTIONS, DOMAIN_GROUPS, grade()/VALUES). That claim is
// unchanged by this port; the sweep logic itself is untouched from the original, only the
// import path and the surrounding comment block changed.

import { compute } from '../art-27-agentic-readiness-diagnostic.kernel.mjs';

// ---- PER-KERNEL: shape ------------------------------------------------------------------------
const N_QUESTIONS = 12;
const ANSWERS = ['yes', 'partial', 'no'];
const VALUES = { yes: 2, partial: 1, no: 0 };
const DOMAIN_GROUPS = [
  { id: 'policy',   label: 'Policy & Mandates',       idx: [0, 1, 2] },
  { id: 'protocol', label: 'Protocol Formalisation',   idx: [3, 4, 5] },
  { id: 'controls', label: 'Financial-Crime Controls', idx: [6, 7, 8] },
  { id: 'runtime',  label: 'MCP Runtime Operations',   idx: [9, 10, 11] },
];
function grade(pct) {
  return pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 55 ? 'C' : pct >= 40 ? 'D' : 'F';
}
// ---- end PER-KERNEL section ---------------------------------------------------------------------

function qKey(i) { return 'q' + (i + 1); }

// Independent restatement of the spec's postconditions — NOT a copy of the kernel's internal
// variable names/control flow, so a coincidental bug shared by both would still be visible as a
// divergence in behaviour the spec did not predict, wherever the two implementations diverge in
// approach (e.g. this computes domain totals from raw answers array-first rather than the kernel's
// single running-index loop).
function specExpected(answers) {
  const effective = answers.map((v) => (v === 'yes' || v === 'partial' || v === 'no') ? v : 'no');
  const all_answered = answers.every((v) => v === 'yes' || v === 'partial' || v === 'no');

  const domain_scores = {};
  const gaps = [];
  let total = 0;
  for (const d of DOMAIN_GROUPS) {
    let t = 0;
    for (const i of d.idx) {
      t += VALUES[effective[i]];
      if (effective[i] !== 'yes') gaps.push({ question: qKey(i), domain: d.id, severity: effective[i] === 'no' ? 'no' : 'partial' });
    }
    const m = d.idx.length * 2;
    domain_scores[d.id] = { label: d.label, pct: Math.round(100 * t / m) };
    total += t;
  }
  const max = N_QUESTIONS * 2;
  const score_pct = Math.round(100 * total / max);
  const g = grade(score_pct);
  const is_ready = g === 'A' || g === 'B';

  const compliance_flags = ['AGENTIC_READINESS_SCORED'];
  compliance_flags.push(is_ready ? 'AGENT_PAYMENTS_READY' : 'AGENT_PAYMENTS_NOT_READY');
  for (const d of DOMAIN_GROUPS) {
    if (domain_scores[d.id].pct < 70) compliance_flags.push(d.id.toUpperCase() + '_GAP');
  }

  return { output_payload: { verdict: g, score_pct, domain_scores, gaps, all_answered, is_ready }, compliance_flags, total, max };
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function checkOne(pp, answers) {
  const kernelResult = compute(pp);
  const expected = specExpected(answers);
  const violations = [];
  if (!deepEqual(kernelResult.output_payload, expected.output_payload)) violations.push('output_payload mismatch');
  if (!deepEqual(kernelResult.compliance_flags, expected.compliance_flags)) violations.push('compliance_flags mismatch');
  // invariants
  const op = kernelResult.output_payload;
  if (op.score_pct < 0 || op.score_pct > 100) violations.push('score_pct out of [0,100]');
  if (!['A', 'B', 'C', 'D', 'F'].includes(op.verdict)) violations.push('verdict not in {A,B,C,D,F}');
  if (op.is_ready !== (op.verdict === 'A' || op.verdict === 'B')) violations.push('is_ready inconsistent with verdict');
  const hasReady = kernelResult.compliance_flags.includes('AGENT_PAYMENTS_READY');
  const hasNotReady = kernelResult.compliance_flags.includes('AGENT_PAYMENTS_NOT_READY');
  if (hasReady === hasNotReady) violations.push('READY/NOT_READY flags not mutually exclusive+exhaustive');
  return { violations, expected };
}

// ---- Main sweep: full 3^N declared-answer domain ----
console.log(`Enumerating ${ANSWERS.length}^${N_QUESTIONS} = ${Math.pow(ANSWERS.length, N_QUESTIONS)} declared states...`);
const t0 = Date.now();

let checked = 0;
let failures = 0;
const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
const achievableScorePcts = new Set();
const domainGapAtTotal = {}; // domain_total(0..6) -> pct, to confirm the <70 cut is domain_total<=4

const digits = new Array(N_QUESTIONS).fill(0);
outer:
while (true) {
  const answers = digits.map((d) => ANSWERS[d]);
  const pp = {};
  answers.forEach((v, i) => { pp[qKey(i)] = v; });

  const { violations, expected } = checkOne(pp, answers);
  checked++;
  if (violations.length) {
    failures++;
    if (failures <= 10) console.log(`FAIL pp=${JSON.stringify(pp)}: ${violations.join(', ')}`);
  }
  gradeCounts[expected.output_payload.verdict]++;
  achievableScorePcts.add(expected.output_payload.score_pct);
  for (const d of DOMAIN_GROUPS) {
    const dt = d.idx.reduce((s, i) => s + VALUES[answers[i]], 0);
    domainGapAtTotal[dt] = expected.output_payload.domain_scores[d.id].pct;
  }

  // increment base-3 counter
  let pos = N_QUESTIONS - 1;
  while (pos >= 0) {
    digits[pos]++;
    if (digits[pos] < ANSWERS.length) break;
    digits[pos] = 0;
    pos--;
  }
  if (pos < 0) break outer;
}
const elapsedMs = Date.now() - t0;

// ---- Boundary sweep: missing/invalid answers (outside the literal 3^N declared-answer count) ----
let boundaryChecked = 0, boundaryFailures = 0;
// all-missing
{
  const { violations } = checkOne({}, new Array(N_QUESTIONS).fill('__missing__'));
  boundaryChecked++;
  if (violations.length) { boundaryFailures++; console.log(`FAIL (all-missing): ${violations.join(', ')}`); }
}
// exactly one missing, rest 'yes'
for (let i = 0; i < N_QUESTIONS; i++) {
  const answers = new Array(N_QUESTIONS).fill('yes');
  const pp = {};
  answers.forEach((v, idx) => { if (idx !== i) pp[qKey(idx)] = v; });
  answers[i] = '__missing__';
  const { violations } = checkOne(pp, answers);
  boundaryChecked++;
  if (violations.length) { boundaryFailures++; console.log(`FAIL (missing ${qKey(i)}): ${violations.join(', ')}`); }
}
// invalid string value on q1
{
  const answers = new Array(N_QUESTIONS).fill('yes');
  const pp = {};
  answers.forEach((v, idx) => { pp[qKey(idx)] = v; });
  pp.q1 = 'maybe';
  answers[0] = '__missing__'; // treated as coerced-to-no by specExpected's effective() rule
  const { violations } = checkOne(pp, answers);
  boundaryChecked++;
  if (violations.length) { boundaryFailures++; console.log(`FAIL (invalid q1='maybe'): ${violations.join(', ')}`); }
}

// ---- Threshold flip points (empirical, not hand-computed — see spec's boundary_cases) ----
const sortedTotals = Object.keys(domainGapAtTotal).map(Number).sort((a, b) => a - b);
const domainGapFlip = sortedTotals.find((dt, i) => domainGapAtTotal[dt] >= 70) ?? null;

function findGradeFlip(threshold) {
  // walk achievable score_pct values in the actual observed order (indexed by underlying total 0..24)
  const totals = Array.from({ length: 25 }, (_, t) => t);
  const scorePctForTotal = (t) => Math.round(100 * t / 24);
  let below = null, atOrAbove = null;
  for (const t of totals) {
    const pct = scorePctForTotal(t);
    if (pct < threshold) below = { total: t, score_pct: pct };
    if (pct >= threshold && atOrAbove === null) atOrAbove = { total: t, score_pct: pct };
  }
  return { below, atOrAbove };
}

console.log(`\nchecked (3^${N_QUESTIONS} sweep): ${checked}`);
console.log(`failures (3^${N_QUESTIONS} sweep): ${failures}`);
console.log(`elapsed: ${elapsedMs} ms (${(checked / (elapsedMs / 1000)).toFixed(0)} states/sec)`);
console.log(`grade distribution:`, gradeCounts);
console.log(`achievable score_pct values (${achievableScorePcts.size} distinct):`, Array.from(achievableScorePcts).sort((a, b) => a - b).join(','));
console.log(`\nboundary sweep (missing/invalid, outside literal 3^${N_QUESTIONS} count): checked=${boundaryChecked} failures=${boundaryFailures}`);
console.log(`\nthreshold flip points (empirical):`);
for (const threshold of [85, 70, 55, 40]) {
  const { below, atOrAbove } = findGradeFlip(threshold);
  console.log(`  threshold=${threshold}: highest-below=${JSON.stringify(below)} lowest-at-or-above=${JSON.stringify(atOrAbove)} exact-value-reachable=${below && atOrAbove && (below.score_pct === threshold - 1 ? 'n/a' : (atOrAbove.score_pct === threshold))}`);
}
console.log(`  per-domain GAP flag flips true at domain_total<=4 (pct<70): observed domain totals->pct map:`, domainGapAtTotal);

const totalFailures = failures + boundaryFailures;
console.log(totalFailures === 0
  ? `\nTOTAL CORRECTNESS: PASS — all ${checked} declared states + ${boundaryChecked} boundary states satisfy every postcondition and invariant. domain_cardinality=${Math.pow(ANSWERS.length, N_QUESTIONS)}.`
  : `\nTOTAL CORRECTNESS: FAIL — ${totalFailures} states violated the spec.`);

if (totalFailures > 0) process.exit(1);
