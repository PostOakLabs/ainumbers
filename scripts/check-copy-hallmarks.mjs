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
 *      REMOVED 2026-07-20 (Tim): italic/bold in headings is now blocking too),
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
 * Blocking, zero-tolerance, no baseline (COPYTELL-SWEEP-1, 2026-07-20 —
 * italics precedent): the HIGH-PRECISION twotone family ("It is not X. It is
 * Y.") — TWOTONE_HIGHPRECISION. The sweep found and fixed the one pre-existing
 * hit (chaingraph/openchain-graph-paper.html), so there is no legacy debt to
 * shield. The rule-of-three adjective/phrase TRIAD heuristic stays advisory
 * PERMANENTLY — it false-positives on legitimate 3-item lists too often for a
 * hard gate, ever. Body-prose emoji counts (see scope decision above) are
 * also advisory-only.
 *
 * Blocking, zero-tolerance, no baseline, SCOPED (BILAT-CSR-BUILD-SPEC.md §7 +
 * Tim's 2026-08-07 popup addendum): a counter_signed_receipt vocabulary ban
 * (accept/acceptance, final/finality, settled) — fires only on pages whose
 * visible text names `counter_signed_receipt`, never sitewide (COSIGN_VOCAB_BAN
 * / cosignVocabHits()). See BILAT-CSR-LINT-1.
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
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = resolve(REPO, 'scripts', 'copy-hallmarks-baseline.json');
const UPDATE = process.argv.includes('--update');

const EMDASH = /—/g;
// Blocking, zero-tolerance, no baseline (DASHSWEEP-1, 2026-08-03 — CONTRACT §1.4
// bans the em-dash and prescribes rewrites; sessions removing em-dashes were
// substituting a double-hyphen instead, which reads as a CLI flag / draft-text
// tell, the same machine-generated signal the em-dash ban exists to remove).
// Exempt <option> divider content (`-- Select technique --`, `-- None --`) —
// established HTML convention, not prose; same precedent as the emoji/bold
// structural-chrome exemptions above.
const DOUBLEDASH = /--/g;
const OPTION_TAG = /<option\b[^>]*>[\s\S]*?<\/option>/gi;
// Build jargon that must not reach readers. \b keeps ART-ids and W-8 (digit) safe.
const JARGON = [
  [/\bWave\s+\d+\b/g, 'Wave-N build code'],
  [/\bW-[A-F]\b/g, 'W-x badge code'],
  [/\bD0\b/g, 'D0 badge code'],
];
// Blocking, zero-tolerance, no baseline (COPYTELL-SWEEP-1) — HIGH-PRECISION twotone family.
const TWOTONE_HIGHPRECISION = /\b(?:is|are|was|were) not (?:a|an|the )?[\w-]+\.\s+(?:It|They|This|That) (?:is|are)\b/g;
// Advisory only, PERMANENTLY — heuristic, catches legitimate 3-item lists too often for a hard gate.
const TRIAD = /\b\w+,\s*\w+,\s*(?:and|&)\s*\w+\b/g;
// Advisory only, WARN-ONLY per Tim's ruling 2026-08-07 (memory
// feedback-anti-ai-tell-copy-ban item 11, LOADBEARING-SWEEP-1): "load-bearing"
// used as a metaphor for "important"/"required" is an AI-writing tell, but the
// word also has legitimate literal-structural and domain-specific uses (e.g.
// physical load-bearing walls, a genuinely load-bearing field in a schema) that
// a regex can't tell apart from the metaphor — never a hard block, a reviewer
// clears each hit. Same shape as the triad/emoji advisories above.
const LOADBEARING = /\bload[\s-]?bearing\b/gi;
// Blocking, zero-tolerance, SCOPED (BILAT-CSR-BUILD-SPEC.md §7 + Tim's
// 2026-08-07 popup addendum, binding): the claim a `counter_signed_receipt`
// makes is "both parties recomputed and signed the same result" — NEVER
// "settled/accepted/final". These words are ordinary vocabulary with heavy
// legitimate use across ~480 unrelated tool pages ("click Accept", "final
// step", "settlement date" fields), so this is NOT a sitewide ban — it fires
// ONLY on a page whose visible text names `counter_signed_receipt` (the
// record_type this ban protects). No such page exists yet (BILAT-CSR-SCHEMA-1
// not landed) — this activates automatically once one ships, and a future
// author who writes "the receipt confirms acceptance" gets caught before
// merge. Scope (a) from §7 (the eventual SPEC.md prose section) is NOT
// covered here — this gate is HTML-only by construction (`htmlFiles()`),
// SPEC.md is markdown and already carries its own §15 gate suite.
const COSIGN_RECEIPT_MARKER = /counter_signed_receipt/;
const COSIGN_VOCAB_BAN = [
  [/\baccept(?:ance|ed|s|ing)?\b/gi, 'accept/acceptance'],
  [/\bfinal(?:ity)?\b/gi, 'final/finality'],
  [/\bsettled?\b/gi, 'settled'],
];
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
// The comma-pivot two-tone cliché: "It's not X, it's Y" (and this/that/there +
// "it's/it is/it's about/they're" on the far side). Sibling to
// TWOTONE_HIGHPRECISION (the period-separated "It is not X. It is Y." form).
// Anchored on a leading pronoun (it's/this is/that's/there's) so factual
// sentences that merely start with a noun ("the field is not required, it is
// optional") don't trip it. Zero-tolerance, no baseline — same as the other
// two-tone tell. Added per Tim 2026-07-21.
const TWOTONE_COMMA = /\b(?:it['’]?s|it is|this is|that['’]?s|there['’]?s)\s+not\s+[^,.!?]{1,70},\s+(?:it['’]?s\s+about|it['’]?s|it is|they['’]?re)\b/gi;
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
// Overuse tells: individually legit words, but repeating them across a page reads
// as an AI hallmark. A file NOT in the baseline may use each at most OVERUSE_CAP
// times; legacy debt is shielded by the baseline (ratchet — counts only go down
// via --update), same design as the em-dash gate. "honest/honestly/honesty"
// added per Tim 2026-07-21 (why-openchain-graph.html used it 5x; once is plenty).
const OVERUSE_CAP = 1;
const OVERUSE_VOCAB = [
  [/\bhonest(?:ly|y)?\b/gi, 'honest'],
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

/** Scoped vocabulary ban (see COSIGN_VOCAB_BAN comment): only evaluates when
 * `text` names counter_signed_receipt. Exported for unit testing. */
export function cosignVocabHits(text) {
  if (!COSIGN_RECEIPT_MARKER.test(text)) return [];
  const hits = [];
  for (const [re, label] of COSIGN_VOCAB_BAN) {
    const m = text.match(re) || [];
    if (m.length) hits.push(`${label} ×${m.length}`);
  }
  return hits;
}

// CONTRACT §1.3 mandates this banner verbatim (em-dash included) — exempt it.
const PII_BANNER = '🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.';

// CONTRACT §1.4 (Tim 2026-08-02): entity-encoded em-dashes/hyphens count as the
// literal character — decode before counting. Small explicit map, not a
// dependency (site repo is ZERO-DEP). Order vs. the PII_BANNER split below does
// NOT matter: the mandated banner string is the raw — character in every file
// checked (verified 2026-08-02, grep for an entity-encoded banner found zero
// hits) — never entity-encoded — so decoding before or after the split is
// equivalent for the banner's own exemption.
function decodeDashEntities(html) {
  return html
    .replace(/&mdash;/gi, '—')
    .replace(/&#0*8212;/g, '—')
    .replace(/&#x0*2014;/gi, '—')
    .replace(/&#0*45;/g, '-')
    .replace(/&#x0*2d;/gi, '-');
}

/** Strip script/style/pre/code bodies + HTML comments, keep other tags intact. */
function proseHtml(html) {
  return decodeDashEntities(html)
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

// Gate body runs only when this file is executed directly (node scripts/check-
// copy-hallmarks.mjs), never on `import` — cosignVocabHits() above is safe to
// unit-test in isolation (check-copy-hallmarks.test.mjs) without triggering a
// full repo scan / process.exit as an import side effect.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {

const findings = {}; // rel path -> { emdash, jargon: [msg], twotone, hallmarks: [msg] }
for (const file of htmlFiles(REPO)) {
  const rel = relative(REPO, file).replace(/\\/g, '/');
  const raw = readFileSync(file, 'utf8');
  const prose = proseHtml(raw); // tags intact, badges/script/style/pre/code/comments gone
  const text = visibleText(raw); // fully tag-stripped

  const emdash = (text.match(EMDASH) || []).length;
  const doubledashText = proseHtml(raw).replace(OPTION_TAG, ' ').replace(/<[^>]+>/g, ' ');
  const doubledash = (doubledashText.match(DOUBLEDASH) || []).length;
  const jargon = [];
  for (const [re, label] of JARGON) {
    const m = text.match(re) || [];
    if (m.length) jargon.push(`${label} ×${m.length} (${[...new Set(m)].slice(0, 3).join(', ')})`);
  }
  const twotoneHP = (text.match(TWOTONE_HIGHPRECISION) || []).length;
  const triad = (text.match(TRIAD) || []).length;
  const cosignVocab = cosignVocabHits(text);
  const loadbearing = (text.match(LOADBEARING) || []).length;

  const hallmarks = [];
  // Italic/bold emphasis in HEADINGS (h1-h6) is now a blocking tell too (Tim
  // 2026-07-20): two-tone/italic/bold headings read as an automatic AI hallmark.
  // The former h1-h6 title-styling exemption is REMOVED — italics count everywhere.
  // Require actual text content — an empty <em id="x"></em> is a JS injection
  // point (e.g. workbench.html's placeholder targets), not prose emphasis.
  const italics = (prose.match(/<(em|i)\b[^>]*>[^<]+<\/\1>/gi) || []).length;
  if (italics) hallmarks.push(`italics-for-emphasis ×${italics}`);
  if (doubledash) hallmarks.push(`double-hyphen em-dash substitute (" -- ") ×${doubledash}`);
  // Bold baseline+ratchet scope: headings NO LONGER exempt; only structural UI
  // chrome (th/dt/label/legend/button) stays exempt — that's not prose emphasis.
  const proseForBold = prose.replace(STRUCTURAL_BOLD_EXEMPT, ' ');
  const bold = (proseForBold.match(BOLD) || []).length;
  for (const [re, label] of NOTJUSTBUT) {
    const m = text.match(re) || [];
    if (m.length) hallmarks.push(`${label} ×${m.length}`);
  }
  const dramatic = (text.match(DRAMATIC_FRAGMENT) || []).length;
  if (dramatic) hallmarks.push(`dramatic-fragment ×${dramatic}`);
  const twotoneComma = (text.match(TWOTONE_COMMA) || []).length;
  if (twotoneComma) hallmarks.push(`"it's not X, it's Y" pivot ×${twotoneComma}`);
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

  // Overuse counts (visible text), reported per label when non-zero.
  const overuse = {};
  for (const [re, label] of OVERUSE_VOCAB) {
    const n = (text.match(re) || []).length;
    if (n) overuse[label] = n;
  }

  if (emdash || jargon.length || twotoneHP || triad || loadbearing || cosignVocab.length || hallmarks.length || emojiProse || bold || Object.keys(overuse).length) {
    findings[rel] = { emdash, jargon, twotoneHP, triad, loadbearing, cosignVocab, hallmarks, emojiProse, bold, overuse };
  }
}

// chaingraph.json descriptions — served to agents over MCP; em-dash gate only
// (jargon there is check-shipped-prose.mjs territory).
const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
let cgEmdash = 0;
for (const n of cg.nodes || []) cgEmdash += ((decodeDashEntities(n.description || '')).match(EMDASH) || []).length;
for (const c of cg.chains || []) cgEmdash += ((decodeDashEntities(c.description || '')).match(EMDASH) || []).length;
if (cgEmdash) findings['chaingraph/chaingraph.json#descriptions'] = { emdash: cgEmdash, jargon: [], twotoneHP: 0, triad: 0, loadbearing: 0, cosignVocab: [], emojiProse: 0, hallmarks: [], bold: 0, overuse: {} };

if (UPDATE) {
  const baseline = {};
  for (const [rel, f] of Object.entries(findings)) {
    // Overuse debt: only counts that exceed the cap need shielding.
    const overDebt = {};
    for (const [k, v] of Object.entries(f.overuse || {})) if (v > OVERUSE_CAP) overDebt[k] = v;
    const debt = f.emdash + f.jargon.length + f.bold + Object.keys(overDebt).length;
    if (debt) {
      baseline[rel] = { emdash: f.emdash, jargon: f.jargon.length, bold: f.bold };
      if (Object.keys(overDebt).length) baseline[rel].overuse = overDebt;
    }
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
  // Overuse: allowed = baselined count if shielded, else OVERUSE_CAP. Ratchet down.
  const bOver = b.overuse || {};
  for (const [k, v] of Object.entries(f.overuse || {})) {
    const allowed = bOver[k] != null ? bOver[k] : OVERUSE_CAP;
    if (v > allowed) failures.push(`${rel}: "${k}" ×${v} in visible text — overused (max ${allowed})`);
    else if (bOver[k] != null && v < bOver[k]) improvements.push(`${rel}: "${k}" ${bOver[k]} -> ${v}`);
  }
  // ANTI-AI-TELL categories: zero-tolerance, no baseline, always fail if present.
  if (f.hallmarks.length) failures.push(`${rel}: ANTI-AI-TELL hit(s): ${f.hallmarks.join('; ')}`);
  // HIGH-PRECISION twotone: zero-tolerance, no baseline (COPYTELL-SWEEP-1, italics precedent).
  if (f.twotoneHP) failures.push(`${rel}: ${f.twotoneHP} HIGH-PRECISION twotone construction(s) ("It is not X. It is Y." family) — rewrite as a direct statement`);
  // BILAT-CSR §7 vocabulary ban: zero-tolerance, no baseline, SCOPED to pages
  // naming counter_signed_receipt (see cosignVocabHits comment).
  if (f.cosignVocab.length) failures.push(`${rel}: counter_signed_receipt vocabulary ban hit(s): ${f.cosignVocab.join('; ')} — a receipt proves both parties recomputed and signed the same result, NEVER "settled/accepted/final"`);
  if (f.triad) advisories.push(`${rel}: ${f.triad} possible rule-of-three triad(s)`);
  if (f.loadbearing) advisories.push(`${rel}: ${f.loadbearing} "load-bearing" hit(s) — likely a metaphor for important/required; reviewer clears literal-structural/domain uses (advisory)`);
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
  console.error(`\nFix the copy (see CONTRACT.md §1.4 + memory feedback-anti-ai-tell-copy-ban). Em-dashes/jargon: baseline burns down with --update. ANTI-AI-TELL hits (italics-emphasis, "not just X but", "it's not X, it's Y" pivot, dramatic fragments, validation-phrasing, filler-vocab, emoji-in-headers/prose): zero-tolerance, no baseline — rewrite the copy.`);
  process.exit(1);
}
console.log(`copy-hallmarks: OK (${Object.keys(baseline).length} baselined file(s) within budget, 0 ANTI-AI-TELL hits).`);

}
