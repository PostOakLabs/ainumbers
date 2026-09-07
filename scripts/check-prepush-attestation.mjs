#!/usr/bin/env node
/**
 * scripts/check-prepush-attestation.mjs — PREPUSH-ATTEST-CHECK-1
 *
 * Closes the `--no-verify` BLIND SPOT (0xAlpha 2026-08-21 mechanical-verification
 * audit, Finding 2 / Rec A1).
 *
 * THE HOLE. `.githooks/pre-push` runs the full preflight suite, and since
 * PREPUSH-SITEHOOK-1 (2026-08-04) it leaves a POSITIVE trace when it passes: a
 * git note on the pushed commit, on its own ref `refs/notes/preflight-attestation`,
 * pushed alongside the branch. But (a) it wrote that note ONLY for pushes touching
 * `chaingraph/chaingraph.json`, and (b) nothing ever READ it. A bypassed push
 * (`git push --no-verify`) produced output identical to a clean one, and the
 * absent note was evidence only if a human happened to go looking. SO #27 made
 * the declaration a MANUAL duty ("name the gate + the reason in the PR body"),
 * which is exactly the step that gets skipped.
 *
 * WHAT THIS SCRIPT IS. The reading half. Given a range of commits that landed on
 * main, it asks, per commit that touches a PROTECTED path: is there an attestation
 * note for it? A missing note is a mechanical RED, not a thing someone must notice.
 *
 * ⛔ WHAT IT IS NOT. It does not forbid bypassing. Legitimate bypass exists and was
 * used on 2026-08-20 (EUC-REGISTER-664-BACKFILL, `--no-verify` per SO #27 over a
 * pre-existing main red, quoted in PR #1420's body). A DECLARED bypass — a note
 * written by `--attest-bypass "<reason>"` — is GREEN and LOGGED. The failure mode
 * being closed is the SILENT bypass, never the declared one.
 *
 * ── PROTECTED PATHS (the SSOT; `.githooks/pre-push` reads this list back out of
 *    this file via `--print-pathspec`, so the hook and the gate cannot drift) ──
 *    chaingraph/chaingraph.json · chaingraph/kernels/** · manifests/** ·
 *    scripts/** · .github/workflows/**
 *
 * ── VERDICTS (one per in-scope commit) ──────────────────────────────────────
 *   ATTESTED        note found (`PREFLIGHT-VERIFIED …`) on the commit itself or on
 *                   the head commit of the PR that produced it. GREEN. Since
 *                   PREPUSH-ATTEST-MECHANICS-1 (2026-09-03) there is a second,
 *                   mechanical source: a commit that resolves to a MERGED pull
 *                   request whose REQUIRED checks (the ruleset's own list, not a
 *                   copy in this file) were green on the PR head. See the SQUASH
 *                   PATH note below.
 *   BYPASS-DECLARED note found (`PREFLIGHT-BYPASS … reason=…`). GREEN + the reason
 *                   is printed, so the declaration lands in the run log.
 *                   `PREFLIGHT-ADJUDICATED … reason=…` notes read the same way:
 *                   a retroactive adjudication of a red that was investigated and
 *                   ruled legitimate (class 1 or 2), with the adjudication's
 *                   class/run/PR carried inside the reason text.
 *   AUTOMATION      committed by the PINNED single-writer app — exactly
 *                   `ainumbers-spec-sync[bot] <ainumbers-spec-sync[bot]@users.noreply.github.com>`
 *                   (app slug ainumbers-spec-sync resolving to app id 4152587)
 *                   AND every file of the commit inside the derived-surface set
 *                   `scripts/derived-artifacts.mjs` declares — the same SSOT the
 *                   regen workflow stages from (single-writer alignment). LOGGED,
 *                   not red. Anything else bot-shaped (another app, a [bot] name
 *                   that is not the pinned one, the pinned one writing outside its
 *                   fence) falls through to UNATTESTED — the carve-out is no
 *                   longer "any [bot] string".
 *   PRE-ROLLOUT     committer date precedes EFFECTIVE_FROM below — a branch pushed
 *                   before this gate existed physically could not have written a
 *                   note. LOGGED, not red. Self-retiring: nothing new is ever dated
 *                   before a fixed past instant.
 *   UNATTESTED      no note anywhere, no merged-PR required-checks proof, no pinned
 *                   single writer. RED (exit 1).
 *   INDETERMINATE   a resolution step was ATTEMPTED and FAILED (no `gh`, API
 *                   error), so ABSENCE could not be established. RED (exit 1) with
 *                   its own diagnosis — SO #34c: a missing gate result is a
 *                   distinct state, never a green one.
 *
 * ── THE SQUASH PATH (PREPUSH-ATTEST-MECHANICS-1, 2026-09-03) ────────────────
 * Five false reds in three days (runs 33526718525 / 33530845476 / 33532601172 /
 * 33646838391 / 33701117493) all had the same shape: a PR whose branch push was
 * `--no-verify`'d over a by-construction red, with the SO #27 declaration written
 * in the PR BODY as prose — discipline followed in substance, invisible to this
 * gate, because a squash merge drops both the branch head (rewritten sha) and any
 * body text that is not pasted into the squash message.
 *
 * Of the two routes the row weighed:
 *   (a) read the declaration out of the PR body — rejected: it depends on the
 *       human writing a machine-readable marker, the exact copy discipline that
 *       produced the five false reds (#1661's prose declaration would not match
 *       any strict marker, so the red would persist though discipline was kept);
 *   (b) carry the note into the squash commit message — rejected: sessions do not
 *       run `gh pr merge` (SO #37 label-automerge only), so no session-side hook
 *       can inject text into the squash message, and the repo-settings route
 *       (squash message = PR body) is admin-only and STILL depends on the body
 *       carrying a marker.
 * The route implemented is the one with ZERO human steps: the merged PR's own
 * REQUIRED checks, re-derived from the primary sources at read time — the active
 * rulesets' required_status_checks list, and the check runs on the PR head sha.
 * Branch protection cannot admit a PR whose required checks are red, and the
 * merge queue (ruleset 20721322, merge_method SQUASH) re-runs them against the
 * merged result before merging, so this evidence is created by CI itself for
 * every merged PR — nobody has to remember anything. This is independent
 * derivation (SO #34): the gate recomputes verification state from GitHub's
 * check-run records, never from the artifact's claim about itself. A merged PR
 * whose required checks were bypassed or absent stays RED — which is a red that
 * MEANS something, per item 3 of the row.
 *
 * ── RUN-LEVEL STATES ────────────────────────────────────────────────────────
 *   NOTES-REF-ABSENT  `refs/notes/preflight-attestation` does not exist locally
 *                     (never pushed, or a shallow/partial clone that did not fetch
 *                     it). Reported ONCE as a ref-level state — ⛔ never fanned out
 *                     into N per-commit "missing note" reds, which would blame the
 *                     commits for a fetch problem. Exit 2 when in-scope commits
 *                     exist (nothing about them could be verified); exit 0 when the
 *                     range holds none (there was nothing to verify either way).
 *   WRITER-REMOVED    `.githooks/pre-push` in the tree under test no longer carries
 *                     the PREPUSH-ATTEST-CHECK-1 attestation writer. Exit 3. This is
 *                     the anti-self-disable rail: without it, deleting nine lines
 *                     from the hook would silently stop every future note and this
 *                     gate would keep reporting green over an empty ref.
 *
 * ── WHY THIS GATE IS NOT IN preflight.mjs ───────────────────────────────────
 * It verifies notes on commits that exist only AFTER a merge, and the note it looks
 * for is written by the very hook that would invoke it — a gate reading its own
 * future output. Pre-push there is nothing to check. It runs main-side, in
 * .github/workflows/prepush-attestation.yml, alongside `--self-test`, which proves
 * on every run that the checker can still go RED (SO #40b).
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   node scripts/check-prepush-attestation.mjs --base <sha> --head <sha>
 *   node scripts/check-prepush-attestation.mjs --range <base>..<head>
 *       Check a landed range. Adds --report-only to print verdicts without failing.
 *   node scripts/check-prepush-attestation.mjs --self-test
 *       Build every fixture in a throwaway git repo and ASSERT each verdict/exit
 *       code, including the RED ones. Exits 1 if the checker misbehaves.
 *   node scripts/check-prepush-attestation.mjs --demo <scenario> [--report-only]
 *       Run ONE fixture and propagate the checker's real exit code, so a CI run can
 *       be seen going red on a missing note rather than merely asserting it does.
 *       Scenarios: note-present · note-absent · declared-bypass · notes-ref-absent ·
 *       unprotected-only · squash-note-on-pr-head · squash-pr-green · squash-pr-red ·
 *       bot-in-scope · bot-out-of-scope · bot-wrong-app · adjudicated-note
 *   node scripts/check-prepush-attestation.mjs --attest-adjudicated "<reason>" [--sha <sha>]
 *       Write a RETROACTIVE-ADJUDICATION note (PREFLIGHT-ADJUDICATED) on <sha>
 *       (default HEAD) and push the notes ref. This is the backfill instrument for
 *       a red that was investigated and ruled legitimate — the reason must carry
 *       the class (1 = squash-dropped declaration, 2 = bot carve-out), the run id
 *       and the adjudicating authority, so the red history reads as adjudicated,
 *       not ignored.
 *   node scripts/check-prepush-attestation.mjs --attest-bypass "<reason>"
 *       Write a DECLARED-bypass note on HEAD and push the notes ref. Run this
 *       BEFORE a `git push --no-verify` that touches a protected path (SO #27's
 *       written justification, now also machine-readable).
 *   node scripts/check-prepush-attestation.mjs --print-pathspec
 *       Print the protected pathspec list for `git diff -- …` (the hook's SSOT read).
 */
import { execFileSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';
import { coveredPaths } from './derived-artifacts.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = resolve(HERE, '..');

export const NOTES_REF = 'preflight-attestation';
export const HOOK_MARKER = 'PREPUSH-ATTEST-CHECK-1';

/**
 * Protected paths — the set whose silent bypass the audit flagged. Directory
 * entries are git pathspecs and match recursively.
 */
export const PROTECTED_PATHS = [
  'chaingraph/chaingraph.json',
  'chaingraph/kernels',
  'manifests',
  'scripts',
  '.github/workflows',
];

/**
 * Transitional boundary: the origin/main tip at the moment this gate was authored
 * (63bce52a, committed 2026-08-22T19:15:17Z). A PR branch pushed before that instant
 * ran the OLD hook, which wrote a note only for chaingraph.json pushes — so a
 * protected-path commit from such a branch has no note through no fault of anyone.
 * Those land as PRE-ROLLOUT, logged and not red. ⛔ Do not advance this constant to
 * silence a red: it is a fixed past instant, and every commit created from here on
 * is dated after it.
 */
export const EFFECTIVE_FROM = '2026-08-22T19:15:17Z';

const EFFECTIVE_FROM_MS = Date.parse(EFFECTIVE_FROM);

export function isProtectedPath(file) {
  if (!file) return false;
  const p = file.replace(/\\/g, '/');
  return PROTECTED_PATHS.some((root) => p === root || p.startsWith(`${root}/`));
}

/**
 * The PINNED single writer (PREPUSH-ATTEST-MECHANICS-1, item 2). Before this
 * constant, ANY `[bot]` string in the committer identity took the AUTOMATION
 * carve-out — a decorative allowlist: it passed dependabot, github-actions, or a
 * rogue app exactly as readily as the real writer. Now the identity must be the
 * spec-sync bot's exact name+email pair AND the app slug must resolve (via the
 * GitHub API, at check time) to app id 4152587 — the org-owned
 * `ainumbers-spec-sync` App that mints the derived-artifacts-regen push token.
 * (Verified live 2026-09-03: GET /apps/ainumbers-spec-sync → id 4152587; its bot
 * USER id is a different number, 297170542 — the pin is the APP id.)
 */
export const SPEC_SYNC_APP = Object.freeze({
  appSlug: 'ainumbers-spec-sync',
  appId: 4152587,
  botName: 'ainumbers-spec-sync[bot]',
  botEmail: 'ainumbers-spec-sync[bot]@users.noreply.github.com',
});

/**
 * Is a file inside the derived-surface set the regen workflow itself stages
 * from? The set is NOT copied here — it is imported from
 * scripts/derived-artifacts.mjs (`coveredPaths()`), the same SSOT
 * `derived-artifacts-regen.yml` reads via `--paths`. If the declared set grows,
 * the bot's legal surface grows with it, with no second list to drift. This is
 * the single-writer alignment the row demands: the carve-out's path scope IS
 * the regen's own pathspec.
 */
export function isDeclaredDerivedPath(file) {
  if (!file) return false;
  const p = file.replace(/\\/g, '/');
  return coveredPaths().some((root) => p === root || p.startsWith(`${root}/`));
}

export function isSpecSyncCommitter(name, email) {
  return String(name || '') === SPEC_SYNC_APP.botName && String(email || '') === SPEC_SYNC_APP.botEmail;
}

/**
 * Note bodies are written by `.githooks/pre-push` (verified), by
 * `--attest-bypass` (declared bypass) and by `--attest-adjudicated`
 * (retroactive adjudication of an investigated red — the backfill instrument,
 * PREPUSH-ATTEST-MECHANICS-1 item 4). Anything else on the ref is UNKNOWN — a
 * shape this gate refuses to read as an attestation.
 */
export function classifyNote(body) {
  if (typeof body !== 'string' || !body.trim()) return { kind: 'unknown', reason: null };
  const text = body.trim();
  if (/^PREFLIGHT-VERIFIED\b/.test(text)) return { kind: 'verified', reason: null };
  if (/^PREFLIGHT-ADJUDICATED\b/.test(text)) {
    const m = text.match(/reason=([\s\S]*)$/);
    return { kind: 'adjudicated', reason: m ? m[1].trim() : '(no adjudication reason recorded)' };
  }
  if (/^PREFLIGHT-BYPASS\b/.test(text)) {
    const m = text.match(/reason=([\s\S]*)$/);
    return { kind: 'bypass', reason: m ? m[1].trim() : '(no reason recorded)' };
  }
  return { kind: 'unknown', reason: null };
}

export function isBotIdentity(name, email) {
  return /\[bot\]/i.test(String(name || '')) || /\[bot\]/i.test(String(email || ''));
}

// ── git plumbing ────────────────────────────────────────────────────────────
// GIT-ENV-LEAK-SWEEP-1 (2026-08-23): env: gitEnv(). This module is invoked BY .githooks/pre-push
// (via --print-pathspec) and reads notes on a `cwd` that the self-test points at throwaway fixture
// repos, so it is exactly the shape where an inherited GIT_DIR beats cwd and the attestation is
// read from — or written onto — the wrong repository.
function git(args, cwd, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      env: gitEnv(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    }).replace(/\s+$/, '');
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}

