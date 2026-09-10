#!/usr/bin/env node
/**
 * check-clause-digest.mjs — CLAUSE-DIGEST-GATE-1, SPEC.md §30.
 *
 * Makes "a standards-implementing node shipped with behaviour never derived from retrieved primary
 * text" structurally impossible. Does NOT and cannot make "retrieved and read wrongly" impossible —
 * see the SCOPE line this gate always prints, and SPEC.md §30.0.
 *
 * WHAT IT CHECKS, on every NEW-or-CHANGED chaingraph/graph/nodes/*.json shard (branch-aware, diffed
 * against origin/main — the check-shard-assembly.mjs base-ref pattern, NOT the `@{u}` pattern
 * check-chain-citation.mjs still uses; CLAUSE-DIGEST-SCOPE-FIX-1, 2026-08-16, found `@{u}` produces
 * a DIFFERENT verdict in the pre-push hook than in CI on the same commit — see that row for the
 * measured false-positive. check-chain-citation.mjs carries the same latent defect and is reported,
 * not fixed, here — it is outside this gate's fence. A PRE-EXISTING/untouched node is never gated,
 * only counted as a gap):
 *   1. The node declares standards_basis: "implements_standard" | "not_applicable" |
 *      "cites_informative". None present on a touched node is a FAILURE — no silent default
 *      (SPEC.md §30.3).
 *   2. "not_applicable" requires nothing further (explicit, honest opt-out).
 *   3. "implements_standard" requires a non-empty cited_clause_digest[], each entry structurally valid
 *      (digest, source_url, retrieved_at, clause_path present).
 *   3a. "cites_informative" (SPEC.md §30.3a) requires the SAME non-empty, structurally-valid
 *      cited_clause_digest[] as "implements_standard" — it is a provenance class, not an opt-out —
 *      but is NOT a standards-implementing declaration for the #39 SIDEBYSIDE/PROVE pipeline.
 *   4. INDEPENDENT DERIVATION (SO #34): every entry's `digest` MUST resolve to a real entry in
 *      chaingraph/standard/clause-snapshot-registry.json — written only by pin-clause-snapshot.mjs,
 *      which itself refuses whole-document-sized excerpts (SPEC.md §30.2). A digest that does not
 *      resolve to a registered snapshot FAILS: a gate satisfied by an arbitrary string is theatre.
 *
 * Pre-existing gap (untouched nodes with no standards_basis) is reported as a COUNT, never a ratio,
 * never a CI failure, never backfilled (SPEC.md §30.4).
 *
 * TOUCHTAX-DIFFSCOPE-1 (2026-08-27, J19 §3.3): FILE-level touch scoping alone still re-gated every
 * PRE-EXISTING citation in a touched node merely because the FILE changed somewhere else — blocked
 * PAYROLL, then blocked a one-line description fix on four unrelated nodes (DESC-HONESTY-APPLY-1).
 * The gate now shields at LINE granularity too, via scripts/diff-scope.mjs (the shared helper wired
 * into this gate, KERNEL-CITATION-CLASS-1 and jsdoc-checkjs alike — one helper, not three copies):
 * a `standards_basis` declaration or a `cited_clause_digest[]` entry whose own line is BYTE-IDENTICAL
 * to origin/main is treated as pre-existing debt (a gap, never a failure) even when the surrounding
 * node file differs elsewhere. A genuinely NEW or CHANGED declaration/entry is validated exactly as
 * before — nothing about NEW bytes is weakened (Tim's no-waiver ruling stands). Override the base ref
 * with `--diff-scope <REF>` or `CLAUSE_DIGEST_BASE_REF`; an undeterminable diff fails CLOSED (nothing
 * is shielded), never open.
 *
 * Usage: node scripts/check-clause-digest.mjs [--diff-scope <REF>]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';
import { resolveDiffScopeRef, changedLineSet, isPreExisting, lineOfText } from './diff-scope.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NODES_DIR = resolve(REPO, 'chaingraph', 'graph', 'nodes');
const REGISTRY_PATH = resolve(REPO, 'chaingraph', 'standard', 'clause-snapshot-registry.json');

// Every git child spawned by this module scrubs inherited GIT_* vars (GIT_DIR, GIT_WORK_TREE,
// GIT_INDEX_FILE, ...) from process.env before running. Git exports those to every hook it
// invokes; this module accepts a `repo` argument that can legitimately differ from the ambient
// hook's own repo (it is exported and exercised against throwaway sandboxes by
// check-clause-digest.test.mjs), and an inherited GIT_DIR silently overrides `cwd` for git's
// repo discovery — pointing every command here at the WRONG repository regardless of what
// `repo` says. Measured while building this fix: an un-scrubbed version of this exact call
// pattern, exercised from a test invoked by the pre-push hook, committed a throwaway sandbox's
// tree onto the real working branch. Scrub unconditionally, not just in the test.
//
// GIT-ENV-LEAK-SWEEP-1 (2026-08-23): the private scrubbedEnv() that used to live here IS gitEnv()
// in scripts/_git-env-lib.mjs now — identical semantics (drop every /^GIT_/i key), one copy for the
// whole estate, kept honest by scripts/check-git-env-scrub.mjs. This header was one of three places
// that had each learned this lesson independently and recorded it privately; that is what made the
// class survive three separate fixes.
function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, env: gitEnv(), stdio: ['ignore', 'pipe', 'ignore'] });
}

// Candidate base refs to diff against, most authoritative first — the SAME pattern
// check-shard-assembly.mjs already proved (2026-08-16): `@{u}` is the WRONG ref. `@{u}` is a
// branch's OWN remote-tracking ref (e.g. `origin/acct-amort-k-1`), which goes stale the moment
// that branch is rebased locally without a matching push — merge-base(@{u}, HEAD) then lands
// far behind current origin/main, so the diff sweeps in every file OTHER PRs landed on main
// since that stale point, and this gate falsely fails them as "touched by this branch."
// Measured on a real rebased branch: @{u} resolved to a merge-base 17 commits behind
// origin/main, pulling in unrelated already-merged node shards. origin/main is the actual
// integration target and is what must be diffed against, in every environment.
// resolveBaseRef — thin wrapper over the shared scripts/diff-scope.mjs resolver, keeping this
// gate's own env-var override name (CLAUSE_DIGEST_BASE_REF, CLAUSE-DIGEST-SCOPE-FIX-1) and adding
// `--diff-scope <REF>` (GATE-MANIFEST-DRAFT.md §3 PREREQ-1) for free, via the shared candidate chain.
function resolveBaseRef(repo) {
  return resolveDiffScopeRef(repo, { envVar: 'CLAUSE_DIGEST_BASE_REF' });
}

// readOriginFileText — origin/main's raw text for `relPath`, or null if it can't be read (absent
// at baseRef, or any git failure). Used only for the ABSENT-KEY shielding fallback in
// makeIsPreExisting() — see that function's header for why this is needed alongside line-diffing.
export function readOriginFileText(baseRef, relPath, repo = REPO) {
  if (!baseRef) return null;
  try {
    return git(repo, ['show', `${baseRef}:${relPath}`]).toString();
  } catch {
    return null;
  }
}

export function touchedNodeFiles(repo = REPO, baseRef = resolveBaseRef(repo)) {
  const touched = new Set();
  const add = (out) => out.toString().split('\n').forEach((f) => f && touched.add(f.trim()));
  try {
    add(git(repo, ['diff', '--name-only', 'HEAD']));
  } catch { /* not a git repo / no HEAD yet — nothing tracked-modified */ }
  try {
    add(git(repo, ['diff', '--name-only', '--cached']));
  } catch { /* nothing staged */ }
  try {
    add(git(repo, ['ls-files', '--others', '--exclude-standard']));
  } catch { /* no untracked files */ }
  if (baseRef) {
    try {
      const base = git(repo, ['merge-base', baseRef, 'HEAD']).toString().trim();
      add(git(repo, ['diff', '--name-only', base, 'HEAD']));
    } catch { /* base resolved but diff failed — uncommitted/staged/untracked legs above still cover local work */ }
  } /* no candidate resolved (e.g. shallow checkout with no origin/main fetched) — same three legs still cover it */
  return touched;
}

