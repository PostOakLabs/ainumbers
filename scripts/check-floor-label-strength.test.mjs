// check-floor-label-strength.test.mjs -- paired red-proof for FLOOR-LABEL-LINT-1.
// SO #40(b) / GATE-SELFTEST-META-1: the five row-mandated controls -- RED on a real census
// floor naming label + too-weak predicate, GREEN on a pinned floor, PHOTOCOPY-still-RED,
// baseline shields legacy but NEW fails, untouched floors counted. Plus counts-only-down.
import { verdictFor, ratchetVerdict } from "./check-floor-label-strength.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const FLOORS = resolve(REPO, "chaingraph/kernels/__proptests__");
const NL = String.fromCharCode(10);
const Q = String.fromCharCode(34);
const failures = [];
const check = (name, ok, detail) => {
  console.log((ok ? "  ok " : "  RED ") + name + (detail ? "  -- " + detail : ""));
  if (!ok) failures.push(name);
};
const readFloor = (id) => readFileSync(resolve(FLOORS, id + ".proptest.mjs"), "utf8");
const baseline = JSON.parse(readFileSync(resolve(HERE, "floor-label-strength-baseline.json"), "utf8"));

console.log("CONTROL 1 RED -- a real census floor is flagged, naming the weakness:");
// Re-anchored by ASSEMBLE-LAND-WITHHELD-0829-1 (2026-08-29): the merged PR legitimately
// FIXED art-223's floor (it gained literal pins; baseline re-pinned 116 -> 115), so the old
// hardcoded art-223 RED anchor went stale. The control keeps its semantics -- the lint
// must flag a REAL live census floor -- by anchoring on the first baseline-named floor that is
// still red. If the estate is fixed without a re-pin (or the lint stops flagging), no carrier is
// found and this control REDs, which is the correct signal.
const redCarrier = baseline.files
  .slice()
  .sort()
  .map((f) => f.replace(/^.*\//, "").replace(/\.proptest\.mjs$/, ""))
  .find((id) => {
    try { return verdictFor(readFloor(id)).red; } catch { return false; }
  });
check("a baseline-named live census floor is RED: outcome language, zero literal pins",
  redCarrier !== undefined, redCarrier ?? "no red carrier found -- baseline stale or lint broken; re-pin with " + "node scripts/check-floor-label-strength.mjs --update-baseline");
if (redCarrier !== undefined) {
  const carrier = verdictFor(readFloor(redCarrier));
  check(redCarrier + " is RED with outcome language and zero pins",
    carrier.red === true && carrier.outcome === true && carrier.pins === 0, JSON.stringify(carrier));
  const carrierSrc = readFloor(redCarrier);
  const weakLabel = (carrierSrc.match(/'[^']*must[^']*'/) || [""])[0];
  const weakPred = (carrierSrc.match(/(?:Number\.isFinite|typeof)\([^)]*\)/) || [""])[0];
  check("its labels use outcome language and its predicates are finite/enum only",
    weakLabel !== "" && weakPred !== "", (weakLabel + " | " + weakPred).slice(0, 110));
}

console.log("CONTROL 2 GREEN -- a floor whose label outcome IS pinned passes:");
const a11 = verdictFor(readFloor("art-11-vop-batch-match-rate-analyser"));
check("art-11 (the audit EXP-E faithful-floor contrast) is GREEN",
  a11.red === false && a11.pins > 0, JSON.stringify(a11));

console.log("CONTROL 3 PHOTOCOPY -- restating the kernel own rule is still RED:");
const photocopyFloor = [
  "// labels promise outcomes:",
  "const CASES = [[{ v: 1 }, " + Q + "must be conforming" + Q + "], [{ v: 2 }, " + Q + "must not be conforming" + Q + "]];",
  "function checkP(v) {",
  "  const r = compute(v);",
  "  const expected = r.classification === r.rule_value; // self-oracle: recomputed from kernel output fields",
  "  if (r.verdict !== expected) violations++;",
  "  if (!Number.isFinite(r.score)) violations++;",
  "}",
].join(NL);
const pc = verdictFor(photocopyFloor);
check("self-oracle photocopy predicate + outcome labels = still RED", pc.red === true, JSON.stringify(pc));

console.log("CONTROL 4 BASELINE -- legacy shielded, NEW fails, counts only go down:");
const liveCounts = {};
const floorFiles = readdirSync(FLOORS).filter((f) => f.endsWith(".proptest.mjs")).sort();
let outcomeFiles = 0;
for (const f of floorFiles) {
  const v = verdictFor(readFileSync(resolve(FLOORS, f), "utf8"));
  if (v.red) liveCounts["chaingraph/kernels/__proptests__/" + f] = ["flagged"];
  if (v.outcome) outcomeFiles++;
}
const legacy = ratchetVerdict(liveCounts, baseline);
check("all enumerated legacy floors pass shielded (live == baseline, zero failures)",
  legacy.failures.length === 0 && legacy.total === baseline.total, "live=" + legacy.total + " baseline=" + baseline.total);
const withNew = JSON.parse(JSON.stringify(liveCounts));
withNew["chaingraph/kernels/__proptests__/art-NEW-fake.proptest.mjs"] = ["flagged"];
const newFail = ratchetVerdict(withNew, baseline);
check("a NEW non-compliant floor outside the baseline hard-fails", newFail.failures.length >= 1 && newFail.failures.some((x) => x.includes("art-NEW-fake")), newFail.failures.join(" | ").slice(0, 90));
const burn = ratchetVerdict({}, baseline);
check("counts only go down: a fully fixed estate is improvements, never failures",
  burn.failures.length === 0 && burn.improvements.length >= baseline.files.length, "improvements=" + burn.improvements.length);

console.log("CONTROL 5 UNCHANGED -- floors with no outcome language are untouched:");
check("floors carrying no outcome language are never flagged",
  legacy.total === baseline.total && outcomeFiles > legacy.total,
  "638 floors scanned; " + outcomeFiles + " carry outcome language; " + legacy.total + " flagged (no pin); " + (floorFiles.length - outcomeFiles) + " untouched by this lint");

console.log("");
if (failures.length) {
  console.error("check-floor-label-strength.test: " + failures.length + " control(s) RED");
  for (const f of failures) console.error("  x " + f);
  process.exit(1);
}
console.log("check-floor-label-strength.test: all five controls green.");