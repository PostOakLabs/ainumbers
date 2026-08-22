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
 *                   the head commit of the PR that produced it. GREEN.
 *   BYPASS-DECLARED note found (`PREFLIGHT-BYPASS … reason=…`). GREEN + the reason
 *                   is printed, so the declaration lands in the run log.
 *   AUTOMATION      committed by a `[bot]` identity — the main-side single-writer
 *                   regen (SO #35, `ainumbers-spec-sync[bot]`) commits directly to
 *                   main from a runner where no client-side hook exists and no
 *                   preflight is meaningful. Its writes touch protected paths
 *                   (measured: 06e0357c rewrote chaingraph/kernels/data/rule-registry.json).
 *                   LOGGED, not red. Named carve-out, not a silent skip.
 *   PRE-ROLLOUT     committer date precedes EFFECTIVE_FROM below — a branch pushed
 *                   before this gate existed physically could not have written a
 *                   note. LOGGED, not red. Self-retiring: nothing new is ever dated
 *                   before a fixed past instant.
 *   UNATTESTED      no note anywhere. RED (exit 1).
 *   INDETERMINATE   the originating PR could not be resolved (no `gh`, API failure),
 *                   so ABSENCE could not be established. RED (exit 1) with its own
 *                   diagnosis — SO #34c: a missing gate result is a distinct state,
 *                   never a green one.
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
 *       unprotected-only
 *   node scripts/check-prepush-attestation.mjs --attest-bypass "<reason>"
 *       Write a DECLARED-bypass note on HEAD and push the notes ref. Run this
 *       BEFORE a `git push --no-verify` that touches a protected path (SO #27's
 *       written justification, now also machine-readable).
 *   node scripts/check-prepush-attestation.mjs --print-pathspec
 *       Print the protected pathspec list for `git diff -- …` (the hook's SSOT read).
 */
import { execFileSync } from 'node:child_process';
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
 * Note bodies are written by `.githooks/pre-push` (verified) and by
 * `--attest-bypass` (declared bypass). Anything else on the ref is UNKNOWN — a
 * shape this gate refuses to read as an attestation.
 */
export function classifyNote(body) {
  if (typeof body !== 'string' || !body.trim()) return { kind: 'unknown', reason: null };
  const text = body.trim();
  if (/^PREFLIGHT-VERIFIED\b/.test(text)) return { kind: 'verified', reason: null };
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
function git(args, cwd, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
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
 * Resolve the PR head commit(s) a main commit came from. Squash merge rewrites the
 * commit, so the sha on main is NEVER the sha the hook attested — the note lives on
 * the branch head. Uses `gh` (preinstalled on GitHub runners; not a third-party
 * Action, so SO #8's Action rule is untouched). No `gh`, or an API failure, yields
 * null → INDETERMINATE, never a silent pass (SO #34c).
 */
function resolvePrHeads(slug, sha) {
  try {
    const out = execFileSync(
      'gh',
      ['api', `repos/${slug}/commits/${sha}/pulls`, '--jq', '.[] | .head.sha, .number'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 },
    ).trim();
    if (!out) return { heads: [], numbers: [], ok: true };
    const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
    const heads = [];
    const numbers = [];
    for (let i = 0; i < lines.length; i += 2) {
      heads.push(lines[i]);
      if (lines[i + 1]) numbers.push(lines[i + 1]);
    }
    return { heads, numbers, ok: true };
  } catch {
    return { heads: [], numbers: [], ok: false };
  }
}

function prCommitShas(slug, number) {
  try {
    const out = execFileSync(
      'gh',
      ['api', '--paginate', `repos/${slug}/pulls/${number}/commits`, '--jq', '.[].sha'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 },
    ).trim();
    return out ? out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

// ── the check ───────────────────────────────────────────────────────────────
export function runCheck({ repo, base, head, remote = true, slug = 'PostOakLabs/ainumbers', reportOnly = false }) {
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
    if (hits.length) inScope.push({ ...meta, hits });
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

    // 1. direct note on the landed commit (a direct-to-main push, or a merge
    //    strategy that preserved the attested sha).
    let body = noteBody(repo, index, c.sha);
    let via = 'commit';

    // 2. the PR head the hook actually attested (squash merge rewrote the sha).
    let prNumbers = [];
    let resolveOk = true;
    if (!body && remote) {
      const { heads, numbers, ok } = resolvePrHeads(slug, c.sha);
      resolveOk = ok;
      prNumbers = numbers;
      for (const h of heads) {
        body = noteBody(repo, index, h);
        if (body) { via = `PR head ${h.slice(0, 8)}`; break; }
      }
      if (!body) {
        for (const n of numbers) {
          for (const s of prCommitShas(slug, n)) {
            body = noteBody(repo, index, s);
            if (body) { via = `PR #${n} commit ${s.slice(0, 8)}`; break; }
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
      say(`  ! note on ${via} has an unrecognised shape — not read as an attestation.`);
    }

    if (isBotIdentity(c.committerName, c.committerEmail)) {
      verdicts.push({ sha: c.sha, verdict: 'AUTOMATION' });
      say(`  · AUTOMATION      ${label}   [committer ${c.committerEmail} — main-side single writer, SO #35]`);
      continue;
    }

    if (Number.isFinite(EFFECTIVE_FROM_MS) && Date.parse(c.committedAt) < EFFECTIVE_FROM_MS) {
      verdicts.push({ sha: c.sha, verdict: 'PRE-ROLLOUT' });
      say(`  · PRE-ROLLOUT     ${label}   [committed ${c.committedAt}, before ${EFFECTIVE_FROM}]`);
      continue;
    }

    // INDETERMINATE is reserved for a resolution that was ATTEMPTED and FAILED —
    // `gh` missing, API error. `--no-remote` is not that: it is the caller
    // declaring there is no squash-rewrite mapping to follow (a local repo, a
    // fixture), so absence on the commit itself IS conclusive there.
    if (remote && !resolveOk) {
      verdicts.push({ sha: c.sha, verdict: 'INDETERMINATE' });
      say(`  ✗ INDETERMINATE   ${label}`);
      say('      no note on the commit, and the originating PR could not be resolved (gh unavailable or API error).');
      say('      Absence was NOT established, so this is not a pass (SO #34c).');
      annotate(`INDETERMINATE: ${short} touches a protected path and its attestation could not be resolved.`);
      continue;
    }

    verdicts.push({ sha: c.sha, verdict: 'UNATTESTED', prNumbers });
    say(`  ✗ UNATTESTED      ${label}`);
    say(`      touched: ${c.hits.slice(0, 4).join(', ')}${c.hits.length > 4 ? ` (+${c.hits.length - 4} more)` : ''}`);
    say(`      No PREFLIGHT-VERIFIED and no PREFLIGHT-BYPASS note${prNumbers.length ? ` (PR ${prNumbers.map((n) => `#${n}`).join(', ')})` : ''}.`);
    say('      Either preflight never ran for this push, or it was bypassed without declaring it.');
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
export const SCENARIOS = ['note-present', 'note-absent', 'declared-bypass', 'notes-ref-absent', 'unprotected-only'];

const EXPECTED = {
  'note-present': { exitCode: 0, verdict: 'ATTESTED', state: 'PASS' },
  'note-absent': { exitCode: 1, verdict: 'UNATTESTED', state: 'FAIL' },
  'declared-bypass': { exitCode: 0, verdict: 'BYPASS-DECLARED', state: 'PASS' },
  'notes-ref-absent': { exitCode: 2, verdict: null, state: 'NOTES-REF-ABSENT' },
  'unprotected-only': { exitCode: 0, verdict: null, state: 'PASS' },
};

/**
 * Build a REAL throwaway git repo — real commits, a real notes ref, the real
 * `git ls-tree`/`cat-file` read path. SO #34b: a gate is verified in the
 * environment of the thing it validates, not against a mock of it.
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

  if (scenario === 'unprotected-only') {
    writeFileSync(join(dir, 'README.md'), 'fixture base\nnot a protected path\n');
    g('add', 'README.md');
    g('commit', '-q', '-m', 'docs: touch nothing protected');
  } else {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    writeFileSync(join(dir, 'scripts', 'fixture-gate.mjs'), '// fixture protected-path change\n');
    g('add', 'scripts/fixture-gate.mjs');
    g('commit', '-q', '-m', 'feat(scripts): fixture protected-path change');
  }
  const head = g('rev-parse', 'HEAD');
  const ts = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  if (scenario === 'note-present') {
    g('notes', `--ref=${NOTES_REF}`, 'add', '-f', '-m', `PREFLIGHT-VERIFIED sha=${head} ts=${ts}`, head);
  } else if (scenario === 'declared-bypass') {
    g('notes', `--ref=${NOTES_REF}`, 'add', '-f', '-m',
      `PREFLIGHT-BYPASS sha=${head} ts=${ts} reason=SO #27 by-construction red: predecessor shard still unmerged`, head);
  } else if (scenario === 'note-absent' || scenario === 'unprotected-only') {
    // The ref must EXIST so a missing note is a per-commit red, not the
    // ref-level NOTES-REF-ABSENT state. Attest the base commit only.
    g('notes', `--ref=${NOTES_REF}`, 'add', '-f', '-m', `PREFLIGHT-VERIFIED sha=${base} ts=${ts}`, base);
  }
  // 'notes-ref-absent' deliberately creates no note at all.

  return { base, head };
}

function withFixture(scenario, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'ain-attest-'));
  try {
    const { base, head } = buildFixture(scenario, dir);
    return fn({ dir, base, head });
  } finally {
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 3 }); } catch { /* windows lock — temp dir, harmless */ }
  }
}

function runDemo(scenario, { reportOnly }) {
  return withFixture(scenario, ({ dir, base, head }) => {
    console.log(`── fixture: ${scenario} ──────────────────────────────────────────`);
    const res = runCheck({ repo: dir, base, head, remote: false, reportOnly });
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
    const res = withFixture(scenario, ({ dir, base, head }) =>
      runCheck({ repo: dir, base, head, remote: false, reportOnly: false }));
    const gotVerdict = res.verdicts.length ? res.verdicts[0].verdict : null;
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

// ── bypass declaration helper ───────────────────────────────────────────────
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
    execFileSync('git', ['push', 'origin', `refs/notes/${NOTES_REF}`], {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Same re-entry sentinel the hook uses: this push would otherwise re-invoke
      // the pre-push hook and re-run preflight on a notes-only ref update.
      env: { ...process.env, AINUM_PREPUSH_ATTESTING: '1' },
    });
    console.log(`✓ pushed refs/notes/${NOTES_REF} to origin — the declaration is now readable by CI.`);
  } catch {
    console.error(`! could not push refs/notes/${NOTES_REF} — the note is recorded locally only.`);
    console.error(`  Push it before the bypassed push lands:  git push origin refs/notes/${NOTES_REF}`);
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
