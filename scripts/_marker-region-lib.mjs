#!/usr/bin/env node
/**
 * scripts/_marker-region-lib.mjs — shared marker-region integrity guards.
 *
 * Every generator that injects content between sentinel markers shares one
 * failure class: a DUPLICATED marker silently survives a first-match
 * indexOf/regex replace, so a stale copy of the generated region ships beside
 * the fresh one. The sitemap.html search outage is the worked example: an
 * orphaned second `const TOTAL` block sat beside the live one, was a SyntaxError
 * that killed the page's whole inline script, and every gate stayed green
 * because the freshness checks only compared the first match.
 *
 * These helpers make the marker COUNT a guarded invariant: exactly one START
 * and one END (or, for heal-on-insert regions, at most one), START before END.
 * Callers throw/print-and-exit on assertion failure — the message names the
 * region and the measured counts.
 *
 * Zero dependencies (node built-ins only). ESM, mirrors _changed-files-lib.js
 * in role: a library, not a gate — the generators that use it are the gates.
 */

function countOf(src, needle) {
  let n = 0;
  let at = 0;
  while ((at = src.indexOf(needle, at)) !== -1) {
    n++;
    at += needle.length;
  }
  return n;
}

/**
 * Assert a marker region is injectable.
 *   max        — maximum allowed occurrences of each marker (default 1).
 *   allowZero  — permit zero occurrences of BOTH markers (heal-on-insert
 *                regions that legitimately insert on first run); returns null.
 * Throws when: counts disagree between START and END, either count exceeds
 * `max`, or END appears before START. Returns { startIdx, endIdx } (endIdx
 * inclusive of the END marker) for callers that splice by index.
 */
function assertMarkerRegion(src, start, end, label, { max = 1, allowZero = false } = {}) {
  const starts = countOf(src, start);
  const ends = countOf(src, end);
  if (allowZero && starts === 0 && ends === 0) return null;
  if (starts !== ends || starts > max) {
    throw new Error(
      `${label}: expected at most ${max} occurrence(s) of the marker pair, found ${starts} × START (${start}) and ${ends} × END (${end}). ` +
        `A duplicated or orphaned marker region silently drifts — remove the stale copy so exactly one remains, then re-run.`
    );
  }
  const startIdx = src.indexOf(start);
  const endIdx = src.indexOf(end);
  if (endIdx < startIdx) {
    throw new Error(`${label}: END marker appears before START marker — region is malformed; restore the marker order and re-run.`);
  }
  return { startIdx, endIdx: endIdx + end.length };
}

export { countOf, assertMarkerRegion };
