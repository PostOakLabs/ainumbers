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
    mcp_name:     n.mcp_name || null,
  };
});

const runnableCount = catalog.filter(n => n.can_run).length;
console.log(`gen-canvas: ${catalog.length} nodes (${runnableCount} browser-runnable)`);

const NODES_JSON = JSON.stringify(catalog);

/* ── H2: slim chain list for named-chain matching ────────────────── */
const CHAINS_SLIM = cg.chains.map(c => ({
  name:          c.name,
  step_tool_ids: c.steps.map(s => s.tool_id),
}));
const CHAINS_JSON = JSON.stringify(CHAINS_SLIM);

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
const CHAINS_PH = '/*__CHAINS_DATA__*/';
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
.canvas-wrap{flex:1;overflow:hidden;position:relative}
#canvas-svg{display:block;width:100%;height:100%;cursor:default}
.cv-zoom{font-family:'JetBrains Mono',monospace;font-size:.5rem;color:var(--muted);min-width:3rem;text-align:right;flex-shrink:0}
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
.cv-edge.selected{stroke:var(--teal);stroke-width:2.5}
.cv-edge-hit{fill:none;stroke:transparent;stroke-width:14;cursor:pointer}
.cv-preview{fill:none;stroke:var(--teal);stroke-width:1.5;stroke-dasharray:5,3;pointer-events:none}
.cn-drag-bar{fill:rgba(20,184,166,.05);cursor:move}
.cn-drag-bar:hover{fill:rgba(20,184,166,.18)}
.cn.selected .cn-drag-bar{fill:rgba(20,184,166,.12)}
.cn-drag-icon{font-size:7px;fill:rgba(20,184,166,.35);pointer-events:none}
.cn.selected .cn-drag-icon{fill:rgba(20,184,166,.65)}
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
/* ── G2: command palette ── */
.cmd-palette{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:400;display:none;align-items:flex-start;justify-content:center;padding-top:72px}
.cmd-palette.open{display:flex}
.cmd-p-inner{background:var(--bg-2);border:1px solid rgba(20,184,166,.35);border-radius:var(--radius-lg);width:520px;max-width:95vw;box-shadow:0 16px 48px rgba(0,0,0,.7);overflow:hidden}
.cmd-input{width:100%;box-sizing:border-box;background:transparent;border:none;border-bottom:1px solid var(--border-2);color:var(--bright);font-size:.85rem;font-family:'Sora',sans-serif;padding:.7rem 1rem;outline:none}
.cmd-results{max-height:300px;overflow-y:auto}
.cmd-results::-webkit-scrollbar{width:3px}
.cmd-results::-webkit-scrollbar-thumb{background:var(--border-2);border-radius:2px}
.cmd-item{padding:.45rem 1rem;cursor:pointer;font-size:.75rem;display:flex;align-items:center;gap:.5rem;border-bottom:1px solid rgba(30,47,74,.4);color:var(--text)}
.cmd-item:hover,.cmd-item.active{background:rgba(20,184,166,.1);color:var(--bright)}
.cmd-item .ci-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmd-item .ci-badge{font-family:'JetBrains Mono',monospace;font-size:.46rem;color:var(--teal);flex-shrink:0}
.cmd-item .ci-compat{font-family:'JetBrains Mono',monospace;font-size:.46rem;color:var(--green-lt);flex-shrink:0}
.cmd-hint-bar{padding:.3rem 1rem;font-family:'JetBrains Mono',monospace;font-size:.46rem;color:var(--muted);border-top:1px solid var(--border)}
/* H1: node inputs editor */
.ni-section{padding:.7rem .95rem;border-bottom:1px solid var(--border)}
.ni-json{width:100%;background:var(--bg-3);border:1px solid var(--border-2);color:var(--bright);font-family:'JetBrains Mono',monospace;font-size:.52rem;border-radius:var(--radius);padding:.5rem .65rem;resize:vertical;min-height:72px;outline:none;line-height:1.5}
.ni-json:focus{border-color:var(--teal)}
.ni-hint{font-family:'JetBrains Mono',monospace;font-size:.48rem;color:var(--muted);margin-top:.3rem;line-height:1.5}
.ni-err{font-family:'JetBrains Mono',monospace;font-size:.48rem;color:var(--red);margin-top:.2rem;display:none}
/* H2/H3: MCP panel */
.mcp-panel-section{padding:.7rem .95rem;border-bottom:1px solid var(--border);display:none}
.mcp-panel-section.open{display:block}
.mcp-code{font-family:'JetBrains Mono',monospace;font-size:.5rem;color:var(--text);background:var(--bg-3);border:1px solid var(--border);border-radius:var(--radius);padding:.55rem .7rem;margin-bottom:.4rem;white-space:pre;overflow-x:auto;line-height:1.45;max-height:220px;overflow-y:auto}
.mcp-copy-btn{background:var(--bg-4);border:1px solid var(--border-2);color:var(--body);padding:.4rem .85rem;border-radius:var(--radius);font-family:'JetBrains Mono',monospace;font-size:.5rem;letter-spacing:.08em;text-transform:uppercase;transition:all .2s;margin-right:.35rem}
.mcp-copy-btn:hover{border-color:var(--teal);color:var(--teal-lt)}
.mcp-dl-btn{background:var(--bg-4);border:1px solid var(--border-2);color:var(--body);padding:.4rem .85rem;border-radius:var(--radius);font-family:'JetBrains Mono',monospace;font-size:.5rem;letter-spacing:.08em;text-transform:uppercase;transition:all .2s}
.mcp-dl-btn:hover{border-color:var(--gold);color:var(--gold)}
.mcp-label{font-family:'JetBrains Mono',monospace;font-size:.46rem;color:var(--muted);margin-bottom:.45rem;line-height:1.5}
.mcp-divider{border:none;border-top:1px solid var(--border);margin:.55rem 0}
</style>
</head>
<body>

