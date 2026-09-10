#!/usr/bin/env node
// check-year-fallback-parity.mjs -- FAIL-CLOSED-PARITY-LINT-1 (J24 L1 lint-family batch).
//
// THE DEFECT: "the silent year fallback". A year-keyed pinned-table lookup that
// silently falls back onto a default row answers a 2019 question with 2026 numbers and 2026
// citations -- worse than an error: a wrong answer that LOOKS RETRIEVED, and reproduces.
// Measured live, not hypothetical (2026-08-27):
//
//   chaingraph/kernels/art-218-qm-points-and-fees.kernel.mjs:115
//     const yearData = QM_TIERS_BY_YEAR[year] || QM_TIERS_BY_YEAR[2026];
//     compute({ year: 2019, loan_amount: 500000, points_and_fees: 1000 })
//       -> pass:true, tier ">= $137,958: 3%", fr_citation "FR 2025-22773 (effective Jan 1, 2026)",
//          compliance_flags []   <- confidently, with no signal that 2019 was unavailable
//   chaingraph/kernels/art-234-test-hoepa-high-cost.kernel.mjs:85
//     const pf_data = HOEPA_PF[year] || HOEPA_PF[2026];
//     compute({ year: 2019, ... }) -> 2026 trigger bands, 2026 citation, no flag.
//
// VOCABULARY (SSOT: workspace-root board/row-state-enum.json, enum v2). LOOKUP_YEAR_UNAVAILABLE
// is a REGISTERED alias of NOT_EVALUABLE (emit alias string in domain context; exit-code
// semantics are NOT_EVALUABLE's); subcode NOT_EVALUABLE-LOOKUP branches remediation
// (extend the table or refuse per consumer-class policy). Flag-vs-refuse is never per-case
// judgment: consumer_class_policy grounds it mechanically -- agent/MCP consumers get refusal
// (fail-closed), human UI gets flag-and-serve with a structured header. This lint uses those
// exact tokens and no others.
//
// GREEN REFERENCES ALREADY IN THE ESTATE (quoted, not synthetic):
//   art-220-reg-z-threshold-lookup.kernel.mjs:98-106 -- the "if (!row)" guard refuses
//     with compliance_flags LOOKUP_YEAR_UNAVAILABLE and available_years; its floor
//     (__proptests__/art-220-...proptest.mjs P3_yearOutOfRange) proves it categorically.
//   art-235-test-hpml-escrow.kernel.mjs resolveLimit() -- hasOwnProperty on the year key,
//     absent year -> { value: null, source: "unresolved" } -> manual review. Fail-closed.
//
// PRECISION -- the mechanical shape, and what it deliberately does NOT flag:
// A year-keyed table here = a const-declared object literal whose top-level keys are ALL
// numeric with at least one calendar-year key (19xx/20xx). The flagged shape = a SAME-TABLE
// default-row fallback:  NAME[expr] (|| or ??) NAME[expr2]  with NAME a detected year-keyed
// table. Two adjacent shapes were examined against the live corpus and are deliberately NOT
// flagged -- flagging them needs per-case judgment, which consumer_class_policy exists to
// remove:
//   * fallback onto a LITERAL, not a table row -- art-70-cbam-default-value-resolver:77
//     MARKUP_BY_YEAR[year] ?? 0.10: an out-of-range year silently receives a scalar equal to
//     the 2026 markup. Named to the ORCH (name-not-fix per the row), not flagged: whether a
//     scalar default is another year's value is a semantic call, not a mechanical one.
//   * fallback onto a NEUTRAL value -- art-332-build-amortization-schedule:245
//     reductions[year] || 0: an absent year in a buydown-reduction schedule means no
//     reduction, and 0 is the semantically correct neutral, not another year's number.
//   * category-keyed tables never fire at all: their keys are strings, so they are not
//     year-keyed tables -- e.g. the legitimate DEFAULT_VALUES[good_category] ??
//     DEFAULT_VALUES.iron_steel in art-70 (pinned as a false-positive control in the paired test).
//
// BASELINE: scripts/year-fallback-parity-baseline.json, loaded through the shared
// HARD-FAILING loader scripts/ratchet-baseline.mjs (RATCHET-BASELINE-LOADER-1 / gate-integrity
// F-11). NO existsSync-else-empty fallback here, ever: deleting the baseline must RED this
// gate, not switch it off. The two instances above are pinned as of 2026-08-27 because their
// fix belongs to REGZ-CORRECTION-APPLY-1 (PR #1502, DRAFT as of 2026-08-27) -- this row adds
// the lint, NOT the kernel fix. Counts only go DOWN: when #1502 lands and both kernels fail
// closed, this gate reports the improvement and re-pins to zero with:
//   node scripts/check-year-fallback-parity.mjs --update-baseline
// Any NEW instance outside the baseline hard-fails the push.
//
// SCOPE: chaingraph/kernels/*.kernel.mjs -- the estate where pinned regulatory tables live.
// Inline page copies are kept in sync with kernels by the page-kernel-digest gates, so the
// kernel is the SSOT and the only place a NEW instance can originate. Enumeration is
// git ls-files via the shared git-env-scrubbed gitSync (SO #52; never a directory walk -- a
// walk would multiply the file set by every live worktree).
//
// Zero-dependency. Paired red-proof (SO #40(b), GATE-SELFTEST-META-1):
// scripts/check-year-fallback-parity.test.mjs.
//
// Usage:
//   node scripts/check-year-fallback-parity.mjs                     # gate (preflight + CI)
//   node scripts/check-year-fallback-parity.mjs --check             # same (generator-coverage alias)
//   node scripts/check-year-fallback-parity.mjs --list              # every live instance, with its line
//   node scripts/check-year-fallback-parity.mjs --update-baseline   # re-pin (counts only go down)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRatchetBaselineOrExit, readBaselineForUpdate, assertFiniteCeiling } from './ratchet-baseline.mjs';
import { gitSync } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
export const BASELINE_PATH = resolve(HERE, "year-fallback-parity-baseline.json");
export const REPIN_COMMAND = "node scripts/check-year-fallback-parity.mjs --update-baseline";
const BASELINE_LABEL = "check-year-fallback-parity";
const BASELINE_KEYS = ["total", { key: "files", type: "name-list" }];

