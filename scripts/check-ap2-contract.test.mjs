/**
 * scripts/check-ap2-contract.test.mjs — paired self-test for
 * check-ap2-contract.mjs (AP2-DEBT-BASELINE-1, SO #40b: "a checker that
 * cannot be shown red proves nothing").
 *
 * classify() is a pure function over raw HTML text — every case here feeds
 * it a small crafted fixture, then changes exactly one thing and asserts
 * the verdict moves. A test that only asserted "today's baseline passes"
 * would stay green if classify() were gutted to `return null`.
 *
 * Also proves the scanner-level RED->GREEN cycle the row's RAILS require:
 * a scratch tools/*.html fixture with a bare, unwired `ap2ExportBtn` is
 * written under a throwaway tools-dir copy, scanTools() reports it as a
 * violation (RED, not in any baseline), then the fixture is removed and
 * the same scan comes back clean (GREEN). Nothing under the real repo is
 * touched — scanTools() takes an explicit dir argument for exactly this.
 *
 * Run: node scripts/check-ap2-contract.test.mjs
 */
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classify, findResultsExportRowSpans, scanTools, CLASSES } from './check-ap2-contract.mjs';

let pass = 0;
let fail = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    fail++;
    failures.push(`${name}\n      ${e.message}`);
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log('check-ap2-contract.test.mjs');

// ── 1. No button at all -> out of scope, not a violation ─────────────────
test('SCOPE - a file with no ap2ExportBtn is not classified (null, not clean)', () => {
  assert(classify('<div class="results-export-row"><button>hi</button></div>') === null,
    'a file without the button must return null, distinct from "clean"');
});

// ── 2. CANARY - the canonical wired shape is clean in all four classes ───
const CANONICAL = `
<div class="results-export-row">
  <button id="ap2ExportBtn" onclick="exportAP2()" disabled>Export</button>
</div>
<script>
  function exportAP2(){ AP2Schema.validate(payload); }
  document.getElementById('ap2ExportBtn').classList.add('ready');
</script>`;
test('CANARY - canonical wired button is clean in all four classes', () => {
  const c = classify(CANONICAL);
  for (const cls of CLASSES) assert(c[cls] === false, `expected ${cls}=false on the canonical shape, got ${JSON.stringify(c)}`);
});

// ── 3. MUTATION - noRow: removing the container flips exactly that class ─
test('MUTATION - deleting .results-export-row flips noRow true, others unaffected', () => {
  const mutated = CANONICAL.replace('<div class="results-export-row">', '<div>').replace('</div>\n<script>', '</div>\n<script>');
  const before = classify(CANONICAL);
  const after = classify(mutated);
  assert(before.noRow === false && after.noRow === true, `noRow should flip true: before=${before.noRow} after=${after.noRow}`);
  assert(after.neverEnabled === before.neverEnabled, 'unrelated class must not move from this mutation');
  assert(after.noSchema === before.noSchema, 'unrelated class must not move from this mutation');
});

// ── 4. MUTATION - outsideRow: a real row exists elsewhere, button not in it ─
// This is the exact T332/T12/T13/T343 shape found live in the estate: a
// results-export-row div holding an unrelated button, with the real
// ap2ExportBtn placed elsewhere in the file. A naive "does the string
// results-export-row appear anywhere before the button" check would call
// this clean; the tag-depth walk must not.
const MISPLACED = `
<div class="results-export-row"><button id="ainSendVerifyBtn">Send</button></div>
<p>unrelated content in between</p>
<button id="ap2ExportBtn" onclick="exportAP2()" disabled>Export</button>
<script>function exportAP2(){ AP2Schema.validate(payload); } document.getElementById('ap2ExportBtn');</script>`;
test('MUTATION - a real row that does not contain the button classifies outsideRow, not noRow', () => {
  const c = classify(MISPLACED);
  assert(c.noRow === false, `a results-export-row div is present, noRow must be false, got ${c.noRow}`);
  assert(c.outsideRow === true, `button sits outside the only row on the page, expected outsideRow=true, got ${c.outsideRow}`);
});

