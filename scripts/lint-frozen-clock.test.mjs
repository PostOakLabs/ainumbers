// lint-frozen-clock.test.mjs -- paired red-proof for NO-CLOCK-LINT-1 (SO #40(b)).
// RED: a synthetic kernel with const TODAY feeding a comparison. GREEN: the art-293
// caller-compared KSeF shape and an echo-only date. art-99 caught + baselined. Counts
// only go down.
import { verdictFor, ratchetVerdict } from "./lint-frozen-clock.mjs";
import { readFileSync } from "node:fs";
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

console.log("CONTROL 1 RED -- synthetic frozen TODAY feeding a comparison:");
const redKernel = [
  "const TODAY = '2026-01-01';",
  "export function compute(pp) {",
  "  const ok = TODAY <= pp.deadline;",
  "  return { ok };",
  "}",
].join(NL);
const r1 = verdictFor(redKernel);
check("const TODAY = date literal feeding a comparison is RED", r1.red === true && r1.hits.length === 1 && r1.hits[0].name === "TODAY" && r1.hits[0].feeding === true, JSON.stringify(r1));

console.log("CONTROL 2 GREEN -- the art-293/295 caller-compared policy-date shape:");
const callerComp = [
  "const KSEF_GO_LIVE = '2026-01-01';",
  "export function compute(pp) {",
  "  const late = pp.transaction_date > KSEF_GO_LIVE;",
  "  return { late };",
  "}",
].join(NL);
check("a POLICY-named date compared against a caller field is NOT flagged", verdictFor(callerComp).red === false);

console.log("CONTROL 3 GREEN -- echo-only and version-pin dates:");
const echoOnly = [
  "const GENERATED_ON = '2026-08-28';",
  "export function compute(pp) { return { generated_on: GENERATED_ON }; }",
].join(NL);
check("an echo-only date constant is NOT flagged", verdictFor(echoOnly).red === false);
const versionPin = [
  "const TABLE_VERSION = '2026.1';",
  "export function compute(pp) { return { table_version: TABLE_VERSION }; }",
].join(NL);
check("a version-pin string is NOT flagged", verdictFor(versionPin).red === false);

console.log("CONTROL 4 art-99 caught and baselined:");
const a99 = verdictFor(readKernel("art-99-mica-transitional-deadline-router"));
check("art-99 kernel TODAY (the audit named defect) is detected and feeding", a99.red === true && a99.hits.some((h) => h.name === "TODAY" && h.feeding), JSON.stringify(a99.hits));
const baseline = JSON.parse(readFileSync(resolve(HERE, "frozen-clock-baseline.json"), "utf8"));
check("art-99 is shielded by the baseline pin", baseline.files.includes("chaingraph/kernels/art-99-mica-transitional-deadline-router.kernel.mjs"));

console.log("CONTROL 5 counts only go down:");
const liveCounts = {
  "chaingraph/kernels/art-99-mica-transitional-deadline-router.kernel.mjs": ["hit"],
  "chaingraph/kernels/__proptests__/art-99-mica-transitional-deadline-router.proptest.mjs": ["hit"],
  "chaingraph/kernels/__proptests__/art-04-agent-identity-attestation-checker.proptest.mjs": ["hit"],
};
const legacy = ratchetVerdict(liveCounts, baseline);
check("the three baselined files pass shielded", legacy.failures.length === 0 && legacy.total === baseline.total);
const withNew = JSON.parse(JSON.stringify(liveCounts));
withNew["chaingraph/kernels/art-NEW.kernel.mjs"] = ["hit"];
const newFail = ratchetVerdict(withNew, baseline);
check("a NEW fake-now outside the baseline hard-fails (unshielded)", newFail.failures.length >= 1 && newFail.failures.some((x) => x.includes("art-NEW")));
const burn = ratchetVerdict({}, baseline);
check("a fully fixed estate is improvements, never failures", burn.failures.length === 0 && burn.improvements.length >= baseline.files.length);

console.log("");
if (failures.length) {
  console.error("lint-frozen-clock.test: " + failures.length + " control(s) RED");
  for (const f of failures) console.error("  x " + f);
  process.exit(1);
}
console.log("lint-frozen-clock.test: all controls green (RED, GREEN x3, art-99 caught + baselined, counts-only-down).");