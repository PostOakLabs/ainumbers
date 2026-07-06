#!/usr/bin/env node
/**
 * scripts/gen-workbench.mjs
 *
 * Generates repo/chaingraph/workbench/workbench.html — the Phase C Workbench:
 * a single self-contained page where a human picks a chain, runs it live in a
 * Phase-B browser runner, and gets the verified composite artifact.
 *
 * The chain catalog is inlined at build time (no fetch/network calls —
 * CONTRACT §0.4 zero-network invariant). See PR note: fetch-vs-inline decision.
 *
 * Usage:
 *   node scripts/gen-workbench.mjs           # generate / update workbench.html
 *   node scripts/gen-workbench.mjs --check   # exit non-zero if stale
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderRail } from './gen-wayfinder.mjs';

const REPO        = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CG_PATH     = resolve(REPO, 'chaingraph/chaingraph.json');
const RUNNERS_DIR = resolve(REPO, 'chaingraph/runners');
const WB_DIR      = resolve(REPO, 'chaingraph/workbench');
const OUT_PATH    = resolve(WB_DIR, 'workbench.html');
const CHECK_MODE  = process.argv.includes('--check');

/* ── load chaingraph.json ─────────────────────────────────────────── */
const cg = JSON.parse(readFileSync(CG_PATH, 'utf8'));

/* ── wayfinder rail (step: Run) ──────────────────────────────────── */
const { steps: wfSteps } = JSON.parse(readFileSync(resolve(REPO, 'data/suite-map.json'), 'utf8'));
const WAYFINDER_PH = '/*__WAYFINDER__*/';
const nodeMap = Object.fromEntries(cg.nodes.map(n => [n.tool_id, n]));

/* ── eligible runners (Phase B output) ───────────────────────────── */
const eligibleRunners = new Set(
  existsSync(RUNNERS_DIR)
    ? readdirSync(RUNNERS_DIR).filter(f => f.endsWith('.html')).map(f => f.replace('.html', ''))
    : []
);