<nav><div class="nav-inner">
  <div class="logo-name"><span class="logo-ai">AI</span>Numbers<span class="logo-co">.co</span></div>
  <div class="nav-bc"><a href="../../index.html">All Tools</a> / <a href="../chaingraph-hub.html">OpenChainGraph Hub</a> / <a href="workbench.html">Workbench</a> / Canvas</div>
  <span class="nav-badge">Canvas</span>
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
      <button class="cv-btn cv-btn-dim" onclick="fitView()" title="Fit all nodes in view (F)">&#x26F6; Fit</button>
      <button class="cv-btn cv-btn-dim" onclick="copyDeepLink()" id="linkBtn" title="Copy permalink to this composition">&#x1F517; Link</button>
      <button class="cv-btn cv-btn-dim" onclick="toggleMcpPanel()" id="mcpBtn" title="Copy as MCP call">&#x1F4CB; MCP</button>
      <button class="cv-btn cv-btn-dim" onclick="proposeAsChain()" id="proposeBtn" title="Propose as named workflow">&#x1F4E8; Propose</button>
      <button class="cv-btn cv-btn-dim" onclick="openPalette()" title="Insert node (Ctrl+K)">&#x2318;K</button>
      <span class="cv-status" id="cvStatus">Add nodes from the palette to begin</span>
      <span class="cv-zoom" id="zoomPct">100%</span>
      <span class="cv-hint" id="cvHint"></span>
    </div>
    <div class="canvas-wrap" id="canvasWrap">
      <svg id="canvas-svg" xmlns="http://www.w3.org/2000/svg"><g id="viewport"></g></svg>
      <div class="cv-empty" id="cvEmpty">
        <div class="cv-empty-icon">&#x26D3;</div>
        <div class="cv-empty-title">Start from a chain or drag nodes from the palette</div>
        <div class="cv-empty-hint">Click a starting point below, or add nodes from the left panel.<br>Connect output ports (&bull;) to input ports: edges enforced via OCG feeds/consumes.</div>
        <div class="cv-tmpl-label">Starting points</div>
        <div class="cv-templates" id="cvTemplates">${TEMPLATES_PH}</div>
      </div>
    </div>
  </div>

  <!-- ══ RIGHT PANE — artifact ══ -->
  <div class="pane-right">
    <!-- H2: MCP call panel (toggle) -->
    <div id="rpMcpPanel" class="mcp-panel-section">
      <div class="rp-label">&#x1F4CB; MCP Call</div>
      <div class="mcp-label" id="mcpLabel"></div>
      <pre class="mcp-code" id="mcpSnippet"></pre>
      <button class="mcp-copy-btn" onclick="copyMcpSnippet()">&#x1F4CB; Copy snippet</button>
      <button class="mcp-dl-btn" id="mcpDlBtn" onclick="dlChainJson()" style="display:none">&#x2B07; Chain JSON</button>
      <hr class="mcp-divider">
      <div class="mcp-label" id="mcpSeqLabel" style="display:none"></div>
      <pre class="mcp-code" id="mcpSeqSnippet" style="display:none"></pre>
      <button class="mcp-copy-btn" id="mcpSeqCopyBtn" onclick="copyMcpSeq()" style="display:none">&#x1F4CB; Copy sequence</button>
    </div>
    <!-- H1: node inputs editor (shown when a node is selected) -->
    <div id="rpNodeInputs" class="ni-section" style="display:none">
      <div class="rp-label">Initial Inputs</div>
      <div class="rp-meta" id="rpNiLabel" style="margin-bottom:.4rem"></div>
      <textarea id="rpNiJson" class="ni-json" placeholder='{"field_id": "value"}' spellcheck="false" autocomplete="off"></textarea>
      <div class="ni-hint">JSON keys = form element IDs in the tool page. Applied to the selected node when running.</div>
      <div class="ni-err" id="rpNiErr">Invalid JSON</div>
    </div>
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

<!-- G2: command palette overlay -->
<div id="cmdPalette" class="cmd-palette" role="dialog" aria-modal="true" aria-label="Insert node">
  <div class="cmd-p-inner">
    <input id="cmdInput" class="cmd-input" placeholder="Search nodes&hellip; (Ctrl+K to open)" autocomplete="off" spellcheck="false"/>
    <div id="cmdResults" class="cmd-results" role="listbox"></div>
    <div class="cmd-hint-bar">&uarr;&darr; navigate &middot; Enter insert &middot; Esc close</div>
  </div>
</div>

<!-- Hidden iframe farm for AINBridge execution -->
<div id="iframe-farm"></div>

