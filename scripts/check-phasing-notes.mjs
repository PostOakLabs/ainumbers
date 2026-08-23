#!/usr/bin/env node
// check-phasing-notes.mjs — STALE-PHASING-NOTE-SWEEP-1.
//
// ⛔⛔ THE DEFECT THIS EXISTS TO KILL — "the self-invalidating comment".
// A phasing note is a comment that states a TEMPORARY condition and names its own exit:
//
//     // Phasing: only 5 of ~79 kernels ship fixtures today, so MISSING-FIXTURE coverage is a
//     // WARNING by default ... Flip to --strict once every kernel has a fixture.
//
// It is written as a temporary statement and then read as a permanent one. Nobody re-reads a
// comment to check whether it expired, so the note above kept a coverage gate LENIENT long after
// its own stated reason for leniency had evaporated — measured 2026-08-23 at 629 of 629 in-scope
// kernels with fixtures, 0 without (KERNEL-CONTRACT-STRICT-1, PR #1493). A kernel that both
// probe-crashed AND shipped no fixture was verified by neither gate while both exited 0.
//
// ⚖ This is the DOCUMENTATION TWIN of the silent-green gate family: it does not become wrong
// loudly, it just stops being true. Same posture as SO #34c — a claim nothing re-evaluates is a
// distinct state, never a verified one.
//
// ✅ WHAT THIS GATE DEMANDS — not "do not write phasing notes". Phasing is legitimate and
// unavoidable; a staged rollout has to say it is staged. The demand is that the note carry a
// CHECKABLE FORM, so the next reader can re-evaluate the condition instead of inheriting it:
//   · a DATE      — "measured 2026-08-23: 5 of 79" expires honestly and promises nothing
//                   (workspace SO #0b(3): "state it as a dated observation").
//   · a COMMAND   — "run `node chaingraph/kernels/kernel-contract.test.mjs --strict`" makes the
//                   READER perform the check (SO #0b(2)) instead of trusting a typed number.
// ⛔ A BARE HARDCODED COUNT IS NOT ACCEPTED, and that is a deliberate, load-bearing call:
//   "5 of ~79 kernels" IS a count, and it is the exact artifact that went stale. A number typed
//   into a comment has no writer and no gate — it is a claim about the world frozen at authoring
//   time, which is the whole defect. A count becomes checkable the moment it carries the date it
//   was measured or the command that re-derives it, and at that point the date/command already
//   satisfies the rule. Accepting a bare count would make this lint blind to the one hit it was
//   built for (the known-answer check in STALE-PHASING-NOTE-SWEEP-1).
//
// ⛔⛔ THIS GATE FINDS, IT DOES NOT FIRE. It never flips a strictness flag, never edits a gate,
// never acts on a met condition. Every met condition is its own row with its own proof —
// KERNEL-CONTRACT-STRICT-1 was exactly that, and it needed two REDs and an independently derived
// count before it flipped one boolean.
//
// ── PRECISION: why this does not flag every `currently` ────────────────────────────────────────
// A lint that fires on a bare temporal word gets baselined into uselessness inside a week. The
// naive term list from the row (`today`, `for now`, `currently`, `pending`, `interim`, ...) hits
// 243 lines in this scope alone, and `pending` ALONE hits 144 — almost all of it legitimate
// domain vocabulary (a Sigsum "pending" anchor state, a `pending` status enum, "pending review").
// So a single word never fires this gate. Two families do, and both require STRUCTURE:
//
//   FAMILY A — PROVISIONAL + EXIT, in the same note.
//     A provisional marker ("today", "for now", "currently", "temporarily", "interim", "not yet")
//     AND an exit marker ("until", "once", "eventually", "in future", "for a future") together.
//     One without the other is ordinary prose and is left alone.
//
//   FAMILY B — a FUTURE-CHANGE ANNOUNCEMENT.
//     A note that says this artifact's behaviour will be changed later: "flip to", "re-tighten",
//     "switch to ... once", "Phasing:", "advisory until", "warn-only until", "revisit once".
//     ⭐ Requiring a CHANGE VERB is what keeps "once every"/"until all" from false-positiving on
//     algorithm prose. Measured against the live corpus, the bare `once every` pattern hit three
//     lines that describe control flow, not phasing:
//       chaingraph/kernels/_proof.mjs        "a proof runs once every previousProof id ... verified"
//       scripts/gen-registry-lineage.mjs     "Only once every step above has succeeded does it write"
//       scripts/gen-registry-errata.mjs      "Only once every step above has succeeded does it write"
//     None names a change to make later, so none is flagged. See the self-test's FALSE-POSITIVE
//     layer, which pins these three verbatim.
//
// ── NOTE GRANULARITY (load-bearing, do not coarsen) ────────────────────────────────────────────
// A "note" is a contiguous run of NON-EMPTY comment lines (or, in markdown, a blank-line-separated
// paragraph). A blank `//` line ENDS a note. ⛔ Merging a whole file header into one note would let
// an unrelated `Usage: node foo.mjs` line three paragraphs away launder a phasing note into
// "checkable" — kernel-contract.test.mjs is exactly that shape, and a coarser grouping makes this
// gate silently miss its own known-answer case.
//
// ── SCOPE ─────────────────────────────────────────────────────────────────────────────────────
// Gate headers, script headers, and CONTRACT/SPEC prose (the row's words):
//   scripts/**/*.mjs · chaingraph/standard/*.mjs · chaingraph/kernels/*.mjs MINUS *.kernel.mjs,
//   __proptests__/ and vendor/ · CONTRACT.md · chaingraph/standard/SPEC.md
// ⛔ Kernel bytes are OUT by construction (*.kernel.mjs excluded) — a lint must never be a reason
// to touch a sealed kernel (SO #36). ⛔ Vendored third-party bundles are excluded: their comments
// are upstream's, not ours, and we do not rewrite them.
// ⛔ Enumeration is `git ls-files`, NEVER a directory walk (SO #52): a walk here would multiply the
// file set by every live worktree under the workspace root.
//
// ── BASELINE ──────────────────────────────────────────────────────────────────────────────────
// scripts/phasing-notes-baseline.json, loaded through the shared HARD-FAILING loader
// scripts/ratchet-baseline.mjs (RATCHET-BASELINE-LOADER-1 / gate-integrity F-11). ⛔ There is no
// `existsSync(...) ? JSON.parse(...) : {}` here and there must never be one: deleting the baseline
// must RED this gate, not switch it off while it keeps printing green.
// Ratchet runs both directions: a count above its pin FAILS; a count below its pin is reported as
// an improvement with the re-pin command, and the pin only ever moves down.
//
// Usage:
//   node scripts/check-phasing-notes.mjs                     # gate (preflight + CI)
//   node scripts/check-phasing-notes.mjs --check             # same thing (generator-coverage alias)
//   node scripts/check-phasing-notes.mjs --list              # print every hit with its reasons
//   node scripts/check-phasing-notes.mjs --update-baseline   # re-pin (counts only go down)
//
// Zero-dependency. Self-test (SO #40(b), RED before GREEN): scripts/check-phasing-notes.test.mjs.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadRatchetBaselineOrExit, readBaselineForUpdate, assertFiniteCeiling } from './ratchet-baseline.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
export const BASELINE_PATH = resolve(HERE, 'phasing-notes-baseline.json');
export const REPIN_COMMAND = 'node scripts/check-phasing-notes.mjs --update-baseline';
const BASELINE_LABEL = 'check-phasing-notes';
const BASELINE_KEYS = ['total', { key: 'files', type: 'name-list' }];

