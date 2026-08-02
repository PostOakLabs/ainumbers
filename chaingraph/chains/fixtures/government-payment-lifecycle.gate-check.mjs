#!/usr/bin/env node
// government-payment-lifecycle.gate-check.mjs — local §21.4 verification for the
// government-payment-lifecycle chain (INBOUND-E2E-CHAIN-1).
//
// Reimplements the linear+gate execution algorithm of mcp-apps-poc/embed/runChain.mjs
// against THIS repo's own chaingraph/kernels/_hash.mjs + _gateval.mjs (the identical
// source the Worker and embed runner vendor byte-for-byte) so the chain's routing and
// composite_execution_hash can be checked WITHOUT touching mcp-apps-poc/ -- this row is
// shard-only (RIDER-KERNEL, ORCH re-fence 2026-08-01) and cannot vendor or run worker CI.
//
// This is a LOCAL, SITE-SIDE substitute for gate-static.test.mjs / gate-semantics.test.mjs /
// gate-branch-coverage.test.mjs / gate-parity.test.mjs, which fire in worker CI only and
// were NOT run from here -- that is stated plainly, not claimed as a pass.
//
// Run: node chaingraph/chains/fixtures/government-payment-lifecycle.gate-check.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const kernelsDir = here + '../../kernels/';
const importUrl = (p) => pathToFileURL(p).href;

const { executionHash } = await import(importUrl(kernelsDir + '_hash.mjs'));
const { evaluateGate, stepId, isTerminalTarget, isPointerSyntaxValid, GATE_OPS, VALUE_OPS } = await import(importUrl(kernelsDir + '_gateval.mjs'));

const chainDef = JSON.parse(readFileSync(here + '../../graph/chains/government-payment-lifecycle.json', 'utf8'));
const fixture = JSON.parse(readFileSync(here + 'government-payment-lifecycle.chain-fixture.json', 'utf8'));
const chainSteps = chainDef.steps;
const CHAIN_NAME = chainDef.name;
const CHAIN_TITLE = chainDef.title;

let fail = 0;
const ok = (label) => console.log('  ✓ ' + label);
const bad = (label, detail) => { fail++; console.error('  ✗ ' + label + (detail ? ' — ' + detail : '')); };

// Inline re-derivation of gate-static.mjs's checks (worker CI's validate-chains.mjs
// Layer 4 + gate-static.test.mjs run the canonical version; not reachable from a
// shard-only site-side row, so this is re-derived here against the SAME
// kernels/_gateval.mjs the worker vendors, not a second definition of the rules).
function validateChainGatesInline(steps) {
  const errs = [];
  const OP_SET = new Set(GATE_OPS);
  const NUMERIC_OPS = new Set(['gt', 'gte', 'lt', 'lte']);
  const ids = steps.map((s, i) => stepId(s, i));
  const firstIndex = new Map();
  ids.forEach((id, i) => { if (firstIndex.has(id)) errs.push(`dup id ${id}`); else firstIndex.set(id, i); });
  const isTarget = (t) => isTerminalTarget(t) || firstIndex.has(t);
  const targetIdx = (t) => (isTerminalTarget(t) ? steps.length : firstIndex.get(t));
  steps.forEach((s, i) => {
    if (!s.gate) return;
    const g = s.gate;
    if (!isPointerSyntaxValid(g.input)) errs.push(`step ${i + 1}: bad pointer ${g.input}`);
    (g.rules || []).forEach((r, ri) => {
      if (!OP_SET.has(r.op)) errs.push(`step ${i + 1} rule ${ri}: op ${r.op} not in closed enum`);
      if (VALUE_OPS.includes(r.op) && !('value' in r)) errs.push(`step ${i + 1} rule ${ri}: op ${r.op} needs value`);
      if (NUMERIC_OPS.has(r.op) && !(typeof r.value === 'number' && Number.isFinite(r.value))) { if (NUMERIC_OPS.has(r.op)) errs.push(`step ${i + 1} rule ${ri}: numeric op needs finite value`); }
      if (!isTarget(r.next)) errs.push(`step ${i + 1} rule ${ri}: next "${r.next}" unresolved`);
      else if (!isTerminalTarget(r.next) && targetIdx(r.next) <= i) errs.push(`step ${i + 1} rule ${ri}: next not forward-only`);
    });
    if (!g.default) errs.push(`step ${i + 1}: missing default`);
    else if (!isTarget(g.default)) errs.push(`step ${i + 1}: default "${g.default}" unresolved`);
    else if (!isTerminalTarget(g.default) && targetIdx(g.default) <= i) errs.push(`step ${i + 1}: default not forward-only`);
  });
  const reachable = new Array(steps.length).fill(false);
  if (steps.length) reachable[0] = true;
  for (let i = 0; i < steps.length; i++) {
    if (!reachable[i]) continue;
    const s = steps[i];
    const succ = [];
    if (s.gate) {
      for (const r of (s.gate.rules || [])) if (isTarget(r.next) && !isTerminalTarget(r.next)) succ.push(targetIdx(r.next));
      if (isTarget(s.gate.default) && !isTerminalTarget(s.gate.default)) succ.push(targetIdx(s.gate.default));
    } else if (i + 1 < steps.length) succ.push(i + 1);
    for (const j of succ) if (j >= 0 && j < steps.length) reachable[j] = true;
  }
  steps.forEach((s, i) => { if (!reachable[i]) errs.push(`step ${i + 1} (${ids[i]}) UNREACHABLE`); });
  return errs;
}

