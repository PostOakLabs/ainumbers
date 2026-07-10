# chaingraph/vm/ — VM-1b browser kernel VM

Phase VM-1b of MANDATE-LOOP-PROGRAM-SPEC.md "VM-1". Runs a ChainGraph kernel's
`compute(policy_parameters) -> output_payload` inside a sandboxed, hermetic, in-browser
QuickJS-ng WebAssembly VM under the `ocg-deterministic-compute@2` profile (SPEC.md §24, §24.5).

VM-1b replaces the VM-1a *prebuilt* `@jitl/quickjs-ng` variant with a **custom, guest-pinned
build**: quickjs-ng compiled at the exact revision inside the §18 zkVM guest, so the browser VM
runs the same C interpreter as the guest (browser↔guest bit-parity). It closes all six VM-1a
limitations, taking the parity gate to **619/619** with an empty `KNOWN_VM1A_LIMITATIONS`.

## What's here

| File | Purpose |
|---|---|
| `kernel-vm.mjs` | The execution harness/library. `runKernelInVM(kernelSource, policyParameters, opts?)` + `runKernelArtifactInVM`. Installs the §24.5 deterministic WebCrypto bridge + real executionHash. |
| `variant.mjs` | A quickjs-emscripten-core "variant" wired to the base64-embedded wasm (zero-fetch). |
| `quickjs-ng-wasm.b64.mjs` | The **custom guest-pinned** quickjs-ng v0.15.1 wasm binary, base64. |
| `emscripten-module.mjs`, `ffi.mjs` | Emscripten glue + low-level FFI (`QTS_*`), from the same custom build. |
| `core/` | Vendored `quickjs-emscripten-core@0.32.0` + `@jitl/quickjs-ffi-types@0.32.0` (pure JS, unchanged from VM-1a — the FFI interface is identical). |
| `scripts/gen-kernel-vm-html.mjs` | Regenerates `chaingraph/kernel-vm.html` (multi-file demo page). |
| `scripts/gen-kernel-vm-widget.mjs` | Regenerates `tools/kernel-vm-widget.html` (single-file MCP Apps PILOT widget). |
| `scripts/smoke.mjs` | Minimal Node smoke test for the harness. |

Consumers: `chaingraph/kernel-vm.html`, `tools/kernel-vm-widget.html`, and the parity gate
`chaingraph/kernels/vm-parity-gate.mjs` (imports `kernel-vm.mjs` directly).

## Reproducibility — the build is re-derivable from these pins

- **quickjs-ng revision:** **v0.15.1**, commit `fd0a0210b7be00957751871e7e01b8291268fc29`
  (upstream `github.com/quickjs-ng/quickjs`). This is the exact revision compiled into the §18
  zkVM guest (ImageID `a1a0bc89…`, guest source `runner/quickjs-ng` in `ocg-zkvm`), which builds
  it from the same four translation units (`quickjs.c`, `dtoa.c`, `libregexp.c`, `libunicode.c`).
- **Toolchain:** emscripten **emsdk 5.0.1** (Docker `emscripten/emsdk:5.0.1`), the version
  quickjs-emscripten@0.32.0 pins. (Do NOT build the singlefile embed with emcc 6.x + `--closure`:
  it strips the `wasmBinary` init path the zero-fetch embed relies on.)
- **Build harness:** `justjake/quickjs-emscripten@0.32.0` (MIT), variant
  `variant-quickjs-ng-wasmfile-release-sync`. Vendor the pinned quickjs-ng with the repo's own
  `scripts/vendor-quickjs-ng.sh v0.15.1` (downloads the official `quickjs-amalgam.zip` and applies
  `vendor/quickjs-ng-patches/0001-bellard-module-detection.patch`, which supplies the
  `QTS_DetectModule`/`js_std_cmd` shims interface.c expects), then `make`. `interface.c` compiles
  unchanged against v0.15.1 — no `QTS_*` API drift from the v0.12.1 the package normally ships.

The build was done on WSL (Ubuntu-24.04); the wasm loads hermetically (base64-embedded, passed via
the emscripten `wasmBinary` option — no fetch/XHR). The parity gate runs fully offline.

