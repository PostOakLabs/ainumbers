#!/usr/bin/env node
/**
 * check-ap2-contract.mjs — ratchet-baseline gate over the four AP2 bulk
 * contract-gap classes named in `0xAlpha/audits/2026-08-21-html-header-
 * footer-ap2-audit.md` Finding D / Rec B3-C3 (AP2-DEBT-BASELINE-1).
 *
 * Scope: every `tools/*.html` file that carries `id="ap2ExportBtn"` (the
 * AINumbers Policy Mandate export toggle, CONTRACT §3.2 — NOT Google's AP2
 * payments protocol; the id is a retained legacy name). For each such file,
 * four independent boolean classes are measured:
 *
 *   noRow        — no `.results-export-row` container exists anywhere in
 *                  the file. The button cannot be inside the mandated
 *                  container because the container itself is absent.
 *   outsideRow   — a `.results-export-row` container exists, but the
 *                  `id="ap2ExportBtn"` element is not nested inside any of
 *                  them (found via a tag-depth walk, not a substring guess,
 *                  since the audit's own example (T332) has an unrelated
 *                  `.results-export-row` div elsewhere in the file that a
 *                  naive "does the string appear before/after" check would
 *                  misclassify).
 *   neverEnabled — the string `ap2ExportBtn` occurs exactly once in the raw
 *                  file (the element's own `id="..."` attribute) — i.e. no
 *                  `<script>` ever references it, so no code path can ever
 *                  flip `disabled` off. Matches the audit's own methodology
 *                  ("sample-verified: exactly 1 occurrence in file = the
 *                  element itself").
 *   noSchema     — no `AP2Schema` reference anywhere in the file, meaning
 *                  any wired exporter bypasses the mandated
 *                  `AP2Schema.validate()` call before download.
 *
 * These are the SAME four classes the audit called (in order) "no
 * .results-export-row anywhere" (77), "button sits outside its export row"
 * (11), "zero JS references to ap2ExportBtn" (113), and "no AP2Schema
 * reference" (131) — re-measured fresh against the current tree rather than
 * copied from the audit text (two fix rows, AP2-DEADTOGGLE-FIX-1 and
 * AP2-MANIFEST-PARITY-1, landed since and moved several files out of these
 * classes; SO #34/#48).
 *
 * RATCHET MECHANISM — copy-hallmarks.mjs's baseline shape, verbatim:
 *   scripts/ap2-contract-baseline.json lists, per class, EXACTLY the legacy
 *   files still carrying that debt as of this row. A file not named in a
 *   class's baseline list must be CLEAN in that class — new tools, and any
 *   existing tool a future PR touches enough to newly regress, fail hard.
 *   A baselined file may keep its grandfathered debt; if it stops
 *   violating, `--update` shrinks the baseline (the count only ever goes
 *   down, never up — SO's standing baseline warning).
 *
 * Usage:
 *   node scripts/check-ap2-contract.mjs            # gate (preflight + CI)
 *   node scripts/check-ap2-contract.mjs --update    # regenerate the baseline from the current tree
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE_PATH = resolve(REPO, 'scripts', 'ap2-contract-baseline.json');
const UPDATE = process.argv.includes('--update');

export const CLASSES = ['noRow', 'outsideRow', 'neverEnabled', 'noSchema'];
const CLASS_LABEL = {
  noRow: 'no .results-export-row anywhere in the file',
  outsideRow: '.results-export-row exists but the button is not nested inside it',
  neverEnabled: 'zero JS references to ap2ExportBtn (permanently disabled)',
  noSchema: 'no AP2Schema reference (download bypasses validate-before-download)',
};

const BUTTON_MARKER = /id\s*=\s*"ap2ExportBtn"/;
const BUTTON_TAG_RE = /<[^>]*\bid\s*=\s*"ap2ExportBtn"[^>]*>/;
const ROW_CLASS_RE = /class\s*=\s*["'][^"']*\bresults-export-row\b[^"']*["']/i;
const DIV_TAG_RE = /<div\b[^>]*>|<\/div>/gi;

/**
 * Tag-depth walk (not a substring guess): returns [start, end) index ranges
 * for every <div> whose OWN opening tag carries the results-export-row
 * class, matched to its own closing </div> via a depth stack so nested divs
 * inside it (or an unrelated results-export-row div elsewhere in the file)
 * can never be confused with one another. Exported for the paired self-test.
 */
export function findResultsExportRowSpans(html) {
  const spans = [];
  const stack = [];
  DIV_TAG_RE.lastIndex = 0;
  let m;
  while ((m = DIV_TAG_RE.exec(html))) {
    if (m[0][1] === 'd' || m[0][1] === 'D') {
      // opening <div ...>
      stack.push({ start: m.index, isRow: ROW_CLASS_RE.test(m[0]) });
    } else {
      // closing </div>
      const top = stack.pop();
      if (top && top.isRow) spans.push([top.start, DIV_TAG_RE.lastIndex]);
    }
  }
  return spans;
}

