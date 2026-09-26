#!/usr/bin/env node
/**
 * scripts/gen-prompts-page.mjs — prompts.html, the copy-paste prompt library.
 * PROMPT-LIBRARY-PAGE-2 (AGENT-REACH-BUILD-SPEC §3.3 + the 2026-09-05 amendment).
 *
 * SSOT: mcp/showcase-prompts.json (the same file the worker's prompts/list and
 * gen-estate-map.mjs read). The page renders EVERY entry, grouped by the JSON's
 * `group` field, in the amendment's section order:
 *   Showcase · Deep dives (persona) · Everyday · By domain (commerce, crypto,
 *   banking, compliance, governance — one sub-heading each) · Every chain
 * plus a per-chain one-liners section parsed from the same table
 * MCP-SUITE-RECIPES-1 uses: the #workflows table in mcp.html (id, what it runs,
 * composer link — the SSOT the worker's recipes precompute is generated from).
 *
 * The page must render correctly with ANY count >= 1: nothing below hardcodes
 * the entry count; the count sentinel is `data-count="showcase_prompts"`.
 *
 * Per card (amendment): title, one_line, doorway badges from doorways[],
 * the W/R/H/L/A/Z requires legend ONCE at the top of the page, tool chips from
 * tools[] (helmd: names link to helm.html; node tools link to their node page
 * chaingraph/<tool_id>.html resolved through chaingraph/chaingraph.json; worker
 * utility names have no page and render as plain chips), a "requires" line from
 * requires[], the body in a <pre> with a copy button, the verify_surface
 * link(s), and a "run it" deep link ONLY when the entry names exactly one node
 * tool (TOOLPAGE-DEEPLINK-1, which has landed: the fragment reader ships in
 * chaingraph/_page-chrome.mjs on every generated node page). The deep link is
 * `#p=v1.<base64url(gzip(JSON policy_parameters))>` — no `&run=1`, because the
 * SSOT's arguments[] carry name/description/required but no values, and this
 * generator never invents parameter values; an empty payload prefills nothing
 * (the reader treats a parameter-free tool as legitimate). If a future SSOT
 * entry carries argument values (example/default/value), they flow into the
 * payload unchanged.
 *
 * Chrome: canonical root chrome — head/fonts/nav copied byte-style from
 * start.html; footer rendered from the single-source ROOT_FOOTER/ROOT_FOOTER_CSS
 * constants in chaingraph/_page-chrome.mjs (the same bytes gen-root-chrome.mjs
 * injects behind the ROOT-FOOTER sentinels).
 *
 * Usage:
 *   node scripts/gen-prompts-page.mjs           # write prompts.html (skip if byte-exact)
 *   node scripts/gen-prompts-page.mjs --check   # freshness gate: exit 1 on drift
 *   node scripts/gen-prompts-page.mjs --selftest  # RED mutation battery, in memory
 *
 * Derived-set entry: scripts/derived-artifacts.mjs COVERED id 'prompts-page'
 * (idempotent: no wall-clock anywhere; a second pass is byte-identical).
 * ⛔ No prompt text edits here — the SSOT is the JSON; this file only renders.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { ROOT_FOOTER, ROOT_FOOTER_CSS } from '../chaingraph/_page-chrome.mjs';
// PROMPTS-BORROW-LABELS-1 (BORROW-1 + BORROW-2): four-state runnability chips
// + the SSOT self-link + the connect-first strip + the Claude Desktop handoff.
import { installLinks } from './gen-install-links.mjs';
import { classifyChainRows, CHIP_LABELS, RUN_STATES, loadChainGraph } from './lib-chain-runnability.mjs';
import { hallmarkFindings, DEFAULT_NOTX_CAP, OVERUSE_CAP } from './check-copy-hallmarks.mjs';
// INFRA-PROMPTS-SVG-1: the shared animated-scene template.
import { SCENE_KIT_CSS, SCENE_KIT_HEAD_JS, sceneFigure, icon } from './lib/scene-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const OUT_REL = 'prompts.html';
const OUT = resolve(REPO, OUT_REL);
const CHECK = process.argv.includes('--check');
const SELFTEST = process.argv.includes('--selftest');

// ── SSOT loads ───────────────────────────────────────────────────────────────

function loadPrompts() {
  const raw = JSON.parse(readFileSync(resolve(REPO, 'mcp', 'showcase-prompts.json'), 'utf8'));
  const prompts = Array.isArray(raw) ? raw : (Array.isArray(raw.prompts) ? raw.prompts : null);
  if (!Array.isArray(prompts)) throw new Error('mcp/showcase-prompts.json: expected a JSON array or {prompts:[…]}');
  if (prompts.length < 1) throw new Error('mcp/showcase-prompts.json: zero entries — the page needs at least 1');
  return prompts;
}

function loadToolPages(graph) {
  // "resolved through the never-written chaingraph.json": the graph is a
  // derived, main-regenerated artifact; this generator only READS it to map
  // mcp_name -> tool_id (page name). It never writes it.
  const map = new Map();
  for (const n of graph.nodes ?? []) {
    if (n.mcp_name && n.tool_id && !map.has(n.mcp_name)) map.set(n.mcp_name, n.tool_id);
  }
  return map;
}

// The per-chain one-liners section: the SAME table MCP-SUITE-RECIPES-1 reads —
// mcp.html's #workflows table (chain id | what it runs | composer link).
function loadChains() {
  const html = readFileSync(resolve(REPO, 'mcp.html'), 'utf8');
  const start = html.indexOf('id="workflows"');
  if (start === -1) throw new Error('mcp.html: #workflows section not found');
  const end = html.indexOf('</section>', start);
  const sec = html.slice(start, end);
  const chains = [];
  let group = null;
  const trRe = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/g;
  const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
  let m;
  while ((m = trRe.exec(sec)) !== null) {
    const attrs = m[1] || '';
    if (/\btool-group\b/.test(attrs)) {
      group = stripTags(m[2]);
      continue;
    }
    const tds = [];
    let t;
    while ((t = tdRe.exec(m[2])) !== null) tds.push(t[1].trim());
    if (tds.length < 2) continue; // header row or malformed
    const link = /<a\s+href="([^"]+)"/.exec(tds[2] ?? '');
    chains.push({
      id: stripTags(tds[0]),
      desc: stripTags(tds[1]),
      group,
      href: link ? link[1] : null,
    });
  }
  return chains;
}

// Decode the named/numeric entities mcp.html's sourced table text carries, so
// esc() escapes exactly once (check-copy-hallmarks fails on "&amp;amp;").
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&ndash;/g, '\u2013').replace(/&mdash;/g, '\u2014')
    .replace(/&rarr;/g, '\u2192').replace(/&larr;/g, '\u2190').replace(/&sect;/g, '\u00A7')
    .replace(/&middot;/g, '\u00B7').replace(/&#8599;/g, '\u2197')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Deep-link codec (TOOLPAGE-DEEPLINK-1) ───────────────────────────────────
// #p=v1.<base64url(gzip(JSON policy_parameters))> — the exact wire shape the
// fragment reader in chaingraph/_page-chrome.mjs decodes.

function deeplink(entry, toolId) {
  const params = {};
  for (const a of entry.arguments ?? []) {
    const v = a?.value ?? a?.example ?? a?.default;
    if (v !== undefined && a?.name) params[a.name] = v;
  }
  const b64 = gzipSync(Buffer.from(JSON.stringify(params), 'utf8')).toString('base64url');
  return `chaingraph/${toolId}.html#p=v1.${b64}`;
}

// ── Page rendering ───────────────────────────────────────────────────────────

const SECTION_ORDER = ['showcase', 'persona', 'everyday', 'commerce', 'crypto', 'banking', 'compliance', 'governance'];
const SECTION_TITLES = {
  showcase: 'Showcase',
  persona: 'Deep dives',
  everyday: 'Everyday',
};
const DOMAIN_TITLES = { commerce: 'Commerce', crypto: 'Crypto', banking: 'Banking', compliance: 'Compliance', governance: 'Governance' };
const REQUIRES_LEGEND = {
  W: 'WebMCP page (OT token or flag)',
  R: 'hosted MCP',
  H: 'helmd paired',
  L: 'ledger',
  A: 'anchor MCP',
  Z: 'zk receipt',
};
const DOORWAY_LABELS = { webmcp: 'WebMCP', mcp: 'hosted MCP', helmd: 'helmd', ledger: 'ledger', anchor: 'anchor', zk: 'zk' };

// ── Claude Desktop handoff (PROMPTS-BORROW-LABELS-1, spec §P10) ─────────────
// Only the DOCUMENTED form ships: claude://claude.ai/new?q= (Claude support
// article 14729294: q prefills, ~14,000-char cap, never auto-sends, needs
// Claude Desktop installed). §J rejects the undocumented https://claude.ai/
// new?q= and chatgpt.com/?q= forms. The URL is NEVER stored in the HTML —
// the inline handler below builds it synchronously on click from the card's
// rendered body, using the same PREFIX constant.
const HANDOFF_REQUIRES = new Set(['R', 'L', 'A', 'Z']);
const HANDOFF_PREFIX = 'Connect https://mcp.ainumbers.co/mcp first; if its tools are unavailable, stop and say so.\n\n';
const HANDOFF_ENCODED_CAP = 14000;
function handoffEligible(entry) {
  // requires ⊆ {R, L, A, Z} (vacuously true for a card that names nothing),
  // and the documented ~14,000-char prefill cap leaves room for the body.
  return (entry.requires ?? []).every((r) => HANDOFF_REQUIRES.has(r))
    && encodeURIComponent(HANDOFF_PREFIX + (entry.body ?? '')).length <= HANDOFF_ENCODED_CAP;
}

// ── Connect-first strip (PROMPTS-BORROW-LABELS-1, spec §P5) ─────────────────
// The deeplinks are IMPORTED from gen-install-links.mjs (MCP-INSTALL-LINKS-1's
// derivation) — ⛔ never hand-written here. The `claude mcp add` command is a
// copy button, not a deeplink, and embeds the same canonical endpoint.
const CLAUDE_MCP_ADD = 'claude mcp add --transport http ainumbers ' + installLinks.endpoint;

function groupSections(prompts) {
  const byGroup = new Map();
  for (const e of prompts) {
    if (!byGroup.has(e.group)) byGroup.set(e.group, []);
    byGroup.get(e.group).push(e);
  }
  const known = SECTION_ORDER.filter((g) => byGroup.has(g));
  // A group added to the SSOT after this row landed must still render (any count, any group set).
  const extra = [...byGroup.keys()].filter((g) => !SECTION_ORDER.includes(g)).sort();
  return { byGroup, known, extra };
}

// ── Animated scenes (INFRA-PROMPTS-SVG-1, scripts/lib/scene-kit.mjs) ─────────
// Three illustrations, each drawn only from fields this generator already
// renders: the anatomy legend mirrors the card parts below it; the door
// stations light the card's own doorways[]; the deep-dive scene follows the
// steps of that prompt's body. No prompt text is edited here.

// The door track, in DOORWAY_LABELS order. doorways[] order is not the order
// a prompt walks them, so the strip lights stations and draws no arrows.
const DOOR_TRACK = ['webmcp', 'mcp', 'helmd', 'ledger', 'anchor', 'zk'];

// Showcase prompts that get no door strip yet. signed-policy-agentic-commerce
// cannot run as written: run_chain rejects a vc_issue credential as
// mandate_unsigned, and its workflow has no gate that could escalate.
// Illustrate it once the prompt runs end to end.
const DOOR_STRIP_HOLD = new Set(['signed-policy-agentic-commerce']);

function doorStrip(entry) {
  if (entry.group !== 'showcase' || DOOR_STRIP_HOLD.has(entry.id)) return '';
  const used = new Set(entry.doorways ?? []);
  const label = (d) => DOORWAY_LABELS[d] ?? d;
  const on = DOOR_TRACK.filter((d) => used.has(d)).map(label);
  const off = DOOR_TRACK.filter((d) => !used.has(d)).map(label);
  const aria = `Doors this prompt uses: ${on.join(', ')}.${off.length ? ` Not used: ${off.join(', ')}.` : ''}`;
  const stations = DOOR_TRACK.map((d, i) => {
    const cx = 50 + i * 100;
    return used.has(d)
      ? `<g class="sk-pop" style="--d:${(0.2 + i * 0.15).toFixed(2)}s"><circle cx="${cx}" cy="24" r="9" fill="var(--teal-dim)" stroke="var(--teal)" stroke-width="1.6"/><circle cx="${cx}" cy="24" r="3.5" fill="var(--teal-lt)"/></g><text x="${cx}" y="54" text-anchor="middle" class="b sm">${esc(label(d))}</text>`
      : `<circle cx="${cx}" cy="24" r="8" fill="var(--bg)" stroke="var(--border-2)" stroke-width="1.3" stroke-dasharray="3 3"/><text x="${cx}" y="54" text-anchor="middle" class="mu sm">${esc(label(d))}</text>`;
  }).join('');
  return `<div class="door-strip"><div class="door-strip-label">Doors this prompt uses</div><div class="sk-scroll"><svg class="sk-scene" viewBox="0 0 600 66" style="min-width:420px" role="img" aria-label="${esc(aria)}" xmlns="http://www.w3.org/2000/svg"><path d="M50 24 H550" stroke="var(--border-2)" stroke-width="1.4"/>${stations}<circle cx="50" cy="24" r="4" fill="var(--gold)" class="sk-travel" style="--tx:500px;--dur:3.6s;--d:.9s"/></svg></div></div>`;
}

function anatomyScene() {
  const steps = [
    { title: 'Prompt', sub: 'the card body', tag: 'Copy prompt' },
    { title: 'Your assistant', sub: 'any MCP client', tag: 'connect strip' },
    { title: 'A door', sub: 'WebMCP or MCP', sub2: 'or helmd', tag: 'Requires' },
    { title: 'Tools', sub: 'one chip per node', tag: 'tool chips' },
    { title: 'Artifact', sub: 'execution_hash', tag: 'run result' },
    { title: 'Verify', sub: 'ledger or recompute', tag: 'Verify links' },
  ];
  const body = steps.map((s, i) => {
    const x = 14 + i * 158;
    const arrow = i < steps.length - 1
      ? `<path class="sk-draw" pathLength="100" d="M${x + 144} 69 H${x + 151}" stroke="var(--muted)" stroke-width="1.6" fill="none" style="--d:${(0.35 + i * 0.25).toFixed(2)}s"/>${icon.arrowRight(x + 158, 69)}`
      : '';
    return `    <g class="sk-pop" style="--d:${(0.1 + i * 0.25).toFixed(2)}s"><rect x="${x}" y="34" width="144" height="70" rx="10" fill="var(--bg-3)" stroke="${i === 4 ? 'var(--gold)' : 'var(--teal)'}" stroke-width="1.3"/><text x="${x + 12}" y="62" class="b sm">${esc(s.title)}</text><text x="${x + 12}" y="82" class="${i === 4 ? 'm g' : 's'} xs">${esc(s.sub)}</text>${s.sub2 ? `<text x="${x + 12}" y="96" class="s xs">${esc(s.sub2)}</text>` : ''}</g>${arrow}
    <path d="M${x + 72} 104 V124" stroke="var(--border-2)" stroke-width="1.2" stroke-dasharray="2 3"/><text x="${x + 72}" y="142" text-anchor="middle" class="m xs t sk-fade" style="--d:${(0.3 + i * 0.25).toFixed(2)}s">${esc(s.tag)}</text>`;
  }).join('\n') + `\n    <circle cx="84" cy="114" r="4" fill="var(--teal-lt)" class="sk-travel" style="--tx:790px;--dur:4.2s;--d:1.8s"/>`;
  return sceneFigure({
    id: 'anatomy-scene',
    viewBox: '0 0 960 160',
    minWidth: 660,
    title: 'How to read a card',
    desc: 'Six boxes in a row: the prompt, which is the card body; your assistant, any MCP client; a door, which is WebMCP or the hosted MCP server or helmd; the tools, one chip per node; the artifact with its execution hash; and the verify step, on the ledger or by recomputing. Under each box a label names the matching part of a card: Copy prompt, the connect strip, Requires, the tool chips, the run result and the Verify links.',
    body,
    caption: 'To use a card, copy its body into your assistant and make sure the assistant can reach the doors listed under Requires. The Verify links check what comes back.',
  });
}

// The deep dive whose body walks private inputs to a hash-only receipt.
function revealScene() {
  const outputs = [
    { tool: 'generate_zk_compliance_proof', note: 'a public statement with no party fields' },
    { tool: 'validate_tfr_travel_rule_batch', note: 'a verdict and its execution_hash' },
    { tool: 'sdjwt_present', note: 'discloses sanctions_predicate: PASS' },
    { tool: 'verify_merkle_batch', note: 'an inclusion proof against the audit root' },
  ];
  const rows = [0, 1, 2, 3, 4].map((r) => `<rect x="36" y="${114 + r * 16}" width="58" height="8" rx="2" fill="var(--muted)"/><rect x="104" y="${114 + r * 16}" width="58" height="8" rx="2" fill="var(--muted)"/><rect x="172" y="${114 + r * 16}" width="30" height="8" rx="2" fill="var(--border-2)"/>`).join('');
  const body = [
    `    <g class="sk-fade" style="--d:.1s"><rect x="20" y="40" width="200" height="160" rx="10" fill="var(--bg-3)" stroke="var(--border-2)" stroke-width="1.3"/><text x="36" y="62" class="b sm">synthetic batch</text><text x="36" y="80" class="m xs mu">5 transfers</text><text x="36" y="104" class="m xs mu">originator</text><text x="104" y="104" class="m xs mu">beneficiary</text>${rows}</g>`,
    `    <text x="120" y="222" text-anchor="middle" class="s xs sk-fade" style="--d:.3s">your agent holds the batch</text>`,
    ...outputs.map((o, i) => {
      const cy = 46 + i * 52;
      return [
        `    <path class="sk-draw" pathLength="100" d="M220 120 C255 120, 255 ${cy}, 290 ${cy}" stroke="var(--teal)" stroke-opacity=".6" stroke-width="1.3" fill="none" style="--d:${(0.4 + i * 0.2).toFixed(2)}s"/>`,
        `    <g class="sk-pop" style="--d:${(0.6 + i * 0.25).toFixed(2)}s"><rect x="290" y="${cy - 20}" width="330" height="40" rx="8" fill="var(--bg-3)" stroke="var(--teal)" stroke-width="1.2"/><text x="304" y="${cy - 4}" class="m xs t">${esc(o.tool)}</text><text x="304" y="${cy + 12}" class="s xs">${esc(o.note)}</text></g>`,
        `    <path class="sk-draw" pathLength="100" d="M620 ${cy} C655 ${cy}, 655 95, 690 95" stroke="var(--gold)" stroke-opacity=".6" stroke-width="1.3" fill="none" style="--d:${(1.8 + i * 0.15).toFixed(2)}s"/>`,
        `    <circle cx="620" cy="${cy}" r="3.5" fill="var(--gold)" class="sk-travel" style="--tx:70px;--ty:${95 - cy}px;--dur:2.2s;--d:${(2.4 + i * 0.4).toFixed(2)}s"/>`,
      ].join('\n');
    }),
    `    <g class="sk-pop" style="--d:2.4s"><rect x="690" y="40" width="250" height="104" rx="12" fill="var(--bg-3)" stroke="var(--gold)" stroke-width="1.4"/><text x="706" y="64" class="b sm">session receipt</text>${icon.hashPill(706, 76, 'root sha256:…', 150)}<text x="706" y="128" class="s xs">built from hashes</text></g>`,
    `    <g class="sk-fade" style="--d:2.9s"><text x="706" y="170" class="t xs u">a verifier sees</text>${icon.check(714, 188, 8)}<text x="730" y="192" class="b xs">predicate results</text>${icon.check(714, 210, 8)}<text x="730" y="214" class="b xs">hashes</text>${icon.lock(706, 224)}<text x="730" y="238" class="s xs">transfer rows stay out of the receipt</text></g>`,
  ].join('\n');
  return sceneFigure({
    id: 'reveal-scene',
    viewBox: '0 0 960 250',
    minWidth: 700,
    title: 'What the final receipt carries',
    desc: 'A synthetic batch of five transfers, with originator and beneficiary columns, feeds four tool results: generate_zk_compliance_proof gives a public statement with no party fields; validate_tfr_travel_rule_batch gives a verdict and an execution hash; sdjwt_present discloses only sanctions_predicate PASS; verify_merkle_batch gives one inclusion proof against the audit root. Hashes flow into a session receipt built from hashes. A verifier sees predicate results and hashes; the transfer rows stay out of the receipt.',
    body,
    caption: 'This deep dive ends with a session receipt built from hashes. The zero-knowledge statement leaves out originator and beneficiary fields and the SD-JWT presentation discloses one claim, so a verifier works from predicate results and hashes.',
  });
}
const CARD_SCENES = { 'prove-compliance-reveal-nothing': revealScene };

function cardHtml(entry, toolPages) {
  const nodeTools = (entry.tools ?? []).filter((t) => !t.startsWith('helmd:'));
  const single = nodeTools.length === 1 && toolPages.has(nodeTools[0])
    ? toolPages.get(nodeTools[0])
    : null;

  const doorways = (entry.doorways ?? [])
    .map((d) => `<span class="door-badge">${esc(DOORWAY_LABELS[d] ?? d)}</span>`)
    .join('');

  const chips = (entry.tools ?? []).map((t) => {
    if (t.startsWith('helmd:')) return `<a class="tool-chip chip-helm" href="helm.html">${esc(t)}</a>`;
    const tid = toolPages.get(t);
    if (tid && existsSync(resolve(REPO, 'chaingraph', `${tid}.html`))) {
      return `<a class="tool-chip" href="chaingraph/${esc(tid)}.html">${esc(t)}</a>`;
    }
    return `<span class="tool-chip chip-plain">${esc(t)}</span>`;
  }).join('');

  const requires = (entry.requires ?? []).length
    ? `<div class="card-requires">Requires: ${(entry.requires ?? []).map((r) => `<abbr class="req" title="${esc(REQUIRES_LEGEND[r] ?? r)}">${esc(r)}</abbr>`).join(' ')}</div>`
    : '';

  // PROMPTS-RUNLINKS-1: a non-empty runner_steps array earns a "Watch it run"
  // doorway into the playground runner panel (mcp-playground.html#run=<id>),
  // rendered in this slot beside — never replacing — the #p=v1 deep link.
  // Entries without runner_steps render exactly as before (byte-identical cards).
  const watch = Array.isArray(entry.runner_steps) && entry.runner_steps.length
    ? `<a class="run-link" href="mcp-playground.html#run=${esc(entry.id)}">Watch it run</a>`
    : '';
  const run = single
    ? `<a class="run-link" href="${esc(deeplink(entry, single))}">Run it on the node page &#8594;</a>${watch ? `\n    ${watch}` : ''}`
    : watch;

  const verify = (Array.isArray(entry.verify_surface) ? entry.verify_surface : [entry.verify_surface].filter(Boolean))
    .map((u) => `<a class="verify-link" href="${esc(u)}">${esc(u)}</a>`)
    .join(' ');

  const handoff = handoffEligible(entry)
    ? `\n    <button class="handoff-btn" type="button" data-handoff>Open in Claude Desktop</button>`
    : '';

  // INFRA-PROMPTS-SVG-1: door strip (showcase) and the per-card deep-dive scene.
  const illus = doorStrip(entry) + (CARD_SCENES[entry.id] ? CARD_SCENES[entry.id]() : '');

  return `<article class="prompt-card" id="${esc(entry.id)}">
  <div class="card-head">
    <h3 class="card-title">${esc(entry.title)}</h3>
    ${doorways ? `<div class="card-doorways">${doorways}</div>` : ''}
  </div>
  <p class="card-one">${esc(entry.one_line)}</p>${illus ? `\n  ${illus}` : ''}
  ${chips ? `<div class="card-tools">${chips}</div>` : ''}
  ${requires}
  <div class="card-body-wrap">
    <pre class="card-body">${esc(entry.body)}</pre>
    <button class="copy-btn" type="button" data-copy-target="next">Copy prompt</button>
  </div>
  <div class="card-foot">
    ${verify ? `<div class="card-verify"><span class="foot-label">Verify:</span> ${verify}</div>` : ''}
    ${run}${handoff}
  </div>
</article>`;
}

// One-line legend under the chains note; labels come from the lib's
// CHIP_LABELS so the legend and the row chips can never drift apart.
const CHIP_LEGEND = {
  server: 'every step executes on the hosted worker',
  partial: 'some steps execute on the worker, the rest run as browser tools',
  browser: 'the steps run as browser tools on the linked pages',
  reading: 'the worker has no chain under this name today',
};

function renderPage(prompts, chains, toolPages, runnability) {
  const { byGroup, known, extra } = groupSections(prompts);
  const n = prompts.length;

  const runChip = (id) => {
    const state = runnability ? runnability.get(id) : undefined;
    // A row whose id is missing from the map renders stateless here — and
    // validate() reds exactly that shape (the selftest carries the fixture).
    return state ? ` <span class="run-chip run-chip--${state}">${esc(CHIP_LABELS[state])}</span>` : '';
  };

  const chainLegend = `<p class="chain-legend" aria-label="Runnability legend">Every chain carries one runnability label: ${RUN_STATES.map((s) => `<span class="lg"><span class="run-chip run-chip--${s}">${esc(CHIP_LABELS[s])}</span> ${esc(CHIP_LEGEND[s])}</span>`).join('')}</p>`;

  const installStrip = `<section class="install-sec" aria-label="Connect the suite">
  <div class="container">
  <div class="install-strip">
    <span class="install-label">Connect the hosted suite once, then any prompt below runs through your assistant or agent:</span>
    <a class="install-link" href="${esc(installLinks.cursor)}" data-install-link="cursor">Add to Cursor</a>
    <a class="install-link" href="${esc(installLinks.vscode)}" data-install-link="vscode">Add to VS Code</a>
    <button class="install-cmd-btn" type="button" data-copy-text="${esc(CLAUDE_MCP_ADD)}"><code>claude mcp add</code></button>
  </div>
  </div>
</section>`;

  const section = (title, entries) => `<section class="pl-section" aria-label="${esc(title)}">
  <div class="container">
  <div class="sec-label">Prompt library</div>
  <h2 class="sec-heading">${esc(title)} <span class="sec-count">${entries.length}</span></h2>
  <div class="pl-grid">
${entries.map((e) => cardHtml(e, toolPages)).join('\n')}
  </div>
  </div>
</section>`;

  const domainEntries = SECTION_ORDER.slice(3).filter((g) => byGroup.has(g));
  const domainsSection = domainEntries.length ? `<section class="pl-section" aria-label="By domain">
  <div class="container">
  <div class="sec-label">Prompt library</div>
  <h2 class="sec-heading">By domain <span class="sec-count">${domainEntries.reduce((a, g) => a + byGroup.get(g).length, 0)}</span></h2>
${domainEntries.map((g) => `  <div class="domain-group">
    <h3 class="domain-title">${esc(DOMAIN_TITLES[g] ?? g)} <span class="sec-count">${byGroup.get(g).length}</span></h3>
    <div class="pl-grid">
${byGroup.get(g).map((e) => cardHtml(e, toolPages)).join('\n')}
    </div>
  </div>`).join('\n')}
  </div>
</section>` : '';

  const extraSection = extra.length
    ? extra.map((g) => section(DOMAIN_TITLES[g] ?? g, byGroup.get(g))).join('\n')
    : '';

  // Every chain: one-liners from the mcp.html #workflows table, group rows kept
  // as sub-headings. A chain whose composer page is absent renders without a
  // link (never a dead link).
  const chainGrouped = new Map();
  for (const c of chains) {
    const k = c.group ?? 'Chains';
    if (!chainGrouped.has(k)) chainGrouped.set(k, []);
    chainGrouped.get(k).push(c);
  }
  const chainsHtml = chains.length ? `<section class="pl-section" aria-label="Every chain" id="every-chain">
  <div class="container">
  <div class="sec-label">Prompt library</div>
  <h2 class="sec-heading">Every chain <span class="sec-count">${chains.length}</span></h2>
  <p class="chains-note">Each line is one workflow recipe from the suite catalog, generated from the mcp.html workflows table. Ask the hosted worker for any of them by name with <code>build_workflow_links</code>, or open the chain page.</p>
  ${chainLegend}
${[...chainGrouped.entries()].map(([g, list]) => `  <div class="domain-group">
    <h3 class="domain-title">${esc(g)}</h3>
    <ul class="chain-list">
${list.map((c) => `      <li><code class="chain-id">${esc(c.id)}</code> <span class="chain-desc">${esc(c.desc)}</span>${runChip(c.id)}${c.href ? ` <a class="chain-open" href="${esc(c.href)}">Open &#8594;</a>` : ''}</li>`).join('\n')}
    </ul>
  </div>`).join('\n')}
  </div>
</section>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<title>Prompt Library | AINumbers.co: Copy-Paste Prompts for the MCP Suite</title>
<meta name="description" content="Every AINumbers example prompt on one page: showcase, deep dives, everyday, and domain briefs with full copy-paste bodies, tool chips, verify surfaces, and the chain catalog one-liners. The same list the hosted worker serves via prompts/list.">
<meta name="robots" content="index, follow">
<meta name="author" content="Post Oak Labs">
<meta name="ain:category" content="run">
<link rel="canonical" href="https://ainumbers.co/prompts.html">
<meta property="og:type" content="website">
<meta property="og:title" content="Prompt Library | AINumbers.co">
<meta property="og:description" content="Copy-paste prompts for the AINumbers MCP suite: showcase, deep dives, everyday, and domain briefs, each with its tools, verify surface, and full body.">
<meta property="og:url" content="https://ainumbers.co/prompts.html">
<meta property="og:site_name" content="AINumbers.co">
<meta name="twitter:card" content="summary">
<meta name="twitter:site" content="@ainumbers">
<meta name="twitter:title" content="Prompt Library | AINumbers.co">
<meta name="twitter:description" content="Copy-paste prompts for the AINumbers MCP suite, generated from the same SSOT as prompts/list.">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23080E1A'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='Sora,sans-serif' font-weight='600' font-size='13' fill='%2314B8A6'>AI</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#080E1A;--bg-2:#0D1627;--bg-3:#111E35;--bg-4:#162340;
  --border:#1E2F4A;--border-2:#263855;--muted:#3A5270;--body:#6888A8;
  --text:#A8C4DE;--bright:#D4E8F8;--white:#EEF6FD;
  --teal:#14B8A6;--teal-dim:rgba(20,184,166,.12);--teal-lt:#2DD4BF;
  --gold:#D4A847;--gold-dim:rgba(212,168,71,.12);
  --green:#22C55E;--green-dim:rgba(34,197,94,.12);
  --red:#EF4444;--red-dim:rgba(239,68,68,.12);
  --warn:#F59E0B;--purple:#9B72F5;--purple-dim:rgba(155,114,245,.12);
  --radius:6px;--radius-lg:10px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:'Sora',sans-serif;font-weight:300;font-size:15px;line-height:1.7;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{font-family:'DM Serif Display',serif;font-weight:400;line-height:1.2}
a{color:inherit;text-decoration:none}
button{cursor:pointer;font-family:inherit}
code{font-family:'JetBrains Mono',monospace}
.container{max-width:1000px;margin:0 auto;padding:0 2rem}
body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(20,184,166,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(20,184,166,.018) 1px,transparent 1px);background-size:48px 48px;pointer-events:none;z-index:0}

/* Nav (byte-style: start.html) */
nav{padding:0 2rem;height:52px;border-bottom:1px solid var(--border);background:rgba(8,14,26,.92);position:sticky;top:0;z-index:200;backdrop-filter:blur(8px)}
.nav-inner{max-width:1100px;margin:0 auto;height:100%;display:flex;align-items:center;justify-content:space-between}
.logo{display:flex;align-items:center;gap:10px;flex-shrink:0}
.logo-text{display:flex;flex-direction:column;gap:.08rem}
.logo-name{font-family:'JetBrains Mono',monospace;font-size:.88rem;font-weight:600;color:var(--bright);line-height:1}
.logo-ai{color:var(--teal)}.logo-co{color:var(--muted);font-size:.8rem}
.logo-tag{font-family:'JetBrains Mono',monospace;font-size:.5rem;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);line-height:1}
.nav-links{display:flex;align-items:center;gap:20px}
.nav-links a{font-family:'JetBrains Mono',monospace;font-size:.58rem;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);transition:color .2s}
.nav-links a:hover{color:var(--teal-lt)}
.nav-cta{font-family:'JetBrains Mono',monospace;font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;color:var(--bg)!important;background:var(--teal);border:1px solid var(--teal);padding:.3rem .85rem;border-radius:6px;transition:all .2s}
.nav-cta:hover{opacity:.85}

