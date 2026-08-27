#!/usr/bin/env node
/**
 * scripts/diff-scope.mjs — TOUCHTAX-DIFFSCOPE-1, the shared line-level diff-scoping helper.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * J19 §3.3 / 0xAlpha/2026-08-27-GATE-FRICTION-AUDIT.md measured a recurring class: a gate scoped
 * to "did this diff touch the FILE" (not the specific bytes) makes touching a file at all — for
 * ANY reason, including an unrelated one-line copy edit — re-gate every PRE-EXISTING byte in that
 * file, not just the new ones. Three measured instances in 24h:
 *   - CLAUSE-DIGEST-GATE-1 (check-clause-digest.mjs) blocked PAYROLL on a whole-node re-validation
 *     triggered by an unrelated field edit, then blocked a one-line description fix on four nodes
 *     (DESC-HONESTY-APPLY-1).
 *   - KERNEL-CITATION-CLASS-1 (chaingraph/kernels/lint-kernel-citation-comments.mjs) flagged a
 *     pre-existing, byte-identical `// 20 CFR 404.409-410` comment at art-282 L13 solely because
 *     the FILE differed from origin/main elsewhere — RULINGS recorded verbatim: "KERNEL-CITATION-
 *     CLASS-1 has no pre-existing-debt shield, unlike check-clause-digest which shields 587 nodes."
 *     (That shield was itself FILE-level — the true fix, shipped here, is LINE-level for both.)
 *   - jsdoc-checkjs (scripts/jsdoc-checkjs-gate.mjs) already scopes to touched FILES, but `tsc
 *     --checkJs` reports every diagnostic in a touched file's whole PROGRAM — including a TS2339
 *     on an untouched line — which blocked REGZ-CORRECTION-APPLY-1 (#1502) on a pre-existing `now`
 *     destructuring signature gap unrelated to its one-line comment fix.
 *
 * Tim ruled the CLASS, not the instance (board row TOUCHTAX-DIFFSCOPE-1): one shared helper,
 * wired into all three, not three copies of the same fix.
 *
 * ── THE PRIMITIVE ────────────────────────────────────────────────────────────
 * `changedLineSet(repo, relPath, baseRef)` answers, per FILE: which line numbers (in the CURRENT
 * on-disk content, 1-indexed) are NEW or CHANGED versus `baseRef`. Anything NOT in that set is
 * byte-identical to `baseRef` at that exact line — pre-existing debt this diff did not write, and
 * therefore EXEMPT from a touch-scoped gate's enforcement, no matter how the surrounding file moved.
 *
 * Reuses `git diff --unified=0 <baseRef> -- <path>` (the SAME "commit vs working tree" form
 * `touchedFloorFiles()` / `touchedNodeFiles()` already rely on elsewhere in this estate — a base ref
 * with no second commit-ish diffs against the CURRENT WORKING TREE, covering staged, unstaged and
 * committed-but-unpushed changes in one call) rather than a hand-rolled diff algorithm: git's diff
 * engine is the estate's existing SSOT for "what changed", so this file adds no second one.
 *
 * ── FAIL CLOSED (SO #34c / J19 §3.3, ⚠⚠ non-negotiable) ─────────────────────
 * `changedLineSet()` returns `{ ok: false }` whenever the comparison is UNDETERMINABLE — no base
 * ref resolves, a shallow clone with no history, an unreadable path, or any unexpected git failure.
 * Every caller MUST treat `ok: false` as "nothing is shielded" (every line counts as new/changed),
 * never as "skip the gate" or "exempt everything". This is the exact failure shape that made
 * NAV-ISLAND-1 emit false islands all day: an undeterminable sub-check must never be silently read
 * as a pass. `isPreExisting()` below enforces this by construction — it returns `false` (not
 * shielded) whenever `scope.ok` is false, with no separate code path to forget.
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *   import { resolveDiffScopeRef, changedLineSet, isPreExisting, lineOfText } from './diff-scope.mjs';
 *   const baseRef = resolveDiffScopeRef(REPO, { envVar: 'MY_GATE_BASE_REF' }); // supports --diff-scope <REF>
 *   const scope = changedLineSet(REPO, 'path/relative/to/repo', baseRef);
 *   if (isPreExisting(scope, lineNumber)) { / * shielded — pre-existing, do not gate * / }
 *
 * A CLI invocation may override the resolved ref with `--diff-scope <REF>` (GATE-MANIFEST-DRAFT.md
 * §3 PREREQ-1's exact flag name) — useful for CI to pin an exact merge-base SHA, and for a selftest
 * fixture to point at a throwaway sandbox ref instead of the real `origin/main`.
 */
import { execFileSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';

/**
 * Resolve the base ref to diff against, most authoritative first:
 *   1. `--diff-scope <REF>` on argv (GATE-MANIFEST-DRAFT.md §3 PREREQ-1's flag)
 *   2. `process.env[envVar]` if `envVar` was given (per-gate override, e.g. CLAUSE_DIGEST_BASE_REF)
 *   3. `origin/main` — the actual integration target in every real environment
 *   4. `origin/${GITHUB_BASE_REF}` — CI's own declared PR base, last resort
 * Returns the first candidate that resolves to a real commit, or `null` if NONE do (undeterminable
 * — shallow clone with no origin/main fetched, no remote at all, etc.). `null` is a legitimate,
 * expected return value, not a bug: every caller must treat it as "fail closed", per the header.
 *
 * Same candidate-and-fallback shape check-clause-digest.mjs's `resolveBaseRef()` already proved
 * (CLAUSE-DIGEST-SCOPE-FIX-1, 2026-08-16: `@{u}` is the WRONG ref, it goes stale under a local
 * rebase with no matching push) — centralized here so the other two gates inherit the same fix
 * instead of re-discovering it.
 */
export function resolveDiffScopeRef(repo, { argv = process.argv, envVar } = {}) {
  const candidates = [];
  const flagIdx = argv.indexOf('--diff-scope');
  if (flagIdx !== -1 && argv[flagIdx + 1]) candidates.push(argv[flagIdx + 1]);
  if (envVar && process.env[envVar]) candidates.push(process.env[envVar]);
  candidates.push('origin/main');
  if (process.env.GITHUB_BASE_REF) candidates.push(`origin/${process.env.GITHUB_BASE_REF}`);
  for (const ref of candidates) {
    try {
      // `^{commit}` is a cmd.exe escape sequence on Windows and gets silently mangled through a
      // shell — execFileSync passes argv straight to git with no shell in between, same reasoning
      // check-clause-digest.mjs's resolveBaseRef() already documented.
      execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`],
        { cwd: repo, env: gitEnv(), stdio: ['ignore', 'pipe', 'ignore'] });
      return ref;
    } catch { /* does not resolve in this checkout — try next candidate */ }
  }
  return null; // undeterminable — every caller fails CLOSED on this, never open
}

/**
 * Per-file line-level diff scope vs `baseRef`.
 *
 * Returns:
 *   { ok: true,  isNew: false, lines: Set<number> } — file exists at baseRef; `lines` is every
 *                                                      1-indexed line number in the CURRENT file
 *                                                      that is new or changed vs baseRef. A line
 *                                                      NOT in this set is byte-identical to baseRef.
 *   { ok: true,  isNew: true,  lines: Set() }        — file is ABSENT at baseRef (brand new) — every
 *                                                      line is new by construction, nothing shielded.
 *   { ok: false, isNew: false, lines: Set() }        — UNDETERMINABLE (baseRef null, git failed
 *                                                      unexpectedly). Fail CLOSED: callers must
 *                                                      treat this exactly like isNew — nothing shielded.
 */
export function changedLineSet(repo, relPath, baseRef) {
  if (!baseRef) return { ok: false, isNew: false, lines: new Set() };
  let existsAtBase = true;
  try {
    execFileSync('git', ['cat-file', '-e', `${baseRef}:${relPath}`],
      { cwd: repo, env: gitEnv(), stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    existsAtBase = false;
  }
  if (!existsAtBase) return { ok: true, isNew: true, lines: new Set() };

  try {
    // `git diff <baseRef> -- <path>` (no second commit-ish) compares baseRef's tree against the
    // CURRENT WORKING TREE — covers uncommitted, staged and committed-but-unpushed changes in one
    // call, exactly the property touchedFloorFiles()/touchedNodeFiles() already rely on elsewhere.
    // --unified=0 drops context lines from the hunk bodies; only the `@@ -a,b +c,d @@` headers are
    // read, so context-line presence/absence in the body is irrelevant to this parse.
    const out = execFileSync('git', ['diff', '--no-color', '--unified=0', baseRef, '--', relPath],
      { cwd: repo, env: gitEnv(), stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const lines = new Set();
    const hunkRe = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
    let m;
    while ((m = hunkRe.exec(out))) {
      const start = parseInt(m[1], 10);
      const count = m[2] !== undefined ? parseInt(m[2], 10) : 1; // no count suffix == exactly 1 line
      for (let i = 0; i < count; i++) lines.add(start + i);
    }
    return { ok: true, isNew: false, lines };
  } catch {
    return { ok: false, isNew: false, lines: new Set() }; // undeterminable — fail CLOSED, not open
  }
}

/**
 * Pure predicate: is `lineNumber` (1-indexed, in the CURRENT file) shielded — i.e. byte-identical
 * to `baseRef`, so a touch-scoped gate must NOT re-gate it merely because the surrounding file
 * moved? Fails CLOSED by construction: `scope.ok === false` or `scope.isNew === true` both return
 * `false` (not shielded) with no separate branch to accidentally invert.
 */
export function isPreExisting(scope, lineNumber) {
  if (!scope || !scope.ok || scope.isNew) return false;
  return !scope.lines.has(lineNumber);
}

/**
 * 1-indexed line number of the first occurrence of `needle` in `text`, or -1 if absent. Used to map
 * a structured value (a JSON node's `cited_clause_digest[i].digest`, a `standards_basis` key) back
 * onto the raw line-diff `changedLineSet()` computes over the file's TEXT — deliberately a plain
 * substring search, not a JSON-position parser: digests are long, effectively-unique sha256 hex
 * strings, so a literal-text search is unambiguous in the overwhelming case and a safe, honestly-
 * documented simplification in the rare duplicate-digest edge case (see check-clause-digest.mjs).
 */
export function lineOfText(text, needle) {
  if (!needle) return -1;
  const idx = text.indexOf(needle);
  if (idx === -1) return -1;
  return text.slice(0, idx).split('\n').length;
}
