// kernel-vm.mjs — VM-1a browser kernel VM execution harness.
//
// Runs a ChainGraph kernel's `compute(policy_parameters) -> output_payload`
// inside a sandboxed, hermetic QuickJS-ng WebAssembly VM under the
// `ocg-deterministic-compute@1` profile (SPEC.md §24). This is Phase VM-1a:
// a PREBUILT quickjs-ng release-sync variant, not the custom guest-pinned
// build (VM-1b). See MANDATE-LOOP-PROGRAM-SPEC.md "VM-1".
//
// §24 rows enforced here (D1/D2 stay the caller's job at hash time via _hash.mjs;
// this harness owns D3-D6 for the compute() call itself):
//   D3 transcendental math — kernels already inline the pure-JS _detmath port; the VM
//      changes nothing about that, it just runs the same source.
//   D4 wall-clock time      — enforced at the JS layer, not the C intrinsic (see the
//      "TWO VM-1a FINDINGS" comment below for why): Date.now(), new Date() with zero
//      args, and Date() as a function all throw; new Date(...args) still parses.
//   D5 randomness           — Math.random replaced with a throwing stub in the prelude.
//   D6 locale / Intl        — quickjs-ng ships no Intl; the prelude also strips it
//      defensively in case a future variant build adds it.
//   D7 environment/platform — no globals are exposed into the sandbox beyond the
//      QuickJS default intrinsics (no fetch, no DOM, no filesystem).
//
// The interrupt handler here is a BUDGET ENFORCER only (kills runaway loops); it is
// NOT a determinism meter. The zkVM guest's cycle count (§18) stays the authoritative
// compute-cost meter — see MANDATE-LOOP-PROGRAM-SPEC.md VM-1 research findings.

import { newQuickJSWASMModuleFromVariant, DefaultIntrinsics } from './core/index.mjs';
import { QUICKJS_NG_SINGLEFILE_VARIANT } from './variant.mjs';

export const OCG_DETERMINISTIC_COMPUTE_PROFILE = 'ocg-deterministic-compute@1';

// Distinctive value returned by the in-VM executionHash STUB (see prelude). The real
// execution_hash is computed HOST-SIDE by the caller in WebCrypto — a kernel's own
// `await executionHash(pp, output_payload)` call inside buildArtifact is only there to fill
// the FINAL envelope field, which callers discard and recompute. But a handful of kernels
// (e.g. art-55) call executionHash MID-COMPUTE to fold a SHA-256 (a merkle_root) into a DATA
// field of output_payload. That output cannot be faithfully reproduced without a host SHA-256,
// so if this sentinel survives into the extracted output_payload the harness surfaces the
// crypto dependency as a host-API limitation instead of shipping a stubbed output.
export const VM_STUB_HASH_SENTINEL = '__ocg_vm_stub_hash_5f3a2b1c__';