/* Header */
.pl-hero{padding:2.5rem 0 1.75rem;border-bottom:1px solid var(--border);position:relative;z-index:1}
.pl-hero::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--teal),transparent)}
.pl-hero h1{font-size:clamp(1.7rem,3vw,2.4rem);color:var(--white);max-width:680px;margin-bottom:.55rem}
.pl-hero .hero-sub{font-size:.9rem;color:var(--body);max-width:640px;margin-bottom:1rem}
.hero-count{font-family:'JetBrains Mono',monospace;font-size:.66rem;letter-spacing:.1em;color:var(--teal-lt);margin-bottom:1rem}
.pii-notice{background:var(--bg-2);border:1px solid var(--border);border-left:2px solid var(--teal);border-radius:var(--radius);padding:.6rem .9rem;font-size:.76rem;color:var(--body);max-width:720px}
.legend{display:flex;flex-wrap:wrap;gap:.4rem .9rem;margin-top:1rem;font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--muted)}
.legend .lg{display:inline-flex;align-items:center;gap:.35rem}
.legend .lg-k{color:var(--teal-lt);font-weight:500;border:1px solid var(--border-2);border-radius:4px;padding:0 .3rem;background:var(--bg-3)}

/* Sections and cards */
.pl-section{padding:2.5rem 0;border-bottom:1px solid var(--border);position:relative;z-index:1}
.sec-label{font-family:'JetBrains Mono',monospace;font-size:.52rem;letter-spacing:.22em;text-transform:uppercase;color:var(--teal);margin-bottom:.5rem}
.sec-heading{font-size:clamp(1.2rem,2vw,1.6rem);color:var(--white);margin-bottom:1.25rem}
.sec-count{font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--teal-lt);vertical-align:middle;border:1px solid var(--border-2);border-radius:100px;padding:.05rem .5rem;background:var(--teal-dim)}
.domain-group{margin-bottom:2rem}
.domain-title{font-size:1.05rem;color:var(--bright);margin-bottom:.9rem}
.pl-grid{display:grid;grid-template-columns:1fr;gap:.9rem}
.prompt-card{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.1rem 1.2rem;display:flex;flex-direction:column;gap:.55rem;scroll-margin-top:70px}
.prompt-card:hover{border-color:rgba(20,184,166,.35)}
.card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:.6rem}
.card-title{font-family:'Sora',sans-serif;font-size:.95rem;font-weight:500;color:var(--bright);line-height:1.35}
.card-doorways{display:flex;flex-wrap:wrap;gap:.3rem;justify-content:flex-end}
.door-badge{font-family:'JetBrains Mono',monospace;font-size:.5rem;letter-spacing:.08em;text-transform:uppercase;color:var(--teal-lt);border:1px solid var(--border-2);border-radius:100px;padding:.08rem .5rem;background:var(--bg-3);white-space:nowrap}
.card-one{font-size:.82rem;color:var(--body);line-height:1.6}
.card-tools{display:flex;flex-wrap:wrap;gap:.3rem}
.tool-chip{font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--text);border:1px solid var(--border-2);border-radius:4px;padding:.1rem .45rem;background:var(--bg-3);transition:border-color .15s,color .15s}
a.tool-chip:hover{border-color:var(--teal);color:var(--teal-lt)}
.tool-chip.chip-helm{color:var(--gold);border-color:rgba(212,168,71,.35)}
.tool-chip.chip-plain{color:var(--muted);border-style:dashed}
.card-requires{font-family:'JetBrains Mono',monospace;font-size:.58rem;letter-spacing:.06em;color:var(--muted)}
.card-requires .req{color:var(--text);text-decoration:none;border-bottom:1px dotted var(--muted);cursor:help}
.card-body-wrap{position:relative}
.card-body{font-family:'JetBrains Mono',monospace;font-size:.66rem;line-height:1.65;color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:.85rem .95rem;white-space:pre-wrap;word-break:break-word;max-height:22rem;overflow:auto}
.copy-btn{position:absolute;top:.5rem;right:.5rem;font-family:'JetBrains Mono',monospace;font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--teal-lt);background:var(--bg-3);border:1px solid var(--border-2);border-radius:4px;padding:.22rem .55rem;transition:all .15s}
.copy-btn:hover{border-color:var(--teal);color:var(--teal-lt)}
.copy-btn.copied{color:var(--green);border-color:rgba(34,197,94,.5)}
.card-foot{display:flex;flex-direction:column;gap:.3rem;font-family:'JetBrains Mono',monospace;font-size:.58rem}
.foot-label{color:var(--muted);letter-spacing:.1em;text-transform:uppercase}
.verify-link{color:var(--body);border-bottom:1px dotted var(--muted);word-break:break-all}
.verify-link:hover{color:var(--teal-lt);border-bottom-style:solid}
.run-link{color:var(--teal-lt);letter-spacing:.08em;text-transform:uppercase;font-size:.54rem}
.run-link:hover{color:var(--white)}
.handoff-btn{align-self:flex-start;font-family:'JetBrains Mono',monospace;font-size:.54rem;letter-spacing:.08em;text-transform:uppercase;color:var(--teal-lt);background:var(--bg-3);border:1px solid var(--border-2);border-radius:4px;padding:.26rem .6rem;transition:all .15s}
.handoff-btn:hover{border-color:var(--teal);color:var(--white)}

