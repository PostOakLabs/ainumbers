#!/usr/bin/env node
// scheduled-red-issue.mjs — NIGHTLY-RED-ISSUE-OPENER-1
//
// A scheduled surface that goes red and opens nothing is a gate nobody reads.
//
// Three surfaces in this repo report and never block: the mutation nightly
// (mutation-full-scheduled.yml), the weekly full suite (fullsuite-schedule.yml),
// and the report-only pre-push attestation check (prepush-attestation.yml).
// Each one's red is a run status on the Actions tab and nothing else. Nobody
// watches the Actions tab, so a floor breach discovered at 09:42 UTC is a
// finding only if a human happens to look. This script turns those reds into
// exactly one tracking issue per surface.
//
// ⛔ THIS DOES NOT MAKE ANY NIGHTLY BLOCKING. It changes only what happens when
// a surface reds, never what the surface runs. (If blocking is the real fix,
// that is a separate decision with its own cost — report it, do not do it here.)
//
// ── THE IDEMPOTENT PATTERN, COPIED NOT REINVENTED ────────────────────────────
// helm-guide-freshness-schedule.yml already solved "recurring finding, one
// issue": resolve an OPEN issue by exact title, comment on it if it exists,
// create it only if it does not. Same gh CLI, same title-match resolution, no
// labels (a label that does not exist makes `gh issue create` fail), no new
// third-party Action. What this adds over that inline shell block is (a) the
// close-on-green half, which the helm workflow has no need for, (b) a surface
// registry so three callers cannot each invent their own title, and (c) a
// simulated backend so every control can be proven WITHOUT manufacturing a red
// on the shared repo.
//
// ⚠ A BOT THAT OPENS 30 ISSUES A MONTH TRAINS EVERYONE TO FILTER IT, which is
// the exact failure this exists to prevent. One open issue per surface, updated
// by comment on each subsequent red, closed when the surface goes green.
//
// ── LEDGER-ECHO ──────────────────────────────────────────────────────────────
// Every create/update/close also emits a one-line ledger pointer (issue number,
// surface, run id) on stdout as `LEDGER-ECHO: …`, into $GITHUB_STEP_SUMMARY,
// and into the issue text itself. With `--ledger <path>` it is APPENDED to a
// findings ledger file. That flag is a LOCAL-SIDE flag by necessity: the ledger
// lives at the workspace root (research/FINDINGS-HELD-<month>.md), outside this
// repo and outside any CI checkout, and this workflow's token is scoped
// `contents: read` + `issues: write` — a runner cannot write it. `--harvest`
// closes that gap from the local side: it reads the open surface issues and
// appends any ledger line missing from the file, so a nightly red that fired
// with no session running still lands in the ledger at the next sweep.
//
// ── SCOPED: SCHEDULED SURFACES ONLY ──────────────────────────────────────────
// `--event` is asserted against an allowlist (schedule, workflow_dispatch, and
// push — the attestation surface is push:main by construction). A pull_request
// or merge_group event is REFUSED, so an ordinary PR/CI red can never open an
// issue here even if some future caller wires it wrong.
//
// USAGE
//   node scripts/scheduled-red-issue.mjs --surface <key> --state red|green \
//        --run-id <n> --run-url <url> [--failure-line "<first line>"] \
//        [--event <name>] [--repo owner/name] [--ledger <path>] \
//        [--store <json>]   # simulated backend, no network, for proofs/tests
//   node scripts/scheduled-red-issue.mjs --harvest --ledger <path> [--repo …]
//   node scripts/scheduled-red-issue.mjs --surfaces      — print the registry
//   node scripts/scheduled-red-issue.mjs --extract-failure-line < failed-job.log
//        print the first gate failure line of a failed-job log (the deadman's
//        failure-line step pipes `gh run view --job … --log-failed` here)
//   … --status-context derived-regen/main --status-sha <sha> [--status-target <url>]
//        after applying the report, also post a commit status on that SHA:
//        failure + the tracking issue as target on red, success + the caller's
//        target on green (REGEN-RED-STOPS-THE-LINE-1; advisory, never a check)
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// ── Surface registry — the single writer of every issue title ────────────────
// A caller passes a KEY. Titles are never hand-written at a call site, so three
// workflows cannot drift into three title shapes and therefore three issues per
// surface. An unknown key is a hard error: absence is a distinct state, never a
// silent green.
export const SURFACES = new Map([
  ['mutation-nightly', {
    name: 'Mutation Tier Scan (scheduled)',
    workflow: '.github/workflows/mutation-full-scheduled.yml',
    // Dispatch condition: the first real issue body quotes the dark-floor
    // backlog instead of fanning out into per-floor issues.
    context:
      'WHY THIS SURFACE MATTERS MORE THAN ITS CADENCE SUGGESTS. The blocking PR gate\n' +
      'examines only TOUCHED kernels: with nothing touched, scripts/preflight.mjs builds a\n' +
      'zero-touched no-op and kernel-preflight skips, printing "0 touched, skipped" and\n' +
      'exiting 0. Almost no floor\'s score has ever been computed outside the pilot-10 sample\n' +
      'and these nightly shards, and the 80 label-decorated and 41 fixture-less floors sit\n' +
      'UNMEASURED until something touches them. This nightly is the only surface most floors\'\n' +
      'scores ever reach, and it never blocks anything. That is why its red gets an issue.\n' +
      '\n' +
      'A shard that FAILED and a shard that DID NOT COMPLETE are different findings: a failed\n' +
      'shard measured a kernel below its break floor; a shard with no verdict line was killed\n' +
      'by the runner ceiling and its kernels were not measured this cycle at all.',
  }],
  ['fullsuite-weekly', {
    name: 'Full Suite (scheduled)',
    workflow: '.github/workflows/fullsuite-schedule.yml',
    context:
      'This weekly run is the only re-check of the estate that is independent of any diff:\n' +
      'every other workflow here is path-filtered, so a regression that shows up because of\n' +
      'TIME (a staleness window crossed, upstream drift, live /mcp state diverging from\n' +
      'committed data) is never re-checked unless an unrelated diff happens to touch the same\n' +
      'files. Its four checks are each continue-on-error, so one red does not hide the others:\n' +
      'read the run summary table for which of the four failed.',
  }],
  ['prepush-attestation', {
    name: 'Pre-push Attestation Check',
    workflow: '.github/workflows/prepush-attestation.yml',
    context:
      'A red here means a commit reached main touching a protected path with no attestation\n' +
      'and no accepted resolution route, i.e. one of: a direct push that skipped the local\n' +
      'gate suite entirely, the single-writer app escaping its declared derived-surface\n' +
      'fence, a merge that landed past a red or absent required check, or a resolution\n' +
      'failure (INDETERMINATE). Every one of those deserves the red it gets. A DECLARED\n' +
      'bypass is not a red, so this issue never fires on one.',
  }],
  // REGEN-FAIL-DEADMAN-1 (2026-10-15). Not a scheduled surface — a workflow_run
  // listener (.github/workflows/derived-regen-deadman.yml) on the main-side
  // Derived Artifacts Regen. It is here because the failure shape is identical
  // to the three above: a red with no issue is a red nobody reads, and the
  // measured cost was worse than most — the regen is the only writer that
  // registers new node shards, so a red main silently dequeues EVERY
  // meta-touching merge-group entry and CI_FAILURE dequeues are never re-armed
  // (automerge-label.yml re-queues CI_TIMEOUT only). Measured 2026-10-12/13:
  // art-708 unregistered ~6.5 h, art-709 ~16 h, only because nobody watched the
  // Actions tab.
  ['derived-regen', {
    name: 'Derived Artifacts Regen (main)',
    workflow: '.github/workflows/derived-regen-deadman.yml',
    context:
      'WHY A RED HERE IS LOUDER THAN ITS RUN COUNT SUGGESTS. The regen is the only writer\n' +
      'that registers new node shards (order.nodes) and auto-lands additive chains. While it\n' +
      'is red on main, every meta-touching pull request in the merge queue is silently\n' +
      'dequeued by the simulated-merge check, and CI_FAILURE dequeues are NEVER re-armed\n' +
      '(automerge-label.yml re-queues CI_TIMEOUT only) — each one needs a manual re-arm after\n' +
      'a healing regen lands. Measured: 2026-10-12 art-708 (em-dash, §1.4 copy gate) unregistered\n' +
      '~6.5 h; 2026-10-13 art-709 unregistered ~16 h; PR #2386 sat disarmed ~21 h.\n' +
      '\n' +
      'WHAT TO DO: read the first failure line — a copy gate red names the offending file and\n' +
      'the cure is a heal PR that fixes the copy at its source, then let (or trigger) the next\n' +
      'regen land it. The listener already retried once (10 min backoff) before this issue\n' +
      'opened: the failure class is deterministic (a gate red, not a flake), so a second red\n' +
      'means a human heal is required, not another retry. This issue does NOT auto-re-arm any\n' +
      'dequeued PR — the CI_FAILURE never-requeue policy is deliberate; re-arm by hand from\n' +
      'the run URL below once main is green.',
  }],
]);