const DETERMINISM_PRELUDE = `
Object.defineProperty(Math, 'random', {
  value: function ocgDisabledRandom() {
    throw new Error('Math.random is disabled under ${OCG_DETERMINISTIC_COMPUTE_PROFILE} (SPEC.md \\u00a724 D5)');
  },
  writable: false,
  configurable: false,
});
if (typeof Intl !== 'undefined') { globalThis.Intl = undefined; }
(function ocgGuardDate() {
  var RealDate = Date;
  function GuardedDate() {
    if (arguments.length === 0) {
      throw new Error('new Date() with zero arguments (wall-clock read) is disabled under ${OCG_DETERMINISTIC_COMPUTE_PROFILE} (SPEC.md \\u00a724 D4)');
    }
    if (new.target) return new (Function.prototype.bind.apply(RealDate, [null].concat(Array.prototype.slice.call(arguments))))();
    throw new Error('Date() called as a function is disabled under ${OCG_DETERMINISTIC_COMPUTE_PROFILE} (SPEC.md \\u00a724 D4)');
  }
  GuardedDate.prototype = RealDate.prototype;
  GuardedDate.parse = RealDate.parse;
  GuardedDate.UTC = RealDate.UTC;
  GuardedDate.now = function ocgDisabledDateNow() {
    throw new Error('Date.now() is disabled under ${OCG_DETERMINISTIC_COMPUTE_PROFILE} (SPEC.md \\u00a724 D4)');
  };
  globalThis.Date = GuardedDate;
})();
// executionHash stub (D7 host API): kernels \`import { executionHash } from './_hash.mjs'\`,
// which the ESM strip removes. Real SHA-256 is host-side WebCrypto and is NOT bridged into
// the sandbox. buildArtifact's final \`await executionHash(pp, output_payload)\` fills the
// envelope execution_hash field, which the caller discards and recomputes host-side, so a
// no-op stub returning a distinctive sentinel lets buildArtifact run to completion. If the
// sentinel ends up inside output_payload (a kernel folding a hash into a DATA field) the host
// harness detects it and surfaces the dependency (see VM_STUB_HASH_SENTINEL).
globalThis.executionHash = function ocgStubExecutionHash() { return '${VM_STUB_HASH_SENTINEL}'; };
// WebCrypto (crypto.subtle / getRandomValues) is a HOST API, not an ECMA-262 intrinsic, and is
// intentionally absent from this sandbox. A kernel that reaches for it cannot be faithfully run
// under ${OCG_DETERMINISTIC_COMPUTE_PROFILE}. Rather than let the access surface as a silent wrong
// answer (several kernels wrap crypto.subtle in a try/catch that degrades to a false verdict), the
// proxy RECORDS the touch via a host callback — so the harness throws even when the kernel swallows
// the error — and then throws. Consistent with §24 "every escape hatch is closed or named".
(function ocgGuardWebCrypto() {
  function touch() {
    if (typeof __ocgHostApiTouched === 'function') { __ocgHostApiTouched('crypto.subtle'); }
    throw new Error('WebCrypto (crypto.subtle) is a host API, unavailable under ${OCG_DETERMINISTIC_COMPUTE_PROFILE} (SPEC.md \\u00a724 D7)');
  }
  var cryptoObj = { get subtle() { touch(); }, getRandomValues: function () { touch(); } };
  Object.defineProperty(globalThis, 'crypto', { get: function () { return cryptoObj; }, configurable: false });
})();
if (typeof BigInt === 'undefined') {
  // This prebuilt jitl release-sync binary parses BigInt LITERALS (e.g. 1n) fine --
  // the primitive type is enabled via the BigInt intrinsic -- but does not expose the
  // BigInt(value) global constructor function. Not a §24 determinism gap (BigInt
  // arithmetic is exact by definition); a pure, deterministic polyfill closes it so
  // kernels that call BigInt(someNumberOrString) still run unmodified.
  globalThis.BigInt = function ocgBigInt(value) {
    if (typeof value === 'bigint') return value;
    var s;
    if (typeof value === 'number') {
      if (!Number.isInteger(value)) throw new RangeError('The number ' + value + ' cannot be converted to a BigInt because it is not an integer');
      s = String(value);
    } else if (typeof value === 'string') {
      s = value.trim() || '0';
    } else if (typeof value === 'boolean') {
      s = value ? '1' : '0';
    } else {
      throw new TypeError('Cannot convert ' + (typeof value) + ' to a BigInt');
    }
    if (!/^-?\\d+$/.test(s)) throw new SyntaxError('Cannot convert ' + JSON.stringify(value) + ' to a BigInt');
    return Function('return (' + s + 'n);')();
  };
}
if (typeof TextEncoder === 'undefined') {
  // Same story: WHATWG Encoding globals are absent from this JS-engine-only build
  // (they were never part of ECMA-262). Deterministic pure-JS UTF-8 polyfill.
  globalThis.TextEncoder = function ocgTextEncoder() {};
  globalThis.TextEncoder.prototype.encode = function ocgEncode(input) {
    var str = input == null ? '' : String(input);
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.codePointAt(i);
      if (code > 0xFFFF) i++;
      if (code < 0x80) { bytes.push(code); }
      else if (code < 0x800) { bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F)); }
      else if (code < 0x10000) { bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F)); }
      else { bytes.push(0xF0 | (code >> 18), 0x80 | ((code >> 12) & 0x3F), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F)); }
    }
    return Uint8Array.from(bytes);
  };
}
`.trim();

/** Strips ESM import/export syntax a kernel.mjs file uses so it can run as a
 * plain QuickJS script. Kernels only ever import { executionHash } from
 * './_hash.mjs' (verified against the full chaingraph/kernels/*.kernel.mjs set,
 * 2026-07 — a real import target would fail loudly inside the VM, not silently
 * miscompute, because compute() never calls executionHash itself: the hash is
 * computed OUTSIDE the VM, in the host environment's real WebCrypto, exactly as
 * kernel-contract.test.mjs / golden-parity.test.mjs already do). */
export function stripEsmSyntaxForVm(kernelSource) {
  return kernelSource
    .replace(/^import\s+.*$/gm, '')
    .replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, '')
    .replace(/^export\s+(?=(async\s+)?function\b|const\b|class\b)/gm, '');
}

