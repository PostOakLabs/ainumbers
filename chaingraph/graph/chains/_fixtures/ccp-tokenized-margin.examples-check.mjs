// ccp-tokenized-margin.examples-check.mjs
// Local proof that the example inputs in ccp-tokenized-margin.fixtures.json
// are accepted by the existing node schemas, and the chain runs end to end:
// each scenario's step inputs go through the SAME kernels the worker uses,
// the chain's own steps are walked in order, and every artifact execution_hash
// is printed. No kernel, fixture or schema is edited; this only reads them.
//
// Run: node chaingraph/graph/chains/_fixtures/ccp-tokenized-margin.examples-check.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getKernel } from '../../../kernels/index.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const chain = JSON.parse(readFileSync(here + '../ccp-tokenized-margin.json', 'utf8'));
const fixtures = JSON.parse(readFileSync(here + 'ccp-tokenized-margin.fixtures.json', 'utf8'));

let fail = 0;
const ok = (label) => console.log('  ok  ' + label);
const bad = (label, detail) => { fail++; console.error('  BAD ' + label + (detail ? ' -- ' + detail : '')); };

// Expected, intended outcomes per scenario and tool (the examples are built to show them).
const EXPECT = {
  cftc_25_39_tokenized_treasury: {
    'art-514-conditional-relief-collateral-receipt': (o) => o.all_conditions_met === true && o.conditions.every((c) => c.verdict === 'PASS'),
  },
  cftc_25_40_fcm_payment_stablecoin: {
    'art-514-conditional-relief-collateral-receipt': (o) => o.all_conditions_met === false && o.conditions.some((c) => c.verdict === 'UNDECIDABLE'),
  },
  dtc_nal_tokenization_services: {
    'art-514-conditional-relief-collateral-receipt': (o) => o.all_conditions_met === true && o.conditions.length === 8,
  },
};

async function run(scenario, toolId, pp) {
  const kernel = getKernel(toolId);
  if (!kernel) { bad(scenario + ': kernel found for ' + toolId); return null; }
  const artifact = await kernel.buildArtifact(pp, { now: '1970-01-01T00:00:00.000Z' });
  const out = artifact.output_payload || artifact.payload || artifact;
  console.log('  ' + toolId + ' execution_hash=' + artifact.execution_hash);
  const check = EXPECT[scenario] && EXPECT[scenario][toolId];
  if (check) { if (check(out)) ok(scenario + ': ' + toolId + ' outcome as designed'); else bad(scenario + ': ' + toolId + ' outcome differs from design'); }
  return { artifact, out };
}

const chainSteps = chain.steps.map((s) => s.tool_id);
for (const [name, sc] of Object.entries(fixtures.scenarios)) {
  console.log(name);
  const ids = Object.keys(sc).filter((k) => k !== 'description');
  const isChain = ids.length === chainSteps.length && ids.every((id, i) => id === chainSteps[i]);
  for (const toolId of isChain ? chainSteps : ids) {
    const r = await run(name, toolId, sc[toolId]);
    if (r && r.out && Array.isArray(r.out.exceptions) && r.out.exceptions.length) {
      console.log('  note: ' + toolId + ' exceptions=' + JSON.stringify(r.out.exceptions));
    }
  }
  if (isChain) ok(name + ': ran as the full chain, steps in order: ' + chainSteps.join(' -> '));
}
if (fail) { console.error(fail + ' check(s) failed'); process.exit(1); }
console.log('all example inputs accepted');