<!-- ════ CANVAS LOGIC ════ -->
<script>
'use strict';
/* Node catalog — inlined at build time by gen-canvas.mjs. Zero network calls. */
var NODES = ${NODES_PH};
/* Chain catalog (slim) — for H2 named-chain matching. */
var CHAINS = ${CHAINS_PH};

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
var selectedEdgeId = null;
var drag = null;        /* {nodeId, ox, oy} when dragging a node */
var connecting = null;  /* {fromNodeId} when drawing an edge (click-click or drag) */
var mousePos = {x:0, y:0}; /* current mouse in SVG coords */
var pan = null;         /* {startX, startY, startVpX, startVpY} during viewport pan */
var moveTarget = null;  /* nodeId waiting for click-to-position (WCAG 2.5.7) */
var currentArtifact = null;
var lastHash = null;
/* ── viewport (zoom/pan) ── */
var vpX = 0, vpY = 0, vpScale = 1;
var vp = null; /* <g id="viewport"> element, resolved on first use */
/* ── undo/redo ── */
var _history = [], _histIdx = -1;
var _loading = false; /* suppress pushHistory during batch load */
/* ── command palette ── */
var _paletteOpen = false, _paletteActiveIdx = 0, _cmdNodes = [];

/* ── SVG helpers ── */
var svg = document.getElementById('canvas-svg');
function getVp() { if (!vp) vp = document.getElementById('viewport'); return vp; }
function svgPt(e) {
  var r = svg.getBoundingClientRect();
  return { x: (e.clientX - r.left - vpX) / vpScale, y: (e.clientY - r.top - vpY) / vpScale };
}
function applyViewport() {
  getVp().setAttribute('transform', 'translate(' + vpX + ',' + vpY + ') scale(' + vpScale + ')');
}
function updateZoomPct() {
  var el = document.getElementById('zoomPct');
  if (el) el.textContent = Math.round(vpScale * 100) + '%';
}
function fitView() {
  if (!canvasNodes.length) return;
  var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (var i = 0; i < canvasNodes.length; i++) {
    var n = canvasNodes[i];
    if (n.x < minX) minX = n.x; if (n.y < minY) minY = n.y;
    if (n.x + NW > maxX) maxX = n.x + NW; if (n.y + NH > maxY) maxY = n.y + NH;
  }
  var r = svg.getBoundingClientRect(), W = r.width || 800, H = r.height || 500, PAD = 48;
  var cw = maxX - minX || 1, ch = maxY - minY || 1;
  vpScale = Math.min(3, Math.max(0.1, Math.min((W - PAD*2) / cw, (H - PAD*2) / ch)));
  vpX = PAD + (W - PAD*2 - cw*vpScale) / 2 - minX*vpScale;
  vpY = PAD + (H - PAD*2 - ch*vpScale) / 2 - minY*vpScale;
  applyViewport(); updateZoomPct();
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
function addNode(tool_id, x, y, forceId, inp) {
  var n = NODE_BY_ID[tool_id];
  if (!n) return null;
  var id = forceId || nextNodeId++;
  if (id >= nextNodeId) nextNodeId = id + 1;
  canvasNodes.push({id: id, tool_id: tool_id, x: x, y: y, inp: inp || {}});
  if (!forceId && !_loading) pushHistory(); /* push after so undo restores post-op state */
  updateRunBtn(); render(); saveHash(); updateNodeInfoPanel();
  return id;
}

function removeNode(id) {
  canvasNodes = canvasNodes.filter(function(n) { return n.id !== id; });
  edges = edges.filter(function(e) { return e.from_id !== id && e.to_id !== id; });
  if (selectedNodeId === id) selectedNodeId = null;
  if (selectedEdgeId) { var eids = edges.map(function(e){return e.id;}); if (eids.indexOf(selectedEdgeId)<0) selectedEdgeId=null; }
  if (!_loading) pushHistory();
  updateRunBtn(); render(); saveHash(); updateNodeInfoPanel();
}

function clearCanvas() {
  canvasNodes = []; edges = []; nextNodeId = 1; nextEdgeId = 1;
  selectedNodeId = null; selectedEdgeId = null;
  drag = null; connecting = null; moveTarget = null; pan = null;
  currentArtifact = null; lastHash = null;
  document.getElementById('rpEmpty').style.display = 'block';
  document.getElementById('rpArtifact').style.display = 'none';
  updateRunBtn(); render(); updateNodeInfoPanel();
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
  if (!_loading) pushHistory();
  updateRunBtn(); render(); saveHash();
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

  /* edges — hit area first, then visible path */
  for (var ei = 0; ei < edges.length; ei++) {
    var e = edges[ei];
    var fn = canvasNodes.find(function(n){return n.id===e.from_id;});
    var tn = canvasNodes.find(function(n){return n.id===e.to_id;});
    if (!fn || !tn) continue;
    var x1 = fn.x + NW, y1 = fn.y + PORT_Y;
    var x2 = tn.x,      y2 = tn.y + PORT_Y;
    var isValid = canConnect(fn.tool_id, tn.tool_id);
    var isSel = (e.id === selectedEdgeId);
    var d = bezierPath(x1,y1,x2,y2);
    parts.push('<path class="cv-edge-hit" d="' + d + '" data-eid="' + e.id + '"/>');
    parts.push('<path class="cv-edge' + (isValid?' valid':'') + (isSel?' selected':'') + '" d="' + d + '" marker-end="url(#' + (isValid?'arrowhead-valid':'arrowhead') + ')"/>');
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
    var isSeln = (cn.id === selectedNodeId);
    var cls = 'cn' + (nd.can_run?' runnable':'') + (isSeln?' selected':'') + (cn.id===moveTarget?' move-active':'');
    var tidShort = cn.tool_id.length > 28 ? cn.tool_id.slice(0,25)+'…' : cn.tool_id;
    var runMark = nd.can_run ? '<text class="cn-run" x="' + (NW-6) + '" y="14" text-anchor="end">&#x25B6;</text>' : '';
    var moveHandle = '<rect class="cn-drag-bar" data-nid="' + cn.id + '" data-role="move" x="16" y="3" width="' + (NW-32) + '" height="7" rx="2"/>'
      + '<text class="cn-drag-icon" x="' + (NW/2) + '" y="9" text-anchor="middle">&#x2807;</text>';
    parts.push(
      '<g class="' + cls + '" id="cn-' + cn.id + '" transform="translate(' + cn.x + ',' + cn.y + ')">'
      + '<rect class="cn-bg" width="' + NW + '" height="' + NH + '" rx="5"/>'
      + moveHandle
      + runMark
      + '<text class="cn-name" x="14" y="27">' + esc(nd.display_name.length>22?nd.display_name.slice(0,20)+'…':nd.display_name) + '</text>'
      + '<text class="cn-tid" x="14" y="42">' + esc(tidShort) + '</text>'
      + '<circle class="port in-port" data-nid="' + cn.id + '" data-port="in" cx="0" cy="' + PORT_Y + '" r="' + PORT_R + '"/>'
      + '<circle class="port out-port" data-nid="' + cn.id + '" data-port="out" cx="' + NW + '" cy="' + PORT_Y + '" r="' + PORT_R + '"/>'
      + '<rect class="cn-hit" width="' + NW + '" height="' + NH + '" rx="5" fill="transparent" data-nid="' + cn.id + '" data-role="body"/>'
      + '</g>'
    );
  }

  getVp().innerHTML = parts.join('');
}

/* ── SVG mouse events ── */
svg.addEventListener('mousedown', function(e) {
  var pt = svgPt(e);
  var target = e.target;
  var nid = target.dataset && target.dataset.nid ? parseInt(target.dataset.nid) : null;
  var port = target.dataset ? target.dataset.port : null;
  var role = target.dataset ? target.dataset.role : null;
  var eid = target.dataset && target.dataset.eid ? parseInt(target.dataset.eid) : null;

  /* move handle: enter click-to-position mode */
  if (nid && role === 'move') {
    moveTarget = nid; selectedNodeId = nid; selectedEdgeId = null;
    svg.style.cursor = 'crosshair';
    setStatus('Click anywhere on the canvas to position the node. Esc to cancel.');
    render(); e.preventDefault(); return;
  }

  /* resolve a pending click-to-position */
  if (moveTarget && !nid && !port && !eid) {
    var mn = canvasNodes.find(function(n){return n.id===moveTarget;});
    if (mn) { mn.x = snap(pt.x - NW/2); mn.y = snap(pt.y - NH/2); pushHistory(); render(); saveHash(); }
    moveTarget = null; svg.style.cursor = 'default'; setStatus('');
    e.preventDefault(); return;
  }

  if (nid && port === 'out') {
    /* start edge connect from output port (click-click mode; drag also works) */
    var fromNd = canvasNodes.find(function(n){return n.id===nid;});
    connecting = {fromNodeId: nid};
    mousePos = pt;
    var label = fromNd ? NODE_BY_ID[fromNd.tool_id] : null;
    setStatus('Connecting from ' + (label ? label.display_name : '?') + ' — click an input port (&#x25CF;) to connect, or press Esc to cancel.');
    e.preventDefault(); return;
  }
  if (nid && port === 'in') {
    /* complete edge (addEdge will pushHistory internally) */
    if (connecting && connecting.fromNodeId !== nid) {
      addEdge(connecting.fromNodeId, nid);
    }
    connecting = null; render(); e.preventDefault(); return;
  }
  if (nid && role === 'body') {
    /* start node drag; history pushed on mouseup after move */
    var cn = canvasNodes.find(function(n){return n.id===nid;});
    if (cn) {
      drag = {nodeId: nid, ox: pt.x - cn.x, oy: pt.y - cn.y, startX: cn.x, startY: cn.y};
      selectedNodeId = nid; selectedEdgeId = null;
      render(); updateNodeInfoPanel();
    }
    e.preventDefault(); return;
  }
  if (eid) {
    /* edge click: select */
    selectedEdgeId = eid; selectedNodeId = null; connecting = null;
    render(); updateNodeInfoPanel(); setStatus('Edge selected. Delete to remove.'); e.preventDefault(); return;
  }

  /* empty area: deselect + start viewport pan (keep connecting active for click-click) */
  selectedNodeId = null; selectedEdgeId = null;
  pan = {startX: e.clientX, startY: e.clientY, startVpX: vpX, startVpY: vpY};
  svg.style.cursor = 'grabbing';
  render(); updateNodeInfoPanel();
});

svg.addEventListener('mousemove', function(e) {
  mousePos = svgPt(e);
  if (drag) {
    var cn = canvasNodes.find(function(n){return n.id===drag.nodeId;});
    if (cn) { cn.x = snap(mousePos.x - drag.ox); cn.y = snap(mousePos.y - drag.oy); render(); }
  } else if (pan) {
    vpX = pan.startVpX + (e.clientX - pan.startX);
    vpY = pan.startVpY + (e.clientY - pan.startY);
    applyViewport();
  } else if (connecting) {
    render();
  }
});

svg.addEventListener('mouseup', function(e) {
  if (drag) {
    /* push history if node actually moved */
    var mover = canvasNodes.find(function(n){return n.id===drag.nodeId;});
    if (mover && (mover.x !== drag.startX || mover.y !== drag.startY)) pushHistory();
    drag = null; saveHash();
  }
  if (pan) { pan = null; svg.style.cursor = moveTarget ? 'crosshair' : 'default'; }
});

svg.addEventListener('dblclick', function(e) {
  /* removeNode pushes history internally */
  var nid = e.target.dataset ? parseInt(e.target.dataset.nid) : null;
  if (nid && e.target.dataset.role === 'body') removeNode(nid);
});

/* ── wheel zoom ── */
svg.addEventListener('wheel', function(e) {
  e.preventDefault();
  var r = svg.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
  var factor = e.deltaY < 0 ? 1.12 : (1/1.12);
  var ns = Math.min(4, Math.max(0.08, vpScale * factor));
  vpX = cx - (cx - vpX) * (ns / vpScale);
  vpY = cy - (cy - vpY) * (ns / vpScale);
  vpScale = ns;
  applyViewport(); updateZoomPct();
}, {passive: false});

/* ── pinch zoom (trackpad/touch) ── */
var _pinchDist = null;
svg.addEventListener('touchstart', function(e) {
  if (e.touches.length === 2) {
    _pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    e.preventDefault();
  }
}, {passive: false});
svg.addEventListener('touchmove', function(e) {
  if (e.touches.length !== 2 || !_pinchDist) return;
  e.preventDefault();
  var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  var r = svg.getBoundingClientRect();
  var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
  var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
  var ns = Math.min(4, Math.max(0.08, vpScale * (d / _pinchDist)));
  vpX = cx - (cx - vpX) * (ns / vpScale);
  vpY = cy - (cy - vpY) * (ns / vpScale);
  vpScale = ns; _pinchDist = d;
  applyViewport(); updateZoomPct();
}, {passive: false});
svg.addEventListener('touchend', function() { _pinchDist = null; }, {passive: false});

/* ── keyboard ── */
document.addEventListener('keydown', function(e) {
  if (_paletteOpen) return; /* palette handles its own keys */
  var tag = document.activeElement ? document.activeElement.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.key === 'Escape') {
    if (moveTarget) { moveTarget = null; svg.style.cursor = 'default'; render(); setStatus(''); }
    else if (connecting) { connecting = null; mousePos = {x:0,y:0}; render(); setStatus('Cancelled.'); }
    e.preventDefault(); return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
    /* removeNode / removeEdge push history themselves */
    if (selectedNodeId) { removeNode(selectedNodeId); e.preventDefault(); }
    else if (selectedEdgeId) { removeEdge(selectedEdgeId); e.preventDefault(); }
    return;
  }
  if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { undo(); e.preventDefault(); return; }
  if ((e.key === 'Z' && (e.ctrlKey || e.metaKey) && e.shiftKey) || (e.key === 'y' && (e.ctrlKey || e.metaKey))) { redo(); e.preventDefault(); return; }
  if (e.key === 'k' && (e.ctrlKey || e.metaKey)) { openPalette(); e.preventDefault(); return; }
  if (e.key === 'f' && !e.ctrlKey && !e.metaKey) { fitView(); e.preventDefault(); return; }

  if (selectedNodeId && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(e.key) >= 0) {
    e.preventDefault();
    var cn2 = canvasNodes.find(function(n){return n.id===selectedNodeId;});
    if (cn2) {
      if (e.key === 'ArrowLeft')  cn2.x = snap(cn2.x - GRID);
      if (e.key === 'ArrowRight') cn2.x = snap(cn2.x + GRID);
      if (e.key === 'ArrowUp')    cn2.y = snap(cn2.y - GRID);
      if (e.key === 'ArrowDown')  cn2.y = snap(cn2.y + GRID);
      pushHistory(); /* push after nudge */
      render(); saveHash();
    }
  }
});

