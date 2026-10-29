#!/usr/bin/env node
/**
 * page-chrome-anchor.mjs — WRITER-CANON-ALIGN-1
 *
 * THE one shared canonical-position table for both chrome writers
 * (check-ask-agent-block.mjs and check-a11y-tree.mjs). Before this module each
 * writer held its own private copy of the insertion rules; the ask-agent writer
 * alone carried the A11Y-abutment relocation (its MAIN-REGEN-SCRIPTS-VERIFY-
 * HEAL-1 convergence rule) while the a11y writer relied on the order falling
 * out implicitly — two tables that can drift, which is exactly how the art-561
 * class of incident happens (an a11y-side relocation moved bytes a downstream
 * eligibility consult read; healed only by the #2253 byte restore).
 *
 * THE CANONICAL LAYOUT (the #2250-settled, a11y-canonical stack, top to bottom
 * at the page tail):
 *
 *   ...page body...
 *   <!-- ASK-AGENT:BEGIN ... --> ... <!-- ASK-AGENT:END -->   (ask-agent block)
 *   <!-- A11Y-TREE:BEGIN ... --> ... <!-- A11Y-TREE:END -->   (a11y runtime region)
 *   <footer> ... (or, when no non-script footer exists, </body>)
 *
 * Rules, in evaluation order:
 *   1. The anchor is the FIRST `<footer>` that is NOT inside a `<script>` span;
 *      when no such footer exists, the LAST `</body>`. (Never first-match on
 *      `</body>` — several pages embed the literal '</body>' inside script
 *      strings, measured: art-373 etc. Some pages build their whole body inside
 *      a template literal in a script that itself contains '<footer>'
 *      (measured: art-139/140/142/143) — injecting there breaks page parsing.)
 *   2. A writer emitting the ASK-AGENT block inserts ABOVE an A11Y-TREE region
 *      that directly abuts the anchor (only whitespace between the region's END
 *      marker and the anchor). `aboveA11yRegion: true` selects this — it is the
 *      ask-agent writer's mode. Without it, back-to-back whole-tree write runs
 *      relocate the block on every run (each strips only its own region, trims
 *      trailing whitespace, and re-inserts before the footer), so the emitted
 *      bytes depended on writer invocation order. Inserting ABOVE the abutting
 *      A11Y region makes both invocation orders converge on the same bytes.
 *   3. A writer emitting the A11Y-TREE region inserts AT the anchor itself —
 *      below any abutting ASK-AGENT block by construction, which IS the
 *      canonical order. `aboveA11yRegion: false` (the a11y writer's mode).
 *
 * Pure functions, no I/O. Both writers and their self-tests import from here;
 * neither carries a private copy of these rules anymore.
 */

export const A11Y_BEGIN = '<!-- A11Y-TREE:BEGIN ';
export const A11Y_END = '<!-- A11Y-TREE:END -->';

/** Every `<script>...</script>` span as [start, end) index pairs (case-
 *  insensitive, non-greedy) — the blindness set for anchor detection. */
export function scriptSpansOf(src) {
  const spans = [];
  const re = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
  let m;
  while ((m = re.exec(src)) !== null) spans.push([m.index, m.index + m[0].length]);
  return spans;
}

/** The canonical tail anchor per rule 1: the byte index of the first non-script
 *  `<footer>`, else the last `</body>`, else null (caller reports the page as
 *  unanchorable). */
export function chromeAnchorOf(src) {
  const spans = scriptSpansOf(src);
  const inScript = (i) => spans.some(([a, b]) => i >= a && i < b);
  let f = src.indexOf('<footer>');
  while (f !== -1) {
    if (!inScript(f)) return f;
    f = src.indexOf('<footer>', f + 1);
  }
  const body = src.lastIndexOf('</body>');
  return body === -1 ? null : body;
}

/** The canonical insertion index for a chrome writer emitting at the tail.
 *  `aboveA11yRegion: true` (ask-agent writer) applies rule 2: when an A11Y-TREE
 *  region directly abuts the anchor, insert above the region instead of at the
 *  anchor. Returns { index, rule } where `rule` names the fired table entry
 *  ('footer' | 'body' | 'above-abutting-a11y'), or null when the page has no
 *  anchor at all. */
export function chromeInsertionIndex(src, { aboveA11yRegion = false } = {}) {
  const anchor = chromeAnchorOf(src);
  if (anchor === null) return null;
  const ruleOf = (i) => (src.startsWith('<footer>', i) ? 'footer' : 'body');
  if (!aboveA11yRegion) return { index: anchor, rule: ruleOf(anchor) };
  const tail = src.slice(0, anchor);
  const aAt = tail.lastIndexOf(A11Y_BEGIN);
  if (aAt !== -1) {
    const aEnd = tail.indexOf(A11Y_END, aAt);
    if (aEnd !== -1 && /^\s*$/.test(tail.slice(aEnd + A11Y_END.length))) {
      return { index: aAt, rule: 'above-abutting-a11y' };
    }
  }
  return { index: anchor, rule: ruleOf(anchor) };
}
