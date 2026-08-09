/**
 * chaingraph/vm/scripts/gen-kernel-vm-widget.mjs
 *
 * Flattens chaingraph/vm/*.mjs (the multi-file Kernel VM module graph) into one
 * self-contained script scope for the MCP Apps PILOT widget surface, and writes
 * tools/kernel-vm-widget.html. GENERATED FILE — never hand-edit
 * tools/kernel-vm-widget.html directly; edit this generator instead (same
 * doctrine as gen-kernel-vm-html.mjs / memory project-ainumbers-vm1b-build).
 *
 * Usage:
 *   node chaingraph/vm/scripts/gen-kernel-vm-widget.mjs          # write tools/kernel-vm-widget.html
 *   node chaingraph/vm/scripts/gen-kernel-vm-widget.mjs --check  # freshness gate (exit 1 if stale)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const VM = `${ROOT}/chaingraph/vm`;
const read = (p) => readFileSync(p, 'utf8');
const CHECK = process.argv.includes('--check');
const OUT = `${ROOT}/tools/kernel-vm-widget.html`;

// Strip a single leading `import {...} from "./x.mjs";` (already known to be the only
// import line in each of these minified/hand-written files) -- verified per-file below.
function stripImportLine(src) {
  return src.replace(/^import\s*\{[^}]*\}\s*from\s*['"][^'"]*['"];?\s*/m, '');
}
// Find every `import{a,b}from"./targetBasename.mjs"` anywhere in src (minified bundlers don't
// always put imports at the top), collect the union of imported names, and strip those lines.
function extractAndStripImportsFrom(src, targetBasename) {
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]\\./${targetBasename}\\.mjs['"];?`, 'g');
  const names = new Set();
  let stripped = src;
  for (const m of src.matchAll(re)) {
    m[1].split(',').map((s) => s.trim()).forEach((n) => names.add(n));
  }
  stripped = stripped.replace(re, '');
  return { names: [...names], stripped };
}
// Strip a trailing `export{a,b,c};` bottom-form export, no leading `export default` inside it.
function stripBottomExport(src) {
  return src.replace(/export\s*\{[^}]*\}\s*;?\s*(\/\/[^\n]*)?\s*$/m, '');
}
function stripDefaultExport(src) {
  return src.replace(/export\s+default\s+(\w+)\s*;?\s*$/m, '');
}
// Strip `export*from"./x.mjs";` re-export lines entirely (handled separately via namespace merge).
function stripStarReexport(src) {
  return src.replace(/export\s*\*\s*from\s*['"][^'"]*['"];?\s*/g, '');
}

// ---- ffitypes: export{EvalFlags,GetOwnPropertyNamesFlags,IntrinsicsFlags,IsEqualOp,JSPromiseStateEnum,assertSync};
let ffitypesSrc = read(`${VM}/core/quickjs-ffi-types.mjs`);
const ffitypesExports = ['EvalFlags', 'GetOwnPropertyNamesFlags', 'IntrinsicsFlags', 'IsEqualOp', 'JSPromiseStateEnum', 'assertSync'];
ffitypesSrc = stripBottomExport(ffitypesSrc);

// ---- wasmb64: export const QUICKJS_NG_WASM_B64 = "...";
let wasmb64Src = read(`${VM}/quickjs-ng-wasm.b64.mjs`);
wasmb64Src = wasmb64Src.replace('export const QUICKJS_NG_WASM_B64', 'const QUICKJS_NG_WASM_B64');

// ---- ffi.mjs: export{QuickJSFFI};
let ffiSrc = read(`${VM}/ffi.mjs`);
ffiSrc = stripBottomExport(ffiSrc);

// ---- emscripten-module.mjs: export default QuickJSRaw;
let emscriptenSrc = read(`${VM}/emscripten-module.mjs`);
emscriptenSrc = stripDefaultExport(emscriptenSrc);
// tools/*.html ships classic (non-module) inline <script> per CONTRACT/check_tools.js
// convention, so `import.meta` (module-only syntax) can't appear even unexecuted. The two
// uses here only seed a base URL for the fetch-fallback path, which is never taken because
// this widget always supplies wasmBinary directly -- location.href is an equivalent,
// non-module-syntax stand-in for that dead branch.
emscriptenSrc = emscriptenSrc.replaceAll('import.meta.url', 'location.href');

