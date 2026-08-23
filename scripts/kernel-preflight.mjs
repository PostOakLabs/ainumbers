#!/usr/bin/env node
/**
 * scripts/kernel-preflight.mjs — KERNEL-PREFLIGHT-1.
 *
 * Every kernel-class check the estate already has (RIDER-KERNEL.md's 107-line
 * checklist + preflight.mjs's GATES list), scoped to ONE kernel, in ~1-2 minutes,
 * so a K session can run it repeatedly WHILE AUTHORING instead of discovering
 * failures in a 10-minute whole-repo preflight at push, on a red PR, or after a
 * GPU prove (Tim, 2026-08-16: "these workflows should work without issues the
 * moment they are made").
 *
 * This file WIRES existing checks — it writes no new gate logic. Every check
 * below either already had a per-kernel mode, or gained a small `--only <id>`
 * flag on the underlying script (behaviour-neutral: whole-estate run is
 * unchanged when the flag is absent). See the row's `done:` list for which
 * scripts were touched.
 *
 * Usage:
 *   node scripts/kernel-preflight.mjs <art-id>            full check list
 *   node scripts/kernel-preflight.mjs <art-id> --fast      skip the GPU cycle
 *                                                           preflight (runq-cpu
 *                                                           is a remote-box
 *                                                           binary, absent on a
 *                                                           dev machine)
 *   node scripts/kernel-preflight.mjs <art-id> --page-less  manual override: force the
 *                                                           page-less-shard exemption
 *                                                           (node page + hub-categories
 *                                                           checks become N-A). Normally
 *                                                           NOT needed — this is derived
 *                                                           automatically from the node's
 *                                                           own chaingraph.json/shard url
 *                                                           field (page-less class = url
 *                                                           does not point at a
 *                                                           chaingraph/art-*.html page;
 *                                                           see memory "Kernel shard row
 *                                                           ships page-less"). Use only if
 *                                                           that derivation can't yet see
 *                                                           your case (e.g. the shard file
 *                                                           doesn't exist yet).
 *   node scripts/kernel-preflight.mjs <art-id> --keep-going  run every check even
 *                                                           after one fails
 *                                                           (default: fail-fast)
 *
 * cwd: repo/ (relative paths below resolve against this file's own location,
 * so it also works run from elsewhere, but the row's convention is cwd=repo/).
 *
 * Exit 0 iff every check is READY/PASS/N-A. Exit 1 on any ✗.
 */
import { execSync, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };

const argv = process.argv.slice(2);
const ID = argv.find((a) => !a.startsWith('--'));
const FAST = argv.includes('--fast');
const PAGE_LESS = argv.includes('--page-less');
const KEEP_GOING = argv.includes('--keep-going');

if (!ID) {
  console.error('Usage: node scripts/kernel-preflight.mjs <art-id> [--fast] [--page-less] [--keep-going]');
  process.exit(2);
}

const KERNEL_PATH = resolve(REPO, 'chaingraph', 'kernels', `${ID}.kernel.mjs`);
if (!existsSync(KERNEL_PATH)) {
  console.error(`✗ kernel-preflight ${ID}: no chaingraph/kernels/${ID}.kernel.mjs — not a kernel id.`);
  process.exit(2);
}

const PROPTEST_PATH = resolve(REPO, 'chaingraph', 'kernels', '__proptests__', `${ID}.proptest.mjs`);
const SHARD_PATH = resolve(REPO, 'chaingraph', 'graph', 'nodes', `${ID}.json`);
const PAGE_PATH = resolve(REPO, 'chaingraph', `${ID}.html`);

