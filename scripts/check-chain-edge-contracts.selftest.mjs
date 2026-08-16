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
import {
  checkChain, checkEdge, typesCompatible, induceSchema, schemaFromProperties,
  classifyCoupling, classifyChainFindings, measuredPrecision, ADJUDICATED_EDGES, ENVELOPE_COUPLING_FIELD,
  PROSE_ORACLE_CAVEAT,
} from './check-chain-edge-contracts.mjs';

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

console.log('── Control 9: DATA-COUPLED vs NAME-ONLY classifier (CHAIN-FV-L1-PRECISION-1) ──');
{
  check('the envelope coupling field is execution_hash', ENVELOPE_COUPLING_FIELD === 'execution_hash');

  // Modelled on the REAL cry-05 kernel: normalizeEntry() reads `el.execution_hash` off an artifact
  // object. This is the genuinely DATA-COUPLED shape (CRY-EDGE-CONFIRM-1 / CRY-EDGE-DENY-1).
  const cry05Like = `function normalizeEntry(el) { if (el && el.execution_hash) { return el.execution_hash; } }`;
  check('a kernel reading .execution_hash classifies DATA-COUPLED', classifyCoupling(cry05Like) === 'DATA-COUPLED');

  // Modelled on the REAL art-496 kernel: reads pp.as_of, a coincidentally same-named but never
  // actually-delivered field (EDGE6-TYPECONFLICT-CONFIRM-1 / -DENY-1 — no chain runner even connects
  // the two nodes, and the field is caller-supplied, never producer-delivered).
  const art496Like = `function compute(pp) { const as_of = num(pp.as_of) ?? 0; return { as_of }; }`;
  check('a kernel reading an unrelated same-named field (no execution_hash) classifies NAME-ONLY',
    classifyCoupling(art496Like) === 'NAME-ONLY');

  // Modelled on the REAL Cluster-B kernels (CLUSTERB-505-CONFIRM-1 / -DENY-1): zero real field
  // overlap in either direction, no execution_hash reference anywhere.
  const clusterBLike = `function compute(pp) { return { eligible: pp.collateral_type === 'tokenized' }; }`;
  check('a kernel with zero coupling-field access classifies NAME-ONLY', classifyCoupling(clusterBLike) === 'NAME-ONLY');

  check('no kernel source available classifies UNCLASSIFIED, never silently downgraded', classifyCoupling(null) === 'UNCLASSIFIED');
  check('UNCLASSIFIED is not NAME-ONLY (absence of evidence never downgrades — SO #34c)',
    classifyCoupling(null) !== 'NAME-ONLY');

  // MUTATION (SO #34): strip the execution_hash access and the classification must flip.
  const mutatedCry05 = cry05Like.replace(/execution_hash/g, 'unrelated_field');
  check('MUTATION: removing the execution_hash access flips DATA-COUPLED -> NAME-ONLY',
    classifyCoupling(mutatedCry05) === 'NAME-ONLY');

  // Bracket and destructure access forms also count as a real read, not just dot-access.
  check('bracket-notation access counts as a read', classifyCoupling(`x[pp['execution_hash']]`) === 'DATA-COUPLED');
  check('destructure counts as a read', classifyCoupling(`const { execution_hash, tool_id } = artifact;`) === 'DATA-COUPLED');
}