// Only scheduled/report surfaces may open an issue. pull_request and
// merge_group are refused by construction — an ordinary PR/CI red is out of
// scope for this mechanism and must stay that way.
//
// `workflow_run` joined for REGEN-FAIL-DEADMAN-1: it is the event shape of a
// LISTENER run, never a PR/CI run — the derived-regen listener fires only on
// `Derived Artifacts Regen` conclusion changes for head_branch main, and that
// scoping (workflow name + branch) is enforced in the listener workflow's own
// `if:` before this script is ever reached. A pull_request or merge_group
// event is still refused here.
export const ALLOWED_EVENTS = new Set(['schedule', 'workflow_dispatch', 'push', 'workflow_run']);

// ── Failure-line extraction (REGEN-RED-STOPS-THE-LINE-1) ─────────────────────
// The deadman's failure-line step used to grep the failed job log for the
// first line naming a gate (`grep -m1 -E 'copy-hallmarks|…'`). On the
// 2026-10-23 incident (run 39936907518, issue #2557) that captured the
// `##[group]Run node scripts/check-copy-hallmarks.mjs` HEADER, not the gate's
// failure line: the word "copy-hallmarks" appears in the run header before
// the gate ever prints, and -m1 stopped right there. The extractor below is
// the fix, exported so scheduled-red-issue.test.mjs proves both behaviours —
// the RED control quotes the old grep's pick, the GREEN asserts this one's.

