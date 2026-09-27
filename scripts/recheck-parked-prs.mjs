#!/usr/bin/env node
/**
 * recheck-parked-prs.mjs — unstick PRs parked on main-side derived reds.
 *
 * Row PARKED-PR-RECHECK-FLOW-1 (2026-09-27, Tim-directed). Problem, measured:
 * `derived-artifacts-regen.yml` regenerates shared derived artifacts on main,
 * but GitHub does not re-run an open PR's checks when main moves. A PR whose
 * only reds are main-side derived reds ("S17 kernel-identity, S18 recompute,
 * absence-tree staleness" — ORCH-314/318) turns green ONLY when its checks
 * RE-RUN against the regenerated base, so digest-moving PRs sat parked until a
 * human noticed main had caught up (TIM-QUEUE 2026-09-26T23:21Z). This script
 * is the clearing mechanism: after every successful `chore(derived)` regen
 * commit, it re-requests the failed check suites of exactly those PRs.
 *
 * WHAT IT NEVER DOES — by construction, there is no code path here for any of
 * it: no merge (no `gh pr merge`, no merge API call), no label, no comment,
 * no branch write. The ONLY writes it can attempt are the two re-request
 * forms the row names: POST /check-suites/<id>/rerequest, and — measured
 * fallback, see below — POST /actions/runs/<id>/rerun-failed-jobs. Nothing
 * else.
 *
 * MEASURED WRITE PATH (2026-09-27, both target PRs): the checks-API suite
 * rerequest returns 404 on every live parked-PR suite — the suite advertises
 * `"rerequestable": true` but `"runs_rerequestable": false"` — while the
 * Actions API's rerun-failed-jobs on the SAME failing checks succeeds. So the
 * script tries the checks API first and, on exactly 404, maps the failing
 * check run to its Actions run id (parsed from details_url) and issues
 * rerun-failed-jobs — "re-run the checks you already ran", failed jobs only.
 *
 * MEMBERSHIP (the classifier, per the row): a PR is PARKED when
 *   (a) its latest failing check runs include at least one of the main-side
 *       derived class — `Full preflight gate suite`, `html-verify / required`,
 *       `scripts-verify / required`, `land-verify / required` — and
 *   (b) it carries NO red in the PR-scoped gates (JS syntax, CSP,
 *       copy-hallmarks, dead-link — live check names: `jsdoc-checkjs /
 *       required`, `CSP + copy-hallmarks + dead-link + chrome gates`).
 * A PR-scoped red means the PR itself is broken; no amount of main-side regen
 * can fix it, and re-requesting would just burn CI.
 *
 * IDEMPOTENCE ("once per regen commit"): a check run whose started_at is
 * AFTER the regen commit's committer timestamp has already re-run against the
 * regenerated base — skip it. Only runs that started BEFORE the regen commit
 * are stale. The workflow passes the regen commit via RECHECK_REGEN_SHA; a
 * local run discovers the newest `chore(derived): regenerate shared derived
 * artifacts` commit on main itself.
 *
 * TOKEN: runs inside the workflow with the App push token. If that token
 * lacks checks:write, every re-request is refused (403): the script still
 * prints the full decision table and EXITS 0 — a visibility-only outcome the
 * row explicitly allows. Read failures are the only hard failure (exit 1).
 *
 * GUARDS: hard cap 5 re-requested PRs per run. --dry-run prints the table and
 * touches nothing. --self-test drives fixture JSON (the measured shapes of
 * #2077/#2058 plus counter-cases) through the same classifier with zero API
 * calls.
 *
 * Usage:
 *   node scripts/recheck-parked-prs.mjs [--dry-run] [--regen-sha <sha>]
 *   node scripts/recheck-parked-prs.mjs --self-test
 */

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { gitEnv } from './_git-env-lib.mjs';

// ── Row constants ────────────────────────────────────────────────────────────

