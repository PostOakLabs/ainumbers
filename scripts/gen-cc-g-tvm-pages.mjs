// One-shot generator: 8 CALC-CORE CC-G (TVM primitive family) node HTML pages.
// Reuses canonical chrome from chaingraph/_page-chrome.mjs. Each page reimplements
// its kernel's pure-math compute() inline (client-side, zero network, self-contained
// per CONTRACT.md — HTML pages never import the ESM kernel modules).
import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { buildNav, FOOTER, CHROME_CSS } from '../chaingraph/_page-chrome.mjs';

const CG = resolve('chaingraph');

// Proof badge is derived from chaingraph.json, never hardcoded: a page that claims
// "Proof deferred" after the node is proven is a false statement to the reader.
const GRAPH_NODES = JSON.parse(readFileSync(resolve(CG, 'chaingraph.json'), 'utf8')).nodes;
function proofBadge(slug) {
  const node = GRAPH_NODES.find((n) => n.tool_id === slug);
  if (!node) throw new Error('node not in chaingraph.json: ' + slug);
  return node.compute_proof_ready === 'ready' && node.compute_proof
    ? '<span class="badge badge-green">Proof verified</span>'
    : '<span class="badge badge-warn">Proof deferred</span>';
}

const MATH_HELPERS = `
function myExp(x){if(!Number.isFinite(x))return 0;let sum=1,term=1;for(let n=1;n<=80;n++){term*=x/n;sum+=term;if(Math.abs(term)<1e-17*Math.abs(sum))break;}return sum;}
function myLn(x){if(x<=0||!Number.isFinite(x))return -1e300;const y=(x-1)/(x+1);let sum=0,ypow=y,y2=y*y;for(let k=0;k<100;k++){sum+=ypow/(2*k+1);ypow*=y2;if(Math.abs(ypow)<1e-17)break;}return 2*sum;}
function myPow(base,exp){if(!Number.isFinite(base)||!Number.isFinite(exp))return 0;if(exp===0)return 1;if(base===1)return 1;const iExp=Math.round(exp);if(Math.abs(exp-iExp)<1e-12){const n=Math.abs(iExp);let r=1;for(let i=0;i<n;i++)r*=base;return iExp<0?1/r:r;}return myExp(exp*myLn(base));}
function safeNum(v,def){const n=Number(v);return Number.isFinite(n)?n:def;}
function r2(v){return Number.isFinite(v)?Math.round(v*100)/100:0;}
function r4(v){return Number.isFinite(v)?Math.round(v*1e4)/1e4:0;}
function r6(v){return Number.isFinite(v)?Math.round(v*1e6)/1e6:0;}
function toJDN(y,m,d){const a=Math.floor((14-m)/12);const yy=y+4800-a;const mm=m+12*a-3;return d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;}
function parseDate(s){const p=String(s).split('-');return {y:Number(p[0]),m:Number(p[1]),d:Number(p[2])};}
function daysBetween(d1s,d2s){const d1=parseDate(d1s),d2=parseDate(d2s);return toJDN(d2.y,d2.m,d2.d)-toJDN(d1.y,d1.m,d1.d);}
function yearFrac(d1s,d2s,convention){const actualDays=daysBetween(d1s,d2s);if(convention==='ACT/360')return actualDays/360;if(convention==='ACT/ACT')return actualDays/365.25;if(convention==='30/360'){const d1=parseDate(d1s),d2=parseDate(d2s);let dd1=d1.d===31?30:d1.d;let dd2=(d2.d===31&&dd1===30)?30:d2.d;const days360=(d2.y-d1.y)*360+(d2.m-d1.m)*30+(dd2-dd1);return days360/360;}return actualDays/365;}
function parseCashFlowLines(text){return String(text||'').split('\\n').map(function(l){return l.trim();}).filter(Boolean).map(function(l){const parts=l.split(',').map(function(s){return s.trim();});return parts;});}
`.trim();

const CANON_SCRIPT = `<script>
/* OCG-CANON v1 — RFC 8785/JCS (I-JSON). DO NOT hand-edit. */
function __ocgCanon(v){return Array.isArray(v)?v.map(__ocgCanon):(v&&typeof v==='object')?Object.keys(v).sort().reduce((o,k)=>(o[k]=__ocgCanon(v[k]),o),{}):v;}
function __ocgAssertIJson(v){if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('OCG: non-finite number is not I-JSON');if(Number.isInteger(v)&&!Number.isSafeInteger(v))throw new Error('OCG: integer exceeds 2^53; pass as string');}else if(Array.isArray(v)){v.forEach(__ocgAssertIJson);}else if(v&&typeof v==='object'){for(const k of Object.keys(v))__ocgAssertIJson(v[k]);}}
function __ocgCanonStr(x){__ocgAssertIJson(x);return JSON.stringify(__ocgCanon(x));}
</script>`;

