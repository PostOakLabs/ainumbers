// headroom-gates.mjs: declaration runner and gates for the headroom library (_headroom.mjs).
//
// Gates (advisory first; each has a planted red and a green control, see runControls):
//   H1  self-report agreement: where a declaration names `self_reported`, the harness distance
//       equals the kernel's own published slack on the base point.
//   H2  witness validity: every witness pair is one grid step apart and its two verdict
//       classes differ, recomputed from scratch.
//   H3  monotone sampling: a `monotone` claim is sampled at 200 grid points; a second verdict
//       change downgrades the basis to bracketed.
//   H5  private-input refusal: a pointer under SPEC section 25 `private_inputs` is refused.
//   H6  unsound input: a pointer the fail-open sweep lists (the verdict survives deleting that
//       input) is refused with `unsound-input`.
//   float-drift control: 150,000 steps of 0.01 land on 13500.00 exactly.
//
// Witness hashes come from executionHash / policyParametersHash in _hash.mjs and nowhere else.
// Node only: reads declarations, fixtures and kernels from disk.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { executionHash, policyParametersHash } from '../_hash.mjs';
import { sourceDigest } from '../_buildid.mjs';
import { readVerdict } from '../../../scripts/lib/verdict-read.mjs';
import {
  probeHeadroom, runClass, getPointer, setPointer, gridValue, stepsBetween, placesOf, toScaled, fromScaled,
} from '../_headroom.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const KERNELS = resolve(HERE, '..');
export const ROOT = resolve(HERE, '..', '..', '..');
export const PROFILE = 'ocg-headroom-report@1';

const clone = (o) => JSON.parse(JSON.stringify(o));
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Verdict classifier for a declaration: the declared map when present, else the shared reader. */
export function classifierFor(decl) {
  const v = decl.verdict;
  if (!v) return (payload) => { const r = readVerdict(payload); return r ? r.cls : 'unclassified'; };
  return (payload) => {
    const x = getPointer(payload, v.pointer);
    if (typeof x === 'boolean') return x ? 'positive' : 'negative';
    return (v.map && v.map[x]) || 'unclassified';
  };
}

const verdictLabel = (decl, payload) => {
  if (decl.verdict) { const x = getPointer(payload, decl.verdict.pointer); return x === undefined ? null : String(x); }
  const r = readVerdict(payload);
  return r ? String(r.value) : null;
};

// ---- H5 and H6 refusals ------------------------------------------------------

/** H5: a pointer equal to, or under, a declared private input is refused. */
export function refusePrivate(pointer, privateInputs) {
  for (const e of privateInputs || []) {
    const p = typeof e === 'string' ? e : e && e.pointer;
    if (p && (pointer === p || pointer.startsWith(`${p}/`))) return { code: 'private-input', detail: `${pointer} is declared under private_inputs (${p})` };
  }
  return null;
}

/** H6: the fail-open baseline lists this node and the probe's top-level field. */
export function refuseUnsound(toolId, pointer, failOpen) {
  const field = pointer.split('/')[1];
  const node = failOpen && failOpen.nodes && failOpen.nodes[toolId];
  if (node && Array.isArray(node.fields) && node.fields.includes(field)) {
    return { code: 'unsound-input', detail: `the missing-input sweep reports the verdict surviving deletion of ${field}; a distance on it means nothing` };
  }
  return null;
}

export function loadFailOpen(root = ROOT) {
  return readJson(resolve(root, 'scripts', 'kernel-missing-input-failclosed.baseline.json'));
}

// ---- running one declaration -----------------------------------------------------

export function loadDeclaration(file) { return readJson(file); }

export async function loadCompute(decl) {
  return (await import(pathToFileURL(resolve(KERNELS, decl.kernel)).href)).compute;
}

/**
 * Run one declaration over its fixture base points. `compute` overrides the real kernel
 * (the H4 control passes a perturbed scratch copy). Returns { reports, findings }.
 */