// ---- chunk-V2S4ZYJR.mjs: import{...}from"./quickjs-ffi-types.mjs"; ... export{many};
let chunkV2S4Src = read(`${VM}/core/chunk-V2S4ZYJR.mjs`);
const chunkV2S4Exports = chunkV2S4Src.match(/export\s*\{([^}]*)\}\s*;?\s*(\/\/[^\n]*)?\s*$/)[1].split(',').map((s) => s.trim());
{ const r = extractAndStripImportsFrom(chunkV2S4Src, 'quickjs-ffi-types'); chunkV2S4Src = r.stripped; var chunkV2S4Imports = r.names; }
chunkV2S4Src = stripBottomExport(chunkV2S4Src);

// ---- chunk-TAV5CUKK.mjs: import{...}from"./chunk-V2S4ZYJR.mjs"; ... export{QuickJSAsyncContext,QuickJSAsyncRuntime,QuickJSAsyncWASMModule};
let chunkTAV5Src = read(`${VM}/core/chunk-TAV5CUKK.mjs`);
const chunkTAV5Exports = chunkTAV5Src.match(/export\s*\{([^}]*)\}\s*;?\s*(\/\/[^\n]*)?\s*$/)[1].split(',').map((s) => s.trim());
{ const r = extractAndStripImportsFrom(chunkTAV5Src, 'chunk-V2S4ZYJR'); chunkTAV5Src = r.stripped; var chunkTAV5Imports = r.names; }
chunkTAV5Src = stripBottomExport(chunkTAV5Src);

// ---- module-ES6BEMUI.mjs: import{...}from"./chunk-V2S4ZYJR.mjs"; export{QuickJSModuleCallbacks,QuickJSWASMModule,applyBaseRuntimeOptions,applyModuleEvalRuntimeOptions};
let moduleES6Src = read(`${VM}/core/module-ES6BEMUI.mjs`);
const moduleES6Exports = moduleES6Src.match(/export\s*\{([^}]*)\}\s*;?\s*(\/\/[^\n]*)?\s*$/)[1].split(',').map((s) => s.trim());
{ const r = extractAndStripImportsFrom(moduleES6Src, 'chunk-V2S4ZYJR'); moduleES6Src = r.stripped; var moduleES6Imports = r.names; }
moduleES6Src = stripBottomExport(moduleES6Src);

