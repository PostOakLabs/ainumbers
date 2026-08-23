#!/usr/bin/env node
/**
 * check-flag-mirror.mjs — FLAG-MIRROR-DOCTRINE gate.
 * Convention of record: chaingraph/standard/AUTHORING-STANDARD.md §2 (Tim ruling, 2026-08-23).
 *
 * THE RULE: a kernel whose compute() can raise a flag CONDITIONALLY must carry at least one member
 * of the CLOSED mirror list in output_payload, so a §21.4 chain gate can route on it.
 *
 * WHY THE RULE EXISTS. SPEC.md §21.4 resolves a gate's RFC 6901 pointer against THIS step's
 * output_payload only (chaingraph/kernels/_gateval.mjs). Top-level compliance_flags is a sibling of
 * output_payload, not a member of it, so NO gate can ever condition on a flag — 0 of 80 gate
 * pointers do, and 12 gate steps sit on kernels that raise flags conditionally and route anyway.
 * Mirroring closes that without touching the evaluator, the schema, or §21.4.
 *
 * ⛔ THIS GATE DOES NOT READ THE KERNEL AND GUESS. It RUNS each kernel and derives conditionality
 * from observed behaviour (SO #34 independent derivation — a static heuristic over the source would
 * be the checker deciding for itself what the artifact claims). Observation set for each kernel:
 * every fixture vector's policy_parameters, plus the empty input {}. The empty input is a real
 * input, not a synthetic one: the measured art-223 instance is literally compute({}) pushing
 * LOAN_AMOUNT_MISSING while still returning classification 'conforming'.
 *
 * CLASSIFICATION (one kernel lands in exactly one bucket):
 *   NO-FLAGS      every observation returned an empty flag set          -> not gated
 *   CONSTANT      every observation returned the SAME non-empty set     -> not gated (the
 *                 *_ASSESSED / *_COMPLETE marker class; no non-verdict is being carried)
 *   CONDITIONAL   two observations returned DIFFERENT flag sets         -> GATED
 *   UNCLASSIFIED  no observation could be made (no compute export, or every input threw)
 *                 -> reported as its own category and counted. ⛔ NEVER folded into the green
 *                 set: SO #34c, absence is not a pass.
 *
 * BASELINE, AND WHY --update CANNOT GROW IT. scripts/flag-mirror-baseline.json shields the
 * violations that existed when this gate landed; retrofitting a mirror into a sealed kernel moves
 * its digest and demands a re-prove in the same row (SO #36), so the doctrine binds NEW and AMENDED
 * work. `--update` therefore REMOVES entries that are now clean and REFUSES to add any: a baseline
 * a session can silently widen is a gate that reports green while getting worse (the deletable-
 * baseline shape). Growing it is a deliberate edit to the JSON, visible in the diff.
 *
 * FAILS ON: (a) a CONDITIONAL kernel with no mirrored member that is not baselined; (b) a baselined
 * entry that is now clean or no longer exists (stale shield — the ratchet must move down).
 *
 * ADVISORY, NEVER FAILING: a mirrored member that is present but never correlates with the
 * conditional flags across the observation set. Correlation is a semantic property that a legitimate
 * kernel can break (an informational flag that is not a review trigger); the ruled gate is
 * "reds a conditional-flag kernel LACKING a mirrored field", and this stays on that line.
 *
 * Usage:
 *   node scripts/check-flag-mirror.mjs            # gate; exit 1 on any unbaselined violation
 *   node scripts/check-flag-mirror.mjs --report   # full per-kernel classification
 *   node scripts/check-flag-mirror.mjs --update   # burn the baseline down (never up)
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KERNELS_DIR = resolve(REPO, 'chaingraph', 'kernels');
const FIXTURES_DIR = resolve(KERNELS_DIR, 'fixtures');
const BASELINE_PATH = resolve(REPO, 'scripts', 'flag-mirror-baseline.json');

/**
 * The CLOSED mirror list (AUTHORING-STANDARD.md §2.2). Extending it is a deliberate amendment to
 * that file, not an author's choice — an open list is how a mirror requirement becomes "put any
 * field you like in the payload and call it a caveat".
 *
 * SELECTION RULE, applied to a measured census of every kernel's observed output_payload keys: a
 * member is admissible iff its presence-and-truthiness means "the kernel is CARRYING A CAVEAT",
 * never "here is the answer". Counts below are the 2026-08-23 census.
 *
 * DELIBERATELY EXCLUDED, with the reason, so this is not re-litigated per node:
 *   decision (20), reason (11), reasons (13), breach_reasons (1) — these EXPLAIN a verdict the
 *     kernel did produce. A gate routing on them routes on the answer, not on the refusal.
 *   execution_state (2) — a lifecycle marker, truthy on clean runs.
 *   notes (1) — prose, emitted on clean runs too (art-637).
 *   valid_input (2) — INVERTED sense: truthy means fine. A mirror must be truthy when a caveat is
 *     present, or every gate written against it routes backwards.
 */
