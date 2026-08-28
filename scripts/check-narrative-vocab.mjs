#!/usr/bin/env node
// check-narrative-vocab.mjs -- NARRATIVE-VOCAB-LINT-1 (J24 L1 lint-family batch).
//
// THE DEFECT (in-code narrative audit, 2026-08-22, finding F9): kernels carry prose
// asserting STABILITY or a LEGAL EVENT -- unchanged-since-2013, structural, never-revised,
// vacated, upheld. These are SELF-CERTIFYING: written once, never re-verified, and wrong
// ones survive indefinitely (the audit found art-220 stability prose over figures the
// record moved, and art-233 vacatur prose naming the wrong court and year).
//
// F9 -- THE HALF THAT MATTERS MOST: rule_note / table_source / fr_citation are PAYLOAD
// STRINGS -- they ride MCP responses to consumers. This lint scans BOTH comments AND those
// three payload fields.
//
// LEXICON (the row, tightened by corpus practice so engineering prose never fires):
//   unchanged | structural | vacat | upheld | since <year> |
//   never (revised|amended|updated|changed|moved)
// A bare never (e.g. never propagate NaN into the verdict) is an engineering statement,
// NOT a stability claim, and never fires -- the false-positive-safe case.
//
// ESCAPE HATCH (art-572 dated-observation form, the sanctioned fix): the same sentence
// carrying an AS-OF DATE or a SOURCE POINTER passes. The failure message points at it.
//
// BASELINE: scripts/narrative-vocab-baseline.json through the shared HARD-FAILING loader
// scripts/ratchet-baseline.mjs (RATCHET-BASELINE-LOADER-1 -- no fourth deletable baseline).
// Counts only go DOWN; a hit above its file pin REDs; a cleaned file reports the improvement
// and the re-pin command (the copied copy-hallmarks ratchet semantics). Existing hits are
// NOT fixed here -- this row builds the instrument (audit counts were 13 narrative + 14
// stability + 63 citation kernels; this lint derives its own live census).
//
// Fence: zero kernel bytes, zero shards, and never a write to the assembled graph artifact.
//
// Usage:
//   node scripts/check-narrative-vocab.mjs                     # gate (preflight + CI)
//   node scripts/check-narrative-vocab.mjs --check             # alias
//   node scripts/check-narrative-vocab.mjs --list              # every hit
//   node scripts/check-narrative-vocab.mjs --update-baseline   # re-pin (counts only go down)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRatchetBaselineOrExit, readBaselineForUpdate, assertFiniteCeiling } from "./ratchet-baseline.mjs";
import { gitSync } from "./_git-env-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
export const BASELINE_PATH = resolve(HERE, "narrative-vocab-baseline.json");
export const REPIN_COMMAND = "node scripts/check-narrative-vocab.mjs --update-baseline";
const BASELINE_LABEL = "check-narrative-vocab";
const BASELINE_KEYS = ["total", { key: "files", type: "name-list" }];

export const NL = String.fromCharCode(10);
const DQ = String.fromCharCode(34);
const SQ = String.fromCharCode(39);
const BT = String.fromCharCode(96);
const BS = String.fromCharCode(92);
const SL = String.fromCharCode(47);
const LP = String.fromCharCode(40);
const RP = String.fromCharCode(41);
const ST = String.fromCharCode(42);

// The lexicon. Stability/event shapes only; a bare never is deliberately absent (the
// false-positive-safe case -- engineering prose uses it constantly and means nothing legal).
export const LEXICON = /unchanged|structural|never\s+(?:revised|amended|updated|changed|moved)|vacat|upheld|since\s+(?:19|20)\d{2}/i;
// Escape hatch: an as-of date (any year mention) or a source pointer on the same line.
export const ESCAPE = /(?:as\s+of|effective|re-verified|FR\s+\d|CFR|cfr|http|section|sec\.|U\.S\.C|Stat\.|publication)/i;
// The escape probe strips the claim own since-year first: unchanged
const PAYLOAD_FIELDS = ["rule_note", "table_source", "fr_citation"];

