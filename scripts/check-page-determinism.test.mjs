// check-page-determinism.test.mjs — the gate's own controls, as FIXTURES.
//
// ⭐ WHY FIXTURES AND NOT LIVE PAGES. The controls that prove this gate works are
// art-09 (a real defect it must catch) and 514/515 (real pages whose locale calls
// are display-only and must NOT be flagged). Pinning the controls to those files
// would make the proof expire the day art-09 is remediated. These fixtures encode
// the SHAPES instead, so the proof survives the remediation — and survives the
// maintainer, since nothing here needs a human to keep it true.
//
// Run: node scripts/check-page-determinism.test.mjs
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = resolve(HERE, "check-page-determinism.mjs");
const dir = mkdtempSync(join(tmpdir(), "pagedet-"));
const EMPTY_BASELINE = join(dir, "baseline.json");
writeFileSync(EMPTY_BASELINE, JSON.stringify({ entries: [] }));

let failures = 0;
const page = (name, body) => {
  const p = join(dir, `${name}.html`);
  writeFileSync(p, `<!doctype html><html><body><script>\n${body}\n</script></body></html>`);
  return p;
};

function run(file, baseline = EMPTY_BASELINE) {
  try {
    const out = execFileSync(process.execPath, [GATE, "--json", "--file", file, "--baseline", baseline], {
      encoding: "utf8",
    });
    return JSON.parse(out);
  } catch (e) {
    return JSON.parse(e.stdout); // exit 1 on new defects is expected
  }
}

function check(name, cond, detail) {
  if (cond) console.log(`  ok   ${name}`);
  else {
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    failures++;
  }
}

/* 1. NEGATIVE CONTROL — display-only locale formatting is NOT a defect.
 *    This is the single most important property: a whole-file ban ported from the
 *    kernel gate would flag this, be dismissed as noise, and take the gate with it. */
{
  const f = page("display-only", `
    function render(v){ document.getElementById('out').textContent = v.toLocaleString('en-GB'); }
    function seal(){
      var pp = { amount: 100 };
      var op = { total: 100, label: 'flat' };
      render(op.total);
      return { policy_parameters: pp, output_payload: op, generated_at: new Date().toISOString() };
    }`);
  const r = run(f);
  check("display-only toLocaleString is not flagged", r.newDefects.length === 0, JSON.stringify(r.newDefects));
  check("envelope generated_at is not flagged", !r.newDefects.some((d) => /generated_at/.test(d.src)));
}

/* 2. POSITIVE CONTROL — the SAME call, reaching output_payload, IS a defect. */
{
  const f = page("reaches-payload", `
    function seal(){
      var label = (1234).toLocaleString('en-GB');
      var op = { total: 100, label: label };
      return { policy_parameters: {}, output_payload: op };
    }`);
  const r = run(f);
  check("payload-reachable toLocaleString is flagged", r.newDefects.length === 1, JSON.stringify(r.newDefects));
}

/* 2b. POSITIVE CONTROL — reached through a template substitution and a callee,
 *     the art-09 shape (a formatted string built in a helper, sealed later). */
{
  const f = page("reaches-via-callee", `
    function build(n){ return { detail: \`count: \${n.toLocaleString()}\` }; }
    function seal(){
      var rows = build(5);
      return { policy_parameters: {}, output_payload: { rows: rows } };
    }`);
  const r = run(f);
  check("defect inside a template substitution in a callee is flagged", r.newDefects.length === 1, JSON.stringify(r.newDefects));
}

/* 3. SPREAD RESOLVED — a defect hiding in a spread core is found, and the page
 *    is NOT reported unresolved (following the core beats declaring a blind spot). */
{
  const f = page("spread-resolved", `
    function seal(){
      var core = { stamped: Date.now() };
      var op = { ...core, extra: 1 };
      return { policy_parameters: {}, output_payload: op };
    }`);
  const r = run(f);
  check("defect inside a resolvable spread core is flagged", r.newDefects.length === 1, JSON.stringify(r.newDefects));
  check("resolvable spread does not report UNRESOLVED", r.unresolved.length === 0, JSON.stringify(r.unresolved));
}

/* 4. UNRESOLVABLE SPREAD — reported UNRESOLVED, never silently passed.
 *    GATE-SPREAD-OPAQUE-1's principle: a lower bound is not a clean bill. */
{
  const f = page("spread-opaque", `
    function seal(){
      var op = { ...makeCore(), extra: 1 };
      return { policy_parameters: {}, output_payload: op };
    }`);
  const r = run(f);
  check("unresolvable spread is reported UNRESOLVED", r.unresolved.length === 1, JSON.stringify(r.unresolved));
  check("unresolvable spread is not reported as a defect", r.newDefects.length === 0);
}

/* 5. Prose is not code: a banned token inside a plain string is not a defect. */
{
  const f = page("prose", `
    function seal(){
      var op = { rule: 'persons who process personal data', note: 'see Date.now guidance' };
      return { policy_parameters: {}, output_payload: op };
    }`);
  const r = run(f);
  check("banned token inside prose is not flagged", r.newDefects.length === 0, JSON.stringify(r.newDefects));
}

/* 6. Markup is not code: `id=`/`onclick=` attributes must not be followed. */
{
  const f = join(dir, "markup.html");
  writeFileSync(
    f,
    `<!doctype html><html><body><div id="x" onclick="alert(1)" style="color:red">n</div>
<script>
function seal(){ var op = { v: 1 }; return { policy_parameters: {}, output_payload: op }; }
function download(){ var ts = new Date().toISOString(); return 'f_' + ts + '.json'; }
</script></body></html>`,
  );
  const r = run(f);
  check("download-filename timestamp is outside the preimage and not flagged", r.newDefects.length === 0, JSON.stringify(r.newDefects));
}

/* 7. BASELINE + RATCHET — a baselined defect warns instead of failing. */
{
  const f = page("baselined", `
    function seal(){
      var op = { stamped: Date.now() };
      return { policy_parameters: {}, output_payload: op };
    }`);
  const bare = run(f);
  const bl = join(dir, "bl.json");
  writeFileSync(
    bl,
    JSON.stringify({
      entries: bare.newDefects.map((d) => ({ file: d.file, line: d.line, pattern: d.label })),
    }),
  );
  const r = run(f, bl);
  check("baselined defect warns, does not fail", r.newDefects.length === 0 && r.baselineDefects.length === 1, JSON.stringify(r));
}

/* 8. STALE BASELINE — an entry whose defect is gone is called out. */
{
  const f = page("clean", `
    function seal(){ return { policy_parameters: {}, output_payload: { v: 1 } }; }`);
  const bl = join(dir, "stale.json");
  writeFileSync(bl, JSON.stringify({ entries: [{ file: "clean.html", line: 3, pattern: "Date.now()" }] }));
  const p = spawnSync(process.execPath, [GATE, "--file", f, "--baseline", bl], { encoding: "utf8" });
  const both = `${p.stdout}${p.stderr}`;
  check("stale baseline entry is reported", /stale baseline/.test(both), both);
}

rmSync(dir, { recursive: true, force: true });

if (failures) {
  console.error(`\n✗ check-page-determinism.test.mjs — ${failures} failure(s).`);
  process.exit(1);
}
console.log("✓ check-page-determinism.test.mjs — all controls pass.");
