#!/usr/bin/env node
// add_proof_binding_nodes.mjs — v0.5 §16 rollout INJECTOR, Phase 2 (nodes + tools; not chains/).
// Idempotent, anchor-guarded, sentinel-bounded. Companion to add_proof_binding.mjs (Phase 1, chains).
// See WAVE-V0.5-MASS-ROLLOUT-SPEC.md.
//
// SCOPE: tools/ (flat) + chaingraph/ (flat, excluding chains/ and agentic-policy.html).
// These pages use DIVERSE artifact accessors (_artifact, _result, _lastArtifact, _ap2, etc.)
// so Phase 2 uses a universal __ocgGetArt() getter and a MutationObserver enable shim,
// rather than the Phase 1 array-inject pattern (which was chains-only).
//
// Per qualifying page (idempotent — re-running is a no-op once OCG-PROOF v1 is present):
//   1. INSERT spec_version:'0.5.0' after chaingraph_version:'0.4.0' (these pages have no spec_version)
//   2. Inject the OCG-PROOF v1 <script> immediately AFTER the OCG-CANON v1 </script>
//   3. Insert Sign + Verify buttons AFTER the detected OCG export button </button>
//      (detected in priority order: ap2ExportBtn → ap2Btn → exportBtn; skip if none found)
//   4. Inject the §16-UI <script> (nodes variant: __ocgGetArt + signArtifact + verifySignature +
//      MutationObserver enable shim) before </body>
//
// Note: Step 4 satisfies the verify-proof-surface.mjs wiring gate because document.getElementById('signArtifactBtn')
// contains the literal string 'signArtifactBtn' which the gate regex matches after stripping id= attributes.
//
// Usage:
//   node scripts/add_proof_binding_nodes.mjs --dry-run        report planned changes, write nothing
//   node scripts/add_proof_binding_nodes.mjs --limit 1        inject into the first qualifying page only
//   node scripts/add_proof_binding_nodes.mjs                  inject into all qualifying pages

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DRY = process.argv.includes('--dry-run');
const limIdx = process.argv.indexOf('--limit');
const LIMIT = limIdx > -1 ? parseInt(process.argv[limIdx + 1], 10) : Infinity;

// Pages excluded from Phase 2 (Phase 0 scope, custom runtime)
const PHASE2_EXCLUDES = new Set(['agentic-policy.html']);

// Phase 2 target dirs: tools/ (flat) + chaingraph/ (flat, not chains/)
function collectFiles() {
  const out = [];
  const toolsDir = join(ROOT, 'tools');
  if (existsSync(toolsDir)) {
    for (const f of readdirSync(toolsDir))
      if (f.endsWith('.html')) out.push(join(toolsDir, f));
  }
  const cgDir = join(ROOT, 'chaingraph');
  if (existsSync(cgDir)) {
    for (const f of readdirSync(cgDir)) {
      const p = join(cgDir, f);
      if (statSync(p).isFile() && f.endsWith('.html')) out.push(p);
    }
  }
  return out;
}

const PIN_PATH = join(ROOT, 'chaingraph', 'kernels', '_proof.inline.min.js');
if (!existsSync(PIN_PATH)) { console.error(`FATAL: pin not found: ${relative(ROOT, PIN_PATH)}`); process.exit(2); }
const PIN = readFileSync(PIN_PATH, 'utf8').trim();

// ── injected fragments ────────────────────────────────────────────────────────────────────────────
const PROOF_SCRIPT = `<script>\n${PIN}\n</script>`;

// Two button variants — chosen at injection time based on page's button style
const BUTTONS_GHOST =
`      <button class="btn btn-ghost" id="signArtifactBtn" onclick="signArtifact()" disabled>⬇ Sign artifact (Ed25519 · §16)</button>
      <button class="btn btn-ghost" id="verifySigBtn" onclick="verifySignature()">🔏 Verify signature (§16)</button>`;

