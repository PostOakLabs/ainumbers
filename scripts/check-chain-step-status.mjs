#!/usr/bin/env node
/**
 * scripts/check-chain-step-status.mjs — GENERATOR-STATUS-FILTER-1.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ⛔ A CHAIN WHOSE STEP RESOLVES TO A NON-LIVE NODE IS RED.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * THIS IS A LIVE INTEROP DEFECT, NOT A COSMETIC ONE. An agent is told it can
 * call something that is gone.
 *
 * THE MEASURED CASE (0xAlpha 2026-08-23 deprecation-residue audit, LOAD-BEARING
 * #1). PR #1477 flipped `art-99-mica-transitional-deadline-router` to
 * `"status": "deprecated"`. It is STEP 1 — the ENTRY step — of the
 * `mica-transitional` chain. Nothing in the estate noticed:
 *
 *   · the assembler's refusal classifier sees nothing, because a status flip
 *     lives in the NODE shard and never touches graph/chains/*.json;
 *   · `validate-chains.mjs` (worker CI) checks that every step id RESOLVES into
 *     `nodes[]` — and art-99 does resolve, it is simply not live;
 *   · `check-chain-edge-contracts.mjs` (L1) is advisory by design and always
 *     exits 0, so it could not red this even if it looked;
 *   · the worker registers node tools live-only (`worker.mjs:4277` skips
 *     `status !== 'live'`) but `find_chain` serves the chain recipe with
 *     `entry_mcp_name: "route_mica_transitional_deadline", callable: true`.
 *
 * ⇒ An agent that follows the estate's own published recipe calls
 *   `route_mica_transitional_deadline` and receives `-32602 Tool not found`.
 *   Every future departure of an in-chain node repeats this shape exactly.
 *
 * ── WHAT THIS GATE CHECKS ───────────────────────────────────────────────────
 * For every `chains[].steps[]` entry whose `tool_id` RESOLVES to a node in
 * `nodes[]`: that node's status must be live. Steps whose id resolves to no node
 * at all are OUT OF SCOPE and are counted, never failed — 397 of 1141 steps name
 * standalone tool pages that were never graph nodes (measured on origin/main
 * 57f6b05e). Absence from the graph is not a departure; only an explicit
 * non-`live` status is (see scripts/_node-status.mjs).
 *
 * ── WHY A BASELINE EXISTS, AND WHY IT IS NOT A HIDING PLACE ─────────────────
 * One offender exists on main today, and this row may NOT fix it: re-stepping or
 * retiring `mica-transitional` is a STRUCTURAL chain modification, which is a
 * human ASSEMBLE/LAND decision (board ruling 48) and is explicitly outside this
 * row's fence (⛔ never chaingraph.json by hand). Shipping the gate unbaselined
 * would red main on a pre-existing condition, and a gate that reds main on a
 * pre-existing condition gets switched off.
 *
 * So: `scripts/chain-step-status-baseline.json` waives NAMED pairs, and it is
 * built so it cannot rot into a silent green —
 *
 *   1. THE FILE IS REQUIRED. Missing or unparseable ⇒ RED, never a pass
 *      (SO #34c: absence is its own state). ⛔ Deleting the baseline does not
 *      make this gate quiet; it makes it fail.
 *   2. EVERY WAIVER MUST BE EXPLAINED. `reason` (>= 40 chars) and `owner_row`
 *      are mandatory per entry; a malformed entry is RED.
 *   3. WAIVERS ARE PRINTED ON EVERY RUN, pass or fail. There is no run of this
 *      gate that does not say out loud what it is ignoring.
 *   4. RATCHET, ONE DIRECTION. `--prune` REMOVES entries that no longer offend.
 *      There is deliberately no `--update` / `--accept`: a NEW offender can only
 *      be waived by a human typing a reason into the file. (Same doctrine as
 *      the nav-island baseline: `--prune`, never `--update`.)
 *   5. DENOMINATOR. If the run resolved zero steps to zero nodes, that is RED,
 *      not green — a broken read must not present as a clean estate.
 *
 * ⛔ SCOPE NOTE (PR #1494): `registry/lineage` and `registry/errata` are
 *    append-only and are not read, filtered or pruned by anything here. This
 *    gate reads chaingraph.json and its own baseline; it writes nothing except
 *    the baseline under --prune.
 *
 * Usage:
 *   node scripts/check-chain-step-status.mjs
 *   node scripts/check-chain-step-status.mjs --prune
 *   node scripts/check-chain-step-status.mjs --graph <path> --baseline <path>
 *
 * Exit codes: 0 clean · 1 offender(s) not waived, or a malformed/absent baseline
 *             · 2 usage
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isNonLive } from './_node-status.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

export const DEFAULT_GRAPH = resolve(REPO, 'chaingraph', 'chaingraph.json');
export const DEFAULT_BASELINE = resolve(HERE, 'chain-step-status-baseline.json');

/** A waiver must say WHY in a sentence, not in a word. */
export const MIN_REASON_CHARS = 40;

