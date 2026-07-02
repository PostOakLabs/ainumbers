#!/usr/bin/env node
/**
 * scripts/gen-canvas.mjs
 *
 * Generates repo/chaingraph/workbench/canvas.html — the Phase E free-form
 * node canvas where a user drag-connects art-* nodes and executes the
 * composed graph via iframe+AINBridge to produce one composite artifact.
 *
 * Node catalog (NODES) is inlined at build time — zero network calls per
 * CONTRACT §0.4. Each node carries:
 *   { tool_id, display_name, iframe_src, can_run, feeds[], consumes[] }
 *
 * can_run = tool HTML file exists AND contains window.AINBridge.
 * iframe_src = relative path from chaingraph/workbench/ to the tool HTML.
 *
 * Usage:
 *   node scripts/gen-canvas.mjs          # generate / update canvas.html
 *   node scripts/gen-canvas.mjs --check  # exit non-zero if stale
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO      = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CG_PATH   = resolve(REPO, 'chaingraph/chaingraph.json');
const WB_DIR    = resolve(REPO, 'chaingraph/workbench');
const OUT_PATH  = resolve(WB_DIR, 'canvas.html');
const CHECK     = process.argv.includes('--check');

/* ── load chaingraph.json ─────────────────────────────────────────── */
const cg = JSON.parse(readFileSync(CG_PATH, 'utf8'));

/* ── AINBridge check (cached reads) ──────────────────────────────── */
const bridgeCache = new Map();
function hasBridge(toolId) {
  if (bridgeCache.has(toolId)) return bridgeCache.get(toolId);
  let p;
  if (toolId.startsWith('art-')) p = resolve(REPO, 'chaingraph', toolId + '.html');
  else                           p = resolve(REPO, 'tools',      toolId + '.html');
  if (!existsSync(p)) { bridgeCache.set(toolId, false); return false; }
  const ok = readFileSync(p, 'utf8').includes('window.AINBridge');
  bridgeCache.set(toolId, ok);
  return ok;
}

function iframeSrc(toolId, canRun) {
  if (!canRun) return null;
  if (toolId.startsWith('art-')) return '../' + toolId + '.html';
  return '../../tools/' + toolId + '.html';
}