const BUTTONS_STYLE =
`    <button id="signArtifactBtn" onclick="signArtifact()" disabled style="font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.45rem 1rem;background:var(--bg-3,#111E35);color:var(--text,#D4E8F8);border:1px solid var(--border,#203050);border-radius:var(--radius,6px);cursor:not-allowed;opacity:.55;transition:opacity .2s,border-color .2s;margin-top:.5rem;display:inline-block">⬇ Sign artifact (Ed25519 · §16)</button>
    <button id="verifySigBtn" onclick="verifySignature()" style="font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.45rem 1rem;background:var(--bg-3,#111E35);color:var(--text,#D4E8F8);border:1px solid var(--border,#203050);border-radius:var(--radius,6px);cursor:pointer;transition:opacity .2s,border-color .2s;margin-top:.5rem;display:inline-block">🔏 Verify signature (§16)</button>`;

// §16 UI script — nodes variant.
// __ocgGetArt() tries global variable names (diverse across ~70 node pages) then falls back to
// reading a pre/textarea element that many nodes populate after a run.
// MutationObserver IIFE enables signArtifactBtn when any recognized OCG export button is un-disabled.
const UI_SCRIPT_NODES =
`<script>
/* OCG-§16-UI v1 (nodes) — Sign + Verify + enable shim. DO NOT hand-edit; injected by scripts/add_proof_binding_nodes.mjs. */
function __ocgGetArt(){
  var cands=['_artifact','_result','_lastArtifact','lastArtifact','_ap2'];
  for(var i=0;i<cands.length;i++){var v=window[cands[i]];if(v&&typeof v==='object'&&v.chaingraph_version)return v;}
  var el=document.getElementById('exportPre')||document.getElementById('exportOutput')||document.getElementById('chainOutput');
  if(el){var t=el.value||el.textContent;try{var vv=JSON.parse(t);if(vv&&vv.chaingraph_version)return vv;}catch(e){}}
  return null;
}
async function signArtifact(){
  var art=__ocgGetArt();
  if(!art){alert('Run the tool first to generate an artifact (no §4 execution_hash found).');return;}
  if(!confirm('Signing binds this run to a one-time key and de-anonymizes it (OCG §16.2). Continue?'))return;
  var kp=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
  var did=await __ocgDidKeyFromPub(kp.publicKey);
  var signed=await __ocgSign(art,{verificationMethod:did,created:art.generated_at||new Date().toISOString(),privateKey:kp.privateKey});
  var ts=new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14);
  var fn=(art.tool_id||'artifact')+'_'+ts+'.signed.json';
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(signed,null,2)],{type:'application/json'}));
  a.download=fn;a.click();URL.revokeObjectURL(a.href);
}
async function verifySignature(){
  var t=window.prompt('Paste a signed OCG artifact JSON to verify its §16 signature:');if(!t)return;
  var art;try{art=JSON.parse(t);}catch(e){alert('✗ not valid JSON');return;}
  var pr=art&&art.audit_signature&&art.audit_signature.proof;
  if(!pr){alert('✗ no §16 proof on this artifact');return;}
  try{var pub=await __ocgPubFromDidKey(pr.verificationMethod);alert(await __ocgVerify(art,pub)?'✓ §16 signature valid':'✗ signature invalid / tampered');}
  catch(e){alert('✗ '+(e&&e.message?e.message:'verify failed'));}
}
(function(){
  var ids=['ap2ExportBtn','ap2Btn','exportBtn'];
  for(var i=0;i<ids.length;i++){
    var el=document.getElementById(ids[i]);
    if(!el)continue;
    var obs=new MutationObserver(function(){
      var sab=document.getElementById('signArtifactBtn');
      if(sab){sab.disabled=false;}
      obs.disconnect();
    });
    obs.observe(el,{attributes:true,attributeFilter:['disabled']});
    break;
  }
})();
</script>`;