/* Every chain */
.chains-note{font-size:.8rem;color:var(--body);max-width:680px;margin-bottom:1.25rem}
.chain-legend{display:flex;flex-wrap:wrap;gap:.4rem 1rem;font-size:.72rem;color:var(--body);margin:-0.6rem 0 1.25rem}
.chain-legend .lg{display:inline-flex;align-items:center;gap:.4rem}
.chain-list{list-style:none;display:grid;grid-template-columns:1fr;gap:.35rem}
.chain-list li{font-size:.76rem;color:var(--body);line-height:1.55;border-bottom:1px dotted var(--border);padding-bottom:.3rem}
.chain-id{font-size:.66rem;color:var(--teal-lt);background:var(--bg-3);border:1px solid var(--border);border-radius:4px;padding:.05rem .35rem;margin-right:.35rem}
.chain-open{font-family:'JetBrains Mono',monospace;font-size:.56rem;letter-spacing:.08em;text-transform:uppercase;color:var(--teal);margin-left:.4rem;white-space:nowrap}
.chain-open:hover{color:var(--teal-lt)}
.run-chip{font-family:'JetBrains Mono',monospace;font-size:.54rem;letter-spacing:.04em;border:1px solid var(--border-2);border-radius:100px;padding:.06rem .5rem;margin-left:.4rem;white-space:nowrap;background:var(--bg-3);color:var(--text)}
.run-chip--server{color:var(--green);border-color:rgba(34,197,94,.4);background:var(--green-dim)}
.run-chip--partial{color:var(--gold);border-color:rgba(212,168,71,.4);background:var(--gold-dim)}
.run-chip--browser{color:var(--purple);border-color:rgba(155,114,245,.4);background:var(--purple-dim)}
.run-chip--reading{color:var(--muted);border-style:dashed}

