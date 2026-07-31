#!/usr/bin/env node
// check-kernel-asof-staleness.mjs — make dated kernel reference-table pins rot VISIBLY
// (ASOF-GATE-1, KERNEL-ASOF-STALENESS-BUILD-SPEC.md).
//
// WHY: a large minority of kernels encode dated/version-pinned reference data (QM
// points-and-fees tiers, LLPA rates, agency eligibility matrices, and similar). A pinned
// table past its window does NOT error — it returns a confident, well-formed, WRONG
// number carrying a citation that makes it look MORE trustworthy than an unpinned guess.
// Nothing in the estate noticed this before. This gate converts that silent rot into a
// visible fact by comparing an AUTHORED date (declared in the kernel source) against the
// CLOCK — two independently-provenanced sides, so it can actually fire.
//
// THIS GATE IS DELIBERATELY CONSERVATIVE, NOT EXHAUSTIVE. A grep proxy for
// `version-pinned|as_of|effective_date|table_version` over chaingraph/kernels/*.kernel.mjs
// matches ~100+ files, but MOST of those matches are runtime fields on records the kernel
// VALIDATES (a mandate's expires_at, an insurance policy's effective_date, a caller-supplied
// as_of point for a TCO simulation) — NOT the kernel's OWN declaration that its reference
// data is current as of some date. Treating those as staleness candidates would be false
// alarms on data the kernel never claimed was current-as-of anything.
//
// WHAT COUNTS AS A CANDIDATE (vocabulary derived from the files, not assumed):
//   - an object-literal property `table_version` / `table_version_<suffix>` whose value is
//     a literal string (inline, or via a same-file ALL_CAPS const it resolves to)
//   - an object-literal property `effective_date` whose value is a literal string
//   (Runtime forms -- `record.effective_date`, `pp.as_of`, `typeof x.effective_date`,
//   `expires_at`, `as_of_date` used as an INPUT field -- are excluded by construction: they
//   never satisfy "literal string directly assigned to this exact key", because their RHS is
//   a property access, a function call, or a variable, not a quoted literal.)
//
// DELIBERATELY-HISTORICAL vs EXPIRED: many candidate values are CITATIONS to a statute, CFR
// section, mortgagee letter, or bulletin (e.g. "SCRA-50USC3937-2024", "MLA-DOD-32CFR232-2016-
// 10-03", "EU-AIA-ART12-2024-1689-R1") -- the embedded year is WHEN THE RULE WAS PROMULGATED,
// not a claim that the data needs refreshing on that date. Flagging those as "stale" the
// moment the citation year is in the past would be noise the estate would rightly mute. This
// gate detects citation markers (CFR/USC/circular/bulletin/pamphlet/mortgagee-letter/statute-
// bill/EU-regulation-number patterns) and reports those as UNDECIDABLE rather than guessing.
// Only a BARE trailing full date or bare trailing calendar year (no citation marker) is
// treated as a genuine currency pin and classified against the clock.
//
// CLASSES: current | expiring (same calendar year, Oct-Dec -- next update likely imminent) |
// past (declared year has fully elapsed) | undecidable (citation-shaped, or no date found).
// Only "past" is stale for ratchet purposes. No percentage, no blended coverage number --
// output is a list: kernel, declared value, key, and the reason (what the date governs).
//
// RATCHET (mirrors check-s18-digest-freshness.mjs / check-catalog-parity.mjs): the "past"
// (stale) set must not GROW past the pinned baseline (scripts/asof-staleness-baseline.json).
// This gate must not red `main` for pre-existing staleness nobody just introduced. New
// staleness (a pin not in the baseline moving into "past") fails the gate. A pin that gets
// re-pinned and drops out of "past" is NOT auto-removed from the baseline -- tighten with
// --update-baseline.
//
// Usage:
//   node scripts/check-kernel-asof-staleness.mjs                   strict: exit 1 if new "past" beyond baseline
//   node scripts/check-kernel-asof-staleness.mjs --summary          vocabulary + class counts, exit 0
//   node scripts/check-kernel-asof-staleness.mjs --list             full candidate list, exit 0
//   node scripts/check-kernel-asof-staleness.mjs --update-baseline  rewrite baseline to current "past" set

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KDIR = resolve(REPO, 'chaingraph', 'kernels');
const BASELINE_PATH = resolve(HERE, 'asof-staleness-baseline.json');

