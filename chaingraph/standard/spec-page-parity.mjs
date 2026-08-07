#!/usr/bin/env node
/**
 * spec-page-parity.mjs — SSOT gate: the rendered spec page may not drift from SPEC.md.
 *
 * SPEC.md (this directory) is the normative single source of truth; the public
 * page chaingraph/openchain-graph-spec.html is a rendering of it. This gate
 * fails the build when the two disagree structurally:
 *
 *   1. Every canonical `## §ID` heading in SPEC.md must have exactly one page
 *      section whose sec-num eyebrow carries that §ID, and exactly one TOC
 *      entry tagged §ID — UNLESS §ID is listed in the baseline (see below).
 *   2. The page may not display a § ID that SPEC.md does not define
 *      (no invented sections).
 *   3. Every TOC link must resolve to an existing section id on the page,
 *      and the § tag shown in the TOC must match the § shown in the target
 *      section's eyebrow.
 *   4. Every page section id must be reachable from the TOC (no orphan
 *      sections invisible to readers).
 *
 * ID SHAPE (SPECPAGE-GATE-FIX-1, 2026-08-07): SPEC.md headings are not all
 * numeric — `## §12 …` and `## §HASHRES-1 …` and `## §SIDECAR …` all occur.
 * The canonical-heading match captures the ID as `\S+` (whatever non-space
 * token follows §), not a hand-typed list of shapes, so any future ID
 * pattern is picked up automatically. Numeric IDs sort numerically; others
 * sort lexicographically after all numerics.
 *
 * BASELINE / RATCHET: `spec-page-parity-baseline.json` in this directory
 * lists §IDs that are known-missing from the page RIGHT NOW (a debt
 * register written the day this gate started seeing lettered/named IDs,
 * SPECPAGE-GAP-SCOPE-1 measured 11). A baselined ID may have zero page/TOC
 * presence without failing the gate; any OTHER inconsistency (e.g. present
 * on the page but missing from the TOC, or vice versa) still fails, because
 * that's a new kind of drift, not the known "not backfilled yet" gap. This
 * is a debt register, not a permanent exemption — SPECPAGE-BACKFILL-PROGRAM
 * removes IDs from it as sections are backfilled; regenerate with
 * `--update-baseline` after a backfill lands (it recomputes from actual
 * page state, never hand-edited).
 *
 * Version-string parity is spec-version-consistency.mjs; this gate is about
 * section structure. Registered in the SPEC.md §15 rule-to-gate matrix, so
 * spec-gate-coverage.mjs enforces this file's existence.
 *
 * History: 2026-07-02 audit found three disagreeing numbering systems on the
 * page (ordinal TOC, positional eyebrows, canonical §s) and two canonical
 * sections (§0, §5, §15) with no page presence at all. PR #101 + this gate's
 * PR reconciled them; the gate keeps them reconciled. 2026-08-07: widened
 * from numeric-only IDs to any §ID shape + added the baseline ratchet
 * (SPECPAGE-GATE-FIX-1 — SPECPAGE-GAP-SCOPE-1 found the numeric-only regex
 * was blind to 11/36 sections, ~17% of SPEC.md, the entire time).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC_MD = resolve(HERE, 'SPEC.md');
const PAGE = resolve(HERE, '..', 'openchain-graph-spec.html');
const BASELINE_PATH = resolve(HERE, 'spec-page-parity-baseline.json');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');

const specMd = readFileSync(SPEC_MD, 'utf8');
const page = readFileSync(PAGE, 'utf8');

// Sort helper: numeric IDs first (numeric order), then lettered/named IDs (lexical).
function sortIds(ids) {
  return [...ids].sort((a, b) => {
    const na = /^\d+$/.test(a), nb = /^\d+$/.test(b);
    if (na && nb) return Number(a) - Number(b);
    if (na !== nb) return na ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

// 1. Canonical § set from SPEC.md `## §ID` headings — ID = whatever token
//    follows §, not a hand-typed shape list.
const canonical = new Set();
for (const m of specMd.matchAll(/^## §(\S+)/gm)) canonical.add(m[1]);

// 2. Page sections: pair each `<div class="section" id="...">` with the first
//    sec-num eyebrow that follows it.
const sections = []; // { id, sec: string|null }
const sectionRe = /<div class="section"[^>]*\bid="([^"]+)"[^>]*>/g;
const starts = [];
for (const m of page.matchAll(sectionRe)) starts.push({ id: m[1], idx: m.index });
for (let i = 0; i < starts.length; i++) {
  const end = i + 1 < starts.length ? starts[i + 1].idx : page.length;
  const body = page.slice(starts[i].idx, end);
  const eyebrow = body.match(/<div class="sec-num">([^<]*)<\/div>/);
  const tag = eyebrow ? eyebrow[1].match(/§([A-Za-z0-9-]+)\b/) : null;
  sections.push({ id: starts[i].id, sec: tag ? tag[1] : null });
}

// 3. TOC entries: href target + § tag (· means informative/unnumbered).
const toc = []; // { target, sec: string|null }
for (const m of page.matchAll(/<li><a href="#([^"]+)"><span class="toc-sec">([^<]*)<\/span>/g)) {
  const tag = m[2].match(/§([A-Za-z0-9-]+)\b/);
  toc.push({ target: m[1], sec: tag ? tag[1] : null });
}

// --- baseline: §IDs allowed to have zero page/TOC presence right now ---
const baseline = existsSync(BASELINE_PATH)
  ? new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).missing || [])
  : new Set();

const errors = [];

// Check 1: every canonical § present exactly once in eyebrows and TOC,
// unless it's a baselined known-missing ID with zero presence anywhere.
const pageSecs = sections.filter(s => s.sec !== null).map(s => s.sec);
const tocSecs = toc.filter(t => t.sec !== null).map(t => t.sec);
const stillMissing = []; // wholly absent (0 page, 0 TOC) — baseline-eligible, never itself an error
for (const id of sortIds(canonical)) {
  const inPage = pageSecs.filter(x => x === id).length;
  const inToc = tocSecs.filter(x => x === id).length;
  if (inPage === 0 && inToc === 0) {
    stillMissing.push(id);
    // In normal (non-update) mode, wholly-missing is only tolerated when the
    // committed baseline already names it — an un-baselined new gap still fails.
    if (!UPDATE_BASELINE && !baseline.has(id)) {
      errors.push(`SPEC.md defines §${id} but it has 0 presence on the page and 0 in the TOC, and is not in the baseline (new gap — add content or run --update-baseline only if this is genuinely pre-existing debt)`);
    }
    continue;
  }
  if (inPage !== 1) errors.push(`SPEC.md defines §${id} but the page has ${inPage} section(s) labeled §${id} (want exactly 1)`);
  if (inToc !== 1) errors.push(`SPEC.md defines §${id} but the TOC has ${inToc} entr(ies) tagged §${id} (want exactly 1)`);
}

// Check 2: no invented § IDs on the page or in the TOC.
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

if (UPDATE_BASELINE) {
  if (errors.length) {
    console.error(`spec-page-parity --update-baseline: refusing — ${errors.length} non-baseline error(s) exist first:\n  ` + errors.join('\n  '));
    process.exit(1);
  }
  writeFileSync(BASELINE_PATH, JSON.stringify({ missing: sortIds(stillMissing) }, null, 2) + '\n');
  console.log(`spec-page-parity: baseline written — ${stillMissing.length} known-missing §ID(s): ${stillMissing.join(', ')}`);
  process.exit(0);
}

if (errors.length) {
  console.error(`spec-page-parity: ${errors.length} FAILURE(s) — the rendered spec page drifted from SPEC.md:\n  ` + errors.join('\n  '));
  console.error('\nSPEC.md is the SSOT. Fix the page (section eyebrow, TOC entry, or add the missing section); never renumber SPEC.md to match the page.');
  console.error(`\nBaselined known-missing (debt, not exempted from this message): ${sortIds(baseline).join(', ') || '(none)'}`);
  process.exit(1);
}
console.log(`spec-page-parity: OK (${canonical.size} canonical §s checked; ${stillMissing.length} baselined known-missing; ${sections.length} page sections all TOC-reachable; no invented IDs).`);