/* Connect-first install strip (PROMPTS-BORROW-LABELS-1) */
.install-sec{padding:1.1rem 0;border-bottom:1px solid var(--border);position:relative;z-index:1;background:var(--bg-2)}
.install-strip{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1rem}
.install-label{font-size:.78rem;color:var(--body)}
.install-link{font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:var(--teal-lt);border:1px solid var(--border-2);border-radius:6px;padding:.32rem .8rem;background:var(--bg-3);transition:all .15s}
.install-link:hover{border-color:var(--teal);color:var(--white)}
.install-cmd-btn{font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--text);background:var(--bg-3);border:1px solid var(--border-2);border-radius:6px;padding:.32rem .8rem;transition:all .15s}
.install-cmd-btn:hover{border-color:var(--teal);color:var(--teal-lt)}
.install-cmd-btn.copied,.handoff-btn.copied{color:var(--green);border-color:rgba(34,197,94,.5)}

/* ROOT-FOOTER-CSS:START (generated by scripts/gen-root-chrome.mjs — do not hand-edit) */
${ROOT_FOOTER_CSS}
/* ROOT-FOOTER-CSS:END */
@media(max-width:600px){.nav-links a:not(.nav-cta){display:none}.card-head{flex-direction:column}}

/* INFRA-PROMPTS-SVG-1 scenes */
${SCENE_KIT_CSS}
.pl-hero .sk-fig{margin:1.4rem 0 0}
.prompt-card .sk-fig{margin:.3rem 0 .4rem}
.door-strip .sk-scroll{background:var(--bg);border-color:var(--border);max-width:560px}
.door-strip-label{font-family:'JetBrains Mono',monospace;font-size:.52rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:.3rem}
</style>
<script>${SCENE_KIT_HEAD_JS}</script>
</head>
<body>

