// wave11-smoke.test.mjs — exercise the 4 Wave-11 kernels (inert/unregistered).
// Run:  node repo/chaingraph/kernels/wave11-smoke.test.mjs
// Checks each kernel computes, emits a v0.4 artifact, and hashes deterministically.

import * as art48 from './art-48-treasury-clearing-fit-diagnostic.kernel.mjs';
import * as art49 from './art-49-clearing-access-model-selector.kernel.mjs';
import * as art50 from './art-50-ficc-margin-netting-estimator.kernel.mjs';
import * as art51 from './art-51-cross-margining-benefit-estimator.kernel.mjs';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

async function check(name, mod, pp) {
  const { output_payload, compliance_flags } = mod.compute(pp);
  ok(output_payload && typeof output_payload === 'object', `${name}: output_payload`);
  ok(Array.isArray(compliance_flags), `${name}: compliance_flags[]`);
  const a1 = await mod.buildArtifact(pp, { now: '2026-06-19T00:00:00Z' });
  const a2 = await mod.buildArtifact(pp, { now: '2099-01-01T00:00:00Z' }); // different timestamp
  ok(/^[0-9a-f]{64}$/.test(a1.execution_hash), `${name}: 64-hex execution_hash`);
  ok(a1.execution_hash === a2.execution_hash, `${name}: hash independent of generated_at (timestamp not in preimage)`);
  ok(a1.chaingraph_version === '0.4.0' && a1.compute_mode === 'server', `${name}: v0.4 envelope`);
  ok(a1.mcp_name === undefined && mod.meta.mcp_name, `${name}: meta.mcp_name = ${mod.meta.mcp_name}`);
  return output_payload;
}

console.log('ART-48 fit diagnostic');
const o48 = await check('art-48', art48, { activity_repo: 'both', current_access: 'none', execution_breadth: 6, cross_product_hedges: 'both', agreements_status: 'not-started', primary_product: 'both' });
ok(['A','B','C','D','F'].includes(o48.overall_grade), `art-48: grade ${o48.overall_grade}, routes to ${o48.primary_recommendation}`);

console.log('ART-49 access-model selector');
const o49 = await check('art-49', art49, { firm_type: 'hedge-fund', repo_notional_daily: 5e9, num_executing_dealers: 6, want_execution_flexibility: true });
ok(['direct','sponsored_done_with','sponsored_done_away','agent_done_away'].includes(o49.recommended_model), `art-49: recommends ${o49.recommended_model}`);

console.log('ART-50 FICC margin estimator');
const o50 = await check('art-50', art50, { positions: [{ instrument: 'ust-note', notional: 1e9, tenor_years: 10, direction: 'long' }, { instrument: 'repo', notional: 8e8, tenor_years: 0.1, direction: 'short' }], clearing_model: 'cleared-done-away' });
ok(o50.estimated_vbm >= 0 && o50.netting_benefit_pct >= 0, `art-50: VBM ~$${o50.estimated_vbm}, netting ${o50.netting_benefit_pct}%`);

console.log('ART-51 cross-margining estimator');
const o51 = await check('art-51', art51, { ust_positions: [{ instrument: 'ust-note', notional: 1e9, tenor_years: 10, direction: 'long' }], cme_positions: [{ contract: 'ZN', num_contracts: 1500, direction: 'short' }], account_type: 'customer' });
ok(o51.im_reduction_usd >= 0, `art-51: IM reduction $${o51.im_reduction_usd} (${o51.im_reduction_pct}%), eligible offsets: ${o51.eligible_offsets.length}`);

console.log(fail ? `\nFAILED (${fail})` : '\nALL PASSED — 4 Wave-11 kernels compute + hash deterministically');
process.exit(fail ? 1 : 0);