function slugDisplay(toolId) {
  return toolId.replace(/^art-\d+-/, '').replace(/^\d+-/, '')
    .split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ── build node catalog ──────────────────────────────────────────── */
const catalog = cg.nodes.map(n => {
  const can_run = hasBridge(n.tool_id);
  return {
    tool_id:      n.tool_id,
    display_name: n.display_name || slugDisplay(n.tool_id),
    iframe_src:   iframeSrc(n.tool_id, can_run),
    can_run,
    feeds:        n.feeds   || [],
    consumes:     n.consumes || [],
  };
});

const runnableCount = catalog.filter(n => n.can_run).length;
console.log(`gen-canvas: ${catalog.length} nodes (${runnableCount} browser-runnable)`);

const NODES_JSON = JSON.stringify(catalog);

/* ── G5: curated template chains ────────────────────────────────── */
const NODE_BY_TOOL = Object.fromEntries(catalog.map(n => [n.tool_id, n]));
/* Chains whose steps are ALL canvas-renderable art-* nodes */
const TEMPLATE_NAMES = [
  'agent-identity-trust',          // Agent identity · 3 steps
  'agent-commerce-conformance',     // Agent commerce · 4 steps
  'digital-trade-ebl-enforceability', // Digital trade · 3 steps
  'digital-trade-doc-integrity',    // Trade doc integrity · 3 steps
  'treasury-clearing-repo-margin',  // Repo margin · 4 steps
  'treasury-clearing-collateral',   // Collateral · 3 steps
  'canton-margin-call',             // Canton / DvP · 3 steps
  'wholesale-settlement-deposit-token', // Settlement · 3 steps
  'nis2-entity-scope-and-obligations',  // NIS2 · 3 steps
  'eudr-due-diligence-statement-validation', // EUDR · 3 steps
];

function chainGState(chain) {
  const NW_S = 224, GAP_S = 80, Y_S = 280;
  const n = chain.steps.map((s, i) => ({ i: i + 1, t: s.tool_id, x: 80 + i * (NW_S + GAP_S), y: Y_S }));
  const e = [];
  for (let i = 0; i < chain.steps.length - 1; i++) e.push({ f: i + 1, t: i + 2 });
  return Buffer.from(JSON.stringify({ n, e })).toString('base64url');
}

const templateCards = TEMPLATE_NAMES.map(name => {
  const chain = cg.chains.find(c => c.name === name);
  if (!chain) return null;
  /* all steps must be art-* nodes known to the canvas catalog */
  if (!chain.steps.every(s => NODE_BY_TOOL[s.tool_id])) return null;
  const g = chainGState(chain);
  const safeTitle = chain.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  return '<div class="cv-tmpl" data-g="' + g + '">'
    + '<div class="cv-tmpl-title">' + safeTitle + '</div>'
    + '<div class="cv-tmpl-steps">' + chain.steps.length + ' steps</div>'
    + '</div>';
}).filter(Boolean);

const TEMPLATES_HTML = templateCards.join('');

/* ── HTML template ──────────────────────────────────────────────── */
const NODES_PH = '/*__NODES_DATA__*/';
const TEMPLATES_PH = '/*__TEMPLATES_HTML__*/';

function renderCanvas() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<title>Canvas · Free-form Node Editor · OpenChainGraph Suite · AINumbers.co</title>
<meta name="description" content="OpenChainGraph Canvas — drag-connect OCG nodes into a custom chain, run it in-browser, and export one verified composite artifact.">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23080E1A'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='Sora,sans-serif' font-weight='600' font-size='13' fill='%2314B8A6'>AI</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#080E1A;--bg-2:#0D1627;--bg-3:#111E35;--bg-4:#162340;--border:#1E2F4A;--border-2:#263855;--muted:#3A5270;--body:#6888A8;--text:#A8C4DE;--bright:#D4E8F8;--white:#EEF6FD;--teal:#14B8A6;--teal-dim:rgba(20,184,166,.12);--teal-lt:#2DD4BF;--gold:#D4A847;--green:#22C55E;--green-dim:rgba(34,197,94,.12);--green-lt:#4ADE80;--red:#EF4444;--warn:#F59E0B;--warn-dim:rgba(245,158,11,.12);--purple:#9B72F5;--radius:6px;--radius-lg:10px}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:var(--bg);color:var(--text);font-family:'Sora',sans-serif;font-weight:300;font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow:hidden;display:flex;flex-direction:column}
h1,h2,h3{font-family:'DM Serif Display',serif;font-weight:400;line-height:1.2}
a{color:var(--teal-lt);text-decoration:none}a:hover{color:var(--white)}
button{cursor:pointer;font-family:inherit}
nav{height:52px;border-bottom:1px solid var(--border);background:rgba(8,14,26,.95);position:relative;z-index:200;backdrop-filter:blur(8px);flex-shrink:0}
.nav-inner{max-width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 1.25rem}
.logo-name{font-family:'JetBrains Mono',monospace;font-size:.88rem;font-weight:600;color:var(--bright)}
.logo-ai{color:var(--teal)}.logo-co{color:var(--muted);font-size:.75rem}
.nav-bc{font-family:'JetBrains Mono',monospace;font-size:.55rem;color:var(--muted)}
.nav-bc a{color:var(--body)}
.nav-badge{font-family:'JetBrains Mono',monospace;font-size:.48rem;letter-spacing:.1em;text-transform:uppercase;color:var(--teal);border:1px solid rgba(20,184,166,.3);padding:.2rem .55rem;border-radius:3px}
.pii-bar{font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--warn);background:var(--warn-dim);border-bottom:1px solid rgba(245,158,11,.25);padding:.45rem 1.25rem;flex-shrink:0}
.cv-grid{flex:1;display:grid;grid-template-columns:260px 1fr 320px;min-height:0;overflow:hidden}
/* Left pane — palette */
.pane-left{background:var(--bg-2);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
.pane-head{padding:.65rem .85rem;border-bottom:1px solid var(--border);flex-shrink:0}
.pane-label{font-family:'JetBrains Mono',monospace;font-size:.48rem;letter-spacing:.18em;text-transform:uppercase;color:var(--teal);margin-bottom:.45rem}
.search-wrap{position:relative;margin-bottom:.4rem}
.search-wrap input{width:100%;background:var(--bg-3);border:1px solid var(--border-2);color:var(--bright);border-radius:var(--radius);padding:.4rem .7rem .4rem 1.8rem;font-family:'Sora',sans-serif;font-size:.75rem;outline:none}
.search-wrap input:focus{border-color:var(--teal)}
.search-icon{position:absolute;left:.55rem;top:50%;transform:translateY(-50%);color:var(--muted);font-size:.7rem;pointer-events:none}
.filter-bar{display:flex;align-items:center;gap:.5rem}
.filter-check{font-family:'JetBrains Mono',monospace;font-size:.52rem;color:var(--body);display:flex;align-items:center;gap:.25rem;cursor:pointer}
.filter-check input{accent-color:var(--teal)}
.pal-count{font-family:'JetBrains Mono',monospace;font-size:.48rem;color:var(--muted);margin-left:auto}
.palette-list{flex:1;overflow-y:auto}
.palette-list::-webkit-scrollbar{width:3px}
.palette-list::-webkit-scrollbar-thumb{background:var(--border-2);border-radius:2px}
.pal-item{padding:.45rem .85rem;border-bottom:1px solid rgba(30,47,74,.5);cursor:pointer;transition:background .1s;display:flex;align-items:center;gap:.4rem}
.pal-item:hover{background:var(--bg-3)}
.pal-name{font-size:.72rem;color:var(--bright);font-weight:400;line-height:1.25;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pal-badge{font-family:'JetBrains Mono',monospace;font-size:.42rem;padding:.1rem .35rem;border-radius:2px;flex-shrink:0;text-transform:uppercase;letter-spacing:.05em}
.pal-badge.run{background:var(--teal-dim);color:var(--teal-lt);border:1px solid rgba(20,184,166,.25)}
.pal-badge.srv{background:rgba(107,114,128,.1);color:var(--muted);border:1px solid rgba(107,114,128,.2)}
.pal-empty{padding:1.2rem .85rem;font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--muted);text-align:center}
/* Center pane — canvas */
.pane-center{position:relative;display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}
.cv-toolbar{padding:.45rem .9rem;border-bottom:1px solid var(--border);background:var(--bg-2);display:flex;align-items:center;gap:.55rem;flex-shrink:0}
.cv-btn{border:none;padding:.42rem 1rem;border-radius:var(--radius);font-family:'JetBrains Mono',monospace;font-size:.56rem;letter-spacing:.08em;text-transform:uppercase;font-weight:600;transition:background .2s}
.cv-btn-teal{background:var(--teal);color:var(--bg)}.cv-btn-teal:hover:not(:disabled){background:var(--teal-lt)}
.cv-btn-dim{background:var(--bg-4);border:1px solid var(--border-2);color:var(--body)}.cv-btn-dim:hover{border-color:var(--teal);color:var(--teal-lt)}
.cv-btn:disabled{opacity:.4;cursor:not-allowed}
.cv-status{font-family:'JetBrains Mono',monospace;font-size:.55rem;color:var(--body);margin-left:.4rem;flex:1}
.cv-hint{font-family:'JetBrains Mono',monospace;font-size:.48rem;color:var(--muted);text-align:right}
.canvas-wrap{flex:1;overflow:auto;position:relative}
#canvas-svg{display:block;cursor:default}
/* Canvas node SVG styles (applied via class on <g>) */
.cn rect.cn-bg{fill:var(--bg-3);stroke:var(--border-2);stroke-width:1.5;rx:5}
.cn.runnable rect.cn-bg{stroke:rgba(20,184,166,.4)}
.cn.selected rect.cn-bg{stroke:var(--teal);stroke-width:2}
.cn text.cn-name{font-family:'Sora',sans-serif;font-size:11px;font-weight:400;fill:var(--bright);pointer-events:none}
.cn text.cn-tid{font-family:'JetBrains Mono',monospace;font-size:8.5px;fill:var(--muted);pointer-events:none}
.cn circle.port{fill:var(--bg-4);stroke:var(--border-2);stroke-width:1.5;cursor:crosshair;transition:fill .12s}
.cn.runnable circle.port{stroke:rgba(20,184,166,.5)}
.cn circle.port:hover{fill:var(--teal);stroke:var(--teal)}
.cn text.cn-run{font-family:'JetBrains Mono',monospace;font-size:8px;fill:var(--teal);pointer-events:none}
.cv-edge{fill:none;stroke:var(--border-2);stroke-width:1.5}
.cv-edge.valid{stroke:rgba(20,184,166,.5)}
.cv-preview{fill:none;stroke:var(--teal);stroke-width:1.5;stroke-dasharray:5,3;pointer-events:none}
/* Empty canvas state + G5 template cards */
.cv-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6rem;pointer-events:none;padding:1rem}
.cv-empty-icon{font-size:2.5rem;opacity:.2}
.cv-empty-title{font-size:.9rem;color:var(--body)}
.cv-empty-hint{font-family:'JetBrains Mono',monospace;font-size:.52rem;color:var(--muted);text-align:center}
.cv-tmpl-label{font-family:'JetBrains Mono',monospace;font-size:.48rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:.25rem}
.cv-templates{display:flex;flex-wrap:wrap;gap:.45rem;justify-content:center;max-width:680px;pointer-events:auto}
.cv-tmpl{background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:.4rem .65rem;cursor:pointer;transition:all .15s;text-align:center;min-width:120px}
.cv-tmpl:hover{border-color:var(--teal);background:var(--teal-dim)}
.cv-tmpl-title{font-size:.65rem;color:var(--bright);font-weight:400;line-height:1.25}
.cv-tmpl-steps{font-family:'JetBrains Mono',monospace;font-size:.46rem;color:var(--muted);margin-top:.15rem}
/* Right pane — artifact */
.pane-right{background:var(--bg-2);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto}
.pane-right::-webkit-scrollbar{width:3px}
.pane-right::-webkit-scrollbar-thumb{background:var(--border-2);border-radius:2px}
.rp-section{padding:.8rem .95rem;border-bottom:1px solid var(--border)}
.rp-label{font-family:'JetBrains Mono',monospace;font-size:.48rem;letter-spacing:.18em;text-transform:uppercase;color:var(--teal);margin-bottom:.5rem}
.rp-title{font-size:.85rem;color:var(--white);font-weight:500;margin-bottom:.2rem}
.rp-meta{font-family:'JetBrains Mono',monospace;font-size:.5rem;color:var(--muted);line-height:1.5}
.hash-display{font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--green-lt);word-break:break-all;background:var(--bg-3);border:1px solid var(--border);border-radius:var(--radius);padding:.55rem .7rem;margin-bottom:.45rem}
.hash-label{color:var(--muted);margin-right:.3rem}
.verify-row{display:flex;align-items:center;gap:.45rem;margin-bottom:.45rem}
.verify-out{font-family:'JetBrains Mono',monospace;font-size:.52rem}
.v-ok{color:var(--green-lt)}.v-fail{color:var(--red)}
.ex-row{display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:.3rem}
.ex-btn{border:none;padding:.45rem .8rem;border-radius:var(--radius);font-family:'JetBrains Mono',monospace;font-size:.5rem;letter-spacing:.06em;text-transform:uppercase;font-weight:600;transition:background .2s}
.ex-primary{background:var(--teal);color:var(--bg)}.ex-primary:hover{background:var(--teal-lt)}
.ex-secondary{background:var(--bg-4);color:var(--text);border:1px solid var(--border-2)}.ex-secondary:hover{border-color:var(--teal);color:var(--teal-lt)}
.ex-purple{background:var(--purple);color:var(--white)}.ex-purple:hover{opacity:.9}
.ex-btn:disabled{opacity:.35;cursor:not-allowed}
.rp-empty{padding:1.4rem .95rem;font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--muted);line-height:1.7}
.step-log{font-family:'JetBrains Mono',monospace;font-size:.52rem;line-height:1.5}
.step-log .sl-ok{color:var(--green-lt)}.step-log .sl-skip{color:var(--muted)}.step-log .sl-err{color:var(--red)}
/* Iframe farm — off-screen execution */
#iframe-farm{position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden}
</style>
</head>
<body>