function notesRefPresent(cwd) {
  return git(['rev-parse', '--verify', '--quiet', `refs/notes/${NOTES_REF}`], cwd, { allowFail: true }) !== null;
}

/**
 * Read the notes ref as a TREE rather than via `git notes show`. `git notes show`
 * needs the annotated object to exist locally; a squash-merged PR head does not
 * exist in a main checkout at all (it is unreachable from any fetched ref). The
 * note is still there — keyed by the head sha under the notes tree — and
 * `git ls-tree -r` finds it regardless of git's fanout layout.
 */
function loadNoteIndex(cwd) {
  const out = git(['ls-tree', '-r', '--name-only', `refs/notes/${NOTES_REF}`], cwd, { allowFail: true });
  const index = new Map();
  if (!out) return index;
  for (const line of out.split('\n')) {
    const path = line.trim();
    if (!path) continue;
    index.set(path.replace(/\//g, ''), path);
  }
  return index;
}

function noteBody(cwd, index, sha) {
  const path = index.get(sha);
  if (!path) return null;
  return git(['cat-file', '-p', `refs/notes/${NOTES_REF}:${path}`], cwd, { allowFail: true });
}

function commitMeta(cwd, sha) {
  const raw = git(['show', '-s', '--format=%H%n%cn%n%ce%n%cI%n%P%n%s', sha], cwd, { allowFail: true });
  if (!raw) return null;
  const [full, cname, cemail, cdate, parents, ...subjectParts] = raw.split('\n');
  return {
    sha: full,
    committerName: cname,
    committerEmail: cemail,
    committedAt: cdate,
    parents: (parents || '').split(' ').filter(Boolean),
    subject: subjectParts.join('\n'),
  };
}

function filesInCommit(cwd, sha, parents) {
  const args = ['diff-tree', '--no-commit-id', '--name-only', '-r'];
  if (parents.length > 1) args.push('-m', '--first-parent');
  args.push(sha);
  const out = git([...args], cwd, { allowFail: true });
  if (!out) return [];
  return out.split('\n').map((l) => l.trim()).filter(Boolean).filter((l) => !/^[0-9a-f]{40}$/.test(l));
}

/**
 * The GitHub API layer. Every method returns `{ ok: true, … }` on success and
 * `{ ok: false }` when the call was ATTEMPTED and FAILED (no `gh`, API error) —
 * the distinction INDETERMINATE is built on (SO #34c): a failed call can never
 * be read as a green, and an empty-but-successful result is a conclusive
 * negative, never an error.
 *
 * The layer is injectable: `runCheck({ api })` accepts any object with these
 * methods, which is how the self-test exercises the PR-required-checks and
 * app-pin routes against fixture repos with no network and no real PRs
 * (SO #34b — the decision layer is verified against API-shaped payloads, and
 * the live `gh` path is the same code the workflow runs).
 */
function makeGhApi() {
  const call = (args) => {
    try {
      return {
        ok: true,
        out: execFileSync('gh', args, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 32 * 1024 * 1024,
        }).trim(),
      };
    } catch {
      return { ok: false, out: null };
    }
  };
  const tsv = (out) => (out ? out.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split('\t')) : []);

  const cache = new Map();
  const memo = (key, fn) => {
    if (!cache.has(key)) cache.set(key, fn());
    return cache.get(key);
  };

  return {
    /** PRs containing a commit: [{number, head, mergedAt}] (mergedAt '' when open). */
    pullsForCommit(slug, sha) {
      return memo(`pulls:${sha}`, () => {
        const r = call(['api', `repos/${slug}/commits/${sha}/pulls`,
          '--jq', '.[] | [.number, .head.sha, (.merged_at // "")] | @tsv']);
        if (!r.ok) return { ok: false, prs: [] };
        return { ok: true, prs: tsv(r.out).map(([number, head, mergedAt]) => ({ number, head, mergedAt })) };
      });
    },
    /** Every commit sha of a PR (for note lookup on the pre-squash commits). */
    prCommits(slug, number) {
      const r = call(['api', '--paginate', `repos/${slug}/pulls/${number}/commits`, '--jq', '.[].sha']);
      if (!r.ok) return { ok: false, shas: [] };
      return { ok: true, shas: r.out ? r.out.split('\n').map((s) => s.trim()).filter(Boolean) : [] };
    },
    /** Required status-check contexts, re-derived from the ACTIVE rulesets (SSOT). */
    requiredContexts(slug) {
      return memo('required', () => {
        const list = call(['api', `repos/${slug}/rulesets?per_page=100`,
          '--jq', '.[] | select(.enforcement == "active") | .id']);
        if (!list.ok) return { ok: false, contexts: [] };
        const contexts = new Set();
        for (const id of list.out ? list.out.split('\n').map((s) => s.trim()).filter(Boolean) : []) {
          const one = call(['api', `repos/${slug}/rulesets/${id}`,
            '--jq', '[.rules[]? | select(.type == "required_status_checks") | .parameters.required_status_checks[]?.context] | join("\\n")']);
          if (!one.ok) return { ok: false, contexts: [] };
          for (const c of one.out ? one.out.split('\n').filter(Boolean) : []) contexts.add(c);
        }
        return { ok: true, contexts: [...contexts].sort() };
      });
    },
    /** Check runs on a sha: [{name, conclusion, id}] (conclusion may be null → ''). */
    checkRuns(slug, sha) {
      return memo(`checks:${sha}`, () => {
        const r = call(['api', '--paginate', `repos/${slug}/commits/${sha}/check-runs?per_page=100`,
          '--jq', '.check_runs[] | [.name, (.conclusion // ""), .id] | @tsv']);
        if (!r.ok) return { ok: false, runs: [] };
        return { ok: true, runs: tsv(r.out).map(([name, conclusion, id]) => ({ name, conclusion, id: Number(id) })) };
      });
    },
    /** App id behind an app slug (public endpoint; used for the single-writer pin). */
    app(appSlug) {
      return memo(`app:${appSlug}`, () => {
        const r = call(['api', `apps/${appSlug}`, '--jq', '.id']);
        if (!r.ok) return { ok: false, id: null };
        const id = Number(r.out);
        return Number.isFinite(id) ? { ok: true, id } : { ok: false, id: null };
      });
    },
  };
}