/* ── build slim catalog ──────────────────────────────────────────── */
function displayName(toolId) {
  const n = nodeMap[toolId];
  if (n && n.display_name) return n.display_name;
  const slug = toolId.replace(/^art-\d+-/, '').replace(/^\d+-/, '');
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const catalogChains = cg.chains.map(chain => {
  const firstStep = chain.steps[0];
  const lastStep  = chain.steps[chain.steps.length - 1];
  const firstNode = firstStep ? (nodeMap[firstStep.tool_id] || {}) : {};
  const lastNode  = lastStep  ? (nodeMap[lastStep.tool_id]  || {}) : {};
  return {
    name:           chain.name,
    title:          chain.title,
    description:    (chain.description || '').slice(0, 250),
    step_count:     chain.steps.length,
    step_tool_ids:  chain.steps.map(s => s.tool_id),
    step_names:     chain.steps.map(s => displayName(s.tool_id)),
    has_runner:     eligibleRunners.has(chain.name),
    last_feeds:     lastNode.feeds  || [],
    first_consumes: firstNode.consumes || [],
  };
});

const catalogJson = JSON.stringify(catalogChains);

/* ── generate workbench HTML ─────────────────────────────────────── */
function renderWorkbench(catalogJson) {
  // Use a placeholder approach so inner JS $ chars are never interpreted
  // as template-literal substitutions.
  const CATALOG_PLACEHOLDER = '/*__CATALOG_DATA__*/';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<title>Workbench · Live Chain Runner · OpenChainGraph Suite · AINumbers.co</title>
<meta name="description" content="The OpenChainGraph Workbench — pick any chain from the catalog, run it live in your browser, and download the composite verified artifact.">
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
/* Nav */
nav{height:52px;border-bottom:1px solid var(--border);background:rgba(8,14,26,.95);position:relative;z-index:200;backdrop-filter:blur(8px);flex-shrink:0}
.nav-inner{max-width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 1.25rem}
.logo-name{font-family:'JetBrains Mono',monospace;font-size:.88rem;font-weight:600;color:var(--bright)}
.logo-ai{color:var(--teal)}.logo-co{color:var(--muted);font-size:.75rem}
.nav-bc{font-family:'JetBrains Mono',monospace;font-size:.55rem;color:var(--muted)}
.nav-bc a{color:var(--body)}
.nav-badge{font-family:'JetBrains Mono',monospace;font-size:.48rem;letter-spacing:.1em;text-transform:uppercase;color:var(--teal);border:1px solid rgba(20,184,166,.3);padding:.2rem .55rem;border-radius:3px}
/* PII banner */
.pii-bar{font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--warn);background:var(--warn-dim);border-bottom:1px solid rgba(245,158,11,.25);padding:.45rem 1.25rem;flex-shrink:0}
/* Three-pane grid */
.wb-grid{flex:1;display:grid;grid-template-columns:300px 1fr 360px;min-height:0;overflow:hidden}
/* Left pane */
.pane-left{background:var(--bg-2);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
.pane-head{padding:.75rem .9rem;border-bottom:1px solid var(--border);flex-shrink:0}
.pane-label{font-family:'JetBrains Mono',monospace;font-size:.48rem;letter-spacing:.18em;text-transform:uppercase;color:var(--teal);margin-bottom:.5rem}
.search-wrap{position:relative;margin-bottom:.5rem}
.search-wrap input{width:100%;background:var(--bg-3);border:1px solid var(--border-2);color:var(--bright);border-radius:var(--radius);padding:.45rem .75rem .45rem 2rem;font-family:'Sora',sans-serif;font-size:.78rem;outline:none}
.search-wrap input:focus{border-color:var(--teal)}
.search-icon{position:absolute;left:.65rem;top:50%;transform:translateY(-50%);color:var(--muted);font-size:.75rem;pointer-events:none}
.filter-bar{display:flex;align-items:center;gap:.65rem}
.filter-check{font-family:'JetBrains Mono',monospace;font-size:.55rem;color:var(--body);display:flex;align-items:center;gap:.3rem;cursor:pointer}
.filter-check input{accent-color:var(--teal)}
.catalog-count{font-family:'JetBrains Mono',monospace;font-size:.5rem;color:var(--muted);margin-left:auto}
.chain-list{flex:1;overflow-y:auto}
.chain-list::-webkit-scrollbar{width:4px}
.chain-list::-webkit-scrollbar-track{background:transparent}
.chain-list::-webkit-scrollbar-thumb{background:var(--border-2);border-radius:2px}
.chain-item{padding:.55rem .9rem;border-bottom:1px solid rgba(30,47,74,.6);cursor:pointer;transition:background .12s}
.chain-item:hover{background:var(--bg-3)}
.chain-item.selected{background:var(--teal-dim);border-left:2px solid var(--teal)}
.ci-head{display:flex;align-items:flex-start;gap:.4rem}
.ci-title{font-size:.78rem;color:var(--bright);font-weight:500;line-height:1.3;flex:1}
.ci-runner{color:var(--teal);font-size:.62rem;flex-shrink:0;margin-top:.1rem}
.ci-meta{font-family:'JetBrains Mono',monospace;font-size:.5rem;color:var(--muted);margin-top:.2rem}
.ci-empty{padding:1.5rem .9rem;font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--muted);text-align:center}
/* Center pane */
.pane-center{position:relative;display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}
.center-bar{padding:.5rem .9rem;border-bottom:1px solid var(--border);background:var(--bg-2);display:flex;align-items:center;gap:.65rem;flex-shrink:0}
.run-btn{background:var(--teal);color:var(--bg);border:none;padding:.5rem 1.25rem;border-radius:var(--radius);font-family:'JetBrains Mono',monospace;font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600;transition:background .2s}
.run-btn:hover:not(:disabled){background:var(--teal-lt)}
.run-btn:disabled{opacity:.4;cursor:not-allowed}
.center-chain-name{font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--body);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.runner-iframe{flex:1;border:0;width:100%;min-height:0}
.center-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center;gap:.75rem}
.cs-icon{font-size:2.5rem;opacity:.35}
.cs-title{font-size:1rem;color:var(--body)}
.cs-hint{font-family:'JetBrains Mono',monospace;font-size:.55rem;color:var(--muted)}
/* Right pane */
.pane-right{background:var(--bg-2);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto}
.pane-right::-webkit-scrollbar{width:4px}
.pane-right::-webkit-scrollbar-track{background:transparent}
.pane-right::-webkit-scrollbar-thumb{background:var(--border-2);border-radius:2px}
.rp-section{padding:.85rem 1rem;border-bottom:1px solid var(--border)}
.rp-label{font-family:'JetBrains Mono',monospace;font-size:.48rem;letter-spacing:.18em;text-transform:uppercase;color:var(--teal);margin-bottom:.55rem}
.rp-title{font-size:.88rem;color:var(--white);font-weight:500;line-height:1.3;margin-bottom:.25rem}
.rp-meta{font-family:'JetBrains Mono',monospace;font-size:.5rem;color:var(--muted);line-height:1.5}
.hash-display{font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--green-lt);word-break:break-all;background:var(--bg-3);border:1px solid var(--border);border-radius:var(--radius);padding:.6rem .75rem;margin-bottom:.5rem}
.hash-label{color:var(--muted);margin-right:.35rem}
.verify-row{display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem}
.verify-out{font-family:'JetBrains Mono',monospace;font-size:.55rem}
.v-ok{color:var(--green-lt)}.v-fail{color:var(--red)}
.ex-row{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.35rem}
.ex-btn{border:none;padding:.5rem .9rem;border-radius:var(--radius);font-family:'JetBrains Mono',monospace;font-size:.52rem;letter-spacing:.08em;text-transform:uppercase;font-weight:600;transition:background .2s}
.ex-primary{background:var(--teal);color:var(--bg)}.ex-primary:hover{background:var(--teal-lt)}
.ex-secondary{background:var(--bg-4);color:var(--text);border:1px solid var(--border-2)}.ex-secondary:hover{border-color:var(--teal);color:var(--teal-lt)}
.ex-purple{background:var(--purple);color:var(--white)}.ex-purple:hover{opacity:.9}
.ex-btn:disabled{opacity:.35;cursor:not-allowed}
.mcp-code{font-family:'JetBrains Mono',monospace;font-size:.55rem;color:var(--text);background:var(--bg-3);border:1px solid var(--border);border-radius:var(--radius);padding:.65rem .75rem;margin-bottom:.5rem;white-space:pre;overflow-x:auto;line-height:1.5}
.copy-btn{background:var(--bg-4);border:1px solid var(--border-2);color:var(--body);padding:.45rem .9rem;border-radius:var(--radius);font-family:'JetBrains Mono',monospace;font-size:.52rem;letter-spacing:.08em;text-transform:uppercase;transition:all .2s}
.copy-btn:hover{border-color:var(--teal);color:var(--teal-lt)}
.snap-item{display:flex;align-items:center;gap:.4rem;padding:.4rem .55rem;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:.35rem;cursor:pointer;transition:background .12s}
.snap-item:hover{background:var(--bg-3);border-color:var(--border-2)}
.snap-title{font-size:.72rem;color:var(--text);flex:1;line-height:1.25}
.snap-badge{font-family:'JetBrains Mono',monospace;font-size:.5rem;color:var(--teal)}
.rp-empty{padding:1.5rem 1rem;font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--muted);line-height:1.7}
/* Step ladder — G2 */
.step-ladder{background:var(--bg-2);border-bottom:1px solid var(--border);padding:.4rem .9rem;flex-shrink:0;max-height:160px;overflow-y:auto}
.step-ladder::-webkit-scrollbar{width:3px}
.step-ladder::-webkit-scrollbar-thumb{background:var(--border-2);border-radius:2px}
.sl-row{display:flex;align-items:center;gap:.5rem;padding:.25rem .3rem;border-radius:3px;transition:background .1s;cursor:default}
.sl-row.sl-clickable{cursor:pointer}.sl-row.sl-clickable:hover{background:var(--bg-3)}
.sl-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--muted);transition:background .2s}
.sl-dot.running{background:var(--warn)}.sl-dot.done{background:var(--green)}.sl-dot.fail{background:var(--red)}
.sl-name{font-family:'JetBrains Mono',monospace;font-size:.52rem;color:var(--body);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sl-state{font-family:'JetBrains Mono',monospace;font-size:.48rem;color:var(--muted);flex-shrink:0}
.sl-detail{background:var(--bg-3);border:1px solid var(--border);border-radius:3px;padding:.4rem .6rem;font-family:'JetBrains Mono',monospace;font-size:.5rem;color:var(--text);white-space:pre-wrap;word-break:break-all;max-height:100px;overflow-y:auto;margin:.2rem 0 .1rem 1.3rem}
/* Accordion — G1b */
.acc-header{display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;padding:.55rem 0;border-top:1px solid var(--border)}
.acc-header:first-child{border-top:none}
.acc-chevron{font-size:.6rem;color:var(--muted);transition:transform .2s;flex-shrink:0}
.acc-header.open .acc-chevron{transform:rotate(180deg)}
.acc-body{overflow:hidden}
/* H1: center-bar link button */
.wb-link-btn{background:var(--bg-4);border:1px solid var(--border-2);color:var(--body);padding:.45rem .75rem;border-radius:var(--radius);font-family:'JetBrains Mono',monospace;font-size:.52rem;letter-spacing:.08em;text-transform:uppercase;transition:all .2s;flex-shrink:0}
.wb-link-btn:hover{border-color:var(--teal);color:var(--teal-lt)}
/* H1: initial inputs textarea */
.rp-inputs-ta{width:100%;background:var(--bg-3);border:1px solid var(--border-2);color:var(--bright);border-radius:var(--radius);padding:.45rem .6rem;font-family:'JetBrains Mono',monospace;font-size:.58rem;resize:vertical;min-height:80px;outline:none;line-height:1.5}
.rp-inputs-ta:focus{border-color:var(--teal)}
.rp-inputs-hint{font-family:'JetBrains Mono',monospace;font-size:.5rem;color:var(--muted);margin-top:.3rem;line-height:1.5}
.rp-inputs-err{font-family:'JetBrains Mono',monospace;font-size:.5rem;color:var(--red);margin-top:.25rem;display:none}
/* Responsive: stack on narrow screens */
@media(max-width:900px){
  body{overflow:auto}
  .wb-grid{grid-template-columns:1fr;grid-template-rows:300px auto auto;height:auto}
  .pane-left{height:300px}
  .pane-center{height:70vh}
  .pane-right{height:auto;overflow:visible}
}
</style>
</head>
<body>

<nav><div class="nav-inner">
  <div class="logo-name"><span class="logo-ai">AI</span>Numbers<span class="logo-co">.co</span></div>
  <div class="nav-bc"><a href="../../index.html">All Tools</a> / <a href="../chaingraph-hub.html">OpenChainGraph Hub</a> / Workbench</div>
  <span class="nav-badge">Workbench</span>
</div></nav>

${WAYFINDER_PH}

<div class="pii-bar">🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.</div>

<div class="wb-grid">

  <!-- ══ LEFT PANE — catalog ══ -->
  <div class="pane-left">
    <div class="pane-head">
      <div class="pane-label">Chain Catalog</div>
      <div class="search-wrap">
        <span class="search-icon">&#x1F50D;</span>
        <input id="searchInput" type="search" placeholder="Search chains…" autocomplete="off" spellcheck="false">
      </div>
      <div class="filter-bar">
        <label class="filter-check"><input type="checkbox" id="runnersOnly"> &#x25B6; runners only</label>
        <span class="catalog-count" id="catalogCount"></span>
      </div>
    </div>
    <div class="chain-list" id="chainList"></div>
  </div>

  <!-- ══ CENTER PANE — runner ══ -->
  <div class="pane-center">
    <div class="center-bar">
      <button class="run-btn" id="wbRunBtn" onclick="wbRunChain()" disabled>&#x25B6; Run Chain</button>
      <span class="center-chain-name" id="centerChainName">— select a chain —</span>
      <button class="wb-link-btn" id="wbLinkBtn" onclick="wbCopyLink()" title="Copy permalink to this chain">&#x1F517; Link</button>
    </div>
    <!-- Step ladder — per-step run status (G2) -->
    <div class="step-ladder" id="stepLadder" style="display:none"></div>
    <!-- Empty state -->
    <div class="center-state" id="emptyState">
      <div class="cs-icon">&#x26D3;</div>
      <div class="cs-title">Select a chain from the catalog</div>
      <div class="cs-hint" id="emptyHint"></div>
    </div>
    <!-- No-runner state -->
    <div class="center-state" id="noRunnerState" style="display:none">
      <div class="cs-icon">&#x1F4CB;</div>
      <div class="cs-title">No browser runner for <em id="noRunnerName"></em></div>
      <div class="cs-hint">This chain lacks the AIN Bridge on one or more steps.<br>
        <a id="noRunnerLink" href="#" target="_blank">View chain definition &#x2197;</a>
      </div>
    </div>
    <!-- Runner iframe -->
    <iframe id="runnerFrame"
            class="runner-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms"
            style="display:none"
            title="Chain Runner"></iframe>
  </div>

  <!-- ══ RIGHT PANE — artifact ══ -->
  <div class="pane-right">
    <div id="rightEmpty" class="rp-empty">
      Select a chain to see its MCP call and run it for the composite artifact.
    </div>

    <!-- Chain info (visible when chain selected) -->
    <div id="chainInfo" style="display:none">
      <div class="rp-section">
        <div class="rp-label">Selected Chain</div>
        <div class="rp-title" id="rpTitle"></div>
        <div class="rp-meta" id="rpMeta"></div>
      </div>
      <div class="rp-section">
        <div class="rp-label">MCP Call &middot; run_chain</div>
        <pre class="mcp-code" id="mcpSnippet"></pre>
        <button class="copy-btn" id="copyMcpBtn" onclick="copyMcp()">&#x1F4CB; Copy</button>
      </div>
      <!-- H1: initial inputs for permalink and prefill -->
      <div class="rp-section" id="rpInputsSection" style="display:none">
        <div class="rp-label">Initial Inputs</div>
        <div class="rp-meta" style="margin-bottom:.4rem">JSON keys = form element IDs in step 0. Encoded in permalink and applied before run.</div>
        <textarea id="wbInputsTa" class="rp-inputs-ta" placeholder='{"field_id": "value"}' spellcheck="false" autocomplete="off"></textarea>
        <div class="rp-inputs-hint">Leave blank to run the chain with default inputs.</div>
        <div class="rp-inputs-err" id="wbInputsErr">Invalid JSON</div>
      </div>
    </div>

    <!-- Artifact section (visible after run) — G1b: export sections accordioned -->
    <div id="artifactSection" style="display:none">
      <div class="rp-section">
        <div class="rp-label">&#167;4 Execution Hash</div>
        <div class="hash-display"><span class="hash-label">execution_hash:</span><span id="apHash"></span></div>
        <div class="verify-row">
          <button class="ex-btn ex-primary" onclick="apVerify()">&#x2713; Verify</button>
          <span class="verify-out" id="apVerifyOut"></span>
        </div>
        <!-- Accordion: §4 + §13.11 exports -->
        <div class="acc-header" id="accExportHdr" onclick="toggleAcc('export')" aria-expanded="false">
          <span class="rp-label" style="margin:0">Export</span>
          <span class="acc-chevron">&#x25BC;</span>
        </div>
        <div class="acc-body" id="accExportBody" style="display:none">
          <div class="ex-row" style="margin-top:.4rem">
            <button class="ex-btn ex-primary" onclick="apExportArtifact()">&#x2B07; &#167;4 Artifact</button>
            <button class="ex-btn ex-purple" onclick="apExportVC()">&#x2B07; W3C VC (&#167;13.11)</button>
          </div>
          <div class="ex-row">
            <button class="ex-btn ex-secondary" onclick="apSign()">&#x2B07; Sign (Ed25519 &middot; &#167;16)</button>
            <button class="ex-btn ex-secondary" onclick="apVerifySig()">&#x1F510; Verify sig</button>
          </div>
        </div>
        <!-- Accordion: snap-compat -->
        <div class="acc-header" id="accSnapHdr" onclick="toggleAcc('snap')" aria-expanded="false" style="display:none">
          <span class="rp-label" style="margin:0">&#x27A1; Downstream</span>
          <span class="acc-chevron">&#x25BC;</span>
        </div>
        <div class="acc-body" id="accSnapBody" style="display:none">
          <div id="snapList" style="margin-top:.35rem"></div>
        </div>
      </div>
    </div>
  </div>

</div>

<!-- ════ WORKBENCH LOGIC ════ -->
<script>
'use strict';
/* Chain catalog — inlined at build time by gen-workbench.mjs
   Fetch-vs-inline decision: this approach (inline) is CONTRACT-compliant
   (zero network calls). Alternative: same-origin fetch('/chaingraph/chaingraph.json')
   would always be fresh but requires a CONTRACT amendment for zero-network.
   See PR for the tradeoff; default is inline. */
const CATALOG_DATA = ${CATALOG_PLACEHOLDER};

/* ── state ── */
var selectedChain = null;
var currentArtifact = null;
var lastHash = null;
var pollTimer = null;
var runnerLoaded = false;

/* ── utility ── */
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function dl(content, name, type) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: type }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function ts14() { return new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14); }