// ── FAMILY A: provisional marker + exit marker, same note ─────────────────────────────────────
const PROVISIONAL = [
  [/\btoday\b/i, '"today"'],
  [/\bfor now\b/i, '"for now"'],
  [/\bfor the (?:moment|time being)\b/i, '"for the moment/time being"'],
  [/\bcurrently\b/i, '"currently"'],
  [/\bat present\b/i, '"at present"'],
  [/\bpresently\b/i, '"presently"'],
  [/\btemporar(?:y|ily)\b/i, '"temporary/temporarily"'],
  [/\binterim\b/i, '"interim"'],
  [/\bas things stand\b/i, '"as things stand"'],
  [/\bnot yet\b/i, '"not yet"'],
  [/\bso far\b/i, '"so far"'],
  [/\bfor the time being\b/i, '"for the time being"'],
];
// ⚠ Every entry here was tuned against the live corpus. Three were tried and REMOVED because they
// fired on ordinary prose, and they are listed so nobody re-adds them:
//   · "later"   — `_proof.mjs`: "calling this helper directly ... currently throws later inside
//                 concatBytes(...)". "later" there means later in the CALL, not later in TIME.
//   · "when X"  — `lint-forbidden-hash.mjs`: "whole-estate run is unchanged when this flag is
//                 absent". A conditional, not a deadline. Narrowed to "when every/all/each".
//   · "until now" — `preflight.mjs`: "The page axis had no gate at all until now". Past tense:
//                 the condition ALREADY resolved, which is the opposite of a pending exit.
const EXIT = [
  [/\buntil\b(?!\s+(?:now|then|recently)\b)/i, '"until"'],
  [/\bonce\b/i, '"once"'],
  [/\beventually\b/i, '"eventually"'],
  [/\bin (?:the |a )?future\b/i, '"in future"'],
  [/\bfor a future\b/i, '"for a future"'],
  [/\bwhen (?:every|all|each)\b/i, '"when every/all/each"'],
];

