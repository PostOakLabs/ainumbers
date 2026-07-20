// vm-parity-gate.mjs — VM-1a CI PARITY GATE.
//
// Runs every gpu:false, status:live kernel's conformance fixtures (fixtures/<tool_id>.fixtures.json)
// through the in-browser QuickJS-ng kernel VM (chaingraph/vm/kernel-vm.mjs) and diffs the
// resulting execution_hash BYTE-FOR-BYTE against the worker/fixture golden_hash. This makes
// browser<->worker parity (SPEC.md §24.0) a TESTED INVARIANT — the VM is a 5th compute surface
// beside worker/embed/composer/guest, and this gate is its golden-parity equivalent.
//
// The canonical entry on BOTH sides is buildArtifact(): it is what the live Worker runs, what
// kernel-contract.test.mjs verifies as hash_valid, and its execution_hash IS the pinned
// golden_hash. compute() is NOT canonical — two return conventions exist across the corpus (a
// bare output_payload vs a { output_payload, compliance_flags } envelope), and some kernels
// (art-55) fold a host SHA-256 into output_payload only inside buildArtifact. Running compute()
// and hashing its raw return produced a FALSE "golden drift" on the envelope kernels; the gate
// now runs buildArtifact in the VM (executionHash stubbed, WebCrypto guarded) and asserts
// worker_hash == golden, so a VM match proves VM == canonical worker byte-for-byte.
//
// Session-3 (2026-07-09): the false-drift root cause was fixed and every remaining non-match is
// a truthfully-classified host-API/prebuilt-intrinsic limitation that THROWS (never a silently
// degraded output). The recorded-divergence set is empty; the gate runs clean under --strict.
//
// Usage:
//   node vm-parity-gate.mjs                 report only, exit 0 unless a HARD error (VM crash,
//                                            malformed fixture) occurs — divergences are reported
//                                            but do not fail CI while any are outstanding.
//   node vm-parity-gate.mjs --strict        divergences also fail (the set is empty as of session-3).
//   node vm-parity-gate.mjs --report <path> write the full JSON divergence report to <path>.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from './_hash.mjs';
import { KERNELS } from './index.mjs';
import { runKernelArtifactInVM } from '../vm/kernel-vm.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = resolve(HERE, 'fixtures');
const STRICT = process.argv.includes('--strict');

// KNOWN VM-1a LIMITATIONS (documented, not papered over — see chaingraph/vm/README.md):
// these tool_ids depend on a host API this prebuilt sandbox genuinely cannot provide (host
// WebCrypto / SHA-256), or hit a gap in this prebuilt's BigInt intrinsic (literal/arithmetic
// works, prototype methods like .toString() do not). All are carried to VM-1b (custom
// guest-pinned build) as findings, not silently retried or ignored. Every one of these now
// THROWS at the harness (the WebCrypto touch is recorded and re-raised even when the kernel
// swallows it in a try/catch; the executionHash SHA-256 stub is detected if folded into a
// data field) — none is allowed to reach a byte comparison with a degraded output. This is
// the §24 "every escape hatch is closed or named" guarantee: the limitation is surfaced, not
// silently degraded. They still print and count, they just don't fail CI as a REGRESSION the
// way a newly-broken pure kernel would.
// VM-1b (ocg-deterministic-compute@2) closes ALL six VM-1a limitations:
//   - art-189/190 (crypto.subtle.digest), art-124/129 (crypto.subtle.importKey/verify), and
//     art-55 (host SHA-256 merkle_root via executionHash) now run against the bridged
//     deterministic WebCrypto subset (§24.5), byte-identical to the worker.
//   - art-201 (BigInt.prototype.toString minhash bit-packing) runs on the guest-pinned
//     v0.15.1 build's native full BigInt.
// The map is intentionally EMPTY: no kernel is allowlisted to throw. A vector that throws is a
// hard error (CI-blocking). If a future limitation is genuinely unclosable it is documented
// here with its reason, never silently re-allowlisted (keep the gate honest — see README.md).
const KNOWN_VM1A_LIMITATIONS = new Map([]);
const reportIdx = process.argv.indexOf('--report');
const reportPath = reportIdx !== -1 ? process.argv[reportIdx + 1] : null;

