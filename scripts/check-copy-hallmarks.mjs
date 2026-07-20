#!/usr/bin/env node
/**
 * check-copy-hallmarks.mjs — gate against AI-writing hallmarks in reader-facing copy.
 *
 * Hard-fails on:
 *   1. Em-dashes (—) in the human-visible text of any public HTML page
 *      (script/style/pre/code/HTML-comments excluded), and in chaingraph.json
 *      node/chain descriptions (served live to agents via MCP tools/list).
 *   2. Internal build jargon in visible HTML text: "Wave N", "W-A".."W-F"
 *      badge codes, standalone "D0". (chaingraph.json jargon is already gated
 *      by check-shipped-prose.mjs.)
 *   3. ANTI-AI-TELL copy (Tim 2026-07-11, PERMANENT — memory
 *      `feedback-anti-ai-tell-copy-ban`): italics-for-emphasis in body prose
 *      (<em>/<i> inside h1-h6 is an exempt title-styling design pattern used
 *      site-wide, e.g. "<h1>AP2 Mandate-Chain <em>Validator</em></h1>"),
 *      "not just X but" / "isn't just" / "more than just", dramatic-fragment
 *      openers ("The result?"), validation-phrasing ("you're not
 *      alone/imagining"), a filler-vocab denylist (delve, tapestry, testament
 *      to, quiet(ly) X, seamless, game-changer, elevate, unlock, "it's worth
 *      noting", "in today's fast-paced"), and decorative emoji in HEADERS.
 *
 * Baseline (scripts/copy-hallmarks-baseline.json) shields not-yet-swept files
 * for em-dash/jargon ONLY: a file may carry at most its baselined count, and
 * files absent from the baseline must be clean there. The category-3 ANTI-AI-
 * TELL patterns carry NO baseline — zero tolerance everywhere, since the WU
 * that added them swept and fixed every pre-existing hit first (no legacy
 * debt to shield).
 *
 * SCOPE DECISION — body-prose emoji is ADVISORY, not blocking: this suite
 * uses single-glyph emoji pervasively as functional UI chrome (save/export/
 * copy/search/currency icons, country-flag selectors, status markers) across
 * ~480 tool pages, predating this ban and indistinguishable from decorative
 * narrative emoji by regex alone once button/badge/control wrappers are
 * stripped. Header emoji (rare, genuinely decorative "🚀 Section Title" style)
 * IS blocking. Flipping body-prose emoji to blocking would force a suite-wide
 * icon-system redesign — a CONTRACT-level UI call for Tim to scope as its own
 * WU, not a copy fix folded into this one.
 *
 * Bold (category 4, Tim 2026-07-20 — memory project-ainumbers-copytell-refined-
 * pass): visible-text <b>/<strong> counts are BASELINE+RATCHET, same design and
 * same baseline file as em-dash — snapshotted via --update, no file may exceed
 * its baselined count, files absent from the baseline must be clean. Same
 * parser scope (script/style/pre/code/comments excluded) plus exemption for
 * h1-h6 (title-styling, same precedent as the italics rule) and
 * th/dt/label/legend/button (structural UI chrome, not prose — button is
 * already tag-stripped upstream).
 *
 * Advisory (never fails): the HIGH-PRECISION twotone family ("It is not X. It
 * is Y.") is its own named category — TWOTONE_HIGHPRECISION — kept advisory
 * for now but structured as a standalone regex/label so a future sweep
 * (COPYTELL-SWEEP-1) can flip it to blocking/zero-baseline once existing hits
 * are cleared (italics precedent). The rule-of-three adjective/phrase TRIAD
 * heuristic stays advisory PERMANENTLY — it false-positives on legitimate
 * 3-item lists too often for a hard gate, ever. Body-prose emoji counts (see
 * scope decision above) are also advisory-only.
 *
 * Usage:
 *   node scripts/check-copy-hallmarks.mjs            # gate (preflight + CI)
 *   node scripts/check-copy-hallmarks.mjs --update   # regenerate the em-dash/jargon/bold baseline
 *
 * Style rule of record: CONTRACT.md §1.4 (reader-facing copy).
 *
 * The CONTRACT §1.3 PII banner is mandated verbatim and currently contains an
 * em-dash; its exact string is stripped before counting so it neither fails the
 * gate nor blocks new tools. Changing the banner itself is a CONTRACT decision.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = resolve(REPO, 'scripts', 'copy-hallmarks-baseline.json');
const UPDATE = process.argv.includes('--update');

const EMDASH = /—/g;
// Build jargon that must not reach readers. \b keeps ART-ids and W-8 (digit) safe.
const JARGON = [
  [/\bWave\s+\d+\b/g, 'Wave-N build code'],
  [/\bW-[A-F]\b/g, 'W-x badge code'],
  [/\bD0\b/g, 'D0 badge code'],
];
// Advisory only, for now — HIGH-PRECISION twotone family, named as its own
// category so COPYTELL-SWEEP-1 can flip it to blocking once swept clean.
const TWOTONE_HIGHPRECISION = /\b(?:is|are|was|were) not (?:a|an|the )?[\w-]+\.\s+(?:It|They|This|That) (?:is|are)\b/g;
// Advisory only, PERMANENTLY — heuristic, catches legitimate 3-item lists too often for a hard gate.
const TRIAD = /\b\w+,\s*\w+,\s*(?:and|&)\s*\w+\b/g;
// Structural UI chrome exempt from the bold count (not prose emphasis) —
// same precedent as the italics rule's h1-h6 exemption, plus tabular/form
// labels. <button> is already stripped upstream via BUTTON_TAG.
const STRUCTURAL_BOLD_EXEMPT = /<(th|dt|label|legend)\b[^>]*>[\s\S]*?<\/\1>/gi;
const BOLD = /<(b|strong)\b[^>]*>[^<]+<\/\1>/gi;

// --- ANTI-AI-TELL BAN (Tim 2026-07-11, PERMANENT — feedback-anti-ai-tell-copy-ban) ---
// Blocking, zero-tolerance, no baseline. Each entry: [regex, label].
const NOTJUSTBUT = [
  [/\bnot\s+just\b(?:(?!\bbut\b)[^.?!]){0,80}\bbut\b/gi, '"not just X but" construction'],
  [/\bisn['’]?t\s+just\b/gi, '"isn\'t just"'],
  [/\bmore\s+than\s+just\b/gi, '"more than just"'],
];
const DRAMATIC_FRAGMENT = /\bThe (?:result|catch|takeaway|verdict|kicker|bottom line)\?/gi;
const VALIDATION_PHRASING = /\byou['’]?re\s+not\s+(?:alone|imagining\s+(?:it|things))\b/gi;
const FILLER_VOCAB = [
  [/\bdelv(?:e|es|ed|ing)\b/gi, 'delve'],
  [/\btapestr(?:y|ies)\b/gi, 'tapestry'],
  [/\btestament\s+to\b/gi, 'testament to'],
  [/\bquiet(?:ly)?\s+(?:revolution|shift|force|power|evolution)\b/gi, 'quiet(ly) X'],
  [/\bseamless(?:ly)?\b/gi, 'seamless'],
  [/\bgame[\s-]?chang(?:er|ing)\b/gi, 'game-changer'],
  // Narrowed to the marketing-verb collocation ("elevate your workflow"), not the
  // bare word: this is a risk/compliance product where "elevated risk/scrutiny/
  // exposure" is correct, load-bearing domain terminology, not filler (measured:
  // 100% of bare-word hits across the site were the domain-adjective sense).
  [/\belevat(?:e|es|ed|ing)\s+(?:your|our|its|their)\s+\w+/gi, 'elevate your/our/its X'],
  // Narrowed to the marketing-metaphor sense ("unlock your potential"), not the
  // literal UI-mechanic sense this suite uses throughout ("Stage 3 unlocks after
  // ...", "13 Tools Unlocked") — measured: 100% of bare-word hits were literal.
  [/\bunlock(?:s|ed|ing)?\s+(?:your\s+|the\s+full\s+|new\s+|greater\s+)?(?:potential|value|growth|opportunit(?:y|ies)|insight(?:s)?|power|possibilit(?:y|ies))\b/gi, 'unlock potential/value/growth (marketing sense)'],
  [/\bit['’]?s\s+worth\s+noting\b/gi, "it's worth noting"],
  [/\bin\s+today['’]?s\s+fast-paced\b/gi, "in today's fast-paced"],
];
// Emoji ranges (misc symbols, emoticons, transport, supplemental, dingbats).
// Flags/regional-indicator pairs (U+1F1E6-1F1FF) are excluded outright: this
// suite uses them as functional country-selector iconography (e.g. the VAT-
// recovery tool's jurisdiction picker), not decorative narrative emoji.
const EMOJI = /[\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}]/gu;
// Functional UI/status glyphs (PASS/FAIL/WARN icons, lock badges) that fall inside
// the emoji ranges above but are NOT the "AI writes a rocket-emoji blog post" tell
// this ban targets — they're load-bearing result-state iconography used across
// every tool's PASS/WARN/FAIL rendering (CONTRACT.md §1.3/§6). Exempt from the
// ban; only genuinely decorative/narrative emoji in prose or headers are blocking.
const EMOJI_UI_EXEMPT = new Set(['✓', '✗', '✔', '✔️', '❌', '✅', '⚠', '⚠️', '🔒', '🔏', '🚫', '☑', '☑️', '➡', '➡️', '→', '⭐', '★', '☆', '❓', '❗', '‼', '⏳', '⏱', '⏱️']);
function nonExemptEmoji(text) {
  return (text.match(EMOJI) || []).filter((ch) => !EMOJI_UI_EXEMPT.has(ch));
}
// Elements exempt from the emoji ban — status/count badges/pills and interactive
// controls (buttons, icon-only indicators), not narrative copy. Every tool page
// uses an emoji glyph as the leading icon on its save/load/export/copy buttons
// and empty-state icons (e.g. "💾 Save Config") — established app chrome that
// predates this ban and is not the "AI writes decorative emoji in prose" tell.
const BADGE_ELEMENT = /<(span|div|a|p)\b[^>]*\bclass\s*=\s*["'][^"']*\b(?:badge|pill|chip)\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi;
const CONTROL_ELEMENT = /<(button|div|span)\b[^>]*\bclass\s*=\s*["'][^"']*\b(?:btn|icon)\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi;
const BUTTON_TAG = /<button\b[^>]*>[\s\S]*?<\/button>/gi;

const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'scripts', '.claude']);

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) htmlFiles(p, out);
    } else if (name.endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

// CONTRACT §1.3 mandates this banner verbatim (em-dash included) — exempt it.
const PII_BANNER = '🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.';

/** Strip script/style/pre/code bodies + HTML comments, keep other tags intact. */
function proseHtml(html) {
  return html
    .split(PII_BANNER).join(' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<pre\b[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<code\b[\s\S]*?<\/code>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(BADGE_ELEMENT, ' ')
    .replace(BUTTON_TAG, ' ')
    .replace(CONTROL_ELEMENT, ' ');
}

/** Human-visible text: proseHtml() with all remaining tags stripped too. */
function visibleText(html) {
  return proseHtml(html).replace(/<[^>]+>/g, ' ');
}

/** Header-only visible text: content of <h1>-<h6>, tags stripped, badges already gone. */
function headerText(prose) {
  const out = [];
  const re = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let m;
  while ((m = re.exec(prose))) out.push(m[1].replace(/<[^>]+>/g, ' '));
  return out.join(' ');
}

const findings = {}; // rel path -> { emdash, jargon: [msg], twotone, hallmarks: [msg] }
for (const file of htmlFiles(REPO)) {
  const rel = relative(REPO, file).replace(/\\/g, '/');
  const raw = readFileSync(file, 'utf8');
  const prose = proseHtml(raw); // tags intact, badges/script/style/pre/code/comments gone
  const text = visibleText(raw); // fully tag-stripped

  const emdash = (text.match(EMDASH) || []).length;
  const jargon = [];
  for (const [re, label] of JARGON) {
    const m = text.match(re) || [];
    if (m.length) jargon.push(`${label} ×${m.length} (${[...new Set(m)].slice(0, 3).join(', ')})`);
  }
  const twotoneHP = (text.match(TWOTONE_HIGHPRECISION) || []).length;
  const triad = (text.match(TRIAD) || []).length;

  const hallmarks = [];
  // Title-styling <em> inside h1-h6 (e.g. "AP2 Mandate-Chain <em>Validator</em>") is
  // an established site-wide headline design pattern, not essay-style emphasis —
  // exempt it. Only body-prose italics (outside headers) are the AI-tell target.
  const proseOutsideHeaders = prose.replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ');
  // Require actual text content — an empty <em id="x"></em> is a JS injection
  // point (e.g. workbench.html's placeholder targets), not prose emphasis.
  const italics = (proseOutsideHeaders.match(/<(em|i)\b[^>]*>[^<]+<\/\1>/gi) || []).length;
  if (italics) hallmarks.push(`italics-for-emphasis ×${italics}`);
  // Bold baseline+ratchet scope: same header exemption as italics, plus
  // structural UI chrome (th/dt/label/legend) — not prose emphasis.
  const proseForBold = proseOutsideHeaders.replace(STRUCTURAL_BOLD_EXEMPT, ' ');
  const bold = (proseForBold.match(BOLD) || []).length;
  for (const [re, label] of NOTJUSTBUT) {
    const m = text.match(re) || [];
    if (m.length) hallmarks.push(`${label} ×${m.length}`);
  }
  const dramatic = (text.match(DRAMATIC_FRAGMENT) || []).length;
  if (dramatic) hallmarks.push(`dramatic-fragment ×${dramatic}`);
  const validation = (text.match(VALIDATION_PHRASING) || []).length;
  if (validation) hallmarks.push(`validation-phrasing ×${validation}`);
  for (const [re, label] of FILLER_VOCAB) {
    const m = text.match(re) || [];
    if (m.length) hallmarks.push(`filler-vocab "${label}" ×${m.length}`);
  }
  // Header emoji is the real "AI writes a decorative section heading" tell (rare,
  // ~12 files, all genuinely narrative hub/explainer pages) — blocking.
  const emojiHeaders = nonExemptEmoji(headerText(prose)).length;
  if (emojiHeaders) hallmarks.push(`emoji-in-header ×${emojiHeaders}`);
  // Body-prose emoji is NOT demoted lightly: this suite uses single-glyph icons
  // pervasively as functional UI chrome (save/export/copy/search/currency icons,
  // status markers) predating this ban and inseparable from narrative decoration
  // by regex alone — button/badge/control wrappers are already stripped above,
  // but some icons sit in bare text nodes (e.g. "📥 Download" inside a <label>
  // or <option>) that a generic wrapper-strip can't reach without a real DOM
  // parser. Flipping this to a hard, zero-tolerance gate would force a suite-wide
  // icon-system redesign across ~480 tool pages — a CONTRACT-level UI decision,
  // not a copy fix, and out of this WU's scope. Advisory only until Tim scopes
  // an icon-migration WU; re-tighten to blocking once that lands.
  const emojiProse = nonExemptEmoji(text).length;

  if (emdash || jargon.length || twotoneHP || triad || hallmarks.length || emojiProse || bold) {
    findings[rel] = { emdash, jargon, twotoneHP, triad, hallmarks, emojiProse, bold };
  }
}

// chaingraph.json descriptions — served to agents over MCP; em-dash gate only
// (jargon there is check-shipped-prose.mjs territory).
const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
let cgEmdash = 0;
for (const n of cg.nodes || []) cgEmdash += ((n.description || '').match(EMDASH) || []).length;
for (const c of cg.chains || []) cgEmdash += ((c.description || '').match(EMDASH) || []).length;
if (cgEmdash) findings['chaingraph/chaingraph.json#descriptions'] = { emdash: cgEmdash, jargon: [], twotoneHP: 0, triad: 0, emojiProse: 0, hallmarks: [], bold: 0 };

if (UPDATE) {
  const baseline = {};
  for (const [rel, f] of Object.entries(findings)) {
    const debt = f.emdash + f.jargon.length + f.bold;
    if (debt) baseline[rel] = { emdash: f.emdash, jargon: f.jargon.length, bold: f.bold };
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`copy-hallmarks: baseline written for ${Object.keys(baseline).length} file(s).`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};
const failures = [];
const improvements = [];
const advisories = [];

for (const [rel, f] of Object.entries(findings)) {
  const b = baseline[rel] || { emdash: 0, jargon: 0, bold: 0 };
  const bBold = b.bold || 0;
  if (f.emdash > b.emdash) failures.push(`${rel}: ${f.emdash} em-dash(es) in visible text (baseline ${b.emdash})`);
  else if (f.emdash < b.emdash) improvements.push(`${rel}: em-dash ${b.emdash} -> ${f.emdash}`);
  if (f.jargon.length > b.jargon) failures.push(`${rel}: build jargon in visible text: ${f.jargon.join('; ')} (baseline ${b.jargon})`);
  if (f.bold > bBold) failures.push(`${rel}: ${f.bold} bold/strong hit(s) in visible text (baseline ${bBold})`);
  else if (f.bold < bBold) improvements.push(`${rel}: bold ${bBold} -> ${f.bold}`);
  // ANTI-AI-TELL categories: zero-tolerance, no baseline, always fail if present.
  if (f.hallmarks.length) failures.push(`${rel}: ANTI-AI-TELL hit(s): ${f.hallmarks.join('; ')}`);
  if (f.twotoneHP && !baseline[rel]) advisories.push(`${rel}: ${f.twotoneHP} possible HIGH-PRECISION twotone construction(s) (flip-ready — see COPYTELL-SWEEP-1)`);
  if (f.triad) advisories.push(`${rel}: ${f.triad} possible rule-of-three triad(s)`);
  if (f.emojiProse) advisories.push(`${rel}: ${f.emojiProse} emoji glyph(s) in body text (advisory — see script header comment)`);
}
for (const rel of Object.keys(baseline)) {
  if (!findings[rel]) improvements.push(`${rel}: clean (baseline entry can be dropped)`);
}

if (advisories.length) {
  console.log(`copy-hallmarks ADVISORY (not failing):\n  ` + advisories.join('\n  '));
}
if (improvements.length) {
  console.log(`copy-hallmarks: ${improvements.length} file(s) beat the baseline — tighten with --update:\n  ` + improvements.slice(0, 10).join('\n  '));
}
if (failures.length) {
  console.error(`\ncopy-hallmarks: ${failures.length} FAILURE(s) — AI-writing hallmarks in reader-facing copy:\n  ` + failures.join('\n  '));
  console.error(`\nFix the copy (see CONTRACT.md §1.4 + memory feedback-anti-ai-tell-copy-ban). Em-dashes/jargon: baseline burns down with --update. ANTI-AI-TELL hits (italics-emphasis, "not just X but", dramatic fragments, validation-phrasing, filler-vocab, emoji-in-headers/prose): zero-tolerance, no baseline — rewrite the copy.`);
  process.exit(1);
}
console.log(`copy-hallmarks: OK (${Object.keys(baseline).length} baselined file(s) within budget, 0 ANTI-AI-TELL hits).`);
