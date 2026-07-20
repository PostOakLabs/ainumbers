// kernel-vm.mjs — VM-1b browser kernel VM execution harness.
//
// Runs a ChainGraph kernel's `compute(policy_parameters) -> output_payload`
// inside a sandboxed, hermetic QuickJS-ng WebAssembly VM under the
// `ocg-deterministic-compute@2` profile (SPEC.md §24, §24.5). This is Phase
// VM-1b: a CUSTOM guest-pinned build of quickjs-ng v0.15.1 (the exact revision
// compiled into the §18 zkVM guest, ImageID a1a0bc89), replacing the VM-1a
// prebuilt release-sync variant. See MANDATE-LOOP-PROGRAM-SPEC.md "VM-1" and
// VM-1B-KERNEL-VM-BUILD-SPEC.md.
//
// What VM-1b adds over VM-1a (closing all 6 VM-1a limitations → parity 619/619):
//   - a DETERMINISTIC WebCrypto subset (§24.5 @2): crypto.subtle.digest /
//     importKey / verify are bridged to the runtime's WebCrypto (Node/browser
//     globalThis.crypto.subtle) and MUST be byte-identical to the worker. These
//     are pure functions of their inputs (no entropy), so they are ALLOWED.
//   - the real executionHash (via the digest bridge), so art-55's host-SHA-256
//     merkle_root folds into output_payload faithfully.
//   - full native BigInt (the guest-pinned build ships BigInt.prototype.*), so
//     art-201's minhash bit-packing runs unmodified — no polyfill.
//
// STILL BANNED (§24.5 @2 = §24 D5 randomness): crypto.getRandomValues,
// crypto.subtle.generateKey, crypto.subtle.sign (fresh-key) THROW inside the VM.
// A kernel that reaches for them fails, it never silently degrades an output.
//
// §24 rows enforced here (D1/D2 stay the caller's job at hash time via _hash.mjs):
//   D3 transcendental math — kernels inline the pure-JS _detmath port; unchanged.
//   D4 wall-clock time      — enforced at the JS layer (see the Date guard below):
//      Date.now(), zero-arg new Date(), and Date() as a function all throw;
//      new Date(...args) still parses a caller-supplied string deterministically.
//   D5 randomness           — Math.random + the non-deterministic WebCrypto subset
//      (getRandomValues/generateKey/sign) all throw.
//   D6 locale / Intl        — quickjs-ng ships no Intl; the prelude strips it too.
//   D7 environment/platform — no globals beyond QuickJS intrinsics + the bridged
//      deterministic WebCrypto subset (§24.5). No fetch, DOM, or filesystem.
//
// The interrupt handler here is a BUDGET ENFORCER only (kills runaway loops); it
// is NOT a determinism meter. The zkVM guest's cycle count (§18) stays the
// authoritative compute-cost meter.

import { newQuickJSWASMModuleFromVariant, DefaultIntrinsics } from './core/index.mjs';
import { QUICKJS_NG_SINGLEFILE_VARIANT } from './variant.mjs';

export const OCG_DETERMINISTIC_COMPUTE_PROFILE = 'ocg-deterministic-compute@2';