// ── FAMILY C: a stale-able count — BUILT, MEASURED, AND DELIBERATELY NOT SHIPPED ──────────────
// The tempting third family: a NUMBER sitting next to a present-tense claim ("5 of ~79 kernels
// ship fixtures TODAY"). It was implemented and run against the live corpus twice.
//   · First cut (any `\d+` within 40 chars of today/currently/so far): 15 hits, 3 genuine — 20%.
//   · Second cut, with a bare-cardinal guard rejecting §27.5 / RFC 8949 / v0.4 / #1493 / 12.5% /
//     BN254 / art-231: 13 family-C-only hits, 2 genuine — ~15%. The survivors were JSDoc from the
//     inlined noble bundles ("currently surfaces the native error"), coverage-policy prose, and
//     §-adjacent numbers the guard could not tell from cardinals.
// ⛔ REJECTED. 15% precision is the "flags every `currently`" failure mode the row names: it gets
// baselined into uselessness inside a week, and then the baseline is the only thing anyone reads.
// ⭐ And it earned nothing: family C did not catch a single note that families A and B missed.
// A phasing note by definition NAMES ITS OWN EXIT ("flip to --strict once every kernel has a
// fixture"), so the exit clause is always there to match. A count with no exit clause is a dated
// observation, which is the GOOD form this gate is asking for, not the defect.
// ⚠ The two genuine hits it did find (`_clausebinding.mjs`'s "the 105 server kernels that today
// carry a bare-string regulatory_basis", `check-s18-digest-freshness.mjs`'s "129 stale exist on
// main today") are hardcoded counts with no exit condition. They are reported in the row's census
// as observations; they are not what a phasing-note gate is for.

// ── FAMILY B: a future-change announcement ────────────────────────────────────────────────────
// Each of these says, on its own, "this artifact's behaviour is provisional and will be changed".
// ⭐ The CHANGE VERB is mandatory — that is the whole precision story (see header).
const FUTURE_CHANGE = [
  [/\bflip(?:s|ped|ping)?\s+(?:it\s+|this\s+|that\s+)?to\b/i, '"flip to"'],
  [/\bflip(?:s|ped|ping)?\s+(?:it|this|that)\s+(?:once|when|after|at)\b/i, '"flip it once/when/at"'],
  [/\bswitch(?:es|ed|ing)?\s+(?:it\s+|this\s+|that\s+)?to\b[^.;]{0,80}\b(?:once|until|when|after)\b/i, '"switch to ... once/until"'],
  [/\bre-?tighten\b/i, '"re-tighten"'],
  [/\bpromote\s+(?:it|this|that)\s+to\b[^.;]{0,80}\b(?:once|until|when|after)\b/i, '"promote to ... once"'],
  [/\brevisit\b[^.;]{0,80}\b(?:once|when|after|if\s+the)\b/i, '"revisit once/when"'],
  [/\bphasing\s*:/i, '"Phasing:" label'],
  [/\b(?:advisory|warn(?:ing)?(?:[\s-]only)?|lenient|soft[\s-]fail(?:s|ing)?|non[\s-]blocking)\b[^.;]{0,60}\buntil\b/i, '"advisory/warn-only ... until"'],
  // ⚠ A bare "until X lands/ships" was tried and REMOVED — it fires on ordinary operational prose
  // that names no future edit: preflight.mjs's "will read RED until the batched vendor land runs —
  // an expected window, not breakage" describes a RECURRING window, not a phasing decision. The
  // genuine hits it used to catch (check-copy-hallmarks.mjs's "re-tighten to blocking once that
  // lands") are all still caught by the change-verb patterns above, so it earned nothing.
  [/\bmake\s+(?:it|this|that)\s+(?:a\s+)?(?:hard|blocking|strict)\b/i, '"make it hard/blocking/strict"'],
  [/\bturn\s+(?:it|this|that)\s+(?:on|off)\b[^.;]{0,60}\b(?:once|until|when|after)\b/i, '"turn it on/off once"'],
];

