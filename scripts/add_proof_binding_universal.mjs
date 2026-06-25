/**
 * add_proof_binding_universal.mjs — Universal §16 Proof Binding injector
 *
 * Targets ALL chaingraph.json node pages + 4 wave-22 chain pages lacking eddsa-jcs-2022.
 * Derives the exact set programmatically (zero drift).
 *
 * Each target gets:
 *   1. spec_version:'0.5.0' INSERT (if absent)
 *   2. Object.defineProperty window getters for let-declared artifact vars
 *   3. OCG-CANON v1 block (adds __ocgCanon global required by proof block)
 *   4. OCG-PROOF v1 block (byte-identical to _proof.inline.min.js)
 *   5. Page-appropriate enable shim + signArtifactBtn + verifySigBtn
 *
 * Patterns:
 *   ap2ExportBtn  — btn-ghost buttons after ap2ExportBtn; watch disabled removal
 *   artifact      — inline-style buttons after <pre id="artifact">; watch childList
 *   chainPage     — inline-style buttons after copyJsonBtn; watch exportArtifactBtn
 *
 * Run: node scripts/add_proof_binding_universal.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

// ── OCG-CANON v1 block (extracted from existing injected pages) ───────────────
const CANON_BLOCK = `<script>
/* OCG-CANON v1 — RFC 8785/JCS (I-JSON). DO NOT hand-edit. Byte-identical to kernels/_hash.mjs. */
function __ocgCanon(v){return Array.isArray(v)?v.map(__ocgCanon):(v&&typeof v==='object')?Object.keys(v).sort().reduce((o,k)=>(o[k]=__ocgCanon(v[k]),o),{}):v;}
function __ocgAssertIJson(v){if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('OCG: non-finite number is not I-JSON');if(Number.isInteger(v)&&!Number.isSafeInteger(v))throw new Error('OCG: integer exceeds 2^53; pass as string');}else if(Array.isArray(v)){v.forEach(__ocgAssertIJson);}else if(v&&typeof v==='object'){for(const k of Object.keys(v))__ocgAssertIJson(v[k]);}}
function __ocgCanonStr(x){__ocgAssertIJson(x);return JSON.stringify(__ocgCanon(x));}
</script>`;

// ── OCG-PROOF v1 block ────────────────────────────────────────────────────────
const PROOF_BODY = readFileSync(join(ROOT, 'chaingraph/kernels/_proof.inline.min.js'), 'utf8').trimEnd();
const PROOF_BLOCK = `<script>\n${PROOF_BODY}\n</script>`;

// ── Sentinels ─────────────────────────────────────────────────────────────────
const PROOF_DONE   = 'eddsa-jcs-2022';       // already-injected marker (fast check)
const UNIV_DONE    = 'OCG-§16-UI v1 (univ';  // this injector's UI sentinel
const CANON_MARK   = 'OCG-CANON v1';

// ── Shared functions (signArtifact, verifySignature, __ocgGetArt) ─────────────
// __ocgGetArt updated: adds 'artifact', '_lastResult', '_ap2Artifact' to candidates
const SHARED_FNS = `function __ocgGetArt(){
  var cands=['_artifact','_result','_lastArtifact','lastArtifact','_ap2','_lastResult','_ap2Artifact'];
  for(var i=0;i<cands.length;i++){var v=window[cands[i]];if(v&&typeof v==='object'&&v.chaingraph_version)return v;}
  var el=document.getElementById('exportPre')||document.getElementById('exportOutput')||document.getElementById('chainOutput')||document.getElementById('artifact');
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
  var art;try{art=JSON.parse(t);}catch(e){alert('\\u2717 not valid JSON');return;}
  var pr=art&&art.audit_signature&&art.audit_signature.proof;
  if(!pr){alert('\\u2717 no \\u00a716 proof on this artifact');return;}
  try{var pub=await __ocgPubFromDidKey(pr.verificationMethod);alert(await __ocgVerify(art,pub)?'\\u2713 \\u00a716 signature valid':'\\u2717 signature invalid / tampered');}
  catch(e){alert('\\u2717 '+(e&&e.message?e.message:'verify failed'));}
}`;

// ── Enable shims (per pattern) ────────────────────────────────────────────────
const SHIM_AP2EXPORTBTN = `(function(){
  var el=document.getElementById('ap2ExportBtn');
  if(!el)return;
  var obs=new MutationObserver(function(){
    var sab=document.getElementById('signArtifactBtn');
    if(sab){sab.disabled=false;}
    obs.disconnect();
  });
  obs.observe(el,{attributes:true,attributeFilter:['disabled']});
})();`;

const SHIM_ARTIFACT = `(function(){
  var el=document.getElementById('artifact');
  if(!el)return;
  var obs=new MutationObserver(function(){
    try{var v=JSON.parse(el.textContent);if(v&&v.chaingraph_version){
      var sab=document.getElementById('signArtifactBtn');
      if(sab){sab.disabled=false;}
      obs.disconnect();
    }}catch(e){}
  });
  obs.observe(el,{childList:true});
})();`;

const SHIM_CHAIN = `(function(){
  var el=document.getElementById('exportArtifactBtn');
  if(!el)return;
  var obs=new MutationObserver(function(){
    var sab=document.getElementById('signArtifactBtn');
    if(sab){sab.disabled=false;}
    obs.disconnect();
  });
  obs.observe(el,{attributes:true,attributeFilter:['disabled']});
})();`;

// ── Button HTML ───────────────────────────────────────────────────────────────
const BTNS_GHOST = `\n      <button class="btn btn-ghost" id="signArtifactBtn" onclick="signArtifact()" disabled>⬇ Sign artifact (Ed25519 · §16)</button>
      <button class="btn btn-ghost" id="verifySigBtn" onclick="verifySignature()">🔏 Verify signature (§16)</button>`;

const BTNS_INLINE = `\n    <button id="signArtifactBtn" onclick="signArtifact()" disabled style="font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.45rem 1rem;background:var(--bg-3,#111E35);color:var(--text,#D4E8F8);border:1px solid var(--border,#203050);border-radius:var(--radius,6px);cursor:not-allowed;opacity:.55;transition:opacity .2s,border-color .2s;margin-top:.5rem;display:inline-block">⬇ Sign artifact (Ed25519 · §16)</button>
    <button id="verifySigBtn" onclick="verifySignature()" style="font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.45rem 1rem;background:transparent;color:var(--text,#D4E8F8);border:1px solid var(--border,#203050);border-radius:var(--radius,6px);cursor:pointer;transition:all .2s;margin-top:.5rem;display:inline-block">🔏 Verify signature (§16)</button>`;

// ── spec_version INSERT ───────────────────────────────────────────────────────
function insertSpecVersion(html) {
  if (/spec_version/.test(html)) return html; // already present
  return html.replace(
    /("?chaingraph_version"?\s*:\s*['"]0\.4\.0['"]\s*,)(\r?\n)([ \t]*)/,
    (m, kv, nl, indent) => {
      const quoted = kv.trimStart().startsWith('"');
      const spec = quoted ? '"spec_version":"0.5.0",' : "spec_version: '0.5.0',";
      return kv + nl + indent + spec + nl + indent;
    }
  );
}

// ── Object.defineProperty injection for let-declared artifact vars ────────────
// Matches: let _varname = null; (single-var) or let _varname=null,_other=null; (multi-var)
const ARTIFACT_VAR_RE = /^(let (_(?:artifact|lastArtifact|ap2Artifact|lastResult|ap2|result)[A-Za-z0-9_]*)\s*=\s*(?:null|\[\]|\{\});)/mg;
// Combined declarations: let _artifact=null,_hash=null; or similar
const ARTIFACT_COMBO_RE = /^(let (_artifact)=null,[^;\n]+;)/mg;

function injectWindowGetters(html) {
  // Single-var declarations
  let out = html.replace(ARTIFACT_VAR_RE, (match, decl, varName) => {
    if (html.includes(`defineProperty(window,'${varName}'`)) return match;
    return `${decl}\nObject.defineProperty(window,'${varName}',{get:function(){return ${varName};},configurable:true});`;
  });
  // Combined declarations (wave-22 chain pages)
  out = out.replace(ARTIFACT_COMBO_RE, (match, decl, varName) => {
    if (out.includes(`defineProperty(window,'${varName}'`)) return match;
    return `${decl}\nObject.defineProperty(window,'${varName}',{get:function(){return ${varName};},configurable:true});`;
  });
  return out;
}

// ── OCG-CANON v1 + OCG-PROOF v1 injection (before </body>) ───────────────────
// Uses lastIndexOf to avoid hitting </body> inside document.write() strings.
function injectCanonAndProof(html) {
  if (html.includes(CANON_MARK)) return html; // already has canon
  const bodyClose = '</body>';
  const idx = html.lastIndexOf(bodyClose);
  if (idx === -1) return html;
  return html.slice(0, idx) + CANON_BLOCK + '\n' + PROOF_BLOCK + '\n' + html.slice(idx);
}

// ── UI script injection (before </body>, after proof blocks) ──────────────────
function makeUiScript(shim, sentinel) {
  return `<script>
/* OCG-§16-UI v1 (univ-${sentinel}) — Sign + Verify + enable shim. DO NOT hand-edit; injected by scripts/add_proof_binding_universal.mjs. */
${SHARED_FNS}
${shim}
</script>`;
}

// ── Button injection helpers ──────────────────────────────────────────────────

// After ap2ExportBtn's closing </button> — handles multi-line button element
function injectBtnsAfterAp2Btn(html, btns) {
  // Find id="ap2ExportBtn" then find the next </button>
  const start = html.indexOf('id="ap2ExportBtn"');
  if (start === -1) return { html, warn: 'ap2ExportBtn not found' };
  const closeTag = '</button>';
  const closeIdx = html.indexOf(closeTag, start);
  if (closeIdx === -1) return { html, warn: 'closing </button> after ap2ExportBtn not found' };
  const insertAt = closeIdx + closeTag.length;
  return { html: html.slice(0, insertAt) + btns + html.slice(insertAt), warn: null };
}

// After <pre id="artifact"></pre>
function injectBtnsAfterArtifact(html, btns) {
  const anchor = '<pre id="artifact"></pre>';
  if (!html.includes(anchor)) return { html, warn: '#artifact anchor not found' };
  return { html: html.replace(anchor, anchor + btns), warn: null };
}

// After copyJsonBtn's closing </button>
function injectBtnsAfterCopyJson(html, btns) {
  const start = html.indexOf('id="copyJsonBtn"');
  if (start === -1) return { html, warn: 'copyJsonBtn not found' };
  const closeIdx = html.indexOf('</button>', start);
  if (closeIdx === -1) return { html, warn: 'closing </button> after copyJsonBtn not found' };
  const insertAt = closeIdx + '</button>'.length;
  return { html: html.slice(0, insertAt) + btns + html.slice(insertAt), warn: null };
}

// ── Derive target set ─────────────────────────────────────────────────────────
function deriveTargets() {
  const catalog = JSON.parse(readFileSync(join(ROOT, 'chaingraph/chaingraph.json'), 'utf8'));
  const targets = [];

  // Node pages
  for (const node of catalog.nodes) {
    const path = join(ROOT, 'chaingraph', node.tool_id + '.html');
    if (!existsSync(path)) continue;
    const html = readFileSync(path, 'utf8');
    if (html.includes(PROOF_DONE)) continue;
    targets.push({ path, type: 'node', id: node.tool_id });
  }

  // Wave-22 chain pages (chains/ without §16)
  const chainsDir = join(ROOT, 'chaingraph/chains');
  for (const f of readdirSync(chainsDir)) {
    if (!f.endsWith('.html')) continue;
    const path = join(chainsDir, f);
    const html = readFileSync(path, 'utf8');
    if (html.includes(PROOF_DONE)) continue;
    targets.push({ path, type: 'chain', id: f.replace('.html', '') });
  }

  return targets;
}

// ── Classify page pattern ─────────────────────────────────────────────────────
function classify(html) {
  if (html.includes('id="ap2ExportBtn"')) return 'ap2ExportBtn';
  if (html.includes('id="artifact"'))      return 'artifact';
  if (html.includes('id="copyJsonBtn"'))   return 'chain';
  return 'unknown';
}

// ── Main ──────────────────────────────────────────────────────────────────────
const targets = deriveTargets();
console.log(`Target: ${targets.length} pages (${targets.filter(t=>t.type==='node').length} nodes + ${targets.filter(t=>t.type==='chain').length} chains)`);

const stats = { injected: 0, skipped: 0, warn: 0, unknown: 0 };

for (const tgt of targets) {
  let html = readFileSync(tgt.path, 'utf8');
  const fname = basename(tgt.path);

  if (html.includes(UNIV_DONE)) {
    console.log(`SKIP (already) ${fname}`);
    stats.skipped++;
    continue;
  }

  const before = html;
  const pattern = classify(html);

  if (pattern === 'unknown') {
    console.log(`UNKNOWN pattern: ${fname}`);
    stats.unknown++;
    continue;
  }

  // 1. spec_version
  html = insertSpecVersion(html);

  // 2. Object.defineProperty for let-declared artifact vars
  html = injectWindowGetters(html);

  // 3. OCG-CANON v1 + OCG-PROOF v1
  html = injectCanonAndProof(html);

  // 4. UI script
  let shim, sentinel, btns;
  if (pattern === 'ap2ExportBtn') {
    shim = SHIM_AP2EXPORTBTN; sentinel = 'ap2'; btns = BTNS_GHOST;
    // Only use btn-ghost if the page has that CSS
    if (!html.includes('btn-ghost')) btns = BTNS_INLINE;
  } else if (pattern === 'artifact') {
    shim = SHIM_ARTIFACT; sentinel = 'artifact'; btns = BTNS_INLINE;
  } else { // chain
    shim = SHIM_CHAIN; sentinel = 'chain'; btns = BTNS_INLINE;
  }

  // Use lastIndexOf to avoid hitting </body> inside document.write() strings
  const uiIdx = html.lastIndexOf('</body>');
  if (uiIdx !== -1) {
    html = html.slice(0, uiIdx) + makeUiScript(shim, sentinel) + '\n' + html.slice(uiIdx);
  }

  // 5. Button injection
  let result;
  if (pattern === 'ap2ExportBtn') {
    result = injectBtnsAfterAp2Btn(html, btns);
  } else if (pattern === 'artifact') {
    result = injectBtnsAfterArtifact(html, btns);
  } else {
    result = injectBtnsAfterCopyJson(html, btns);
  }

  if (result.warn) {
    console.log(`WARN [${pattern}] ${fname}: ${result.warn}`);
    stats.warn++;
  }
  html = result.html;

  if (html === before) {
    console.log(`SKIP (no change) ${fname}`);
    stats.skipped++;
    continue;
  }

  if (DRY) {
    console.log(`DRY [${pattern}] ${fname}`);
  } else {
    writeFileSync(tgt.path, html, 'utf8');
    console.log(`OK [${pattern}] ${fname}`);
  }
  stats.injected++;
}

console.log(`\n${DRY ? 'DRY-RUN ' : ''}Done: ${stats.injected} injected, ${stats.skipped} skipped, ${stats.warn} warnings, ${stats.unknown} unknown-pattern.`);
