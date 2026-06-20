// build-tcm-chain-pages.mjs — generate the Wave-11 tcm-* chain composition pages
// from chaingraph.json (DRY: node names/urls + step handoffs come from the source of truth).
//
//   node repo/chaingraph/chains/build-tcm-chain-pages.mjs            # dry run (lists)
//   node repo/chaingraph/chains/build-tcm-chain-pages.mjs --write    # writes chains/tcm-*.html
//
// Re-run after editing any tcm-* chain in chaingraph.json. Commit the generated HTML.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CG = resolve(HERE, '..', 'chaingraph.json');
const WRITE = process.argv.includes('--write');

const cg = JSON.parse(readFileSync(CG, 'utf8'));
const nodeById = {};
for (const n of (cg.nodes ?? [])) nodeById[n.tool_id] = n;
const chains = (cg.chains ?? []).filter((c) => c.name && c.name.startsWith('tcm-'));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const relUrl = (u) => (u || '').replace('https://ainumbers.co/chaingraph/', '../').replace('https://ainumbers.co/', '../../');

function page(chain) {
  const stages = chain.steps.map((s, i) => {
    const n = nodeById[s.tool_id] || {};
    const name = n.display_name || s.tool_id;
    const href = n.url ? relUrl(n.url) : null;
    const isNew = (n.wave === 11);
    const tag = i === 0 ? 'ROOT · D0' : (i === chain.steps.length - 1 ? 'TERMINAL' : 'D' + i);
    return `
      <div class="stage">
        <div class="stage-h"><span class="snum">${i + 1}</span><span class="stag">${tag}</span>${isNew ? '<span class="new">new</span>' : '<span class="reuse">reused</span>'}</div>
        <div class="sname">${href ? `<a href="${href}">${esc(name)}</a>` : esc(name)} <span class="tid">${esc(s.tool_id)}</span></div>
        <div class="shand">${esc(s.handoff)}</div>
      </div>${i < chain.steps.length - 1 ? '<div class="arrow">&darr;</div>' : ''}`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(chain.title)} — Wave 11 chain | AINumbers OpenChainGraph</title>
<meta name="description" content="${esc(chain.description)}">
<meta name="robots" content="index, follow">
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
h1{font-size:1.45rem;color:var(--white);margin-bottom:8px;font-weight:600}
.desc{max-width:640px;margin-bottom:18px}
.stage{background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--teal);border-radius:var(--radius-lg);padding:14px 18px}
.stage-h{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.snum{font-family:'JetBrains Mono',monospace;width:22px;height:22px;border-radius:50%;background:var(--teal-dim);color:var(--teal-lt);display:flex;align-items:center;justify-content:center;font-size:.72rem}
.stag{font-family:'JetBrains Mono',monospace;font-size:.54rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.new{font-family:'JetBrains Mono',monospace;font-size:.5rem;background:rgba(34,197,94,.12);color:var(--green);border:1px solid rgba(34,197,94,.3);padding:.1rem .4rem;border-radius:20px;text-transform:uppercase;letter-spacing:.08em}
.reuse{font-family:'JetBrains Mono',monospace;font-size:.5rem;background:var(--bg3);color:var(--muted);border:1px solid var(--border);padding:.1rem .4rem;border-radius:20px;text-transform:uppercase;letter-spacing:.08em}
.sname{font-size:.92rem;color:var(--bright);font-weight:600}
.tid{font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--muted);font-weight:400}
.shand{font-size:.78rem;color:var(--body);margin-top:4px}
.arrow{text-align:center;color:var(--muted);font-size:1.1rem;line-height:1;margin:4px 0}
.note{background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);padding:12px 16px;margin-top:20px;font-size:.8rem}
.note b{color:var(--bright)}
.reframe{font-size:.74rem;color:var(--muted);margin-top:10px;font-style:italic}
</style></head>
<body>
<nav><div class="in"><span><b>AI</b>Numbers · OpenChainGraph</span><a href="../guide-treasury-clearing.html">← Treasury Clearing guide</a></div></nav>
<div class="wrap">
  <div class="eyebrow">Wave 11 · US Treasury Clearing · ${esc(chain.name)}</div>
  <h1>${esc(chain.title)}</h1>
  <p class="desc">${esc(chain.description)}</p>
  ${stages}
  <div class="note"><b>How this chain runs.</b> Each stage is an OpenChainGraph v0.4 tool: call it over MCP (or in-browser), capture its <code>execution_hash</code>, and pass it as the next stage's <code>parent_hashes</code>. The terminal artifact carries the full provenance chain and can be exported (xlsx / pdf / xbrl) via <code>export_artifact</code>. Every decision is reproducible and independently verifiable.
  <div class="reframe">Reused capital-markets nodes (Canton/Wave-8 + the VaR/stress/liquidity stack) apply the same regulatory logic (SA-CCR, CRE70, HQLA, d349, PFMI P12, 2a-7) natively to FICC-cleared cash &amp; repo — confirm any tokenized-context framing on the underlying tool page.</div>
  </div>
</div>
</body></html>
`;
}

let count = 0;
for (const chain of chains) {
  const file = resolve(HERE, `${chain.name}.html`);
  if (WRITE) writeFileSync(file, page(chain));
  console.log(`${WRITE ? 'wrote' : 'would write'}  chains/${chain.name}.html  (${chain.steps.length} stage${chain.steps.length > 1 ? 's' : ''})`);
  count++;
}
console.log(`\n${WRITE ? 'Wrote' : 'Dry run -'} ${count} tcm-* chain page(s).${WRITE ? '' : ' Re-run with --write to generate.'}`);