// ── the check ───────────────────────────────────────────────────────────────
export function runCheck({
  repo, base, head, remote = true, slug = 'PostOakLabs/ainumbers', reportOnly = false, api = makeGhApi(),
}) {
  const lines = [];
  const say = (s) => { lines.push(s); console.log(s); };
  const annotate = (s) => {
    if (process.env.GITHUB_ACTIONS && !reportOnly) console.log(`::error::${s}`);
  };

  // Anti-self-disable rail. The hook is the WRITER; if the writer is gone this gate
  // would keep reading an ever-emptier ref and calling it green.
  const hookSrc = git(['show', `${head}:.githooks/pre-push`], repo, { allowFail: true })
    ?? (existsSync(join(repo, '.githooks/pre-push')) ? readFileSync(join(repo, '.githooks/pre-push'), 'utf8') : null);
  if (hookSrc !== null && !hookSrc.includes(HOOK_MARKER)) {
    say(`✗ WRITER-REMOVED: .githooks/pre-push no longer carries the ${HOOK_MARKER} attestation writer.`);
    say('  Every future protected-path push would go unattested while this gate still reported green.');
    annotate(`WRITER-REMOVED: .githooks/pre-push lost the ${HOOK_MARKER} attestation writer.`);
    return { exitCode: reportOnly ? 0 : 3, state: 'WRITER-REMOVED', verdicts: [], lines };
  }

  const range = base ? `${base}..${head}` : `${head}^..${head}`;
  const revs = git(['rev-list', '--reverse', range], repo, { allowFail: true });
  const shas = revs ? revs.split('\n').map((s) => s.trim()).filter(Boolean) : [];

  const inScope = [];
  for (const sha of shas) {
    const meta = commitMeta(repo, sha);
    if (!meta) continue;
    const files = filesInCommit(repo, sha, meta.parents);
    const hits = files.filter(isProtectedPath);
    if (hits.length) inScope.push({ ...meta, files, hits });
  }

  say(`preflight-attestation coverage — range ${range}`);
  say(`  commits in range: ${shas.length} · touching protected paths: ${inScope.length}`);

  if (!notesRefPresent(repo)) {
    // Ref-level state, reported ONCE. Distinct from "this commit lacks a note".
    say(`  notes ref: ABSENT (refs/notes/${NOTES_REF} not present in this checkout)`);
    if (inScope.length === 0) {
      say('✓ NOTES-REF-ABSENT with nothing in scope — nothing to verify, and nothing claimed verified.');
      return { exitCode: 0, state: 'NOTES-REF-ABSENT-IDLE', verdicts: [], lines };
    }
    say(`✗ NOTES-REF-ABSENT: ${inScope.length} protected-path commit(s) could not be verified either way.`);
    say(`  Fetch it first:  git fetch origin refs/notes/${NOTES_REF}:refs/notes/${NOTES_REF}`);
    say('  This is NOT a per-commit red — no commit is being accused; the evidence ref is missing.');
    annotate(`NOTES-REF-ABSENT: refs/notes/${NOTES_REF} missing — ${inScope.length} protected-path commit(s) unverifiable.`);
    return { exitCode: reportOnly ? 0 : 2, state: 'NOTES-REF-ABSENT', verdicts: [], lines };
  }
  say(`  notes ref: present (${loadNoteIndex(repo).size} note(s))`);

  const index = loadNoteIndex(repo);
  const verdicts = [];

  for (const c of inScope) {
    const short = c.sha.slice(0, 8);
    const label = `${short} ${c.subject.slice(0, 62)}`;
    let apiFailed = false;
    let prChecksRed = false;

    // 1. direct note on the landed commit (a direct-to-main push, or a merge
    //    strategy that preserved the attested sha).
    let body = noteBody(repo, index, c.sha);
    let via = 'commit';

    // 2. notes on the PR the commit came from — the squash merge rewrote the
    //    sha, so the note lives on the branch head (or a pre-squash commit).
    let prNumbers = [];
    let prs = [];
    if (!body && remote) {
      const r = api.pullsForCommit(slug, c.sha);
      if (!r.ok) apiFailed = true;
      prs = r.ok ? r.prs : [];
      prNumbers = prs.map((p) => p.number);
      for (const p of prs) {
        body = noteBody(repo, index, p.head);
        if (body) { via = `PR head ${p.head.slice(0, 8)}`; break; }
      }
      if (!body) {
        for (const p of prs) {
          const rc = api.prCommits(slug, p.number);
          if (!rc.ok) { apiFailed = true; continue; }
          for (const s of rc.shas) {
            body = noteBody(repo, index, s);
            if (body) { via = `PR #${p.number} commit ${s.slice(0, 8)}`; break; }
          }
          if (body) break;
        }
      }
    }

    if (body) {
      const note = classifyNote(body);
      if (note.kind === 'verified') {
        verdicts.push({ sha: c.sha, verdict: 'ATTESTED', via });
        say(`  ✓ ATTESTED        ${label}   [note on ${via}]`);
        continue;
      }
      if (note.kind === 'bypass') {
        verdicts.push({ sha: c.sha, verdict: 'BYPASS-DECLARED', via, reason: note.reason });
        say(`  ✓ BYPASS-DECLARED ${label}   [note on ${via}]`);
        say(`      declared reason (SO #27): ${note.reason}`);
        continue;
      }
      if (note.kind === 'adjudicated') {
        verdicts.push({ sha: c.sha, verdict: 'BYPASS-DECLARED', via: `${via} — retroactive adjudication`, reason: note.reason });
        say(`  ✓ BYPASS-DECLARED ${label}   [note on ${via} — retroactive adjudication]`);
        say(`      adjudicated: ${note.reason}`);
        continue;
      }
      say(`  ! note on ${via} has an unrecognised shape — not read as an attestation.`);
    }

    // 3. the PINNED single-writer bot, path-scoped (PREPUSH-ATTEST-MECHANICS-1
    //    item 2). The old carve-out took ANY `[bot]` string; now only the exact
    //    spec-sync identity, only inside the regen's own declared pathspec, and
    //    only once the app slug has resolved to the pinned app id.
    if (isBotIdentity(c.committerName, c.committerEmail)) {
      if (isSpecSyncCommitter(c.committerName, c.committerEmail)) {
        const outOfFence = c.files.filter((f) => !isDeclaredDerivedPath(f));
        if (outOfFence.length === 0) {
          const app = api.app(SPEC_SYNC_APP.appSlug);
          if (!app.ok) {
            apiFailed = true;
            say(`  ! committer is ${SPEC_SYNC_APP.botName}, but app ${SPEC_SYNC_APP.appSlug} could not be resolved to prove id ${SPEC_SYNC_APP.appId}.`);
          } else if (app.id === SPEC_SYNC_APP.appId) {
            verdicts.push({ sha: c.sha, verdict: 'AUTOMATION' });
            say(`  · AUTOMATION      ${label}   [${SPEC_SYNC_APP.appSlug} app id ${app.id} — main-side single writer, SO #35; ${c.files.length} file(s), all inside the declared derived set]`);
            continue;
          } else {
            say(`  ! committer claims ${SPEC_SYNC_APP.botName} but app ${SPEC_SYNC_APP.appSlug} resolves to id ${app.id}, not ${SPEC_SYNC_APP.appId} — not the pinned single writer.`);
          }
        } else {
          say(`  ! ${SPEC_SYNC_APP.botName} identity, but the commit writes OUTSIDE the declared derived set (single-writer fence, SO #35):`);
          say(`      ${outOfFence.slice(0, 4).join(', ')}${outOfFence.length > 4 ? ` (+${outOfFence.length - 4} more)` : ''}`);
        }
      } else {
        say(`  ! bot committer ${c.committerEmail || c.committerName} is not the pinned single writer (${SPEC_SYNC_APP.botName}, app id ${SPEC_SYNC_APP.appId}) — no carve-out.`);
      }
    }

    if (Number.isFinite(EFFECTIVE_FROM_MS) && Date.parse(c.committedAt) < EFFECTIVE_FROM_MS) {
      verdicts.push({ sha: c.sha, verdict: 'PRE-ROLLOUT' });
      say(`  · PRE-ROLLOUT     ${label}   [committed ${c.committedAt}, before ${EFFECTIVE_FROM}]`);
      continue;
    }

    // 4. the SQUASH PATH: the merged PR's own required checks (see the header —
    //    the route with zero human steps). Only PRs that actually MERGED count;
    //    the required-context list is re-derived from the active rulesets, and
    //    the check runs are read on the PR head sha. A required check that is
    //    red, or that never ran on the head, keeps this commit RED — that red
    //    means the merge reached main past a failed/absent required check.
    if (remote && prs.length) {
      let prAttested = false;
      for (const p of prs) {
        if (!p.mergedAt) continue;
        const req = api.requiredContexts(slug);
        if (!req.ok) { apiFailed = true; continue; }
        const cr = api.checkRuns(slug, p.head);
        if (!cr.ok) { apiFailed = true; continue; }
        const latest = new Map();
        for (const run of cr.runs) {
          if (!latest.has(run.name) || run.id > latest.get(run.name).id) latest.set(run.name, run);
        }
        const red = [];
        const skipped = [];
        let green = true;
        for (const ctx of req.contexts) {
          const run = latest.get(ctx);
          if (!run) { green = false; red.push(`${ctx} (never ran on the PR head)`); }
          else if (run.conclusion === 'success') { /* the proof */ }
          else if (run.conclusion === 'skipped') { skipped.push(ctx); }
          else { green = false; red.push(`${ctx} (${run.conclusion || 'no conclusion'})`); }
        }
        if (green) {
          verdicts.push({ sha: c.sha, verdict: 'ATTESTED', via: `PR #${p.number} required checks` });
          say(`  ✓ ATTESTED        ${label}   [PR #${p.number} required checks green on head ${p.head.slice(0, 8)}${skipped.length ? `; skipped by path filter: ${skipped.join(', ')}` : ''}]`);
          prAttested = true;
          break;
        }
        say(`  ✗ PR #${p.number} required checks NOT all green: ${red.join(' · ')}`);
        prChecksRed = true;
      }
      if (prAttested) continue;
    }

    // INDETERMINATE is reserved for a resolution that was ATTEMPTED and FAILED —
    // `gh` missing, API error. `--no-remote` is not that: it is the caller
    // declaring there is no squash-rewrite mapping to follow (a local repo, a
    // fixture), so absence on the commit itself IS conclusive there.
    if (remote && apiFailed) {
      verdicts.push({ sha: c.sha, verdict: 'INDETERMINATE', prNumbers });
      say(`  ✗ INDETERMINATE   ${label}`);
      say('      a resolution step failed (gh unavailable or API error) — the attestation could not be established either way.');
      say('      Absence was NOT established, so this is not a pass (SO #34c).');
      annotate(`INDETERMINATE: ${short} touches a protected path and its attestation could not be resolved.`);
      continue;
    }

    verdicts.push({ sha: c.sha, verdict: 'UNATTESTED', prNumbers });
    say(`  ✗ UNATTESTED      ${label}`);
    say(`      touched: ${c.hits.slice(0, 4).join(', ')}${c.hits.length > 4 ? ` (+${c.hits.length - 4} more)` : ''}`);
    say(`      No PREFLIGHT-VERIFIED note, no PREFLIGHT-BYPASS/ADJUDICATED note, no green required-checks record${prNumbers.length ? ` (PR ${prNumbers.map((n) => `#${n}`).join(', ')})` : ''}.`);
    if (prChecksRed) {
      say('      The PR\'s required checks were red or absent — this merge reached main past them.');
    } else {
      say('      Either preflight never ran for this push, or it was bypassed without declaring it.');
    }
    say(`      Declare a legitimate bypass BEFORE pushing:  node scripts/check-prepush-attestation.mjs --attest-bypass "<SO #27 reason>"`);
    annotate(`UNATTESTED: ${short} touches a protected path with no preflight-attestation note.`);
  }

  const bad = verdicts.filter((v) => v.verdict === 'UNATTESTED' || v.verdict === 'INDETERMINATE');
  const counts = verdicts.reduce((acc, v) => { acc[v.verdict] = (acc[v.verdict] || 0) + 1; return acc; }, {});
  say(`  summary: ${Object.entries(counts).map(([k, n]) => `${k}=${n}`).join(' · ') || 'nothing in scope'}`);
  if (bad.length) {
    say(`✗ ${bad.length} protected-path commit(s) without a usable attestation.`);
    return { exitCode: reportOnly ? 0 : 1, state: 'FAIL', verdicts, lines };
  }
  say('✓ every protected-path commit in range carries an attestation (or a named, logged carve-out).');
  return { exitCode: 0, state: 'PASS', verdicts, lines };
}

