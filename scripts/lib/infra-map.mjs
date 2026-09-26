#!/usr/bin/env node
/**
 * scripts/lib/infra-map.mjs — INFRA-MAP-COPY-1 (2026-09-21 humanize pass).
 *
 * Shared display-copy + chrome layer for the two map pages rendered from
 * data/infra-registry.json: infrastructure.html (gen-infrastructure-page.mjs)
 * and hub-for-hubs.html (gen-hub-for-hubs-page.mjs).
 *
 * The registry is DERIVED (gen-infra-registry.mjs scrapes every page's <title>
 * and meta description), so its raw strings are whatever the source pages
 * publish: SEO-stuffed title suffixes ("... · AINumbers.co",
 * "..., OpenChainGraph, AINumbers"), em-dash artifacts left by an earlier
 * sweep ("Clause , Clause"), and descriptions that arrive truncated or empty
 * because the SOURCE page ships them that way. None of that may render on the
 * map pages (CONTRACT §1.4 copy hallmarks; AI-hallmark sweep).
 *
 * Three layers, applied in order:
 *   1. displayTitle()  — deterministic cleanup of a scraped title: entity
 *                        decode, trailing site/series suffix strip, the
 *                        " , " em-dash artifact repaired to ": ", leading
 *                        site-name prefix strip.
 *   2. overrides       — data/infra-copy-overrides.json, an AUTHORED
 *                        per-path { title?, description? } table for rows a
 *                        mechanical pass cannot fix (truncated or empty
 *                        source descriptions). Keys are validated against
 *                        the registry: an override for a page that no longer
 *                        exists is a hard error, so the table can never mask
 *                        a removed page.
 *   3. sanitizeCopy()  — last-touch scrub before anything renders (em-dash
 *                        to colon, the "adjudication" copy-ban word).
 *
 * renderDescription() enforces the no-empty-card rule: a card that would
 * render without a description throws, so a future husk cannot ship on
 * either map page.
 *
 * Nothing here mutates data/infra-registry.json; the registry stays a pure
 * scrape. All cleanup is display-time.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hubCountsFromHtml, hubCountPhrase, stripHubCountNumeral } from '../counts.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..', '..');
const OVERRIDES_REL = 'data/infra-copy-overrides.json';

/**
 * Decode the handful of named entities the registry's title scrape can leave
 * behind (titleOf decodes &amp;/&middot;/&#NNN; but not the full HTML table).
 */
function decodeEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&middot;/g, '\u00B7')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));
}

/**
 * Deterministic display-title cleanup. Strips the SEO suffixes source pages
 * append to their <title> (site name, standard name, explainer-series tags),
 * repairs the " , " artifact the legacy em-dash sweep left in source titles,
 * and drops a leading site-name prefix. En-dash RANGES survive (allowed by
 * CONTRACT §1.4); a spaced em-dash in a title is subtitle-shaped and becomes
 * a colon.
 */
export function displayTitle(raw) {
  let t = decodeEntities(raw);
  // Applied repeatedly: suffixes chain ("... · Autonity Explainer E-05 ·
  // AINumbers.co" only reveals the series tag once the site tag is gone).
  const suffixes = [
    /\s*·\s*OpenChainGraph\s*·\s*AINumbers\.co\s*$/i,
    /\s*[—–]\s*OpenChainGraph\s*·\s*AINumbers(\.co)?\s*$/i,
    /\s*·\s*Autonity\s+Explainer\s+E-\d+\s*$/i,
    /\s*·\s*OpenChainGraph\s+Suite\s*$/i,
    /\s*·\s*Cat-\d+\s*$/i,
    /\s*·\s*AINumbers\.co\s*$/i,
    /\s*·\s*OpenChainGraph\s*$/i,
    /\s*[—–]\s*AINumbers(\.co)?\s*$/i,
    /\s*·\s*AINumbers\s*$/i,
    /,\s*OpenChainGraph,\s*AINumbers\s*$/i,
    /,\s*OpenChainGraph\s*$/i,
    /\s*,\s*AINumbers\s*$/i,
    // Explainer-series tails ("The Mandate Loop, an OpenChainGraph Explainer",
    // "How OpenChainGraph Works, Interactive Explainer"): a comma fragment in a
    // card heading reads as an AI tell (Tim, 2026-09-26), and the card already
    // sits in the Learn section.
    /,\s*(?:an\s+)?(?:OpenChainGraph\s+|Interactive\s+)?Explainer\s*$/i,
  ];
  for (let pass = 0; pass < 3; pass++) {
    const before = t;
    for (const re of suffixes) t = t.replace(re, '');
    if (t === before) break;
  }
  t = t.replace(/^AINumbers\.co:\s*/i, '');
  // The " , " artifact only: space BEFORE the comma (normal lists read "A, B"
  // with the space after). Never touch "A, B" — that would splice real lists.
  t = t.replace(/ , /g, ': ').replace(/ ,(?=\S)/g, ', ');
  t = t.replace(/\s{2,}/g, ' ')
       .replace(/[\s:,·]+$/g, '')
       .trim();
  return t;
}