/** (a) Failing check names that indicate a main-side derived red. */
export const DERIVED_FAILING_NAMES = [
  'Full preflight gate suite',
  'html-verify / required',
  'scripts-verify / required',
  'land-verify / required',
];

/**
 * (b) Failing check names that are PR-scoped gates. Any red here disqualifies
 * the PR from membership no matter how many derived reds it also carries.
 * Regexes because the live gates bundle several row-level concerns into one
 * check name (`CSP + copy-hallmarks + dead-link + chrome gates`).
 */
export const PR_SCOPED_RED_PATTERNS = [
  /jsdoc-checkjs/i, // JS syntax / checkJs gate
  /\bjs\.?\s?-?syntax\b/i, // the row's "JS syntax" naming, direct
  /\bcsp\b/i,
  /copy-?hallmarks?/i,
  /dead-?link/i,
];

/** Conclusions that count as "red". Queued/in_progress runs are merely fresh. */
const RED_CONCLUSIONS = new Set([
  'failure',
  'timed_out',
  'cancelled',
  'startup_failure',
]);

/** Hard cap on PRs whose checks get re-requested in one run. */
const MAX_PRS_PER_RUN = 5;

const REGEN_COMMIT_PREFIX = 'chore(derived): regenerate shared derived artifacts';

// ── gh plumbing ──────────────────────────────────────────────────────────────

function gh(args, { allowFail = false } = {}) {
  try {
    return execFileSync('gh', ['api', ...args], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    if (allowFail) return null;
    // Surface the denial verbatim — an honest red beats an invented green.
    const body = err.stdout ? String(err.stdout).slice(0, 400) : '';
    throw new Error(`gh api ${args.join(' ')} failed: ${err.message} ${body}`);
  }
}

/**
 * gh api call that NEVER throws: {ok, status, body}. The HTTP status is
 * parsed from gh's stderr line ("gh: Not Found (HTTP 404)") so the write path
 * can distinguish a 404 (wrong endpoint for these suites — fall back) from a
 * 403 (token lacks the permission — report and exit 0, per the row).
 */
function ghApi(args) {
  try {
    const body = execFileSync('gh', ['api', ...args], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return { ok: true, status: 200, body };
  } catch (err) {
    const m = /HTTP (\d{3})/.exec(String(err.stderr ?? ''));
    return {
      ok: false,
      status: m ? Number(m[1]) : 0,
      body: String(err.stdout ?? err.stderr ?? '').slice(0, 400),
    };
  }
}

/**
 * Map an Actions-created check run to its workflow run id — the rerun
 * fallback's key. Actions check runs carry
 * details_url = https://<host>/<owner>/<repo>/actions/runs/<run_id>/job/<job_id>.
 * Returns null when the run was not created by Actions (no fallback exists).
 */
export function actionsRunIdFromCheckRun(run) {
  const m = /actions\/runs\/(\d+)/.exec(String(run?.details_url ?? ''));
  return m ? m[1] : null;
}

function ghJson(endpoint) {
  return JSON.parse(gh([endpoint]));
}

function repoSlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  // Local/branch runs: derive owner/name from the checkout's origin.
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
    encoding: 'utf8',
    env: gitEnv(), // GIT-ENV-LEAK-SWEEP-1: never inherit ambient GIT_*
  }).trim();
  const m = url.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!m) throw new Error(`cannot parse repo slug from origin URL: ${url}`);
  return `${m[1]}/${m[2]}`;
}

/** The regen commit this run is anchored to (default: newest on main). */
function findRegenCommit(slug) {
  const commits = ghJson(
    `repos/${slug}/commits?sha=main&per_page=30`
  );
  const hit = commits.find((c) =>
    (c.commit?.message ?? '').startsWith(REGEN_COMMIT_PREFIX)
  );
  if (!hit) {
    throw new Error(
      `no ${REGEN_COMMIT_PREFIX}* commit in the last 30 on main — nothing to anchor idempotence to`
    );
  }
  return hit;
}