export async function runDeclaration(decl, { compute, failOpen, privateInputs } = {}) {
  const run = compute || await loadCompute(decl);
  const classify = classifierFor(decl);
  const fixture = readJson(resolve(KERNELS, decl.fixture));
  const kernelDigest = await sourceDigest(readFileSync(resolve(KERNELS, decl.kernel), 'utf8'));
  const reports = [];
  const findings = [];
  let skipped = 0;
  for (const name of decl.base_fixtures) {
    const vec = fixture.vectors.find((v) => v.name === name);
    if (!vec) { findings.push({ gate: 'declaration', ok: false, detail: `${decl.tool_id}: base fixture ${name} not found` }); continue; }
    const pp = vec.policy_parameters;
    const base = await runClass(run, pp, classify);
    const report = {
      profile: PROFILE,
      base: {
        tool_id: decl.tool_id,
        kernel_digest: String(kernelDigest).startsWith('sha256:') ? kernelDigest : `sha256:${kernelDigest}`,
        fixture: name,
        execution_hash: base.payload ? await executionHash(pp, base.payload) : null,
        verdict: base.payload ? verdictLabel(decl, base.payload) : null,
        class: base.cls,
      },
      entries: [],
      evaluations: 0,
    };
    if (base.cls !== 'positive' && base.cls !== 'negative') {
      skipped++;
      report.skipped = `base class ${base.cls}`;
      reports.push(report);
      continue;
    }
    for (const probe of decl.probes) {
      const refused = refusePrivate(probe.pointer, privateInputs || decl.private_inputs) || refuseUnsound(decl.tool_id, probe.pointer, failOpen);
      if (refused) { report.entries.push({ pointer: probe.pointer, status: 'refused', ...refused }); continue; }
      if (probe.grid !== 'integer' && probe.grid !== 'decimal') {
        report.entries.push({ pointer: probe.pointer, status: 'refused', code: 'grid-not-supported', detail: `grid ${probe.grid} is not probed in v1` });
        continue;
      }
      for (const dir of ['+', '-']) {
        const e = await probeHeadroom({ compute: run, pp, probe, dir, classify, base });
        report.evaluations += e.evaluations || 0;
        if (e.status === 'flip' || e.status === 'domain_edge') {
          if (probe.monotone && e.basis === 'declared-monotone') {
            const h3 = await gateH3(run, pp, probe, classify);
            findings.push({ gate: 'H3', ok: h3.ok, detail: `${decl.tool_id} ${probe.pointer}: ${h3.detail}` });
            if (!h3.ok) e.basis = 'bracketed';
          }
          await attachWitnessHashes(e, run, pp, probe, dir, decl);
        }
        report.entries.push(e);
      }
    }
    // H2 and H1 per entry
    for (const e of report.entries) {
      if (e.status !== 'flip' && e.status !== 'domain_edge') continue;
      const probe = decl.probes.find((p) => p.pointer === e.pointer);
      const h2 = await gateH2(e, { compute: run, pp, probe, classify });
      findings.push({ gate: 'H2', ok: h2.ok, detail: `${decl.tool_id} ${e.pointer} ${e.direction}: ${h2.detail}` });
    }
    if (decl.self_reported && base.payload) {
      const h1 = gateH1(decl, report, base.payload);
      findings.push({ gate: 'H1', ok: h1.ok, detail: `${decl.tool_id}: ${h1.detail}` });
    }
    reports.push(report);
  }
  return { reports, findings, skipped };
}

async function attachWitnessHashes(e, run, pp, probe, dir, decl) {
  const sign = dir === '+' ? 1 : -1;
  const baseValue = getPointer(pp, probe.pointer);
  for (const [slot, n] of [['last_same', e.lo], ['first_other', e.hi]]) {
    const q = clone(pp);
    const text = gridValue(String(baseValue), probe.step, sign * n);
    setPointer(q, probe.pointer, typeof baseValue === 'string' ? text : Number(text));
    const r = await runClass(run, q, classifierFor(decl));
    e.witness[slot].policy_parameters_hash = await policyParametersHash(q);
    e.witness[slot].execution_hash = r.payload ? await executionHash(q, r.payload) : null;
    e.witness[slot].verdict = r.payload ? verdictLabel(decl, r.payload) : `thrown: ${r.thrown}`;
  }
}

// ---- gates ---------------------------------------------------------------------

