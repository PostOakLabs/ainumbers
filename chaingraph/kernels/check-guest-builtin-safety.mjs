// @ts-nocheck — plain CLI utility script, never meant to be type-checked; only
// swept into tsc --checkJs's program because it lives under chaingraph/kernels/
// and this edit makes it "touched" (JSDOC-CHECKJS-PREFLIGHT-1's own path filter,
// landed 2026-08-16, watches the whole directory, not just *.kernel.mjs). Without
// this it fails on bare node:fs/process usage — a directory-wide @types/node gap
// (SO #47's exemption only reaches chaingraph/kernels/__proptests__/) that would
// block ANY future edit to any of the ~40 non-kernel .mjs scripts in this
// directory, not something specific to this file's own logic.
// check-guest-builtin-safety.mjs — GUEST-BUILTIN-GATE-1.
//
// vm-parity-gate.mjs (§24) runs every kernel through chaingraph/vm/kernel-vm.mjs, whose
// DETERMINISM_PRELUDE POLYFILLS `atob`/`btoa`/`TextEncoder`/`URL` before the kernel body ever
// executes (see kernel-vm.mjs's own header: "TextEncoder is still absent from this JS-engine-only
// build ... a pure, deterministic UTF-8 polyfill remains"). That is correct for byte-parity
// against the WORKER, but it means a kernel calling one of those WHATWG globals passes the
// mandatory gate and only fails months later, after a multi-hour real zkVM prove, with an opaque
// `{error:ocg_run, code:-3, msg:undefined}` journal — measured on art-612, art-607, art-606,
// art-604, art-587 (research/KERNEL-BRANCH-FRESHNESS-SCOPE-2026-08-14.md).
//
// This gate closes that hole: it runs `compute(policy_parameters)` — the entry point the real
// zkVM guest actually executes and commits to the journal (§18.0: `journal.output` JCS-equals
// `output_payload`; the wrapping `execution_hash` field is bound OUTSIDE the guest, by the host,
// over the guest's returned output_payload — buildArtifact()'s own top-level `executionHash(pp,
// output_payload)` call is a WORKER-side concern only, never something the guest runs) — through
// the SAME QuickJS-ng VM, but with the guest-absent builtins genuinely DELETED immediately after
// the determinism prelude installs its polyfills and before the kernel body evaluates,
// reproducing exactly what the real zkVM guest lacks. A kernel that reaches one of them on a
// realistic input throws a real ReferenceError here, in milliseconds, pre-GPU. This matches the
// entry point ART607-EAGER-INIT-FIX-1 / ART595-ART590-UTF8-FIX-1 / TEXTENCODER-SWEEP-FIX-1 each
// hand-drove ("module load and compute()", never buildArtifact()) — confirmed empirically here
// too: running buildArtifact() instead makes every kernel fail, because its own executionHash()
// wrapper needs TextEncoder and is not part of what the guest computes.
//
// It does NOT touch vm-parity-gate.mjs or kernel-vm.mjs (their polyfills stay — other things may
// depend on them; this is an ADDITIONAL, faithful gate, per GUEST-BUILTIN-GATE-1's fence).
//
// Usage:
//   node check-guest-builtin-safety.mjs             report + exit 1 on any NEW (non-allowlisted)
//                                                    guest-fatal finding or hard error.
//   node check-guest-builtin-safety.mjs --report <path>   write the full JSON result to <path>.
//   node check-guest-builtin-safety.mjs --only <tool-id>  KERNEL-PREFLIGHT-1: scope the run to
//                                                    ONE kernel id (whole-estate run is unchanged
//                                                    when this flag is absent).

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KERNELS } from './index.mjs';
import { runKernelInVM } from '../vm/kernel-vm.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = resolve(HERE, 'fixtures');
const KERNEL_VM_PATH = resolve(HERE, '../vm/kernel-vm.mjs');
const reportIdx = process.argv.indexOf('--report');
const reportPath = reportIdx !== -1 ? process.argv[reportIdx + 1] : null;
const onlyIdx = process.argv.indexOf('--only');
const ONLY_ID = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;