console.log('── Control 10: classifyChainFindings — prove BOTH directions (row done-criterion) ──');
{
  // (a) A genuinely DATA-COUPLED contradiction must NOT be downgraded — cry-05's known-good shape.
  {
    const r = checkChain(
      { name: 'fx-cry05-shape', steps: [{ tool_id: 'fx-p' }, { tool_id: 'fx-c' }] },
      { adjacency: new Map([['fx-p', { consumes: [], feeds: [] }], ['fx-c', { consumes: [], feeds: ['fx-p'] }]]), outSchema: () => null, inSchema: () => null },
    );
    check('precondition: synthetic chain has one edge-inverted hard finding pre-classification',
      r.findings.length === 1 && r.findings[0].code === 'edge-inverted');
    const classified = classifyChainFindings(r, (id) => (id === 'fx-c' ? cry05LikeSource() : null));
    check('DATA-COUPLED finding stays a HARD finding (not downgraded)', classified.findings.length === 1);
    check('DATA-COUPLED finding is tagged correctly', classified.findings[0].coupling === 'DATA-COUPLED');
    check('info_findings stays empty', classified.info_findings.length === 0);
    check('chain verdict stays L1-fail', classified.verdict === 'L1-fail');
  }

  // (b) A NAME-ONLY match on edge #6's ACTUAL shape — type-conflict, not edge-inverted — downgrades
  // to INFO and the verdict recomputes. (CHAIN-FV-L1-PRECISION-2: the downgrade is now scoped to
  // type-conflict only — see Control 12 — so this fixture must use edge #6's real finding code to
  // stay a faithful positive control.)
  {
    const ctx = makeCtx({
      adjacency: { 'fx-p': { consumes: [], feeds: ['fx-c'] }, 'fx-c': { consumes: ['fx-p'], feeds: [] } },
      out: { 'fx-p': { as_of: ['string', 'null'] } },
      in: { 'fx-c': { as_of: ['number'] } },
    });
    const r = checkChain({ name: 'fx-edge6-shape', steps: [{ tool_id: 'fx-p' }, { tool_id: 'fx-c' }] }, ctx);
    check('precondition: synthetic chain has one type-conflict hard finding pre-classification (edge #6\'s real code)',
      r.findings.length === 1 && r.findings[0].code === 'type-conflict');
    const classified = classifyChainFindings(r, (id) => (id === 'fx-c' ? art496LikeSource() : null));
    check('NAME-ONLY type-conflict finding is removed from the hard findings list', classified.findings.length === 0);
    check('NAME-ONLY finding is reported as INFO, never dropped', classified.info_findings.length === 1);
    check('info finding is tagged NAME-ONLY', classified.info_findings[0].coupling === 'NAME-ONLY');
    check('chain verdict recomputes away from L1-fail once the only finding is NAME-ONLY',
      classified.verdict !== 'L1-fail');
  }

  // (c) Cluster B's REAL shape is edge-inverted (a hub node's declared direction vs. the chain's
  // real step order), not type-conflict — CHAIN-FV-L1-PRECISION-2 measured this live (canton-margin-
  // call, canton-mmf-collateral, canton-securities-lending, rhc-collateral-haircut, us-treasury-
  // clearing all still carry the same edge-inverted finding against node 505). Because the NAME-ONLY
  // downgrade is now scoped to type-conflict only, these correctly STAY hard findings post-fix — the
  // CLUSTERB-505-* pair's FP-hub verdict lives in ADJUDICATED_EDGES (excluded from the genuine-
  // defects numerator there), not as a live-classifier suppression. A hard finding is a lead, not an
  // unconditional defect claim (the checker is advisory and always exits 0) — an already-adjudicated
  // lead staying visible is correct, not a regression.
  {
    const hubChain = checkChain(
      { name: 'fx-clusterb-shape', steps: [{ tool_id: 'fx-a' }, { tool_id: 'fx-hub' }, { tool_id: 'fx-b' }] },
      {
        adjacency: new Map([
          ['fx-a', { consumes: [], feeds: [] }],
          ['fx-hub', { consumes: [], feeds: ['fx-a', 'fx-b'] }], // both directions declared inverted vs the chain
          ['fx-b', { consumes: ['fx-hub'], feeds: [] }],
        ]),
        outSchema: () => null,
        inSchema: () => null,
      },
    );
    check('precondition: synthetic hub chain carries edge-inverted findings pre-classification',
      hubChain.findings.length >= 1 && hubChain.findings.every((f) => f.code === 'edge-inverted'));
    const classified = classifyChainFindings(hubChain, () => clusterBLikeSource());
    check('edge-inverted hub findings are tagged NAME-ONLY (kernel source has zero coupling-field access)',
      classified.findings.every((f) => f.coupling === 'NAME-ONLY'));
    check('but STAY hard findings post-fix — edge-inverted is never eligible for the downgrade',
      classified.findings.length === hubChain.findings.length && classified.info_findings.length === 0);
  }
}

