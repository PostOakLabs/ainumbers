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
 * A page whose own links resolve to ZERO catalog tools AND zero chains carries
 * NO region at all (HUBSCENE-ZEROSTATION-SKIP-1): a rendered zero-station
 * figure is title/desc/caption around an empty body — an empty box on the
 * page, which 11 pages shipped before this law. applyToPage removes a stale
 * region on such a page and --check alarms until it is gone.
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

/**
 * Remove a BEGIN…END region pair. PURE. Companion to sync-scene-kit's
 * replaceRegion for the one verdict that writer cannot express: the region
 * must NOT exist (HUBSCENE-ZEROSTATION-SKIP-1 — a zero-station figure renders
 * as an empty box, which is a defect, not a scene). Same problem discipline:
 * half a pair, out-of-order markers, or a duplicated pair is a reported
 * problem, never a silent pass (SO #34c); an absent pair is a byte no-op.
 * Removal also eats the single '\n' the inserter laid before BEGIN, so a
 * removed page is byte-identical to its never-had-a-region state.
 */
export function removeRegion(src, begin, end) {
  const begins = src.split(begin).length - 1;
  const ends = src.split(end).length - 1;
  if (begins > 1) return { html: src, present: false, problem: 'more than one BEGIN marker' };
  if (ends > 1) return { html: src, present: false, problem: 'more than one END marker' };
  if (begins === 0 && ends === 0) return { html: src, present: false, problem: null };
  if (begins === 0) return { html: src, present: false, problem: 'half a marker pair (END without BEGIN)' };
  if (ends === 0) return { html: src, present: false, problem: 'half a marker pair (BEGIN without END)' };
  const at = src.indexOf(begin);
  const close = src.indexOf(end, at);
  if (close === -1) return { html: src, present: false, problem: 'half a marker pair (BEGIN before END not found)' };
  const start = src[at - 1] === '\n' ? at - 1 : at;
  return { html: src.slice(0, start) + src.slice(close + end.length), present: true, problem: null };
}

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

/** A readable label for a tool page that is not a registered node (chain steps
 *  may name pages the node list does not carry): drop the leading number or
 *  art- prefix, split on hyphens, capitalise, and upper-case short acronyms. */
