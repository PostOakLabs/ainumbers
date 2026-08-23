#!/usr/bin/env node
/**
 * scripts/check-deploy-superseded.test.mjs — paired self-test for
 * check-deploy-superseded.mjs (DEPLOY-REGEN-RACE-1).
 *
 * SO #34: "verify a checker by MUTATION, not by reading it." SO #40(b): prove RED
 * before GREEN. Both apply with the polarity INVERTED here, because the outcome
 * this script can grant is a STAND-DOWN, not a pass:
 *
 *   · the FALSE-ALARM case must produce superseded=true  (the red goes away)
 *   · ⭐ THE LOAD-BEARING CASE — a genuinely stale artifact the regen will NOT
 *     repair must produce superseded=false, so the Deploy preflight job runs the
 *     identical gate raw and reds the run exactly as it does today. Without that
 *     case passing, this change has DISABLED a deploy gate rather than fixed an
 *     alert, which is the one outcome the row forbids.
 *
 * The decision table is driven through the injectable `exec` / `probe` seams, so
 * it runs in milliseconds and cannot be perturbed by the estate's real freshness
 * state. Two cases additionally drive the REAL probeRepairable() over a scripted
 * command table, so the two halves are proven WIRED, not merely each correct.
 *
 * The final block is the one measurement against the live tree: the gate set must
 * still be derivable from the real deploy workflow. If a future edit removes
 * those steps, or breaks the parse, this goes red here rather than silently
 * standing Deploy down (or silently never standing it down) on main.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifySuperseded, deployGateCommands, DEPLOY_WORKFLOW } from './check-deploy-superseded.mjs';
import { probeRepairable } from './check-regen-repairable.mjs';
import { REPO, advisoryGates } from './derived-artifacts.mjs';
import { normalizeCmd } from './check-workflow-gate-parity.mjs';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); failures++; }
}

// Synthetic COVERED-shaped entries. Deliberately NOT the real set: the classifier
// must be correct as a function of its inputs, not of today's estate.
const FIXTURE = [
  { id: 'alpha', regen: 'REGEN_ALPHA', gate: 'GATE_ALPHA', artifacts: ['a.json'] },
  { id: 'beta', regen: 'REGEN_BETA', gate: 'GATE_BETA', artifacts: ['b.json'] },
];
const GATES = ['GATE_ALPHA', 'GATE_BETA'];

const OK = { ok: true, output: 'ok' };
const RED = (out = 'stale') => ({ ok: false, output: out });

/** exec from a command -> result map (single result per command). */
const execFrom = (map) => (cmd) => map[cmd] ?? { ok: false, output: `UNSCRIPTED: ${cmd}` };

/** exec from a command -> [results] script; each call consumes the next, last repeats. */
function scriptedExec(script) {
  const calls = [];
  const cursors = new Map();
  const fn = (cmd) => {
    calls.push(cmd);
    const seq = script[cmd];
    if (!seq) return { ok: false, output: `UNSCRIPTED: ${cmd}` };
    const i = cursors.get(cmd) ?? 0;
    cursors.set(cmd, Math.min(i + 1, seq.length - 1));
    return seq[i];
  };
  fn.calls = calls;
  return fn;
}

const never = () => { throw new Error('probe must not run'); };

console.log('▶ check-deploy-superseded — decision table (mutation-driven)\n');

// ── 1. NO DRIFT: nothing to stand down for, and the probe must not even run ────
{
  const r = classifySuperseded({
    gates: GATES,
    covered: FIXTURE,
    exec: execFrom({ GATE_ALPHA: OK, GATE_BETA: OK }),
    probe: never,
  });
  check('all gates fresh ⇒ NOT superseded (Deploy proceeds exactly as today)', r.superseded === false, `reason=${r.reason}`);
  check('all gates fresh ⇒ reason NO-DRIFT', r.reason === 'NO-DRIFT');
  check('all gates fresh ⇒ no scratch worktree is built at all', r.red.length === 0);
}