// ── DERIVE the absent-builtin set from kernel-vm.mjs's own prelude — never hand-typed ───────────
// kernel-vm.mjs's DETERMINISM_PRELUDE guards every WHATWG/ECMA-262-absent global it polyfills
// behind `if (typeof X === 'undefined') { ... }` (its own comments document each as genuinely
// absent from the guest-pinned QuickJS-ng build: atob/btoa "absent from this JS-engine-only
// build", TextEncoder "still absent ... it was never ECMA-262", URL "absent from this JS-engine-
// only build"). Reading that guard list IS reading the guest's real environment description —
// a hand-typed list here would be exactly the duty SO #0b forbids (silently goes stale if the
// prelude's polyfill set ever changes).
const kernelVmSource = readFileSync(KERNEL_VM_PATH, 'utf8');
const preludeMatch = kernelVmSource.match(/const DETERMINISM_PRELUDE = `([\s\S]*?)`\.trim\(\);/);
if (!preludeMatch) {
  throw new Error('check-guest-builtin-safety.mjs: could not locate DETERMINISM_PRELUDE in kernel-vm.mjs — the derivation source moved or was renamed; update this gate, do not fall back to a hand-typed list.');
}
const ABSENT_BUILTINS = [...new Set([...preludeMatch[1].matchAll(/if \(typeof (\w+) === 'undefined'\)/g)].map((m) => m[1]))];
// btoa shares atob's guard block (both installed together, no separate `typeof btoa` check of
// its own) — kernel-vm.mjs's own comment on that block names both as the same WHATWG pair.
if (ABSENT_BUILTINS.includes('atob') && !ABSENT_BUILTINS.includes('btoa')) ABSENT_BUILTINS.push('btoa');
if (ABSENT_BUILTINS.length === 0) {
  throw new Error('check-guest-builtin-safety.mjs: derived ZERO absent builtins from kernel-vm.mjs — derivation is broken. This gate must not silently no-op; fix the derivation before trusting a green run.');
}
const DELETE_PRELUDE = ABSENT_BUILTINS.map((name) => `delete globalThis.${name};`).join(' ');

// ── KNOWN, NAMED, SHRINK-ONLY allowlist ──────────────────────────────────────────────────────
// A kernel/vector pair here is a MEASURED, currently-open guest-fatal defect with its own fix
// row already in flight — listing it here is what lets this gate go live as a REQUIRED preflight
// check today without redding every push on pre-existing debt (same shape as vm-parity-gate.mjs's
// KNOWN_VM1A_LIMITATIONS). Removing an entry (because the fix landed) is encouraged and expected;
// ADDING one for a kernel this gate did not just measure as failing is not — that would silently
// widen the escape hatch this row exists to close. Never `--update-baseline`-style bulk add.
const KNOWN_GUEST_FATAL = new Map([
  ['art-598-input-attestation-verifier', 'bare `new TextEncoder()` at 3 call sites (kernel.mjs:59,194,195), inside compute()/buildArtifact(), on non-empty realistic input. Fix in flight: ART598-DEASYNC-1, held draft PR #1219 (unmerged as of GUEST-BUILTIN-GATE-1, 2026-08-14).'],
]);

function isReferenceErrorForAbsentBuiltin(message) {
  return ABSENT_BUILTINS.some((name) => new RegExp(`\\b${name}\\b`).test(message) && /not defined|is not a function|undefined is not/i.test(message));
}

let checked = 0, passed = 0, guestFatal = 0, knownGuestFatal = 0, hardErrors = 0, skippedGpu = 0, skippedNoFixture = 0, skippedPrivateInput = 0;
const findings = [];
const knownHits = [];

