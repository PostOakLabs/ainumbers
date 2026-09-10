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
 *        [--seed | --prune] [--baseline <path>] [--registry <path>]
 *
 * ── PROCESS-ORDER EXTENSION (CHAIN-CITATION-PROCESS-ORDER-1, Tim directive
 * 2026-08-22; instrument contract J9 §0 in 0xAlpha/audits/2026-08-24-CHAIN-
 * PROCESS-ORDER-SPECS.md) ────────────────────────────────────────────────────
 *
 * A chain whose TITLE or DESCRIPTION names a statutory process must declare
 * EITHER a pinned `process_order` (an ordered list of cited locators, each
 * carrying the quoted ordering phrase — ⛔ never prose) OR an explicit
 * `sequence_not_statutory: true`. ⛔ Silence stops being an option. The gate
 * FAILS CLOSED on the trigger, NOT on the population: a chain that names no
 * statutory process is untouched; a chain that names one and declares neither
 * shape FAILS with its name.
 *
 * Two states beyond the binary are representable (J9 §0): a `process_order`
 * leg may be `status: "pinned"` (locator + quoted phrase per step) or
 * `status: "unretrieved"` (a `note` naming what is unretrieved and why) — a
 * strictly binary gate cannot consume the pinned cells without
 * misrepresenting them. The gate requires ≥1 pinned leg; a declaration whose
 * legs are ALL unretrieved does not pass.
 *
 * WHERE DECLARATIONS LIVE. Two surfaces, both accepted:
 *   - in-shard: `process_order` / `sequence_not_statutory` on the chain JSON
 *     (works for NEW chains: a chain-added auto-lands per
 *     ASSEMBLE-CHAIN-CLASSIFY-1 verdict (b));
 *   - the sidecar registry scripts/chain-process-order-declarations.json,
 *     keyed by chain `name`.
 * The sidecar exists because the assembler's COPY_ONLY_CHAIN_FIELDS classes
 * ANY new top-level field on an EXISTING chain shard as a structural edit
 * (REFUSED to a human ASSEMBLE/LAND row) — an in-shard declaration on a
 * legacy chain would red the main-side regen (SO #47's measured failure
 * class). The gate never writes chaingraph.json and never reorders steps.
 *
 * BASELINE (counts only go DOWN). scripts/chain-process-order-baseline.json
 * enumerates, BY NAME, the legacy chains that triggered and had declared
 * neither shape when this extension shipped. A baselined chain passes
 * shielded; a chain ABSENT from the baseline that triggers without declaring
 * FAILS — the baseline shields enumerated legacy only, never a new chain.
 * `--seed` writes the initial baseline (refuses if the file exists);
 * `--prune` removes entries whose chain now declares or no longer exists.
 * There is deliberately NO --update: a NEW undeclared chain can only be
 * baselined by a human typing the entry. Missing/malformed baseline = RED,
 * never quiet (SO #34c). A declared chain still carrying a baseline entry is
 * reported as pruneable.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';
import { resolveDiffScopeRef, changedLineSet } from './diff-scope.mjs';
import { pathToFileURL } from 'node:url';

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

// ───────────────────────── process-order extension (CHAIN-CITATION-PROCESS-ORDER-1) ─────────────────────────

export const BASELINE_PATH_DEFAULT = resolve(REPO, 'scripts', 'chain-process-order-baseline.json');
export const REGISTRY_PATH_DEFAULT = resolve(REPO, 'scripts', 'chain-process-order-declarations.json');

// The trigger: title/description NAMES a statutory process. Curated marker
// list anchored on the audit's named-process population (§3.1) and J9's
// retrieved set (§1–§2); each marker names the process it recognises so a
// failure message says WHICH process the chain claimed. Extensible by a
// future row — widening it can only ADD declaration duties, and the baseline
// ratchet (below) is what keeps a widening honest: entries only ever leave.
export const STATUTORY_PROCESS_MARKERS = Object.freeze([
  { label: 'ECOA/Reg B adverse-action notice', re: /\breg\s?B\b|\badverse[- ]action\b/i },
  { label: 'Reg BI / Form CRS best-interest process', re: /\breg\s?BI\b|best[- ]interest|form\s?CRS/i },
  { label: 'CIP/CDD customer identification & beneficial ownership', re: /\bkyc\b|know[- ]your[- ]customer|\bcip\b|customer due diligence|beneficial ownership/i },
  { label: 'GENIUS Act payment-stablecoin issuance', re: /\bgenius\b|payment stablecoin|stablecoin issuer/i },
  { label: 'reserve composition/disclosure (GENIUS §4 / MiCA Arts 34-36)', re: /reserve[- ](compliance|attestation|adequacy|proof|evidence|management)|proof of reserve|xreserve/i },
  { label: 'CCD2 consumer-credit creditworthiness & SECCI', re: /\bccd2\b|consumer credit|creditworthiness|\bsecci\b/i },
  { label: 'FCA CONC BNPL creditworthiness', re: /\bbnpl\b/i },
  { label: 'PSD2/instant-payments verification of payee', re: /verification of payee|\bvop\b|instant payments?|\bpsd2\b/i },
  { label: 'UCP 600 letter-of-credit examination & OFAC sanctions screening', re: /letter of credit|\bucp\s?600\b|\blc\b|trade sanctions|\bsanctions?\b/i },
  { label: 'PSR APP fraud reimbursement', re: /\bapp fraud|fraud reimbursement/i },
  { label: 'EN 16931 e-invoice validation', re: /\ben\s?16931\b|e-?invoice/i },
  { label: 'FFIEC Call Report preparation', re: /call report|\bffiec\b/i },
  { label: 'Treasury payment lifecycle', re: /government payment|treasury (lifecycle|payment|cash)/i },
  { label: 'BSA/AML/FATF financial-crime programme', re: /\baml\b|\bfatf\b|financial crime|money laundering|\bbsa\b|tbml/i },
  { label: 'card-scheme dispute/chargeback process', re: /\bdispute (management|reason|resolution)|chargeback|representment|scheme dispute/i },
  { label: 'Reg Z APR accuracy & tolerance cure', re: /\bapr\b|tolerance cure/i },
  { label: 'QM / ability-to-repay assessment', re: /ability to repay|qualified mortgage|points and fees|\bqm\b/i },
  { label: 'US banking compliance spot-check process', re: /banking compliance/i },
  { label: 'Reg F debt-collection process', re: /debt collection|regulation f\b/i },
  { label: 'CARD Act ability-to-pay', re: /ability to pay|card act/i },
  { label: 'MiCA reserve/issuance duties', re: /\bmica\b/i },
]);

/** Pure trigger: which statutory processes does this chain's title/description name? */
export function chainNamesStatutoryProcess(chain) {
  const text = `${chain.title || ''} ${chain.description || ''}`;
  return STATUTORY_PROCESS_MARKERS.filter((m) => m.re.test(text)).map((m) => m.label);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const nonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

/** Validate one process-order declaration (either accepted shape). Pure. */
export function validateProcessDeclaration(decl) {
  const errors = [];
  if (!decl || typeof decl !== 'object' || Array.isArray(decl)) {
    return { ok: false, errors: ['declaration must be an object'] };
  }
  const hasOrder = Object.prototype.hasOwnProperty.call(decl, 'process_order');
  const hasNotStatutory = Object.prototype.hasOwnProperty.call(decl, 'sequence_not_statutory');
  if (hasOrder === hasNotStatutory) {
    errors.push('declare EXACTLY ONE of process_order (pinned ordered locators) or sequence_not_statutory:true');
    return { ok: false, errors };
  }
  if (hasNotStatutory) {
    if (decl.sequence_not_statutory !== true) {
      errors.push('sequence_not_statutory must be the explicit boolean true, never a string or an omission');
    }
    if (decl.basis !== undefined && !nonEmptyString(decl.basis)) {
      errors.push('sequence_not_statutory.basis, when present, must be a non-empty evidence reference');
    }
    return { ok: errors.length === 0, errors };
  }
  const po = decl.process_order;
  if (!po || typeof po !== 'object' || Array.isArray(po)) {
    errors.push('process_order must be an object with declared_by, declared_at and legs[]');
    return { ok: false, errors };
  }
  if (!nonEmptyString(po.declared_by)) errors.push('process_order.declared_by is required (the declaring row)');
  if (!nonEmptyString(po.declared_at) || !ISO_DATE.test(po.declared_at)) errors.push('process_order.declared_at must be an ISO date (YYYY-MM-DD)');
  if (!Array.isArray(po.legs) || po.legs.length === 0) {
    errors.push('process_order.legs must be a non-empty array');
    return { ok: errors.length === 0, errors };
  }
  let pinnedLegs = 0;
  po.legs.forEach((leg, i) => {
    const at = `legs[${i}]`;
    if (!leg || typeof leg !== 'object' || Array.isArray(leg)) {
      errors.push(`${at}: leg must be an object`);
      return;
    }
    if (!nonEmptyString(leg.process)) errors.push(`${at}.process is required (which statutory process this leg pins)`);
    if (leg.status === 'pinned') {
      pinnedLegs++;
      if (!Array.isArray(leg.order) || leg.order.length === 0) {
        errors.push(`${at}.order must be a non-empty array of cited locators`);
        return;
      }
      leg.order.forEach((step, j) => {
        const sat = `${at}.order[${j}]`;
        if (!step || typeof step !== 'object' || Array.isArray(step)) {
          errors.push(`${sat}: an order entry must be an object with locator + quoted — an ordered list of cited locators, NEVER prose`);
          return;
        }
        if (!nonEmptyString(step.locator)) errors.push(`${sat}.locator is required (the process's own sequencing locator)`);
        if (!nonEmptyString(step.quoted)) errors.push(`${sat}.quoted is required (the quoted ordering phrase from that locator)`);
      });
    } else if (leg.status === 'unretrieved') {
      if (!nonEmptyString(leg.note)) errors.push(`${at}.note is required for an unretrieved leg (name what is unretrieved and why — never filled from memory)`);
    } else {
      errors.push(`${at}.status must be "pinned" or "unretrieved" (got ${JSON.stringify(leg.status)})`);
    }
  });
  if (pinnedLegs === 0) {
    errors.push('process_order needs at least ONE pinned leg — a declaration whose legs are all unretrieved asserts nothing (J9 §0: the chain asserts neither field until a retrieval row lands)');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Pure evaluation for one chain. Returns one of:
 *   { state: 'untriggered' }                                — names no statutory process
 *   { state: 'declared', via, where }                       — valid declaration found
 *   { state: 'baselined' }                                  — legacy, enumerated in the baseline
 *   { state: 'fail', reasons: [...] }                       — triggers, declares neither, unbaselined
 *   { state: 'fail', reasons } (invalid declaration)        — declaration present but malformed
 */
export function evaluateProcessOrder(chain, { registry = {}, baseline = new Set() } = {}) {
  const matched = chainNamesStatutoryProcess(chain);
  if (matched.length === 0) return { state: 'untriggered' };
  const name = chain.name || '(no name)';
  const attempts = [];
  // Build the in-shard attempt object conditionally: a key present with value
  // undefined is NOT a declaration, and hasOwnProperty would otherwise see one.
  if (Object.prototype.hasOwnProperty.call(chain, 'process_order')) {
    const v = validateProcessDeclaration({ process_order: chain.process_order });
    attempts.push({ where: 'in-shard', ...v });
  }
  if (Object.prototype.hasOwnProperty.call(chain, 'sequence_not_statutory')) {
    const v = validateProcessDeclaration({ sequence_not_statutory: chain.sequence_not_statutory });
    attempts.push({ where: 'in-shard', ...v });
  }
  const registered = registry[name];
  if (registered !== undefined) {
    const v = validateProcessDeclaration(registered);
    attempts.push({ where: 'registry', ...v });
  }
  if (attempts.length > 0) {
    const ok = attempts.find((a) => a.ok);
    if (ok) return { state: 'declared', via: ok.where === 'in-shard' ? 'in-shard' : 'registry', where: ok.where };
    return { state: 'fail', reasons: attempts.flatMap((a) => a.errors.map((e) => `${name}: [${a.where}] ${e}`)) };
  }
  if (baseline.has(name)) return { state: 'baselined' };
  return {
    state: 'fail',
    reasons: [
      `${name}: names a statutory process (${matched.join('; ')}) but declares NEITHER a pinned process_order NOR sequence_not_statutory:true, and is absent from the baseline — a NEW chain must declare (the baseline shields enumerated legacy only)`,
    ],
  };
}

/** Pure --prune: which baseline entries no longer name an undeclared triggering chain? */
export function pruneBaselineEntries(baselineMap, chains) {
  const undeclaredTriggering = new Set(
    chains.filter((c) => evaluateProcessOrder(c, { baseline: new Set() }).state === 'fail').map((c) => c.name),
  );
  return Object.keys(baselineMap).filter((name) => !undeclaredTriggering.has(name));
}

function loadRegistry(path) {
  if (!existsSync(path)) return { registry: {}, note: `registry absent (${path}) — no sidecar declarations yet` };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { error: `registry ${path} is malformed JSON: ${e.message}` };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof parsed.declarations !== 'object' || Array.isArray(parsed.declarations)) {
    return { error: `registry ${path} must be an object with a "declarations" map keyed by chain name` };
  }
  return { registry: parsed.declarations };
}

function loadBaseline(path) {
  if (!existsSync(path)) {
    return { error: `baseline ${path} MISSING — a missing baseline is a distinct state, never a green one (SO #34c). Run --seed to write it from the current tree, or restore the file.` };
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { error: `baseline ${path} is malformed JSON: ${e.message}` };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof parsed.chains !== 'object' || Array.isArray(parsed.chains)) {
    return { error: `baseline ${path} must be an object with a "chains" map (name -> title)` };
  }
  return { baseline: new Set(Object.keys(parsed.chains)), map: parsed.chains };
}

// ───────────────────────── end process-order extension ─────────────────────────

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

// MAIN-ONLY GUARD (same pattern assemble-chaingraph.mjs uses so its self-test can
// import the pure classifier): the live gate below runs only when this file is the
// INVOKED script, never when check-chain-citation.test.mjs imports the pure
// process-order exports above.
const INVOKED_DIRECTLY = (() => {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
  } catch {
    return false;
  }
})();

// eslint-disable-next-line no-extra-bind
function main() {
const baseRef = resolveDiffScopeRef(REPO, { envVar: 'CHAIN_CITATION_BASE_REF' });
const touched = touchedChainFiles();
const files = readdirSync(CHAINS_DIR).filter((f) => f.endsWith('.json'));

// ── process-order flags (CHAIN-CITATION-PROCESS-ORDER-1) ──
const argv = process.argv.slice(2);
const SEED = argv.includes('--seed');
const PRUNE = argv.includes('--prune');
const flagValue = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? resolve(argv[i + 1]) : null;
};
const BASELINE_PATH = flagValue('--baseline') || BASELINE_PATH_DEFAULT;
const REGISTRY_PATH = flagValue('--registry') || REGISTRY_PATH_DEFAULT;

function parseChains() {
  const parsed = [];
  for (const name of files) {
    const abs = join(CHAINS_DIR, name);
    const rel = relative(REPO, abs).replace(/\\/g, '/');
    try {
      parsed.push({ rel, chain: JSON.parse(readFileSync(abs, 'utf8')) });
    } catch (e) {
      console.error(`check-chain-citation: ${rel}: unparseable JSON (${e.message})`);
      process.exit(1);
    }
  }
  return parsed;
}

if (SEED) {
  if (existsSync(BASELINE_PATH)) {
    console.error(`check-chain-citation: --seed refuses — ${BASELINE_PATH} already exists. Seeding twice would silently re-shield chains that declared in between; use --prune to shrink instead.`);
    process.exit(1);
  }
  const registryLoad = loadRegistry(REGISTRY_PATH);
  if (registryLoad.error) {
    console.error(`check-chain-citation: ${registryLoad.error}`);
    process.exit(1);
  }
  const chains = parseChains();
  const map = {};
  for (const { chain } of chains) {
    if (evaluateProcessOrder(chain, { registry: registryLoad.registry, baseline: new Set() }).state === 'fail') {
      map[chain.name] = chain.title || '(no title)';
    }
  }
  const doc = {
    _doc: 'Ratchet baseline for check-chain-citation.mjs process-order trigger (CHAIN-CITATION-PROCESS-ORDER-1, 2026-08-29): chains whose title/description names a statutory process and which had declared NEITHER process_order NOR sequence_not_statutory when the extension shipped. Counts only go DOWN: --prune removes entries whose chain now declares; there is deliberately NO --update, so a NEW undeclared chain can only be baselined by a human typing the entry here. Deleting this file makes the gate RED, not quiet (SO #34c).',
    chains: Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b))),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log(`check-chain-citation: baseline written — ${Object.keys(map).length} legacy undeclared triggering chain(s) enumerated by name in ${BASELINE_PATH}.`);
  process.exit(0);
}

