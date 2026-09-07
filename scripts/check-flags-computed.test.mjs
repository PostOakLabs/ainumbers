// check-flags-computed.test.mjs -- paired red-proof for FLAGS-COMPUTED-LINT-1.
// SO #40(b): RED on every fired leg (literal-array, bare-push, object-true, unparseable),
// GREEN on every computed/conditional shape, the two LIVE byte controls the row names
// (known-bad qfa-04 must fire; known-good sim-03/rca-02 must pass), and the baseline
// ratchet both directions.
import { verdictFor, ratchetVerdict, BASELINE_PATH } from "./check-flags-computed.mjs";
import { readFileSync } from "node:fs";
import { gitEnv } from "./_git-env-lib.mjs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const NL = String.fromCharCode(10);
const failures = [];
const check = (name, ok, detail) => {
  console.log((ok ? "  ok " : "  RED ") + name + (detail ? "  -- " + String(detail).replace(/\s+/g, " ").slice(0, 120) : ""));
  if (!ok) failures.push(name);
};
const kinds = (v) => v.hits.map((h) => h.kind);
const hasHitText = (v, frag) => v.hits.some((h) => h.text.includes(frag));

console.log("CONTROL 1 RED -- the literal-array leg (the qfa-04 shape):");
const litFixture = [
  "export function compute(pp) {",
  "  const riskRating = cva > 100 ? 'HIGH' : 'LOW';",
  "  const compliance_flags = [",
  "    'FRTB_CVA_DESK_COMPUTED',",
  "    'BASEL_III_SA_CCR_ASSESSED',",
  "    `SA_CVA_${riskRating}_RISK`,",
  "  ];",
  "  return { compliance_flags };",
  "}",
].join(NL);
const c1 = verdictFor(litFixture);
check("a constant array with a template element fires literal-array x3 (interpolation does not launder the emission)",
  c1.red === true && kinds(c1).filter((k) => k === "literal-array").length === 3 && hasHitText(c1, "FRTB_CVA_DESK_COMPUTED"), JSON.stringify(c1.hits));

console.log("CONTROL 2 RED -- the bare-push leg (the qfa-03 shape):");
const pushFixture = [
  "export function compute(pp) {",
  "  const compliance_flags = [];",
  "  if (pp.x) compliance_flags.push('CONDITIONAL_ONE');",
  "  compliance_flags.push('HISTORICAL_SCENARIO_MC_STRESS_COMPUTED');",
  "  return { compliance_flags };",
  "}",
].join(NL);
const c2 = verdictFor(pushFixture);
check("a bare top-level push fires bare-push exactly once (the guarded sibling stays clean)",
  kinds(c2).filter((k) => k === "bare-push").length === 1 && hasHitText(c2, "HISTORICAL_SCENARIO_MC_STRESS_COMPUTED"), JSON.stringify(c2.hits));

console.log("CONTROL 3 RED -- the object-true leg and the concat element (the rca-01 shape):");
const concatFixture = [
  "export function compute(pp) {",
  "  const complianceFlags = [",
  "    'FRTB_IMA_ES_COMPUTED',",
  "    cond ? 'NMRF_SURCHARGE_ESTIMATED' : 'NMRF_NOT_APPLICABLE',",
  "    'PLA_TEST_' + plaStatus,",
  "  ];",
  "  return { compliance_flags: complianceFlags };",
  "}",
].join(NL);
const c3 = verdictFor(concatFixture);
check("concat element fires, ternary element does not (2 hits)", kinds(c3).filter((k) => k === "literal-array").length === 2 && hasHitText(c3, "PLA_TEST_"), JSON.stringify(c3.hits));
const objFixture = [
  "export function compute(pp) {",
  "  const compliance_flags = { SUMMA_MST_VERIFY_ONLY: true, MAYBE: pp.x > 1 };",
  "  return Object.keys(compliance_flags);",
  "}",
].join(NL);
const c3b = verdictFor(objFixture);
check("a `<FLAG>: true` object entry fires object-true; the computed entry does not (1 hit)",
  kinds(c3b).filter((k) => k === "object-true").length === 1 && hasHitText(c3b, "SUMMA_MST_VERIFY_ONLY"), JSON.stringify(c3b.hits));

