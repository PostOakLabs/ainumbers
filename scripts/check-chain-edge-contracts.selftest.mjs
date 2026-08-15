#!/usr/bin/env node
// check-chain-edge-contracts.selftest.mjs — CHAIN-FV-L1-1 positive/negative controls.
//
// ⛔ MANDATORY POSITIVE CONTROL (the row's own done-criterion): a fixture chain wired with the RIGHT
// kernels but the WRONG edge must return L1-fail, and a known-good chain must return L1-pass. Both
// live here. Fixture chains #1 and #2 below use the IDENTICAL kernel set and differ ONLY in edge
// direction — so a pass/fail split can come from nothing except the edge itself.
//
// ⛔ AND THE CHECKER IS VERIFIED BY MUTATION, NOT BY READING IT (SO #34): every control is re-run
// with one fact flipped, and the verdict must move. A checker that returns the same verdict after
// its evidence is mutated is not checking anything.
//
// Pure in-memory fixtures — this test NEVER reads or writes chaingraph.json, any manifest, or any
// kernel. Run: node scripts/check-chain-edge-contracts.selftest.mjs
import { checkChain, checkEdge, typesCompatible, induceSchema, schemaFromProperties } from './check-chain-edge-contracts.mjs';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  OK:   ${name}`);
  else { console.error(`  FAIL: ${name}`); failures++; }
}

/** Build a ctx from plain fixture data. Mirrors the live wiring's shape exactly. */
function makeCtx({ adjacency = {}, out = {}, in: ins = {} }) {
  return {
    adjacency: new Map(Object.entries(adjacency)),
    outSchema: (id) => (out[id] ? { fields: out[id], required: [] } : null),
    inSchema: (id) => (ins[id] ? { fields: ins[id], required: [] } : null),
  };
}

// Two kernels with a real declared dataflow: alpha produces the score beta consumes.
const KERNELS = {
  adjacency: {
    'fx-alpha-score-producer': { consumes: [], feeds: ['fx-beta-score-consumer'] },
    'fx-beta-score-consumer': { consumes: ['fx-alpha-score-producer'], feeds: [] },
  },
  out: {
    'fx-alpha-score-producer': { risk_score: ['number'], as_of: ['string'] },
    'fx-beta-score-consumer': { decision: ['string'] },
  },
  in: {
    'fx-alpha-score-producer': { exposures: ['array'] },
    'fx-beta-score-consumer': { risk_score: ['number'], threshold: ['number'] },
  },
};

console.log('── Control 1: known-good chain (alpha -> beta, the declared direction) ──');
{
  const ctx = makeCtx(KERNELS);
  const r = checkChain({ name: 'fx-good', steps: [{ tool_id: 'fx-alpha-score-producer' }, { tool_id: 'fx-beta-score-consumer' }] }, ctx);
  check('known-good chain returns L1-pass', r.verdict === 'L1-pass');
  check('known-good chain has no findings', r.findings.length === 0);
  check('known-good chain actually decided its edge (not a vacuous pass)', r.decided_edges === 1 && r.edge_count === 1);
  check('known-good edge ran BOTH sub-checks (adjacency + schema types)',
    r.edges[0].checks_run.includes('adjacency') && r.edges[0].checks_run.includes('schema-types'));
}

console.log('── Control 2: MIS-WIRED chain — same kernels, edge reversed ──');
{
  const ctx = makeCtx(KERNELS);
  const r = checkChain({ name: 'fx-miswired', steps: [{ tool_id: 'fx-beta-score-consumer' }, { tool_id: 'fx-alpha-score-producer' }] }, ctx);
  check('mis-wired chain returns L1-fail', r.verdict === 'L1-fail');
  check('mis-wired chain names edge-inverted', r.findings.some((f) => f.code === 'edge-inverted'));
  check('finding detail names both endpoints, not a vague failure',
    r.findings[0].detail.includes('fx-alpha-score-producer') && r.findings[0].detail.includes('fx-beta-score-consumer'));
  check('mis-wired chain is NOT reported as indeterminate', r.verdict !== 'L1-indeterminate');
}

console.log('── Control 3: type-conflict on a shared field name ──');
{
  const ctx = makeCtx({
    adjacency: { 'fx-p': { consumes: [], feeds: ['fx-c'] }, 'fx-c': { consumes: ['fx-p'], feeds: [] } },
    out: { 'fx-p': { as_of: ['string', 'null'] } },
    in: { 'fx-c': { as_of: ['number'] } },
  });
  const r = checkChain({ name: 'fx-typeclash', steps: [{ tool_id: 'fx-p' }, { tool_id: 'fx-c' }] }, ctx);
  check('type-incompatible edge returns L1-fail', r.verdict === 'L1-fail');
  check('names type-conflict and the offending field', r.findings.some((f) => f.code === 'type-conflict' && f.detail.includes('as_of')));
}

console.log('── Control 4: MUTATION — flip the adjacency, the verdict must move ──');
{
  // Same good chain, but adjacency mutated to declare the reverse relation.
  const mutated = JSON.parse(JSON.stringify(KERNELS));
  mutated.adjacency['fx-alpha-score-producer'] = { consumes: ['fx-beta-score-consumer'], feeds: [] };
  mutated.adjacency['fx-beta-score-consumer'] = { consumes: [], feeds: ['fx-alpha-score-producer'] };
  const r = checkChain({ name: 'fx-good', steps: [{ tool_id: 'fx-alpha-score-producer' }, { tool_id: 'fx-beta-score-consumer' }] }, makeCtx(mutated));
  check('flipping the adjacency turns the passing chain into L1-fail', r.verdict === 'L1-fail');
}
{
  // Same mis-wired chain, but adjacency mutated to endorse that direction — must stop failing.
  const mutated = JSON.parse(JSON.stringify(KERNELS));
  mutated.adjacency['fx-beta-score-consumer'] = { consumes: [], feeds: ['fx-alpha-score-producer'] };
  mutated.adjacency['fx-alpha-score-producer'] = { consumes: ['fx-beta-score-consumer'], feeds: [] };
  const r = checkChain({ name: 'fx-miswired', steps: [{ tool_id: 'fx-beta-score-consumer' }, { tool_id: 'fx-alpha-score-producer' }] }, makeCtx(mutated));
  check('endorsing the reversed direction stops the failure (no verdict stuck on)', r.verdict !== 'L1-fail');
}
{
  // Mutate the conflicting type into a compatible one — the type-conflict must disappear.
  const r = checkChain({ name: 'fx-typeclash', steps: [{ tool_id: 'fx-p' }, { tool_id: 'fx-c' }] }, makeCtx({
    adjacency: { 'fx-p': { consumes: [], feeds: ['fx-c'] }, 'fx-c': { consumes: ['fx-p'], feeds: [] } },
    out: { 'fx-p': { as_of: ['number'] } },
    in: { 'fx-c': { as_of: ['number'] } },
  }));
  check('repairing the type removes the type-conflict finding', r.verdict === 'L1-pass');
}

console.log('── Control 5: an indeterminate is NEVER folded into a pass ──');
{
  // No adjacency data anywhere, and no shared field names — nothing is decidable.
  const ctx = makeCtx({
    adjacency: { 'fx-x': { consumes: [], feeds: [] }, 'fx-y': { consumes: [], feeds: [] } },
    out: { 'fx-x': { alpha_out: ['string'] } },
    in: { 'fx-y': { beta_in: ['string'] } },
  });
  const r = checkChain({ name: 'fx-unknowable', steps: [{ tool_id: 'fx-x' }, { tool_id: 'fx-y' }] }, ctx);
  check('undecidable edge returns L1-indeterminate, not L1-pass', r.verdict === 'L1-indeterminate');
  check('indeterminate names WHY (adjacency + schema reasons)',
    r.reasons.includes('no-adjacency-declared-either-endpoint') && r.reasons.includes('no-shared-field-names-between-schemas'));
  check('indeterminate chain reports 0 decided edges', r.decided_edges === 0);
}
{
  // A single-step chain has no edges. Vacuous truth must not be sold as verification.
  const r = checkChain({ name: 'fx-single', steps: [{ tool_id: 'fx-alpha-score-producer' }] }, makeCtx(KERNELS));
  check('edge-free chain is L1-indeterminate, not a vacuous L1-pass', r.verdict === 'L1-indeterminate');
  check('edge-free chain names no-edges-single-step-chain', r.reasons.includes('no-edges-single-step-chain'));
}
{
  // A node absent from the graph cannot be adjacency-checked — must be named, never assumed fine.
  const ctx = makeCtx({ adjacency: {}, out: { 'fx-q': { z_out: ['string'] } }, in: { 'fx-r': { z_in: ['string'] } } });
  const e = checkEdge('fx-q', 'fx-r', ctx);
  check('non-graph endpoints are named as such', e.undecided_reasons.includes('both-endpoints-not-graph-nodes'));
  check('non-graph endpoints leave the edge undecided', e.decided === false);
}

console.log('── Control 6: absence of evidence is not a finding ──');
{
  // Both nodes declare adjacency, just not to each other. Curated lists are partial — not a defect.
  const ctx = makeCtx({
    adjacency: { 'fx-m': { consumes: [], feeds: ['fx-other'] }, 'fx-n': { consumes: ['fx-elsewhere'], feeds: [] } },
    out: { 'fx-m': { m_out: ['string'] } },
    in: { 'fx-n': { n_in: ['string'] } },
  });
  const r = checkChain({ name: 'fx-unlisted', steps: [{ tool_id: 'fx-m' }, { tool_id: 'fx-n' }] }, ctx);
  check('an edge merely absent from the adjacency map is NOT a failure', r.verdict === 'L1-indeterminate');
  check('and it says so by name', r.reasons.includes('edge-absent-from-adjacency-map'));
}

console.log('── Control 7: type-compatibility primitives ──');
{
  check('integer and number are compatible', typesCompatible(['integer'], ['number']));
  check('string and number are NOT compatible', !typesCompatible(['string'], ['number']));
  check('nullable producer judged on its non-null type', !typesCompatible(['string', 'null'], ['number']));
  check('null-only producer cannot convict', typesCompatible(['null'], ['number']));
  check('unknown is a wildcard on either side', typesCompatible(['unknown'], ['number']) && typesCompatible(['string'], ['unknown']));
}

console.log('── Control 8: schema derivation ──');
{
  const s = induceSchema([{ a: 1, b: 'x' }, { a: null, c: [1] }]);
  check('induced schema unions observed types across vectors', s.fields.a.join('|') === 'integer|null');
  check('induced schema picks up a field seen in only one vector', Array.isArray(s.fields.c) && s.fields.c[0] === 'array');
  const j = schemaFromProperties({ properties: { p: { type: 'number' }, q: {} }, required: ['p'] });
  check('JSON Schema properties flatten to field types', j.fields.p[0] === 'number');
  check('a property with no declared type becomes unknown, not a guess', j.fields.q[0] === 'unknown');
  check('required list is preserved', j.required.includes('p'));
  check('a schema with no properties yields null (absent, not empty)', schemaFromProperties({ type: 'object' }) === null);
}

console.log(failures === 0 ? '\n✓ chain edge-contract selftest: all controls passed' : `\n✗ ${failures} control(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