// ── The classifier (pure — exercised by --self-test) ────────────────────────

function isDerivedRed(run) {
  return (
    RED_CONCLUSIONS.has(run.conclusion) &&
    DERIVED_FAILING_NAMES.some(
      (n) => n.toLowerCase() === String(run.name ?? '').trim().toLowerCase()
    )
  );
}

function isPrScopedRed(run) {
  return (
    RED_CONCLUSIONS.has(run.conclusion) &&
    PR_SCOPED_RED_PATTERNS.some((re) => re.test(String(run.name ?? '')))
  );
}

/**
 * Decide one PR.
 * @param {object} pr  {number, title, head:{sha}}
 * @param {Array} runs latest check-runs for pr.head.sha
 * @param {Date} regenTime  committer timestamp of the regen commit
 * @returns decision row (plain object, printable)
 */
export function classifyPr(pr, runs, regenTime) {
  const reds = (runs ?? []).filter((r) => RED_CONCLUSIONS.has(r.conclusion));
  const derivedReds = reds.filter(isDerivedRed);
  const scopedReds = reds.filter(isPrScopedRed);

  const row = {
    pr: pr.number,
    title: String(pr.title ?? '').slice(0, 60),
    derivedReds: derivedReds.map((r) => r.name),
    scopedReds: scopedReds.map((r) => r.name),
    actions: [], // {kind:'suite'|'run', id, run, decision, why}
    decision: '',
  };

  if (derivedReds.length === 0) {
    row.decision = 'NOT-PARKED (no main-side derived red)';
    return row;
  }
  if (scopedReds.length > 0) {
    row.decision = `NOT-PARKED (PR-scoped red: ${scopedReds.map((r) => r.name).join(', ')})`;
    return row;
  }
  row.decision = 'PARKED';

  // Re-request stale suites once per regen commit: a run that already started
  // AFTER the regen commit re-ran against the regenerated base — leave it.
  const seenSuites = new Set();
  for (const r of derivedReds) {
    const startedAt = Date.parse(r.started_at);
    if (Number.isFinite(startedAt) && startedAt > regenTime.getTime()) {
      row.actions.push({
        kind: 'suite',
        id: r.check_suite?.id,
        run: r.name,
        decision: 'SKIP-FRESH',
        why: `run started ${r.started_at}, after regen commit — already fresh`,
      });
      continue;
    }
    if (r.check_suite?.id != null && seenSuites.has(r.check_suite.id)) {
      continue; // several failing runs can share one suite; one POST covers all
    }
    if (r.check_suite?.id != null) seenSuites.add(r.check_suite.id);
    row.actions.push({
      kind: 'suite',
      id: r.check_suite?.id,
      run: r.name,
      decision: 'REREQUEST',
      why: `run started ${r.started_at}, before regen commit — stale`,
      checkRun: { id: r.id, details_url: r.details_url ?? null },
    });
  }
  return row;
}

/**
 * Classify every PR and enforce the per-run cap.
 * @returns {Array} decision rows, capped to MAX_PRS_PER_RUN actionable PRs
 */
export function planRecheck(prs, runsBySha, regenTime) {
  const rows = prs.map((pr) => classifyPr(pr, runsBySha[pr.head?.sha], regenTime));
  let actionable = 0;
  for (const row of rows) {
    const wants = row.actions.some((a) => a.decision === 'REREQUEST');
    if (!wants) continue;
    if (actionable >= MAX_PRS_PER_RUN) {
      for (const a of row.actions) {
        if (a.decision === 'REREQUEST') {
          a.decision = 'SKIP-CAP';
          a.why = `per-run cap of ${MAX_PRS_PER_RUN} PRs already reached`;
        }
      }
      row.decision += ' [capped out this run]';
    } else {
      actionable += 1;
    }
  }
  return rows;
}

// ── Output ───────────────────────────────────────────────────────────────────