/** Returned when a log carries no gate failure line at all. */
export const NO_GATE_LINE_FOUND = '(no gate failure line found in the failed job log — open the run URL)';

// One gh log line, in both shapes: raw API logs start with the timestamp
// (`2026-…Z content`); `gh run view --job --log` prefixes `job\tstep\t`
// before it. Whatever sits before the timestamp is prefix and is dropped.
const TS_SEGMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z /;
// The runner's own noise: the run header/footer groups, the shell/env banner,
// and the echoed command lines. gh renders the echo's ESC byte as the literal
// two characters ^[, so both spellings are skipped.
const NOISE_RE = /##\[group\]|##\[endgroup\]|^shell:|^env:|\x1b\[36;1m|\^\[\[36;1m/;
// A gate failure summary: the markers this repo's gates print when they red
// (copy-hallmarks "N FAILURE(s)", shipped-prose "✗ … FAILED", the assembler's
// REFUSED, GitHub's ##[error], a plain Error:).
const SUMMARY_RE = /✗|FAILURE\(s\)|FAILED\b|REFUSED|##\[error\]|::error|Error:/;
// Advisory sections (copy-hallmarks): findings listed after this marker are
// NOT failures and must never be picked over a real one.
const ADVISORY_RE = /\bADVISORY\b/;

