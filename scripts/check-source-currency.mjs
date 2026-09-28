#!/usr/bin/env node
/**
 * scripts/check-source-currency.mjs — SOURCE-CURRENCY-FEED-1.
 *
 * The first gate that asks THE SOURCE whether a pinned section changed, rather than
 * re-reading citation strings. The citation gates below it (check-citation-drift,
 * check-chain-citation, check-kernel-asof-staleness, check-amendment-detection,
 * check-clause-digest) all check citation TEXT, as-of staleness, or clause digests;
 * none of them knows whether eCFR amended the section after a kernel pinned it.
 *
 * THE MAP (scripts/source-currency.json) is the record: {generated_at, sections:
 * {"<title> CFR <unit>": {last_amended, latest_issue_date, kernels: [ids]}}}. It is
 * written by the WORKSPACE-ROOT network instrument (AINumbers/scripts/
 * source-currency-refresh.mjs), which queries eCFR's versioner once per section-unit —
 * GET https://www.ecfr.gov/api/versioner/v1/versions/title-{T}.json?section={S}
 * (dotted sections) or ?part={P} (part-level pins; the coarsest unit eCFR versions —
 * an appendix/chapter citation normalizes to its part and carries the part's latest
 * amendment, conservative in the flagging direction). THIS GATE NEVER TOUCHES THE
 * NETWORK: it reads the committed map offline and re-derives its side of the
 * comparison from the current tree, so the map's age is always visible against live
 * kernel pins.
 *
 * WHAT IS COMPARED (per kernel with a CFR citation, same scope the row measured —
 * chaingraph/kernels/art-*.mjs, 54 of 638 files): the kernel's pinned date vs the
 * unit's last_amended. The pin is the kernel's most recent confirmation, from:
 *   - cited_clause_digest[].retrieved_at in its graph node
 *     (chaingraph/graph/nodes/<TOOL_ID>.json), and/or
 *   - an as_of / as_of_date / effective_date / table_version literal in the kernel
 *     source (the ASOF-GATE-1 vocabulary; runtime property reads never match because
 *     only quoted literals carry a value).
 * A year-only pin (e.g. table_version '...-29CFR1607-2024') compares by calendar year
 * with a same-year exemption: an amendment INSIDE the pinned year cannot be ordered
 * against a year pin, so it is undecidable, not flagged.
 *
 * FINDINGS:
 *   - FLAGGED          unit's last_amended is AFTER the kernel's pin — kernel id,
 *                      unit, both dates, pin kind. These become their own rows
 *                      (staged from this list); this gate never fixes kernels.
 *   - UNMAPPED_SECTION kernel cites a unit the map does not carry — the map is
 *                      stale against the tree; re-run the refresh instrument.
 *   - MISSING_MAP      the map file itself is absent.
 * A kernel with citations but NO comparable pin is listed (NO-PIN), never flagged.
 *
 * ADVISORY vs BLOCKING — never a typed baseline: the JSON itself is the record.
 *   - Advisory (exit 0, findings printed) by default and on pull_request, so the
 *     initial FLAGGED set can be triaged into rows without reddening every PR.
 *   - Blocking (exit 1) only when SOURCE_CURRENCY_ENFORCE=1 and not a pull_request —
 *     the switch CI-on-main flips once the initial set is triaged. From then on a
 *     re-pin clears a kernel's flag with no baseline to burn down.
 *
 * Usage:
 *   node scripts/check-source-currency.mjs            # gate (preflight + CI)
 *   node scripts/check-source-currency.mjs --list     # distinct units + citing kernels, no map needed
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KDIR = resolve(REPO, 'chaingraph', 'kernels');
const NODES_DIR = resolve(REPO, 'chaingraph', 'graph', 'nodes');
export const MAP_PATH = resolve(HERE, 'source-currency.json');

// ---------------------------------------------------------------------------
// Citation extraction — the SSOT for kernel CFR citations. The workspace-root
// refresh instrument imports exactly this function, so the map and this gate can
// never disagree about what a kernel cites. (Both shapes below are measured in the
// live estate: spaced prose citations and no-space table_version identifiers.)
// ---------------------------------------------------------------------------

// "32 CFR 232.4(c)(1)(i)", "12 CFR 1026 Appendix J", "17 CFR 240.15c3-3",
// "12 CFR part 1026", "15 CFR Parts 730", "12 CFR pt 370", "15 CFR §744".
// Section ids interleave letters and digits ("15c3", "16b"): the suffix after the
// dot is digits, then any number of letter+digit runs and dash segments.
const CFR_SPACED = /\b(\d{1,2})\s+(?:C\.F\.R\.|CFR)\s+(?:§\s*)?(?:(?:parts?|pts?)\s+)?(\d{1,4}(?:\.\d+(?:[a-zA-Z]+\d*)*(?:-[a-zA-Z0-9]+)*)?)\b/gi;
// No-space identifier pins: "32CFR232-2015-10-01", "29CFR1607-2024",
// "12CFR1003", "31CFR1010.230-2024". A trailing date suffix is a pin marker,
// not part of the identifier.
const CFR_NOSPACE = /\b(\d{1,2})CFR(\d{1,4}(?:\.\d+(?:[a-zA-Z]+\d*)*(?:-[a-zA-Z0-9]+)*)?)/g;
// A trailing -YYYY or -YYYY-MM-DD year-stamped pin suffix (19xx/20xx only, so
// "240.15c3-3"'s clause dash is never eaten).
const DATE_SUFFIX = /-(?:19|20)\d{2}(?:-\d{2}){0,2}$/;

/**
 * Parse one title+token pair into the canonical unit key and its query shape.
 * Dotted tokens are section units ("32 CFR 232.4"); bare numbers are part units,
 * the coarsest thing eCFR versions ("12 CFR part 1026"). Returns null for
 * out-of-range titles (CFR titles are 1..54).
 */