// ── per-page transform ─────────────────────────────────────────────────────────────────────────────
function transform(html) {
  if (html.includes('OCG-PROOF v1')) return { skip: 'already has OCG-PROOF v1' };
  if (!html.includes('OCG-CANON v1')) return { skip: 'no OCG-CANON v1 (not an emitter)' };
  if (!html.includes("chaingraph_version")) return { skip: 'no chaingraph_version anchor' };

  // Detect which OCG export button this page uses
  const EXPORT_BTN_IDS = ['ap2ExportBtn', 'ap2Btn', 'exportBtn'];
  const exportBtnId = EXPORT_BTN_IDS.find(id => html.includes(`id="${id}"`));
  if (!exportBtnId) return { skip: 'no recognized OCG export button (ap2ExportBtn|ap2Btn|exportBtn) — NONE page, skip' };

  let out = html;

  // 1. INSERT spec_version:'0.5.0' after chaingraph_version:'0.4.0'
  //    Captures the newline + indent after the comma so the inserted line matches surrounding style.
  const specBefore = out;
  // Handle both unquoted key (JS: chaingraph_version: '0.4.0',) and
  // quoted key (JSON: "chaingraph_version":"0.4.0",)
  out = out.replace(
    /("?chaingraph_version"?\s*:\s*['"]0\.4\.0['"]\s*,)(\r?\n)([ \t]*)/,
    (m, kv, nl, indent) => {
      // Mirror the key quote style of the matched chaingraph_version line
      const quoted = kv.trimStart().startsWith('"');
      const spec = quoted ? '"spec_version":"0.5.0",' : "spec_version: '0.5.0',";
      return kv + nl + indent + spec + nl + indent;
    }
  );
  if (out === specBefore) return { skip: 'could not find chaingraph_version:0.4.0 for spec_version INSERT' };

  // 2. OCG-PROOF block right after the OCG-CANON v1 </script>
  const canonAt = out.indexOf('OCG-CANON v1');
  const canonClose = out.indexOf('</script>', canonAt);
  if (canonClose === -1) return { skip: 'OCG-CANON block has no closing </script>' };
  const insAt = canonClose + '</script>'.length;
  out = out.slice(0, insAt) + '\n' + PROOF_SCRIPT + out.slice(insAt);

  // 3. Sign + Verify buttons AFTER the export button's </button>
  const btnAt = out.indexOf(`id="${exportBtnId}"`);
  const btnClose = out.indexOf('</button>', btnAt);
  if (btnClose === -1) return { skip: `${exportBtnId} has no closing </button>` };
  const btnInsAt = btnClose + '</button>'.length;
  const useGhost = out.includes('class="btn btn-ghost"');
  const BUTTONS = useGhost ? BUTTONS_GHOST : BUTTONS_STYLE;
  out = out.slice(0, btnInsAt) + '\n' + BUTTONS + out.slice(btnInsAt);

  // 4. §16 UI script (nodes variant) before </body>
  const bodyClose = out.lastIndexOf('</body>');
  if (bodyClose === -1) return { skip: 'no </body>' };
  out = out.slice(0, bodyClose) + UI_SCRIPT_NODES + '\n' + out.slice(bodyClose);

  return { changed: true, html: out, exportBtnId };
}

// ── sweep ──────────────────────────────────────────────────────────────────────────────────────────
const files = collectFiles();
let done = 0, skipped = 0, already = 0;
const skips = [];
console.log(`add_proof_binding_nodes · ${DRY ? 'DRY-RUN' : 'WRITE'} · ${files.length} pages scanned\n`);

for (const f of files) {
  if (done >= LIMIT) break;
  const base = basename(f);
  if (PHASE2_EXCLUDES.has(base)) continue;
  const r = transform(readFileSync(f, 'utf8'));
  const rel = relative(ROOT, f);
  if (r.skip) {
    if (r.skip.startsWith('already')) already++;
    else skips.push(`  · ${rel} — ${r.skip}`);
    continue;
  }
  if (!DRY) writeFileSync(f, r.html);
  done++;
  console.log(`  ✓ ${DRY ? 'would inject' : 'injected'} [${r.exportBtnId}]: ${rel}`);
}

skipped = skips.length;
console.log(`\n${done} ${DRY ? 'would change' : 'changed'} · ${already} already done · ${skipped} skipped`);
if (skips.length) {
  console.log('\nskipped (no/partial anchors or NONE-button pages — handle separately):');
  for (const s of skips.filter(s => !s.includes('not an emitter') && !s.includes('no OCG-CANON'))) console.log(s);
  const nonEmitter = skips.filter(s => s.includes('not an emitter') || s.includes('no OCG-CANON'));
  if (nonEmitter.length) console.log(`  (+ ${nonEmitter.length} non-emitter pages suppressed)`);
}
console.log(DRY ? '\nDRY-RUN — nothing written.' : '\nDone. Run: node scripts/check_tools.js && node scripts/verify-proof-surface.mjs');