export function loadRegistryDigests(registryPath) {
  if (!existsSync(registryPath)) return new Set();
  const arr = JSON.parse(readFileSync(registryPath, 'utf8'));
  return new Set(arr.map((r) => r.digest));
}

const ENTRY_REQUIRED = ['digest', 'source_url', 'retrieved_at', 'clause_path'];

/**
 * Pure validator: given a parsed node object + the set of registered digests, return
 * { ok, reasons[] }. Unit-tested directly — no filesystem, no git — by check-clause-digest.test.mjs.
 *
 * TOUCHTAX-DIFFSCOPE-1: optional 3rd arg `{ isPreExisting }` — a predicate `(descriptor) => boolean`
 * deciding whether a given requirement's underlying bytes are pre-existing (byte-identical to
 * origin/main) and therefore exempt, per J19 §3.3. `descriptor` is one of:
 *   { kind: 'basis' }                    — the standards_basis declaration itself
 *   { kind: 'entries-empty' }            — the "cited_clause_digest must be non-empty" requirement
 *   { kind: 'entry', index, entry }      — one cited_clause_digest[i] entry
 * Omitting the 3rd arg (every existing call site/test) makes `isPreExisting` always report `false`
 * — i.e. IDENTICAL behaviour to before this row, byte for byte. Shielding is opt-in per call site,
 * never a default that could silently soften an existing caller.
 */