<nav aria-label="Site navigation">
  <div class="nav-inner">
    <a href="index.html" class="logo" aria-label="AINumbers.co home">
      <svg width="28" height="28" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="48" height="48" rx="9" fill="var(--bg-2)"/><rect x="1" y="1" width="46" height="46" rx="8" fill="none" stroke="var(--border)" stroke-width="1"/><rect x="9" y="9" width="8" height="8" rx="1.5" fill="var(--teal)" opacity="1"/><rect x="20" y="9" width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".45"/><rect x="31" y="9" width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".15"/><rect x="9" y="20" width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".6"/><rect x="20" y="20" width="8" height="8" rx="1.5" fill="var(--gold)" opacity=".9"/><rect x="31" y="20" width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".3"/><rect x="9" y="31" width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".2"/><rect x="20" y="31" width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".35"/><rect x="31" y="31" width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".7"/></svg>
      <div class="logo-text">
        <div class="logo-name"><span class="logo-ai">AI</span>Numbers<span class="logo-co">.co</span></div>
        <div class="logo-tag">Fintech Intelligence Suite</div>
      </div>
    </a>
    <div class="nav-links">
      <a href="about.html">About</a>
      <a href="start.html" class="nav-cta">Start</a>
    </div>
  </div>
</nav>

<main>

