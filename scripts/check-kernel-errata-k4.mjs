#!/usr/bin/env node
/**
 * scripts/check-kernel-errata-k4.mjs: KERNEL-ERRATA-GATE-1-RESUME-1 gate K4, predicate width.
 *
 * For every erratum source record under chaingraph/errata/sources/, the gate samples inputs
 * around the witness vectors: the fixture corpus of the fixed version plus the missing-input
 * probes (each input deleted, set to null, set to a string). The affected witness itself is
 * drawn from this same corpus by the writer, so every sample is an input around the affected
 * vector. Wherever the old and the new kernel outputs differ, the predicate must be true:
 * a divergent probe outside the predicate is reported RED (too narrow). A predicate that is
 * true where outputs agree is ACCEPTED and reported as a count (too wide), which is what the
 * spec says a too-wide predicate deserves. A predicate that throws on a probe counts as not
 * true on it (and as an evaluation error, so the throw is never silently a pass).
 *
 * Two vacuous passes are guarded against: an entry with no fixture vectors to sample, and an
 * entry whose corpus shows no divergent probe at all (its affected witness could not hold)
 * are both RED, not green.
 *
 * ADVISORY: this script ALWAYS exits 0. Exit 2 is reserved for a usage error or a crash of
 * the harness itself. K4 is non-blocking until the desk flips it.
 *
 * Usage: node scripts/check-kernel-errata-k4.mjs [--root <repo>]
 * Self-test: scripts/check-kernel-errata-k4.selftest.mjs (too-narrow RED, too-wide counted)
 * Node built-ins only; no network, no clock, no randomness; writes nothing.
 */
import {
  REPO_ROOT, SOURCES_DIR, fixturePath, git, resolveCommit, loadKernelAt, loadPredicate, outcome, outcomeKey, probeVariants,
} from './lib/kernel-errata.mjs';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function loadSourceRecords(root) {
  const dir = join(root, SOURCES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => ({ file: f, entry: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
}

// The property test over a list of { file, entry } records.
export async function checkK4(root, records) {
  const out = [];
  for (const { file, entry } of records) {
    const id = entry?.id ?? file;
    const detail = { id, tool_id: entry?.tool_id ?? null, probes: 0, divergent: 0, too_narrow: 0, too_wide: 0, eval_errors: 0, reds: [] };
    try {
      const oldRef = resolveCommit(root, entry.kernel_source.old_ref);
      const newRef = resolveCommit(root, entry.kernel_source.new_ref);
      const oldK = await loadKernelAt(root, oldRef, entry.tool_id);
      const newK = await loadKernelAt(root, newRef, entry.tool_id);
      const fx = JSON.parse(git(root, ['show', `${newRef}:${fixturePath(entry.tool_id)}`]));
      const vectors = (fx.vectors ?? []).map((v) => v.policy_parameters).filter((p) => p && typeof p === 'object');
      if (!vectors.length) {
        detail.reds.push(`no fixture vectors for ${entry.tool_id} at the fixed ref: the property test has nothing to sample`);
        out.push(detail);
        continue;
      }
      const affected = await loadPredicate(root, entry.affected_predicate.path);
      for (const v of probeVariants(vectors)) {
        const [o, n] = [await outcome(oldK.mod, v.pp), await outcome(newK.mod, v.pp)];
        const diverges = outcomeKey(o) !== outcomeKey(n);
        let pred = false;
        try { pred = affected(structuredClone(v.pp)) === true; } catch { detail.eval_errors++; }
        detail.probes++;
        if (diverges) detail.divergent++;
        if (diverges && !pred) detail.too_narrow++;
        if (!diverges && pred) detail.too_wide++;
      }
      if (!detail.divergent) detail.reds.push('no divergent probe on this corpus: the affected witness cannot hold');
    } catch (e) {
      detail.reds.push(`could not run: ${e.message}`);
    }
    out.push(detail);
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const root = resolve(opt('--root') ?? REPO_ROOT);
  const records = loadSourceRecords(root);
  const details = await checkK4(root, records);
  let reds = 0;
  for (const d of details) {
    for (const r of d.reds) { console.log(`RED K4 ${d.id}: ${r}`); reds++; }
    console.log(`${d.too_narrow ? 'RED' : 'ok '} K4 ${d.id} (${d.tool_id}): probes ${d.probes}, divergent ${d.divergent}, too_narrow ${d.too_narrow}${d.too_narrow ? ' (RED)' : ''}, too_wide ${d.too_wide} (counted), eval_errors ${d.eval_errors}`);
    if (d.too_narrow) reds++;
  }
  console.log(`check-kernel-errata-k4 (K4 advisory): ${records.length} entr${records.length === 1 ? 'y' : 'ies'} sampled, ${reds} red${reds ? ' (K4 is non-blocking until the desk flips it)' : ''}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