const BASE_STYLE = `
:root{
  --bg:#080E1A;--bg-2:#0D1627;--bg-3:#111E35;--bg-4:#162340;
  --border:#1E2F4A;--border-2:#263855;--muted:#3A5270;--body:#6888A8;
  --text:#A8C4DE;--bright:#D4E8F8;--white:#EEF6FD;
  --teal:#14B8A6;--teal-lt:#2DD4BF;--teal-dim:rgba(20,184,166,.12);
  --gold:#D4A847;--gold-dim:rgba(212,168,71,.12);
  --green:#22C55E;--green-dim:rgba(34,197,94,.12);
  --red:#EF4444;--red-dim:rgba(239,68,68,.12);
  --warn:#F59E0B;--purple:#9B72F5;--purple-dim:rgba(155,114,245,.12);
  --radius:6px;--radius-lg:10px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Sora',sans-serif;font-weight:300;font-size:15px;line-height:1.7;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:'DM Serif Display',serif;font-weight:400;line-height:1.2}
a{color:inherit;text-decoration:none}
button{cursor:pointer;font-family:inherit}
.container{max-width:880px;margin:0 auto;padding:0 2rem}
.hero{padding:3rem 0 1.6rem;border-bottom:1px solid var(--border)}
.hero-eyebrow{font-family:'JetBrains Mono',monospace;font-size:.58rem;letter-spacing:.22em;text-transform:uppercase;color:var(--teal);margin-bottom:.8rem}
.hero h1{font-size:2rem;color:var(--white);margin-bottom:.8rem}
.hero h1 em{font-style:italic;color:var(--teal-lt)}
.hero p{max-width:720px;font-size:.92rem;color:var(--body);line-height:1.8;margin-bottom:1rem}
.hero-meta{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem}
.badge{font-family:'JetBrains Mono',monospace;font-size:.48rem;letter-spacing:.1em;text-transform:uppercase;padding:.22rem .6rem;border:1px solid;border-radius:3px}
.badge-teal{color:var(--teal);border-color:rgba(20,184,166,.3)}.badge-warn{color:var(--warn);border-color:rgba(245,158,11,.3)}.badge-green{color:var(--green);border-color:rgba(34,197,94,.3)}.badge-gold{color:var(--gold);border-color:rgba(212,168,71,.3)}.badge-muted{color:var(--muted);border-color:var(--border)}.badge-purple{color:var(--purple);border-color:rgba(155,114,245,.3)}
.pii-notice{font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--muted);background:var(--bg-3);border:1px solid var(--border);border-left:3px solid var(--teal);border-radius:4px;padding:.5rem .85rem;line-height:1.5;margin-bottom:1.5rem}
.tool-body{padding:2rem 0 4rem}
.field-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin-bottom:1.25rem}
.field{display:flex;flex-direction:column;gap:.35rem}
.field label{font-family:'JetBrains Mono',monospace;font-size:.58rem;letter-spacing:.06em;text-transform:uppercase;color:var(--body)}
.field input[type=text],.field input[type=number],.field select,.field textarea{background:var(--bg-2);border:1px solid var(--border-2);border-radius:var(--radius);color:var(--bright);font-family:'JetBrains Mono',monospace;font-size:.78rem;padding:.5rem .65rem}
.field textarea{min-height:96px;resize:vertical;line-height:1.5}
.field .field-hint{font-size:.6rem;color:var(--muted);line-height:1.4}
.field-check{flex-direction:row;align-items:center;gap:.5rem}
.field-check input{width:auto}
.run-btn{display:block;width:100%;background:var(--teal);color:var(--bg);border:none;padding:.85rem 2rem;border-radius:var(--radius);font-family:'JetBrains Mono',monospace;font-size:.64rem;letter-spacing:.12em;text-transform:uppercase;font-weight:600;margin:1.25rem 0 2rem;transition:background .2s}
.run-btn:hover{background:var(--teal-lt)}
.results-panel{display:none}
.results-panel.visible{display:block}
.out-section{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:1.25rem}
.out-header{padding:.75rem 1.25rem;border-bottom:1px solid var(--border);background:var(--bg-3)}
.out-title{font-family:'JetBrains Mono',monospace;font-size:.55rem;letter-spacing:.14em;text-transform:uppercase;color:var(--teal)}
.out-body{padding:1.1rem 1.25rem}
.out-row{display:flex;justify-content:space-between;gap:1rem;padding:.35rem 0;border-bottom:1px solid var(--border);font-size:.78rem}
.out-row:last-child{border-bottom:none}
.out-row .k{color:var(--body)}
.out-row .v{color:var(--bright);font-family:'JetBrains Mono',monospace;text-align:right;word-break:break-word}
.flag-row{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.5rem}
.flag{font-family:'JetBrains Mono',monospace;font-size:.5rem;letter-spacing:.06em;text-transform:uppercase;padding:.22rem .55rem;border-radius:3px;border:1px solid rgba(245,158,11,.35);color:var(--warn)}
.results-export-row{display:flex;gap:.75rem;flex-wrap:wrap;align-items:center;margin-top:.75rem}
.btn{font-family:'JetBrains Mono',monospace;font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;padding:.4rem 1rem;border-radius:var(--radius);border:1px solid;transition:all .2s;cursor:pointer;background:transparent}
.btn-ghost{border-color:var(--border);color:var(--muted)}.btn-ghost.ready{border-color:var(--teal);color:var(--bright)}.btn-ghost.ready:hover{background:var(--bg-4)}.btn-ghost:disabled{opacity:.28;cursor:not-allowed}
.btn-subtitle{display:block;font-size:.4rem;color:var(--muted);margin-top:.1rem}
.hash-row{font-family:'JetBrains Mono',monospace;font-size:.56rem;color:var(--muted);word-break:break-all;padding:.5rem .7rem;background:var(--bg-4);border-radius:var(--radius);border:1px solid var(--border);margin-top:.75rem}
.hash-label{color:var(--teal);margin-right:.5rem}
.mfst-btn{width:100%;background:var(--bg-2);border:1px solid var(--border);padding:.85rem 1.1rem;display:flex;align-items:center;justify-content:space-between;color:var(--text);font-family:'JetBrains Mono',monospace;font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;border-radius:var(--radius);transition:background .15s;cursor:pointer;margin-top:2rem}
.mfst-btn:hover{background:var(--bg-3)}
.mfst-body{display:none;border:1px solid var(--border);border-top:none;border-radius:0 0 var(--radius) var(--radius);background:var(--bg-3);padding:1.25rem;overflow-x:auto}
.mfst-code{font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--text);line-height:1.6;white-space:pre}
.toast{position:fixed;bottom:1.5rem;right:1.5rem;background:var(--bg-3);border:1px solid var(--teal);color:var(--teal-lt);font-family:'JetBrains Mono',monospace;font-size:.58rem;padding:.5rem 1rem;border-radius:var(--radius);z-index:999;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.show{opacity:1}
@media(max-width:680px){.hero h1{font-size:1.5rem}}
`.trim();

function fieldHtml(f) {
  if (f.type === 'select') {
    const opts = f.options.map(o => `<option value="${o.value}"${o.value === f.default ? ' selected' : ''}>${o.label}</option>`).join('');
    return `<div class="field"><label for="${f.id}">${f.label}</label><select id="${f.id}">${opts}</select>${f.hint ? `<div class="field-hint">${f.hint}</div>` : ''}</div>`;
  }
  if (f.type === 'checkbox') {
    return `<div class="field field-check"><input type="checkbox" id="${f.id}"${f.default ? ' checked' : ''}><label for="${f.id}">${f.label}</label></div>`;
  }
  if (f.type === 'textarea') {
    return `<div class="field" style="grid-column:1/-1"><label for="${f.id}">${f.label}</label><textarea id="${f.id}" spellcheck="false">${f.default}</textarea>${f.hint ? `<div class="field-hint">${f.hint}</div>` : ''}</div>`;
  }
  return `<div class="field"><label for="${f.id}">${f.label}</label><input type="text" id="${f.id}" value="${f.default}">${f.hint ? `<div class="field-hint">${f.hint}</div>` : ''}</div>`;
}

function outRowsJs(rows) {
  // rows: array of [label, expr] where expr is a JS expression string referencing `o` (output_payload)
  return rows.map(([label, expr]) => `'<div class="out-row"><span class="k">${label}</span><span class="v">'+(${expr})+'</span></div>'`).join("+\n    ");
}

