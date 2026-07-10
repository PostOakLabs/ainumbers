import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
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

const SOURCES = Object.fromEntries(DEMO_KERNELS.map((id) => {
  const src = readFileSync(`${ROOT}/chaingraph/kernels/${id}.kernel.mjs`, 'utf8');
  return [id, src];
}));

const KERNEL_META = {
  '503-canton-tokenization-readiness-diagnostic': { label: 'Canton Tokenization Readiness Diagnostic', mcp_name: 'diagnose_canton_readiness' },
  '508-repo-haircut-collateral-calculator': { label: 'Repo Haircut Collateral Calculator', mcp_name: 'calculate_repo_haircut' },
  '509-canton-party-allowlist-validator': { label: 'Canton Party Allowlist Validator', mcp_name: 'validate_canton_party_allowlist' },
  '507-canton-dvp-atomicity-validator': { label: 'Canton DvP Atomicity Validator', mcp_name: 'validate_canton_dvp_atomicity' },
};

const DEMO_DATA_JS = `const DEMO_KERNELS = ${JSON.stringify(DEMO_KERNELS, null, 2)};
const KERNEL_META = ${JSON.stringify(KERNEL_META, null, 2)};
const KERNEL_SOURCES = ${JSON.stringify(SOURCES, null, 2)};
const KERNEL_FIXTURES = ${JSON.stringify(FIXTURES, null, 2)};
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' blob: 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<title>Kernel VM &middot; OpenChainGraph &middot; AINumbers.co</title>
<meta name="description" content="Run a ChainGraph decision kernel's compute(policy_parameters) inside a sandboxed, deterministic, in-browser QuickJS-ng VM under the ocg-deterministic-compute@2 profile, and compare its execution_hash against the worker.">
<link rel="canonical" href="https://ainumbers.co/chaingraph/kernel-vm.html">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23080E1A'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='Sora,sans-serif' font-weight='600' font-size='13' fill='%2314B8A6'>AI</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Sora:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"TechArticle","headline":"Kernel VM","description":"Run a ChainGraph decision kernel inside a sandboxed, deterministic, in-browser QuickJS-ng WebAssembly VM.","publisher":{"@type":"Organization","name":"Post Oak Labs"}}
</script>
<style>
:root{--bg:#080E1A;--bg-2:#0D1627;--bg-3:#111E35;--border:#1E2F4A;--border-2:#263855;--muted:#3A5270;--body:#6888A8;--text:#A8C4DE;--bright:#D4E8F8;--white:#EEF6FD;--teal:#14B8A6;--teal-lt:#2DD4BF;--gold:#D4A847;--green:#22C55E;--red:#EF4444;--warn:#F59E0B;--radius:6px;--radius-lg:10px}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Sora',system-ui,sans-serif;font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--teal-lt);text-decoration:none}
.wrap{max-width:980px;margin:0 auto;padding:24px 20px 80px}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--teal);margin:18px 0 8px}
h1{font-size:1.6rem;color:var(--white);margin-bottom:8px;font-weight:600;font-family:'DM Serif Display',serif}
.sub{color:var(--body);max-width:700px;margin-bottom:8px}
.pii-notice{font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--muted);background:var(--bg-3);border:1px solid var(--border);border-left:3px solid var(--teal);border-radius:4px;padding:.5rem .85rem;line-height:1.5;margin:12px 0}
.cross-link{font-family:'JetBrains Mono',monospace;font-size:.66rem;color:var(--body);background:var(--bg-3);border:1px solid var(--border);border-left:3px solid var(--gold);border-radius:4px;padding:.6rem .85rem;line-height:1.6;margin:12px 0}
.cross-link a{color:var(--gold)}
.card{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px;margin:16px 0}
.section-head{font-size:.78rem;color:var(--bright);margin:16px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)}
.q-label{font-family:'JetBrains Mono',monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--teal);margin-bottom:.4rem;display:block}
select,textarea{width:100%;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);color:var(--bright);font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:.6rem .7rem;outline:none}
select:focus,textarea:focus{border-color:var(--teal)}
textarea{min-height:180px;resize:vertical}
button{font-family:'JetBrains Mono',monospace;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;background:var(--teal);color:#06121f;border:none;border-radius:var(--radius);padding:.6rem 1.2rem;cursor:pointer;font-weight:600;margin-top:10px}
button:hover{opacity:.9}
button:disabled{opacity:.35;cursor:not-allowed}
.results-panel{display:none;margin-top:16px}
.results-panel.show{display:block}
.stat-row{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0}
.stat{background:var(--bg-3);border:1px solid var(--border);border-radius:var(--radius);padding:8px 14px;font-family:'JetBrains Mono',monospace;font-size:.7rem;text-align:center;min-width:120px}
.stat-val{font-size:1rem;color:var(--bright);font-weight:600;display:block;word-break:break-all}
.stat-key{font-size:.58rem;color:var(--muted);letter-spacing:.08em;text-transform:uppercase}
.badge{font-family:'JetBrains Mono',monospace;font-size:.62rem;padding:.2rem .55rem;border-radius:10px;display:inline-block}
.badge.ok{background:rgba(34,197,94,.08);color:var(--green);border:1px solid rgba(34,197,94,.2)}
.badge.fail{background:rgba(239,68,68,.08);color:var(--red);border:1px solid rgba(239,68,68,.2)}
pre{background:#06101e;border:1px solid var(--border);border-radius:var(--radius);padding:12px;overflow-x:auto;font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--text);margin-top:10px;max-height:420px}
.hash{font-family:'JetBrains Mono',monospace;font-size:.64rem;color:var(--teal-lt);word-break:break-all;margin:6px 0}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--border);font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--muted)}
</style>
</head>
<body>
<div class="wrap">
<div class="eyebrow">OpenChainGraph &middot; VM-1b</div>
<h1>Kernel VM</h1>
<p class="sub">Runs a ChainGraph decision kernel's <code>compute(policy_parameters)</code> inside a sandboxed, hermetic, in-browser QuickJS-ng WebAssembly VM under the <code>ocg-deterministic-compute@2</code> profile (SPEC.md &sect;24). The VM is a fifth compute surface beside the worker, embed bundle, composer, and zkVM guest: this page runs the SAME kernel source twice, once in this VM and once natively in your browser's JavaScript engine, and shows whether the two <code>execution_hash</code> values agree.</p>
<div class="pii-notice">🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.</div>
<div class="cross-link">This page ships a small curated set of kernels for direct exploration. Every conformance-fixtured <code>gpu:false</code> kernel is checked automatically in CI by <code>chaingraph/kernels/vm-parity-gate.mjs</code>. See also the <a href="./boundary-explorer.html">decision boundary explorer</a>, which sweeps a kernel's inputs the same way the worker does.</p></div>

<div class="card">
<div class="section-head">1. Choose a kernel</div>
<label class="q-label">Kernel</label>
<select id="kernelSelect"></select>
<label class="q-label" style="margin-top:14px">policy_parameters (JSON)</label>
<textarea id="ppInput" spellcheck="false"></textarea>
<button id="runBtn" type="button">Run in kernel VM</button>
<span id="status" style="margin-left:10px;font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--muted)"></span>
</div>

<div class="card results-panel" id="results">
<div class="section-head">2. Result</div>
<div class="stat-row">
  <div class="stat"><span class="stat-val" id="parityBadge">-</span><span class="stat-key">VM &harr; browser-native parity</span></div>
  <div class="stat"><span class="stat-val" id="elapsedMs">-</span><span class="stat-key">VM elapsed ms</span></div>
</div>
<div class="q-label" style="margin-top:10px">execution_hash &mdash; run in the VM</div>
<div class="hash" id="vmHash">-</div>
<div class="q-label">execution_hash &mdash; run natively in this browser tab (not the worker; see below)</div>
<div class="hash" id="nativeHash">-</div>
<div class="cross-link" style="margin-top:10px">"Browser-native" here means this same JavaScript engine (V8/SpiderMonkey/whatever renders this page), evaluated via a real ESM <code>import()</code> of the SAME kernel source with no sandbox. It is a same-tab parity check, not a live call to the Cloudflare Worker (this page makes zero network calls). The CI gate additionally diffs the VM against the worker's own kernel registry on every push.</div>
<div class="q-label" style="margin-top:10px">output_payload</div>
<pre id="outputPayload"></pre>
</div>

<footer>
Vendors <a href="https://github.com/justjake/quickjs-emscripten" target="_blank" rel="noopener">quickjs-emscripten-core</a> +
a base64-embedded <a href="https://github.com/quickjs-ng/quickjs" target="_blank" rel="noopener">QuickJS-ng</a> WebAssembly binary (MIT). Zero-fetch: the wasm ships inline in <code>chaingraph/vm/quickjs-ng-wasm.b64.mjs</code>, no CDN, no network call after page load. Phase VM-1b: a custom guest-pinned build of quickjs-ng v0.15.1 (the exact revision in the SPEC.md &sect;18 zkVM guest), with the deterministic WebCrypto subset (&sect;24.5) and full native BigInt bridged in.
</footer>
</div>

<script type="module">
${DEMO_DATA_JS}
import { runKernelInVM } from './vm/kernel-vm.mjs';

const sel = document.getElementById('kernelSelect');
const ppInput = document.getElementById('ppInput');
const runBtn = document.getElementById('runBtn');
const statusEl = document.getElementById('status');
const results = document.getElementById('results');

for (const id of DEMO_KERNELS) {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = \`\${id} \\u2014 \${KERNEL_META[id].label} (\${KERNEL_META[id].mcp_name})\`;
  sel.appendChild(opt);
}

function loadDefaults() {
  const id = sel.value;
  ppInput.value = JSON.stringify(KERNEL_FIXTURES[id], null, 2);
}
sel.addEventListener('change', loadDefaults);
loadDefaults();

// Compute a browser-native execution_hash the same way _hash.mjs does (RFC 8785 / JCS
// canonicalization over {policy_parameters, output_payload}), inlined here because this
// page makes zero network/module-fetch calls to the kernels/ directory beyond vm/ itself.
function cgCanon(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('non-finite number in payload');
      return JSON.stringify(value);
    }
    return JSON.stringify(value);
  }
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
  const preimage = cgCanon({ policy_parameters, output_payload });
  const bytes = new TextEncoder().encode(preimage);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function runNative(id, pp) {
  // A blob: URL has no meaningful relative base, so the kernel's own
  // "import { executionHash } from './_hash.mjs'" can't resolve here; strip it,
  // exactly as the VM harness does (compute() never calls executionHash itself).
  const stripped = KERNEL_SOURCES[id].replace(/^import\\s+.*$/gm, '');
  const blob = new Blob([stripped], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    const mod = await import(/* webpackIgnore: true */ url);
    return mod.compute(pp);
  } finally {
    URL.revokeObjectURL(url);
  }
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
    statusEl.textContent = 'running natively for comparison...';
    const nativeResult = await runNative(id, pp);

    const vmHash = await executionHashLocal(pp, vmResult.output_payload);
    // vmResult.output_payload is the FULL return of compute() (runKernelInVM wraps it in
    // {output_payload, elapsed_ms}); nativeResult IS compute()'s return already -- both
    // sides must hash the identical shape or this "parity" check is comparing apples to
    // oranges, not the VM.
    const nativeHash = await executionHashLocal(pp, nativeResult);

    document.getElementById('vmHash').textContent = vmHash;
    document.getElementById('nativeHash').textContent = nativeHash;
    document.getElementById('elapsedMs').textContent = vmResult.elapsed_ms.toFixed(2);
    document.getElementById('outputPayload').textContent = JSON.stringify(vmResult.output_payload, null, 2);

    const badge = document.getElementById('parityBadge');
    if (vmHash === nativeHash) { badge.textContent = 'MATCH'; badge.style.color = 'var(--green)'; }
    else { badge.textContent = 'DIVERGENCE'; badge.style.color = 'var(--red)'; }

    results.classList.add('show');
    statusEl.textContent = '';
  } catch (e) {
    statusEl.textContent = \`error: \${e.message}\`;
  } finally {
    runBtn.disabled = false;
  }
});
</script>
</body>
</html>
`;

writeFileSync(`${ROOT}/chaingraph/kernel-vm.html`, html);
console.log('wrote', html.length, 'chars');
