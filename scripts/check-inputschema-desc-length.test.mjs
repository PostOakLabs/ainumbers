// check-inputschema-desc-length.test.mjs -- paired red-proof for MCP-INPUTSCHEMA-DESC-TRIM-1's
// ratchet. SO #40(b) / GATE-SELFTEST-META-1: a gate with no control that actually goes RED is
// a gate nobody has proven. Controls here run the counter against synthetic manifest trees on
// disk (never against the live estate, so the estate's own count cannot make a control flap):
//   1. RED   -- a description over MAX_CHARS is counted.
//   2. GREEN -- a description at exactly MAX_CHARS is NOT counted (boundary is > not >=).
//   3. The counter reads the SERVED slot only; a long description parked in `input_schema`
//      alone is invisible to tools/list and so must not be counted.
//   4. Non-string / absent descriptions never throw and never count.
//   5. The committed baseline is a real number and the live estate is AT OR BELOW it
//      (the ratchet's own invariant: counts only go down).
import { countLongDescriptions, MAX_CHARS } from "./check-inputschema-desc-length.mjs";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const failures = [];
const check = (name, ok, detail) => {
  console.log((ok ? "  ok " : "  RED ") + name + (detail ? "  -- " + detail : ""));
  if (!ok) failures.push(name);
};

/** Build a throwaway repo root holding exactly the given manifests. */
function fixture(manifests) {
  const root = mkdtempSync(join(tmpdir(), "isdl-"));
  mkdirSync(join(root, "manifests"));
  for (const [name, body] of Object.entries(manifests)) {
    writeFileSync(join(root, "manifests", name), JSON.stringify(body, null, 2), "utf8");
  }
  return root;
}
const served = (props) => ({ mcp_tool_definition: { name: "t", inputSchema: { type: "object", properties: props } } });
const runOn = (manifests) => {
  const root = fixture(manifests);
  try { return countLongDescriptions(root); } finally { rmSync(root, { recursive: true, force: true }); }
};

console.log("CONTROL 1 RED -- an over-length served description is counted:");
{
  const r = runOn({ "a.manifest.json": served({ p: { type: "string", description: "x".repeat(MAX_CHARS + 1) } }) });
  check("count is 1", r.count === 1, "count=" + r.count);
  check("offender names the manifest and the property",
    r.offenders[0]?.manifest === "manifests/a.manifest.json" && r.offenders[0]?.property === "p",
    JSON.stringify(r.offenders[0] ?? null));
  check("offender reports the true length", r.offenders[0]?.len === MAX_CHARS + 1, String(r.offenders[0]?.len));
}

console.log("CONTROL 2 GREEN -- exactly MAX_CHARS is allowed (boundary is strictly greater-than):");
{
  const r = runOn({ "a.manifest.json": served({ p: { type: "string", description: "x".repeat(MAX_CHARS) } }) });
  check("count is 0 at the boundary", r.count === 0, "count=" + r.count);
  check("the boundary description is still tallied as described", r.described === 1, "described=" + r.described);
}

console.log("CONTROL 3 -- the SERVED slot is the scope; input_schema alone is not counted:");
{
  const m = {
    input_schema: { type: "object", properties: { p: { type: "string", description: "y".repeat(MAX_CHARS + 50) } } },
    mcp_tool_definition: { name: "t", inputSchema: { type: "object", properties: { p: { type: "string", description: "short" } } } },
  };
  const r = runOn({ "a.manifest.json": m });
  check("a long input_schema-only description is invisible to the ratchet", r.count === 0, "count=" + r.count);
}

console.log("CONTROL 4 -- missing / non-string descriptions neither throw nor count:");
{
  const r = runOn({
    "a.manifest.json": served({ p: { type: "string" }, q: { type: "string", description: 12345 }, r: null }),
    "b.manifest.json": { tool_id: "no-served-schema" },
  });
  check("count is 0", r.count === 0, "count=" + r.count);
  check("no description is tallied", r.described === 0, "described=" + r.described);
  check("only the manifest carrying a served schema is scanned", r.manifests === 1, "manifests=" + r.manifests);
}

console.log("CONTROL 5 -- the committed baseline holds against the LIVE estate (counts only go down):");
{
  let baseline = null;
  try { baseline = JSON.parse(readFileSync(resolve(HERE, "inputschema-desc-length-baseline.json"), "utf8")); } catch { /* reported below */ }
  check("baseline file exists and carries a numeric count",
    baseline !== null && typeof baseline.count === "number", JSON.stringify(baseline));
  check("baseline records the same MAX_CHARS the gate enforces",
    baseline?.max_chars === MAX_CHARS, baseline?.max_chars + " vs " + MAX_CHARS);
  if (baseline && typeof baseline.count === "number") {
    const live = countLongDescriptions(REPO);
    check("live estate is at or below the baseline",
      live.count <= baseline.count, "live=" + live.count + " baseline=" + baseline.count);
    console.log("  (live estate: " + live.count + " over-" + MAX_CHARS + " of " + live.described +
      " described propert(ies) across " + live.manifests + " manifest(s))");
  }
}

if (failures.length) {
  console.error("\nRED (" + failures.length + "): " + failures.join("; "));
  process.exit(1);
}
console.log("\n. check-inputschema-desc-length controls all pass.".replace(".", "✓"));