const staticErrs = validateChainGatesInline(chainSteps);
if (staticErrs.length) bad('static §21.4 validity', JSON.stringify(staticErrs));
else ok('static §21.4 validity clean (RFC 6901 pointers, closed op enum, mandatory default, forward-only, unique ids, no unreachable step)');

const cgCanon = (v) => Array.isArray(v) ? v.map(cgCanon)
  : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {}) : v;
async function cgSha256Hex(obj) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(cgCanon(obj))));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function loadKernel(tool_id) { return import(importUrl(kernelsDir + tool_id + '.kernel.mjs')); }
function loadVector(step_id, ref) {
  const j = JSON.parse(readFileSync(kernelsDir + 'fixtures/' + ref.fixture_source, 'utf8'));
  const v = j.vectors.find((v) => v.name === ref.vector);
  if (!v) throw new Error(`vector ${ref.vector} not found in ${ref.fixture_source} for ${step_id}`);
  return v.policy_parameters;
}

async function runScenario(scn) {
  const ppByStep = {};
  for (const [tid, ref] of Object.entries(scn.input_bundle_by_step)) ppByStep[tid] = loadVector(tid, ref);

  const idToIndex = {};
  chainSteps.forEach((s, i) => { idToIndex[stepId(s, i)] = i; });

  const results = new Array(chainSteps.length).fill(null);
  const decisions = [];
  const path_taken = [];
  let prevHash = null, prevId = null, idx = 0;
  while (idx < chainSteps.length) {
    const step = chainSteps[idx];
    const tid = step.tool_id;
    const kernel = await loadKernel(tid);
    const pp = ppByStep[tid] ?? {};
    const artifact = await kernel.buildArtifact(pp, { now: '1970-01-01T00:00:00.000Z', parent_hashes: prevHash ? [prevHash] : [], parent_tool_ids: prevId ? [prevId] : [], chain_depth: idx });
    results[idx] = { order: idx + 1, tool_id: tid, status: 'ok', mandate_type: artifact.mandate_type, execution_hash: artifact.execution_hash, artifact };
    prevHash = artifact.execution_hash; prevId = tid;
    path_taken.push(stepId(step, idx));

    if (step.gate) {
      const dec = { step_id: stepId(step, idx), ...evaluateGate(step.gate, artifact.output_payload) };
      decisions.push(dec);
      let target = isTerminalTarget(dec.next) ? chainSteps.length : idToIndex[dec.next];
      if (target === undefined || target <= idx) target = idx + 1;
      for (let j = idx + 1; j < target && j < chainSteps.length; j++) {
        if (results[j] === null) results[j] = { order: j + 1, tool_id: chainSteps[j].tool_id, status: 'skipped_by_gate' };
      }
      idx = target;
      continue;
    }
    idx++;
  }
  const resultsList = results.filter((r) => r !== null);
  const ran = resultsList.filter((r) => r.status === 'ok');
  const skipped = resultsList.filter((r) => r.status !== 'ok').map((r) => r.tool_id);

  const composite_policy = { compute_mode: 'server', chain: CHAIN_NAME, chain_title: CHAIN_TITLE, step_count: ran.length, step_tool_ids: ran.map((r) => r.tool_id) };
  const composite_output = { chain: CHAIN_NAME, steps: ran.map((r) => ({ tool_id: r.tool_id, mandate_type: r.mandate_type, execution_hash: r.execution_hash, output_payload: r.artifact.output_payload })) };
  composite_policy.route_plan_digest = await cgSha256Hex(chainSteps);
  composite_output.decisions = decisions;
  composite_output.path_taken = path_taken;
  const composite_hash = await executionHash(composite_policy, composite_output);

  return { decisions, path_taken, skipped, composite_hash };
}