/* ── catalog rendering ── */
function renderCatalog(chains) {
  var list = document.getElementById('chainList');
  if (!chains.length) {
    list.innerHTML = '<div class="ci-empty">No chains match.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < chains.length; i++) {
    var c = chains[i];
    var sel = c.name === selectedChain ? ' selected' : '';
    html += '<div class="chain-item' + sel + '" data-name="' + escHtml(c.name) + '">'
      + '<div class="ci-head"><span class="ci-title">' + escHtml(c.title) + '</span>'
      + (c.has_runner ? '<span class="ci-runner">&#x25B6;</span>' : '')
      + '</div>'
      + '<div class="ci-meta">' + c.step_count + ' step' + (c.step_count !== 1 ? 's' : '')
      + (c.has_runner ? ' &middot; runner available' : '') + '</div>'
      + '</div>';
  }
  list.innerHTML = html;
  list.onclick = function(e) {
    var item = e.target.closest('.chain-item');
    if (item && item.dataset.name) selectChain(item.dataset.name);
  };
}

function applyFilter() {
  var q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  var rOnly = document.getElementById('runnersOnly').checked;
  var chains = CATALOG_DATA;
  if (rOnly) { var tmp = []; for (var i=0;i<chains.length;i++) if (chains[i].has_runner) tmp.push(chains[i]); chains = tmp; }
  if (q) {
    var tmp2 = [];
    for (var j=0;j<chains.length;j++) {
      var c = chains[j];
      if ((c.title+' '+c.name+' '+c.description+' '+c.step_names.join(' ')).toLowerCase().indexOf(q) >= 0) tmp2.push(c);
    }
    chains = tmp2;
  }
  renderCatalog(chains);
  document.getElementById('catalogCount').textContent = chains.length + ' / ' + CATALOG_DATA.length;
}

