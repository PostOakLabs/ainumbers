#!/usr/bin/env node
// scheduled-red-issue.test.mjs — the six controls NIGHTLY-RED-ISSUE-OPENER-1
// names, each proven against the simulated backend so no red is ever
// manufactured on the shared repo to exercise them.
//
//   OPENS            a red on a surface with no open issue creates one, and the
//                    body carries surface + run id + failure line.
//   IDEMPOTENT       a SECOND red on the same surface updates the SAME issue.
//                    No second issue. This is the control that matters.
//   CLOSES           the surface goes green -> the issue closes.
//   QUIET WHEN GREEN a green run with no open issue opens nothing, touches nothing.
//   SCOPED           a pull_request event is refused: an ordinary PR/CI red can
//                    never open an issue here.
//   LEDGER-ECHO      every create/update/close emits a one-line ledger pointer
//                    (issue number + surface + run id), and --harvest recovers
//                    those pointers into the findings ledger from the issue store
//                    alone, which is the no-session-running case.
//
// Zero-dep, node:test. Uses a temp dir; writes nothing into the repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyReport, fileBackend, harvest, titleFor, SURFACES, ALLOWED_EVENTS,
  extractFailureLine, cleanLogLine, NO_GATE_LINE_FOUND,
  statusPayload, STATUS_DESCRIPTION_MAX,
} from './scheduled-red-issue.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, 'scheduled-red-issue.mjs');
const KEY = 'mutation-nightly';

function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'sched-red-'));
  return { dir, store: join(dir, 'issues.json'), ledger: join(dir, 'FINDINGS-HELD-2026-09.md') };
}

test('OPENS: a red opens one issue whose body carries surface + run id + failure line', () => {
  const { store } = fresh();
  const be = fileBackend(store);
  const r = applyReport(be, {
    key: KEY, state: 'red', runId: '34137426698',
    runUrl: 'https://github.com/PostOakLabs/ainumbers/actions/runs/34137426698',
    failureLine: 'Shard 3 (failure): ran to completion with a kernel below its break floor',
  });
  assert.equal(r.action, 'opened');
  assert.ok(Number.isInteger(r.issue));
  const db = JSON.parse(readFileSync(store, 'utf8'));
  assert.equal(db.issues.length, 1);
  const body = db.issues[0].body;
  assert.equal(db.issues[0].title, titleFor(KEY));
  assert.match(body, /Mutation Tier Scan \(scheduled\)/);          // which surface
  assert.match(body, /34137426698/);                                // which run id
  assert.match(body, /below its break floor/);                      // what failed, first line
  assert.match(body, /80 label-decorated and 41 fixture-less floors/); // the dark-floor backlog, quoted
});

test('IDEMPOTENT: a second red UPDATES the same issue and opens no second issue', () => {
  const { store } = fresh();
  const be = fileBackend(store);
  const first = applyReport(be, { key: KEY, state: 'red', runId: '1', runUrl: 'u/1', failureLine: 'first' });
  const second = applyReport(be, { key: KEY, state: 'red', runId: '2', runUrl: 'u/2', failureLine: 'second' });
  assert.equal(first.action, 'opened');
  assert.equal(second.action, 'updated');
  assert.equal(second.issue, first.issue, 'the second red must land on the SAME issue number');
  const db = JSON.parse(readFileSync(store, 'utf8'));
  assert.equal(db.issues.length, 1, 'a second issue is the failure this row exists to prevent');
  assert.equal(db.issues[0].comments.length, 1);
  assert.match(db.issues[0].comments[0], /Still red as of run 2/);
});

test('IDEMPOTENT: ten consecutive reds still leave exactly one issue', () => {
  const { store } = fresh();
  const be = fileBackend(store);
  for (let i = 0; i < 10; i++) {
    applyReport(be, { key: KEY, state: 'red', runId: String(i), runUrl: `u/${i}`, failureLine: 'x' });
  }
  const db = JSON.parse(readFileSync(store, 'utf8'));
  assert.equal(db.issues.length, 1);
  assert.equal(db.issues[0].comments.length, 9);
});

test('CLOSES: the surface going green closes the open issue', () => {
  const { store } = fresh();
  const be = fileBackend(store);
  const opened = applyReport(be, { key: KEY, state: 'red', runId: '1', runUrl: 'u/1', failureLine: 'f' });
  const closed = applyReport(be, { key: KEY, state: 'green', runId: '2', runUrl: 'u/2' });
  assert.equal(closed.action, 'closed-on-green');
  assert.equal(closed.issue, opened.issue);
  const db = JSON.parse(readFileSync(store, 'utf8'));
  assert.equal(db.issues[0].state, 'closed');
  assert.match(db.issues[0].comments.at(-1), /Green again as of run 2/);
});