function enumerateBranches() {
  const out = [];
  chainSteps.forEach((s, i) => {
    if (!s.gate) return;
    const id = stepId(s, i);
    (s.gate.rules || []).forEach((_, ri) => out.push(`${id}#rule${ri}`));
    out.push(`${id}#default`);
  });
  return out;
}
function branchesHitBy(decisions) {
  const hit = new Set();
  for (const d of decisions) hit.add(`${d.step_id}#${d.matched_rule_index === null ? 'default' : 'rule' + d.matched_rule_index}`);
  return hit;
}

const allDecisions = [];
for (const scn of fixture.scenarios) {
  const r = await runScenario(scn);
  const label = scn.scenario_id;

  if (JSON.stringify(r.path_taken) !== JSON.stringify(scn.expected_path_taken)) bad(`${label}: path_taken matches`, JSON.stringify(r.path_taken));
  else ok(`${label}: path_taken matches (${r.path_taken.length} steps)`);

  if (JSON.stringify(r.skipped.sort()) !== JSON.stringify([...scn.expected_skipped].sort())) bad(`${label}: skipped set matches`, JSON.stringify(r.skipped));
  else ok(`${label}: skipped set matches (${r.skipped.length} steps)`);

  if (JSON.stringify(r.decisions) !== JSON.stringify(scn.expected_decisions)) bad(`${label}: decisions match`, JSON.stringify(r.decisions));
  else ok(`${label}: decisions match fixture exactly`);

  if (r.composite_hash !== scn.expected_composite_execution_hash) bad(`${label}: composite_execution_hash matches`, `got ${r.composite_hash}, want ${scn.expected_composite_execution_hash}`);
  else ok(`${label}: composite_execution_hash matches (${r.composite_hash})`);

  allDecisions.push(r.decisions);
}

const need = new Set(enumerateBranches());
for (const d of allDecisions) for (const b of branchesHitBy(d)) need.delete(b);
if (need.size) bad('branch coverage: every gate branch + default driven at least once', JSON.stringify([...need]));
else ok(`branch coverage: all ${enumerateBranches().length} branches driven across ${fixture.scenarios.length} scenarios`);

if (fail) { console.error(`\n✗ government-payment-lifecycle.gate-check: ${fail} failure(s)`); process.exit(1); }
console.log('\n✅ government-payment-lifecycle.gate-check: static validity, both scenarios, and full branch coverage all confirmed locally.');
console.log('   ⚠ worker-CI gates (validate-chains.mjs Layer 4, gate-semantics.test.mjs, gate-parity.test.mjs) were NOT run from here -- shard-only fence, no vendor.');