/* ── undo / redo ── */
function _snapshot() {
  return {
    nodes: canvasNodes.map(function(n){ return {id:n.id, tool_id:n.tool_id, x:n.x, y:n.y, inp:n.inp||{}}; }),
    edges: edges.map(function(e){ return {id:e.id, from_id:e.from_id, to_id:e.to_id}; }),
    nid: nextNodeId, eid: nextEdgeId
  };
}
function pushHistory() {
  if (_loading) return;
  _history = _history.slice(0, _histIdx + 1);
  _history.push(_snapshot());
  if (_history.length > 100) _history = _history.slice(_history.length - 100);
  _histIdx = _history.length - 1;
}
function _restoreSnap(snap) {
  canvasNodes = snap.nodes.map(function(n){ return {id:n.id, tool_id:n.tool_id, x:n.x, y:n.y, inp:n.inp||{}}; });
  edges = snap.edges.map(function(e){ return {id:e.id, from_id:e.from_id, to_id:e.to_id}; });
  nextNodeId = snap.nid; nextEdgeId = snap.eid;
  selectedNodeId = null; selectedEdgeId = null; connecting = null; moveTarget = null;
  render(); updateRunBtn(); saveHash(); updateNodeInfoPanel();
}
/* hist[histIdx] = current state (push-after pattern) */
function undo() { if (_histIdx > 0) { _histIdx--; _loading = true; _restoreSnap(_history[_histIdx]); _loading = false; } }
function redo() { if (_histIdx < _history.length - 1) { _histIdx++; _loading = true; _restoreSnap(_history[_histIdx]); _loading = false; } }

