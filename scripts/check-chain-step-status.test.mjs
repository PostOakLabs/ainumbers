#!/usr/bin/env node
/**
 * scripts/check-chain-step-status.test.mjs — controls for check-chain-step-status.mjs.
 *
 * SO #40(b): a new gate proves RED before GREEN, and the RED is the FIRST case
 * here on purpose. Every control drives the real script end to end (spawned with
 * --graph/--baseline pointed at throwaway fixtures) rather than re-implementing
 * its logic, so a checker that stopped checking cannot pass its own test.
 *
 * ⛔ SO #34's mutation discipline: the fixtures below are the same graph with ONE
 *    field moved. If flipping `status` alone does not move the verdict, the gate
 *    is not reading status.
 *
 * Controls:
 *   1. RED       chain steps to a deprecated node, no waiver          -> exit 1
 *   2. RED       ...and the ENTRY-step / find_chain wording is emitted
 *   3. GREEN     same graph, node flipped back to live (ONE-FIELD MUTATION)
 *   4. GREEN     same offender, waived with a reason + owner_row
 *   5. RED       waiver with a too-short reason
 *   6. RED       waiver missing owner_row
 *   7. RED       baseline file absent (absence is not a pass, SO #34c)
 *   8. RED       baseline waiver that no longer names an offender (ratchet)
 *   9. GREEN     --prune removes exactly that stale waiver
 *  10. RED       empty denominator (no chains) is not a clean estate
 *  11. GREEN     a step naming a non-node tool page is out of scope, not a fail
 *
 * Run: node scripts/check-chain-step-status.test.mjs
 */

import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, 'check-chain-step-status.mjs');

let pass = 0, fail = 0;
function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}
function heading(n, s) { console.log(`\n[${n}] ${s}`); }

/** One node graph, parameterised by the departed node's status. */
function graph(status, { chains = 'normal' } = {}) {
  const nodes = [
    { tool_id: 'fx-alpha', status: 'live', mcp_name: 'run_fx_alpha', url: 'https://ainumbers.co/chaingraph/fx-alpha.html' },
    { tool_id: 'fx-beta', status, mcp_name: 'run_fx_beta', url: 'https://ainumbers.co/chaingraph/fx-beta.html' },
    { tool_id: 'fx-gamma', status: 'live', mcp_name: 'run_fx_gamma', url: 'https://ainumbers.co/chaingraph/fx-gamma.html' },
  ];
  const normal = [
    { name: 'fx-departed-entry', steps: [{ tool_id: 'fx-beta' }, { tool_id: 'fx-gamma' }] },
    { name: 'fx-all-live', steps: [{ tool_id: 'fx-alpha' }, { tool_id: 'fx-gamma' }] },
  ];
  const nonNode = [
    { name: 'fx-page-step', steps: [{ tool_id: 'fx-alpha' }, { tool_id: '152-baas-provider-comparator' }] },
  ];
  return { nodes, chains: chains === 'none' ? [] : chains === 'nonNode' ? nonNode : normal };
}

function waiver(over = {}) {
  return {
    chain: 'fx-departed-entry',
    tool_id: 'fx-beta',
    owner_row: 'FIXTURE-ROW-1',
    reason: 'Fixture waiver used only by check-chain-step-status.test.mjs to exercise the waived path.',
    ...over,
  };
}