console.log("CONTROL 4 GREEN -- the verified-computed shapes never fire:");
const greenShapes = [
  ["empty array + if/else guarded pushes (sim-03 shape)", [
    "export function compute(pp) {",
    "  const compliance_flags = [];",
    "  if (pp.a > 1) compliance_flags.push('A');",
    "  else compliance_flags.push('B');",
    "  if (pp.b) {",
    "    if (pp.c > 0.1) compliance_flags.push('C');",
    "  }",
    "  return { compliance_flags };",
    "}",
].join(NL)],
  ["braceless if-body push", [
    "export function compute(pp) {",
    "  const compliance_flags = [];",
    "  if (pp.gap)",
    "    compliance_flags.push('LIST_COVERAGE_GAP');",
    "  return { compliance_flags };",
    "}",
].join(NL)],
  ["ternary array + spread/call constructions", [
    "export function compute(pp) {",
    "  const flags = [];",
    "  if (pp.x) flags.push(computeFlag(pp));",
    "  const compliance_flags = verdict === 'PASS' ? ['OK'] : ['FAIL'];",
    "  const c2 = [...new Set(flags)];",
    "  const c3 = Object.keys(flagState);",
    "  return { compliance_flags, c2, c3 };",
    "}",
].join(NL)],
  ["computed push values (identifier args) and filter reassignment", [
    "export function compute(pp, finality_flag) {",
    "  let compliance_flags = ['ALWAYS'? 0 : 'X'];",
    "  compliance_flags = ['ALWAYS', 'EMITTED'].filter(f => f !== 'EMITTED');",
    "  const f2 = [];",
    "  f2.push(finality_flag);",
    "  return { compliance_flags, f2 };",
    "}",
].join(NL)],
];
for (const [name, src] of greenShapes) {
  const v = verdictFor(src);
  check("GREEN: " + name, v.red === false && v.hits.length === 0, JSON.stringify(v.hits));
}

console.log("CONTROL 5 UNPARSEABLE honesty -- an unresolvable construction is a HIT, never a silent skip:");
const unkFixture = [
  "export function compute(pp, feederArg) {",
  "  return { output_payload: {}, compliance_flags: feederArg };",
  "}",
].join(NL);
const c5 = verdictFor(unkFixture);
check("a compliance_flags feeder with no local declaration reports unparseable and REDs",
  c5.red === true && kinds(c5).includes("unparseable"), JSON.stringify(c5.hits));

console.log("CONTROL 6 mutation regressions -- the two defects this scanner had during authoring:");
const destructureFixture = [
  "export function compute(pp) {",
  "  const compliance_flags = ['EARNED_BECAUSE_COND'];",
  "  return { compliance_flags };",
  "}",
  "export async function buildArtifact(pp) {",
  "  const result = compute(pp);",
  "  const { compliance_flags = {} } = result;",
  "  return { compliance_flags };",
  "}",
].join(NL);
const c6a = verdictFor(destructureFixture);
check("a destructuring default is NOT a reassignment (literal hit survives, no unparseable)",
  kinds(c6a).filter((k) => k === "literal-array").length === 1 && !kinds(c6a).includes("unparseable"), JSON.stringify(c6a.hits));
const siblingFixture = [
  "export function compute(pp) {",
  "  if (pp.mode === 'x') {",
  "    const compliance_flags = ['BRANCH_X_ALWAYS'];",
  "    return { compliance_flags };",
  "  }",
  "  const compliance_flags = ['MAIN_ALWAYS'];",
  "  return { compliance_flags };",
  "}",
].join(NL);
const c6b = verdictFor(siblingFixture);
check("sibling declarations are not misread as reassignments (2 hits, no unparseable)",
  kinds(c6b).filter((k) => k === "literal-array").length === 2 && !kinds(c6b).includes("unparseable"), JSON.stringify(c6b.hits));