/* ── chain selection ── */
function selectChain(name) {
  var chain = null;
  for (var i=0;i<CATALOG_DATA.length;i++) if (CATALOG_DATA[i].name === name) { chain = CATALOG_DATA[i]; break; }
  if (!chain) return;

  selectedChain = name;
  currentArtifact = null;
  lastHash = null;
  runnerLoaded = false;

  /* highlight left pane */
  var items = document.querySelectorAll('.chain-item');
  for (var k=0;k<items.length;k++) items[k].classList.remove('selected');
  var item = document.querySelector('.chain-item[data-name="'+escHtml(name)+'"]');
  if (item) { item.classList.add('selected'); item.scrollIntoView({ block:'nearest' }); }

  /* center pane — clear step ladder before re-populating */
  document.getElementById('centerChainName').textContent = chain.title;
  (function(){ var sl = document.getElementById('stepLadder'); sl.innerHTML = ''; sl.style.display = 'none'; })();
  _slDetailShown = null;
  var old = document.getElementById('slDetail'); if (old) old.remove();
  var frame = document.getElementById('runnerFrame');
  if (chain.has_runner) {
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('noRunnerState').style.display = 'none';
    frame.style.display = 'block';
    frame.src = '../runners/' + name + '.html#embed';
    /* pre-populate step ladder with pending rows from catalog step names */
    (function() {
      var ladder = document.getElementById('stepLadder');
      var h = '';
      for (var si = 0; si < chain.step_names.length; si++) {
        h += '<div class="sl-row" id="slRow' + si + '" data-step="' + si + '">'
          + '<span class="sl-dot" id="slDot' + si + '"></span>'
          + '<span class="sl-name">' + escHtml(chain.step_names[si]) + '</span>'
          + '<span class="sl-state" id="slSt' + si + '">pending</span>'
          + '</div>';
      }
      ladder.innerHTML = h;
      ladder.style.display = chain.step_names.length ? 'block' : 'none';
      ladder.onclick = function(ev) {
        var row = ev.target.closest('.sl-row');
        if (row && row.dataset.step !== undefined) showStepDetail(parseInt(row.dataset.step));
      };
    })();
    var btn = document.getElementById('wbRunBtn');
    btn.disabled = true;
    btn.textContent = '▶ Run Chain';
  } else {
    frame.style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('noRunnerState').style.display = 'flex';
    document.getElementById('noRunnerName').textContent = chain.title;
    document.getElementById('noRunnerLink').href = '../chains/' + name + '.html';
    document.getElementById('wbRunBtn').disabled = true;
  }

  /* right pane: chain info */
  document.getElementById('rightEmpty').style.display = 'none';
  document.getElementById('chainInfo').style.display = 'block';
  document.getElementById('rpTitle').textContent = chain.title;
  var stepPreview = chain.step_names.slice(0, 3).join(' → ') + (chain.step_count > 3 ? ' …' : '');
  document.getElementById('rpMeta').textContent = chain.step_count + ' steps · ' + stepPreview;
  document.getElementById('artifactSection').style.display = 'none';
  document.getElementById('accSnapHdr').style.display = 'none';
  document.getElementById('accSnapBody').style.display = 'none';
  document.getElementById('apVerifyOut').textContent = '';
  document.getElementById('rpInputsSection').style.display = 'block';

  /* MCP snippet */
  document.getElementById('mcpSnippet').textContent = JSON.stringify({
    method: 'tools/call',
    params: {
      name: 'run_chain',
      arguments: { chain: name }
    }
  }, null, 2);

  updateHash();
  startPolling();
}