function stable(x) {
  if (Array.isArray(x)) return x.map(stable);
  if (x && typeof x === 'object') {
    return Object.keys(x).sort().reduce((o, k) => { o[k] = stable(x[k]); return o; }, {});
  }
  return x;
}
const sameShape = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

let checked = 0, matched = 0, diverged = 0, hardErrors = 0, knownLimitations = 0, skippedGpu = 0, skippedNoFixture = 0, skippedPrivateInput = 0;
const divergences = [];
const limitationsHit = [];

const toolIds = Object.keys(KERNELS);
for (const id of toolIds) {
  const kernel = KERNELS[id];
  if (kernel?.meta?.gpu === true) { skippedGpu++; continue; } // §24.0: gpu:true nodes out of scope
  // OCG §25 ocg-private-input@1 nodes (PRIV-IN-1-BUILD, 2026-07-20): buildArtifact's first
  // argument is the caller's PRIVATE WITNESS (e.g. {parties, salt}), never the artifact's own
  // policy_parameters (which carries only a sha256-salted@1 commitment, per §25.2 plaintext-
  // exclusion). Replaying kernel.buildArtifact(fixture.policy_parameters) — this gate's whole
  // model — therefore cannot succeed for these nodes BY CONSTRUCTION: it is the profile's
  // defining property (SPEC.md §18.3: "recompute becomes unavailable to third parties"), not a
  // VM/host-API gap like the historical KNOWN_VM1A_LIMITATIONS entries. Out of scope here, same
  // as gpu:true; conformance instead runs through validate_private_inputs (§25.4) against the
  // out-of-band disclosure fixtures (kernels/fixtures/<tool_id>.disclosure.json, test-only).
  if (kernel?.meta?.private_input_profile) { skippedPrivateInput++; continue; }

  const fpath = resolve(FIXDIR, `${id}.fixtures.json`);
  if (!existsSync(fpath)) { skippedNoFixture++; continue; }

  const kernelPath = resolve(HERE, `${id}.kernel.mjs`);
  if (!existsSync(kernelPath)) {
    console.error(`✗ ${id}: registered in index.mjs but no source file at kernels/${id}.kernel.mjs`);
    hardErrors++; continue;
  }
  const kernelSource = readFileSync(kernelPath, 'utf8');

  const doc = JSON.parse(readFileSync(fpath, 'utf8'));
  for (const v of doc.vectors ?? []) {
    const tag = `${id}/${v.name}`;
    checked++;

    // CANONICAL worker artifact: buildArtifact() is each kernel's own authoritative path —
    // it is exactly what the live Worker runs and what kernel-contract.test.mjs verifies as
    // hash_valid, and its execution_hash IS the pinned golden_hash (compute() alone is NOT
    // canonical: two return conventions exist across the corpus, and some kernels — art-55 —
    // fold a host SHA-256 into output_payload only inside buildArtifact). So worker_hash here
    // is the golden/_hash canonical hash, by construction.
    let workerArtifact;
    try {
      workerArtifact = await kernel.buildArtifact(v.policy_parameters, { now: null });
    } catch (e) {
      console.error(`✗ ${tag}: worker-side kernel.buildArtifact() threw — ${e.message}`);
      hardErrors++; continue;
    }
    const workerOutput = workerArtifact.output_payload;
    const workerHash = String(workerArtifact.execution_hash ?? '').replace(/^sha256:/, '');
    const goldenHash = String(v.golden_hash ?? '').replace(/^sha256:/, '');

    // SELF-CHECK: the canonical worker hash must equal the pinned golden. If it does not, the
    // fixture/kernel is genuinely out of sync (kernel-contract.test.mjs's invariant is broken)
    // — that is a hard error, not something to paper over as VM parity noise.
    if (workerHash !== goldenHash) {
      console.error(`✗ ${tag}: CANONICAL DRIFT — buildArtifact execution_hash ${workerHash} != pinned golden ${goldenHash}. Fix the kernel/fixture (golden-parity --update) — not a VM issue.`);
      hardErrors++; continue;
    }

    // The browser VM runs the SAME canonical entry (buildArtifact) in the sandbox; a host-API
    // dependency (WebCrypto / folded SHA-256) or a prebuilt-intrinsic gap THROWS here and is
    // surfaced as a named limitation rather than silently degraded.
    let vmResult;
    try {
      vmResult = await runKernelArtifactInVM(kernelSource, v.policy_parameters);
    } catch (e) {
      if (KNOWN_VM1A_LIMITATIONS.has(id)) {
        console.warn(`⚠ ${tag}: KNOWN VM-1a limitation — ${KNOWN_VM1A_LIMITATIONS.get(id)} (threw: ${e.message})`);
        knownLimitations++; limitationsHit.push({ tool_id: id, vector: v.name, reason: KNOWN_VM1A_LIMITATIONS.get(id), error: e.message });
      } else {
        console.error(`✗ ${tag}: VM execution threw — ${e.message}`);
        hardErrors++;
      }
      continue;
    }

    const vmHash = await executionHash(v.policy_parameters, vmResult.output_payload);

    // PRIMARY invariant: the browser VM and the canonical worker, both running today's kernel
    // source through buildArtifact, must produce byte-for-byte identical output_payload — and
    // since worker_hash == golden (asserted above), a VM match proves VM == canonical worker.
    const outputsMatch = sameShape(vmResult.output_payload, workerOutput);
    const vmWorkerParity = vmHash === workerHash;

    if (outputsMatch && vmWorkerParity) {
      matched++;
    } else {
      diverged++;
      const entry = {
        tool_id: id,
        vector: v.name,
        policy_parameters: v.policy_parameters,
        worker_output_payload: workerOutput,
        vm_output_payload: vmResult.output_payload,
        worker_hash: workerHash,
        vm_hash: vmHash,
        golden_hash: goldenHash,
        outputs_match: outputsMatch,
        vm_worker_parity: vmWorkerParity,
      };
      divergences.push(entry);
      console.error(`✗ ${tag}: VM<->WORKER PARITY DIVERGENCE\n    outputs_match=${outputsMatch} vm_worker_parity=${vmWorkerParity}\n    worker_hash ${workerHash}\n    vm_hash     ${vmHash}`);
    }
  }
}

