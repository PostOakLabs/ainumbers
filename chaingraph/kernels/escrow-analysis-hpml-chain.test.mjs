// escrow-analysis-hpml-chain.test.mjs — chain fixture for CALC-CORE-BAND-SPEC.md CC-D.
// Demonstrates: compute_escrow_analysis (art-342) -> test_hpml_escrow (art-235),
// per CC-D's "chain fixture: analysis -> requirement" done-criterion.
//
// Why this pairing, and why the chain runs this direction: the two kernels have
// disjoint input schemas (trial-balance/disbursement figures vs. APR/APOR/lien
// figures) -- neither's output is literally consumed as the other's input. The
// chain instead demonstrates the real audit relationship: having just run the
// §1024.17 aggregate escrow analysis on an account, a servicer/agent chains
// into art-235's §1026.35(a)/(b) HPML+escrow-requirement test as a downstream
// compliance cross-check, confirming the loan was one for which an escrow
// account was actually required to exist (first-lien HPML, no exemption) --
// i.e. that the analysis just performed was performed on a loan that needed it.
// Also wires parent_hashes / chain_depth per the OCG chain convention (§A3.2 /
// SPEC.md §1/§4): the child artifact's chain.parent_hashes carries the
// parent's execution_hash, chain_depth = parent_depth + 1.
//
// Run:  node chaingraph/kernels/escrow-analysis-hpml-chain.test.mjs

import * as escrow from './art-342-compute-escrow-analysis.kernel.mjs';
import * as hpml from './art-235-test-hpml-escrow.kernel.mjs';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

const escrowInput = {
  starting_balance: 500,
  monthly_escrow_payment: 250,
  disbursements: [0, 0, 600, 0, 0, 1200, 0, 0, 0, 0, 0, 1200],
  cushion_fraction: 1 / 6,
};

const escrowArtifact = await escrow.buildArtifact(escrowInput, { now: '2026-07-17T00:00:00Z' });
ok(/^[0-9a-f]{64}$/.test(escrowArtifact.execution_hash), 'art-342: 64-hex execution_hash');
ok(escrowArtifact.output_payload.account_status === 'shortage', 'art-342: classifies as shortage (fixture reused from shortage_mandatory_spread vector)');

// First-lien loan, 1.5pp above APOR -- an HPML per §1026.35(a)(1)(i)(A), first
// lien, no rural/condo exemption -- so an escrow account was legally required
// to be established for it, consistent with the account existing to analyze.
const hpmlInput = {
  apr_pct: 7.5,
  apor_pct: 6.0,
  lien_type: 'first',
  is_jumbo: false,
  year: 2026,
};

const hpmlArtifact = await hpml.buildArtifact(hpmlInput, {
  now: '2026-07-17T00:00:01Z',
  parent_hashes: [escrowArtifact.execution_hash],
  parent_tool_ids: [escrowArtifact.tool_id],
  chain_depth: (escrowArtifact.chain?.chain_depth ?? 0) + 1,
});

ok(/^[0-9a-f]{64}$/.test(hpmlArtifact.execution_hash), 'art-235: 64-hex execution_hash');
ok(hpmlArtifact.chain.parent_hashes[0] === escrowArtifact.execution_hash, 'art-235: chain.parent_hashes carries art-342 execution_hash');
ok(hpmlArtifact.chain.parent_tool_ids[0] === 'art-342-compute-escrow-analysis', 'art-235: chain.parent_tool_ids carries art-342 tool_id');
ok(hpmlArtifact.chain.chain_depth === 1, `art-235: chain_depth == 1 (got ${hpmlArtifact.chain.chain_depth})`);
ok(hpmlArtifact.output_payload.is_hpml === true, 'art-235: loan classifies as HPML (7.5% APR vs 6.0% APOR, 1.5pp first-lien spread)');
ok(hpmlArtifact.output_payload.escrow_required === true, 'art-235: escrow WAS required for this first-lien HPML -- consistent with art-342 having an account to analyze');

console.log(fail ? `\nFAILED (${fail})` : '\nALL PASSED — art-342 escrow analysis -> art-235 HPML/escrow-requirement chain fixture verified (chain_depth 1, parent_hashes wired, escrow_required cross-check holds).');
process.exit(fail ? 1 : 0);