/* ── runner iframe load ── */
document.getElementById('runnerFrame').addEventListener('load', function() {
  runnerLoaded = true;
  if (selectedChain) {
    var btn = document.getElementById('wbRunBtn');
    btn.disabled = false;
  }
  /* H1: apply initial inputs after inner step-0 iframe has a moment to load */
  setTimeout(applyInitialInputs, 600);
});

/* ── workbench-level Run Chain ── */
function wbRunChain() {
  var frame = document.getElementById('runnerFrame');
  if (!runnerLoaded || !frame.contentWindow || typeof frame.contentWindow.runChain !== 'function') return;
  var btn = document.getElementById('wbRunBtn');
  btn.disabled = true;
  btn.textContent = 'Running…';
  var result = frame.contentWindow.runChain();
  if (result && typeof result.then === 'function') {
    result.then(function() { btn.disabled=false; btn.textContent='▶ Run Chain'; })
          .catch(function() { btn.disabled=false; btn.textContent='▶ Run Chain'; });
  } else {
    setTimeout(function() { btn.disabled=false; btn.textContent='▶ Run Chain'; }, 6000);
  }
}

/* ── polling for artifact ── */
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(checkForResult, 500);
}
function checkForResult() {
  if (!selectedChain) return;
  var frame = document.getElementById('runnerFrame');
  if (!frame || frame.style.display === 'none') return;
  try {
    var doc = frame.contentDocument;
    if (!doc) return;
    /* G2: update step ladder from runner stage-state elements */
    updateStepLadder(frame, doc);
    var rs = doc.getElementById('resultSection');
    if (!rs || rs.style.display === 'none') return;
    var hashEl = doc.getElementById('hashValue');
    var hash = hashEl ? hashEl.textContent.trim() : '';
    if (!hash || hash === '—' || hash === lastHash) return;
    lastHash = hash;
    var jsonEl = doc.getElementById('jsonCode');
    try { currentArtifact = jsonEl ? JSON.parse(jsonEl.textContent) : null; } catch(e2) { currentArtifact = null; }
    showArtifact();
  } catch(e) { /* cross-origin guard */ }
}

