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
 *   1. The node declares standards_basis: "implements_standard" | "not_applicable". Neither present
 *      on a touched node is a FAILURE — no silent default (SPEC.md §30.3).
 *   2. "not_applicable" requires nothing further (explicit, honest opt-out).
 *   3. "implements_standard" requires a non-empty cited_clause_digest[], each entry structurally valid
 *      (digest, source_url, retrieved_at, clause_path present).
 *   4. INDEPENDENT DERIVATION (SO #34): every entry's `digest` MUST resolve to a real entry in
 *      chaingraph/standard/clause-snapshot-registry.json — written only by pin-clause-snapshot.mjs,
 *      which itself refuses whole-document-sized excerpts (SPEC.md §30.2). A digest that does not
 *      resolve to a registered snapshot FAILS: a gate satisfied by an arbitrary string is theatre.
 *
 * Pre-existing gap (untouched nodes with no standards_basis) is reported as a COUNT, never a ratio,
 * never a CI failure, never backfilled (SPEC.md §30.4).
 *
 * Usage: node scripts/check-clause-digest.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

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
function scrubbedEnv() {
  const e = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!/^GIT_/i.test(k) && v !== undefined) e[k] = v;
  }
  return e;
}

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, env: scrubbedEnv(), stdio: ['ignore', 'pipe', 'ignore'] });
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
function resolveBaseRef(repo) {
  const candidates = [];
  if (process.env.CLAUSE_DIGEST_BASE_REF) candidates.push(process.env.CLAUSE_DIGEST_BASE_REF);
  candidates.push('origin/main');
  if (process.env.GITHUB_BASE_REF) candidates.push(`origin/${process.env.GITHUB_BASE_REF}`);
  for (const ref of candidates) {
    try {
      // `^{commit}` is a cmd.exe escape sequence on Windows and gets silently mangled if this
      // were run through a shell (execSync with a string) — execFileSync passes argv straight
      // to git with no shell in between, which is why every call in this module uses it.
      git(repo, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
      return ref;
    } catch { /* does not resolve in this checkout — try next candidate */ }
  }
  return null;
}

export function touchedNodeFiles(repo = REPO) {
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
  const baseRef = resolveBaseRef(repo);
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

/** Pure validator: given a parsed node object + the set of registered digests, return
 *  { ok, reasons[] }. Unit-tested directly — no filesystem, no git — by check-clause-digest.test.mjs. */
export function validateNode(node, registryDigests) {
  const reasons = [];
  const basis = node.standards_basis;
  if (basis !== 'implements_standard' && basis !== 'not_applicable') {
    reasons.push(`standards_basis missing or invalid (got ${JSON.stringify(basis)}) — must declare "implements_standard" or "not_applicable" (SPEC.md §30.3)`);
    return { ok: false, reasons };
  }
  if (basis === 'not_applicable') return { ok: true, reasons: [] };

  const entries = Array.isArray(node.cited_clause_digest) ? node.cited_clause_digest : [];
  if (entries.length === 0) {
    reasons.push('standards_basis is "implements_standard" but cited_clause_digest is empty/missing (SPEC.md §30.1)');
    return { ok: false, reasons };
  }
  entries.forEach((e, i) => {
    if (!e || typeof e !== 'object') { reasons.push(`cited_clause_digest[${i}] is not an object`); return; }
    const missing = ENTRY_REQUIRED.filter((k) => !e[k]);
    if (missing.length) { reasons.push(`cited_clause_digest[${i}] missing required member(s): ${missing.join(', ')}`); return; }
    if (!registryDigests.has(e.digest)) {
      reasons.push(`cited_clause_digest[${i}] digest ${e.digest} does not resolve to any entry in clause-snapshot-registry.json — a digest satisfied by an arbitrary string is not permitted (SPEC.md §30.5c)`);
    }
  });
  return { ok: reasons.length === 0, reasons };
}

function main() {
  const touched = touchedNodeFiles();
  const registryDigests = loadRegistryDigests(REGISTRY_PATH);
  const files = existsSync(NODES_DIR) ? readdirSync(NODES_DIR).filter((f) => f.endsWith('.json')) : [];

  const failures = [];
  let gapCount = 0;

  for (const name of files) {
    const abs = join(NODES_DIR, name);
    const rel = relative(REPO, abs).replace(/\\/g, '/');
    let node;
    try {
      node = JSON.parse(readFileSync(abs, 'utf8'));
    } catch (e) {
      failures.push(`${rel}: unparseable JSON (${e.message})`);
      continue;
    }
    const isTouched = touched.has(rel);
    const basis = node.standards_basis;
    const undeclared = basis !== 'implements_standard' && basis !== 'not_applicable';

    if (!isTouched) {
      if (undeclared) gapCount++;
      continue; // never retro-gated (SPEC.md §30.4)
    }
    const { ok, reasons } = validateNode(node, registryDigests);
    if (!ok) failures.push(`${rel} [${node.tool_id ?? '(no tool_id)'}]: ${reasons.join('; ')}`);
  }

  console.log(`check-clause-digest: SCOPE — this gate proves retrieval happened, it does NOT prove the retrieved text was read correctly (SPEC.md §30.0).`);
  console.log(`check-clause-digest: ${gapCount} pre-existing node(s) with no standards_basis declaration (gap, NOT gating, never backfilled — SPEC.md §30.4).`);

  if (failures.length) {
    console.error(`\ncheck-clause-digest: ${failures.length} FAILURE(s) on NEW/CHANGED node(s):\n  ` + failures.join('\n  '));
    console.error('\nDeclare standards_basis:"implements_standard" with >=1 valid, registry-resolved cited_clause_digest entry, or standards_basis:"not_applicable". See SPEC.md §30.');
    process.exit(1);
  }

  console.log(`check-clause-digest: OK (0 new/changed nodes missing a valid declaration).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
