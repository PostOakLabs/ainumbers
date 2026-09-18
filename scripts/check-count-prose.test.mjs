// check-count-prose.test.mjs — HUB-COUNT-DETECTOR-WIDEN-2
//
// Behavioural pair for the widened count-prose detector (remediation plan v2
// §1a + §3a). The detector's regexes and the denylist are imported from
// check-count-prose.mjs itself — the SAME pattern HUB-COUNT-DERIVE-AT-REGEN-1's
// generators must import — so this test cannot drift from what the scanner and
// the generators actually run.
//
// RED-first (SO #34c): authored against the OLD `{0,3}` / `[A-Za-z-]+` regex
// before the script was widened. On that script every behavioural check below
// fails, and the import itself dies: the pre-widen script ran its whole-repo
// scan at module top level and process.exit()ed during import, so ZERO checks
// ran. Both facts are quoted in the row's check-off.
//
// Run:  node scripts/check-count-prose.test.mjs
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

console.log('check-count-prose.test.mjs: importing scripts/check-count-prose.mjs ...')
const mod = await import('./check-count-prose.mjs')

let fail = 0
let ran = 0
const ok = (c, m) => {
  ran++
  if (!c) { fail++; console.error('  ✗ ' + m) } else console.log('  ✓ ' + m)
}
// A behavioural check must survive the module lacking an export: RED against
// the pre-widen script reports the missing behaviour, not a crash.
const call = (fn, ...args) => { try { return fn(...args) } catch { return undefined } }

// ── 1. Exports exist (HUB-COUNT-DERIVE-AT-REGEN-1 imports the SAME pattern) ──
ok(typeof mod.makeNumericCountProseRegex === 'function', 'exports makeNumericCountProseRegex()')
ok(typeof mod.makeSpelledCountProseRegex === 'function', 'exports makeSpelledCountProseRegex()')
ok(typeof mod.countProseHits === 'function' && typeof mod.spelledProseHits === 'function',
  'exports countProseHits() + spelledProseHits()')
ok(typeof mod.maskNonCountPhrases === 'function', 'exports maskNonCountPhrases()')
ok(Array.isArray(mod.NON_COUNT_PHRASES) && mod.NON_COUNT_PHRASES.length > 0, 'exports a non-empty NON_COUNT_PHRASES')

const NUM_SOURCE = '\\d[\\d,]*\\+?\\s+(?:[A-Za-z0-9][A-Za-z0-9-]*\\s+){0,5}tools?\\b'
const numRe = call(mod.makeNumericCountProseRegex)
ok(numRe instanceof RegExp && numRe.source === NUM_SOURCE && numRe.flags.includes('i'),
  `numeric detector source is the widened alphanumeric-safe {0,5} pattern — got ${JSON.stringify(numRe && numRe.source)}`)
ok(call(mod.makeNumericCountProseRegex) !== call(mod.makeNumericCountProseRegex),
  'makeNumericCountProseRegex() returns a FRESH regex per call (no shared lastIndex state)')

// ── 2. The two hub phrases that escaped the OLD {0,3} bound (plan v2 §1a.1) ──
const realtime = '8 free browser-based real-time payments tools covering FedNow participation readiness.'
const regcomp = '14 free browser-based regulatory compliance tools covering GDPR/UK GDPR data subject rights.'
const rtHits = call(mod.countProseHits, realtime) ?? []
ok(rtHits.length === 1 && rtHits[0] === '8 free browser-based real-time payments tools',
  `realtime-payments-ops-hub phrase caught with claim 8 — got ${JSON.stringify(rtHits)}`)
const rcHits = call(mod.countProseHits, regcomp) ?? []
ok(rcHits.length === 1 && rcHits[0] === '14 free browser-based regulatory compliance tools',
  `regulatory-compliance-consent-hub phrase caught with claim 14 — got ${JSON.stringify(rcHits)}`)

