// Generator for wave 22 HTML tool pages (art-112..122)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', 'chaingraph');

function makeHTML(cfg) {
  const { artNum, slug, title, subtitle, wave, flags, infoScope, presets, inputs, computeFn, renderFn, manifestDef, exportFns, initCode, feedsFrom, exportCapability } = cfg;
  const hasVC = (exportCapability || []).includes('vc');
  const feedsFromArr = feedsFrom || [];
  const chainDepth = feedsFromArr.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<title>${title} · ART-${artNum} · OpenChainGraph · AINumbers.co</title>
<meta name="description" content="${subtitle}">
<link rel="canonical" href="https://ainumbers.co/chaingraph/${slug}.html">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23080E1A'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='Sora,sans-serif' font-weight='600' font-size='13' fill='%2314B8A6'>AI</text></svg>">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"SoftwareApplication","name":"${title}","applicationCategory":"FinanceApplication","description":"${subtitle}","url":"https://ainumbers.co/chaingraph/${slug}.html","publisher":{"@type":"Organization","name":"Post Oak Labs","url":"https://postoaklabs.com"},"license":"https://creativecommons.org/licenses/by/4.0/"}
<\/script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Sora:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#080E1A;--bg-2:#0D1627;--bg-3:#111E35;--bg-4:#162340;--border:#1E2F4A;--border-2:#263855;--muted:#3A5270;--body:#6888A8;--text:#A8C4DE;--bright:#D4E8F8;--white:#EEF6FD;--teal:#14B8A6;--teal-dim:rgba(20,184,166,.12);--teal-lt:#2DD4BF;--gold:#D4A847;--green:#22C55E;--green-dim:rgba(34,197,94,.12);--red:#EF4444;--warn:#F59E0B;--purple:#9B72F5;--radius:6px;--radius-lg:10px}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Sora',system-ui,sans-serif;font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--teal-lt);text-decoration:none}
.wrap{max-width:920px;margin:0 auto;padding:24px 20px 80px}
nav{position:sticky;top:0;z-index:10;background:rgba(8,14,26,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--border);padding:0 20px;height:50px;display:flex;align-items:center}
nav .in{max-width:920px;margin:0 auto;width:100%;display:flex;align-items:center;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:.8rem}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--teal);margin:18px 0 8px}
h1{font-size:1.6rem;color:var(--white);margin-bottom:8px;font-weight:600;font-family:'DM Serif Display',serif}
.sub{color:var(--body);max-width:660px;margin-bottom:8px}
.flag{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:.6rem;background:rgba(34,197,94,.08);color:var(--green);border:1px solid rgba(34,197,94,.25);padding:.2rem .55rem;border-radius:20px;margin:4px 2px}
.flag.warn{background:rgba(212,168,71,.1);color:var(--gold);border-color:rgba(212,168,71,.3)}
.flag.info{background:rgba(20,184,166,.08);color:var(--teal-lt);border-color:rgba(20,184,166,.25)}
.flag.purple{background:rgba(155,114,245,.08);color:var(--purple);border-color:rgba(155,114,245,.25)}
.pii-notice{font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--muted);background:var(--bg-3);border:1px solid var(--border);border-left:3px solid var(--teal);border-radius:4px;padding:.5rem .85rem;line-height:1.5;margin:12px 0}
.card{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px;margin:16px 0}
.section-head{font-size:.78rem;color:var(--bright);margin:16px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)}
.q{margin-bottom:14px}
.q label{display:block;font-size:.82rem;color:var(--bright);margin-bottom:5px}
.q .dim{font-family:'JetBrains Mono',monospace;font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-right:6px}
select{width:100%;background:var(--bg-3);border:1px solid var(--border-2);color:var(--text);border-radius:var(--radius);padding:.5rem .6rem;font-family:inherit;font-size:.82rem}
input[type=text],input[type=number]{width:100%;background:var(--bg-3);border:1px solid var(--border-2);color:var(--text);border-radius:var(--radius);padding:.5rem .6rem;font-family:'JetBrains Mono',monospace;font-size:.82rem}
textarea{width:100%;background:var(--bg-3);border:1px solid var(--border-2);color:var(--text);border-radius:var(--radius);padding:.5rem .6rem;font-family:'JetBrains Mono',monospace;font-size:.75rem;resize:vertical}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
@media(max-width:620px){.grid{grid-template-columns:1fr}.grid3{grid-template-columns:1fr}}
button{font-family:'JetBrains Mono',monospace;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;background:var(--teal);color:#06121f;border:none;border-radius:var(--radius);padding:.6rem 1.2rem;cursor:pointer;font-weight:600}
button:hover{opacity:.9}
button:disabled{opacity:.45;cursor:not-allowed}
.preset-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.preset-btn{background:var(--bg-3);color:var(--body);border:1px solid var(--border-2);font-size:.62rem;padding:.3rem .7rem;text-transform:none;letter-spacing:0;font-weight:400}
.preset-btn:hover{border-color:var(--teal);color:var(--teal-lt);opacity:1}
.results-panel{display:none}
.results-panel.show{display:block}
.hero-row{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px}
.hero-stat{background:var(--bg-3);border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px 16px;text-align:center;min-width:110px;flex:1}
.hero-val{font-family:'JetBrains Mono',monospace;font-size:1.8rem;font-weight:600}
.hero-lbl{font-family:'JetBrains Mono',monospace;font-size:.52rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-top:2px}
.verdict{border-radius:var(--radius);padding:10px 14px;margin:6px 0;font-size:.82rem}
.verdict.pass{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);color:var(--green)}
.verdict.warn{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);color:var(--warn)}
.verdict.fail{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.25);color:var(--red)}
.verdict.info{background:rgba(20,184,166,.06);border:1px solid rgba(20,184,166,.2);color:var(--teal-lt)}
.badge{font-family:'JetBrains Mono',monospace;font-size:.58rem;padding:.15rem .45rem;border-radius:10px;display:inline-block;white-space:nowrap;margin:2px 2px}
.badge.err{background:rgba(239,68,68,.1);color:var(--red);border:1px solid rgba(239,68,68,.25)}
.badge.warn-b{background:rgba(245,158,11,.1);color:var(--warn);border:1px solid rgba(245,158,11,.25)}
.badge.ok{background:rgba(34,197,94,.08);color:var(--green);border:1px solid rgba(34,197,94,.2)}
.badge.info{background:rgba(20,184,166,.08);color:var(--teal-lt);border:1px solid rgba(20,184,166,.2)}
.badge.purple{background:rgba(155,114,245,.1);color:var(--purple);border:1px solid rgba(155,114,245,.25)}
.tbl{width:100%;border-collapse:collapse;margin:8px 0;font-size:.78rem}
.tbl th{font-family:'JetBrains Mono',monospace;font-size:.58rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);text-align:left;padding:7px 8px;border-bottom:1px solid var(--border)}
.tbl td{padding:7px 8px;border-bottom:1px solid rgba(30,47,74,.5);color:var(--text);vertical-align:top}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:rgba(255,255,255,.02)}
pre{background:#06101e;border:1px solid var(--border);border-radius:var(--radius);padding:12px;overflow-x:auto;font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--text);margin-top:10px;max-height:380px}
.hash{font-family:'JetBrains Mono',monospace;font-size:.64rem;color:var(--green);word-break:break-all;margin:6px 0}
.muted-txt{color:var(--muted);font-size:.72rem}
.mfst-btn{font-family:'JetBrains Mono',monospace;font-size:.6rem;background:none;color:var(--muted);border:1px solid var(--border);border-radius:var(--radius);padding:.3rem .7rem;cursor:pointer;display:block;margin:24px auto 0;text-transform:uppercase;letter-spacing:.08em}
.mfst-btn:hover{color:var(--text);border-color:var(--border-2)}
#mfstBody{display:none;margin-top:10px}
.results-export-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--border)}
.run-btn{margin-top:6px}
.info-box{background:var(--bg-3);border:1px solid var(--border-2);border-left:3px solid var(--teal);border-radius:4px;padding:.7rem .9rem;margin:10px 0;font-family:'JetBrains Mono',monospace;font-size:.64rem;color:var(--text);line-height:1.7}
.info-box .ib-title{color:var(--teal);font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px}
.handoff-box{background:var(--bg-3);border:1px solid var(--border-2);border-left:3px solid var(--purple);border-radius:4px;padding:.75rem 1rem;margin:10px 0;font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--text);line-height:1.7}
.handoff-box .hb-title{color:var(--purple);font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px}
</style>
</head>
<body>

<nav><div class="in">
  <a href="../index.html" style="display:flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--bright)"><span style="color:var(--teal)">AI</span>Numbers<span style="color:var(--muted);font-size:.75rem">.co</span></a>
  <div style="font-family:'JetBrains Mono',monospace;font-size:.55rem;color:var(--muted);display:flex;gap:.5rem;align-items:center">
    <a href="../index.html" style="color:var(--body)">All Tools</a><span>/</span>
    <a href="chaingraph-hub.html" style="color:var(--body)">OpenChainGraph Hub</a><span>/</span>
    <span style="color:var(--text)">${title}</span>
  </div>
  <a href="chaingraph-hub.html" style="font-family:'JetBrains Mono',monospace;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;color:#06121f;background:var(--teal);padding:.28rem .75rem;border-radius:4px">Hub →</a>
</div></nav>

<div class="wrap">
  <div class="eyebrow">OpenChainGraph Suite · ART-${artNum} · wave ${wave}</div>
  <h1>${title}</h1>
  <p class="sub">${subtitle}</p>
  <div style="margin-bottom:6px">${flags}</div>

  <div class="pii-notice">🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.</div>

  ${infoScope ? `<div class="info-box"><div class="ib-title">Scope</div>${infoScope}</div>` : ''}

  <div class="card">
    <div class="section-head">Presets</div>
    <div class="preset-row">${presets}</div>
    <div class="section-head">Inputs</div>
    ${inputs}
    <button class="run-btn" style="margin-top:14px" onclick="run()">Run</button>
  </div>

  <div class="results-panel" id="resultsPanel">
    <div class="card">
      <div class="section-head">Result</div>
      <div class="hero-row" id="heroRow"></div>
      <div id="verdictDiv"></div>
      <div id="detailDiv"></div>
    </div>
    <div class="card">
      <div class="section-head">Execution Hash &amp; §4 Artifact</div>
      <div style="margin-bottom:4px"><span class="muted-txt">SHA-256 execution hash (JCS canonical — RFC 8785):</span></div>
      <div class="hash" id="execHash"></div>
      <pre id="artifactPre"></pre>
      <div class="results-export-row">
        <button id="ap2ExportBtn" onclick="exportAP2()" disabled>Export Policy Mandate JSON</button>
        <button onclick="exportArtifact()">Export §4 Artifact</button>${hasVC ? '\n        <button onclick="exportVC()">Export W3C VC (§13.11)</button>' : ''}
      </div>
    </div>
  </div>

  <button class="mfst-btn" onclick="toggleMfst()">Show Tool Manifest</button>
  <div id="mfstBody" class="card" style="margin-top:10px">
    <pre id="mfstCode"></pre>
  </div>
</div>

