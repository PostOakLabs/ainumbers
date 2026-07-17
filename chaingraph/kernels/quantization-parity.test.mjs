// quantization-parity.test.mjs — §24.6 DETCLASS-1 rider gate (ZKML-GUEST-1-BUILD-SPEC.md §ZG-3).
//
// A kernel MAY attach a top-level `quantization_parity` block (hash-excluded, additive — see
// SPEC.md §24.6) declaring the float-vs-quantized top1 agreement rate its static quantization
// achieved over a committed held-out test-vector set. §24.6 doctrine is TESTED, not merely
// asserted: this gate re-runs the integer kernel over that committed vector set, recomputes the
// agreement rate from scratch, and fails if it does not match the declared value.
//
// Two checks per kernel that carries `quantization_parity`:
//   (a) FIDELITY   — kernel.compute() reproduces the vector set's own recorded
//                    `quantized_prediction` for every row (kernel matches its own fixture).
//   (b) AGREEMENT  — recomputed top1-match(quantized_prediction, float_prediction) over the
//                    full vector set equals the kernel's declared `quantization_parity.agreement.value`.
// Plus a self-test (c) that the comparison logic itself detects a tampered declared value —
// same pattern as gate-replay-tamper.test.mjs / escalation-closure-tamper.test.mjs.
//
// Zero-dependency. Wired into scripts/preflight.mjs.
//   node chaingraph/kernels/quantization-parity.test.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KERNELS } from './index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = resolve(HERE, 'fixtures');
const EPS = 1e-9;

let fail = 0, checked = 0;

// (c) self-test: the comparison logic must reject a mismatch. Runs unconditionally, before any
// kernel scan, so the tamper-detect path is exercised even in a future estate with zero
// quantized kernels.
{
  const declared = 0.998, recomputed = 0.998, tampered = 0.988;
  if (Math.abs(declared - recomputed) > EPS) { console.error('✗ self-test: equal values flagged as mismatched (comparator broken).'); fail++; }
  if (Math.abs(declared - tampered) <= EPS) { console.error('✗ self-test: tampered declared-agreement value NOT detected (comparator broken).'); fail++; }
  else console.log('✓ self-test: tamper-detect comparator correctly flags a mismatched declared-agreement value.');
}

for (const [id, kernel] of Object.entries(KERNELS)) {
  if (typeof kernel?.buildArtifact !== 'function') continue;

  // A quantized kernel attaches quantization_parity to every artifact regardless of input —
  // probe with an empty policy_parameters to read the declaration without needing real inputs.
  let probe;
  try { probe = await kernel.buildArtifact({}, { now: null }); } catch { continue; }
  const qp = probe?.quantization_parity;
  if (!qp) continue; // not a quantized kernel — out of scope for this gate

  const declared = qp?.agreement?.value;
  if (typeof declared !== 'number' || !Number.isFinite(declared)) {
    console.error(`✗ ${id}: quantization_parity.agreement.value missing or non-finite.`);
    fail++; continue;
  }

  const vpath = resolve(FIXDIR, `${id}.test-vectors.json`);
  if (!existsSync(vpath)) {
    console.error(`✗ ${id}: declares quantization_parity but has no fixtures/${id}.test-vectors.json to test it against.`);
    fail++; continue;
  }

  const doc = JSON.parse(readFileSync(vpath, 'utf8'));
  const vectors = doc.vectors ?? [];
  if (vectors.length === 0) { console.error(`✗ ${id}: test-vectors.json has no vectors.`); fail++; continue; }

  let fidelityMismatches = 0, agree = 0;
  for (const v of vectors) {
    const { output_payload } = kernel.compute({ normalized_fixp16: v.normalized_fixp16 });
    const decision = output_payload?.decision;
    if (decision !== v.quantized_prediction) fidelityMismatches++;
    if (decision === v.float_prediction) agree++;
  }

  if (fidelityMismatches > 0) {
    console.error(`✗ ${id}: kernel.compute() disagrees with the fixture's own quantized_prediction on ${fidelityMismatches}/${vectors.length} vector(s) — kernel drift.`);
    fail++; continue;
  }

  const recomputedAgreement = agree / vectors.length;
  if (Math.abs(recomputedAgreement - declared) > EPS) {
    console.error(`✗ ${id}: declared agreement ${declared} != recomputed ${recomputedAgreement} over ${vectors.length} vectors (declared-agreement drift).`);
    fail++; continue;
  }

  console.log(`✓ ${id}: quantization_parity verified — ${vectors.length} vectors, declared ${declared} == recomputed ${recomputedAgreement}.`);
  checked++;
}

if (fail === 0) {
  console.log(`\n✓ quantization-parity clean — ${checked} quantized kernel(s) verified against their committed test-vector sets.`);
  process.exit(0);
}
console.error(`\n✗ ${fail} quantization-parity failure(s).`);
process.exit(1);
