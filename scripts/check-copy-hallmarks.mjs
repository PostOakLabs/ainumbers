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
 * H5 insider-register + AI-vocabulary + H1 ",-not" density (COPY-HALLMARK-
 * METRICS-1, 2026-08-15, per research/COPY-HUMANIZE-AUDIT-SCOPING-2026-08-14.md
 * + Tim's easy-tells-only ruling 2026-08-14): three more baseline+ratchet
 * buckets, same shape as jargon/bold above — a file may not exceed its
 * baselined count, files absent from the baseline must be within the default.
 *   - INSIDER_TERMS (bucket "insider"): process-diary/insider register on a
 *     public page ("Tim's", "self-disclosed", "adjudicat-", "this row") plus a
 *     heuristic spec/WU-codename pattern (ALL-CAPS-word chain ending in a bare
 *     1-2-digit number, e.g. "COPY-HALLMARK-METRICS-1"). The codename heuristic
 *     false-positives on real standard names (ML-DSA-44, CC-BY-4) — those exact
 *     prefixes are excluded; remaining noise is absorbed by the baseline, never
 *     a zero-tolerance ban (measured 2026-08-15: a naive version hit 230
 *     matches across licenses/regs/algorithm names before narrowing).
 *   - AI_VOCAB (bucket "aiVocab"): Wikipedia's "signs of AI writing" vocabulary
 *     list, narrowed to terms with zero legitimate hits on this site as of
 *     2026-08-15 (crucial, pivotal, underscore-as-verb, showcase, foster,
 *     boast, "dive into", "in the realm of", "indelible mark", spearhead,
 *     myriad, plethora). "showcase" was considered and DROPPED — it collides
 *     with the literal "POL Showcase" nav link on every tool page (measured
 *     2026-08-15: ~60 false positives). "leverage" and "robust" were considered
 *     and DROPPED —
 *     both are ordinary finance/eng vocabulary on this site ("leverage ratio",
 *     "robust error handling"), not AI tells; a hard ban would fight every
 *     future writer on the exact domain this site is about.
 *   - H1_NOTX density (bucket "notX", numeric, DEFAULT cap not a zero-tolerance
 *     ban): the ", not X" defensive-negation reflex. "One per section stays
 *     legal" per the style contract (CONTRACT.md §1.4 / research doc rule 2) —
 *     DEFAULT_NOTX_CAP tolerates a few before requiring a baseline entry.
 *
 * ABSOLUTES (bucket "absolutes", CLAIMS-ABSOLUTES-GATE-1, 2026-08-29 —
 * 0xAlpha public-claims-liability-audit.md §4 gate-catchable item 1): a
 * fourth baseline+ratchet bucket, same shape as jargon/bold/insider/aiVocab
 * above, for absolute/certainty-claim terms — "this cannot fail/be broken/
 * contain an error" phrasing no software system can actually back. This is
 * the standing extension of the one-time pinned-wording fixes CLAIMS-
 * WORDING-FIX-1 applied to the E1-E3/B1/B7 audit families: those exact terms
 * ("tamper-proof", "mathematically proven", "fully verified", etc.) are now
 * gated everywhere so the families cannot regrow on a new page. Regime/tool
 * NOUNS ("bank guarantee", "NYDFS Certification", "IAL levels") are a
 * different word shape entirely and never match. "independently verified" is
 * exempt only in its compliant named-mechanism form ("independently
 * verified: <mechanism>", the shape euc-register.html's trust line actually
 * ships); the bare form (no colon) is still an unqualified absolute claim.
 *
 * Usage:
 *   node scripts/check-copy-hallmarks.mjs            # gate (preflight + CI)
 *   node scripts/check-copy-hallmarks.mjs --update   # regenerate the em-dash/jargon/bold/insider/aiVocab/absolutes/notX baseline
 *   node scripts/check-copy-hallmarks.mjs --report   # write the Tier-1 H1+H5 remediation ranking to workspace-root research/
 *
 * Style rule of record: CONTRACT.md §1.4 (reader-facing copy).
 *
 * The CONTRACT §1.3 PII banner is mandated verbatim and currently contains an
 * em-dash; its exact string is stripped before counting so it neither fails the
 * gate nor blocks new tools. Changing the banner itself is a CONTRACT decision.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveChangedScope, isTouched } from './_changed-files-lib.js';