test('CLOSES then re-OPENS: a red after a close opens a fresh issue, not a resurrection', () => {
  const { store } = fresh();
  const be = fileBackend(store);
  const a = applyReport(be, { key: KEY, state: 'red', runId: '1', runUrl: 'u/1', failureLine: 'f' });
  applyReport(be, { key: KEY, state: 'green', runId: '2', runUrl: 'u/2' });
  const c = applyReport(be, { key: KEY, state: 'red', runId: '3', runUrl: 'u/3', failureLine: 'f' });
  assert.equal(c.action, 'opened');
  assert.notEqual(c.issue, a.issue);
});

test('QUIET WHEN GREEN: a green run with no open issue opens nothing and touches nothing', () => {
  const { store } = fresh();
  const be = fileBackend(store);
  const r = applyReport(be, { key: KEY, state: 'green', runId: '1', runUrl: 'u/1' });
  assert.equal(r.action, 'noop-green');
  assert.equal(r.issue, null);
  assert.equal(r.ledger, null);
  assert.equal(existsSync(store), false, 'a green no-op must not even create the issue store');
});

test('SCOPED: a pull_request event is refused, an ordinary PR/CI red cannot open an issue', () => {
  assert.equal(ALLOWED_EVENTS.has('pull_request'), false);
  assert.equal(ALLOWED_EVENTS.has('merge_group'), false);
  const { store } = fresh();
  assert.throws(
    () => execFileSync(process.execPath, [SCRIPT, '--surface', KEY, '--state', 'red',
      '--event', 'pull_request', '--store', store, '--run-id', '9', '--run-url', 'u/9'],
    { encoding: 'utf8', stdio: 'pipe' }),
    /out of scope/,
  );
  assert.equal(existsSync(store), false);
});

test('SCOPED: an unknown surface key is a hard error, never a silent green', () => {
  const be = fileBackend(fresh().store);
  assert.throws(() => applyReport(be, { key: 'some-pr-check', state: 'red', runId: '1', runUrl: 'u' }),
    /unknown surface/);
});

test('LEDGER-ECHO: create/update/close each emit a pointer carrying issue + surface + run id', () => {
  const { store } = fresh();
  const be = fileBackend(store);
  const a = applyReport(be, { key: KEY, state: 'red', runId: '11', runUrl: 'u/11', failureLine: 'f' });
  const b = applyReport(be, { key: KEY, state: 'red', runId: '12', runUrl: 'u/12', failureLine: 'f' });
  const c = applyReport(be, { key: KEY, state: 'green', runId: '13', runUrl: 'u/13' });
  for (const [r, run] of [[a, '11'], [b, '12'], [c, '13']]) {
    assert.match(r.ledger, new RegExp(`#${r.issue}\\b`));
    assert.match(r.ledger, new RegExp(KEY));
    assert.match(r.ledger, new RegExp(`run ${run}\\b`));
  }
});

test('LEDGER-ECHO: --harvest recovers pointers into the ledger with no session running', () => {
  const { store, ledger } = fresh();
  const be = fileBackend(store);
  const r = applyReport(be, { key: KEY, state: 'red', runId: '77', runUrl: 'u/77', failureLine: 'f' });
  const appended = harvest(be, ledger);
  assert.equal(appended.length, 1);
  const text = readFileSync(ledger, 'utf8');
  assert.match(text, new RegExp(`issue #${r.issue}`));
  assert.match(text, /run 77/);
  // Idempotent on the ledger too: a second sweep appends nothing.
  assert.equal(harvest(be, ledger).length, 0);
  assert.equal(readFileSync(ledger, 'utf8'), text);
});

test('registry covers exactly the surfaces the rows name (three scheduled + the regen listener)', () => {
  assert.deepEqual([...SURFACES.keys()].sort(),
    ['derived-regen', 'fullsuite-weekly', 'mutation-nightly', 'prepush-attestation']);
  for (const [key, s] of SURFACES) {
    assert.ok(existsSync(resolve(HERE, '..', s.workflow)), `${key}: ${s.workflow} must exist`);
  }
});

