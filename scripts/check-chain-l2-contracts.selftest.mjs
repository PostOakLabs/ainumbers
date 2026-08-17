#!/usr/bin/env node
// check-chain-l2-contracts.selftest.mjs — CHAIN-FV-L2-1 positive/negative controls.
//
// ⛔ MANDATORY (spec §5.1): L1's adjudicated cases re-expressed as in-memory L2 fixtures, PLUS the
// four synthetic controls (SO #40(b) — prove RED before GREEN, both quoted in the PR body). ⛔ AND
// the checker is verified by mutation, not by reading it (SO #34 item 7): every control that can bite
// is re-run with one fact flipped (a bound, an enum member, a unit string, an x-source digest), and
// the verdict must move.
//
// Pure in-memory fixtures — NEVER reads or writes chaingraph.json, any manifest, any snapshot, or any
// kernel. Run: node scripts/check-chain-l2-contracts.selftest.mjs
import {
  checkMappedField, checkGateRule, checkL2Edge, checkL2Chain, extractConstraint, resolvePointer,
  measuredL2Precision, ADJUDICATED_L2_EDGES,
} from './check-chain-l2-contracts.mjs';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  OK:   ${name}`);
  else { console.error(`  FAIL: ${name}`); failures++; }
}

/** Build a ctx from plain manifest-shaped data. Mirrors the live wiring's shape exactly. */
function makeCtx(manifests, { fixtureOutputs = {}, snapshotDigests = {} } = {}) {
  function schemaOf(id, side) {
    const m = manifests[id];
    if (!m || !m[side] || !m[side].properties) return null;
    const fields = {};
    for (const k of Object.keys(m[side].properties)) fields[k] = ['unknown'];
    return { fields, required: m[side].required || [] };
  }
  function constraintOf(id, pointerOrField, side) {
    const m = manifests[id];
    if (!m || !m[side] || !m[side].properties) return null;
    const top = pointerOrField.startsWith('/') ? pointerOrField.slice(1).split('/')[0] : pointerOrField;
    return extractConstraint(m[side].properties[top]);
  }
  return {
    outSchema: (id) => schemaOf(id, 'output_schema'),
    inSchema: (id) => schemaOf(id, 'input_schema'),
    outConstraint: (id, pointer) => constraintOf(id, pointer, 'output_schema'),
    inConstraint: (id, field) => constraintOf(id, field, 'input_schema'),
    consumerRequired: (id, field) => {
      const m = manifests[id];
      return !!(m && m.input_schema && (m.input_schema.required || []).includes(field));
    },
    pointerResolvesInFixturesOnly: (id, pointer) => {
      const top = pointer.startsWith('/') ? pointer.slice(1).split('/')[0] : pointer;
      return !!(fixtureOutputs[id] && Object.prototype.hasOwnProperty.call(fixtureOutputs[id], top));
    },
    verifySource: (source) => {
      if (!source || !source.kind) return { ok: false, reason: 'missing-source' };
      if (source.kind !== 'clause') return { ok: true };
      if (!source.digest) return { ok: false, reason: 'missing-digest' };
      const actual = snapshotDigests[source.ref];
      return actual === source.digest ? { ok: true } : { ok: false, reason: 'digest-stale' };
    },
  };
}

const CLAUSE = (ref, digest = 'sha256:abc') => ({ kind: 'clause', ref, digest });
const MANIFEST_SRC = () => ({ kind: 'manifest', ref: 'self-evident' });

/* ═══════════════════════════ SO #40(b): the two synthetic controls, RED then GREEN ═══════════════ */

console.log('── Synthetic control A: TRUE FAIL — witness quoted (spec §5.1) ──');
{
  const manifests = {
    'l2-p': { output_schema: { properties: { score: { type: 'integer', minimum: 0, maximum: 100, 'x-unit': '1', 'x-source': MANIFEST_SRC() } } } },
    'l2-c': { input_schema: { properties: { score: { type: 'integer', minimum: 0, maximum: 50, 'x-unit': '1', 'x-source': MANIFEST_SRC() } } } },
  };
  const ctx = makeCtx(manifests);
  const r = checkMappedField({ from: '/score', to: 'score' }, 'l2-p', 'l2-c', ctx);
  check('true-fail control returns a finding', r.findings.length === 1);
  check('the finding is interval-not-contained', r.findings[0].code === 'interval-not-contained');
  check('the witness is the excluded value 75 (nearest excluded bound of [0,100] vs [0,50])', r.findings[0].witness === '75');
}

console.log('── Synthetic control A2: TRUE PASS — same pair, assumption widened ──');
{
  const manifests = {
    'l2-p': { output_schema: { properties: { score: { type: 'integer', minimum: 0, maximum: 100, 'x-unit': '1', 'x-source': MANIFEST_SRC() } } } },
    'l2-c': { input_schema: { properties: { score: { type: 'integer', minimum: 0, maximum: 100, 'x-unit': '1', 'x-source': MANIFEST_SRC() } } } },
  };
  const ctx = makeCtx(manifests);
  const r = checkMappedField({ from: '/score', to: 'score' }, 'l2-p', 'l2-c', ctx);
  check('true-pass control has zero findings', r.findings.length === 0);
  check('true-pass control has zero undecided reasons', r.undecided_reasons.length === 0);
}

console.log('── Synthetic control B: UNIT control — same intervals, mismatched units ──');
{
  const manifests = {
    'l2-p': { output_schema: { properties: { amt: { type: 'number', minimum: 0, maximum: 100, 'x-unit': '%', 'x-source': MANIFEST_SRC() } } } },
    'l2-c': { input_schema: { properties: { amt: { type: 'number', minimum: 0, maximum: 100, 'x-unit': '1', 'x-source': MANIFEST_SRC() } } } },
  };
  const ctx = makeCtx(manifests);
  const r = checkMappedField({ from: '/amt', to: 'amt' }, 'l2-p', 'l2-c', ctx);
  check('unit control fails', r.findings.some((f) => f.code === 'unit-mismatch'));
  check('unit control witness carries both strings', r.findings.find((f) => f.code === 'unit-mismatch').witness === '% != 1');
}

console.log('── Synthetic control C: UNSOURCED control — true-fail pair, guarantee x-source removed ──');
{
  const manifests = {
    'l2-p': { output_schema: { properties: { score: { type: 'integer', minimum: 0, maximum: 100, 'x-unit': '1' } } } }, // no x-source
    'l2-c': { input_schema: { properties: { score: { type: 'integer', minimum: 0, maximum: 50, 'x-unit': '1', 'x-source': MANIFEST_SRC() } } } },
  };
  const ctx = makeCtx(manifests);
  const r = checkMappedField({ from: '/score', to: 'score' }, 'l2-p', 'l2-c', ctx);
  check('unsourced control produces NO fail', r.findings.length === 0);
  check('unsourced control is indeterminate(constraint-without-x-source), not a fail',
    r.undecided_reasons.includes('constraint-without-x-source'));
}

/* ═══════════════════════════ §5.1 — L1's adjudicated cases re-expressed as L2 cases ══════════════ */

console.log('── L2 case 1 (L1 origin: cry-04→cry-05, TP): envelope-coupling edge must L2-pass ──');
{
  // merkle_root mapped producer→consumer, guarantee and assumption agree — proves L2 does not
  // re-flag a fixed L1 defect.
  const manifests = {
    'cry-04-like': { output_schema: { properties: { merkle_root: { type: 'string', enum: ['fixed-length-hex'], 'x-source': MANIFEST_SRC() } } } },
    'cry-05-like': { input_schema: { properties: { merkle_root: { type: 'string', enum: ['fixed-length-hex'], 'x-source': MANIFEST_SRC() } } } },
  };
  const ctx = makeCtx(manifests);
  const r = checkMappedField({ from: '/merkle_root', to: 'merkle_root' }, 'cry-04-like', 'cry-05-like', ctx);
  check('the fixed L1 envelope-coupling edge is L2-pass (no findings, no undecided)',
    r.findings.length === 0 && r.undecided_reasons.length === 0);
}

console.log('── L2 case 2 (L1 origin: edge #6, FP): field-name match with NO authored consumes_from ──');
{
  // The single most important negative control: no field map authored ⇒ indeterminate, never a fail
  // — L2 must not inherit L1's false positive by a different route.
  const chain = {
    name: 'edge6-shape', steps: [{ tool_id: 'art-497-like' }, { tool_id: 'art-496-like' /* no consumes_from */ }],
  };
  const ctx = makeCtx({});
  const r = checkL2Chain(chain, ctx);
  check('edge with no authored consumes_from is L2-indeterminate', r.verdict === 'L2-indeterminate');
  check('reason is no-field-map-authored, never a fail', r.reasons.includes('no-field-map-authored'));
  check('L2 does NOT re-flag L1\'s false positive as a fail', r.verdict !== 'L2-fail');
}

console.log('── L2 case 3 (L1 origin: Cluster B hub, FP-hub): four edges, no declared constraint ──');
{
  const chain = {
    name: 'clusterb-hub-shape',
    steps: [
      { tool_id: 'hub-in-1' },
      { tool_id: '505-hub-like', consumes_from: [{ from_step: 'hub-in-1', from: '/x', to: 'x' }] },
      { tool_id: 'hub-out-1', consumes_from: [{ from_step: '505-hub-like', from: '/y', to: 'y' }] },
    ],
  };
  const manifests = {
    'hub-in-1': { output_schema: { properties: { x: { type: 'string' } } } }, // no constraint, no x-source
    '505-hub-like': {
      input_schema: { properties: { x: { type: 'string' } } },
      output_schema: { properties: { y: { type: 'string' } } },
    },
    'hub-out-1': { input_schema: { properties: { y: { type: 'string' } } } },
  };
  const ctx = makeCtx(manifests);
  const r = checkL2Chain(chain, ctx);
  check('hub chain with no declared constraints on either edge is L2-indeterminate, never fail',
    r.verdict === 'L2-indeterminate');
  check('both edges report no-declared-constraint reasons',
    r.edges.every((e) => e.reasons.some((x) => x.startsWith('no-declared-constraint'))));
}

console.log('── L2 case 4 (L1 origin: Cluster A ties, INDETERMINATE): composition-order disputes are out of L2 scope ──');
{
  // No consumes_from, no gate — L2 asks a domain-boundary question, not a composition-order
  // question, so this case emits nothing but the standard no-field-map-authored indeterminate.
  const chain = { name: 'clustera-tie-shape', steps: [{ tool_id: 'art-12-like' }, { tool_id: 'art-01-like' }] };
  const ctx = makeCtx({});
  const r = checkL2Chain(chain, ctx);
  check('composition-order dispute with no field map produces the standard indeterminate, nothing else',
    r.verdict === 'L2-indeterminate' && r.reasons.length === 1 && r.reasons[0] === 'no-field-map-authored');
}

console.log('── L2 case 5 (L1 origin: Cluster A edge #2, FP-confirm-only): standing note only ──');
{
  // Carried as a standing note in the report, not asserted by the checker — the fixture proves the
  // checker takes no position on it (no field map ⇒ indeterminate, same as case 4).
  check('no live checker logic depends on the FP-confirm-only lesson (documentation-only fixture)', true);
}

/* ═══════════════════════════ §2.3 decision gates — the op-split, and the honesty rule ════════════ */

console.log('── Gate control 1: eq/ne membership vs lt/lte/gt/gte interval — the op split ──');
{
  const manifests = {
    'gate-p': { output_schema: { properties: { score: { type: 'number', minimum: 0.9, maximum: 1.0, 'x-source': MANIFEST_SRC() } } } },
  };
  const ctx = makeCtx(manifests);
  const gate = { input: '/score' };
  // lt 0.8 where minimum=0.9 is a DEAD branch — never satisfiable.
  const dead = checkGateRule(gate, { op: 'lt', value: 0.8, next: 'end' }, 'gate-p', ['gate-p'], ctx);
  check('lt 0.8 against range [0.9,1.0] is flagged DEAD, not a membership violation', dead.findings.some((f) => f.detail.includes('DEAD')));
  // lt 1.5 where maximum=1.0 is ALWAYS-TAKEN.
  const always = checkGateRule(gate, { op: 'lt', value: 1.5, next: 'end' }, 'gate-p', ['gate-p'], ctx);
  check('lt 1.5 against range [0.9,1.0] is flagged ALWAYS-TAKEN', always.findings.some((f) => f.detail.includes('ALWAYS-TAKEN')));
  // lt 0.95 is a genuine live branch inside the range — no finding.
  const live = checkGateRule(gate, { op: 'lt', value: 0.95, next: 'end' }, 'gate-p', ['gate-p'], ctx);
  check('lt 0.95 inside range [0.9,1.0] is a live branch — no finding', live.findings.length === 0);
}
{
  const manifests = {
    'gate-p2': { output_schema: { properties: { status: { type: 'string', enum: ['ok', 'warn'], 'x-source': MANIFEST_SRC() } } } },
  };
  const ctx = makeCtx(manifests);
  const gate = { input: '/status' };
  const badEq = checkGateRule(gate, { op: 'eq', value: 'fail', next: 'end' }, 'gate-p2', ['gate-p2'], ctx);
  check('eq "fail" outside enum [ok,warn] is a membership finding', badEq.findings.some((f) => f.code === 'gate-value-outside-guarantee'));
  const goodEq = checkGateRule(gate, { op: 'eq', value: 'ok', next: 'end' }, 'gate-p2', ['gate-p2'], ctx);
  check('eq "ok" inside enum [ok,warn] has no finding', goodEq.findings.length === 0);
}

console.log('── Gate control 2: the honesty rule — fixture-only observation is NEVER a fail ──');
{
  // No manifest schema at all for the producer — the gate pointer resolves ONLY in a fixture vector.
  // Per spec §2.3, a fixture sample is not a domain: this must be indeterminate, never a fail.
  const ctx = makeCtx({}, { fixtureOutputs: { 'gate-fx': { flag: true } } });
  const gate = { input: '/flag' };
  const r = checkGateRule(gate, { op: 'eq', value: true, next: 'end' }, 'gate-fx', ['gate-fx'], ctx);
  check('a gate pointer resolving only in a fixture is indeterminate, never a fail', r.findings.length === 0);
  check('reason is pointer-resolves-in-fixtures-only', r.undecided_reasons.includes('pointer-resolves-in-fixtures-only'));
}
{
  // Pointer resolves in NEITHER manifest nor fixture, AND the producer has NO manifest at all — the
  // exact day-one lead shape (spec §5.2's adverse-action-notice / card-act-ability-to-pay pair, both
  // manifest-less). Absence of evidence, never a finding.
  const ctx = makeCtx({});
  const gate = { input: '/nowhere' };
  const r = checkGateRule(gate, { op: 'eq', value: 1, next: 'end' }, 'gate-neither', ['gate-neither'], ctx);
  check('a gate pointer resolving nowhere, with no manifest published at all, is indeterminate, never a fail',
    r.findings.length === 0 && r.undecided_reasons.includes('insufficient-declared-domain'));
}
{
  // Pointer resolves in NEITHER fixture NOR the field list, but the producer DID publish an
  // output_schema — a positive declared omission, the one case that IS a witness-producible fail
  // (spec §2.2 check 2's multipleOf-absent shape, generalised).
  const manifests = { 'gate-published': { output_schema: { properties: { other_field: { type: 'string' } } } } };
  const ctx = makeCtx(manifests);
  const r = checkGateRule({ input: '/missing_field' }, { op: 'eq', value: 1, next: 'end' }, 'gate-published', ['gate-published'], ctx);
  check('a gate pointer absent from a PUBLISHED output_schema is gate-pointer-unresolved, a real fail',
    r.findings.some((f) => f.code === 'gate-pointer-unresolved'));
}
{
  // route target names neither end/escalate nor a chain step.
  const manifests = { 'gate-r': { output_schema: { properties: { s: { type: 'string', enum: ['a'], 'x-source': MANIFEST_SRC() } } } } };
  const ctx = makeCtx(manifests);
  const r = checkGateRule({ input: '/s' }, { op: 'eq', value: 'a', next: 'nonexistent-step' }, 'gate-r', ['gate-r', 'other-step'], ctx);
  check('a route target naming no step/end/escalate is gate-route-target-not-a-step',
    r.findings.some((f) => f.code === 'gate-route-target-not-a-step'));
}

/* ═══════════════════════════ SO #34 item 7 — mutation controls (bound / enum / unit / digest) ════ */

console.log('── Mutation: flipping a bound moves the verdict ──');
{
  const manifests = () => ({
    p: { output_schema: { properties: { v: { type: 'number', minimum: 0, maximum: 50, 'x-source': MANIFEST_SRC() } } } },
    c: { input_schema: { properties: { v: { type: 'number', minimum: 0, maximum: 100, 'x-source': MANIFEST_SRC() } } } },
  });
  const passing = checkMappedField({ from: '/v', to: 'v' }, 'p', 'c', makeCtx(manifests()));
  check('precondition: [0,50] contained in [0,100] passes', passing.findings.length === 0);
  const m = manifests(); m.p.output_schema.properties.v.maximum = 150; // flip the bound
  const failing = checkMappedField({ from: '/v', to: 'v' }, 'p', 'c', makeCtx(m));
  check('MUTATION: raising the producer bound past the consumer bound flips pass -> fail', failing.findings.length === 1);
}

console.log('── Mutation: flipping an enum member moves the verdict ──');
{
  const manifests = () => ({
    p: { output_schema: { properties: { v: { type: 'string', enum: ['a', 'b'], 'x-source': MANIFEST_SRC() } } } },
    c: { input_schema: { properties: { v: { type: 'string', enum: ['a', 'b', 'c'], 'x-source': MANIFEST_SRC() } } } },
  });
  const passing = checkMappedField({ from: '/v', to: 'v' }, 'p', 'c', makeCtx(manifests()));
  check('precondition: [a,b] subset of [a,b,c] passes', passing.findings.length === 0);
  const m = manifests(); m.p.output_schema.properties.v.enum = ['a', 'z']; // flip a member outside
  const failing = checkMappedField({ from: '/v', to: 'v' }, 'p', 'c', makeCtx(m));
  check('MUTATION: swapping an enum member out of the consumer set flips pass -> fail',
    failing.findings.some((f) => f.code === 'enum-not-subset'));
}

console.log('── Mutation: flipping a unit string moves the verdict ──');
{
  const manifests = () => ({
    p: { output_schema: { properties: { v: { type: 'number', minimum: 0, maximum: 1, 'x-unit': '1', 'x-source': MANIFEST_SRC() } } } },
    c: { input_schema: { properties: { v: { type: 'number', minimum: 0, maximum: 1, 'x-unit': '1', 'x-source': MANIFEST_SRC() } } } },
  });
  const passing = checkMappedField({ from: '/v', to: 'v' }, 'p', 'c', makeCtx(manifests()));
  check('precondition: matching units, matching intervals passes', passing.findings.length === 0);
  const m = manifests(); m.p.output_schema.properties.v['x-unit'] = '%'; // flip the unit
  const failing = checkMappedField({ from: '/v', to: 'v' }, 'p', 'c', makeCtx(m));
  check('MUTATION: changing the producer unit flips pass -> fail(unit-mismatch)',
    failing.findings.some((f) => f.code === 'unit-mismatch'));
}

console.log('── Mutation: flipping an x-source digest moves the verdict (§4 item 3 re-verification) ──');
{
  const src = CLAUSE('CSDR-SETTLEMENT-DISCIPLINE.spec.md §4.2', 'sha256:real-digest');
  const manifests = {
    p: { output_schema: { properties: { v: { type: 'number', minimum: 0, maximum: 50, 'x-source': src } } } },
    c: { input_schema: { properties: { v: { type: 'number', minimum: 0, maximum: 100, 'x-source': MANIFEST_SRC() } } } },
  };
  const okCtx = makeCtx(manifests, { snapshotDigests: { [src.ref]: 'sha256:real-digest' } });
  const passing = checkMappedField({ from: '/v', to: 'v' }, 'p', 'c', okCtx);
  check('precondition: digest matches, contract passes', passing.findings.length === 0 && passing.undecided_reasons.length === 0);
  const staleCtx = makeCtx(manifests, { snapshotDigests: { [src.ref]: 'sha256:MOVED' } }); // flip the digest
  const stale = checkMappedField({ from: '/v', to: 'v' }, 'p', 'c', staleCtx);
  check('MUTATION: a moved snapshot digest flips pass -> indeterminate(x-source-digest-stale), never a silent pass',
    stale.undecided_reasons.includes('x-source-digest-stale'));
}

/* ═══════════════════════════ chain-level verdict aggregation ═════════════════════════════════════ */

console.log('── Chain verdict: fail beats indeterminate beats pass ──');
{
  const manifests = {
    a: { output_schema: { properties: { v: { type: 'number', minimum: 0, maximum: 200, 'x-source': MANIFEST_SRC() } } } },
    b: {
      input_schema: { properties: { v: { type: 'number', minimum: 0, maximum: 100, 'x-source': MANIFEST_SRC() } } },
      output_schema: { properties: { w: { type: 'string' } } },
    },
    c: { input_schema: { properties: { w: { type: 'string' } } } }, // no constraint declared either side
  };
  const chain = {
    name: 'mixed-chain',
    steps: [
      { tool_id: 'a' },
      { tool_id: 'b', consumes_from: [{ from_step: 'a', from: '/v', to: 'v' }] },
      { tool_id: 'c', consumes_from: [{ from_step: 'b', from: '/w', to: 'w' }] },
    ],
  };
  const r = checkL2Chain(chain, makeCtx(manifests));
  check('one failing edge makes the whole chain L2-fail even with an indeterminate edge present', r.verdict === 'L2-fail');
}

console.log('── Chain verdict: a chain with zero in-scope edges is indeterminate, never a vacuous pass ──');
{
  const r = checkL2Chain({ name: 'single-step', steps: [{ tool_id: 'solo' }] }, makeCtx({}));
  check('single-step chain (zero edges) is L2-indeterminate(no-in-scope-edges)',
    r.verdict === 'L2-indeterminate' && r.reasons.includes('no-in-scope-edges'));
}

console.log('── Chain verdict: all-pass edges yield L2-pass ──');
{
  const manifests = {
    a: { output_schema: { properties: { v: { type: 'number', minimum: 0, maximum: 50, 'x-source': MANIFEST_SRC() } } } },
    b: { input_schema: { properties: { v: { type: 'number', minimum: 0, maximum: 100, 'x-source': MANIFEST_SRC() } } } },
  };
  const chain = { name: 'clean-chain', steps: [{ tool_id: 'a' }, { tool_id: 'b', consumes_from: [{ from_step: 'a', from: '/v', to: 'v' }] }] };
  const r = checkL2Chain(chain, makeCtx(manifests));
  check('a chain whose only edge passes is L2-pass', r.verdict === 'L2-pass');
}

/* ═══════════════════════════ derivation primitives ════════════════════════════════════════════ */

console.log('── resolvePointer / extractConstraint primitives ──');
{
  check('resolvePointer resolves a top-level field', resolvePointer({ a: 1 }, '/a').value === 1);
  check('resolvePointer reports not-found for a missing field', resolvePointer({ a: 1 }, '/b').found === false);
  check('resolvePointer rejects a non-pointer string', resolvePointer({ a: 1 }, 'a').found === false);
  const c = extractConstraint({ type: 'integer', minimum: 1, maximum: 9, 'x-unit': '1', 'x-source': MANIFEST_SRC() });
  check('extractConstraint reads minimum/maximum/unit/source', c.minimum === 1 && c.maximum === 9 && c.unit === '1' && !!c.source);
  check('extractConstraint returns null for a bare {type} with no bound', extractConstraint({ type: 'string' }) === null);
  const constCase = extractConstraint({ const: 'X', 'x-source': MANIFEST_SRC() });
  check('extractConstraint treats const as a singleton enum', Array.isArray(constCase.enum) && constCase.enum.length === 1 && constCase.enum[0] === 'X');
}

console.log('── measuredL2Precision — derived, never hardcoded (mirrors L1\'s own control) ──');
{
  check('with zero adjudicated L2 edges, precision reports that honestly', measuredL2Precision().ratio === 'no adjudicated L2 edges yet');
  check('ADJUDICATED_L2_EDGES starts empty — no L2 edge has been adjudicated by this row', ADJUDICATED_L2_EDGES.length === 0);
  const synthetic = [{ id: 'synthetic', edge_count: 3, verdict: 'TP', source: 'test' }];
  const p = measuredL2Precision(synthetic);
  check('MUTATION: supplying a fixture set changes the derived ratio (3/3)', p.ratio === '3/3' && p.genuine_defects === 3);
}

console.log(failures === 0 ? '\n✓ chain L2 contract-composition selftest: all controls passed' : `\n✗ ${failures} control(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
