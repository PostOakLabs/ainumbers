// check-narrative-vocab.test.mjs -- paired red-proof for NARRATIVE-VOCAB-LINT-1.
// SO #40(b): RED on BOTH legs (comment AND payload -- F9), GREEN on the dated-observation
// escape, baseline ratchets both directions, false-positive-safe engineering prose.
import { verdictFor, ratchetVerdict } from "./check-narrative-vocab.mjs";
import { readFileSync } from "node:fs";
import { gitEnv } from "./_git-env-lib.mjs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const NL = String.fromCharCode(10);
const failures = [];
const check = (name, ok, detail) => {
  console.log((ok ? "  ok " : "  RED ") + name + (detail ? "  -- " + detail : ""));
  if (!ok) failures.push(name);
};

console.log("CONTROL 1 RED -- the COMMENT leg:");
const commentFixture = [
  "// Stable thresholds, unchanged since 2013.",
  "export function compute(pp) { return pp; }",
].join(NL);
const c1 = verdictFor(commentFixture);
check("a bare unchanged-since-2013 comment is RED", c1.red === true && c1.hits.length === 1 && c1.hits[0].kind === "comment", JSON.stringify(c1));

console.log("CONTROL 2 RED -- the PAYLOAD leg (F9: these ride MCP responses):");
const payloadFixture = [
  'export function compute(pp) {',
  '  return { output_payload: { rule_note: "Unchanged since 2013; safe to rely on" } };',
  '}',
].join(NL);
const c2 = verdictFor(payloadFixture);
check("a bare stability claim inside rule_note payload is RED",
  c2.red === true && c2.hits.length === 1 && c2.hits[0].kind === "payload:rule_note", JSON.stringify(c2));

console.log("CONTROL 3 GREEN -- the art-572 dated-observation escape hatch:");
const escapeFixture = [
  "// Stable thresholds, unchanged since 2013 (FR 2013-19978; re-verified as of 2026-08-27).",
  "export function compute(pp) {",
  '  return { output_payload: { rule_note: "Unchanged since 2013 (FR 2013-19978; re-verified as of 2026-08-27)" } };',
  "}",
].join(NL);
const c3 = verdictFor(escapeFixture);
check("the same sentence WITH as-of date + source pointer passes on BOTH legs", c3.red === false && c3.hits.length === 0, JSON.stringify(c3));

console.log("CONTROL 4 BASELINE -- ratchets both directions:");
const baseline = JSON.parse(readFileSync(resolve(HERE, "narrative-vocab-baseline.json"), "utf8"));
const liveCounts = {};
const RE = /Kernel-Preflight-sentinel/; // placeholder, replaced below
const { execSync } = await import("node:child_process");
const files = execSync("git ls-files -z -- chaingraph/kernels/*.kernel.mjs", { cwd: REPO, env: gitEnv() }).toString().split(String.fromCharCode(0)).filter((p) => p.endsWith(".kernel.mjs"));
for (const f of files) {
  const v = verdictFor(readFileSync(resolve(REPO, f.replace(/\\/g, "/")), "utf8"));
  if (v.red) liveCounts[f.replace(/\\/g, "/")] = v.hits.map((h) => h.kind);
}
const legacy = ratchetVerdict(liveCounts, baseline);
check("all enumerated legacy hits pass shielded (live == baseline)", legacy.failures.length === 0 && legacy.total === baseline.total, "live=" + legacy.total + " baseline=" + baseline.total);
const withNew = JSON.parse(JSON.stringify(liveCounts));
const someFile = Object.keys(withNew)[0] || "chaingraph/kernels/art-x.kernel.mjs";
withNew[someFile] = [...(withNew[someFile] || []), "payload:rule_note"];
const addFail = ratchetVerdict(withNew, baseline);
check("adding a hit above the pin REDs", addFail.failures.length >= 1, addFail.failures.join(" | ").slice(0, 90));
const removed = JSON.parse(JSON.stringify(liveCounts));
delete removed[Object.keys(liveCounts)[0]];
const removeResult = ratchetVerdict(removed, baseline);
check("removing a hit without lowering the baseline reports the improvement + re-pin (counts only go down)",
  removeResult.failures.length === 0 && removeResult.improvements.length >= 1 && removeResult.improvements.length >= 1, removeResult.improvements.join(" | ").slice(0, 110));

console.log("CONTROL 5 FALSE-POSITIVE-SAFE -- engineering prose never fires:");
const engFixture = [
  "// NaN never propagates into the verdict; the structural check is bounded.",
  "export function compute(pp) { return { structural: true }; }",
].join(NL);
const c5 = verdictFor(engFixture);
check("bare never (engineering) and structural check (engineering) are NOT flagged", c5.red === false && c5.hits.length === 0, JSON.stringify(c5));

console.log("");
if (failures.length) {
  console.error("check-narrative-vocab.test: " + failures.length + " control(s) RED");
  for (const f of failures) console.error("  x " + f);
  process.exit(1);
}
console.log("check-narrative-vocab.test: all controls green (both RED legs, escape hatch, ratchet both ways, FP-safe).");