let modulePromise = null;
function getQuickJSModule() {
  if (!modulePromise) modulePromise = newQuickJSWASMModuleFromVariant(QUICKJS_NG_SINGLEFILE_VARIANT);
  return modulePromise;
}

/**
 * @param {string} kernelSource raw contents of a *.kernel.mjs file (or any source
 *   defining a top-level `compute` function under the same ESM-import convention).
 * @param {object} policyParameters the kernel's policy_parameters input.
 * @param {object} [opts]
 * @param {number} [opts.memoryLimitBytes=16*1024*1024] hard cap, QTS_RuntimeSetMemoryLimit.
 * @param {number} [opts.maxStackSizeBytes=1024*1024] hard cap, QTS_RuntimeSetMaxStackSize.
 * @param {number} [opts.interruptBudgetSteps=5_000_000] interrupt-handler call budget
 *   (an enforcement backstop against runaway/infinite kernels, not a cycle-accurate meter).
 * @param {string} [opts.functionName='compute'] exported function to invoke.
 * @returns {Promise<{output_payload: any, elapsed_ms: number}>}
 */
export async function runKernelInVM(kernelSource, policyParameters, opts = {}) {
  const {
    memoryLimitBytes = 16 * 1024 * 1024,
    maxStackSizeBytes = 1024 * 1024,
    interruptBudgetSteps = 5_000_000,
    functionName = 'compute',
  } = opts;

  const mod = await getQuickJSModule();
  const runtime = mod.newRuntime();
  runtime.setMemoryLimit(memoryLimitBytes);
  runtime.setMaxStackSize(maxStackSizeBytes);

  let steps = 0;
  runtime.setInterruptHandler(() => {
    steps += 1;
    return steps > interruptBudgetSteps; // budget ENFORCER only — see header note.
  });

  // TWO VM-1a FINDINGS vs. the literal "disable Date + Eval via context
  // intrinsics" instruction, both empirically confirmed 2026-07-09 and carried
  // forward to VM-1b:
  //
  // 1. Eval: in this prebuilt jitl release-sync binary, intrinsics.Eval=false
  //    disables the host QTS_Eval entry point that context.evalCode() itself
  //    uses to run ANY code, not just the guest-callable eval() global
  //    ("eval is not supported" TypeError from the wasm side). Eval stays
  //    enabled; the residual risk is a kernel calling eval()/Function()
  //    internally, a code-shape concern (no kernel in the fixture set does
  //    this) rather than a determinism one -- eval'd code still runs inside
  //    the same Date-guarded, Math.random-stubbed, Intl-less sandbox.
  //
  // 2. Date: intrinsics.Date=false removes the WHOLE Date object, but live
  //    kernels (e.g. art-01-ap2-mandate-chain-validator) legitimately call
  //    `new Date(pp.some_iso_timestamp)` to deterministically PARSE a
  //    caller-supplied ISO 8601 string from policy_parameters -- that is pure
  //    string computation, not a wall-clock read, and the intrinsics flag has
  //    no granularity to keep parsing while banning `Date.now()`/no-arg
  //    `new Date()`. So D4 is enforced at the JS layer instead: the
  //    determinism prelude below keeps the Date intrinsic ON but replaces the
  //    global with a guard that throws on `Date.now()`, throws on `new Date()`
  //    with zero arguments, and throws on `Date()` called without `new`
  //    (all wall-clock/ambient reads) while passing any Date(...args) call
  //    through to the real constructor for deterministic parsing/arithmetic.
  //    VM-1b can revisit both once the guest-pinned custom build gives more
  //    control over which C intrinsics are compiled in at all.
  const context = runtime.newContext({
    // BigInt: several kernels (e.g. art-201 ISCC content-code generator) need it for
    // exact 64-bit multihash arithmetic; it is IEEE-754-exact/deterministic by
    // definition (arbitrary-precision integers), so enabling it adds no §24 risk.
    intrinsics: { ...DefaultIntrinsics, Date: true, Eval: true, BigInt: true },
  });

  // Host-API touch recorder: the WebCrypto guard in the prelude calls this the instant a
  // kernel accesses crypto.subtle, BEFORE it throws. That way a kernel that swallows the
  // throw in a try/catch (degrading to a false verdict) is STILL surfaced — the harness
  // checks this flag after the run and throws regardless of what the kernel returned.
  let hostApiTouched = null;
  const touchCb = context.newFunction('__ocgHostApiTouched', (apiHandle) => {
    hostApiTouched = context.dump(apiHandle);
  });
  context.setProp(context.global, '__ocgHostApiTouched', touchCb);
  touchCb.dispose();

  const t0 = performance.now();
  try {
    context.unwrapResult(context.evalCode(DETERMINISM_PRELUDE, 'ocg-vm-prelude.js')).dispose();

    const body = stripEsmSyntaxForVm(kernelSource);
    // compute() may be sync or async (several kernels declare `export async function
    // compute`, generally for a uniform call shape rather than any real await); always
    // funnel through Promise.resolve() so the harness has one resolution path for both.
    const wrapped = [
      '(function ocgKernelVmEntry() {',
      body,
      `  const __pp = ${JSON.stringify(policyParameters)};`,
      `  const __fn = ${functionName};`,
      "  if (typeof __fn !== 'function') {",
      `    throw new Error('kernel does not export a function named ${functionName}');`,
      '  }',
      '  return Promise.resolve(__fn(__pp));',
      '})();',
    ].join('\n');

    // promiseHandle/resultHandle MUST be disposed on every path, including a thrown
    // getPromiseState (rejected promise): an undisposed handle at runtime.dispose()
    // time trips a hard C-level `Aborted(Assertion failed: list_empty(&rt->gc_obj_list))`
    // -- not a catchable JS error, a genuine leak -- found empirically 2026-07-09 on
    // kernels whose compute() rejects (e.g. via a thrown error inside an async function).
    let promiseHandle;
    let resultHandle;
    try {
      promiseHandle = context.unwrapResult(context.evalCode(wrapped, 'kernel.js'));
      while (runtime.hasPendingJob()) {
        context.unwrapResult(runtime.executePendingJobs());
      }
      resultHandle = context.unwrapResult(context.getPromiseState(promiseHandle));
      const output_payload = context.dump(resultHandle);
      // A recorded host-API touch wins over whatever the kernel returned/threw: surface it
      // as a named limitation rather than trusting a degraded output.
      if (hostApiTouched) {
        throw new Error(`kernel depends on host API '${hostApiTouched}', unavailable under ${OCG_DETERMINISTIC_COMPUTE_PROFILE} — VM-1a cannot faithfully execute it (surfaced, not silently degraded).`);
      }
      return { output_payload, elapsed_ms: performance.now() - t0 };
    } catch (e) {
      // If the kernel let the WebCrypto throw escape uncaught, the touch was still recorded —
      // normalise the message so callers classify it uniformly as a host-API limitation.
      if (hostApiTouched) {
        throw new Error(`kernel depends on host API '${hostApiTouched}', unavailable under ${OCG_DETERMINISTIC_COMPUTE_PROFILE} — VM-1a cannot faithfully execute it (surfaced, not silently degraded).`);
      }
      throw e;
    } finally {
      resultHandle?.dispose();
      promiseHandle?.dispose();
    }
  } finally {
    context.dispose();
    runtime.dispose();
  }
}