<nav><div class="nav-inner">
  <div class="logo-name"><span class="logo-ai">AI</span>Numbers<span class="logo-co">.co</span></div>
  <div class="nav-bc"><a href="../../index.html">All Tools</a> / <a href="../chaingraph-hub.html">OpenChainGraph Hub</a> / <a href="workbench.html">Workbench</a> / Canvas</div>
  <span class="nav-badge">Phase E &middot; Canvas</span>
</div></nav>

<div class="pii-bar">&#x1F512; All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data &mdash; use synthetic or anonymised inputs only.</div>

<div class="cv-grid">

  <!-- ══ LEFT PANE — palette ══ -->
  <div class="pane-left">
    <div class="pane-head">
      <div class="pane-label">Node Palette</div>
      <div class="search-wrap">
        <span class="search-icon">&#x1F50D;</span>
        <input id="palSearch" type="search" placeholder="Search nodes&hellip;" autocomplete="off" spellcheck="false">
      </div>
      <div class="filter-bar">
        <label class="filter-check"><input type="checkbox" id="runnableOnly"> &#x25B6; runnable only</label>
        <span class="pal-count" id="palCount"></span>
      </div>
    </div>
    <div class="palette-list" id="paletteList"></div>
  </div>

  <!-- ══ CENTER PANE — canvas ══ -->
  <div class="pane-center">
    <div class="cv-toolbar">
      <button class="cv-btn cv-btn-teal" id="runBtn" onclick="runCanvas()" disabled>&#x25B6; Run</button>
      <button class="cv-btn cv-btn-dim" onclick="clearCanvas()">&#x2715; Clear</button>
      <button class="cv-btn cv-btn-dim" id="layoutBtn" onclick="autoLayout()" title="Auto-arrange nodes by topology">&#x25A4; Layout</button>
      <button class="cv-btn cv-btn-dim" onclick="copyDeepLink()" id="linkBtn" title="Copy deep-link to clipboard">&#x1F517; Link</button>
      <span class="cv-status" id="cvStatus">Add nodes from the palette to begin</span>
      <span class="cv-hint" id="cvHint"></span>
    </div>
    <div class="canvas-wrap" id="canvasWrap">
      <svg id="canvas-svg" xmlns="http://www.w3.org/2000/svg" width="3000" height="2000"></svg>
      <div class="cv-empty" id="cvEmpty">
        <div class="cv-empty-icon">&#x26D3;</div>
        <div class="cv-empty-title">Start from a chain or drag nodes from the palette</div>
        <div class="cv-empty-hint">Click a starting point below, or add nodes from the left panel.<br>Connect output ports (&bull;) to input ports &mdash; edges enforced via OCG feeds/consumes.</div>
        <div class="cv-tmpl-label">Starting points</div>
        <div class="cv-templates" id="cvTemplates">${TEMPLATES_PH}</div>
      </div>
    </div>
  </div>

  <!-- ══ RIGHT PANE — artifact ══ -->
  <div class="pane-right">
    <div id="rpEmpty" class="rp-empty">
      Compose and run a graph to see the composite artifact here.
    </div>

    <div id="rpArtifact" style="display:none">
      <div class="rp-section">
        <div class="rp-label">Run Summary</div>
        <div class="rp-title" id="rpSummary"></div>
        <div class="rp-meta step-log" id="rpStepLog"></div>
      </div>
      <div class="rp-section">
        <div class="rp-label">&#167;4 Composite Execution Hash</div>
        <div class="hash-display"><span class="hash-label">execution_hash:</span><span id="apHash"></span></div>
        <div class="verify-row">
          <button class="ex-btn ex-primary" onclick="apVerify()">&#x2713; Verify</button>
          <span class="verify-out" id="apVerifyOut"></span>
        </div>
      </div>
      <div class="rp-section">
        <div class="rp-label">Export</div>
        <div class="ex-row">
          <button class="ex-btn ex-primary" onclick="apExportArtifact()">&#x2B07; &#167;4 Artifact</button>
          <button class="ex-btn ex-purple" onclick="apExportVC()">&#x2B07; W3C VC (&#167;13.11)</button>
        </div>
        <div class="ex-row">
          <button class="ex-btn ex-secondary" onclick="apSign()">&#x2B07; Sign (Ed25519 &middot; &#167;16)</button>
          <button class="ex-btn ex-secondary" onclick="apVerifySig()">&#x1F510; Verify signature</button>
        </div>
      </div>
    </div>
  </div>

</div>

<!-- Hidden iframe farm for AINBridge execution -->
<div id="iframe-farm"></div>

