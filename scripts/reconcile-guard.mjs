#!/usr/bin/env node
/**
 * scripts/reconcile-guard.mjs — RECONCILE-PUSH-QUARANTINE-1 (Tim directive, 2026-08-22).
 *
 * ── WHAT HAPPENED ───────────────────────────────────────────────────────────
 * `WORKTREE-RECONCILE-2` classified 74 local branches, called 16 of them
 * "UNIQUE, not checked out anywhere", and pushed all 16 to origin in ONE
 * `--no-verify` push. ORCH re-measured the same day: ALL 16 were SUPERSEDED,
 * and every one was deleted hours later.
 *
 * The classification instrument was the defect. `git cherry` compares PATCH-IDs
 * and is blind to both things that applied:
 *   - a SQUASH merge rewrites the patch-id, so a landed branch shows `+` forever
 *     (12 of the 16 had a MERGED PR);
 *   - the branches were 210-1,633 commits behind main, so nothing matched anyway.
 * `git cherry` answers "is this exact patch upstream?" when the question was
 * "does this work exist upstream?". On an ancient branch those diverge totally.
 *
 * ── THE MECHANISM SHIPPED HERE: (A) `wip/` QUARANTINE NAMESPACE ─────────────
 * A push that CREATES branch refs at origin in a reconcile-class shape must put
 * them under `refs/heads/wip/`. Bare branch names at origin root are refused.
 * Quarantine refs are cheap, visible (`git ls-remote origin 'refs/heads/wip/*'`)
 * and bulk-deletable, and nothing merges out of them without a human reading
 * the per-branch verdict first.
 *
 * Tim named two acceptable shapes; this ships ONE of them. Mechanism (B),
 * manifest-before-push with a human ack, was NOT shipped: it converts an
 * otherwise autonomous reconcile row into a blocking one, and it gates on a
 * human reading a manifest, which is exactly the step that is skipped at 2am.
 * (A) costs nothing when it is right and is enforced by a script, not by trust.
 *
 * ── WHAT COUNTS AS RECONCILE-CLASS (two rules, both cheap, both local) ──────
 * Only ref CREATIONS under `refs/heads/` are ever considered (remote OID is all
 * zeros). Updates to refs that already exist at origin, deletions, tags and
 * notes refs are never reconcile-class and are never touched.
 *
 *   R1 BULK-CREATE   one push creates 2 or more branch refs outside `wip/`.
 *                    This is the literal 2026-08-22 shape (16 in one push).
 *
 *   R2 NOT-HEAD      a branch ref is created at origin from a local ref whose
 *                    tip is NOT the working tree's HEAD, i.e. you are pushing
 *                    a branch you are not on. An ordinary build row always
 *                    pushes the branch it is standing on, so this costs a
 *                    normal push nothing; a reconcile row sweeping other
 *                    people's stale branches trips it every time, including
 *                    when it tries to evade R1 by pushing them one at a time.
 *
 * A commit-distance rule was considered and REJECTED on measurement: origin/main
 * takes ~31 commits/day (218 in the 7 days to 2026-08-22), so any "N commits
 * behind" threshold low enough to catch the offending branches (210 behind at
 * the nearest) would also catch a perfectly ordinary week-old feature branch.
 * A guardrail that taxes normal pushes gets bypassed within a day.
 *
 * ── THE RESIDUAL, STATED PLAINLY ────────────────────────────────────────────
 * `git push --no-verify` skips every client-side pre-push hook, including this
 * one. No client-side mechanism can close that; only a server-side push ruleset
 * can, and rulesets are Tim-only (SO #8 flag-and-wait). What IS closed is the
 * REASON the 2026-08-22 push reached for `--no-verify` in the first place: it
 * was bypassing preflight, which fails by construction on ancient branches
 * (SO #27). The paired change in `.githooks/pre-push` makes a push whose refs
 * are ALL under `wip/` skip preflight outright, so the sanctioned path is now
 * strictly cheaper than the bypass. Trading "no hook at all" for "hook runs,
 * quarantine enforced, preflight skipped" is a strict improvement.
 *
 * ── MODES ───────────────────────────────────────────────────────────────────
 *   node scripts/reconcile-guard.mjs --prepush
 *       Reads git's pre-push stdin (`<local ref> <local oid> <remote ref>
 *       <remote oid>` per line). Exit 0 = allowed, exit 1 = refused with a
 *       diagnosis. Prints `AINUM_QUARANTINE_ONLY=1` when every branch ref in
 *       the push is under `refs/heads/wip/` (the hook reads this to skip
 *       preflight). This is what `.githooks/pre-push` runs.
 *
 *   node scripts/reconcile-guard.mjs --check-refs "<line>" ["<line>" ...]
 *       Same evaluation, ref lines supplied on argv instead of stdin. Exists so
 *       a session can demonstrate the refusal without performing a real push.
 *
 *   node scripts/reconcile-guard.mjs --classify <branch> [<branch> ...]
 *       The supersession classifier a reconcile-class row MUST use instead of
 *       `git cherry`. Combines a merged-PR lookup (`gh pr list --head`) with a
 *       content-level check (does every file the branch's unique commits touch
 *       already exist on origin/main?) and reports `git cherry` as ADVISORY
 *       ONLY. Patch-id alone can never produce a UNIQUE verdict here.
 */
import { execFileSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const QUARANTINE_PREFIX = 'refs/heads/wip/';
export const BRANCH_PREFIX = 'refs/heads/';
/** One push may create at most this many branch refs outside the quarantine namespace. */
export const MAX_BARE_CREATES = 1;

const isZero = (oid) => /^0+$/.test(String(oid || ''));

/* ─────────────────────────── push evaluation ─────────────────────────── */

/**
 * Parse git's pre-push stdin format into ref records.
 * Blank lines and malformed lines are ignored (git never emits them, but a
 * hand-driven --check-refs invocation might).
 */
export function parseRefLines(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef, localOid, remoteRef, remoteOid] = line.split(/\s+/);
      if (!localRef || !localOid || !remoteRef || !remoteOid) return null;
      return { localRef, localOid, remoteRef, remoteOid, raw: line };
    })
    .filter(Boolean);
}

/**
 * Decide whether a push is allowed.
 *
 * @param {Array} refs      parsed ref records (see parseRefLines)
 * @param {object} opts
 * @param {string|null} opts.headOid  the working tree's HEAD OID, or null if
 *        it cannot be resolved (R2 is then skipped rather than guessed at).
 * @returns {{ok:boolean, violations:Array, creations:Array, quarantined:Array,
 *            branchRefs:Array, quarantineOnly:boolean}}
 */
export function evaluatePush(refs, { headOid = null } = {}) {
  const branchRefs = refs.filter((r) => r.remoteRef.startsWith(BRANCH_PREFIX) && !isZero(r.localOid));
  const creations = branchRefs.filter((r) => isZero(r.remoteOid));
  const quarantined = creations.filter((r) => r.remoteRef.startsWith(QUARANTINE_PREFIX));
  const bare = creations.filter((r) => !r.remoteRef.startsWith(QUARANTINE_PREFIX));

  const bulk = bare.length > MAX_BARE_CREATES;
  const violations = [];
  for (const ref of bare) {
    const reasons = [];
    if (bulk) {
      reasons.push(
        `R1 BULK-CREATE: this push creates ${bare.length} branch refs at origin outside ${QUARANTINE_PREFIX} (limit ${MAX_BARE_CREATES}).`,
      );
    }
    if (headOid && ref.localOid !== headOid) {
      reasons.push(
        `R2 NOT-HEAD: creating this ref from ${ref.localRef} (${ref.localOid.slice(0, 8)}), which is not the working tree HEAD (${headOid.slice(0, 8)}) — you are pushing a branch you are not on.`,
      );
    }
    if (reasons.length) violations.push({ ref, reasons });
  }

  return {
    ok: violations.length === 0,
    violations,
    creations,
    quarantined,
    branchRefs,
    quarantineOnly: branchRefs.length > 0 && branchRefs.every((r) => r.remoteRef.startsWith(QUARANTINE_PREFIX)),
  };
}