export const MIRROR_MEMBERS = Object.freeze([
  'manual_review_required', // 3 — art-637 / art-615 / art-507, the refusal-carrying counter-pattern
  'warning_checks',         // 1 — art-01, the precedent this doctrine formalises
  'warnings',               // 12
  'warn_count',             // 11
  'caveats',                // 1
  'domain_errors',          // 2 — art-617's declared-domain refusal
  'errors',                 // 10
  'issues',                 // 9
]);

/** A mirror member counts as CARRIED when the key is present, whatever this run's value. */
function mirrorsPresent(payload) {
  if (!payload || typeof payload !== 'object') return [];
  return MIRROR_MEMBERS.filter((k) => Object.prototype.hasOwnProperty.call(payload, k));
}

/** Truthiness for the advisory correlation read: [] / 0 / false / null all read as "no caveat". */
function mirrorTruthy(payload) {
  for (const k of mirrorsPresent(payload)) {
    const v = payload[k];
    if (Array.isArray(v) ? v.length > 0 : (typeof v === 'number' ? v > 0 : Boolean(v))) return true;
  }
  return false;
}

/** Every fixture vector's policy_parameters, in file order. Tolerates all three container shapes. */
export function fixtureInputs(toolId, fixturesDir = FIXTURES_DIR) {
  const p = join(fixturesDir, `${toolId}.fixtures.json`);
  if (!existsSync(p)) return [];
  let parsed;
  try { parsed = JSON.parse(readFileSync(p, 'utf8')); } catch { return []; }
  const vectors = Array.isArray(parsed) ? parsed : (parsed.vectors || parsed.cases || parsed.fixtures || []);
  if (!Array.isArray(vectors)) return [];
  return vectors.filter((v) => v && typeof v === 'object' && v.policy_parameters).map((v) => v.policy_parameters);
}

/**
 * Run one kernel over its observation set and classify it.
 * @returns {{ tool_id: string, verdict: string, mirrors: string[], observations: number, correlates: boolean|null }}
 */
export async function classifyKernel(toolId, { kernelsDir = KERNELS_DIR, fixturesDir = FIXTURES_DIR } = {}) {
  const base = { tool_id: toolId, mirrors: [], observations: 0, correlates: null };
  let compute;
  try {
    ({ compute } = await import(pathToFileURL(join(kernelsDir, `${toolId}.kernel.mjs`)).href));
  } catch {
    return { ...base, verdict: 'UNCLASSIFIED' };
  }
  if (typeof compute !== 'function') return { ...base, verdict: 'UNCLASSIFIED' };

  const inputs = [...fixtureInputs(toolId, fixturesDir), {}];
  const runs = [];
  for (const pp of inputs) {
    let r;
    // A kernel that throws on one input is not a failure of THIS gate — the observation is simply
    // unavailable. It becomes UNCLASSIFIED only if EVERY input is unavailable.
    try { r = compute(structuredClone(pp)); } catch { continue; }
    const flags = Array.isArray(r?.compliance_flags) ? r.compliance_flags.slice().sort() : [];
    runs.push({ key: JSON.stringify(flags), raised: flags.length > 0, payload: r?.output_payload });
  }
  if (runs.length === 0) return { ...base, verdict: 'UNCLASSIFIED' };

  const mirrors = [...new Set(runs.flatMap((r) => mirrorsPresent(r.payload)))].sort();
  const distinct = new Set(runs.map((r) => r.key));
  const out = { ...base, mirrors, observations: runs.length };

  if (!runs.some((r) => r.raised)) return { ...out, verdict: 'NO-FLAGS' };
  if (distinct.size === 1) return { ...out, verdict: 'CONSTANT' };

  // CONDITIONAL. Advisory only: does a mirror move with the flags on every observation?
  const always = runs.map((r) => JSON.parse(r.key)).reduce((a, b) => a.filter((x) => b.includes(x)));
  const correlates = runs.every((r) => {
    const conditional = JSON.parse(r.key).some((f) => !always.includes(f));
    return conditional === mirrorTruthy(r.payload);
  });
  return { ...out, verdict: 'CONDITIONAL', correlates };
}