import { isSkipDir } from './_walk-skip-dirs.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = resolve(REPO, 'scripts', 'copy-hallmarks-baseline.json');
const UPDATE = process.argv.includes('--update');
// --changed <REF> (PREREQ-CHANGED-SCOPING-1, B5 of GATE-MANIFEST-DRAFT.md §1):
// scope the scan to pages touched vs <REF>. Undeterminable diff BLOCKS
// (fail-closed) rather than silently widening to a full scan. Never combined
// with --update/--report, which regenerate the baseline/metrics from the
// full estate by design.
const changedArgIdx = process.argv.indexOf('--changed');
const changedRef = changedArgIdx !== -1 ? process.argv[changedArgIdx + 1] : null;
const CHANGED = (!UPDATE && !process.argv.includes('--report'))
  ? resolveChangedScope(changedRef, { gate: 'check-copy-hallmarks.mjs (B5)', failClosed: true })
  : null;
// --report is local/dev-only (COPY-HALLMARK-METRICS-1): writes the Tier-1
// H1+H5 remediation ranking to WORKSPACE-ROOT research/ (never repo/research/,
// per workspace CLAUDE.md's path-ambiguity trap). Never invoked by preflight
// or CI — CI clones only repo/, so a workspace-root parent directory does not
// exist there; this is a side effect of a deliberate local run, not the gate.
const REPORT = process.argv.includes('--report');
const WORKSPACE_RESEARCH = resolve(REPO, '..', 'research');
// Tier-1 per the scoping doc: root-level pages, chaingraph/ explainers/hubs/
// guides, guides/, disclosures/. Tier-2 (tools/) still counted, just labeled.
const TIER1_RE = /^(?:[^/]+\.html|chaingraph\/(?!kernels\/)[^/]+\.html|chaingraph\/(?:chains|guides)\/[^/]+\.html|guides\/[^/]+\.html|disclosures\/[^/]+\.html)$/;

