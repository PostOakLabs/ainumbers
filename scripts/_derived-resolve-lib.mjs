/**
 * _derived-resolve-lib.mjs — the DERIVED_ROOT overlay resolver as a LEAF module.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS (S18-FRESHNESS-MERGEGROUP-DERIVED-ROOT-1, 2026-10-31) — cycle integrity,
 * measured by DERIVED-SET-SELFTEST-1, not hygiene.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * derived-artifacts.mjs statically imports RECEIPT_BUNDLES_WRITES_REPORT_PATH from
 * gen-receipt-bundles.mjs, which imports computeStaleness from
 * check-s18-digest-freshness.mjs. When check-s18-digest-freshness.mjs in turn statically
 * imported derivedResolve FROM derived-artifacts.mjs (this row's original shape), that closed
 * the cycle derived-artifacts → gen-receipt-bundles → check-s18-digest-freshness →
 * derived-artifacts — and whenever gen-receipt-bundles.mjs was the ENTRY process (exactly what
 * DERIVED-SET-SELFTEST-1 does: it executes every COVERED regen command as its own process in a
 * scratch worktree), ESM's cycle rule skipped the still-evaluating entry module, so
 * derived-artifacts.mjs's own top-level read of RECEIPT_BUNDLES_WRITES_REPORT_PATH (the
 * 'receipt-bundles' entry's writesReport field) evaluated against an uninitialized binding:
 *
 *     ReferenceError: Cannot access 'RECEIPT_BUNDLES_WRITES_REPORT_PATH' before initialization
 *         at scripts/derived-artifacts.mjs (receipt-bundles entry literal)
 *
 * The lazily-cached resolveCgPath() in check-s18-digest-freshness.mjs fixes the OTHER entry
 * shapes but cannot fix this one: ANY evaluation of derived-artifacts.mjs from inside
 * gen-receipt-bundles' import graph re-creates the TDZ. The resolver is therefore a LEAF — it
 * imports nothing from this estate — and check-s18-digest-freshness.mjs and its .test.mjs
 * import it from here instead of from derived-artifacts.mjs. derived-artifacts.mjs re-exports
 * both functions verbatim, so every other importer (check-a11y-tree.mjs,
 * check-compute-proof-coverage.mjs, …) is unchanged.
 */
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The non-empty DERIVED_ROOT, or '' — CI merge_group jobs only by convention,
 *  but any caller that sets the variable explicitly opts in to the overlay. */
export function derivedRoot() {
  const dr = process.env.DERIVED_ROOT;
  return dr && dr.trim() ? dr.trim() : '';
}

/** Resolve a repo-relative derived-artifact path against the ephemeral tree
 *  when one is mounted, falling back to the real repo (overlay semantics: only
 *  files the assembly actually produced come from the scratch root). Accepts
 *  path segments, e.g. derivedResolve('chaingraph', 'chaingraph.json'). */
export function derivedResolve(...parts) {
  const rel = parts.join('/');
  const dr = derivedRoot();
  const scratch = dr ? resolve(REPO, dr, ...parts) : null;
  return scratch && existsSync(scratch) ? scratch : resolve(REPO, ...parts);
}