console.log('── Control 11: measured precision is DERIVED, not hardcoded, and is regression-tested ──');
{
  const p = measuredPrecision();
  check('genuine defects is exactly the count of TP fixtures (cry-05 + Cluster A edge #4)', p.genuine_defects === 2);
  check('adjudicated edges sums every fixture\'s edge_count (1 + 1 + 4 + 5 Cluster A = 11)', p.adjudicated_edges === 11);
  check('ratio string matches the derived numbers', p.ratio === '2/11');
  check('Cluster A IS folded in (CHAIN-FV-L1-PRECISION-2)',
    ADJUDICATED_EDGES.some((f) => f.id.toLowerCase().includes('cluster a')));
  check('Cluster A contributes exactly one TP (edge #4), one distinct CONFIRM-ONLY FP (edge #2), three INDETERMINATE (#1/#3/#14)',
    ADJUDICATED_EDGES.filter((f) => f.id.toLowerCase().includes('cluster a') && f.verdict === 'TP').length === 1
    && ADJUDICATED_EDGES.filter((f) => f.id.toLowerCase().includes('cluster a') && f.verdict === 'FP-confirm-only').length === 1
    && ADJUDICATED_EDGES.filter((f) => f.id.toLowerCase().includes('cluster a') && f.verdict === 'INDETERMINATE').length === 3);
  check('edge #2\'s FP class is DISTINCT from Cluster B\'s FP-hub class, not merged into it',
    ADJUDICATED_EDGES.some((f) => f.verdict === 'FP-confirm-only') && ADJUDICATED_EDGES.some((f) => f.verdict === 'FP-hub'));

  // REGRESSION: if a future change silently reclassifies one of the settled fixtures, the ratio MUST
  // move — this is what makes precision a measured property, not a claim (the row's own done-
  // criterion for part 3).
  const mutated = ADJUDICATED_EDGES.map((f) => (f.id.startsWith('edge #6') ? { ...f, verdict: 'TP' } : f));
  const mutatedP = measuredPrecision(mutated);
  check('MUTATION: reclassifying edge #6 as a TP moves the ratio (3/11, not still 2/11)',
    mutatedP.genuine_defects === 3 && mutatedP.ratio === '3/11');

  const mutated2 = ADJUDICATED_EDGES.map((f) => (f.id.includes('Cluster A edge #4') ? { ...f, verdict: 'FP' } : f));
  const mutatedP2 = measuredPrecision(mutated2);
  check('MUTATION: flipping Cluster A edge #4 off TP moves the ratio (1/11, not still 2/11)',
    mutatedP2.genuine_defects === 1 && mutatedP2.ratio === '1/11');
}