// ── 2. THE FALSE ALARM: stale, and the regen provably erases it ───────────────
{
  const r = classifySuperseded({
    gates: GATES,
    covered: FIXTURE,
    exec: execFrom({ GATE_ALPHA: RED('llms-full.txt is stale'), GATE_BETA: OK }),
    probe: () => ({ notReproduced: [], repaired: [{ id: 'alpha', gate: 'GATE_ALPHA', via: 'declared regen chain' }], unrepairable: [], escalated: false }),
  });
  check('repairable drift ⇒ SUPERSEDED (the e7e6ef34 false alarm)', r.superseded === true, `reason=${r.reason}`);
  check('repairable drift ⇒ reason REGEN-LAG', r.reason === 'REGEN-LAG');
}

// ── 3. ⭐ THE LOAD-BEARING CASE: genuinely stale ⇒ the RED IS KEPT ────────────
{
  const r = classifySuperseded({
    gates: GATES,
    covered: FIXTURE,
    exec: execFrom({ GATE_ALPHA: RED('1 stale entries (node no longer live)'), GATE_BETA: OK }),
    probe: () => ({ notReproduced: [], repaired: [], unrepairable: [{ id: 'alpha', gate: 'GATE_ALPHA', stage: 'gate', cmd: 'GATE_ALPHA', reason: 'still stale after the FULL declared regen', output: '' }], escalated: true }),
  });
  check('⭐ UNREPAIRABLE drift ⇒ NOT superseded — Deploy still fails on it', r.superseded === false, `reason=${r.reason}`);
  check('⭐ UNREPAIRABLE drift ⇒ reason UNREPAIRABLE', r.reason === 'UNREPAIRABLE');
}

// ── 4. MIXED: one repairable + one not ⇒ the unrepairable one still wins ──────
{
  const r = classifySuperseded({
    gates: GATES,
    covered: FIXTURE,
    exec: execFrom({ GATE_ALPHA: RED(), GATE_BETA: RED() }),
    probe: () => ({
      notReproduced: [],
      repaired: [{ id: 'alpha', gate: 'GATE_ALPHA', via: 'declared regen chain' }],
      unrepairable: [{ id: 'beta', gate: 'GATE_BETA', stage: 'gate', cmd: 'GATE_BETA', reason: 'not repairable', output: '' }],
      escalated: true,
    }),
  });
  check('one repairable + one not ⇒ NOT superseded (a real red is never masked by a false one)', r.superseded === false, `reason=${r.reason}`);
}

// ── 5. NOT REPRODUCED: the two measurements disagree ⇒ refuse to stand down ───
{
  const r = classifySuperseded({
    gates: GATES,
    covered: FIXTURE,
    exec: execFrom({ GATE_ALPHA: RED(), GATE_BETA: OK }),
    probe: () => ({ notReproduced: [{ id: 'alpha', gate: 'GATE_ALPHA', output: '' }], repaired: [], unrepairable: [], escalated: false }),
  });
  check('gate red in the tree but green at HEAD ⇒ NOT superseded', r.superseded === false, `reason=${r.reason}`);
}

// ── 6. PROBE UNAVAILABLE: a result that does not exist is not a verdict ───────
{
  const r = classifySuperseded({
    gates: GATES,
    covered: FIXTURE,
    exec: execFrom({ GATE_ALPHA: RED(), GATE_BETA: OK }),
    probe: () => { throw new Error('git worktree add failed'); },
  });
  check('probe throws ⇒ NOT superseded (SO #34c: absence is its own state)', r.superseded === false, `reason=${r.reason}`);
  check('probe throws ⇒ reason PROBE-UNAVAILABLE', r.reason === 'PROBE-UNAVAILABLE');
}

// ── 7. DERIVATION MEASURED NOTHING ⇒ refuse to stand down ─────────────────────
{
  const r = classifySuperseded({ gates: [], covered: FIXTURE, exec: () => OK, probe: never });
  check('zero derived gates ⇒ NOT superseded', r.superseded === false, `reason=${r.reason}`);
  check('zero derived gates ⇒ reason NO-GATES-DERIVED', r.reason === 'NO-GATES-DERIVED');
}

