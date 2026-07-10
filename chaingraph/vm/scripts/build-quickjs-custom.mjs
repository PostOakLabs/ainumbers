// build-quickjs-custom.mjs — reproducible recipe for the VM-1b custom guest-pinned
// quickjs-ng wasm. This is documentation-as-code: the actual compile runs on Linux/WSL with
// emscripten (emsdk 5.0.1 via Docker) + the justjake/quickjs-emscripten build harness, which can
// NOT run inside the site's zero-build Node/Windows context (CONTRACT §0). Running this on the host
// prints the recipe and the pins; run the STEPS on WSL to re-derive chaingraph/vm/*.
//
// See chaingraph/vm/README.md ("Reproducibility") for the rationale behind each pin.

// ── PINS (must match the §18 zkVM guest for browser↔guest bit-parity) ───────────────────────────
export const QUICKJS_NG_VERSION = 'v0.15.1';
export const QUICKJS_NG_COMMIT = 'fd0a0210b7be00957751871e7e01b8291268fc29';
export const EMSDK_VERSION = '5.0.1'; // emscripten/emsdk:5.0.1 (do NOT use 6.x + --closure: strips wasmBinary)
export const QE_HARNESS = 'justjake/quickjs-emscripten@0.32.0';
export const QE_VARIANT = 'variant-quickjs-ng-wasmfile-release-sync';

// ── STEPS (run on WSL/Linux) ────────────────────────────────────────────────────────────────────
export const RECIPE = `
# 0. Prereqs (once): emsdk 5.0.1 available (Docker image emscripten/emsdk:5.0.1), unzip, node, docker.
# 1. Clone the build harness:
git clone https://github.com/justjake/quickjs-emscripten.git qe-build && cd qe-build
pnpm install   # (the root 'prepare' README-codegen may fail on a shallow clone; irrelevant to the wasm)
# 2. Vendor the guest-pinned quickjs-ng (downloads the official amalgam + applies the QTS_DetectModule
#    patch the interface expects). interface.c compiles unchanged against ${QUICKJS_NG_VERSION}:
bash scripts/vendor-quickjs-ng.sh ${QUICKJS_NG_VERSION}
# 3. Build the release-sync wasm with the pinned Docker toolchain:
cd packages/${QE_VARIANT} && make        # emcc.sh auto-uses Docker emscripten/emsdk:${EMSDK_VERSION}
# 4. Vendor into the site repo (base64-embed the wasm; copy the glue). ffi.mjs + core/ are UNCHANGED
#    from VM-1a — the QTS_* FFI interface is identical, only the quickjs-ng revision moved.
#    cp dist/emscripten-module.browser.mjs        -> chaingraph/vm/emscripten-module.mjs
#    base64(dist/emscripten-module.wasm)          -> chaingraph/vm/quickjs-ng-wasm.b64.mjs
# 5. Prove it: node chaingraph/kernels/vm-parity-gate.mjs --strict   (expect 619/619, 0 divergences)
`;

if (import.meta.url === `file://${process.argv[1]}`.replace(/\\\\/g, '/') || process.argv[1]?.endsWith('build-quickjs-custom.mjs')) {
  console.log('VM-1b custom guest-pinned quickjs-ng build — pins:');
  console.log({ QUICKJS_NG_VERSION, QUICKJS_NG_COMMIT, EMSDK_VERSION, QE_HARNESS, QE_VARIANT });
  console.log('\nThis compile runs on WSL/Linux, not here. Recipe:');
  console.log(RECIPE);
}