// Extract comment lines (// and block) with their 1-based line numbers from RAW source.
export function commentLines(src) {
  const out = [];
  let i = 0, line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === NL) { line++; i++; continue; }
    if (c === DQ || c === SQ || c === BT) {
      const quote = c; i++;
      while (i < n) {
        if (src[i] === BS) { i += 2; continue; }
        if (src[i] === NL) { line++; i++; if (quote !== BT) break; continue; }
        if (src[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === SL && src[i + 1] === SL) {
      const startLine = line;
      let j = i + 2;
      while (j < n && src[j] !== NL) j++;
      out.push({ line: startLine, text: src.slice(i + 2, j) });
      i = j;
      continue;
    }
    if (c === SL && src[i + 1] === ST) {
      const startLine = line;
      let j = i + 2;
      while (j < n && !(src[j] === ST && src[j + 1] === SL)) { if (src[j] === NL) line++; j++; }
      out.push({ line: startLine, text: src.slice(i + 2, j) });
      i = j + 2;
      continue;
    }
    i++;
  }
  return out;
}

// Pure verdict: scan comments AND the three payload fields. red iff any hit lacks the
// dated-observation/source-pointer escape.
export function verdictFor(src) {
  const hits = [];
  for (const c of commentLines(src)) {
    if (!LEXICON.test(c.text)) continue;
    if (ESCAPE.test(c.text)) continue;
    // Structural in an ENGINEERING sense (structural check, structurally valid) is not a
    // stability claim -- the false-positive-safe case. In comments it fires only next to a
    // legal-stability co-occurrent; in PAYLOAD fields it stays unconditional (they ride MCP).
    const structuralOnly = /structural/i.test(c.text) && !/unchanged|never\s+(?:revised|amended|updated|changed|moved)|vacat|upheld|since\s+(?:19|20)\d{2}/i.test(c.text);
    if (structuralOnly && !/(CPI|adjust|threshold|rule of law|legal|statut|regulat|rule)/i.test(c.text)) continue;
    hits.push({ kind: "comment", line: c.line, text: c.text.trim().slice(0, 120) });
  }
  let m;
  const re = new RegExp("(rule_note|table_source|fr_citation)(?:\\s*:\\s*)((?:\\x22[^\\n]*\\x22)|(?:\\x27[^\\n]*\\x27))", "g");
  while ((m = re.exec(src))) {
    const value = m[2].slice(1, m[2].length - 1);
    if (!LEXICON.test(value)) continue;
    if (ESCAPE.test(value)) continue;
    const line = src.slice(0, m.index).split(NL).length;
    hits.push({ kind: "payload:" + m[1], line, text: value.trim().slice(0, 120) });
  }
  return { hits, red: hits.length > 0 };
}

const SCOPE_GLOB = "chaingraph/kernels/*.kernel.mjs";

function scopeFiles() {
  const raw = gitSync(["ls-files", "-z", "--", SCOPE_GLOB], { cwd: REPO, maxBuffer: 32 * 1024 * 1024 });
  return [...new Set(raw.split(String.fromCharCode(0)).filter(Boolean).map((p) => p.split(String.fromCharCode(92)).join(String.fromCharCode(47))))]
    .filter((p) => p.endsWith(".kernel.mjs")).sort();
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
      failures.push(rel + ": " + (hits.length - pinned) + " NEW narrative-vocab hit(s) above the baseline pin (" + pinned + ")");
    } else if (hits.length < pinned) {
      improvements.push(rel + ": " + pinned + " -> " + hits.length + " -- convert the prose to the dated-observation form, then re-pin with `" + REPIN_COMMAND + "`");
    }
  }
  for (const rel of pinnedFiles) {
    if (!counts[rel]) improvements.push(rel + ": clean (baseline entry can be dropped)");
  }
  const ceiling = assertFiniteCeiling(baseline.total, { label: BASELINE_LABEL, keyName: "total" });
  if (total > ceiling) failures.push("estate total " + total + " narrative-vocab hit(s) exceeds the pinned ceiling " + ceiling);
  else if (total < ceiling) improvements.push("estate total " + ceiling + " -> " + total);
  return { failures, improvements, total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const UPDATE = process.argv.includes("--update-baseline");
  const LIST = process.argv.includes("--list");
  const CHECK = process.argv.includes("--check");
  if (CHECK && UPDATE) {
    console.error("X check-narrative-vocab: --check and --update-baseline are mutually exclusive.");
    process.exit(1);
  }

  const files = scopeFiles();
  if (files.length === 0) {
    console.error("X check-narrative-vocab: scope enumeration returned ZERO kernel files -- the gate examined nothing, which is not a pass (SO #34c).");
    process.exit(1);
  }

  const counts = {};
  for (const rel of files) {
    const v = verdictFor(readFileSync(resolve(REPO, rel), "utf8"));
    if (v.red) counts[rel] = v.hits.map((h) => h.kind + " @line " + h.line + ": " + h.text);
  }
  const liveTotal = Object.values(counts).reduce((n, h) => n + h.length, 0);

  if (LIST) {
    for (const rel of Object.keys(counts)) for (const h of counts[rel]) console.log(rel + "  " + h);
    console.log(NL + "check-narrative-vocab: " + liveTotal + " hit(s) across " + Object.keys(counts).length + " kernel(s) of " + files.length + " scanned.");
    process.exit(0);
  }

  if (UPDATE) {
    const prior = readBaselineForUpdate(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
    const per_file = {};
    for (const rel of Object.keys(counts)) per_file[rel] = counts[rel].length;
    const doc = {
      _comment: "NARRATIVE-VOCAB-LINT-1 ratchet pin: self-certifying stability/legal-event prose in kernel comments and the rule_note/table_source/fr_citation payload fields. Counts only go DOWN: convert the prose to the dated-observation form (art-572 escape hatch -- an as-of date or a source pointer), then re-pin with node scripts/check-narrative-vocab.mjs --update-baseline. Loaded through the hard-failing scripts/ratchet-baseline.mjs: deleting this file REDS the gate.",
      total: liveTotal,
      files: Object.keys(counts).sort(),
      per_file,
    };
    if (prior && liveTotal > prior.total) {
      console.error("X check-narrative-vocab --update-baseline REFUSED: this would raise the pinned ceiling " + prior.total + " -> " + liveTotal + ". A ratchet only moves down.");
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + NL);
    console.log("check-narrative-vocab: baseline pinned at " + liveTotal + " hit(s) across " + doc.files.length + " file(s).");
    process.exit(0);
  }

  const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
  const verdict = ratchetVerdict(counts, baseline);

  if (verdict.improvements.length) {
    console.log("check-narrative-vocab: " + verdict.improvements.length + " improvement(s) beat the baseline -- tighten with `" + REPIN_COMMAND + "`");
  }
  if (verdict.failures.length) {
    console.error(NL + "X check-narrative-vocab: " + verdict.failures.length + " FAILURE(s)" + NL + "  " + verdict.failures.join(NL + "  "));
    console.error(NL + "  A stability/legal-event claim nothing re-verifies is self-certification. The sanctioned form is");
    console.error("  the dated observation (the art-572 escape hatch): state the claim WITH its as-of date or");
    console.error("  source pointer, e.g. unchanged since 2013 (FR 2013-19978; re-verified as of 2026-08-27).");
    console.error("  Payload strings ride MCP responses to consumers.");
    process.exit(1);
  }
  console.log("check-narrative-vocab: OK (" + files.length + " kernel(s) scanned, " + baseline.total + " baselined hit(s) within budget).");
}