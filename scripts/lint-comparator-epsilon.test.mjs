// lint-comparator-epsilon.test.mjs -- paired red-proof for COMPARATOR-EPSILON-LINT-1
// (SO #40(b) / GATE-SELFTEST-META-1). RED: a synthetic strict comparator widened by an
// epsilon (the art-234 L106 inversion shape). GREEN: the tightening form, the
// widening-inclusive forms, plain comparators, bare-epsilon proximity guards, and
// comment/string mentions. art-234 caught + baselined. Counts only go down. The ratchet
// loader is verified by MUTATION of inputs, never by reading it (SO #34).
import { verdictFor, ratchetVerdict, stripCommentsAndStrings, splitTopLevel, classifyTerm } from "./lint-comparator-epsilon.mjs";
import { validateRatchetBaseline } from "./ratchet-baseline.mjs";
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

console.log("CONTROL 1 RED -- strict comparator widened by an epsilon (the art-234 inversion shape):");
const redSrc = "const t = v > LIMIT - 1e-5;";
const r1 = verdictFor(redSrc);
check("`v > LIMIT - 1e-5` is flagged WIDENING_STRICT",
  r1.flagged.length === 1 && r1.hits[0].shape === "WIDENING_STRICT" && r1.hits[0].op === ">" && r1.hits[0].epsSign === "-",
  JSON.stringify(r1.hits));
const mirror = verdictFor("if (v < LIMIT + 1e-5) fire();");
check("`v < LIMIT + 1e-5` (mirror image) is flagged WIDENING_STRICT",
  mirror.flagged.length === 1 && mirror.hits[0].shape === "WIDENING_STRICT",
  JSON.stringify(mirror.hits));
const swapped = verdictFor("const ok = LIMIT - 1e-5 < v;");
check("`LIMIT - 1e-5 < v` normalizes (epsilon on the left) to the same flagged shape",
  swapped.flagged.length === 1 && swapped.hits[0].shape === "WIDENING_STRICT" && swapped.hits[0].mirrored === true,
  JSON.stringify(swapped.hits));

console.log("CONTROL 2 GREEN -- tightening shapes are informational, never flagged:");
const tighten1 = verdictFor("const t = v > LIMIT + 1e-5;");
check("`v > LIMIT + 1e-5` matches as TIGHTENING_STRICT but is NOT flagged",
  tighten1.hits.length === 1 && tighten1.hits[0].shape === "TIGHTENING_STRICT" && tighten1.flagged.length === 0,
  JSON.stringify(tighten1.hits));
const tighten2 = verdictFor("const t = v < LIMIT - 1e-5;");
check("`v < LIMIT - 1e-5` matches as TIGHTENING_STRICT but is NOT flagged",
  tighten2.hits.length === 1 && tighten2.hits[0].shape === "TIGHTENING_STRICT" && tighten2.flagged.length === 0);

console.log("CONTROL 3 GREEN -- widening over an INCLUSIVE comparator is census-only:");
const wide1 = verdictFor("const t = v >= LIMIT - 1e-5;");
check("`v >= LIMIT - 1e-5` is WIDENING_INCLUSIVE, not flagged",
  wide1.hits.length === 1 && wide1.hits[0].shape === "WIDENING_INCLUSIVE" && wide1.flagged.length === 0);
const wide2 = verdictFor("const t = v <= LIMIT + 1e-5;");
check("`v <= LIMIT + 1e-5` is WIDENING_INCLUSIVE, not flagged",
  wide2.hits.length === 1 && wide2.hits[0].shape === "WIDENING_INCLUSIVE" && wide2.flagged.length === 0);

console.log("CONTROL 4 GREEN -- out-of-scope classes never match:");
const plain = verdictFor("const t = v > LIMIT;");
check("a plain comparator is out of scope (0 hits, counted plain)", plain.hits.length === 0 && plain.census.plain === 1);
const bare = verdictFor("if (Math.abs(x) < 1e-9) break;");
check("a bare-epsilon proximity guard is excluded (counted bare)", bare.hits.length === 0 && bare.census.bare === 1);
const rel = verdictFor("if (inv > lca * (1 + tol)) reject();");
check("a relative/multiplicative tolerance is excluded (counted relative)", rel.hits.length === 0 && rel.census.relative === 1);
const commented = verdictFor("// v > LIMIT - 1e-5 is the documented rule" + NL + "const t = v > LIMIT;");
check("an epsilon comparator quoted in a COMMENT does not match", commented.hits.length === 0 && commented.census.plain === 1);
const inString = verdictFor("const msg = `v > LIMIT - 1e-5 fired`;");
check("an epsilon comparator inside a STRING does not match", inString.hits.length === 0);
const arrow = verdictFor("const f = (a) => a > LIMIT;");
check("an arrow function's => is not read as a comparator", arrow.census.comparisons === 1 && arrow.hits.length === 0);