/** H1: harness distance equals the kernel's own published slack. */
export function gateH1(decl, report, basePayload) {
  const sr = decl.self_reported;
  const e = report.entries.find((x) => x.pointer === sr.of_probe && x.direction === sr.direction && x.distance !== undefined);
  if (!e) return { ok: false, detail: `no distance found on ${sr.of_probe} ${sr.direction} to compare with ${sr.pointer}` };
  const pub = getPointer(basePayload, sr.pointer);
  if (pub === undefined || pub === null) return { ok: false, detail: `kernel publishes no value at ${sr.pointer}` };
  const places = placesOf(e.distance);
  let pubText;
  try { pubText = typeof pub === 'number' ? pub.toFixed(places) : String(pub); toScaled(pubText, places); } catch { return { ok: false, detail: `published ${sr.pointer}=${pub} is not comparable at ${places} places` }; }
  const equal = toScaled(pubText, places) === toScaled(e.distance, places);
  return { ok: equal, detail: `distance ${e.distance} ${equal ? '==' : '!='} published ${sr.pointer} ${pubText}` };
}

/** H2: the witness pair is one grid step apart and its classes differ, recomputed from scratch. */
export async function gateH2(e, { compute, pp, probe, classify }) {
  const a = e.witness.last_same.value;
  const b = e.witness.first_other.value;
  const apart = stepsBetween(String(a), String(b), probe.step);
  const want = e.direction === '+' ? 1n : -1n;
  if (apart !== want) return { ok: false, detail: `witness values are ${apart} steps apart, not one` };
  const baseValue = getPointer(pp, probe.pointer);
  const classAt = async (v) => { const q = clone(pp); setPointer(q, probe.pointer, typeof baseValue === 'string' ? String(v) : Number(v)); return (await runClass(compute, q, classify)).cls; };
  const [ca, cb] = [await classAt(a), await classAt(b)];
  if (ca !== e.base_class) return { ok: false, detail: `last_same class ${ca} is not the base class ${e.base_class}` };
  if (cb === ca) return { ok: false, detail: `both witness points read ${ca}` };
  if (e.status === 'flip' && !(cb === 'positive' || cb === 'negative')) return { ok: false, detail: `a flip must end in positive or negative, got ${cb}` };
  return { ok: true, detail: `witness one step apart, ${ca} -> ${cb}` };
}

/** H3: sample 200 grid points across [min, max]; more than one class change breaks monotone. */
export async function gateH3(compute, pp, probe, classify) {
  const total = Number(stepsBetween(probe.min, probe.max, probe.step));
  const baseValue = getPointer(pp, probe.pointer);
  let prev = null;
  let changes = 0;
  for (let i = 0; i < 200; i++) {
    const n = Math.round((i * total) / 199);
    const text = gridValue(probe.min, probe.step, n);
    const q = clone(pp);
    setPointer(q, probe.pointer, typeof baseValue === 'string' ? text : Number(text));
    const { cls } = await runClass(compute, q, classify);
    if (prev !== null && cls !== prev) changes++;
    prev = cls;
  }
  return { ok: changes <= 1, detail: `${changes} class change(s) over 200 sampled grid points` };
}

// ---- controls (each gate shown red, then green) ------------------------------------

/** Repeated floating-point addition, the way the library must NOT step. */
export function naiveFloatSteps(base, step, n) {
  let v = Number(base);
  for (let i = 0; i < n; i++) v += Number(step);
  return v;
}