/** Stable key for one (chain, step) pair. */
export function pairKey(chainName, toolId) {
  return `${chainName}::${toolId}`;
}

/**
 * Walk every chain step and classify it. Pure — takes an already-parsed graph.
 *
 * @param {{nodes?: any[], chains?: any[]}} cg
 * @returns {{
 *   offenders: Array<{key:string, chain:string, tool_id:string, status:string, mcp_name:string|null, step_index:number, is_entry:boolean}>,
 *   stepsTotal: number,
 *   stepsResolved: number,
 *   stepsUnresolved: number,
 *   chainsTotal: number,
 *   nodesTotal: number,
 * }}
 */
export function scanChainSteps(cg) {
  const nodes = Array.isArray(cg?.nodes) ? cg.nodes : [];
  const chains = Array.isArray(cg?.chains) ? cg.chains : [];
  const byId = new Map(nodes.map((n) => [n.tool_id, n]));
  const offenders = [];
  let stepsTotal = 0, stepsResolved = 0, stepsUnresolved = 0;
  for (const chain of chains) {
    const steps = Array.isArray(chain?.steps) ? chain.steps : [];
    steps.forEach((step, i) => {
      // `tool_id` is the field chains actually carry; `node_id` is the name
      // CONTRACT §A4 uses for the same thing. Accept both rather than silently
      // skipping a chain written to the other spelling.
      const id = step?.tool_id ?? step?.node_id;
      if (typeof id !== 'string' || !id) return;
      stepsTotal++;
      const node = byId.get(id);
      if (!node) { stepsUnresolved++; return; }
      stepsResolved++;
      if (!isNonLive(node)) return;
      offenders.push({
        key: pairKey(chain.name, id),
        chain: chain.name,
        tool_id: id,
        status: node.status,
        mcp_name: node.mcp_name ?? null,
        step_index: i,
        is_entry: i === 0,
      });
    });
  }
  offenders.sort((a, b) => a.key.localeCompare(b.key));
  return {
    offenders,
    stepsTotal,
    stepsResolved,
    stepsUnresolved,
    chainsTotal: chains.length,
    nodesTotal: nodes.length,
  };
}

/**
 * Validate the baseline document's SHAPE. Returns the problems, never throws —
 * the caller turns them into the exit code, so the self-test can assert on them.
 */
export function validateBaseline(doc) {
  const problems = [];
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return ['baseline is not a JSON object'];
  }
  if (!Array.isArray(doc.waivers)) return ['baseline has no `waivers` array'];
  doc.waivers.forEach((w, i) => {
    const at = `waivers[${i}]`;
    if (!w || typeof w !== 'object') { problems.push(`${at} is not an object`); return; }
    if (typeof w.chain !== 'string' || !w.chain) problems.push(`${at} has no \`chain\``);
    if (typeof w.tool_id !== 'string' || !w.tool_id) problems.push(`${at} has no \`tool_id\``);
    if (typeof w.owner_row !== 'string' || !w.owner_row) problems.push(`${at} has no \`owner_row\` (which row owns resolving it)`);
    if (typeof w.reason !== 'string' || w.reason.trim().length < MIN_REASON_CHARS) {
      problems.push(`${at} \`reason\` must be at least ${MIN_REASON_CHARS} characters — a waiver has to say why`);
    }
  });
  return problems;
}

/** Load + shape-check the baseline. A missing file is a PROBLEM, never an empty pass. */
export function loadBaseline(path) {
  if (!existsSync(path)) {
    return { doc: null, problems: [`baseline file is MISSING at ${path} — absence is not a pass (SO #34c). Restore it, or create it with an empty \`waivers\` array.`] };
  }
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { doc: null, problems: [`baseline file at ${path} is not parseable JSON: ${e.message}`] };
  }
  return { doc, problems: validateBaseline(doc) };
}

