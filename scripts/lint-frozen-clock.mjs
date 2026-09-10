#!/usr/bin/env node
// lint-frozen-clock.mjs -- NO-CLOCK-LINT-1 (J24 L1 lint-family batch).
//
// THE DEFECT (time-decaying-constants audit, 2026-08-21, gate-candidate 1 + addendum A3):
// the estate NO-CLOCK convention (every temporal comparison derives from caller inputs)
// was prose-only, and art-99 proved prose does not hold -- a frozen TODAY=$2026-06-22$
// drove a licensing decision for two months undetected.
//
// THE RULE (mechanical): a module-level constant whose NAME declares it the current date
// (TODAY, TODAYS_DATE, AS_OF, ASOF, NOW, CURRENT_DATE) and whose value is a date/epoch
// literal is a FAKE-NOW. If the name is used anywhere beyond its declaration (feeding a
// comparison, a new Date(), or anything else) the file is RED. The NAME is the signal: a
// constant the author called NOW is pretending to be the clock, whatever it is compared
// against. Policy dates with policy names (CLIFF_DEADLINE, KSEF_GO_LIVE) compared against
// caller inputs are the CORRECT art-293/295 KSeF shape and never fire.
//
// EXCLUDED CLASSES (per the row):
//   - informational echo-only dates (dates only copied into output -- no fake-now name);
//   - version-pin strings (table_version, *_version declarations);
//   - caller-compared policy dates with policy names (the art-293/295 KSeF shape).
//
// SCOPE (audit addendum A3 -- the original sweep missed the test layer):
// chaingraph/kernels/*.kernel.mjs AND chaingraph/kernels/__proptests__/*.proptest.mjs.
//
// BASELINE: scripts/frozen-clock-baseline.json through the shared HARD-FAILING loader
// scripts/ratchet-baseline.mjs. The live census at ship time (2026-08-28) found the debt
// the audit named STILL PRESENT: art-99 kernel TODAY (line 20), its floor mirror, and
// art-04 floor NOW -- 3 files pinned. Counts only go DOWN; a NEW fake-now anywhere REDs
// immediately (unshielded); deleting the baseline REDS the gate. Zero kernel edits in this
// row -- the art-99 fix belongs to its rebuild row.
//
// Usage:
//   node scripts/lint-frozen-clock.mjs                     # gate (preflight + CI)
//   node scripts/lint-frozen-clock.mjs --check             # alias
//   node scripts/lint-frozen-clock.mjs --list              # every flagged file
//   node scripts/lint-frozen-clock.mjs --update-baseline   # re-pin (counts only go down)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRatchetBaselineOrExit, readBaselineForUpdate, assertFiniteCeiling } from "./ratchet-baseline.mjs";
import { gitSync } from "./_git-env-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
export const BASELINE_PATH = resolve(HERE, "frozen-clock-baseline.json");
export const REPIN_COMMAND = "node scripts/lint-frozen-clock.mjs --update-baseline";
const BASELINE_LABEL = "lint-frozen-clock";
const BASELINE_KEYS = ["total", { key: "files", type: "name-list" }];

export const NL = String.fromCharCode(10);