/* ── G2: step ladder update ── */
function updateStepLadder(frame, doc) {
  var i = 0;
  while (true) {
    var stEl = doc.getElementById('state' + i);
    if (!stEl) break;
    var dot = document.getElementById('slDot' + i);
    var st  = document.getElementById('slSt' + i);
    var row = document.getElementById('slRow' + i);
    if (dot && st && row) {
      var cls = stEl.className || '';
      if (cls.indexOf('st-running') >= 0) {
        dot.className = 'sl-dot running'; st.textContent = 'running'; row.className = 'sl-row';
      } else if (cls.indexOf('st-done') >= 0) {
        dot.className = 'sl-dot done'; st.textContent = 'done'; row.className = 'sl-row sl-clickable';
      } else if (cls.indexOf('st-empty') >= 0) {
        dot.className = 'sl-dot fail'; st.textContent = 'no output'; row.className = 'sl-row sl-clickable';
      } else {
        dot.className = 'sl-dot'; st.textContent = 'pending'; row.className = 'sl-row';
      }
    }
    i++;
  }
}

var _slDetailShown = null;
function showStepDetail(idx) {
  var old = document.getElementById('slDetail');
  if (old) old.remove();
  if (_slDetailShown === idx) { _slDetailShown = null; return; }
  _slDetailShown = idx;
  var frame = document.getElementById('runnerFrame');
  try {
    var col = frame.contentWindow.collected;
    if (!col || !col[idx]) return;
    var step = col[idx];
    var text = step.mandate
      ? JSON.stringify(step.mandate.payload || step.mandate, null, 2)
      : (step.error || 'no mandate produced');
    var det = document.createElement('div');
    det.id = 'slDetail'; det.className = 'sl-detail';
    det.textContent = text;
    var row = document.getElementById('slRow' + idx);
    if (row) row.after(det);
  } catch(e) { /* guard */ }
}