/* ── remove edge ── */
function removeEdge(eid) {
  edges = edges.filter(function(e){ return e.id !== eid; });
  selectedEdgeId = null;
  pushHistory();
  render(); updateRunBtn(); saveHash();
}

/* ── G2: command palette ── */
function openPalette() {
  _paletteOpen = true; _paletteActiveIdx = 0;
  var fromNd = connecting ? canvasNodes.find(function(n){return n.id===connecting.fromNodeId;}) : null;
  _cmdNodes = fromNd
    ? NODES.filter(function(n){ return canConnect(fromNd.tool_id, n.tool_id); })
    : NODES.slice();
  document.getElementById('cmdPalette').classList.add('open');
  document.getElementById('cmdInput').value = '';
  document.getElementById('cmdInput').focus();
  _renderCmdResults();
}
function closePalette() {
  _paletteOpen = false;
  document.getElementById('cmdPalette').classList.remove('open');
}
function _filteredCmd() {
  var q = (document.getElementById('cmdInput').value || '').toLowerCase().trim();
  var fromNd = connecting ? canvasNodes.find(function(n){return n.id===connecting.fromNodeId;}) : null;
  var pool = q ? NODES.filter(function(n){
    return (n.display_name + ' ' + n.tool_id + ' ' + (n.mcp_name||'')).toLowerCase().indexOf(q) >= 0;
  }) : _cmdNodes.slice();
  if (fromNd) pool = pool.filter(function(n){ return canConnect(fromNd.tool_id, n.tool_id); });
  return pool;
}
function _renderCmdResults() {
  var filtered = _filteredCmd();
  var fromNd = connecting ? canvasNodes.find(function(n){return n.id===connecting.fromNodeId;}) : null;
  _paletteActiveIdx = Math.max(0, Math.min(_paletteActiveIdx, filtered.length - 1));
  var html = '';
  var max = Math.min(filtered.length, 40);
  for (var i = 0; i < max; i++) {
    var n = filtered[i];
    var compat = fromNd ? '<span class="ci-compat">compatible &#x25B8; auto-wire</span>' : '';
    html += '<div class="cmd-item' + (i === _paletteActiveIdx ? ' active' : '') + '" data-tid="' + esc(n.tool_id) + '">'
      + '<span class="ci-name">' + esc(n.display_name) + '</span>'
      + '<span class="ci-badge">' + (n.can_run ? '&#x25B6;' : '&#x2B21;') + '</span>'
      + compat + '</div>';
  }
  if (!html) html = '<div class="cmd-item" style="color:#64748b;cursor:default">No matching nodes</div>';
  document.getElementById('cmdResults').innerHTML = html;
  var activeEl = document.getElementById('cmdResults').querySelector('.active');
  if (activeEl) activeEl.scrollIntoView({block:'nearest'});
}
function _cmdInsert(toolId) {
  var fromNd = connecting ? canvasNodes.find(function(n){return n.id===connecting.fromNodeId;}) : null;
  var fromConn = connecting ? {fromNodeId: connecting.fromNodeId} : null;
  closePalette();
  var r = svg.getBoundingClientRect();
  var cx = snap((r.width/2 - vpX) / vpScale - NW/2);
  var cy = snap((r.height/2 - vpY) / vpScale - NH/2);
  var newId = addNode(toolId, cx, cy);
  if (fromNd && newId && canConnect(fromNd.tool_id, toolId)) {
    addEdge(fromConn.fromNodeId, newId);
    connecting = null;
  }
  render();
}