export function normalizeCfrUnit(title, token) {
  const t = Number(title);
  if (!Number.isInteger(t) || t < 1 || t > 54) return null;
  if (token.includes('.')) return { unit: `${t} CFR ${token}`, kind: 'section' };
  return { unit: `${t} CFR part ${token}`, kind: 'part' };
}

/**
 * Extract every CFR unit a kernel source cites. Pure: source text in, sorted
 * [{unit, kind}] out. Deduplicated. Chapter-level prose ("31 CFR Chapter X")
 * yields no token and is correctly absent — the refresh instrument counts it.
 * Deliberately NO comment stripping: a large share of the estate's citations live
 * in // comments (art-431/536/628 measured), so stripping them hides real pins. The
 * cost is accepted: a citation wrapped across a comment continuation (art-538's
 * "(17 CFR\n// 240.15c3-3(b))") parses as unit-less and is reported as such.
 */
export function extractCfrCitations(source) {
  const units = new Map();
  let m;
  CFR_SPACED.lastIndex = 0;
  while ((m = CFR_SPACED.exec(source))) {
    const norm = normalizeCfrUnit(m[1], m[2]);
    if (norm) units.set(norm.unit, norm);
  }
  CFR_NOSPACE.lastIndex = 0;
  while ((m = CFR_NOSPACE.exec(source))) {
    const token = m[2].replace(DATE_SUFFIX, '');
    const norm = normalizeCfrUnit(m[1], token);
    if (norm) units.set(norm.unit, norm);
  }
  return [...units.values()].sort((a, b) => (a.unit < b.unit ? -1 : a.unit > b.unit ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Pin extraction — the kernel's own declared currency dates (ASOF-GATE-1's
// vocabulary: literal strings on as_of/as_of_date/effective_date/table_version
// keys, directly or via a same-file ALL_CAPS const). Runtime property reads never
// match: their RHS is not a quoted literal.
// ---------------------------------------------------------------------------

const PIN_KEY = /\b(as_of(?:_date)?|effective_date|table_version(?:_\w+)?)\s*:\s*(?:([A-Z][A-Z0-9_]*)|(['"])([^'"]*)\3)/g;
const FULL_DATE = /\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/g;
const BARE_YEAR = /\b((?:19|20)\d{2})\b/g;
// Non-global twin for .test() — a /g/ regex's lastIndex would leak across calls.
const FULL_DATE_TEST = /\b(?:19|20)\d{2}-\d{2}-\d{2}\b/;

function resolveConst(source, name) {
  const re = new RegExp(`\\bconst\\s+${name}\\s*=\\s*(['"])([^'"]*)\\1`);
  const m = source.match(re);
  return m ? m[2] : null;
}

/**
 * Extract the year/full-date pins declared in one kernel source. Returns
 * { full: ['YYYY-MM-DD', ...], years: ['YYYY', ...] } — unsorted, deduplicated.
 */
export function kernelSourcePins(source) {
  const full = new Set();
  const years = new Set();
  PIN_KEY.lastIndex = 0;
  let m;
  while ((m = PIN_KEY.exec(source))) {
    const value = m[2] ? (resolveConst(source, m[2]) ?? '') : (m[4] ?? '');
    let d;
    FULL_DATE.lastIndex = 0;
    while ((d = FULL_DATE.exec(value))) full.add(d[0]);
    BARE_YEAR.lastIndex = 0;
    while ((d = BARE_YEAR.exec(value))) years.add(d[1]);
  }
  return { full: [...full], years: [...years] };
}

/** A pin as a comparable (date, coarse) pair; a year pin is Jan-1 and coarse. */
function toComparable(dateStr, coarse) {
  return { date: dateStr.length === 4 ? `${dateStr}-01-01` : dateStr, coarse };
}

/** The kernel's best (latest) comparable pin from a source-pin set, or null. */
function bestPinFrom(pins) {
  const all = [
    ...pins.full.map((d) => toComparable(d, false)),
    ...pins.years.map((y) => toComparable(y, true)),
  ];
  if (!all.length) return null;
  return all.reduce((a, b) => (b.date > a.date ? b : a));
}

/**
 * The kernel's best pin across all provenances: its graph node's
 * cited_clause_digest retrieved_at dates (full dates) plus its source pins.
 * Returns { date, coarse, kind } or null when the kernel declares no pin at all.
 */
export function kernelPin(source, node) {
  const candidates = [];
  const sourcePins = kernelSourcePins(source);
  if (sourcePins.full.length || sourcePins.years.length) {
    const best = bestPinFrom(sourcePins);
    if (best) candidates.push({ ...best, kind: best.coarse ? 'source year pin (as_of/effective_date/table_version)' : 'source date pin (as_of/effective_date/table_version)' });
  }
  const digestDates = (node?.cited_clause_digest ?? [])
    .map((c) => c.retrieved_at)
    .filter((d) => typeof d === 'string' && FULL_DATE_TEST.test(d));
  for (const d of digestDates) candidates.push({ ...toComparable(d, false), kind: 'clause-digest retrieved_at' });
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (b.date > a.date ? b : a));
}

// ---------------------------------------------------------------------------
// Finding computation — pure, so the paired test drives it on fixtures without
// touching the real tree (GATE-SELFTEST-META-1: prove the gate CAN go red).
// ---------------------------------------------------------------------------

/**
 * flagged iff last_amended is strictly after the pin, with the year-pin same-year
 * exemption: a coarse pin inside last_amended's year cannot be ordered, so it is
 * undecidable, not flagged.
 */
export function isAmendedAfterPin(pin, lastAmended) {
  if (!pin) return false;
  if (lastAmended <= pin.date) return false;
  if (pin.coarse && lastAmended.slice(0, 4) === pin.date.slice(0, 4)) return false;
  return true;
}

/**
 * Pure comparator over one kernel's citations against the map's sections.
 * map.sections: { [unit]: { last_amended, ... } }. Returns findings:
 * [{kind: 'FLAGGED'|'UNMAPPED_SECTION', kernel, unit, ...}]. NO-PIN kernels are the
 * caller's bookkeeping (they cannot be flagged), not findings.
 */
export function compareKernelToMap(kernelId, citations, pin, sections) {
  const findings = [];
  for (const { unit } of citations) {
    const entry = sections[unit];
    if (!entry || !entry.last_amended) {
      findings.push({ kind: 'UNMAPPED_SECTION', kernel: kernelId, unit, message: `${kernelId}: cites ${unit}, which the map does not carry (map stale against the tree — re-run the refresh instrument)` });
      continue;
    }
    if (isAmendedAfterPin(pin, entry.last_amended)) {
      findings.push({
        kind: 'FLAGGED',
        kernel: kernelId,
        unit,
        pin: pin.date,
        pin_kind: pin.kind,
        last_amended: entry.last_amended,
        message: `${kernelId}: ${unit} last amended ${entry.last_amended}, AFTER the kernel's pin ${pin.date} (${pin.kind})`,
      });
    }
  }
  return findings;
}

/** Exit semantics: pull_request is always advisory; ENFORCE flips main to blocking. */
export function gateExit(findings, { enforce, isPullRequest }) {
  if (isPullRequest) return 0;
  return enforce && findings.length > 0 ? 1 : 0;
}

function loadMap() {
  if (!existsSync(MAP_PATH)) return null;
  return JSON.parse(readFileSync(MAP_PATH, 'utf8'));
}

function toolIdOf(file, source) {
  // Whitespace-tolerant: several kernels align the assignment
  // (`const TOOL_ID      = 'art-...'`), a single-space pattern silently missed them.
  const m = source.match(/\bconst\s+TOOL_ID\s*=\s*(['"])([^'"]+)\1/);
  return m ? m[2] : file.replace(/\.kernel\.mjs$/, '').replace(/\.mjs$/, '');
}

/// True when the source textually mentions a numbered CFR citation at all — the
/// unit-less companion to extractCfrCitations. A kernel that mentions CFR only in
/// forms the versioner cannot address (chapter-level like "31 CFR Chapter X", or a
/// bare prose mention) is reported UNIT-LESS by the gate, invisible to the map by
/// design, never flagged.
export function hasCfrMention(source) {
  return /\b\d{1,2}\s+(?:C\.F\.R\.|CFR)\b|\b\d{1,2}CFR\d/.test(source);
}

/**
 * Scan chaingraph/kernels/art-*.mjs for CFR citations. Exported because the
 * workspace-root refresh instrument must see the exact same kernel/unit/kernel-id
 * population this gate sees — one SSOT, no drift. Returns { kernels: [{id, file,
 * citations, node}], unitless: [fileNames] }.
 */
export function scanKernelCitations() {
  return scanKernels();
}

function scanKernels() {
  if (!existsSync(KDIR)) return { kernels: [], unitless: [] };
  const out = new Map(); // toolId -> {id, file, citations, node}
  const unitless = [];
  for (const f of readdirSync(KDIR).sort()) {
    if (!/^art-.*\.mjs$/.test(f)) continue;
    const source = readFileSync(resolve(KDIR, f), 'utf8');
    if (!hasCfrMention(source)) continue; // e.g. the Incoterm CFR (Cost and Freight) in art-474's Incoterms regex — not a citation
    const citations = extractCfrCitations(source);
    if (!citations.length) {
      unitless.push(f);
      continue; // chapter-level / prose-only mention — invisible to the map by design
    }
    const id = toolIdOf(f, source);
    if (out.has(id)) continue; // e.g. a legacy twin of the same kernel id cites the same units
    let node = null;
    const nodePath = resolve(NODES_DIR, `${id}.json`);
    if (existsSync(nodePath)) {
      try { node = JSON.parse(readFileSync(nodePath, 'utf8')); } catch { node = null; }
    }
    out.set(id, { id, file: f, citations, node });
  }
  return { kernels: [...out.values()], unitless };
}

// -- CLI entrypoint ---------------------------------------------------------
// Guarded so importing the pure helpers (test, refresh instrument) never triggers
// a filesystem scan or process.exit as a side effect of import.
const isMain = (() => {
  try {
    return resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
  } catch {
    return false;
  }
})();

if (isMain) {
  const { kernels, unitless } = scanKernels();
  const LIST = process.argv.includes('--list');

  if (LIST) {
    const units = new Map();
    for (const k of kernels) {
      for (const { unit, kind } of k.citations) {
        if (!units.has(unit)) units.set(unit, { kind, kernels: [] });
        units.get(unit).kernels.push(k.id);
      }
    }
    const keys = [...units.keys()].sort();
    console.log(`check-source-currency --list: ${kernels.length} kernel(s) citing ${keys.length} distinct section-unit(s):`);
    for (const u of keys) console.log(`  ${u}  [${units.get(u).kind}]  <- ${units.get(u).kernels.sort().join(', ')}`);
    if (unitless.length) console.log(`  (unit-less CFR mention(s), not mappable to a versioner unit: ${unitless.join(', ')})`);
    process.exit(0);
  }

  const map = loadMap();
  if (!map || !map.sections) {
    console.error('check-source-currency: MISSING_MAP — scripts/source-currency.json absent or shapeless. Run the workspace-root refresh instrument (AINumbers/scripts/source-currency-refresh.mjs) and commit the map.');
    process.exit(1);
  }

  const findings = [];
  const noPin = [];
  for (const k of kernels) {
    const pin = kernelPin(readFileSync(resolve(KDIR, k.file), 'utf8'), k.node);
    // Map-coverage findings (UNMAPPED_SECTION) are computed for EVERY kernel —
    // they are independent of pinning, so a NO-PIN kernel's unmapped unit must
    // still surface (measured: art-405's range-shaped 1026.46-48, eCFR-skipped).
    findings.push(...compareKernelToMap(k.id, k.citations, pin, map.sections));
    if (!pin) noPin.push(`${k.id} (${k.citations.map((c) => c.unit).join('; ')})`);
  }

  const flagged = findings.filter((f) => f.kind === 'FLAGGED');
  const unmapped = findings.filter((f) => f.kind === 'UNMAPPED_SECTION');
  const mapUnits = Object.keys(map.sections).sort();
  const staleUnits = mapUnits.filter((u) => !kernels.some((k) => k.citations.some((c) => c.unit === u)));

  console.log(`check-source-currency: map generated_at ${map.generated_at}, ${mapUnits.length} unit(s); ${kernels.length} kernel(s) citing CFR, ${noPin.length} without a comparable pin (listed, never flagged).`);
  if (unitless.length) console.log(`check-source-currency: ${unitless.length} unit-less CFR mention(s) (chapter-level/prose, not mappable to a versioner unit): ${unitless.join(', ')}`);
  if (noPin.length) console.log(`check-source-currency: NO-PIN kernel(s): ${noPin.join(' | ')}`);
  if (staleUnits.length) console.log(`check-source-currency: ${staleUnits.length} map unit(s) no longer cited by any kernel (next refresh drops them): ${staleUnits.join(', ')}`);

  if (unmapped.length) {
    console.error(`\ncheck-source-currency: ${unmapped.length} UNMAPPED_SECTION:\n  ` + unmapped.map((f) => f.message).join('\n  '));
  }
  if (flagged.length) {
    console.log(`\ncheck-source-currency: ${flagged.length} FLAGGED (source amended after the kernel's pin):`);
    flagged.forEach((f) => console.log(`  ${f.message}`));
  }
  if (!flagged.length && !unmapped.length) {
    console.log('check-source-currency: OK — no section amended after any kernel pin, map covers every cited unit.');
  }

  const enforce = process.env.SOURCE_CURRENCY_ENFORCE === '1';
  const isPullRequest = process.env.GITHUB_EVENT_NAME === 'pull_request';
  if (findings.length) {
    const verdict = isPullRequest || !enforce ? 'ADVISORY (pull_request or ENFORCE unset — the JSON is the record; triage FLAGGED rows, flip SOURCE_CURRENCY_ENFORCE=1 on main when done)' : 'BLOCKING';
    console.log(`check-source-currency: ${verdict}`);
  }
  process.exit(gateExit(findings, { enforce, isPullRequest }));
}