/** Split offenders into waived / unwaived, and find waivers that no longer apply. */
export function reconcile(offenders, doc) {
  const waived = new Map((doc?.waivers ?? []).map((w) => [pairKey(w.chain, w.tool_id), w]));
  const offenderKeys = new Set(offenders.map((o) => o.key));
  return {
    unwaived: offenders.filter((o) => !waived.has(o.key)),
    waivedHits: offenders.filter((o) => waived.has(o.key)).map((o) => ({ ...o, waiver: waived.get(o.key) })),
    staleWaivers: [...waived.values()].filter((w) => !offenderKeys.has(pairKey(w.chain, w.tool_id))),
  };
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function main() {
  const PRUNE = process.argv.includes('--prune');
  const graphPath = argValue('--graph') ?? DEFAULT_GRAPH;
  const baselinePath = argValue('--baseline') ?? DEFAULT_BASELINE;

  let cg;
  try {
    cg = JSON.parse(readFileSync(graphPath, 'utf8'));
  } catch (e) {
    console.error(`check-chain-step-status: cannot read ${graphPath}: ${e.message}`);
    process.exit(1);
  }

  const scan = scanChainSteps(cg);
  const { doc, problems } = loadBaseline(baselinePath);
  const { unwaived, waivedHits, staleWaivers } = reconcile(scan.offenders, doc);

  // DENOMINATOR (SO #34c, and check-git-env-scrub's check D one level over): a
  // run that resolved nothing proves nothing. A broken read must not read as a
  // clean estate.
  if (scan.chainsTotal === 0 || scan.stepsResolved === 0) {
    console.error(`check-chain-step-status: DENOMINATOR EMPTY — ${scan.chainsTotal} chain(s), ${scan.stepsResolved} step(s) resolved to a node out of ${scan.stepsTotal}. Nothing was measured, so this is not a pass.`);
    process.exit(1);
  }

  // Waivers are ALWAYS printed, pass or fail. No run of this gate is silent
  // about what it is ignoring.
  if (waivedHits.length) {
    console.log(`check-chain-step-status: ${waivedHits.length} WAIVED offender(s) (baseline: ${baselinePath}):`);
    for (const o of waivedHits) {
      console.log(`  ~ ${o.chain} step ${o.step_index}${o.is_entry ? ' (ENTRY)' : ''} -> ${o.tool_id} [${o.status}]${o.mcp_name ? ` mcp_name=${o.mcp_name}` : ''}`);
      console.log(`      owner_row: ${o.waiver.owner_row}`);
      console.log(`      reason:    ${o.waiver.reason}`);
    }
  }

  if (PRUNE) {
    if (problems.length) {
      console.error('check-chain-step-status --prune: baseline is malformed; refusing to rewrite it:');
      for (const p of problems) console.error(`  ✗ ${p}`);
      process.exit(1);
    }
    if (!staleWaivers.length) {
      console.log('check-chain-step-status --prune: nothing to prune (every waiver still names a real offender).');
      process.exit(0);
    }
    const staleKeys = new Set(staleWaivers.map((w) => pairKey(w.chain, w.tool_id)));
    const next = { ...doc, waivers: doc.waivers.filter((w) => !staleKeys.has(pairKey(w.chain, w.tool_id))) };
    writeFileSync(baselinePath, JSON.stringify(next, null, 2) + '\n');
    console.log(`check-chain-step-status --prune: removed ${staleWaivers.length} waiver(s) that no longer name an offender (${doc.waivers.length} -> ${next.waivers.length}):`);
    for (const w of staleWaivers) console.log(`  − ${w.chain} -> ${w.tool_id}`);
    process.exit(0);
  }

  let failed = false;

  if (problems.length) {
    console.error('check-chain-step-status: BASELINE UNUSABLE:');
    for (const p of problems) console.error(`  ✗ ${p}`);
    failed = true;
  }

  if (unwaived.length) {
    console.error(`\ncheck-chain-step-status: ${unwaived.length} chain step(s) resolve to a NON-LIVE node:`);
    for (const o of unwaived) {
      console.error(`  ✗ chain "${o.chain}" step ${o.step_index}${o.is_entry ? ' (ENTRY STEP)' : ''} -> ${o.tool_id} [status: ${o.status}]`);
      if (o.mcp_name) {
        console.error(`      find_chain will advertise ${o.is_entry ? 'entry_mcp_name' : 'this step'} "${o.mcp_name}" as callable, but the worker registers node tools live-only`);
        console.error(`      => an agent following this recipe gets -32602 Tool not found.`);
      }
    }
    console.error('\n  A chain stepping through a departed node is a live interop defect. Re-step the chain');
    console.error('  around the node, or retire the chain — both are STRUCTURAL chain modifications, i.e. a');
    console.error('  human ASSEMBLE/LAND row (ruling 48), never an auto-land and never a hand edit of');
    console.error('  chaingraph.json. If it must ship unresolved, add a waiver with a reason and an');
    console.error(`  owner_row to ${baselinePath}.`);
    failed = true;
  }

  if (staleWaivers.length) {
    console.error(`\ncheck-chain-step-status: ${staleWaivers.length} baseline waiver(s) no longer name an offender — the ratchet must go down:`);
    for (const w of staleWaivers) console.error(`  ✗ ${w.chain} -> ${w.tool_id} (owner_row: ${w.owner_row})`);
    console.error('  Run: node scripts/check-chain-step-status.mjs --prune');
    failed = true;
  }

  if (failed) process.exit(1);

  console.log(`check-chain-step-status: OK — ${scan.chainsTotal} chains, ${scan.stepsTotal} steps (${scan.stepsResolved} resolve to a graph node, ${scan.stepsUnresolved} name a non-node tool page and are out of scope), 0 unwaived non-live step(s), ${waivedHits.length} waived.`);
}

if (resolve(process.argv[1] || '') === resolve(fileURLToPath(import.meta.url))) main();
