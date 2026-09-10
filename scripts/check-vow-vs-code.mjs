#!/usr/bin/env node
// check-vow-vs-code.mjs -- VOW-VS-CODE-LINT-1 (J24 L1 lint-family batch).
//
// THE DEFECT (canonical-pattern-fidelity audit + narrative self-certification class applied
// to dependency claims): a kernel that SAYS it consumes another node output, or does not
// duplicate another work, without an edge or an import that makes it so, is making a promise
// nothing keeps. The vow can be false at authoring time or become false when an edge is
// removed -- and reads exactly the same either way.
//
// VERB LIST (final, corpus-derived): consumes, supplies, feeds from, takes the output(s) of,
// combines the output(s) of, builds on the output(s) of, does not duplicate, without
// duplicating. A vow fires ONLY on a line that also cross-references another node
// (art-<n> / VE-<n> / tool_id) -- this keeps engineering senses quiet: a consumes-Uint8Array
// type mention, a caller-supplies-input line, a B2C-supplies noun.
//
// EVIDENCE that clears a vow (EITHER suffices):
//   1. MODULE IMPORT -- the kernel imports another *.kernel.mjs module (real code
//      dependency: the consumed behavior is in-process and version-locked by the import).
//   2. DECLARED DATAFLOW EDGE -- the node shard carries a non-empty consumes[] array (the
//      node-level declared dataflow dependency).
//
// ADJACENCY VS PROVENANCE -- decided and stated (the row requires it): SPEC clarifies that
// an ocg:consumes CHAIN EDGE asserts pipeline adjacency, not dataflow. This lint therefore
// DOES NOT consult chain edges at all: adjacency alone would clear a dataflow vow on exactly
// the confusion the clarification exists to stop. Only the two evidence forms above clear.
// The shard consumes[] array is accepted because it is the node OWN declared dataflow
// dependency (a maintained field, distinct from chain adjacency); it is re-checked on every
// run, so an edge removed later re-REDs the vow.
//
// BASELINE: scripts/vow-vs-code-baseline.json through the shared HARD-FAILING loader
// scripts/ratchet-baseline.mjs. Counts only go DOWN; a NEW unevidenced vow REDs unshielded.
// Zero vows rewritten here -- this row builds the instrument and baselines the debt.
//
// Fence: zero kernel bytes, zero shards, never a write to the assembled graph artifact.
//
// Usage:
//   node scripts/check-vow-vs-code.mjs                     # gate (preflight + CI)
//   node scripts/check-vow-vs-code.mjs --check             # alias
//   node scripts/check-vow-vs-code.mjs --list              # every flagged file
//   node scripts/check-vow-vs-code.mjs --update-baseline   # re-pin (counts only go down)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRatchetBaselineOrExit, readBaselineForUpdate, assertFiniteCeiling } from "./ratchet-baseline.mjs";
import { gitSync } from "./_git-env-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
export const BASELINE_PATH = resolve(HERE, "vow-vs-code-baseline.json");
export const REPIN_COMMAND = "node scripts/check-vow-vs-code.mjs --update-baseline";
const BASELINE_LABEL = "check-vow-vs-code";
const BASELINE_KEYS = ["total", { key: "files", type: "name-list" }];

export const NL = String.fromCharCode(10);

// Verb list (final) + the cross-node reference requirement on the same line.
export const VOW_RE = /\b(?:consumes?|supplies|feeds\s+from|does\s+not\s+duplicate|without\s+duplicating|takes\s+the\s+outputs?\s+of|combines\s+the\s+outputs?\s+of|builds\s+on\s+the\s+outputs?\s+of)\b/i;
export const NODE_REF = /art-\d{1,4}\b|VE-\d+\b|tool_id/i;
// Engineering senses that are never dependency vows, even with a node reference nearby.
const SAFE = /\bcaller\b|\buser\b|\breader\b|\bUint8Array\b|\bparameter\b|\bpolicy_param/i;

export function verdictFor(src, shardConsumes) {
  const hasImport = /from\s+(?:'|")[^'"\n]*kernel\.mjs(?:'|")/.test(src) &&
    /import\s/.test(src);
  const edgeEvidence = (shardConsumes || []).length > 0;
  const lines = src.split(NL);
  const vows = [];
  for (let i = 0; i < lines.length; i++) {
    if (!VOW_RE.test(lines[i])) continue;
    if (!NODE_REF.test(lines[i])) continue;
    if (SAFE.test(lines[i])) continue;
    vows.push({ line: i + 1, text: lines[i].trim().slice(0, 120) });
  }
  return { hasImport, edgeEvidence, vows, red: vows.length > 0 && !hasImport && !edgeEvidence };
}

const SCOPE_GLOB = "chaingraph/kernels/*.kernel.mjs";

function scopeFiles() {
  const raw = gitSync(["ls-files", "-z", "--", SCOPE_GLOB], { cwd: REPO, maxBuffer: 32 * 1024 * 1024 });
  return [...new Set(raw.split(String.fromCharCode(0)).filter(Boolean).map((p) => p.split(String.fromCharCode(92)).join(String.fromCharCode(47))))]
    .filter((p) => p.endsWith(".kernel.mjs")).sort();
}