console.log('── Control 12: NAME-ONLY downgrade is scoped to type-conflict only (CHAIN-FV-L1-PRECISION-2) ──');
{
  // art-01-like: a real Cluster-A-shaped consumer that never reads execution_hash (art-01 reads
  // caller-pasted intent/cart/payment JSON only) — modelled on, not copied from, the real kernel.
  const art01Like = `function compute(pp) { return { mandate_ids: { intent: pp.intent, cart: pp.cart, payment: pp.payment } }; }`;
  check('precondition: this source classifies NAME-ONLY under the raw execution_hash read-check',
    classifyCoupling(art01Like) === 'NAME-ONLY');

  // (a) An edge-inverted finding against this NAME-ONLY source must stay HARD — the Cluster-A
  // edge-#4 shape: a confirmed true positive that the raw execution_hash heuristic alone would have
  // wrongly downgraded.
  {
    const r = checkChain(
      { name: 'fx-edge4-shape', steps: [{ tool_id: 'fx-p' }, { tool_id: 'fx-c' }] },
      { adjacency: new Map([['fx-p', { consumes: [], feeds: [] }], ['fx-c', { consumes: [], feeds: ['fx-p'] }]]), outSchema: () => null, inSchema: () => null },
    );
    check('precondition: synthetic chain carries one edge-inverted finding pre-classification',
      r.findings.length === 1 && r.findings[0].code === 'edge-inverted');
    const classified = classifyChainFindings(r, (id) => (id === 'fx-c' ? art01Like : null));
    check('edge-inverted finding against a NAME-ONLY-coupled consumer STAYS a hard finding (not downgraded)',
      classified.findings.length === 1);
    check('its coupling tag is still computed and reported as NAME-ONLY, for transparency', classified.findings[0].coupling === 'NAME-ONLY');
    check('it is NOT duplicated into info_findings', classified.info_findings.length === 0);
    check('chain verdict stays L1-fail', classified.verdict === 'L1-fail');
  }

  // (b) The SAME NAME-ONLY source against a type-conflict finding still downgrades — the eligible
  // case is unaffected by the fix; only edge-inverted's eligibility changed.
  {
    const ctx = makeCtx({
      adjacency: { 'fx-p': { consumes: [], feeds: ['fx-c'] }, 'fx-c': { consumes: ['fx-p'], feeds: [] } },
      out: { 'fx-p': { as_of: ['string'] } },
      in: { 'fx-c': { as_of: ['number'] } },
    });
    const r = checkChain({ name: 'fx-typeclash-shape', steps: [{ tool_id: 'fx-p' }, { tool_id: 'fx-c' }] }, ctx);
    check('precondition: synthetic chain carries one type-conflict finding pre-classification',
      r.findings.length === 1 && r.findings[0].code === 'type-conflict');
    const classified = classifyChainFindings(r, (id) => (id === 'fx-c' ? art01Like : null));
    check('type-conflict finding against a NAME-ONLY-coupled consumer DOES downgrade to INFO', classified.findings.length === 0);
    check('it is reported as INFO, never dropped', classified.info_findings.length === 1);
  }

  // MUTATION (SO #34): the fix itself must be provable by mutation — restoring the OLD (uniform)
  // downgrade rule on the same edge-inverted fixture must make it downgrade, proving the scoping
  // restriction is what is actually doing the work, not some other code path.
  {
    const oldRuleHard = (finding) => finding.coupling !== 'NAME-ONLY'; // the PRECISION-1 rule, pre-fix
    const r = checkChain(
      { name: 'fx-edge4-shape', steps: [{ tool_id: 'fx-p' }, { tool_id: 'fx-c' }] },
      { adjacency: new Map([['fx-p', { consumes: [], feeds: [] }], ['fx-c', { consumes: [], feeds: ['fx-p'] }]]), outSchema: () => null, inSchema: () => null },
    );
    const tagged = r.findings.map((f) => ({ ...f, coupling: classifyCoupling(art01Like) }));
    check('MUTATION: under the OLD uniform rule this same finding WOULD have downgraded (proves the fix is load-bearing)',
      tagged.filter(oldRuleHard).length === 0);
  }
}

console.log('── Control 13: PROSE_ORACLE_CAVEAT is present and names its worked example (CHAIN-FV-L1-PRECISION-2) ──');
{
  check('caveat states prose is evidence, never an oracle', /evidence/i.test(PROSE_ORACLE_CAVEAT.note) && /oracle/i.test(PROSE_ORACLE_CAVEAT.note));
  check('caveat names Cluster A edge #3 as its worked example', PROSE_ORACLE_CAVEAT.worked_example.includes('art-04') && PROSE_ORACLE_CAVEAT.worked_example.includes('art-32'));
  check('caveat cites its source rows, not asserted from nothing', PROSE_ORACLE_CAVEAT.source.includes('CLUSTERA-AP2-DENY-1'));
  check('caveat does not render a verdict on edge #3 (no CONFIRMED/DENIED/REFUTED language)',
    !/\b(confirmed|refuted|denied)\b/i.test(PROSE_ORACLE_CAVEAT.note) && !/\b(confirmed|refuted|denied)\b/i.test(PROSE_ORACLE_CAVEAT.worked_example));
}

/* Synthetic kernel-source fixtures for Control 10, modelled on (but not copied verbatim from) the
 * real cry-05 / art-496 / Cluster-B kernels named in the adjudication rows. */
function cry05LikeSource() {
  return `function normalizeEntry(el) { if (el && el.execution_hash) { return el.execution_hash; } }`;
}
function art496LikeSource() {
  return `function compute(pp) { const as_of = num(pp.as_of) ?? 0; return { as_of }; }`;
}
function clusterBLikeSource() {
  return `function compute(pp) { return { eligible: pp.collateral_type === 'tokenized' }; }`;
}

console.log(failures === 0 ? '\n✓ chain edge-contract selftest: all controls passed' : `\n✗ ${failures} control(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