const DIR = mkdtempSync(join(tmpdir(), 'ccss-'));
function write(name, obj) {
  const p = join(DIR, name);
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
  return p;
}
/** Spawn the real gate. Returns { code, out }. */
function run(graphPath, baselinePath, extra = []) {
  const r = spawnSync(process.execPath, [SCRIPT, '--graph', graphPath, '--baseline', baselinePath, ...extra], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

console.log('▶ check-chain-step-status controls (GENERATOR-STATUS-FILTER-1)');

try {
  const gDead = write('graph-dead.json', graph('deprecated'));
  const gLive = write('graph-live.json', graph('live'));
  const bEmpty = write('baseline-empty.json', { waivers: [] });

  heading(1, 'RED FIRST — chain steps to a deprecated node, nothing waived');
  const r1 = run(gDead, bEmpty);
  check('exit 1', r1.code === 1, `got ${r1.code}`);
  check('names the chain and the departed step', /fx-departed-entry/.test(r1.out) && /fx-beta/.test(r1.out), r1.out);
  check('names the status', /deprecated/.test(r1.out), r1.out);
  check('does NOT flag the all-live chain', !/fx-all-live/.test(r1.out), r1.out);

  heading(2, 'RED — the interop consequence is spelled out, not just the drift');
  check('says ENTRY STEP', /ENTRY STEP/.test(r1.out), r1.out);
  check('names find_chain + entry_mcp_name', /find_chain/.test(r1.out) && /entry_mcp_name/.test(r1.out), r1.out);
  check('names the -32602 outcome', /-32602/.test(r1.out), r1.out);

  heading(3, 'GREEN — ONE-FIELD MUTATION: same graph, status flipped back to live');
  const r3 = run(gLive, bEmpty);
  check('exit 0', r3.code === 0, `got ${r3.code} :: ${r3.out}`);
  check('reports 0 unwaived', /0 unwaived non-live step\(s\)/.test(r3.out), r3.out);
  check('the ONLY difference from control 1 was the status field',
    JSON.stringify(graph('live').chains) === JSON.stringify(graph('deprecated').chains));

  heading(4, 'GREEN — the same offender, waived with a reason and an owner_row');
  const bOk = write('baseline-ok.json', { waivers: [waiver()] });
  const r4 = run(gDead, bOk);
  check('exit 0', r4.code === 0, `got ${r4.code} :: ${r4.out}`);
  check('the waiver is PRINTED, not silent', /WAIVED offender/.test(r4.out) && /FIXTURE-ROW-1/.test(r4.out), r4.out);

  heading(5, 'RED — a waiver whose reason is too short to be a reason');
  const bShort = write('baseline-short.json', { waivers: [waiver({ reason: 'because' })] });
  const r5 = run(gDead, bShort);
  check('exit 1', r5.code === 1, `got ${r5.code}`);
  check('names the reason-length rule', /at least 40 characters/.test(r5.out), r5.out);

  heading(6, 'RED — a waiver with no owner_row');
  const bNoOwner = write('baseline-noowner.json', { waivers: [{ chain: 'fx-departed-entry', tool_id: 'fx-beta', reason: waiver().reason }] });
  const r6 = run(gDead, bNoOwner);
  check('exit 1', r6.code === 1, `got ${r6.code}`);
  check('names owner_row', /owner_row/.test(r6.out), r6.out);

  heading(7, 'RED — DELETING THE BASELINE DOES NOT SILENCE THE GATE (SO #34c)');
  const r7 = run(gLive, join(DIR, 'does-not-exist.json'));
  check('exit 1 even though the graph itself is clean', r7.code === 1, `got ${r7.code} :: ${r7.out}`);
  check('says absence is not a pass', /absence is not a pass/i.test(r7.out), r7.out);

  heading(8, 'RED — a waiver that no longer names an offender (ratchet only goes down)');
  const bStale = write('baseline-stale.json', { waivers: [waiver()] });
  const r8 = run(gLive, bStale);
  check('exit 1', r8.code === 1, `got ${r8.code}`);
  check('names the stale waiver and the --prune remedy', /no longer name an offender/.test(r8.out) && /--prune/.test(r8.out), r8.out);

  heading(9, 'GREEN — --prune removes exactly the stale waiver, and nothing else');
  const bPrune = write('baseline-prune.json', { waivers: [waiver(), waiver({ chain: 'fx-departed-entry', tool_id: 'fx-beta', owner_row: 'KEEP-ME' })] });
  const rp = run(gDead, bPrune, ['--prune']);
  check('exit 0', rp.code === 0, `got ${rp.code} :: ${rp.out}`);
  check('nothing to prune while the offender is real', /nothing to prune/.test(rp.out), rp.out);
  const rp2 = run(gLive, bPrune, ['--prune']);
  check('prune on a clean graph empties the waiver list', rp2.code === 0 && JSON.parse(readFileSync(bPrune, 'utf8')).waivers.length === 0, rp2.out);
  check('--prune never ADDS: re-running it on a fresh offender does not waive it',
    run(gDead, bPrune, ['--prune']).code === 0 && JSON.parse(readFileSync(bPrune, 'utf8')).waivers.length === 0);
  check('...and the gate is therefore still RED on that offender', run(gDead, bPrune).code === 1);

  heading(10, 'RED — an empty denominator is not a clean estate');
  const gNone = write('graph-none.json', graph('live', { chains: 'none' }));
  const r10 = run(gNone, bEmpty);
  check('exit 1', r10.code === 1, `got ${r10.code}`);
  check('says DENOMINATOR EMPTY', /DENOMINATOR EMPTY/.test(r10.out), r10.out);

  heading(11, 'GREEN — a step naming a non-node tool page is OUT OF SCOPE, not a failure');
  const gPage = write('graph-page.json', graph('deprecated', { chains: 'nonNode' }));
  const r11 = run(gPage, bEmpty);
  check('exit 0', r11.code === 0, `got ${r11.code} :: ${r11.out}`);
  check('counts it as out of scope rather than failing it', /out of scope/.test(r11.out), r11.out);
} finally {
  rmSync(DIR, { recursive: true, force: true });
}

console.log(`\n${fail ? '❌' : '✅'} check-chain-step-status controls: ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