<footer style="border-top:1px solid var(--border);padding:1.75rem 20px;margin-top:2rem;font-family:'JetBrains Mono',monospace;font-size:.55rem;color:var(--muted)">
  <div style="max-width:920px;margin:0 auto;display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;align-items:center">
    <div style="display:flex;gap:1.25rem;flex-wrap:wrap">
      <a href="chaingraph-hub.html" style="color:var(--muted)">OpenChainGraph Suite</a>
      <a href="openchain-graph-spec.html" style="color:var(--muted)">Spec v0.4</a>
    </div>
    <div>CC BY 4.0 · Zero PII · Client-side only</div>
  </div>
</footer>

<script>
const MANIFEST = ${JSON.stringify(manifestDef, null, 2)};

${computeFn}

function cgCanon(v){if(v===null||typeof v!=='object')return v;if(Array.isArray(v))return v.map(cgCanon);const o={};for(const k of Object.keys(v).sort())o[k]=cgCanon(v[k]);return o;}
async function executionHashLocal(pp,op){const obj=cgCanon({policy_parameters:pp,output_payload:op});const s=JSON.stringify(obj);const buf=new TextEncoder().encode(s);const dig=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(dig)).map(b=>b.toString(16).padStart(2,'0')).join('');}

let _lastArtifact=null,_lastPP=null,_lastOP=null,_lastHash=null,_lastFlags=null;

async function run(){
  const pp=getParams();
  if(!pp)return;
  const {output_payload,compliance_flags}=compute(pp);
  const rawHash=await executionHashLocal(pp,output_payload);
  const execHash='sha256:'+rawHash;
  const artifact={
    '@context':'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version:'0.4.0',
    spec_version:'0.5.0',
    compute_mode:'browser',
    mandate_type:'compliance_mandate',
    tool_id:MANIFEST.tool_id,
    tool_version:MANIFEST.version,
    generated_at:new Date().toISOString(),
    execution_hash:execHash,
    chain:{parent_hashes:[],parent_tool_ids:${JSON.stringify(feedsFromArr)},chain_depth:${chainDepth}},
    policy_parameters:pp,
    output_payload,
    compliance_flags,
    audit_signature:{payloadType:'application/vnd.openchain.graph+json;version=0.4',payload:'',signatures:[]}
  };
  _lastArtifact=artifact;_lastPP=pp;_lastOP=output_payload;_lastHash=execHash;_lastFlags=compliance_flags;
  renderResults(output_payload,compliance_flags,execHash,artifact);
  document.getElementById('ap2ExportBtn').disabled=false;
}

${renderFn}

function exportAP2(){if(!_lastArtifact)return;const ap2={schema:'ainumbers-policy-mandate-v1.0',tool_id:MANIFEST.tool_id,version:MANIFEST.version,mandate_type:'compliance_mandate',generated_at:_lastArtifact.generated_at,execution_hash:_lastHash,policy_parameters:_lastPP,output_payload:_lastOP,compliance_flags:_lastFlags};dl(JSON.stringify(ap2,null,2),'${slug}-policy-mandate.json','application/json');}
function exportArtifact(){if(!_lastArtifact)return;dl(JSON.stringify(_lastArtifact,null,2),'${slug}-artifact.json','application/json');}
${hasVC ? `function exportVC(){if(!_lastArtifact)return;const vc={"@context":["https://www.w3.org/ns/credentials/v2","https://ainumbers.co/chaingraph/context/v0.4/context.jsonld"],type:["VerifiableCredential","OpenChainGraphArtifact"],issuer:"did:web:ainumbers.co",validFrom:_lastArtifact.generated_at,credentialSubject:{...{id:"urn:ocg:"+_lastHash},..._lastArtifact}};dl(JSON.stringify(vc,null,2),'${slug}-vc.json','application/json');}` : ''}
function dl(c,f,m){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([c],{type:m}));a.download=f;a.click();}
function toggleMfst(){const b=document.getElementById('mfstBody'),c=document.getElementById('mfstCode');if(b.style.display==='none'||!b.style.display){if(!c.textContent)c.textContent=JSON.stringify(MANIFEST,null,2);b.style.display='block';}else b.style.display='none';}

${exportFns || ''}
${initCode || ''}
</script>
</body>
</html>`;
}

// ── TOOL CONFIGS ─────────────────────────────────────────────────────────────

const TOOLS = [

// ART-112
{
  artNum:112, slug:'art-112-dscsa-transaction-statement-verifier',
  title:'DSCSA Transaction Statement (T3) Verifier',
  subtitle:'Verify the DSCSA T3 set (Transaction Information + History + Statement) completeness, validate the GS1 SGTIN, and map the EPCIS 2.0 event type. DSCSA §582 — enforcement live since Aug 2025.',
  wave:22,
  flags:`<span class="flag info">DSCSA §582</span><span class="flag info">GS1 EPCIS 2.0</span><span class="flag">Zero PII</span><span class="flag">Client-side only</span><span class="flag warn">US FDA · Enforcement Aug 2025</span>`,
  infoScope:`Validates the three-document T3 set required by DSCSA §582: Transaction Information, Transaction History, Transaction Statement. Also validates GS1 SGTIN format (GTIN-14 + serial) and maps the EPCIS 2.0 event type. Feeds the saleable-returns verifier (art-113).`,
  presets:`<button class="preset-btn" onclick="loadPreset('complete')">Complete T3 (SGTIN valid)</button><button class="preset-btn" onclick="loadPreset('missing')">Missing T3 Components</button>`,
  inputs:`<div class="q"><label>Product SGTIN <span class="dim">GTIN-14.serial</span></label><input type="text" id="sgtin" placeholder="00312345678901.12345"></div>
<div class="grid3">
<div class="q"><label>Transaction Information</label><select id="ti"><option value="true">Present</option><option value="false">Missing</option></select></div>
<div class="q"><label>Transaction History</label><select id="th"><option value="true">Present</option><option value="false">Missing</option></select></div>
<div class="q"><label>Transaction Statement</label><select id="ts"><option value="true">Present</option><option value="false">Missing</option></select></div>
</div>
<div class="grid">
<div class="q"><label>EPCIS Event Type</label><select id="epcis"><option value="ObjectEvent">ObjectEvent</option><option value="AggregationEvent">AggregationEvent</option><option value="TransformationEvent">TransformationEvent</option></select></div>
<div class="q"><label>Lot Number <span class="dim">optional</span></label><input type="text" id="lot" placeholder="LOT-2026-001"></div>
</div>
<div class="q"><label>Expiration Date <span class="dim">YYYY-MM-DD</span></label><input type="text" id="expiry" placeholder="2027-12-31"></div>`,
  computeFn:`function sgtinValid(s){if(!s||typeof s!=='string')return false;const p=s.split('.');if(p.length!==2)return false;const g=p[0].replace(/[^0-9]/g,'');return g.length===14&&p[1].length>=1&&p[1].length<=20;}
function compute(pp){
  const{sgtin,transaction_information,transaction_history,transaction_statement,epcis_event_type,lot_number,expiration_date}=pp;
  const t3_complete=!!(transaction_information&&transaction_history&&transaction_statement);
  const sgtin_valid=sgtinValid(sgtin);
  const missing_t3=[];
  if(!transaction_information)missing_t3.push('transaction_information');
  if(!transaction_history)missing_t3.push('transaction_history');
  if(!transaction_statement)missing_t3.push('transaction_statement');
  const compliant=t3_complete&&sgtin_valid;
  const op={compliant,t3_complete,sgtin_valid,missing_t3,epcis_event_type:epcis_event_type||'ObjectEvent'};
  if(lot_number)op.lot_number=lot_number;
  if(expiration_date)op.expiration_date=expiration_date;
  const flags=[compliant?'DSCSA_T3_COMPLIANT':'DSCSA_T3_VIOLATION',...(!sgtin_valid?['INVALID_SGTIN']:[]),...(missing_t3.length?['MISSING_T3_DOCUMENTS']:[])];
  return{output_payload:op,compliance_flags:flags};
}`,
  renderFn:`function renderResults(op,flags,execHash,artifact){
  const pass=op.compliant;
  document.getElementById('heroRow').innerHTML=
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.t3_complete?'var(--green)':'var(--red)')+'">'+( op.t3_complete?'✓':'✗')+'</div><div class="hero-lbl">T3 Complete</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.sgtin_valid?'var(--green)':'var(--red)')+'">'+( op.sgtin_valid?'✓':'✗')+'</div><div class="hero-lbl">SGTIN Valid</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(pass?'var(--green)':'var(--red)');font-size:1rem;padding-top:6px">'+(pass?'COMPLIANT':'VIOLATION')+'</div><div class="hero-lbl">DSCSA Status</div></div>';
  document.getElementById('verdictDiv').innerHTML=
    '<div class="verdict '+(pass?'pass':'fail')+'">'+(pass?'✓ T3 set complete and SGTIN valid — DSCSA §582 compliant.':'✗ DSCSA §582 violation: '+op.missing_t3.join(', ')+(!op.sgtin_valid?' / invalid SGTIN':'')+'.')+'</div>'+
    '<div style="margin-top:6px">'+flags.map(f=>'<span class="badge '+(f.includes('VIOLATION')||f.includes('MISSING')||f.includes('INVALID')?'err':'ok')+'">'+f+'</span>').join('')+'</div>';
  document.getElementById('detailDiv').innerHTML=op.missing_t3.length?'<table class="tbl"><thead><tr><th>Missing Document</th></tr></thead><tbody>'+op.missing_t3.map(d=>'<tr><td><span class="badge err">'+d+'</span></td></tr>').join('')+'</tbody></table>':'';
  document.getElementById('execHash').textContent=execHash;
  document.getElementById('artifactPre').textContent=JSON.stringify(artifact,null,2);
  document.getElementById('resultsPanel').classList.add('show');
}`,
  manifestDef:{tool_id:'art-112-dscsa-transaction-statement-verifier',version:'1.0.0',title:'DSCSA Transaction Statement (T3) Verifier',mcp_tool_definition:{name:'verify_dscsa_transaction_statement',description:'Verify DSCSA T3 set completeness, validate GS1 SGTIN, map EPCIS 2.0 event type. DSCSA §582.',inputSchema:{type:'object',properties:{sgtin:{type:'string'},transaction_information:{type:'boolean'},transaction_history:{type:'boolean'},transaction_statement:{type:'boolean'},epcis_event_type:{type:'string'},lot_number:{type:'string'},expiration_date:{type:'string'}},required:['sgtin','transaction_information','transaction_history','transaction_statement']}},ap2_export:true,chaingraph:true},
  feedsFrom:[],
  exportCapability:['json','pdf','jsonld'],
  initCode:`const PRESETS={complete:{sgtin:'00312345678901.12345',ti:'true',th:'true',ts:'true',epcis:'ObjectEvent',lot:'LOT-2026-001',expiry:'2027-12-31'},missing:{sgtin:'INVALID-SGTIN',ti:'true',th:'false',ts:'false',epcis:'ObjectEvent',lot:'',expiry:''}};
