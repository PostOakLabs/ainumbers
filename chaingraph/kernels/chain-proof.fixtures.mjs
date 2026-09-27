// Fixture runner for chain-proof.kernel.mjs (CHAIN-PROOF-TRIAL-1).
//
// Six cases: ONE passes, FIVE must refuse. The five are the threat rows of
// CHAIN-PROOF-SCOPE.md §4 that the kernel itself is responsible for closing — step-receipt
// substitution, a tampered output, a dropped step, a skipped gate, and a broken mandate binding.
// (The sixth row of that table, a stale `kernel_digest`, is the same check as `kernel_digest_mismatch`
// and is exercised implicitly by the tampered-output case's journal comparison.)
//
// Run it:  node chaingraph/kernels/chain-proof.fixtures.mjs
// In the guest, `__ocg_verify` is the `env::verify` host function. Here it is a recorder: outside a
// risc0 session there is no assumption to make, and the kernel refuses outright if neither exists —
// so this stand-in is what lets the other checks be exercised on a laptop.
//
// The happy-path data is REAL: `fixtures/chain-proof/aca-226j-run.json` carries the journal bytes of
// the three shipped art-298/299/300 Groth16 receipts, the policy_parameters they were proven over,
// and the execution hashes those two recompute to.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from './_hash.mjs';
import { PINNED_CHAINS, cgSha256Hex, chainProof, composeChainProof } from './chain-proof.kernel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUN = JSON.parse(readFileSync(resolve(HERE, 'fixtures', 'chain-proof', 'aca-226j-run.json'), 'utf8'));

// ── the host-function stand-in ──
const verifyCalls = [];
globalThis.__ocg_verify = (imageIdHex, journalBytes) => {
  verifyCalls.push({ imageIdHex, journal_len: journalBytes.length });
  return true;
};

const clone = (v) => JSON.parse(JSON.stringify(v));

// Recompute each step's execution_hash and re-thread parent_hashes, so a fixture that legitimately
// edits policy_parameters (the mandate case) fails on the check it is aimed at rather than on a
// stale hash.
async function relink(run) {
  let parent = null;
  for (const s of run.steps) {
    s.execution_hash = await executionHash(s.policy_parameters, s.output_payload);
    s.parent_hashes = parent ? [parent] : [];
    parent = s.execution_hash;
  }
  return run;
}

// A synthetic PINNED chain used only by the skipped-gate case: same three steps, but step 1 carries
// a gate that routes to "end" whenever the affordability harbor is satisfied — which it is in the
// real run. A run that then reports steps 2 and 3 as having run took a route the committed
// definition does not admit.
async function gatedPinned() {
  const base = PINNED_CHAINS['aca-226j-response-composer'];
  const pinned = clone(base);
  pinned.steps[0].gate = {
    input: '/satisfies_any_harbor',
    rules: [{ op: 'eq', value: true, next: 'end' }],
    default: 'art-299-aca-esrp-exposure',
  };
  pinned.definition_steps = clone(base.definition_steps);
  pinned.definition_steps[0].gate = pinned.steps[0].gate;
  pinned.chain_definition_digest = await cgSha256Hex(pinned.definition_steps);
  return pinned;
}

const results = [];
async function expectPass(name, fn) {
  try {
    const out = await fn();
    results.push({ name, expect: 'pass', got: 'pass', detail: out });
  } catch (e) {
    results.push({ name, expect: 'pass', got: 'REFUSED', detail: String(e.message || e) });
  }
}
async function expectRefusal(name, code, fn) {
  try {
    await fn();
    results.push({ name, expect: `refuse:${code}`, got: 'PASSED', detail: 'no refusal was raised' });
  } catch (e) {
    const msg = String(e.message || e);
    const got = msg.startsWith('chain_proof_refused:') ? msg.slice('chain_proof_refused:'.length).split(' ')[0] : 'THREW';
    results.push({ name, expect: `refuse:${code}`, got: `refuse:${got}`, detail: msg });
  }
}

// 1. happy path — the real run, verified end to end.
await expectPass('happy-path', async () => {
  const out = await chainProof(clone(RUN));
  return `composite_execution_hash=${out.composite_execution_hash} steps=${out.steps.length} verify_calls=${verifyCalls.length}`;
});

// 2. substituted image — a valid receipt from a DIFFERENT image offered for step 2.
await expectRefusal('substituted-image', 'step_image_substituted', async () => {
  const run = clone(RUN);
  run.steps[1].image_id = 'sha256:6548edabfc00736df6b3fa5954a8ac8a68df0855fbb5078f10c5916db9d5ac14';
  return chainProof(run);
});

// 3. tampered output — the run reports an output the journal does not carry.
await expectRefusal('tampered-output', 'journal_output_tampered', async () => {
  const run = clone(RUN);
  run.steps[0].output_payload.satisfies_any_harbor = !run.steps[0].output_payload.satisfies_any_harbor;
  return chainProof(run);
});

// 4. dropped step — the middle step is removed from the run.
await expectRefusal('dropped-step', 'step_out_of_order', async () => {
  const run = clone(RUN);
  run.steps.splice(1, 1);
  return chainProof(run);
});

// 5. skipped gate — under the gated definition the chain ends after step 1, yet 3 steps ran.
await expectRefusal('skipped-gate', 'unrouted_step_ran', async () => {
  const pinned = await gatedPinned();
  return composeChainProof(pinned, clone(RUN));
});

// 6. mandate mismatch — a mandate governs the run but the last step does not carry it.
await expectRefusal('mandate-mismatch', 'mandate_binding_mismatch', async () => {
  const run = await relink(clone(RUN));
  const mandate = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
  run.mandate_hash = mandate;
  run.steps[0].policy_parameters.mandate_hash = mandate;
  run.steps[1].policy_parameters.mandate_hash = mandate;
  await relink(run);
  return chainProof(run);
});

let bad = 0;
for (const r of results) {
  const ok = r.expect === 'pass' ? r.got === 'pass' : r.got === r.expect;
  if (!ok) bad += 1;
  console.log(`${ok ? '✓' : '✗'} ${r.name.padEnd(18)} expected ${r.expect.padEnd(34)} got ${r.got}`);
  console.log(`    ${r.detail}`);
}
console.log(bad === 0
  ? `✓ chain-proof fixtures: ${results.length}/${results.length} behaved (1 pass, ${results.length - 1} refusals)`
  : `✗ chain-proof fixtures: ${bad} of ${results.length} did not behave`);
process.exit(bad === 0 ? 0 : 1);