/**
 * Classify one file's raw HTML text against the four AP2 bulk-debt classes.
 * Returns null if the file has no ap2ExportBtn at all (out of scope for
 * this gate — a tool with no export button cannot have a misplaced one).
 * Exported for the paired self-test (AP2-CONTRACT-SELFTEST-1 pairing).
 */
export function classify(html) {
  if (!BUTTON_MARKER.test(html)) return null;
  const rowSpans = findResultsExportRowSpans(html);
  const noRow = rowSpans.length === 0;
  let outsideRow = false;
  if (!noRow) {
    const tagMatch = BUTTON_TAG_RE.exec(html);
    const buttonIdx = tagMatch ? tagMatch.index : html.search(BUTTON_MARKER);
    outsideRow = !rowSpans.some(([s, e]) => buttonIdx >= s && buttonIdx < e);
  }
  const totalRefs = (html.match(/ap2ExportBtn/g) || []).length;
  const neverEnabled = totalRefs <= 1;
  const noSchema = !/AP2Schema/.test(html);
  return { noRow, outsideRow, neverEnabled, noSchema };
}

const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', '.claude', '.wt', 'worktrees']);
function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP_DIRS.has(name)) continue;
    const st = statSync(p);
    if (st.isDirectory()) htmlFiles(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** Scan tools/*.html and return { rel -> classification } for every button-bearing file. */
export function scanTools(toolsDir) {
  const findings = {};
  for (const file of htmlFiles(toolsDir)) {
    const rel = relative(REPO, file).replace(/\\/g, '/');
    const html = readFileSync(file, 'utf8');
    const c = classify(html);
    if (c && CLASSES.some((k) => c[k])) findings[rel] = c;
  }
  return findings;
}

// Gate body runs only when executed directly, never on import (same guard
// shape as check-copy-hallmarks.mjs — keeps classify()/findResultsExportRowSpans()
// safe to unit-test in isolation without triggering a full scan / process.exit).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {

const TOOLS_DIR = resolve(REPO, 'tools');
const findings = scanTools(TOOLS_DIR);

if (UPDATE) {
  const baseline = {};
  for (const cls of CLASSES) baseline[cls] = [];
  for (const [rel, c] of Object.entries(findings)) {
    for (const cls of CLASSES) if (c[cls]) baseline[cls].push(rel);
  }
  for (const cls of CLASSES) baseline[cls].sort();
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  const total = CLASSES.reduce((n, cls) => n + baseline[cls].length, 0);
  console.log(`ap2-contract: baseline written — ${CLASSES.map((c) => `${c}=${baseline[c].length}`).join(', ')} (${total} total entries).`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};
const baselineSets = {};
for (const cls of CLASSES) baselineSets[cls] = new Set(baseline[cls] || []);

const failures = [];
const improvements = [];
const classCounts = {};
for (const cls of CLASSES) classCounts[cls] = 0;

for (const [rel, c] of Object.entries(findings)) {
  for (const cls of CLASSES) {
    if (c[cls]) {
      classCounts[cls]++;
      if (!baselineSets[cls].has(rel)) {
        failures.push(`${rel}: NEW ${cls} violation — ${CLASS_LABEL[cls]} (not in baseline; new/touched tools must be clean)`);
      }
    }
  }
}
// Improvements: baselined files that no longer violate a class they were shielded for.
for (const cls of CLASSES) {
  for (const rel of baselineSets[cls]) {
    if (!findings[rel] || !findings[rel][cls]) improvements.push(`${rel}: ${cls} fixed — drop from baseline with --update`);
  }
}

if (improvements.length) {
  console.log(`ap2-contract: ${improvements.length} baselined file(s) beat their class — tighten with --update:\n  ` + improvements.slice(0, 10).join('\n  ') + (improvements.length > 10 ? `\n  ... and ${improvements.length - 10} more` : ''));
}

const baselineTotal = CLASSES.reduce((n, cls) => n + baselineSets[cls].size, 0);
if (failures.length) {
  console.error(`\nap2-contract: ${failures.length} FAILURE(s) — new AP2 export-toggle contract-gap regressions:\n  ` + failures.join('\n  '));
  console.error(`\nEach class is a ratchet baseline (scripts/ap2-contract-baseline.json) — only enumerated legacy files may carry this debt, and the baseline may only shrink. Fix the file (wire the exporter, move the button inside .results-export-row, call AP2Schema.validate() before download) or, for a file that was already-baselined debt you did not touch, this failure should not fire — re-run with --update only after fixing, never to hide a new file.`);
  process.exit(1);
}
console.log(`ap2-contract: OK — ${CLASSES.map((c) => `${c}=${classCounts[c]}/${baselineSets[c].size} baselined`).join(', ')} (${baselineTotal} total baselined entries, 0 new regressions).`);

}
