#!/usr/bin/env node
/**
 * scripts/check-kernel-errata-k2.mjs: KERNEL-ERRATA-GATE-1-RESUME-1 gate K2, no silent fix.
 *
 * A PR that modifies an existing compute module (chaingraph/kernels/<tool-id>.kernel.mjs,
 * present at the merge base) must do one of two things:
 *   - add an erratum source record under chaingraph/errata/sources/ whose
 *     kernel_digest_affected names the old digest of that module at the merge base, or
 *   - carry a no-semantic-change declaration at
 *     chaingraph/errata/no-semantic-change/<tool-id>.json whose old_digest and new_digest
 *     pin exactly this change. For a declaration the gate runs the fixture corpus plus the
 *     missing-input probes (each input deleted, set to null, set to a string) on both
 *     versions and requires byte-equal outputs; one divergent probe contradicts it.
 *
 * Added, renamed and deleted modules are not fixes in place and are reported out of scope.
 * A source-only edit that does not move the canonical digest (a line-ending-only edit) owes
 * neither an erratum nor a declaration.
 *
 * ADVISORY: this script ALWAYS exits 0. Exit 2 is reserved for a usage error or a crash of
 * the harness itself. K2 is advisory on PRs as staged 2026-11-15; the flip to blocking is
 * the desk's decision under the errata build spec (bar: two weeks advisory with zero false
 * reds).
 *
 * Usage:
 *   node scripts/check-kernel-errata-k2.mjs [--root <repo>] [--base <ref>] [--head <ref>]
 *       [--replay <n>]
 *   --base    default origin/main; the merge base of --base and --head is the old state
 *   --head    default HEAD
 *   --replay  walk the last <n> commits that modified a kernel in place and classify each
 *             the way a PR run would; this is the retrospective the row owes
 *
 * The declaration shape is written and validated, never generated: this script writes
 * nothing, keeps no baseline, and supports no --check flag of its own.
 * Self-test: scripts/check-kernel-errata-k2.selftest.mjs (RED and GREEN on real fix pairs)
 * Node built-ins only; no network, no clock, no randomness.
 */
import {
  REPO_ROOT, SOURCES_DIR, fixturePath, git, resolveCommit, loadKernelAt, outcome, outcomeKey, probeVariants,
} from './lib/kernel-errata.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DECL_DIR = 'chaingraph/errata/no-semantic-change';
const KERNELS_DIR = 'chaingraph/kernels';
const DECL_RE = /^sha256:[0-9a-f]{64}$/;

// M-status kernel files between two commits. Status letters other than M (a new module, a
// rename, a deletion) are not fixes in place; the caller reports them out of scope.
export function collectModifiedKernels(root, baseCommit, headCommit) {
  const rows = git(root, ['diff', '--name-status', baseCommit, headCommit, '--', `${KERNELS_DIR}/`]).split('\n').filter(Boolean);
  const out = [];
  for (const row of rows) {
    const i = row.indexOf('\t');
    const status = row.slice(0, i);
    const path = row.slice(i + 1);
    const m = new RegExp(`^${KERNELS_DIR}/(.+)\\.kernel\\.mjs$`).exec(path);
    if (m) out.push({ toolId: m[1], status, path });
  }
  return out;
}

// Entries recorded at a ref. An unreadable record is skipped here on purpose: K1 (hard) owns
// the shape, and a broken record simply cannot name a digest, so K2 stays red for the kernel
// it was meant to cover.
export function loadEntriesAt(root, ref) {
  let paths;
  try { paths = git(root, ['ls-tree', '-r', '--name-only', ref, '--', `${SOURCES_DIR}/`]).split('\n').filter(Boolean); } catch { return []; }
  const out = [];
  for (const p of paths) {
    if (!p.endsWith('.json')) continue;
    try { out.push({ path: p, entry: JSON.parse(git(root, ['show', `${ref}:${p}`])) }); } catch { /* K1 reports this */ }
  }
  return out;
}

