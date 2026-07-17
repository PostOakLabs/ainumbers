// amortization-apr-chain.test.mjs — chain fixture for CALC-CORE-BAND-SPEC.md CC-A.
// Demonstrates: build_amortization_schedule (art-332, level_payment) -> its
// advances[]/payments[] output fed straight into compute_reg_z_appendix_j_apr
// (art-215) -> the actuarial APR matches the schedule's own note rate.
//
// Why the expected APR is exactly the note rate: when the only finance charge
// is interest on the stated principal (no points, no prepaid finance charges),
// the Appendix J actuarial method is an identity -- the schedule that exactly
// amortizes principal at rate r over n periods has, by construction, a
// present-value-of-payments-equals-advance at that same periodic rate r. So
// APR == note_rate_pct up to the rounding introduced by quantizing the level
// payment to the nearest cent (why the assertion below uses a small tolerance).
//
// Also wires parent_hashes / chain_depth per the OCG chain convention (§A3.2 /
// SPEC.md §1/§4): the child artifact's chain.parent_hashes carries the
// parent's execution_hash, chain_depth = parent_depth + 1.
//
// Run:  node chaingraph/kernels/amortization-apr-chain.test.mjs

import * as schedule from './art-332-build-amortization-schedule.kernel.mjs';
import * as apr from './art-215-reg-z-appendix-j-apr.kernel.mjs';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

const scheduleInput = {
  schedule_type: 'level_payment',
  loan_amount: 200000,
  note_rate_pct: 6.5,
  num_payments: 360,
  periods_per_year: 12,
};

const scheduleArtifact = await schedule.buildArtifact(scheduleInput, { now: '2026-07-17T00:00:00Z' });
ok(/^[0-9a-f]{64}$/.test(scheduleArtifact.execution_hash), 'art-332: 64-hex execution_hash');
ok(scheduleArtifact.output_payload.advances.length === 1 && scheduleArtifact.output_payload.payments.length === 360, 'art-332: advances[1] / payments[360] shape ready for art-215');

const aprInput = {
  advances: scheduleArtifact.output_payload.advances,
  payments: scheduleArtifact.output_payload.payments,
  periods_per_year: scheduleArtifact.output_payload.periods_per_year,
};

const aprArtifact = await apr.buildArtifact(aprInput, {
  now: '2026-07-17T00:00:01Z',
  parent_hashes: [scheduleArtifact.execution_hash],
  parent_tool_ids: [scheduleArtifact.tool_id],
  chain_depth: (scheduleArtifact.chain?.chain_depth ?? 0) + 1,
});

ok(/^[0-9a-f]{64}$/.test(aprArtifact.execution_hash), 'art-215: 64-hex execution_hash');
ok(aprArtifact.chain.parent_hashes[0] === scheduleArtifact.execution_hash, 'art-215: chain.parent_hashes carries art-332 execution_hash');
ok(aprArtifact.chain.parent_tool_ids[0] === 'art-332-build-amortization-schedule', 'art-215: chain.parent_tool_ids carries art-332 tool_id');
ok(aprArtifact.chain.chain_depth === 1, `art-215: chain_depth == 1 (got ${aprArtifact.chain.chain_depth})`);
ok(aprArtifact.output_payload.converged === true, 'art-215: APR solver converged');

const apr_pct = aprArtifact.output_payload.apr_pct;
const expected = scheduleInput.note_rate_pct;
ok(Math.abs(apr_pct - expected) < 0.01, `art-215: apr_pct (${apr_pct}) ~= schedule note_rate_pct (${expected}) within 0.01 -- actuarial identity (no other finance charge)`);

console.log(fail ? `\nFAILED (${fail})` : '\nALL PASSED — art-332 schedule -> art-215 APR chain fixture verified (chain_depth 1, parent_hashes wired, APR matches note rate).');
process.exit(fail ? 1 : 0);
