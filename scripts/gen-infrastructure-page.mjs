#!/usr/bin/env node
/**
 * scripts/gen-infrastructure-page.mjs — INFRA-PAGE-1 (INFRA-MAP-COPY-1 rework,
 * 2026-09-21 humanize pass).
 *
 * Generates repo/infrastructure.html from data/infra-registry.json (the
 * derived registry written by gen-infra-registry.mjs — never hand-listed):
 * canonical chrome copied byte-style from start.html (head CSS, nav, canonical
 * footer), one section per `ain:category` enum value in enum order, a card per
 * registry entry (title, description, Open link, fact chips), a
 * data-count="infra_pages" sentinel, and JSON-LD CollectionPage whose
 * mainEntity is an ItemList of the cards this page renders.
 *
 * What the humanize pass changed (why this file no longer renders the
 * registry verbatim):
 *   · GUIDE ROWS SPLIT OUT. 130 of the registry rows are domain hubs and
 *     integration guides; rendering them inline buried the seven working
 *     sections under a two-hundred-card wall. They render on
 *     hub-for-hubs.html (gen-hub-for-hubs-page.mjs, same registry), and this
 *     page carries a pointer section (id="hubs") with three start-here cards
 *     so the split costs one click, not a dead end.
 *   · DISPLAY COPY. Titles/descriptions render through scripts/lib/infra-map.mjs:
 *     authored overrides (data/infra-copy-overrides.json) for the rows whose
 *     source meta is truncated or empty, deterministic suffix cleanup for the
 *     SEO-stuffed titles, and a hard error if any card would render without a
 *     description. The registry file itself is never mutated.
 *   · HUMAN NAVIGATION. A persona-bar jump strip under the hero (anchor to
 *     each section), section counts computed at render (this page is derived,
 *     so render-time numbers regenerate with the registry — they are not
 *     hand-typed), and section headings that say what the section is for.
 *
 * Deterministic: pure function of the registry + overrides + chrome sources
 * (no wall-clock), so --check byte-compares and the idempotency proof is a
 * two-run byte comparison.
 *
 * Usage:
 *   node scripts/gen-infrastructure-page.mjs           # write
 *   node scripts/gen-infrastructure-page.mjs --check   # byte-compare, exit 1 on drift
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES } from './gen-infra-registry.mjs';
import {
  REPO, readRegistry, loadOverrides, validateOverrides,
  renderCard, renderTitle, esc, jumpBar, readStartChrome,
} from './lib/infra-map.mjs';
import { SCENE_KIT_CSS, SCENE_KIT_HEAD_JS, sceneFigure, icon } from './lib/scene-kit.mjs';

const CHECK = process.argv.includes('--check');
const OUT_REL = 'infrastructure.html';

const CATEGORY_LABELS = {
  run: 'Run', verify: 'Verify', anchor: 'Anchor', convert: 'Convert',
  agents: 'Agents', learn: 'Learn', helm: 'Helm', guide: 'Guide',
};
// Section headings say what the section is for, in plain sentences. The old
// rule-of-three headings ("Execute tools, workflows, and agent automations")
// were exactly the catalog copy this page exists to replace. No commas in a
// heading (Tim, 2026-09-26: comma lists and comma fragments read as AI tells).
const CATEGORY_BLURBS = {
  run: 'Tools and workflows you can run',
  verify: 'Where to check an artifact or a conformance claim',
  anchor: 'Timestamps and signing keys',
  convert: 'Turning documents into verifiable artifacts',
  agents: 'How agents connect over MCP and WebMCP',
  learn: 'Explainers and the specification',
  helm: 'The air-gapped Helm control plane',
  guide: 'Domain integration guides and hubs',
};
const FACT_LABELS = {
  webmcp: 'WebMCP', deeplink: 'Deep-link', policy_mandate_export: 'Mandate export', jsonld: 'JSON-LD',
};

// The start-here cards in the hubs pointer section. Registry paths of GUIDE
// rows, so every card below links a real hub; the first card points at the
// full split-out catalog. Keep this list short — the point of the split is
// that this page stops being the hub catalog.
const HUB_STARTERS = [
  'guides/agentic-commerce-mcp-hub.html',
  'guides/aml-kyc-compliance-hub.html',
  'guides/core-infrastructure-hub.html',
];

// ── Animated scenes (INFRA-PROMPTS-SVG-1, scripts/lib/scene-kit.mjs) ─────────
// Every fact drawn below is quoted from the pages the section lists: the
// verification ladder from SPEC §4/§16/§17/§18/§20, the conversion flow from
// convert.html (art-189/190 → art-191 → art-192), the Helm loop from
// helm-technical-design.html. Counts on the map come from the registry at
// render time, like the section labels, so they regenerate with it.

const pageCount = (k) => `${k} page${k === 1 ? '' : 's'}`;

// One map station: a linked card that jumps to its section.
function station({ href, x, y, w = 200, h, stroke, cls, label, count, title, sub, d }) {
  return `    <a href="#${href}" aria-label="${esc(label)}, ${esc(count)}: jump to the section">
      <g class="sk-pop" style="--d:${d}s">
        <rect class="sk-hit" x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="var(--bg-3)" stroke="${stroke}" stroke-width="1.4"/>
        <text x="${x + 14}" y="${y + 22}" class="u xs ${cls}">${esc(label)}</text>
        <text x="${x + w - 14}" y="${y + 22}" text-anchor="end" class="m xs mu">${esc(count)}</text>
        <text x="${x + 14}" y="${y + h - 30}" class="b sm">${esc(title)}</text>
        <text x="${x + 14}" y="${y + h - 13}" class="s xs">${esc(sub)}</text>
      </g>
    </a>`;
}

function mapScene(sections, guideCount) {
  const n = Object.fromEntries(sections.map((s) => [s.cat, s.rows.length]));
  const c = (cat) => pageCount(n[cat] ?? 0);
  const body = [
    `    <text x="20" y="40" class="u xs t">How the sections fit</text>`,
    `    <text x="20" y="60" class="s xs">Select a station to jump to it</text>`,
    // Main row: a file becomes a receipt, a kernel computes, anyone checks, authorities timestamp.
    station({ href: 'convert', x: 20, y: 124, h: 86, stroke: 'var(--purple)', cls: 'p', label: 'Convert', count: c('convert'), title: 'A file becomes a receipt', sub: 'both files hashed and bound', d: 0.1 }),
    station({ href: 'run', x: 260, y: 124, h: 86, stroke: 'var(--teal)', cls: 't', label: 'Run', count: c('run'), title: 'A kernel computes a hash', sub: 'tools and workflows you can run', d: 0.3 }),
    station({ href: 'verify', x: 500, y: 124, h: 86, stroke: 'var(--green)', cls: 'ok', label: 'Verify', count: c('verify'), title: 'Anyone can recompute it', sub: 'checks you can run yourself', d: 0.5 }),
    station({ href: 'anchor', x: 740, y: 124, h: 86, stroke: 'var(--gold)', cls: 'g', label: 'Anchor', count: c('anchor'), title: 'Authorities timestamp it', sub: 'timestamps and signing keys', d: 0.7 }),
    // Ways in and ways to read.
    station({ href: 'agents', x: 260, y: 12, h: 76, stroke: 'var(--purple)', cls: 'p', label: 'Agents', count: c('agents'), title: 'Agents call the kernels', sub: 'hosted MCP and WebMCP', d: 0.9 }),
    station({ href: 'helm', x: 260, y: 246, h: 76, stroke: 'var(--gold)', cls: 'g', label: 'Helm', count: c('helm'), title: 'Runs on your own machine', sub: 'bundles that verify offline', d: 1.1 }),
    station({ href: 'learn', x: 740, y: 12, h: 76, stroke: 'var(--border-2)', cls: 's', label: 'Learn', count: c('learn'), title: 'How each piece works', sub: 'explainers and the spec', d: 1.3 }),
    station({ href: 'hubs', x: 740, y: 246, h: 76, stroke: 'var(--border-2)', cls: 's', label: 'Guides', count: pageCount(guideCount), title: 'Hubs and guides by desk', sub: 'on their own map', d: 1.5 }),
    // Arrows along the main row, then Agents into Run and Helm beside it.
    `    <path class="sk-draw" pathLength="100" d="M220 167 H252" stroke="var(--muted)" stroke-width="1.6" fill="none" style="--d:.25s"/>${icon.arrowRight(259, 167)}`,
    `    <path class="sk-draw" pathLength="100" d="M460 167 H492" stroke="var(--muted)" stroke-width="1.6" fill="none" style="--d:.45s"/>${icon.arrowRight(499, 167)}`,
    `    <path class="sk-draw" pathLength="100" d="M700 167 H732" stroke="var(--muted)" stroke-width="1.6" fill="none" style="--d:.65s"/>${icon.arrowRight(739, 167)}`,
    `    <path class="sk-draw" pathLength="100" d="M360 88 V116" stroke="var(--muted)" stroke-width="1.6" fill="none" style="--d:.95s"/>${icon.arrowDown(360, 123)}`,
    `    <path d="M360 212 V244" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="4 4" fill="none"/>`,
    `    <text x="372" y="232" class="s xs sk-fade" style="--d:1.2s">same kernels</text>`,
    // One execution hash carried from Run over Verify into Anchor.
    `    <g class="sk-fade" style="--d:1.6s">${icon.hashPill(470, 93, 'sha256:9f2c…', 130)}</g>`,
    `    <path d="M604 106 H836 V116" stroke="var(--gold)" stroke-opacity=".55" stroke-width="1.3" stroke-dasharray="3 5" fill="none"/>${icon.arrowDown(836, 123, 'var(--gold)')}`,
    `    <circle cx="604" cy="106" r="4" fill="var(--gold)" class="sk-travel" style="--tx:232px;--dur:2.8s;--d:2s"/>`,
  ].join('\n');
  return sceneFigure({
    id: 'map-scene',
    viewBox: '0 0 960 330',
    minWidth: 660,
    role: 'group',
    title: 'How the sections fit together',
    desc: 'Four stations in a row: Convert, where a file becomes a receipt; Run, where a kernel computes a hash; Verify, where anyone can recompute it; and Anchor, where timestamp authorities sign it. Agents enter Run from above, Helm runs the same kernels on your own machine below it, and Learn and the hubs map sit at the right. A hash travels from Run toward Anchor. Each station links to its section.',
    body,
    caption: 'A run produces an execution hash that a verifier can recompute and a timestamp authority can sign. Select a station to jump to its pages.',
  });
}

function verifyScene() {
  // Rungs top to bottom; card fields line up with them.
  const rungs = [
    { y: 77, label: 'Check a timestamp over its receipt root', ref: 'SPEC §20', field: ['anchor binding', ' via session root', 's'] },
    { y: 121, label: 'Verify the 256-byte Groth16 seal', ref: 'SPEC §18', field: ['compute_proof.seal', '', ''] },
    { y: 165, label: 'Match the kernel digest', ref: 'SPEC §17', field: ['kernel_digest', ' sha256:…', 'g'] },
    { y: 209, label: 'Check the eddsa-jcs-2022 signature', ref: 'SPEC §16', field: ['audit_signature.proof', '', ''] },
    { y: 253, label: 'Recompute the execution hash', ref: 'SPEC §4', field: ['execution_hash', ' sha256:…', 'g'] },
  ];
  const body = [
    `    <g class="sk-fade" style="--d:.1s"><rect x="24" y="30" width="310" height="246" rx="12" fill="var(--bg-3)" stroke="var(--border-2)" stroke-width="1.3"/><text x="40" y="54" class="s xs">an OpenChainGraph artifact</text></g>`,
    `    <path d="M404 44 V284 M936 44 V284" stroke="var(--border-2)" stroke-width="2" fill="none"/>`,
    ...rungs.map((r, i) => {
      const climb = (rungs.length - 1 - i) * 0.4; // bottom rung first
      const [name, val, cls] = r.field;
      return [
        `    <text x="40" y="${r.y + 4}" class="m xs t sk-fade" style="--d:${(0.2 + climb / 2).toFixed(2)}s">${esc(name)}${val ? `<tspan class="${cls}">${esc(val)}</tspan>` : ''}</text>`,
        `    <g class="sk-fade" style="--d:.3s"><rect x="410" y="${r.y - 17}" width="520" height="34" rx="8" fill="var(--bg-3)" stroke="var(--border)" stroke-width="1.2"/><text x="452" y="${r.y + 4}" class="b sm">${esc(r.label)}</text><text x="914" y="${r.y + 4}" text-anchor="end" class="m xs mu">${esc(r.ref)}</text></g>`,
        `    <path class="sk-draw" pathLength="100" d="M334 ${r.y} H410" stroke="var(--muted)" stroke-width="1.3" fill="none" style="--d:${(0.6 + climb).toFixed(2)}s"/>`,
        `    <g class="sk-pop" style="--d:${(0.8 + climb).toFixed(2)}s">${icon.check(431, r.y, 10)}</g>`,
      ].join('\n');
    }),
  ].join('\n');
  return sceneFigure({
    id: 'verify-scene',
    viewBox: '0 0 960 300',
    minWidth: 700,
    title: 'Five checks an artifact supports',
    desc: 'An artifact card on the left lists execution_hash, audit_signature.proof, kernel_digest, compute_proof.seal and an anchor binding. Each field connects to a rung of a ladder on the right: recompute the execution hash (SPEC §4), check the eddsa-jcs-2022 signature (§16), match the kernel digest (§17), verify the 256-byte Groth16 seal (§18), and check a timestamp over the receipt root (§20). Check marks appear from the bottom rung up.',
    body,
    caption: 'An OpenChainGraph artifact supports five checks. The <a href="verification-desk.html">Verification Desk</a> checks hashes, signatures and seals in your browser, and the <a href="ledger/index.html">Ledger</a> in the Anchor section adds the timestamp.',
  });
}

function convertScene() {
  const body = [
    `    <rect x="12" y="14" width="936" height="232" rx="14" fill="none" stroke="var(--teal)" stroke-width="1.3" stroke-dasharray="7 6"/>`,
    `    <text x="30" y="38" class="t xs">everything below runs in your browser tab</text>`,
    `    <g class="sk-fade" style="--d:.1s">${icon.doc(44, 62, 56, 70)}<text x="72" y="152" text-anchor="middle" class="s sm">source file</text><text x="72" y="172" text-anchor="middle" class="m xs g">input_sha256</text></g>`,
    `    <path class="sk-draw" pathLength="100" d="M106 97 H144" stroke="var(--muted)" stroke-width="1.6" fill="none" style="--d:.35s"/>${icon.arrowRight(151, 97)}`,
    `    <g class="sk-pop" style="--d:.5s"><rect x="154" y="66" width="170" height="62" rx="10" fill="var(--bg-3)" stroke="var(--purple)" stroke-width="1.4"/><text x="239" y="92" text-anchor="middle" class="b sm">converter</text><text x="239" y="112" text-anchor="middle" class="m xs t">art-189 or art-190</text></g>`,
    `    <path class="sk-draw" pathLength="100" d="M324 97 H362" stroke="var(--muted)" stroke-width="1.6" fill="none" style="--d:.75s"/>${icon.arrowRight(369, 97)}`,
    `    <g class="sk-fade" style="--d:.9s">${icon.doc(372, 62, 56, 70)}<text x="400" y="152" text-anchor="middle" class="s sm">converted file</text><text x="400" y="172" text-anchor="middle" class="m xs g">output_sha256</text></g>`,
    `    <path class="sk-draw" pathLength="100" d="M72 180 V224 H640 V200" stroke="var(--gold)" stroke-opacity=".7" stroke-width="1.3" fill="none" style="--d:1.1s"/>`,
    `    <path class="sk-draw" pathLength="100" d="M400 180 V212 H580 V200" stroke="var(--gold)" stroke-opacity=".7" stroke-width="1.3" fill="none" style="--d:1.2s"/>`,
    `    <g class="sk-pop" style="--d:1.5s"><rect x="500" y="48" width="230" height="152" rx="12" fill="var(--bg-3)" stroke="var(--gold)" stroke-width="1.4"/><text x="516" y="72" class="b sm">receipt builder</text><text x="714" y="72" text-anchor="end" class="m xs t">art-191</text><text x="516" y="96" class="s xs">input digest</text><text x="516" y="114" class="s xs">converter identity</text><text x="516" y="132" class="s xs">parameters</text><text x="516" y="150" class="s xs">output digest</text><path d="M516 162 H714" stroke="var(--border-2)" stroke-width="1"/><text x="516" y="184" class="m xs g">binding_sha256</text></g>`,
    `    <path class="sk-draw" pathLength="100" d="M730 115 H770" stroke="var(--muted)" stroke-width="1.6" fill="none" style="--d:1.9s"/>${icon.arrowRight(777, 115)}`,
    `    <g class="sk-pop" style="--d:2.1s"><rect x="780" y="66" width="152" height="96" rx="10" fill="var(--bg-3)" stroke="var(--green)" stroke-width="1.4"/><text x="856" y="90" text-anchor="middle" class="b sm">verifier</text><text x="856" y="108" text-anchor="middle" class="m xs t">art-192</text><text x="856" y="128" text-anchor="middle" class="s xs">re-hashes both files</text><text x="856" y="146" text-anchor="middle" class="s xs">recomputes the binding</text></g>`,
    `    <g class="sk-pop" style="--d:2.5s">${icon.check(836, 190, 11)}<text x="854" y="195" class="m sm ok">PASS</text></g>`,
  ].join('\n');
  return sceneFigure({
    id: 'convert-scene',
    viewBox: '0 0 960 260',
    minWidth: 700,
    title: 'A conversion bound into a receipt',
    desc: 'Inside a dashed boundary marked as the browser tab, a source file passes through a converter (art-189 or art-190) and becomes a converted file; both files are hashed. The input and output hashes flow into a receipt builder (art-191) that binds the input digest, converter identity, parameters and output digest into a binding hash. A verifier (art-192) re-hashes both files, recomputes the binding and shows PASS.',
    body,
    caption: 'This is the document-conversion-verification workflow. A converter hashes both files in the tab and the receipt builder binds the two digests to the converter\'s identity and parameters. The verifier re-hashes the files and recomputes the binding.',
  });
}

function agentsScene() {
  const doors = [
    { y: 18, title: 'WebMCP', sub: 'the page registers its tool', subCls: 's' },
    { y: 104, title: 'Hosted MCP', sub: 'mcp.ainumbers.co/mcp', subCls: 'm t' },
    { y: 190, title: 'helmd', sub: '127.0.0.1 on your machine', subCls: 's' },
  ];
  const body = [
    `    <g class="sk-fade" style="--d:.1s">${icon.agent(64, 135)}<text x="64" y="172" text-anchor="middle" class="s sm">your agent</text></g>`,
    ...doors.map((dr, i) => {
      const cy = dr.y + 31;
      return [
        `    <path class="sk-draw" pathLength="100" d="M86 135 C132 135, 132 ${cy}, 180 ${cy}" stroke="var(--purple)" stroke-opacity=".7" stroke-width="1.4" fill="none" style="--d:${(0.3 + i * 0.15).toFixed(2)}s"/>`,
        `    <g class="sk-pop" style="--d:${(0.5 + i * 0.2).toFixed(2)}s"><rect x="180" y="${dr.y}" width="250" height="62" rx="10" fill="var(--bg-3)" stroke="var(--teal)" stroke-width="1.3"/><rect x="196" y="${cy - 16}" width="20" height="32" rx="2" fill="none" stroke="var(--teal-lt)" stroke-width="1.4"/><circle cx="211" cy="${cy + 1}" r="1.8" fill="var(--teal-lt)"/><text x="230" y="${cy - 3}" class="b sm">${esc(dr.title)}</text><text x="230" y="${cy + 15}" class="${dr.subCls} xs">${esc(dr.sub)}</text></g>`,
        `    <path class="sk-draw" pathLength="100" d="M430 ${cy} C510 ${cy}, 520 135, 566 135" stroke="var(--teal)" stroke-opacity=".7" stroke-width="1.4" fill="none" style="--d:${(1.1 + i * 0.15).toFixed(2)}s"/>`,
        `    <circle cx="430" cy="${cy}" r="4" fill="var(--teal-lt)" class="sk-travel" style="--tx:136px;--ty:${135 - cy}px;--dur:2.4s;--d:${(1.6 + i * 0.5).toFixed(2)}s"/>`,
      ].join('\n');
    }),
    `    <g class="sk-pop" style="--d:1.6s">${icon.hex(610, 135, 40)}</g>`,
    `    <text x="610" y="198" text-anchor="middle" class="s sm sk-fade" style="--d:1.8s">same kernel source</text>`,
    `    <path class="sk-draw" pathLength="100" d="M654 135 H710" stroke="var(--muted)" stroke-width="1.6" fill="none" style="--d:2s"/>${icon.arrowRight(717, 135)}`,
    `    <text x="828" y="90" text-anchor="middle" class="t sm sk-fade" style="--d:2.3s">same inputs give the same hash</text>`,
    `    <g class="sk-pop" style="--d:2.2s"><rect x="720" y="100" width="216" height="72" rx="10" fill="var(--bg-3)" stroke="var(--gold)" stroke-width="1.4"/><text x="736" y="122" class="s xs">artifact</text><text x="736" y="142" class="m xs b">execution_hash</text><text x="736" y="160" class="m xs g">sha256:9f2c…</text></g>`,
  ].join('\n');
  return sceneFigure({
    id: 'agents-scene',
    viewBox: '0 0 960 270',
    minWidth: 700,
    title: 'Three doors into one kernel',
    desc: 'An agent on the left reaches three doors: WebMCP, where the page registers its tool in the browser; the hosted MCP server at mcp.ainumbers.co/mcp; and helmd on 127.0.0.1 on your own machine. All three lead to one kernel hexagon labelled same kernel source, which produces an artifact with an execution hash under the words same inputs give the same hash.',
    body,
    caption: 'An agent can reach a kernel through any of three doors. Each door runs the same kernel source, so the same inputs give the same execution hash. The <a href="prompts.html">prompt library</a> says which doors each task needs.',
  });
}

function helmScene() {
  const blocks = [36, 146, 256, 366];
  const body = [
    `    <rect x="12" y="14" width="700" height="262" rx="14" fill="none" stroke="var(--gold)" stroke-width="1.3" stroke-dasharray="7 6"/>`,
    `    <text x="30" y="38" class="u xs g">your machine</text>`,
    `    <g class="sk-pop" style="--d:.1s"><rect x="36" y="54" width="210" height="74" rx="10" fill="var(--bg-3)" stroke="var(--border-2)" stroke-width="1.3"/><circle cx="52" cy="68" r="3" fill="var(--muted)"/><circle cx="62" cy="68" r="3" fill="var(--muted)"/><circle cx="72" cy="68" r="3" fill="var(--muted)"/><text x="52" y="96" class="b sm">Helm in your browser</text><text x="52" y="114" class="m xs t">served from 127.0.0.1</text></g>`,
    `    <g class="sk-pop" style="--d:.4s"><rect x="330" y="54" width="210" height="74" rx="10" fill="var(--bg-3)" stroke="var(--teal)" stroke-width="1.4"/><text x="346" y="86" class="b sm">helmd</text><text x="346" y="106" class="s xs">HTTP bound to 127.0.0.1 only</text></g>`,
    `    <path class="sk-draw" pathLength="100" d="M246 91 H330" stroke="var(--teal)" stroke-width="1.6" fill="none" style="--d:.7s"/>`,
    `    <g class="sk-pop" style="--d:.9s">${icon.lock(280, 64)}</g>`,
    `    <text x="288" y="112" text-anchor="middle" class="s xs sk-fade" style="--d:1s">paired</text>`,
    `    <g class="sk-fade" style="--d:.6s"><text x="566" y="78" class="t xs">the core loop makes</text><text x="566" y="94" class="t xs">no outbound request</text></g>`,
    `    <text x="36" y="164" class="s xs sk-fade" style="--d:1s">append-only journal: each entry hashes the one before it</text>`,
    ...blocks.map((x, i) => [
      `    <g class="sk-slide" style="--d:${(1.2 + i * 0.3).toFixed(2)}s;--dx:-14px;--dy:0px"><rect x="${x}" y="176" width="92" height="46" rx="8" fill="var(--bg-3)" stroke="var(--border-2)" stroke-width="1.2"/><text x="${x + 46}" y="196" text-anchor="middle" class="b xs">step ${i + 1}</text><text x="${x + 46}" y="212" text-anchor="middle" class="m xs mu">${i === 0 ? 'first entry' : 'prev hash'}</text></g>`,
      i < blocks.length - 1 ? `    <path class="sk-draw" pathLength="100" d="M${x + 92} 199 H${x + 110}" stroke="var(--gold)" stroke-width="1.6" fill="none" style="--d:${(1.4 + i * 0.3).toFixed(2)}s"/>` : '',
    ].filter(Boolean).join('\n')),
    `    <path class="sk-draw" pathLength="100" d="M458 199 H486" stroke="var(--muted)" stroke-width="1.6" fill="none" style="--d:2.4s"/>${icon.arrowRight(493, 199)}`,
    `    <g class="sk-pop" style="--d:2.6s"><rect x="496" y="170" width="160" height="58" rx="10" fill="var(--bg-3)" stroke="var(--gold)" stroke-width="1.4"/><text x="512" y="194" class="b sm">evidence bundle</text><text x="512" y="212" class="s xs">signed and sealed</text><circle cx="646" cy="172" r="11" fill="var(--gold-dim)" stroke="var(--gold)" stroke-width="1.4"/><path d="M641 172 L645 176 L652 167" fill="none" stroke="var(--gold)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g>`,
    `    <path class="sk-draw" pathLength="100" d="M656 199 H766" stroke="var(--muted)" stroke-width="1.6" fill="none" style="--d:2.9s"/>${icon.arrowRight(773, 199)}`,
    `    <text x="858" y="146" text-anchor="middle" class="s xs sk-fade" style="--d:3s">you hand over the file</text>`,
    `    <g class="sk-pop" style="--d:3.1s"><rect x="776" y="160" width="164" height="98" rx="10" fill="var(--bg-3)" stroke="var(--green)" stroke-width="1.4"/><text x="792" y="184" class="b sm">any verifier</text><text x="792" y="202" class="s xs">no network access</text>${icon.check(804, 230, 11)}<text x="822" y="234" class="ok xs">bundle verifies</text></g>`,
  ].join('\n');
  return sceneFigure({
    id: 'helm-scene',
    viewBox: '0 0 960 290',
    minWidth: 720,
    title: 'Helm on your machine',
    desc: 'Inside a dashed boundary marked your machine, Helm in the browser is served from 127.0.0.1 and paired with helmd, an HTTP server bound to 127.0.0.1 only; a note says the core loop makes no outbound request. Journal entries for steps 1 to 4 appear one after another, each linked to the one before. The journal flows into a signed, sealed evidence bundle, which leaves the machine as a file and reaches a verifier outside with no network access, where it verifies.',
    body,
    caption: 'helmd serves Helm\'s interface from 127.0.0.1 only and records every step in a hash-chained journal. A run ends in a signed evidence bundle that a third party can verify with no network access, and the <a href="helm-walkthrough.html">guided walkthrough</a> verifies a real one in your tab.',
  });
}

// Scenes and notes placed under a section's heading, before its cards.
const SECTION_SCENES = { verify: verifyScene, convert: convertScene, agents: agentsScene, helm: helmScene };
const SECTION_NOTES = {
  anchor: 'To watch timestamping and anchoring step by step, open <a href="chaingraph/evidence-estate-explainer.html">The Evidence Estate</a>.',
};

function renderPage(registry, overrides, chrome) {
  const total = registry.length;
  const guideRows = registry.filter(r => r.category === 'guide');

  // Every card this page renders, section by section. Featured rows surface
  // first (the registry scrapes ain:featured; almost nothing sets it today),
  // then display-title order so the cleanup actually drives the sort.
  const sections = CATEGORIES.filter(c => c !== 'guide').map(cat => {
    const rows = registry
      .filter(r => r.category === cat)
      .sort((a, b) =>
        ((a.featured ? 0 : 1) - (b.featured ? 0 : 1))
        || renderTitle(a, overrides).localeCompare(renderTitle(b, overrides))
        || a.path.localeCompare(b.path));
    return { cat, rows };
  }).filter(s => s.rows.length);

  const cardsJsonLd = [];
  let body = '';
  for (const { cat, rows } of sections) {
    body += `<section class="section" id="${cat}" aria-label="${CATEGORY_LABELS[cat]} surfaces">\n  <div class="container">\n`;
    body += `    <div class="sec-label">${CATEGORY_LABELS[cat]} · ${rows.length}</div>\n`;
    body += `    <h2 class="sec-heading">${esc(CATEGORY_BLURBS[cat])}</h2>\n`;
    if (SECTION_NOTES[cat]) body += `    <p class="sec-note">${SECTION_NOTES[cat]}</p>\n`;
    if (SECTION_SCENES[cat]) body += `${SECTION_SCENES[cat]()}\n`;
    body += `    <div class="recipe-grid">\n`;
    for (const r of rows) {
      body += renderCard(r, overrides, FACT_LABELS);
      cardsJsonLd.push({
        '@type': 'ListItem',
        position: cardsJsonLd.length + 1,
        name: renderTitle(r, overrides),
        url: `https://ainumbers.co/${r.path}`,
      });
    }
    body += `    </div>\n  </div>\n</section>\n`;
  }

  // Hubs & guides pointer: the guide rows live on hub-for-hubs.html; this
  // section is the bridge, not a second catalog.
  const starters = HUB_STARTERS.map(p => {
    const row = registry.find(r => r.path === p);
    if (!row || row.category !== 'guide') {
      throw new Error(`HUB_STARTERS names ${p}, which is not a guide-category registry row`);
    }
    return renderCard(row, overrides, FACT_LABELS);
  }).join('');
  body += `<section class="section" id="hubs" aria-label="Hubs and guides">
  <div class="container">
    <div class="sec-label">Guide · ${guideRows.length}</div>
    <h2 class="sec-heading">Hubs and guides have their own map</h2>
    <p class="hero-sub">Domain hubs collect the tools and chains for one desk or one rulebook; single-purpose guides answer one question apiece. All <span data-count="guide_pages">${guideRows.length}</span> of them are grouped by desk on <a href="hub-for-hubs.html">the hubs and guides map</a>. Three to start with:</p>
    <div class="recipe-grid">
      <a class="recipe-card" href="hub-for-hubs.html">
        <div class="recipe-title">All hubs and guides on one map</div>
        <div class="recipe-outcome">The full catalog of domain hubs and integration guides, clustered by the work they support: payments, regulation, markets and treasury, risk, tokenization, trade, agents, the OpenChainGraph platform, and evidence.</div>
        <div class="recipe-go">Browse</div>
      </a>
${starters}    </div>
  </div>
</section>
`;

  const jumpLinks = sections.map(s => ({ id: s.cat, label: CATEGORY_LABELS[s.cat] }));
  jumpLinks.push({ id: 'hubs', label: 'Hubs & guides' });

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'AINumbers.co Infrastructure Map',
    description: `The generated map of AINumbers.co: ${total} pages across ${CATEGORIES.length} categories, grouped by the job each page does. Domain hubs and integration guides have their own map.`,
    url: 'https://ainumbers.co/infrastructure.html',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: cardsJsonLd.length,
      itemListElement: cardsJsonLd,
    },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="The generated map of AINumbers.co: ${total} pages across ${CATEGORIES.length} categories, grouped by the job each page does. Domain hubs and integration guides live on their own map at hub-for-hubs.html.">
<meta name="ain:category" content="learn">
<title>Infrastructure Map | AINumbers.co</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
${chrome.css}
${chrome.footerCss}
/* INFRA-PAGE-1 page-local additions */
.fact-row{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.1rem}
.fact-chip{font-family:'JetBrains Mono',monospace;font-size:.46rem;letter-spacing:.1em;text-transform:uppercase;color:var(--teal-lt);background:rgba(20,184,166,.08);border:1px solid rgba(20,184,166,.25);border-radius:999px;padding:.15rem .55rem}
.sec-note{font-size:.84rem;color:var(--body);max-width:720px;margin:-.4rem 0 1.1rem}
.sec-note a{color:var(--teal-lt);border-bottom:1px dotted currentColor}
/* INFRA-PROMPTS-SVG-1 scenes */
${SCENE_KIT_CSS}
</style>
<script>${SCENE_KIT_HEAD_JS}</script>
<script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
</script>
</head>
<body>