## §24.5 deterministic WebCrypto bridge (VM-1b)

`kernel-vm.mjs` installs a `crypto` global inside the VM implementing the `@2` split (SPEC.md §24.5):

- **ALLOWED (bridged to the runtime's WebCrypto, byte-identical to the worker):**
  - `crypto.subtle.digest` (SHA-256/384) — a host callback resolves it from
    `globalThis.crypto.subtle.digest` (present in Node 18+ and the browser).
  - `crypto.subtle.importKey` / `crypto.subtle.verify` — importKey stays in-VM (returns an opaque
    key object carrying the JWK + algorithm, no host key state); verify bridges to the host, which
    runs importKey+verify against the runtime WebCrypto and returns the boolean. Ed25519 (art-129)
    and ECDSA (art-124) both verified.
  - `executionHash` is the **real** `_hash.mjs` implementation, defined in the prelude on top of the
    digest bridge — so a kernel folding a host SHA-256 into `output_payload` (art-55's `merkle_root`)
    is reproduced byte-for-byte.
- **BANNED (§24 D5 randomness — throw):** `crypto.getRandomValues`, `crypto.subtle.generateKey`,
  `crypto.subtle.sign` (fresh key). A kernel reaching for them fails; it never silently degrades an
  output (the s3 doctrine). Proven to throw.

The async host calls resolve through QuickJS's job queue: the harness drive loop interleaves
`executePendingJobs()` draining with awaiting in-flight host promises until the top-level promise
settles. Kernels using `atob`/`TextEncoder` get deterministic pure-JS polyfills (those WHATWG
globals were never in ECMA-262 and are absent from this JS-engine-only build). **BigInt is native
and full** in this build (prototype methods included) — no polyfill; art-201's minhash bit-packing
runs unmodified.

## §24 determinism findings carried from VM-1a

1. **Eval intrinsic stays enabled.** `intrinsics.Eval=false` disables the host `QTS_Eval` entry
   `context.evalCode()` itself uses; the residual "kernel calls `eval()`" risk is a code-shape
   concern (no fixture does it), not a determinism one.
2. **Date (D4) is a JS-layer guard.** Live kernels call `new Date(pp.some_iso_timestamp)` to PARSE
   a caller string (pure computation). The intrinsic flag can't keep parsing while banning `.now()`,
   so the prelude keeps `Date` on and replaces the global: `Date.now()`, zero-arg `new Date()`, and
   `Date()`-as-a-function all throw; `new Date(...args)` still parses.
3. **Math.random (D5)** is a throwing stub. **Intl (D6)** is absent from this build (a §24.1 D6
   gift); the prelude strips it defensively.
4. **`WebAssembly.instantiate` needs `'wasm-unsafe-eval'` in `script-src`.** Both `kernel-vm.html`
   and `tools/kernel-vm-widget.html` carry it. The widget flattens the whole `vm/*.mjs` graph into
   same-scope IIFEs (no `blob:`/dynamic-`import()`) so WASM compiles in the top-level document
   context — see `scripts/gen-kernel-vm-widget.mjs`.

## Canonical entry: buildArtifact, not compute

The parity gate runs `buildArtifact(policy_parameters)` in the VM — NOT `compute()`. `buildArtifact`
is each kernel's authoritative path (what the Worker runs, what the pinned `golden_hash` is taken
over); `compute()` has two return conventions across the corpus so hashing its raw return is
non-canonical. The gate asserts `worker_hash == golden` and `vm_hash == worker_hash`, so a VM match
proves VM == canonical worker byte-for-byte.

## Parity

`node chaingraph/kernels/vm-parity-gate.mjs --strict` → **619/619 byte-identical to the worker, 0
divergences, 0 hard errors, `KNOWN_VM1A_LIMITATIONS` empty.** VM-1a is retired; VM-1b is the sole
in-browser VM surface. The gate runs `--strict` in CI (`deploy-to-dreamhost.yml`) and
`scripts/preflight.mjs`.