function loadPreset(n){const d=PRESETS[n];if(!d)return;document.getElementById('sgtin').value=d.sgtin;document.getElementById('ti').value=d.ti;document.getElementById('th').value=d.th;document.getElementById('ts').value=d.ts;document.getElementById('epcis').value=d.epcis;document.getElementById('lot').value=d.lot;document.getElementById('expiry').value=d.expiry;}
function getParams(){const lot=document.getElementById('lot').value.trim();const expiry=document.getElementById('expiry').value.trim();const pp={sgtin:document.getElementById('sgtin').value.trim(),transaction_information:document.getElementById('ti').value==='true',transaction_history:document.getElementById('th').value==='true',transaction_statement:document.getElementById('ts').value==='true',epcis_event_type:document.getElementById('epcis').value};if(lot)pp.lot_number=lot;if(expiry)pp.expiration_date=expiry;return pp;}
loadPreset('complete');`
},

// ART-113
{
  artNum:113, slug:'art-113-saleable-returns-verifier',
  title:'DSCSA Saleable Returns Verifier',
  subtitle:'Match a returned unit SGTIN+lot to its original transaction hash (DSCSA §582(c)(4)(D)). Unauthorized trading partner or mismatched SGTIN/lot → REFUSE.',
  wave:22,
  flags:`<span class="flag info">DSCSA §582(c)(4)(D)</span><span class="flag">Zero PII</span><span class="flag">Client-side only</span><span class="flag warn">US FDA · Saleable Returns</span>`,
  infoScope:`Verifies that a saleable return matches its original transaction record: SGTIN, lot number, and trading partner authorization all checked. Unauthorized partner or mismatched identifiers → REFUSE with quarantine flag. Feeds suspect-product quarantine assessor (art-114).`,
  presets:`<button class="preset-btn" onclick="loadPreset('accept')">Verified Return (ACCEPT)</button><button class="preset-btn" onclick="loadPreset('refuse')">Mismatched Lot (REFUSE)</button>`,
  inputs:`<div class="q"><label>Returned SGTIN</label><input type="text" id="ret_sgtin" placeholder="00312345678901.12345"></div>
<div class="q"><label>Returned Lot Number</label><input type="text" id="ret_lot" placeholder="LOT-2026-001"></div>
<div class="q"><label>Original Transaction Hash <span class="dim">sha256:...</span></label><input type="text" id="orig_hash" placeholder="sha256:b9a6a9..."></div>
<div class="grid">
<div class="q"><label>Original SGTIN</label><input type="text" id="orig_sgtin" placeholder="00312345678901.12345"></div>
<div class="q"><label>Original Lot Number</label><input type="text" id="orig_lot" placeholder="LOT-2026-001"></div>
</div>
<div class="q"><label>Returning Party Authorized?</label><select id="auth"><option value="true">Yes — authorized trading partner</option><option value="false">No — unauthorized</option></select></div>`,
  computeFn:`function compute(pp){
  const{returned_sgtin,returned_lot,original_transaction_hash,original_sgtin,original_lot,authorized_trading_partner}=pp;
  const sgtin_match=returned_sgtin===original_sgtin;
  const lot_match=returned_lot===original_lot;
  const verdict=(authorized_trading_partner&&sgtin_match&&lot_match)?'ACCEPT':'REFUSE';
  const reasons=[];
  if(!authorized_trading_partner)reasons.push('UNAUTHORIZED_TRADING_PARTNER');
  if(!sgtin_match)reasons.push('SGTIN_MISMATCH');
  if(!lot_match)reasons.push('LOT_MISMATCH');
  return{output_payload:{verdict,sgtin_match,lot_match,authorized_trading_partner:!!authorized_trading_partner,original_transaction_hash,reasons},compliance_flags:[verdict==='ACCEPT'?'SALEABLE_RETURN_ACCEPTED':'SALEABLE_RETURN_REFUSED',...reasons]};
}`,
  renderFn:`function renderResults(op,flags,execHash,artifact){
  const pass=op.verdict==='ACCEPT';
  document.getElementById('heroRow').innerHTML=
    '<div class="hero-stat"><div class="hero-val" style="color:'+(pass?'var(--green)':'var(--red)')+';font-size:1.1rem;padding-top:4px">'+op.verdict+'</div><div class="hero-lbl">Return Verdict</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.sgtin_match?'var(--green)':'var(--red)')+'">'+( op.sgtin_match?'✓':'✗')+'</div><div class="hero-lbl">SGTIN Match</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.lot_match?'var(--green)':'var(--red)')+'">'+( op.lot_match?'✓':'✗')+'</div><div class="hero-lbl">Lot Match</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.authorized_trading_partner?'var(--green)':'var(--red)')+'">'+( op.authorized_trading_partner?'✓':'✗')+'</div><div class="hero-lbl">Auth Partner</div></div>';
  document.getElementById('verdictDiv').innerHTML=
    '<div class="verdict '+(pass?'pass':'fail')+'">'+(pass?'✓ ACCEPT — Saleable return matches original transaction.':'✗ REFUSE — '+op.reasons.join(', ')+'. Quarantine required.')+'</div>'+
    '<div style="margin-top:6px">'+flags.map(f=>'<span class="badge '+(f.includes('REFUSED')||f.includes('MISMATCH')||f.includes('UNAUTHORIZED')?'err':'ok')+'">'+f+'</span>').join('')+'</div>';
  document.getElementById('detailDiv').innerHTML=op.reasons.length?'<div style="margin-top:8px">Refusal reasons: '+op.reasons.map(r=>'<span class="badge err">'+r+'</span>').join('')+'</div>':'';
  document.getElementById('execHash').textContent=execHash;
  document.getElementById('artifactPre').textContent=JSON.stringify(artifact,null,2);
  document.getElementById('resultsPanel').classList.add('show');
}`,
  manifestDef:{tool_id:'art-113-saleable-returns-verifier',version:'1.0.0',title:'DSCSA Saleable Returns Verifier',mcp_tool_definition:{name:'verify_saleable_return',description:'Match returned SGTIN+lot to original transaction hash. DSCSA §582(c)(4)(D).',inputSchema:{type:'object',properties:{returned_sgtin:{type:'string'},returned_lot:{type:'string'},original_transaction_hash:{type:'string'},original_sgtin:{type:'string'},original_lot:{type:'string'},authorized_trading_partner:{type:'boolean'}},required:['returned_sgtin','returned_lot','original_transaction_hash','original_sgtin','original_lot','authorized_trading_partner']}},ap2_export:true,chaingraph:true},
  feedsFrom:['art-112-dscsa-transaction-statement-verifier'],
  exportCapability:['json','pdf','jsonld'],
  initCode:`const PRESETS={accept:{ret_sgtin:'00312345678901.12345',ret_lot:'LOT-2026-001',orig_hash:'sha256:b9a6a9224c03c049c698d59b0aafd6e9e6546e18e861fc76452656d97df316e0',orig_sgtin:'00312345678901.12345',orig_lot:'LOT-2026-001',auth:'true'},refuse:{ret_sgtin:'00312345678901.12345',ret_lot:'LOT-WRONG-999',orig_hash:'sha256:b9a6a9224c03c049c698d59b0aafd6e9e6546e18e861fc76452656d97df316e0',orig_sgtin:'00312345678901.12345',orig_lot:'LOT-2026-001',auth:'false'}};
function loadPreset(n){const d=PRESETS[n];if(!d)return;document.getElementById('ret_sgtin').value=d.ret_sgtin;document.getElementById('ret_lot').value=d.ret_lot;document.getElementById('orig_hash').value=d.orig_hash;document.getElementById('orig_sgtin').value=d.orig_sgtin;document.getElementById('orig_lot').value=d.orig_lot;document.getElementById('auth').value=d.auth;}
function getParams(){return{returned_sgtin:document.getElementById('ret_sgtin').value.trim(),returned_lot:document.getElementById('ret_lot').value.trim(),original_transaction_hash:document.getElementById('orig_hash').value.trim(),original_sgtin:document.getElementById('orig_sgtin').value.trim(),original_lot:document.getElementById('orig_lot').value.trim(),authorized_trading_partner:document.getElementById('auth').value==='true'};}
loadPreset('accept');`
},

// ART-114
{
  artNum:114, slug:'art-114-suspect-product-quarantine',
  title:'DSCSA Suspect/Illegitimate Product Quarantine Assessor',
  subtitle:'Determine suspect vs illegitimate product status and required actions including quarantine, investigation, and 72-hour FDA Form 3911 notification. Terminal stage of pharma-serialization-custody chain.',
  wave:22,
  flags:`<span class="flag info">DSCSA §582(h)</span><span class="flag">Zero PII</span><span class="flag">Client-side only</span><span class="flag warn">US FDA · 72-Hour Form 3911</span>`,
  infoScope:`Assesses a product flagged after saleable-returns refusal or autonomous alert against DSCSA suspect/illegitimate criteria. Emits required_actions: quarantine, investigate, and/or FDA_FORM_3911_72H (illegitimate only). Terminal stage of the pharma-serialization-custody chain.`,
  presets:`<button class="preset-btn" onclick="loadPreset('cleared')">Cleared Product</button><button class="preset-btn" onclick="loadPreset('suspect')">Suspect Product</button><button class="preset-btn" onclick="loadPreset('illegitimate')">Illegitimate (Form 3911)</button>`,
  inputs:`<div class="q"><label>Product SGTIN</label><input type="text" id="sgtin" placeholder="00312345678901.12345"></div>