<!-- ════ CANVAS LOGIC ════ -->
<script>
'use strict';
/* Node catalog — inlined at build time by gen-canvas.mjs. Zero network calls. */
var NODES = ${NODES_PH};

/* ── node lookup ── */
var NODE_BY_ID = {};
for (var _ni = 0; _ni < NODES.length; _ni++) NODE_BY_ID[NODES[_ni].tool_id] = NODES[_ni];

/* ── canvas constants ── */
var NW = 224, NH = 56, PORT_R = 7, PORT_Y = NH / 2;
var CANVAS_W = 3000, CANVAS_H = 2000;
var GRID = 20;

/* ── state ── */
var canvasNodes = [];   /* [{id, tool_id, x, y}] */
var edges = [];         /* [{id, from_id, to_id}] */
var nextNodeId = 1;
var nextEdgeId = 1;
var selectedNodeId = null;
var drag = null;        /* {nodeId, dx, dy} when dragging a node */
var connecting = null;  /* {fromNodeId} when drawing an edge */
var mousePos = {x:0, y:0}; /* current mouse in SVG coords */
var currentArtifact = null;
var lastHash = null;

/* ── SVG helpers ── */
var svg = document.getElementById('canvas-svg');
function svgPt(e) {
  var r = svg.getBoundingClientRect();
  var wrap = document.getElementById('canvasWrap');
  return {
    x: e.clientX - r.left + wrap.scrollLeft,
    y: e.clientY - r.top  + wrap.scrollTop
  };
}
function snap(v) { return Math.round(v / GRID) * GRID; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function setStatus(s) { document.getElementById('cvStatus').textContent = s; }
function dl(content, name, type) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: type }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function ts14() { return new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14); }

/* ── palette ── */
function renderPalette() {
  var q = (document.getElementById('palSearch').value || '').toLowerCase().trim();
  var rOnly = document.getElementById('runnableOnly').checked;
  var filtered = NODES.filter(function(n) {
    if (rOnly && !n.can_run) return false;
    if (!q) return true;
    return (n.display_name + ' ' + n.tool_id).toLowerCase().indexOf(q) >= 0;
  });
  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var n = filtered[i];
    var badge = n.can_run
      ? '<span class="pal-badge run">&#x25B6; runnable</span>'
      : '<span class="pal-badge srv">server</span>';
    html += '<div class="pal-item" data-tid="' + esc(n.tool_id) + '">'
      + '<span class="pal-name" title="' + esc(n.tool_id) + '">' + esc(n.display_name) + '</span>'
      + badge + '</div>';
  }
  if (!filtered.length) html = '<div class="pal-empty">No matching nodes.</div>';
  document.getElementById('paletteList').innerHTML = html;
  document.getElementById('palCount').textContent = filtered.length + ' / ' + NODES.length;
}

document.getElementById('paletteList').onclick = function(e) {
  var item = e.target.closest('.pal-item');
  if (item && item.dataset.tid) addNode(item.dataset.tid, 80 + Math.random()*200 | 0, 80 + Math.random()*200 | 0);
};
document.getElementById('palSearch').addEventListener('input', renderPalette);
document.getElementById('runnableOnly').addEventListener('change', renderPalette);

/* ── add / remove nodes ── */
function addNode(tool_id, x, y, forceId) {
  var n = NODE_BY_ID[tool_id];
  if (!n) return;
  var id = forceId || nextNodeId++;
  if (id >= nextNodeId) nextNodeId = id + 1;
  canvasNodes.push({id: id, tool_id: tool_id, x: x, y: y});
  updateRunBtn();
  render();
  saveHash();
}

function removeNode(id) {
  canvasNodes = canvasNodes.filter(function(n) { return n.id !== id; });
  edges = edges.filter(function(e) { return e.from_id !== id && e.to_id !== id; });
  if (selectedNodeId === id) selectedNodeId = null;
  updateRunBtn();
  render();
  saveHash();
}

function clearCanvas() {
  canvasNodes = []; edges = []; selectedNodeId = null; drag = null; connecting = null;
  currentArtifact = null; lastHash = null;
  document.getElementById('rpEmpty').style.display = 'block';
  document.getElementById('rpArtifact').style.display = 'none';
  updateRunBtn();
  render();
  history.replaceState(null, '', location.pathname + location.search);
}

function updateRunBtn() {
  var hasRunnable = canvasNodes.some(function(n) { return NODE_BY_ID[n.tool_id] && NODE_BY_ID[n.tool_id].can_run; });
  document.getElementById('runBtn').disabled = !hasRunnable;
  document.getElementById('cvEmpty').style.display = canvasNodes.length ? 'none' : 'flex';
}

/* ── edge validity ── */
function canConnect(fromToolId, toToolId) {
  var from = NODE_BY_ID[fromToolId];
  var to   = NODE_BY_ID[toToolId];
  if (!from || !to) return false;
  if (from.feeds && from.feeds.indexOf(toToolId) >= 0) return true;
  if (to.consumes && to.consumes.indexOf(fromToolId) >= 0) return true;
  return false;
}

function addEdge(fromId, toId) {
  /* no self-loop, no duplicate */
  if (fromId === toId) return;
  for (var i = 0; i < edges.length; i++) if (edges[i].from_id === fromId && edges[i].to_id === toId) return;
  var fn = canvasNodes.find(function(n){return n.id===fromId;});
  var tn = canvasNodes.find(function(n){return n.id===toId;});
  if (!fn || !tn) return;
  if (!canConnect(fn.tool_id, tn.tool_id)) {
    setStatus('⚠ Invalid edge — ' + fn.tool_id + ' does not feed ' + tn.tool_id);
    return;
  }
  edges.push({id: nextEdgeId++, from_id: fromId, to_id: toId});
  updateRunBtn();
  render();
  saveHash();
}

/* ── bezier edge path ── */
function bezierPath(x1, y1, x2, y2) {
  var dx = Math.abs(x2 - x1) * 0.45;
  return 'M' + x1 + ',' + y1 + ' C' + (x1+dx) + ',' + y1 + ' ' + (x2-dx) + ',' + y2 + ' ' + x2 + ',' + y2;
}

