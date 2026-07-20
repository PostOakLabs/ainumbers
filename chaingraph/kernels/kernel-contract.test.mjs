// kernel-contract.test.mjs — agent-native kernel CONTRACT gate.
//
// Complements golden-parity.test.mjs. golden-parity hashes the fixture's STORED
// {policy_parameters, output_payload} and never calls the kernel — so it cannot catch a
// kernel whose buildArtifact returns a malformed artifact (no execution_hash, no
// policy_parameters/output_payload split). That is exactly how the 6 Arc kernels shipped
// returning hash_valid:false on the live Worker (2026-06-19).
//
// This gate closes both holes:
//   (a) COVERAGE   — every kernel registered in index.mjs MUST have a fixtures/<tool_id>.fixtures.json
//                    with >=1 vector and a pinned golden_hash.
//   (b) CONTRACT   — for each vector it actually calls kernel.buildArtifact(policy_parameters) and
//                    reproduces the Worker's hash_valid check locally:
//                      • artifact has execution_hash (64-hex), policy_parameters, output_payload
//                      • artifact.policy_parameters == vector.policy_parameters
//                      • artifact.output_payload   == vector.output_payload
//                      • executionHash(artifact.policy_parameters, artifact.output_payload)
//                          === artifact.execution_hash      (self-consistent → live hash_valid:true)
//                      • artifact.execution_hash === vector.golden_hash   (matches the pinned snapshot)
//
// A kernel that would return hash_valid:false on the Worker fails HERE, in CI, before deploy.
//
// Phasing: only 5 of ~79 kernels ship fixtures today, so MISSING-FIXTURE coverage is a
// WARNING by default (so it doesn't turn CI red on the backfill backlog). The CONTRACT /
// self-consistency check ALWAYS hard-fails for any kernel that HAS a fixture — that is what
// catches the Arc-class bug. Flip to --strict once every kernel has a fixture to make
// coverage a hard gate too.
//
// Usage:  node kernel-contract.test.mjs            (contract = hard fail; missing fixture = warn)
//         node kernel-contract.test.mjs --strict   (missing fixture also fails)

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from './_hash.mjs';
import { KERNELS } from './index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = resolve(HERE, 'fixtures');
const norm = (h) => String(h ?? '').replace(/^sha256:/, '');
const isHex64 = (h) => /^[a-f0-9]{64}$/.test(norm(h));

// order-independent structural compare (stable-sorted JSON)
function stable(x) {
  if (Array.isArray(x)) return x.map(stable);
  if (x && typeof x === 'object') {
    return Object.keys(x).sort().reduce((o, k) => { o[k] = stable(x[k]); return o; }, {});
  }
  return x;
}
const sameShape = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

const STRICT = process.argv.includes('--strict');
let fail = 0, warn = 0, checked = 0, skippedPrivateInput = 0;
const toolIds = Object.keys(KERNELS);

