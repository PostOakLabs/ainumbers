#!/usr/bin/env node
/**
 * check-clause-digest.mjs — CLAUSE-DIGEST-GATE-1, SPEC.md §30.
 *
 * Makes "a standards-implementing node shipped with behaviour never derived from retrieved primary
 * text" structurally impossible. Does NOT and cannot make "retrieved and read wrongly" impossible —
 * see the SCOPE line this gate always prints, and SPEC.md §30.0.
 *
 * WHAT IT CHECKS, on every NEW-or-CHANGED chaingraph/graph/nodes/*.json shard (branch-aware — same
 * touched-file detection check-chain-citation.mjs already uses for chains; a PRE-EXISTING/untouched
 * node is never gated, only counted as a gap):
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
import { execSync } from 'node:child_process';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NODES_DIR = resolve(REPO, 'chaingraph', 'graph', 'nodes');
const REGISTRY_PATH = resolve(REPO, 'chaingraph', 'standard', 'clause-snapshot-registry.json');
const env = process.env;

export function touchedNodeFiles(repo = REPO) {
  const touched = new Set();
  const add = (out) => out.toString().split('\n').forEach((f) => f && touched.add(f.trim()));
  try {
    add(execSync('git diff --name-only HEAD', { cwd: repo, env, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { /* not a git repo / no HEAD yet — nothing tracked-modified */ }
  try {
    add(execSync('git diff --name-only --cached', { cwd: repo, env, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { /* nothing staged */ }
  try {
    add(execSync('git ls-files --others --exclude-standard', { cwd: repo, env, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { /* no untracked files */ }
  try {
    const upstream = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: repo, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const base = execSync(`git merge-base ${upstream} HEAD`, { cwd: repo, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    add(execSync(`git diff --name-only ${base} HEAD`, { cwd: repo, env, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { /* no upstream configured — uncommitted/staged/untracked diff already covers local work */ }
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