/* ── SVG render ── */
function render() {
  var parts = [];
  /* defs */
  parts.push('<defs>'
    + '<marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">'
    + '<polygon points="0 0, 8 3, 0 6" fill="rgba(56,80,120,.7)"/></marker>'
    + '<marker id="arrowhead-valid" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">'
    + '<polygon points="0 0, 8 3, 0 6" fill="rgba(20,184,166,.6)"/></marker>'
    + '</defs>');

  /* grid dots (subtle) */
  parts.push('<pattern id="grid-dots" x="0" y="0" width="' + GRID + '" height="' + GRID + '" patternUnits="userSpaceOnUse">'
    + '<circle cx="' + (GRID/2) + '" cy="' + (GRID/2) + '" r="0.8" fill="rgba(30,47,74,.5)"/></pattern>');
  parts.push('<rect width="' + CANVAS_W + '" height="' + CANVAS_H + '" fill="url(#grid-dots)"/>');

  /* edges */
  for (var ei = 0; ei < edges.length; ei++) {
    var e = edges[ei];
    var fn = canvasNodes.find(function(n){return n.id===e.from_id;});
    var tn = canvasNodes.find(function(n){return n.id===e.to_id;});
    if (!fn || !tn) continue;
    var x1 = fn.x + NW, y1 = fn.y + PORT_Y;
    var x2 = tn.x,      y2 = tn.y + PORT_Y;
    var isValid = canConnect(fn.tool_id, tn.tool_id);
    parts.push('<path class="cv-edge' + (isValid?' valid':'') + '" d="' + bezierPath(x1,y1,x2,y2) + '" marker-end="url(#' + (isValid?'arrowhead-valid':'arrowhead') + ')"/>');
  }

  /* preview edge while connecting */
  if (connecting) {
    var cfn = canvasNodes.find(function(n){return n.id===connecting.fromNodeId;});
    if (cfn) {
      var px1 = cfn.x + NW, py1 = cfn.y + PORT_Y;
      parts.push('<path class="cv-preview" d="' + bezierPath(px1,py1,mousePos.x,mousePos.y) + '"/>');
    }
  }

  /* nodes */
  for (var ni = 0; ni < canvasNodes.length; ni++) {
    var cn = canvasNodes[ni];
    var nd = NODE_BY_ID[cn.tool_id];
    if (!nd) continue;
    var cls = 'cn' + (nd.can_run?' runnable':'') + (cn.id===selectedNodeId?' selected':'');
    var tidShort = cn.tool_id.length > 28 ? cn.tool_id.slice(0,25)+'…' : cn.tool_id;
    var runMark = nd.can_run ? '<text class="cn-run" x="' + (NW-6) + '" y="14" text-anchor="end">&#x25B6;</text>' : '';
    parts.push(
      '<g class="' + cls + '" id="cn-' + cn.id + '" transform="translate(' + cn.x + ',' + cn.y + ')">'
      + '<rect class="cn-bg" width="' + NW + '" height="' + NH + '" rx="5"/>'
      + runMark
      + '<text class="cn-name" x="14" y="23" clip-path="url(#clip-' + cn.id + ')">' + esc(nd.display_name.length>22?nd.display_name.slice(0,20)+'…':nd.display_name) + '</text>'
      + '<text class="cn-tid" x="14" y="40">' + esc(tidShort) + '</text>'
      + '<circle class="port in-port" data-nid="' + cn.id + '" data-port="in" cx="0" cy="' + PORT_Y + '" r="' + PORT_R + '"/>'
      + '<circle class="port out-port" data-nid="' + cn.id + '" data-port="out" cx="' + NW + '" cy="' + PORT_Y + '" r="' + PORT_R + '"/>'
      + '<rect class="cn-hit" width="' + NW + '" height="' + NH + '" rx="5" fill="transparent" data-nid="' + cn.id + '" data-role="body"/>'
      + '</g>'
    );
  }

  svg.innerHTML = parts.join('');
}

/* ── SVG mouse events ── */
svg.addEventListener('mousedown', function(e) {
  var pt = svgPt(e);
  var target = e.target;
  var nid = target.dataset.nid ? parseInt(target.dataset.nid) : null;
  var port = target.dataset.port;

  if (nid && port === 'out') {
    /* start edge drawing from output port */
    connecting = {fromNodeId: nid};
    mousePos = pt;
    e.preventDefault();
    return;
  }
  if (nid && port === 'in') {
    /* complete edge if connecting */
    if (connecting && connecting.fromNodeId !== nid) {
      addEdge(connecting.fromNodeId, nid);
    }
    connecting = null;
    render();
    e.preventDefault();
    return;
  }
  if (nid && target.dataset.role === 'body') {
    /* start dragging node */
    var cn = canvasNodes.find(function(n){return n.id===nid;});
    if (cn) {
      drag = {nodeId: nid, ox: pt.x - cn.x, oy: pt.y - cn.y};
      selectedNodeId = nid;
      render();
    }
    e.preventDefault();
    return;
  }
  /* click empty area = cancel connecting, deselect */
  if (connecting) { connecting = null; render(); }
  selectedNodeId = null;
  render();
});

svg.addEventListener('mousemove', function(e) {
  mousePos = svgPt(e);
  if (drag) {
    var cn = canvasNodes.find(function(n){return n.id===drag.nodeId;});
    if (cn) {
      cn.x = snap(mousePos.x - drag.ox);
      cn.y = snap(mousePos.y - drag.oy);
      render();
    }
  } else if (connecting) {
    render();
  }
});

svg.addEventListener('mouseup', function(e) {
  if (drag) { drag = null; saveHash(); }
  /* if mouseup on empty area while connecting, cancel */
  var port = e.target.dataset ? e.target.dataset.port : null;
  if (connecting && port !== 'in') { connecting = null; render(); }
});

svg.addEventListener('dblclick', function(e) {
  var nid = e.target.dataset ? parseInt(e.target.dataset.nid) : null;
  if (nid) removeNode(nid);
});

/* ── deep-link (#g=) ── */
function saveHash() {
  if (!canvasNodes.length) { history.replaceState(null,'',location.pathname+location.search); return; }
  var state = {
    n: canvasNodes.map(function(n){ return {i:n.id, t:n.tool_id, x:n.x, y:n.y}; }),
    e: edges.map(function(e){ return {f:e.from_id, t:e.to_id}; })
  };
  var json = JSON.stringify(state);
  var bytes = new TextEncoder().encode(json);
  var b64 = btoa(String.fromCharCode.apply(null, bytes)).replace(/[+]/g,'-').replace(/[/]/g,'_').replace(/=+$/,'');
  history.replaceState(null, '', '#g=' + b64);
}

function loadHash() {
  var hash = location.hash;
  if (!hash.startsWith('#g=')) return;
  try {
    var b64 = hash.slice(3).replace(/-/g,'+').replace(/_/g,'/');
    var padded = b64 + '=='.slice((b64.length+2)%4);
    var bytes = Uint8Array.from(atob(padded), function(c){return c.charCodeAt(0);});
    var state = JSON.parse(new TextDecoder().decode(bytes));
    for (var i = 0; i < state.n.length; i++) {
      var sn = state.n[i];
      addNode(sn.t, sn.x, sn.y, sn.i);
    }
    for (var j = 0; j < state.e.length; j++) {
      addEdge(state.e[j].f, state.e[j].t);
    }
  } catch(err) { /* ignore bad hash */ }
}

function copyDeepLink() {
  saveHash();
  var url = location.href;
  var btn = document.getElementById('linkBtn');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(function() {
      btn.textContent = '✓ Copied!';
      setTimeout(function(){ btn.innerHTML = '&#x1F517; Link'; }, 1800);
    }).catch(function(){ fallbackCopy(url); });
  } else { fallbackCopy(url); }
}
function fallbackCopy(t) {
  var ta = document.createElement('textarea');
  ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch(e){}
  document.body.removeChild(ta);
}

