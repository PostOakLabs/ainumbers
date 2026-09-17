#!/usr/bin/env node
/**
 * scripts/verify-counts.mjs — Count-drift prevention gate.
 *
 * Two modes:
 *   node scripts/verify-counts.mjs          # --check (CI default)
 *   node scripts/verify-counts.mjs --fix    # write correct values to all sentinel sites
 *
 * Sentinel formats checked:
 *   1. HTML comment sentinels in text content:
 *        <!--COUNT:key-->N<!--/COUNT-->
 *   2. data-count attributes on span/div elements:
 *        <span data-count="key">N</span>
 *   3. ATTR_RULES — file-specific regex patterns for meta content, title,
 *        JSON field values, and llms.txt lines where HTML comments can't be used.
 *
 * The gate catches drift on ALL count sites; add new rules when adding new pages.
 * Exit 1 on any mismatch in --check mode.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { deriveCounts } from './counts.mjs'
import { ATTR_RULES } from './lib/count-rules.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const FIX = process.argv.includes('--fix')

// MERGEGROUP-HARD-GATES-1: overlay-read. On merge_group, DERIVED_ROOT points
// at the ephemeral assembled tree; reads prefer a scratch copy when the
// assembly produced one and fall back to the checkout otherwise. Unset
// everywhere else — behaviour byte-for-byte unchanged.
const DERIVED_ROOT = process.env.DERIVED_ROOT && process.env.DERIVED_ROOT.trim()
  ? resolve(root, process.env.DERIVED_ROOT.trim()) : null
const read = rel => {
  const scratch = DERIVED_ROOT ? resolve(DERIVED_ROOT, rel) : null
  return readFileSync(scratch && existsSync(scratch) ? scratch : resolve(root, rel), 'utf8')
}
const write = (rel, txt) => writeFileSync(resolve(root, rel), txt, 'utf8')

// ── 1. Derive counts ─────────────────────────────────────────────────────────

const C = await deriveCounts()

// ── 2. HTML comment sentinel scanner/fixer ───────────────────────────────────

const SENTINEL_RE = /<!--COUNT:([^-]+?)-->(\d+)<!--\/COUNT-->/g
const DATA_COUNT_RE = /(<[^>]+\bdata-count="([^"]+)"[^>]*>)(\d+)(<\/)/g

function checkHtmlSentinels(rel) {
  let html = read(rel)
  let drifted = 0
  let changed = false

  // Comment sentinels
  html = html.replace(SENTINEL_RE, (match, key, valStr) => {
    const expected = C[key]
    if (expected === undefined) {
      console.warn(`UNKNOWN-KEY  ${rel}  key="${key}" not in deriveCounts() — skipping`)
      return match
    }
    const got = parseInt(valStr, 10)
    if (got !== expected) {
      console.log(`DRIFT  ${rel}  <!--COUNT:${key}-->  expected=${expected} got=${got}`)
      drifted++
      if (FIX) { changed = true; return `<!--COUNT:${key}-->${expected}<!--/COUNT-->` }
    } else {
      console.log(`OK     ${rel}  <!--COUNT:${key}-->  ${got}`)
    }
    return match
  })

  // data-count attributes
  html = html.replace(DATA_COUNT_RE, (match, openFull, key, valStr, close) => {
    const expected = C[key]
    if (expected === undefined) {
      console.warn(`UNKNOWN-KEY  ${rel}  data-count="${key}" not in deriveCounts() — skipping`)
      return match
    }
    const got = parseInt(valStr, 10)
    if (got !== expected) {
      console.log(`DRIFT  ${rel}  data-count="${key}"  expected=${expected} got=${got}`)
      drifted++
      if (FIX) { changed = true; return `${openFull}${expected}${close}` }
    } else {
      console.log(`OK     ${rel}  data-count="${key}"  ${got}`)
    }
    return match
  })

  if (FIX && changed) { write(rel, html); console.log(`WROTE  ${rel}`) }
  return drifted
}

// ── 3. Attribute / JSON / text rules ─────────────────────────────────────────
//
// The rule table itself lives in scripts/lib/count-rules.mjs and is imported
// above (moved verbatim, no rule changes — REGEN-INFRA-REGISTRY-READBACK-
// CYCLE-1): gen-infra-registry.mjs derives its description-rewrite exemption
// from the SAME table, so a future count rule cannot re-open the read-back
// cycle silently. Each rule: { file, key, label, regex }.
//   regex  — regex to find the count occurrence; group = capture group index (1-based)
//
// --fix mode: replaces the captured group with the expected value.
// --check mode: reports expected vs got.

function checkAttrRules() {
  const byFile = new Map()
  for (const rule of ATTR_RULES) {
    if (!byFile.has(rule.file)) byFile.set(rule.file, [])
    byFile.get(rule.file).push(rule)
  }

  let total = 0
  for (const [file, rules] of byFile) {
    let content = read(file)
    let changed = false
    for (const { key, label, regex } of rules) {
      const expected = C[key]
      if (expected === undefined) {
        console.warn(`UNKNOWN-KEY  ${file}  key="${key}" — skipping`)
        continue
      }
      const flags = regex.flags.includes('g') ? regex.flags : regex.flags + ''
      const re = new RegExp(regex.source, flags.includes('g') ? flags : flags + 'g')
      let matched = false
      content = content.replace(re, (match, pre, valStr, ...rest) => {
        matched = true
        // rest[0] is group3 (string) if regex has 3 groups, or the offset (number) if only 2 groups
        const post = typeof rest[0] === 'string' ? rest[0] : ''
        const got = parseInt(valStr, 10)
        if (got !== expected) {
          console.log(`DRIFT  ${file}  ${label}  expected=${expected} got=${got}`)
          total++
          if (FIX) { changed = true; return `${pre}${expected}${post}` }
        } else {
          console.log(`OK     ${file}  ${label}  ${got}`)
        }
        return match
      })
      if (!matched) {
        // A declared sentinel that matches NOTHING = silent coverage loss — markup was reworded/
        // removed and this count is now unverified (exactly how drift sneaks back undetected). FAIL
        // it: a count that can't be located can't be verified. Fix the regex or delete the row
        // deliberately; never warn-and-pass. (Not auto-fixable — there's nothing to substitute.)
        console.log(`NO-MATCH  ${file}  ${label}  regex did not match anything — FAIL (update or remove this sentinel)`)
        total++
      }
    }
    if (FIX && changed) { write(file, content); console.log(`WROTE  ${file}`) }
  }
  return total
}

// ── 4. llms.txt rules ────────────────────────────────────────────────────────

function checkLlms() {
  let content = read('llms.txt')
  let drifted = 0
  let changed = false

  const llmsRules = [
    { key: 'tools.browser', regex: /(suite of )(\d+)( browser-based fintech tools)/g },
    { key: 'tools.browser', regex: /(tool grid \()(\d+)( tools\))/g },
    { key: 'guides.hubs',   regex: /(→ )(\d+)( integration hubs)/g },
    { key: 'tools.browser', regex: /(→ )(\d+)( individual standalone fintech utilities)/g },
    { key: 'tools.browser', regex: /(Tool count as of [0-9-]+: )(\d+)( tools in)/g },
    { key: 'manifests',     regex: /(\()(\d+)( with MCP manifests in)/g },
  ]

  for (const { key, regex } of llmsRules) {
    const expected = C[key]
    content = content.replace(regex, (match, pre, valStr, post) => {
      const got = parseInt(valStr, 10)
      if (got !== expected) {
        console.log(`DRIFT  llms.txt  [${key}] "${pre}N${post}"  expected=${expected} got=${got}`)
        drifted++
        if (FIX) { changed = true; return `${pre}${expected}${post}` }
      } else {
        console.log(`OK     llms.txt  [${key}]  ${got}`)
      }
      return match
    })
  }

  if (FIX && changed) { write('llms.txt', content); console.log(`WROTE  llms.txt`) }
  return drifted
}

// ── 5. Run all checks ─────────────────────────────────────────────────────────

let total = 0

// HTML files with comment sentinels (also covers data-count attributes)
for (const rel of [
  'docs/index.html',
  'index.html',
  'start.html',
  'about.html',
  'chaingraph/openchain-graph-paper.html',
  'sitemap.html',
  'tools.html',
  'mcp.html',
  'chaingraph/chaingraph-hub.html',
  'chaingraph/zkvm-compute-integrity.html',
  'chaingraph/why-openchain-graph.html',
  'fv-explainer.html',
  // INFRA-PAGE-1: the generated infrastructure page's data-count="infra_pages"
  // sentinel (key derived in counts.mjs from data/infra-registry.json).
  'infrastructure.html',
  // PROMPT-LIBRARY-PAGE-2: the generated prompt library's
  // data-count="showcase_prompts" hero sentinel (key registered in counts.mjs
  // from the same mcp/showcase-prompts.json read gen-prompts-page.mjs renders
  // from — gate, generator, and the index.html topic tile share one number;
  // --fix owns the tile so the merge-commit regen cannot diverge).
  'prompts.html',
  // CLAIMS-SENTINEL-TIER1-1 (audit Q7) — the five hub hero paragraphs' spelled-out tool counts,
  // now numeral + <!--COUNT:hubTools.*--> sentinels alongside every same-page copy of the figure
  // (hero-eyebrow, sec-heading(s), last-reviewed, sec-sub). tradetech-hub.html's meta/og/JSON-LD
  // copies are attribute/JSON contexts and live in ATTR_RULES above instead.
  'guides/dora-operational-resilience-hub.html',
  'guides/fraud-risk-hub.html',
  'guides/sme-financial-health-hub.html',
  'guides/tradetech-hub.html',
  'guides/capital-markets-settlement-hub.html',
]) {
  total += checkHtmlSentinels(rel)
}

// Attribute / JSON rules
total += checkAttrRules()

// llms.txt
total += checkLlms()

// ── 6. Result ─────────────────────────────────────────────────────────────────

if (total === 0) {
  console.log('\nAll counts in sync.')
  process.exit(0)
} else if (FIX) {
  console.log(`\nFixed ${total} count(s).`)
  process.exit(0)
} else {
  console.log(`\n${total} count(s) drifted. Run with --fix to repair.`)
  process.exit(1)
}