/** Human-readable refusal text for a failed evaluatePush result. */
export function renderRefusal(result) {
  const lines = [];
  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('⛔ reconcile-guard: PUSH REFUSED — reconcile-class ref creation outside the quarantine namespace.');
  lines.push('');
  for (const { ref, reasons } of result.violations) {
    lines.push(`  ${ref.remoteRef}`);
    for (const r of reasons) lines.push(`    · ${r}`);
  }
  lines.push('');
  lines.push('WHY THIS EXISTS (RECONCILE-PUSH-QUARANTINE-1, Tim 2026-08-22):');
  lines.push('  A reconcile-class row pushed 16 bare branch names straight to origin on a');
  lines.push('  `git cherry` classification that was wrong. All 16 were SUPERSEDED and were');
  lines.push('  deleted the same day. Patch-id is blind to squash merges.');
  lines.push('');
  lines.push('WHAT TO DO INSTEAD:');
  lines.push(`  1. Classify first, and NOT with \`git cherry\`:`);
  lines.push('       node scripts/reconcile-guard.mjs --classify <branch> [<branch> ...]');
  lines.push('     A UNIQUE verdict requires a merged-PR lookup AND a content-level check.');
  lines.push('  2. Push anything that survives into the quarantine namespace:');
  lines.push('       git push origin <branch>:refs/heads/wip/<branch>');
  lines.push('     Quarantine pushes skip preflight, so there is no reason to reach for');
  lines.push('     --no-verify. List them later with:');
  lines.push("       git ls-remote origin 'refs/heads/wip/*'");
  lines.push('  3. Promotion out of wip/ is a human decision, never a sweep.');
  lines.push('════════════════════════════════════════════════════════════════');
  return lines.join('\n');
}

/* ──────────────────────── supersession classifier ────────────────────── */

export const VERDICTS = ['SUPERSEDED', 'UNIQUE', 'INDETERMINATE'];

/**
 * Decide whether a branch carries work that is absent from origin/main.
 *
 * PURE — every input is measured by the caller, so the self-test can drive this
 * with recorded fixtures and no network.
 *
 * @param {object} m
 * @param {string} m.branch
 * @param {number} m.cherryUnique     count of `+` lines from `git cherry origin/main <branch>`
 * @param {number} m.absentOnMain     files touched by the branch's unique commits that do NOT exist on origin/main
 * @param {number} m.touchedFiles     total files touched by those commits
 * @param {Array}  m.mergedPRs        [{number, mergedAt, title}] PRs with head=<branch> and state MERGED
 * @param {boolean} m.prLookupAvailable  false when `gh` could not be consulted
 * @param {number} [m.behind]         commits the branch is behind origin/main (reported, never decisive)
 */
export function classifyBranch(m) {
  const reasons = [];
  const cherryNote =
    `git cherry: ${m.cherryUnique} commit(s) with no patch-id match upstream — ADVISORY ONLY. ` +
    'A squash merge rewrites the patch-id, so a fully-landed branch shows + forever. ' +
    'This signal may never, on its own, produce a UNIQUE verdict.';

  let verdict;
  if (Array.isArray(m.mergedPRs) && m.mergedPRs.length > 0) {
    const pr = m.mergedPRs[0];
    verdict = 'SUPERSEDED';
    reasons.push(
      `merged-PR lookup: PR #${pr.number} with head=${m.branch} is MERGED${pr.mergedAt ? ` (${pr.mergedAt})` : ''}${pr.title ? ` — "${pr.title}"` : ''}. The work landed; the merge was a squash, which is why patch-id cannot see it.`,
    );
  } else if (m.cherryUnique === 0) {
    verdict = 'SUPERSEDED';
    reasons.push('every commit on this branch has a patch-id match upstream (cherry is sound in this direction — it proves presence, never absence).');
  } else if (!m.prLookupAvailable) {
    verdict = 'INDETERMINATE';
    reasons.push('merged-PR lookup UNAVAILABLE (`gh` could not be consulted). Absence of a lookup is not a pass (SO #34c): patch-id alone may never call a branch UNIQUE. Re-run with `gh` authenticated.');
  } else if (m.absentOnMain === 0) {
    verdict = 'SUPERSEDED';
    reasons.push(
      `content check: all ${m.touchedFiles} file(s) touched by this branch's unique commits already exist on origin/main (absent-on-main = 0). Files "differ" only because main has evolved past them.`,
    );
  } else {
    verdict = 'UNIQUE';
    reasons.push(
      `content check: ${m.absentOnMain} of ${m.touchedFiles} file(s) touched by this branch's unique commits are ABSENT from origin/main, and no merged PR carries head=${m.branch}.`,
    );
  }

  reasons.push(cherryNote);
  if (typeof m.behind === 'number') {
    reasons.push(`branch is ${m.behind} commit(s) behind origin/main (reported for context; distance is never decisive).`);
  }
  return { branch: m.branch, verdict, reasons };
}

/* ──────────────────────────── git / gh plumbing ──────────────────────── */

