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

const EXPECT = {
  'syn-a-spend': 'FAIL',
  'syn-b-criteria': 'FAIL',
  'syn-c-flag': 'FAIL',
  'syn-d-closed': 'PASS',
  'syn-e1-undeclared': 'UNDECLARED',
  'syn-e2-unclassified': 'UNCLASSIFIED',
};

function runChecker(script, tag) {
  const jsonPath = join(tmp, `${tag}.json`);
  const r = spawnSync(process.execPath, [script, '--root', tmp, '--json', jsonPath], { encoding: 'utf8' });
  if (r.status !== 0) return { crashed: true, status: r.status, stderr: (r.stderr || '').slice(0, 300) };
  const report = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const got = Object.fromEntries(report.kernels.map((k) => [k.id, k.state]));
  const wrong = Object.entries(EXPECT).filter(([id, s]) => got[id] !== s).map(([id, s]) => `${id}: expected ${s}, got ${got[id]}`);
  const nullPassFails = report.kernels.find((k) => k.id === 'syn-c-flag')?.fails.filter((f) => f.mode === 'null').length ?? 0;
  if (nullPassFails === 0) wrong.push('syn-c-flag: the null-set pass recorded no fail-open case');
  return { crashed: false, wrong };
}

let failed = 0;
try {
  // RED: a deliberately broken checker (never records a fail-open case) must be caught.
  const brokenPath = join(tmp, 'broken-checker.mjs');
  const src = readFileSync(REAL, 'utf8');
  const broken = src.replace('out.fails.push(', 'void (');
  if (broken === src) throw new Error('selftest cannot break the checker: marker `out.fails.push(` not found');
  writeFileSync(brokenPath, broken.replace("resolve(HERE, '..')", JSON.stringify(resolve(HERE, '..'))));
  const red = runChecker(brokenPath, 'red');
  if (red.crashed || red.wrong.length === 0) {
    console.error('RED control did not go red: the broken checker was not detected.', red);
    failed++;
  } else {
    console.log(`RED  ok: broken checker detected (${red.wrong.length} control(s) failed as they must)`);
  }
  // GREEN: the real checker satisfies every control.
  const green = runChecker(REAL, 'green');
  if (green.crashed || green.wrong.length) {
    console.error('GREEN control failed:', green.crashed ? green : green.wrong.join('; '));
    failed++;
  } else {
    console.log('GREEN ok: a, b, c planted FAIL; d PASS; e1 UNDECLARED; e2 UNCLASSIFIED');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
if (failed) { console.error(`✗ kernel-missing-input-failclosed selftest: ${failed} control group(s) failed`); process.exit(1); }
console.log('✓ kernel-missing-input-failclosed selftest: RED then GREEN');
