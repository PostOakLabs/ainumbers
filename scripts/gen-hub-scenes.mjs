#!/usr/bin/env node
/**
 * scripts/gen-hub-scenes.mjs — HUBSCENE-BUILD-1 (Tim 2026-10-06, spec:
 * research/HUBSCENES-BUILD-SPEC.md, HUBSCENE-SPEC-1 done 2026-10-06)
 *
 * ONE main-side writer (SO #35, the gen-chain-ask-agent shape) for the
 * generated animated chain-flow scene on every hub guide page: exactly one
 * `<!-- HUB-SCENE:BEGIN -->` … `<!-- HUB-SCENE:END -->` region per in-scope
 * page, rendered from the assembled ChainGraph catalog. A row ships data and
 * wiring; the page regions land MAIN-SIDE, in the derived-artifacts regen pass
 * after merge (COVERED id 'hub-scenes') — a PR is forbidden to hand-write
 * scene bytes (SO #35), which is exactly why the scene-required gate ACCEPTS
 * generator-scope pages (sync-scene-kit.mjs sceneRequiredVerdict).
 *
 * The region carries ZERO @keyframes and ZERO animation: properties — every
 * moving element takes its motion from the kit's sk-* classes (ONE animation
 * system in the estate; the no-fork rule is machine-checked: the render path
 * runs every region through assertNoFork, and the selftest holds it to the
 * poison case). On a page's FIRST insert the generator also lays down the
 * SCENE-KIT inline copies — the CSS pair inside the page's first <style> and
 * the head-script pair before </head> — from scripts/lib/scene-kit.mjs
 * BYTE-IDENTICALLY to sync-scene-kit.mjs's own cssRegion()/jsRegion() (this
 * file imports those very builders), so two writers deriving from one lib
 * cannot drift and `sync-scene-kit.mjs --check` keeps policing the copies.
 *
 * SCOPE, derived never hand-listed: every tracked page matching
 * guides/*-hub.html or chaingraph/guide-*.html (isHubScenePage). The same
 * derived list is (a) this writer's page list, (b) derived-artifacts.mjs's
 * declared `writes`/`artifacts` for the 'hub-scenes' entry, and (c) the
 * scene-required gate's generator-scope acceptance set — one function, three
 * consumers, no second enumeration to drift.
 *
 * INSERTION SLOT (spec §3, measured not assumed — full 93-page sweep
 * 2026-10-07): the page's unique hero container close, found by depth-counting
 * from the hero open. Three measured shapes:
 *   <section class="hero">   → 82 guides pages
 *   <div class="hero">       → 44 pages (10 guides with a div hero + all 34
 *                              chaingraph guides)
 *   <h1 class="doc-title">   → 1 page (guides/audit-trail-crosswalk-hub.html,
 *                              a doc-shaped page with no hero at all; the slot
 *                              stays top-of-content, right under the title)
 * 0 or >1 matches at every shape → a reported SKIP, never a silent pass, and
 * --check exits 1 on it (the gen-chain-ask-agent rule: the write run exits 0
 * even when a page is skipped; --check is the alarm).
 *
 * Exit codes: the write run exits 0 even when a page is skipped (it prints the
 * skip), so one odd page never stops main's whole regen pass; --check is the
 * alarm and exits 1 on drift or on a page it could not write.
 *
 * CIRCULAR-IMPORT LAW: sync-scene-kit.mjs imports hubScenePages from this
 * module and this module imports replaceRegion/cssRegion/jsRegion and the
 * timing parsers from sync-scene-kit.mjs. Both sides use the other's bindings
 * ONLY inside function bodies — never at module top level — so either import
 * order initializes cleanly (derived-artifacts.mjs imports this file at its
 * own top level, preflight runs both CLIs: both orders exercised).
 *
 * DETERMINISTIC: no clock, no randomness anywhere — the kit's own contract
 * (lib/scene-kit.mjs: "DETERMINISTIC. No randomness and no clock"). Labels
 * come from catalog titles and the page's own links; no dates, no counts, no
 * hand-typed numerals in the generated prose (SO #0b — the hero's COUNT
 * sentinels stay the only count surface on the page).
 *
 * Usage:
 *   node scripts/gen-hub-scenes.mjs            # write every stale region (main-side regen)
 *   node scripts/gen-hub-scenes.mjs --write    # same write mode, spelled out
 *   node scripts/gen-hub-scenes.mjs --check    # exit 1 on drift or an unwritable page
 *   node scripts/gen-hub-scenes.mjs --paths    # the derived page list this writer owns
 *   node scripts/gen-hub-scenes.mjs --skips    # pages with no insertion point, with reasons
 *   node scripts/gen-hub-scenes.mjs --selftest # RED/GREEN controls over fixtures + the real tree
 *
 * Zero-dependency: node builtins only (STANDING ORDER #10).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gitSync } from './_git-env-lib.mjs';
import { SCENE_KIT_CSS, SCENE_KIT_HEAD_JS, sceneFigure, escText, icon } from './lib/scene-kit.mjs';
import {
  replaceRegion, cssRegion, jsRegion, CSS_START, CSS_END, JS_START, JS_END,
  parseKitTimings, sceneTimings, MAX_END_MS,
} from './sync-scene-kit.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The marker pair this writer owns, one region per page. */
export const HUB_SCENE_BEGIN = '<!-- HUB-SCENE:BEGIN (generated by scripts/gen-hub-scenes.mjs — the ONE main-side writer; hand edits are overwritten by the regen pass) -->';
export const HUB_SCENE_END = '<!-- HUB-SCENE:END -->';

