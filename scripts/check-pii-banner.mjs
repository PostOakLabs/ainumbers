#!/usr/bin/env node
// check-pii-banner.mjs — PIIBANNER-GATE-SWEEP-1: CONTRACT §1.3 exact-text banner gate.
//
// THE DEFECT (research/AUDIT-PUBLIC-FULLSWEEP-2026-09-01.md STOR-1): CONTRACT §1.3 mandates
// one exact sentence on every tools/*.html page. The estate drifted — some pages drop the
// do-not-enter instruction or the synthetic-inputs clause entirely, some reword it, some
// entity-encode the mandated em-dash (&mdash;) instead of shipping the literal character, some
// substitute a plain hyphen. `CLAUDE.md` checklist item 4's old verification line
// (`grep -rL "pii-notice" tools/*.html`) is a DEAD CHECK: it only asserts the class name
// string appears SOMEWHERE in the file, including inside a `<style>`/`<script>` block that
// defines or references the class without ever rendering the mandated sentence — it has never
// once caught a wrong-text banner.
//
// THIS GATE checks the actual reader-visible TEXT, not a selector. It strips `<script>`,
// `<style>` and HTML comments (so a CSS/JS string mentioning the class name can never satisfy
// it — the exact bug the old grep had), strips remaining tags, collapses whitespace runs (pages
// wrap the sentence across source lines), and asserts the CONTRACT §1.3 sentence appears
// byte-exact — literal em-dash, no entity, no reword, no dropped clause — as a substring of
// that text. A tool may append its own tailored second sentence after the mandated one; that is
// unaffected, since the check is containment, not equality.
//
// SCOPE: tools/*.html only (§1.3's binding scope; CONTRACT.md §1.3 + repo/CLAUDE.md "PII
// Banner" line). guides/ hub pages and root pages are out of this gate's scope — same fence as
// the row that built it (PIIBANNER-GATE-SWEEP-1).
//
// BASELINE: scripts/pii-banner-baseline.json through the shared HARD-FAILING loader
// scripts/ratchet-baseline.mjs (RATCHET-BASELINE-LOADER-1 — no fourth deletable baseline).
// Counts only go DOWN; a file gaining a hit above its pin REDs. The row this gate ships in
// swept every drifted banner found at claim time, so the pin should read 0 — the baseline
// exists as the standing net against future drift, not as shielded legacy debt.
//
// Self-test (RED+GREEN mutation proof, SO #34 clause "verify a checker by mutation, not by
// reading it"): scripts/check-pii-banner.test.mjs.
//
// Usage:
//   node scripts/check-pii-banner.mjs                  # gate (preflight + CI)
//   node scripts/check-pii-banner.mjs --check           # alias
//   node scripts/check-pii-banner.mjs --list             # every non-compliant file
//   node scripts/check-pii-banner.mjs --update-baseline  # re-pin (counts only go down)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRatchetBaselineOrExit, readBaselineForUpdate, assertFiniteCeiling } from "./ratchet-baseline.mjs";
import { gitSync } from "./_git-env-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
export const BASELINE_PATH = resolve(HERE, "pii-banner-baseline.json");
export const REPIN_COMMAND = "node scripts/check-pii-banner.mjs --update-baseline";
const BASELINE_LABEL = "check-pii-banner";
const BASELINE_KEYS = ["total", { key: "files", type: "name-list" }];

const NL = String.fromCharCode(10);

// CONTRACT.md §1.3 — the mandated sentence, byte-exact (real em-dash, U+2014).
export const CANONICAL_BANNER =
  "🔒 All inputs are processed locally in your browser. No data is transmitted. " +
  "Do not enter real personal data — use synthetic or anonymised inputs only.";

// Strip non-rendering regions first — this is the fix for the dead-check bug: a class name or
// the sentence text sitting inside <style>/<script>/a comment must never satisfy the gate.
function stripNonRendering(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, "");
}

function collapseWhitespace(text) {
  return text.replace(/\s+/g, " ");
}

// Pure verdict: does the rendered text of this page contain the CONTRACT §1.3 sentence
// byte-exact? Exported so the self-test can drive it without touching disk.
export function hasCanonicalBanner(html) {
  const visible = collapseWhitespace(stripTags(stripNonRendering(html)));
  return visible.includes(CANONICAL_BANNER);
}

const SCOPE_GLOB = "tools/*.html";

function scopeFiles() {
  const raw = gitSync(["ls-files", "-z", "--", SCOPE_GLOB], { cwd: REPO, maxBuffer: 32 * 1024 * 1024 });
  return [...new Set(raw.split(String.fromCharCode(0)).filter(Boolean).map((p) => p.split(String.fromCharCode(92)).join(String.fromCharCode(47))))]
    .filter((p) => p.endsWith(".html")).sort();
}