// env: gitEnv() — this module runs as `node scripts/reconcile-guard.mjs --prepush` FROM
// .githooks/pre-push, i.e. the one place in the estate guaranteed to have GIT_DIR exported. It
// classifies branches and refuses pushes, so answering about the outer repo would refuse (or
// permit) on another tree's ref graph. `opts` is spread last so a caller can still override.
function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: REPO, env: gitEnv(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

function gitOrNull(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function repoSlug() {
  const url = gitOrNull(['remote', 'get-url', 'origin']) || '';
  const m = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
  return m ? m[1] : 'PostOakLabs/ainumbers';
}

function mergedPRsFor(branch) {
  try {
    const out = execFileSync(
      'gh',
      ['pr', 'list', '-R', repoSlug(), '--head', branch, '--state', 'all', '--json', 'number,state,mergedAt,title'],
      { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const rows = JSON.parse(out);
    return { available: true, merged: rows.filter((r) => r.state === 'MERGED') };
  } catch {
    return { available: false, merged: [] };
  }
}

function measureBranch(branch) {
  const tip = gitOrNull(['rev-parse', '--verify', `${branch}^{commit}`]);
  if (!tip) return { error: `branch not found: ${branch}` };
  const base = gitOrNull(['merge-base', 'origin/main', branch]);
  if (!base) return { error: `no merge-base between origin/main and ${branch} (is origin/main fetched?)` };

  const behind = Number(gitOrNull(['rev-list', '--count', `${branch}..origin/main`]) || 0);
  const cherry = gitOrNull(['cherry', 'origin/main', branch]) || '';
  const cherryUnique = cherry.split('\n').filter((l) => l.startsWith('+ ')).length;

  const files = (gitOrNull(['diff', '--name-only', base, branch]) || '').split('\n').map((f) => f.trim()).filter(Boolean);
  const absent = files.filter((f) => {
    try {
      git(['cat-file', '-e', `origin/main:${f}`]);
      return false;
    } catch {
      return true;
    }
  });

  const pr = mergedPRsFor(branch);
  return { tip, base, behind, cherryUnique, touchedFiles: files.length, absentOnMain: absent.length, absentList: absent, pr };
}

/* ──────────────────────────────── CLI ────────────────────────────────── */

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function runPushCheck(text) {
  const refs = parseRefLines(text);
  const headOid = gitOrNull(['rev-parse', 'HEAD']);
  const result = evaluatePush(refs, { headOid });
  if (!result.ok) {
    console.error(renderRefusal(result));
    return 1;
  }
  if (result.quarantineOnly) {
    console.log(`reconcile-guard: OK — quarantine-only push (${result.branchRefs.length} ref(s) under ${QUARANTINE_PREFIX}).`);
    console.log('AINUM_QUARANTINE_ONLY=1');
  } else if (result.creations.length) {
    console.log(`reconcile-guard: OK — ${result.creations.length} branch ref creation(s), none reconcile-class.`);
  }
  return 0;
}

function runClassify(branches) {
  let bad = 0;
  for (const branch of branches) {
    const m = measureBranch(branch);
    if (m.error) {
      console.error(`⛔ ${branch}: ${m.error}`);
      bad = 1;
      continue;
    }
    const out = classifyBranch({
      branch,
      cherryUnique: m.cherryUnique,
      absentOnMain: m.absentOnMain,
      touchedFiles: m.touchedFiles,
      mergedPRs: m.pr.merged,
      prLookupAvailable: m.pr.available,
      behind: m.behind,
    });
    console.log(`${out.verdict.padEnd(13)} ${branch}  (tip ${m.tip.slice(0, 8)})`);
    for (const r of out.reasons) console.log(`   · ${r}`);
    if (m.absentList.length) console.log(`   · absent on main: ${m.absentList.slice(0, 10).join(', ')}${m.absentList.length > 10 ? ' …' : ''}`);
    console.log('');
  }
  return bad;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--prepush')) process.exit(runPushCheck(readStdin()));

  const ci = argv.indexOf('--check-refs');
  if (ci !== -1) process.exit(runPushCheck(argv.slice(ci + 1).join('\n')));

  const cl = argv.indexOf('--classify');
  if (cl !== -1) {
    const branches = argv.slice(cl + 1).filter((a) => !a.startsWith('--'));
    if (!branches.length) {
      console.error('usage: node scripts/reconcile-guard.mjs --classify <branch> [<branch> ...]');
      process.exit(2);
    }
    process.exit(runClassify(branches));
  }

  console.error('usage: node scripts/reconcile-guard.mjs --prepush | --check-refs "<line>" ... | --classify <branch> ...');
  process.exit(2);
}

if (resolve(process.argv[1] || '') === resolve(fileURLToPath(import.meta.url))) main();