// ── Scope: derived, never hand-listed ──────────────────────────────────────

/** The hub-guide page class (spec §0 key shapes, measured 2026-10-06/07). */
export function isHubScenePage(rel) {
  return /^guides\/[a-z0-9][a-z0-9-]*-hub\.html$/.test(rel)
    || /^chaingraph\/guide-[a-z0-9][a-z0-9-]*\.html$/.test(rel);
}

/** Repo-relative page paths this writer may write; derived-artifacts.mjs
 *  declares exactly this list as the 'hub-scenes' entry's `writes` and
 *  `artifacts`, and sync-scene-kit.mjs consumes it as its generator-scope
 *  acceptance set. */
export function hubScenePages() {
  return gitSync(['ls-files', '-z', '--', '*.html'], { cwd: REPO })
    .split('\0').filter(Boolean)
    .filter(isHubScenePage)
    .sort();
}

// ── Catalog access: LAZY, inside the render path ───────────────────────────
// The gen-chain-ask-agent lesson (gen-chain-ask-agent.mjs:84-88): derived-
// artifacts.mjs imports this file at top level, and a graph read at import
// time would let a malformed chaingraph.json crash the very assembler that
// exists to rebuild it. The catalog loads on first RENDER, never at import.
// (The selftest passes its own fixture catalog through the pure functions.)

let CATALOG = null;
function catalog() {
  if (CATALOG === null) {
    CATALOG = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
  }
  return CATALOG;
}

/** Every tool-page slug the catalog can name: registered nodes' tool_ids plus
 *  every chain step's tool_id (chain steps reference page slugs that need not
 *  be registered nodes — measured 2026-10-07: chains touch
 *  274-mcp-tool-definition-linter, which nodes/ does not list). */
export function catalogToolSlugs(cat) {
  const slugs = new Set(cat.nodes.map((n) => n.tool_id));
  for (const c of cat.chains) for (const s of c.steps ?? []) slugs.add(s.tool_id);
  return slugs;
}

/**
 * One page's scene data, from ITS OWN links plus the assembled catalog.
 *   toolIds — the tool-page slugs the page links (class-aware href shapes,
 *             measured 2026-10-07: guides pages link tools/… and
 *             ../chaingraph/<tool_id>.html; chaingraph guides link sibling
 *             node pages bare, filtered to the catalog slug universe so nav
 *             links to other guide pages never count)
 *   chains  — every catalog chain whose steps touch one of those tools
 *   tools   — the same slugs with catalog display names, sorted
 */
export function pageSceneData(rel, src, cat) {
  const slugs = catalogToolSlugs(cat);
  const toolIds = new Set();
  if (rel.startsWith('guides/')) {
    for (const m of src.matchAll(/tools\/([a-z0-9-]+)\.html/g)) toolIds.add(m[1]);
    for (const m of src.matchAll(/chaingraph\/([a-z0-9][a-z0-9-]*)\.html/g)) if (slugs.has(m[1])) toolIds.add(m[1]);
  } else {
    for (const m of src.matchAll(/href="([a-z0-9][a-z0-9-]*)\.html"/g)) if (slugs.has(m[1])) toolIds.add(m[1]);
  }
  const chains = cat.chains.filter((c) => (c.steps ?? []).some((s) => toolIds.has(s.tool_id)));
  const names = new Map(cat.nodes.map((n) => [n.tool_id, n.display_name]));
  const tools = [...toolIds].sort().map((id) => ({ id, name: names.get(id) ?? id }));
  return { toolIds, chains, tools };
}