// ── 8. A red gate that maps to no COVERED entry ⇒ refuse to stand down ────────
{
  const r = classifySuperseded({
    gates: ['GATE_ALPHA', 'GATE_ORPHAN'],
    covered: FIXTURE,
    exec: execFrom({ GATE_ALPHA: OK, GATE_ORPHAN: RED() }),
    probe: never,
  });
  check('stale gate with no COVERED entry ⇒ NOT superseded', r.superseded === false, `reason=${r.reason}`);
  check('stale gate with no COVERED entry ⇒ reason ENTRY-MAPPING-DRIFT', r.reason === 'ENTRY-MAPPING-DRIFT');
}

console.log('\n▶ wired end-to-end through the REAL probeRepairable() (scripted commands, no git)\n');

// ── 9. The e7e6ef34 shape, through the real probe: gate red, regen writes, gate green ──
{
  const exec = scriptedExec({
    GATE_ALPHA: [RED('llms-full.txt is stale'), OK],
    REGEN_ALPHA: [OK],
  });
  const r = classifySuperseded({
    gates: ['GATE_ALPHA'],
    covered: FIXTURE,
    exec: execFrom({ GATE_ALPHA: RED('llms-full.txt is stale') }),
    probe: (entries) => probeRepairable({ dir: '/dev/null', entries, covered: FIXTURE, exec }),
  });
  check('⭐ regen-lag shape end-to-end ⇒ SUPERSEDED', r.superseded === true, `reason=${r.reason}`);
  check('regen-lag shape ⇒ the declared regen actually ran in the probe', exec.calls.includes('REGEN_ALPHA'));
}

// ── 10. The art-99 shape, through the real probe: regen exits 0 and fixes NOTHING ──
//     Measured on the real PR #1477 fixture (check-regen-repairable.mjs's header):
//       gate -> exit 1 · regen -> exit 0 "wrote 0 changed entry file(s)" · gate -> exit 1
{
  const exec = scriptedExec({
    GATE_ALPHA: [RED('1 stale entries (node no longer live)')],
    REGEN_ALPHA: [{ ok: true, output: 'wrote 0 changed entry file(s)' }],
    'node scripts/derived-artifacts.mjs --regen': [OK],
  });
  const r = classifySuperseded({
    gates: ['GATE_ALPHA'],
    covered: FIXTURE,
    exec: execFrom({ GATE_ALPHA: RED('1 stale entries (node no longer live)') }),
    probe: (entries) => probeRepairable({ dir: '/dev/null', entries, covered: FIXTURE, exec }),
  });
  check('⭐ art-99 shape end-to-end ⇒ NOT superseded (the 15-hour red-main shape still reds Deploy)',
    r.superseded === false, `reason=${r.reason}`);
  check('art-99 shape ⇒ the probe escalated to the full declared regen before calling it permanent',
    exec.calls.includes('node scripts/derived-artifacts.mjs --regen'));
}

console.log('\n▶ live derivation against the real deploy workflow\n');

// ── 11. The one measurement against the tree: the gate set must be derivable ──
{
  let text = '';
  let readErr = null;
  try { text = readFileSync(resolve(REPO, DEPLOY_WORKFLOW), 'utf8'); } catch (e) { readErr = e; }
  check(`${DEPLOY_WORKFLOW} is readable`, readErr === null, readErr?.message);
  const derived = text ? deployGateCommands(text) : [];
  check('the deploy workflow still runs at least one shared-derived-artifact gate raw', derived.length > 0,
    'zero derived ⇒ either the gate steps were removed or workflowCommands() stopped parsing this file');
  const advisory = new Set([...advisoryGates()].map(normalizeCmd));
  const strays = derived.filter((c) => !advisory.has(c));
  check('every derived gate is a member of advisoryGates() (single-writer, SO #35)', strays.length === 0, strays.join(' | '));
  console.log(`    derived ${derived.length} gate command(s):`);
  for (const d of derived) console.log(`      ${d}`);
}

console.log('');
if (failures) {
  console.log(`✗ check-deploy-superseded self-test: ${failures} failure(s)`);
  process.exit(1);
}
console.log('✓ check-deploy-superseded self-test: all cases pass');