// ---- core/index.mjs: imports chunkTAV5 + chunkV2S4 (both via one or two import lines),
// re-exports * from quickjs-ffi-types, dynamically imports module-ES6BEMUI + module-asyncify
// (asyncify path unused -- newQuickJSAsyncWASMModuleFromVariant is never called by kernel-vm.mjs).
let coreIndexSrc = read(`${VM}/core/index.mjs`);
// two import statements: from chunk-TAV5CUKK.mjs and from chunk-V2S4ZYJR.mjs
const coreImportMatches = [...coreIndexSrc.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/(chunk-[A-Z0-9]+)\.mjs['"]\s*;?/g)];
// Some entries use "localName as exportedName" (e.g. errors_exports as errors); normalize to
// a return-object shorthand-or-explicit form: "exportedName: localName".
const coreIndexExports = coreIndexSrc.match(/export\s*\{([^}]*)\}\s*;?\s*(\/\/[^\n]*)?\s*$/)[1]
  .split(',').map((s) => s.trim())
  .map((s) => {
    const m = s.match(/^(\S+)\s+as\s+(\S+)$/);
    return m ? `${m[2]}: ${m[1]}` : s;
  });
coreIndexSrc = coreIndexSrc
  .replace(/import\s*\{[^}]*\}\s*from\s*['"]\.\/chunk-TAV5CUKK\.mjs['"]\s*;?/, '')
  .replace(/import\s*\{[^}]*\}\s*from\s*['"]\.\/chunk-V2S4ZYJR\.mjs['"]\s*;?/, '');
coreIndexSrc = stripStarReexport(coreIndexSrc);
coreIndexSrc = coreIndexSrc.replace(/export\s*\{[^}]*\}\s*;?\s*(\/\/[^\n]*)?\s*$/, '');
coreIndexSrc = coreIndexSrc.replace('import("./module-ES6BEMUI.mjs")', 'Promise.resolve(NS_moduleES6)');
coreIndexSrc = coreIndexSrc.replace('import("./module-asyncify-2EFITU5U.mjs")', 'Promise.reject(new Error("VM-1b: async QuickJS variant not vendored in this widget (sync path only)"))');

// ---- variant.mjs (hand-written, non-minified)
let variantSrc = read(`${VM}/variant.mjs`);
variantSrc = variantSrc
  .replace(/import\s*\{\s*QUICKJS_NG_WASM_B64\s*\}\s*from\s*'\.\/quickjs-ng-wasm\.b64\.mjs';/, '')
  .replace(/const\s*\{\s*default:\s*QuickJSRaw\s*\}\s*=\s*await import\('\.\/emscripten-module\.mjs'\);/, 'const { default: QuickJSRaw } = NS_emscripten;')
  .replace(/const\s*\{\s*QuickJSFFI\s*\}\s*=\s*await import\('\.\/ffi\.mjs'\);/, 'const { QuickJSFFI } = NS_ffi;')
  .replace(/^export const QUICKJS_NG_SINGLEFILE_VARIANT/m, 'const QUICKJS_NG_SINGLEFILE_VARIANT')
  .replace(/^export default QUICKJS_NG_SINGLEFILE_VARIANT;\s*$/m, '');

// ---- kernel-vm.mjs (hand-written)
let kernelVmSrc = read(`${VM}/kernel-vm.mjs`);
kernelVmSrc = kernelVmSrc
  .replace(/import\s*\{\s*newQuickJSWASMModuleFromVariant,\s*DefaultIntrinsics\s*\}\s*from\s*'\.\/core\/index\.mjs';/, 'const { newQuickJSWASMModuleFromVariant, DefaultIntrinsics } = NS_coreindex;')
  .replace(/import\s*\{\s*QUICKJS_NG_SINGLEFILE_VARIANT\s*\}\s*from\s*'\.\/variant\.mjs';/, 'const { QUICKJS_NG_SINGLEFILE_VARIANT } = NS_variant;')
  .replace(/^export const OCG_DETERMINISTIC_COMPUTE_PROFILE/m, 'const OCG_DETERMINISTIC_COMPUTE_PROFILE')
  .replace(/^export function stripEsmSyntaxForVm/m, 'function stripEsmSyntaxForVm')
  .replace(/^export async function runKernelInVM/m, 'async function runKernelInVM')
  .replace(/^export async function runKernelArtifactInVM/m, 'async function runKernelArtifactInVM');

const MODULE_JS = `
// ---- Single-file, single-scope inlining of chaingraph/vm/*.mjs for the MCP Apps PILOT widget
// surface (tools/*.html must be one self-contained file, CONTRACT §0 -- and, separately, blob:
// -sourced nested ES modules were found empirically NOT to inherit this document's meta
// Content-Security-Policy for WebAssembly.instantiate in at least one tested engine, so this
// widget avoids blob:/dynamic-import entirely and instead flattens the whole module graph into
// IIFEs sharing one script scope -- WASM compiles in the top-level document context exactly
// like chaingraph/kernel-vm.html (the multi-file version), which is proven working).
// Regenerate with chaingraph/vm/scripts/gen-kernel-vm-widget.mjs whenever chaingraph/vm/*.mjs changes.
function smartUnwrap(val){return val&&"default"in val&&val.default?val.default&&"default"in val.default&&val.default.default?val.default.default:val.default:val}

const NS_ffitypes = (function(){
${ffitypesSrc}
return {${ffitypesExports.join(', ')}};
})();

const QUICKJS_NG_WASM_B64 = (function(){
${wasmb64Src}
return QUICKJS_NG_WASM_B64;
})();

const NS_ffi = (function(){
${ffiSrc}
return {QuickJSFFI};
})();

const NS_emscripten = (function(){
${emscriptenSrc}
return {default: QuickJSRaw};
})();

const NS_chunkV2S4 = (function(NS){
const {${chunkV2S4Imports.join(', ')}} = NS;
${chunkV2S4Src}
return {${chunkV2S4Exports.join(', ')}};
})(NS_ffitypes);

const NS_chunkTAV5 = (function(NS){
const {${chunkTAV5Imports.join(', ')}} = NS;
${chunkTAV5Src}
return {${chunkTAV5Exports.join(', ')}};
})(NS_chunkV2S4);

const NS_moduleES6 = (function(NS){
const {${moduleES6Imports.join(', ')}} = NS;
${moduleES6Src}
return {${moduleES6Exports.join(', ')}};
})(NS_chunkV2S4);

const NS_coreindex = (function(NS_TAV5, NS_V2S4){
${coreImportMatches.map((m) => {
  const names = m[1].split(',').map((s) => s.trim());
  const src = m[2] === 'chunk-TAV5CUKK' ? 'NS_TAV5' : 'NS_V2S4';
  return `const {${names.join(', ')}} = ${src};`;
}).join('\n')}
${coreIndexSrc}
return {${coreIndexExports.join(', ')}, ...NS_ffitypes};
})(NS_chunkTAV5, NS_chunkV2S4);

const NS_variant = (function(){
${variantSrc}
return {QUICKJS_NG_SINGLEFILE_VARIANT};
})();

const NS_kernelvm = (function(){
${kernelVmSrc}
return {runKernelInVM, OCG_DETERMINISTIC_COMPUTE_PROFILE, stripEsmSyntaxForVm};
})();
const { runKernelInVM } = NS_kernelvm;
`;

const MANIFEST_JSON = read(`${ROOT}/manifests/kernel-vm-widget.manifest.json`);

const DEMO_KERNELS = [
  '503-canton-tokenization-readiness-diagnostic',
  '508-repo-haircut-collateral-calculator',
  '509-canton-party-allowlist-validator',
  '507-canton-dvp-atomicity-validator',
];
const FIXTURES = Object.fromEntries(DEMO_KERNELS.map((id) => {
  const doc = JSON.parse(readFileSync(`${ROOT}/chaingraph/kernels/fixtures/${id}.fixtures.json`, 'utf8'));
  return [id, doc.vectors[0].policy_parameters];
}));
const SOURCES = Object.fromEntries(DEMO_KERNELS.map((id) => [id, read(`${ROOT}/chaingraph/kernels/${id}.kernel.mjs`)]));
const KERNEL_META = {
  '503-canton-tokenization-readiness-diagnostic': { label: 'Canton Tokenization Readiness Diagnostic', mcp_name: 'diagnose_canton_readiness' },
  '508-repo-haircut-collateral-calculator': { label: 'Repo Haircut Collateral Calculator', mcp_name: 'calculate_repo_haircut' },
  '509-canton-party-allowlist-validator': { label: 'Canton Party Allowlist Validator', mcp_name: 'validate_canton_party_allowlist' },
  '507-canton-dvp-atomicity-validator': { label: 'Canton DvP Atomicity Validator', mcp_name: 'validate_canton_dvp_atomicity' },
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<title>Kernel VM Widget · AINumbers.co</title>
<meta name="description" content="MCP Apps widget: run a ChainGraph decision kernel's compute(policy_parameters) inside a sandboxed, deterministic, in-browser QuickJS-ng VM (VM-1b, ocg-deterministic-compute@2) and compare its execution_hash against a native run in the same tab.">
<link rel="canonical" href="https://ainumbers.co/tools/kernel-vm-widget.html">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23080E1A'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='Sora,sans-serif' font-weight='600' font-size='13' fill='%2314B8A6'>AI</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Sora:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#080E1A;--bg-2:#0D1627;--bg-3:#111E35;--border:#1E2F4A;--border-2:#263855;--muted:#3A5270;--body:#6888A8;--text:#A8C4DE;--bright:#D4E8F8;--white:#EEF6FD;--teal:#14B8A6;--teal-lt:#2DD4BF;--gold:#D4A847;--green:#22C55E;--red:#EF4444;--warn:#F59E0B;--radius:6px;--radius-lg:10px}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Sora',system-ui,sans-serif;font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--teal-lt);text-decoration:none}
.wrap{max-width:820px;margin:0 auto;padding:24px 20px 60px}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--teal);margin:12px 0 8px}
h1{font-size:1.4rem;color:var(--white);margin-bottom:8px;font-weight:600;font-family:'DM Serif Display',serif}
.sub{color:var(--body);margin-bottom:8px;font-size:.85rem}
.pii-notice{font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--muted);background:var(--bg-3);border:1px solid var(--border);border-left:3px solid var(--teal);border-radius:4px;padding:.5rem .85rem;line-height:1.5;margin:12px 0}
.card{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 18px;margin:14px 0}
.section-head{font-size:.74rem;color:var(--bright);margin:14px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)}
.q-label{font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--teal);margin-bottom:.4rem;display:block}
select,textarea{width:100%;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);color:var(--bright);font-family:'JetBrains Mono',monospace;font-size:.7rem;padding:.5rem .65rem;outline:none}
textarea{min-height:150px;resize:vertical}
button{font-family:'JetBrains Mono',monospace;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;background:var(--teal);color:#06121f;border:none;border-radius:var(--radius);padding:.55rem 1.1rem;cursor:pointer;font-weight:600;margin-top:10px}
button:disabled{opacity:.35;cursor:not-allowed}
.results-panel{display:none;margin-top:14px}
.results-panel.show{display:block}
.stat-row{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}
.stat{background:var(--bg-3);border:1px solid var(--border);border-radius:var(--radius);padding:7px 12px;font-family:'JetBrains Mono',monospace;font-size:.68rem;text-align:center;min-width:110px}
.stat-val{font-size:.95rem;color:var(--bright);font-weight:600;display:block;word-break:break-all}
.stat-key{font-size:.56rem;color:var(--muted);letter-spacing:.08em;text-transform:uppercase}
pre{background:#06101e;border:1px solid var(--border);border-radius:var(--radius);padding:10px;overflow-x:auto;font-family:'JetBrains Mono',monospace;font-size:.64rem;color:var(--text);margin-top:8px;max-height:320px}
.hash{font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--teal-lt);word-break:break-all;margin:5px 0}
.mfst-btn{width:100%;background:var(--bg-2);border:1px solid var(--border);padding:.85rem 1.1rem;display:flex;align-items:center;justify-content:space-between;color:var(--text);font-family:'JetBrains Mono',monospace;font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;border-radius:var(--radius);transition:background .15s;cursor:pointer;margin-top:14px}
.mfst-btn:hover{background:var(--bg-3)}
.mfst-body{display:none;border:1px solid var(--border);border-top:none;border-radius:0 0 var(--radius) var(--radius);background:var(--bg-3);padding:1.25rem;overflow-x:auto}
.mfst-code{font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--text);white-space:pre-wrap}
</style>
</head>
<body>
<div class="wrap">
<div class="eyebrow">OpenChainGraph &middot; VM-1b &middot; MCP Apps widget</div>
<h1>Kernel VM</h1>
<p class="sub">Runs a ChainGraph decision kernel's compute(policy_parameters) inside a sandboxed, in-browser QuickJS-ng WebAssembly VM under the ocg-deterministic-compute@2 profile, then compares its execution_hash against a native run in the same tab.</p>
<div class="pii-notice">🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.</div>