function shardConsumesFor(rel) {
  const id = rel.split(String.fromCharCode(47)).pop().replace(/\.kernel\.mjs$/, "");
  const p = resolve(REPO, "chaingraph/graph/nodes", id + ".json");
  if (!existsSync(p)) return [];
  try { const j = JSON.parse(readFileSync(p, "utf8")); return Array.isArray(j.consumes) ? j.consumes : []; } catch { return []; }
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
      failures.push(rel + ": " + (hits.length - pinned) + " NEW unevidenced consume-vow hit(s) above the baseline pin (" + pinned + ")");
    } else if (hits.length < pinned) {
      improvements.push(rel + ": " + pinned + " -> " + hits.length + " -- add the import or the declared consumes edge, then re-pin with `" + REPIN_COMMAND + "`");
    }
  }
  for (const rel of pinnedFiles) {
    if (!counts[rel]) improvements.push(rel + ": clean (baseline entry can be dropped)");
  }
  const ceiling = assertFiniteCeiling(baseline.total, { label: BASELINE_LABEL, keyName: "total" });
  if (total > ceiling) failures.push("estate total " + total + " unevidenced consume-vow file(s) exceeds the pinned ceiling " + ceiling);
  else if (total < ceiling) improvements.push("estate total " + ceiling + " -> " + total);
  return { failures, improvements, total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const UPDATE = process.argv.includes("--update-baseline");
  const LIST = process.argv.includes("--list");
  const CHECK = process.argv.includes("--check");
  if (CHECK && UPDATE) {
    console.error("X check-vow-vs-code: --check and --update-baseline are mutually exclusive.");
    process.exit(1);
  }

  const files = scopeFiles();
  if (files.length === 0) {
    console.error("X check-vow-vs-code: scope enumeration returned ZERO kernel files -- the gate examined nothing, which is not a pass (SO #34c).");
    process.exit(1);
  }

  const counts = {};
  for (const rel of files) {
    const shard = shardConsumesFor(rel);
    const v = verdictFor(readFileSync(resolve(REPO, rel), "utf8"), shard);
    if (v.red) counts[rel] = v.vows.map((h) => "vow @line " + h.line + ": " + h.text);
  }
  const liveTotal = Object.values(counts).reduce((n, h) => n + h.length, 0);

  if (LIST) {
    for (const rel of Object.keys(counts)) for (const h of counts[rel]) console.log(rel + "  " + h);
    console.log(NL + "check-vow-vs-code: " + liveTotal + " unevidenced consume-vow hit(s) across " + Object.keys(counts).length + " kernel(s) of " + files.length + " scanned.");
    process.exit(0);
  }

  if (UPDATE) {
    const prior = readBaselineForUpdate(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
    const per_file = {};
    for (const rel of Object.keys(counts)) per_file[rel] = counts[rel].length;
    const doc = {
      _comment: "VOW-VS-CODE-LINT-1 ratchet pin: consume/do-not-duplicate vows (consumes, supplies, feeds from, ...) that cross-reference another node with NO module import and NO declared shard consumes edge. Counts only go DOWN: add the import or the declared edge, then re-pin with node scripts/check-vow-vs-code.mjs --update-baseline. Loaded through the hard-failing scripts/ratchet-baseline.mjs: deleting this file REDS the gate. Chain-edge ocg:consumes adjacency is deliberately NOT consulted (adjacency is not provenance).",
      total: liveTotal,
      files: Object.keys(counts).sort(),
      per_file,
    };
    if (prior && liveTotal > prior.total) {
      console.error("X check-vow-vs-code --update-baseline REFUSED: this would raise the pinned ceiling " + prior.total + " -> " + liveTotal + ". A ratchet only moves down.");
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + NL);
    console.log("check-vow-vs-code: baseline pinned at " + liveTotal + " hit(s) across " + doc.files.length + " file(s).");
    process.exit(0);
  }

  const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
  const verdict = ratchetVerdict(counts, baseline);

  if (verdict.improvements.length) {
    console.log("check-vow-vs-code: " + verdict.improvements.length + " improvement(s) beat the baseline -- tighten with `" + REPIN_COMMAND + "`");
  }
  if (verdict.failures.length) {
    console.error(NL + "X check-vow-vs-code: " + verdict.failures.length + " FAILURE(s)" + NL + "  " + verdict.failures.join(NL + "  "));
    console.error(NL + "  A consume vow nothing verifies is self-certification. Clear it with a module import of the");
    console.error("  consumed kernel, or a declared consumes edge in the node shard. Chain-edge adjacency does");
    console.error("  not count (ocg:consumes asserts pipeline adjacency, not dataflow).");
    process.exit(1);
  }
  console.log("check-vow-vs-code: OK (" + files.length + " kernel(s) scanned, " + baseline.total + " baselined hit(s) within budget).");
}