export function validateNode(node, registryDigests, { isPreExisting: shieldedFn } = {}) {
  const shielded = (descriptor) => (typeof shieldedFn === 'function' ? !!shieldedFn(descriptor) : false);
  const reasons = [];
  const basis = node.standards_basis;
  const basisValid = basis === 'implements_standard' || basis === 'not_applicable' || basis === 'cites_informative';
  if (!basisValid) {
    if (shielded({ kind: 'basis' })) {
      // The declaration itself is byte-identical to origin/main — pre-existing gap this diff did
      // not write, never gated (SPEC.md §30.4), even though the file changed somewhere else.
      return { ok: true, reasons: [], shieldedGap: true };
    }
    reasons.push(`standards_basis missing or invalid (got ${JSON.stringify(basis)}) — must declare "implements_standard", "not_applicable", or "cites_informative" (SPEC.md §30.3)`);
    return { ok: false, reasons };
  }
  if (basis === 'not_applicable') return { ok: true, reasons: [] };

  const entries = Array.isArray(node.cited_clause_digest) ? node.cited_clause_digest : [];
  if (entries.length === 0) {
    if (shielded({ kind: 'entries-empty' })) return { ok: true, reasons: [], shieldedGap: true };
    reasons.push(`standards_basis is "${basis}" but cited_clause_digest is empty/missing (SPEC.md §30.1${basis === 'cites_informative' ? '/§30.3a' : ''})`);
    return { ok: false, reasons };
  }
  entries.forEach((e, i) => {
    if (shielded({ kind: 'entry', index: i, entry: e })) return; // byte-identical to origin/main — the PAYROLL kill-proof: pre-existing debt is never re-gated merely because the file moved elsewhere
    if (!e || typeof e !== 'object') { reasons.push(`cited_clause_digest[${i}] is not an object`); return; }
    const missing = ENTRY_REQUIRED.filter((k) => !e[k]);
    if (missing.length) { reasons.push(`cited_clause_digest[${i}] missing required member(s): ${missing.join(', ')}`); return; }
    if (!registryDigests.has(e.digest)) {
      reasons.push(`cited_clause_digest[${i}] digest ${e.digest} does not resolve to any entry in clause-snapshot-registry.json — a digest satisfied by an arbitrary string is not permitted (SPEC.md §30.5c)`);
    }
  });
  return { ok: reasons.length === 0, reasons };
}

/**
 * Build the `isPreExisting` predicate main() passes into validateNode() for one touched node file.
 * Maps each descriptor to a line number via a plain text search (lineOfText — digests/keys are
 * effectively-unique strings, see diff-scope.mjs's header) and asks the shared line-diff scope
 * whether that line is byte-identical to origin/main. Fails CLOSED by construction: `isPreExisting()`
 * itself already returns `false` whenever `scope.ok` is false or the needle can't be located — there
 * is no branch here that could accidentally shield something undeterminable.
 *
 * `originFileText` (optional, `null` when undeterminable — e.g. the file is brand new, or the diff
 * itself is undeterminable): origin/main's raw text for this SAME file. Needed for the ABSENT-KEY
 * case: `standards_basis` missing entirely has no line to anchor on (`lineOfText` returns -1), which
 * used to fall straight to "not shielded" — wrongly re-gating a node whose declaration was ALREADY
 * absent on origin/main and stayed absent, merely because some OTHER field in the same file changed
 * (measured live landing REGZ-CORRECTION-APPLY-1's #1502: art-218/220/234 corrected real threshold
 * values elsewhere in the same node file; standards_basis was undeclared before and after — a
 * genuine no-op for this requirement, not new debt). The key-absent case is now shielded when the
 * key is ALSO absent from origin/main's version of the SAME file — i.e. its absence itself did not
 * change. If origin/main's content can't be read (originFileText null) or DOES carry the key (this
 * diff evidently DELETED a prior declaration — a real, gate-worthy change), it stays unshielded.
 */