/** Strip gh's job/step/timestamp prefix (and any BOM/CR) from one log line. */
export function cleanLogLine(raw) {
  const segs = String(raw).replace(/^\uFEFF/, '').replace(/\r$/, '').split('\t');
  for (let k = 0; k < segs.length; k++) {
    const m = segs[k].match(TS_SEGMENT);
    if (m) return [segs[k].slice(m[0].length), ...segs.slice(k + 1)].join('\t');
  }
  return segs.join('\t');
}

/** Strip ANSI colour sequences from a log line's text. */
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

/**
 * The first gate failure line of a failed-job log, or NO_GATE_LINE_FOUND.
 * Two tiers, first match wins:
 *   1. the actionable FINDING line — the indented detail under a failure
 *      summary that names the offending file/node and the violation
 *      (`chaingraph/chaingraph.json#descriptions: 2 em-dash(es) …`, a
 *      shipped-prose `• node …` hit, an assembler refusal). An ADVISORY
 *      marker ends a failure block, so an advisory finding never wins.
 *   2. the failure summary itself (`✗ …`, `N FAILURE(s) …`, `REFUSED …`,
 *      `##[error]…` with text) when a gate reds without detail lines.
 * Runner noise — ##[group] headers, the shell:/env: banner, the echoed
 * command lines — is skipped before either tier is considered.
 */
export function extractFailureLine(logText) {
  let inFailureBlock = false;
  let firstSummary = null;
  for (const raw of String(logText).split('\n')) {
    const content = cleanLogLine(raw);
    if (!content.trim() || NOISE_RE.test(content)) continue;
    if (ADVISORY_RE.test(content)) {
      inFailureBlock = false;
      continue;
    }
    if (SUMMARY_RE.test(content)) {
      if (firstSummary === null) firstSummary = content.trim();
      inFailureBlock = true;
      continue;
    }
    if (inFailureBlock) return stripAnsi(content).trim();
  }
  return firstSummary === null ? NO_GATE_LINE_FOUND : stripAnsi(firstSummary).trim();
}

// ── Commit-status helper (REGEN-RED-STOPS-THE-LINE-1) ─────────────────────────
// An issue nobody looks at while merging is half an alarm. The deadman also
// marks the failing (or healed) main SHA with a commit status
// `derived-regen/main`, so the red is visible on the commit itself — where
// the repo's history and every PR's "main regen red since <sha>" advisory
// probe (land-verify.yml) already look. A commit STATUS is not a check run
// and can never be made required: this stays advisory by construction.

/** GitHub caps a commit-status description at 140 characters. */
export const STATUS_DESCRIPTION_MAX = 140;

/** The POST /repos/{repo}/statuses/{sha} body, description truncated to fit. */
export function statusPayload({ state, context, description, targetUrl }) {
  if (state !== 'success' && state !== 'failure') {
    throw new Error(`commit status state must be success|failure, got '${state}'`);
  }
  if (!context) throw new Error('commit status requires a context');
  return {
    state,
    context,
    description: String(description || '').slice(0, STATUS_DESCRIPTION_MAX),
    ...(targetUrl ? { target_url: targetUrl } : {}),
  };
}

/** Issue title for a surface key. One writer, so callers cannot drift. */
export function titleFor(key) {
  const s = SURFACES.get(key);
  if (!s) throw new Error(`unknown surface '${key}' — known: ${[...SURFACES.keys()].join(', ')}`);
  return `Scheduled surface RED: ${s.name}`;
}

/** The one-line ledger pointer. Issue number + surface + run id, per LEDGER-ECHO. */
export function ledgerLine({ key, issue, action, runId, runUrl, date }) {
  const d = date || new Date().toISOString().slice(0, 10);
  return `- ${d} · NIGHTLY-RED · ${key} · issue #${issue} (${action}) · run ${runId} · ${runUrl}`;
}

