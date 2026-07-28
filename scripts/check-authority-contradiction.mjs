#!/usr/bin/env node
/**
 * scripts/check-authority-contradiction.mjs — CB4-CONTRADICTION-GATE-1.
 *
 * Builds an authority index (normalized regulatory identifier -> every live
 * surface asserting it as current, unqualified authority) and goes RED when
 * two live surfaces assert DIFFERENT current authority for the SAME
 * computation. Zero network, zero npm deps — pure local check over our own
 * files, so unlike scripts/check-citation-staleness.mjs (which asks a
 * publisher whether an identifier is stale) this one IS gate-eligible.
 *
 * ⛔ This is NOT a supersession table. It does not know that SR 26-2
 * replaces SR 11-7, or which of two disagreeing surfaces is "right" — it
 * only detects that two surfaces disagree. (CLAUSE-BINDING-BUILD-SPEC.md §5
 * as originally written proposed a hand-seeded supersession table; that is
 * DEAD — SUPERSESSION-DETECT-1 already covers "is this stale" via publisher
 * lookups. This script covers the other half: "do we contradict ourselves.")
 *
 * "Same computation" is derived, not asserted: two files are in scope for
 * comparison only if they share a topical tag that is NOT common across the
 * estate (the frequent-tag threshold below, computed from the data itself —
 * no hand-picked stopword list). Within that shared-topic pair, identifiers
 * are compared only within the same identifier FAMILY (same issuing body +
 * series, e.g. Federal Reserve SR letters), because two different families
 * co-cited by the same topic are routinely both correct (e.g. a tool citing
 * both SR 11-7 and OCC 2011-12 is not a contradiction).
 *
 * Usage: node scripts/check-authority-contradiction.mjs [--json out.json]
 * Exit 0 = no contradiction found (known-unswept gaps are printed, not
 *          failed — see KNOWN_UNSWEPT_GAPS below).
 * Exit 1 = at least one contradiction found; printed as a list, never a
 *          ratio (CLAUSE-BINDING-BUILD-SPEC.md §0.7).
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TOOLS_DIR = join(REPO, 'tools')
const GUIDES_DIR = join(REPO, 'guides')

// ── Known-unswept gaps (CLAUSE-BINDING-BUILD-SPEC.md §5) ────────────────────
// Neither pattern below is covered by the family recognizers this script
// uses: Basel III/Endgame/IV are prose-named revisions of the same accord
// with no stable short-form identifier to normalize against, and EMIR vs
// EMIR Refit are DIFFERENT EU regulation numbers (648/2012 vs 2019/834), so
// the EU-REG family key (keyed by regulation number, see normalizeIdentifier)
// deliberately does not fuse them. Printed so a green run is never read as
// "these are consistent" — inherited as gaps, not swept.
const KNOWN_UNSWEPT_GAPS = [
  { label: 'Basel III vs Endgame/IV consistency', expectedFiles: 34 },
  { label: 'EMIR vs EMIR Refit consistency', expectedFiles: 4 },
]

// ── Identifier family recognizers ────────────────────────────────────────
// Each returns {family, canonical, contradictionEligible} or null. Order
// matters: first match wins.
//
// `contradictionEligible` is the false-positive guard, MEASURED not assumed:
// a first pass grouped CFR parts by TITLE ONLY and BCBS documents by ONE
// shared bucket, and against the live estate that produced 37 flags — nearly
// all noise (31 CFR 1010.410 vs 31 CFR 1020.210 shared only the "fatf" tag
// and are unrelated rules; BCBS 189 [capital] vs BCBS 238 [LCR] shared only
// "capital"/"basel iii" and are different standards, not competing current-
// authority claims). ONLY Fed SR letters and OCC Bulletins are eligible: both
// are single-issuer, sequentially numbered GUIDANCE LETTER series where a
// later letter routinely supersedes or updates earlier guidance on the same
// topic — the exact shape of the measured SR 11-7 → SR 26-2 incident. CFR
// parts and BCBS standard numbers are each their own distinct rule/document;
// citing two different ones is normal, not a disagreement. Still indexed
// (visible in the authority index) — just excluded from the contradiction
// comparison so the gate doesn't cry wolf on ordinary citation diversity.
const FAMILIES = [
  {
    // Federal Reserve SR letters: "SR 11-7", "SR11-7", "SR 26-02", "SR-15-18"
    family: 'FED-SR',
    re: /\bSR[\s-]?(\d{2})[\s-](\d{1,3})\b/i,
    canonical: (m) => `SR ${m[1]}-${parseInt(m[2], 10)}`,
    contradictionEligible: true,
  },
  {
    // OCC Bulletins: "OCC Bulletin 2011-12", "OCC 2011-12"
    family: 'OCC-BULLETIN',
    re: /\bOCC\s+(?:Bulletin\s+)?(\d{4})-(\d{1,3})\b/i,
    canonical: (m) => `OCC ${m[1]}-${parseInt(m[2], 10)}`,
    contradictionEligible: true,
  },
  {
    // Basel Committee standards: "BCBS 239", "BCBS239" — each number is its
    // own distinct standard (capital, LCR, NSFR, leverage, disclosure, …),
    // not a supersession series. Indexed only.
    family: 'BASEL-BCBS',
    re: /\bBCBS[\s-]?(\d{2,4})\b/i,
    canonical: (m) => `BCBS ${parseInt(m[1], 10)}`,
    contradictionEligible: false,
  },
  {
    // US CFR cites: "12 CFR 1010.410", "31 CFR Part 1020" — family keyed by
    // title + PART (not title alone: different parts under one title are
    // different rules, e.g. 12 CFR 1005 [Reg E] vs 12 CFR 1033 [data rights]
    // are unrelated). Indexed only — CFR parts aren't a supersession series.
    family: null,
    re: /\b(\d{1,3})\s*CFR\s*(?:Part\s*)?(\d{1,5})(?:\.(\d+))?\b/i,
    canonical: (m) => `${m[1]} CFR ${m[2]}${m[3] ? '.' + m[3] : ''}`,
    familyOf: (m) => `CFR-${m[1]}-${m[2]}`,
    contradictionEligible: false,
  },
  {
    // EU Regulations/Directives: "Regulation (EU) 2015/847", "Directive 2015/849"
    // — family keyed by the regulation/directive number itself, deliberately
    // (see KNOWN_UNSWEPT_GAPS: EMIR 648/2012 vs EMIR Refit 2019/834 stay
    // distinct families rather than being fused as "the same computation").
    // Indexed only.
    family: null,
    re: /\b(Regulation|Directive)\s*\(?EU\)?\s*(?:No\s*)?(\d{4}\/\d+)\b/i,
    canonical: (m) => `EU ${m[1]} ${m[2]}`,
    familyOf: (m) => `EU-${m[1].toUpperCase()}-${m[2]}`,
    contradictionEligible: false,
  },
]

export function normalizeIdentifier(raw) {
  for (const f of FAMILIES) {
    const m = raw.match(f.re)
    if (!m) continue
    return {
      family: f.familyOf ? f.familyOf(m) : f.family,
      canonical: f.canonical(m),
      contradictionEligible: f.contradictionEligible,
    }
  }
  return null
}

// ── Extraction helpers ───────────────────────────────────────────────────
function extractQuotedStrings(bracketContent) {
  const out = []
  const re = /(['"])((?:(?!\1)[^\\]|\\.)*)\1/g
  let m
  while ((m = re.exec(bracketContent))) out.push(m[2])
  return out
}

function extractArrayField(text, fieldNames) {
  // Grabs the first `<field>: [ ... ]` (any quote style on the key, JS or
  // JSON) and returns its quoted-string members. Non-greedy up to the first
  // `]` — every observed usage in this estate is a flat string array with no
  // nested brackets, so this is safe and avoids a full JS parser.
  for (const name of fieldNames) {
    const re = new RegExp(`["']?${name}["']?\\s*:\\s*\\[([^\\]]*)\\]`, 'i')
    const m = text.match(re)
    if (m) return extractQuotedStrings(m[1])
  }
  return []
}

export function loadEntries(root = REPO) {
  const toolsDir = join(root, 'tools')
  const guidesDir = join(root, 'guides')
  const files = []
  for (const dir of [toolsDir, guidesDir]) {
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.html')) files.push(join(dir, f))
    }
  }

  const entries = []
  for (const path of files) {
    const text = readFileSync(path, 'utf8')
    const rawIds = [
      ...extractArrayField(text, ['regulatory_frameworks']),
      ...extractArrayField(text, ['regulatory_citations']),
    ]
    if (rawIds.length === 0) continue
    const tags = extractArrayField(text, ['tags']).map((t) => t.toLowerCase().trim())
    const identifiers = []
    for (const raw of rawIds) {
      const n = normalizeIdentifier(raw)
      if (n) identifiers.push({ raw, ...n })
    }
    if (identifiers.length === 0) continue
    entries.push({ file: path.slice(root.length + 1).replace(/\\/g, '/'), tags, identifiers })
  }
  return entries
}

// ── Topic-tag stoplist, derived from the corpus itself ──────────────────
// A tag is "generic" (excluded from topic-overlap comparison) if it appears
// on more than FREQ_THRESHOLD of the files that carry ANY tags at all. No
// hand-picked TOPIC word list — this is recomputed every run against live
// data. FREQ_THRESHOLD alone isn't enough at this estate's scale, though:
// tag frequencies are sparse everywhere (measured — "occ" appears on only 8
// files, "model risk" on 3, neither near a 5% floor), so a frequency cutoff
// can't tell "names the computation" (model risk, MRM) from "names the
// regulator" (occ, federal reserve, fdic) apart. The second kind is
// tautological: a tool citing an OCC Bulletin will almost always ALSO carry
// an "occ" tag, so two OCC-citing tools about unrelated computations share
// that tag by construction, not because they compute the same thing.
// ISSUER_NAME_TAGS names exactly the issuing bodies the FAMILIES recognizers
// above already know how to parse (Federal Reserve/SR, OCC, FDIC as the
// third banking-agency co-tag routinely cross-listed alongside OCC/Fed,
// BCBS/Basel, EU) — narrow and tied to the regex recognizers, not a
// supersession or domain-knowledge list.
const ISSUER_NAME_TAGS = new Set(['occ', 'federal reserve', 'fed', 'frb', 'fdic', 'bcbs', 'basel', 'basel committee', 'eu', 'european union'])
const FREQ_THRESHOLD = 0.05

export function computeStoplist(entries) {
  const withTags = entries.filter((e) => e.tags.length > 0)
  const counts = new Map()
  for (const e of withTags) {
    for (const t of new Set(e.tags)) counts.set(t, (counts.get(t) || 0) + 1)
  }
  const stop = new Set()
  // A tag seen on exactly one file can never be "generic" regardless of the
  // fraction it represents (matters on small corpora, e.g. this file's own
  // fixture tests) — require at least 2 occurrences before considering it.
  const minCount = Math.max(2, Math.ceil(withTags.length * FREQ_THRESHOLD))
  for (const [tag, count] of counts) if (count >= minCount) stop.add(tag)
  return stop
}

export function buildAuthorityIndex(entries) {
  const index = new Map() // canonical -> [{file, raw, family}]
  for (const e of entries) {
    for (const id of e.identifiers) {
      if (!index.has(id.canonical)) index.set(id.canonical, [])
      index.get(id.canonical).push({ file: e.file, raw: id.raw, family: id.family })
    }
  }
  return index
}

export function findContradictions(entries, stoplist) {
  const contradictions = []
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]
      const sharedTopic = a.tags.filter((t) => !stoplist.has(t) && !ISSUER_NAME_TAGS.has(t) && b.tags.includes(t))
      if (sharedTopic.length === 0) continue

      const familiesA = new Map() // family -> Set(canonical)
      for (const id of a.identifiers) {
        if (!id.contradictionEligible) continue
        if (!familiesA.has(id.family)) familiesA.set(id.family, new Set())
        familiesA.get(id.family).add(id.canonical)
      }
      const familiesB = new Map()
      for (const id of b.identifiers) {
        if (!id.contradictionEligible) continue
        if (!familiesB.has(id.family)) familiesB.set(id.family, new Set())
        familiesB.get(id.family).add(id.canonical)
      }

      for (const family of familiesA.keys()) {
        if (!familiesB.has(family)) continue
        const idsA = familiesA.get(family)
        const idsB = familiesB.get(family)
        const disjoint = [...idsA].every((x) => !idsB.has(x))
        if (disjoint) {
          contradictions.push({
            family,
            sharedTopic,
            a: { file: a.file, identifiers: [...idsA] },
            b: { file: b.file, identifiers: [...idsB] },
          })
        }
      }
    }
  }
  return contradictions
}

export function run(entries) {
  const resolvedEntries = entries || loadEntries()
  const stoplist = computeStoplist(resolvedEntries)
  const authorityIndex = buildAuthorityIndex(resolvedEntries)
  const contradictions = findContradictions(resolvedEntries, stoplist)
  return { entries: resolvedEntries, stoplist, authorityIndex, contradictions }
}

// ── Baseline ratchet (same pattern as scripts/copy-hallmarks-baseline.json) ─
// The live estate carries ONE known contradiction as of this gate's first
// run (tools/339 vs tools/451 — see BASELINE_PATH). Wiring a brand-new gate
// straight into preflight with zero shielding would redden the shared branch
// over a finding this WU's fence doesn't authorize fixing (CB4's fence is
// scripts/ only, never repo/tools/). The baseline shields exactly the
// already-known set; anything NOT in it is a genuinely NEW contradiction and
// still fails the gate. Counts only go down — shrink the baseline file by
// hand as contradictions get fixed, never grow it without deliberate review.
export function contradictionKey(c) {
  const [f1, f2] = [c.a.file, c.b.file].sort()
  return `${c.family}::${f1}::${f2}`
}

const BASELINE_PATH = resolve(REPO, 'scripts', 'authority-contradiction-baseline.json')

function loadBaseline() {
  try {
    return new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')))
  } catch {
    return new Set()
  }
}

// ── CLI entrypoint ───────────────────────────────────────────────────────
const isMain = (() => {
  try {
    return resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
  } catch {
    return false
  }
})()

if (isMain) {
  const jsonIdx = process.argv.indexOf('--json')
  const jsonOut = jsonIdx !== -1 ? process.argv[jsonIdx + 1] : null
  const doUpdate = process.argv.includes('--update')

  const { authorityIndex, contradictions, stoplist } = run()

  if (doUpdate) {
    const keys = contradictions.map(contradictionKey).sort()
    writeFileSync(BASELINE_PATH, JSON.stringify(keys, null, 2) + '\n')
    console.log(`authority-contradiction: baseline written for ${keys.length} known contradiction(s).`)
    process.exit(0)
  }

  if (jsonOut) {
    const plain = {
      authority_index: Object.fromEntries([...authorityIndex.entries()]),
      contradictions,
      stoplist_tags: [...stoplist],
    }
    writeFileSync(jsonOut, JSON.stringify(plain, null, 2))
  }

  const baseline = loadBaseline()
  const known = contradictions.filter((c) => baseline.has(contradictionKey(c)))
  const fresh = contradictions.filter((c) => !baseline.has(contradictionKey(c)))

  if (known.length > 0) {
    console.log(`⚠ ${known.length} known (baselined) authority contradiction(s) — shrink scripts/authority-contradiction-baseline.json as these get fixed:\n`)
    for (const c of known) {
      console.log(`  [${c.family}] shared topic: ${c.sharedTopic.join(', ')}`)
      console.log(`    ${c.a.file} asserts: ${c.a.identifiers.join(', ')}`)
      console.log(`    ${c.b.file} asserts: ${c.b.identifiers.join(', ')}`)
      console.log('')
    }
  }

  if (fresh.length > 0) {
    console.log(`✗ ${fresh.length} NEW authority contradiction(s) found:\n`)
    for (const c of fresh) {
      console.log(`  [${c.family}] shared topic: ${c.sharedTopic.join(', ')}`)
      console.log(`    ${c.a.file} asserts: ${c.a.identifiers.join(', ')}`)
      console.log(`    ${c.b.file} asserts: ${c.b.identifiers.join(', ')}`)
      console.log('')
    }
  } else if (known.length === 0) {
    console.log('✓ no authority contradictions found among files carrying regulatory identifiers')
  } else {
    console.log('✓ no NEW authority contradictions beyond the baseline')
  }

  // Known-unswept gaps — always printed, never gates. A green result above
  // must not be read as "these are checked and clean" (CLAUSE-BINDING-BUILD-
  // SPEC.md §5): the family recognizers here do not fuse these identifier
  // groups, by design (see KNOWN_UNSWEPT_GAPS comment above).
  console.log('\nKnown-unswept (not evaluated by this check, inherited as gaps):')
  for (const gap of KNOWN_UNSWEPT_GAPS) {
    console.log(`  - ${gap.label} (spec-cited ~${gap.expectedFiles} files, not scanned by this check)`)
  }

  process.exit(fresh.length > 0 ? 1 : 0)
}
