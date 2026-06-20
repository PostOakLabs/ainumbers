// build-chain-pages.mjs — generate generic OpenChainGraph chain composition pages
// from chaingraph.json (DRY: titles, descriptions, step handoffs come from the source of truth).
//
//   node build-chain-pages.mjs <name> [<name> ...]            # dry run (lists)
//   node build-chain-pages.mjs --write <name> [<name> ...]    # write chains/<name>.html
//   node build-chain-pages.mjs --write --missing              # write a page for EVERY chain
//                                                              # that lacks chains/<name>.html
//
// Produces the same linear template as the tcm-* / ach / tempo-validator chain pages
// (the majority convention). Step links resolve to a nodes[] page, a promoted node page
// (chaingraph/<id>.html), or a catalog tool (tools/<id>.html) — whichever exists.
// Re-run after editing a chain in chaingraph.json. Commit the generated HTML.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');                 // repo/
const CG = resolve(HERE, '..', 'chaingraph.json');      // repo/chaingraph/chaingraph.json
const TOOLS_DIR = resolve(REPO, 'tools');
const CG_DIR = resolve(REPO, 'chaingraph');

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const MISSING = args.includes('--missing');
const NAMES = args.filter((a) => !a.startsWith('--'));

const cg = JSON.parse(readFileSync(CG, 'utf8'));
const nodeById = {};
for (const n of (cg.nodes ?? [])) nodeById[n.tool_id] = n;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const relUrl = (u) => (u || '').replace('https://ainumbers.co/chaingraph/', '../').replace('https://ainumbers.co/', '../../');