function redBody({ key, runId, runUrl, failureLine }) {
  const s = SURFACES.get(key);
  return [
    `**Surface:** ${s.name} (\`${s.workflow}\`, surface key \`${key}\`)`,
    `**Run:** ${runId} — ${runUrl}`,
    `**First failure line:** ${failureLine}`,
    '',
    'This surface is REPORT-ONLY and stays that way: it blocks no merge and no deploy, and',
    'this issue does not change that. It exists because a scheduled surface that goes red and',
    'opens nothing is a gate nobody reads.',
    '',
    s.context,
    '',
    '**Lifecycle.** One open issue per surface. Each further red adds a comment here rather',
    'than opening a second issue. When the surface next runs green this issue is closed',
    'automatically with the green run linked.',
    '',
    `LEDGER-ECHO: ${ledgerLine({ key, issue: '<this issue>', action: 'opened', runId, runUrl })}`,
  ].join('\n');
}

function stillRedComment({ key, runId, runUrl, failureLine, issue }) {
  return [
    `Still red as of run ${runId} — ${runUrl}`,
    '',
    `**First failure line:** ${failureLine}`,
    '',
    `LEDGER-ECHO: ${ledgerLine({ key, issue, action: 'updated', runId, runUrl })}`,
  ].join('\n');
}

function greenComment({ key, runId, runUrl, issue }) {
  return [
    `Green again as of run ${runId} — ${runUrl}. Closing.`,
    '',
    `LEDGER-ECHO: ${ledgerLine({ key, issue, action: 'closed-on-green', runId, runUrl })}`,
  ].join('\n');
}

// ── Backends ────────────────────────────────────────────────────────────────
// Two implementations of one interface (issue lifecycle + commit status). `gh`
// is the real one and ships preinstalled on ubuntu-latest runners (no new
// third-party Action). The simulated one is a JSON file and touches no network
// — it is what makes every control below provable locally instead of by
// manufacturing a red on the shared repo.

/** Real backend: the gh CLI, already present on the runner. */
export function ghBackend(repo) {
  const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  // `gh api --input -` reads the request body from stdin.
  const ghStdin = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input });
  return {
    findOpen(title) {
      // `--search in:title` is a FUZZY search, so an exact-title filter is
      // applied on the result. Without it a near-miss title would resolve as a
      // hit and the update would land on the wrong issue.
      const raw = gh(['issue', 'list', '--repo', repo, '--state', 'open',
        '--search', `in:title "${title}"`, '--limit', '50', '--json', 'number,title']);
      const hits = JSON.parse(raw || '[]').filter((i) => i.title === title);
      return hits.length ? hits[0].number : null;
    },
    create(title, body) {
      const url = gh(['issue', 'create', '--repo', repo, '--title', title, '--body', body]).trim();
      const m = url.match(/\/(\d+)\s*$/);
      if (!m) throw new Error(`could not read the new issue number from gh output: ${url}`);
      return Number(m[1]);
    },
    comment(number, body) {
      gh(['issue', 'comment', String(number), '--repo', repo, '--body', body]);
    },
    close(number, body) {
      gh(['issue', 'close', String(number), '--repo', repo, '--comment', body]);
    },
    listOpenAll() {
      const raw = gh(['issue', 'list', '--repo', repo, '--state', 'open', '--limit', '100',
        '--json', 'number,title,body']);
      return JSON.parse(raw || '[]');
    },
    // REGEN-RED-STOPS-THE-LINE-1: the deadman's advisory `derived-regen/main`
    // status. Same gh CLI, no new third-party Action, no token beyond the
    // workflow's own `statuses: write`.
    postStatus(sha, payload) {
      ghStdin(['api', '--method', 'POST', `repos/${repo}/statuses/${sha}`, '--input', '-'],
        JSON.stringify(payload));
    },
  };
}

/**
 * Simulated backend over a JSON file:
 * `{ next: <n>, issues: [{number,title,state,body,comments:[]}], statuses: [{sha,…payload}] }`.
 * Same methods, no network. Used by scheduled-red-issue.test.mjs and by
 * this row's own local proof run.
 */