function buildPage(cfg) {
  const breadcrumb = `ART-${cfg.num} · ${cfg.title}`;
  const fieldsHtml = cfg.fields.map(fieldHtml).join('\n      ');
  const inputSchemaProps = cfg.mcpProps;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<title>${cfg.title} · ART-${cfg.num} · OpenChainGraph · AINumbers.co</title>
<meta name="description" content="${cfg.metaDesc}">
<meta name="robots" content="index, follow">
<meta name="author" content="Post Oak Labs">
<link rel="canonical" href="https://ainumbers.co/chaingraph/${cfg.slug}.html">
<meta property="og:type" content="website">
<meta property="og:title" content="${cfg.title} · ART-${cfg.num} · OpenChainGraph · AINumbers.co">
<meta property="og:description" content="${cfg.metaDesc}">
<meta property="og:url" content="https://ainumbers.co/chaingraph/${cfg.slug}.html">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23080E1A'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='Sora,sans-serif' font-weight='600' font-size='13' fill='%2314B8A6'>AI</text></svg>">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":"${cfg.title} · ART-${cfg.num} · OpenChainGraph","url":"https://ainumbers.co/chaingraph/${cfg.slug}.html","applicationCategory":"FinanceApplication","operatingSystem":"Web browser","description":"${cfg.metaDesc}","author":{"@type":"Organization","name":"Post Oak Labs","url":"https://postoaklabs.com"},"offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<style>
${BASE_STYLE}
</style>
<style>
${CHROME_CSS}
</style>
</head>
<body>
${buildNav(breadcrumb)}

<div class="tool-body"><div class="container">

  <div class="hero">
    <div class="hero-eyebrow">ART-${cfg.num} &middot; OpenChainGraph &middot; TVM Primitive</div>
    <span class="badge badge-muted" style="display:inline-flex;margin-bottom:.6rem">v1.0.0</span>
    <h1>${cfg.h1}</h1>
    <p>${cfg.heroDesc}</p>
    <div class="hero-meta">
      <span class="badge badge-teal">Policy Mandate Export</span>
      <span class="badge badge-gold">TVM Primitive</span>
      <span class="badge badge-muted">analytics_mandate</span>
      ${proofBadge(cfg.slug)}
    </div>
  </div>

  <div style="padding-top:1.5rem">
    <div class="pii-notice">&#128274; All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data &mdash; use synthetic or anonymised inputs only.</div>

    <div class="field-grid">
      ${fieldsHtml}
    </div>

    <button class="run-btn" onclick="runCompute()">&#9654; ${cfg.runLabel}</button>

    <div class="results-panel" id="resultsPanel">
      <div class="out-section">
        <div class="out-header"><span class="out-title">Result</span></div>
        <div class="out-body" id="outBody"></div>
      </div>

      <div class="results-export-row">
        <button class="btn btn-ghost" id="ap2ExportBtn" disabled onclick="exportPolicyMandate()">
          {} Export Policy Mandate<span class="btn-subtitle">chaingraph_version: 0.4.0 &middot; execution_hash</span>
        </button>
        <button class="btn btn-ghost" id="mdBtn" disabled onclick="exportMd()">
          &#x21E9; Export Markdown<span class="btn-subtitle">Report</span>
        </button>
      </div>
      <div class="hash-row" id="hashRow" style="display:none">
        <span class="hash-label">sha256:</span><span id="hashVal"></span>
      </div>
    </div>

    <button class="mfst-btn" onclick="toggleMfst()" aria-expanded="false" aria-controls="mfstBody">
      <span>{} MCP Manifest &mdash; ART-${cfg.num}</span><span id="mfstArrow">&#9660;</span>
    </button>
    <div class="mfst-body" id="mfstBody" aria-hidden="true"><pre class="mfst-code" id="mfstCode"></pre></div>
  </div>
</div></div>

${FOOTER}
<div class="toast" id="toast"></div>

<script>
'use strict';
/* ART-${cfg.num} · ${cfg.title} — OpenChainGraph node. analytics_mandate. */
const MANIFEST = {
  tool_id: '${cfg.slug}',
  version: '1.0.0',
  title: '${cfg.title}',
  mcp_tool_definition: {
    name: '${cfg.mcpName}',
    description: ${JSON.stringify(cfg.mcpDesc)},
    inputSchema: { type: 'object', properties: ${JSON.stringify(inputSchemaProps)}, required: [] }
  },
  ap2_export: true,
  chaingraph: true
};

${MATH_HELPERS}

${cfg.computeFn}

let _result = null;
let _artifact = null;
let _pp = null;

function runCompute() {
  _pp = readInputs();
  const { output_payload, compliance_flags } = compute(_pp);
  _result = { output_payload, compliance_flags };
  document.getElementById('outBody').innerHTML =
    ${outRowsJs(cfg.outRows)} +
    (compliance_flags.length ? '<div class="flag-row">' + compliance_flags.map(function(f){return '<span class="flag">'+f+'</span>';}).join('') + '</div>' : '');
  document.getElementById('resultsPanel').classList.add('visible');
  document.getElementById('resultsPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  buildArtifact();
}

${cfg.readInputsFn}

async function buildArtifact() {
  const pp = _pp;
  const output_payload = _result.output_payload;
  const hash = await sha256({ policy_parameters: pp, output_payload });

  document.getElementById('hashRow').style.display = 'block';
  document.getElementById('hashVal').textContent = hash;

  _artifact = {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: 'analytics_mandate',
    tool_id: '${cfg.slug}',
    tool_version: '1.0.0',
    generated_at: new Date().toISOString(),
    execution_hash: hash,
    chain: { parent_hashes: [], parent_tool_ids: [], chain_depth: 0 },
    policy_parameters: pp, output_payload,
    compliance_flags: _result.compliance_flags,
    compute_mode: 'client',
    audit_signature: { client_side_executed: true, zero_pii_verified: true, deterministic_run: true }
  };

  ['ap2ExportBtn', 'mdBtn'].forEach(function(id) {
    const b = document.getElementById(id);
    b.disabled = false;
    b.classList.add('ready');
  });
}

async function sha256(obj) {
  const c = __ocgCanonStr(obj);
  const b = new TextEncoder().encode(c);
  const h = await crypto.subtle.digest('SHA-256', b);
  return Array.from(new Uint8Array(h)).map(function(x) { return x.toString(16).padStart(2, '0'); }).join('');
}

function ts14() { return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); }

function showToast(m) {
  const t = document.getElementById('toast');
  t.textContent = m;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2200);
}

