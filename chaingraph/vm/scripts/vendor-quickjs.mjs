// vendor-quickjs.mjs — regenerates the vendored quickjs-emscripten files in chaingraph/vm/
// from npm. Run this after bumping QJS_VERSION below (all three packages share one version).
//
// Usage: node chaingraph/vm/scripts/vendor-quickjs.mjs
//
// Why this exists as a script and not just "npm install": chaingraph/vm/ has no package.json
// (CONTRACT §0 -- the site repo is zero-build, self-contained HTML). This pulls the three npm
// tarballs into a scratch dir, extracts exactly the files the harness needs, base64-encodes the
// wasm binary, and rewrites the one bare-specifier import (@jitl/quickjs-ffi-types) to a
// relative path -- see chaingraph/vm/README.md for why @jitl/quickjs-ng-*-singlefile-* doesn't
// exist and this wasmfile+wasmBinary approach is the hermetic equivalent.
//
// SANDBOX-FILELIST-SWEEP-2 DISPOSITION -- DECLARED OUT, not converted to scripts/lib-sandbox-deps.mjs.
// That module derives a repo-relative file LIST from OUR OWN static import graph, to keep a fixture
// in sync with what a copied module imports. This script runs the opposite direction: it pulls
// named files OUT of a third-party npm tarball (quickjs-emscripten-core's dist/ output) INTO the
// repo, and those filenames are content-hashed by upstream's esbuild build, not by anything in this
// repository's import graph -- there is nothing here for derivation to walk. The list below
// (['index.mjs', 'chunk-TAV5CUKK.mjs', ...]) is necessarily hand-maintained and self-declares its
// own staleness risk in the trailing console.log ("If chunk filenames changed ... update").

import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const QJS_VERSION = '0.32.0';
const HERE = dirname(fileURLToPath(import.meta.url));
const VM = resolve(HERE, '..');

const scratch = mkdtempSync(join(tmpdir(), 'vendor-quickjs-'));
console.log('scratch dir:', scratch);

function pack(pkg) {
  execSync(`npm pack ${pkg}@${QJS_VERSION}`, { cwd: scratch, stdio: 'inherit' });
  const tgz = execSync('npm pack --dry-run --json ' + pkg + '@' + QJS_VERSION, { cwd: scratch }).toString();
  const filename = JSON.parse(tgz)[0].filename;
  const dir = join(scratch, pkg.replace('/', '-'));
  mkdirSync(dir, { recursive: true });
  execSync(`tar xf ${filename} -C ${dir}`, { cwd: scratch });
  return join(dir, 'package');
}

const wasmfile = pack('@jitl/quickjs-ng-wasmfile-release-sync');
const core = pack('quickjs-emscripten-core');
const ffitypes = pack('@jitl/quickjs-ffi-types');

// ---- wasm -> base64 module
const wasmBytes = readFileSync(join(wasmfile, 'dist', 'emscripten-module.wasm'));
writeFileSync(join(VM, 'quickjs-ng-wasm.b64.mjs'),
  `// Vendored quickjs-ng WASM binary (base64), embedded for zero-fetch hermetic load.\n` +
  `// Source: @jitl/quickjs-ng-wasmfile-release-sync@${QJS_VERSION} dist/emscripten-module.wasm (MIT, justjake/quickjs-emscripten)\n` +
  `// Regenerate: node chaingraph/vm/scripts/vendor-quickjs.mjs\n` +
  `export const QUICKJS_NG_WASM_B64 = "${wasmBytes.toString('base64')}";\n`);

// ---- emscripten glue + ffi (unmodified; wasmBinary option makes the fetch fallbacks dead code)
cpSync(join(wasmfile, 'dist', 'emscripten-module.browser.mjs'), join(VM, 'emscripten-module.mjs'));
cpSync(join(wasmfile, 'dist', 'ffi.mjs'), join(VM, 'ffi.mjs'));
cpSync(join(wasmfile, 'LICENSE'), join(VM, 'QUICKJS-LICENSE'));

// ---- core (pure JS, no wasm) + ffi-types, with the one bare specifier rewritten to relative
mkdirSync(join(VM, 'core'), { recursive: true });
for (const f of ['index.mjs', 'chunk-TAV5CUKK.mjs', 'chunk-V2S4ZYJR.mjs', 'module-ES6BEMUI.mjs']) {
  const src = readFileSync(join(core, 'dist', f), 'utf8')
    .replaceAll('@jitl/quickjs-ffi-types', './quickjs-ffi-types.mjs');
  writeFileSync(join(VM, 'core', f), src);
}
cpSync(join(core, 'LICENSE'), join(VM, 'core', 'LICENSE'));
cpSync(join(ffitypes, 'dist', 'index.mjs'), join(VM, 'core', 'quickjs-ffi-types.mjs'));

rmSync(scratch, { recursive: true, force: true });
console.log('done. Re-run the smoke test: node chaingraph/vm/scripts/smoke.mjs');
console.log('If chunk filenames changed (they are content-hashed by esbuild upstream), update');
console.log('chaingraph/vm/variant.mjs, chaingraph/vm/kernel-vm.mjs, and both widget generators.');