/** The page's own subject, for <title>/<desc>/caption: its <h1> text, else
 *  its <title> tag. Data, never invented. The raw heading is ENTITY-ENCODED
 *  source text ("… &amp; …"); the subject is returned DECODED plain text so
 *  the emit path's single escText() escapes each value exactly once —
 *  re-escaping the encoded heading is what emitted "&amp;amp;" on the 2026-
 *  10-08 regen (the double-escape class, MAIN-HUBSCENE-REGEN-COPY-HEAL-1). */
export function pageSubject(src) {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(src);
  if (h1) return visibleCopy(decodeEntities(h1[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()));
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(src);
  return t ? visibleCopy(decodeEntities(t[1].replace(/\s+/g, ' ').trim())) : 'this guide';
}

/** CONTRACT §1.4 enforced AT THE REGION'S EMIT BOUNDARY. Station labels and
 *  subjects come from DATA (catalog chain titles, node display names, page
 *  headings) that may carry an em-dash — literal or entity-encoded; visible
 *  copy may not. The 2026-10-08 main regen emitted a chain title's
 *  "US Wealth & Advisory — Reg BI Suitability" verbatim into a station
 *  <text> and went red on 4 hub pages. The rewrite is the CONTRACT's own
 *  prescription for a `label — value` splice: `label: value`. En-dashes in
 *  numeric ranges are correct typography and pass through untouched. */
function visibleCopy(s) {
  return String(s)
    .replace(/&mdash;|&#0*8212;|&#x0*2014;/gi, '—')
    .replace(/\s*—\s*/g, ': ')
    .replace(/^[:\s]+/, '');
}

/** Decode the entity set HTML authoring actually uses in headings, `&amp;`
 *  LAST so a source-encoded ampersand decodes exactly once (never
 *  `&amp;lt;` → `<`). Pairs with escText(): decode at extraction, escape at
 *  emit — one escape per rendered value. */
function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#0*39;|&#x0*27;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&middot;/gi, '·')
    .replace(/&amp;/gi, '&');
}

// ── The no-fork rule, machine-checked (spec §2/D1, §6) ─────────────────────

/**
 * The ONLY @keyframes allowed in any emitted page bytes are the six kit
 * keyframes inside SCENE_KIT_CSS. The generated region carries zero
 * @keyframes and zero animation: properties — all motion rides the kit's
 * sk-* classes. This guard runs on every rendered region; the selftest holds
 * it to the poison case.
 */
export function assertNoFork(region) {
  if (/@keyframes/.test(region) || /animation\s*:/.test(region) || /animation-duration\s*:/.test(region)) {
    throw new Error('gen-hub-scenes: the rendered region declares its own animation — the estate keeps ONE animation system (SCENE-KIT sk-* classes); see scripts/lib/scene-kit.mjs');
  }
  return region;
}

// ── Rendering (spec §4 layout law) ─────────────────────────────────────────

const PER_ROW = 6;         // stations per row, maximum
const PITCH = 160;         // station pitch, viewBox units (spec: 150–174)
const STATION_W = 132;     // station box width
const STATION_H = 64;      // chain-station box height
const TOOL_STATION_H = 70; // tool-station box height (icon + label)
const ROW_H = 86;          // row height, viewBox units (spec)
const SIDE = 24;           // viewBox side margin
const TOP = 30;            // viewBox top margin

/** Greedy word wrap: deterministic, ≤ maxLines lines, '…' whenever anything
 *  was cut (a too-long word or leftover words). */
function wrapLabel(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  for (let l = 0; l < maxLines && words.length; l += 1) {
    let line = '';
    while (words.length && `${line}${line ? ' ' : ''}${words[0]}`.length <= maxChars) {
      line += `${line ? ' ' : ''}${words.shift()}`;
    }
    if (!line) {
      const w = words.shift();
      line = w.length > maxChars - 1 ? `${w.slice(0, maxChars - 1)}…` : w;
    }
    lines.push(line);
  }
  if (words.length && lines.length) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = `${last.length >= maxChars ? last.slice(0, maxChars - 1) : last}`.replace(/…$/, '') + '…';
  }
  return lines;
}

