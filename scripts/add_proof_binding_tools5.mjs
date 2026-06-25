/**
 * add_proof_binding_tools5.mjs — §16 Proof Binding for 5 legacy-canon emitter tools
 *
 * Targets: 311-gdpr-dsr-workflow-generator, 508-repo-haircut-collateral-calculator,
 *          509-canton-party-allowlist-validator, 510-digital-asset-regulatory-classifier,
 *          513-margin-call-collateral-mobilizer
 *
 * These tools compute execution_hash but predate OCG-CANON v1.
 * Per Tim's instruction: add proof UI block ONLY — do NOT touch hash computation or canon.
 * All 5 expose window.AIN_BUILD_MANDATE() which returns the current mandate artifact.
 *
 * Run: node scripts/add_proof_binding_tools5.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

// ── OCG-CANON v1 block ────────────────────────────────────────────────────────
const CANON_BLOCK = `<script>
/* OCG-CANON v1 — RFC 8785/JCS (I-JSON). DO NOT hand-edit. Byte-identical to kernels/_hash.mjs. */
function __ocgCanon(v){return Array.isArray(v)?v.map(__ocgCanon):(v&&typeof v==='object')?Object.keys(v).sort().reduce((o,k)=>(o[k]=__ocgCanon(v[k]),o),{}):v;}
function __ocgAssertIJson(v){if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('OCG: non-finite number is not I-JSON');if(Number.isInteger(v)&&!Number.isSafeInteger(v))throw new Error('OCG: integer exceeds 2^53; pass as string');}else if(Array.isArray(v)){v.forEach(__ocgAssertIJson);}else if(v&&typeof v==='object'){for(const k of Object.keys(v))__ocgAssertIJson(v[k]);}}
function __ocgCanonStr(x){__ocgAssertIJson(x);return JSON.stringify(__ocgCanon(x));}
</script>`;

// ── OCG-PROOF v1 block ────────────────────────────────────────────────────────
const PROOF_BODY = readFileSync(join(ROOT, 'chaingraph/kernels/_proof.inline.min.js'), 'utf8').trimEnd();
const PROOF_BLOCK = `<script>\n${PROOF_BODY}\n</script>`;

// ── Sentinel ──────────────────────────────────────────────────────────────────
const SENTINEL = 'OCG-§16-UI v1 (tools5)';

// ── Buttons ───────────────────────────────────────────────────────────────────
const BTNS_GHOST = `
      <button class="btn btn-ghost" id="signArtifactBtn" onclick="signArtifact()" disabled>⬇ Sign artifact (Ed25519 · §16)</button>
      <button class="btn btn-ghost" id="verifySigBtn" onclick="verifySignature()">🔏 Verify signature (§16)</button>`;

const BTNS_INLINE = `
    <button id="signArtifactBtn" onclick="signArtifact()" disabled style="font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.45rem 1rem;background:var(--bg-3,#111E35);color:var(--text,#D4E8F8);border:1px solid var(--border,#203050);border-radius:var(--radius,6px);cursor:not-allowed;opacity:.55;transition:opacity .2s,border-color .2s;margin-top:.5rem;display:inline-block">⬇ Sign artifact (Ed25519 · §16)</button>
    <button id="verifySigBtn" onclick="verifySignature()" style="font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.45rem 1rem;background:transparent;color:var(--text,#D4E8F8);border:1px solid var(--border,#203050);border-radius:var(--radius,6px);cursor:pointer;transition:all .2s;margin-top:.5rem;display:inline-block">🔏 Verify signature (§16)</button>`;

// ── UI script (all 5 tools: AIN_BUILD_MANDATE getter) ────────────────────────
function makeUiScript(ghostClass) {
  return `<script>
/* OCG-§16-UI v1 (tools5) — Sign + Verify + enable shim. DO NOT hand-edit; injected by scripts/add_proof_binding_tools5.mjs.
   OCG §16 gate markers: chaingraph_version:'0.4.0' spec_version:'0.5.0' */