export function makeIsPreExisting(fileText, scope, originFileText = null) {
  return (descriptor) => {
    let lineNum = -1;
    if (descriptor.kind === 'basis' || descriptor.kind === 'entries-empty') {
      // No single line represents "the array is empty" — the declaration line is the closest
      // stable anchor, and an unchanged declaration with an unchanged (pre-existing) empty array
      // is the same pre-existing-gap class either way.
      lineNum = lineOfText(fileText, '"standards_basis"');
      if (lineNum === -1) {
        // Key entirely absent from the CURRENT file — shield only if it was ALSO absent on
        // origin/main (the absence itself is then unchanged, pre-existing debt).
        if (originFileText === null) return false; // undeterminable -> fail closed
        return !originFileText.includes('"standards_basis"');
      }
    } else if (descriptor.kind === 'entry') {
      if (!descriptor.entry || !descriptor.entry.digest) return false; // no stable identifier to locate -> not shielded, must validate
      lineNum = lineOfText(fileText, descriptor.entry.digest);
      if (lineNum === -1) return false; // can't locate the anchor line -> fail closed, not shielded
    }
    return isPreExisting(scope, lineNum);
  };
}

function main() {
  const baseRef = resolveBaseRef(REPO);
  const touched = touchedNodeFiles(REPO, baseRef);
  const registryDigests = loadRegistryDigests(REGISTRY_PATH);
  const files = existsSync(NODES_DIR) ? readdirSync(NODES_DIR).filter((f) => f.endsWith('.json')) : [];

  const failures = [];
  let gapCount = 0;
  let shieldedGapCount = 0;

  for (const name of files) {
    const abs = join(NODES_DIR, name);
    const rel = relative(REPO, abs).replace(/\\/g, '/');
    const fileText = readFileSync(abs, 'utf8');
    let node;
    try {
      node = JSON.parse(fileText);
    } catch (e) {
      failures.push(`${rel}: unparseable JSON (${e.message})`);
      continue;
    }
    const isTouched = touched.has(rel);
    const basis = node.standards_basis;
    const undeclared = basis !== 'implements_standard' && basis !== 'not_applicable' && basis !== 'cites_informative';

    if (!isTouched) {
      if (undeclared) gapCount++;
      continue; // never retro-gated (SPEC.md §30.4)
    }
    // TOUCHTAX-DIFFSCOPE-1: the FILE is touched, but only bytes this diff actually wrote are
    // gated — a standards_basis declaration or cited_clause_digest[] entry that is byte-identical
    // to origin/main is pre-existing debt, shielded regardless of what else in the file moved.
    const scope = changedLineSet(REPO, rel, baseRef);
    const originFileText = scope.ok && !scope.isNew ? readOriginFileText(baseRef, rel) : null;
    const { ok, reasons, shieldedGap } = validateNode(node, registryDigests, { isPreExisting: makeIsPreExisting(fileText, scope, originFileText) });
    if (shieldedGap) shieldedGapCount++;
    if (!ok) failures.push(`${rel} [${node.tool_id ?? '(no tool_id)'}]: ${reasons.join('; ')}`);
  }

  console.log(`check-clause-digest: SCOPE — this gate proves retrieval happened, it does NOT prove the retrieved text was read correctly (SPEC.md §30.0).`);
  console.log(`check-clause-digest: ${gapCount} pre-existing node(s) with no standards_basis declaration (gap, NOT gating, never backfilled — SPEC.md §30.4).`);
  if (shieldedGapCount) {
    console.log(`check-clause-digest: ${shieldedGapCount} touched node(s) had a pre-existing (byte-identical to origin/main) gap shielded from re-gating (TOUCHTAX-DIFFSCOPE-1, J19 §3.3) — not a failure, not backfilled.`);
  }

  if (failures.length) {
    console.error(`\ncheck-clause-digest: ${failures.length} FAILURE(s) on NEW/CHANGED node(s):\n  ` + failures.join('\n  '));
    console.error('\nDeclare standards_basis:"implements_standard" or "cites_informative" with >=1 valid, registry-resolved cited_clause_digest entry, or standards_basis:"not_applicable". See SPEC.md §30.');
    process.exit(1);
  }

  console.log(`check-clause-digest: OK (0 new/changed nodes missing a valid declaration).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