// ── CHECKABLE FORMS ───────────────────────────────────────────────────────────────────────────
// A date (an observation that expires honestly) or a command (the reader re-derives the number).
// ⛔ Deliberately NOT a bare number — see the header's load-bearing call.
const CHECKABLE = [
  [/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/, 'ISO date'],
  [/\bnode\s+[\w./@-]*[\w-]\.(?:mjs|js|cjs)\b/, '`node <script>` command'],
  [/\bpython\s+[\w./-]*[\w-]\.py\b/, '`python <script>` command'],
  [/\bgit\s+(?:grep|ls-files|log|diff|show|rev-parse|cherry)\b/, '`git` command'],
  [/\bgh\s+(?:pr|run|api|workflow|issue)\b/, '`gh` command'],
  [/\bnpm\s+run\s+[\w:-]+/, '`npm run` command'],
  [/\bwsl\.exe\b/, '`wsl.exe` command'],
];

/** Does this note carry a form the next reader can actually re-evaluate? */
export function checkableForm(note) {
  for (const [re, label] of CHECKABLE) if (re.test(note)) return label;
  return null;
}

/** Why (if at all) this note reads as a phasing note. Returns [] when it does not. */
export function phasingReasons(note) {
  const reasons = [];
  for (const [re, label] of FUTURE_CHANGE) {
    if (re.test(note)) reasons.push(`future-change announcement ${label}`);
  }
  const prov = PROVISIONAL.find(([re]) => re.test(note));
  const exit = EXIT.find(([re]) => re.test(note));
  if (prov && exit) reasons.push(`provisional ${prov[1]} + exit condition ${exit[1]}`);
  return reasons;
}

// ── NOTE EXTRACTION ───────────────────────────────────────────────────────────────────────────
// A mini-lexer, not a parser: it tracks string literals so a `//` inside a quoted string is never
// mistaken for a comment (that is how a `'https://…'` URL or a `status: '// pending'` string would
// otherwise land in the corpus), and it tracks both comment forms.
function commentLines(src) {
  const out = new Map(); // 1-based line number -> comment text on that line
  let i = 0, line = 1;
  const n = src.length;
  const push = (ln, text) => {
    const prev = out.get(ln);
    out.set(ln, prev ? `${prev} ${text}` : text);
  };
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    // string literals — skipped wholesale
    if (c === '"' || c === "'" || c === '`') {
      const quote = c; i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '\n') { line++; i++; if (quote !== '`') break; continue; }
        if (src[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      let j = i + 2;
      while (j < n && src[j] !== '\n') j++;
      push(line, src.slice(i + 2, j).trim());
      i = j;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      let j = i + 2;
      const startLine = line;
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) { if (src[j] === '\n') line++; j++; }
      const body = src.slice(i + 2, j);
      body.split('\n').forEach((raw, k) => {
        push(startLine + k, raw.replace(/^\s*\*+\s?/, '').trim());
      });
      i = j + 2;
      continue;
    }
    i++;
  }
  return out;
}

/**
 * Split a source file into NOTES: contiguous runs of non-empty comment lines.
 * ⛔ A blank comment line ends a note. See the header — coarsening this is how the gate goes blind.
 */