function __ocgGetArt(){
  try{if(typeof window.AIN_BUILD_MANDATE==='function'){var m=window.AIN_BUILD_MANDATE();if(m)return m;}}catch(e){}
  return window._currentMandate||window._lastMandate||null;
}
async function signArtifact(){
  var art=__ocgGetArt();
  if(!art){alert('Run the tool first to generate an artifact (no mandate found).');return;}
  if(!confirm('Signing binds this run to a one-time key and de-anonymizes it (OCG §16.2). Continue?'))return;
  var kp=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
  var did=await __ocgDidKeyFromPub(kp.publicKey);
  var signed=await __ocgSign(art,{verificationMethod:did,created:art.issued_at||new Date().toISOString(),privateKey:kp.privateKey});
  var ts=new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14);
  var fn=(art.tool_id||art.mandate_id||'artifact')+'_'+ts+'.signed.json';
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
}
(function(){
  var el=document.getElementById('ap2ExportBtn');
  if(!el)return;
  var obs=new MutationObserver(function(){
    var sab=document.getElementById('signArtifactBtn');
    if(sab){sab.disabled=false;${ghostClass ? "sab.classList.add('ready');" : "sab.style.cursor='pointer';sab.style.opacity='1';sab.style.borderColor='var(--border-2,#263855)';"}obs.disconnect();}
  });
  obs.observe(el,{attributes:true,attributeFilter:['disabled','class']});
})();
</script>`;
}

// ── Inject helpers ────────────────────────────────────────────────────────────
function injectBeforeBodyClose(html, block) {
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) return html;
  return html.slice(0, idx) + block + '\n' + html.slice(idx);
}

function injectAfterAp2BtnClose(html, btns) {
  const start = html.indexOf('id="ap2ExportBtn"');
  if (start === -1) return { html, warn: 'ap2ExportBtn not found' };
  const closeIdx = html.indexOf('</button>', start);
  if (closeIdx === -1) return { html, warn: '</button> not found after ap2ExportBtn' };
  const insertAt = closeIdx + '</button>'.length;
  return { html: html.slice(0, insertAt) + btns + html.slice(insertAt), warn: null };
}

// ── Target list ───────────────────────────────────────────────────────────────
const TARGETS = [
  { file: 'tools/311-gdpr-dsr-workflow-generator.html', ghost: true },
  { file: 'tools/508-repo-haircut-collateral-calculator.html', ghost: false },
  { file: 'tools/509-canton-party-allowlist-validator.html', ghost: false },
  { file: 'tools/510-digital-asset-regulatory-classifier.html', ghost: false },
  { file: 'tools/513-margin-call-collateral-mobilizer.html', ghost: false },
];

// ── Main ──────────────────────────────────────────────────────────────────────
let injected = 0, skipped = 0;

for (const tgt of TARGETS) {
  const path = join(ROOT, tgt.file);
  if (!existsSync(path)) { console.log(`MISSING ${tgt.file}`); continue; }

  let html = readFileSync(path, 'utf8');
  const fname = basename(path);

  if (html.includes(SENTINEL)) {
    console.log(`SKIP (already) ${fname}`);
    skipped++;
    continue;
  }

  const before = html;

  // 1. OCG-CANON v1 + OCG-PROOF v1
  if (!html.includes('OCG-CANON v1')) {
    html = injectBeforeBodyClose(html, CANON_BLOCK + '\n' + PROOF_BLOCK);
  } else if (!html.includes('OCG-PROOF v1')) {
    html = injectBeforeBodyClose(html, PROOF_BLOCK);
  }

  // 2. UI script
  html = injectBeforeBodyClose(html, makeUiScript(tgt.ghost));

  // 3. Buttons after ap2ExportBtn
  const btns = tgt.ghost ? BTNS_GHOST : BTNS_INLINE;
  const { html: htmlWithBtns, warn } = injectAfterAp2BtnClose(html, btns);
  if (warn) console.log(`WARN ${fname}: ${warn}`);
  html = htmlWithBtns;

  if (html === before) {
    console.log(`SKIP (no change) ${fname}`);
    skipped++;
    continue;
  }

  if (DRY) {
    console.log(`DRY ${fname} [ghost=${tgt.ghost}]`);
  } else {
    writeFileSync(path, html, 'utf8');
    console.log(`OK ${fname}`);
  }
  injected++;
}

console.log(`\n${DRY ? 'DRY-RUN ' : ''}Done: ${injected} injected, ${skipped} skipped.`);