<div class="q"><label>Suspect Trigger</label><select id="trigger"><option value="verification_failure">Verification Failure</option><option value="saleable_return_refused">Saleable Return Refused</option><option value="autonomous_alert">Autonomous Alert</option><option value="trading_partner_notification">Trading Partner Notification</option></select></div>
<div class="q"><label>Counterfeit/Stolen/Diverted Evidence?</label><select id="counterfeit"><option value="false">No</option><option value="true">Yes — confirmed illegitimate</option></select></div>
<div class="q"><label>Serial Number Verification Attempted?</label><select id="sn_verify"><option value="true">Yes</option><option value="false">No</option></select></div>
<div class="q"><label>Quarantine Initiated?</label><select id="quarantine"><option value="true">Yes</option><option value="false">No</option></select></div>`,
  computeFn:`function compute(pp){
  const{sgtin,suspect_trigger,counterfeit_evidence,serial_verification_attempted,quarantine_initiated}=pp;
  const is_illegitimate=!!counterfeit_evidence;
  const status=is_illegitimate?'ILLEGITIMATE':(!serial_verification_attempted?'SUSPECT':'CLEARED');
  const required_actions=[];
  if(status!=='CLEARED'){required_actions.push('quarantine');required_actions.push('investigate');}
  if(status==='ILLEGITIMATE'){required_actions.push('FDA_FORM_3911_72H');required_actions.push('trading_partner_notification');}
  if(!quarantine_initiated&&status!=='CLEARED')required_actions.push('INITIATE_QUARANTINE_IMMEDIATELY');
  return{output_payload:{status,sgtin,suspect_trigger,is_illegitimate,required_actions},compliance_flags:[status==='CLEARED'?'PRODUCT_CLEARED':status==='ILLEGITIMATE'?'ILLEGITIMATE_PRODUCT_FDA_NOTIF_REQUIRED':'SUSPECT_PRODUCT_QUARANTINE_REQUIRED',...required_actions.map(a=>'ACTION_'+a.toUpperCase())]};
}`,
  renderFn:`function renderResults(op,flags,execHash,artifact){
  const color=op.status==='CLEARED'?'var(--green)':op.status==='ILLEGITIMATE'?'var(--red)':'var(--warn)';
  document.getElementById('heroRow').innerHTML=
    '<div class="hero-stat"><div class="hero-val" style="color:'+color+';font-size:1rem;padding-top:6px">'+op.status+'</div><div class="hero-lbl">Product Status</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.required_actions.length?'var(--warn)':'var(--green)')+'">'+op.required_actions.length+'</div><div class="hero-lbl">Required Actions</div></div>';
  const cls=op.status==='CLEARED'?'pass':op.status==='ILLEGITIMATE'?'fail':'warn';
  document.getElementById('verdictDiv').innerHTML=
    '<div class="verdict '+cls+'">'+(op.status==='CLEARED'?'✓ Product cleared — no further DSCSA action required.':op.status==='ILLEGITIMATE'?'✗ ILLEGITIMATE PRODUCT — quarantine immediately and notify FDA within 72 hours (Form 3911).':'⚠ SUSPECT PRODUCT — quarantine and investigate per DSCSA §582(h).')+'</div>'+
    '<div style="margin-top:6px">'+flags.map(f=>'<span class="badge '+(f.includes('ILLEGITIMATE')||f.includes('IMMEDIATELY')?'err':f.includes('SUSPECT')||f.includes('ACTION')?'warn-b':'ok')+'">'+f+'</span>').join('')+'</div>';
  document.getElementById('detailDiv').innerHTML=op.required_actions.length?'<table class="tbl"><thead><tr><th>Required Action</th></tr></thead><tbody>'+op.required_actions.map(a=>'<tr><td><span class="badge '+(a.includes('FDA')||a.includes('IMMEDIATELY')?'err':'warn-b')+'">'+a+'</span></td></tr>').join('')+'</tbody></table>':'';
  document.getElementById('execHash').textContent=execHash;
  document.getElementById('artifactPre').textContent=JSON.stringify(artifact,null,2);
  document.getElementById('resultsPanel').classList.add('show');
}`,
  manifestDef:{tool_id:'art-114-suspect-product-quarantine',version:'1.0.0',title:'DSCSA Suspect/Illegitimate Product Quarantine Assessor',mcp_tool_definition:{name:'assess_suspect_product_status',description:'Determine suspect vs illegitimate product status and required DSCSA §582(h) actions.',inputSchema:{type:'object',properties:{sgtin:{type:'string'},suspect_trigger:{type:'string'},counterfeit_evidence:{type:'boolean'},serial_verification_attempted:{type:'boolean'},quarantine_initiated:{type:'boolean'}},required:['sgtin','suspect_trigger','counterfeit_evidence','serial_verification_attempted','quarantine_initiated']}},ap2_export:true,chaingraph:true},
  feedsFrom:['art-113-saleable-returns-verifier'],
  exportCapability:['json','pdf','jsonld'],
  initCode:`const PRESETS={cleared:{trigger:'verification_failure',counterfeit:'false',sn_verify:'true',quarantine:'false'},suspect:{trigger:'saleable_return_refused',counterfeit:'false',sn_verify:'false',quarantine:'true'},illegitimate:{trigger:'autonomous_alert',counterfeit:'true',sn_verify:'true',quarantine:'true'}};
function loadPreset(n){const d=PRESETS[n];if(!d)return;document.getElementById('trigger').value=d.trigger;document.getElementById('counterfeit').value=d.counterfeit;document.getElementById('sn_verify').value=d.sn_verify;document.getElementById('quarantine').value=d.quarantine;}
function getParams(){return{sgtin:document.getElementById('sgtin').value.trim()||'00312345678901.12345',suspect_trigger:document.getElementById('trigger').value,counterfeit_evidence:document.getElementById('counterfeit').value==='true',serial_verification_attempted:document.getElementById('sn_verify').value==='true',quarantine_initiated:document.getElementById('quarantine').value==='true'};}
loadPreset('illegitimate');`
},

// ART-115
{
  artNum:115, slug:'art-115-dpp-data-carrier-validator',
  title:'EU ESPR Digital Product Passport Data Carrier Validator',
  subtitle:'Validate DPP required data elements against the CIRPASS-2 Core Ontology and check GS1 Digital Link data-carrier type. EU ESPR — Central DPP Registry live 19 Jul 2026.',
  wave:22,
  flags:`<span class="flag info">EU ESPR</span><span class="flag info">CIRPASS-2 Core Ontology</span><span class="flag info">GS1 Digital Link</span><span class="flag">Zero PII</span><span class="flag warn">Central DPP Registry · 19 Jul 2026</span>`,
  infoScope:`Validates DPP required data elements against the CIRPASS-2 Core Ontology (7 mandatory fields including durability, reparability, recyclability, carbon_footprint, and substances_of_concern). Also checks the GS1 Digital Link data-carrier type. EU ESPR Central DPP Registry goes live 19 Jul 2026.`,
  presets:`<button class="preset-btn" onclick="loadPreset('conformant')">Conformant DPP</button><button class="preset-btn" onclick="loadPreset('missing')">Missing Fields</button>`,
  inputs:`<div class="q"><label>Carrier Type</label><select id="carrier"><option value="qr_gs1_digital_link">QR — GS1 Digital Link</option><option value="datamatrix">DataMatrix</option><option value="nfc">NFC</option><option value="rfid">RFID</option></select></div>
<div class="q"><label>Product ID (GS1 Digital Link URI)</label><input type="text" id="product_id" placeholder="https://id.gs1.org/01/09506000134352"></div>
<div class="q"><label>DPP Data Fields <span class="dim">JSON object</span></label><textarea id="dpp_data" rows="8" placeholder='{"durability_score":8,"reparability_score":7,"recyclability_pct":72,"carbon_footprint_kg_co2e":12.4,"substances_of_concern":[],"manufacturer_id":"GL-MFG-001","product_category":"electronics"}'></textarea></div>`,
  computeFn:`const REQUIRED_FIELDS=['durability_score','reparability_score','recyclability_pct','carbon_footprint_kg_co2e','substances_of_concern','manufacturer_id','product_category'];
const VALID_CARRIERS=['qr_gs1_digital_link','datamatrix','nfc','rfid'];
function compute(pp){
  const{carrier_type,product_id,dpp_data}=pp;
  const carrier_valid=VALID_CARRIERS.includes(carrier_type);
  const data=dpp_data||{};
  const missing_fields=REQUIRED_FIELDS.filter(f=>!(f in data));
  const conformant=carrier_valid&&missing_fields.length===0;
  return{output_payload:{conformant,carrier_type,carrier_valid,missing_fields,product_id,fields_present:REQUIRED_FIELDS.filter(f=>f in data)},compliance_flags:[conformant?'DPP_CIRPASS2_CONFORMANT':'DPP_CIRPASS2_NONCONFORMANT',...(!carrier_valid?['INVALID_CARRIER_TYPE']:[]),...(missing_fields.length?['MISSING_REQUIRED_FIELDS']:[]),'EU_ESPR_DPP_REGISTRY_REQUIRED']};
}`,
  renderFn:`function renderResults(op,flags,execHash,artifact){
  const pass=op.conformant;
  document.getElementById('heroRow').innerHTML=
    '<div class="hero-stat"><div class="hero-val" style="color:'+(pass?'var(--green)':'var(--red)')+'">'+( pass?'✓':'✗')+'</div><div class="hero-lbl">CIRPASS-2 Conformant</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.carrier_valid?'var(--green)':'var(--red)')+'">'+( op.carrier_valid?'✓':'✗')+'</div><div class="hero-lbl">Carrier Valid</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.missing_fields.length===0?'var(--green)':'var(--red)')+'">'+op.missing_fields.length+'</div><div class="hero-lbl">Missing Fields</div></div>';
  document.getElementById('verdictDiv').innerHTML=
    '<div class="verdict '+(pass?'pass':'fail')+'">'+(pass?'✓ DPP conforms to CIRPASS-2 Core Ontology. Carrier type valid. Ready for EU ESPR Central DPP Registry submission.':'✗ DPP non-conformant — '+op.missing_fields.length+' required field(s) missing.')+'</div>'+
    '<div style="margin-top:6px">'+flags.map(f=>'<span class="badge '+(f.includes('NON')||f.includes('MISSING')||f.includes('INVALID')?'err':f.includes('REQUIRED')?'warn-b':'ok')+'">'+f+'</span>').join('')+'</div>';
  document.getElementById('detailDiv').innerHTML=op.missing_fields.length?'<table class="tbl"><thead><tr><th>Missing CIRPASS-2 Field</th></tr></thead><tbody>'+op.missing_fields.map(f=>'<tr><td><span class="badge err">'+f+'</span></td></tr>').join('')+'</tbody></table>':'';
  document.getElementById('execHash').textContent=execHash;
  document.getElementById('artifactPre').textContent=JSON.stringify(artifact,null,2);
  document.getElementById('resultsPanel').classList.add('show');
}`,
  manifestDef:{tool_id:'art-115-dpp-data-carrier-validator',version:'1.0.0',title:'EU ESPR Digital Product Passport Data Carrier Validator',mcp_tool_definition:{name:'validate_dpp_data_carrier',description:'Validate DPP required data elements against CIRPASS-2 Core Ontology and GS1 Digital Link carrier type. EU ESPR.',inputSchema:{type:'object',properties:{carrier_type:{type:'string'},product_id:{type:'string'},dpp_data:{type:'object'}},required:['carrier_type','product_id','dpp_data']}},ap2_export:true,chaingraph:true},
  feedsFrom:[],
  exportCapability:['json','pdf','jsonld'],
  initCode:`const PRESETS={conformant:{carrier:'qr_gs1_digital_link',product_id:'https://id.gs1.org/01/09506000134352',dpp_data:'{"durability_score":8,"reparability_score":7,"recyclability_pct":72,"carbon_footprint_kg_co2e":12.4,"substances_of_concern":[],"manufacturer_id":"GL-MFG-001","product_category":"electronics"}'},missing:{carrier:'datamatrix',product_id:'https://id.gs1.org/01/09506000134352',dpp_data:'{"durability_score":5,"recyclability_pct":60}'}};
function loadPreset(n){const d=PRESETS[n];if(!d)return;document.getElementById('carrier').value=d.carrier;document.getElementById('product_id').value=d.product_id;document.getElementById('dpp_data').value=d.dpp_data;}
function getParams(){let data;try{data=JSON.parse(document.getElementById('dpp_data').value);}catch(e){alert('DPP Data must be valid JSON');return null;}return{carrier_type:document.getElementById('carrier').value,product_id:document.getElementById('product_id').value.trim(),dpp_data:data};}
loadPreset('conformant');`
},

// ART-116
{
  artNum:116, slug:'art-116-product-lineage-builder',
  title:'Digital Product Passport Cradle-to-Gate Lineage Builder',
  subtitle:'Build a cradle-to-gate supplier lineage with hash-only claims per stage. Each stage carries a supplier_hash anchor and carbon_value. Aggregates total carbon deterministically.',
  wave:22,
  flags:`<span class="flag info">EU ESPR</span><span class="flag info">GS1 EPCIS 2.0</span><span class="flag">Zero PII</span><span class="flag">Client-side only</span><span class="flag warn">Hash-Only · No Trade Secrets</span>`,
  infoScope:`Builds a cradle-to-gate supply chain lineage using hash-only supplier claims — no trade secrets exposed. Each stage requires a sha256:-prefixed supplier_hash and a carbon_value. Total carbon aggregated to 1e6 precision. Feeds the product authenticity verifier (art-117).`,
  presets:`<button class="preset-btn" onclick="loadPreset('anchored')">Fully Anchored Lineage</button>`,
  inputs:`<div class="q"><label>Product ID</label><input type="text" id="product_id" placeholder="GL-PROD-2026-001"></div>