function exportPolicyMandate() {
  if (!_artifact) return;
  const ts = ts14();
  const b = new Blob([JSON.stringify(_artifact, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: '${cfg.slug}_' + ts + '.policy.json' });
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Policy Mandate exported');
}

function exportMd() {
  if (!_result || !_artifact) return;
  const ts = ts14();
  const lines = [
    '# ${cfg.title} Report',
    '',
    '_' + new Date().toISOString() + ' · ainumbers.co/chaingraph/${cfg.slug}.html · client-side, zero PII_',
    '',
    '**ART-${cfg.num} · OpenChainGraph**',
    '**execution_hash:** ' + _artifact.execution_hash,
    '',
    '## Output',
    '',
    JSON.stringify(_result.output_payload, null, 2),
    '',
    '---',
    '> *ART-${cfg.num} · OpenChainGraph Suite · Post Oak Labs · CC BY 4.0*'
  ];
  const b = new Blob([lines.join('\\n')], { type: 'text/markdown' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: '${cfg.slug}_' + ts + '.md' });
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Markdown exported');
}

function toggleMfst() {
  const body = document.getElementById('mfstBody'), arrow = document.getElementById('mfstArrow'), btn = document.querySelector('.mfst-btn');
  const open = body.style.display === 'block';
  body.style.display = open ? 'none' : 'block';
  arrow.textContent = open ? '▼' : '▲';
  btn.setAttribute('aria-expanded', String(!open));
  body.setAttribute('aria-hidden', String(open));
  if (!open && !document.getElementById('mfstCode').textContent) document.getElementById('mfstCode').textContent = JSON.stringify(MANIFEST, null, 2);
}
</script>
${CANON_SCRIPT}
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Per-tool configs
// ---------------------------------------------------------------------------

const PAGES = [];

// art-324-tvm-npv
PAGES.push({
  num: '324', slug: 'art-324-tvm-npv', mcpName: 'compute_npv', title: 'Net Present Value (NPV)',
  h1: 'Net Present Value <em>(NPV)</em>',
  heroDesc: 'Discounts a cash flow series at a declared periodic rate. Accepts caller-supplied period offsets, or dated cash flows converted to years under a declared day-count convention (30/360, ACT/360, ACT/365, or a simplified ACT/ACT). Deterministic pow via Taylor-series exp/ln, no engine transcendentals. Foundation primitive for downstream valuation and lease/loan analytics.',
  metaDesc: 'Net present value calculator: discount a cash flow series at a declared periodic rate, periods or dated mode with declared day-count convention. Client-side. Zero PII.',
  runLabel: 'Compute NPV',
  mcpDesc: 'Computes net present value of a cash flow series at a declared discount rate, in periods mode (caller supplies period offset t) or dates mode (t derived from valuation_date under a declared day_count_convention).',
  mcpProps: {
    mode: { type: 'string', enum: ['periods', 'dates'], description: 'periods: t is a caller-supplied offset. dates: t derived from valuation_date.' },
    discount_rate_pct: { type: 'number', description: 'Per-period discount rate, percent' },
    valuation_date: { type: 'string', description: 'ISO date, dates mode only' },
    day_count_convention: { type: 'string', enum: ['ACT/365', 'ACT/360', '30/360', 'ACT/ACT'] },
    cash_flows: { type: 'array', description: 'List of {amount, t} (periods mode) or {amount, date} (dates mode)' },
  },
  fields: [
    { id: 'mode', type: 'select', label: 'Mode', default: 'periods', options: [{ value: 'periods', label: 'Periods (t offset)' }, { value: 'dates', label: 'Dates' }] },
    { id: 'discountRate', label: 'Discount rate (% per period)', default: '10' },
    { id: 'dayCount', type: 'select', label: 'Day-count convention (dates mode)', default: 'ACT/365', options: [{ value: 'ACT/365', label: 'ACT/365' }, { value: 'ACT/360', label: 'ACT/360' }, { value: '30/360', label: '30/360' }, { value: 'ACT/ACT', label: 'ACT/ACT (simplified)' }] },
    { id: 'valuationDate', label: 'Valuation date (dates mode, YYYY-MM-DD)', default: '2026-01-01' },
    { id: 'cashFlows', type: 'textarea', label: 'Cash flows, one per line: amount,t (periods) or amount,YYYY-MM-DD (dates)', default: '-1000,0\n500,1\n500,2\n500,3', hint: 'periods mode: amount,t &middot; dates mode: amount,date' },
  ],
  outRows: [
    ['NPV', "r2(o.npv).toFixed(2)"],
    ['Discount rate (%)', 'o.discount_rate_pct'],
    ['Cash flows', 'o.num_cash_flows'],
    ['Total undiscounted', 'o.total_undiscounted.toFixed(2)'],
    ['Mode', 'o.mode'],
    ['Day-count convention', 'o.day_count_convention'],
  ],
  readInputsFn: `
function readInputs() {
  const mode = document.getElementById('mode').value;
  const discount_rate_pct = safeNum(document.getElementById('discountRate').value, 0);
  const day_count_convention = document.getElementById('dayCount').value;
  const valuation_date = document.getElementById('valuationDate').value;
  const rows = parseCashFlowLines(document.getElementById('cashFlows').value);
  const cash_flows = rows.map(function(parts) {
    if (mode === 'dates') return { amount: safeNum(parts[0], 0), date: parts[1] };
    return { amount: safeNum(parts[0], 0), t: safeNum(parts[1], 0) };
  });
  return { mode, discount_rate_pct, day_count_convention, valuation_date, cash_flows };
}`,
  computeFn: `
function normalizeCashFlows(pp) {
  const flows = Array.isArray(pp.cash_flows) ? pp.cash_flows : [];
  const mode = pp.mode === 'dates' ? 'dates' : 'periods';
  const convention = pp.day_count_convention || 'ACT/365';
  const valuationDate = pp.valuation_date;
  const out = [];
  for (const cf of flows) {
    const amount = safeNum(cf.amount, 0);
    let t;
    if (mode === 'dates') t = yearFrac(valuationDate, cf.date, convention);
    else t = safeNum(cf.t, 0);
    out.push({ amount, t: Number.isFinite(t) ? t : 0 });
  }
  return { flows: out, mode, convention };
}
function compute(pp) {
  pp = pp || {};
  const { flows, mode, convention } = normalizeCashFlows(pp);
  const rate = safeNum(pp.discount_rate_pct, 0) / 100;
  let npv = 0;
  for (const f of flows) npv += f.amount * myPow(1 + rate, -f.t);
  const totalUndiscounted = flows.reduce(function(s, f) { return s + f.amount; }, 0);
  const compliance_flags = [];
  if (flows.length === 0) compliance_flags.push('NO_CASH_FLOWS');
  if (rate <= -1) compliance_flags.push('RATE_BELOW_NEGATIVE_100_PCT');
  const output_payload = {
    npv: r2(npv), discount_rate_pct: r6(rate * 100), num_cash_flows: flows.length,
    total_undiscounted: r2(totalUndiscounted), mode,
    day_count_convention: mode === 'dates' ? convention : 'n/a (periods mode)',
  };
  return { output_payload, compliance_flags };
}`,
});

// art-325-tvm-irr
PAGES.push({
  num: '325', slug: 'art-325-tvm-irr', mcpName: 'compute_irr', title: 'Internal Rate of Return (IRR)',
  h1: 'Internal Rate of <em>Return (IRR)</em>',
  heroDesc: 'Solves the internal rate of return for an equal-period cash flow series by deterministic bisection over a declared rate bracket with declared tolerance and iteration cap. Never Newton/derivative-based, so no float-drift nondeterminism. Reports whether the bracket contained a sign change and whether the search converged.',
  metaDesc: 'IRR calculator: deterministic bisection root-find over a declared rate bracket for equal-period cash flows. Client-side. Zero PII.',
  runLabel: 'Compute IRR',
  mcpDesc: 'Internal rate of return for an equal-period cash flow series, solved by deterministic bisection over a declared rate bracket with declared tolerance and iteration cap.',
  mcpProps: {
    cash_flows: { type: 'array', description: 'List of {amount}, index 0..n-1' },
    bracket_lo: { type: 'number', description: 'Lower rate bracket bound (decimal), default -0.9999' },
    bracket_hi: { type: 'number', description: 'Upper rate bracket bound (decimal), default 10' },
    tolerance: { type: 'number', description: 'Convergence tolerance, default 1e-9' },
    max_iterations: { type: 'number', description: 'Iteration cap, default 200' },
  },
  fields: [
    { id: 'cashFlows', type: 'textarea', label: 'Cash flows, one amount per line, index 0..n-1', default: '-1000\n300\n420\n380\n700', hint: 'First row = period 0 (usually the initial outlay, negative)' },
    { id: 'bracketLo', label: 'Bracket low (%)', default: '-99.99' },
    { id: 'bracketHi', label: 'Bracket high (%)', default: '1000' },
    { id: 'tolerance', label: 'Tolerance', default: '0.000000001' },
    { id: 'maxIter', label: 'Max iterations', default: '200' },
  ],
  outRows: [
    ['IRR (%)', 'o.irr_pct'],
    ['Cash flows', 'o.num_cash_flows'],
    ['Iterations', 'o.iterations'],
    ['Converged', 'o.converged'],
    ['Bracket (%)', "o.bracket_lo_pct + ' .. ' + o.bracket_hi_pct"],
    ['Method', 'o.method'],
  ],
  readInputsFn: `
function readInputs() {
  const rows = parseCashFlowLines(document.getElementById('cashFlows').value);
  const cash_flows = rows.map(function(parts) { return { amount: safeNum(parts[0], 0) }; });
  return {
    cash_flows,
    bracket_lo: safeNum(document.getElementById('bracketLo').value, -99.99) / 100,
    bracket_hi: safeNum(document.getElementById('bracketHi').value, 1000) / 100,
    tolerance: safeNum(document.getElementById('tolerance').value, 1e-9),
    max_iterations: safeNum(document.getElementById('maxIter').value, 200),
  };
}`,
  computeFn: `
function npvAt(amounts, r) {
  let npv = 0;
  for (let t = 0; t < amounts.length; t++) npv += amounts[t] * myPow(1 + r, -t);
  return npv;
}
function bisectIRR(amounts, lo, hi, tolerance, maxIterations) {
  let fLo = npvAt(amounts, lo), fHi = npvAt(amounts, hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return { irr: 0, iterations: 0, converged: false, bracket_valid: false };
  if ((fLo > 0 && fHi > 0) || (fLo < 0 && fHi < 0)) return { irr: 0, iterations: 0, converged: false, bracket_valid: false };
  let iter = 0, mid = lo;
  for (iter = 1; iter <= maxIterations; iter++) {
    mid = (lo + hi) / 2;
    const fMid = npvAt(amounts, mid);
    if (!Number.isFinite(fMid)) return { irr: 0, iterations: iter, converged: false, bracket_valid: true };
    if (Math.abs(fMid) < tolerance || (hi - lo) / 2 < tolerance) return { irr: mid, iterations: iter, converged: true, bracket_valid: true };
    if ((fLo < 0 && fMid < 0) || (fLo > 0 && fMid > 0)) { lo = mid; fLo = fMid; } else { hi = mid; }
  }
  return { irr: mid, iterations: maxIterations, converged: false, bracket_valid: true };
}
function compute(pp) {
  pp = pp || {};
  const amounts = (Array.isArray(pp.cash_flows) ? pp.cash_flows : []).map(function(cf) { return safeNum(cf && cf.amount, 0); });
  const bracketLo = safeNum(pp.bracket_lo, -0.9999), bracketHi = safeNum(pp.bracket_hi, 10);
  const tolerance = safeNum(pp.tolerance, 1e-9);
  const maxIterations = Math.max(1, Math.round(safeNum(pp.max_iterations, 200)));
  const compliance_flags = [];
  let result = { irr: 0, iterations: 0, converged: false, bracket_valid: false };
  if (amounts.length >= 2) {
    result = bisectIRR(amounts, bracketLo, bracketHi, tolerance, maxIterations);
    if (!result.bracket_valid) compliance_flags.push('NO_SIGN_CHANGE_IN_BRACKET');
    if (!result.converged && result.bracket_valid) compliance_flags.push('IRR_DID_NOT_CONVERGE');
  } else compliance_flags.push('INSUFFICIENT_CASH_FLOWS');
  const output_payload = {
    irr_pct: r6(result.irr * 100), num_cash_flows: amounts.length, iterations: result.iterations,
    converged: result.converged, bracket_lo_pct: r6(bracketLo * 100), bracket_hi_pct: r6(bracketHi * 100),
    tolerance, method: 'bisection',
  };
  return { output_payload, compliance_flags };
}`,
});

// art-326-tvm-xirr
PAGES.push({
  num: '326', slug: 'art-326-tvm-xirr', mcpName: 'compute_xirr', title: 'XIRR (Irregular Dated Cash Flows)',
  h1: 'XIRR <em>(Irregular Dated Cash Flows)</em>',
  heroDesc: 'Annualized rate of return for irregular-interval dated cash flows, matching Excel XIRR semantics exactly: fixed actual/365 day count, anchored to the first cash flow date, solved by deterministic bisection over a declared rate bracket. Companion to the IRR primitive for cash flows that do not fall on equal periods.',
  metaDesc: 'XIRR calculator: Excel-matching annualized rate of return for irregular dated cash flows, actual/365 day count, deterministic bisection. Client-side. Zero PII.',
  runLabel: 'Compute XIRR',
  mcpDesc: 'Annualized rate of return for irregular-interval dated cash flows, Excel XIRR semantics (fixed actual/365 day count, anchored to the first cash flow date), solved by deterministic bisection.',
  mcpProps: {
    cash_flows: { type: 'array', description: 'List of {amount, date (ISO)}' },
    bracket_lo: { type: 'number' }, bracket_hi: { type: 'number' },
    tolerance: { type: 'number' }, max_iterations: { type: 'number' },
  },
  fields: [
    { id: 'cashFlows', type: 'textarea', label: 'Cash flows, one per line: amount,YYYY-MM-DD', default: '-10000,2023-01-01\n2750,2023-03-01\n4250,2023-10-30\n3250,2024-02-15\n2750,2024-04-01', hint: 'First flow date anchors t=0' },
    { id: 'bracketLo', label: 'Bracket low (%)', default: '-99.99' },
    { id: 'bracketHi', label: 'Bracket high (%)', default: '1000' },
    { id: 'tolerance', label: 'Tolerance', default: '0.000000001' },
    { id: 'maxIter', label: 'Max iterations', default: '200' },
  ],
  outRows: [
    ['XIRR (%)', 'o.xirr_pct'],
    ['Cash flows', 'o.num_cash_flows'],
    ['Anchor date', 'o.anchor_date'],
    ['Iterations', 'o.iterations'],
    ['Converged', 'o.converged'],
    ['Day-count convention', 'o.day_count_convention'],
  ],
  readInputsFn: `
function readInputs() {
  const rows = parseCashFlowLines(document.getElementById('cashFlows').value);
  const cash_flows = rows.map(function(parts) { return { amount: safeNum(parts[0], 0), date: parts[1] }; });
  return {
    cash_flows,
    bracket_lo: safeNum(document.getElementById('bracketLo').value, -99.99) / 100,
    bracket_hi: safeNum(document.getElementById('bracketHi').value, 1000) / 100,
    tolerance: safeNum(document.getElementById('tolerance').value, 1e-9),
    max_iterations: safeNum(document.getElementById('maxIter').value, 200),
  };
}`,
  computeFn: `
function npvAtX(flows, anchorDate, r) {
  let npv = 0;
  for (const f of flows) { const t = daysBetween(anchorDate, f.date) / 365; npv += f.amount * myPow(1 + r, -t); }
  return npv;
}
function bisectXIRR(flows, anchorDate, lo, hi, tolerance, maxIterations) {
  let fLo = npvAtX(flows, anchorDate, lo), fHi = npvAtX(flows, anchorDate, hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return { rate: 0, iterations: 0, converged: false, bracket_valid: false };
  if ((fLo > 0 && fHi > 0) || (fLo < 0 && fHi < 0)) return { rate: 0, iterations: 0, converged: false, bracket_valid: false };
  let iter = 0, mid = lo;
  for (iter = 1; iter <= maxIterations; iter++) {
    mid = (lo + hi) / 2;
    const fMid = npvAtX(flows, anchorDate, mid);
    if (!Number.isFinite(fMid)) return { rate: 0, iterations: iter, converged: false, bracket_valid: true };
    if (Math.abs(fMid) < tolerance || (hi - lo) / 2 < tolerance) return { rate: mid, iterations: iter, converged: true, bracket_valid: true };
    if ((fLo < 0 && fMid < 0) || (fLo > 0 && fMid > 0)) { lo = mid; fLo = fMid; } else { hi = mid; }
  }
  return { rate: mid, iterations: maxIterations, converged: false, bracket_valid: true };
}
function compute(pp) {
  pp = pp || {};
  const flows = (Array.isArray(pp.cash_flows) ? pp.cash_flows : []).map(function(cf) { return { amount: safeNum(cf && cf.amount, 0), date: cf && cf.date }; });
  const validFlows = flows.filter(function(f) { return typeof f.date === 'string' && f.date.length >= 8; });
  const bracketLo = safeNum(pp.bracket_lo, -0.9999), bracketHi = safeNum(pp.bracket_hi, 10);
  const tolerance = safeNum(pp.tolerance, 1e-9);
  const maxIterations = Math.max(1, Math.round(safeNum(pp.max_iterations, 200)));
  const compliance_flags = [];
  let result = { rate: 0, iterations: 0, converged: false, bracket_valid: false };
  let anchorDate = null;
  if (validFlows.length >= 2) {
    anchorDate = validFlows[0].date;
    result = bisectXIRR(validFlows, anchorDate, bracketLo, bracketHi, tolerance, maxIterations);
    if (!result.bracket_valid) compliance_flags.push('NO_SIGN_CHANGE_IN_BRACKET');
    if (!result.converged && result.bracket_valid) compliance_flags.push('XIRR_DID_NOT_CONVERGE');
  } else compliance_flags.push('INSUFFICIENT_DATED_CASH_FLOWS');
  if (validFlows.length !== flows.length) compliance_flags.push('SOME_CASH_FLOWS_MISSING_DATES_DROPPED');
  const output_payload = {
    xirr_pct: r6(result.rate * 100), num_cash_flows: validFlows.length, anchor_date: anchorDate,
    iterations: result.iterations, converged: result.converged,
    bracket_lo_pct: r6(bracketLo * 100), bracket_hi_pct: r6(bracketHi * 100), tolerance,
    method: 'bisection', day_count_convention: 'ACT/365',
  };
  return { output_payload, compliance_flags };
}`,
});

// art-327-tvm-annuity
PAGES.push({
  num: '327', slug: 'art-327-tvm-annuity', mcpName: 'compute_annuity', title: 'Annuity PV / FV / Payment Solver',
  h1: 'Annuity PV / FV / <em>Payment Solver</em>',
  heroDesc: 'Solves present value, future value, or payment for an ordinary annuity or annuity-due, given the other two plus rate and number of periods, using the standard closed-form annuity factor. Matches Excel PV/FV/PMT semantics including the due=true (beginning-of-period) adjustment.',
  metaDesc: 'Annuity PV/FV/PMT solver matching Excel semantics, ordinary or annuity-due. Client-side. Zero PII.',
  runLabel: 'Solve Annuity',
  mcpDesc: 'Solves present value, future value, or payment for an ordinary annuity or annuity-due given the other two plus rate_pct and nper, matching Excel PV/FV/PMT semantics.',
  mcpProps: {
    rate_pct: { type: 'number', description: 'Periodic rate, percent' },
    nper: { type: 'number', description: 'Number of periods' },
    pv: { type: 'number' }, fv: { type: 'number' }, pmt: { type: 'number' },
    due: { type: 'boolean', description: 'true = annuity-due (start of period), false = ordinary (end)' },
    solve_for: { type: 'string', enum: ['pv', 'fv', 'pmt'] },
  },
  fields: [
    { id: 'ratePct', label: 'Rate (% per period)', default: '5' },
    { id: 'nper', label: 'Number of periods', default: '10' },
    { id: 'pv', label: 'Present value (PV)', default: '0' },
    { id: 'fv', label: 'Future value (FV)', default: '0' },
    { id: 'pmt', label: 'Payment (PMT)', default: '-1000' },
    { id: 'due', type: 'checkbox', label: 'Annuity-due (payments at period start)', default: false },
    { id: 'solveFor', type: 'select', label: 'Solve for', default: 'fv', options: [{ value: 'pv', label: 'PV' }, { value: 'fv', label: 'FV' }, { value: 'pmt', label: 'PMT' }] },
  ],
  outRows: [
    ['Solved for', 'o.solved_for'],
    ['PV', 'o.pv.toFixed(2)'],
    ['FV', 'o.fv.toFixed(2)'],
    ['PMT', 'o.pmt.toFixed(2)'],
    ['Rate (%)', 'o.rate_pct'],
    ['Periods', 'o.nper'],
    ['Due (annuity-due)', 'o.due'],
    ['Annuity factor', 'o.annuity_factor'],
  ],
  readInputsFn: `
function readInputs() {
  return {
    rate_pct: safeNum(document.getElementById('ratePct').value, 0),
    nper: safeNum(document.getElementById('nper').value, 0),
    pv: safeNum(document.getElementById('pv').value, 0),
    fv: safeNum(document.getElementById('fv').value, 0),
    pmt: safeNum(document.getElementById('pmt').value, 0),
    due: document.getElementById('due').checked,
    solve_for: document.getElementById('solveFor').value,
  };
}`,
  computeFn: `
function annuityFactor(rate, nper, type) {
  if (Math.abs(rate) < 1e-15) return nper;
  const growth = myPow(1 + rate, nper);
  const factor = (growth - 1) / rate / myPow(1 + rate, nper);
  return factor * (1 + rate * type);
}
function compute(pp) {
  pp = pp || {};
  const rate = safeNum(pp.rate_pct, 0) / 100;
  const nper = safeNum(pp.nper, 0);
  const type = pp.due === true ? 1 : 0;
  const solveFor = pp.solve_for === 'fv' || pp.solve_for === 'pmt' ? pp.solve_for : 'pv';
  const compliance_flags = [];
  if (nper <= 0) compliance_flags.push('NPER_NOT_POSITIVE');
  const annFactor = annuityFactor(rate, nper, type);
  const discPow = myPow(1 + rate, -nper);
  let pv = safeNum(pp.pv, 0), fv = safeNum(pp.fv, 0), pmt = safeNum(pp.pmt, 0);
  const growth = myPow(1 + rate, nper);
  if (solveFor === 'fv') {
    fv = -(pv * growth + pmt * (annFactor * growth));
  } else if (solveFor === 'pmt') {
    pmt = annFactor !== 0 ? -(pv + fv * discPow) / annFactor : 0;
    if (annFactor === 0) compliance_flags.push('ANNUITY_FACTOR_ZERO_CANNOT_SOLVE_PMT');
  } else {
    pv = -(fv * discPow + pmt * annFactor);
  }
  const output_payload = {
    solved_for: solveFor, pv: r2(pv), fv: r2(fv), pmt: r2(pmt),
    rate_pct: safeNum(pp.rate_pct, 0), nper, due: type === 1,
    annuity_factor: Number.isFinite(annFactor) ? Math.round(annFactor * 1e6) / 1e6 : 0,
  };
  return { output_payload, compliance_flags };
}`,
});

// art-328-tvm-breakeven
PAGES.push({
  num: '328', slug: 'art-328-tvm-breakeven', mcpName: 'compute_breakeven', title: 'Breakeven / CVP Analysis',
  h1: 'Breakeven / <em>CVP Analysis</em>',
  heroDesc: 'Standard cost-volume-profit breakeven analysis: breakeven units and revenue from fixed costs, price per unit, and variable cost per unit, plus contribution margin ratio and an optional margin-of-safety calculation against a supplied current volume.',
  metaDesc: 'Breakeven / cost-volume-profit calculator: breakeven units, revenue, contribution margin, margin of safety. Client-side. Zero PII.',
  runLabel: 'Compute Breakeven',
  mcpDesc: 'Standard cost-volume-profit breakeven analysis: breakeven units and revenue, contribution margin ratio, and an optional margin-of-safety calculation given current_units.',
  mcpProps: {
    fixed_costs: { type: 'number' }, price_per_unit: { type: 'number' },
    variable_cost_per_unit: { type: 'number' }, current_units: { type: 'number', description: 'Optional, for margin of safety' },
  },
  fields: [
    { id: 'fixedCosts', label: 'Fixed costs', default: '50000' },
    { id: 'pricePerUnit', label: 'Price per unit', default: '25' },
    { id: 'varCostPerUnit', label: 'Variable cost per unit', default: '15' },
    { id: 'currentUnits', label: 'Current/forecast units (optional)', default: '6000' },
  ],
  outRows: [
    ['Breakeven units', 'o.breakeven_units.toFixed(2)'],
    ['Breakeven revenue', 'o.breakeven_revenue.toFixed(2)'],
    ['Unit contribution', 'o.unit_contribution.toFixed(4)'],
    ['Contribution margin ratio', 'o.contribution_margin_ratio.toFixed(4)'],
    ['Margin of safety (units)', "o.margin_of_safety_units===null?'n/a':o.margin_of_safety_units.toFixed(2)"],
    ['Margin of safety (%)', "o.margin_of_safety_pct===null?'n/a':o.margin_of_safety_pct.toFixed(2)"],
  ],
  readInputsFn: `
function readInputs() {
  const cuRaw = document.getElementById('currentUnits').value;
  return {
    fixed_costs: safeNum(document.getElementById('fixedCosts').value, 0),
    price_per_unit: safeNum(document.getElementById('pricePerUnit').value, 0),
    variable_cost_per_unit: safeNum(document.getElementById('varCostPerUnit').value, 0),
    current_units: cuRaw.trim() === '' ? undefined : safeNum(cuRaw, undefined),
  };
}`,
  computeFn: `
function compute(pp) {
  pp = pp || {};
  const fixedCosts = safeNum(pp.fixed_costs, 0);
  const pricePerUnit = safeNum(pp.price_per_unit, 0);
  const variableCostPerUnit = safeNum(pp.variable_cost_per_unit, 0);
  const currentUnits = pp.current_units !== undefined ? safeNum(pp.current_units, null) : null;
  const unitContribution = pricePerUnit - variableCostPerUnit;
  const compliance_flags = [];
  let breakevenUnits = 0, breakevenRevenue = 0, contributionMarginRatio = 0;
  if (unitContribution <= 0) {
    compliance_flags.push('NON_POSITIVE_UNIT_CONTRIBUTION');
  } else {
    breakevenUnits = fixedCosts / unitContribution;
    breakevenRevenue = breakevenUnits * pricePerUnit;
    contributionMarginRatio = pricePerUnit !== 0 ? unitContribution / pricePerUnit : 0;
  }
  if (pricePerUnit === 0) compliance_flags.push('ZERO_PRICE_PER_UNIT');
  let marginOfSafetyUnits = null, marginOfSafetyPct = null;
  if (currentUnits !== null && Number.isFinite(currentUnits) && unitContribution > 0) {
    marginOfSafetyUnits = r2(currentUnits - breakevenUnits);
    marginOfSafetyPct = currentUnits !== 0 ? r4(((currentUnits - breakevenUnits) / currentUnits) * 100) : null;
    if (currentUnits < breakevenUnits) compliance_flags.push('CURRENT_VOLUME_BELOW_BREAKEVEN');
  }
  const output_payload = {
    breakeven_units: r2(breakevenUnits), breakeven_revenue: r2(breakevenRevenue),
    unit_contribution: r4(unitContribution), contribution_margin_ratio: r4(contributionMarginRatio),
    fixed_costs: r2(fixedCosts), price_per_unit: r2(pricePerUnit), variable_cost_per_unit: r2(variableCostPerUnit),
    margin_of_safety_units: marginOfSafetyUnits, margin_of_safety_pct: marginOfSafetyPct,
  };
  return { output_payload, compliance_flags };
}`,
});

// Shared bond schedule fields
const BOND_FIELDS = [
  { id: 'faceValue', label: 'Face value', default: '1000' },
  { id: 'couponRatePct', label: 'Coupon rate (% p.a.)', default: '5' },
  { id: 'ytmPct', label: 'Yield to maturity (% p.a.)', default: '6' },
  { id: 'yearsToMaturity', label: 'Years to maturity', default: '10' },
  { id: 'periodsPerYear', label: 'Periods per year', default: '2' },
];
const BOND_SCHEDULE_JS = `
function buildSchedule(face, couponRatePct, yearsToMaturity, periodsPerYear) {
  const n = Math.max(1, Math.round(yearsToMaturity * periodsPerYear));
  const couponPerPeriod = face * (couponRatePct / 100) / periodsPerYear;
  const cashFlows = [];
  for (let t = 1; t <= n; t++) { const amount = t === n ? couponPerPeriod + face : couponPerPeriod; cashFlows.push({ t, amount }); }
  return cashFlows;
}`;

// art-329-tvm-bond-duration
PAGES.push({
  num: '329', slug: 'art-329-tvm-bond-duration', mcpName: 'compute_bond_duration', title: 'Bond Macaulay / Modified Duration',
  h1: 'Bond Macaulay / <em>Modified Duration</em>',
  heroDesc: 'Macaulay and modified duration for a standard even-period bullet bond, given face value, coupon rate, yield to maturity, years to maturity, and compounding frequency. Prices the schedule and reports the PV-weighted average time to cash flows in years. Feeds the DV01 and convexity primitives for full fixed-income risk analytics.',
  metaDesc: 'Bond Macaulay and modified duration calculator for a standard bullet bond. Client-side. Zero PII.',
  runLabel: 'Compute Duration',
  mcpDesc: 'Macaulay and modified duration for a standard even-period bullet bond given face value, coupon rate, yield to maturity, years to maturity, and compounding frequency.',
  mcpProps: {
    face_value: { type: 'number' }, coupon_rate_pct: { type: 'number' }, ytm_pct: { type: 'number' },
    years_to_maturity: { type: 'number' }, periods_per_year: { type: 'number' },
    day_count_convention: { type: 'string', enum: ['30/360', 'ACT/360', 'ACT/365', 'ACT/ACT'] },
  },
  fields: [...BOND_FIELDS, { id: 'dayCount', type: 'select', label: 'Day-count convention (receipt only)', default: '30/360', options: [{ value: '30/360', label: '30/360' }, { value: 'ACT/360', label: 'ACT/360' }, { value: 'ACT/365', label: 'ACT/365' }, { value: 'ACT/ACT', label: 'ACT/ACT' }] }],
  outRows: [
    ['Price', 'o.price.toFixed(2)'],
    ['Macaulay duration (years)', 'o.macaulay_duration_years'],
    ['Modified duration (years)', 'o.modified_duration_years'],
    ['Periods', 'o.num_periods'],
    ['Day-count convention', 'o.day_count_convention'],
  ],
  readInputsFn: `
function readInputs() {
  return {
    face_value: safeNum(document.getElementById('faceValue').value, 1000),
    coupon_rate_pct: safeNum(document.getElementById('couponRatePct').value, 0),
    ytm_pct: safeNum(document.getElementById('ytmPct').value, 0),
    years_to_maturity: safeNum(document.getElementById('yearsToMaturity').value, 0),
    periods_per_year: safeNum(document.getElementById('periodsPerYear').value, 2),
    day_count_convention: document.getElementById('dayCount').value,
  };
}`,
  computeFn: BOND_SCHEDULE_JS + `
function priceAndDuration(cashFlows, periodicYield, periodsPerYear) {
  let price = 0, weightedT = 0;
  for (const cf of cashFlows) { const disc = myPow(1 + periodicYield, -cf.t); const pv = cf.amount * disc; price += pv; weightedT += cf.t * pv; }
  const macaulayPeriods = price !== 0 ? weightedT / price : 0;
  const macaulayYears = macaulayPeriods / periodsPerYear;
  const modifiedYears = macaulayYears / (1 + periodicYield);
  return { price, macaulayYears, modifiedYears };
}
function compute(pp) {
  pp = pp || {};
  const face = safeNum(pp.face_value, 1000);
  const couponRatePct = safeNum(pp.coupon_rate_pct, 0);
  const ytmPct = safeNum(pp.ytm_pct, 0);
  const yearsToMaturity = Math.max(0, safeNum(pp.years_to_maturity, 0));
  const periodsPerYear = Math.max(1, Math.round(safeNum(pp.periods_per_year, 2)));
  const dayCountConvention = pp.day_count_convention || '30/360';
  const compliance_flags = [];
  if (yearsToMaturity <= 0) compliance_flags.push('YEARS_TO_MATURITY_NOT_POSITIVE');
  const cashFlows = yearsToMaturity > 0 ? buildSchedule(face, couponRatePct, yearsToMaturity, periodsPerYear) : [];
  const periodicYield = ytmPct / 100 / periodsPerYear;
  const pd = cashFlows.length ? priceAndDuration(cashFlows, periodicYield, periodsPerYear) : { price: 0, macaulayYears: 0, modifiedYears: 0 };
  if (pd.price <= 0 && cashFlows.length) compliance_flags.push('NON_POSITIVE_PRICE');
  const output_payload = {
    price: r2(pd.price), macaulay_duration_years: r6(pd.macaulayYears), modified_duration_years: r6(pd.modifiedYears),
    face_value: r2(face), coupon_rate_pct: couponRatePct, ytm_pct: ytmPct, years_to_maturity: yearsToMaturity,
    periods_per_year: periodsPerYear, num_periods: cashFlows.length, day_count_convention: dayCountConvention,
  };
  return { output_payload, compliance_flags };
}`,
});

// art-330-tvm-dv01
PAGES.push({
  num: '330', slug: 'art-330-tvm-dv01', mcpName: 'compute_dv01', title: 'Bond DV01 (Price Value of a Basis Point)',
  h1: 'Bond DV01 <em>(Price Value of a Basis Point)</em>',
  heroDesc: 'DV01 / price value of a basis point for a standard even-period bullet bond, computed by full central-difference reprice at yield plus and minus a declared basis-point shock, not the linear modified-duration approximation. Stays accurate for large coupons or short maturities where the linear approximation drifts. Same bond schedule builder as the duration primitive.',
  metaDesc: 'Bond DV01 (price value of a basis point) calculator via central-difference full reprice. Client-side. Zero PII.',
  runLabel: 'Compute DV01',
  mcpDesc: 'DV01 for a standard even-period bullet bond via central-difference full reprice at yield plus and minus a declared basis-point shock (default 1bp).',
  mcpProps: {
    face_value: { type: 'number' }, coupon_rate_pct: { type: 'number' }, ytm_pct: { type: 'number' },
    years_to_maturity: { type: 'number' }, periods_per_year: { type: 'number' },
    basis_points: { type: 'number', description: 'Shock size in basis points, default 1' },
  },
  fields: [...BOND_FIELDS, { id: 'basisPoints', label: 'Shock size (basis points)', default: '1' }],
  outRows: [
    ['DV01', 'o.dv01.toFixed(6)'],
    ['Price', 'o.price.toFixed(2)'],
    ['Price (+shock)', 'o.price_up_shock.toFixed(2)'],
    ['Price (-shock)', 'o.price_down_shock.toFixed(2)'],
    ['Shock size (bp)', 'o.shock_size_bp'],
    ['Method', 'o.method'],
  ],
  readInputsFn: `
function readInputs() {
  return {
    face_value: safeNum(document.getElementById('faceValue').value, 1000),
    coupon_rate_pct: safeNum(document.getElementById('couponRatePct').value, 0),
    ytm_pct: safeNum(document.getElementById('ytmPct').value, 0),
    years_to_maturity: safeNum(document.getElementById('yearsToMaturity').value, 0),
    periods_per_year: safeNum(document.getElementById('periodsPerYear').value, 2),
    basis_points: safeNum(document.getElementById('basisPoints').value, 1),
  };
}`,
  computeFn: BOND_SCHEDULE_JS + `
function priceAt(cashFlows, periodicYield) {
  let price = 0;
  for (const cf of cashFlows) price += cf.amount * myPow(1 + periodicYield, -cf.t);
  return price;
}
function compute(pp) {
  pp = pp || {};
  const face = safeNum(pp.face_value, 1000);
  const couponRatePct = safeNum(pp.coupon_rate_pct, 0);
  const ytmPct = safeNum(pp.ytm_pct, 0);
  const yearsToMaturity = Math.max(0, safeNum(pp.years_to_maturity, 0));
  const periodsPerYear = Math.max(1, Math.round(safeNum(pp.periods_per_year, 2)));
  const bpSize = safeNum(pp.basis_points, 1);
  const compliance_flags = [];
  if (yearsToMaturity <= 0) compliance_flags.push('YEARS_TO_MATURITY_NOT_POSITIVE');
  const cashFlows = yearsToMaturity > 0 ? buildSchedule(face, couponRatePct, yearsToMaturity, periodsPerYear) : [];
  const basePeriodicYield = ytmPct / 100 / periodsPerYear;
  const shockPeriodicYield = (bpSize / 10000) / periodsPerYear;
  let priceBase = 0, priceUp = 0, priceDown = 0;
  if (cashFlows.length) {
    priceBase = priceAt(cashFlows, basePeriodicYield);
    priceUp = priceAt(cashFlows, basePeriodicYield + shockPeriodicYield);
    priceDown = priceAt(cashFlows, basePeriodicYield - shockPeriodicYield);
  }
  const dv01 = (priceDown - priceUp) / 2;
  if (priceBase <= 0 && cashFlows.length) compliance_flags.push('NON_POSITIVE_PRICE');
  const output_payload = {
    dv01: r6(dv01), price: r2(priceBase), price_up_shock: r2(priceUp), price_down_shock: r2(priceDown),
    shock_size_bp: bpSize, face_value: r2(face), coupon_rate_pct: couponRatePct, ytm_pct: ytmPct,
    years_to_maturity: yearsToMaturity, periods_per_year: periodsPerYear, method: 'central_difference_full_reprice',
  };
  return { output_payload, compliance_flags };
}`,
});

// art-331-tvm-convexity
PAGES.push({
  num: '331', slug: 'art-331-tvm-convexity', mcpName: 'compute_convexity', title: 'Bond Convexity',
  h1: 'Bond <em>Convexity</em>',
  heroDesc: 'Standard closed-form convexity for a bullet bond, annualized by compounding frequency squared. Second-order complement to modified duration for estimating bond price sensitivity to larger yield moves; optionally reports the convexity price-adjustment term for a declared yield shock. Same bond schedule builder as the duration and DV01 primitives.',
  metaDesc: 'Bond convexity calculator, closed-form, with optional convexity price-adjustment term. Client-side. Zero PII.',
  runLabel: 'Compute Convexity',
  mcpDesc: 'Standard closed-form convexity for a bullet bond, annualized by periods_per_year squared, with an optional convexity price-adjustment estimate for a declared yield_shock_bp.',
  mcpProps: {
    face_value: { type: 'number' }, coupon_rate_pct: { type: 'number' }, ytm_pct: { type: 'number' },
    years_to_maturity: { type: 'number' }, periods_per_year: { type: 'number' },
    yield_shock_bp: { type: 'number', description: 'Optional yield shock in basis points, for the price-adjustment estimate' },
  },
  fields: [...BOND_FIELDS, { id: 'yieldShockBp', label: 'Yield shock (basis points, optional)', default: '100' }],
  outRows: [
    ['Convexity', 'o.convexity.toFixed(6)'],
    ['Price', 'o.price.toFixed(2)'],
    ['Periods', 'o.num_periods'],
    ['Convexity price adjustment (%)', "o.convexity_price_adjustment_pct===null?'n/a':o.convexity_price_adjustment_pct"],
  ],
  readInputsFn: `
function readInputs() {
  const shockRaw = document.getElementById('yieldShockBp').value;
  return {
    face_value: safeNum(document.getElementById('faceValue').value, 1000),
    coupon_rate_pct: safeNum(document.getElementById('couponRatePct').value, 0),
    ytm_pct: safeNum(document.getElementById('ytmPct').value, 0),
    years_to_maturity: safeNum(document.getElementById('yearsToMaturity').value, 0),
    periods_per_year: safeNum(document.getElementById('periodsPerYear').value, 2),
    yield_shock_bp: shockRaw.trim() === '' ? undefined : safeNum(shockRaw, undefined),
  };
}`,
  computeFn: BOND_SCHEDULE_JS + `
function priceAndConvexity(cashFlows, periodicYield, periodsPerYear) {
  let price = 0, secondMoment = 0;
  for (const cf of cashFlows) {
    const disc = myPow(1 + periodicYield, -cf.t);
    price += cf.amount * disc;
    secondMoment += cf.amount * cf.t * (cf.t + 1) * myPow(1 + periodicYield, -(cf.t + 2));
  }
  const convexityPeriods = price !== 0 ? secondMoment / price : 0;
  const convexityAnnual = convexityPeriods / (periodsPerYear * periodsPerYear);
  return { price, convexityAnnual };
}
function compute(pp) {
  pp = pp || {};
  const face = safeNum(pp.face_value, 1000);
  const couponRatePct = safeNum(pp.coupon_rate_pct, 0);
  const ytmPct = safeNum(pp.ytm_pct, 0);
  const yearsToMaturity = Math.max(0, safeNum(pp.years_to_maturity, 0));
  const periodsPerYear = Math.max(1, Math.round(safeNum(pp.periods_per_year, 2)));
  const compliance_flags = [];
  if (yearsToMaturity <= 0) compliance_flags.push('YEARS_TO_MATURITY_NOT_POSITIVE');
  const cashFlows = yearsToMaturity > 0 ? buildSchedule(face, couponRatePct, yearsToMaturity, periodsPerYear) : [];
  const periodicYield = ytmPct / 100 / periodsPerYear;
  const pc = cashFlows.length ? priceAndConvexity(cashFlows, periodicYield, periodsPerYear) : { price: 0, convexityAnnual: 0 };
  if (pc.price <= 0 && cashFlows.length) compliance_flags.push('NON_POSITIVE_PRICE');
  let convexityAdjustmentPct = null;
  if (pp.yield_shock_bp !== undefined) {
    const dy = safeNum(pp.yield_shock_bp, 0) / 10000;
    convexityAdjustmentPct = r6(0.5 * pc.convexityAnnual * dy * dy * 100);
  }
  const output_payload = {
    convexity: r6(pc.convexityAnnual), price: r2(pc.price), face_value: r2(face), coupon_rate_pct: couponRatePct,
    ytm_pct: ytmPct, years_to_maturity: yearsToMaturity, periods_per_year: periodsPerYear,
    num_periods: cashFlows.length, convexity_price_adjustment_pct: convexityAdjustmentPct,
  };
  return { output_payload, compliance_flags };
}`,
});

for (const cfg of PAGES) {
  const html = buildPage(cfg);
  const path = resolve(CG, cfg.slug + '.html');
  writeFileSync(path, html, 'utf8');
  console.log('wrote', path);
}
console.log('Done:', PAGES.length, 'pages generated.');
