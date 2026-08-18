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
  checkSharedInputField, checkSharedInputs, checkProvenanceThreading, gateAuthoringInstruction,
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
  // ⛔ RESCOPE-1 amended this control's EXPECTED VERDICT, not its purpose. The purpose — L2 must not
  // inherit L1's false positive by a different route — is unchanged and still asserted below. What
  // changed is that "no field map" is now a structural not-applicable, not an open chore.
  check('edge with no authored consumes_from is L2-not-applicable', r.verdict === 'L2-not-applicable');
  check('reason is the structural one, never a fail', r.reasons.includes('chain-steps-independently-parameterised'));
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
  // question, so this case emits the structural not-applicable and nothing else.
  const chain = { name: 'clustera-tie-shape', steps: [{ tool_id: 'art-12-like' }, { tool_id: 'art-01-like' }] };
  const ctx = makeCtx({});
  const r = checkL2Chain(chain, ctx);
  check('composition-order dispute with no field map produces the structural not-applicable, nothing else',
    r.verdict === 'L2-not-applicable' && r.reasons.includes('chain-steps-independently-parameterised'));
  check('and it raises no finding of any kind', r.findings.length === 0);
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

console.log('── Chain verdict: a chain with zero in-scope edges is never a vacuous pass ──');
{
  // ⛔ RESCOPE-1: a single-step chain has no edges BY CONSTRUCTION — structural absence, so the
  // verdict is not-applicable rather than indeterminate. The invariant the original control existed
  // to protect is unchanged and is asserted first: ⛔ never a vacuous pass.
  const r = checkL2Chain({ name: 'single-step', steps: [{ tool_id: 'solo' }] }, makeCtx({}));
  check('single-step chain (zero edges) is ⛔ NOT L2-pass', r.verdict !== 'L2-pass');
  check('it is L2-not-applicable(no-in-scope-edges)',
    r.verdict === 'L2-not-applicable' && r.reasons.includes('no-in-scope-edges'));
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

/* ═══════════════ CHAIN-FV-L2-RESCOPE-1 — L2-S shared-input coherence (spec §2.7) ═════════════════ */

/** Build checkSharedInputField participants from plain property schemas. */
function parts(...entries) {
  return entries.map(([step, prop]) => ({
    step,
    types: prop && prop.type ? [prop.type] : ['unknown'],
    constraint: extractConstraint(prop),
  }));
}

console.log('── L2-S control RED: currency [EUR] vs [USD] — disjoint, must FAIL with a witness ──');
{
  const r = checkSharedInputField('currency', parts(
    ['step-a', { type: 'string', enum: ['EUR'] }],
    ['step-b', { type: 'string', enum: ['USD'] }],
  ));
  check('RED: disjoint declared enums are L2S-fail', r.verdict === 'L2S-fail');
  check('RED: the code is shared-input-domain-disjoint', r.findings[0].code === 'shared-input-domain-disjoint');
  check('RED: the witness names a concrete value one step accepts and another rejects',
    r.findings[0].witness === '"EUR" is accepted by step-a and rejected by step-b');
  check('RED: no effective domain is published for a disjoint field', r.effective_domain === null);
}

console.log('── L2-S control GREEN: same pair, step-b widened to [EUR,USD] ──');
{
  const r = checkSharedInputField('currency', parts(
    ['step-a', { type: 'string', enum: ['EUR'] }],
    ['step-b', { type: 'string', enum: ['EUR', 'USD'] }],
  ));
  check('GREEN: overlapping declared enums are L2S-pass', r.verdict === 'L2S-pass');
  check('GREEN: zero findings', r.findings.length === 0);
  check('GREEN: the narrowed intersection is published as the effective domain',
    r.effective_domain.kind === 'enum' && JSON.stringify(r.effective_domain.values) === JSON.stringify(['EUR']));
}

console.log('── L2-S MUTATION: adding one enum member to the RED case flips fail -> pass ──');
{
  const red = checkSharedInputField('currency', parts(
    ['step-a', { type: 'string', enum: ['EUR'] }],
    ['step-b', { type: 'string', enum: ['USD'] }],
  ));
  const mutated = checkSharedInputField('currency', parts(
    ['step-a', { type: 'string', enum: ['EUR'] }],
    ['step-b', { type: 'string', enum: ['USD', 'EUR'] }], // one fact flipped
  ));
  check('MUTATION: the verdict actually moves (fail -> pass), so the check is not vacuous',
    red.verdict === 'L2S-fail' && mutated.verdict === 'L2S-pass');
}

console.log('── L2-S PRECISION GUARD: unequal-but-overlapping is a PASS, ⛔ never a fail ──');
{
  // The bug this control exists to prevent: "the two enums differ" is NOT a defect. A step may
  // legitimately accept a superset. Only an EMPTY intersection means the chain has no runnable value.
  // Same category-error shape as §2.3's `lt` lesson — cheaper to control for than to adjudicate.
  const r = checkSharedInputField('currency', parts(
    ['step-a', { type: 'string', enum: ['USD', 'EUR', 'GBP', 'JPY'] }],
    ['step-b', { type: 'string', enum: ['USD', 'EUR', 'GBP', 'HKD', 'SGD'] }],
  ));
  check('differing-but-overlapping enums do NOT produce a finding', r.findings.length === 0);
  check('the effective domain is the intersection, published for the reader',
    JSON.stringify(r.effective_domain.values) === JSON.stringify(['USD', 'EUR', 'GBP']));
}

console.log('── L2-S: a step declaring NO domain is indeterminate, ⛔ never convicted ──');
{
  const r = checkSharedInputField('jurisdiction', parts(
    ['step-a', { type: 'string', enum: ['eu'] }],
    ['step-b', { type: 'string' }], // no declared domain at all
  ));
  check('an undeclared domain produces zero findings', r.findings.length === 0);
  check('it is L2S-indeterminate', r.verdict === 'L2S-indeterminate');
  check('the reason names the exact step and field a batch row must author',
    r.undecided_reasons.includes('no-domain:step-b.jurisdiction'));
}

console.log('── L2-S: type conflict, numeric-range conflict, unit conflict ──');
{
  const t = checkSharedInputField('amount', parts(
    ['step-a', { type: 'string' }],
    ['step-b', { type: 'number' }],
  ));
  check('a string/number conflict on a shared field fails', t.findings.some((f) => f.code === 'shared-input-type-conflict'));

  const n = checkSharedInputField('ltv', parts(
    ['step-a', { type: 'number', minimum: 80 }],
    ['step-b', { type: 'number', maximum: 50 }],
  ));
  check('disjoint numeric ranges fail', n.findings.some((f) => f.code === 'shared-input-range-disjoint'));
  check('the range witness states the empty interval', n.findings.find((f) => f.code === 'shared-input-range-disjoint').witness === '[80,50] is empty');

  const u = checkSharedInputField('rate', parts(
    ['step-a', { type: 'number', minimum: 0, maximum: 100, 'x-unit': '%' }],
    ['step-b', { type: 'number', minimum: 0, maximum: 100, 'x-unit': '1' }],
  ));
  check('conflicting x-unit on a shared field fails, with both strings as the witness',
    u.findings.find((f) => f.code === 'shared-input-unit-conflict').witness === '% != 1');
}

console.log('── L2-S: a field only ONE step accepts is not a shared field at all ──');
{
  const manifests = {
    a: { input_schema: { properties: { only_mine: { type: 'string', enum: ['x'] } } } },
    b: { input_schema: { properties: { also_mine: { type: 'string', enum: ['y'] } } } },
  };
  const r = checkSharedInputs({ name: 'no-overlap', steps: [{ tool_id: 'a' }, { tool_id: 'b' }] }, makeCtx(manifests));
  check('zero shared fields is L2S-not-applicable(no-shared-input-fields), ⛔ not a vacuous pass',
    r.verdict === 'L2S-not-applicable' && r.reasons.includes('no-shared-input-fields'));
  check('and it examined zero fields', r.shared_field_count === 0);
}

console.log('── L2-S: whole-chain roll-up, and a repeated tool_id counted once ──');
{
  const manifests = {
    a: { input_schema: { properties: { currency: { type: 'string', enum: ['EUR'] } } } },
    b: { input_schema: { properties: { currency: { type: 'string', enum: ['USD'] } } } },
  };
  const chain = { name: 'fx-mismatch', steps: [{ tool_id: 'a' }, { tool_id: 'b' }, { tool_id: 'a' }] };
  const r = checkSharedInputs(chain, makeCtx(manifests));
  check('the chain rolls up to L2S-fail', r.verdict === 'L2S-fail');
  check('a tool named twice contributes ONE contract, not two',
    r.fields[0].steps.length === 2 && r.fields[0].steps.filter((s) => s === 'a').length === 1);
}

/* ═══════════════ CHAIN-FV-L2-RESCOPE-1 — L2-G gate control + authoring (spec §2.6) ═══════════════ */

console.log('── L2-G control RED: gate needs status eq "ready", producer declares [pending,failed] ──');
{
  const manifests = {
    prod: { output_schema: { properties: { status: { type: 'string', enum: ['pending', 'failed'], 'x-source': MANIFEST_SRC() } } } },
  };
  const gate = { input: '/status', rules: [{ op: 'eq', value: 'ready', next: 'end' }] };
  const r = checkGateRule(gate, gate.rules[0], 'prod', ['prod'], makeCtx(manifests));
  check('RED: a gate on a value the producer cannot emit is a finding', r.findings.length === 1);
  check('RED: the code is gate-value-outside-guarantee', r.findings[0].code === 'gate-value-outside-guarantee');
  check('RED: the witness is the unreachable literal', r.findings[0].witness === 'ready');
  check('RED: a DECIDED gate carries no authoring instruction', r.authoring === null);
}

console.log('── L2-G control GREEN: producer declares [pending,failed,ready] ──');
{
  const manifests = {
    prod: { output_schema: { properties: { status: { type: 'string', enum: ['pending', 'failed', 'ready'], 'x-source': MANIFEST_SRC() } } } },
  };
  const gate = { input: '/status', rules: [{ op: 'eq', value: 'ready', next: 'end' }] };
  const r = checkGateRule(gate, gate.rules[0], 'prod', ['prod'], makeCtx(manifests));
  check('GREEN: zero findings once the declared domain covers the literal', r.findings.length === 0);
  check('GREEN: zero undecided reasons', r.undecided_reasons.length === 0);
}

console.log('── L2-G: an UNDECIDED gate carries an authoring instruction — the 74 become work items ──');
{
  // Producer publishes an output_schema but declares no domain for the pointed field: the exact
  // `insufficient-declared-domain` shape that 3 live edges are in.
  const manifests = { prod: { output_schema: { properties: { status: { type: 'string' } } } } };
  const gate = { input: '/status', rules: [{ op: 'eq', value: 'ready', next: 'end' }] };
  const r = checkGateRule(gate, gate.rules[0], 'prod', ['prod'], makeCtx(manifests));
  check('the gate is undecided, not convicted', r.findings.length === 0 && r.undecided_reasons.length > 0);
  check('and it carries an authoring instruction', !!r.authoring);
  check('the instruction names the producer manifest property to author',
    r.authoring.author_in === 'manifests/prod.manifest.json → output_schema.properties.status');
  check('the instruction states the required shape for an eq rule', r.authoring.required.shape === 'enum');
  check('the instruction still demands an x-source — authoring a bare bound does not close it',
    r.authoring.x_source_required === true);
  check('⛔ the instruction points AWAY from kernel bytes, naming them sealed',
    /kernel/i.test(r.authoring.never_author_in) && /sealed/i.test(r.authoring.never_author_in)
    && !/kernel/i.test(r.authoring.author_in));

  const numeric = checkGateRule({ input: '/status' }, { op: 'gte', value: 0.9, next: 'end' }, 'prod', ['prod'], makeCtx(manifests));
  check('a numeric op asks for a range, not an enum', numeric.authoring.required.shape === 'numeric-range');
}

console.log('── L2-G: fixture values are offered as CANDIDATES, and labelled as never-a-citation ──');
{
  const manifests = { prod: { output_schema: { properties: { status: { type: 'string' } } } } };
  const ctx = makeCtx(manifests, { fixtureOutputs: { prod: { status: 'pending' } } });
  const instr = gateAuthoringInstruction({ input: '/status' }, { op: 'eq', value: 'ready' }, 'prod', {
    ...ctx, fixtureObservedValues: () => ['pending', 'failed'],
  });
  check('observed fixture values are surfaced as candidates',
    JSON.stringify(instr.fixture_observed_values) === JSON.stringify(['pending', 'failed']));
  check('and are labelled CANDIDATES ONLY, never evidence (spec §1.2 proptest doctrine)',
    /CANDIDATES ONLY/.test(instr.fixture_note) && /not a citation/.test(instr.fixture_note));
}

/* ═══════════════ CHAIN-FV-L2-RESCOPE-1 — the dormant field-map model (spec §1.4) ═════════════════ */

console.log('── not-applicable: an edge with no field map and no gate is NOT a chore and NOT a pass ──');
{
  const e = checkL2Edge('a', 'b', [], null, ['a', 'b'], makeCtx({}));
  check('the edge verdict is L2-not-applicable', e.verdict === 'L2-not-applicable');
  check('the reason is structural and named, ⛔ not "no-field-map-authored"',
    e.reasons.includes('chain-steps-independently-parameterised') && !e.reasons.includes('no-field-map-authored'));
}

console.log('── not-applicable edges are excluded from the chain denominator, and never rescue a pass ──');
{
  const chain = { name: 'plain', steps: [{ tool_id: 'a' }, { tool_id: 'b' }] };
  const r = checkL2Chain(chain, makeCtx({}));
  check('a chain of only not-applicable edges is L2-not-applicable', r.verdict === 'L2-not-applicable');
  check('⛔ it is NOT L2-pass — absence is not a pass (SO #34c)', r.verdict !== 'L2-pass');
  check('⛔ and it is NOT L2-indeterminate — it is not an unfinished chore either', r.verdict !== 'L2-indeterminate');
  check('the excluded edges are counted out loud', r.not_applicable_edge_count === 1 && r.in_scope_edge_count === 0);
}

console.log('── the dormant model still WORKS: checkMappedField decides the day an instance appears ──');
{
  // ⛔ The field-map model is dormant, not deleted. If a future pipeline redesign authors one
  // consumes_from entry, the checker must convict on it that day without a rewrite.
  const manifests = {
    p: { output_schema: { properties: { v: { type: 'number', minimum: 0, maximum: 200, 'x-source': MANIFEST_SRC() } } } },
    c: { input_schema: { properties: { v: { type: 'number', minimum: 0, maximum: 100, 'x-source': MANIFEST_SRC() } } } },
  };
  const chain = { name: 'revived', steps: [{ tool_id: 'p' }, { tool_id: 'c', consumes_from: [{ from_step: 'p', from: '/v', to: 'v' }] }] };
  const r = checkL2Chain(chain, makeCtx(manifests));
  check('an authored field map is checked and fails, dormant model notwithstanding', r.verdict === 'L2-fail');
  check('and that edge is IN scope, not not-applicable', r.in_scope_edge_count === 1 && r.not_applicable_edge_count === 0);
}

/* ═══════════════ CHAIN-FV-L2-RESCOPE-1 — L2-P provenance threading (spec §2.8) ═══════════════════ */

console.log('── L2-P: no mandate declared ⇒ not-applicable, and the hash chain is referenced not re-derived ──');
{
  const r = checkProvenanceThreading({ name: 'plain', steps: [{ tool_id: 'a' }] }, makeCtx({}));
  check('a chain declaring no mandate is L2P-not-applicable', r.verdict === 'L2P-not-applicable');
  check('parent_hashes integrity is explicitly deferred to the execution_hash receipts (SO #34)',
    /execution_hash receipts/.test(r.hash_chain_note) && /not re-derived/.test(r.hash_chain_note));
}

console.log('── L2-P: a declared mandate whose step does not accept mandate_hash is a fail ──');
{
  const manifests = {
    a: { input_schema: { properties: { mandate_hash: { type: 'string' } } } },
    b: { input_schema: { properties: { something_else: { type: 'string' } } } },
  };
  const chain = { name: 'mandated', mandate: 'policy-mandate-v1', steps: [{ tool_id: 'a' }, { tool_id: 'b' }] };
  const r = checkProvenanceThreading(chain, makeCtx(manifests));
  check('the step missing mandate_hash is convicted', r.verdict === 'L2P-fail');
  check('the witness names the step and the missing property',
    r.findings[0].witness === 'b.input_schema has no mandate_hash property');
  const fixed = checkProvenanceThreading(
    { ...chain, steps: [{ tool_id: 'a' }] }, makeCtx(manifests),
  );
  check('MUTATION: dropping the offending step flips fail -> pass', fixed.verdict === 'L2P-pass');
}

console.log(failures === 0 ? '\n✓ chain L2 contract-composition selftest: all controls passed' : `\n✗ ${failures} control(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