function run(label, cmd, extra) {
  const t0 = Date.now();
  try {
    const out = execSync(cmd, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    return { label, status: 'PASS', ms: Date.now() - t0, out, ...extra };
  } catch (e) {
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    return { label, status: 'FAIL', ms: Date.now() - t0, out, ...extra };
  }
}

function na(label, reason) {
  return { label, status: 'N-A', ms: 0, note: reason };
}

const results = [];

function record(r) {
  results.push(r);
  return r;
}

function shouldStop() {
  return !KEEP_GOING && results.some((r) => r.status === 'FAIL');
}

// 1. syntax
if (!shouldStop()) {
  record(run('Syntax (tool/kernel/chain HTML)', 'node chaingraph/kernels/syntax-check.mjs'));
}

// 2. exports
if (!shouldStop()) {
  record(run('Kernel exports (meta+compute+buildArtifact)', `node scripts/check-kernel-exports.mjs --only ${ID}`));
}

// 3. forbidden-hash lint
if (!shouldStop()) {
  record(run('Forbidden-hash lint', `node chaingraph/kernels/lint-forbidden-hash.mjs --only ${ID}`));
}

// 4. guest-builtin safety
if (!shouldStop()) {
  record(run('Guest-builtin safety (GUEST-BUILTIN-GATE-1)', `node chaingraph/kernels/check-guest-builtin-safety.mjs --only ${ID}`));
}

// 4b. citation-in-comments (KERNEL-CITATION-CLASS-1) — kernel source is BEHAVIOUR ONLY;
// a citation belongs in node metadata (regulatory_basis/cited_clause_digest/description),
// never a kernel comment, so a wrong one is a metadata PR forever, never a re-prove.
// Scoped to new/changed kernels only inside the lint script itself — an unchanged existing
// kernel is N-A here, not a fail (RIDER-KERNEL.md SHARD-GATE-PRE-ASSEMBLE-1's own scoping
// shape, applied to this gate).
if (!shouldStop()) {
  record(run('Citation-in-comments (KERNEL-CITATION-CLASS-1)', `node chaingraph/kernels/lint-kernel-citation-comments.mjs --only ${ID}`));
}

// 5. VM<->worker parity
if (!shouldStop()) {
  record(run('VM<->worker parity (§24)', `node chaingraph/kernels/vm-parity-gate.mjs --strict --only ${ID}`));
}

// 6. tsc --checkJs (jsdoc-checkjs-gate.mjs). MUST use the SAME "touched" scoping the real
// gate uses (a genuine PR diff vs its base), never "always the target kernel" — measured
// while building this row: 606/616 kernels share a `{ now, parent_hashes = [], ... } = {}`
// buildArtifact destructuring with no default for `now`, which tsc's --checkJs flags with
// a "Property 'now' does not exist" diagnostic on ANY file it type-checks with that shape,
// regardless of whether the file was actually edited. jsdoc-checkjs-gate.mjs's own header
// already documents this as a known, accepted, permanent gap that is harmless ONLY because
// rule (1) (scope-to-touched) reclassifies it as "ignored-dependency" whenever the kernel
// itself is not part of the diff being checked — confirmed against the REAL CI run for the
// ASSEMBLE-ART628-1 PR (run 31970940656): it type-checked art-628's kernel.mjs (pulled in
// only to resolve the touched proptest file's import) and correctly logged the 'now'
// diagnostic as "[pre-existing dependency, not in this diff, ignored]", while a REAL bug
// in the touched proptest file (TS2464, computed property name) was the actual [BLOCKING]
// failure. Passing the kernel file itself as an unconditional touched root — this check's
// first version — reproduced a false FAIL on every kernel, including art-617 (the row's own
// READY fixture). The fix: only treat kernel/floor as "touched" (passed to tsc as a root)
// if they actually differ from origin/main, or don't exist there yet (a brand-new shard) —
// exactly PR-diff scoping, using origin/main as the stand-in base a live authoring session
// would otherwise diff against.
if (!shouldStop()) {
  const relKernel = `chaingraph/kernels/${ID}.kernel.mjs`;
  const relFloor = `chaingraph/kernels/__proptests__/${ID}.proptest.mjs`;
  const candidates = [relKernel, ...(existsSync(PROPTEST_PATH) ? [relFloor] : [])];

  function differsFromOriginMain(relPath, absPath) {
    let originContent;
    try {
      originContent = execFileSync('git', ['show', `origin/main:${relPath}`], { cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch {
      return true; // absent from origin/main — brand-new file, genuinely touched
    }
    return originContent !== readFileSync(absPath, 'utf8');
  }
  const files = candidates.filter((rel) => differsFromOriginMain(rel, resolve(REPO, rel)));

  if (files.length === 0) {
    record(na('tsc --checkJs (jsdoc-checkjs-gate.mjs)', `${relKernel}${existsSync(PROPTEST_PATH) ? ' and its floor file' : ''} match origin/main byte-for-byte — nothing touched, nothing for CI's real PR-diff-scoped gate to check either.`));
  } else {
    // win32 npx.cmd spawnSync EINVAL is fixed inside jsdoc-checkjs-gate.mjs itself
    // (JSDOC-CHECKJS-PREFLIGHT-1, 2026-08-16 — resolves npx-cli.js and runs it through
    // `node` directly, no shell) — nothing extra needed here, same as preflight.mjs's
    // own "JSDoc CheckJS" gate calls it plainly.
    record(run('tsc --checkJs (jsdoc-checkjs-gate.mjs)', `node scripts/jsdoc-checkjs-gate.mjs ${files.join(' ')}`));
  }
}

// 7. proptest floor — run this kernel's own floor file directly (every floor file
//    imports ONLY its own sibling .kernel.mjs — run-proptests.mjs's own header
//    documents this as checked, not assumed — so running it standalone is exact).
if (!shouldStop()) {
  if (!existsSync(PROPTEST_PATH)) {
    record({ label: 'Property-testing floor', status: 'FAIL', ms: 0, out: `missing chaingraph/kernels/__proptests__/${ID}.proptest.mjs — every live kernel carries one (616/616 as of KERNEL-PREFLIGHT-1).` });
  } else {
    record(run('Property-testing floor', `node chaingraph/kernels/__proptests__/${ID}.proptest.mjs`));
  }
}

// 7b. floor digest stamp (FV-FLOOR-DIGEST-GATE-1) — only meaningful once the
// floor file exists; reuses check-fv-floor-coverage.mjs's own --verify-authoring
// mode, which is already scoped to exactly the files it's given.
if (!shouldStop()) {
  if (!existsSync(PROPTEST_PATH)) {
    record(na('Floor digest stamp (kernel_digest_at_authoring)', 'no floor file to check (see prior FAIL)'));
  } else {
    record(run('Floor digest stamp (kernel_digest_at_authoring)', `node scripts/check-fv-floor-coverage.mjs --verify-authoring "chaingraph/kernels/__proptests__/${ID}.proptest.mjs"`));
  }
}

// 8. registration two-step — INDEPENDENT DERIVATION (SO #34): read the shard file,
// chaingraph.meta.json order.nodes, and chaingraph.json nodes directly, never a
// self-attested summary. Mirrors RIDER-KERNEL.md's SHARD-GATE-PRE-ASSEMBLE-1
// branch-aware semantics: a shard absent from origin/main and not yet registered
// is PENDING-ASSEMBLE (informational PASS), not a leak.
if (!shouldStop()) {
  const t0 = Date.now();
  if (!existsSync(SHARD_PATH)) {
    record({ label: 'Registration: shard file present', status: 'FAIL', ms: Date.now() - t0, out: `missing chaingraph/graph/nodes/${ID}.json` });
  } else {
    let onOriginMain = false;
    try {
      execFileSync('git', ['cat-file', '-e', `origin/main:chaingraph/graph/nodes/${ID}.json`], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
      onOriginMain = true;
    } catch { /* not on origin/main — a brand-new shard, or origin unresolvable (treated as absent, same as check-shard-assembly.mjs's fail-closed-on-assembler-branch design does not apply to a non-assembling K row) */ }
    let meta = { order: { nodes: [] } };
    try { meta = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.meta.json'), 'utf8')); } catch { /* unreadable — treated as not-registered below */ }
    const registered = Array.isArray(meta?.order?.nodes) && meta.order.nodes.includes(ID);
    let cg = { nodes: [] };
    try { cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8')); } catch { /* unreadable */ }
    const assembled = Array.isArray(cg?.nodes) && cg.nodes.some((n) => n.tool_id === ID);

    if (assembled && registered) {
      record({ label: 'Registration: shard assembled + registered', status: 'PASS', ms: Date.now() - t0, out: `${ID} present in chaingraph.meta.json order.nodes and chaingraph.json.` });
    } else if (!registered && !assembled && !onOriginMain) {
      record({ label: 'Registration: shard assembled + registered', status: 'PASS', ms: Date.now() - t0, out: `PENDING-ASSEMBLE — ${ID} is a new shard, absent from origin/main, not yet registered. ASSEMBLE-LAND owns registration (RIDER-KERNEL.md SHARD-GATE-PRE-ASSEMBLE-1) — this is NOT a leak, no action needed from this row.` });
    } else {
      record({ label: 'Registration: shard assembled + registered', status: 'FAIL', ms: Date.now() - t0, out: `NODE-REGISTRATION-GAP-1 shape: shard present on origin/main or partially registered (registered=${registered} assembled=${assembled} onOriginMain=${onOriginMain}) but not BOTH registered+assembled. Fix via ASSEMBLE-LAND, never by hand-editing chaingraph.json/chaingraph.meta.json yourself (RIDER-KERNEL.md, SO #6/#35).` });
    }
  }
}

// Page-less-class discriminator (INDEPENDENT DERIVATION, SO #34): read the SAME field
// gen-chaingraph-hub.mjs itself uses to decide whether a node is required to have a
// chaingraph/art-*.html card at all — `n.url.includes('/chaingraph/art-')`. A shard whose
// url points at tools/NNN-*.html instead (the "Kernel shard row ships page-less" class —
// its node page is structurally the assemble row's, per that memory) is OUT OF SCOPE for
// both the hub-categories membership check and the node-page/hub-link check, by the exact
// same rule the real gate already enforces — not a guess, and not the `--page-less` flag
// (kept below only as a manual override for a case this derivation cannot yet see).
let nodeUrl = null;
try {
  const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
  nodeUrl = cg.nodes.find((n) => n.tool_id === ID)?.url ?? null;
} catch { /* handled as N-A below if unresolvable */ }
if (!nodeUrl && existsSync(SHARD_PATH)) {
  // A PENDING-ASSEMBLE shard (new, not yet in chaingraph.json) still carries its own url
  // field in the shard file itself — same field, same primary source, just not assembled yet.
  try { nodeUrl = JSON.parse(readFileSync(SHARD_PATH, 'utf8'))?.url ?? null; } catch { /* left null */ }
}
const REQUIRES_HUB_CARD = PAGE_LESS ? false : (nodeUrl ? nodeUrl.includes('/chaingraph/art-') : null);

// 9. hub-categories.json membership — only required for nodes gen-chaingraph-hub.mjs
// itself would require it for (see REQUIRES_HUB_CARD derivation above).
if (!shouldStop()) {
  const t0 = Date.now();
  if (REQUIRES_HUB_CARD === false) {
    record({ label: 'hub-categories.json membership', status: 'N-A', ms: Date.now() - t0, out: `${ID}'s chaingraph.json url (${nodeUrl ?? 'unresolved'}) is not a chaingraph/art-* page — gen-chaingraph-hub.mjs's own coverage gate does not require a hub-categories.json entry for this class (page-less shard).` });
  } else if (REQUIRES_HUB_CARD === null) {
    record({ label: 'hub-categories.json membership', status: 'FAIL', ms: Date.now() - t0, out: `${ID} not found in chaingraph.json — cannot derive whether a hub-categories.json entry is required.` });
  } else {
    try {
      const hub = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'hub-categories.json'), 'utf8'));
      const present = Object.values(hub).some((cat) => Array.isArray(cat.art_ids) && cat.art_ids.includes(ID));
      if (present) {
        record({ label: 'hub-categories.json membership', status: 'PASS', ms: Date.now() - t0, out: `${ID} present in hub-categories.json.` });
      } else {
        record({ label: 'hub-categories.json membership', status: 'FAIL', ms: Date.now() - t0, out: `${ID} absent from every category's art_ids[] in chaingraph/hub-categories.json — the hub category-map gate class this week's defects hit.` });
      }
    } catch (e) {
      record({ label: 'hub-categories.json membership', status: 'FAIL', ms: Date.now() - t0, out: `could not read/parse chaingraph/hub-categories.json: ${e.message}` });
    }
  }
}

// 10. node page exists + is hub-linked — same page-less exemption.
if (!shouldStop()) {
  const t0 = Date.now();
  if (REQUIRES_HUB_CARD === false) {
    record({ label: 'Node page exists + linked from a hub', status: 'N-A', ms: Date.now() - t0, out: `${ID} is a page-less shard by chaingraph.json's own url field (${nodeUrl ?? 'unresolved'}) — no chaingraph/${ID}.html is expected from this row; that page is structurally the assemble row's.` });
  } else if (!existsSync(PAGE_PATH)) {
    record({ label: 'Node page exists + linked from a hub', status: 'FAIL', ms: Date.now() - t0, out: `missing chaingraph/${ID}.html, and chaingraph.json's url field says this node IS a chaingraph/art-* page (${nodeUrl ?? 'unresolved'}).` });
  } else {
    const nav = run('Node page exists + linked from a hub', 'node scripts/check-nav-reachability.mjs');
    const pageRel = `chaingraph/${ID}.html`;
    const isIsland = nav.out.includes(pageRel);
    if (nav.status === 'PASS' || !isIsland) {
      record({ label: 'Node page exists + linked from a hub', status: 'PASS', ms: nav.ms, out: `chaingraph/${ID}.html exists and is not reported as an unreachable island.` });
    } else {
      record({ label: 'Node page exists + linked from a hub', status: 'FAIL', ms: nav.ms, out: `chaingraph/${ID}.html is an unreachable island per check-nav-reachability.mjs (NAV-ISLAND-1) — wire it into a hub.\n${nav.out}` });
    }
  }
}

// 11. cited_clause_digest present-or-explicitly-N/A — INDEPENDENT DERIVATION: read
// the shard's own standards_basis/cited_clause_digest fields (SO #34), never a
// summary. The `regulatory_basis` kernel-output-field discriminator is the same
// one FAST-PROVE-BATCH-1 used to classify standards-implementing vs not (grepped
// from the kernel source, since only 4/616 nodes carry standards_basis today —
// see ORCH CORRECTION on this row: this check reports N-A for a non-standards
// node, never weakens or drops the check itself).
if (!shouldStop()) {
  const t0 = Date.now();
  let shard = null;
  try { shard = JSON.parse(readFileSync(SHARD_PATH, 'utf8')); } catch { /* handled by registration check above */ }
  const kernelSrc = readFileSync(KERNEL_PATH, 'utf8');
  const looksStandardsImplementing = /\bregulatory_basis\s*:/.test(kernelSrc) || shard?.standards_basis === 'implements_standard';

  if (shard?.standards_basis === 'not_applicable') {
    record({ label: 'cited_clause_digest present-or-N/A (SO #38/§30)', status: 'N-A', ms: Date.now() - t0, out: `${ID} declares standards_basis:"not_applicable".` });
  } else if (shard?.standards_basis === 'implements_standard') {
    const digests = Array.isArray(shard.cited_clause_digest) ? shard.cited_clause_digest : [];
    if (digests.length > 0) {
      record({ label: 'cited_clause_digest present-or-N/A (SO #38/§30)', status: 'PASS', ms: Date.now() - t0, out: `${digests.length} cited_clause_digest entr(ies) present.` });
    } else {
      record({ label: 'cited_clause_digest present-or-N/A (SO #38/§30)', status: 'FAIL', ms: Date.now() - t0, out: `standards_basis:"implements_standard" but cited_clause_digest[] is empty — SO #38 violation.` });
    }
  } else if (looksStandardsImplementing) {
    record({ label: 'cited_clause_digest present-or-N/A (SO #38/§30)', status: 'FAIL', ms: Date.now() - t0, out: `kernel source declares a regulatory_basis (standards-implementing) but the shard carries no standards_basis field at all — SO #38 requires "implements_standard" + cited_clause_digest[], or an explicit "not_applicable".` });
    } else {
    record({ label: 'cited_clause_digest present-or-N/A (SO #38/§30)', status: 'N-A', ms: Date.now() - t0, out: `no standards_basis field and no regulatory_basis in kernel source — not a standards-implementing node by this discriminator (the same one FAST-PROVE-BATCH-1 used). Reported N-A, never silently passed: RIDER-KERNEL/CLAUSE-DIGEST-LAND-0816-1 own backfilling this class, not this row.` });
  }
}

// 12. GPU cycle preflight (GPU-CYCLE-PREFLIGHT-1) — runq-cpu is a remote GPU-box
// binary (/root/ocg-zkvm/runq-cpu per GPU-CYCLE-PREFLIGHT-SPEC.md), not present on
// every machine this command runs from. --fast skips it outright; otherwise this
// probes for the binary and reports PENDING (not a failure) when absent, FAST/SLOW
// when it can actually run.
{
  const t0 = Date.now();
  if (FAST) {
    record({ label: 'GPU cycle preflight (runq-cpu exec)', status: 'N-A', ms: 0, out: 'cycle_preflight: FAST-SKIPPED (--fast) — run without --fast before booking GPU time.' });
  } else {
    const RUNQ = '/root/ocg-zkvm/runq-cpu';
    if (!existsSync(RUNQ)) {
      record({ label: 'GPU cycle preflight (runq-cpu exec)', status: 'N-A', ms: Date.now() - t0, out: `cycle_preflight: PENDING — runq-cpu not found at ${RUNQ} on this machine. Run on the GPU box per GPU-CYCLE-PREFLIGHT-SPEC.md before booking a prove.` });
    } else {
      // Deliberately not implemented further here: the exec-preflight recipe needs
      // per-kernel policy_parameters (prep_pp.mjs) and a KROOT this command has no
      // way to derive generically across 616 heterogeneous kernels. Reported PENDING
      // with the exact commands to run by hand, per GPU-CYCLE-PREFLIGHT-SPEC.md.
      record({ label: 'GPU cycle preflight (runq-cpu exec)', status: 'N-A', ms: Date.now() - t0, out: `cycle_preflight: PENDING — runq-cpu found but this command does not auto-derive per-kernel policy_parameters. Run manually: node "$T/prep_pp.mjs" "${ID}" "$KROOT" "$O/pp_${ID}.json" && ${RUNQ} exec "$K" "$O/pp_${ID}.json"` });
    }
  }
}

// ── report ────────────────────────────────────────────────────────────────
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
const glyph = { PASS: '✓', FAIL: '✗', 'N-A': '·' };
const rule = '─'.repeat(96);
console.log(`\nKERNEL-PREFLIGHT ${ID}`);
console.log(rule);
for (const r of results) {
  console.log(`${glyph[r.status]} ${pad(r.status, 6)}${String(r.ms).padStart(7)}ms  ${r.label}`);
  if (r.status !== 'PASS' && r.out) {
    console.log(r.out.trim().split('\n').map((l) => `      ${l}`).join('\n'));
  }
}
console.log(rule);

// The authoring convention has no gate that can fire on a kernel nobody wrote yet, so it is printed
// where an author is already looking (AUTHORING-STANDARD-ADOPT-1). One line, every run, pass or fail.
console.log('AUTHORING: chaingraph/standard/AUTHORING-STANDARD.md — refusal-carrying exclusions (§1),');
console.log('           flag-mirror doctrine (§2), documentary citation validation (§3.1), snapshot expiry (§3.2).');
console.log(rule);

const fails = results.filter((r) => r.status === 'FAIL');
const totalMs = results.reduce((a, r) => a + r.ms, 0);
console.log(`TOTAL ${(totalMs / 1000).toFixed(1)}s wall-clock (sum of checks run; ${results.length} check(s) reached${shouldStop() ? ', stopped at first FAIL — pass --keep-going to run every check' : ''})`);

if (fails.length) {
  console.log(`\nKERNEL-PREFLIGHT ${ID}: NOT READY (${fails.length} failing)`);
  process.exit(1);
}
console.log(`\nKERNEL-PREFLIGHT ${ID}: READY`);
process.exit(0);
