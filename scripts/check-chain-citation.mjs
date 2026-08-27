#!/usr/bin/env node
/**
 * check-chain-citation.mjs — CLAUSE-BINDING-BUILD-SPEC.md §3 (CB-2).
 *
 * Chain-level (and steps[]-level) `regulatory_citations` (§1.2 pinned form)
 * is now admissible on `chaingraph/graph/chains/*.json`. This gate does NOT
 * require a citation — the corrected §3 gate exists precisely to avoid a
 * no-escape RED that would force an engineer to invent an interpretation
 * under deadline pressure (§0.3/§0.9: all 331 chains start SILENT, which
 * ranks ABOVE unpinned).
 *
 * GATE BEHAVIOUR (locked decision, CLAUSE-BINDING-BUILD-SPEC.md §3, asymmetric
 * on purpose):
 *   - A NEW or EDITED chain must declare ONE of:
 *       (a) >=1 L2-or-better citation (an object with scheme+id+path, or any
 *           deeper form) carrying `mapped_by` + `mapped_at`, OR
 *       (b) an explicit `regulatory_basis_status: "not_assessed"` — a
 *           first-class value, not an omission — carrying `decided_by` +
 *           `decided_at`.
 *     Declaring neither is a hard FAILURE (exit 1). `not_assessed` is
 *     deliberately NO HARDER to set than a real citation.
 *   - A PRE-EXISTING chain (untouched by the current diff) with neither is
 *     listed as a gap only — never RED, never rolled into a ratio (§0.7 bars
 *     publishing any coverage percentage). ⛔ Do not backfill the gap list.
 *
 * "Touched" = modified/staged in the working tree, or differs from the
 * upstream merge-base — same detection check-gate-rationale.mjs (CB-1) uses.
 * ⚠ That `@{u}` base-ref pattern carries CLAUSE-DIGEST-SCOPE-FIX-1's known-and-deferred
 * staleness defect (check-clause-digest.mjs's own header names this file explicitly:
 * "carries the same latent defect ... reported, not fixed, here"). Left AS-IS in THIS row —
 * fixing it would also move check-gate-rationale.mjs's shared detection and is a separate,
 * previously-reported fence.
 *
 * TOUCHTAX-DIFFSCOPE-1 (2026-08-27, J19 §3.3): a DIFFERENT, narrower defect, fixed here — a
 * chain with NO declaration at all (a pre-existing gap) was forced into a hard FAILURE merely
 * by touching the file ANYWHERE, even for a change with nothing to do with citations (the same
 * "touch tax" class as CLAUSE-DIGEST-GATE-1/KERNEL-CITATION-CLASS-1/jsdoc-checkjs). Within an
 * already-touched file (the `@{u}` detection above, unchanged), the missing-declaration failure
 * is now shielded down to a gap unless this diff's own changed lines (via the shared
 * scripts/diff-scope.mjs helper, origin/main-based) actually touch the citation-declaration
 * area (`regulatory_citations` / `regulatory_basis_status` / `regulatory_basis_decided_by` /
 * `regulatory_basis_decided_at`, at chain or step level). A genuinely new/edited declaration is
 * still validated exactly as before. Undeterminable diff or a brand-new chain: fails CLOSED,
 * full scope, never shielded.
 *
 * Usage: node scripts/check-chain-citation.mjs [--diff-scope <REF>]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';
import { resolveDiffScopeRef, changedLineSet } from './diff-scope.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHAINS_DIR = resolve(REPO, 'chaingraph', 'graph', 'chains');
// GIT-ENV-LEAK-SWEEP-1: was `process.env`. Every git call below derives the TOUCHED-FILE SET, and
// this gate runs from preflight, which the pre-push hook invokes — where git exports GIT_DIR and it
// beats `cwd`. Un-scrubbed, `git diff --name-only HEAD` answers about the OUTER repository, so this
// gate examines that tree's changes and silently gates nothing in the tree it names.
const env = gitEnv();

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

// L2-or-better: a pinned §1.2 object with at least scheme+id+path, or a
// bare string is never L2 (strings are always unpinned/L0-L1 per §1.1/§1.3).
function isL2OrBetterCitation(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  return Boolean(c.scheme && c.id && c.path && c.mapped_by && c.mapped_at);
}

function chainHasDeclaration(chain) {
  const citations = Array.isArray(chain.regulatory_citations) ? chain.regulatory_citations : [];
  if (citations.some(isL2OrBetterCitation)) return true;
  if (chain.regulatory_basis_status === 'not_assessed' && chain.regulatory_basis_decided_by && chain.regulatory_basis_decided_at) {
    return true;
  }
  for (const step of chain.steps || []) {
    const stepCitations = Array.isArray(step.regulatory_citations) ? step.regulatory_citations : [];
    if (stepCitations.some(isL2OrBetterCitation)) return true;
  }
  return false;
}

// citationAreaTouched — TOUCHTAX-DIFFSCOPE-1: did THIS diff's own new/changed lines (not the
// file as a whole) actually touch the citation-declaration area? Text-marker search, not a JSON-
// position parser (same pragmatic choice diff-scope.mjs's lineOfText() documents) — the four
// declaration-related keys are unambiguous literal substrings. Fails CLOSED by construction:
// undeterminable scope or a brand-new chain both return true (fully in scope, no shield).
export function citationAreaTouched(fileText, scope) {
  if (!scope.ok || scope.isNew) return true;
  const fileLines = fileText.split('\n');
  const markers = ['regulatory_citations', 'regulatory_basis_status', 'regulatory_basis_decided_by', 'regulatory_basis_decided_at'];
  for (const lineNo of scope.lines) {
    const text = fileLines[lineNo - 1] || '';
    if (markers.some((mk) => text.includes(mk))) return true;
  }
  return false;
}

const baseRef = resolveDiffScopeRef(REPO, { envVar: 'CHAIN_CITATION_BASE_REF' });
const touched = touchedChainFiles();
const files = readdirSync(CHAINS_DIR).filter((f) => f.endsWith('.json'));

const failures = [];
const gaps = [];
let shieldedGapCount = 0;

for (const name of files) {
  const abs = join(CHAINS_DIR, name);
  const rel = relative(REPO, abs).replace(/\\/g, '/');
  const fileText = readFileSync(abs, 'utf8');
  let chain;
  try {
    chain = JSON.parse(fileText);
  } catch (e) {
    failures.push(`${rel}: unparseable JSON (${e.message})`);
    continue;
  }
  if (chainHasDeclaration(chain)) continue;
  const chainId = chain.name || '(no name)';
  if (!touched.has(rel)) {
    gaps.push(`${rel} [${chainId}]: no citation declaration`);
    continue;
  }
  const scope = changedLineSet(REPO, rel, baseRef);
  if (citationAreaTouched(fileText, scope)) {
    failures.push(`${rel} [${chainId}]: no L2-or-better regulatory_citations and no regulatory_basis_status:"not_assessed" — this chain is NEW/EDITED, one declaration is required`);
  } else {
    // File touched, but NOT in the citation-declaration area (TOUCHTAX-DIFFSCOPE-1) — the
    // missing declaration is pre-existing debt this diff did not create, shielded to a gap.
    gaps.push(`${rel} [${chainId}]: no citation declaration (pre-existing — this diff's changes did not touch the citation-declaration area, TOUCHTAX-DIFFSCOPE-1)`);
    shieldedGapCount++;
  }
}

if (gaps.length) {
  console.log(`check-chain-citation: ${gaps.length} pre-existing gap(s), NOT gating (CLAUSE-BINDING-BUILD-SPEC.md §0.3/§3 — never backfilled, never a ratio):\n  ` + gaps.join('\n  '));
}
if (shieldedGapCount) {
  console.log(`check-chain-citation: ${shieldedGapCount} of those gap(s) were touched-file failures SHIELDED to gaps (TOUCHTAX-DIFFSCOPE-1, J19 §3.3) — the diff never touched the citation-declaration area.`);
}

if (failures.length) {
  console.error(`\ncheck-chain-citation: ${failures.length} FAILURE(s) — new/edited chain(s) with no citation declaration:\n  ` + failures.join('\n  '));
  console.error('\nDeclare EITHER an L2-or-better regulatory_citations entry (scheme+id+path+mapped_by+mapped_at) OR regulatory_basis_status:"not_assessed" with regulatory_basis_decided_by + regulatory_basis_decided_at. See CLAUSE-BINDING-BUILD-SPEC.md §3.');
  process.exit(1);
}

console.log(`check-chain-citation: OK (0 new/edited chains missing a citation declaration; ${gaps.length} pre-existing gap(s) listed above).`);