export const VOCAB_TOKEN = 'LOOKUP_YEAR_UNAVAILABLE';
export const VOCAB_SUBCODE = 'NOT_EVALUABLE-LOOKUP';
const DQ = String.fromCharCode(34);
const SQ = String.fromCharCode(39);
const BT = String.fromCharCode(96);
const NL = String.fromCharCode(10);
const BS = String.fromCharCode(92);
const SP = String.fromCharCode(32);
const NUL = String.fromCharCode(0);
const SL = String.fromCharCode(47);
const ST = String.fromCharCode(42);

export function stripComments(src) {
  let out = src.slice(0, 0);
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === SL && src[i + 1] === SL) {
      let j = i;
      while (j < n && src[j] !== NL) j++;
      out = out + SP.repeat(j - i);
      i = j;
      continue;
    }
    if (c === SL && src[i + 1] === ST) {
      let j = i + 2;
      while (j < n && !(src[j] === ST && src[j + 1] === SL)) j++;
      const end = Math.min(j + 2, n);
      const seg = src.slice(i, end);
      for (const ch of seg) out = out + (ch === NL ? NL : SP);
      i = end;
      continue;
    }
    if (c === DQ || c === SQ || c === BT) {
      const quote = c;
      out = out + c;
      i++;
      while (i < n) {
        const d = src[i];
        out = out + d;
        if (d === BS && i + 1 < n) { out = out + src[i + 1]; i += 2; continue; }
        if (d === quote) { i++; break; }
        if (d === NL && quote !== BT) { i++; break; }
        i++;
      }
      continue;
    }
    out = out + c;
    i++;
  }
  return out;
}
// Delimiter characters as strings, so indexOf and equality agree.
const LC = String.fromCharCode(123);
const RC = String.fromCharCode(125);
const LP = String.fromCharCode(40);
const RP = String.fromCharCode(41);
const LB = String.fromCharCode(91);
const RB = String.fromCharCode(93);
const CM = String.fromCharCode(44);
const CN = String.fromCharCode(58);