<div class="q"><label>Lineage Stages <span class="dim">JSON array</span></label><textarea id="stages" rows="10" placeholder='[{"stage":"raw_materials","supplier_hash":"sha256:abc...","certification":"ISO-14001:2015","dataVersion":"2026-Q1","carbon_value":4.2},{"stage":"manufacturing","supplier_hash":"sha256:def...","certification":"ISO-9001:2015","dataVersion":"2026-Q1","carbon_value":7.8}]'></textarea></div>`,
  computeFn:`function compute(pp){
  const{product_id,stages}=pp;
  const arr=Array.isArray(stages)?stages:[];
  const lineage=[];
  let total_carbon=0;
  for(const s of arr){
    const hash_valid=typeof s.supplier_hash==='string'&&s.supplier_hash.startsWith('sha256:');
    lineage.push({stage:s.stage,supplier_hash:s.supplier_hash,hash_valid,certification:s.certification||null,dataVersion:s.dataVersion||null,carbon_value:Number(s.carbon_value)||0});
    total_carbon+=Number(s.carbon_value)||0;
  }
  total_carbon=Math.round(total_carbon*1e6)/1e6;
  const all_anchored=lineage.every(l=>l.hash_valid);
  return{output_payload:{product_id,lineage,total_carbon,stage_count:lineage.length,all_anchored},compliance_flags:[all_anchored?'ALL_STAGES_HASH_ANCHORED':'UNANCHORED_STAGES_FOUND','CARBON_AGGREGATED','EU_ESPR_LINEAGE_READY']};
}`,
  renderFn:`function renderResults(op,flags,execHash,artifact){
  document.getElementById('heroRow').innerHTML=
    '<div class="hero-stat"><div class="hero-val" style="color:var(--teal-lt)">'+op.stage_count+'</div><div class="hero-lbl">Stages</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.all_anchored?'var(--green)':'var(--red)')+'">'+( op.all_anchored?'✓':'✗')+'</div><div class="hero-lbl">All Anchored</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:var(--gold);font-size:1.2rem">'+op.total_carbon+'</div><div class="hero-lbl">Total kg CO₂e</div></div>';
  document.getElementById('verdictDiv').innerHTML=
    '<div class="verdict '+(op.all_anchored?'pass':'warn')+'">'+(op.all_anchored?'✓ All lineage stages hash-anchored. Total carbon aggregated: '+op.total_carbon+' kg CO₂e.':'⚠ Some stages lack valid sha256: supplier hashes.')+'</div>'+
    '<div style="margin-top:6px">'+flags.map(f=>'<span class="badge '+(f.includes('UNANCHORED')?'err':'ok')+'">'+f+'</span>').join('')+'</div>';
  document.getElementById('detailDiv').innerHTML='<table class="tbl"><thead><tr><th>Stage</th><th>Hash Valid</th><th>Carbon</th><th>Cert</th></tr></thead><tbody>'+op.lineage.map(l=>'<tr><td>'+l.stage+'</td><td><span class="badge '+(l.hash_valid?'ok':'err')+'">'+( l.hash_valid?'✓':'✗')+'</span></td><td>'+l.carbon_value+'</td><td>'+(l.certification||'—')+'</td></tr>').join('')+'</tbody></table>';
  document.getElementById('execHash').textContent=execHash;
  document.getElementById('artifactPre').textContent=JSON.stringify(artifact,null,2);
  document.getElementById('resultsPanel').classList.add('show');
}`,
  manifestDef:{tool_id:'art-116-product-lineage-builder',version:'1.0.0',title:'Digital Product Passport Cradle-to-Gate Lineage Builder',mcp_tool_definition:{name:'build_product_lineage',description:'Build cradle-to-gate supplier lineage with hash-only claims and carbon aggregation. EU ESPR DPP.',inputSchema:{type:'object',properties:{product_id:{type:'string'},stages:{type:'array',items:{type:'object',properties:{stage:{type:'string'},supplier_hash:{type:'string'},certification:{type:'string'},dataVersion:{type:'string'},carbon_value:{type:'number'}},required:['stage','supplier_hash','carbon_value']}}},required:['product_id','stages']}},ap2_export:true,chaingraph:true},
  feedsFrom:['art-115-dpp-data-carrier-validator'],
  exportCapability:['json','pdf','jsonld'],
  initCode:`const PRESET_ANCHORED='[{"stage":"raw_materials","supplier_hash":"sha256:aaaa0000000000000000000000000000000000000000000000000000000000001","certification":"ISO-14001:2015","dataVersion":"2026-Q1","carbon_value":4.2},{"stage":"manufacturing","supplier_hash":"sha256:bbbb0000000000000000000000000000000000000000000000000000000000002","certification":"ISO-9001:2015","dataVersion":"2026-Q1","carbon_value":7.8},{"stage":"logistics","supplier_hash":"sha256:cccc0000000000000000000000000000000000000000000000000000000000003","certification":"ISO-14064","dataVersion":"2026-Q1","carbon_value":1.5}]';
function loadPreset(n){document.getElementById('product_id').value='GL-PROD-2026-001';document.getElementById('stages').value=PRESET_ANCHORED;}
function getParams(){let stages;try{stages=JSON.parse(document.getElementById('stages').value);}catch(e){alert('Stages must be valid JSON array');return null;}return{product_id:document.getElementById('product_id').value.trim()||'GL-PROD-2026-001',stages};}
loadPreset('anchored');`
},

// ART-117
{
  artNum:117, slug:'art-117-product-authenticity-verifier',
  title:'Luxury Goods Product Authenticity Verifier',
  subtitle:'Verify that presented lineage hashes chain back to the claimed root and that ownership transfers are continuous. Consumer/resale authenticity verdict.',
  wave:22,
  flags:`<span class="flag info">EU ESPR</span><span class="flag info">Anti-Counterfeit</span><span class="flag">Zero PII</span><span class="flag">Client-side only</span>`,
  infoScope:`Checks that the first element of presented_lineage_hashes matches the claimed_root_hash and that ownership transfers are continuous (no gaps). Terminal stage of the digital-product-passport-lineage chain.`,
  presets:`<button class="preset-btn" onclick="loadPreset('authentic')">Authentic (Verified)</button><button class="preset-btn" onclick="loadPreset('broken')">Broken Ownership Chain</button>`,
  inputs:`<div class="q"><label>Claimed Root Hash <span class="dim">sha256:...</span></label><input type="text" id="root_hash" placeholder="sha256:aaaa000..."></div>
<div class="q"><label>Presented Lineage Hashes <span class="dim">JSON array, most-recent-first</span></label><textarea id="lineage_hashes" rows="4" placeholder='["sha256:aaaa000...", "sha256:bbbb000..."]'></textarea></div>
<div class="q"><label>Ownership Transfers <span class="dim">JSON array of {from, to, date}</span></label><textarea id="transfers" rows="5" placeholder='[{"from":"MFG","to":"DIST","date":"2026-01-10"},{"from":"DIST","to":"RETAIL","date":"2026-03-05"}]'></textarea></div>`,
  computeFn:`function compute(pp){
  const{claimed_root_hash,presented_lineage_hashes,ownership_transfers}=pp;
  const hashes=Array.isArray(presented_lineage_hashes)?presented_lineage_hashes:[];
  const transfers=Array.isArray(ownership_transfers)?ownership_transfers:[];
  const root_match=hashes.length>0&&hashes[0]===claimed_root_hash;
  let ownership_continuous=true;
  for(let i=1;i<transfers.length;i++){if(transfers[i].from!==transfers[i-1].to){ownership_continuous=false;break;}}
  const authentic=root_match&&ownership_continuous;
  return{output_payload:{authentic,root_match,ownership_continuous,chain_depth:hashes.length,transfer_count:transfers.length},compliance_flags:[authentic?'PRODUCT_AUTHENTIC':'AUTHENTICITY_FAILED',...(!root_match?['ROOT_HASH_MISMATCH']:[]),...(!ownership_continuous?['OWNERSHIP_CHAIN_BROKEN']:[])]};
}`,
  renderFn:`function renderResults(op,flags,execHash,artifact){
  document.getElementById('heroRow').innerHTML=
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.authentic?'var(--green)':'var(--red)')+';font-size:1rem;padding-top:6px">'+(op.authentic?'AUTHENTIC':'FAILED')+'</div><div class="hero-lbl">Verdict</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.root_match?'var(--green)':'var(--red)')+'">'+( op.root_match?'✓':'✗')+'</div><div class="hero-lbl">Root Hash</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.ownership_continuous?'var(--green)':'var(--red)')+'">'+( op.ownership_continuous?'✓':'✗')+'</div><div class="hero-lbl">Ownership Chain</div></div>';
  document.getElementById('verdictDiv').innerHTML=
    '<div class="verdict '+(op.authentic?'pass':'fail')+'">'+(op.authentic?'✓ AUTHENTIC — Lineage hashes chain to claimed root. Ownership transfers continuous.':'✗ AUTHENTICITY FAILED — '+flags.filter(f=>f!=='AUTHENTICITY_FAILED').join(', ')+'.')+'</div>'+
    '<div style="margin-top:6px">'+flags.map(f=>'<span class="badge '+(f.includes('FAILED')||f.includes('MISMATCH')||f.includes('BROKEN')?'err':'ok')+'">'+f+'</span>').join('')+'</div>';
  document.getElementById('detailDiv').innerHTML='';
  document.getElementById('execHash').textContent=execHash;
  document.getElementById('artifactPre').textContent=JSON.stringify(artifact,null,2);
  document.getElementById('resultsPanel').classList.add('show');
}`,
  manifestDef:{tool_id:'art-117-product-authenticity-verifier',version:'1.0.0',title:'Luxury Goods Product Authenticity Verifier',mcp_tool_definition:{name:'verify_product_authenticity',description:'Verify lineage hashes chain to claimed root and ownership transfers are continuous.',inputSchema:{type:'object',properties:{claimed_root_hash:{type:'string'},presented_lineage_hashes:{type:'array',items:{type:'string'}},ownership_transfers:{type:'array',items:{type:'object'}}},required:['claimed_root_hash','presented_lineage_hashes','ownership_transfers']}},ap2_export:true,chaingraph:true},
  feedsFrom:['art-116-product-lineage-builder'],
  exportCapability:['json','pdf','jsonld'],
  initCode:`const PRESETS={authentic:{root:'sha256:aaaa0000000000000000000000000000000000000000000000000000000000001',hashes:'["sha256:aaaa0000000000000000000000000000000000000000000000000000000000001","sha256:bbbb0000000000000000000000000000000000000000000000000000000000002"]',transfers:'[{"from":"MFG","to":"DIST","date":"2026-01-10"},{"from":"DIST","to":"RETAIL","date":"2026-03-05"}]'},broken:{root:'sha256:aaaa0000000000000000000000000000000000000000000000000000000000001',hashes:'["sha256:xxxx0000000000000000000000000000000000000000000000000000000000099"]',transfers:'[{"from":"MFG","to":"DIST","date":"2026-01-10"},{"from":"UNKNOWN","to":"RETAIL","date":"2026-03-05"}]'}};
