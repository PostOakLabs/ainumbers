#!/usr/bin/env node
/**
 * check-branch-inventory.test.mjs — SO #40(b) pairing for the branch-inventory gate.
 *
 * ⚠ WHY THIS FILE MATTERS MORE THAN USUAL. The first cohort scores 100% fill quality, and it was
 * authored by one session holding the gate. A gate that cannot go red would produce that same 100%
 * over inventories that claim anything at all, and the number would mean nothing. So every claim the
 * gate makes is proven here BY MUTATION against a throwaway estate: an unreachable refusal reds, a
 * fabricated representation reds, an unregistered clause digest reds, a missing fixture reds.
 *
 * Usage: node scripts/check-branch-inventory.test.mjs   (exit 0 = all cases pass)
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SELF = resolve(dirname(fileURLToPath(import.meta.url)), 'check-branch-inventory.mjs');
const { run, DISPOSITIONS, ERROR_DIRECTIONS } = await import(pathToFileURL(SELF).href);

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
  if (!ok) failures++;
};

const DIGEST = 'sha256:0000000000000000000000000000000000000000000000000000000000000001';
const KERNEL = `
export function compute(pp) {
  pp = pp || {};
  const flags = ['ASSESSED'];
  let review = false;
  if (pp.carve_out_claimed === true) { flags.push('CARVE_OUT_UNRESOLVED'); review = true; }
  return { output_payload: { verdict: review ? null : 'ok', manual_review_required: review }, compliance_flags: flags };
}
`;

function sandbox(inventory, { registerDigest = true, fixtureNames = ['carve-out-claimed'], reachability = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'branchinv-'));
  mkdirSync(join(root, 'chaingraph', 'kernels', 'fixtures'), { recursive: true });
  mkdirSync(join(root, 'chaingraph', 'standard', 'branch-inventories'), { recursive: true });
  writeFileSync(join(root, 'chaingraph', 'kernels', 'k-demo.kernel.mjs'), KERNEL);
  writeFileSync(join(root, 'chaingraph', 'kernels', 'fixtures', 'k-demo.fixtures.json'), JSON.stringify({
    tool_id: 'k-demo',
    vectors: fixtureNames.map((n) => ({ name: n, policy_parameters: { carve_out_claimed: true } })),
  }, null, 2));
  if (reachability) {
    writeFileSync(join(root, 'chaingraph', 'kernels', 'fixtures', 'k-demo.reachability.json'),
      JSON.stringify({ tool_id: 'k-demo', kind: 'reachability', vectors: reachability }, null, 2));
  }
  writeFileSync(join(root, 'chaingraph', 'standard', 'clause-snapshot-registry.json'),
    JSON.stringify(registerDigest ? [{ digest: DIGEST, clause_path: 'demo §1' }] : [], null, 2));
  writeFileSync(join(root, 'chaingraph', 'standard', 'branch-inventories', 'k-demo.inventory.json'), JSON.stringify(inventory, null, 2));
  return root;
}

const base = (branches) => ({
  tool_id: 'k-demo',
  inventory_version: '1.0.0',
  error_direction: 'conservative_toward_finding',
  error_direction_rationale: 'demo',
  derived_from: [{ digest: DIGEST, clause_path: 'demo §1' }],
  branches,
});

const REFUSED_OK = {
  id: 'b-carve-out', clause: 'demo §1(a)', disposition: 'refused',
  refusal: {
    flag: 'CARVE_OUT_UNRESOLVED', payload_marker: 'manual_review_required',
    fixture: 'k-demo.fixtures.json#carve-out-claimed',
    reachability_vector: { carve_out_claimed: true },
  },
};

const quiet = async (fn) => {
  const log = console.log, err = console.error;
  console.log = () => {}; console.error = () => {};
  try { return await fn(); } finally { console.log = log; console.error = err; }
};
const gate = (inv, opts) => {
  const root = sandbox(inv, opts);
  return quiet(() => run({ repo: root, argv: [] })).finally(() => rmSync(root, { recursive: true, force: true }));
};

console.log('check-branch-inventory.test.mjs — RED-first proof by mutation\n');

check('closed disposition enum is frozen at 4 values', [Object.isFrozen(DISPOSITIONS), DISPOSITIONS.length], [true, 4]);
check('closed error-direction enum is frozen at 3 values', [Object.isFrozen(ERROR_DIRECTIONS), ERROR_DIRECTIONS.length], [true, 3]);

check('a well-formed inventory -> exit 0', await gate(base([REFUSED_OK])), 0);

// THE LOAD-BEARING MUTATIONS — each breaks exactly one claim the gate makes.
check('refusal whose flag never fires -> exit 1',
  await gate(base([{ ...REFUSED_OK, refusal: { ...REFUSED_OK.refusal, flag: 'A_FLAG_THAT_IS_NEVER_RAISED' } }])), 1);
check('refusal whose vector does NOT reach the path -> exit 1',
  await gate(base([{ ...REFUSED_OK, refusal: { ...REFUSED_OK.refusal, reachability_vector: { carve_out_claimed: false } } }])), 1);
check('refusal whose payload marker stays falsy -> exit 1',
  await gate(base([{ ...REFUSED_OK, refusal: { ...REFUSED_OK.refusal, payload_marker: 'verdict' } }])), 1);
check('refusal naming a fixture vector that does not exist -> exit 1',
  await gate(base([{ ...REFUSED_OK, refusal: { ...REFUSED_OK.refusal, fixture: 'k-demo.fixtures.json#no-such-vector' } }])), 1);
check('refusal with no fixture at all -> exit 1',
  await gate(base([{ ...REFUSED_OK, refusal: { flag: 'CARVE_OUT_UNRESOLVED', payload_marker: 'manual_review_required', reachability_vector: { carve_out_claimed: true } } }])), 1);

check('represented naming a payload member that never appears -> exit 1',
  await gate(base([{ id: 'b-rep', clause: 'demo §1(b)', disposition: 'represented', evidence: 'a_member_that_does_not_exist' }])), 1);
check('represented naming a real payload member -> exit 0',
  await gate(base([{ id: 'b-rep', clause: 'demo §1(b)', disposition: 'represented', evidence: 'verdict' }])), 0);

check('out_of_scope_by_input with no named owner -> exit 1',
  await gate(base([{ id: 'b-in', clause: 'demo §1(c)', disposition: 'out_of_scope_by_input', assumption_of_use: { value: 'x', source: 'y' } }])), 1);
check('unrepresented_known with no declared error direction -> exit 1',
  await gate(base([{ id: 'b-gap', clause: 'demo §1(d)', disposition: 'unrepresented_known' }])), 1);
check('unrepresented_known with one -> exit 0',
  await gate(base([{ id: 'b-gap', clause: 'demo §1(d)', disposition: 'unrepresented_known', error_direction: 'undirected' }])), 0);

// The two-file split (§1.5): a refusal may point into <id>.reachability.json, and a kernel_generated
// vector there must BE the input the inventory declares — otherwise gate and fixture pin different
// things while both look filled.
{
  const R = { ...REFUSED_OK, refusal: { ...REFUSED_OK.refusal, fixture: 'k-demo.reachability.json#rv-carve-out' } };
  check('refusal resolving into the reachability file -> exit 0',
    await gate(base([R]), { reachability: [{ name: 'rv-carve-out', provenance: 'kernel_generated', policy_parameters: { carve_out_claimed: true } }] }), 0);
  check('reachability vector that does NOT match the inventory vector -> exit 1',
    await gate(base([R]), { reachability: [{ name: 'rv-carve-out', provenance: 'kernel_generated', policy_parameters: { carve_out_claimed: true, extra: 1 } }] }), 1);
}

// SO #34 — the inventory must be traceable to registered primary text, not to the kernel.
check('derived_from digest not in the snapshot registry -> exit 1', await gate(base([REFUSED_OK]), { registerDigest: false }), 1);
check('empty derived_from[] -> exit 1',
  await gate({ ...base([REFUSED_OK]), derived_from: [] }), 1);

// Structural.
check('disposition outside the closed enum -> exit 1',
  await gate(base([{ id: 'b-x', clause: 'demo §1(e)', disposition: 'probably_fine' }])), 1);
check('error_direction outside the closed enum -> exit 1',
  await gate({ ...base([REFUSED_OK]), error_direction: 'mostly_safe' }), 1);
check('a directed error_direction with no rationale -> exit 1',
  await gate({ ...base([REFUSED_OK]), error_direction_rationale: undefined }), 1);
check('duplicate branch ids -> exit 1',
  await gate(base([REFUSED_OK, { ...REFUSED_OK }])), 1);

console.log(`\n${failures === 0 ? '✓ all cases passed' : `✗ ${failures} case(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