export function ratchetVerdict(nonCompliant, baseline) {
  const failures = [], improvements = [];
  const perFile = baseline.per_file;
  if (perFile === null || typeof perFile !== "object" || Array.isArray(perFile)) {
    failures.push("baseline per_file must be an object of {path: 1} — the per-file ceilings are missing or malformed");
    return { failures, improvements, total: 0 };
  }
  const pinnedFiles = new Set(baseline.files);
  for (const key of Object.keys(perFile)) {
    if (!pinnedFiles.has(key)) failures.push("baseline drift: per_file pins " + key + " but files does not list it — re-pin with " + REPIN_COMMAND);
  }
  for (const key of pinnedFiles) {
    if (!Object.prototype.hasOwnProperty.call(perFile, key)) failures.push("baseline drift: files lists " + key + " but per_file has no ceiling for it — re-pin with " + REPIN_COMMAND);
  }
  const live = new Set(nonCompliant);
  for (const rel of live) {
    const pinned = Object.prototype.hasOwnProperty.call(perFile, rel)
      ? assertFiniteCeiling(perFile[rel], { label: BASELINE_LABEL, keyName: "per_file." + rel })
      : 0;
    if (1 > pinned) failures.push(rel + ": missing/wrong CONTRACT §1.3 PII banner text (baseline pin " + pinned + ")");
  }
  for (const rel of pinnedFiles) {
    if (!live.has(rel)) improvements.push(rel + ": clean (baseline entry can be dropped)");
  }
  const total = live.size;
  const ceiling = assertFiniteCeiling(baseline.total, { label: BASELINE_LABEL, keyName: "total" });
  if (total > ceiling) failures.push("estate total " + total + " non-compliant tools/*.html exceeds the pinned ceiling " + ceiling);
  else if (total < ceiling) improvements.push("estate total " + ceiling + " -> " + total);
  return { failures, improvements, total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const UPDATE = process.argv.includes("--update-baseline");
  const LIST = process.argv.includes("--list");
  const CHECK = process.argv.includes("--check");
  if (CHECK && UPDATE) {
    console.error("X check-pii-banner: --check and --update-baseline are mutually exclusive.");
    process.exit(1);
  }

  const files = scopeFiles();
  if (files.length === 0) {
    console.error("X check-pii-banner: scope enumeration returned ZERO tools/*.html files — the gate examined nothing, which is not a pass (SO #34c).");
    process.exit(1);
  }

  const nonCompliant = [];
  for (const rel of files) {
    const html = readFileSync(resolve(REPO, rel), "utf8");
    if (!hasCanonicalBanner(html)) nonCompliant.push(rel);
  }

  if (LIST) {
    for (const rel of nonCompliant) console.log(rel);
    console.log(NL + "check-pii-banner: " + nonCompliant.length + " non-compliant of " + files.length + " tools/*.html scanned.");
    process.exit(0);
  }

  if (UPDATE) {
    const prior = readBaselineForUpdate(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
    const per_file = {};
    for (const rel of nonCompliant) per_file[rel] = 1;
    const doc = {
      _comment: "PIIBANNER-GATE-SWEEP-1 ratchet pin: tools/*.html pages whose rendered text does not contain the CONTRACT §1.3 PII banner sentence byte-exact. Counts only go DOWN: fix the banner text to the canonical sentence (a tailored tail sentence may follow it), then re-pin with node scripts/check-pii-banner.mjs --update-baseline. Loaded through the hard-failing scripts/ratchet-baseline.mjs: deleting this file REDS the gate.",
      total: nonCompliant.length,
      files: nonCompliant.slice().sort(),
      per_file,
    };
    if (prior) {
      // A file gaining non-compliance that was previously compliant (absent from prior.files) is
      // new drift, not estate growth — name it loudly rather than silently absorbing it.
      const newHits = nonCompliant.filter((rel) => !prior.files || !prior.files.includes(rel));
      if (newHits.length) console.log("check-pii-banner: absorbing " + newHits.length + " newly-non-compliant file(s) into the baseline (disclosed): " + newHits.join(", "));
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + NL);
    console.log("check-pii-banner: baseline pinned at " + nonCompliant.length + " non-compliant file(s).");
    process.exit(0);
  }

  const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
  const verdict = ratchetVerdict(nonCompliant, baseline);

  if (verdict.improvements.length) {
    console.log("check-pii-banner: " + verdict.improvements.length + " improvement(s) beat the baseline — tighten with `" + REPIN_COMMAND + "`");
  }
  if (verdict.failures.length) {
    console.error(NL + "X check-pii-banner: " + verdict.failures.length + " FAILURE(s)" + NL + "  " + verdict.failures.join(NL + "  "));
    console.error(NL + "  CONTRACT §1.3 mandates this exact sentence on every tools/*.html page:");
    console.error("  " + CANONICAL_BANNER);
    console.error("  A tool may add its own tailored sentence AFTER it, but the mandated sentence itself must");
    console.error("  appear byte-exact — literal em-dash (not &mdash;), no reworded clause, nothing dropped.");
    process.exit(1);
  }
  console.log("check-pii-banner: OK (" + files.length + " tools/*.html scanned, " + baseline.total + " baselined non-compliant file(s) within budget).");
}