/**
 * Runs a kernel's `buildArtifact(policy_parameters)` inside the VM and returns the CANONICAL
 * `output_payload` — the same value the worker's buildArtifact produces and that the pinned
 * fixture golden_hash is taken over. This is the entry point the parity gate uses: `compute()`
 * has two return conventions across the corpus (a bare output_payload vs a
 * `{ output_payload, compliance_flags }` envelope), so hashing `compute()`'s raw return is
 * NON-canonical for the envelope kernels. buildArtifact is each kernel's own authoritative
 * extraction, so running it here yields the canonical payload uniformly.
 *
 * The in-VM executionHash is a no-op stub (see prelude); the caller computes the real
 * execution_hash host-side over the returned output_payload. If the stub sentinel survives
 * into output_payload (a kernel that folds a host SHA-256 into a data field, e.g. art-55's
 * merkle_root) this throws — the payload is not faithfully reproducible in the sandbox.
 *
 * @returns {Promise<{output_payload: any, elapsed_ms: number}>}
 */
export async function runKernelArtifactInVM(kernelSource, policyParameters, opts = {}) {
  const res = await runKernelInVM(kernelSource, policyParameters, { ...opts, functionName: 'buildArtifact' });
  const artifact = res.output_payload;
  const output_payload = artifact?.output_payload;
  if (JSON.stringify(output_payload ?? null).includes(VM_STUB_HASH_SENTINEL)) {
    throw new Error(`kernel folds a host SHA-256 (executionHash) into output_payload, unavailable under ${OCG_DETERMINISTIC_COMPUTE_PROFILE} — VM-1a cannot faithfully reproduce it (surfaced, not silently degraded).`);
  }
  return { output_payload, elapsed_ms: res.elapsed_ms };
}