const SCOPE_DIR = "chaingraph/kernels";
const KERNEL_SUFFIX = ".kernel.mjs";

// A year-keyed table = a const-declared object literal whose top-level keys are ALL numeric
// and at least one is a calendar year (19xx/20xx). Mixed tables (string keys, shorthand
// members, methods) never qualify -- the ALL-KEYS-NUMERIC rule is what keeps category
// tables out.
export function findYearKeyedTables(stripped) {
  const tables = new Map();
  const declRe = /(?:^|\n)[ \t]*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;
  let m;
  while ((m = declRe.exec(stripped))) {
    const name = m[1];
    const open = stripped.indexOf(LC, m.index + m[0].length - 1);
    if (open === -1) continue;
    let depth = 0;
    let close = -1;
    for (let j = open; j < stripped.length; j++) {
      const c = stripped[j];
      if (c === LC) depth++;
      else if (c === RC) { depth--; if (depth === 0) { close = j; break; } }
    }
    if (close === -1) continue;
    const block = stripped.slice(open + 1, close);
    const parts = [];
    let d = 0, start = 0, q = null;
    for (let k = 0; k < block.length; k++) {
      const c = block[k];
      if (q) {
        if (c === BS) k++;
        else if (c === q) q = null;
        continue;
      }
      if (c === DQ || c === SQ || c === BT) { q = c; continue; }
      if (c === LC || c === LP || c === LB) { d++; continue; }
      if (c === RC || c === RP || c === RB) { d--; continue; }
      if (c === CM && d === 0) { parts.push(block.slice(start, k)); start = k + 1; }
    }
    parts.push(block.slice(start));
    const keys = [];
    let allNumeric = parts.length > 0;
    for (const part of parts) {
      const colon = part.indexOf(CN);
      const key = (colon === -1 ? part : part.slice(0, colon)).trim();
      if (!key) continue;
      const first = key.slice(0, 1);
      const last = key.slice(-1);
      let raw = key;
      if (key.length >= 2 && (first === SQ || first === DQ) && last === first) raw = key.slice(1, key.length - 1);
      if (!/^\d+$/.test(raw)) { allNumeric = false; break; }
      keys.push(raw);
    }
    if (!allNumeric) continue;
    const yearKeys = keys.filter((k) => /^(19|20)\d{2}$/.test(k));
    if (yearKeys.length < 1) continue;
    if (!tables.has(name)) {
      tables.set(name, { line: stripped.slice(0, m.index).split(NL).length, yearKeys });
    }
  }
  return tables;
}

// The flagged shape: a same-table default-row fallback on a detected year-keyed table.
const FALLBACK_RE = /([A-Za-z_$][\w$]*)[ \t]*\[([^\]\n]{1,120})\][ \t]*(\|\||\?\?)[ \t]*([A-Za-z_$][\w$]*)[ \t]*\[([^\]\n]{1,120})\]/g;

export function scanText(src) {
  const stripped = stripComments(src);
  const tables = findYearKeyedTables(stripped);
  const hits = [];
  FALLBACK_RE.lastIndex = 0;
  let m;
  while ((m = FALLBACK_RE.exec(stripped))) {
    const full = m[0];
    const left = m[1];
    const op = m[3];
    const right = m[4];
    if (left !== right) continue;
    const table = tables.get(left);
    if (!table) continue;
    hits.push({
      line: stripped.slice(0, m.index).split(NL).length,
      operator: op,
      table: left,
      yearKeys: table.yearKeys,
      excerpt: full.trim().slice(0, 140),
    });
  }
  return hits;
}

// SO #52: git ls-files, never a walk; scrubbed env via the shared gitSync.
const SCOPE_GLOB = SCOPE_DIR;