for (const id of toolIds) {
  const kernel = KERNELS[id];
  const fpath = resolve(FIXDIR, `${id}.fixtures.json`);

  // OCG §25 ocg-private-input@1 nodes (PRIV-IN-1-BUILD, 2026-07-20): buildArtifact's first
  // argument is the caller's PRIVATE WITNESS, never the artifact's own policy_parameters (which
  // carries only a sha256-salted@1 commitment, §25.2 plaintext-exclusion). Replaying
  // kernel.buildArtifact(fixture.policy_parameters) cannot succeed for these BY CONSTRUCTION
  // (SPEC.md §18.3: "recompute becomes unavailable to third parties") — same exemption as
  // chaingraph/kernels/vm-parity-gate.mjs. Conformance instead runs through
  // validate_private_inputs (§25.4) against the out-of-band disclosure fixtures
  // (kernels/fixtures/<tool_id>.disclosure.json, test-only).
  if (kernel?.meta?.private_input_profile) { skippedPrivateInput++; continue; }

  // (a) coverage — warning by default, hard fail under --strict
  if (!existsSync(fpath)) {
    if (STRICT) { console.error(`✗ ${id}: NO fixtures/${id}.fixtures.json — every registered kernel must ship a pinned fixture.`); fail++; }
    else { console.warn(`⚠ ${id}: no fixture yet — contract not verified (backfill fixtures/${id}.fixtures.json).`); warn++; }
    continue;
  }
  if (typeof kernel?.buildArtifact !== 'function') {
    console.error(`✗ ${id}: kernel exports no buildArtifact() — cannot produce a verifiable artifact.`);
    fail++; continue;
  }
  const doc = JSON.parse(readFileSync(fpath, 'utf8'));
  const vectors = doc.vectors ?? [];
  if (vectors.length === 0) { console.error(`✗ ${id}: fixture has no vectors.`); fail++; continue; }

  for (const v of vectors) {
    const tag = `${id}/${v.name}`;
    if (!v.golden_hash || !isHex64(v.golden_hash)) { console.error(`✗ ${tag}: golden_hash not pinned (run golden-parity --update).`); fail++; continue; }

    let art;
    try { art = await kernel.buildArtifact(v.policy_parameters, { now: null }); }
    catch (e) { console.error(`✗ ${tag}: buildArtifact threw — ${e.message}`); fail++; continue; }

    // (b) contract shape
    if (!art || typeof art !== 'object') { console.error(`✗ ${tag}: buildArtifact did not return an object.`); fail++; continue; }
    if (!isHex64(art.execution_hash)) { console.error(`✗ ${tag}: artifact missing/invalid execution_hash (got ${JSON.stringify(art.execution_hash)}).`); fail++; continue; }
    if (!('policy_parameters' in art)) { console.error(`✗ ${tag}: artifact missing policy_parameters.`); fail++; continue; }
    if (!('output_payload' in art)) { console.error(`✗ ${tag}: artifact missing output_payload.`); fail++; continue; }
    if (!sameShape(art.policy_parameters, v.policy_parameters)) { console.error(`✗ ${tag}: artifact.policy_parameters != fixture input.`); fail++; continue; }
    if (!sameShape(art.output_payload, v.output_payload)) { console.error(`✗ ${tag}: artifact.output_payload != fixture output (kernel drift).`); fail++; continue; }

    // (b) self-consistency — this is the Worker's hash_valid check
    const recomputed = await executionHash(art.policy_parameters, art.output_payload);
    if (norm(art.execution_hash) !== norm(recomputed)) {
      console.error(`✗ ${tag}: SELF-INCONSISTENT — execution_hash != hash(policy_parameters,output_payload) → live hash_valid:false.`);
      fail++; continue;
    }
    if (norm(art.execution_hash) !== norm(v.golden_hash)) {
      console.error(`✗ ${tag}: artifact hash ${norm(art.execution_hash)} != pinned golden ${norm(v.golden_hash)}.`);
      fail++; continue;
    }
    checked++;
  }
}

if (fail === 0) {
  const warnMsg = warn ? `  (${warn} kernel(s) without a fixture — not yet contract-verified${STRICT ? '' : '; warning only'})` : '';
  const privMsg = skippedPrivateInput ? `  (${skippedPrivateInput} §25 private-input kernel(s) out of scope — see validate_private_inputs)` : '';
  console.log(`✓ kernel-contract clean — ${checked} vector(s) contract-verified (well-formed, self-consistent → hash_valid, golden-matched).${warnMsg}${privMsg}`);
  process.exit(0);
}
console.error(`\n✗ ${fail} kernel-contract failure(s). A failing kernel returns hash_valid:false on the live Worker — fix the kernel (copy the art-12 shape: async buildArtifact, executionHash from _hash.mjs, {policy_parameters, output_payload, execution_hash}), then golden-parity --update.`);
process.exit(1);
