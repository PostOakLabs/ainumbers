#!/usr/bin/env node
// derived-regen-deadman-retry.test.mjs — DEADMAN-RERUN-STALE-SHA-1 controls.
//
// The deadman's retry-once job re-runs a failed main regen after a 10-minute
// back-off. A re-run checks out its ORIGINAL commit, and the regen's
// concurrency group keeps a single pending run, so re-running an old commit
// cancelled the pending regen of main's newest commit (2026-11-25: re-runs of
// 58d1b4eb and 205223c1 cancelled the regen of 018b75f8). The job must only
// re-run while the failed run's commit is still main's head.
//
// The retry step's own shell is extracted from the workflow and executed with
// a stub `gh` on PATH and the back-off removed:
//   GREEN  main still at the failed commit  -> exactly one `gh run rerun`
//   SKIP   main moved past the failed commit -> no re-run, exit 0
// Zero-dep, node:test; temp dir only, writes nothing into the repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WF = readFileSync(join(ROOT, '.github/workflows/derived-regen-deadman.yml'), 'utf8');

/** The `run: |` body of the retry step, dedented, with the back-off removed. */
function retryScript() {
  const start = WF.indexOf('- name: Back off, then re-run the failed jobs');
  assert.notEqual(start, -1, 'retry step missing from derived-regen-deadman.yml');
  const lines = WF.slice(start).split('\n');
  const runAt = lines.findIndex((l) => /^\s*run:\s*\|\s*$/.test(l));
  assert.ok(runAt > 0, 'retry step has no `run: |` block');
  const body = [];
  let indent = null;
  for (const l of lines.slice(runAt + 1)) {
    if (l.trim() === '') { body.push(''); continue; }
    const n = l.match(/^\s*/)[0].length;
    if (indent === null) indent = n;
    if (n < indent) break;
    body.push(l.slice(indent));
  }
  const text = body.join('\n');
  assert.match(text, /sleep 600/, 'the back-off is expected in the retry step');
  return text.replace(/^sleep 600$/m, ': back-off removed for the test');
}

function runWith({ headSha, mainSha }) {
  const dir = mkdtempSync(join(tmpdir(), 'deadman-retry-'));
  try {
    const log = join(dir, 'gh.log');
    const gh = join(dir, 'gh');
    // `gh api .../jobs` -> a transient (push-race) failure, so the retry
    // helper says retry; `gh api .../commits/main` -> the stubbed main head.
    const jobs = JSON.stringify({ jobs: [{ conclusion: 'failure', steps: [{ name: 'Commit and push', conclusion: 'failure' }] }] });
    writeFileSync(join(dir, 'jobs.json'), jobs);
    writeFileSync(gh, [
      '#!/usr/bin/env bash',
      `echo "$*" >> "${log}"`,
      'if [ "$1" = "api" ]; then',
      `  case "$2" in *"/jobs"*) cat "${join(dir, 'jobs.json')}" ;; *"/commits/main"*) echo "$MAIN_SHA_STUB" ;; esac`,
      'fi',
      'exit 0',
      '',
    ].join('\n'));
    chmodSync(gh, 0o755);
    const script = join(dir, 'step.sh');
    writeFileSync(script, retryScript());
    const r = spawnSync('bash', [script], {
      encoding: 'utf8',
      cwd: ROOT, // the step runs scripts/ci/regen-retry-decide.mjs by relative path
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        GH_TOKEN: 'stub', RUN_ID: '123', HEAD_SHA: headSha,
        GITHUB_REPOSITORY: 'owner/repo', MAIN_SHA_STUB: mainSha,
      },
    });
    const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : [];
    return { status: r.status, stdout: r.stdout, stderr: r.stderr, calls };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('GREEN: main still at the failed commit -> exactly one re-run', () => {
  const r = runWith({ headSha: 'aaaa', mainSha: 'aaaa' });
  assert.equal(r.status, 0, r.stderr);
  const reruns = r.calls.filter((c) => c.startsWith('run rerun'));
  assert.deepEqual(reruns, ['run rerun 123 --repo owner/repo --failed']);
});

test('SKIP: main moved past the failed commit -> no re-run, exit 0', () => {
  const r = runWith({ headSha: 'aaaa', mainSha: 'bbbb' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.calls.filter((c) => c.startsWith('run rerun')).length, 0, `unexpected re-run: ${r.calls.join(' | ')}`);
  assert.match(r.stdout, /main moved from aaaa to bbbb/);
});

test('the retry step reads the failed run head SHA from the event, not from a step output', () => {
  const start = WF.indexOf('- name: Back off, then re-run the failed jobs');
  const block = WF.slice(start, start + 600);
  assert.match(block, /HEAD_SHA:\s*\$\{\{\s*github\.event\.workflow_run\.head_sha\s*\}\}/);
});