let toolIds = Object.keys(KERNELS);
if (ONLY_ID) {
  if (!toolIds.includes(ONLY_ID)) {
    throw new Error(`check-guest-builtin-safety.mjs --only ${ONLY_ID}: no such kernel id in index.mjs.`);
  }
  toolIds = [ONLY_ID];
}
for (const id of toolIds) {
  const kernel = KERNELS[id];
  if (kernel?.meta?.gpu === true) { skippedGpu++; continue; } // out of scope, same as vm-parity-gate.mjs (§24.0)
  if (kernel?.meta?.private_input_profile) { skippedPrivateInput++; continue; } // §25 profile, same exclusion as vm-parity-gate.mjs

  const fpath = resolve(FIXDIR, `${id}.fixtures.json`);
  if (!existsSync(fpath)) { skippedNoFixture++; continue; }

  const kernelPath = resolve(HERE, `${id}.kernel.mjs`);
  if (!existsSync(kernelPath)) {
    console.error(`✗ ${id}: registered in index.mjs but no source file at kernels/${id}.kernel.mjs`);
    hardErrors++; continue;
  }
  const kernelSource = readFileSync(kernelPath, 'utf8');
  const guestShapedSource = `${DELETE_PRELUDE}\n${kernelSource}`;

  const doc = JSON.parse(readFileSync(fpath, 'utf8'));
  for (const v of doc.vectors ?? []) {
    const tag = `${id}/${v.name}`;
    checked++; // EVERY fixture vector, not vectors[0] — a guard-branch vector proves nothing about the others.

    try {
      await runKernelInVM(guestShapedSource, v.policy_parameters, { functionName: 'compute' });
      passed++;
    } catch (e) {
      const message = String(e && e.message ? e.message : e);
      if (KNOWN_GUEST_FATAL.has(id)) {
        knownGuestFatal++;
        knownHits.push({ tool_id: id, vector: v.name, reason: KNOWN_GUEST_FATAL.get(id), error: message });
        console.warn(`⚠ ${tag}: KNOWN guest-fatal — ${KNOWN_GUEST_FATAL.get(id)} (threw: ${message})`);
      } else if (isReferenceErrorForAbsentBuiltin(message)) {
        guestFatal++;
        findings.push({ tool_id: id, vector: v.name, policy_parameters: v.policy_parameters, error: message, class: 'guest-absent-builtin' });
        console.error(`✗ ${tag}: GUEST-FATAL — calls an absent builtin the real zkVM guest does not have.\n    ${message}`);
      } else {
        hardErrors++;
        findings.push({ tool_id: id, vector: v.name, policy_parameters: v.policy_parameters, error: message, class: 'hard-error' });
        console.error(`✗ ${tag}: VM execution threw (not an absent-builtin ReferenceError) — ${message}`);
      }
    }
  }
}

if (reportPath) {
  writeFileSync(reportPath, JSON.stringify({
    generated_by: 'check-guest-builtin-safety.mjs',
    derived_absent_builtins: ABSENT_BUILTINS,
    checked, passed, guestFatal, knownGuestFatal, hardErrors, skippedGpu, skippedNoFixture, skippedPrivateInput,
    findings,
    known_guest_fatal_hit: knownHits,
  }, null, 2) + '\n');
  console.log(`report written to ${reportPath}`);
}

console.log(`\nGuest-builtin safety: ${passed}/${checked} vector(s) run clean with {${ABSENT_BUILTINS.join(', ')}} genuinely deleted post-prelude (${guestFatal} NEW guest-fatal finding(s), ${knownGuestFatal} known/allowlisted guest-fatal hit(s), ${hardErrors} other hard error(s), ${skippedGpu} gpu:true skipped, ${skippedNoFixture} no-fixture skipped, ${skippedPrivateInput} private-input (§25) skipped).`);

if (guestFatal > 0 || hardErrors > 0) {
  console.error(`\n✗ ${guestFatal} new guest-fatal finding(s) + ${hardErrors} other hard error(s) — CI-blocking${reportPath ? `, full detail in ${reportPath}` : ''}.`);
  process.exit(1);
}
console.log('✓ check-guest-builtin-safety clean.');
process.exit(0);