// ── fixtures (self-test + CI demo) ──────────────────────────────────────────
export const SCENARIOS = [
  'note-present', 'note-absent', 'declared-bypass', 'notes-ref-absent', 'unprotected-only',
  // PREPUSH-ATTEST-MECHANICS-1 — the four control shapes named in the row, plus
  // the two tighter REDs the new mechanics make provable:
  'squash-note-on-pr-head', // GREEN: squash merge, note lives on the PR head sha
  'squash-pr-green',        // GREEN: no note anywhere, but the merged PR's required checks were green
  'squash-pr-red',          // RED:   merged PR with a FAILED required check — a red that MEANS something
  'bot-in-scope',           // GREEN: pinned app, every file inside the declared derived set
  'bot-out-of-scope',       // RED:   pinned app writing outside its single-writer fence
  'bot-wrong-app',          // RED:   a different [bot] identity — the old "any [bot] passes" hole, closed
  'adjudicated-note',       // GREEN: retroactive adjudication note, reason printed into the log
];

const EXPECTED = {
  'note-present': { exitCode: 0, verdict: 'ATTESTED', state: 'PASS' },
  'note-absent': { exitCode: 1, verdict: 'UNATTESTED', state: 'FAIL' },
  'declared-bypass': { exitCode: 0, verdict: 'BYPASS-DECLARED', state: 'PASS' },
  'notes-ref-absent': { exitCode: 2, verdict: null, state: 'NOTES-REF-ABSENT' },
  'unprotected-only': { exitCode: 0, verdict: null, state: 'PASS' },
  'squash-note-on-pr-head': { exitCode: 0, verdict: 'ATTESTED', state: 'PASS' },
  'squash-pr-green': { exitCode: 0, verdict: 'ATTESTED', state: 'PASS' },
  'squash-pr-red': { exitCode: 1, verdict: 'UNATTESTED', state: 'FAIL' },
  'bot-in-scope': { exitCode: 0, verdict: 'AUTOMATION', state: 'PASS' },
  'bot-out-of-scope': { exitCode: 1, verdict: 'UNATTESTED', state: 'FAIL' },
  'bot-wrong-app': { exitCode: 1, verdict: 'UNATTESTED', state: 'FAIL' },
  'adjudicated-note': { exitCode: 0, verdict: 'BYPASS-DECLARED', state: 'PASS' },
};