export async function runControls() {
  const out = [];
  const rec = (name, ok, detail) => out.push({ name, ok, detail });
  const d218 = loadDeclaration(resolve(HERE, 'art-218-qm-points-and-fees.headroom.json'));
  const failOpen = loadFailOpen();

  // float drift: green = scaled integers land exactly; red = naive float addition does not
  const exact = gridValue('12000', '0.01', 150000);
  rec('float-drift green', exact === '13500.00', `gridValue(12000, 0.01, 150000) = ${exact}`);
  const naive = naiveFloatSteps(12000, 0.01, 150000);
  const naiveZero = naiveFloatSteps(0, 0.01, 150000);
  rec('float-drift red', naive !== 13500 || naiveZero !== 1500, `naive float addition gives ${naive} and ${naiveZero}`);

  // H1 + H4: the real kernel agrees with its published slack, a flipped comparator does not
  const real = await runDeclaration(d218, { failOpen });
  const realH1 = real.findings.filter((f) => f.gate === 'H1');
  rec('H1 green', realH1.length > 0 && realH1.every((f) => f.ok), realH1.map((f) => f.detail).join('; '));
  const perturbed = (await import(pathToFileURL(resolve(KERNELS, '__boundary_mr__', 'red-control', 'art-218-pass-comparator-flipped.perturbed.mjs')).href)).compute;
  const red = await runDeclaration(d218, { compute: perturbed, failOpen });
  const redH1 = red.findings.filter((f) => f.gate === 'H1');
  rec('H4 red (flipped comparator turns H1 red)', redH1.length > 0 && redH1.some((f) => !f.ok), redH1.map((f) => f.detail).join('; '));

  // H2: real witnesses pass, tampered witnesses fail
  const rep = real.reports[0];
  const entry = rep.entries.find((e) => e.status === 'flip' && e.pointer === '/points_and_fees' && e.direction === '+');
  const fx = readJson(resolve(KERNELS, d218.fixture)).vectors.find((v) => v.name === d218.base_fixtures[0]);
  const classify = classifierFor(d218);
  const probe = d218.probes[0];
  const ctx = { compute: await loadCompute(d218), pp: fx.policy_parameters, probe, classify };
  const h2green = await gateH2(entry, ctx);
  rec('H2 green', h2green.ok, h2green.detail);
  const twoApart = clone(entry); twoApart.witness.first_other.value = gridValue(entry.witness.last_same.value, '0.01', 2);
  const sameClass = clone(entry); sameClass.witness.first_other.value = gridValue(entry.witness.last_same.value, '0.01', -1);
  sameClass.witness.last_same.value = gridValue(entry.witness.last_same.value, '0.01', -2);
  const h2a = await gateH2(twoApart, ctx);
  const h2b = await gateH2(sameClass, ctx);
  rec('H2 red (witness two steps apart)', !h2a.ok, h2a.detail);
  rec('H2 red (both witness points read the same class)', !h2b.ok, h2b.detail);

  // H6: planted fail-open pointer refused with unsound-input; the real baseline does not refuse
  const planted = { nodes: { [d218.tool_id]: { fields: ['points_and_fees'], count: 1 } } };
  const h6red = await runDeclaration(d218, { failOpen: planted });
  const refused = h6red.reports[0].entries.find((e) => e.pointer === '/points_and_fees');
  rec('H6 red (planted fail-open pointer)', refused && refused.status === 'refused' && refused.code === 'unsound-input', refused ? `${refused.status} ${refused.code}` : 'no entry');
  const h6green = real.reports[0].entries.find((e) => e.pointer === '/points_and_fees' && e.direction === '+');
  rec('H6 green (real baseline)', h6green && h6green.status === 'flip', h6green ? h6green.status : 'no entry');

  // H5: a private-input pointer is refused, an unrelated pointer is not
  rec('H5 red', refusePrivate('/points_and_fees', [{ pointer: '/points_and_fees' }]) !== null, 'private pointer refused');
  rec('H5 green', refusePrivate('/points_and_fees', [{ pointer: '/loan_amount' }]) === null, 'unrelated pointer passes');

  // H3: a planted non-monotone kernel downgrades the basis; the real one holds
  const wavy = (pp) => ({ output_payload: { pass: Math.floor(Number(pp.points_and_fees) / 5000) % 2 === 0 } });
  const h3red = await gateH3(wavy, fx.policy_parameters, probe, classify);
  rec('H3 red (planted non-monotone kernel)', !h3red.ok, h3red.detail);
  const h3green = await gateH3(ctx.compute, fx.policy_parameters, probe, classify);
  rec('H3 green', h3green.ok, h3green.detail);

  // domain edges: a refusal and a thrown error are edges, never flips
  const edge = (pp) => ({ output_payload: { decision: Number(pp.x) > 3 ? 'INDETERMINATE' : 'SPEND' } });
  const thrower = (pp) => { if (Number(pp.x) > 3) throw new Error('boom'); return { output_payload: { decision: 'SPEND' } }; };
  const eprobe = { pointer: '/x', step: '1', min: '0', max: '100' };
  const cls = (p) => { const r = readVerdict(p); return r ? r.cls : 'unclassified'; };
  const e1 = await probeHeadroom({ compute: edge, pp: { x: 0 }, probe: eprobe, dir: '+', classify: cls });
  const e2 = await probeHeadroom({ compute: thrower, pp: { x: 0 }, probe: eprobe, dir: '+', classify: cls });
  rec('refusal is a domain edge', e1.status === 'domain_edge' && e1.steps_to_flip === 3, `${e1.status} at ${e1.steps_to_flip}`);
  rec('thrown error is a domain edge', e2.status === 'domain_edge' && e2.steps_to_flip === 3, `${e2.status} at ${e2.steps_to_flip}`);
  return out;
}