export function humanizeSlug(id) {
  const small = new Set(['of', 'to', 'and', 'for', 'the', 'in', 'vs', 'on', 'by', 'at', 'as', 'or', 'via', 'per', 'with']);
  return id.replace(/^(?:[a-z]{2,4}-)?\d+[a-z]?-/, '').split('-').filter(Boolean)
    .map((w) => (small.has(w) ? w : w.length <= 3 && /^[a-z]+$/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ') || id;
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
  const tools = [...toolIds].sort().map((id) => ({ id, name: names.get(id) ?? humanizeSlug(id) }));
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
const TOOL_STATION_H = 70; // tool-station box height (icon + label)

// Chain-use matrix geometry (columns = tools, rows = chain groups).
const M_LABEL_W = 220;     // row-label gutter
const M_PITCH = 44;        // column pitch
const M_CELL_W = 38;       // cell width
const M_CELL_H = 24;       // cell height
const M_ROW_H = 30;        // row pitch
const M_HEAD_H = 140;      // rotated column-label band
const M_RIGHT = 84;        // room for the last rotated label to run out right
const M_MAX_COLS = 18;     // columns kept; least-used tools beyond this are dropped
const M_GROUP_ABOVE = 8;   // more chains than this: rows group by domain
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

/** One tool station for the zero-chain landscape: rect + the kit's doc()
 *  icon + the tool's own display name. */
function toolStation(x, y, name, row, col, clamp) {
  const delay = Math.min(delayFor(row, col), clamp.get('sk-pop') ?? 4.4);
  const lines = wrapLabel(name, 20, 2);
  const labels = lines.map((ln, i) =>
    `<text x="${x + STATION_W / 2}" y="${y + 52 + i * 12}" text-anchor="middle" class="xs s">${escText(ln)}</text>`).join('');
  return `  <g class="sk-pop" style="--d:${dAttr(delay)}"><rect x="${x}" y="${y}" width="${STATION_W}" height="${TOOL_STATION_H}" rx="9" fill="var(--bg-3,#111E35)" stroke="var(--border-2,#263855)" stroke-width="1.4"/>${icon.doc(x + STATION_W / 2 - 15, y + 8, 30, 32)}${labels}</g>`;
}

/** The page's own href for a slug (tool page or chain composer), taken from
 *  the page source so the scene can never link to a path the page does not
 *  already use. null when the page carries no such link. */
function pageHref(src, kind, slug) {
  const dir = kind === 'chain' ? 'chains/' : '';
  const re = new RegExp(`href="([^"#?]*${dir}${slug.replace(/[^a-z0-9-]/gi, '')}\\.html)"`);
  const m = re.exec(src);
  return m ? m[1] : null;
}

/**
 * The chain-use matrix data: which of the page's tools each chain row runs
 * through. Rows are chains when the page has few of them, else chains grouped
 * by catalog domain (biggest group first). Columns are the page's tools that
 * at least one chain uses, most-used first (the backbone tool leads), capped
 * at M_MAX_COLS. PURE; all values come from the assembled catalog.
 */
export function matrixData(chains, tools) {
  const grouped = chains.length > M_GROUP_ABOVE;
  const toolName = new Map(tools.map((t) => [t.id, t.name]));
  const usedBy = new Map();
  for (const c of chains) {
    for (const id of new Set((c.steps ?? []).map((s) => s.tool_id))) {
      if (!toolName.has(id)) continue;
      if (!usedBy.has(id)) usedBy.set(id, []);
      usedBy.get(id).push(c);
    }
  }
  const cols = [...usedBy.keys()]
    .sort((x, y) => usedBy.get(y).length - usedBy.get(x).length || (x < y ? -1 : 1))
    .slice(0, M_MAX_COLS)
    .map((id) => ({ id, name: toolName.get(id), chains: usedBy.get(id) }));
  const buckets = new Map();
  for (const c of chains) {
    const key = grouped ? (c.domain ?? 'Other') : (c.name ?? c.title ?? 'chain');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(c);
  }
  const rows = [...buckets.entries()]
    .map(([key, list]) => ({ key, label: grouped ? key : (list[0].title ?? key), chains: list }))
    .sort((x, y) => grouped
      ? y.chains.length - x.chains.length || (x.key < y.key ? -1 : 1)
      : 0);
  return { grouped, cols, rows };
}

/** One matrix cell: n chains of this row run through this column's tool. A
 *  zero cell is a still faint dot (no animation); a hit pops in and carries a
 *  hover list of the chains. */
function matrixCell(cx, cy, n, max, grouped, tip, delay) {
  if (n === 0) return `  <circle cx="${cx}" cy="${cy}" r="2" fill="var(--border-2,#263855)"/>`;
  const x = cx - M_CELL_W / 2;
  const y = cy - M_CELL_H / 2;
  const heat = Number((0.2 + 0.4 * (n / max)).toFixed(2));
  const mark = grouped
    ? `<text x="${cx}" y="${cy + 4}" text-anchor="middle" class="m sm b">${n}</text>`
    : `<circle cx="${cx}" cy="${cy}" r="4.5" fill="var(--teal-lt,#2DD4BF)"/>`;
  return `  <g class="sk-pop" style="--d:${dAttr(delay)}"><title>${escText(tip)}</title><rect x="${x}" y="${y}" width="${M_CELL_W}" height="${M_CELL_H}" rx="5" fill="var(--teal,#14B8A6)" fill-opacity="${heat}" stroke="var(--teal,#14B8A6)" stroke-opacity="0.6" stroke-width="1"/>${mark}</g>`;
}

/** The chain-use matrix body: columns are the tools a hub covers, rows are
 *  chains or chain groups, a cell counts the chains that run through the
 *  tool. Reads the real coupling (which chains share which tool) instead of
 *  an invented hand-off order between unrelated chains. */
function matrixBody(src, chains, tools, clamp) {
  const { grouped, cols, rows } = matrixData(chains, tools);
  const popMax = clamp.get('sk-pop') ?? 4.4;
  const fadeMax = clamp.get('sk-fade') ?? 4.4;
  const colX = (c) => M_LABEL_W + c * M_PITCH + M_PITCH / 2;
  let max = 1;
  const counts = rows.map((r) => cols.map((col) => {
    const used = new Set(col.chains.map((c) => c.name));
    const n = r.chains.filter((c) => used.has(c.name)).length;
    if (n > max) max = n;
    return n;
  }));
  const parts = [];
  cols.forEach((col, c) => {
    const x = colX(c);
    const label = escText(wrapLabel(visibleCopy(col.name), 24, 1)[0] ?? col.id);
    const href = pageHref(src, 'tool', col.id);
    const fade = dAttr(Math.min(c * 0.05, fadeMax));
    const hit = `<rect class="sk-hit" x="${x - M_PITCH / 2 + 1}" y="${M_HEAD_H - 14}" width="${M_PITCH - 2}" height="${rows.length * M_ROW_H + 14}" rx="6" fill="transparent" stroke="none"/>`;
    const text = `<text x="${x - 2}" y="${M_HEAD_H - 20}" transform="rotate(-55 ${x - 2} ${M_HEAD_H - 20})" class="xs s">${label}</text>`;
    const inner = `<title>${escText(visibleCopy(col.name))}</title>${hit}${text}`;
    parts.push(href
      ? `  <a href="${escText(href)}" class="sk-fade" style="--d:${fade}">${inner}</a>`
      : `  <g class="sk-fade" style="--d:${fade}">${inner}</g>`);
  });
  rows.forEach((r, i) => {
    const y = M_HEAD_H + i * M_ROW_H + M_ROW_H / 2;
    const name = escText(wrapLabel(visibleCopy(r.label), grouped ? 26 : 27, 1)[0] ?? r.key);
    const tail = grouped ? `<tspan class="m xs t" dx="7">${r.chains.length}</tspan>` : '';
    const chainHref = grouped ? null : pageHref(src, 'chain', r.chains[0].name);
    const label = `<text x="${M_LABEL_W - 10}" y="${y + 4}" text-anchor="end" class="sm b">${name}${tail}</text>`;
    parts.push(chainHref
      ? `  <a href="${escText(chainHref)}"><title>${escText(visibleCopy(r.label))}</title>${label}</a>`
      : `  ${label}`);
    cols.forEach((col, c) => {
      const n = counts[i][c];
      const used = new Set(col.chains.map((ch) => ch.name));
      const names = r.chains.filter((ch) => used.has(ch.name)).map((ch) => visibleCopy(ch.title ?? ch.name));
      const tip = n ? `${grouped ? `${visibleCopy(r.key)}: ` : ''}${names.join('; ')} run through ${visibleCopy(col.name)}` : '';
      parts.push(matrixCell(colX(c), y, n, max, grouped, tip, Math.min(i * 0.06 + c * 0.05, popMax)));
    });
  });
  const ty = M_HEAD_H + rows.length * M_ROW_H + M_ROW_H / 2;
  parts.push(`  <text x="${M_LABEL_W - 10}" y="${ty + 4}" text-anchor="end" class="xs s">Chains using the tool</text>`);
  cols.forEach((col, c) => {
    parts.push(`  <text x="${colX(c)}" y="${ty + 4}" text-anchor="middle" class="m sm t">${col.chains.length}</text>`);
  });
  return {
    body: parts.join('\n'),
    width: M_LABEL_W + cols.length * M_PITCH + M_RIGHT,
    height: M_HEAD_H + (rows.length + 1) * M_ROW_H + 10,
    grouped,
  };
}

/**
 * The region body for one page. ≥1 chain → chain-use matrix (columns are the
 * tools the page covers, rows are the chains or chain domains, each cell counts
 * the chains running through that tool); 0 chains → the tool-landscape scene
 * (each tool a station). Same timing budget either way (spec §4).
 * sceneFigure() is the ONLY wrapper (it throws without id/viewBox/title/desc —
 * the accessibility premise, mechanically enforced).
 *
 * THIRD VERDICT (HUBSCENE-ZEROSTATION-SKIP-1): 0 chains AND 0 tools → this
 * function is never called; applyToPage OMITS the region entirely. A rendered
 * zero-station figure is title/desc/caption around an empty body — an empty
 * box on the page (11 pages shipped that way) — not a scene. --check alarms
 * on any page still carrying one.
 */
export function renderRegion(rel, src, cat, timings) {
  const { chains, tools } = pageSceneData(rel, src, cat);
  const clamp = delayClamps(timings);
  const subject = pageSubject(src);
  const isChains = chains.length >= 1;
  const id = `hub-scene-${rel.split('/').pop().replace(/\.html$/, '')}`;
  let body;
  let width;
  let height;
  let grouped = false;
  if (isChains) {
    ({ body, width, height, grouped } = matrixBody(src, chains, tools, clamp));
  } else {
    const rows = Math.max(1, Math.ceil(tools.length / PER_ROW));
    width = sceneWidth(Math.min(PER_ROW, tools.length));
    height = TOP + rows * ROW_H;
    body = tools.map((t, i) => toolStation(SIDE + (i % PER_ROW) * PITCH, TOP + Math.floor(i / PER_ROW) * ROW_H,
      visibleCopy(t.name), Math.floor(i / PER_ROW), i % PER_ROW, clamp)).join('\n');
  }
  const title = isChains ? `${subject} chain and tool matrix` : `${subject} tool landscape`;
  const rowWord = grouped ? 'rows group the chains by domain' : 'each row is one chain';
  const desc = isChains
    ? `Matrix for ${subject}: columns are the tools this guide covers, ${rowWord}, and a filled cell marks a chain that runs through the tool.`
    : `Each station is one tool this guide builds on.`;
  const caption = isChains
    ? `Chain and tool matrix for ${escText(subject)}: each column is a tool this guide covers, most used first, ${rowWord}, and a brighter cell means more of that row's chains run through the tool. Hover a cell to list them.`
    : `Tool landscape of ${escText(subject)}: each station is one tool this guide builds on.`;
  const figure = sceneFigure({
    id,
    viewBox: `0 0 ${width} ${height}`,
    minWidth: Math.min(isChains ? 720 : 640, width),
    title,
    desc,
    caption,
    body,
    role: isChains ? 'group' : 'img',
  });
  // A small scene must not stretch to the container: cap the frame at 115% of
  // the scene's own width and centre it, so a two-column matrix keeps legible
  // type. A wide scene (width * 1.15 above the container) is unaffected.
  const framed = figure.replace(SCROLL_OPEN,
    `<div class="sk-scroll" style="max-width:${Math.round(width * 1.15)}px;margin-left:auto;margin-right:auto">`);
  const centred = framed.replace(CAPTION_OPEN, CAPTION_OPEN_CENTERED);
  const container = heroContainerClass(src);
  return assertNoFork(container ? `<div class="${container}">\n${centred}\n</div>` : centred);
}

/**
 * The page's own hero container class, when the scene lands OUTSIDE it.
 * A `<section class="hero">` page closes its full-bleed band before the scene
 * slot, so a bare figure runs edge to edge while the hero text above sits in
 * the page's inset column. Wrapping the figure in the hero's own inner class
 * (`container`, `wrap`) reuses the page's measure and gutter, so the scene
 * lines up with the hero on every page, whatever width that page chose.
 * Returns null (no wrapper) when the hero is a `<div class="hero">` (already
 * inside the page wrapper), a doc-title page, or when the inner element has
 * no max-width rule in the page's own CSS: never a guessed class.
 */
export function heroContainerClass(src) {
  const m = /<section class="hero">\s*<div class="([a-z0-9-]+)(?:\s[^"]*)?">/.exec(src);
  if (!m) return null;
  const rule = new RegExp(`\\.${m[1]}\\s*\\{[^}]*max-width\\s*:`).test(src);
  return rule ? m[1] : null;
}

/** Hub-scene captions sit centred under the figure. The kit's .sk-cap is
 *  left-aligned at a 780px measure, shared by hand-authored explainers, so
 *  the centring is an inline style on THIS writer's figcaption only. */
const CAPTION_OPEN = '<figcaption class="sk-cap">';
const SCROLL_OPEN = '<div class="sk-scroll">';
const CAPTION_OPEN_CENTERED = '<figcaption class="sk-cap" style="margin-left:auto;margin-right:auto;text-align:center">';

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
 * One page's next bytes. PURE. Returns { html, problem, removed }:
 *   problem  — a reported SKIP (no insertion point, a broken marker pair, or
 *              a missing <style>/</head> to host the kit copies)
 *   removed  — true when a stale zero-station region was stripped
 * The three marker systems on a generated hub page, one owner each (spec D1):
 *   HUB-SCENE pair            → THIS writer (region replaced wholesale, or
 *                               removed on a zero-station page)
 *   SCENE-KIT CSS + JS pairs  → laid down on first insert, byte-identically
 *                               to sync-scene-kit's builders; their CONTENT
 *                               stays owned by sync-scene-kit (--check holds
 *                               the copies to the lib forever after). On a
 *                               zero-station page the pairs are left exactly
 *                               as found — kit copies without a scene are
 *                               gate-legal, and stripping another writer's
 *                               markers is not this writer's call.
 */
export function applyToPage(rel, src, cat, timings) {
  const scene = pageSceneData(rel, src, cat);
  if (scene.chains.length === 0 && scene.tools.length === 0) {
    const hub = removeRegion(src, HUB_SCENE_BEGIN, HUB_SCENE_END);
    return hub.problem
      ? { html: src, problem: hub.problem, removed: false }
      : { html: hub.html, problem: null, removed: hub.present };
  }
  const slot = insertPoint(src, rel);
  if (slot.problem) return { html: src, problem: slot.problem, removed: false };
  const region = `${HUB_SCENE_BEGIN}\n${renderRegion(rel, src, cat, timings)}\n${HUB_SCENE_END}`;
  let out;
  const hub = replaceRegion(src, HUB_SCENE_BEGIN, HUB_SCENE_END, region);
  if (hub.problem) return { html: src, problem: hub.problem, removed: false };
  out = hub.present ? hub.html : src.slice(0, slot.at) + '\n' + region + src.slice(slot.at);
  const css = replaceRegion(out, CSS_START, CSS_END, cssRegion());
  if (css.problem) return { html: src, problem: css.problem, removed: false };
  out = css.present ? css.html
    : out.slice(0, out.indexOf('</style>')) + '\n' + cssRegion() + '\n' + out.slice(out.indexOf('</style>'));
  const js = replaceRegion(out, JS_START, JS_END, jsRegion());
  if (js.problem) return { html: src, problem: js.problem, removed: false };
  out = js.present ? js.html
    : out.slice(0, out.indexOf('</head>')) + '\n' + jsRegion() + '\n' + out.slice(out.indexOf('</head>'));
  return { html: out, problem: null, removed: false };
}

// ── CLI runs ───────────────────────────────────────────────────────────────

function run({ apply }) {
  const cat = catalog();
  const timings = parseKitTimings(SCENE_KIT_CSS);
  const result = { targets: [], changed: [], skipped: [], removed: [] };
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
    if (next.removed) result.removed.push(rel);
    if (apply) writeFileSync(resolve(REPO, rel), next.html, 'utf8');
  }
  return result;
}