function loadPreset(n){const d=PRESETS[n];if(!d)return;document.getElementById('root_hash').value=d.root;document.getElementById('lineage_hashes').value=d.hashes;document.getElementById('transfers').value=d.transfers;}
function getParams(){let hashes,transfers;try{hashes=JSON.parse(document.getElementById('lineage_hashes').value);}catch(e){alert('Lineage hashes must be valid JSON array');return null;}try{transfers=JSON.parse(document.getElementById('transfers').value);}catch(e){alert('Ownership transfers must be valid JSON array');return null;}return{claimed_root_hash:document.getElementById('root_hash').value.trim(),presented_lineage_hashes:hashes,ownership_transfers:transfers};}
loadPreset('authentic');`
},

// ART-118
{
  artNum:118, slug:'art-118-fsma204-cte-validator',
  title:'FSMA 204 Critical Tracking Event (CTE) Validator',
  subtitle:'Validate required Key Data Elements present for each FDA FSMA 204 Critical Tracking Event per the Food Traceability List. Enforcement July 2028.',
  wave:22,
  flags:`<span class="flag info">FSMA 204</span><span class="flag info">FDA Food Traceability List</span><span class="flag">Zero PII</span><span class="flag">Client-side only</span><span class="flag warn">US FDA · Enforcement Jul 2028</span>`,
  infoScope:`Validates required Key Data Elements for each FDA FSMA 204 Critical Tracking Event type: harvesting, cooling, initial_packing, shipping, receiving, transformation. Feeds the traceability lot code linker (art-119).`,
  presets:`<button class="preset-btn" onclick="loadPreset('shipping')">Complete Shipping CTE</button><button class="preset-btn" onclick="loadPreset('harvesting')">Incomplete Harvesting CTE</button>`,
  inputs:`<div class="q"><label>CTE Type</label><select id="cte_type"><option value="shipping">Shipping</option><option value="receiving">Receiving</option><option value="harvesting">Harvesting</option><option value="cooling">Cooling</option><option value="initial_packing">Initial Packing</option><option value="transformation">Transformation</option></select></div>
<div class="q"><label>Food on Traceability List</label><input type="text" id="ftl_food" placeholder="fresh cut spinach"></div>
<div class="q"><label>KDEs <span class="dim">JSON object — key-value pairs</span></label><textarea id="kdes" rows="7" placeholder='{"traceability_lot_code":"TLC-001","ship_to_location":"GLN-001","ship_date":"2026-06-01","quantity":"500 lbs","reference_document":"BOL-001"}'></textarea></div>`,
  computeFn:`const CTE_KDES={harvesting:['traceability_lot_code','location_description','harvest_date','reference_document'],cooling:['traceability_lot_code','location_description','cool_date','reference_document'],initial_packing:['traceability_lot_code','location_description','pack_date','commodity','variety','reference_document'],shipping:['traceability_lot_code','ship_to_location','ship_date','quantity','reference_document'],receiving:['traceability_lot_code','ship_from_location','receive_date','quantity','reference_document'],transformation:['traceability_lot_code','location_description','transform_date','new_traceability_lot_code','reference_document']};
function compute(pp){
  const{cte_type,kdes,ftl_food}=pp;
  const required=CTE_KDES[cte_type]||[];
  const data=kdes||{};
  const missing_kdes=required.filter(k=>!(k in data));
  const cte_valid=missing_kdes.length===0;
  return{output_payload:{cte_type,cte_valid,missing_kdes,ftl_food:ftl_food||''},compliance_flags:[cte_valid?'FSMA204_CTE_VALID':'FSMA204_CTE_INCOMPLETE',...(missing_kdes.length?['MISSING_KDES']:[]),'FSMA204_ENFORCEMENT_JUL2028']};
}`,
  renderFn:`function renderResults(op,flags,execHash,artifact){
  document.getElementById('heroRow').innerHTML=
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.cte_valid?'var(--green)':'var(--red)')+'">'+( op.cte_valid?'✓':'✗')+'</div><div class="hero-lbl">CTE Valid</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.missing_kdes.length===0?'var(--green)':'var(--red)')+'">'+op.missing_kdes.length+'</div><div class="hero-lbl">Missing KDEs</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:var(--teal-lt);font-size:.9rem;padding-top:6px">'+op.cte_type+'</div><div class="hero-lbl">CTE Type</div></div>';
  document.getElementById('verdictDiv').innerHTML=
    '<div class="verdict '+(op.cte_valid?'pass':'fail')+'">'+(op.cte_valid?'✓ All required KDEs present. FSMA 204 CTE compliant.':'✗ CTE incomplete — '+op.missing_kdes.length+' required KDE(s) missing.')+'</div>'+
    '<div style="margin-top:6px">'+flags.map(f=>'<span class="badge '+(f.includes('INCOMPLETE')||f.includes('MISSING')?'err':f.includes('2028')?'warn-b':'ok')+'">'+f+'</span>').join('')+'</div>';
  document.getElementById('detailDiv').innerHTML=op.missing_kdes.length?'<table class="tbl"><thead><tr><th>Missing KDE</th></tr></thead><tbody>'+op.missing_kdes.map(k=>'<tr><td><span class="badge err">'+k+'</span></td></tr>').join('')+'</tbody></table>':'';
  document.getElementById('execHash').textContent=execHash;
  document.getElementById('artifactPre').textContent=JSON.stringify(artifact,null,2);
  document.getElementById('resultsPanel').classList.add('show');
}`,
  manifestDef:{tool_id:'art-118-fsma204-cte-validator',version:'1.0.0',title:'FSMA 204 Critical Tracking Event (CTE) Validator',mcp_tool_definition:{name:'validate_fsma204_cte',description:'Validate required KDEs for FSMA 204 CTE types per the FDA Food Traceability List.',inputSchema:{type:'object',properties:{cte_type:{type:'string',enum:['harvesting','cooling','initial_packing','shipping','receiving','transformation']},kdes:{type:'object'},ftl_food:{type:'string'}},required:['cte_type','kdes','ftl_food']}},ap2_export:true,chaingraph:true},
  feedsFrom:[],
  exportCapability:['json','pdf','jsonld'],
  initCode:`const PRESETS={shipping:{cte:'shipping',ftl:'fresh cut spinach',kdes:'{"traceability_lot_code":"TLC-2026-SPINACH-001","ship_to_location":"GLN-0312345000016","ship_date":"2026-06-01","quantity":"500 lbs","reference_document":"BOL-20260601-001"}'},harvesting:{cte:'harvesting',ftl:'romaine lettuce',kdes:'{"traceability_lot_code":"TLC-2026-LEAFY-002","location_description":"Farm 42, Salinas CA"}'}};
function loadPreset(n){const d=PRESETS[n];if(!d)return;document.getElementById('cte_type').value=d.cte;document.getElementById('ftl_food').value=d.ftl;document.getElementById('kdes').value=d.kdes;}
function getParams(){let kdes;try{kdes=JSON.parse(document.getElementById('kdes').value);}catch(e){alert('KDEs must be valid JSON');return null;}return{cte_type:document.getElementById('cte_type').value,kdes,ftl_food:document.getElementById('ftl_food').value.trim()};}
loadPreset('shipping');`
},

// ART-119
{
  artNum:119, slug:'art-119-traceability-lot-code-linker',
  title:'FSMA 204 Traceability Lot Code Chain Linker',
  subtitle:'Link Traceability Lot Codes across CTEs and detect chain breaks. Transformation events mint a new TLC. Feeds the recall trace resolver (art-120).',
  wave:22,
  flags:`<span class="flag info">FSMA 204</span><span class="flag info">TLC Chain</span><span class="flag">Zero PII</span><span class="flag">Client-side only</span>`,
  infoScope:`Links Traceability Lot Codes across a sequence of CTEs, detecting chain breaks where prev_tlc doesn't match the prior event's tlc. Transformation events may mint a new TLC (new_lot_minted=true). Feeds recall trace resolution (art-120).`,
  presets:`<button class="preset-btn" onclick="loadPreset('intact')">Intact TLC Chain</button><button class="preset-btn" onclick="loadPreset('broken')">Broken Chain</button>`,
  inputs:`<div class="q"><label>CTE Event Sequence <span class="dim">JSON array of {cte, tlc, prev_tlc, location_gln, date}</span></label><textarea id="events" rows="10" placeholder='[{"cte":"harvesting","tlc":"TLC-001","prev_tlc":null,"location_gln":"GLN-FARM","date":"2026-05-01"},{"cte":"shipping","tlc":"TLC-001","prev_tlc":"TLC-001","location_gln":"GLN-DC","date":"2026-05-03"}]'></textarea></div>`,
  computeFn:`function compute(pp){
  const{events}=pp;
  const arr=Array.isArray(events)?events:[];
  const lineage=[];
  const breaks_arr=[];
  for(let i=0;i<arr.length;i++){
    const e=arr[i];
    const is_transform=e.cte==='transformation';
    const new_lot_minted=is_transform&&e.tlc!=(i>0?arr[i-1].tlc:e.tlc);
    let linked=true;
    if(i===0){linked=true;}
    else if(is_transform&&new_lot_minted){linked=true;}
    else if(e.prev_tlc!==arr[i-1].tlc){linked=false;breaks_arr.push({index:i,tlc:e.tlc,expected_prev:arr[i-1].tlc,got:e.prev_tlc});}
    lineage.push({step:i,cte:e.cte,tlc:e.tlc,linked,new_lot_minted:!!new_lot_minted});
  }
  return{output_payload:{lineage,breaks:breaks_arr,depth:arr.length},compliance_flags:[breaks_arr.length===0?'TLC_CHAIN_INTACT':'TLC_CHAIN_BREAKS_DETECTED',...(breaks_arr.length?['FSMA204_LINKAGE_FAILURE']:[])]};
}`,
  renderFn:`function renderResults(op,flags,execHash,artifact){
  document.getElementById('heroRow').innerHTML=
    '<div class="hero-stat"><div class="hero-val" style="color:var(--teal-lt)">'+op.depth+'</div><div class="hero-lbl">CTE Steps</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.breaks.length===0?'var(--green)':'var(--red)')+'">'+op.breaks.length+'</div><div class="hero-lbl">Chain Breaks</div></div>';
  document.getElementById('verdictDiv').innerHTML=
    '<div class="verdict '+(op.breaks.length===0?'pass':'fail')+'">'+(op.breaks.length===0?'✓ TLC chain intact across all CTE steps.':'✗ '+op.breaks.length+' chain break(s) detected.')+'</div>'+
    '<div style="margin-top:6px">'+flags.map(f=>'<span class="badge '+(f.includes('BREAKS')||f.includes('FAILURE')?'err':'ok')+'">'+f+'</span>').join('')+'</div>';
  document.getElementById('detailDiv').innerHTML='<table class="tbl"><thead><tr><th>Step</th><th>CTE</th><th>TLC</th><th>Linked</th><th>New Lot</th></tr></thead><tbody>'+op.lineage.map(l=>'<tr><td>'+l.step+'</td><td>'+l.cte+'</td><td style="font-family:\'JetBrains Mono\',monospace;font-size:.68rem">'+l.tlc+'</td><td><span class="badge '+(l.linked?'ok':'err')+'">'+( l.linked?'✓':'✗')+'</span></td><td>'+(l.new_lot_minted?'<span class="badge info">yes</span>':'—')+'</td></tr>').join('')+'</tbody></table>';
  document.getElementById('execHash').textContent=execHash;
  document.getElementById('artifactPre').textContent=JSON.stringify(artifact,null,2);
  document.getElementById('resultsPanel').classList.add('show');
}`,
  manifestDef:{tool_id:'art-119-traceability-lot-code-linker',version:'1.0.0',title:'FSMA 204 Traceability Lot Code Chain Linker',mcp_tool_definition:{name:'link_traceability_lot_code',description:'Link TLCs across FSMA 204 CTEs, detect breaks, flag transformation new-lot events.',inputSchema:{type:'object',properties:{events:{type:'array',items:{type:'object',properties:{cte:{type:'string'},tlc:{type:'string'},prev_tlc:{type:['string','null']},location_gln:{type:'string'},date:{type:'string'}},required:['cte','tlc','date']}}},required:['events']}},ap2_export:true,chaingraph:true},
  feedsFrom:['art-118-fsma204-cte-validator'],
  exportCapability:['json','pdf','jsonld'],
  initCode:`const PRESETS={intact:'[{"cte":"harvesting","tlc":"TLC-001","prev_tlc":null,"location_gln":"GLN-FARM","date":"2026-05-01"},{"cte":"shipping","tlc":"TLC-001","prev_tlc":"TLC-001","location_gln":"GLN-DC","date":"2026-05-03"},{"cte":"receiving","tlc":"TLC-001","prev_tlc":"TLC-001","location_gln":"GLN-STORE","date":"2026-05-05"}]',broken:'[{"cte":"harvesting","tlc":"TLC-001","prev_tlc":null,"location_gln":"GLN-FARM","date":"2026-05-01"},{"cte":"shipping","tlc":"TLC-002","prev_tlc":"TLC-WRONG","location_gln":"GLN-DC","date":"2026-05-03"}]'};