export function loadBaseline(path = BASELINE_PATH) {
  if (!existsSync(path)) return { entries: [] };
  return JSON.parse(readFileSync(path, 'utf8'));
}

export async function run({ repo = REPO, argv = [] } = {}) {
  const kernelsDir = resolve(repo, 'chaingraph', 'kernels');
  const fixturesDir = resolve(kernelsDir, 'fixtures');
  const baselinePath = resolve(repo, 'scripts', 'flag-mirror-baseline.json');
  const report = argv.includes('--report');
  const update = argv.includes('--update');

  const toolIds = readdirSync(kernelsDir)
    .filter((f) => f.endsWith('.kernel.mjs'))
    .map((f) => f.replace(/\.kernel\.mjs$/, ''))
    .sort();

  const results = [];
  for (const id of toolIds) results.push(await classifyKernel(id, { kernelsDir, fixturesDir }));

  const tally = { CONDITIONAL: 0, CONSTANT: 0, 'NO-FLAGS': 0, UNCLASSIFIED: 0 };
  for (const r of results) tally[r.verdict]++;

  const violations = results.filter((r) => r.verdict === 'CONDITIONAL' && r.mirrors.length === 0).map((r) => r.tool_id);
  const uncorrelated = results.filter((r) => r.verdict === 'CONDITIONAL' && r.mirrors.length > 0 && r.correlates === false);
  const unclassified = results.filter((r) => r.verdict === 'UNCLASSIFIED').map((r) => r.tool_id);

  const baseline = loadBaseline(baselinePath);
  const shielded = new Set(baseline.entries || []);
  const violationSet = new Set(violations);
  const unshielded = violations.filter((id) => !shielded.has(id));
  const stale = [...shielded].filter((id) => !violationSet.has(id)).sort();

  console.log('FLAG-MIRROR-DOCTRINE (AUTHORING-STANDARD.md §2)');
  console.log(`  kernels ${results.length}  ·  CONDITIONAL ${tally.CONDITIONAL}  ·  CONSTANT ${tally.CONSTANT}  ·  NO-FLAGS ${tally['NO-FLAGS']}  ·  UNCLASSIFIED ${tally.UNCLASSIFIED}`);
  console.log(`  CONDITIONAL carrying a mirrored member: ${tally.CONDITIONAL - violations.length} / ${tally.CONDITIONAL}`);
  console.log(`  baseline ${shielded.size} shielded  ·  ${unshielded.length} unshielded violation(s)  ·  ${stale.length} stale entr(ies)`);
  if (unclassified.length) console.log(`  ⚠ UNCLASSIFIED (no observation possible — NOT a pass, SO #34c): ${unclassified.join(', ')}`);
  if (uncorrelated.length) console.log(`  ℹ advisory: ${uncorrelated.length} kernel(s) carry a mirror that does not track the conditional flags`);

  if (update) {
    // ⛔ Burn down only. Adding here would let a session widen its own shield silently.
    const kept = (baseline.entries || []).filter((id) => violationSet.has(id));
    writeFileSync(baselinePath, `${JSON.stringify({ ...baseline, entries: kept.sort() }, null, 2)}\n`);
    console.log(`  --update: removed ${stale.length} stale entr(ies); ${unshielded.length} unshielded violation(s) NOT added (by design).`);
    return unshielded.length === 0 ? 0 : 1;
  }

  if (report) {
    for (const r of results) {
      if (r.verdict === 'NO-FLAGS' || r.verdict === 'CONSTANT') continue;
      const shield = shielded.has(r.tool_id) ? ' [baselined]' : '';
      console.log(`    ${r.verdict.padEnd(12)} ${r.tool_id}${r.mirrors.length ? `  mirrors=[${r.mirrors.join(',')}]` : '  mirrors=NONE'}${shield}`);
    }
  }

  let failed = false;
  if (unshielded.length) {
    failed = true;
    console.error(`\n✗ ${unshielded.length} kernel(s) raise conditional flags with NO mirrored output_payload member:`);
    for (const id of unshielded) console.error(`    ${id}`);
    console.error(`  Add one of [${MIRROR_MEMBERS.join(', ')}] to output_payload — see chaingraph/standard/AUTHORING-STANDARD.md §2.2.`);
  }
  if (stale.length) {
    failed = true;
    console.error(`\n✗ ${stale.length} baseline entr(ies) no longer violate (or no longer exist). Run --update to burn them down:`);
    for (const id of stale) console.error(`    ${id}`);
  }
  if (!failed) console.log('\n✓ FLAG-MIRROR-DOCTRINE clean.');
  return failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(await run({ argv: process.argv.slice(2) }));
}
