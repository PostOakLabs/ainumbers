#!/usr/bin/env node
// check-floor-label-strength.mjs -- FLOOR-LABEL-LINT-1 (J24 L1 lint-family batch).
//
// THE DEFECT: a floor label that promises an outcome while its acceptance predicate only
// checks finiteness or enum-membership is a claim with nothing behind it -- every value the
// kernel could return satisfies it. art-223 proves the worst case: two of its ten labels
// are contradicted by the kernel TODAY and the floor greens over both (proptest-oracle-
// vacuity audit, 2026-08-23, sections 2 and 4 F-A).
//
// THE RULE (mechanical): a floor file whose label/prose strings use OUTCOME LANGUAGE and
// whose code contains NO outcome pin -- no equality/inequality comparison against a
// literal, and no output-prefixed boundary comparison -- is RED. Finiteness checks
// (Number.isFinite), typeof enum-membership, harness accumulators (failures.length === 0)
// and console output never count as pins; a predicate that restates the kernel own rule
// (self-oracle: expected recomputed from kernel output fields) contains no literal pin and
// stays RED -- the photocopy class.
//
// OUTCOME LANGUAGE -- derived from THIS corpus (638 floors, marker hit counts measured
// 2026-08-27), not assumed: must (1507), never (424), always (127), cannot (14),
// should (8), is required to (1); will and has-to scored zero and are excluded.
//
// CENSUS re-derived independently (this lint, 2026-08-27): 116 of 638 floors flagged
// (outcome language + no pin). The audit 80-file list was an estimate with a stated false-
// positive bias on pins; this count is the number THIS mechanical rule derives, quoted per
// the row, and the baseline pins exactly these files. Counts only go DOWN.
//
// WHAT CLEARS: pinning the outcome to a literal (op.x === 5, op.flag === "conforming",
// r.y >= 90), including literals shared with the kernel (they still assert an outcome; the
// shared-constant wrong-in-both-places class is audit finding F-B/Tier B-3, a different
// remedy, out of this fence). Referencing the kernel own computation does NOT clear.
//
// BASELINE: scripts/floor-label-strength-baseline.json through the shared HARD-FAILING
// loader scripts/ratchet-baseline.mjs (F-11): a flagged file must be in the baseline
// (legacy shield) or the gate REDs; a NEW non-compliant floor hard-fails; deleting the
// baseline REDS the gate; counts only go DOWN. Re-pin after fixing floors:
//   node scripts/check-floor-label-strength.mjs --update-baseline
//
// SCOPE: chaingraph/kernels/__proptests__/*.proptest.mjs, enumerated via git ls-files
// (SO #52) with the shared scrubbed gitSync. Zero floor edits, zero kernel bytes -- this
// lint FLAGS, it does not fix (the row fence).
//
// Paired red-proof (SO #40(b), GATE-SELFTEST-META-1):
// scripts/check-floor-label-strength.test.mjs.
//
// Usage:
//   node scripts/check-floor-label-strength.mjs                     # gate (preflight + CI)
//   node scripts/check-floor-label-strength.mjs --check             # alias
//   node scripts/check-floor-label-strength.mjs --list              # every flagged floor
//   node scripts/check-floor-label-strength.mjs --update-baseline   # re-pin (counts only go down)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRatchetBaselineOrExit, readBaselineForUpdate, assertFiniteCeiling } from "./ratchet-baseline.mjs";
import { gitSync } from "./_git-env-lib.mjs";
import { stripComments } from "./check-year-fallback-parity.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
export const BASELINE_PATH = resolve(HERE, "floor-label-strength-baseline.json");
export const REPIN_COMMAND = "node scripts/check-floor-label-strength.mjs --update-baseline";
const BASELINE_LABEL = "check-floor-label-strength";
const BASELINE_KEYS = ["total", { key: "files", type: "name-list" }];

const NL = String.fromCharCode(10);
export const MARKERS = [/\bmust\b/i, /\bshould\b/i, /\bnever\b/i, /\balways\b/i, /\bcannot\b/i, /\bis required to\b/i];
const OUT_RE = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
const TYPE_NAMES = "boolean,number,string,object,undefined,function,bigint,symbol".split(",");
const WEAK_TAIL = /\.(?:length|violations|count|total|failures|size|ok|trials|granted|limited)$/i;
const CMP = /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*(===|!==)\s*(-?\d+(?:\.\d+)?|'[^'\n]*'|"[^"\n]*")/g;
const CMP3 = /((?:op|r|res|row|result|out|output|ret)\.[A-Za-z_$][\w$]*)\s*(<=|>=)\s*(-?\d+(?:\.\d+)?)/g;

// Blank balanced-paren spans that begin a statement of no interest: console output and
// for-loop headers. Length-preserving so line numbers stay true.
function blankSpans(src, headRe) {
  let out = src;
  for (;;) {
    const m = headRe.exec(out);
    if (!m) break;
    let i = m.index + m[0].length, depth = 1;
    while (i < out.length && depth > 0) { const c = out[i]; if (c === String.fromCharCode(40)) depth++; else if (c === String.fromCharCode(41)) depth--; i++; }
    out = out.slice(0, m.index) + out.slice(m.index, i).replace(/[^\n]/g, String.fromCharCode(32)) + out.slice(i);
  }
  return out;
}

export function hasOutcomeLanguage(st) {
  const strs = st.match(OUT_RE) || [];
  return strs.some((s) => MARKERS.some((re) => re.test(s)));
}

