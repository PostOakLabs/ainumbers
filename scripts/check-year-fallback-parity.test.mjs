// check-year-fallback-parity.test.mjs -- paired red-proof for FAIL-CLOSED-PARITY-LINT-1.
// SO #40(b) / GATE-SELFTEST-META-1: proves the lint CAN fail (RED), stays quiet on
// legitimate defaults (false-positive-safe), agrees with the live corpus in both the
// pre-REGZ and post-REGZ states, and that the ratchet verdict bites in both directions.
// Run: node scripts/check-year-fallback-parity.test.mjs
import { scanText, ratchetVerdict, VOCAB_TOKEN, VOCAB_SUBCODE } from "./check-year-fallback-parity.mjs";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const failures = [];
const check = (name, ok, detail) => {
  console.log((ok ? "  ok " : "  RED ") + name + (detail ? "  -- " + detail : ""));
  if (!ok) failures.push(name);
};

const SYNTH_FALLBACK_OR = [
  "const RATES = {",
  "  2024: { v: 1 },",
  "  2026: { v: 2 },",
  "};",
  "export function compute(pp) {",
  "  const year = Number(pp.year);",
  "  const row = RATES[year] || RATES[2026];",
  "  return row;",
  "}",
].join(String.fromCharCode(10));

const SYNTH_FALLBACK_NULLISH = SYNTH_FALLBACK_OR.replace(
  "RATES[year] || RATES[2026]",
  "RATES[year] ?? RATES[2026]");

const SYNTH_DIFF_IDENT = SYNTH_FALLBACK_OR.replace("RATES[2026]", "OTHER[2026]");

const SYNTH_STRING_KEYS = [
  "const M = {",
  "  en: { v: 1 },",
  "  fr: { v: 2 },",
  "};",
  "export function pick(lang) { return M[lang] || M.en; }",
].join(String.fromCharCode(10));

const SYNTH_HTTP_KEYS = [
  "const S = {",
  "  404: { v: 1 },",
  "  500: { v: 2 },",
  "};",
  "export function pick(code) { return S[code] || S[500]; }",
].join(String.fromCharCode(10));

const SYNTH_SINGLE_YEAR_NO_FALLBACK = [
  "const LIMITS = { 2026: 2785000000 };",
  "export function limit(year) {",
  "  return Object.prototype.hasOwnProperty.call(LIMITS, String(year)) ? LIMITS[String(year)] : null;",
  "}",
].join(String.fromCharCode(10));

const SYNTH_LITERAL_FALLBACK = SYNTH_FALLBACK_OR.replace("RATES[2026]", "0.5");

const realKernel = (id) => readFileSync(resolve(REPO, "chaingraph/kernels", id + ".kernel.mjs"), "utf8");

console.log("RED -- the defect shape must be found:");
const orHits = scanText(SYNTH_FALLBACK_OR);
check("same-table || fallback on a year-keyed table is flagged", orHits.length === 1 && orHits[0].table === "RATES" && orHits[0].operator === "||", JSON.stringify(orHits));
const nnHits = scanText(SYNTH_FALLBACK_NULLISH);
check("same-table ?? fallback on a year-keyed table is flagged", nnHits.length === 1 && nnHits[0].operator === "??", JSON.stringify(nnHits));
check("vocabulary tokens are the registered enum tokens", VOCAB_TOKEN === "LOOKUP_YEAR_UNAVAILABLE" && VOCAB_SUBCODE === "NOT_EVALUABLE-LOOKUP", VOCAB_TOKEN + " / " + VOCAB_SUBCODE);