/**
 * Build a REAL throwaway git repo — real commits, a real notes ref, the real
 * `git ls-tree`/`cat-file` read path. SO #34b: a gate is verified in the
 * environment of the thing it validates, not against a mock of it. The GitHub
 * API half (PR resolution, required checks, app pin) is exercised through the
 * same injectable interface the live `gh` path implements, against payloads
 * shaped like the API's (see fixtureApi).
 */
function buildFixture(scenario, dir) {
  const g = (...args) => git(args, dir);
  g('init', '-q', '-b', 'main');
  g('config', 'user.email', 'fixture@example.invalid');
  g('config', 'user.name', 'Fixture Session');
  g('config', 'commit.gpgsign', 'false');

  writeFileSync(join(dir, 'README.md'), 'fixture base\n');
  g('add', 'README.md');
  g('commit', '-q', '-m', 'chore: fixture base');
  const base = g('rev-parse', 'HEAD');

  const commitProtected = (subject, message) => {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    writeFileSync(join(dir, 'scripts', 'fixture-gate.mjs'), `// ${message}\n`);
    g('add', 'scripts/fixture-gate.mjs');
    g('commit', '-q', '-m', subject);
  };
  const botCommit = (paths, subject) => {
    for (const [file, content] of paths) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), `// ${content}\n`);
      g('add', '--', file);
    }
    g('-c', `user.name=${SPEC_SYNC_APP.botName}`, `-c`, `user.email=${SPEC_SYNC_APP.botEmail}`,
      'commit', '-q', '-m', subject);
  };

  let prHead = null;
  if (scenario === 'unprotected-only') {
    writeFileSync(join(dir, 'README.md'), 'fixture base\nnot a protected path\n');
    g('add', 'README.md');
    g('commit', '-q', '-m', 'docs: touch nothing protected');
  } else if (scenario === 'squash-note-on-pr-head') {
    // The branch head the hook attested…
    commitProtected('feat(scripts): fixture protected-path change (pr head)', 'pr head change');
    prHead = g('rev-parse', 'HEAD');
    // …and the squash commit that landed on main — same change, rewritten sha.
    commitProtected('feat(scripts): fixture protected-path change (#4242)', 'squashed change');
  } else if (scenario === 'squash-pr-green' || scenario === 'squash-pr-red') {
    commitProtected('feat(scripts): fixture protected-path change (#4242)', 'squashed change');
  } else if (scenario === 'bot-in-scope' || scenario === 'bot-wrong-app') {
    // chaingraph/kernels/index.mjs is BOTH protected (chaingraph/kernels/**) and
    // declared (derived-artifacts.mjs id 'kernel-index') — the real overlap the
    // carve-out exists for.
    mkdirSync(join(dir, 'chaingraph', 'kernels'), { recursive: true });
    writeFileSync(join(dir, 'chaingraph', 'kernels', 'index.mjs'), '// fixture declared derived surface\n');
    g('add', '--', 'chaingraph/kernels/index.mjs');
    if (scenario === 'bot-in-scope') {
      g('-c', `user.name=${SPEC_SYNC_APP.botName}`, `-c`, `user.email=${SPEC_SYNC_APP.botEmail}`,
        'commit', '-q', '-m', 'chore(derived): regenerate shared derived artifacts on main');
    } else {
      g('-c', 'user.name=dependabot[bot]', '-c', 'user.email=dependabot[bot]@users.noreply.github.com',
        'commit', '-q', '-m', 'chore(deps): not the pinned single writer');
    }
  } else if (scenario === 'bot-out-of-scope') {
    botCommit([['scripts/fixture-gate.mjs', 'protected path OUTSIDE the declared derived set']],
      'chore(derived): regenerate shared derived artifacts on main');
  } else {
    commitProtected('feat(scripts): fixture protected-path change', 'fixture protected-path change');
  }
  const head = g('rev-parse', 'HEAD');
  const ts = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  if (scenario === 'note-present') {
    g('notes', `--ref=${NOTES_REF}`, 'add', '-f', '-m', `PREFLIGHT-VERIFIED sha=${head} ts=${ts}`, head);
  } else if (scenario === 'declared-bypass') {
    g('notes', `--ref=${NOTES_REF}`, 'add', '-f', '-m',
      `PREFLIGHT-BYPASS sha=${head} ts=${ts} reason=SO #27 by-construction red: predecessor shard still unmerged`, head);
  } else if (scenario === 'adjudicated-note') {
    g('notes', `--ref=${NOTES_REF}`, 'add', '-f', '-m',
      `PREFLIGHT-ADJUDICATED sha=${head} ts=${ts} reason=class 1 (squash) — run 33701117493, PR #4242: squash merge dropped the PR-body SO #27 declaration; adjudicated 7F SP-2 addendum 2026-09-03; annotated by PREPUSH-ATTEST-MECHANICS-1`, head);
  } else if (scenario === 'note-absent' || scenario === 'unprotected-only'
    || scenario === 'squash-pr-green' || scenario === 'squash-pr-red') {
    // The ref must EXIST so a missing note is a per-commit red, not the
    // ref-level NOTES-REF-ABSENT state. Attest the base commit only.
    g('notes', `--ref=${NOTES_REF}`, 'add', '-f', '-m', `PREFLIGHT-VERIFIED sha=${base} ts=${ts}`, base);
  } else if (scenario === 'squash-note-on-pr-head') {
    // The hook's note went on the PR HEAD, not on the squash sha — that is the
    // entire point of this scenario.
    g('notes', `--ref=${NOTES_REF}`, 'add', '-f', '-m', `PREFLIGHT-VERIFIED sha=${prHead} ts=${ts}`, prHead);
  } else if (scenario === 'bot-in-scope' || scenario === 'bot-out-of-scope' || scenario === 'bot-wrong-app') {
    g('notes', `--ref=${NOTES_REF}`, 'add', '-f', '-m', `PREFLIGHT-VERIFIED sha=${base} ts=${ts}`, base);
  }
  // 'notes-ref-absent' deliberately creates no note at all.

  return { base, head, prHead };
}