export function fileBackend(path) {
  const load = () => (existsSync(path)
    ? JSON.parse(readFileSync(path, 'utf8'))
    : { next: 1000, issues: [] });
  const save = (db) => writeFileSync(path, `${JSON.stringify(db, null, 2)}\n`);
  return {
    findOpen(title) {
      const db = load();
      const hit = db.issues.find((i) => i.title === title && i.state === 'open');
      return hit ? hit.number : null;
    },
    create(title, body) {
      const db = load();
      const number = db.next++;
      db.issues.push({ number, title, state: 'open', body, comments: [] });
      save(db);
      return number;
    },
    comment(number, body) {
      const db = load();
      db.issues.find((i) => i.number === number).comments.push(body);
      save(db);
    },
    close(number, body) {
      const db = load();
      const issue = db.issues.find((i) => i.number === number);
      issue.comments.push(body);
      issue.state = 'closed';
      save(db);
    },
    listOpenAll() {
      return load().issues.filter((i) => i.state === 'open');
    },
    postStatus(sha, payload) {
      const db = load();
      if (!db.statuses) db.statuses = [];
      db.statuses.push({ sha, ...payload });
      save(db);
    },
  };
}

// ── The lifecycle ───────────────────────────────────────────────────────────

/**
 * Apply one surface report. Returns `{ action, issue, ledger }`, where action is
 * one of: opened | updated | closed-on-green | noop-green.
 *
 * RED  + no open issue  -> opened      (one issue for this surface)
 * RED  + open issue     -> updated     (a COMMENT — never a second issue)
 * GREEN + open issue    -> closed-on-green
 * GREEN + no open issue -> noop-green  (quiet when green: nothing opened, nothing touched)
 */
export function applyReport(backend, { key, state, runId, runUrl, failureLine }) {
  const title = titleFor(key);
  const existing = backend.findOpen(title);

  if (state === 'green') {
    if (existing === null) return { action: 'noop-green', issue: null, ledger: null };
    backend.close(existing, greenComment({ key, runId, runUrl, issue: existing }));
    return {
      action: 'closed-on-green',
      issue: existing,
      ledger: ledgerLine({ key, issue: existing, action: 'closed-on-green', runId, runUrl }),
    };
  }

  if (existing !== null) {
    backend.comment(existing, stillRedComment({ key, runId, runUrl, failureLine, issue: existing }));
    return {
      action: 'updated',
      issue: existing,
      ledger: ledgerLine({ key, issue: existing, action: 'updated', runId, runUrl }),
    };
  }

  const number = backend.create(title, redBody({ key, runId, runUrl, failureLine }));
  return {
    action: 'opened',
    issue: number,
    ledger: ledgerLine({ key, issue: number, action: 'opened', runId, runUrl }),
  };
}

/** Append a ledger line, creating the findings file with a header if absent. */
export function appendLedger(path, line) {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `# Findings held — scheduled-surface reds\n\n`);
  }
  const current = readFileSync(path, 'utf8');
  if (current.includes(line)) return false;
  appendFileSync(path, `${line}\n`);
  return true;
}

/**
 * Local-side sweep: read every open surface issue and append any LEDGER-ECHO
 * line the ledger is missing. This is what makes a nightly red that fired with
 * no session running still reach the ledger — the runner itself cannot write a
 * file that lives outside the repo.
 */