/** '--d' formatting: Number's own shortest form + 's' ('0.42s', '2.2s', '3s'). */
const dAttr = (n) => `${Number(n.toFixed(2))}s`;

/**
 * Per-class delay clamps, DERIVED FROM THE KIT'S OWN CSS (parsed by
 * sync-scene-kit's parseKitTimings — never hardcoded): an element of class
 * `cls` may start no later than MAX_END_MS minus its own duration×iterations,
 * so every scene still ends inside the WCAG 2.2.2 five-second budget no
 * matter how many rows it wraps to. The base delay law is spec §4:
 * --d = row×0.3s + indexInRow×0.12s, clamped per class.
 */
function delayClamps(timings) {
  const out = new Map();
  for (const [cls, rule] of timings) out.set(cls, (MAX_END_MS - rule.durMs * rule.iterations) / 1000);
  return out;
}
const delayFor = (row, indexInRow) => row * 0.3 + indexInRow * 0.12;

/** viewBox width for the widest row. */
const sceneWidth = (firstRowCount) => Math.max(480, SIDE * 2 + (firstRowCount - 1) * PITCH + STATION_W);

/** One chain station: rounded rect + the chain's own catalog title. */
function chainStation(x, y, title, row, col, clamp) {
  const delay = Math.min(delayFor(row, col), clamp.get('sk-pop') ?? 4.4);
  const lines = wrapLabel(title, 17, 3);
  const baseY = y + STATION_H / 2 - (lines.length - 1) * 8 + 4;
  const labels = lines.map((ln, i) =>
    `<text x="${x + STATION_W / 2}" y="${baseY + i * 16}" text-anchor="middle" class="sm b">${escText(ln)}</text>`).join('');
  return `  <g class="sk-pop" style="--d:${dAttr(delay)}"><rect x="${x}" y="${y}" width="${STATION_W}" height="${STATION_H}" rx="9" fill="var(--bg-3,#111E35)" stroke="var(--border-2,#263855)" stroke-width="1.4"/>${labels}</g>`;
}

/** One link between consecutive stations in a row: a drawing stroke with a
 *  persistent arrowhead (flow direction — Tim-ruled flow-map depth, not a
 *  step player), plus ONE travelling dot that crosses the span once. */
function link(x, yMid, row, col, clamp) {
  const start = x + STATION_W + 3;
  const end = x + PITCH - 4;
  const dDraw = Math.min(delayFor(row, col), clamp.get('sk-draw') ?? 4.1);
  const dTravel = Math.min(delayFor(row, col), clamp.get('sk-travel') ?? 2.2);
  const span = end - start;
  return `  <path class="sk-draw" pathLength="100" d="M${start} ${yMid} H${end}" style="--d:${dAttr(dDraw)}" stroke="var(--border-2,#263855)" stroke-width="1.6"/>\n`
    + `  <polygon points="${end},${yMid} ${end - 6},${yMid - 3.5} ${end - 6},${yMid + 3.5}" fill="var(--muted,#3A5270)"/>\n`
    + `  <circle class="sk-travel" r="3" cy="${yMid}" style="--d:${dAttr(dTravel)};--tx:${span}px" fill="var(--teal-lt,#2DD4BF)"/>`;
}

/** One tool station for the zero-chain landscape: rect + the kit's doc()
 *  icon + the tool's own display name. */
function toolStation(x, y, name, row, col, clamp) {
  const delay = Math.min(delayFor(row, col), clamp.get('sk-pop') ?? 4.4);
  const lines = wrapLabel(name, 20, 2);
  const labels = lines.map((ln, i) =>
    `<text x="${x + STATION_W / 2}" y="${y + 52 + i * 12}" text-anchor="middle" class="xs s">${escText(ln)}</text>`).join('');
  return `  <g class="sk-pop" style="--d:${dAttr(delay)}"><rect x="${x}" y="${y}" width="${STATION_W}" height="${TOOL_STATION_H}" rx="9" fill="var(--bg-3,#111E35)" stroke="var(--border-2,#263855)" stroke-width="1.4"/>${icon.doc(x + STATION_W / 2 - 15, y + 8, 30, 32)}${labels}</g>`;
}

/**
 * The region body for one page. ≥1 chain → chain-pipeline scene (each chain a
 * station, links + travelling dots between stations in a row); 0 chains →
 * the tool-landscape scene (each tool a station). Same wrap law, same timing
 * budget either way (spec §4). sceneFigure() is the ONLY wrapper (it throws
 * without id/viewBox/title/desc — the accessibility premise, mechanically
 * enforced).
 */