<!-- lang toggle removed — CONTRACT §1.1 -->

${chrome.nav}

<main>

<!-- Hero -->
<section class="hero">
  <div class="container">
    <div class="hero-eyebrow">Site map</div>
    <h1>Every page on this site grouped by the job it does</h1>
    <p class="hero-sub">This map is generated from the page registry, so every page that ships appears here. <span data-count="infra_pages">${total}</span> pages across ${CATEGORIES.length} categories, each declared by a category tag in the page's own head. The <span data-count="guide_pages">${guideRows.length}</span> domain hubs and guides are a map of their own, so the sections below stay browsable. Surfaces with dedicated catalogs keep them: <a href="tools.html">tools</a>, the <a href="chaingraph/chaingraph-hub.html">workflow hub</a>, and <a href="sitemap.html">sitemap</a>.</p>
${mapScene(sections, guideRows.length)}
  </div>
</section>

${jumpBar('Jump to', jumpLinks)}

${body}

</main>

<!-- ROOT-FOOTER:START -->
${chrome.footer}
<!-- ROOT-FOOTER:END -->

</body>
</html>
`;
}

const registryPath = resolve(REPO, 'data', 'infra-registry.json');
if (!existsSync(registryPath)) {
  console.error('gen-infrastructure-page: data/infra-registry.json missing. Run `node scripts/gen-infra-registry.mjs` first.');
  process.exit(1);
}
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const overrides = loadOverrides();
validateOverrides(overrides, registry);
const chrome = readStartChrome();
const out = renderPage(registry, overrides, chrome);
const target = resolve(REPO, OUT_REL);
const exists = existsSync(target);
const current = exists ? readFileSync(target, 'utf8') : '';

if (CHECK) {
  if (!exists) {
    console.error(`gen-infrastructure-page --check: ${OUT_REL} is missing. Run \`node scripts/gen-infrastructure-page.mjs\`.`);
    process.exit(1);
  }
  if (current !== out) {
    console.error(`gen-infrastructure-page --check: ${OUT_REL} is stale. Run \`node scripts/gen-infrastructure-page.mjs\`.`);
    process.exit(1);
  }
  console.log(`gen-infrastructure-page --check: OK (${registry.length} registry rows, byte-exact).`);
  process.exit(0);
}
writeFileSync(target, out, 'utf8');
console.log(`gen-infrastructure-page: wrote ${OUT_REL} (${registry.length} registry rows; guide rows render on hub-for-hubs.html).`);
