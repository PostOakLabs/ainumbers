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

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { deriveCounts } from './counts.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const FIX = process.argv.includes('--fix')

const read  = rel => readFileSync(resolve(root, rel), 'utf8')
const write = (rel, txt) => writeFileSync(resolve(root, rel), txt, 'utf8')

// ── 1. Derive counts ─────────────────────────────────────────────────────────

const C = deriveCounts()

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
// Each rule: { file, key, label, regex, group }
//   regex  — regex to find the count occurrence; group = capture group index (1-based)
//   flags  — optional regex flags (default 'g')
//
// --fix mode: replaces the captured group with the expected value.
// --check mode: reports expected vs got.

const ATTR_RULES = [
  // ── docs/index.html ─────────────────────────────────────────────────────
  { file: 'docs/index.html', key: 'tools.browser', label: 'meta description',
    regex: /(content="Developer documentation[^"]*?\. MCP-native[^"]*?\. )(\d+)( browser-based)/,
  },
  { file: 'docs/index.html', key: 'mcp.live', label: 'meta description (mcp.live)',
    regex: /(content="Developer documentation[^"]*?\. MCP-native[^"]*?\. \d+ browser-based[^"]*?\()(\d+)( live on the MCP)/,
  },
  { file: 'docs/index.html', key: 'tools.browser', label: 'og:description',
    regex: /(content="MCP-native, OpenAPI-documented[^"]*?suite\. )(\d+)( tools)/,
  },
  { file: 'docs/index.html', key: 'mcp.live', label: 'og:description (mcp.live)',
    regex: /(content="MCP-native, OpenAPI-documented[^"]*?suite\. \d+ tools \()(\d+)( live)/,
  },
  { file: 'docs/index.html', key: 'tools.browser', label: 'schema.org description',
    regex: /(\"description\": \"MCP-native, OpenAPI-documented[^"]*?suite\. )(\d+)( tools,)/,
  },
  { file: 'docs/index.html', key: 'mcp.live', label: 'schema.org description (mcp.live)',
    regex: /(\"description\": \"MCP-native, OpenAPI-documented[^"]*?suite\. \d+ tools, )(\d+)( live)/,
  },

  // ── index.html (head meta/title — body text uses comment sentinels) ──────
  { file: 'index.html', key: 'tools.browser', label: 'meta description',
    regex: /(content=")(\d+)( free, open-source fintech tools designed by Post Oak Labs)/,
  },
  { file: 'index.html', key: 'tools.browser', label: 'og:description',
    regex: /(content=")(\d+)( free browser-based fintech tools designed by Post Oak Labs)/,
  },
  { file: 'index.html', key: 'tools.browser', label: 'twitter:description',
    regex: /(content=")(\d+)( free browser-based fintech tools for A2A payments)/,
  },
  { file: 'index.html', key: 'tools.browser', label: 'schema.org description',
    regex: /(\"description\": \")(\d+)( free, open-source browser-based fintech tools for payments)/,
  },

  // ── sitemap.html ─────────────────────────────────────────────────────────
  { file: 'sitemap.html', key: 'tools.browser', label: 'LLMEO comment text',
    regex: /(║  • )(\d+)( free tools, all client-side)/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'title',
    regex: /(<title>Sitemap \| AINumbers\.co — )(\d+)( Free Fintech Tools<\/title>)/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'meta description',
    regex: /(content="Complete sitemap of AINumbers\.co\. )(\d+)( free browser-based)/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'og:title',
    regex: /(content="Sitemap \| AINumbers\.co — )(\d+)( Free Fintech Tools")/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'og:description',
    regex: /(content="Every tool, every page\. )(\d+)( free browser-based)/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'twitter:title',
    regex: /(content="Sitemap \| AINumbers\.co — )(\d+)( Free Fintech Tools")/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'schema.org description',
    regex: /(\"description\": \")(\d+)( free browser-based fintech tools for payments engineers)/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'schema.org numberOfItems',
    regex: /(\"numberOfItems\": )(\d+)(,)/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'schema.org ItemList description',
    regex: /(\"description\": \"All )(\d+)( free fintech tools)/,
  },

  // ── JSON machine files ───────────────────────────────────────────────────
  { file: 'mcp/server.json', key: 'tools.browser', label: 'tool_count',
    regex: /(\"tool_count\": )(\d+)/,
  },
  { file: '.well-known/mcp.json', key: 'tools.browser', label: 'ainumbers-fintech-suite tool_count',
    regex: /(\"id\": \"ainumbers-fintech-suite\"[^}]*?\"tool_count\": )(\d+)/s,
  },
  { file: '.well-known/mcp.json', key: 'mcp.live', label: 'ainumbers-apps tool_count',
    regex: /(\"id\": \"ainumbers-apps\"[^}]*?\"tool_count\": )(\d+)/s,
  },
]

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
        console.warn(`NO-MATCH  ${file}  ${label}  regex did not match anything`)
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
  'sitemap.html',
  'tools.html',
  'mcp.html',
  'chaingraph/chaingraph-hub.html',
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