// Double-escaped HTML entities (ENTITY-DOUBLE-ESCAPE-1, 2026-08-09): a source
// value that already carries an entity (e.g. "&amp;" for a literal "&") gets
// escaped a SECOND time by a generator's esc()/escHtml(), rendering literal
// "&amp;" text on the page instead of "&". Scanned over raw HTML (not just
// tag-stripped visible text) because the bug also hits attributes like
// data-name/aria-label that visibleText() strips before this point. Zero-
// tolerance, no baseline — the sweep that added this found and fixed every
// pre-existing hit first, so there is no legacy debt to shield.
const DOUBLE_ESCAPED_ENTITY = /&amp;(?:amp|lt|gt|quot|#39|nbsp);/g;

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
// H5 insider-register terms (COPY-HALLMARK-METRICS-1) — baseline+ratchet,
// own bucket (kept separate from JARGON above) so the Tier-1 report can total
// H1+H5 without double-counting build-code hits it doesn't own.
const WU_CODE_EXEMPT = /^(?:ML-DSA-|ML-KEM-|CC-BY-)/;
const WU_CODE = /\b[A-Z]{2,}(?:-[A-Z]{1,}){1,3}-\d{1,2}\b/g;
const INSIDER_TERMS = [
  [/\bTim['’]s\b/g, "Tim's"],
  [/\bself-disclosed\b/gi, 'self-disclosed'],
  [/\badjudicat\w*/gi, 'adjudicat-'],
  [/\bthis row\b/gi, 'this row'],
];
export function insiderHits(text) {
  const hits = [];
  for (const [re, label] of INSIDER_TERMS) {
    const m = text.match(re) || [];
    if (m.length) hits.push(`${label} ×${m.length}`);
  }
  const codes = (text.match(WU_CODE) || []).filter((m) => !WU_CODE_EXEMPT.test(m));
  if (codes.length) hits.push(`spec/WU codename ×${codes.length} (${[...new Set(codes)].slice(0, 3).join(', ')})`);
  return hits;
}
// H5-adjacent: Wikipedia "signs of AI writing" vocabulary, narrowed to terms
// with zero legitimate hits on this site (see file header comment).
const AI_VOCAB = [
  [/\bcrucial(?:ly)?\b/gi, 'crucial'],
  [/\bpivotal\b/gi, 'pivotal'],
  [/\bunderscor(?:e|es|ed|ing)\b/gi, 'underscore (verb)'],
  [/\bfoster(?:s|ed|ing)?\b/gi, 'foster'],
  [/\bboast(?:s|ed|ing)?\b/gi, 'boast'],
  [/\bdive\s+into\b/gi, 'dive into'],
  [/\bin\s+the\s+realm\s+of\b/gi, 'in the realm of'],
  [/\bindelible\s+mark\b/gi, 'indelible mark'],
  [/\bspearhead(?:s|ed|ing)?\b/gi, 'spearhead'],
  [/\bmyriad\b/gi, 'myriad'],
  [/\bplethora\b/gi, 'plethora'],
];
export function aiVocabHits(text) {
  const hits = [];
  for (const [re, label] of AI_VOCAB) {
    const m = text.match(re) || [];
    if (m.length) hits.push(`${label} ×${m.length}`);
  }
  return hits;
}
// ABSOLUTES (CLAIMS-ABSOLUTES-GATE-1): total/binary guarantee claims from the
// 0xAlpha public-claims-liability-audit.md §4 E1-E3/B1/B7 families ("this
// cannot fail/be broken/contain an error") — the standing gate that keeps
// CLAIMS-WORDING-FIX-1's one-time pinned-wording fixes from regrowing
// elsewhere. Regime/tool nouns ("bank guarantee", "NYDFS Certification",
// "IAL levels") are a different word shape and never match these patterns.
// "independently verified" is exempt only when followed by a colon, the
// shape euc-register.html's trust line actually ships ("independently
// verified: zkVM execution proof (risc0/groth16-bn254)", verified 2026-08-29
// via `git grep -n "independently verified:" -- '*.html'` — 26/26 hits on
// that exact mechanism string, 0 elsewhere). Known false-negative: a colon
// can also start an unrelated clause (chaingraph/art-573-...html:138, "...is
// independently verified: you assert those facts.") — that reads as a
// disclaimer denying verification, not an over-claim, so under-flagging it
// is the safe direction and not worth a mechanism-name allowlist here.
const ABSOLUTES = [
  [/\btamper[\s-]?proof\b/gi, 'tamper-proof'],
  [/\berror[\s-]?free\b/gi, 'error-free'],
  [/\bbug[\s-]?free\b/gi, 'bug-free'],
  [/\bflawless(?:ly)?\b/gi, 'flawless'],
  [/\bunforgeable\b/gi, 'unforgeable'],
  [/\bcryptographically guaranteed\b/gi, 'cryptographically guaranteed'],
  [/\bprovably correct\b/gi, 'provably correct'],
  [/\bbank[\s-]?grade\b/gi, 'bank-grade'],
  [/\bmathematically proven\b/gi, 'mathematically proven'],
  [/\bfully verified\b/gi, 'fully verified'],
  [/\bindependently verified\b(?!\s*:)/gi, 'independently verified (bare)'],
];
export function absolutesHits(text) {
  const hits = [];
  for (const [re, label] of ABSOLUTES) {
    const m = text.match(re) || [];
    if (m.length) hits.push(`${label} ×${m.length}`);
  }
  return hits;
}
// PANEL: the "SCOPE box" / "what this does not do" negation-wall shape
// (SCOPE-PANEL-COPY-AUDIT-1, 2026-08-18, Tim's ruling on agentcore-x402-hub.html's
// SCOPE box: "very distracting, it sounds like slop ... readers care about a
// couple items in the scope/out of scope, but no one cares about all of these
// out of scope items"). Distinct from H1 (notX, an inline ",-not X" reflex): a
// PANEL is a HEADING that frames negation (SCOPE / Non-Goals / Out of Scope /
// Limitations / "what this does not do") followed by >=2 negation bullets/
// sentences under it. CONTRACT §1.4's reasonable-reader rule permits at most
// two inline limitation sentences per page; a heading-plus-wall is the house
// tic that rule exists to remove.
// Labels aren't always real headings — this site also uses short leaf
// elements as section labels (<div class="sec-label">Scope</div>) and short
// lead-in sentences ("What this page does not do, stated plainly:") right
// before the bullet wall. Match any short (<=150 char) leaf element's text,
// not just h1-h6, so both shapes are caught.
const PANEL_HEADING_RE = /<(h[1-6]|div|p|span|strong|b)\b[^>]*>([^<]{0,150})<\/\1>/gi;
// A heading already framed as negative: any bullet under it counts.
const PANEL_NEGATION_LABEL = /\bnon-goals?\b|\bout of scope\b|does\s+not\s+do\b|\blimitations?\b|\bwhat this\b[^<]{0,40}\bdoes\s+not\b|\bwill\s+not\b/i;
// A bare "Scope" heading is ambiguous (could be positive) — only count bullets
// that themselves read as negations.
const PANEL_SCOPE_LABEL = /\bscope\b/i;
const NEG_ITEM_TEXT = /\b(?:does\s+not|is\s+not\s+a|is\s+not\s+an|not\s+a\s+substitute\s+for|cannot|can['’]?t|will\s+not|won['’]?t|never|excludes?|no\s+support\s+for)\b/i;
const LIST_ITEM_RE = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z])/;
// A boxed/callout wrapper (class names like "scope-callout", "scope-fence",
// "scope-box") is itself the shape Tim flagged ("very distracting, it sounds
// like slop") regardless of exact sentence count inside — a bordered box
// visually promotes a limitation into a section, which the reasonable-reader
// rule forbids even at one sentence. Lower threshold to >=1 negation mention
// for these explicitly-boxed wrappers only.
const CALLOUT_WRAPPER_RE = /<(div|aside|section)\b[^>]*\bclass\s*=\s*["'][^"']*\b(?:scope-callout|scope-box|scope-fence|non-goals-box|limitations-box)\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
/** Detect PANEL-shaped negation walls. Exported for unit testing. */
export function panelHits(prose) {
  const hits = [];
  let m;
  CALLOUT_WRAPPER_RE.lastIndex = 0;
  const boxSeen = new Set();
  while ((m = CALLOUT_WRAPPER_RE.exec(prose))) {
    const plain = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (NEG_ITEM_TEXT.test(plain) || /\bnot\b/i.test(plain)) {
      hits.push(`boxed scope/limitation callout (${plain.slice(0, 60)}...)`);
      boxSeen.add(m.index);
    }
  }
  PANEL_HEADING_RE.lastIndex = 0;
  const headings = [];
  while ((m = PANEL_HEADING_RE.exec(prose))) {
    headings.push({ start: m.index, end: PANEL_HEADING_RE.lastIndex, text: m[2].trim() });
  }
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const isNegation = PANEL_NEGATION_LABEL.test(h.text);
    const isScope = !isNegation && PANEL_SCOPE_LABEL.test(h.text);
    if (!isNegation && !isScope) continue;
    const nextStart = i + 1 < headings.length ? headings[i + 1].start : Math.min(prose.length, h.end + 3000);
    const span = prose.slice(h.end, nextStart);
    LIST_ITEM_RE.lastIndex = 0;
    const items = [];
    let lm;
    while ((lm = LIST_ITEM_RE.exec(span))) items.push(lm[1].replace(/<[^>]+>/g, ' ').trim());
    let negCount = 0;
    if (items.length) {
      negCount = isNegation ? items.length : items.filter((t) => NEG_ITEM_TEXT.test(t)).length;
    } else {
      const plainText = span.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const sentences = plainText.split(SENTENCE_SPLIT_RE).filter(Boolean);
      negCount = sentences.filter((s) => NEG_ITEM_TEXT.test(s)).length;
    }
    if (negCount >= 2) {
      hits.push(`"${h.text.slice(0, 60)}" panel with ${negCount} negation ${items.length ? 'bullet' : 'sentence'}(s)`);
    }
  }
  return hits;
}
// H1: the ", not X" defensive-negation reflex + "; it is not" sibling form.
// DEFAULT_NOTX_CAP tolerates a few before a file needs a baseline entry — the
// style contract allows "one per section", and most pages have 2+ sections.
const NOTX = /,\s+not\s+(?:a|an|the|som\w+|only|merely)?\s?[\w-]+/gi;
const SEMI_NOT = /;\s*it is not/gi;
const DEFAULT_NOTX_CAP = 3;
export function notXCount(text) {
  return (text.match(NOTX) || []).length + (text.match(SEMI_NOT) || []).length;
}
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

// isSkipDir() (scripts/_walk-skip-dirs.mjs, WT-IGNORE-GATES-1 item c) is the
// shared worktree/VCS exclusion — a sibling git worktree checkout ('.wt/*',
// '.claude/worktrees/*', etc.) is not site content, or a live sibling
// worktree's copy of every page double-counts. 'scripts' is this walker's
// OWN extra exclusion (non-content, not a worktree concern) layered on top.
const EXTRA_SKIP_DIRS = new Set(['scripts']);

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!isSkipDir(name) && !EXTRA_SKIP_DIRS.has(name)) htmlFiles(p, out);
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
export function visibleText(html) {
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
const scanFiles = CHANGED ? htmlFiles(REPO).filter((f) => isTouched(relative(REPO, f), CHANGED)) : htmlFiles(REPO);
for (const file of scanFiles) {
  const rel = relative(REPO, file).replace(/\\/g, '/');
  const raw = readFileSync(file, 'utf8');
  const prose = proseHtml(raw); // tags intact, badges/script/style/pre/code/comments gone
  const text = visibleText(raw); // fully tag-stripped

  const doubleEscaped = (raw.match(DOUBLE_ESCAPED_ENTITY) || []).length;
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
  const insider = insiderHits(text);
  const aiVocab = aiVocabHits(text);
  const absolutes = absolutesHits(text);
  const notX = notXCount(text);
  const panel = panelHits(prose);

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
  // ⛔ Do not read the sentence above as a statement of where things stand — it
  // has no owner and nothing re-evaluates it. Re-derive instead: `node
  // scripts/check-copy-hallmarks.mjs` prints the live per-page body-emoji count
  // in its ADVISORY block, which is the debt a flip to blocking would turn red.
  // Last evaluated 2026-08-23 (STALE-PHASING-NOTE-SWEEP-1): no icon-migration WU
  // scoped, so still advisory and still pending. Re-date when you re-check.
  const emojiProse = nonExemptEmoji(text).length;

  // Overuse counts (visible text), reported per label when non-zero.
  const overuse = {};
  for (const [re, label] of OVERUSE_VOCAB) {
    const n = (text.match(re) || []).length;
    if (n) overuse[label] = n;
  }

  if (emdash || jargon.length || twotoneHP || triad || loadbearing || cosignVocab.length || hallmarks.length || emojiProse || bold || doubleEscaped || Object.keys(overuse).length || insider.length || aiVocab.length || absolutes.length || notX || panel.length) {
    findings[rel] = { emdash, jargon, twotoneHP, triad, loadbearing, cosignVocab, hallmarks, emojiProse, bold, doubleEscaped, overuse, insider, aiVocab, absolutes, notX, panel };
  }
}

// chaingraph.json descriptions — served to agents over MCP; em-dash gate only
// (jargon there is check-shipped-prose.mjs territory). Scoped runs only pay
// for this when chaingraph.json itself is in the touched set — never write
// to it (out of this row's fence; this gate only reads it).
if (!CHANGED || isTouched('chaingraph/chaingraph.json', CHANGED)) {
  const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
  let cgEmdash = 0;
  for (const n of cg.nodes || []) cgEmdash += ((decodeDashEntities(n.description || '')).match(EMDASH) || []).length;
  for (const c of cg.chains || []) cgEmdash += ((decodeDashEntities(c.description || '')).match(EMDASH) || []).length;
  if (cgEmdash) findings['chaingraph/chaingraph.json#descriptions'] = { emdash: cgEmdash, jargon: [], twotoneHP: 0, triad: 0, loadbearing: 0, cosignVocab: [], emojiProse: 0, hallmarks: [], bold: 0, overuse: {}, insider: [], aiVocab: [], absolutes: [], notX: 0, panel: [] };
}

if (REPORT) {
  const date = process.env.COPY_HALLMARK_REPORT_DATE || new Date().toISOString().slice(0, 10);
  const ranked = Object.entries(findings)
    .map(([rel, f]) => ({ file: rel, tier: TIER1_RE.test(rel) ? 1 : 2, notX: f.notX, insider: f.insider.length, h1PlusH5: f.notX + f.insider.length, insiderDetail: f.insider }))
    .filter((r) => r.h1PlusH5 > 0)
    .sort((a, b) => b.h1PlusH5 - a.h1PlusH5 || a.file.localeCompare(b.file));
  if (!existsSync(WORKSPACE_RESEARCH)) mkdirSync(WORKSPACE_RESEARCH, { recursive: true });
  const outPath = resolve(WORKSPACE_RESEARCH, `copy-hallmark-report-${date}.json`);
  writeFileSync(outPath, JSON.stringify({ generated: date, metric: 'H1 (,-not density) + H5 (insider-register) per page, descending', ranked }, null, 2) + '\n');
  console.log(`copy-hallmarks: report written to ${outPath} (${ranked.length} page(s) with H1/H5 hits, ${ranked.filter((r) => r.tier === 1).length} Tier-1).`);
  process.exit(0);
}

if (UPDATE) {
  const baseline = {};
  for (const [rel, f] of Object.entries(findings)) {
    // Overuse debt: only counts that exceed the cap need shielding.
    const overDebt = {};
    for (const [k, v] of Object.entries(f.overuse || {})) if (v > OVERUSE_CAP) overDebt[k] = v;
    const notXDebt = f.notX > DEFAULT_NOTX_CAP ? f.notX : 0;
    const debt = f.emdash + f.jargon.length + f.bold + Object.keys(overDebt).length + f.insider.length + f.aiVocab.length + f.absolutes.length + (notXDebt ? 1 : 0) + f.panel.length;
    if (debt) {
      baseline[rel] = { emdash: f.emdash, jargon: f.jargon.length, bold: f.bold, insider: f.insider.length, aiVocab: f.aiVocab.length, absolutes: f.absolutes.length };
      if (Object.keys(overDebt).length) baseline[rel].overuse = overDebt;
      if (notXDebt) baseline[rel].notX = notXDebt;
      if (f.panel.length) baseline[rel].panel = f.panel.length;
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
  const b = baseline[rel] || { emdash: 0, jargon: 0, bold: 0, insider: 0, aiVocab: 0, absolutes: 0 };
  const bBold = b.bold || 0;
  const bInsider = b.insider || 0;
  const bAiVocab = b.aiVocab || 0;
  const bAbsolutes = b.absolutes || 0;
  const bPanel = b.panel || 0;
  if (f.emdash > b.emdash) failures.push(`${rel}: ${f.emdash} em-dash(es) in visible text (baseline ${b.emdash})`);
  else if (f.emdash < b.emdash) improvements.push(`${rel}: em-dash ${b.emdash} -> ${f.emdash}`);
  if (f.jargon.length > b.jargon) failures.push(`${rel}: build jargon in visible text: ${f.jargon.join('; ')} (baseline ${b.jargon})`);
  if (f.bold > bBold) failures.push(`${rel}: ${f.bold} bold/strong hit(s) in visible text (baseline ${bBold})`);
  else if (f.bold < bBold) improvements.push(`${rel}: bold ${bBold} -> ${f.bold}`);
  if (f.insider.length > bInsider) failures.push(`${rel}: insider-register hit(s): ${f.insider.join('; ')} (baseline ${bInsider})`);
  else if (f.insider.length < bInsider) improvements.push(`${rel}: insider-register ${bInsider} -> ${f.insider.length}`);
  if (f.aiVocab.length > bAiVocab) failures.push(`${rel}: AI-vocabulary hit(s): ${f.aiVocab.join('; ')} (baseline ${bAiVocab})`);
  else if (f.aiVocab.length < bAiVocab) improvements.push(`${rel}: AI-vocabulary ${bAiVocab} -> ${f.aiVocab.length}`);
  if (f.absolutes.length > bAbsolutes) failures.push(`${rel}: absolute/certainty-claim hit(s): ${f.absolutes.join('; ')} (baseline ${bAbsolutes}) — CONTRACT §1.4: rewrite as a falsifiable, scoped claim (e.g. hash-anchored/tamper-evident, ZK-proven, hash-committed and recomputable) instead of an unqualified guarantee`);
  else if (f.absolutes.length < bAbsolutes) improvements.push(`${rel}: absolutes ${bAbsolutes} -> ${f.absolutes.length}`);
  // PANEL (scope-box negation-wall shape): BLOCKING for new/changed pages — a
  // file absent from the baseline gets zero tolerance, same shape as jargon/
  // insider/aiVocab above. The baseline is legacy-estate shielding ONLY,
  // burned down by rewrite PRs via --update (never grown to hide a new hit).
  if (f.panel.length > bPanel) failures.push(`${rel}: SCOPE-panel negation-wall hit(s): ${f.panel.join('; ')} (baseline ${bPanel}) — CONTRACT §1.4 reasonable-reader rule: fold into at most two inline limitation sentences, no heading-plus-bullet-wall`);
  else if (f.panel.length < bPanel) improvements.push(`${rel}: panel ${bPanel} -> ${f.panel.length}`);
  {
    const allowedNotX = b.notX != null ? b.notX : DEFAULT_NOTX_CAP;
    if (f.notX > allowedNotX) failures.push(`${rel}: ${f.notX} ",-not X" defensive-negation hit(s) — over cap (max ${allowedNotX})`);
    else if (b.notX != null && f.notX < b.notX) improvements.push(`${rel}: ",-not X" density ${b.notX} -> ${f.notX}`);
  }
  // Overuse: allowed = baselined count if shielded, else OVERUSE_CAP. Ratchet down.
  const bOver = b.overuse || {};
  for (const [k, v] of Object.entries(f.overuse || {})) {
    const allowed = bOver[k] != null ? bOver[k] : OVERUSE_CAP;
    if (v > allowed) failures.push(`${rel}: "${k}" ×${v} in visible text — overused (max ${allowed})`);
    else if (bOver[k] != null && v < bOver[k]) improvements.push(`${rel}: "${k}" ${bOver[k]} -> ${v}`);
  }
  // Double-escaped HTML entities: zero-tolerance, no baseline (ENTITY-DOUBLE-ESCAPE-1).
  if (f.doubleEscaped) failures.push(`${rel}: ${f.doubleEscaped} double-escaped HTML entity/entities (e.g. "&amp;amp;") — a generator is escaping an already-escaped source value`);
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
// Untouched files were never scanned in a --changed run — only claim "now
// clean" for a baseline entry this run actually scanned.
for (const rel of Object.keys(baseline)) {
  if (CHANGED && !isTouched(rel, CHANGED)) continue;
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
console.log(`copy-hallmarks: OK (${Object.keys(baseline).length} baselined file(s) within budget, 0 ANTI-AI-TELL hits)${CHANGED ? ` — touched-scope: ${scanFiles.length} file(s) scanned` : ''}.`);

}