<section class="pl-hero">
  <div class="container">
    <div class="sec-label">Prompt library</div>
    <h1>Copy-paste prompts for the AINumbers suite</h1>
    <p class="hero-sub">This page lists every example prompt in the estate. It is generated from <a href="./mcp/showcase-prompts.json">mcp/showcase-prompts.json</a>, the same file the hosted worker serves at <code>prompts/list</code>. Copy a body into any MCP-aware assistant, or hand it to your agent with <a href="https://mcp.ainumbers.co/mcp">mcp.ainumbers.co/mcp</a>. Each card names the tools it calls and what the run requires, and links to where you can check the result.</p>
    <p class="hero-count"><span data-count="showcase_prompts">${n}</span> prompts &middot; ${chains.length} chain recipes</p>
    <div class="pii-notice">Zero PII, client-side only: this page makes no network calls and stores nothing. Prompt bodies use synthetic inputs. Run results are verifiable: every tool returns an execution hash you can check with <code>verify_execution_hash</code>.</div>
    <div class="legend" aria-label="Requires legend">
      <span class="lg"><span class="lg-k">W</span> ${esc(REQUIRES_LEGEND.W)}</span>
      <span class="lg"><span class="lg-k">R</span> ${esc(REQUIRES_LEGEND.R)}</span>
      <span class="lg"><span class="lg-k">H</span> ${esc(REQUIRES_LEGEND.H)}</span>
      <span class="lg"><span class="lg-k">L</span> ${esc(REQUIRES_LEGEND.L)}</span>
      <span class="lg"><span class="lg-k">A</span> ${esc(REQUIRES_LEGEND.A)}</span>
      <span class="lg"><span class="lg-k">Z</span> ${esc(REQUIRES_LEGEND.Z)}</span>
    </div>