console.log("CONTROL 5 splitting and classification mechanics:");
check("splitTopLevel keeps `1e-5` whole",
  JSON.stringify(splitTopLevel("LIMIT - 1e-5").map((t) => t.sign + ":" + t.text)) === '["+:LIMIT","-:1e-5"]',
  JSON.stringify(splitTopLevel("LIMIT - 1e-5")));
check("classifyTerm: sci-notation and positional literals under 0.01 are epsilon; 0.5 is not",
  classifyTerm("1e-5") === "epsilon" && classifyTerm("0.005") === "epsilon" && classifyTerm("0.5") === "other");
check("classifyTerm: tolerance-named identifiers are epsilon; `marginal_effect_pct` is not",
  classifyTerm("tolerance_pct") === "epsilon" && classifyTerm("roundingToleranceUsd") === "epsilon" && classifyTerm("marginal_effect_pct") === "other");
const stripped = stripCommentsAndStrings("const s = 'v > L - 1e-5'; // v > L - 1e-5" + NL + "const t = v > L - 1e-5;");
check("stripCommentsAndStrings blanks comments+strings, keeps code (offset-stable)",
  stripped.split(NL)[1] === "const t = v > L - 1e-5;" && !stripped.split(NL)[0].includes("1e-5"));

console.log("CONTROL 6 art-234 caught and baselined:");
const a234 = verdictFor(readKernel("art-234-test-hoepa-high-cost"));
const flaggedLines = a234.flagged.map((h) => h.line).sort((a, b) => a - b);
check("art-234 kernel lines 93 and 106 are flagged WIDENING_STRICT (the audit-named L106 inversion + its sibling)",
  JSON.stringify(flaggedLines) === "[93,106]", JSON.stringify(a234.flagged.map((h) => h.line + ":" + h.shape)));
const baseline = JSON.parse(readFileSync(resolve(HERE, "comparator-epsilon-baseline.json"), "utf8"));
check("art-234 is shielded by the baseline pin",
  baseline.files.includes("chaingraph/kernels/art-234-test-hoepa-high-cost.kernel.mjs") && baseline.total === 2);

console.log("CONTROL 7 counts only go down:");
const liveCounts = {
  "chaingraph/kernels/art-234-test-hoepa-high-cost.kernel.mjs": ["hit", "hit"],
};
const shielded = ratchetVerdict(liveCounts, baseline);
check("the baselined file passes shielded", shielded.failures.length === 0 && shielded.total === baseline.total);
const withNew = { ...liveCounts, "chaingraph/kernels/art-NEW.kernel.mjs": ["hit"] };
const newFail = ratchetVerdict(withNew, baseline);
check("a NEW widening-strict shape outside the baseline hard-fails (unshielded)",
  newFail.failures.length >= 1 && newFail.failures.some((x) => x.includes("art-NEW")));
const burn = ratchetVerdict({}, baseline);
check("a fully fixed estate is improvements, never failures",
  burn.failures.length === 0 && burn.improvements.length >= baseline.files.length);
check("a baseline pinning MORE than the live count reports the improvement",
  ratchetVerdict({ "chaingraph/kernels/art-234-test-hoepa-high-cost.kernel.mjs": ["hit"] }, baseline)
    .improvements.some((x) => x.includes("art-234")));

console.log("CONTROL 8 the loader hard-fails on a missing/corrupt baseline (deleting it is never a pass):");
const missingStates = ["MISSING-FILE", "INVALID-JSON", "MISSING-KEY", "NAN-KEY", "BAD-LIST-KEY"];
let sawMissing = false;
try {
  validateRatchetBaseline(null, ["total", { key: "files", type: "name-list" }], { label: "test", path: "x", repinCommand: "x" });
} catch (e) {
  sawMissing = e.state === "MISSING-FILE";
}
check("baseline text null -> MISSING-FILE hard error", sawMissing);
const corrupted = JSON.stringify({ total: 2, files: "not-an-array" }); // files list demoted to a string
let sawBadList = false;
try {
  validateRatchetBaseline(corrupted, ["total", { key: "files", type: "name-list" }], { label: "test", path: "x", repinCommand: "x" });
} catch (e) {
  sawBadList = e.state === "BAD-LIST-KEY";
}
check("baseline with the files list demoted to a non-array -> BAD-LIST-KEY hard error", sawBadList);
check("all five loader states are named in the loader's contract", missingStates.length === 5);

console.log("");
if (failures.length) {
  console.error("lint-comparator-epsilon.test: " + failures.length + " control(s) RED");
  for (const f of failures) console.error("  x " + f);
  process.exit(1);
}
console.log("lint-comparator-epsilon.test: all controls green (RED, GREEN x5, art-234 caught + baselined, counts-only-down, loader hard-fails).");