function report(result, check) {
  if (check) {
    const problems = [];
    if (result.changed.length) problems.push(`${result.changed.length} hub scene region(s) differ from the assembled catalog (${result.removed.length} of them zero-station pages whose region must be OMITTED): ${result.changed.slice(0, 12).join(', ')}${result.changed.length > 12 ? ', …' : ''}`);
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
  if (result.removed.length) console.log(`gen-hub-scenes: removed ${result.removed.length} stale zero-station region(s) (an empty figure is a defect, HUBSCENE-ZEROSTATION-SKIP-1): ${result.removed.slice(0, 12).join(', ')}${result.removed.length > 12 ? ', …' : ''}`);
  if (result.skipped.length) console.log(`gen-hub-scenes: skipped ${result.skipped.length} (the --check gate reports these): ${result.skipped.map((s) => s.file).join(', ')}`);
}

// ── Self-test: the checker proved RED before it is trusted GREEN (SO #34c) ──

function fixturePage(toolHref) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Fixture hub</title>
<style>
:root{--bg:#080E1A}
.hero h1{font-size:2rem}
</style>
</head>
<body>
<nav><a href="../index.html">home</a></nav>
<section class="hero">
  <p class="hero-desc">A fixture hub with <a href="${toolHref}">one tool</a> and <a href="../chaingraph/art-43-example-sibling.html">a sibling</a>.</p>
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
  // The fixture's tool link must resolve in the REAL catalog (a hand-typed
  // example slug like art-42-example-tool is NOT a registered tool_id — the
  // old fixture was secretly zero-station and would have false-greened the
  // insert path once zero-station pages omit the region). Data-derived, SO
  // #0b: the fixture takes its slug from the catalog, never from a hand.
  const realSlug = cat.nodes.map((n) => n.tool_id).sort()[0];
  const src = fixturePage(`../tools/${realSlug}.html`);

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
  a('the caption is centred (inline style on the hub-scene figcaption only)',
    once.html.includes(CAPTION_OPEN_CENTERED) && !once.html.includes(CAPTION_OPEN));
  // Width: a section.hero page whose inner element has a max-width rule gets
  // the figure wrapped in that class; every other shape is left bare.
  const heroSection = '<section class="hero"><div class="container"><h1>x</h1></div></section>';
  const styled = '<style>.container{max-width:1100px;margin:0 auto;padding:0 2rem}</style>';
  a('width: section.hero + container rule wraps the figure in that container',
    heroContainerClass(`${styled}${heroSection}`) === 'container'
    && renderRegion(rel, `${styled}${heroSection}<a href="../tools/${realSlug}.html">t</a>`, cat, timings)
      .startsWith('<div class="container">\n<figure'));
  a('width: the scroll frame is capped at 115% of the scene width and centred',
    /<div class="sk-scroll" style="max-width:\d+px;margin-left:auto;margin-right:auto">/.test(once.html)
    && !once.html.includes(SCROLL_OPEN));
  a('width: no max-width rule means no wrapper (never a guessed class)', heroContainerClass(heroSection) === null);
  a('width: a div.hero page is left bare (already inside the page wrapper)',
    heroContainerClass('<style>.wrap{max-width:1000px}</style><div class="wrap"><div class="hero"><div class="eyebrow">x</div></div></div>') === null);
  a('width: the fixture page (no inner div) renders a bare figure',
    renderRegion(rel, src, cat, timings).startsWith('<figure'));
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
  const mutant = once.html.replace('chain and tool matrix', 'chain and tool matriz');
  if (mutant === once.html) fails.push('RED control: mutation target not found in the region');
  const red = applyToPage(rel, mutant, cat, timings);
  a('RED: a hand-edited region byte is reported as drift', red.problem === null && red.html !== mutant);

  // 4. RED: a REGION-OWING page (a catalog tool link) with no hero and no
  //    doc-title is a reported SKIP (and --check exits 1 on it) — never a
  //    silent pass. Zero-link pages need no slot at all: they are the
  //    zero-station verdict, covered in 5b below.
  const anchorlessSrc = '<html><body><main><p>no anchor here, but a tool: <a href="../tools/' + realSlug + '.html">x</a></p></main></body></html>';
  const anchorless = applyToPage(rel, anchorlessSrc, cat, timings);
  a('RED: an anchorless page is a reported SKIP', anchorless.problem !== null && anchorless.html === anchorlessSrc);

  // 5. RED: half the HUB-SCENE marker pair is a problem, never a silent pass.
  const half = applyToPage(rel, once.html.replace(HUB_SCENE_END, ''), cat, timings);
  a('RED: half a HUB-SCENE marker pair is a problem', half.problem !== null && /half a marker pair/.test(half.problem));

  // 5b. Zero-station page (HUBSCENE-ZEROSTATION-SKIP-1): links no catalog
  //     tool → the region is OMITTED, never an empty-box figure. The bare
  //     page's bytes come back untouched; a STALE region (the shape 11 pages
  //     shipped) is removed byte-exactly, including the inserter's leading
  //     newline; and half a pair is still a reported problem.
  const zeroSrc = fixturePage('token-standards-hub.html');
  const zero1 = applyToPage(rel, zeroSrc, cat, timings);
  a('zero-station: no problem', zero1.problem === null);
  a('zero-station: the page is untouched (region omitted, not an empty figure)',
    zero1.html === zeroSrc && !zero1.html.includes(HUB_SCENE_BEGIN) && zero1.removed === false);
  const zero2 = applyToPage(rel, zero1.html, cat, timings);
  a('zero-station: a second pass is byte-identical', zero2.problem === null && zero2.html === zeroSrc);
  const staleRegion = `${HUB_SCENE_BEGIN}\n${renderRegion(rel, zeroSrc, cat, timings)}\n${HUB_SCENE_END}`;
  a('RED setup: the stale region is the empty-box shape (title, zero station groups)',
    /<title id="hub-scene-fixture-hub-t">/.test(staleRegion) && !/<g class="sk-pop"/.test(staleRegion));
  const heroClose = zeroSrc.indexOf('</section>') + '</section>'.length;
  const staleSrc = zeroSrc.slice(0, heroClose) + '\n' + staleRegion + zeroSrc.slice(heroClose);
  const zero3 = applyToPage(rel, staleSrc, cat, timings);
  a('zero-station: a stale region is removed byte-exactly back to the bare page',
    zero3.problem === null && zero3.removed === true && zero3.html === zeroSrc);
  const zero4 = applyToPage(rel, staleSrc.replace(HUB_SCENE_END, ''), cat, timings);
  a('zero-station: half a marker pair is a problem', zero4.problem !== null && /half a marker pair/.test(zero4.problem));

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
    chains: Array.from({ length: 1000 }, (_, i) => ({ name: `fixture-chain-${i}`, title: `Fixture chain number ${i}`, domain: `Fixture domain ${i % 40}`, steps: [{ tool_id: realSlug }] })),
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
  console.log(`✓ gen-hub-scenes selftest: first insert lays region + byte-identical kit copies, second pass byte-identical, hand-edited region RED, anchorless page SKIPs, half pair RED, zero-station page omitted + stale region removed byte-exactly + half pair RED, no-fork guard throws, ${samples.length} real extremes (${samples.map((r) => `${chainCount(r)} chains`).join(' / ')}) + a 1,000-station clamp proof within ${(MAX_END_MS / 1000).toFixed(0)}s, all ${pages.length} pages anchored.`);
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