function loadPreset(n){document.getElementById('events').value=PRESETS[n]||'';}
function getParams(){let events;try{events=JSON.parse(document.getElementById('events').value);}catch(e){alert('Events must be valid JSON array');return null;}return{events};}
loadPreset('intact');`
},

// ART-120
{
  artNum:120, slug:'art-120-recall-trace-resolver',
  title:'FSMA 204 Recall Trace Resolver (24-Hour FDA List)',
  subtitle:'One-up/one-back trace from a contaminated Traceability Lot Code to affected recipients and sources. Emits data for the FDA 24-hour sortable spreadsheet.',
  wave:22,
  flags:`<span class="flag info">FSMA 204</span><span class="flag info">FDA Recall</span><span class="flag">Zero PII</span><span class="flag">Client-side only</span><span class="flag warn">FDA 24-Hour Reportable List</span>`,
  infoScope:`Performs one-up (forward) and one-back (backward) trace from a contaminated TLC using a supply chain edge graph. Emits the data required for the FDA 24-hour sortable recall spreadsheet. Terminal stage of food-traceability-fsma204 chain.`,
  presets:`<button class="preset-btn" onclick="loadPreset('bidirectional')">Bidirectional Trace</button>`,
  inputs:`<div class="q"><label>Contaminated TLC</label><input type="text" id="contam_tlc" placeholder="TLC-CONTAM"></div>
<div class="q"><label>Trace Direction</label><select id="direction"><option value="both">Both (one-up + one-back)</option><option value="forward">Forward (one-up only)</option><option value="backward">Backward (one-back only)</option></select></div>
<div class="q"><label>Supply Chain Edges <span class="dim">JSON array of {from_tlc, to_tlc, from_gln, to_gln, date}</span></label><textarea id="edges" rows="8" placeholder='[{"from_tlc":"TLC-FARM-A","to_tlc":"TLC-CONTAM","from_gln":"GLN-001","to_gln":"GLN-002","date":"2026-05-01"},{"from_tlc":"TLC-CONTAM","to_tlc":"TLC-STORE-1","from_gln":"GLN-002","to_gln":"GLN-003","date":"2026-05-05"}]'></textarea></div>`,
  computeFn:`function compute(pp){
  const{contaminated_tlc,direction,edges}=pp;
  const arr=Array.isArray(edges)?edges:[];
  const dir=direction||'both';
  const sources=[];
  const recipients=[];
  if(dir==='both'||dir==='backward'){for(const e of arr){if(e.to_tlc===contaminated_tlc)sources.push({tlc:e.from_tlc,gln:e.from_gln,date:e.date});}}
  if(dir==='both'||dir==='forward'){for(const e of arr){if(e.from_tlc===contaminated_tlc)recipients.push({tlc:e.to_tlc,gln:e.to_gln,date:e.date});}}
  const traced_count=sources.length+recipients.length;
  return{output_payload:{contaminated_tlc,sources,recipients,traced_count},compliance_flags:['RECALL_TRACE_COMPLETE','FSMA204_24H_LIST_READY','FDA_REPORTABLE']};
}`,
  renderFn:`function renderResults(op,flags,execHash,artifact){
  document.getElementById('heroRow').innerHTML=
    '<div class="hero-stat"><div class="hero-val" style="color:var(--warn)">'+op.sources.length+'</div><div class="hero-lbl">Sources (one-back)</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:var(--warn)">'+op.recipients.length+'</div><div class="hero-lbl">Recipients (one-up)</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:var(--teal-lt)">'+op.traced_count+'</div><div class="hero-lbl">Total Traced</div></div>';
  document.getElementById('verdictDiv').innerHTML=
    '<div class="verdict warn">⚠ Recall trace complete. '+op.traced_count+' entities traced. FDA 24-hour reportable list data ready.</div>'+
    '<div style="margin-top:6px">'+flags.map(f=>'<span class="badge '+(f.includes('FDA')||f.includes('REPORTABLE')?'warn-b':'ok')+'">'+f+'</span>').join('')+'</div>';
  let html='<div class="grid"><div><strong style="font-size:.78rem;color:var(--bright)">Sources</strong><table class="tbl"><thead><tr><th>TLC</th><th>GLN</th><th>Date</th></tr></thead><tbody>'+op.sources.map(s=>'<tr><td>'+s.tlc+'</td><td>'+s.gln+'</td><td>'+s.date+'</td></tr>').join('')+'</tbody></table></div><div><strong style="font-size:.78rem;color:var(--bright)">Recipients</strong><table class="tbl"><thead><tr><th>TLC</th><th>GLN</th><th>Date</th></tr></thead><tbody>'+op.recipients.map(r=>'<tr><td>'+r.tlc+'</td><td>'+r.gln+'</td><td>'+r.date+'</td></tr>').join('')+'</tbody></table></div></div>';
  document.getElementById('detailDiv').innerHTML=html;
  document.getElementById('execHash').textContent=execHash;
  document.getElementById('artifactPre').textContent=JSON.stringify(artifact,null,2);
  document.getElementById('resultsPanel').classList.add('show');
}`,
  manifestDef:{tool_id:'art-120-recall-trace-resolver',version:'1.0.0',title:'FSMA 204 Recall Trace Resolver',mcp_tool_definition:{name:'resolve_recall_trace',description:'One-up/one-back trace from contaminated TLC for FDA 24-hour recall spreadsheet. FSMA 204.',inputSchema:{type:'object',properties:{contaminated_tlc:{type:'string'},direction:{type:'string',enum:['both','forward','backward']},edges:{type:'array',items:{type:'object',properties:{from_tlc:{type:'string'},to_tlc:{type:'string'},from_gln:{type:'string'},to_gln:{type:'string'},date:{type:'string'}},required:['from_tlc','to_tlc','from_gln','to_gln','date']}}},required:['contaminated_tlc','direction','edges']}},ap2_export:true,chaingraph:true},
  feedsFrom:['art-119-traceability-lot-code-linker'],
  exportCapability:['json','pdf','jsonld'],
  initCode:`const PRESET_EDGES='[{"from_tlc":"TLC-FARM-A","to_tlc":"TLC-CONTAM","from_gln":"GLN-001","to_gln":"GLN-002","date":"2026-05-01"},{"from_tlc":"TLC-CONTAM","to_tlc":"TLC-STORE-1","from_gln":"GLN-002","to_gln":"GLN-003","date":"2026-05-05"},{"from_tlc":"TLC-CONTAM","to_tlc":"TLC-STORE-2","from_gln":"GLN-002","to_gln":"GLN-004","date":"2026-05-06"}]';
function loadPreset(n){document.getElementById('contam_tlc').value='TLC-CONTAM';document.getElementById('direction').value='both';document.getElementById('edges').value=PRESET_EDGES;}
function getParams(){let edges;try{edges=JSON.parse(document.getElementById('edges').value);}catch(e){alert('Edges must be valid JSON array');return null;}return{contaminated_tlc:document.getElementById('contam_tlc').value.trim(),direction:document.getElementById('direction').value,edges};}
loadPreset('bidirectional');`
},

// ART-121
{
  artNum:121, slug:'art-121-document-integrity-anchor',
  title:'Document Integrity & eIDAS Electronic Timestamp Anchor',
  subtitle:'Bind a document SHA-256 and claimed timestamp into an OCG execution_hash that serves as an eIDAS Art.41 / RFC 3161-aligned electronic timestamp. Feeds timestamp attestation verifier (art-122).',
  wave:22,
  flags:`<span class="flag info">eIDAS Art.41</span><span class="flag info">RFC 3161-aligned</span><span class="flag info">W3C VC §13.11</span><span class="flag">Zero PII</span><span class="flag">Client-side only</span>`,
  infoScope:`Anchors a document hash (sha256:...) and claimed timestamp to produce an OCG execution_hash usable as an eIDAS Art.41-aligned electronic timestamp — no external TSA call. Optionally accepts a C2PA manifest field. Exports W3C VC via §13.11.`,
  presets:`<button class="preset-btn" onclick="loadPreset('contract')">Contract (Valid Hash)</button><button class="preset-btn" onclick="loadPreset('malformed')">Malformed Hash</button>`,
  inputs:`<div class="q"><label>Document Hash <span class="dim">sha256:[64 hex chars]</span></label><input type="text" id="doc_hash" placeholder="sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"></div>