function scopeFiles() {
  const raw = gitSync(["ls-files", "-z", "--", SCOPE_GLOB], { cwd: REPO, maxBuffer: 32 * 1024 * 1024 });
  return [...new Set(raw.split(NUL).filter(Boolean).map((p) => p.split(BS).join(SL)))]
    .filter((p) => p.endsWith(KERNEL_SUFFIX)).sort();
}
export function ratchetVerdict(counts, baseline) {
  const failures = [];
  const improvements = [];
  const perFile = baseline.per_file;
  if (perFile === null || typeof perFile !== "object" || Array.isArray(perFile)) {
    failures.push("baseline per_file must be an object of {path: count} -- the per-file ceilings are missing or malformed");
    return { failures, improvements, total: 0 };
  }
  const pinnedFiles = new Set(baseline.files);
  for (const key of Object.keys(perFile)) {
    if (!pinnedFiles.has(key)) failures.push("baseline drift: per_file pins " + key + " but files does not list it -- re-pin with " + REPIN_COMMAND);
  }
  for (const key of pinnedFiles) {
    if (!Object.prototype.hasOwnProperty.call(perFile, key)) failures.push("baseline drift: files lists " + key + " but per_file has no ceiling for it -- re-pin with " + REPIN_COMMAND);
  }
  let total = 0;
  for (const rel of Object.keys(counts)) {
    const hits = counts[rel];
    total = total + hits.length;
    const pinned = Object.prototype.hasOwnProperty.call(perFile, rel)
      ? assertFiniteCeiling(perFile[rel], { label: BASELINE_LABEL, keyName: "per_file." + rel })
      : 0;
    if (hits.length > pinned) {
      failures.push(rel + ": " + hits.length + " silent year-fallback instance(s), baseline " + pinned + " -- a NEW instance outside the pin" + NL +
        hits.map((h) => "      line " + h.line + ": " + h.excerpt + "" + NL + "        -> must refuse or emit " + VOCAB_TOKEN + " (" + VOCAB_SUBCODE + ")").join(NL));
    } else if (hits.length < pinned) {
      improvements.push(rel + ": " + pinned + " -> " + hits.length);
    }
  }
  for (const rel of pinnedFiles) {
    if (!counts[rel]) improvements.push(rel + ": clean (baseline entry can be dropped)");
  }
  const ceiling = assertFiniteCeiling(baseline.total, { label: BASELINE_LABEL, keyName: "total" });
  if (total > ceiling) failures.push("estate total " + total + " silent year-fallback instance(s) exceeds the pinned ceiling " + ceiling);
  else if (total < ceiling) improvements.push("estate total " + ceiling + " -> " + total);
  return { failures, improvements, total };
}
// -- gate body -- runs only on direct execution, never on import ---------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const UPDATE = process.argv.includes("--update-baseline");
  const LIST = process.argv.includes("--list");
  // --check is an explicit alias for the default gate mode, same reason as
  // check-phasing-notes: check-generator-coverage sees the writeFileSync in
  // --update-baseline and needs a --check-capable gate that IS wired into preflight.
  const CHECK = process.argv.includes("--check");
  if (CHECK && UPDATE) {
    console.error("X check-year-fallback-parity: --check (gate) and --update-baseline (re-pin) are mutually exclusive.");
    process.exit(1);
  }

  const files = scopeFiles();
  // SO #34c / DENOMINATOR-SENTINEL-1: 0 of 0 clean is not a pass. If the scope came back
  // empty the enumeration broke -- a failure, never a green scan of nothing.
  if (files.length === 0) {
    console.error("X check-year-fallback-parity: scope enumeration returned ZERO kernel files; git ls-files found nothing under " + SCOPE_GLOB + " -- the gate examined nothing, which is not a pass (SO #34c).");
    process.exit(1);
  }

  const counts = {};
  for (const rel of files) {
    const hits = scanText(readFileSync(resolve(REPO, rel), "utf8"));
    if (hits.length) counts[rel] = hits;
  }
  const liveTotal = Object.values(counts).reduce((n, h) => n + h.length, 0);

  if (LIST) {
    for (const rel of Object.keys(counts)) {
      for (const h of counts[rel]) {
        console.log(rel + ":" + h.line + "  " + h.excerpt);
        console.log("    -> year-keyed table " + h.table + " (keys " + h.yearKeys.join(", ") + "); must refuse or emit " + VOCAB_TOKEN + " (" + VOCAB_SUBCODE + "); a " + h.operator + " onto a default row is the silent-year-fallback defect");
      }
    }
    console.log(NL + "check-year-fallback-parity: " + liveTotal + " instance(s) across " + Object.keys(counts).length + " file(s) of " + files.length + " kernel(s) scanned.");
    process.exit(0);
  }

  if (UPDATE) {
    // The one sanctioned absent-baseline path (a first-ever pin). An existing but corrupt
    // baseline still hard-fails here rather than being silently overwritten (readBaselineForUpdate).
    const prior = readBaselineForUpdate(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
    const per_file = {};
    for (const rel of Object.keys(counts)) per_file[rel] = counts[rel].length;
    const doc = {
      _comment: "FAIL-CLOSED-PARITY-LINT-1 ratchet pin: year-keyed pinned-table lookups with a silent same-table default-row fallback (the 2019-question-2026-numbers defect). Counts only go DOWN: fix a kernel to refuse or emit LOOKUP_YEAR_UNAVAILABLE (registered NOT_EVALUABLE alias, subcode NOT_EVALUABLE-LOOKUP), then re-pin with node scripts/check-year-fallback-parity.mjs --update-baseline. Loaded through the hard-failing scripts/ratchet-baseline.mjs: deleting this file REDS the gate, it does not switch it off. The two pinned instances belong to REGZ-CORRECTION-APPLY-1 (PR #1502); this lint adds no kernel fix.",
      total: liveTotal,
      files: Object.keys(counts).sort(),
      per_file,
    };
    if (prior && liveTotal > prior.total) {
      console.error("X check-year-fallback-parity --update-baseline REFUSED: this would raise the pinned ceiling " + prior.total + " -> " + liveTotal + ". A ratchet only moves down; fix the new instance (refuse or emit " + VOCAB_TOKEN + ") instead of re-pinning over it.");
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + NL);
    console.log("check-year-fallback-parity: baseline pinned at " + liveTotal + " instance(s) across " + doc.files.length + " file(s).");
    process.exit(0);
  }

  const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
  const verdict = ratchetVerdict(counts, baseline);

  if (verdict.improvements.length) {
    console.log("check-year-fallback-parity: " + verdict.improvements.length + " improvement(s) beat the baseline -- tighten with `" + REPIN_COMMAND + "`:" + NL + "  " + verdict.improvements.slice(0, 12).join(NL + "  "));
  }
  if (verdict.failures.length) {
    console.error(NL + "X check-year-fallback-parity: " + verdict.failures.length + " FAILURE(s) -- silent year-fallback instance(s):" + NL + "  " + verdict.failures.join(NL + "  "));
    console.error(NL + "  A year-keyed pinned-table lookup that silently falls back onto a default row answers a 2019");
    console.error("  question with 2026 numbers and 2026 citations -- a wrong answer that LOOKS retrieved, and reproduces.");
    console.error("  Fix: refuse for an out-of-range year, or emit " + VOCAB_TOKEN + " (registered NOT_EVALUABLE alias,");
    console.error("  subcode " + VOCAB_SUBCODE + "); agent/MCP consumers refuse, human UI flags-and-serves (consumer_class_policy).");
    console.error("  The pre-existing instances are pinned in scripts/year-fallback-parity-baseline.json (they belong to");
    console.error("  REGZ-CORRECTION-APPLY-1, PR #1502) and burn down with `" + REPIN_COMMAND + "`; the ceiling only moves DOWN.");
    process.exit(1);
  }
  const pinnedNames = Object.keys(baseline.per_file || {}).map((rel) => rel + " x" + baseline.per_file[rel]).join(", ");
  console.log("check-year-fallback-parity: OK (" + files.length + " kernel(s) scanned, " + baseline.total + " baselined instance(s) within budget" + (pinnedNames ? " -- the pre-REGZ RED, quoted: " + pinnedNames : "") + ").");
  if (baseline.total > 0) {
    console.log("  REGZ coordination: the pinned instances belong to REGZ-CORRECTION-APPLY-1 (PR #1502, DRAFT as of 2026-08-27).");
    console.log("  When it lands and both kernels fail closed, this gate reports the improvement; re-pin with `" + REPIN_COMMAND + "`.");
  }
}