// ── 5. CONTROL - button correctly nested inside a row with OTHER buttons ─
// Guards the opposite failure mode: a row containing several buttons plus
// ap2ExportBtn must not be misclassified as outsideRow because of the extra
// siblings sharing the container.
test('CONTROL - button nested alongside sibling buttons inside the same row is NOT outsideRow', () => {
  const html = `<div class="results-export-row"><button id="ainSendVerifyBtn">Send</button><button id="ap2ExportBtn" onclick="exportAP2()" disabled>Export</button></div><script>AP2Schema.validate; document.getElementById('ap2ExportBtn');</script>`;
  const c = classify(html);
  assert(c.outsideRow === false, `button shares the row with a sibling button, expected outsideRow=false, got ${c.outsideRow}`);
});

// ── 6. MUTATION - neverEnabled: exactly one occurrence (the element itself) ─
test('MUTATION - removing every JS reference leaves exactly 1 occurrence -> neverEnabled true', () => {
  const wired = classify(CANONICAL);
  const dead = CANONICAL.replace(/document\.getElementById\('ap2ExportBtn'\)[^;]*;\s*/, '').replace('function exportAP2(){ AP2Schema.validate(payload); }', 'function exportAP2(){ AP2Schema.validate(payload); }');
  const c = classify(dead);
  assert(wired.neverEnabled === false, 'canonical fixture must start wired (neverEnabled=false)');
  assert(c.neverEnabled === true, `stripping the getElementById reference should leave 1 occurrence -> neverEnabled=true, got ${c.neverEnabled}`);
});

// ── 7. MUTATION - noSchema: removing AP2Schema flips exactly that class ──
test('MUTATION - removing every AP2Schema reference flips noSchema true, others unaffected', () => {
  const mutated = CANONICAL.replace('AP2Schema.validate(payload);', 'validatePayload(payload);');
  const before = classify(CANONICAL);
  const after = classify(mutated);
  assert(before.noSchema === false && after.noSchema === true, `noSchema should flip true: before=${before.noSchema} after=${after.noSchema}`);
  assert(after.noRow === before.noRow, 'unrelated class must not move from this mutation');
  assert(after.outsideRow === before.outsideRow, 'unrelated class must not move from this mutation');
});

// ── 8. findResultsExportRowSpans: nested divs inside the row do not break matching ─
test('MUTATION - a nested div inside the row is still bounded correctly (depth tracking)', () => {
  const html = `<div class="results-export-row"><div class="inner"><span>x</span></div><button id="ap2ExportBtn"></button></div>`;
  const spans = findResultsExportRowSpans(html);
  assert(spans.length === 1, `expected exactly 1 row span, got ${spans.length}`);
  const idx = html.indexOf('id="ap2ExportBtn"');
  assert(idx >= spans[0][0] && idx < spans[0][1], 'button index must fall inside the depth-matched span despite the nested inner div');
});

// ── 9. RED -> GREEN scanner cycle (SO #40b, the row's RAILS demonstration) ─
// A throwaway tools-dir copy, never the real repo tree.
const FIXROOT = mkdtempSync(join(tmpdir(), 'ap2-contract-selftest-'));
const scratchTools = join(FIXROOT, 'tools');
mkdirSync(scratchTools, { recursive: true });
const cleanup = () => { try { rmSync(FIXROOT, { recursive: true, force: true }); } catch { /* best effort */ } };
process.on('exit', cleanup);

test('RED -> GREEN - a bare unwired ap2ExportBtn is caught, then clears once removed', () => {
  const scratchFile = join(scratchTools, '999-scratch-tamper.html');
  writeFileSync(scratchFile, '<html><body><button id="ap2ExportBtn">Export</button></body></html>');
  const red = scanTools(scratchTools);
  const relKey = Object.keys(red).find((k) => k.endsWith('999-scratch-tamper.html'));
  assert(relKey, `scanTools must report the scratch fixture as a violation, got keys ${JSON.stringify(Object.keys(red))}`);
  assert(red[relKey].noRow && red[relKey].neverEnabled && red[relKey].noSchema, `bare button should hit noRow+neverEnabled+noSchema, got ${JSON.stringify(red[relKey])}`);
  unlinkSync(scratchFile);
  const green = scanTools(scratchTools);
  assert(Object.keys(green).length === 0, `after removing the fixture, scanTools must report clean, got ${JSON.stringify(Object.keys(green))}`);
});

console.log(`\ncheck-ap2-contract.test.mjs: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