/* ── G4: bespoke auto-layout (longest-path layering + barycenter ordering) ── */
function autoLayout() {
  if (!canvasNodes.length) return;
  /* build adjacency + reverse adjacency */
  var adj = {}, radj = {};
  for (var i = 0; i < canvasNodes.length; i++) { adj[canvasNodes[i].id] = []; radj[canvasNodes[i].id] = []; }
  for (var ei = 0; ei < edges.length; ei++) {
    adj[edges[ei].from_id].push(edges[ei].to_id);
    radj[edges[ei].to_id].push(edges[ei].from_id);
  }
  /* longest-path layering: layer[id] = max dist to any successor */
  var lp = {};
  function longestPath(id) {
    if (lp[id] !== undefined) return lp[id];
    var succ = adj[id] || [], mx = 0;
    for (var k = 0; k < succ.length; k++) { var v = longestPath(succ[k]) + 1; if (v > mx) mx = v; }
    lp[id] = mx; return mx;
  }
  for (var n0 = 0; n0 < canvasNodes.length; n0++) longestPath(canvasNodes[n0].id);
  /* flip so sources = layer 0 */
  var maxL = 0;
  for (var n1 = 0; n1 < canvasNodes.length; n1++) if (lp[canvasNodes[n1].id] > maxL) maxL = lp[canvasNodes[n1].id];
  var layer = {};
  for (var n2 = 0; n2 < canvasNodes.length; n2++) layer[canvasNodes[n2].id] = maxL - lp[canvasNodes[n2].id];
  /* group by layer */
  var layers = {};
  for (var n3 = 0; n3 < canvasNodes.length; n3++) {
    var l = layer[canvasNodes[n3].id];
    if (!layers[l]) layers[l] = [];
    layers[l].push(canvasNodes[n3].id);
  }
  /* barycenter ordering within each layer */
  var prevPos = {};
  var layerNums = Object.keys(layers).map(Number).sort(function(a,b){return a-b;});
  for (var li = 0; li < layerNums.length; li++) {
    var lNum = layerNums[li];
    var ids = layers[lNum].slice();
    if (li === 0) {
      ids.sort(function(a,b){
        var na = canvasNodes.find(function(n){return n.id===a;});
        var nb = canvasNodes.find(function(n){return n.id===b;});
        return (na?na.y:0)-(nb?nb.y:0);
      });
    } else {
      ids.sort(function(a,b){
        function bc(id){
          var preds=radj[id]||[], sum=0, cnt=0;
          for(var p=0;p<preds.length;p++){if(prevPos[preds[p]]!==undefined){sum+=prevPos[preds[p]];cnt++;}}
          return cnt?sum/cnt:999;
        }
        return bc(a)-bc(b);
      });
    }
    for (var oi = 0; oi < ids.length; oi++) prevPos[ids[oi]] = oi;
    layers[lNum] = ids;
  }
  /* assign positions */
  var H_STRIDE = NW + 80, V_STRIDE = NH + 48, SX = 80, SY = 80;
  for (var li2 = 0; li2 < layerNums.length; li2++) {
    var lNum2 = layerNums[li2];
    var ids2 = layers[lNum2];
    for (var ni = 0; ni < ids2.length; ni++) {
      var cn = canvasNodes.find(function(n){return n.id===ids2[ni];});
      if (cn) { cn.x = snap(SX + li2 * H_STRIDE); cn.y = snap(SY + ni * V_STRIDE); }
    }
  }
  render(); saveHash();
}

/* ── topological sort ── */
function topoSort() {
  var adj = {}, inDeg = {};
  for (var i = 0; i < canvasNodes.length; i++) { adj[canvasNodes[i].id] = []; inDeg[canvasNodes[i].id] = 0; }
  for (var j = 0; j < edges.length; j++) {
    adj[edges[j].from_id].push(edges[j].to_id);
    inDeg[edges[j].to_id] = (inDeg[edges[j].to_id]||0) + 1;
  }
  var queue = canvasNodes.filter(function(n){ return !inDeg[n.id]; }).slice();
  var result = [];
  while (queue.length) {
    var cur = queue.shift();
    result.push(cur);
    var nbs = adj[cur.id] || [];
    for (var k = 0; k < nbs.length; k++) {
      inDeg[nbs[k]]--;
      if (!inDeg[nbs[k]]) {
        var nb = canvasNodes.find(function(n){return n.id===nbs[k];});
        if (nb) queue.push(nb);
      }
    }
  }
  /* append any remaining (cycles get appended last) */
  for (var m = 0; m < canvasNodes.length; m++) {
    if (result.indexOf(canvasNodes[m]) < 0) result.push(canvasNodes[m]);
  }
  return result;
}

/* ── execution helpers (mirrors runner pattern) ── */
function flattenScalars(obj) {
  var o = {};
  Object.keys(obj || {}).forEach(function(k) {
    var v = obj[k];
    if (v == null || typeof v === 'object') return;
    o[k] = v;
  });
  return o;
}

function delay(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }

var _NON_DET = new Set(['generated_at','issued_at','valid_from','valid_until','last_reviewed','mandate_id']);
function scrubNonDet(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrubNonDet);
  var o = {};
  for (var k of Object.keys(obj)) {
    if (_NON_DET.has(k)) continue;
    o[k] = scrubNonDet(obj[k]);
  }
  return o;
}

