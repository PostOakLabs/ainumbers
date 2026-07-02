#!/usr/bin/env node
/**
 * spec-page-parity.mjs — SSOT gate: the rendered spec page may not drift from SPEC.md.
 *
 * SPEC.md (this directory) is the normative single source of truth; the public
 * page chaingraph/openchain-graph-spec.html is a rendering of it. This gate
 * fails the build when the two disagree structurally:
 *
 *   1. Every canonical `## §N` heading in SPEC.md must have exactly one page
 *      section whose sec-num eyebrow carries that §N, and exactly one TOC
 *      entry tagged §N.
 *   2. The page may not display a § number that SPEC.md does not define
 *      (no invented sections).
 *   3. Every TOC link must resolve to an existing section id on the page,
 *      and the § tag shown in the TOC must match the § shown in the target
 *      section's eyebrow.
 *   4. Every page section id must be reachable from the TOC (no orphan
 *      sections invisible to readers).
 *
 * Version-string parity is spec-version-consistency.mjs; this gate is about
 * section structure. Registered in the SPEC.md §15 rule-to-gate matrix, so
 * spec-gate-coverage.mjs enforces this file's existence.
 *
 * History: 2026-07-02 audit found three disagreeing numbering systems on the
 * page (ordinal TOC, positional eyebrows, canonical §s) and two canonical
 * sections (§0, §5, §15) with no page presence at all. PR #101 + this gate's
 * PR reconciled them; the gate keeps them reconciled.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC_MD = resolve(HERE, 'SPEC.md');
const PAGE = resolve(HERE, '..', 'openchain-graph-spec.html');

const specMd = readFileSync(SPEC_MD, 'utf8');
const page = readFileSync(PAGE, 'utf8');

// 1. Canonical § set from SPEC.md `## §N` headings.
const canonical = new Set();
for (const m of specMd.matchAll(/^## §(\d+)\b/gm)) canonical.add(Number(m[1]));

// 2. Page sections: pair each `<div class="section" id="...">` with the first
//    sec-num eyebrow that follows it.
const sections = []; // { id, sec: number|null }
const sectionRe = /<div class="section"[^>]*\bid="([^"]+)"[^>]*>/g;
const starts = [];
for (const m of page.matchAll(sectionRe)) starts.push({ id: m[1], idx: m.index });
for (let i = 0; i < starts.length; i++) {
  const end = i + 1 < starts.length ? starts[i + 1].idx : page.length;
  const body = page.slice(starts[i].idx, end);
  const eyebrow = body.match(/<div class="sec-num">([^<]*)<\/div>/);
  const sec = eyebrow ? (eyebrow[1].match(/§(\d+)\b/) ? Number(eyebrow[1].match(/§(\d+)\b/)[1]) : null) : null;
  sections.push({ id: starts[i].id, sec });
}

// 3. TOC entries: href target + § tag (· means informative/unnumbered).
const toc = []; // { target, sec: number|null }
for (const m of page.matchAll(/<li><a href="#([^"]+)"><span class="toc-sec">([^<]*)<\/span>/g)) {
  const tag = m[2].match(/§(\d+)\b/);
  toc.push({ target: m[1], sec: tag ? Number(tag[1]) : null });
}

const errors = [];

// Check 1: every canonical § present exactly once in eyebrows and TOC.
const pageSecs = sections.filter(s => s.sec !== null).map(s => s.sec);
const tocSecs = toc.filter(t => t.sec !== null).map(t => t.sec);
for (const n of [...canonical].sort((a, b) => a - b)) {
  const inPage = pageSecs.filter(x => x === n).length;
  const inToc = tocSecs.filter(x => x === n).length;
  if (inPage !== 1) errors.push(`SPEC.md defines §${n} but the page has ${inPage} section(s) labeled §${n} (want exactly 1)`);
  if (inToc !== 1) errors.push(`SPEC.md defines §${n} but the TOC has ${inToc} entr(ies) tagged §${n} (want exactly 1)`);
}

// Check 2: no invented § numbers on the page or in the TOC.
for (const s of sections) if (s.sec !== null && !canonical.has(s.sec)) errors.push(`page section id="${s.id}" is labeled §${s.sec}, which SPEC.md does not define`);
for (const t of toc) if (t.sec !== null && !canonical.has(t.sec)) errors.push(`TOC entry #${t.target} is tagged §${t.sec}, which SPEC.md does not define`);

// Check 3: TOC links resolve; TOC § tag matches target section's eyebrow §.
const byId = new Map(sections.map(s => [s.id, s]));
for (const t of toc) {
  const s = byId.get(t.target);
  if (!s) { errors.push(`TOC links #${t.target} but no section with that id exists`); continue; }
  if ((t.sec ?? null) !== (s.sec ?? null)) errors.push(`TOC tags #${t.target} as ${t.sec === null ? 'unnumbered' : '§' + t.sec} but the section eyebrow says ${s.sec === null ? 'unnumbered' : '§' + s.sec}`);
}

// Check 4: every section id is reachable from the TOC.
const tocTargets = new Set(toc.map(t => t.target));
for (const s of sections) if (!tocTargets.has(s.id)) errors.push(`section id="${s.id}" has no TOC entry (orphan section)`);

if (errors.length) {
  console.error(`spec-page-parity: ${errors.length} FAILURE(s) — the rendered spec page drifted from SPEC.md:\n  ` + errors.join('\n  '));
  console.error('\nSPEC.md is the SSOT. Fix the page (section eyebrow, TOC entry, or add the missing section); never renumber SPEC.md to match the page.');
  process.exit(1);
}
console.log(`spec-page-parity: OK (${canonical.size} canonical §s mirrored; ${sections.length} page sections all TOC-reachable; no invented numbers).`);