// Pure declaration validation. A declaration pins exactly one change: same module, digest at
// the old state, digest at the new state, a date, and the row or PR that made the change.
export function validateDeclaration(decl, expect) {
  const errs = [];
  if (!decl || typeof decl !== 'object' || Array.isArray(decl)) return ['declaration is not a JSON object'];
  if (decl.kind !== 'no-semantic-change') errs.push(`kind must be "no-semantic-change", got ${JSON.stringify(decl.kind ?? null)}`);
  if (decl.tool_id !== expect.toolId) errs.push(`tool_id ${JSON.stringify(decl.tool_id ?? null)} does not match ${expect.toolId}`);
  for (const [key, want] of [['old_digest', expect.oldDigest], ['new_digest', expect.newDigest]]) {
    const got = decl[key];
    if (typeof got !== 'string' || !DECL_RE.test(got)) errs.push(`${key} is not a sha256: digest`);
    else if (got !== want) errs.push(`${key} pins a different change (${got.slice(0, 14)}... vs ${want.slice(0, 14)}...)`);
  }
  if (typeof decl.declared_at !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(decl.declared_at)) errs.push('declared_at must be YYYY-MM-DD');
  if (typeof decl.row !== 'string' || !decl.row.trim()) errs.push('row must name the row or PR that made the change');
  return errs;
}

// The declaration's proof obligation: fixture corpus plus missing-input probes on both
// versions, byte-equal on every probe. Refusals compare by outcome key (two refusals by
// exception are the same outcome, whatever their message says), matching the writer.
export async function verifyNoSemanticChange(root, oldRef, newRef, toolId) {
  const oldK = await loadKernelAt(root, oldRef, toolId);
  const newK = await loadKernelAt(root, newRef, toolId);
  let vectors = null;
  try {
    const fx = JSON.parse(git(root, ['show', `${newRef}:${fixturePath(toolId)}`]));
    vectors = (fx.vectors ?? []).map((v) => v.policy_parameters).filter((p) => p && typeof p === 'object');
  } catch { /* fall through to the no-corpus red */ }
  if (!vectors || !vectors.length) return { ok: false, reason: `no fixture corpus for ${toolId} at ${newRef.slice(0, 10)}: a declaration cannot be verified without fixtures (add fixtures or file an erratum)` };
  const variants = probeVariants(vectors);
  let divergent = 0;
  for (const v of variants) {
    const [o, n] = [await outcome(oldK.mod, v.pp), await outcome(newK.mod, v.pp)];
    if (outcomeKey(o) !== outcomeKey(n)) divergent++;
  }
  return { ok: divergent === 0, probes: variants.length, divergent };
}

function declarationAt(root, ref, toolId) {
  const path = `${DECL_DIR}/${toolId}.json`;
  try { return { path, decl: JSON.parse(git(root, ['show', `${ref}:${path}`])) }; } catch { return { path, decl: null }; }
}