/* ── run canvas ── */
async function runCanvas() {
  var ordered = topoSort();
  if (!ordered.length) return;

  document.getElementById('runBtn').disabled = true;
  setStatus('Running…');

  /* clear prior iframes */
  var farm = document.getElementById('iframe-farm');
  farm.innerHTML = '';
  var iframes = {}, readyP = {};

  /* create iframes for runnable nodes */
  for (var i = 0; i < ordered.length; i++) {
    var cn = ordered[i];
    var nd = NODE_BY_ID[cn.tool_id];
    if (!nd || !nd.can_run || !nd.iframe_src) continue;
    var fr = document.createElement('iframe');
    fr.sandbox = 'allow-scripts allow-same-origin allow-forms';
    fr.title = nd.display_name;
    fr.style.cssText = 'width:1280px;height:800px;border:0';
    fr.src = nd.iframe_src;
    var id = cn.id;
    readyP[id] = new Promise(function(res){ fr.onload = res; });
    farm.appendChild(fr);
    iframes[id] = fr;
  }

  /* drive each step */
  var collected = [];
  var prior = null;
  for (var si = 0; si < ordered.length; si++) {
    var step = ordered[si];
    var snd  = NODE_BY_ID[step.tool_id];
    if (!snd) continue;

    if (!snd.can_run || !iframes[step.id]) {
      /* server-only node — include in results as skipped */
      setStatus('Skipping (server-only): ' + snd.display_name);
      collected.push({tool_id: step.tool_id, name: snd.display_name, applied: 0, mandate: null, skipped: true});
      continue;
    }

    setStatus('Running step ' + (si+1) + '/' + ordered.length + ': ' + snd.display_name);
    await readyP[step.id];
    var win = iframes[step.id].contentWindow;
    if (!win || !win.AINBridge) {
      collected.push({tool_id: step.tool_id, name: snd.display_name, applied: 0, mandate: null, skipped: false, error: 'no AINBridge'});
      prior = null;
      continue;
    }
    var applied = 0;
    if (prior && prior.mandate && prior.mandate.payload) {
      try { applied = win.AINBridge.apply(flattenScalars(prior.mandate.payload)) || 0; } catch(e){ applied = 0; }
    }
    win.AINBridge.run();
    await delay(220);
    var mandate = win.AINBridge.getMandate();
    collected.push({tool_id: step.tool_id, name: snd.display_name, applied: applied, mandate: mandate, skipped: false});
    prior = {mandate: mandate};
  }

  /* build preimage + hash */
  var stepIds = ordered.map(function(n){ return n.tool_id; });
  var preimage = {
    policy_parameters: {
      execution_backend: 'browser',
      canvas_id: 'user-composed',
      step_count: ordered.length,
      step_tool_ids: stepIds
    },
    output_payload: {
      steps: collected.map(function(s){
        return {
          tool_id: s.tool_id,
          mandate_type: s.mandate ? s.mandate.mandate_type : null,
          handoff_fields_applied: s.applied,
          payload: s.mandate ? scrubNonDet(s.mandate.payload) : null
        };
      })
    }
  };

  var hash = await sha256hex(preimage);
  lastHash = hash;

  /* build artifact */
  currentArtifact = Object.assign({}, preimage, {
    chaingraph_version: '0.4.0',
    mandate_type: 'canvas_composition',
    execution_hash: hash,
    generated_at: new Date().toISOString(),
    audit_signature: { verified: true, message: 'Canvas composite: ' + ordered.length + ' step(s)' }
  });

  /* show results */
  var ok = collected.filter(function(s){ return s.mandate; }).length;
  var skipped = collected.filter(function(s){ return s.skipped; }).length;
  setStatus('Done — ' + ok + '/' + ordered.length + ' step(s) produced a mandate');
  showArtifact(ok, skipped, collected);
  document.getElementById('runBtn').disabled = false;

  /* clean up iframes */
  farm.innerHTML = '';
}

async function sha256hex(obj) {
  var s = __ocgCanonStr(obj);
  var buf = new TextEncoder().encode(s);
  var dig = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(dig)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}

function showArtifact(ok, skipped, collected) {
  document.getElementById('rpEmpty').style.display = 'none';
  document.getElementById('rpArtifact').style.display = 'block';
  document.getElementById('apHash').textContent = lastHash;
  document.getElementById('apVerifyOut').textContent = '';
  var stepCount = collected.length;
  document.getElementById('rpSummary').textContent = ok + ' mandate(s) · ' + (stepCount - ok - skipped) + ' empty · ' + skipped + ' server-only';
  var logHtml = '';
  for (var i = 0; i < collected.length; i++) {
    var s = collected[i];
    if (s.skipped) logHtml += '<span class="sl-skip">○ ' + esc(s.name) + ' (server-only)</span><br>';
    else if (s.mandate) logHtml += '<span class="sl-ok">✓ ' + esc(s.name) + ' (↳ ' + esc(s.mandate.mandate_type||'?') + ')</span><br>';
    else logHtml += '<span class="sl-err">△ ' + esc(s.name) + (s.error?' — '+esc(s.error):'') + '</span><br>';
  }
  document.getElementById('rpStepLog').innerHTML = logHtml;
}

/* ── artifact panel ── */
async function apVerify() {
  if (!currentArtifact) return;
  var out = document.getElementById('apVerifyOut');
  out.textContent = 'recomputing…'; out.className = 'verify-out';
  try {
    var pre = { policy_parameters: currentArtifact.policy_parameters, output_payload: currentArtifact.output_payload };
    var re = await sha256hex(pre);
    if (re === currentArtifact.execution_hash) {
      out.className = 'verify-out v-ok'; out.textContent = '✓ verified — hash matches';
    } else {
      out.className = 'verify-out v-fail'; out.textContent = '✗ mismatch';
    }
  } catch(e) { out.className = 'verify-out v-fail'; out.textContent = 'error: ' + e.message; }
}

function apExportArtifact() {
  if (currentArtifact) dl(JSON.stringify(currentArtifact,null,2), 'canvas-composition_'+ts14()+'.artifact.json','application/json');
}

function apExportVC() {
  if (!currentArtifact || !lastHash) return;
  var vc = {
    '@context': ['https://www.w3.org/ns/credentials/v2','https://ainumbers.co/chaingraph/context/vc/v0.4.1'],
    type: ['VerifiableCredential','OpenChainGraphCredential'],
    id: 'urn:ocg:artifact:'+lastHash,
    issuer: 'https://ainumbers.co',
    credentialSubject: {
      id: 'urn:ocg:canvas:user-composed#canvas-runner',
      mandate_type: currentArtifact.mandate_type,
      policy_parameters: currentArtifact.policy_parameters,
      output_payload: currentArtifact.output_payload
    },
    'ocg:hashAnchor': {
      type: 'OpenChainGraphHashAnchor2026',
      digestMethod: 'sha-256',
      executionHash: lastHash,
      verify_url: 'https://ainumbers.co/chaingraph/workbench/canvas.html'
    }
  };
  dl(JSON.stringify(vc,null,2), 'canvas-composition_'+ts14()+'.vc.json','application/vc+json');
}

/* ── G5: template card click handler ── */
document.getElementById('cvTemplates').addEventListener('click', function(e) {
  var card = e.target.closest('.cv-tmpl');
  if (!card || !card.dataset.g) return;
  clearCanvas();
  var b64 = card.dataset.g.replace(/-/g,'+').replace(/_/g,'/');
  var padded = b64 + '=='.slice((b64.length+2)%4);
  try {
    var bytes = Uint8Array.from(atob(padded), function(c){return c.charCodeAt(0);});
    var state = JSON.parse(new TextDecoder().decode(bytes));
    for (var i = 0; i < state.n.length; i++) {
      var sn = state.n[i]; addNode(sn.t, sn.x, sn.y, sn.i);
    }
    for (var j = 0; j < state.e.length; j++) { addEdge(state.e[j].f, state.e[j].t); }
  } catch(err) {}
});

/* ── init ── */
window.addEventListener('DOMContentLoaded', function() {
  renderPalette();
  render();
  loadHash();
  var hint = document.getElementById('cvHint');
  if (hint) hint.textContent = NODES.filter(function(n){return n.can_run;}).length + ' of ' + NODES.length + ' nodes browser-runnable';
});
</script>