function printTable(rows, { regenCommit, mode }) {
  console.log(`recheck-parked-prs: regen commit ${regenCommit} — mode: ${mode}`);
  console.log(
    'PR'.padEnd(7) +
      'DECISION'.padEnd(58) +
      'MAIN-SIDE DERIVED REDS'
  );
  for (const r of rows) {
    console.log(
      `#${String(r.pr).padEnd(6)}` +
        r.decision.padEnd(58) +
        (r.derivedReds.join(', ') || '-')
    );
  }
  let requests = 0,
    skips = 0;
  for (const r of rows) {
    for (const a of r.actions) {
      if (a.decision === 'REREQUEST') {
        requests += 1;
        console.log(`  -> #${r.pr} re-request suite ${a.id} (${a.run}): ${a.why}`);
      } else if (a.decision === 'SKIP-FRESH') {
        skips += 1;
        console.log(`  -> #${r.pr} skip ${a.run}: ${a.why}`);
      } else if (a.decision === 'SKIP-CAP') {
        console.log(`  -> #${r.pr} skip ${a.run}: ${a.why}`);
      }
    }
  }
  console.log(`recheck-parked-prs: ${requests} suite re-request(s), ${skips} skipped as fresh, cap ${MAX_PRS_PER_RUN} PRs/run`);
}

// ── Live path ────────────────────────────────────────────────────────────────

async function live({ dryRun, regenShaArg }) {
  const slug = repoSlug();
  const regen = regenShaArg
    ? ghJson(`repos/${slug}/commits/${regenShaArg}`)
    : findRegenCommit(slug);
  const regenTime = new Date(regen.commit.committer.date);
  const regenCommit = regen.sha;

  const prs = ghJson(
    `repos/${slug}/pulls?state=open&per_page=100&sort=created&direction=asc`
  );

  const runsBySha = {};
  for (const pr of prs) {
    const data = ghJson(
      `repos/${slug}/commits/${pr.head.sha}/check-runs?per_page=100`
    );
    runsBySha[pr.head.sha] = data.check_runs ?? [];
  }

  const rows = planRecheck(prs, runsBySha, regenTime);
  printTable(rows, {
    regenCommit,
    mode: dryRun ? 'DRY-RUN (no re-requests issued)' : 'LIVE',
  });

  if (dryRun) {
    console.log('recheck-parked-prs: dry-run — no re-request issued.');
    return 0;
  }

  // The ONLY writes this script can attempt: re-request existing checks.
  let denied = false;
  let issued = 0;
  for (const r of rows) {
    for (const a of r.actions) {
      if (a.decision !== 'REREQUEST') continue;
      const suiteOut = ghApi([
        `repos/${slug}/check-suites/${a.id}/rerequest`,
        '-X',
        'POST',
        '--silent',
      ]);
      if (suiteOut.ok) {
        issued += 1;
        console.log(`  OK #${r.pr} suite ${a.id} re-requested via checks API (${a.run}).`);
        continue;
      }
      if (suiteOut.status === 404) {
        // MEASURED (2026-09-27, suites of #2077/#2058): the suite exists and
        // is "rerequestable" but reports runs_rerequestable:false, so the
        // checks-API rerequest 404s. Row-sanctioned fallback: re-run the
        // failed jobs of the Actions workflow run that owns these check runs.
        const runId = actionsRunIdFromCheckRun(a.checkRun);
        if (!runId) {
          console.log(
            `  !! #${r.pr} suite ${a.id} checks-API rerequest 404 and check run ` +
              `${a.run} has no Actions run id (details_url missing) — cannot re-request.`
          );
          continue;
        }
        const actionsOut = ghApi([
          `repos/${slug}/actions/runs/${runId}/rerun-failed-jobs`,
          '-X',
          'POST',
          '--silent',
        ]);
        if (actionsOut.ok) {
          issued += 1;
          console.log(
            `  OK #${r.pr} failed jobs of Actions run ${runId} re-run via actions API (${a.run}).`
          );
          continue;
        }
        if (actionsOut.status === 403) {
          denied = true;
          console.log(
            `  !! #${r.pr} actions run ${runId} rerun-failed-jobs REFUSED (403) — ` +
              `the token lacks actions:write.`
          );
        } else {
          console.log(
            `  !! #${r.pr} actions run ${runId} rerun-failed-jobs failed ` +
              `(HTTP ${actionsOut.status}): ${actionsOut.body.trim()}`
          );
        }
        continue;
      }
      if (suiteOut.status === 403) {
        denied = true;
        console.log(
          `  !! #${r.pr} suite ${a.id} rerequest REFUSED (403) — the token lacks checks:write.`
        );
      } else {
        console.log(
          `  !! #${r.pr} suite ${a.id} rerequest failed (HTTP ${suiteOut.status}): ` +
            `${suiteOut.body.trim()}`
        );
      }
    }
  }
  if (denied) {
    console.log(
      'recheck-parked-prs: at least one re-request was refused for lack of permission. ' +
        'Per PARKED-PR-RECHECK-FLOW-1 this is a visibility-only outcome: the decision ' +
        'table above is the deliverable; exiting 0.'
    );
  }
  console.log(`recheck-parked-prs: ${issued} re-request(s) issued.`);
  return 0;
}