test('derived-regen: the workflow_run listener surface is registered, reachable and scoped', () => {
  // The regen-failure deadman listener surface: registered, reachable and scoped.
  // (a workflow_run conclusion the script refused would alarm nobody), while
  // pull_request/merge_group stay refused.
  assert.equal(ALLOWED_EVENTS.has('workflow_run'), true);
  assert.equal(ALLOWED_EVENTS.has('pull_request'), false);
  const s = SURFACES.get('derived-regen');
  const wf = readFileSync(resolve(HERE, '..', s.workflow), 'utf8');
  // The listener runs the tracker as a SCRIPT (DEADMAN-REUSABLE-CALL-HEAL-1,
  // PR #2426): a step-level `uses:` of the workflow_call file is read as a local
  // action and dies on the missing action.yml (the PR #2423 regression).
  assert.match(wf, /node \.\/scripts\/scheduled-red-issue\.mjs/, 'the listener must run the shared tracker script');
  assert.match(wf, /--surface derived-regen\b/);
  assert.doesNotMatch(wf, /^\s*(-\s*)?uses:\s*\.\/\.github\/workflows\/scheduled-red-issue\.yml/m, 'a step-level uses: of the workflow_call file is the PR #2423 regression');
  // Branch scoping lives in the listener's `gate` job, not in the script —
  // via an env-var comparison (template-injection safe), not a raw `${{ }}`
  // interpolation into the shell.
  assert.match(wf, /BRANCH: \$\{\{ github\.event\.workflow_run\.head_branch \}\}/, 'the listener must read the branch through env');
  assert.match(wf, /\$BRANCH" = "main"/, 'the listener must scope itself to main');
  // And it must guard the workflow name, so no other workflow's failure can
  // reach this surface.
  assert.match(wf, /workflows: \[ "Derived Artifacts Regen" \]/);
});

test('every caller workflow passes a surface key the registry knows', () => {
  // Reverse direction: a caller that invents a key would open no issue at all,
  // which is this row's failure mode wearing a green run.
  for (const [key, s] of SURFACES) {
    const wf = readFileSync(resolve(HERE, '..', s.workflow), 'utf8');
    // Either caller shape counts: the reusable workflow (`surface: key`) or the
    // tracker script run directly (`scheduled-red-issue.mjs --surface key`).
    const viaReusable = /scheduled-red-issue\.yml/.test(wf) && new RegExp(`surface:\\s*${key}\\b`).test(wf);
    const viaScript = /scheduled-red-issue\.mjs/.test(wf) && new RegExp(`--surface ${key}\\b`).test(wf);
    assert.ok(viaReusable || viaScript, `${s.workflow} must call the shared tracker with surface ${key}`);
  }
});

// ── REGEN-RED-STOPS-THE-LINE-1: the failure-line extractor ──────────────────
// Run 39936907518 (2026-10-23, issue #2557) is the incident: the regen failed
// 14 merges in a row on two em-dashes in chaingraph.json#descriptions, and the
// deadman's issue quoted the `##[group]Run` header instead of the gate's
// finding line. The fixture beside this test is that run's failed-job log,
// captured verbatim (13 lines, exact gh log shape incl. the BOM and the ^[
// cyan echoes; no secrets — the only *** is GitHub's own mask text).
const REGEN_EXCERPT = resolve(HERE, 'fixtures/scheduled-red-issue/regen-39936907518-copy-gate-excerpt.log');
const EMDASH_LINE = 'chaingraph/chaingraph.json#descriptions: 2 em-dash(es) in visible text (baseline 0)';

// The PRE-FIX extraction, replicated from derived-regen-deadman.yml's old
// failure-line step: grep -m1 -E 'copy-hallmarks|shipped-prose|::error|REFUSED|Error:'.
function legacyGrepExtract(logText) {
  for (const raw of String(logText).split('\n')) {
    if (/copy-hallmarks|shipped-prose|::error|REFUSED|Error:/.test(raw)) return raw.slice(0, 300);
  }
  return '';
}

test('EXTRACTOR (a) RED control: the pre-fix grep picked the ##[group]Run header over the gate finding', () => {
  const log = readFileSync(REGEN_EXCERPT, 'utf8');
  const picked = legacyGrepExtract(log);
  // The defect, quoted: the word "copy-hallmarks" first appears in the run
  // HEADER, so the old grep stopped there and issue #2557 carried
  // "##[group]Run node scripts/check-copy-hallmarks.mjs" as its failure line.
  assert.match(picked, /##\[group\]Run node scripts\/check-copy-hallmarks\.mjs/);
  assert.doesNotMatch(picked, /em-dash/);
  // And the fixed extractor must NOT return that header — this is the assert
  // that FAILS if extractFailureLine ever regresses to the old behaviour.
  assert.notEqual(extractFailureLine(log), cleanLogLine(picked).trim());
});

test('EXTRACTOR (b) GREEN: the fixed extractor returns the em-dash finding line, function and CLI both', () => {
  const log = readFileSync(REGEN_EXCERPT, 'utf8');
  assert.equal(extractFailureLine(log), EMDASH_LINE);
  // The deadman pipes `gh run view --job … --log-failed` through the CLI;
  // prove that exact path over the same captured bytes.
  const viaCli = execFileSync(process.execPath, [SCRIPT, '--extract-failure-line'],
    { input: log, encoding: 'utf8' });
  assert.equal(viaCli.trim(), EMDASH_LINE);
});

test('EXTRACTOR (c) GREEN: only ##[group] noise returns the no-gate-line fallback, never the header', () => {
  const noise = [
    'Regenerate shared derived artifacts\tValidate the regenerated reader-facing copy (CONTRACT.md §1.4)\t2026-10-23T10:20:42.5275079Z ##[group]Run node scripts/check-copy-hallmarks.mjs',
    'Regenerate shared derived artifacts\tValidate the regenerated reader-facing copy (CONTRACT.md §1.4)\t2026-10-23T10:20:42.5275677Z ^[[36;1mnode scripts/check-copy-hallmarks.mjs^[[0m',
    'Regenerate shared derived artifacts\tValidate the regenerated reader-facing copy (CONTRACT.md §1.4)\t2026-10-23T10:20:42.5343906Z shell: /usr/bin/bash -e {0}',
    'Regenerate shared derived artifacts\tValidate the regenerated reader-facing copy (CONTRACT.md §1.4)\t2026-10-23T10:20:42.5344383Z ##[endgroup]',
    '',
  ].join('\n');
  const picked = extractFailureLine(noise);
  assert.equal(picked, NO_GATE_LINE_FOUND);
  assert.doesNotMatch(picked, /##\[group\]/, 'the header is noise and must never be picked');
});

test('EXTRACTOR: an advisory finding is never picked, and a summary-only red falls back to the summary', () => {
  // The ADVISORY block's findings (rule-of-three triads) sit in the same
  // fixture AFTER the failing finding; a log with ONLY the advisory block
  // must fall through to the summary tier, not quote an advisory line.
  const log = readFileSync(REGEN_EXCERPT, 'utf8');
  const advisoryOnly = log.split('\n').filter((l) => !/FAILURE\(s\)|##\[error\]|descriptions: 2 em-dash/.test(l)).join('\n');
  const picked = extractFailureLine(advisoryOnly);
  assert.doesNotMatch(picked, /rule-of-three/, 'advisory findings are not failures');
  assert.equal(picked, NO_GATE_LINE_FOUND, 'with the failure block removed there is no gate line at all');
  // A gate that reds with a summary but no detail lines: the summary is the line.
  assert.equal(
    extractFailureLine('job\tstep\t2026-10-23T10:20:46.6676007Z ✗ some-gate FAILED (2) — the reason'),
    '✗ some-gate FAILED (2) — the reason',
  );
});

// ── REGEN-RED-STOPS-THE-LINE-1: the advisory derived-regen/main commit status ─
test('STATUS: a red report posts the derived-regen/main failure status (issue target, truncated description)', () => {
  const { store } = fresh();
  const be = fileBackend(store);
  const r = applyReport(be, {
    key: 'derived-regen', state: 'red', runId: '39936907518', runUrl: 'u/39936907518',
    failureLine: `regen run u :: ${EMDASH_LINE}`,
  });
  be.postStatus('b1a4a42f107adaa384be7b740cd452af1dcc6e49', statusPayload({
    state: 'failure',
    context: 'derived-regen/main',
    description: EMDASH_LINE,
    targetUrl: `https://github.com/PostOakLabs/ainumbers/issues/${r.issue}`,
  }));
  const db = JSON.parse(readFileSync(store, 'utf8'));
  assert.equal(db.statuses.length, 1);
  assert.equal(db.statuses[0].state, 'failure');
  assert.equal(db.statuses[0].context, 'derived-regen/main');
  assert.equal(db.statuses[0].description, EMDASH_LINE);
  assert.equal(db.statuses[0].target_url, `https://github.com/PostOakLabs/ainumbers/issues/${r.issue}`);
});

test('STATUS: statusPayload truncates to the 140-char cap and refuses a non-status state', () => {
  assert.equal(STATUS_DESCRIPTION_MAX, 140, 'GitHub caps a commit-status description at 140 characters');
  const p = statusPayload({ state: 'failure', context: 'derived-regen/main', description: 'x'.repeat(300) });
  assert.equal(p.description.length, 140);
  assert.throws(() => statusPayload({ state: 'pending', context: 'x' }), /success\|failure/);
  assert.throws(() => statusPayload({ state: 'failure' }), /requires a context/);
});