// Pretty display name from a slug like "503-canton-tokenization-readiness-diagnostic"
// or "rbe-06-agentic-mandate-sandbox" → "Canton Tokenization Readiness Diagnostic".
function prettify(id) {
  const stripped = String(id)
    .replace(/^rbe-\d+-/, '')
    .replace(/^art-\d+-/, '')
    .replace(/^\d+-/, '');
  return stripped.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

// Resolve a step's display name + href. Order: nodes[] → promoted node page → catalog tool.
function resolveStep(tool_id) {
  const n = nodeById[tool_id];
  if (n && n.url) return { name: n.display_name || prettify(tool_id), href: relUrl(n.url), kind: 'node' };
  if (existsSync(resolve(CG_DIR, `${tool_id}.html`))) return { name: prettify(tool_id), href: `../${tool_id}.html`, kind: 'node' };
  if (existsSync(resolve(TOOLS_DIR, `${tool_id}.html`))) return { name: prettify(tool_id), href: `../../tools/${tool_id}.html`, kind: 'reuse' };
  return { name: prettify(tool_id), href: null, kind: 'reuse' };
}

function page(chain) {
  const n = chain.steps.length;
  const stages = chain.steps.map((s, i) => {
    const r = resolveStep(s.tool_id);
    const tag = n === 1 ? 'ROOT · TERMINAL · D0' : (i === 0 ? 'ROOT · D0' : (i === n - 1 ? 'TERMINAL' : 'D' + i));
    const badge = r.kind === 'node' ? '<span class="node">node</span>' : '<span class="reuse">reused</span>';
    const nameHtml = r.href ? `<a href="${r.href}">${esc(r.name)}</a>` : esc(r.name);
    return `
      <div class="stage">
        <div class="stage-h"><span class="snum">${i + 1}</span><span class="stag">${tag}</span>${badge}</div>
        <div class="sname">${nameHtml} <span class="tid">${esc(s.tool_id)}</span></div>
        <div class="shand">${esc(s.handoff)}</div>
      </div>${i < n - 1 ? '<div class="arrow">&darr;</div>' : ''}`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(chain.title)} — chain | AINumbers OpenChainGraph</title>
<meta name="description" content="${esc(chain.description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://ainumbers.co/chaingraph/chains/${esc(chain.name)}.html">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23080E1A'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='Sora,sans-serif' font-weight='600' font-size='13' fill='%2314B8A6'>AI</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Sora:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
:root{--bg:#080E1A;--bg2:#0D1627;--bg3:#111E35;--border:#1E2F4A;--border2:#263855;--muted:#3A5270;--body:#6888A8;--bright:#D4E8F8;--white:#EEF6FD;--teal:#14B8A6;--teal-lt:#2DD4BF;--teal-dim:rgba(20,184,166,.12);--gold:#D4A847;--green:#22C55E;--radius:6px;--radius-lg:10px}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--body);font-family:'Sora',system-ui,sans-serif;font-size:14px;line-height:1.6}
a{color:var(--teal-lt);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:760px;margin:0 auto;padding:24px 20px 80px}
nav{position:sticky;top:0;z-index:10;background:rgba(8,14,26,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--border);padding:0 20px;height:50px;display:flex;align-items:center}
nav .in{max-width:760px;margin:0 auto;width:100%;display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:.8rem}
nav b{color:var(--teal)}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--teal);margin:18px 0 8px}
h1{font-size:1.45rem;color:var(--white);margin-bottom:8px;font-weight:600;font-family:'DM Serif Display',serif}
.desc{max-width:640px;margin-bottom:18px}
.stage{background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--teal);border-radius:var(--radius-lg);padding:14px 18px}
.stage-h{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.snum{font-family:'JetBrains Mono',monospace;width:22px;height:22px;border-radius:50%;background:var(--teal-dim);color:var(--teal-lt);display:flex;align-items:center;justify-content:center;font-size:.72rem}
.stag{font-family:'JetBrains Mono',monospace;font-size:.54rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.node{font-family:'JetBrains Mono',monospace;font-size:.5rem;background:var(--teal-dim);color:var(--teal-lt);border:1px solid rgba(20,184,166,.3);padding:.1rem .4rem;border-radius:20px;text-transform:uppercase;letter-spacing:.08em}
.reuse{font-family:'JetBrains Mono',monospace;font-size:.5rem;background:var(--bg3);color:var(--muted);border:1px solid var(--border);padding:.1rem .4rem;border-radius:20px;text-transform:uppercase;letter-spacing:.08em}
.sname{font-size:.92rem;color:var(--bright);font-weight:600}
.tid{font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--muted);font-weight:400}
.shand{font-size:.78rem;color:var(--body);margin-top:4px}
.arrow{text-align:center;color:var(--muted);font-size:1.1rem;line-height:1;margin:4px 0}
.note{background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);padding:12px 16px;margin-top:20px;font-size:.8rem}
.note b{color:var(--bright)}
</style></head>
<body>
<nav><div class="in"><span><b>AI</b>Numbers · OpenChainGraph</span><a href="../chaingraph-hub.html">← OpenChainGraph hub</a></div></nav>
<div class="wrap">
  <div class="eyebrow">OpenChainGraph · ${esc(chain.name)}</div>
  <h1>${esc(chain.title)}</h1>
  <p class="desc">${esc(chain.description)}</p>
  ${stages}
  <div class="note"><b>How this chain runs.</b> Each stage is an OpenChainGraph tool: call it in-browser (or over MCP), capture its <code>execution_hash</code>, and pass it as the next stage's <code>parent_hashes</code>. The terminal artifact carries the full provenance chain and can be exported (xlsx / pdf / xbrl) via <code>export_artifact</code>. Every decision is reproducible and independently verifiable. Client-side, zero PII.</div>
</div>
</body></html>
`;
}

const allChains = cg.chains ?? [];
let targets;
if (MISSING) {
  targets = allChains.filter((c) => c.name && !existsSync(resolve(HERE, `${c.name}.html`)));
} else {
  const want = new Set(NAMES);
  targets = allChains.filter((c) => want.has(c.name));
  const found = new Set(targets.map((c) => c.name));
  for (const nm of NAMES) if (!found.has(nm)) console.error(`!! chain not found in chaingraph.json: ${nm}`);
}

let count = 0;
for (const chain of targets) {
  const file = resolve(HERE, `${chain.name}.html`);
  const exists = existsSync(file);
  if (WRITE) writeFileSync(file, page(chain));
  console.log(`${WRITE ? 'wrote' : 'would write'}  chains/${chain.name}.html  (${chain.steps.length} stage${chain.steps.length > 1 ? 's' : ''})${exists ? '  [OVERWRITES existing]' : ''}`);
  count++;
}
console.log(`\n${WRITE ? 'Wrote' : 'Dry run -'} ${count} chain page(s).${WRITE ? '' : ' Re-run with --write to generate.'}`);
