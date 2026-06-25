/**
 * add_proof_binding_phase2b.mjs — Phase 2b §16 Proof Binding injector
 *
 * Targets the 9 chaingraph/ flat pages skipped by Phase 2 (no ap2ExportBtn/ap2Btn/exportBtn).
 * Three patterns:
 *   A (7 pages)  — #exportPre + copy-btn; MutationObserver watches #exportPre childList
 *   B (art-29)   — #hashDisplay + window._lastArtifact; observer watches #hashDisplay class
 *   C (pnr-01)   — #export-hash + let _artifact; Object.defineProperty window getter + observer
 *
 * Run: node scripts/add_proof_binding_phase2b.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

// ── OCG-PROOF v1 block (byte-identical to kernels/_proof.inline.min.js) ─────
const PROOF_INLINE_PATH = join(ROOT, 'chaingraph/kernels/_proof.inline.min.js');
const PROOF_BODY = readFileSync(PROOF_INLINE_PATH, 'utf8').trimEnd();
const PROOF_BLOCK = `<script>\n${PROOF_BODY}\n</script>`;

// ── Sentinels ────────────────────────────────────────────────────────────────
const CANON_CLOSE     = '</script>';
const CANON_SENTINEL  = 'OCG-CANON v1';
const PROOF_SENTINEL  = 'OCG-PROOF v1';
const PROOF_BLOCK_UI_SENTINEL = 'OCG-§16-UI v1 (phase2b';

// ── Shared signArtifact / verifySignature / __ocgGetArt body ─────────────────
const SHARED_FNS = `function __ocgGetArt(){
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
}`;

// ── UI scripts per pattern ───────────────────────────────────────────────────
function uiScriptExportPre() {
  return `<script>
/* OCG-§16-UI v1 (phase2b-exportPre) — Sign + Verify + enable shim. DO NOT hand-edit; injected by scripts/add_proof_binding_phase2b.mjs. */
${SHARED_FNS}
(function(){
  var el=document.getElementById('exportPre');
  if(!el)return;
  var obs=new MutationObserver(function(){
    try{var v=JSON.parse(el.textContent);if(v&&v.chaingraph_version){
      var sab=document.getElementById('signArtifactBtn');
      if(sab){sab.disabled=false;}
      obs.disconnect();
    }}catch(e){}
  });
  obs.observe(el,{childList:true});
})();
</script>`;
}

function uiScriptHashDisplay() {
  return `<script>
/* OCG-§16-UI v1 (phase2b-hashDisplay) — Sign + Verify + enable shim. DO NOT hand-edit; injected by scripts/add_proof_binding_phase2b.mjs. */
${SHARED_FNS}
(function(){
  var el=document.getElementById('hashDisplay');
  if(!el)return;
  var obs=new MutationObserver(function(){
    if(el.classList.contains('visible')){
      var sab=document.getElementById('signArtifactBtn');
      if(sab){sab.disabled=false;}
      obs.disconnect();
    }
  });
  obs.observe(el,{attributes:true,attributeFilter:['class']});
})();
</script>`;
}

function uiScriptExportHash() {
  return `<script>