export function outcomePins(st) {
  const noLoops = blankSpans(st, /\bfor\s*\(/);
  const out = [];
  let m;
  CMP.lastIndex = 0;
  while ((m = CMP.exec(noLoops))) {
    if (/^typeof\b/.test(m[1])) continue;                    // typeof enum-membership: the trap
    if (WEAK_TAIL.test(m[1])) continue;                      // harness accumulators
    if (TYPE_NAMES.includes(m[3].replace(/^'|'$|^"|"$/g, ""))) continue; // typeof-style literal
    out.push(m[0]);
  }
  CMP3.lastIndex = 0;
  while ((m = CMP3.exec(noLoops))) out.push(m[0]);           // output-prefixed boundary comparison
  return out;
}

// Pure verdict for one floor: RED iff outcome language is present and no outcome pin is.
export function verdictFor(src) {
  const st = blankSpans(stripComments(src), /console\.(?:log|error|warn|info)\(/);
  const outcome = hasOutcomeLanguage(st);
  const pins = outcomePins(st);
  return { outcome, pins: pins.length, red: outcome && pins.length === 0 };
}

const SCOPE_DIR = "chaingraph/kernels/__proptests__";
const SUFFIX = ".proptest.mjs";

function scopeFiles() {
  const raw = gitSync(["ls-files", "-z", "--", SCOPE_DIR], { cwd: REPO, maxBuffer: 32 * 1024 * 1024 });
  return [...new Set(raw.split(String.fromCharCode(0)).filter(Boolean).map((p) => p.split(String.fromCharCode(92)).join(String.fromCharCode(47))))]
    .filter((p) => p.endsWith(SUFFIX)).sort();
}

export function ratchetVerdict(counts, baseline) {
  const failures = [], improvements = [];
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
      failures.push(rel + ": a NEW non-compliant floor outside the baseline (" + hits.length + " > " + pinned + ")" + NL +
        hits.map((h) => "      " + h).join(NL));
    } else if (hits.length < pinned) {
      improvements.push(rel + ": " + pinned + " -> " + hits.length);
    }
  }
  for (const rel of pinnedFiles) {
    if (!counts[rel]) improvements.push(rel + ": clean (baseline entry can be dropped)");
  }
  const ceiling = assertFiniteCeiling(baseline.total, { label: BASELINE_LABEL, keyName: "total" });
  if (total > ceiling) failures.push("estate total " + total + " flagged floor(s) exceeds the pinned ceiling " + ceiling);
  else if (total < ceiling) improvements.push("estate total " + ceiling + " -> " + total);
  return { failures, improvements, total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const UPDATE = process.argv.includes("--update-baseline");
  const LIST = process.argv.includes("--list");
  const CHECK = process.argv.includes("--check");
  if (CHECK && UPDATE) {
    console.error("X check-floor-label-strength: --check and --update-baseline are mutually exclusive.");
    process.exit(1);
  }

  const files = scopeFiles();
  if (files.length === 0) {
    console.error("X check-floor-label-strength: scope enumeration returned ZERO floor files -- the gate examined nothing, which is not a pass (SO #34c).");
    process.exit(1);
  }

  const counts = {};
  for (const rel of files) {
    const v = verdictFor(readFileSync(resolve(REPO, rel), "utf8"));
    if (v.red) counts[rel] = ["outcome-language labels with no outcome pinned to any literal (finiteness/enum/self-oracle predicates only)"];
  }
  const liveTotal = Object.values(counts).reduce((n, h) => n + h.length, 0);

  if (LIST) {
    for (const rel of Object.keys(counts)) console.log(rel + "  " + counts[rel][0]);
    console.log(NL + "check-floor-label-strength: " + liveTotal + " flagged floor(s) of " + files.length + " scanned.");
    process.exit(0);
  }

  if (UPDATE) {
    const prior = readBaselineForUpdate(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
    const per_file = {};
    for (const rel of Object.keys(counts)) per_file[rel] = counts[rel].length;
    const doc = {
      _comment: "FLOOR-LABEL-LINT-1 ratchet pin: floors whose label strings use outcome language (must/should/never/always/cannot/is-required-to -- corpus-derived) while no literal outcome pin exists in the file. Counts only go DOWN: pin the label outcome to a literal (or state not_applicable), then re-pin with node scripts/check-floor-label-strength.mjs --update-baseline. Loaded through the hard-failing scripts/ratchet-baseline.mjs: deleting this file REDS the gate. New non-compliant floors hard-fail; legacy floors are shielded ONLY at their pinned count.",
      total: liveTotal,
      files: Object.keys(counts).sort(),
      per_file,
    };
    if (prior && liveTotal > prior.total) {
      console.error("X check-floor-label-strength --update-baseline REFUSED: this would raise the pinned ceiling " + prior.total + " -> " + liveTotal + ". A ratchet only moves down; fix the new floor instead.");
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + NL);
    console.log("check-floor-label-strength: baseline pinned at " + liveTotal + " flagged floor(s) across " + doc.files.length + " file(s).");
    process.exit(0);
  }

  const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
  const verdict = ratchetVerdict(counts, baseline);

  if (verdict.improvements.length) {
    console.log("check-floor-label-strength: " + verdict.improvements.length + " improvement(s) beat the baseline -- tighten with `" + REPIN_COMMAND + "`");
  }
  if (verdict.failures.length) {
    console.error(NL + "X check-floor-label-strength: " + verdict.failures.length + " FAILURE(s)" + NL + "  " + verdict.failures.join(NL + "  "));
    console.error(NL + "  A label that promises an outcome while the predicate only checks finiteness or enum-membership");
    console.error("  is a claim with nothing behind it. Pin the outcome to a literal, a boundary comparison, or an");
    console.error("  independently-sourced expected value. Restating the kernel own rule does not count.");
    process.exit(1);
  }
  console.log("check-floor-label-strength: OK (" + files.length + " floor(s) scanned, " + baseline.total + " baselined within budget).");
}