/**
 * Stub of the gh API layer for fixture scenarios (same method shapes as
 * makeGhApi). The required-contexts list mirrors the live ruleset's five; the
 * point under test is the DECISION LOGIC over API-shaped payloads, not the
 * live list itself.
 */
function fixtureApi(scenario, { head, prHead }) {
  const REQUIRED = ['anchor', 'html-verify / required', 'jsdoc-checkjs / required', 'land-verify / required', 'scripts-verify / required'];
  const runs = (over = {}) => REQUIRED.map((name, i) => ({ name, conclusion: over[name] ?? 'success', id: i + 1 }));
  const prsBySha = {};
  const runsBySha = {};
  if (scenario === 'squash-note-on-pr-head') {
    prsBySha[head] = [{ number: 4242, head: prHead, mergedAt: '2026-09-03T00:00:00Z' }];
    runsBySha[prHead] = runs();
  } else if (scenario === 'squash-pr-green') {
    prsBySha[head] = [{ number: 4242, head, mergedAt: '2026-09-03T00:00:00Z' }];
    runsBySha[head] = runs();
  } else if (scenario === 'squash-pr-red') {
    prsBySha[head] = [{ number: 4242, head, mergedAt: '2026-09-03T00:00:00Z' }];
    runsBySha[head] = runs({ anchor: 'failure' });
  }
  return {
    pullsForCommit: (slug, sha) => ({ ok: true, prs: prsBySha[sha] || [] }),
    prCommits: () => ({ ok: true, shas: [] }),
    requiredContexts: () => ({ ok: true, contexts: REQUIRED }),
    checkRuns: (slug, sha) => ({ ok: true, runs: runsBySha[sha] || [] }),
    app: () => ({ ok: true, id: SPEC_SYNC_APP.appId }),
  };
}

function withFixture(scenario, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'ain-attest-'));
  try {
    const { base, head, prHead } = buildFixture(scenario, dir);
    const api = fixtureApi(scenario, { head, prHead });
    // The squash-* scenarios exercise the PR-resolution routes (stubbed); every
    // other scenario is fully local, as before.
    const remote = scenario.startsWith('squash-') || scenario.startsWith('bot-');
    return fn({ dir, base, head, api, remote });
  } finally {
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 3 }); } catch { /* windows lock — temp dir, harmless */ }
  }
}

function runDemo(scenario, { reportOnly }) {
  return withFixture(scenario, ({ dir, base, head, api, remote }) => {
    console.log(`── fixture: ${scenario} ──────────────────────────────────────────`);
    const res = runCheck({ repo: dir, base, head, remote, api, reportOnly });
    const exp = EXPECTED[scenario];
    console.log(`   expected: exit ${exp.exitCode} / state ${exp.state}${exp.verdict ? ` / verdict ${exp.verdict}` : ''}`);
    console.log(`   observed: exit ${reportOnly ? `${res.exitCode} (report-only; ${exp.exitCode} when enforcing)` : res.exitCode} / state ${res.state}`);
    return res;
  });
}