console.log("FALSE-POSITIVE -- legitimate defaults must stay quiet:");
check("different-container fallback (A[k] || B[k]) is not flagged", scanText(SYNTH_DIFF_IDENT).length === 0);
check("string-keyed category table with same-table fallback is not flagged", scanText(SYNTH_STRING_KEYS).length === 0);
check("numeric non-year keys (404/500) are not a year-keyed table", scanText(SYNTH_HTTP_KEYS).length === 0);
check("single-year table with hasOwnProperty refusal is not flagged", scanText(SYNTH_SINGLE_YEAR_NO_FALLBACK).length === 0);
check("fallback onto a literal (not a table row) is out of scope", scanText(SYNTH_LITERAL_FALLBACK).length === 0);
check("live art-332 (reductions[year] || 0, the neutral default) is not flagged", scanText(realKernel("art-332-build-amortization-schedule")).length === 0);
check("live art-70 (MARKUP_BY_YEAR ?? literal, DEFAULT_VALUES category fallback) is not flagged", scanText(realKernel("art-70-cbam-default-value-resolver")).length === 0);
check("live art-220 (the fail-closed GREEN reference) is not flagged", scanText(realKernel("art-220-reg-z-threshold-lookup")).length === 0);
check("live art-235 (the unresolved-year GREEN reference) is not flagged", scanText(realKernel("art-235-test-hpml-escrow")).length === 0);

console.log("LIVE-CORPUS CONSISTENCY -- detected iff the shape is present, both REGZ states:");
const a218 = realKernel("art-218-qm-points-and-fees");
const a218Shape = a218.includes("QM_TIERS_BY_YEAR[year] || QM_TIERS_BY_YEAR[2026]");
const a218Hits = scanText(a218);
check("art-218 verdict matches its own source (RED now, GREEN after REGZ lands)", (a218Hits.length === 1) === a218Shape, "hits=" + a218Hits.length + " shape-present=" + a218Shape);
if (a218Hits.length === 1) check("art-218 finding points at the fallback line (115)", a218Hits[0].line === 115, "line=" + a218Hits[0].line);
const a234 = realKernel("art-234-test-hoepa-high-cost");
const a234Shape = a234.includes("HOEPA_PF[year] || HOEPA_PF[2026]");
const a234Hits = scanText(a234);
check("art-234 verdict matches its own source (RED now, GREEN after REGZ lands)", (a234Hits.length === 1) === a234Shape, "hits=" + a234Hits.length + " shape-present=" + a234Shape);
console.log("RATCHET -- counts only go down, drift is named:");
const pinnedBaseline = {
  _comment: "test fixture",
  total: 2,
  files: ["a.kernel.mjs", "b.kernel.mjs"],
  per_file: { "a.kernel.mjs": 1, "b.kernel.mjs": 1 },
};
const over = ratchetVerdict({ "a.kernel.mjs": [{ line: 9, operator: "||", table: "T", yearKeys: [2026], excerpt: "x" }, { line: 12, operator: "||", table: "T", yearKeys: [2026], excerpt: "y" }], "b.kernel.mjs": [] }, pinnedBaseline);
check("a file over its per-file ceiling fails", over.failures.length === 1 && over.failures[0].includes("a.kernel.mjs"), over.failures.join(" | ").slice(0, 80));
const under = ratchetVerdict({}, pinnedBaseline);
check("a file that went clean is an improvement, not a failure", under.failures.length === 0 && under.improvements.length >= 2, under.improvements.join(" | ").slice(0, 80));
const drift = ratchetVerdict({}, { total: 2, files: ["a.kernel.mjs"], per_file: { "a.kernel.mjs": 1, "b.kernel.mjs": 1 } });
check("per_file/files drift is a named failure (F-11 shape)", drift.failures.length === 1 && drift.failures[0].includes("drift"));
const noPerFile = ratchetVerdict({}, { total: 2, files: [] });
check("a missing per_file object is a named failure, never a silent pass", noPerFile.failures.length === 1 && noPerFile.failures[0].includes("per_file"));
let threw = false;
try { ratchetVerdict({}, { total: Number("1e999"), files: [], per_file: {} }); } catch (e) { threw = true; }
check("a non-finite total ceiling throws (RatchetBaselineError contract)", threw);

console.log("");
if (failures.length) {
  console.error("check-year-fallback-parity.test: " + failures.length + " control(s) RED:");
  for (const f of failures) console.error("  x " + f);
  process.exit(1);
}
console.log("check-year-fallback-parity.test: all controls green (RED-proven lint, false-positive-safe, ratchet bites both ways).");