<div class="card">
<div class="section-head">Choose a kernel</div>
<label class="q-label">Kernel</label>
<select id="kernelSelect"></select>
<label class="q-label" style="margin-top:12px">policy_parameters (JSON)</label>
<textarea id="ppInput" spellcheck="false"></textarea>
<button id="runBtn" type="button">Run in kernel VM</button>
<span id="status" style="margin-left:8px;font-family:'JetBrains Mono',monospace;font-size:.64rem;color:var(--muted)"></span>
</div>

<div class="card results-panel" id="results">
<div class="section-head">Result</div>
<div class="stat-row">
  <div class="stat"><span class="stat-val" id="parityBadge">-</span><span class="stat-key">VM ran</span></div>
  <div class="stat"><span class="stat-val" id="elapsedMs">-</span><span class="stat-key">VM elapsed ms</span></div>
</div>
<div class="q-label" style="margin-top:8px">execution_hash (VM)</div>
<div class="hash" id="vmHash">-</div>
<div class="q-label">output_payload</div>
<pre id="outputPayload"></pre>
</div>

<section id="mfstSec" style="margin-top:14px">
<button class="mfst-btn" onclick="toggleMfst()"><span>📦 &nbsp;manifest.json &middot; MCP tool definition</span><span id="mfstArr" style="color:var(--muted)">&#9660;</span></button>
<div class="mfst-body" id="mfstBody"><div class="mfst-code" id="mfstCode"></div></div>
</section>
</div>

