#!/usr/bin/env node
/**
 * scripts/check-workflow-step-uses.mjs — WORKFLOW-STEP-USES-LINT-1 (freeze-class: gate).
 *
 * Rejects a STEP-level `uses:` of a reusable workflow file in .github/workflows/*.yml.
 * GitHub Actions syntax allows a reusable workflow (a path under .github/workflows/
 * ending in .yml/.yaml, local `./...` or `owner/repo/...@ref`) to be called ONLY from
 * a job (jobs.<id>.uses). A step-level call does not fail workflow parsing: the step
 * treats the workflow file as a composite action, and the run fails at execution time
 * with "Can't find 'action.yml', 'action.yaml' or 'Dockerfile'" (measured 2026-10-15,
 * derived-regen-deadman.yml:164, 6 of the last 20 deadman runs red). The existing
 * parse gate (check-workflow-yaml.py) passes such a file, so placement was unchecked.
 *
 * How placement is decided: structural indentation, no YAML dependency. Each `uses:`
 * line's ancestor mapping keys are walked by indent; if `steps` is among them the call
 * is step-level. Job-level `uses:` (sibling of runs-on/needs/with) passes, and so does
 * any step-level `uses:` of a normal action (actions/checkout@..., ./action.yml, a
 * Docker ref) — only reusable-workflow shapes are flagged.
 *
 * Baseline: scripts/workflow-step-uses-baseline.json through the shared hard-failing
 * loader (ratchet-baseline.mjs), so deleting or corrupting the baseline REDs the gate.
 * The single entry is derived-regen-deadman.yml, owned by DEADMAN-REUSABLE-CALL-HEAL-1;
 * that row's fix removes the entry. Counts only go down.
 *
 * Usage:
 *   node scripts/check-workflow-step-uses.mjs                    (gate)
 *   node scripts/check-workflow-step-uses.mjs --update-baseline  (writer; never raises the ceiling)
 *   node scripts/check-workflow-step-uses.mjs --dir <workflows>  (self-test hook)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadRatchetBaselineOrExit,
  readBaselineForUpdate,
} from './ratchet-baseline.mjs';

export const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const WORKFLOWS_DIR = process.argv.includes('--dir') ? resolve(process.argv[process.argv.indexOf('--dir') + 1]) : join(REPO, '.github', 'workflows');
export const BASELINE_PATH = process.argv.includes('--baseline')
  ? resolve(process.argv[process.argv.indexOf('--baseline') + 1])
  : join(REPO, 'scripts', 'workflow-step-uses-baseline.json');
const REQUIRED_KEYS = [
  { key: 'deferred', type: 'count' },
  { key: 'deferred_files', type: 'name-list' },
];
const BASELINE_LABEL = 'workflow step-uses ratchet';
const REPIN = 'node scripts/check-workflow-step-uses.mjs --update-baseline';

/** A reusable-workflow `uses:` value: a .yml/.yaml path under .github/workflows/, local or owner/repo, optional @ref. */
export function isReusableWorkflowUse(value) {
  const v = value.trim();
  if (!/\.(ya?ml)(@[^@]*)?$/.test(v)) return false;
  return v.startsWith('./.github/workflows/') || /(^|\/)\.github\/workflows\/[^/]+\.ya?ml(@|$)/.test(v);
}

/** Tokenize into { indent, key, raw } rows (comments, blanks and non key/value lines dropped). */
function tokenize(text) {
  return text.split(/\r?\n/).map((raw) => {
    if (/^\s*(#|$)/.test(raw)) return null;
    const m = /^(-\s+)?([A-Za-z0-9_.-]+|\*)\s*:(\s|$)/.exec(raw.trimStart());
    if (!m) return null;
    return { indent: raw.length - raw.trimStart().length, key: m[2], raw };
  }).filter(Boolean);
}

/** Walk the ancestor mapping keys of token i by indent, outermost first, `jobs:` excluded. */
function ancestorKeys(lines, i) {
  const chain = [];
  let indent = lines[i].indent;
  for (let j = i - 1; j >= 0; j--) {
    if (lines[j].indent >= indent) continue;
    indent = lines[j].indent;
    if (lines[j].key === 'jobs') break;
    chain.push(lines[j].key);
  }
  return chain;
}

/** 1-based source line number for token index i (tokens were filtered, so recount in source order). */
function sourceLine(text, tokenIndex) {
  const all = text.split(/\r?\n/);
  let seen = -1;
  for (let n = 0; n < all.length; n++) {
    if (/^\s*(#|$)/.test(all[n])) continue;
    const m = /^(-\s+)?([A-Za-z0-9_.-]+|\*)\s*:(\s|$)/.exec(all[n].trimStart());
    if (!m) continue;
    seen++;
    if (seen === tokenIndex) return n + 1;
  }
  return 0;
}

/** Pure scan of one workflow file's text; returns [{ line, value }] step-level reusable calls. */
export function scanWorkflow(text) {
  const lines = tokenize(text);
  if (!lines.some((l) => l.indent === 0 && l.key === 'jobs')) return [];
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].key !== 'uses') continue;
    const value = lines[i].raw.slice(lines[i].raw.indexOf(':') + 1).trim().replace(/^["']|["']$/g, '');
    if (!isReusableWorkflowUse(value)) continue;
    if (ancestorKeys(lines, i).includes('steps')) hits.push({ line: sourceLine(text, i), value });
  }
  return hits;
}

/** Scan every .yml/.yaml in dir; returns [{ file, line, value }] sorted by file. */
export function scanAll(dir = WORKFLOWS_DIR) {
  const out = [];
  for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    const text = readFileSync(join(dir, f), 'utf8');
    for (const hit of scanWorkflow(text)) out.push({ file: f, ...hit });
  }
  return out;
}

function main() {
  if (process.argv.includes('--update-baseline')) {
    const hits = scanAll();
    const prev = readBaselineForUpdate(BASELINE_PATH, REQUIRED_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN });
    if (prev && hits.length > prev.deferred) {
      console.error(`✗ ${BASELINE_LABEL}: live count ${hits.length} exceeds pinned ceiling ${prev.deferred}; a repin that RAISES the ceiling is refused. Fix the new call(s) instead:\n  ${hits.map((h) => `${h.file}:${h.line}`).join('\n  ')}`);
      process.exit(1);
    }
    const files = [...new Set(hits.map((h) => h.file))].sort();
    writeFileSync(BASELINE_PATH, JSON.stringify({ deferred: hits.length, deferred_files: files }, null, 2) + '\n');
    console.log(`baseline pinned: deferred=${hits.length} files=[${files.join(', ')}]`);
    return;
  }

  const pinned = loadRatchetBaselineOrExit(BASELINE_PATH, REQUIRED_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN });
  const hits = scanAll();
  const unbaselined = hits.filter((h) => !pinned.deferred_files.includes(h.file));
  for (const h of unbaselined) {
    console.error(`${h.file}:${h.line}: reusable workflow "${h.value}" called from a step; move it to a job (jobs.<id>.uses) or call an action instead`);
  }
  if (hits.length > pinned.deferred) {
    console.error(`✗ ${BASELINE_LABEL}: ${hits.length} step-level reusable-workflow calls exceed the pinned ceiling ${pinned.deferred} (${REPIN} never raises it; the count may only go down).`);
  }
  if (unbaselined.length > 0 || hits.length > pinned.deferred) process.exit(1);
  console.log(`Workflow step-uses placement: ${hits.length} step-level call(s), all baselined (ceiling ${pinned.deferred}), WORKFLOW-STEP-USES-LINT-1`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
