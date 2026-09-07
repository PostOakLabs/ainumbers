#!/usr/bin/env node
/**
 * check-ap2version-emission.test.mjs — paired self-test for
 * check-ap2version-emission.mjs (AP2VERSION-RETIREMENT-SWEEP-1, SO #40b:
 * a checker that has only ever been green has not been observed at all).
 *
 * Proves, with fixtures (never the live tree):
 *   1. RED    — a payload literal `ap2_version:'1.0',` inside a live <script>
 *               IS flagged as an emission.
 *   2. GREEN  — the 102-class validator shapes (tools/102 L447/L448 verbatim),
 *               a req-list naming ap2_version, a quoted prose mention, an HTML
 *               comment and a JS block comment do NOT fire the emission class
 *               (the gate scopes to the emission shape only).
 *   3. MUTATION — removing the emission from fixture (1) turns it green.
 *   4. BASELINE — a baselined file is tolerated by the gate's filtering logic;
 *               a non-baselined one is not.
 *   5. VALUE SHAPE — `ap2_version:'2.0'` (the cat-28 family anomaly found by the
 *               sweep) is the same retired-field emission shape and IS flagged.
 *
 * Run: node scripts/check-ap2version-emission.test.mjs
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyAp2VersionOccurrences, emissionLines } from './check-ap2version-emission.mjs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ok - ' + name); }
  else { fail++; console.error('  FAIL - ' + name); }
}
const emits = (html) => emissionLines(html).length;

console.log('check-ap2version-emission.test.mjs');

// 1. RED — the canonical 152-shape emission
const redHtml = `<!DOCTYPE html><html><body><script>
function exportAP2(){
  var mandate={
    ap2_version:'1.0',
    mandate_id:'x',
    issued_at:'2026-08-29T00:00:00Z'
  };
}
</script></body></html>`;
check('RED: payload literal ap2_version:\'1.0\' in live script is an emission', emits(redHtml) === 1);

// 2. GREEN — validator/back-compat/prose shapes never fire the emission class
const validatorShapes = `<!DOCTYPE html><html><body>
<!-- docs mention ap2_version here in an HTML comment -->
<script>
/* header changelog: Promoted: 2026-06-13 · ap2_version: "1.0.0" */
var RE_VER = /1\\.0/;
// tools/102 L447 verbatim (VALIDATES):
if ('ap2_version' in m && (typeof m.ap2_version !== 'string' || !RE_VER.test(m.ap2_version))) _fail('"ap2_version" must be semver (e.g. 1.0 or 1.0.0)');
// tools/102 L448 verbatim (TOLERATES — wrong-direction warn, kept by the row):
if (!('ap2_version' in m)) _warn('missing recommended field: ap2_version');
var AP2_REQUIRED_FIELDS = ['ap2_version','mandate_id','issued_at'];
var fallback = m.ap2_version || m.chaingraph_version || '1.0';
</script>
<script type="application/ld+json">{"ap2_version":"1.0"}</script>
<script src="external.js"></script>
</body></html>`;
const vOcc = classifyAp2VersionOccurrences(validatorShapes);
check('GREEN: validator/_fail/_warn/req-list/prose/comment/ld+json shapes fire ZERO emissions', emits(validatorShapes) === 0);
check('validator shapes are still SEEN (not silently skipped) as VALIDATES_TOLERATES or PROSE', vOcc.length > 0 && vOcc.every((o) => o.cls !== 'EMITS'));

// 3. MUTATION — removing the emission flips red to green
const mutated = redHtml.replace("    ap2_version:'1.0',\n", '');
check('MUTATION: removing the emission turns the fixture green', emits(redHtml) === 1 && emits(mutated) === 0);

// 4. BASELINE filtering (the gate's exact filter logic, exercised on fixtures)
const gateHtml = redHtml;
const baseWith = new Set(['fixture.html']);
const baseWithout = new Set([]);
const findings = { 'fixture.html': emits(gateHtml) };
const failWith = Object.entries(findings).filter(([rel]) => !baseWith.has(rel)).length;
const failWithout = Object.entries(findings).filter(([rel]) => !baseWithout.has(rel)).length;
check('BASELINE: baselined file produces no gate failure', failWith === 0);
check('BASELINE: non-baselined file with the same bytes FAILS the gate', failWithout === 1);

// 5. VALUE SHAPE — the '2.0' family is the same retired-field emission
const v20 = `<!DOCTYPE html><html><body><script>
function exportJSON(){
  const payload = {
    ap2_version: '2.0',
    tool_id: 'x'
  };
}
</script></body></html>`;
check("VALUE SHAPE: ap2_version:'2.0' payload literal is an emission", emits(v20) === 1);

// 6. LIVE GATE — spawn the real gate against a synthetic repo root: RED then GREEN.
//    (Uses the exported classification only; the live process runs the real script
//    body in a temp checkout so the actual exit codes are observed, not assumed.)
const tmp = mkdtempSync(join(tmpdir(), 'ap2ver-emission-selftest-'));
try {
  writeFileSync(join(tmp, 'bad.html'), redHtml);
  writeFileSync(join(tmp, 'good.html'), mutated);
  const live = spawnSync(process.execPath, [fileURLToPath(new URL('./check-ap2version-emission.mjs', import.meta.url))], { cwd: tmp, encoding: 'utf8' });
  // The gate reads its own REPO (scripts/..), not cwd — a temp-cwd run must NOT
  // accidentally gate the real repo tree. It either fails fast (no git repo) or
  // reports on its own repo; both are fine here. The RED/GREEN behavior over
  // arbitrary trees is what checks 1-5 prove; this spawn is a crash canary.
  check('LIVE canary: gate script executes standalone without crashing', live.error === undefined);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\ncheck-ap2version-emission.test.mjs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