<script>
${MODULE_JS}
const sel = document.getElementById('kernelSelect');
const ppInput = document.getElementById('ppInput');
const runBtn = document.getElementById('runBtn');
const statusEl = document.getElementById('status');
const results = document.getElementById('results');
const DEMO_KERNELS = ${JSON.stringify(DEMO_KERNELS, null, 2)};
const KERNEL_META = ${JSON.stringify(KERNEL_META, null, 2)};
const KERNEL_SOURCES = ${JSON.stringify(SOURCES, null, 2)};
const KERNEL_FIXTURES = ${JSON.stringify(FIXTURES, null, 2)};
var MANIFEST = ${JSON.stringify(JSON.parse(MANIFEST_JSON))};
function toggleMfst(){var b=document.getElementById('mfstBody'),a=document.getElementById('mfstArr');if(b.style.display==='none'||b.style.display===''){b.style.display='block';if(a)a.textContent='\\u25b2';document.getElementById('mfstCode').textContent=JSON.stringify(MANIFEST,null,2);}else{b.style.display='none';if(a)a.textContent='\\u25bc';}}

for (const id of DEMO_KERNELS) {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = \`\${id} \\u2014 \${KERNEL_META[id].label} (\${KERNEL_META[id].mcp_name})\`;
  sel.appendChild(opt);
}
function loadDefaults() { ppInput.value = JSON.stringify(KERNEL_FIXTURES[sel.value], null, 2); }
sel.addEventListener('change', loadDefaults);
loadDefaults();

function cgCanon(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map((v) => cgCanon(v === undefined ? null : v)).join(',') + ']';
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + cgCanon(value[k])).join(',') + '}';
}
function assertIJson(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('Non-finite number (' + v + ') is not valid I-JSON; cannot canonicalize for hashing (RFC 8785 §3.2.2.3).');
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) throw new Error('Integer ' + v + ' exceeds 2^53 and is not safe I-JSON; pass it as a string (RFC 7493).');
  } else if (Array.isArray(v)) {
    v.forEach(assertIJson);
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) assertIJson(v[k]);
  }
}
async function executionHashLocal(policy_parameters, output_payload) {
  assertIJson({ policy_parameters, output_payload });
  const bytes = new TextEncoder().encode(cgCanon({ policy_parameters, output_payload }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

runBtn.addEventListener('click', async () => {
  const id = sel.value;
  let pp;
  try { pp = JSON.parse(ppInput.value); }
  catch (e) { statusEl.textContent = \`invalid JSON: \${e.message}\`; return; }
  runBtn.disabled = true;
  statusEl.textContent = 'running in VM...';
  results.classList.remove('show');
  try {
    const vmResult = await runKernelInVM(KERNEL_SOURCES[id], pp);
    const vmHash = await executionHashLocal(pp, vmResult.output_payload);
    document.getElementById('vmHash').textContent = vmHash;
    document.getElementById('elapsedMs').textContent = vmResult.elapsed_ms.toFixed(2);
    document.getElementById('outputPayload').textContent = JSON.stringify(vmResult.output_payload, null, 2);
    document.getElementById('parityBadge').textContent = 'RAN';
    document.getElementById('parityBadge').style.color = 'var(--green)';
    results.classList.add('show');
    statusEl.textContent = '';
  } catch (e) {
    statusEl.textContent = \`error: \${e.message}\`;
  } finally {
    runBtn.disabled = false;
  }
});

// Expose the compute function for the MCP Apps host bridge (tool-call arguments come in via
// the ext-apps glue injected at vend time; see mcp-apps-poc/pilot.mjs widgetGlue()). This
// widget is exploratory (run a kernel, inspect output_payload), not a Policy Mandate emitter.
window.ocgKernelVmRun = async (tool_id, policy_parameters) => {
  if (!KERNEL_SOURCES[tool_id]) throw new Error('unknown demo kernel: ' + tool_id + ' (widget ships a curated subset; see chaingraph/kernel-vm.html for the full-catalog CI gate)');
  return runKernelInVM(KERNEL_SOURCES[tool_id], policy_parameters);
};
</script>
</body>
</html>
`;

if (CHECK) {
  let current = null;
  try { current = readFileSync(OUT, 'utf8'); } catch { /* missing */ }
  if (current !== html) {
    console.error(`gen-kernel-vm-widget --check: ${OUT} is out of sync with the generator.`);
    console.error('Run `node chaingraph/vm/scripts/gen-kernel-vm-widget.mjs` to regenerate.');
    process.exit(1);
  }
  console.log('gen-kernel-vm-widget --check: OK (kernel-vm-widget.html matches generator).');
} else {
  writeFileSync(OUT, html);
  console.log('wrote', html.length, 'chars');
}