if (PRUNE) {
  const registryLoad = loadRegistry(REGISTRY_PATH);
  if (registryLoad.error) {
    console.error(`check-chain-citation: ${registryLoad.error}`);
    process.exit(1);
  }
  const baselineLoad = loadBaseline(BASELINE_PATH);
  if (baselineLoad.error) {
    console.error(`check-chain-citation: ${baselineLoad.error}`);
    process.exit(1);
  }
  const chains = parseChains();
  const stale = pruneBaselineEntries(baselineLoad.map, chains.map((c) => c.chain));
  if (stale.length === 0) {
    console.log('check-chain-citation: --prune: nothing to prune (every baseline entry still names an undeclared triggering chain).');
    process.exit(0);
  }
  const next = { ...baselineLoad.map };
  for (const name of stale) delete next[name];
  const doc = { _doc: JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))._doc, chains: Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b))) };
  writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log(`check-chain-citation: --prune removed ${stale.length} baseline entr(y/ies) that now declare (or no longer exist): ${stale.join(', ')}`);
  process.exit(0);
}

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

// ── process-order pass (CHAIN-CITATION-PROCESS-ORDER-1) — population-wide, every run. ──
const registryLoad = loadRegistry(REGISTRY_PATH);
const baselineLoad = loadBaseline(BASELINE_PATH);
const poFailures = [];
let poTriggered = 0;
let poDeclared = 0;
let poBaselined = 0;
let poUntriggered = 0;
const poPruneable = [];

