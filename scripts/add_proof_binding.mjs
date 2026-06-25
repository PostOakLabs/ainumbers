#!/usr/bin/env node
// add_proof_binding.mjs — v0.5 §16 rollout INJECTOR, Phase 1 (chaingraph/chains/ only).
// Idempotent, anchor-guarded, sentinel-bounded. Mirrors the inline OCG-CANON pattern.
// See WAVE-V0.5-MASS-ROLLOUT-SPEC.md. Pairs with the gate scripts/verify-proof-surface.mjs.
//
// SCOPE: ONLY the chains/ family, which is UNIFORM (≈200 pages: CHAIN_HASH + buildArtifact() +
// exportVCBtn + OCG-CANON v1 + a `verifyBtn` enable array). It REFUSES any page missing those anchors
// (the 3 laggards + outliers) — it logs+skips rather than mangle. tools/ + art-NN node pages use a
// DIFFERENT artifact accessor (lastArtifact / inline) — DO NOT point this script at them; they are a
// separate phase with a different signArtifact() body (see the handoff prompt).
//
// Per qualifying page (idempotent — re-running is a no-op once OCG-PROOF v1 is present):
//   1. spec_version field → 0.5.0  (SURGICAL: only the spec_version token; NEVER chaingraph_version)
//   2. inject the OCG-PROOF v1 <script> immediately AFTER the OCG-CANON v1 </script>
//   3. insert Sign + Verify buttons after the exportVCBtn </button>
//   4. add 'signArtifactBtn' to the button-enable id array (verifySigBtn is always-on, not added)
//   5. inject the §16-UI <script> (signArtifact + verifySignature) before </body>
//
// Usage:
//   node scripts/add_proof_binding.mjs --dry-run            report planned changes, write nothing
//   node scripts/add_proof_binding.mjs --limit 1            inject into the first qualifying page only
//   node scripts/add_proof_binding.mjs                      inject into all qualifying chains/ pages
//   node scripts/add_proof_binding.mjs --dir chaingraph/chains   (default)

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DRY = process.argv.includes('--dry-run');
const limIdx = process.argv.indexOf('--limit');
const LIMIT = limIdx > -1 ? parseInt(process.argv[limIdx + 1], 10) : Infinity;
const dirIdx = process.argv.indexOf('--dir');
const TARGET = join(ROOT, dirIdx > -1 ? process.argv[dirIdx + 1] : 'chaingraph/chains');

const PIN_PATH = join(ROOT, 'chaingraph', 'kernels', '_proof.inline.min.js');
if (!existsSync(PIN_PATH)) { console.error(`FATAL: pin not found: ${relative(ROOT, PIN_PATH)}`); process.exit(2); }
const PIN = readFileSync(PIN_PATH, 'utf8').trim();

// ── injected fragments ───────────────────────────────────────────────────────────────────────────
const PROOF_SCRIPT = `<script>\n${PIN}\n</script>`;

const BUTTONS =
`    <button class="export-btn export-btn-secondary" id="signArtifactBtn" onclick="signArtifact()" disabled>⬇ Sign artifact (Ed25519 · §16)</button>
    <button class="export-btn export-btn-secondary" id="verifySigBtn" onclick="verifySignature()">🔏 Verify signature (§16)</button>`;

const UI_SCRIPT =
`<script>
/* OCG-§16-UI v1 (chains) — Sign + Verify wiring. DO NOT hand-edit; injected by scripts/add_proof_binding.mjs. */
async function signArtifact(){
  if(typeof CHAIN_HASH==='undefined'||!CHAIN_HASH)return;
  if(!confirm('Signing binds this run to a one-time key and de-anonymizes it (OCG §16.2). Continue?'))return;
  var art=buildArtifact(CHAIN_HASH);
  var kp=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
  var did=await __ocgDidKeyFromPub(kp.publicKey);
  var signed=await __ocgSign(art,{verificationMethod:did,created:art.generated_at,privateKey:kp.privateKey});
  var ts=new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14);
  var fn=(typeof CHAIN_MANIFEST!=='undefined'&&CHAIN_MANIFEST&&CHAIN_MANIFEST.chain_id?CHAIN_MANIFEST.chain_id:art.tool_id)+'_'+ts+'.signed.json';
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
</script>`;