<script>
/* OCG-CANON v1 — RFC 8785/JCS (I-JSON). DO NOT hand-edit. Byte-identical to kernels/_hash.mjs. */
function __ocgCanon(v){return Array.isArray(v)?v.map(__ocgCanon):(v&&typeof v==='object')?Object.keys(v).sort().reduce((o,k)=>(o[k]=__ocgCanon(v[k]),o),{}):v;}
function __ocgAssertIJson(v){if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('OCG: non-finite number is not I-JSON');if(Number.isInteger(v)&&!Number.isSafeInteger(v))throw new Error('OCG: integer exceeds 2^53; pass as string');}else if(Array.isArray(v)){v.forEach(__ocgAssertIJson);}else if(v&&typeof v==='object'){for(const k of Object.keys(v))__ocgAssertIJson(v[k]);}}
function __ocgCanonStr(x){__ocgAssertIJson(x);return JSON.stringify(__ocgCanon(x));}
</script>
<script>
/* OCG-PROOF v1 — W3C Data Integrity eddsa-jcs-2022 (OCG §16). DO NOT hand-edit. Byte-identical to kernels/_proof.mjs. */
(function(){
  var CS='eddsa-jcs-2022';
  function jcs(o){return new TextEncoder().encode(JSON.stringify(__ocgCanon(o)));}
  function sha(b){return crypto.subtle.digest('SHA-256',b).then(function(d){return new Uint8Array(d);});}
  function secured(a){var c=structuredClone(a);if(c&&c.audit_signature&&'proof'in c.audit_signature)delete c.audit_signature.proof;return c;}
  function opts(vm,created){return{type:'DataIntegrityProof',cryptosuite:CS,verificationMethod:vm,proofPurpose:'assertionMethod',created:created};}
  function hashData(a,o){return Promise.all([sha(jcs(o)),sha(jcs(secured(a)))]).then(function(h){var oh=h[0],dh=h[1];var c=new Uint8Array(oh.length+dh.length);c.set(oh,0);c.set(dh,oh.length);return c;});}
  var B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58e(bytes){var z=0;while(z<bytes.length&&bytes[z]===0)z++;var d=[0];for(var i=z;i<bytes.length;i++){var c=bytes[i];for(var j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=(c/58)|0;}while(c){d.push(c%58);c=(c/58)|0;}}var s='';for(var k=0;k<z;k++)s+='1';for(var q=d.length-1;q>=0;q--)s+=B58[d[q]];return s;}
  function b58d(str){var z=0;while(z<str.length&&str[z]==='1')z++;var b=[0];for(var i=z;i<str.length;i++){var c=B58.indexOf(str[i]);if(c<0)throw new Error('bad base58');for(var j=0;j<b.length;j++){c+=b[j]*58;b[j]=c&255;c>>=8;}while(c){b.push(c&255);c>>=8;}}var out=new Uint8Array(z+b.length);for(var k=0;k<b.length;k++)out[z+b.length-1-k]=b[k];return out;}
  var MC=[0xed,0x01];
  function didFromPub(pk){return crypto.subtle.exportKey('raw',pk).then(function(r){var raw=new Uint8Array(r);var p=new Uint8Array(MC.length+raw.length);p.set(MC,0);p.set(raw,MC.length);return 'did:key:z'+b58e(p);});}
  function pubFromDid(did){if(did.indexOf('did:key:z')!==0)throw new Error('not did:key z-form');var p=b58d(did.slice(9));if(p[0]!==0xed||p[1]!==0x01)throw new Error('did:key not Ed25519');return crypto.subtle.importKey('raw',p.slice(2),{name:'Ed25519'},true,['verify']);}
  function sign(a,o){var po=opts(o.verificationMethod,o.created);return hashData(a,po).then(function(hd){return crypto.subtle.sign('Ed25519',o.privateKey,hd);}).then(function(s){var proof=Object.assign({},po,{proofValue:'z'+b58e(new Uint8Array(s))});var out=structuredClone(a);out.audit_signature=Object.assign({},out.audit_signature||{},{proof:proof});return out;});}
  function verify(a,pub){var pr=a&&a.audit_signature&&a.audit_signature.proof;if(!pr||pr.type!=='DataIntegrityProof'||pr.cryptosuite!==CS)return Promise.resolve(false);if(pr.proofPurpose!=='assertionMethod'||typeof pr.proofValue!=='string'||pr.proofValue[0]!=='z')return Promise.resolve(false);var po=opts(pr.verificationMethod,pr.created);return hashData(a,po).then(function(hd){var sig;try{sig=b58d(pr.proofValue.slice(1));}catch(e){return false;}return crypto.subtle.verify('Ed25519',pub,sig,hd);}).catch(function(){return false;});}
  window.__ocgSign=sign;window.__ocgVerify=verify;window.__ocgDidKeyFromPub=didFromPub;window.__ocgPubFromDidKey=pubFromDid;
})();
</script>
<script>
/* OCG-§16-UI v1 (canvas adaptation) — Sign + Verify wiring. */
async function apSign(){
  if(!currentArtifact)return;
  if(!confirm('Signing binds this run to a one-time key and de-anonymizes it (OCG §16.2). Continue?'))return;
  try{
    var kp=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
    var did=await __ocgDidKeyFromPub(kp.publicKey);
    var signed=await __ocgSign(currentArtifact,{verificationMethod:did,created:currentArtifact.generated_at,privateKey:kp.privateKey});
    dl(JSON.stringify(signed,null,2),'canvas-composition_'+ts14()+'.signed.json','application/json');
  }catch(e){alert('✗ signing failed: '+(e&&e.message?e.message:String(e)));}
}
async function apVerifySig(){
  var t=window.prompt('Paste a signed OCG artifact JSON to verify its §16 signature:');if(!t)return;
  var art;try{art=JSON.parse(t);}catch(e){alert('✗ not valid JSON');return;}
  var pr=art&&art.audit_signature&&art.audit_signature.proof;
  if(!pr){alert('✗ no §16 proof on this artifact');return;}
  try{var pub=await __ocgPubFromDidKey(pr.verificationMethod);alert(await __ocgVerify(art,pub)?'✓ §16 signature valid':'✗ signature invalid / tampered');}
  catch(e){alert('✗ '+(e&&e.message?e.message:'verify failed'));}
}
</script>
</body>
</html>`;

  return html.replace(NODES_PH, () => NODES_JSON).replace(TEMPLATES_PH, () => TEMPLATES_HTML);
}

/* ── check or write ──────────────────────────────────────────────── */
const html = renderCanvas();

if (CHECK) {
  if (!existsSync(OUT_PATH)) {
    console.error('✗ gen-canvas: canvas.html is missing (run: node scripts/gen-canvas.mjs)');
    process.exit(1);
  }
  const disk = readFileSync(OUT_PATH, 'utf8');
  if (disk !== html) {
    console.error('✗ gen-canvas: canvas.html is stale (run: node scripts/gen-canvas.mjs)');
    process.exit(1);
  }
  console.log('✓ gen-canvas: canvas.html up-to-date (' + catalog.length + ' nodes, ' + runnableCount + ' browser-runnable)');
  process.exit(0);
} else {
  mkdirSync(WB_DIR, { recursive: true });
  writeFileSync(OUT_PATH, html, 'utf8');
  console.log('gen-canvas: wrote chaingraph/workbench/canvas.html');
  console.log('  nodes: ' + catalog.length + ' total, ' + runnableCount + ' browser-runnable');
  console.log('  catalog size: ~' + Math.round(NODES_JSON.length / 1024) + 'KB inline');
}