export function renderRegion(rel, src, cat, timings) {
  const { chains, tools } = pageSceneData(rel, src, cat);
  const clamp = delayClamps(timings);
  const subject = pageSubject(src);
  const stations = chains.length >= 1
    ? chains.map((c) => ({ label: visibleCopy(c.title ?? c.name ?? 'chain'), kind: 'chain' }))
    : tools.map((t) => ({ label: visibleCopy(t.name), kind: 'tool' }));
  const rows = Math.max(1, Math.ceil(stations.length / PER_ROW));
  const width = sceneWidth(Math.min(PER_ROW, stations.length));
  const height = TOP + rows * ROW_H;
  const parts = [];
  stations.forEach((st, i) => {
    const row = Math.floor(i / PER_ROW);
    const col = i % PER_ROW;
    const x = SIDE + col * PITCH;
    const y = TOP + row * ROW_H;
    parts.push(st.kind === 'chain'
      ? chainStation(x, y, st.label, row, col, clamp)
      : toolStation(x, y, st.label, row, col, clamp));
    if (st.kind === 'chain' && col < PER_ROW - 1 && i + 1 < stations.length && Math.floor((i + 1) / PER_ROW) === row) {
      parts.push(link(x, y + STATION_H / 2, row, col, clamp));
    }
  });
  const isChains = chains.length >= 1;
  const id = `hub-scene-${rel.split('/').pop().replace(/\.html$/, '')}`;
  const title = isChains ? `${subject} chain flow map` : `${subject} tool landscape`;
  const desc = isChains
    ? `Each station is one named chain on ${subject}; strokes and travelling dots show the hand-off order within each row.`
    : `Each station is one tool this guide builds on, laid out like the chain flow map.`;
  const caption = isChains
    ? `Flow map of ${escText(subject)}: each station is one named chain; arrows mark the hand-off order within each row.`
    : `Tool landscape of ${escText(subject)}: each station is one tool this guide builds on.`;
  return assertNoFork(sceneFigure({
    id,
    viewBox: `0 0 ${width} ${height}`,
    minWidth: Math.min(640, width),
    title,
    desc,
    caption,
    body: parts.join('\n'),
  }));
}

// ── Insertion slot (spec §3) ───────────────────────────────────────────────

/**
 * The page's unique insertion point: index just AFTER the hero container's
 * matching close (depth-counted from the hero open), or after the doc-title
 * h1's close on the one doc-shaped in-scope page. Returns { at } or
 * { problem }. Fail-closed: 0 or >1 candidates at every shape is a problem,
 * never a guess.
 */
export function insertPoint(src, rel) {
  void rel;
  for (const open of ['<section class="hero">', '<div class="hero">']) {
    const first = src.indexOf(open);
    if (first === -1) continue;
    if (src.indexOf(open, first + 1) !== -1) return { problem: `more than one ${open} hero container` };
    const tag = open.slice(1, open.indexOf(' '));
    const closeTag = `</${tag}>`;
    const openRe = new RegExp(`<${tag}(?=[\\s>])`, 'g');
    // Explicit monotonic cursor: exec() both advances lastIndex past its match
    // and RESETS it to 0 on exhaustion, so a loop keyed on openRe.lastIndex can
    // rewind behind the hero's own close and spin forever (measured on
    // guides/aml-kyc-compliance-hub.html, 2026-10-07). `pos` only moves forward.
    let pos = first + open.length;
    let depth = 0;
    for (;;) {
      openRe.lastIndex = pos;
      const nextOpen = openRe.exec(src);
      const nextClose = src.indexOf(closeTag, pos);
      if (nextClose === -1) return { problem: `unclosed ${open} hero container` };
      if (nextOpen && nextOpen.index < nextClose) {
        depth += 1;
        pos = nextOpen.index + tag.length + 1;
        continue;
      }
      if (depth === 0) return { at: nextClose + closeTag.length };
      depth -= 1;
      pos = nextClose + closeTag.length;
    }
  }
  const docTitle = src.indexOf('<h1 class="doc-title">');
  if (docTitle !== -1) {
    if (src.indexOf('<h1 class="doc-title">', docTitle + 1) !== -1) return { problem: 'more than one <h1 class="doc-title">' };
    const close = src.indexOf('</h1>', docTitle);
    if (close === -1) return { problem: 'unclosed <h1 class="doc-title">' };
    return { at: close + '</h1>'.length };
  }
  return { problem: 'no unique hero container (section.hero / div.hero) and no doc-title h1 to anchor to' };
}