// ── per-page transform (pure: returns {changed, html, skip}) ──────────────────────────────────────
function transform(html) {
  // idempotent: already done
  if (html.includes('OCG-PROOF v1')) return { skip: 'already has OCG-PROOF v1' };

  // anchors REQUIRED for the chains accessor — refuse to touch a page that lacks any
  const need = [
    ['OCG-CANON v1', 'OCG-CANON v1'],
    ['exportVCBtn', 'id="exportVCBtn"'],
    ['CHAIN_HASH', 'CHAIN_HASH'],
    ['buildArtifact(', 'buildArtifact('],
  ];
  for (const [label, token] of need) if (!html.includes(token)) return { skip: `missing anchor: ${label}` };

  let out = html;

  // 1. spec_version → 0.5.0 (surgical; never chaingraph_version)
  out = out.replace(/(spec_version['"]?\s*:\s*['"])0\.4\.[0-9]+(['"])/g, `$10.5.0$2`);
  out = out.replace(/(name=["']ocg-spec-version["']\s+content=["'])0\.4\.[0-9]+(["'])/g, `$10.5.0$2`);

  // 2. OCG-PROOF block right after the OCG-CANON </script>
  const canonAt = out.indexOf('OCG-CANON v1');
  const canonClose = out.indexOf('</script>', canonAt);
  if (canonClose === -1) return { skip: 'OCG-CANON block has no closing </script>' };
  const insAt = canonClose + '</script>'.length;
  out = out.slice(0, insAt) + '\n' + PROOF_SCRIPT + out.slice(insAt);

  // 3. buttons after the exportVCBtn </button>
  const vcBtnAt = out.indexOf('id="exportVCBtn"');
  const vcBtnClose = out.indexOf('</button>', vcBtnAt);
  if (vcBtnClose === -1) return { skip: 'exportVCBtn has no closing </button>' };
  const btnInsAt = vcBtnClose + '</button>'.length;
  out = out.slice(0, btnInsAt) + '\n' + BUTTONS + out.slice(btnInsAt);

  // 4. add signArtifactBtn to the enable id array (the array that contains 'verifyBtn')
  //    matches:  ids = ['verifyBtn', 'exportArtifactBtn', ...]   (single or double quotes)
  const before = out;
  out = out.replace(/(\[\s*['"]verifyBtn['"][^\]]*)\]/, (m, head) => {
    if (m.includes('signArtifactBtn')) return m;
    return `${head}, 'signArtifactBtn']`;
  });
  if (out === before) return { skip: "could not find the verifyBtn enable id array (step 4)" };

  // 5. §16-UI script before </body>
  const bodyClose = out.lastIndexOf('</body>');
  if (bodyClose === -1) return { skip: 'no </body>' };
  out = out.slice(0, bodyClose) + UI_SCRIPT + '\n' + out.slice(bodyClose);

  return { changed: true, html: out };
}

// ── sweep ──────────────────────────────────────────────────────────────────────────────────────
if (!existsSync(TARGET)) { console.error(`FATAL: target dir not found: ${relative(ROOT, TARGET)}`); process.exit(2); }
const files = readdirSync(TARGET).filter((f) => f.endsWith('.html')).map((f) => join(TARGET, f));

let done = 0, skipped = 0, already = 0; const skips = [];
console.log(`add_proof_binding · ${DRY ? 'DRY-RUN' : 'WRITE'} · target ${relative(ROOT, TARGET)} · ${files.length} pages\n`);
for (const f of files) {
  if (done >= LIMIT) break;
  const rel = relative(ROOT, f);
  const r = transform(readFileSync(f, 'utf8'));
  if (r.skip) {
    if (r.skip.startsWith('already')) { already++; }
    else { skipped++; skips.push(`  · ${rel} — ${r.skip}`); }
    continue;
  }
  if (!DRY) writeFileSync(f, r.html);
  done++;
  console.log(`  ✓ ${DRY ? 'would inject' : 'injected'}: ${rel}`);
}

console.log(`\n${done} ${DRY ? 'would change' : 'changed'} · ${already} already done · ${skipped} skipped (no/partial anchors)`);
if (skips.length) { console.log('\nskipped (review — likely laggards/outliers, handle per the handoff):'); for (const s of skips) console.log(s); }
console.log(DRY ? '\nDRY-RUN — nothing written. Re-run without --dry-run to apply.' : '\nDone. Run: node scripts/check_tools.js && node scripts/verify-proof-surface.mjs');