function selfTest() {
  let failures = 0;
  for (const scenario of SCENARIOS) {
    const exp = EXPECTED[scenario];
    const res = withFixture(scenario, ({ dir, base, head, api, remote }) =>
      runCheck({ repo: dir, base, head, remote, api, reportOnly: false }));
    const gotVerdict = res.verdicts.length ? res.verdicts[res.verdicts.length - 1].verdict : null;
    const ok = res.exitCode === exp.exitCode
      && res.state === exp.state
      && (exp.verdict === null || gotVerdict === exp.verdict);
    if (!ok) {
      failures++;
      console.error(`✗ self-test ${scenario}: expected exit ${exp.exitCode}/${exp.state}/${exp.verdict}, got exit ${res.exitCode}/${res.state}/${gotVerdict}`);
    } else {
      console.log(`✓ self-test ${scenario}: exit ${res.exitCode} · state ${res.state}${gotVerdict ? ` · ${gotVerdict}` : ''}`);
    }
  }
  if (failures) {
    console.error(`✗ check-prepush-attestation self-test: ${failures} fixture(s) misbehaved.`);
    return 1;
  }
  console.log(`✓ check-prepush-attestation self-test: ${SCENARIOS.length}/${SCENARIOS.length} fixtures behaved as specified (RED cases included).`);
  return 0;
}

// ── bypass declaration + adjudication helpers ───────────────────────────────
function pushNotesRef(repo) {
  execFileSync('git', ['push', 'origin', `refs/notes/${NOTES_REF}`], {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // Same re-entry sentinel the hook uses: this push would otherwise re-invoke
    // the pre-push hook and re-run preflight on a notes-only ref update. AINUM_PREPUSH_ATTESTING
    // is passed as gitEnv()'s `extra`, so it survives the scrub — it is not a GIT_* key, and the
    // scrub only ever removes INHERITED git state, never something set deliberately here.
    // Credentials are config-resident (Windows credential manager locally, checkout's
    // http.extraheader in CI), so dropping GIT_ASKPASS/GIT_SSH_COMMAND costs this push nothing.
    env: gitEnv({ AINUM_PREPUSH_ATTESTING: '1' }),
  });
}

function attestBypass(repo, reason) {
  if (!reason || !reason.trim()) {
    console.error('✗ --attest-bypass needs a reason: the SO #27 justification, in words.');
    return 1;
  }
  const sha = git(['rev-parse', 'HEAD'], repo);
  const ts = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const flat = reason.replace(/\s+/g, ' ').trim();
  git(['notes', `--ref=${NOTES_REF}`, 'add', '-f', '-m', `PREFLIGHT-BYPASS sha=${sha} ts=${ts} reason=${flat}`, sha], repo);
  console.log(`✓ declared-bypass note written on ${sha}`);
  console.log(`    reason: ${flat}`);
  try {
    pushNotesRef(repo);
    console.log(`✓ pushed refs/notes/${NOTES_REF} to origin — the declaration is now readable by CI.`);
  } catch {
    console.error(`! could not push refs/notes/${NOTES_REF} — the note is recorded locally only.`);
    console.error('  Push it before the bypassed push lands:  git push origin refs/notes/preflight-attestation');
    return 1;
  }
  return 0;
}

/**
 * The BACKFILL INSTRUMENT (row item 4). A red that was investigated and ruled
 * legitimate gets a dated annotation on the flagged commit, in the same trail
 * the gate already reads — so the history says "adjudicated", not "ignored".
 * The reason must name the class (1 = squash-dropped declaration, 2 = bot
 * carve-out), the run id and the adjudicating authority.
 */
function attestAdjudicated(repo, reason, shaArg) {
  if (!reason || !reason.trim()) {
    console.error('✗ --attest-adjudicated needs a reason: class (1|2), run id, PR/commit and adjudicating authority, in words.');
    return 1;
  }
  const sha = shaArg || git(['rev-parse', 'HEAD'], repo);
  const resolved = git(['rev-parse', `${sha}^{commit}`], repo, { allowFail: true });
  if (!resolved) {
    console.error(`✗ ${sha} does not resolve to a commit in this repository.`);
    return 1;
  }
  const ts = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const flat = reason.replace(/\s+/g, ' ').trim();
  git(['notes', `--ref=${NOTES_REF}`, 'add', '-f', '-m', `PREFLIGHT-ADJUDICATED sha=${resolved} ts=${ts} reason=${flat}`, resolved], repo);
  console.log(`✓ adjudication note written on ${resolved}`);
  console.log(`    reason: ${flat}`);
  try {
    pushNotesRef(repo);
    console.log(`✓ pushed refs/notes/${NOTES_REF} to origin — the adjudication is now part of the readable trail.`);
  } catch {
    console.error(`! could not push refs/notes/${NOTES_REF} — the note is recorded locally only.`);
    console.error('  Push it with:  git push origin refs/notes/preflight-attestation');
    return 1;
  }
  return 0;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
function argValue(argv, name) {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}

function main(argv) {
  const repo = resolve(argValue(argv, '--repo') || REPO_DEFAULT);
  const reportOnly = argv.includes('--report-only');

  if (argv.includes('--print-pathspec')) {
    console.log(PROTECTED_PATHS.join(' '));
    return 0;
  }

  if (argv.includes('--attest-bypass')) {
    return attestBypass(repo, argValue(argv, '--attest-bypass'));
  }

  if (argv.includes('--attest-adjudicated')) {
    return attestAdjudicated(repo, argValue(argv, '--attest-adjudicated'), argValue(argv, '--sha'));
  }

  if (argv.includes('--self-test')) return selfTest();

  const demo = argValue(argv, '--demo');
  if (demo) {
    if (!SCENARIOS.includes(demo)) {
      console.error(`✗ unknown scenario "${demo}". Known: ${SCENARIOS.join(', ')}`);
      return 1;
    }
    return runDemo(demo, { reportOnly }).exitCode;
  }

  let base = argValue(argv, '--base');
  let head = argValue(argv, '--head');
  const range = argValue(argv, '--range');
  if (range && range.includes('..')) {
    const [b, h] = range.split('..');
    base = base || b;
    head = head || h;
  }
  head = head || process.env.GITHUB_SHA || 'HEAD';
  base = base || process.env.PUSH_BEFORE || null;

  // A force-push / first-push `before` is all-zeroes, and a squash merge can leave
  // it unresolvable in a shallow-ish checkout. Fall back to the single head commit
  // and SAY SO — never widen silently, never pretend the range was what was asked.
  if (base && (/^0{40}$/.test(base) || git(['cat-file', '-e', `${base}^{commit}`], repo, { allowFail: true }) === null)) {
    console.log(`! base ${base.slice(0, 8)} is unresolvable in this checkout — narrowing to ${head.slice(0, 8)}^..${head.slice(0, 8)}.`);
    base = null;
  }

  const slug = process.env.GITHUB_REPOSITORY || 'PostOakLabs/ainumbers';
  const remote = !argv.includes('--no-remote');
  return runCheck({ repo, base, head, remote, slug, reportOnly }).exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
