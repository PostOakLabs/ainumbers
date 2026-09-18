#!/usr/bin/env node
/**
 * scripts/check-count-prose.mjs — HUB-COUNT-STALE-SURFACES-1 step 5, widened
 * by HUB-COUNT-DETECTOR-WIDEN-2: the count-prose detector. ADVISORY (never
 * wired as a blocking gate by either row); it exists so the class of stale
 * suite-wide prose counts that the verify-counts plan's regex missed cannot
 * silently regrow.
 *
 * Why this exists. The Phase-0 plan's regex `\d[\d,]*\s*(?:free\s+)?tools?\b`
 * permitted only the literal word "free" between the number and the noun and
 * had no `+` handling, so "484 Fintech Tools", "501 browser-based … tools",
 * "300+ Tools" and "92+ Fintech Tools" were all invisible — and a sitemap-URL
 * crawl could not see `.well-known/*`, `mcp/*.json` or `llms*.txt` at all
 * (verification doc F1: both audit angles shared the blind spot).
 *
 * WIDEN-2 closes the two holes remediation plan v2 (§1a) measured in the
 * HUB-COUNT-STALE-SURFACES-1 pattern:
 *   1. the filler bound `{0,3}` let "8 free browser-based real-time payments
 *      tools" (realtime-payments-ops-hub) and "14 free browser-based
 *      regulatory compliance tools" (regulatory-compliance-consent-hub)
 *      escape — the bound is now `{0,5}`;
 *   2. the filler class `[A-Za-z-]+` rejected alphanumeric tokens, so
 *      "All 21 Cat-11 tools" (dlt-tokenization-hub) was misread as the
 *      substring match "11 tools" — a too-tight detector does not only
 *      under-count, it mis-reads. The filler class is now alphanumeric-safe.
 * The widened pattern, EXPORTED below for reuse (HUB-COUNT-DERIVE-AT-REGEN-1's
 * generators import the SAME pattern, so detector and generators cannot desync):
 *
 *     \d[\d,]*\+?\s+(?:[A-Za-z0-9][A-Za-z0-9-]*\s+){0,5}tools?\b
 *
 * (with the `i` flag — as written lowercase-only it would miss "300+ Tools",
 * one of the very surfaces the original row fixed).
 *
 * Non-count denylist. Some digit+noun shapes are NAMES, not counts — the
 * known case (plan v2 §3a) is "the AIUC-1 evidence tools" on
 * guides/aiuc-insurance-evidence.html, where AIUC-1 is a standard's name, not
 * a count of one. Each NON_COUNT_PHRASES entry is a LITERAL phrase carrying a
 * one-line reason, blanked before matching. Never a regex: a pattern broad
 * enough to be convenient is broad enough to hide a real count; a literal
 * phrase only ever hides itself.
 *
 * Spelled numerals (plan v2 §1a.3 — the class the original DORA drift rode,
 * and one no numeral detector can see). The SAME filler rule anchored on the
 * capital-initial words Two…Twenty is matched in the same pass, but it is
 * ADVISORY ONLY: it gets its own baseline key (`spelledFiles`, counts only go
 * down) and NEVER affects the exit code, so legacy spelled-out copy cannot red
 * a PR. `--report-spelled` prints file, line and phrase for every hit, then
 * the total and the top ten files.
 *
 * The scanner matches across ALL published dirs from scripts/published-dirs.json
 * PLUS `.well-known/`, `mcp/*.json` and `llms*.txt`, and reports every hit that
 * does NOT sit inside a count sentinel or an ATTR_RULE-gated slot. Hits inside
 * `<!--COUNT:key-->N<!--/COUNT-->` and data-count elements are stripped; digits
 * captured by an ATTR_RULE from scripts/lib/count-rules.mjs (the same table
 * verify-counts.mjs executes) are blanked before matching — everything left is
 * ungated prose.
 *
 * Baseline ratchet (copy-hallmarks mechanics): scripts/count-prose-baseline.json
 * records each file's hit count under `files` (numeric detector) and
 * `spelledFiles` (spelled advisory); a baselined file may carry AT MOST its
 * recorded count and a file absent from the map must be clean, so new ungated
 * prose hits are flagged immediately. Only `files` affects the exit code.
 *
 * Usage:
 *   node scripts/check-count-prose.mjs                  # ratchet check (exit 1 over baseline)
 *   node scripts/check-count-prose.mjs --update         # re-baseline (deliberate, reviewed)
 *   node scripts/check-count-prose.mjs --report-spelled # spelled-numeral advisory report
 *
 * Self-test (behavioural pair, authored RED-first against the pre-widen
 * regex): scripts/check-count-prose.test.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ATTR_RULES } from './lib/count-rules.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const UPDATE = process.argv.includes('--update')
const REPORT_SPELLED = process.argv.includes('--report-spelled')
const BASELINE_PATH = resolve(HERE, 'count-prose-baseline.json')

// ── 0. Detector patterns + non-count denylist (EXPORTED — stable API) ────────
// HUB-COUNT-DERIVE-AT-REGEN-1's generators import these very constants so a
// future detector change cannot desync from the consumers. Factories return a
// FRESH regex per call: `g`-flagged regexes carry lastIndex state and must not
// be shared across modules.

// Filler between the numeral and the noun: at most five alphanumeric-safe
// words (letters, digits, hyphen) — widened from `{0,3}` + `[A-Za-z-]+`.
export const COUNT_PROSE_FILLER = '(?:[A-Za-z0-9][A-Za-z0-9-]*\\s+){0,5}'

export const NUMERIC_COUNT_PROSE_SOURCE = `\\d[\\d,]*\\+?\\s+${COUNT_PROSE_FILLER}tools?\\b`

// Spelled class: capital-initial Two…Twenty (the measured plan §1a.3 class —
// hero/heading copy like "Eleven"), same filler rule, noun either case.
export const SPELLED_COUNT_WORDS =
  'Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|' +
  'Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty'
export const SPELLED_COUNT_PROSE_SOURCE =
  `\\b(?:${SPELLED_COUNT_WORDS})\\s+${COUNT_PROSE_FILLER}[tT]ools?\\b`

export function makeNumericCountProseRegex(flags = 'gi') {
  return new RegExp(NUMERIC_COUNT_PROSE_SOURCE, flags)
}
export function makeSpelledCountProseRegex(flags = 'g') {
  return new RegExp(SPELLED_COUNT_PROSE_SOURCE, flags)
}

// Literal-phrase non-count denylist. Each entry: the exact phrase (NO regex
// metacharacters — enforced by check-count-prose.test.mjs) + a one-line
// reason. A regex here could be broad enough to hide a real count; a literal
// phrase only hides itself.
export const NON_COUNT_PHRASES = [
  {
    phrase: 'AIUC-1 evidence tools',
    reason: 'AIUC-1 is a standard\'s name, not a count of one — the plan v2 §3a false positive on guides/aiuc-insurance-evidence.html',
  },
  {
    phrase: 'ISO 20022',
    reason: 'the digits are the messaging standard\'s number; "ISO 20022 tools" names a standard, never a count',
  },
  {
    phrase: 'Level 3',
    reason: 'a named tier/product designation; the digit belongs to the name, not a count',
  },
]

// Blank every denylist phrase before matching (exact, case-sensitive literal
// split/join — the most conservative reading of "literal phrase").
export function maskNonCountPhrases(content) {
  let out = content
  for (const { phrase } of NON_COUNT_PHRASES) out = out.split(phrase).join(' ')
  return out
}

// Ungated numeric prose hits in `content` (already sentinel/ATTR-masked by the
// caller when scanning a real file; pure on raw text for tests/generators).
export function countProseHits(content) {
  return [...maskNonCountPhrases(content).matchAll(makeNumericCountProseRegex())].map(m => m[0])
}

// Spelled-numeral advisory hits as {index, text} spans (the CLI derives line
// numbers from index; tests and generators read .text).
export function spelledProseHits(content) {
  return [...maskNonCountPhrases(content).matchAll(makeSpelledCountProseRegex())]
    .map(m => ({ index: m.index, text: m[0] }))
}

// ── 1. Collect the scan set ──────────────────────────────────────────────────
// Every published directory from published-dirs.json (flatDirs, recursiveDirs
// minus its excludes, externalSurfaces hosts, rootPages) PLUS .well-known/,
// mcp/*.json and llms*.txt — the surfaces the sitemap-URL crawl could not see.

const pub = JSON.parse(readFileSync(resolve(ROOT, 'scripts', 'published-dirs.json'), 'utf8'))

function walkDir(abs, rel, out) {
  let entries
  try { entries = readdirSync(abs, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const r = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) {
      if (pub.recursiveExcludeSubdirs?.some(x => r === x || r.startsWith(x + '/'))) continue
      walkDir(join(abs, e.name), r, out)
    } else {
      out.add(r)
    }
  }
}

function collectFiles() {
  const files = new Set()
  for (const dir of pub.flatDirs ?? []) walkDir(resolve(ROOT, dir), dir, files)
  for (const dir of pub.recursiveDirs ?? []) walkDir(resolve(ROOT, dir), dir, files)
  for (const ext of pub.externalSurfaces ?? []) walkDir(resolve(ROOT, ext.dir), ext.dir, files)
  for (const page of pub.rootPages ?? []) files.add(page.path)
  walkDir(resolve(ROOT, '.well-known'), '.well-known', files)
  for (const f of readdirSync(resolve(ROOT, 'mcp'))) {
    if (f.endsWith('.json')) files.add(`mcp/${f}`)
  }
  for (const f of readdirSync(ROOT)) {
    if (/^llms.*\.txt$/.test(f)) files.add(f)
  }
  return files
}

// ── 2. Neutralise gated digits, then count prose hits ───────────────────────

// ATTR_RULES by file: blank each rule's captured count digits (group 2) so a
// gated slot can never surface as a prose hit. Same group shape verify-counts
// --fix replaces.
const attrRulesByFile = new Map()
for (const rule of ATTR_RULES) {
  if (!attrRulesByFile.has(rule.file)) attrRulesByFile.set(rule.file, [])
  attrRulesByFile.get(rule.file).push(rule)
}

function maskGatedDigits(content, rel) {
  const SENTINEL_RE = /<!--COUNT:[^-]+?-->\d+<!--\/COUNT-->/g
  const DATA_COUNT_RE = /(<[^>]+\bdata-count="[^"]+"[^>]*>)\d+(<\/)/g
  let out = content.replace(SENTINEL_RE, ' ')
  out = out.replace(DATA_COUNT_RE, (m, open, digits, close) => `${open}N${close}`)
  for (const { regex } of attrRulesByFile.get(rel) ?? []) {
    const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g'
    out = out.replace(new RegExp(regex.source, flags),
      (match, pre, ...rest) => pre + 'N' + (typeof rest[0] === 'string' ? rest[0] : ''))
  }
  return out
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length
}

function scan() {
  const perFile = new Map()
  const spelledPerFile = new Map()
  let total = 0
  let spelledTotal = 0
  for (const rel of [...collectFiles()].sort()) {
    const full = resolve(ROOT, rel)
    let content
    try {
      if (!statSync(full).isFile()) continue
      content = readFileSync(full, 'utf8')
    } catch { continue }
    const masked = maskGatedDigits(content, rel)
    const hits = countProseHits(masked)
    const spelled = spelledProseHits(masked)
      .map(({ index, text }) => ({ line: lineOf(content, index), text }))
    if (hits.length) { perFile.set(rel, hits); total += hits.length }
    if (spelled.length) { spelledPerFile.set(rel, spelled); spelledTotal += spelled.length }
  }
  return { perFile, spelledPerFile, total, spelledTotal }
}

// ── 3. Report against the baseline (counts only go down) ────────────────────

function main() {
  const { perFile, spelledPerFile, total, spelledTotal } = scan()

  let baseline = { _comment: '', files: {}, spelledFiles: {} }
  if (existsSync(BASELINE_PATH)) {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  }

  if (UPDATE) {
    baseline._comment =
      'HUB-COUNT-STALE-SURFACES-1 + HUB-COUNT-DETECTOR-WIDEN-2: ungated "N tools"-prose ' +
      'hits per published file (check-count-prose.mjs, widened alphanumeric-safe {0,5} ' +
      'filler + literal-phrase non-count denylist). `files` gates the numeric ratchet; ' +
      '`spelledFiles` is the spelled-numeral advisory key (Two..Twenty, never blocks). ' +
      'A file may carry AT MOST its recorded count; a file absent from a map must be ' +
      'clean. Regenerate only for a deliberate, reviewed inventory reset — never to ' +
      'paper over a regression.'
    baseline.files = Object.fromEntries([...perFile.entries()].map(([f, h]) => [f, h.length]))
    baseline.spelledFiles =
      Object.fromEntries([...spelledPerFile.entries()].map(([f, h]) => [f, h.length]))
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n')
    console.log(`count-prose advisory: baselined ${total} ungated prose hit(s) across ${perFile.size} file(s) and ${spelledTotal} spelled hit(s) across ${spelledPerFile.size} file(s) -> scripts/count-prose-baseline.json`)
    process.exit(0)
  }

  // Spelled-numeral advisory (own baseline key, never affects the exit code —
  // legacy spelled copy cannot red a PR; reported so it cannot silently regrow).
  const spelledBaseline = baseline.spelledFiles ?? {}
  const spelledOver = []
  for (const [rel, hits] of spelledPerFile) {
    const allowed = spelledBaseline[rel]
    if (allowed === undefined || hits.length > allowed) {
      spelledOver.push({ rel, hits: hits.length, allowed })
    }
  }
  for (const { rel, hits, allowed } of spelledOver) {
    console.log(`SPELLED-OVER (advisory)  ${rel}  ${hits} spelled hit(s) (spelled baseline: ${allowed === undefined ? 'not baselined' : allowed})`)
  }
  const spelledBaselinedTotal = Object.values(spelledBaseline).reduce((a, b) => a + b, 0)
  console.log(`count-prose advisory (spelled): ${spelledTotal} spelled "Word .. tools" hit(s) across ${spelledPerFile.size} published file(s) (baseline shields ${spelledBaselinedTotal} across ${Object.keys(spelledBaseline).length} files; ADVISORY ONLY — never blocks)`)

  if (REPORT_SPELLED) {
    for (const [rel, hits] of [...spelledPerFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      for (const h of hits) console.log(`SPELLED  ${rel}:${h.line}: ${h.text}`)
    }
    const top = [...spelledPerFile.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .slice(0, 10)
    console.log(`count-prose advisory (spelled): top ten files:`)
    for (const [rel, hits] of top) console.log(`  ${String(hits.length).padStart(4)}  ${rel}`)
    process.exit(0)
  }

  const over = []
  for (const [rel, hits] of perFile) {
    const allowed = baseline.files[rel]
    if (allowed === undefined || hits.length > allowed) {
      over.push({ rel, hits: hits.length, allowed })
    }
  }
  for (const { rel, hits, allowed } of over) {
    const ex = (perFile.get(rel) ?? []).slice(0, 3).map(s => JSON.stringify(s)).join(', ')
    console.log(`OVER  ${rel}  ${hits} hit(s) (baseline: ${allowed === undefined ? 'none — file must be clean' : allowed})  e.g. ${ex}`)
  }
  const baselinedTotal = Object.values(baseline.files).reduce((a, b) => a + b, 0)
  console.log(`count-prose advisory: ${total} ungated "<n> tools"-prose hit(s) across ${perFile.size} published file(s) (baseline shields ${baselinedTotal} across ${Object.keys(baseline.files).length} files; counts only go down)`)
  if (over.length) {
    console.log(`count-prose advisory: ${over.length} file(s) OVER baseline — new ungated count prose must be sentinel-wrapped or ATTR_RULE-gated, or the inventory re-baselined deliberately.`)
    process.exit(1)
  }
  process.exit(0)
}

// Library when imported (check-count-prose.test.mjs, HUB-COUNT-DERIVE-AT-REGEN-1
// generators); CLI only when run directly — the pre-widen version ran its scan
// at module top level, which made the module unimportable.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main()
}