const SUMMARY = process.argv.includes('--summary');
const LIST = process.argv.includes('--list');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');

const NOW = new Date(); // real clock -- the whole point is comparing an authored date against it

// Citation-shaped values: a statute/CFR/circular/bulletin/mortgagee-letter/draft/EU-regulation
// reference. The trailing year in these is WHEN THE RULE WAS PUBLISHED, not a data-currency
// stamp -- never comparable to the clock without knowing whether the rule itself changed.
const CITATION_MARKER = /CFR|USC|CIRC|BULLETIN|PAMPHLET|-ML\d|SB\d|DRAFT|-1689-|ANNEX\d/i;

const FULL_DATE_RE = /-(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_ONLY_RE = /-(\d{4})$/;

function resolveConstValue(source, name) {
  const re = new RegExp(`\\bconst\\s+${name}\\s*=\\s*(['"])([^'"]*)\\1`);
  const m = source.match(re);
  return m ? m[2] : null;
}

// Extract every literal (key, value) candidate pair from one kernel's source text.
export function findCandidates(source) {
  const out = [];
  // key: 'literal' or key: "literal" -- table_version / table_version_<suffix> / effective_date
  const literalRe = /\b(table_version(?:_\w+)?|effective_date)\s*:\s*(['"])([^'"]*)\2/g;
  let m;
  while ((m = literalRe.exec(source))) {
    out.push({ key: m[1], value: m[3] });
  }
  // key: SOME_CONST -- resolve via same-file ALL_CAPS const declaration
  const constRefRe = /\b(table_version(?:_\w+)?|effective_date)\s*:\s*([A-Z][A-Z0-9_]*)\b/g;
  while ((m = constRefRe.exec(source))) {
    const val = resolveConstValue(source, m[2]);
    if (val) out.push({ key: m[1], value: val });
  }
  // dedupe identical (key, value) pairs from the same file (e.g. object literal repeated
  // across quote styles, or referenced from multiple call sites)
  const seen = new Set();
  return out.filter((c) => {
    const k = `${c.key} ${c.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function classifyCandidate(value, now = NOW) {
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  if (CITATION_MARKER.test(value)) {
    return { class: 'undecidable', reason: 'citation-shaped (statute/CFR/circular/bulletin/mortgagee-letter/draft/EU-reg reference -- the trailing year is when the rule was published, not a data-currency stamp)' };
  }
  const full = value.match(FULL_DATE_RE);
  if (full) {
    const year = Number(full[1]);
    if (year < currentYear) return { class: 'past', reason: `dated ${full[0].slice(1)}, that calendar year has fully elapsed` };
    if (year === currentYear && currentMonth >= 10) return { class: 'expiring', reason: `dated ${full[0].slice(1)}, current year is in its final quarter -- next update likely due` };
    return { class: 'current', reason: `dated ${full[0].slice(1)}, within the current calendar year` };
  }
  const yearOnly = value.match(YEAR_ONLY_RE);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    if (year < currentYear) return { class: 'past', reason: `pinned to calendar year ${year}, which has fully elapsed` };
    if (year === currentYear && currentMonth >= 10) return { class: 'expiring', reason: `pinned to the current calendar year ${year}, now in its final quarter` };
    if (year === currentYear) return { class: 'current', reason: `pinned to the current calendar year ${year}` };
    return { class: 'current', reason: `pinned to a future calendar year ${year}` };
  }
  return { class: 'undecidable', reason: 'no full date or trailing calendar year found in the pin value' };
}

function scanKernels() {
  const files = readdirSync(KDIR).filter((f) => f.endsWith('.kernel.mjs'));
  const results = [];
  const vocab = { table_version: 0, table_version_variant: 0, effective_date: 0 };
  for (const file of files) {
    const source = readFileSync(resolve(KDIR, file), 'utf8');
    const candidates = findCandidates(source);
    for (const c of candidates) {
      if (c.key === 'table_version') vocab.table_version += 1;
      else if (c.key.startsWith('table_version_')) vocab.table_version_variant += 1;
      else if (c.key === 'effective_date') vocab.effective_date += 1;
      const { class: cls, reason } = classifyCandidate(c.value);
      results.push({ file, key: c.key, value: c.value, class: cls, reason });
    }
  }
  return { results, vocab, totalKernels: files.length };
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return { past: [] };
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

function printCandidate(r) {
  console.log(`  ${r.file} :: ${r.key} = "${r.value}" -- ${r.class} (${r.reason})`);
}

// -- CLI entrypoint -----------------------------------------------------------------------
// Guarded so importing findCandidates/classifyCandidate (the fixture test) never triggers a
// filesystem scan or process.exit as a side effect of import.
const isMain = (() => {
  try {
    return resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
  } catch {
    return false;
  }
})();

if (isMain) {
  const { results, vocab, totalKernels } = scanKernels();
  const past = results.filter((r) => r.class === 'past');
  const expiring = results.filter((r) => r.class === 'expiring');
  const current = results.filter((r) => r.class === 'current');
  const undecidable = results.filter((r) => r.class === 'undecidable');

  // identity for the baseline: which file+key+value is stale, not just which file (a file can
  // have more than one pin, and only some may be past)
  const pastIds = past.map((r) => `${r.file} ${r.key} ${r.value}`);

  if (UPDATE_BASELINE) {
    writeFileSync(BASELINE_PATH, JSON.stringify({ past: pastIds.sort() }, null, 2) + '\n');
    console.log(`kernel-asof-staleness: baseline written for ${pastIds.length} known-past pin(s).`);
    process.exit(0);
  }

  const baseline = loadBaseline();
  const baselinedSet = new Set(baseline.past || []);
  const newPast = pastIds.filter((id) => !baselinedSet.has(id));
  const fixed = [...baselinedSet].filter((id) => !pastIds.includes(id));

  if (SUMMARY || LIST) {
    console.log(`kernel-asof-staleness: scanned ${totalKernels} kernel(s).`);
    console.log(`  vocabulary found: table_version=${vocab.table_version}, table_version_<suffix>=${vocab.table_version_variant}, effective_date=${vocab.effective_date}`);
    console.log(`  candidates: ${results.length} total -- current=${current.length}, expiring=${expiring.length}, past=${past.length}, undecidable=${undecidable.length}`);
    console.log(`  baseline: ${baselinedSet.size} pin(s) recorded as pre-existing-past`);
    if (LIST) {
      console.log('\n-- past (stale) --');
      past.forEach(printCandidate);
      console.log('\n-- expiring --');
      expiring.forEach(printCandidate);
      console.log('\n-- undecidable --');
      undecidable.forEach(printCandidate);
      console.log('\n-- current --');
      current.forEach(printCandidate);
    }
    process.exit(0);
  }

  if (fixed.length) {
    console.log(`kernel-asof-staleness: ${fixed.length} baselined pin(s) no longer past -- tighten with --update-baseline:`);
    fixed.forEach((id) => console.log(`  ${id}`));
  }

  if (newPast.length) {
    console.error(`\nkernel-asof-staleness: ${newPast.length} NEW past-dated pin(s) not in the baseline:`);
    newPast.forEach((id) => {
      const r = past.find((p) => `${p.file} ${p.key} ${p.value}` === id);
      printCandidate(r);
    });
    console.error(`\nA kernel's own reference-table pin (table_version / effective_date) has aged past the calendar year it declares. This does not mean the underlying data is wrong -- it means nobody has re-confirmed it since. Either re-pin it (bump the version string after confirming the source), or if the estate has decided to accept it as-is for now, run --update-baseline with a comment explaining why.`);
  }

  if (newPast.length) process.exit(1);
  console.log(`kernel-asof-staleness: OK -- ${baselinedSet.size} baselined past-dated pin(s) within budget, 0 new, ${undecidable.length} undecidable (not counted as stale), ${expiring.length} expiring soon.`);
}