console.log("CONTROL 7 LIVE bytes -- the row's named controls:");
const liveFile = (rel) => readFileSync(resolve(REPO, rel.replace(/\//g, "/")), "utf8");
const qfa04 = verdictFor(liveFile("chaingraph/kernels/qfa-04-xva-cva-calculator.kernel.mjs"));
check("LIVE RED: qfa-04 fires with FRTB_CVA_DESK_COMPUTED named",
  qfa04.red === true && hasHitText(qfa04, "FRTB_CVA_DESK_COMPUTED") && qfa04.hits.length >= 3, JSON.stringify(qfa04.hits));
const sim03 = verdictFor(liveFile("chaingraph/kernels/sim-03-basel-rwa-scenario-modeler.kernel.mjs"));
check("LIVE GREEN: sim-03 (verified computed) passes with zero hits", sim03.red === false && sim03.hits.length === 0, JSON.stringify(sim03.hits));
const rca02 = verdictFor(liveFile("chaingraph/kernels/rca-02-mica-reserve-stress.kernel.mjs"));
check("LIVE GREEN: rca-02 (verified computed) passes with zero hits", rca02.red === false && rca02.hits.length === 0, JSON.stringify(rca02.hits));
for (const [label, rel] of [["qfa-03", "chaingraph/kernels/qfa-03-stress-test-engine.kernel.mjs"], ["rca-01", "chaingraph/kernels/rca-01-frtb-ima-pre-validator.kernel.mjs"]]) {
  const v = verdictFor(liveFile(rel));
  console.log("  info " + label + " live verdict: " + (v.red ? "RED (" + v.hits.length + " hit(s), baselined -- the batch-3 rows fix it)" : "clean (batch-3 fix already landed)"));
}

console.log("CONTROL 8 BASELINE -- the ratchet holds both directions:");
const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
const files = execSync("git ls-files -z -- chaingraph/kernels/*.kernel.mjs", { cwd: REPO, env: gitEnv() }).toString().split(String.fromCharCode(0)).filter((p) => p.endsWith(".kernel.mjs"));
const liveCounts = {};
for (const f of files) {
  const v = verdictFor(readFileSync(resolve(REPO, f.replace(/\\/g, "/")), "utf8"));
  if (v.red) liveCounts[f.replace(/\\/g, "/")] = v.hits.map((h) => h.kind + ": " + h.text);
}
const liveTotal = Object.values(liveCounts).reduce((n, h) => n + h.length, 0);
const r0 = ratchetVerdict(liveCounts, baseline);
check("live census equals the pin (no drift)", r0.failures.length === 0 && liveTotal === baseline.total, "live=" + liveTotal + " baseline=" + baseline.total);
const withNew = JSON.parse(JSON.stringify(liveCounts));
const someFile = Object.keys(withNew)[0] || "chaingraph/kernels/art-x.kernel.mjs";
withNew[someFile] = [...(withNew[someFile] || []), "literal-array: compliance_flags element emitted unconditionally: 'NEW_UNEARNED_FLAG'"];
const rUp = ratchetVerdict(withNew, baseline);
check("a new unconditional emission above the pin REDs", rUp.failures.length >= 1, rUp.failures.join(" | "));
const removed = JSON.parse(JSON.stringify(liveCounts));
delete removed[Object.keys(liveCounts)[0]];
const rDown = ratchetVerdict(removed, baseline);
check("a cleaned file reports the improvement, never a failure (counts only go down)",
  rDown.failures.length === 0 && rDown.improvements.length >= 1, rDown.improvements.join(" | ").slice(0, 110));

console.log("");
if (failures.length) {
  console.error("check-flags-computed.test: " + failures.length + " control(s) RED");
  for (const f of failures) console.error("  x " + f);
  process.exit(1);
}
console.log("check-flags-computed.test: all controls green (all RED legs, GREEN shapes, unparseable honesty, live qfa-04/sim-03/rca-02 bytes, ratchet both ways).");
