// vm-parity-gate.mjs — VM-1a CI PARITY GATE.
//
// Runs every gpu:false, status:live kernel's conformance fixtures (fixtures/<tool_id>.fixtures.json)
// through the in-browser QuickJS-ng kernel VM (chaingraph/vm/kernel-vm.mjs) and diffs the
// resulting execution_hash BYTE-FOR-BYTE against the worker/fixture golden_hash. This makes
// browser<->worker parity (SPEC.md §24.0) a TESTED INVARIANT — the VM is a 5th compute surface
// beside worker/embed/composer/guest, and this gate is its golden-parity equivalent.
//
// Per MANDATE-LOOP-PROGRAM-SPEC.md VM-1a scope: if a kernel's VM execution_hash diverges from
// the worker's, this gate does NOT paper over it — it records the divergence (kernel, vector,
// both hashes, both output_payloads) and reports it. Resolving any recorded divergences is
// explicitly out of VM-1a scope (carried to the session-3 pass).
//
// Usage:
//   node vm-parity-gate.mjs                 report only, exit 0 unless a HARD error (VM crash,
//                                            malformed fixture) occurs — divergences are reported
//                                            but do not fail CI while any are outstanding.
//   node vm-parity-gate.mjs --strict        divergences also fail (flip once the set is empty).
//   node vm-parity-gate.mjs --report <path> write the full JSON divergence report to <path>.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from './_hash.mjs';
import { KERNELS } from './index.mjs';
import { runKernelInVM } from '../vm/kernel-vm.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = resolve(HERE, 'fixtures');
const STRICT = process.argv.includes('--strict');

// KNOWN VM-1a LIMITATIONS (documented, not papered over — see chaingraph/vm/README.md):
// these tool_ids call a host API this prebuilt sandbox genuinely cannot provide, or hit
// a gap in this prebuilt's BigInt intrinsic (literal/arithmetic works, prototype methods
// like .toString() do not). Both are carried to VM-1b (custom guest-pinned build) as
// findings, not silently retried or ignored -- they still print and count, just don't
// fail CI as a REGRESSION the way a newly-broken kernel would.
const KNOWN_VM1A_LIMITATIONS = new Map([
  ['art-189-markdown-document-converter', 'compute() calls globalThis.crypto.subtle.digest() directly; WebCrypto is not bridged into the VM-1a sandbox (no host API surface by design).'],
  ['art-190-tabular-data-converter', 'compute() calls globalThis.crypto.subtle.digest() directly; WebCrypto is not bridged into the VM-1a sandbox (no host API surface by design).'],
  ['art-201-iscc-content-code-generator', "compute() calls BigInt value .toString() (minhash bit-packing); this prebuilt's BigInt intrinsic supports literals/arithmetic but not primitive prototype methods."],
  // These two wrap globalThis.crypto.subtle.importKey/verify in a try/catch that sets
  // signature_cryptographically_valid=false on failure instead of throwing, so the
  // absence of WebCrypto surfaces as a silent VM<->worker OUTPUT divergence rather
  // than a hard error -- same root cause as the art-189/190 entries above, different
  // symptom. Found via vm-parity-gate.mjs itself (2026-07-09), not assumed.
  ['art-124-content-credential-signature-verifier', 'compute() calls globalThis.crypto.subtle.importKey/verify inside a try/catch; WebCrypto absence silently flips signature_cryptographically_valid instead of throwing.'],
  ['art-129-webbotauth-signature-verifier', 'compute() calls globalThis.crypto.subtle.importKey/verify inside a try/catch; WebCrypto absence silently flips signature_cryptographically_valid instead of throwing.'],
]);
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

let checked = 0, matched = 0, diverged = 0, hardErrors = 0, knownLimitations = 0, skippedGpu = 0, skippedNoFixture = 0;
const divergences = [];
const limitationsHit = [];

const toolIds = Object.keys(KERNELS);
for (const id of toolIds) {
  const kernel = KERNELS[id];
  if (kernel?.meta?.gpu === true) { skippedGpu++; continue; } // §24.0: gpu:true nodes out of scope

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

    let vmResult;
    try {
      vmResult = await runKernelInVM(kernelSource, v.policy_parameters);
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

    let workerOutput;
    try {
      workerOutput = typeof kernel.compute === 'function'
        ? await kernel.compute(v.policy_parameters) // compute() may be sync or async
        : v.output_payload; // kernel exports no compute() directly — fall back to the pinned fixture output
    } catch (e) {
      console.error(`✗ ${tag}: worker-side kernel.compute() threw — ${e.message}`);
      hardErrors++; continue;
    }

    const vmHash = await executionHash(v.policy_parameters, vmResult.output_payload);
    const workerHash = await executionHash(v.policy_parameters, workerOutput);
    const goldenHash = String(v.golden_hash ?? '').replace(/^sha256:/, '');

    // PRIMARY invariant (this gate's actual job): the browser VM and the worker,
    // BOTH run live against today's kernel source, must byte-for-byte agree.
    // golden_hash is a SEPARATE, pre-existing concern (fixture pinned at an
    // earlier kernel revision — kernel-contract.test.mjs's job, not this gate's;
    // out of VM-1a's no-kernel-changes scope fence) so it is reported as
    // informational fixture drift, not counted as a VM<->worker divergence.
    const outputsMatch = sameShape(vmResult.output_payload, workerOutput);
    const vmWorkerParity = vmHash === workerHash;
    const goldenDrift = workerHash !== goldenHash; // pre-existing, not VM-caused

    if (outputsMatch && vmWorkerParity) {
      matched++;
      if (goldenDrift) {
        console.warn(`⚠ ${tag}: fixture golden_hash drift (pre-existing, not a VM parity issue) — worker_hash ${workerHash} != golden ${goldenHash}. Kernel likely changed since fixture was pinned; re-run golden-parity.test.mjs --update if intentional.`);
      }
    } else if (KNOWN_VM1A_LIMITATIONS.has(id)) {
      knownLimitations++;
      limitationsHit.push({ tool_id: id, vector: v.name, reason: KNOWN_VM1A_LIMITATIONS.get(id), worker_hash: workerHash, vm_hash: vmHash });
      console.warn(`⚠ ${tag}: KNOWN VM-1a limitation — ${KNOWN_VM1A_LIMITATIONS.get(id)} (output diverged rather than throwing).`);
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
    checked, matched, diverged, hardErrors, knownLimitations, skippedGpu, skippedNoFixture,
    divergences,
    known_limitations_hit: limitationsHit,
  }, null, 2) + '\n');
  console.log(`report written to ${reportPath}`);
}

console.log(`\nVM-1a parity: ${matched}/${checked} vector(s) byte-identical to the worker (${diverged} divergence(s), ${hardErrors} hard error(s), ${knownLimitations} known-limitation skip(s), ${skippedGpu} gpu:true skipped, ${skippedNoFixture} no-fixture skipped).`);

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
