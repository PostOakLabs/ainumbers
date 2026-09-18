#!/usr/bin/env node
/**
 * scripts/check-count-prose.mjs — HUB-COUNT-STALE-SURFACES-1 step 5: the
 * widened count detector. ADVISORY (never wired as a blocking gate by this
 * row); it exists so the class of stale suite-wide prose counts that the
 * verify-counts plan's regex missed cannot silently regrow.
 *
 * Why this exists. The Phase-0 plan's regex `\d[\d,]*\s*(?:free\s+)?tools?\b`
 * permitted only the literal word "free" between the number and the noun and
 * had no `+` handling, so "484 Fintech Tools", "501 browser-based … tools",
 * "300+ Tools" and "92+ Fintech Tools" were all invisible — and a sitemap-URL
 * crawl could not see `.well-known/*`, `mcp/*.json` or `llms*.txt` at all
 * (verification doc F1: both audit angles shared the blind spot). This scanner
 * matches the row's widened pattern
 *
 *     \d[\d,]*\+?\s+(?:[A-Za-z-]+\s+){0,3}tools?\b
 *
 * (with the `i` flag — as written lowercase-only it would miss "300+ Tools",
 * one of the very surfaces this row fixes) across ALL published dirs from
 * scripts/published-dirs.json PLUS `.well-known/`, `mcp/*.json` and `llms*.txt`,
 * and reports every hit that does NOT sit inside a count sentinel or an
 * ATTR_RULE-gated slot. Hits inside `<!--COUNT:key-->N<!--/COUNT-->` and
 * data-count elements are stripped; digits captured by an ATTR_RULE from
 * scripts/lib/count-rules.mjs (the same table verify-counts.mjs executes) are
 * blanked before matching — everything left is ungated prose.
 *
 * Baseline ratchet (copy-hallmarks mechanics): scripts/count-prose-baseline.json
 * records each file's hit count; a baselined file may carry AT MOST its recorded
 * count (counts only go down) and a file absent from the baseline must be clean,
 * so new ungated prose hits are flagged immediately. The first run's total is
 * the Phase-0 inventory's starting point.
 *
 * Usage:
 *   node scripts/check-count-prose.mjs           # ratchet check (exit 1 over baseline)
 *   node scripts/check-count-prose.mjs --update  # re-baseline (deliberate, reviewed)
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ATTR_RULES } from './lib/count-rules.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const UPDATE = process.argv.includes('--update')
const BASELINE_PATH = resolve(HERE, 'count-prose-baseline.json')

// The row's widened detector regex, case-insensitive so "300+ Tools" is seen.
const PROSE_RE = /\d[\d,]*\+?\s+(?:[A-Za-z-]+\s+){0,3}tools?\b/gi
// Same sentinel shapes verify-counts.mjs scans — a hit INSIDE one is gated.
const SENTINEL_RE = /<!--COUNT:[^-]+?-->\d+<!--\/COUNT-->/g
const DATA_COUNT_RE = /(<[^>]+\bdata-count="[^"]+"[^>]*>)\d+(<\/)/g

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
  let out = content.replace(SENTINEL_RE, ' ')
  out = out.replace(DATA_COUNT_RE, (m, open, digits, close) => `${open}N${close}`)
  for (const { regex } of attrRulesByFile.get(rel) ?? []) {
    const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g'
    out = out.replace(new RegExp(regex.source, flags),
      (match, pre, ...rest) => pre + 'N' + (typeof rest[0] === 'string' ? rest[0] : ''))
  }
  return out
}

const perFile = new Map()
let total = 0
for (const rel of [...files].sort()) {
  const full = resolve(ROOT, rel)
  let content
  try {
    if (!statSync(full).isFile()) continue
    content = readFileSync(full, 'utf8')
  } catch { continue }
  const hits = [...maskGatedDigits(content, rel).matchAll(PROSE_RE)].map(m => m[0])
  if (hits.length) { perFile.set(rel, hits); total += hits.length }
}

// ── 3. Report against the baseline (counts only go down) ────────────────────

let baseline = { _comment: '', files: {} }
if (existsSync(BASELINE_PATH)) {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
}

if (UPDATE) {
  baseline._comment =
    'HUB-COUNT-STALE-SURFACES-1: ungated "N tools"-prose hits per published file ' +
    '(check-count-prose.mjs). A file may carry AT MOST its recorded count; a file ' +
    'absent from this map must be clean. Regenerate only for a deliberate, reviewed ' +
    'inventory reset — never to paper over a regression.'
  baseline.files = Object.fromEntries([...perFile.entries()].map(([f, h]) => [f, h.length]))
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n')
  console.log(`count-prose advisory: baselined ${total} ungated prose hit(s) across ${perFile.size} file(s) -> scripts/count-prose-baseline.json`)
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