export function harvest(backend, ledgerPath) {
  const titles = new Set([...SURFACES.keys()].map(titleFor));
  const appended = [];
  for (const issue of backend.listOpenAll()) {
    if (!titles.has(issue.title)) continue;
    const texts = [issue.body || '', ...(issue.comments || [])];
    for (const text of texts) {
      for (const line of text.split('\n')) {
        const m = line.match(/^LEDGER-ECHO:\s*(.+)$/);
        if (!m) continue;
        const pointer = m[1].replace('#<this issue>', `#${issue.number}`);
        if (appendLedger(ledgerPath, pointer)) appended.push(pointer);
      }
    }
  }
  return appended;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

function main() {
  if (process.argv.includes('--surfaces')) {
    for (const [k, s] of SURFACES) console.log(`${k}\t${titleFor(k)}\t${s.workflow}`);
    return;
  }

  // The deadman's failure-line step pipes the failed job's log here
  // (`gh run view --job … --log-failed | node … --extract-failure-line`) so the
  // extraction lives in ONE place, testable without manufacturing a red.
  if (process.argv.includes('--extract-failure-line')) {
    let log = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { log += c; });
    process.stdin.on('end', () => console.log(extractFailureLine(log)));
    return;
  }

  const store = arg('store');
  const repo = arg('repo', process.env.GITHUB_REPOSITORY);
  const ledger = arg('ledger');
  const backend = store ? fileBackend(store) : ghBackend(repo);

  if (process.argv.includes('--harvest')) {
    if (!ledger) throw new Error('--harvest requires --ledger <path>');
    const appended = harvest(backend, ledger);
    console.log(`harvest: ${appended.length} ledger line(s) appended to ${ledger}`);
    for (const l of appended) console.log(l);
    return;
  }

  const key = arg('surface');
  const state = arg('state');
  const event = arg('event', process.env.GITHUB_EVENT_NAME || 'schedule');
  const runId = arg('run-id', process.env.GITHUB_RUN_ID || 'unknown');
  const runUrl = arg('run-url', 'unknown');
  const failureLine = arg('failure-line', '(no failure line supplied by the caller)');

  if (!SURFACES.has(key)) throw new Error(`unknown surface '${key}' — known: ${[...SURFACES.keys()].join(', ')}`);
  if (state !== 'red' && state !== 'green') throw new Error(`--state must be red|green, got '${state}'`);
  if (!ALLOWED_EVENTS.has(event)) {
    // SCOPED. An ordinary PR/CI red is not a scheduled-surface finding and must
    // never open an issue here.
    throw new Error(`event '${event}' is out of scope — this mechanism is for scheduled/report surfaces only (${[...ALLOWED_EVENTS].join(', ')})`);
  }
  if (!store && !repo) throw new Error('--repo or GITHUB_REPOSITORY is required for the gh backend');

  const result = applyReport(backend, { key, state, runId, runUrl, failureLine });
  console.log(`${key}: ${state} -> ${result.action}${result.issue ? ` (issue #${result.issue})` : ''}`);

  // The deadman's advisory commit status (REGEN-RED-STOPS-THE-LINE-1). RED:
  // failure on the regen's head SHA, description = the extracted gate line,
  // target = the tracking issue that carries the cure steps. GREEN: success on
  // that SHA, target = the caller's --status-target (the green regen run). A
  // commit status is not a check run and can never be made required.
  const statusContext = arg('status-context');
  if (statusContext) {
    const statusSha = arg('status-sha');
    if (!statusSha) throw new Error('--status-context requires --status-sha <the main SHA the status marks>');
    const statusState = state === 'red' ? 'failure' : 'success';
    const targetUrl = statusState === 'failure' && result.issue
      ? `https://github.com/${repo}/issues/${result.issue}`
      : arg('status-target');
    const description = arg('status-description')
      || (statusState === 'failure'
        ? failureLine
        : `main derived regen green again (run ${runId})`);
    backend.postStatus(statusSha, statusPayload({ state: statusState, context: statusContext, description, targetUrl }));
    console.log(`status: ${statusContext} = ${statusState} on ${String(statusSha).slice(0, 12)}${targetUrl ? ` -> ${targetUrl}` : ''}`);
  }

  if (result.ledger) {
    console.log(`LEDGER-ECHO: ${result.ledger}`);
    if (ledger) appendLedger(ledger, result.ledger);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `## Scheduled-surface red tracking\n\n${result.action} issue #${result.issue}\n\n\`LEDGER-ECHO: ${result.ledger}\`\n`);
    }
  } else {
    console.log('quiet: surface is green and no tracking issue is open — nothing opened, nothing touched.');
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('scheduled-red-issue.mjs')) {
  main();
}