/**
 * One page's next bytes. PURE. Returns { html, problem }:
 *   problem  — a reported SKIP (no insertion point, a broken marker pair, or
 *              a missing <style>/</head> to host the kit copies)
 * The three marker systems on a generated hub page, one owner each (spec D1):
 *   HUB-SCENE pair            → THIS writer (region replaced wholesale)
 *   SCENE-KIT CSS + JS pairs  → laid down on first insert, byte-identically
 *                               to sync-scene-kit's builders; their CONTENT
 *                               stays owned by sync-scene-kit (--check holds
 *                               the copies to the lib forever after)
 */
export function applyToPage(rel, src, cat, timings) {
  const slot = insertPoint(src, rel);
  if (slot.problem) return { html: src, problem: slot.problem };
  const region = `${HUB_SCENE_BEGIN}\n${renderRegion(rel, src, cat, timings)}\n${HUB_SCENE_END}`;
  let out;
  const hub = replaceRegion(src, HUB_SCENE_BEGIN, HUB_SCENE_END, region);
  if (hub.problem) return { html: src, problem: hub.problem };
  out = hub.present ? hub.html : src.slice(0, slot.at) + '\n' + region + src.slice(slot.at);
  const css = replaceRegion(out, CSS_START, CSS_END, cssRegion());
  if (css.problem) return { html: src, problem: css.problem };
  out = css.present ? css.html
    : out.slice(0, out.indexOf('</style>')) + '\n' + cssRegion() + '\n' + out.slice(out.indexOf('</style>'));
  const js = replaceRegion(out, JS_START, JS_END, jsRegion());
  if (js.problem) return { html: src, problem: js.problem };
  out = js.present ? js.html
    : out.slice(0, out.indexOf('</head>')) + '\n' + jsRegion() + '\n' + out.slice(out.indexOf('</head>'));
  return { html: out, problem: null };
}

// ── CLI runs ───────────────────────────────────────────────────────────────

function run({ apply }) {
  const cat = catalog();
  const timings = parseKitTimings(SCENE_KIT_CSS);
  const result = { targets: [], changed: [], skipped: [] };
  for (const rel of hubScenePages()) {
    result.targets.push(rel);
    const current = readFileSync(resolve(REPO, rel), 'utf8');
    const next = applyToPage(rel, current, cat, timings);
    if (next.problem) {
      result.skipped.push({ file: rel, reason: next.problem });
      continue;
    }
    if (next.html === current) continue;
    result.changed.push(rel);
    if (apply) writeFileSync(resolve(REPO, rel), next.html, 'utf8');
  }
  return result;
}

function report(result, check) {
  if (check) {
    const problems = [];
    if (result.changed.length) problems.push(`${result.changed.length} hub scene region(s) differ from the assembled catalog: ${result.changed.slice(0, 12).join(', ')}${result.changed.length > 12 ? ', …' : ''}`);
    if (result.skipped.length) problems.push(`${result.skipped.length} page(s) had no insertion point: ${result.skipped.map((s) => `${s.file} (${s.reason})`).join('; ')}`);
    if (problems.length) {
      console.error('✗ hub scene regions are stale (HUBSCENE-BUILD-1). Main-side single writer: node scripts/gen-hub-scenes.mjs');
      problems.forEach((p) => console.error('    ' + p));
      process.exit(1);
    }
    console.log(`✓ hub scene regions fresh: ${result.targets.length} page(s) match the assembled catalog (SCENE-KIT copies held to the lib by sync-scene-kit --check).`);
    return;
  }
  console.log(`gen-hub-scenes: wrote ${result.changed.length} of ${result.targets.length} page(s)${result.changed.length ? ': ' + result.changed.slice(0, 12).join(', ') + (result.changed.length > 12 ? ', …' : '') : ''}.`);
  if (result.skipped.length) console.log(`gen-hub-scenes: skipped ${result.skipped.length} (the --check gate reports these): ${result.skipped.map((s) => s.file).join(', ')}`);
}

// ── Self-test: the checker proved RED before it is trusted GREEN (SO #34c) ──