if (reportPath) {
  writeFileSync(reportPath, JSON.stringify({
    generated_by: 'vm-parity-gate.mjs',
    profile: 'ocg-deterministic-compute@1',
    checked, matched, diverged, hardErrors, knownLimitations, skippedGpu, skippedNoFixture, skippedPrivateInput,
    divergences,
    known_limitations_hit: limitationsHit,
  }, null, 2) + '\n');
  console.log(`report written to ${reportPath}`);
}

console.log(`\nVM-1a parity: ${matched}/${checked} vector(s) byte-identical to the worker (${diverged} divergence(s), ${hardErrors} hard error(s), ${knownLimitations} known-limitation skip(s), ${skippedGpu} gpu:true skipped, ${skippedNoFixture} no-fixture skipped, ${skippedPrivateInput} private-input (§25) skipped).`);

if (hardErrors > 0) {
  console.error(`\n✗ ${hardErrors} hard error(s) — VM crash or malformed fixture, always CI-blocking. (${knownLimitations} additional vector(s) hit a documented KNOWN_VM1A_LIMITATIONS entry and were not counted as hard errors — see chaingraph/vm/README.md.)`);
  process.exit(1);
}
if (diverged > 0) {
  console.error(`\n${STRICT ? '✗' : '⚠'} ${diverged} kernel(s) diverge between the browser VM and the worker — recorded above${reportPath ? ` and in ${reportPath}` : ''}. Resolving divergences is out of VM-1a scope (see MANDATE-LOOP-PROGRAM-SPEC.md VM-1a).`);
  process.exit(STRICT ? 1 : 0);
}
console.log('✓ vm-parity-gate clean.');
process.exit(0);