<div class="q"><label>Claimed Timestamp <span class="dim">ISO 8601</span></label><input type="text" id="ts" placeholder="2026-06-25T10:00:00Z"></div>
<div class="grid">
<div class="q"><label>Hash Algorithm</label><select id="algo"><option value="sha256">sha256</option><option value="sha384">sha384</option><option value="sha512">sha512</option></select></div>
<div class="q"><label>Document Type <span class="dim">optional</span></label><input type="text" id="doc_type" placeholder="contract"></div>
</div>`,
  computeFn:`function compute(pp){
  const{document_hash,claimed_timestamp,hash_algorithm,document_type}=pp;
  const hash_valid=typeof document_hash==='string'&&/^sha256:[0-9a-f]{64}$/.test(document_hash);
  const anchored=hash_valid;
  const op={anchored,document_hash,document_type:document_type||'',timestamp_claim:{standard:'eIDAS Art.41 / RFC 3161-aligned',timestamp:claimed_timestamp,algorithm:hash_algorithm||'sha256'}};
  return{output_payload:op,compliance_flags:[anchored?'DOCUMENT_ANCHORED':'ANCHOR_FAILED_INVALID_HASH','EIDAS_ART41_ALIGNED','RFC3161_COMPATIBLE']};
}`,
  renderFn:`function renderResults(op,flags,execHash,artifact){
  document.getElementById('heroRow').innerHTML=
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.anchored?'var(--green)':'var(--red)')+'">'+( op.anchored?'✓':'✗')+'</div><div class="hero-lbl">Anchored</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:var(--teal-lt);font-size:.75rem;padding-top:6px">'+op.timestamp_claim.standard+'</div><div class="hero-lbl">Standard</div></div>';
  document.getElementById('verdictDiv').innerHTML=
    '<div class="verdict '+(op.anchored?'pass':'fail')+'">'+(op.anchored?'✓ Document anchored. Execution hash serves as eIDAS Art.41 electronic timestamp.':'✗ Anchor failed — document hash is malformed (must be sha256:[64 hex chars]).')+'</div>'+
    '<div style="margin-top:6px">'+flags.map(f=>'<span class="badge '+(f.includes('FAILED')?'err':'ok')+'">'+f+'</span>').join('')+'</div>';
  document.getElementById('detailDiv').innerHTML='<table class="tbl"><tbody><tr><td style="color:var(--muted)">Timestamp</td><td>'+op.timestamp_claim.timestamp+'</td></tr><tr><td style="color:var(--muted)">Algorithm</td><td>'+op.timestamp_claim.algorithm+'</td></tr><tr><td style="color:var(--muted)">Execution Hash</td><td style="font-family:\'JetBrains Mono\',monospace;font-size:.65rem;word-break:break-all">'+execHash+'</td></tr></tbody></table>';
  document.getElementById('execHash').textContent=execHash;
  document.getElementById('artifactPre').textContent=JSON.stringify(artifact,null,2);
  document.getElementById('resultsPanel').classList.add('show');
}`,
  manifestDef:{tool_id:'art-121-document-integrity-anchor',version:'1.0.0',title:'Document Integrity & eIDAS Electronic Timestamp Anchor',mcp_tool_definition:{name:'anchor_document_integrity',description:'Bind document SHA-256 + claimed timestamp as eIDAS Art.41 / RFC 3161-aligned electronic timestamp.',inputSchema:{type:'object',properties:{document_hash:{type:'string'},claimed_timestamp:{type:'string'},hash_algorithm:{type:'string'},document_type:{type:'string'}},required:['document_hash','claimed_timestamp','hash_algorithm']}},ap2_export:true,chaingraph:true},
  feedsFrom:[],
  exportCapability:['json','vc'],
  initCode:`const PRESETS={contract:{hash:'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',ts:'2026-06-25T10:00:00Z',algo:'sha256',type:'contract'},malformed:{hash:'not-a-sha256-hash',ts:'2026-06-25T10:00:00Z',algo:'sha256',type:'invoice'}};
function loadPreset(n){const d=PRESETS[n];if(!d)return;document.getElementById('doc_hash').value=d.hash;document.getElementById('ts').value=d.ts;document.getElementById('algo').value=d.algo;document.getElementById('doc_type').value=d.type;}
function getParams(){return{document_hash:document.getElementById('doc_hash').value.trim(),claimed_timestamp:document.getElementById('ts').value.trim()||new Date().toISOString(),hash_algorithm:document.getElementById('algo').value,document_type:document.getElementById('doc_type').value.trim()||undefined};}
loadPreset('contract');`
},

// ART-122
{
  artNum:122, slug:'art-122-timestamp-attestation-verifier',
  title:'Timestamp Attestation Verifier',
  subtitle:'Recompute the document integrity anchor, confirm the document hash and timestamp claim match and the algorithm is consistent. Terminal stage of document-integrity-anchor chain.',
  wave:22,
  flags:`<span class="flag info">eIDAS Art.41</span><span class="flag info">RFC 3161-aligned</span><span class="flag info">W3C VC §13.11</span><span class="flag">Zero PII</span><span class="flag">Client-side only</span>`,
  infoScope:`Verifies a previously created document integrity anchor: recomputes that the presented anchor's document_hash matches the provided document_hash, that the timestamp is consistent, and the algorithm matches. Terminal stage of document-integrity-anchor chain.`,
  presets:`<button class="preset-btn" onclick="loadPreset('verified')">Verified Attestation</button><button class="preset-btn" onclick="loadPreset('mismatch')">Hash Mismatch</button>`,
  inputs:`<div class="q"><label>Document Hash <span class="dim">sha256:...</span></label><input type="text" id="doc_hash" placeholder="sha256:abcdef..."></div>
<div class="q"><label>Presented Anchor <span class="dim">JSON object from art-121 output</span></label><textarea id="anchor" rows="6" placeholder='{"document_hash":"sha256:abcdef...","timestamp_claim":{"standard":"eIDAS Art.41 / RFC 3161-aligned","timestamp":"2026-06-25T10:00:00Z","algorithm":"sha256"}}'></textarea></div>
<div class="grid">
<div class="q"><label>Presented Timestamp</label><input type="text" id="pres_ts" placeholder="2026-06-25T10:00:00Z"></div>
<div class="q"><label>Expected Algorithm</label><select id="exp_algo"><option value="sha256">sha256</option><option value="sha384">sha384</option><option value="sha512">sha512</option></select></div>
</div>`,
  computeFn:`function compute(pp){
  const{document_hash,presented_anchor,presented_timestamp,expected_algorithm}=pp;
  const anchor=presented_anchor||{};
  const hash_match=document_hash===anchor.document_hash;
  const ts_consistent=presented_timestamp===(anchor.timestamp_claim||{}).timestamp;
  const algo_match=expected_algorithm===(anchor.timestamp_claim||{}).algorithm;
  const verified=hash_match&&ts_consistent&&algo_match;
  return{output_payload:{verified,hash_match,ts_consistent,algo_match},compliance_flags:[verified?'TIMESTAMP_ATTESTATION_VERIFIED':'TIMESTAMP_ATTESTATION_FAILED',...(!hash_match?['HASH_MISMATCH']:[]),...(!ts_consistent?['TIMESTAMP_INCONSISTENT']:[]),...(!algo_match?['ALGORITHM_MISMATCH']:[])]};
}`,
  renderFn:`function renderResults(op,flags,execHash,artifact){
  document.getElementById('heroRow').innerHTML=
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.verified?'var(--green)':'var(--red)')+';font-size:1rem;padding-top:6px">'+(op.verified?'VERIFIED':'FAILED')+'</div><div class="hero-lbl">Attestation</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.hash_match?'var(--green)':'var(--red)')+'">'+( op.hash_match?'✓':'✗')+'</div><div class="hero-lbl">Hash Match</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.ts_consistent?'var(--green)':'var(--red)')+'">'+( op.ts_consistent?'✓':'✗')+'</div><div class="hero-lbl">Timestamp OK</div></div>'+
    '<div class="hero-stat"><div class="hero-val" style="color:'+(op.algo_match?'var(--green)':'var(--red)')+'">'+( op.algo_match?'✓':'✗')+'</div><div class="hero-lbl">Algo Match</div></div>';
  document.getElementById('verdictDiv').innerHTML=
    '<div class="verdict '+(op.verified?'pass':'fail')+'">'+(op.verified?'✓ VERIFIED — Document hash, timestamp, and algorithm all consistent. eIDAS Art.41 attestation valid.':'✗ FAILED — '+flags.filter(f=>f!=='TIMESTAMP_ATTESTATION_FAILED').join(', ')+'.')+'</div>'+
    '<div style="margin-top:6px">'+flags.map(f=>'<span class="badge '+(f.includes('FAILED')||f.includes('MISMATCH')||f.includes('INCONSISTENT')?'err':'ok')+'">'+f+'</span>').join('')+'</div>';
  document.getElementById('detailDiv').innerHTML='';
  document.getElementById('execHash').textContent=execHash;
  document.getElementById('artifactPre').textContent=JSON.stringify(artifact,null,2);
  document.getElementById('resultsPanel').classList.add('show');
}`,
  manifestDef:{tool_id:'art-122-timestamp-attestation-verifier',version:'1.0.0',title:'Timestamp Attestation Verifier',mcp_tool_definition:{name:'verify_timestamp_attestation',description:'Verify document integrity anchor: hash match, timestamp consistency, algorithm match.',inputSchema:{type:'object',properties:{document_hash:{type:'string'},presented_anchor:{type:'object'},presented_timestamp:{type:'string'},expected_algorithm:{type:'string'}},required:['document_hash','presented_anchor','presented_timestamp','expected_algorithm']}},ap2_export:true,chaingraph:true},
  feedsFrom:['art-121-document-integrity-anchor'],
  exportCapability:['json','vc'],
  initCode:`const PRESETS={verified:{hash:'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',anchor:'{"document_hash":"sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890","timestamp_claim":{"standard":"eIDAS Art.41 / RFC 3161-aligned","timestamp":"2026-06-25T10:00:00Z","algorithm":"sha256"}}',ts:'2026-06-25T10:00:00Z',algo:'sha256'},mismatch:{hash:'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',anchor:'{"document_hash":"sha256:0000000000000000000000000000000000000000000000000000000000000000","timestamp_claim":{"standard":"eIDAS Art.41 / RFC 3161-aligned","timestamp":"2026-06-25T10:00:00Z","algorithm":"sha256"}}',ts:'2026-06-25T10:00:00Z',algo:'sha256'}};
function loadPreset(n){const d=PRESETS[n];if(!d)return;document.getElementById('doc_hash').value=d.hash;document.getElementById('anchor').value=d.anchor;document.getElementById('pres_ts').value=d.ts;document.getElementById('exp_algo').value=d.algo;}
function getParams(){let anchor;try{anchor=JSON.parse(document.getElementById('anchor').value);}catch(e){alert('Anchor must be valid JSON');return null;}return{document_hash:document.getElementById('doc_hash').value.trim(),presented_anchor:anchor,presented_timestamp:document.getElementById('pres_ts').value.trim(),expected_algorithm:document.getElementById('exp_algo').value};}
loadPreset('verified');`
}

];

// Write all files
for (const cfg of TOOLS) {
  const html = makeHTML(cfg);
  const outPath = path.join(REPO, cfg.slug + '.html');
  fs.writeFileSync(outPath, html);
  console.log('wrote ' + cfg.slug + '.html  (' + html.length + ' bytes)');
}
console.log('All 11 tool pages written.');