// Fake-now declaration: a const whose NAME self-declares it as the current date/time.
export const FAKENOW_RE = /const\s+(TODAY|TODAYS_DATE|AS_OF|ASOF|NOW|CURRENT_DATE)\s*=\s*(?:'|")?((?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])|\d[\d_]*)(?:'|")?/g;
const WORD = (n) => new RegExp("\\b" + n + "\\b");

export function verdictFor(src) {
  const hits = [];
  FAKENOW_RE.lastIndex = 0;
  let m;
  while ((m = FAKENOW_RE.exec(src))) {
    const name = m[1];
    const line = src.slice(0, m.index).split(NL).length;
    const uses = src.split(WORD(name)).length - 1;
    const feeding = uses > 1; // declared AND referenced somewhere (comparison, new Date, output, ...)
    hits.push({ name, line, feeding, value: m[2] });
  }
  return { hits, red: hits.some((h) => h.feeding) };
}

const SCOPE_GLOBS = ["chaingraph/kernels/*.kernel.mjs", "chaingraph/kernels/__proptests__/*.proptest.mjs"];

function scopeFiles() {
  const raw = gitSync(["ls-files", "-z", "--", ...SCOPE_GLOBS], { cwd: REPO, maxBuffer: 32 * 1024 * 1024 });
  return [...new Set(raw.split(String.fromCharCode(0)).filter(Boolean).map((p) => p.split(String.fromCharCode(92)).join(String.fromCharCode(47))))]
    .filter((p) => p.endsWith(".proptest.mjs") || p.endsWith(".kernel.mjs")).sort();
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
      failures.push(rel + ": " + (hits.length - pinned) + " NEW frozen-clock hit(s) above the baseline pin (" + pinned + ")");
    } else if (hits.length < pinned) {
      improvements.push(rel + ": " + pinned + " -> " + hits.length + " -- the fake-now left; re-pin with `" + REPIN_COMMAND + "`");
    }
  }
  for (const rel of pinnedFiles) {
    if (!counts[rel]) improvements.push(rel + ": clean (baseline entry can be dropped)");
  }
  const ceiling = assertFiniteCeiling(baseline.total, { label: BASELINE_LABEL, keyName: "total" });
  if (total > ceiling) failures.push("estate total " + total + " frozen-clock hit(s) exceeds the pinned ceiling " + ceiling);
  else if (total < ceiling) improvements.push("estate total " + ceiling + " -> " + total);
  return { failures, improvements, total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const UPDATE = process.argv.includes("--update-baseline");
  const LIST = process.argv.includes("--list");
  const CHECK = process.argv.includes("--check");
  if (CHECK && UPDATE) {
    console.error("X lint-frozen-clock: --check and --update-baseline are mutually exclusive.");
    process.exit(1);
  }

  const files = scopeFiles();
  if (files.length === 0) {
    console.error("X lint-frozen-clock: scope enumeration returned ZERO files -- the gate examined nothing, which is not a pass (SO #34c).");
    process.exit(1);
  }

  const counts = {};
  for (const rel of files) {
    const v = verdictFor(readFileSync(resolve(REPO, rel), "utf8"));
    if (v.red) counts[rel] = v.hits.filter((h) => h.feeding).map((h) => "const " + h.name + " @line " + h.line + " feeds something (fake-now)");
  }
  const liveTotal = Object.values(counts).reduce((n, h) => n + h.length, 0);

  if (LIST) {
    for (const rel of Object.keys(counts)) for (const h of counts[rel]) console.log(rel + "  " + h);
    console.log(NL + "lint-frozen-clock: " + liveTotal + " hit(s) across " + Object.keys(counts).length + " file(s) of " + files.length + " scanned.");
    process.exit(0);
  }

  if (UPDATE) {
    const prior = readBaselineForUpdate(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
    const per_file = {};
    for (const rel of Object.keys(counts)) per_file[rel] = counts[rel].length;
    const doc = {
      _comment: "NO-CLOCK-LINT-1 ratchet pin: module-level fake-now constants (TODAY/AS_OF/NOW/... with a date or epoch value) that feed comparisons or Date construction. Counts only go DOWN: derive every temporal comparison from caller inputs, then re-pin with node scripts/lint-frozen-clock.mjs --update-baseline. Loaded through the hard-failing scripts/ratchet-baseline.mjs: deleting this file REDS the gate. The pinned art-99/art-04 debt belongs to art-99 rebuild row -- this instrument does not fix it.",
      total: liveTotal,
      files: Object.keys(counts).sort(),
      per_file,
    };
    if (prior && liveTotal > prior.total) {
      console.error("X lint-frozen-clock --update-baseline REFUSED: this would raise the pinned ceiling " + prior.total + " -> " + liveTotal + ". A ratchet only moves down.");
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + NL);
    console.log("lint-frozen-clock: baseline pinned at " + liveTotal + " hit(s) across " + doc.files.length + " file(s).");
    process.exit(0);
  }

  const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
  const verdict = ratchetVerdict(counts, baseline);

  if (verdict.improvements.length) {
    console.log("lint-frozen-clock: " + verdict.improvements.length + " improvement(s) beat the baseline -- tighten with `" + REPIN_COMMAND + "`");
  }
  if (verdict.failures.length) {
    console.error(NL + "X lint-frozen-clock: " + verdict.failures.length + " FAILURE(s)" + NL + "  " + verdict.failures.join(NL + "  "));
    console.error(NL + "  A frozen TODAY pretending to be the clock drives decisions from a date nobody chose. Derive");
    console.error("  every temporal comparison from caller inputs (the estate NO-CLOCK convention); policy dates");
    console.error("  get policy names (CLIFF_DEADLINE, not TODAY) and are compared against caller-supplied dates.");
    process.exit(1);
  }
  console.log("lint-frozen-clock: OK (" + files.length + " file(s) scanned, " + baseline.total + " baselined hit(s) within budget).");
}