// The gate over one base/head pair. opts.entries replaces the head-side record set,
// opts.baseEntries the base-side set, and opts.declarations (Map of toolId -> declaration
// object) overrides the declaration files, so the self-test can plant controls without
// touching the tree.
export async function checkK2(root, baseCommit, headCommit, opts = {}) {
  const lines = [];
  const modified = collectModifiedKernels(root, baseCommit, headCommit);
  const inScope = modified.filter((m) => m.status === 'M');
  for (const m of modified.filter((m) => m.status !== 'M')) {
    lines.push({ red: false, toolId: m.toolId, text: `K2 ${m.toolId}: ${m.status} (added/renamed/deleted module) is not a fix in place; out of scope` });
  }
  const headEntries = opts.entries ?? loadEntriesAt(root, headCommit);
  const baseEntries = opts.baseEntries ?? (opts.entries ? [] : loadEntriesAt(root, baseCommit));
  const basePathSet = new Set(baseEntries.map((r) => r.path));
  const newEntries = headEntries.filter((r) => !basePathSet.has(r.path));
  for (const m of inScope) {
    const oldK = await loadKernelAt(root, baseCommit, m.toolId);
    const newK = await loadKernelAt(root, headCommit, m.toolId);
    if (oldK.digest === newK.digest) {
      lines.push({ red: false, toolId: m.toolId, text: `K2 ${m.toolId}: canonical digest unchanged (line-ending-only edit); no erratum owed` });
      continue;
    }
    const naming = newEntries.filter((r) => r.entry?.tool_id === m.toolId
      && Array.isArray(r.entry.kernel_digest_affected)
      && r.entry.kernel_digest_affected.map(String).includes(oldK.digest));
    if (naming.length) {
      lines.push({ red: false, toolId: m.toolId, text: `K2 ${m.toolId}: erratum ${naming.map((r) => r.entry.id).join(', ')} names the old digest` });
      continue;
    }
    const injected = opts.declarations?.get(m.toolId);
    const { decl } = injected ? { decl: injected } : declarationAt(root, headCommit, m.toolId);
    if (decl) {
      const errs = validateDeclaration(decl, { toolId: m.toolId, oldDigest: oldK.digest, newDigest: newK.digest });
      if (errs.length) lines.push({ red: true, toolId: m.toolId, text: `K2 ${m.toolId}: declaration rejected (${errs.join('; ')})` });
      else {
        const v = await verifyNoSemanticChange(root, baseCommit, headCommit, m.toolId);
        if (!v.ok && v.reason) lines.push({ red: true, toolId: m.toolId, text: `K2 ${m.toolId}: ${v.reason}` });
        else if (!v.ok) lines.push({ red: true, toolId: m.toolId, text: `K2 ${m.toolId}: declaration contradicted by ${v.divergent} of ${v.probes} probes (outputs differ; file an erratum instead)` });
        else lines.push({ red: false, toolId: m.toolId, text: `K2 ${m.toolId}: no-semantic-change declaration verified (${v.probes} probes byte-equal)` });
      }
      continue;
    }
    lines.push({ red: true, toolId: m.toolId, text: `K2 ${m.toolId}: modified in place without an erratum naming the old digest ${oldK.digest} and without a no-semantic-change declaration` });
  }
  return { lines, examined: inScope.length };
}

// Commits that modified at least one kernel in place, newest first. For a merge commit the
// first parent is the pre-merge main, so the pair (C^, C) is exactly the PR's effect.
export function replayCommits(root, n) {
  return git(root, ['log', '--format=%H', '--diff-filter=M', '-n', String(n), '--', `${KERNELS_DIR}/`]).split('\n').filter(Boolean);
}

function mergeBase(root, a, b) {
  return git(root, ['merge-base', a, b]).trim();
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const root = resolve(opt('--root') ?? REPO_ROOT);
  const replayN = opt('--replay');
  if (replayN !== undefined) {
    const n = Number(replayN);
    if (!Number.isInteger(n) || n < 1) { console.error('usage: --replay <n> with a positive integer'); process.exit(2); }
    for (const c of replayCommits(root, n)) {
      const { lines } = await checkK2(root, `${c}^`, c);
      console.log(`REPLAY ${c.slice(0, 10)}`);
      for (const l of lines) console.log(`  ${l.red ? 'RED' : 'ok '} ${l.text}`);
    }
    console.log(`check-kernel-errata-k2 replay: classified (advisory)`);
    return;
  }
  const baseRef = opt('--base') ?? 'origin/main';
  const headRef = opt('--head') ?? 'HEAD';
  let baseCommit, headCommit;
  try {
    baseCommit = resolveCommit(root, baseRef);
    headCommit = resolveCommit(root, headRef);
  } catch (e) { console.error(`cannot resolve refs: ${e.message}`); process.exit(2); }
  const mb = mergeBase(root, baseCommit, headCommit);
  const { lines, examined } = await checkK2(root, mb, headCommit);
  for (const l of lines) console.log(`${l.red ? 'RED' : 'ok '} ${l.text}`);
  const reds = lines.filter((l) => l.red).length;
  console.log(`check-kernel-errata-k2 (K2 advisory): ${examined} in-place kernel modification${examined === 1 ? '' : 's'} examined, ${reds} red${reds ? ' (K2 is non-blocking until the desk flips it)' : ''}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
