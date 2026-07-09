# chaingraph/vm/ — VM-1a browser kernel VM

Phase VM-1a of MANDATE-LOOP-PROGRAM-SPEC.md "VM-1". Runs a ChainGraph kernel's
`compute(policy_parameters) -> output_payload` inside a sandboxed, hermetic, in-browser
QuickJS-ng WebAssembly VM under the `ocg-deterministic-compute@1` profile (SPEC.md §24).

## What's here

| File | Purpose |
|---|---|
| `kernel-vm.mjs` | The execution harness/library. `runKernelInVM(kernelSource, policyParameters, opts?)`. |
| `variant.mjs` | A quickjs-emscripten-core "variant" wired to the base64-embedded wasm (zero-fetch). |
| `quickjs-ng-wasm.b64.mjs` | Vendored `@jitl/quickjs-ng-wasmfile-release-sync@0.32.0` wasm binary, base64. |
| `emscripten-module.mjs`, `ffi.mjs` | Vendored emscripten glue + low-level FFI, unmodified from the same npm package. |
| `core/` | Vendored `quickjs-emscripten-core@0.32.0` + `@jitl/quickjs-ffi-types@0.32.0` (pure JS, no wasm). |
| `scripts/gen-kernel-vm-html.mjs` | Regenerates `chaingraph/kernel-vm.html` (multi-file demo page). |
| `scripts/gen-kernel-vm-widget.mjs` | Regenerates `tools/kernel-vm-widget.html` (single-file PILOT widget). |
| `scripts/smoke.mjs` | Minimal Node smoke test for the harness (no browser needed). |

Consumers: `chaingraph/kernel-vm.html` (standalone demo page, multi-file `<script type="module">`
imports), `tools/kernel-vm-widget.html` (single-file MCP Apps PILOT widget, flattened IIFE
bundle — see below), and `chaingraph/kernels/vm-parity-gate.mjs` (the CI parity gate, Node-side,
imports `kernel-vm.mjs` directly).

## Why the vendored package name doesn't match the spec text

MANDATE-LOOP-PROGRAM-SPEC.md's VM-1a phase description says "prebuilt
`@jitl/quickjs-ng-*-release-sync` variant" implying a singlefile (wasm-embedded) package. That
exact package does not exist on the npm registry — `@jitl` only ships quickjs-ng as
**wasmfile** variants (separate `.wasm` file); the **singlefile** (base64-embedded) variants only
exist for the classic Bellard-lineage `quickjs` package, not `quickjs-ng`. This is a real,
checked finding (`npm view` against the registry, 2026-07-09), not an assumption.

**Resolution:** vendor the wasmfile variant's `.wasm` binary directly, base64-encode it
(`quickjs-ng-wasm.b64.mjs`), and pass it via the standard Emscripten `wasmBinary` init option
(`variant.mjs`). The vendored `emscripten-module.mjs` glue already supports this natively — when
`wasmBinary` is supplied, its own fetch/XHR fallback code paths are simply never reached (dead
code, verified by reading the glue's control flow, not by removing the code). The result is
functionally identical to a true singlefile package: zero-fetch, hermetic, one wasm compile at
harness init. Regenerate the vendored files if the upstream version bumps:
`node chaingraph/vm/scripts/vendor-quickjs.mjs` (TODO for VM-1b: this manual-vendoring note is a
placeholder for a real vendoring script; VM-1a vendored by hand from
`@jitl/quickjs-ng-wasmfile-release-sync@0.32.0` + `quickjs-emscripten-core@0.32.0` +
`@jitl/quickjs-ffi-types@0.32.0`).

## §24 determinism findings (VM-1a, empirically confirmed 2026-07-09)

`kernel-vm.mjs` documents these inline; summarized here for anyone debugging a divergence:

1. **Eval intrinsic must stay enabled.** In this prebuilt binary, `intrinsics.Eval=false`
   disables the host `QTS_Eval` entry point that `context.evalCode()` itself uses to run ANY
   code, not just the guest-callable `eval()` global. Eval stays on; the residual risk (a kernel
   calling `eval()`/`Function()` internally) is a code-shape concern, not a determinism one — the
   fixture set doesn't do this.
2. **Date (D4) is enforced at the JS layer, not the C intrinsic.** `intrinsics.Date=false` removes
   the whole `Date` object, but live kernels legitimately call `new Date(pp.some_iso_timestamp)`
   to deterministically PARSE a caller-supplied string (pure computation, not a wall-clock read).
   The intrinsics flag has no granularity for "allow parsing, ban `.now()`", so the determinism
   prelude keeps `Date` enabled and replaces the global with a guard: `Date.now()` throws, `new
   Date()` with zero args throws, `Date()` called without `new` throws; `new Date(...args)` still
   works.
3. **Math.random (D5)** is replaced with a throwing stub — straightforward, no surprises.
4. **Intl (D6)** is absent by default in this build (a determinism gift per SPEC.md §24.1 D6); the
   prelude also strips it defensively.
5. **BigInt, TextEncoder are missing globals**, not a §24 issue — WHatWG/constructor gaps in this
   minimal build. `BigInt(value)` and `TextEncoder.prototype.encode` are polyfilled with pure,
   deterministic implementations in the prelude. `BigInt.prototype.toString()` (and other
   prototype methods) are NOT fixable this way — the primitive's internal prototype linkage
   belongs to the engine, not guest JS. Kernels that need it are a KNOWN_VM1A_LIMITATIONS entry
   in `vm-parity-gate.mjs`.
6. **WebAssembly.instantiate requires `'wasm-unsafe-eval'` in `script-src`** wherever a page's CSP
   is enforced. `chaingraph/kernel-vm.html` and `tools/kernel-vm-widget.html` both carry it.
7. **Blob-sourced nested ES modules did NOT reliably inherit the page's meta-tag CSP** for
   `wasm-unsafe-eval` in local testing (a `WebAssembly.instantiate` inside a `blob:`-loaded,
   dynamically-`import()`-ed module was rejected citing a CSP string that didn't match the actual
   `<meta>` tag). `tools/kernel-vm-widget.html` therefore avoids `blob:`/dynamic-`import()`
   entirely and flattens the whole `chaingraph/vm/*.mjs` module graph into same-scope IIFEs at
   generation time (see `scripts/gen-kernel-vm-widget.mjs`) — WASM then compiles in the top-level
   document context, which is proven to work (`chaingraph/kernel-vm.html` uses real files via
   `<script type="module">` imports and has never hit this).

## Known VM-1a limitations (carried to VM-1b)

See `KNOWN_VM1A_LIMITATIONS` in `chaingraph/kernels/vm-parity-gate.mjs`. As of 2026-07-09: 3
kernels call `globalThis.crypto.subtle` directly inside `compute()` (WebCrypto isn't bridged into
the sandbox by design), and 1 kernel calls a `BigInt` prototype method this build doesn't expose.
606/619 conformance vectors (302 kernels) run byte-identical to the worker; the remaining 13
vectors are these documented, non-silent gaps.

## VM-1b (not this phase)

A custom guest-pinned emscripten build, pinned to the exact quickjs-ng revision inside the §18
zkVM guest (`a1a0bc89`), closing browser↔guest parity fully and potentially resolving the Eval/
BigInt-prototype findings above by controlling which C intrinsics compile in at all.