if (registryLoad.error || baselineLoad.error) {
  poFailures.push(registryLoad.error || baselineLoad.error);
} else {
  for (const name of files) {
    const abs = join(CHAINS_DIR, name);
    const rel = relative(REPO, abs).replace(/\\/g, '/');
    let chain;
    try {
      chain = JSON.parse(readFileSync(abs, 'utf8'));
    } catch {
      continue; // already failed the citation pass with a parse message
    }
    const verdict = evaluateProcessOrder(chain, { registry: registryLoad.registry, baseline: baselineLoad.baseline });
    if (verdict.state === 'untriggered') {
      poUntriggered++;
      continue;
    }
    poTriggered++;
    if (verdict.state === 'declared') {
      poDeclared++;
      if (registryLoad.registry[chain.name] !== undefined && verdict.via === 'in-shard') {
        poPruneable.push(chain.name);
      }
    } else if (verdict.state === 'baselined') {
      poBaselined++;
    } else {
      poFailures.push(`${rel} [${chain.name}]: ${verdict.reasons.join(' ')}`);
    }
  }
}

if (poFailures.length) {
  console.error(`\ncheck-chain-citation: ${poFailures.length} process-order FAILURE(s) — chains naming a statutory process with neither declaration (CHAIN-CITATION-PROCESS-ORDER-1):`);
  for (const f of poFailures.slice(0, 20)) console.error('  ' + f);
  if (poFailures.length > 20) console.error(`  ... and ${poFailures.length - 20} more`);
  console.error('\nDeclare EITHER a pinned process_order (ordered list of cited locators, each with the quoted ordering phrase; legs may be status:"pinned" or status:"unretrieved" with a note) OR sequence_not_statutory:true. Declarations live in the chain shard (new chains) or scripts/chain-process-order-declarations.json (legacy chains — the assembler classes new fields on existing chain shards as structural edits). See J9 §0 (0xAlpha/audits/2026-08-24-CHAIN-PROCESS-ORDER-SPECS.md).');
} else {
  console.log(`check-chain-citation: process-order OK — ${poTriggered}/${files.length} chain(s) name a statutory process: ${poDeclared} declared, ${poBaselined} baselined legacy (counts only go down; --prune shrinks), ${poUntriggered} name no statutory process and are untouched.`);
  if (poPruneable.length) {
    console.log(`check-chain-citation: ${poPruneable.length} chain(s) now declare in-shard while still carrying a registry entry — prune the registry copy: ${poPruneable.join(', ')}`);
  }
}

if (failures.length) {
  console.error(`\ncheck-chain-citation: ${failures.length} FAILURE(s) — new/edited chain(s) with no citation declaration:\n  ` + failures.join('\n  '));
  console.error('\nDeclare EITHER an L2-or-better regulatory_citations entry (scheme+id+path+mapped_by+mapped_at) OR regulatory_basis_status:"not_assessed" with regulatory_basis_decided_by + regulatory_basis_decided_at. See CLAUSE-BINDING-BUILD-SPEC.md §3.');
  process.exit(1);
}

if (poFailures.length) process.exit(1);

console.log(`check-chain-citation: OK (0 new/edited chains missing a citation declaration; ${gaps.length} pre-existing gap(s) listed above).`);
}

if (INVOKED_DIRECTLY) main();