// The determinism prelude, injected before any kernel source. It (a) closes the
// §24 D4/D5/D6 escape hatches at the JS layer, (b) installs the deterministic
// WebCrypto subset bridge (§24.5) over the host functions registered by
// runKernelInVM, and (c) defines the real executionHash (identical to
// kernels/_hash.mjs, which the ESM strip removes) on top of that bridge.
//
// BigInt is NATIVE in this guest-pinned build (v0.15.1) — no polyfill. TextEncoder
// is still absent from this JS-engine-only build (it was never ECMA-262), so a
// pure, deterministic UTF-8 polyfill remains.
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
if (typeof atob === 'undefined') {
  // base64 decode/encode are WHATWG globals, absent from this JS-engine-only build. Several
  // kernels (art-124/129) decode signatures/keys via globalThis.atob. Deterministic pure-JS
  // polyfills (RFC 4648 std alphabet); atob returns a binary string, exactly like the browser.
  var __ocgB64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  globalThis.atob = function ocgAtob(input) {
    var str = String(input).replace(/[ \\t\\r\\n\\f]/g, '');
    if (str.length % 4 === 1) throw new Error("Failed to execute 'atob': invalid base64 length");
    str = str.replace(/=+$/, '');
    var out = '', bits = 0, acc = 0;
    for (var i = 0; i < str.length; i++) {
      var idx = __ocgB64.indexOf(str.charAt(i));
      if (idx === -1) throw new Error("Failed to execute 'atob': invalid character");
      acc = (acc << 6) | idx; bits += 6;
      if (bits >= 8) { bits -= 8; out += String.fromCharCode((acc >> bits) & 0xFF); }
    }
    return out;
  };
  globalThis.btoa = function ocgBtoa(input) {
    var str = String(input), out = '';
    for (var i = 0; i < str.length; i += 3) {
      var a = str.charCodeAt(i), b = str.charCodeAt(i + 1), c = str.charCodeAt(i + 2);
      if (a > 0xFF || (i + 1 < str.length && b > 0xFF) || (i + 2 < str.length && c > 0xFF)) {
        throw new Error("Failed to execute 'btoa': character out of range");
      }
      var e1 = a >> 2, e2 = ((a & 3) << 4) | (b >> 4), e3 = ((b & 15) << 2) | (c >> 6), e4 = c & 63;
      if (isNaN(b)) { e3 = e4 = 64; } else if (isNaN(c)) { e4 = 64; }
      out += __ocgB64.charAt(e1) + __ocgB64.charAt(e2) + (e3 === 64 ? '=' : __ocgB64.charAt(e3)) + (e4 === 64 ? '=' : __ocgB64.charAt(e4));
    }
    return out;
  };
}
if (typeof TextEncoder === 'undefined') {
  // WHATWG Encoding globals are absent from this JS-engine-only build. Deterministic pure-JS UTF-8 polyfill.
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
if (typeof URL === 'undefined') {
  // WHATWG URL is absent from this JS-engine-only build. The only in-repo usage (art-394,
  // isHttpsUrl: \`new URL(s).protocol === 'https:'\`) reads just the scheme, so this polyfill
  // only needs to extract a leading URI scheme (RFC 3986 §3.1) and expose it as
  // \`.protocol\` with the trailing colon WHATWG appends. Malformed/unparseable input throws
  // a TypeError, matching the real URL constructor's fail-closed behavior (§24 "every escape
  // hatch is closed or named" — no silent degrade to an empty/wrong protocol).
  globalThis.URL = function ocgURL(input) {
    var str = String(input);
    var m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(str);
    if (!m) {
      throw new TypeError("Failed to construct 'URL': Invalid URL '" + str + "'");
    }
    this.href = str;
    this.protocol = m[1].toLowerCase() + ':';
  };
}
// ── Deterministic WebCrypto subset (§24.5 @2) ───────────────────────────────
// ALLOWED (bridged to host WebCrypto, byte-identical to the worker):
//   crypto.subtle.digest (SHA-256/384), importKey, verify.
// BANNED (§24 D5 randomness — throw):
//   crypto.getRandomValues, crypto.subtle.generateKey, crypto.subtle.sign.
(function ocgInstallWebCrypto() {
  function toArrayBuffer(d) {
    if (d instanceof ArrayBuffer) return d;
    // TypedArray / DataView view → the exact backing slice
    return d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
  }
  function algoName(a) { return typeof a === 'string' ? a : (a && a.name) || String(a); }
  function bannedRandom(which) {
    return function ocgBannedRandomCrypto() {
      throw new Error(which + ' is randomness, banned under ${OCG_DETERMINISTIC_COMPUTE_PROFILE} (SPEC.md \\u00a724.5 / D5) — unavailable inside the deterministic VM');
    };
  }
  var subtle = {
    // digest(algo, data) -> Promise<ArrayBuffer>. Host returns the ArrayBuffer directly;
    // Promise.resolve wraps it so an in-kernel \`await\` resolves uniformly.
    digest: function (algo, data) {
      return Promise.resolve(__ocgDigest(algoName(algo), toArrayBuffer(data)));
    },
    // importKey stays in-VM: it returns an opaque key object carrying the material +
    // import algorithm. No host round-trip and no host key state — verify re-marshals it.
    importKey: function (fmt, keyData, algo, extractable, usages) {
      return Promise.resolve({ __ocgKey: true, fmt: fmt, keyData: keyData, algo: algo });
    },
    // verify(verifyAlgo, key, signature, data) -> Promise<boolean>. The host performs
    // importKey+verify against globalThis.crypto.subtle, byte-identical to the worker.
    verify: function (verifyAlgo, key, signature, data) {
      if (!key || !key.__ocgKey) {
        throw new Error('crypto.subtle.verify requires a key from crypto.subtle.importKey under ${OCG_DETERMINISTIC_COMPUTE_PROFILE}');
      }
      return Promise.resolve(__ocgVerify(
        JSON.stringify(key.algo), JSON.stringify(verifyAlgo), JSON.stringify(key.keyData),
        toArrayBuffer(signature), toArrayBuffer(data)
      ));
    },
    generateKey: bannedRandom('crypto.subtle.generateKey'),
    sign: bannedRandom('crypto.subtle.sign'),
  };
  var cryptoObj = { subtle: subtle, getRandomValues: bannedRandom('crypto.getRandomValues') };
  Object.defineProperty(globalThis, 'crypto', { get: function () { return cryptoObj; }, configurable: false });
})();
// ── Real executionHash (identical to kernels/_hash.mjs; the ESM strip removed the import) ──
// Now that crypto.subtle.digest + TextEncoder work in-VM, this is the AUTHENTIC hash, not a
// stub — so a kernel that folds a host SHA-256 into output_payload (art-55 merkle_root) is
// reproduced byte-for-byte.
(function ocgInstallExecutionHash() {
  function assertIJson(v) {
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new Error('Non-finite number (' + v + ') is not valid I-JSON; cannot canonicalize for hashing (RFC 8785 \\u00a73.2.2.3).');
      if (Number.isInteger(v) && !Number.isSafeInteger(v)) throw new Error('Integer ' + v + ' exceeds 2^53 and is not safe I-JSON; pass it as a string (RFC 7493).');
    } else if (Array.isArray(v)) {
      v.forEach(assertIJson);
    } else if (v && typeof v === 'object') {
      for (var k in v) { if (Object.prototype.hasOwnProperty.call(v, k)) assertIJson(v[k]); }
    }
  }
  function cgCanon(v) {
    if (Array.isArray(v)) return v.map(cgCanon);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort().reduce(function (o, k) { o[k] = cgCanon(v[k]); return o; }, {});
    }
    return v;
  }
  globalThis.executionHash = async function ocgExecutionHash(policy_parameters, output_payload) {
    var obj = { policy_parameters: policy_parameters, output_payload: output_payload };
    assertIJson(obj);
    var bytes = new TextEncoder().encode(JSON.stringify(cgCanon(obj)));
    var digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  };
  // §PPH-1 (PPH1-CODE-1): identical to kernels/_hash.mjs policyParametersHash — a kernel
  // wired to emit policy_parameters_hash imports this alongside executionHash, and the ESM
  // strip below removes that import too, so it needs the same host-bridged re-definition.
  globalThis.policyParametersHash = async function ocgPolicyParametersHash(policy_parameters) {
    assertIJson(policy_parameters);
    var bytes = new TextEncoder().encode(JSON.stringify(cgCanon(policy_parameters)));
    var digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  };
})();
`.trim();

/** Strips ESM import/export syntax a kernel.mjs file uses so it can run as a
 * plain QuickJS script. Kernels only ever import { executionHash } (and, since
 * PPH1-CODE-1, optionally policyParametersHash) from './_hash.mjs' (verified against the
 * full chaingraph/kernels/*.kernel.mjs set) — the prelude re-defines both as the real
 * host-bridged implementation. */
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

  // Date + Eval stay ENABLED as C intrinsics (VM-1a findings, carried forward):
  //   Eval: context.evalCode() itself routes through QTS_Eval, so intrinsics.Eval=false
  //     breaks the harness's own code entry; the residual "kernel calls eval()" risk is a
  //     code-shape concern (no fixture does it), enforced at the JS layer instead.
  //   Date: live kernels call new Date(pp.some_iso_timestamp) to PARSE a caller string
  //     (pure computation); the intrinsic flag can't keep parsing while banning .now(), so
  //     D4 is a JS-layer guard (see the prelude).
  //   BigInt: NATIVE and full in this guest-pinned v0.15.1 build (prototype methods included),
  //     IEEE-754-exact by definition — enabled with no §24 risk (art-201).
  const context = runtime.newContext({
    intrinsics: { ...DefaultIntrinsics, Date: true, Eval: true, BigInt: true },
  });

  // Host WebCrypto bridge (§24.5 @2). These host functions return QuickJS promises resolved
  // from the runtime's own WebCrypto (globalThis.crypto.subtle — present in Node 18+ and the
  // browser), so the digest/verify a kernel awaits is byte-identical to the worker's. Every
  // in-flight host promise is tracked in `pending` so the drive loop can await settlement
  // between QuickJS job drains.
  const pending = [];
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('runtime has no globalThis.crypto.subtle — cannot bridge the §24.5 deterministic WebCrypto subset');

  const readAB = (h) => {
    const lt = context.getArrayBuffer(h);
    const bytes = new Uint8Array(lt.value.slice()); // copy out before dispose
    lt.dispose();
    return bytes;
  };
  const settleFromHostPromise = (deferred, hostPromise, mapResolve) => {
    hostPromise
      .then((v) => { const h = mapResolve(v); deferred.resolve(h); if (h?.dispose && h !== context.true && h !== context.false && h !== context.undefined) h.dispose(); })
      .catch((e) => { const s = context.newString(String(e && e.message ? e.message : e)); deferred.reject(s); s.dispose(); })
      .finally(() => { try { runtime.executePendingJobs(); } catch { /* drained by the loop below */ } });
    pending.push(deferred.settled);
    return deferred.handle;
  };

  const digestFn = context.newFunction('__ocgDigest', (algoH, bufH) => {
    const algo = context.getString(algoH);
    const bytes = readAB(bufH);
    const deferred = context.newPromise();
    return settleFromHostPromise(deferred, subtle.digest(algo, bytes), (ab) => context.newArrayBuffer(new Uint8Array(ab)));
  });
  context.setProp(context.global, '__ocgDigest', digestFn);
  digestFn.dispose();

  const verifyFn = context.newFunction('__ocgVerify', (importAlgoH, verifyAlgoH, jwkH, sigH, dataH) => {
    const importAlgo = JSON.parse(context.getString(importAlgoH));
    const verifyAlgo = JSON.parse(context.getString(verifyAlgoH));
    const keyData = JSON.parse(context.getString(jwkH));
    const sig = readAB(sigH);
    const data = readAB(dataH);
    const deferred = context.newPromise();
    const hostPromise = (async () => {
      const key = await subtle.importKey('jwk', keyData, importAlgo, false, ['verify']);
      return subtle.verify(verifyAlgo, key, sig, data);
    })();
    return settleFromHostPromise(deferred, hostPromise, (ok) => (ok ? context.true : context.false));
  });
  context.setProp(context.global, '__ocgVerify', verifyFn);
  verifyFn.dispose();

  const t0 = performance.now();
  try {
    context.unwrapResult(context.evalCode(DETERMINISM_PRELUDE, 'ocg-vm-prelude.js')).dispose();

    const body = stripEsmSyntaxForVm(kernelSource);
    // compute()/buildArtifact() may be sync or async; funnel through Promise.resolve() so the
    // harness has one resolution path for both.
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

    let promiseHandle;
    let resultHandle;
    try {
      promiseHandle = context.unwrapResult(context.evalCode(wrapped, 'kernel.js'));
      // Drive loop: interleave QuickJS microtask draining with host-promise settlement. A kernel
      // that awaits crypto.subtle.digest/verify suspends into a host promise; we drain jobs, then
      // await any in-flight host promises, then drain again, until the top-level promise settles.
      // The guard bounds a pathological loop (defence-in-depth beside the interrupt budget).
      let guard = 0;
      while (runtime.hasPendingJob() || pending.length) {
        while (runtime.hasPendingJob()) context.unwrapResult(runtime.executePendingJobs());
        if (pending.length) await Promise.all(pending.splice(0));
        if (++guard > 1_000_000) throw new Error('VM drive loop exceeded its settlement budget (possible unresolved host promise)');
      }
      resultHandle = context.unwrapResult(context.getPromiseState(promiseHandle));
      const output_payload = context.dump(resultHandle);
      return { output_payload, elapsed_ms: performance.now() - t0 };
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
 * Under VM-1b the in-VM executionHash is the REAL host-bridged hash (§24.5), so a kernel that
 * folds a host SHA-256 into a data field (e.g. art-55's merkle_root) is reproduced byte-for-byte.
 *
 * @returns {Promise<{output_payload: any, elapsed_ms: number}>}
 */
export async function runKernelArtifactInVM(kernelSource, policyParameters, opts = {}) {
  const res = await runKernelInVM(kernelSource, policyParameters, { ...opts, functionName: 'buildArtifact' });
  const artifact = res.output_payload;
  const output_payload = artifact?.output_payload;
  return { output_payload, elapsed_ms: res.elapsed_ms };
}