// ── Self-test (fixtures only, zero API calls) ────────────────────────────────

/**
 * Fixtures are the MEASURED shapes from 2026-09-27 (gh api check-runs for
 * #2077 @ d5881f4 and #2058 @ 7e2992c), trimmed to the fields the classifier
 * reads. regen commit 80628854 committed 2026-09-27T12:00:49Z; the PR reds
 * started 11:25-11:31Z, i.e. stale against it.
 */
function selfTest() {
  const REGEN = new Date('2026-09-27T12:00:49Z');
  const pre = (t) => `2026-09-27T${t}Z`;

  const suite = (id) => ({ id });

  // Fixture A — the measured shape of #2077 (art-77 dates): 3 derived-class
  // reds across 2 suites, all PR-scoped gates green.
  const pr2077 = {
    number: 2077,
    title: 'art-77 dates',
    head: { sha: 'd5881f4041123d571866159b1e5fb714c3ed57b3' },
  };
  const runs2077 = [
    { name: 'Full preflight gate suite', conclusion: 'failure', started_at: pre('11:25:07'), check_suite: suite(98180499541), details_url: 'https://github.com/PostOakLabs/ainumbers/actions/runs/36255526493/job/101844339811' },
    { name: 'scripts-verify / required', conclusion: 'failure', started_at: pre('11:27:01'), check_suite: suite(98180499541), details_url: 'https://github.com/PostOakLabs/ainumbers/actions/runs/36255526493/job/101844340133' },
    { name: 'land-verify / required', conclusion: 'failure', started_at: pre('11:25:32'), check_suite: suite(98180499536), details_url: 'https://github.com/PostOakLabs/ainumbers/actions/runs/36255526496/job/101844339731' },
    { name: 'html-verify / required', conclusion: 'success', started_at: pre('16:28:36').replace('2026-09-27', '2026-09-26'), check_suite: suite(98180499581) },
    { name: 'CSP + copy-hallmarks + dead-link + chrome gates', conclusion: 'success', started_at: '2026-09-26T16:28:02Z', check_suite: suite(98180499581) },
    { name: 'jsdoc-checkjs / required', conclusion: 'success', started_at: '2026-09-26T16:28:29Z', check_suite: suite(98180499587) },
  ];

  // Fixture B — the measured shape of #2058 (art-81 evidence): the same three
  // derived reds PLUS two failures OUTSIDE both classes (§18 SSOT, 19
  // measured-green) — those are neither derived-class nor PR-scoped and must
  // not flip the decision.
  const pr2058 = {
    number: 2058,
    title: 'art-81 evidence',
    head: { sha: '7e2992c7995bf7573f12c01a55f5cab1b71c61c9' },
  };
  const runs2058 = [
    { name: 'Full preflight gate suite', conclusion: 'failure', started_at: pre('11:25:12'), check_suite: suite(98230515868), details_url: 'https://github.com/PostOakLabs/ainumbers/actions/runs/36274881965/job/101850188234' },
    { name: 'scripts-verify / required', conclusion: 'failure', started_at: pre('11:31:19'), check_suite: suite(98230515868), details_url: 'https://github.com/PostOakLabs/ainumbers/actions/runs/36274881965/job/101850188592' },
    { name: 'land-verify / required', conclusion: 'failure', started_at: pre('11:25:40'), check_suite: suite(98230515942), details_url: 'https://github.com/PostOakLabs/ainumbers/actions/runs/36274881992/job/101850188172' },
    { name: '§18 proof coverage + SSOT gates', conclusion: 'failure', started_at: pre('11:25:11'), check_suite: suite(98230515942) },
    { name: '19 measured-green gates + surface-parity report', conclusion: 'failure', started_at: pre('11:25:10'), check_suite: suite(98230515871) },
    { name: 'CSP + copy-hallmarks + dead-link + chrome gates', conclusion: 'success', started_at: '2026-09-26T22:01:42Z', check_suite: suite(98230515858) },
    { name: 'jsdoc-checkjs / required', conclusion: 'success', started_at: '2026-09-26T22:02:05Z', check_suite: suite(98230515971) },
  ];

  // Fixture C — a PR with a JS-syntax red: never parked, no matter what.
  const prJsRed = {
    number: 9001,
    title: 'broken syntax',
    head: { sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  };
  const runsJsRed = [
    { name: 'Full preflight gate suite', conclusion: 'failure', started_at: pre('11:25:07'), check_suite: suite(1) },
    { name: 'CSP + copy-hallmarks + dead-link + chrome gates', conclusion: 'failure', started_at: pre('11:25:08'), check_suite: suite(2) },
  ];

  // Fixture D — derived reds that ALREADY re-ran after the regen commit:
  // parked, but every action is SKIP-FRESH (idempotence).
  const prFresh = {
    number: 9002,
    title: 'already re-requested',
    head: { sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
  };
  const runsFresh = [
    { name: 'land-verify / required', conclusion: 'failure', started_at: pre('12:05:00'), check_suite: suite(3) },
    { name: 'jsdoc-checkjs / required', conclusion: 'success', started_at: pre('12:04:00'), check_suite: suite(3) },
  ];

  // Fixture E — healthy PR: nothing to do.
  const prClean = {
    number: 9003,
    title: 'clean',
    head: { sha: 'cccccccccccccccccccccccccccccccccccccccc' },
  };
  const runsClean = [
    { name: 'Full preflight gate suite', conclusion: 'success', started_at: pre('11:25:07'), check_suite: suite(4) },
    { name: 'CSP + copy-hallmarks + dead-link + chrome gates', conclusion: 'success', started_at: pre('11:25:08'), check_suite: suite(4) },
  ];

  const prs = [pr2077, pr2058, prJsRed, prFresh, prClean];
  const runsBySha = {
    [pr2077.head.sha]: runs2077,
    [pr2058.head.sha]: runs2058,
    [prJsRed.head.sha]: runsJsRed,
    [prFresh.head.sha]: runsFresh,
    [prClean.head.sha]: runsClean,
  };

  const rows = planRecheck(prs, runsBySha, REGEN);
  const by = Object.fromEntries(rows.map((r) => [r.pr, r]));

  // The two current PRs classify as PARKED with stale-run re-requests.
  assert.equal(by[2077].decision.startsWith('PARKED'), true, '#2077 must be parked');
  assert.equal(by[2058].decision.startsWith('PARKED'), true, '#2058 must be parked');
  assert.deepEqual(
    by[2077].actions.filter((a) => a.decision === 'REREQUEST').map((a) => a.id),
    [98180499541, 98180499536], // two suites, deduped from three failing runs
    '#2077 re-request set'
  );
  assert.deepEqual(
    by[2058].actions.filter((a) => a.decision === 'REREQUEST').map((a) => a.id),
    [98230515868, 98230515942],
    '#2058 re-request set — the §18 and 19-measured-green reds are out-of-class, their suites stay untouched'
  );

  // A PR with a JS-syntax red does NOT classify as parked.
  assert.match(by[9001].decision, /NOT-PARKED \(PR-scoped red/);
  assert.equal(
    by[9001].actions.filter((a) => a.decision === 'REREQUEST').length,
    0,
    'JS-syntax red PR must get zero re-requests'
  );

  // Actions-run mapping for the measured rerun-failed-jobs fallback: the
  // #2077 fixture's two stale suites map to its two failing workflow runs,
  // and a non-Actions check run maps to null.
  assert.deepEqual(
    by[2077].actions
      .filter((a) => a.decision === 'REREQUEST')
      .map((a) => actionsRunIdFromCheckRun(a.checkRun)),
    ['36255526493', '36255526496']
  );
  assert.equal(actionsRunIdFromCheckRun({ name: 'non-actions check' }), null);

  // Idempotence: post-regen re-runs are SKIP-FRESH.
  assert.match(by[9002].decision, /^PARKED/);
  assert.equal(
    by[9002].actions.filter((a) => a.decision === 'SKIP-FRESH').length,
    1
  );
  assert.equal(
    by[9002].actions.filter((a) => a.decision === 'REREQUEST').length,
    0
  );

  // Healthy PR: no actions at all.
  assert.match(by[9003].decision, /NOT-PARKED \(no main-side derived red\)/);

  // Cap: 6 parked PRs -> only MAX_PRS_PER_RUN keep REREQUEST decisions.
  const manyPrs = [];
  const manyRuns = {};
  for (let i = 0; i < 6; i += 1) {
    const pr = {
      number: 7000 + i,
      title: `parked ${i}`,
      head: { sha: `sha${i}${'0'.repeat(29)}`.slice(0, 40) },
    };
    manyPrs.push(pr);
    manyRuns[pr.head.sha] = [
      { name: 'land-verify / required', conclusion: 'failure', started_at: pre('11:00:00'), check_suite: suite(100 + i) },
    ];
  }
  const capped = planRecheck(manyPrs, manyRuns, REGEN);
  const stillWants = capped.filter((r) =>
    r.actions.some((a) => a.decision === 'REREQUEST')
  );
  assert.equal(stillWants.length, MAX_PRS_PER_RUN, 'cap enforces 5 PRs/run');
  assert.ok(
    capped.some((r) => r.actions.some((a) => a.decision === 'SKIP-CAP')),
    'overflow PR is SKIP-CAP, not dropped silently'
  );

  console.log(
    `self-test: 14 assertions passed — #2077/#2058 fixtures classify PARKED ` +
      `with deduped stale-suite re-requests mapping to their Actions runs; ` +
      `JS-syntax red and clean PRs do not; post-regen re-runs SKIP-FRESH; per-run cap 5 enforced.`
  );
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  selfTest();
} else if (args.includes('--help') || args.includes('-h')) {
  console.log(
    'usage: node scripts/recheck-parked-prs.mjs [--dry-run] [--regen-sha <sha>] | --self-test'
  );
} else {
  const dryRun = args.includes('--dry-run');
  const regenIdx = args.indexOf('--regen-sha');
  const regenShaArg = regenIdx >= 0 ? args[regenIdx + 1] : process.env.RECHECK_REGEN_SHA;
  try {
    process.exitCode = await live({ dryRun, regenShaArg });
  } catch (err) {
    // Read failures are the only hard failure; the workflow step wraps this
    // in continue-on-error: true regardless.
    console.error(`recheck-parked-prs: FAILED — ${err.message}`);
    process.exitCode = 1;
  }
}