/* ── G1b: accordion toggle ── */
function toggleAcc(key) {
  var hdr = document.getElementById('acc' + key.charAt(0).toUpperCase() + key.slice(1) + 'Hdr');
  var body = document.getElementById('acc' + key.charAt(0).toUpperCase() + key.slice(1) + 'Body');
  if (!hdr || !body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  hdr.classList.toggle('open', !open);
  hdr.setAttribute('aria-expanded', String(!open));
}

/* ── show artifact ── */
function showArtifact() {
  if (!lastHash) return;
  document.getElementById('apHash').textContent = lastHash;
  document.getElementById('apVerifyOut').textContent = '';
  document.getElementById('artifactSection').style.display = 'block';
  updateSnapSuggestions();
}

/* ── snap-compat ── */
function updateSnapSuggestions() {
  var chain = null;
  for (var i=0;i<CATALOG_DATA.length;i++) if (CATALOG_DATA[i].name === selectedChain) { chain=CATALOG_DATA[i]; break; }
  if (!chain || !chain.last_feeds || !chain.last_feeds.length) return;
  var feedSet = {};
  for (var f=0;f<chain.last_feeds.length;f++) feedSet[chain.last_feeds[f]] = true;
  var downstream = [];
  for (var j=0;j<CATALOG_DATA.length;j++) {
    var c = CATALOG_DATA[j];
    if (c.name === selectedChain || !c.step_tool_ids.length) continue;
    if (feedSet[c.step_tool_ids[0]]) downstream.push(c);
  }
  if (!downstream.length) return;
  var el = document.getElementById('snapList');
  var html = '';
  var limit = Math.min(downstream.length, 6);
  for (var k=0;k<limit;k++) {
    var d = downstream[k];
    html += '<div class="snap-item" data-name="' + escHtml(d.name) + '">'
      + '<span class="snap-title">' + escHtml(d.title) + '</span>'
      + (d.has_runner ? '<span class="snap-badge">&#x25B6; runner</span>' : '')
      + '</div>';
  }
  el.innerHTML = html;
  el.onclick = function(e) {
    var item = e.target.closest('.snap-item');
    if (item && item.dataset.name) selectChain(item.dataset.name);
  };
  document.getElementById('accSnapHdr').style.display = 'flex';
}

/* ── right panel verify ── */
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

async function sha256hex(obj) {
  var s = __ocgCanonStr(obj);
  var buf = new TextEncoder().encode(s);
  var dig = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(dig)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}

/* ── exports ── */
function apExportArtifact() {
  if (currentArtifact) dl(JSON.stringify(currentArtifact,null,2), selectedChain+'_'+ts14()+'.artifact.json','application/json');
}
function apExportVC() {
  if (!currentArtifact || !lastHash) return;
  var vc = {
    '@context': ['https://www.w3.org/ns/credentials/v2','https://ainumbers.co/chaingraph/context/vc/v0.4.1'],
    type: ['VerifiableCredential','OpenChainGraphCredential'],
    id: 'urn:ocg:artifact:'+lastHash,
    issuer: 'https://ainumbers.co',
    credentialSubject: {
      id: 'urn:ocg:chain:'+selectedChain+'#workbench-runner',
      mandate_type: currentArtifact.mandate_type,
      policy_parameters: currentArtifact.policy_parameters,
      output_payload: currentArtifact.output_payload
    },
    'ocg:hashAnchor': {
      type: 'OpenChainGraphHashAnchor2026',
      digestMethod: 'sha-256',
      executionHash: lastHash,
      verify_url: 'https://ainumbers.co/chaingraph/runners/'+selectedChain+'.html'
    }
  };
  dl(JSON.stringify(vc,null,2), selectedChain+'_'+ts14()+'.vc.json','application/vc+json');
}

/* ── MCP copy ── */
function copyMcp() {
  var text = document.getElementById('mcpSnippet').textContent;
  var btn = document.getElementById('copyMcpBtn');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      btn.textContent = '✓ Copied!';
      setTimeout(function(){ btn.textContent='📋 Copy'; }, 1600);
    }).catch(function(){ fallbackCopy(text); });
  } else { fallbackCopy(text); }
}
function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch(e){}
  document.body.removeChild(ta);
}