// ── 3. Alphanumeric-safe filler (plan v2 §1a.2): digits inside a filler word ──
const dlt = 'All 21 Cat-11 tools unified as a single enterprise DLT onboarding suite.'
const dltHits = call(mod.countProseHits, dlt) ?? []
ok(dltHits.length === 1 && dltHits[0] === '21 Cat-11 tools',
  `dlt-tokenization "21 Cat-11 tools" read as claim 21, not the old misread "11 tools" — got ${JSON.stringify(dltHits)}`)
ok((call(mod.countProseHits, '9 alpha beta gamma delta epsilon tools') ?? []).length === 1,
  'five filler words still caught ({0,5} bound)')
ok((call(mod.countProseHits, '9 alpha beta gamma delta epsilon zeta tools') ?? []).length === 0,
  'six filler words escape ({0,5} bound holds)')
ok((call(mod.countProseHits, '300+ Tools') ?? []).length === 1,
  'regression guard: "300+ Tools" (case + plus suffix) still caught')

// ── 4. Non-count denylist (plan v2 §3a): literal phrases only, with reasons ──
for (const e of mod.NON_COUNT_PHRASES ?? []) {
  ok(typeof e.phrase === 'string' && typeof e.reason === 'string' && e.reason.length > 0,
    `denylist entry ${JSON.stringify(e.phrase)} carries a one-line reason`)
  ok(!/[\\^$.*+?(){}[\]|]/.test(e.phrase || ''),
    `denylist entry ${JSON.stringify(e.phrase)} is a LITERAL phrase (no regex metacharacters — never broad enough to hide a real count)`)
}
ok((call(mod.countProseHits, 'Explore the AIUC-1 evidence tools across the insurance evidence hub.') ?? []).length === 0,
  'denylist: "the AIUC-1 evidence tools" (a standard\'s name) is NOT counted')
ok((call(mod.countProseHits, 'ISO 20022 tools and messages') ?? []).length === 0,
  'denylist: "ISO 20022 tools" (digit belongs to the standard\'s name) is NOT counted')
ok((call(mod.countProseHits, 'Level 3 tools') ?? []).length === 0,
  'denylist: "Level 3 tools" (digit belongs to the name) is NOT counted')
const around = call(mod.countProseHits, '5 free ISO 20022 migration tools shipped today') ?? []
ok(around.length === 1 && around[0].startsWith('5'),
  `denylist does not hide a REAL count around a name: "5 free ISO 20022 migration tools" counted — got ${JSON.stringify(around)}`)

// ── 5. Spelled numerals (plan v2 §1a.3 — the DORA-drift class), advisory ──
// spelledProseHits returns {index, text} spans (the CLI derives line numbers
// from index); the assertions read the .text of each span.
const sp = (s) => (call(mod.spelledProseHits, s) ?? []).map((h) => h.text)
ok(JSON.stringify(sp('Three free tools')) === JSON.stringify(['Three free tools']),
  `"Three free tools" caught as spelled — got ${JSON.stringify(sp('Three free tools'))}`)
ok(sp('Eleven operational resilience tools across the DORA domains.').length === 1,
  '"Eleven operational resilience tools" (the original DORA drift shape) caught as spelled')
ok(sp('Twenty real-time settlement tools').length === 1,
  '"Twenty real-time settlement tools" caught as spelled (same filler rule as the numeric class)')
ok(sp('Eleven Tools').length === 1, '"Eleven Tools" (capitalised noun) caught as spelled')
ok(sp('two free tools').length === 0,
  'lowercase "two free tools" NOT in the spelled class (capital-initial words, per the measured plan §1a.3 class)')
ok(sp('Browse the AIUC-1 evidence tools today.').length === 0,
  'spelled detector applies the same denylist ("Three AIUC-1 evidence tools" shapes cannot fire)')

if (ran === 0) {
  console.error('check-count-prose.test.mjs: NO checks ran — the module under test could not be imported.')
  process.exit(1)
}
if (fail) {
  console.error(`\ncheck-count-prose.test.mjs: ${fail}/${ran} FAILURE(s)`)
  process.exit(1)
}
console.log(`\ncheck-count-prose.test.mjs: all ${ran} checks passed.`)