export function extractNotes(src, kind) {
  const notes = [];
  if (kind === 'md') {
    const lines = src.split(/\r?\n/);
    let fenced = false, cur = null;
    // ⛔ A blank line is NOT the only note boundary in markdown. CONTRACT.md and SPEC.md write long
    // numbered/bulleted rules with no blank line between items, so a blank-line-only split merged an
    // entire §13.13 rule list into one 3,000-character "note" — at which point an "until" in item 6
    // could be laundered by a date in item 2, and the reported excerpt named the wrong rule. Split
    // on headings and list-item markers too, so a note is one rule.
    const BOUNDARY = /^\s{0,3}(?:#{1,6}\s|(?:\d+|[a-z])[.)]\s|[-*+·]\s|>\s|\|)/;
    lines.forEach((raw, idx) => {
      if (/^\s*(?:```|~~~)/.test(raw)) { fenced = !fenced; if (cur) { notes.push(cur); cur = null; } return; }
      if (fenced) return;
      if (!raw.trim()) { if (cur) { notes.push(cur); cur = null; } return; }
      if (cur && BOUNDARY.test(raw)) { notes.push(cur); cur = null; }
      if (!cur) cur = { line: idx + 1, text: raw.trim() };
      else cur.text += ` ${raw.trim()}`;
    });
    if (cur) notes.push(cur);
    return notes;
  }
  // Same reason as the markdown branch: a header comment that numbers its steps ("1. Reads
  // errata.json ... 3. A ZERO-entry log (errata.json currently ships 0 entries) ... 7. Only once
  // every step above has succeeded") is a LIST, not one statement. Without this split, item 3's
  // "currently" and item 7's "once" combined into a phantom phasing note 30 lines wide.
  const LIST_ITEM = /^(?:\d{1,2}[.)]\s|[-*+·]\s)/;
  const byLine = commentLines(src);
  const lineNums = [...byLine.keys()].sort((a, b) => a - b);
  let cur = null, prevLine = -10;
  for (const ln of lineNums) {
    const text = byLine.get(ln);
    if (!text) { if (cur) { notes.push(cur); cur = null; } prevLine = ln; continue; }
    if (cur && ln === prevLine + 1 && !LIST_ITEM.test(text)) cur.text += ` ${text}`;
    else { if (cur) notes.push(cur); cur = { line: ln, text }; }
    prevLine = ln;
  }
  if (cur) notes.push(cur);
  return notes;
}

/** Every phasing note in `src` that carries NO checkable form. */
export function scanText(src, kind) {
  const hits = [];
  for (const note of extractNotes(src, kind)) {
    const reasons = phasingReasons(note.text);
    if (!reasons.length) continue;
    if (checkableForm(note.text)) continue;
    hits.push({ line: note.line, reasons, excerpt: note.text.slice(0, 140) });
  }
  return hits;
}

// ── SCOPE ENUMERATION ─────────────────────────────────────────────────────────────────────────
// SO #52: `git ls-files`, never a walk. No fallback — if git cannot answer, this gate has no
// denominator and the only honest exit is a failure, not an empty green scan (SO #34c).
const SCOPE_GLOBS = [
  'scripts/*.mjs',
  'scripts/**/*.mjs',
  'chaingraph/standard/*.mjs',
  'chaingraph/kernels/*.mjs',
  'CONTRACT.md',
  'chaingraph/standard/SPEC.md',
];
const SCOPE_EXCLUDE = [
  /\.kernel\.mjs$/,          // kernel bytes — out by construction (SO #36)
  /(^|\/)__proptests__\//,   // generated per-node property tests, not gate headers
  /(^|\/)vendor\//,          // third-party bundles: upstream's comments, not ours
  /\.bundle\.mjs$/,          // inlined/generated bundles (noble crypto, _detmath, _dtree): nobody
                             // hand-edits a bundle, and their JSDoc is upstream's prose, not ours
];
// ⚖ SELF-EXCLUSION, and it is exactly two files. This gate's own header QUOTES the phasing notes it
// detects, verbatim, as worked examples ("Phasing: only 5 of ~79 kernels ship fixtures today ...
// Flip to --strict once every kernel has a fixture"), and so does its self-test's fixture corpus.
// Scanning them would flag the documentation of the rule as a violation of the rule. Same precedent
// as check-generator-coverage.mjs's SELF_EXCLUDE and check-copy-hallmarks.mjs's PII-banner
// exemption. ⛔ This list is pinned by the self-test — widening it is how a real phasing note gets
// parked in a file nobody scans.
export const SELF_EXCLUDE = new Set([
  'scripts/check-phasing-notes.mjs',
  'scripts/check-phasing-notes.test.mjs',
]);

export function inScope(rel) {
  if (SELF_EXCLUDE.has(rel)) return false;
  return !SCOPE_EXCLUDE.some((re) => re.test(rel));
}

function scopeFiles() {
  const raw = execFileSync('git', ['ls-files', '-z', '--', ...SCOPE_GLOBS], { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const all = raw.split('\0').filter(Boolean).map((p) => p.replace(/\\/g, '/'));
  return [...new Set(all)].filter(inScope).sort();
}

// ── RATCHET ───────────────────────────────────────────────────────────────────────────────────
/**
 * Pure ratchet comparison. Exported so the self-test drives it in memory, and so the per-file
 * ceiling goes through assertFiniteCeiling() at BOTH layers (F-11: `count > undefined` is a
 * silent pass, so an absent/corrupt per-file pin must never be read as a permissive one).
 */
export function ratchetVerdict(counts, baseline) {
  const failures = [], improvements = [];
  const perFile = baseline.per_file;
  if (perFile === null || typeof perFile !== 'object' || Array.isArray(perFile)) {
    failures.push('baseline "per_file" must be an object of {path: count} — the per-file ceilings are missing or malformed');
    return { failures, improvements, total: 0 };
  }
  const pinnedFiles = new Set(baseline.files);
  for (const key of Object.keys(perFile)) {
    if (!pinnedFiles.has(key)) failures.push(`baseline drift: "per_file" pins ${key} but "files" does not list it — re-pin with ${REPIN_COMMAND}`);
  }
  for (const key of pinnedFiles) {
    if (!Object.prototype.hasOwnProperty.call(perFile, key)) failures.push(`baseline drift: "files" lists ${key} but "per_file" has no ceiling for it — re-pin with ${REPIN_COMMAND}`);
  }
  let total = 0;
  for (const [rel, hits] of Object.entries(counts)) {
    total += hits.length;
    const pinned = Object.prototype.hasOwnProperty.call(perFile, rel)
      ? assertFiniteCeiling(perFile[rel], { label: BASELINE_LABEL, keyName: `per_file.${rel}` })
      : 0;
    if (hits.length > pinned) {
      failures.push(`${rel}: ${hits.length} unchecked phasing note(s), baseline ${pinned}\n` +
        hits.map((h) => `      line ${h.line}: ${h.reasons.join(' + ')}\n        ${h.excerpt}`).join('\n'));
    } else if (hits.length < pinned) {
      improvements.push(`${rel}: ${pinned} -> ${hits.length}`);
    }
  }
  for (const rel of pinnedFiles) {
    if (!counts[rel]) improvements.push(`${rel}: clean (baseline entry can be dropped)`);
  }
  const ceiling = assertFiniteCeiling(baseline.total, { label: BASELINE_LABEL, keyName: 'total' });
  if (total > ceiling) failures.push(`estate total ${total} unchecked phasing note(s) exceeds the pinned ceiling ${ceiling}`);
  else if (total < ceiling) improvements.push(`estate total ${ceiling} -> ${total}`);
  return { failures, improvements, total };
}

// ── GATE BODY ─────────────────────────────────────────────────────────────────────────────────
// Runs only on direct execution, never on import — the self-test imports the pure functions above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const UPDATE = process.argv.includes('--update-baseline');
  const LIST = process.argv.includes('--list');
  // `--check` is an explicit alias for the default gate mode. It earns its keep with
  // check-generator-coverage.mjs, which otherwise sees only the writeFileSync in --update-baseline
  // and warns about an unguarded generator. The writer here is a deliberate re-pin, not a build
  // step, so the honest answer is "yes, --check is the gate, and preflight runs it".
  const CHECK = process.argv.includes('--check');
  if (CHECK && UPDATE) {
    console.error('✗ check-phasing-notes: --check (gate) and --update-baseline (re-pin) are mutually exclusive.');
    process.exit(1);
  }

  const files = scopeFiles();
  // SO #34c / DENOMINATOR-SENTINEL-1: "0 of 0 clean" is indistinguishable from full coverage in a
  // CI log. If the scope came back empty, the enumeration broke — that is a failure, not a pass.
  if (files.length === 0) {
    console.error('✗ check-phasing-notes: scope enumeration returned ZERO files. `git ls-files` found nothing under the declared globs — the gate examined nothing, which is not a pass (SO #34c).');
    process.exit(1);
  }

  const counts = {};
  for (const rel of files) {
    const kind = rel.endsWith('.md') ? 'md' : 'mjs';
    const hits = scanText(readFileSync(resolve(REPO, rel), 'utf8'), kind);
    if (hits.length) counts[rel] = hits;
  }
  const liveTotal = Object.values(counts).reduce((n, h) => n + h.length, 0);

  if (LIST) {
    for (const [rel, hits] of Object.entries(counts)) {
      for (const h of hits) console.log(`${rel}:${h.line}  ${h.reasons.join(' + ')}\n    ${h.excerpt}`);
    }
    console.log(`\ncheck-phasing-notes: ${liveTotal} unchecked phasing note(s) across ${Object.keys(counts).length} file(s) of ${files.length} scanned.`);
    process.exit(0);
  }

  if (UPDATE) {
    // The ONE sanctioned absent-baseline path (a first-ever pin). An EXISTING but corrupt baseline
    // still hard-fails here rather than being silently overwritten with a fresh, higher ceiling.
    const prior = readBaselineForUpdate(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
    const per_file = {};
    for (const [rel, hits] of Object.entries(counts)) per_file[rel] = hits.length;
    const doc = {
      _comment: 'STALE-PHASING-NOTE-SWEEP-1 ratchet pin. Phasing notes with no checkable form (a date or a re-derivation command). Counts only go DOWN: rewrite a note to carry a date/command, then re-pin with `node scripts/check-phasing-notes.mjs --update-baseline`. Loaded through the hard-failing scripts/ratchet-baseline.mjs: deleting this file REDS the gate, it does not switch it off.',
      total: liveTotal,
      files: Object.keys(counts).sort(),
      per_file,
    };
    if (prior && liveTotal > prior.total) {
      console.error(`✗ check-phasing-notes --update-baseline REFUSED: this would raise the pinned ceiling ${prior.total} -> ${liveTotal}. A ratchet only moves down; fix the new note (give it a date or a command) instead of re-pinning over it.`);
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + '\n');
    console.log(`check-phasing-notes: baseline pinned at ${liveTotal} note(s) across ${doc.files.length} file(s).`);
    process.exit(0);
  }

  const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
  const { failures, improvements } = ratchetVerdict(counts, baseline);

  if (improvements.length) {
    console.log(`check-phasing-notes: ${improvements.length} improvement(s) beat the baseline — tighten with \`${REPIN_COMMAND}\`:\n  ` + improvements.slice(0, 12).join('\n  '));
  }
  if (failures.length) {
    console.error(`\n✗ check-phasing-notes: ${failures.length} FAILURE(s) — phasing note(s) with no checkable form:\n  ` + failures.join('\n  '));
    console.error('\n  A phasing note states a temporary condition and names its own exit, then gets read as permanent fact forever.');
    console.error('  Give it a form the next reader can re-evaluate:');
    console.error('    · a DATE      — "measured 2026-08-23: 5 of 79 kernels ship fixtures"');
    console.error('    · a COMMAND   — "run `node chaingraph/kernels/kernel-contract.test.mjs --strict` to see where this stands"');
    console.error('  A bare hardcoded count is NOT enough — that is exactly the form that went stale (KERNEL-CONTRACT-STRICT-1, PR #1493).');
    console.error(`  Legacy debt is shielded by scripts/phasing-notes-baseline.json and burns down with \`${REPIN_COMMAND}\`; the ceiling only moves DOWN.`);
    process.exit(1);
  }
  console.log(`check-phasing-notes: OK (${files.length} file(s) scanned, ${baseline.total} baselined note(s) within budget).`);
}