/* OCG-§16-UI v1 (phase2b-exportHash) — Sign + Verify + enable shim. DO NOT hand-edit; injected by scripts/add_proof_binding_phase2b.mjs. */
${SHARED_FNS}
(function(){
  var el=document.getElementById('export-hash');
  if(!el)return;
  var obs=new MutationObserver(function(){
    var t=el.textContent;if(t&&t!=='—'&&t.length>5){
      var sab=document.getElementById('signArtifactBtn');
      if(sab){sab.disabled=false;}
      obs.disconnect();
    }
  });
  obs.observe(el,{childList:true});
})();
</script>`;
}

// ── Button HTML (inline-styled, no CSS class dependency) ─────────────────────
const BUTTONS_INLINE = `\n    <button id="signArtifactBtn" onclick="signArtifact()" disabled style="font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.45rem 1rem;background:var(--bg-3,#111E35);color:var(--text,#D4E8F8);border:1px solid var(--border,#203050);border-radius:var(--radius,6px);cursor:not-allowed;opacity:.55;transition:opacity .2s,border-color .2s;margin-top:.5rem;display:inline-block">⬇ Sign artifact (Ed25519 · §16)</button>\n    <button id="verifySigBtn" onclick="verifySignature()" style="font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.45rem 1rem;background:transparent;color:var(--text,#D4E8F8);border:1px solid var(--border,#203050);border-radius:var(--radius,6px);cursor:pointer;transition:all .2s;margin-top:.5rem;display:inline-block">🔏 Verify signature (§16)</button>`;

// ── spec_version INSERT (same regex as Phase 2, handles JS-unquoted + JSON-quoted) ───
function insertSpecVersion(html) {
  return html.replace(
    /("?chaingraph_version"?\s*:\s*['"]0\.4\.0['"]\s*,)(\r?\n)([ \t]*)/,
    (m, kv, nl, indent) => {
      const quoted = kv.trimStart().startsWith('"');
      const spec = quoted ? '"spec_version":"0.5.0",' : "spec_version: '0.5.0',";
      return kv + nl + indent + spec + nl + indent;
    }
  );
}

// ── OCG-PROOF v1 block injection (after OCG-CANON v1 </script>) ──────────────
function injectProofBlock(html) {
  if (html.includes(PROOF_SENTINEL)) return html; // already injected
  // Find the </script> that closes the OCG-CANON v1 block
  const canonIdx = html.indexOf(CANON_SENTINEL);
  if (canonIdx === -1) return html;
  const closeIdx = html.indexOf(CANON_CLOSE, canonIdx);
  if (closeIdx === -1) return html;
  const insertAt = closeIdx + CANON_CLOSE.length;
  return html.slice(0, insertAt) + '\n' + PROOF_BLOCK + html.slice(insertAt);
}

// ── Page configs ─────────────────────────────────────────────────────────────
const pages = [
  // Pattern A — #exportPre pages
  {
    file: 'chaingraph/art-14-psd3-psr-readiness-checker.html',
    pattern: 'exportPre',
    btnAnchor: `onclick="copyExport()">Copy JSON</button>`,
    btnAnchorReplace: (a) => a + BUTTONS_INLINE,
    uiScript: uiScriptExportPre,
  },
  {
    file: 'chaingraph/ml-01-isolation-forest.html',
    pattern: 'exportPre',
    btnAnchor: `onclick="copyExport()">Copy JSON</button>`,
    btnAnchorReplace: (a) => a + BUTTONS_INLINE,
    uiScript: uiScriptExportPre,
  },
  {
    file: 'chaingraph/ml-02-credit-default-risk-scorer.html',
    pattern: 'exportPre',
    btnAnchor: `onclick="copyExport()">Copy JSON</button>`,
    btnAnchorReplace: (a) => a + BUTTONS_INLINE,
    uiScript: uiScriptExportPre,
  },
  {
    file: 'chaingraph/ml-03-timeseries-anomaly-detector.html',
    pattern: 'exportPre',
    btnAnchor: `onclick="copyExport()">Copy JSON</button>`,
    btnAnchorReplace: (a) => a + BUTTONS_INLINE,
    uiScript: uiScriptExportPre,
  },
  {
    file: 'chaingraph/qfa-03-stress-test-engine.html',
    pattern: 'exportPre',
    btnAnchor: `onclick="copyExport()">Copy JSON</button>`,
    btnAnchorReplace: (a) => a + BUTTONS_INLINE,
    uiScript: uiScriptExportPre,
  },
  {
    file: 'chaingraph/rca-01-frtb-ima-pre-validator.html',
    pattern: 'exportPre',
    btnAnchor: `onclick="copyExport()">Copy JSON</button>`,
    btnAnchorReplace: (a) => a + BUTTONS_INLINE,
    uiScript: uiScriptExportPre,
  },
  {
    file: 'chaingraph/sim-07-open-banking-consent-flow-stress.html',
    pattern: 'exportPre',
    btnAnchor: `onclick="copyExport()">Copy JSON</button>`,
    btnAnchorReplace: (a) => a + BUTTONS_INLINE,
    uiScript: uiScriptExportPre,
  },

  // Pattern B — art-29 (window._lastArtifact + #hashDisplay)
  {
    file: 'chaingraph/art-29-dora-readiness-diagnostic.html',
    pattern: 'hashDisplay',
    btnAnchor: `onclick="copyShareLink()">🔗 Copy result link</button>`,
    btnAnchorReplace: (a) => a + BUTTONS_INLINE,
    uiScript: uiScriptHashDisplay,
  },

  // Pattern C — pnr-01 (let _artifact + #export-hash + window getter)
  {
    file: 'chaingraph/pnr-01-dora-ict-cascade-simulator.html',
    pattern: 'exportHash',
    btnAnchor: `onclick="exportMarkdown()">↓ Export .md</button>`,
    btnAnchorReplace: (a) => a + BUTTONS_INLINE,
    uiScript: uiScriptExportHash,
    // Extra: expose let _artifact to window via Object.defineProperty
    windowGetterAnchor: 'let _artifact = null;',
    windowGetterInsert: `\nObject.defineProperty(window,'_artifact',{get:function(){return _artifact;},configurable:true});`,
  },
];

// ── Main ────────────────────────────────────────────────────────────────────
let injected = 0, skipped = 0, errors = 0;

for (const pg of pages) {
  const path = join(ROOT, pg.file);
  if (!existsSync(path)) { console.log(`MISSING ${pg.file}`); errors++; continue; }

  let html = readFileSync(path, 'utf8');

  // Idempotency
  if (html.includes(PROOF_BLOCK_UI_SENTINEL)) {
    console.log(`SKIP (already injected) ${pg.file}`);
    skipped++;
    continue;
  }

  const before = html;

  // 1. spec_version INSERT
  html = insertSpecVersion(html);
  if (html === before) {
    console.log(`WARN spec_version INSERT no-op on ${pg.file} — check chaingraph_version format`);
  }

  // 2. OCG-PROOF v1 block
  html = injectProofBlock(html);

  // 3. Window getter patch (pnr-01 only)
  if (pg.windowGetterAnchor) {
    const anchor = pg.windowGetterAnchor;
    if (html.includes(anchor)) {
      html = html.replace(anchor, anchor + pg.windowGetterInsert);
    } else {
      console.log(`WARN window getter anchor not found in ${pg.file}`);
    }
  }

  // 4. Button injection
  if (html.includes(pg.btnAnchor)) {
    html = html.replace(pg.btnAnchor, pg.btnAnchorReplace(pg.btnAnchor));
  } else {
    console.log(`WARN button anchor not found in ${pg.file}`);
  }

  // 5. UI script injection (before </body>)
  const bodyClose = '</body>';
  if (!html.includes(bodyClose)) {
    console.log(`WARN no </body> in ${pg.file}`);
  } else {
    html = html.replace(bodyClose, pg.uiScript() + '\n' + bodyClose);
  }

  if (html === before) {
    console.log(`SKIP (no change) ${pg.file}`);
    skipped++;
    continue;
  }

  if (DRY) {
    console.log(`DRY-RUN would inject: ${pg.file} [${pg.pattern}]`);
  } else {
    writeFileSync(path, html, 'utf8');
    console.log(`INJECTED [${pg.pattern}] ${pg.file}`);
  }
  injected++;
}

console.log(`\n${DRY ? 'DRY-RUN ' : ''}Done: ${injected} injected, ${skipped} skipped, ${errors} errors.`);
