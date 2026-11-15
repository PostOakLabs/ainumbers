#!/usr/bin/env node
/**
 * scripts/check-kernel-missing-input-failclosed.selftest.mjs: paired controls for
 * scripts/check-kernel-missing-input-failclosed.mjs (GATE-SELFTEST-META-1).
 *
 * Builds SYNTHETIC kernels in a temp dir (never the real estate) and runs the
 * checker against them with --root:
 *   (a) art-816 shape: deleting `domain` still yields SPEND            -> FAIL
 *   (b) art-798 shape: missing `criteria` defaults to [] and is READY  -> FAIL
 *   (c) art-832 shape: a null flag is silently ignored, still positive -> FAIL (null pass)
 *   (d) fail-closed kernel (refuses any missing / null required field) -> PASS
 *   (e) manifest with no required list -> UNDECLARED; unreadable verdict -> UNCLASSIFIED
 *       (never PASS or FAIL)
 * RED first: the same controls run against a deliberately broken copy of the
 * checker (it never records a fail-open case) and must be detected as broken.
 * Then GREEN: the real checker must satisfy every control.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL = resolve(HERE, 'check-kernel-missing-input-failclosed.mjs');

const tmp = mkdtempSync(join(tmpdir(), 'failclosed-selftest-'));
const kdir = join(tmp, 'chaingraph', 'kernels');
const fdir = join(kdir, 'fixtures');
const mdir = join(tmp, 'manifests');
for (const d of [kdir, fdir, mdir]) mkdirSync(d, { recursive: true });

function plant(id, { required, pp, payload, kernelSrc }) {
  writeFileSync(join(kdir, `${id}.kernel.mjs`), kernelSrc);
  writeFileSync(join(fdir, `${id}.fixtures.json`), JSON.stringify({ tool_id: id, vectors: [{ name: 'v0', policy_parameters: pp, output_payload: payload }] }));
  writeFileSync(join(mdir, `${id}.manifest.json`), JSON.stringify({ tool_id: id, input_schema: required ? { type: 'object', required } : { type: 'object' } }));
}

plant('syn-a-spend', {
  required: ['domain'], pp: { domain: 'ex.test' }, payload: { verdict: 'SPEND' },
  kernelSrc: `export function compute(pp) { return { output_payload: { verdict: 'SPEND' } }; }\n`,
});
plant('syn-b-criteria', {
  required: ['criteria'], pp: { criteria: [true] }, payload: { verdict: 'READY' },
  kernelSrc: `export function compute(pp) { const c = pp.criteria ?? []; return { output_payload: { verdict: c.every(Boolean) ? 'READY' : 'NOT_READY' } }; }\n`,
});
plant('syn-c-flag', {
  required: ['flag_a'], pp: { flag_a: true }, payload: { verdict: 'READY' },
  kernelSrc: `export function compute(pp) { if (pp.flag_a === undefined) throw new Error('missing flag_a'); return { output_payload: { verdict: 'READY' } }; }\n`,
});
plant('syn-d-closed', {
  required: ['domain', 'nonce'], pp: { domain: 'ex.test', nonce: 'n1' }, payload: { verdict: 'SPEND' },
  kernelSrc: `export function compute(pp) { for (const k of ['domain', 'nonce']) { if (pp[k] === undefined || pp[k] === null) return { output_payload: { verdict: 'NOT_EVALUATED' } }; } return { output_payload: { verdict: 'SPEND' } }; }\n`,
});
plant('syn-e1-undeclared', {
  required: null, pp: { x: 1 }, payload: { verdict: 'READY' },
  kernelSrc: `export function compute(pp) { return { output_payload: { verdict: 'READY' } }; }\n`,
});
plant('syn-e2-unclassified', {
  required: ['x'], pp: { x: 1 }, payload: { verdict: 'GREENISH' },
  kernelSrc: `export function compute(pp) { return { output_payload: { verdict: 'GREENISH' } }; }\n`,
});

// (f) OPTIONAL field deleted and still positive: not a declared requirement, must NOT be FAIL.
plant('syn-f-optional', {
  required: ['a'], pp: { a: 1, opt: 2 }, payload: { verdict: 'READY' },
  kernelSrc: `export function compute(pp) { if (pp.a === undefined || pp.a === null) return { output_payload: { verdict: 'NOT_EVALUATED' } }; return { output_payload: { verdict: 'READY' } }; }\n`,
});
// (g) undeclared list, kernel ignores every key: HARNESS-SUSPECT, never FAIL.
plant('syn-g-suspect', {
  required: null, pp: { x: 1, opt: 2 }, payload: { verdict: 'READY' },
  kernelSrc: `export function compute(pp) { return { output_payload: { verdict: 'READY' } }; }\n`,
});
// (h..k) one planted fail-open kernel per widened verdict token class.
const openKernel = (payloadJs) => `export function compute(pp) { return { output_payload: ${payloadJs} }; }\n`;
plant('syn-h-mandate', { required: ['m'], pp: { m: 1 }, payload: { verdict: 'WITHIN_MANDATE' }, kernelSrc: openKernel(`{ verdict: 'WITHIN_MANDATE' }`) });
plant('syn-i-conserved', { required: ['m'], pp: { m: 1 }, payload: { conserved: true }, kernelSrc: openKernel(`{ conserved: true }`) });
plant('syn-j-eligibility', { required: ['m'], pp: { m: 1 }, payload: { eligibility: 'ELIGIBLE' }, kernelSrc: openKernel(`{ eligibility: 'ELIGIBLE' }`) });
plant('syn-k-profile', { required: ['m'], pp: { m: 1 }, payload: { profile_status: 'READY' }, kernelSrc: openKernel(`{ profile_status: 'READY' }`) });

// (m) two required fields; the baseline below will list only `a`, so `b` is an ADDED pair.
plant('syn-m-two', { required: ['a', 'b'], pp: { a: 1, b: 2 }, payload: { verdict: 'READY' }, kernelSrc: `export function compute(pp) { if (pp.a === undefined || pp.a === null) return { output_payload: { verdict: 'NOT_EVALUATED' } }; return { output_payload: { verdict: 'READY' } }; }\n` });

const EXPECT = {
  'syn-m-two': 'FAIL',
  'syn-f-optional': 'PASS',
  'syn-g-suspect': 'UNDECLARED',
  'syn-h-mandate': 'FAIL',
  'syn-i-conserved': 'FAIL',
  'syn-j-eligibility': 'FAIL',
  'syn-k-profile': 'FAIL',
  'syn-a-spend': 'FAIL',
  'syn-b-criteria': 'FAIL',
  'syn-c-flag': 'FAIL',
  'syn-d-closed': 'PASS',
  'syn-e1-undeclared': 'UNDECLARED',
  'syn-e2-unclassified': 'UNCLASSIFIED',
};

function runChecker(script, tag) {
  const jsonPath = join(tmp, `${tag}.json`);
  const basePath = join(tmp, `${tag}.baseline.json`);
  const r = spawnSync(process.execPath, [script, '--root', tmp, '--json', jsonPath, '--write-baseline', basePath], { encoding: 'utf8' });
  if (r.status !== 0) return { crashed: true, status: r.status, stderr: (r.stderr || '').slice(0, 300) };
  const report = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const got = Object.fromEntries(report.kernels.map((k) => [k.id, k.state]));
  const wrong = Object.entries(EXPECT).filter(([id, s]) => got[id] !== s).map(([id, s]) => `${id}: expected ${s}, got ${got[id]}`);
  const nullPassFails = report.kernels.find((k) => k.id === 'syn-c-flag')?.fails.filter((f) => f.mode === 'null').length ?? 0;
  if (nullPassFails === 0) wrong.push('syn-c-flag: the null-set pass recorded no fail-open case');
  // An optional-field deletion or an undeclared-list hit is never a FAIL source.
  if ((report.kernels.find((k) => k.id === 'syn-f-optional')?.fails.length ?? 1) !== 0) wrong.push('syn-f-optional: an optional field produced a FAIL');
  const g = report.kernels.find((k) => k.id === 'syn-g-suspect');
  if (!g || g.fails.length !== 0 || g.suspects.length === 0) wrong.push('syn-g-suspect: expected HARNESS-SUSPECT hits and zero FAIL');
  if (!(report.totals.HARNESS_SUSPECT > 0)) wrong.push('totals: HARNESS_SUSPECT not counted');
  // --write-baseline records FAIL pairs only (never suspects, never PASS kernels).
  const bl = JSON.parse(readFileSync(basePath, 'utf8'));
  if (!bl.nodes['syn-a-spend']?.fields.includes('domain')) wrong.push('baseline: syn-a-spend/domain pair missing');
  if (bl.nodes['syn-f-optional'] || bl.nodes['syn-g-suspect'] || bl.nodes['syn-d-closed']) wrong.push('baseline: contains a non-FAIL kernel');
  return { crashed: false, wrong };
}

// Stage 2 controls: --enforce <baseline> and --only <ids>, driven through the real CLI.
function enforceControls(script, tag) {
  const wrong = [];
  const base = join(tmp, `${tag}.full-baseline.json`);
  const gen = spawnSync(process.execPath, [REAL, '--root', tmp, '--write-baseline', base], { encoding: 'utf8' });
  if (gen.status !== 0) return [`could not generate the control baseline: ${(gen.stderr || '').slice(0, 200)}`];
  const full = JSON.parse(readFileSync(base, 'utf8'));
  const writeBl = (name, mutate) => { const d = JSON.parse(JSON.stringify(full)); mutate(d); const p = join(tmp, `${tag}.${name}.json`); writeFileSync(p, JSON.stringify(d)); return p; };
  const go = (args) => spawnSync(process.execPath, [script, '--root', tmp, ...args], { encoding: 'utf8' });

  // GREEN: the current FAIL pairs are all in the baseline, so nothing is refused.
  let r = go(['--enforce', base]);
  if (r.status !== 0) wrong.push(`enforce(current baseline) exited ${r.status}, expected 0`);
  // A baseline that lists MORE than is failing (a cured kernel) is a shrink: still exit 0.
  const superset = writeBl('superset', (d) => { d.nodes['syn-cured'] = { fields: ['z'], count: 1 }; });
  r = go(['--enforce', superset]);
  if (r.status !== 0) wrong.push(`enforce(baseline with a cured entry) exited ${r.status}, expected 0`);
  // RED: a NEW kernel (absent from the baseline) with a FAIL pair is refused, and the message is complete.
  const noA = writeBl('no-a', (d) => { delete d.nodes['syn-a-spend']; });
  r = go(['--enforce', noA]);
  const msg = r.stderr || '';
  if (r.status !== 1) wrong.push(`enforce(new fail-open kernel) exited ${r.status}, expected 1`);
  for (const needle of ['syn-a-spend', '"domain"', 'SPEND', 'Refuse or return a non-positive verdict when this input is missing']) {
    if (r.status === 1 && !msg.includes(needle)) wrong.push(`enforce message lacks ${needle}`);
  }
  // RED: the baseline never grows. A pair ADDED to a known kernel (b on syn-m-two) is refused.
  const noB = writeBl('no-b', (d) => { d.nodes['syn-m-two'].fields = d.nodes['syn-m-two'].fields.filter((f) => f !== 'b'); });
  r = go(['--enforce', noB]);
  if (r.status !== 1 || !(r.stderr || '').includes('syn-m-two') || !(r.stderr || '').includes('"b"')) wrong.push(`enforce(added pair syn-m-two/b) exited ${r.status}, expected 1 naming syn-m-two and b`);
  // Unreadable baseline: usage error (2), never a silent pass.
  r = go(['--enforce', join(tmp, 'does-not-exist.json')]);
  if (r.status !== 2) wrong.push(`enforce(missing baseline file) exited ${r.status}, expected 2`);
  // --only: sweeps just the named kernels.
  r = go(['--only', 'syn-d-closed', '--enforce', noA]);
  if (r.status !== 0 || !/kernels examined: 1 /.test(r.stdout || '')) wrong.push(`--only syn-d-closed should examine 1 kernel and pass (exit ${r.status})`);
  r = go(['--only', 'syn-a-spend', '--enforce', noA]);
  if (r.status !== 1) wrong.push(`--only syn-a-spend against a baseline without it exited ${r.status}, expected 1`);
  r = go(['--only', 'syn-a-spend']);
  if (r.status !== 0) wrong.push(`--only without --enforce must stay advisory (exit ${r.status})`);
  r = go(['--only', 'syn-no-such-kernel']);
  if (r.status !== 2) wrong.push(`--only unknown id exited ${r.status}, expected 2`);
  return wrong;
}

let failed = 0;
try {
  // RED: a deliberately broken checker (never records a fail-open case) must be caught.
  const brokenPath = join(tmp, 'broken-checker.mjs');
  const src = readFileSync(REAL, 'utf8');
  const broken = src.replace('sink.push(', 'void (');
  if (broken === src) throw new Error('selftest cannot break the checker: marker `sink.push(` not found');
  writeFileSync(brokenPath, broken.replace("resolve(HERE, '..')", JSON.stringify(resolve(HERE, '..'))));
  const red = runChecker(brokenPath, 'red');
  if (red.crashed || red.wrong.length === 0) {
    console.error('RED control did not go red: the broken checker was not detected.', red);
    failed++;
  } else {
    console.log(`RED  ok: broken checker detected (${red.wrong.length} control(s) failed as they must)`);
  }
  const redEnf = enforceControls(brokenPath, 'redenf');
  if (redEnf.length === 0) {
    console.error('RED control did not go red: the broken checker passed every enforce-mode control.');
    failed++;
  } else {
    console.log(`RED  ok: broken checker detected by enforce-mode controls (${redEnf.length} failed as they must)`);
  }
  const greenEnf = enforceControls(REAL, 'greenenf');
  if (greenEnf.length) {
    console.error('GREEN enforce-mode controls failed:', greenEnf.join('; '));
    failed++;
  } else {
    console.log('GREEN ok: enforce refuses a new fail-open kernel and an added pair, accepts the current baseline and a shrunk one; --only scopes the sweep');
  }
  // GREEN: the real checker satisfies every control.
  const green = runChecker(REAL, 'green');
  if (green.crashed || green.wrong.length) {
    console.error('GREEN control failed:', green.crashed ? green : green.wrong.join('; '));
    failed++;
  } else {
    console.log('GREEN ok: a, b, c, h, i, j, k planted FAIL; d, f PASS; e1, g UNDECLARED (g with HARNESS-SUSPECT); e2 UNCLASSIFIED; baseline holds FAIL pairs only');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
if (failed) { console.error(`✗ kernel-missing-input-failclosed selftest: ${failed} control group(s) failed`); process.exit(1); }
console.log('✓ kernel-missing-input-failclosed selftest: RED then GREEN');
