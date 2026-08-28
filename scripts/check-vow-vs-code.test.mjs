// check-vow-vs-code.test.mjs -- paired red-proof for VOW-VS-CODE-LINT-1 (SO #40(b)).
// RED: a consume vow with no edge and no import. GREEN x2: vow backed by a module import,
// and a vow backed by a declared shard consumes edge. ADJACENCY-IS-NOT-PROVENANCE stated
// and asserted. FP-safe: caller-supplies and type-consumption senses. Baseline both ways.
import { verdictFor, ratchetVerdict } from "./check-vow-vs-code.mjs";
import { readFileSync, readdirSync } from "node:fs";
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
const readKernel = (id) => readFileSync(resolve(REPO, "chaingraph/kernels", id + ".kernel.mjs"), "utf8");

console.log("CONTROL 1 RED -- a consume vow with no edge and no import:");
const redKernel = [
  "// Consumes art-215 reconciliation output for the tie-back.",
  "export function compute(pp) { return pp; }",
].join(NL);
const r1 = verdictFor(redKernel, []);
check("consume vow + node reference + no import + empty consumes = RED", r1.red === true && r1.vows.length === 1, JSON.stringify(r1));

console.log("CONTROL 2 GREEN x2 -- module import and declared shard edge:");
const importKernel = [
  "// Consumes art-215 reconciliation output for the tie-back.",
  'import { compute } from "../art-215-reconciliation.kernel.mjs";',
  "export function compute(pp) { return compute(pp); }",
].join(NL);
check("the same vow backed by a module import passes", verdictFor(importKernel, []).red === false);
const edgeKernel = [
  "// Consumes art-215 reconciliation output for the tie-back.",
  "export function compute(pp) { return pp; }",
].join(NL);
check("the same vow backed by a declared consumes edge passes", verdictFor(edgeKernel, ["art-215-reconciliation"]).red === false);

console.log("CONTROL 3 ADJACENCY IS NOT PROVENANCE (stated and asserted):");
const adjacencyKernel = [
  "// Consumes art-215 output; the ocg:consumes chain edge from the reconciliation chain lands here.",
  "export function compute(pp) { return pp; }",
].join(NL);
const adj = verdictFor(adjacencyKernel, []);
check("an ocg:consumes chain-edge MENTION with empty shard consumes stays RED (this lint never reads chain edges; adjacency alone must not clear a dataflow vow)",
  adj.red === true, JSON.stringify(adj));

console.log("CONTROL 4 FALSE-POSITIVE-SAFE:");
const fp1 = ["// The caller supplies the art-222 eligibility matrix slice per call."].join(NL);
check("caller-supplies sense is NOT flagged (even with a node reference)", verdictFor(fp1, []).red === false && verdictFor(fp1, []).vows.length === 0);
const fp2 = ["* Helper for KDFs: consumes Uint8Array or string."].join(NL);
check("type-consumption (Uint8Array, no node reference) is NOT flagged", verdictFor(fp2, []).red === false && verdictFor(fp2, []).vows.length === 0);

console.log("CONTROL 5 BASELINE -- live estate, both directions:");
const baseline = JSON.parse(readFileSync(resolve(HERE, "vow-vs-code-baseline.json"), "utf8"));
const liveCounts = {};
const floorFiles = readdirSync(resolve(REPO, "chaingraph/kernels")).filter((f) => f.endsWith(".kernel.mjs")).sort();
for (const f of floorFiles) {
  const rel = "chaingraph/kernels/" + f;
  const shardPath = resolve(REPO, "chaingraph/graph/nodes", f.replace(/\.kernel\.mjs$/, ".json"));
  let consumes = [];
  try { consumes = JSON.parse(readFileSync(shardPath, "utf8")).consumes || []; } catch {}
  const v = verdictFor(readFileSync(resolve(REPO, "chaingraph/kernels", f), "utf8"), consumes);
  if (v.red) liveCounts[rel] = v.vows.map((h) => h.text);
}
const legacy = ratchetVerdict(liveCounts, baseline);
check("all enumerated legacy vows pass shielded (live == baseline)", legacy.failures.length === 0 && legacy.total === baseline.total, "live=" + legacy.total + " baseline=" + baseline.total);
const withNew = JSON.parse(JSON.stringify(liveCounts));
withNew["chaingraph/kernels/art-NEW.kernel.mjs"] = ["vow"];
const newFail = ratchetVerdict(withNew, baseline);
check("a NEW unevidenced vow outside the baseline hard-fails", newFail.failures.length >= 1 && newFail.failures.some((x) => x.includes("art-NEW")));
const burn = ratchetVerdict({}, baseline);
check("counts only go down: a fully fixed estate is improvements, never failures", burn.failures.length === 0 && burn.improvements.length >= baseline.files.length);

console.log("");
if (failures.length) {
  console.error("check-vow-vs-code.test: " + failures.length + " control(s) RED");
  for (const f of failures) console.error("  x " + f);
  process.exit(1);
}
console.log("check-vow-vs-code.test: all controls green (RED, GREEN x2, adjacency stated+asserted, FP-safe, baseline both ways).");