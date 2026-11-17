#!/usr/bin/env node
/**
 * scripts/gen-kernel-erratum.mjs: KERNEL-ERRATA-SCHEMA-1 writer.
 *
 *   node scripts/gen-kernel-erratum.mjs <tool-id> --old <ref> --new <ref> --id KE-2026-0001
 *        --class <class> --summary "<one sentence>" [--predicate <file>] [--published-at YYYY-MM-DD]
 *        [--root <repo>] [--write]
 *
 * Loads the two compute-module versions from git, runs the fixture corpus plus the
 * missing-input probes (each input deleted, set to null, set to a string) on both, and
 * for the two mechanical classes (fail-open-missing-input, fail-open-wrong-type) proposes
 * the predicate. Every other class takes a hand-written predicate via --predicate, which is
 * verified by exactly the same checks:
 *   - no divergent probe may fall outside the predicate (too narrow = refused),
 *   - a predicate that is true where outputs are equal is reported as a count (too wide),
 *   - a witness pair is picked (affected: hashes differ, predicate true; unaffected: hashes
 *     equal, predicate false) and the entry passes K1 and K3 before anything is written.
 * Without --write nothing touches disk. With --write the source record lands at
 * chaingraph/errata/sources/<id>.json and the predicate at chaingraph/errata/predicates/<id>.mjs.
 * Those are the records the main-side log writer reads; this script never edits registry/errata.
 *
 * Node built-ins only; no network, no clock (published_at is an argument), no randomness.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { policyParametersHash } from '../chaingraph/kernels/_hash.mjs';
import {
  REPO_ROOT, SOURCES_DIR, PREDICATES_DIR, CLASSES, ID_RE, git, fixturePath, resolveCommit, loadKernelAt, loadPredicate,
  outcome, outcomeKey, probeVariants, attribute, proposePredicate, lintPredicate, verifyEntry, sha256Text,
} from './lib/kernel-errata.mjs';

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--write') a.write = true;
    else if (t.startsWith('--')) a[t.slice(2)] = argv[++i];
    else a._.push(t);
  }
  return a;
}

export async function buildEntry({ root, toolId, oldRef, newRef, id, cls, summary, predicateSrc, publishedAt }) {
  const nodeId = /^(art-\d+)/.exec(toolId)?.[1] ?? toolId;
  const oldCommit = resolveCommit(root, oldRef);
  const newCommit = resolveCommit(root, newRef);
  const oldK = await loadKernelAt(root, oldCommit, toolId);
  const newK = await loadKernelAt(root, newCommit, toolId);
  const fx = JSON.parse(git(root, ['show', `${newCommit}:${fixturePath(toolId)}`]));
  const vectors = (fx.vectors ?? []).map((v) => v.policy_parameters).filter((p) => p && typeof p === 'object');
  if (!vectors.length) throw new Error(`${toolId}: no fixture vectors at ${newCommit}`);
  const variants = probeVariants(vectors);
  const rows = [];
  for (const v of variants) {
    const [o, n] = [await outcome(oldK.mod, v.pp), await outcome(newK.mod, v.pp)];
    rows.push({ ...v, o, n, diverges: outcomeKey(o) !== outcomeKey(n) });
  }
  const divergent = rows.filter((r) => r.diverges);
  let src = predicateSrc;
  if (!src) {
    src = proposePredicate(cls, await attribute(rows, vectors, oldK.mod, newK.mod), vectors, id);
    if (!src) throw new Error(`class ${cls}: no mechanical predicate can be proposed (${divergent.length} divergent probes); supply --predicate <file>`);
  }
  const lint = lintPredicate(src);
  if (lint.length) throw new Error(`K3 predicate purity: ${lint.join('; ')}`);
  // Evaluate the predicate through a temp file in the real predicates dir path form.
  const rel = `${PREDICATES_DIR}/${id}.mjs`;
  const tmp = join(root, rel);
  const existed = existsSync(tmp);
  if (existed && readFileSync(tmp, 'utf8') !== src) throw new Error(`${rel} already exists with different content (entries are never edited)`);
  mkdirSync(join(root, PREDICATES_DIR), { recursive: true });
  writeFileSync(tmp, src);
  const affected = await loadPredicate(root, rel);
  let narrow = 0, wide = 0, hit = 0;
  for (const r of rows) {
    r.pred = affected(structuredClone(r.pp)) === true;
    if (r.pred) hit++;
    if (r.diverges && !r.pred) narrow++;
    if (!r.diverges && r.pred) wide++;
  }
  const stats = { probes: rows.length, divergent: divergent.length, predicate_true: hit, too_narrow: narrow, too_wide: wide };
  if (narrow) {
    if (!existed) rmSync(tmp);
    throw new Error(`predicate is too narrow: ${narrow} divergent probes fall outside it ${JSON.stringify(stats)}`);
  }
  const okBoth = (r) => r.o.hash !== null && r.n.hash !== null;
  const aff = rows.find((r) => r.diverges && r.pred && okBoth(r));
  const una = rows.find((r) => !r.diverges && !r.pred && okBoth(r));
  if (!aff) throw new Error(`no affected witness vector found ${JSON.stringify(stats)}`);
  if (!una) throw new Error(`no unaffected witness vector found ${JSON.stringify(stats)}`);
  const wit = async (r) => ({
    policy_parameters: r.pp,
    policy_parameters_hash: await policyParametersHash(r.pp),
    old_execution_hash: r.o.hash,
    new_execution_hash: r.n.hash,
  });
  const entry = {
    kind: 'kernel',
    id,
    node_id: nodeId,
    tool_id: toolId,
    kernel_digest_affected: [oldK.digest],
    kernel_digest_fixed: newK.digest,
    kernel_source: { old_ref: oldCommit, new_ref: newCommit },
    class: cls,
    summary,
    affected_predicate: { path: rel, sha256: sha256Text(src) },
    witness: { affected: await wit(aff), unaffected: await wit(una) },
    published_at: publishedAt,
  };
  const errs = await verifyEntry(root, entry);
  if (errs.length) {
    if (!existed) rmSync(tmp);
    throw new Error(`K1 witness check failed: ${errs.join('; ')}`);
  }
  return { entry, src, stats, created: !existed };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const toolId = a._[0];
  const root = resolve(a.root ?? REPO_ROOT);
  const need = ['old', 'new', 'id', 'class', 'summary', 'published-at'].filter((k) => !a[k]);
  if (!toolId || need.length) { console.error(`usage: gen-kernel-erratum.mjs <tool-id> --old <ref> --new <ref> --id KE-YYYY-NNNN --class <class> --summary <text> --published-at <date> [--predicate <file>] [--write]\nmissing: ${need.join(', ')}`); process.exit(2); }
  if (!ID_RE.test(a.id)) { console.error(`bad id ${a.id}`); process.exit(2); }
  if (!CLASSES.includes(a.class)) { console.error(`bad class ${a.class}; one of ${CLASSES.join(', ')}`); process.exit(2); }
  const srcPath = join(root, SOURCES_DIR, `${a.id}.json`);
  if (existsSync(srcPath)) { console.error(`${a.id} already exists: an entry id is never reused or edited; write a new entry that names this one`); process.exit(1); }
  try {
    const { entry, src, stats, created } = await buildEntry({
      root, toolId, oldRef: a.old, newRef: a.new, id: a.id, cls: a.class, summary: a.summary, publishedAt: a['published-at'],
      predicateSrc: a.predicate ? readFileSync(resolve(a.predicate), 'utf8') : null,
    });
    console.log(`OK ${a.id} ${toolId} ${JSON.stringify(stats)}`);
    if (a.write) {
      mkdirSync(join(root, SOURCES_DIR), { recursive: true });
      writeFileSync(join(root, entry.affected_predicate.path), src);
      writeFileSync(srcPath, JSON.stringify(entry, null, 2) + '\n');
      console.log(`wrote ${SOURCES_DIR}/${a.id}.json and ${entry.affected_predicate.path}`);
    } else {
      if (created) rmSync(join(root, entry.affected_predicate.path));
      console.log('dry run (no --write): nothing written');
      console.log(JSON.stringify(entry, null, 2));
    }
  } catch (e) {
    console.error(`REFUSED ${a.id}: ${e.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