function fixturePage() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Fixture hub</title>
<style>
:root{--bg:#080E1A}
.hero h1{font-size:2rem}
</style>
</head>
<body>
<nav><a href="../index.html">home</a></nav>
<section class="hero">
  <p class="hero-desc">A fixture hub with <a href="../tools/art-42-example-tool.html">one tool</a> and <a href="../chaingraph/art-43-example-sibling.html">a sibling</a>.</p>
</section>
<main><p>Body.</p></main>
</body></html>`;
}

function selftest() {
  const fails = [];
  const a = (name, cond) => { if (!cond) fails.push(name); };
  const cat = catalog();
  const timings = parseKitTimings(SCENE_KIT_CSS);
  const rel = 'guides/fixture-hub.html';
  const src = fixturePage();

  // 1. First insert: region + both kit copies, byte-identical to the sync
  //    tool's builders, and NOTHING outside the three inserted pieces moves.
  const once = applyToPage(rel, src, cat, timings);
  a('the first insert has no problem', once.problem === null);
  a('the HUB-SCENE region markers landed', once.html.includes(HUB_SCENE_BEGIN) && once.html.includes(HUB_SCENE_END));
  a('the CSS copy is byte-identical to sync-scene-kit cssRegion()', once.html.includes(`\n${cssRegion()}\n`));
  a('the head-script copy is byte-identical to sync-scene-kit jsRegion()', once.html.includes(`\n${jsRegion()}\n`));
  a('the figure carries a non-empty <title> and <desc>',
    /<title id="hub-scene-fixture-hub-t">[^<]+<\/title>/.test(once.html)
    && /<desc id="hub-scene-fixture-hub-d">[^<]+<\/desc>/.test(once.html));
  const regionOnce = `${HUB_SCENE_BEGIN}\n${renderRegion(rel, src, cat, timings)}\n${HUB_SCENE_END}`;
  const strippedOnce = once.html
    .replace(`\n${regionOnce}`, '')
    .replace(`\n${cssRegion()}\n`, '')
    .replace(`\n${jsRegion()}\n`, '');
  a('the insert changed nothing outside the three regions', strippedOnce === src);

  // 2. Idempotent: a second pass is byte-identical.
  const twice = applyToPage(rel, once.html, cat, timings);
  a('a second pass is byte-identical', twice.problem === null && twice.html === once.html);

  // 3. RED: one hand-edited byte inside the region is drift.
  const mutant = once.html.replace('chain flow map', 'chain flox map');
  if (mutant === once.html) fails.push('RED control: mutation target not found in the region');
  const red = applyToPage(rel, mutant, cat, timings);
  a('RED: a hand-edited region byte is reported as drift', red.problem === null && red.html !== mutant);

  // 4. RED: a page with no hero and no doc-title is a reported SKIP (and
  //    --check exits 1 on it) — never a silent pass.
  const anchorlessSrc = '<html><body><p>no anchor here</p></body></html>';
  const anchorless = applyToPage(rel, anchorlessSrc, cat, timings);
  a('RED: an anchorless page is a reported SKIP', anchorless.problem !== null && anchorless.html === anchorlessSrc);

  // 5. RED: half the HUB-SCENE marker pair is a problem, never a silent pass.
  const half = applyToPage(rel, once.html.replace(HUB_SCENE_END, ''), cat, timings);
  a('RED: half a HUB-SCENE marker pair is a problem', half.problem !== null && /half a marker pair/.test(half.problem));

  // 6. The no-fork rule: the shipped region declares no animation of its own,
  //    and the guard throws on a poisoned region.
  a('the rendered region carries zero @keyframes and zero animation:', !/@keyframes|animation\s*:/.test(regionOnce));
  let threw = false;
  try { assertNoFork('<g class="sk-pop" style="animation:sk-pop .5s"/>'); } catch { threw = true; }
  a('RED: assertNoFork throws on a region with its own animation', threw);

  // 7. The 5s budget holds at every measured extreme, and the per-class delay
  //    clamp survives a pathological page. Timings come from the gate's own
  //    parser over the kit CSS (SO #34: recompute from the primary source).
  const worstEnd = (html) => Math.max(0, ...sceneTimings(html, timings).map((s) => s.endMs));
  const pages = hubScenePages();
  const chainCount = (r) => pageSceneData(r, readFileSync(resolve(REPO, r), 'utf8'), cat).chains.length;
  const withChains = pages.filter((r) => chainCount(r) > 0).sort((x, y) => chainCount(x) - chainCount(y));
  const samples = [withChains[0], withChains[Math.floor(withChains.length / 2)], withChains[withChains.length - 1]].filter(Boolean);
  for (const r of samples) {
    const real = readFileSync(resolve(REPO, r), 'utf8');
    const rendered = applyToPage(r, real, cat, timings);
    a(`${r} renders without a problem`, rendered.problem === null);
    a(`${r} scene (${chainCount(r)} chains) still ends within ${MAX_END_MS / 1000}s`, worstEnd(rendered.html) <= MAX_END_MS);
  }
  // Pathological wrap: 1,000 chains → 167 rows. Every delay clamps per class,
  // so the scene STILL ends inside the five-second budget.
  const monster = {
    chains: Array.from({ length: 1000 }, (_, i) => ({ name: `fixture-chain-${i}`, title: `Fixture chain number ${i}`, steps: [{ tool_id: 'art-42-example-tool' }] })),
    nodes: cat.nodes,
  };
  const monsterOut = applyToPage(rel, src, monster, timings);
  a('a 1,000-station scene still ends within 5s (the clamp law)', monsterOut.problem === null && worstEnd(monsterOut.html) <= MAX_END_MS);

  // 8. Every real in-scope page has exactly one insertion point — the
  //    acceptance this row ships against (post-regen --check runs 0 skips).
  const noAnchor = pages.filter((r) => insertPoint(readFileSync(resolve(REPO, r), 'utf8'), r).problem);
  a(`every in-scope page (${pages.length}) has exactly one insertion point`, noAnchor.length === 0);
  if (noAnchor.length) fails.push(`pages without an insertion point: ${noAnchor.join(', ')}`);

  // 9. The scope predicate is the single derived class (guides/*-hub ∪
  //    chaingraph/guide-*), shared with the gate and derived-artifacts.
  a('guides/foo-hub.html is in scope', isHubScenePage('guides/foo-hub.html'));
  a('guides/foo.html is NOT in scope', !isHubScenePage('guides/foo.html'));
  a('chaingraph/guide-foo.html is in scope', isHubScenePage('chaingraph/guide-foo.html'));
  a('chaingraph/foo-hub.html is NOT in scope (the gate may still block it)', !isHubScenePage('chaingraph/foo-hub.html'));
  a('tools/foo.html is NOT in scope', !isHubScenePage('tools/foo.html'));

  // 10. Mutation control (SO #34c): removing the check must turn this
  //     selftest RED — hold the CLI to its wiring by reading this file's
  //     own source.
  const selfSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const reportSrc = selfSrc.slice(selfSrc.indexOf('function report'), selfSrc.indexOf('// ── Self-test'));
  a('mutation control: the check path still exits 1 on drift', reportSrc.includes('result.changed.length'));
  a('mutation control: the check path still exits 1 on skips', reportSrc.includes('result.skipped.length'));
  const runSrc = selfSrc.slice(selfSrc.indexOf('function run({ apply })'), selfSrc.indexOf('function report'));
  a('mutation control: run() still routes every page through applyToPage', runSrc.includes('applyToPage('));
  a('mutation control: the render path still runs the no-fork guard', selfSrc.includes('assertNoFork(sceneFigure('));

  if (fails.length) {
    console.error('✗ gen-hub-scenes selftest FAILED:');
    fails.forEach((f) => console.error('    ' + f));
    process.exit(1);
  }
  console.log(`✓ gen-hub-scenes selftest: first insert lays region + byte-identical kit copies, second pass byte-identical, hand-edited region RED, anchorless page SKIPs, half pair RED, no-fork guard throws, ${samples.length} real extremes (${samples.map((r) => `${chainCount(r)} chains`).join(' / ')}) + a 1,000-station clamp proof within ${(MAX_END_MS / 1000).toFixed(0)}s, all ${pages.length} pages anchored.`);
}

// ── Entry (guarded: importing this module — derived-artifacts.mjs,
//    sync-scene-kit.mjs — must never execute CLI code) ──────────────────────

const IS_CLI = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (IS_CLI) {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) selftest();
  else if (args.includes('--paths')) { hubScenePages().forEach((p) => console.log(p)); }
  else if (args.includes('--skips')) {
    const result = run({ apply: false });
    if (!result.skipped.length) console.log('gen-hub-scenes: 0 skips — every in-scope page has its insertion point.');
    else result.skipped.forEach((s) => console.log(`${s.file}: ${s.reason}`));
  } else {
    const check = args.includes('--check');
    report(run({ apply: !check }), check);
  }
}
