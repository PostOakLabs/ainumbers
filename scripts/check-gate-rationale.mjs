#!/usr/bin/env node
/**
 * check-gate-rationale.mjs — CLAUSE-BINDING-BUILD-SPEC.md §2 (CB-1).
 *
 * Every chain step `gate` that carries `gate_policy` (OCG §27.4 human-
 * accountability precondition) SHOULD carry a sibling `gate_rationale`:
 *   { "citation": <§1.2 pinned object or plain string>, "why": "<one sentence>" }
 *
 * GATE BEHAVIOUR (locked decision, CLAUSE-BINDING-BUILD-SPEC.md §0.3/§0.7,
 * asymmetric on purpose):
 *   - A NEW or EDITED chain file with a `gate_policy` and no sibling
 *     `gate_rationale` is a hard FAILURE (exit 1).
 *   - A PRE-EXISTING chain (untouched by the current diff) with the same gap
 *     is listed as a gap only — never RED, never rolled into a ratio (§0.7
 *     bars publishing any coverage percentage). ⛔ Do not backfill the gap
 *     list — mass-authoring rationale for untouched chains is the exact
 *     defect §0.3 exists to prevent.
 *
 * "Touched" = modified/staged in the working tree, or differs from the
 * upstream merge-base — same detection preflight.mjs already uses for the
 * chaingraph.json vendor-owed advisory.
 *
 * Usage: node scripts/check-gate-rationale.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHAINS_DIR = resolve(REPO, 'chaingraph', 'graph', 'chains');
const env = process.env;

function touchedChainFiles() {
  const touched = new Set();
  const add = (out) => out.toString().split('\n').forEach((f) => f && touched.add(f.trim()));
  try {
    add(execSync('git diff --name-only HEAD', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { /* not a git repo / no HEAD yet — nothing tracked-modified */ }
  try {
    add(execSync('git diff --name-only --cached', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { /* nothing staged */ }
  try {
    add(execSync('git ls-files --others --exclude-standard', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { /* no untracked files */ }
  try {
    const upstream = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const base = execSync(`git merge-base ${upstream} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    add(execSync(`git diff --name-only ${base} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { /* no upstream configured — uncommitted/staged/untracked diff already covers local work */ }
  return touched;
}

function ungatedSteps(chain) {
  const hits = [];
  for (const step of chain.steps || []) {
    const gate = step.gate;
    if (gate && gate.gate_policy && !gate.gate_rationale) {
      hits.push(step.tool_id || '(no tool_id)');
    }
  }
  return hits;
}

const touched = touchedChainFiles();
const files = readdirSync(CHAINS_DIR).filter((f) => f.endsWith('.json'));

const failures = [];
const gaps = [];

for (const name of files) {
  const abs = join(CHAINS_DIR, name);
  const rel = relative(REPO, abs).replace(/\\/g, '/');
  let chain;
  try {
    chain = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e) {
    failures.push(`${rel}: unparseable JSON (${e.message})`);
    continue;
  }
  const hits = ungatedSteps(chain);
  if (!hits.length) continue;
  if (touched.has(rel)) {
    failures.push(`${rel}: gate_policy with no gate_rationale on step(s) ${hits.join(', ')} — this chain is NEW/EDITED, rationale is required`);
  } else {
    gaps.push(`${rel}: gate_policy with no gate_rationale on step(s) ${hits.join(', ')}`);
  }
}

if (gaps.length) {
  console.log(`check-gate-rationale: ${gaps.length} pre-existing gap(s), NOT gating (CLAUSE-BINDING-BUILD-SPEC.md §0.3 — never backfilled, never a ratio):\n  ` + gaps.join('\n  '));
}

if (failures.length) {
  console.error(`\ncheck-gate-rationale: ${failures.length} FAILURE(s) — new/edited chain(s) missing gate_rationale:\n  ` + failures.join('\n  '));
  console.error('\nAdd a sibling gate_rationale ({ "citation": ..., "why": "..." }) next to gate_policy on the touched chain(s). See CLAUSE-BINDING-BUILD-SPEC.md §2.');
  process.exit(1);
}

console.log(`check-gate-rationale: OK (0 new/edited chains missing gate_rationale; ${gaps.length} pre-existing gap(s) listed above).`);