/* ── H1: Workbench permalinks ── */
function wbInputsJson() {
  var ta = document.getElementById('wbInputsTa');
  var raw = ta ? ta.value.trim() : '';
  if (!raw) return null;
  try { return JSON.parse(raw); } catch(e) { return null; }
}
function wbInputsB64() {
  var obj = wbInputsJson();
  if (!obj || !Object.keys(obj).length) return '';
  var json = JSON.stringify(obj);
  var bytes = new TextEncoder().encode(json);
  return btoa(String.fromCharCode.apply(null, bytes)).replace(/[+]/g,'-').replace(/[/]/g,'_').replace(/=+$/,'');
}
function updateHash() {
  if (!selectedChain) { history.replaceState(null,'',location.pathname+location.search); return; }
  var inB64 = wbInputsB64();
  var frag = '#chain=' + encodeURIComponent(selectedChain) + (inB64 ? '&in=' + inB64 : '');
  history.replaceState(null, '', frag);
}
function wbCopyLink() {
  updateHash();
  var url = location.href;
  var btn = document.getElementById('wbLinkBtn');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(function() {
      btn.textContent = '&#x2713; Copied!';
      setTimeout(function(){ btn.textContent = '&#x1F517; Link'; }, 1600);
    }).catch(function(){ fallbackCopy(url); });
  } else { fallbackCopy(url); }
}
function loadFromHash() {
  var hash = location.hash;
  if (!hash || hash.indexOf('chain=') < 0) return;
  var params = {};
  hash.slice(1).split('&').forEach(function(part) {
    var eq = part.indexOf('=');
    if (eq < 0) return;
    try { params[decodeURIComponent(part.slice(0, eq))] = decodeURIComponent(part.slice(eq + 1)); } catch(e) {}
  });
  var chainName = params['chain'];
  if (!chainName) return;
  var found = false;
  for (var i = 0; i < CATALOG_DATA.length; i++) { if (CATALOG_DATA[i].name === chainName) { found = true; break; } }
  if (!found) return;
  if (params['in']) {
    try {
      var b64 = params['in'].replace(/-/g,'+').replace(/_/g,'/');
      var padded = b64 + '=='.slice((b64.length+2)%4);
      var bytes = Uint8Array.from(atob(padded), function(c){ return c.charCodeAt(0); });
      var obj = JSON.parse(new TextDecoder().decode(bytes));
      var ta = document.getElementById('wbInputsTa');
      if (ta) ta.value = JSON.stringify(obj, null, 2);
    } catch(e) { /* ignore bad in= */ }
  }
  selectChain(chainName);
}
function applyInitialInputs() {
  var obj = wbInputsJson();
  if (!obj || !Object.keys(obj).length) return;
  var frame = document.getElementById('runnerFrame');
  if (!frame || !frame.contentWindow) return;
  try {
    var innerFrame = frame.contentWindow.document.getElementById('frame0');
    if (innerFrame && innerFrame.contentWindow && typeof frame.contentWindow.applySeed === 'function') {
      frame.contentWindow.applySeed(innerFrame.contentWindow, obj);
    }
  } catch(e) { /* cross-origin or not ready */ }
}

/* ── init ── */
window.addEventListener('DOMContentLoaded', function() {
  var hint = document.getElementById('emptyHint');
  var runnerCount = 0;
  for (var i=0;i<CATALOG_DATA.length;i++) if (CATALOG_DATA[i].has_runner) runnerCount++;
  if (hint) hint.textContent = runnerCount + ' of ' + CATALOG_DATA.length + ' chains have live runners (▶)';
  renderCatalog(CATALOG_DATA);
  document.getElementById('catalogCount').textContent = CATALOG_DATA.length + ' chains';
  document.getElementById('searchInput').addEventListener('input', applyFilter);
  document.getElementById('runnersOnly').addEventListener('change', applyFilter);

  /* H1: inputs textarea wiring */
  var ta = document.getElementById('wbInputsTa');
  if (ta) {
    ta.addEventListener('input', function() {
      var errEl = document.getElementById('wbInputsErr');
      var raw = ta.value.trim();
      if (!raw) { errEl.style.display = 'none'; updateHash(); return; }
      try { JSON.parse(raw); errEl.style.display = 'none'; updateHash(); }
      catch(e) { errEl.style.display = 'block'; }
    });
  }

  /* H1: load from hash after catalog is ready */
  loadFromHash();
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
/* OCG-§16-UI v1 (workbench adaptation) — Sign + Verify wiring. */
async function apSign(){
  if(!currentArtifact)return;
  if(!confirm('Signing binds this run to a one-time key and de-anonymizes it (OCG §16.2). Continue?'))return;
  try{
    var kp=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
    var did=await __ocgDidKeyFromPub(kp.publicKey);
    var signed=await __ocgSign(currentArtifact,{verificationMethod:did,created:currentArtifact.generated_at,privateKey:kp.privateKey});
    dl(JSON.stringify(signed,null,2),selectedChain+'_'+ts14()+'.signed.json','application/json');
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

  const wfHtml = renderRail(wfSteps, 'run');
  return html.replace(CATALOG_PLACEHOLDER, () => catalogJson).replace(WAYFINDER_PH, () => wfHtml);
}

/* ── check or write ──────────────────────────────────────────────── */
const html = renderWorkbench(catalogJson);

if (CHECK_MODE) {
  if (!existsSync(OUT_PATH)) {
    console.error('✗ gen-workbench: workbench.html is missing (run: node scripts/gen-workbench.mjs)');
    process.exit(1);
  }
  const disk = readFileSync(OUT_PATH, 'utf8');
  if (disk !== html) {
    console.error('✗ gen-workbench: workbench.html is stale (run: node scripts/gen-workbench.mjs)');
    process.exit(1);
  }
  console.log('✓ gen-workbench: workbench.html up-to-date (' + cg.chains.length + ' chains, '
    + eligibleRunners.size + ' runners)');
  process.exit(0);
} else {
  mkdirSync(WB_DIR, { recursive: true });
  writeFileSync(OUT_PATH, html, 'utf8');
  console.log('gen-workbench: wrote chaingraph/workbench/workbench.html');
  console.log('  chains: ' + cg.chains.length + ' total, ' + eligibleRunners.size + ' with runners');
  console.log('  catalog size: ~' + Math.round(catalogJson.length / 1024) + 'KB inline');
}