${anatomyScene()}
  </div>
</section>

${installStrip}

${SECTION_ORDER.slice(0, 3).filter((g) => byGroup.has(g)).map((g) => section(SECTION_TITLES[g], byGroup.get(g))).join('\n\n')}
${domainsSection ? '\n\n' + domainsSection : ''}
${extraSection ? '\n\n' + extraSection : ''}
${chainsHtml ? '\n\n' + chainsHtml : ''}

</main>

<!--ROOT-FOOTER:START (generated by scripts/gen-root-chrome.mjs — do not hand-edit)-->
${ROOT_FOOTER}
<!--ROOT-FOOTER:END-->

<script>
(function () {
  // Same constants the generator used to decide eligibility (see above in
  // scripts/gen-prompts-page.mjs) — the URL itself is built here, on click.
  var HANDOFF_PREFIX = 'Connect https://mcp.ainumbers.co/mcp first; if its tools are unavailable, stop and say so.\\n\\n';
  function flash(btn, label) {
    if (!btn.getAttribute('data-label')) btn.setAttribute('data-label', btn.textContent);
    btn.classList.add('copied');
    btn.textContent = label;
    setTimeout(function () { btn.classList.remove('copied'); btn.textContent = btn.getAttribute('data-label'); }, 1600);
  }
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target : null;
    if (!el) return;
    var ct = el.closest('[data-copy-text]');
    if (ct) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ct.getAttribute('data-copy-text')).then(function () { flash(ct, 'Copied'); }, function () {});
      }
      return;
    }
    var hbtn = el.closest('.handoff-btn');
    if (hbtn) {
      var hcard = hbtn.closest('.prompt-card');
      var hpre = hcard ? hcard.querySelector('.card-body') : null;
      if (hpre) {
        // Built synchronously on click; documented claude:// form only.
        flash(hbtn, 'Opening');
        window.location.href = 'claude://claude.ai/new?q=' + encodeURIComponent(HANDOFF_PREFIX + hpre.textContent);
      }
      return;
    }
    var btn = el.closest('.copy-btn');
    if (!btn) return;
    var card = btn.closest('.prompt-card');
    if (!card) return;
    var pre = card.querySelector('.card-body');
    if (!pre) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pre.textContent).then(function () { flash(btn, 'Copied'); }, function () {});
    }
  });
})();
</script>

</body>
</html>
`;
}

// ── Modes ────────────────────────────────────────────────────────────────────

function build() {
  const prompts = loadPrompts();
  const graph = loadChainGraph(REPO);
  const toolPages = loadToolPages(graph);
  const chains = loadChains();
  const runnability = classifyChainRows(chains, graph);
  return { html: renderPage(prompts, chains, toolPages, runnability), prompts, chains, runnability };
}

// PROMPTS-BORROW-LABELS-1: the repo-level gates read the COMMITTED
// prompts.html — which on a PR is still the pre-change bytes (main
// regenerates post-merge). So the generator holds its own RENDERED output to
// the same standard pre-write: the copy-hallmark battery (via the exported
// hallmarkFindings(), the very function the repo gate consumes) against this
// file's scripts/copy-hallmarks-baseline.json ratchet.
const HALLMARK_BASELINE = existsSync(resolve(HERE, 'copy-hallmarks-baseline.json'))
  ? JSON.parse(readFileSync(resolve(HERE, 'copy-hallmarks-baseline.json'), 'utf8'))
  : {};

function hallmarkErrors(html) {
  const f = hallmarkFindings(html);
  const b = HALLMARK_BASELINE['prompts.html'] || {};
  const errs = [];
  const gt = (v, cap, label, detail) => {
    if (v > cap) errs.push(`copy-hallmark ${label}: ${v} (cap ${cap})${detail ? ' — ' + detail : ''}`);
  };
  gt(f.emdash, b.emdash || 0, 'em-dash in visible text');
  gt(f.jargon.length, b.jargon || 0, 'build jargon', f.jargon.join('; '));
  gt(f.bold, b.bold || 0, 'bold/strong in visible text');
  gt(f.insider.length, b.insider || 0, 'insider-register', f.insider.join('; '));
  gt(f.aiVocab.length, b.aiVocab || 0, 'AI-vocabulary', f.aiVocab.join('; '));
  gt(f.absolutes.length, b.absolutes || 0, 'absolute/certainty-claim', f.absolutes.join('; '));
  gt(f.panel.length, b.panel || 0, 'SCOPE-panel negation-wall', f.panel.join('; '));
  gt(f.fragHead.length, b.fragHead || 0, 'comma-splice fragment heading', f.fragHead.join('; '));
  gt(f.notX, b.notX != null ? b.notX : DEFAULT_NOTX_CAP, '",-not X" defensive-negation');
  for (const [k, v] of Object.entries(f.overuse)) {
    gt(v, (b.overuse && b.overuse[k] != null) ? b.overuse[k] : OVERUSE_CAP, `"${k}" overuse`);
  }
  if (f.doubleEscaped) errs.push(`copy-hallmark double-escaped HTML entity ×${f.doubleEscaped}`);
  if (f.hallmarks.length) errs.push(`ANTI-AI-TELL: ${f.hallmarks.join('; ')}`);
  if (f.twotoneHP) errs.push(`HIGH-PRECISION twotone ×${f.twotoneHP}`);
  if (f.cosignVocab.length) errs.push(`counter_signed_receipt vocabulary: ${f.cosignVocab.join('; ')}`);
  return errs;
}

// Exactly one state per "Every chain" row, and it must be the computed one:
// the chip text must be the canonical CHIP_LABELS wording (the ", not" chip
// fixture reds here), the state one of RUN_STATES, and the rendered state
// equal classifyChainRows()'s verdict for that id (render/derivation drift).
function chainRowErrors(html, chains, runnability) {
  if (!chains.length) return [];
  const errs = [];
  const start = html.indexOf('id="every-chain"');
  if (start === -1) return [`Every chain section (id="every-chain") not found`];
  const end = html.indexOf('</section>', start);
  const sec = html.slice(start, end);
  const liRe = /<li>[\s\S]*?<\/li>/g;
  const chipRe = /<span class="run-chip run-chip--(\w+)">([^<]*)<\/span>/g;
  const idRe = /<code class="chain-id">([^<]*)<\/code>/;
  let m;
  let rows = 0;
  while ((m = liRe.exec(sec)) !== null) {
    rows++;
    const row = m[0];
    const states = [...row.matchAll(chipRe)];
    if (states.length !== 1) {
      errs.push(`chain row ${rows} (${(idRe.exec(row) || ['', '?'])[1]}): ${states.length} runnability chips, exactly one required`);
      continue;
    }
    const state = states[0][1];
    const id = (idRe.exec(row) || [])[1];
    if (!RUN_STATES.includes(state)) {
      errs.push(`chain row ${rows} (${id}): unknown runnability state "${state}"`);
    } else if (CHIP_LABELS[state] !== states[0][2]) {
      errs.push(`chain row ${rows} (${id}): chip text "${states[0][2]}" is not the canonical label for ${state} ("${CHIP_LABELS[state]}")`);
    } else if (runnability && runnability.get(id) !== state) {
      errs.push(`chain row ${rows} (${id}): rendered state ${state} != computed state ${runnability.get(id)}`);
    }
  }
  if (rows !== chains.length) errs.push(`chain row count ${rows} != #workflows table rows ${chains.length}`);
  return errs;
}