document.getElementById('cmdInput').addEventListener('input', function() {
  _paletteActiveIdx = 0; _renderCmdResults();
});
document.getElementById('cmdInput').addEventListener('keydown', function(e) {
  if (e.key === 'ArrowDown') { _paletteActiveIdx++; _renderCmdResults(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { _paletteActiveIdx--; _renderCmdResults(); e.preventDefault(); }
  else if (e.key === 'Enter') {
    var filtered = _filteredCmd();
    var n = filtered[Math.min(_paletteActiveIdx, filtered.length - 1)];
    if (n) _cmdInsert(n.tool_id);
    e.preventDefault();
  } else if (e.key === 'Escape') { closePalette(); e.preventDefault(); }
});
document.getElementById('cmdResults').addEventListener('click', function(e) {
  var item = e.target.closest('.cmd-item');
  if (item && item.dataset.tid) _cmdInsert(item.dataset.tid);
});
document.getElementById('cmdPalette').addEventListener('mousedown', function(e) {
  if (e.target === this) closePalette();
});

/* ── deep-link (#g=) ── v2 adds schema version + per-node inp; v1 (no 'v') loads silently ── */
function saveHash() {
  if (!canvasNodes.length) { history.replaceState(null,'',location.pathname+location.search); return; }
  var hasInp = canvasNodes.some(function(n){ return n.inp && Object.keys(n.inp).length; });
  var state = {
    v: 2,
    n: canvasNodes.map(function(n){
      var entry = {i:n.id, t:n.tool_id, x:n.x, y:n.y};
      if (hasInp) entry.inp = n.inp || {};
      return entry;
    }),
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
  _loading = true;
  try {
    var b64 = hash.slice(3).replace(/-/g,'+').replace(/_/g,'/');
    var padded = b64 + '=='.slice((b64.length+2)%4);
    var bytes = Uint8Array.from(atob(padded), function(c){return c.charCodeAt(0);});
    var state = JSON.parse(new TextDecoder().decode(bytes));
    /* v1: {n:[{i,t,x,y}...],e:[...]} no 'v' field; v2: {v:2,n:[{i,t,x,y,inp?:{}}...],e:[...]} */
    var isV2 = state.v === 2;
    for (var i = 0; i < state.n.length; i++) {
      var sn = state.n[i];
      addNode(sn.t, sn.x, sn.y, sn.i, isV2 ? (sn.inp || {}) : {});
    }
    for (var j = 0; j < state.e.length; j++) { addEdge(state.e[j].f, state.e[j].t); }
  } catch(err) { /* ignore bad hash */ }
  _loading = false;
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

/* ── H1: node inputs panel ── */
var _niTimer = null;
function updateNodeInfoPanel() {
  var panel = document.getElementById('rpNodeInputs');
  if (!panel) return;
  if (!selectedNodeId) { panel.style.display = 'none'; return; }
  var cn = canvasNodes.find(function(n){ return n.id === selectedNodeId; });
  if (!cn) { panel.style.display = 'none'; return; }
  var nd = NODE_BY_ID[cn.tool_id];
  var label = document.getElementById('rpNiLabel');
  if (label) label.textContent = (nd ? nd.display_name : cn.tool_id) + ' (node ' + cn.id + ')';
  var ta = document.getElementById('rpNiJson');
  if (ta && !_niEditing) {
    var existing = cn.inp && Object.keys(cn.inp).length ? JSON.stringify(cn.inp, null, 2) : '';
    ta.value = existing;
    document.getElementById('rpNiErr').style.display = 'none';
  }
  panel.style.display = 'block';
}
var _niEditing = false;
document.addEventListener('DOMContentLoaded', function() {
  var ta = document.getElementById('rpNiJson');
  if (!ta) return;
  ta.addEventListener('focus', function(){ _niEditing = true; });
  ta.addEventListener('blur',  function(){ _niEditing = false; });
  ta.addEventListener('input', function() {
    var errEl = document.getElementById('rpNiErr');
    var raw = ta.value.trim();
    if (!raw) {
      /* clear inputs for selected node */
      var cn = selectedNodeId ? canvasNodes.find(function(n){ return n.id === selectedNodeId; }) : null;
      if (cn) { cn.inp = {}; if (_niTimer) clearTimeout(_niTimer); _niTimer = setTimeout(saveHash, 400); }
      errEl.style.display = 'none'; return;
    }
    try {
      var parsed = JSON.parse(raw);
      errEl.style.display = 'none';
      var cn2 = selectedNodeId ? canvasNodes.find(function(n){ return n.id === selectedNodeId; }) : null;
      if (cn2) { cn2.inp = parsed; if (_niTimer) clearTimeout(_niTimer); _niTimer = setTimeout(saveHash, 400); }
    } catch(e) {
      errEl.style.display = 'block';
    }
  });
});

/* ── H2: toggle MCP panel ── */
var _mcpPanelOpen = false;
var _lastChainJson = null;
var _lastSeqJson = null;
function toggleMcpPanel() {
  if (!canvasNodes.length) { setStatus('Add nodes to the canvas first.'); return; }
  _mcpPanelOpen = !_mcpPanelOpen;
  var panel = document.getElementById('rpMcpPanel');
  if (!_mcpPanelOpen) { panel.classList.remove('open'); return; }
  panel.classList.add('open');
  buildMcpPanel();
}
function buildMcpPanel() {
  var ordered = topoSort();
  if (!ordered.length) return;
  var toolIds = ordered.map(function(n){ return n.tool_id; });

  /* check if composition matches a named chain */
  var matchedChain = null;
  for (var ci = 0; ci < CHAINS.length; ci++) {
    var c = CHAINS[ci];
    if (c.step_tool_ids.length === toolIds.length) {
      var match = true;
      for (var k = 0; k < toolIds.length; k++) { if (c.step_tool_ids[k] !== toolIds[k]) { match = false; break; } }
      if (match) { matchedChain = c; break; }
    }
  }

  var labelEl = document.getElementById('mcpLabel');
  var snippetEl = document.getElementById('mcpSnippet');
  var dlBtn = document.getElementById('mcpDlBtn');
  var seqLabel = document.getElementById('mcpSeqLabel');
  var seqSnippet = document.getElementById('mcpSeqSnippet');
  var seqCopy = document.getElementById('mcpSeqCopyBtn');

  _lastChainJson = null; _lastSeqJson = null;

  if (matchedChain) {
    labelEl.textContent = 'Named chain match: ' + matchedChain.name + '. Runs against mcp.ainumbers.co.';
    snippetEl.textContent = JSON.stringify({
      method: 'tools/call',
      params: { name: 'run_chain', arguments: { chain: matchedChain.name } }
    }, null, 2);
    dlBtn.style.display = 'none';
    seqLabel.style.display = 'none';
    seqSnippet.style.display = 'none';
    seqCopy.style.display = 'none';
  } else {
    /* unnamed composition: chain JSON + per-step MCP sequence */
    var slug = buildSlug(ordered);
    var chainObj = buildChainObj(ordered, slug);
    _lastChainJson = JSON.stringify(chainObj, null, 2);

    var firstNodeInp = (ordered[0].inp && Object.keys(ordered[0].inp).length) ? ordered[0].inp : {};
    var seq = ordered.map(function(n, i) {
      var nd = NODE_BY_ID[n.tool_id];
      var mcpN = nd && nd.mcp_name ? nd.mcp_name : n.tool_id;
      return { method: 'tools/call', params: { name: mcpN, arguments: i === 0 ? firstNodeInp : {} } };
    });
    _lastSeqJson = JSON.stringify(seq, null, 2);

    labelEl.textContent = 'Unnamed composition. Download chain JSON, then run each step via mcp.ainumbers.co.';
    snippetEl.textContent = _lastChainJson;
    dlBtn.style.display = 'inline-block';

    seqLabel.textContent = 'Per-step MCP sequence (runs each step independently):';
    seqLabel.style.display = 'block';
    seqSnippet.textContent = _lastSeqJson;
    seqSnippet.style.display = 'block';
    seqCopy.style.display = 'inline-block';
  }
}
function copyMcpSnippet() {
  var text = document.getElementById('mcpSnippet').textContent;
  var btn = document.querySelector('#rpMcpPanel .mcp-copy-btn');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function(){
      btn.textContent = '&#x2713; Copied!'; setTimeout(function(){ btn.textContent = '&#x1F4CB; Copy snippet'; }, 1600);
    }).catch(function(){ fallbackCopy(text); });
  } else { fallbackCopy(text); }
}
function copyMcpSeq() {
  var text = _lastSeqJson || document.getElementById('mcpSeqSnippet').textContent;
  var btn = document.getElementById('mcpSeqCopyBtn');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function(){
      btn.textContent = '&#x2713; Copied!'; setTimeout(function(){ btn.textContent = '&#x1F4CB; Copy sequence'; }, 1600);
    }).catch(function(){ fallbackCopy(text); });
  } else { fallbackCopy(text); }
}
function dlChainJson() {
  if (!_lastChainJson) { buildMcpPanel(); }
  if (_lastChainJson) dl(_lastChainJson, buildSlug(topoSort()) + '.chain.json', 'application/json');
}

