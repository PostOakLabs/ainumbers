#!/usr/bin/env node
/**
 * scripts/check-workflow-step-uses.test.mjs — WORKFLOW-STEP-USES-LINT-1 / SO #40b,
 * RED before GREEN self-test for scripts/check-workflow-step-uses.mjs.
 *
 * Plants temp-dir workflows covering: (a) a step-level local reusable-workflow call,
 * (b) the legal job-level form, (c) a step-level normal action (must NOT be flagged),
 * (d) the real-tree shape of derived-regen-deadman.yml:164. Through the gate process
 * itself (--dir/--baseline hooks): missing baseline RED, a call outside the baseline
 * RED with the named message, a baselined call GREEN, and --update-baseline refusing
 * to raise the ceiling (deletable-baseline rule via the shared ratchet loader).
 *
 * Usage: node scripts/check-workflow-step-uses.test.mjs  (also under `node --test`)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { scanWorkflow, scanAll, isReusableWorkflowUse, BASELINE_PATH } from './check-workflow-step-uses.mjs';

const GATE = fileURLToPath(new URL('./check-workflow-step-uses.mjs', import.meta.url));

function workflow(body) {
  return `name: t\non: [push]\n${body}`;
}

function runGate(args) {
  try {
    return { code: 0, stdout: execFileSync(process.execPath, [GATE, ...args], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout || '', stderr: e.stderr || String(e) };
  }
}

const BAD_STEP_LOCAL = workflow([
  'jobs:',
  '  build:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - name: report',
  '        uses: ./.github/workflows/x.yml',
  '',
].join('\n'));

const GOOD_JOB_LEVEL = workflow([
  'jobs:',
  '  alarm:',
  '    uses: ./.github/workflows/x.yml',
  '    with:',
  '      surface: t',
  '',
].join('\n'));

const GOOD_STEP_ACTION = workflow([
  'jobs:',
  '  build:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - uses: actions/checkout@0ad4b8fadaa221de15dcec353f45205ec38ea70b',
  '      - uses: ./action',
  '',
].join('\n'));

// The real deadman tree shape (derived-regen-deadman.yml:164, emoji step name,
// if: condition between name and uses).
const BAD_DEADMAN_SHAPE = workflow([
  'jobs:',
  '  gate:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - name: probe',
  '        run: echo ok',
  '      - name: "\u{1F6A8} Report the regen state"',
  '        if: failure()',
  '        uses: ./.github/workflows/scheduled-red-issue.yml',
  '        with:',
  '          surface: derived-regen',
  '',
].join('\n'));

const BAD_STEP_REMOTE = workflow([
  'jobs:',
  '  build:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - uses: owner/repo/.github/workflows/x.yml@v1',
  '',
].join('\n'));

function makeTree(files, baselineJson) {
  const dir = mkdtempSync(join(tmpdir(), 'step-uses-'));
  const wf = join(dir, 'wf');
  mkdirSync(wf, { recursive: true });
  for (const [name, text] of files) writeFileSync(join(wf, name), text);
  if (baselineJson !== undefined) writeFileSync(join(dir, 'baseline.json'), baselineJson);
  return { dir, wf, baseline: join(dir, 'baseline.json') };
}

test('shape classifier: reusable-workflow values vs normal actions', () => {
  assert.equal(isReusableWorkflowUse('./.github/workflows/x.yml'), true);
  assert.equal(isReusableWorkflowUse('owner/repo/.github/workflows/x.yml@v1'), true);
  assert.equal(isReusableWorkflowUse('actions/checkout@0ad4b8fadaa221de15dcec353f45205ec38ea70b'), false);
  assert.equal(isReusableWorkflowUse('./action'), false);
  assert.equal(isReusableWorkflowUse('docker://alpine:3'), false);
  assert.equal(isReusableWorkflowUse('./.github/workflows/notes.md'), false);
});

test('(a) step-level local call found at the exact source line', () => {
  const hits = scanWorkflow(BAD_STEP_LOCAL);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 8);
  assert.equal(hits[0].value, './.github/workflows/x.yml');
});

test('(b) job-level reusable call produces no hit', () => {
  assert.deepEqual(scanWorkflow(GOOD_JOB_LEVEL), []);
});

test('(c) step-level normal actions produce no hit', () => {
  assert.deepEqual(scanWorkflow(GOOD_STEP_ACTION), []);
});

test('(d) the real deadman tree shape is flagged', () => {
  const hits = scanWorkflow(BAD_DEADMAN_SHAPE);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].value, './.github/workflows/scheduled-red-issue.yml');
});

test('step-level owner/repo/.github/workflows/x.yml@ref is flagged too', () => {
  assert.equal(scanWorkflow(BAD_STEP_REMOTE).length, 1);
});

test('gate process: missing baseline REDs (MISSING-FILE, the deletable-baseline rule)', () => {
  const t = makeTree([['bad.yml', BAD_STEP_LOCAL]]);
  const r = runGate(['--dir', t.wf, '--baseline', t.baseline]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /MISSING-FILE/);
  rmSync(t.dir, { recursive: true, force: true });
});

test('gate process: unbaselined call REDs with file:line and the move-it message', () => {
  const t = makeTree(
    [['bad.yml', BAD_STEP_LOCAL], ['good.yml', GOOD_JOB_LEVEL]],
    JSON.stringify({ deferred: 0, deferred_files: [] }),
  );
  const r = runGate(['--dir', t.wf, '--baseline', t.baseline]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /bad\.yml:8: reusable workflow "\.\/\.github\/workflows\/x\.yml" called from a step/);
  rmSync(t.dir, { recursive: true, force: true });
});

test('gate process: baselined call GREENs; good-only tree GREENs', () => {
  const t = makeTree(
    [['bad.yml', BAD_STEP_LOCAL], ['good.yml', GOOD_JOB_LEVEL]],
    JSON.stringify({ deferred: 1, deferred_files: ['bad.yml'] }),
  );
  const r = runGate(['--dir', t.wf, '--baseline', t.baseline]);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /1 step-level call\(s\), all baselined/);
  rmSync(t.dir, { recursive: true, force: true });

  const g = makeTree([['good.yml', GOOD_JOB_LEVEL], ['good2.yml', GOOD_STEP_ACTION]], JSON.stringify({ deferred: 0, deferred_files: [] }));
  const r2 = runGate(['--dir', g.wf, '--baseline', g.baseline]);
  assert.equal(r2.code, 0, r2.stderr);
  rmSync(g.dir, { recursive: true, force: true });
});

test('--update-baseline pins the live count and refuses to raise a lower ceiling', () => {
  const t = makeTree([['bad.yml', BAD_STEP_LOCAL]]);
  const b = t.baseline;
  const pin = runGate(['--dir', t.wf, '--baseline', b, '--update-baseline']);
  assert.equal(pin.code, 0, pin.stderr);
  assert.equal(JSON.parse(readFileSync(b, 'utf8')).deferred, 1);
  // lower the ceiling by hand, then repin over a tree where the call persists: refused
  writeFileSync(b, JSON.stringify({ deferred: 0, deferred_files: [] }));
  const raise = runGate(['--dir', t.wf, '--baseline', b, '--update-baseline']);
  assert.equal(raise.code, 1);
  assert.match(raise.stderr, /never raises|RAISES the ceiling/);
  assert.equal(JSON.parse(readFileSync(b, 'utf8')).deferred, 0, 'the pinned file must be untouched on refusal');
  rmSync(t.dir, { recursive: true, force: true });
});

test('the shipped repo baseline pins exactly the deadman entry', () => {
  assert.ok(existsSync(BASELINE_PATH));
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  assert.equal(baseline.deferred, 1);
  assert.deepEqual(baseline.deferred_files, ['derived-regen-deadman.yml']);
  // and the real tree scan agrees with it
  const hits = scanAll();
  assert.equal(hits.length, 1);
  assert.equal(hits[0].file, 'derived-regen-deadman.yml');
  assert.equal(hits[0].line, 164);
});
