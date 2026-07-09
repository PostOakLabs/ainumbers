// variant.mjs — a quickjs-emscripten-core "variant" wired to a base64-embedded
// wasm binary instead of a fetched/CDN .wasm file (zero-fetch, hermetic).
// Source lineage: @jitl/quickjs-ng-wasmfile-release-sync@0.32.0 (MIT, justjake/quickjs-emscripten).
// Regenerate the vendored files with: node chaingraph/vm/scripts/vendor-quickjs.mjs

import { QUICKJS_NG_WASM_B64 } from './quickjs-ng-wasm.b64.mjs';

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let wasmBytes = null;
function getWasmBinary() {
  if (!wasmBytes) wasmBytes = base64ToBytes(QUICKJS_NG_WASM_B64);
  return wasmBytes;
}

async function importModuleLoader() {
  const { default: QuickJSRaw } = await import('./emscripten-module.mjs');
  // Pin wasmBinary so the emscripten glue never issues a fetch/XHR for the .wasm
  // (its own fetch fallbacks stay present in the vendored file but are dead code
  // whenever wasmBinary is supplied — see chaingraph/vm/README.md).
  return (moduleArg = {}) => QuickJSRaw({ wasmBinary: getWasmBinary(), ...moduleArg });
}

async function importFFI() {
  const { QuickJSFFI } = await import('./ffi.mjs');
  return QuickJSFFI;
}

export const QUICKJS_NG_SINGLEFILE_VARIANT = {
  type: 'sync',
  importFFI,
  importModuleLoader,
};

export default QUICKJS_NG_SINGLEFILE_VARIANT;