/* ── H3: propose as named chain ── */
function buildSlug(ordered) {
  /* §A3.3: <domain-word>-<specifics>, lowercase-kebab, spelled out */
  var parts = ordered.map(function(n) {
    var nd = NODE_BY_ID[n.tool_id];
    var name = nd ? nd.display_name : n.tool_id;
    return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  });
  var slug = parts.join('-to-');
  if (slug.length > 80) slug = slug.slice(0, 80).replace(/-+$/, '');
  return slug;
}
function buildChainObj(ordered, slug) {
  return {
    name:        slug,
    title:       ordered.map(function(n){ var nd=NODE_BY_ID[n.tool_id]; return nd?nd.display_name:n.tool_id; }).join(' + '),
    description: 'Composed on AINumbers.co Canvas.',
    steps:       ordered.map(function(n, i) {
      return { tool_id: n.tool_id, handoff: i < ordered.length - 1 };
    })
  };
}
function proposeAsChain() {
  if (!canvasNodes.length) { setStatus('Add nodes to the canvas first.'); return; }
  var ordered = topoSort();
  var slug = buildSlug(ordered);
  var chainObj = buildChainObj(ordered, slug);
  var chainJson = JSON.stringify(chainObj, null, 2);
  var subject = '[AINumbers Chain Proposal] ' + slug;
  var body = 'Proposed workflow: ' + slug + '\\n\\nChain JSON:\\n' + chainJson;
  var mailto = 'mailto:contact@ainumbers.co?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  if (mailto.length <= 2000) {
    window.location.href = mailto;
  } else {
    /* body too large for mailto — copy JSON to clipboard, open suggest.html */
    var doOpen = function() {
      window.open('../../suggest.html', '_blank');
      setStatus('Chain JSON copied — paste it in the description field on the suggestion page.');
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(chainJson).then(doOpen).catch(function(){ fallbackCopy(chainJson); doOpen(); });
    } else { fallbackCopy(chainJson); doOpen(); }
  }
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
  if (!_loading) pushHistory();
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
    /* H1: apply per-node inputs first, then override with prior step's payload */
    var nodeInp = step.inp && Object.keys(step.inp).length ? flattenScalars(step.inp) : {};
    if (Object.keys(nodeInp).length) {
      try { win.AINBridge.apply(nodeInp); } catch(e2){}
    }
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
  pushHistory(); /* capture pre-load state as one undo step */
  _loading = true;
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
    _loading = false;
    autoLayout(); /* 6a: auto-trigger layout after template load */
  } catch(err) { _loading = false; }
});

/* ── init ── */
window.addEventListener('DOMContentLoaded', function() {
  vp = document.getElementById('viewport');
  renderPalette();
  render();
  applyViewport();
  loadHash();
  if (canvasNodes.length) fitView(); /* fit if hash loaded a graph */
  _history = [_snapshot()]; _histIdx = 0; /* initial undo anchor */
  var hint = document.getElementById('cvHint');
  if (hint) hint.textContent = NODES.filter(function(n){return n.can_run;}).length + ' of ' + NODES.length + ' nodes browser-runnable';
  updateZoomPct();
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

  return html.replace(NODES_PH, () => NODES_JSON).replace(CHAINS_PH, () => CHAINS_JSON).replace(TEMPLATES_PH, () => TEMPLATES_HTML);
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