function validate(html, prompts, chains, runnability) {
  const errs = [];
  const cards = (html.match(/<article class="prompt-card"/g) || []).length;
  if (cards !== prompts.length) errs.push(`card count ${cards} != JSON array length ${prompts.length}`);
  const sentinel = new RegExp(`data-count="showcase_prompts">${prompts.length}<`);
  if (!sentinel.test(html)) errs.push(`count sentinel data-count="showcase_prompts" != ${prompts.length} or missing`);
  for (const id of prompts.map((p) => p.id)) {
    if (!html.includes(`id="${id}"`)) errs.push(`entry ${id} has no card anchor`);
  }
  // claude:, cursor: and vscode: are opaque launch schemes (the documented
  // Claude Desktop handoff + the MCP-INSTALL-LINKS-1 one-click installs),
  // mirroring scripts/dead-link-check.mjs's skip set; anything else must
  // resolve as a file.
  for (const m of html.matchAll(/href="(?!https?:|#|data:|claude:|cursor:|vscode:)([^"]+)"/g)) {
    const target = m[1].split('#')[0];
    if (target && !existsSync(resolve(REPO, target))) errs.push(`dead internal link target: ${m[1]}`);
  }
  errs.push(...chainRowErrors(html, chains ?? [], runnability));
  errs.push(...hallmarkErrors(html));
  return errs;
}

if (SELFTEST) {
  // RED mutation battery, entirely in memory: every RED mutation must fail
  // validate() (the --check assertions), and every GREEN control must pass
  // it, proving the gate is live without being over-broad.
  const { html, prompts, chains, runnability } = build();
  const misses = [];
  const check = (mutated, mutatedPrompts) => validate(mutated.html ?? mutated, mutatedPrompts ?? prompts, chains, runnability);
  const expectRed = (label, mutate) => {
    const errs = check(mutate(html, JSON.parse(JSON.stringify(prompts))));
    if (!errs.length) misses.push(`RED mutation "${label}" did NOT go red`);
    else console.log(`  selftest RED ok: ${label} -> ${errs[0]}`);
  };
  const expectGreen = (label, mutate) => {
    const errs = check(mutate(html, JSON.parse(JSON.stringify(prompts))));
    if (errs.length) misses.push(`GREEN control "${label}" went red: ${errs[0]}`);
    else console.log(`  selftest GREEN ok: ${label}`);
  };
  expectRed('count drift (page renders N-1 cards)', (h, p) => {
    p.length = p.length - 1;
    return renderPage(p, loadChains(), loadToolPages(loadChainGraph(REPO)), runnability);
  });
  expectRed('sentinel drift (hardcoded stale count)', (h) =>
    h.replace(new RegExp(`data-count="showcase_prompts">${prompts.length}<`), 'data-count="showcase_prompts">999<'));
  expectRed('dead internal link', (h) => h.replace('href="helm.html"', 'href="helm-missing.html"'));
  expectRed('dropped card anchor', (h) => h.replace(new RegExp(`id="${prompts[0].id}"`), 'id="removed"'));
  // PROMPTS-BORROW-LABELS-1 fixtures: a bogus scheme stays dead; every chain
  // row carries exactly one canonical state; chip wording holds the line
  // against the ", not" negation reflex (CONTRACT §1.4); the documented
  // claude:// deeplink is skipped, never refused.
  expectRed('bogus link scheme stays dead', (h) => h.replace('href="about.html"', 'href="wibble://nope/x"'));
  // Fixtures target a ROW chip (the first chip in the document is the legend's);
  // a row stripped of its chip, and a row chip drifting off the canonical
  // wording (the ", not" negation reflex), must both go red.
  expectRed('chain row with no runnability state', (h) =>
    h.replace(/(<span class="chain-desc">[^<]*<\/span>) <span class="run-chip run-chip--\w+">[^<]*<\/span>/, '$1'));
  expectRed('", not" chip wording', (h) =>
    h.replace(' <span class="run-chip run-chip--partial">Runs in part</span>', ' <span class="run-chip run-chip--partial">Runs in part, not on the worker</span>'));
  expectGreen('documented claude:// deeplink is skipped by the link check', (h) =>
    h.replace('href="about.html"', 'href="claude://claude.ai/new?q=smoke"'));
  if (misses.length) {
    console.error('selftest FAILED:');
    for (const x of misses) console.error('  ' + x);
    process.exit(1);
  }
  console.log('selftest: all mutations went RED, all controls stayed GREEN.');
  process.exit(0);
}

const { html, prompts, chains, runnability } = build();
const errs = validate(html, prompts, chains, runnability);
if (errs.length) {
  console.error(`gen-prompts-page: REFUSING to write, ${errs.length} problem(s):`);
  for (const e of errs) console.error('  ' + e);
  process.exit(1);
}

if (CHECK) {
  const onDisk = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
  if (onDisk !== html) {
    console.error(`gen-prompts-page --check: STALE. ${OUT_REL} on disk does not match the regeneration from its sources (mcp/showcase-prompts.json, mcp.html #workflows, chaingraph.json). Run: node scripts/gen-prompts-page.mjs`);
    if (!onDisk) console.error('  (prompts.html is absent on disk)');
    process.exit(1);
  }
  console.log(`gen-prompts-page --check: byte-exact. ${prompts.length} prompt cards (JSON array length ${prompts.length}), ${chains.length} chain one-liners each carrying exactly one runnability state (server ${[...runnability.values()].filter((s) => s === 'server').length} / partial ${[...runnability.values()].filter((s) => s === 'partial').length} / browser ${[...runnability.values()].filter((s) => s === 'browser').length} / reading ${[...runnability.values()].filter((s) => s === 'reading').length}), count sentinel data-count="showcase_prompts"=${prompts.length}, all internal links resolve.`);
  process.exit(0);
}

if (existsSync(OUT) && readFileSync(OUT, 'utf8') === html) {
  console.log(`gen-prompts-page: already byte-exact, no write (${prompts.length} cards, ${chains.length} chains).`);
  process.exit(0);
}
writeFileSync(OUT, html);
console.log(`gen-prompts-page: wrote ${OUT_REL} (${prompts.length} prompt cards, ${chains.length} chain one-liners: ${[...runnability.values()].filter((s) => s === 'server').length} server / ${[...runnability.values()].filter((s) => s === 'partial').length} partial / ${[...runnability.values()].filter((s) => s === 'browser').length} browser / ${[...runnability.values()].filter((s) => s === 'reading').length} reading).`);