/**
 * Last-touch scrub for sourced copy (CONTRACT §1.4: no em-dashes in visible
 * text; "adjudication" sits on the check-copy-hallmarks ban list). A spaced
 * em-dash separates clauses, so it renders as a colon rather than the old
 * ", " which produced "Clause , Clause" splices.
 */
export function sanitizeCopy(s) {
  return String(s || '')
    .replace(/\s*—\s*/g, ': ')
    .replace(/\s+--\s+/g, ': ')
    .replace(/adjudicat\w*/gi, 'review')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Load the authored display-copy overrides. Throws if the file is missing. */
export function loadOverrides() {
  return JSON.parse(readFileSync(resolve(REPO, OVERRIDES_REL), 'utf8'));
}

/**
 * Every override key must name a live registry row. An override for a page
 * that has left the registry is stale by definition: fail loudly instead of
 * silently carrying dead copy (and never let an override CREATE a card).
 */
export function validateOverrides(overrides, registry) {
  const paths = new Set(registry.map(r => r.path));
  const stale = Object.keys(overrides)
    .filter(k => k !== '_comment') // authored note, not an override
    .filter(k => !paths.has(k));
  if (stale.length) {
    throw new Error(
      `infra-copy-overrides.json names ${stale.length} page(s) that are not in the registry ` +
      `(deleted, renamed, or re-categorized?): ${stale.join(', ')}. Remove or re-point them.`);
  }
}

// hubDirFor — same two families gen-infra-registry.mjs's hubDescription walks,
// matched off the registry's own rel path. Re-stated here (the original is a
// module local) because an OVERRIDDEN hub description must re-derive its
// "(N tools / N ChainGraph nodes)" phrase from the hub page at render time:
// the phrase is computed, never hand-typed, so an override cannot let a hub
// card's count go stale.
function hubDirFor(rel) {
  if (rel.startsWith('guides/') && rel.endsWith('-hub.html')) return 'guides';
  if (rel.startsWith('chaingraph/guide-') && rel.endsWith('.html')) return 'chaingraph';
  return null;
}

const hubHtmlCache = new Map();
function hubPageHtml(relPath) {
  if (!hubHtmlCache.has(relPath)) {
    hubHtmlCache.set(relPath, readFileSync(resolve(REPO, relPath), 'utf8'));
  }
  return hubHtmlCache.get(relPath);
}

/** Capitalize a description's first letter (several scraped descriptions start lowercase). */
function sentenceCase(s) {
  return s.replace(/^([a-z])/, (c) => c.toUpperCase());
}

/**
 * Render a card description for one registry row.
 *   override wins → recomputed hub-count phrase appended for hub-family rows
 *   no override   → the registry's scraped description as-is
 * A card that would render with NO description throws: every card on a map
 * page carries at least one line of real copy (2026-09-21 humanize pass;
 * the QR-preview / spec / PROV-DM husks are why this is a hard rule).
 */
export function renderDescription(row, overrides) {
  const ov = overrides[row.path];
  if (ov && ov.description) {
    let base = stripHubCountNumeral(ov.description);
    const dir = hubDirFor(row.path);
    if (dir) {
      const phrase = hubCountPhrase(hubCountsFromHtml(hubPageHtml(row.path), dir));
      if (phrase) base = `${base} (${phrase})`.trim();
    }
    const out = sentenceCase(sanitizeCopy(base));
    if (!out) throw new Error(`override description for ${row.path} renders empty`);
    return out;
  }
  const out = sentenceCase(sanitizeCopy(row.description || ''));
  if (!out) {
    throw new Error(
      `no description for ${row.path} — the source page's meta description is empty and ` +
      `data/infra-copy-overrides.json has no entry. Add one; empty cards do not ship.`);
  }
  return out;
}

/** Render a card title: authored override, else deterministic cleanup. */
export function renderTitle(row, overrides) {
  const ov = overrides[row.path];
  const t = sanitizeCopy(ov && ov.title ? ov.title : displayTitle(row.title));
  if (!t) {
    throw new Error(
      `display title for ${row.path} renders empty — the source <title> "${row.title}" is ` +
      `entirely strippable suffix. Fix the source title or add an override; empty cards do not ship.`);
  }
  return t;
}

/**
 * Copy the canonical page chrome out of start.html: head CSS, nav, footer,
 * footer CSS. Byte-style extraction, shared by both map generators so the
 * two pages can never wear different chrome. (Moved here from
 * gen-infrastructure-page.mjs when hub-for-hubs.html needed the same block.)
 */
export function extractChrome(startHtml) {
  const styleOpen = startHtml.indexOf('<style>');
  const styleClose = startHtml.indexOf('</style>');
  if (styleOpen === -1 || styleClose === -1) throw new Error('chrome: <style> not found in start.html');
  const css = startHtml.slice(styleOpen + '<style>'.length, styleClose);
  const navOpen = startHtml.indexOf('<nav aria-label="Site navigation">');
  const navClose = startHtml.indexOf('</nav>');
  if (navOpen === -1 || navClose === -1) throw new Error('chrome: nav not found in start.html');
  const nav = startHtml.slice(navOpen, navClose + '</nav>'.length);
  const fOpen = startHtml.indexOf('ROOT-FOOTER:START');
  const fClose = startHtml.indexOf('ROOT-FOOTER:END');
  if (fOpen === -1 || fClose === -1) throw new Error('chrome: ROOT-FOOTER sentinels not found in start.html');
  const footer = startHtml.slice(startHtml.indexOf('\n', fOpen) + 1, startHtml.lastIndexOf('\n', fClose));
  const footerCssOpen = startHtml.indexOf('ROOT-FOOTER-CSS:START');
  const footerCssClose = startHtml.indexOf('ROOT-FOOTER-CSS:END');
  const footerCss = startHtml.slice(startHtml.indexOf('\n', footerCssOpen) + 1, startHtml.lastIndexOf('\n', footerCssClose));
  return { css, nav, footer, footerCss };
}

export function readStartChrome() {
  return extractChrome(readFileSync(resolve(REPO, 'start.html'), 'utf8'));
}

export function readRegistry() {
  return JSON.parse(readFileSync(resolve(REPO, 'data', 'infra-registry.json'), 'utf8'));
}

/** HTML-escape text headed for markup or an attribute. */
export function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Render one fact-chip row from a registry row's facts map. */
export function factChips(row, factLabels) {
  const chips = Object.entries(row.facts || {}).filter(([, v]) => v)
    .map(([k]) => `<span class="fact-chip">${factLabels[k]}</span>`).join('');
  return chips ? `<div class="fact-row">${chips}</div>\n` : '';
}

/** Render one recipe-card <a> block for a registry row. */
export function renderCard(row, overrides, factLabels) {
  const chips = factChips(row, factLabels);
  return `      <a class="recipe-card" href="${esc(row.path)}">\n` +
    `        <div class="recipe-title">${esc(renderTitle(row, overrides))}</div>\n` +
    `        <div class="recipe-outcome">${esc(renderDescription(row, overrides))}</div>\n` +
    chips +
    `        <div class="recipe-go">Open</div>\n` +
    `      </a>\n`;
}

/** The persona-bar chip strip used as the jump nav on both map pages. */
export function jumpBar(label, links) {
  const chips = links.map(l => `      <a class="persona-btn" href="#${l.id}">${esc(l.label)}</a>`).join('\n');
  return `<div class="persona-bar" aria-label="Jump to section">
  <div class="persona-inner">
    <span class="persona-label">${esc(label)}</span>
${chips}
  </div>
</div>`;
}
