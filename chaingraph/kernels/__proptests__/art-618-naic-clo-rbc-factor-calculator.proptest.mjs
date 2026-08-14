// kernel_digest_at_authoring: sha256:cb99858043a626cef3ee2982c902f5dc20456fe04034d70adf63b9a8177fd864
// FV floor (PBT-floor tier, FV-PBT-FLOOR-BUILD-SPEC.md) for art-618-naic-clo-rbc-factor-calculator.
// Engineering QC only -- no assurance-grade vocabulary. Separate from, and narrower than, the
// class-A exhaustive-enumeration verification artifact at research/NAIC-CLO-RBC-K-1-verification-artifact.json,
// which checks the full 31-state declared domain against an independently-transcribed factor table.

import { compute } from '../art-618-naic-clo-rbc-factor-calculator.kernel.mjs';
import { deepStrictEqual, ok } from 'node:assert';

const VALID_DESIGNATIONS = [
  '1.A', '1.B', '1.C', '1.D', '1.E', '1.F', '1.G',
  '2.A', '2.B', '2.C',
  '3.A', '3.B', '3.C',
  '4.A', '4.B', '4.C',
  '5.A', '5.B', '5.C',
  '6',
];

function run() {
  // Property: portfolio_total_rbc_requirement is always the sum of per-tranche rbc_requirement.
  for (const d of VALID_DESIGNATIONS) {
    const pp = { tranches: [
      { naic_designation: d, book_adjusted_carrying_value: 1000000 },
      { naic_designation: d, book_adjusted_carrying_value: 250000 },
    ] };
    const { output_payload } = compute(pp);
    const sum = output_payload.tranches.reduce((a, t) => a + t.rbc_requirement, 0);
    deepStrictEqual(output_payload.portfolio_total_rbc_requirement, sum, `portfolio sum property failed for ${d}`);
  }

  // Property: applied_factor is always a non-negative number <= 1 for every valid designation, at
  // both override states (where eligible).
  for (const d of VALID_DESIGNATIONS) {
    for (const thin of [false, true]) {
      const pp = { tranches: [{ naic_designation: d, book_adjusted_carrying_value: 100, bsl_thin_tranche: thin, tranche_thickness_pct: thin ? 2 : 50 }] };
      const { output_payload } = compute(pp);
      const f = output_payload.tranches[0].applied_factor;
      ok(typeof f === 'number' && f >= 0 && f <= 1, `applied_factor out of range for ${d} thin=${thin}: ${f}`);
    }
  }

  // Property: zero book/adjusted carrying value always yields a zero RBC requirement, for every
  // valid designation.
  for (const d of VALID_DESIGNATIONS) {
    const { output_payload } = compute({ tranches: [{ naic_designation: d, book_adjusted_carrying_value: 0 }] });
    deepStrictEqual(output_payload.tranches[0].rbc_requirement, 0, `zero-BACV property failed for ${d}`);
  }

  // Property: an unrecognized designation is always flagged as an error and contributes zero to
  // the portfolio total, never silently priced.
  {
    const { output_payload } = compute({ tranches: [{ naic_designation: 'not-a-designation', book_adjusted_carrying_value: 999999 }] });
    deepStrictEqual(output_payload.tranches[0].error, 'unrecognized_naic_designation');
    deepStrictEqual(output_payload.tranches[0].rbc_requirement, 0);
  }

  // Property: the thin-tranche override never applies to a designation outside the eligible set
  // (1.A-1.G, 2.A, 2.B), regardless of the caller-supplied flags.
  for (const d of ['1.A', '1.B', '1.C', '1.D', '1.E', '1.F', '1.G', '2.A', '2.B']) {
    const { output_payload } = compute({ tranches: [{ naic_designation: d, book_adjusted_carrying_value: 100, bsl_thin_tranche: true, tranche_thickness_pct: 1 }] });
    deepStrictEqual(output_payload.tranches[0].override_applied, false, `override incorrectly applied for ineligible designation ${d}`);
  }

  console.log('OK art-618-naic-clo-rbc-factor-calculator.proptest.mjs — all properties held');
}

run();
