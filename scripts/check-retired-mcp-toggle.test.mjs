#!/usr/bin/env node
// check-retired-mcp-toggle.test.mjs — paired fixture proof for
// check-retired-mcp-toggle.mjs (GATE-SELFTEST-META-1 / SO #34 mutation discipline).
//
// Drives the exported lineHits() on in-memory fixtures — never touches the real
// tools/ tree — proving the checker CAN go red (a retired token trips it), DOES go
// green on the sanctioned replacement shape, and behaves correctly on adjacent
// strings (mutation controls).
//
// Usage: node scripts/check-retired-mcp-toggle.test.mjs
// Exit 0 = every assertion passed. Exit 1 = a fixture assertion failed.

import { lineHits, RETIRED_PATTERNS } from './check-retired-mcp-toggle.mjs';

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log(`✗ ${msg}`); }
  else console.log(`✓ ${msg}`);
}

// ── RED: each retired §1.2 token trips the gate ──────────────────────────
const redHandler = `function toggleMcp(){var p=document.getElementById('mcp-panel');p.style.display=p.style.display==='block'?'none':'block';}`;
const redCss = `#mcp-panel{display:none;background:#0a1220;border:1px solid var(--border);white-space:pre}`;
const redToggleClass = `.mcp-toggle{width:100%;cursor:pointer}`;

assert(lineHits(redHandler), 'RED: the retired toggleMcp() handler trips the gate');
assert(lineHits(redCss), 'RED: the retired #mcp-panel CSS trips the gate');
assert(lineHits(redToggleClass), 'RED: the retired .mcp-toggle class trips the gate');
assert(lineHits('onclick="toggleMCP()"'), 'RED: the uppercase toggleMCP spelling trips the gate (case-insensitive)');
console.log('  [quotable] RED   — lineHits(redHandler) => true (toggleMcp + mcp-panel are both retired tokens)');

// ── GREEN: the sanctioned §1.2 replacement shape passes ──────────────────
const greenHandler = `function toggleMfst(){var b=document.getElementById('mfstBody');b.hidden=!b.hidden;}`;
const greenCss = `.mfst-btn{width:100%;display:flex;justify-content:space-between;cursor:pointer}`;
const greenIds = `const code=document.getElementById('mfstCode');code.textContent=JSON.stringify(MANIFEST,null,2);`;

assert(!lineHits(greenHandler), 'GREEN: the sanctioned toggleMfst() handler passes');
assert(!lineHits(greenCss), 'GREEN: the sanctioned .mfst-btn CSS passes');
assert(!lineHits(greenIds), 'GREEN: the sanctioned #mfstBody / #mfstCode ids pass');
console.log('  [quotable] GREEN — lineHits(toggleMfst handler) => false (the one sanctioned manifest disclosure)');

// ── MUTATION CONTROLS: boundary behavior is documented, not accidental ───
assert(lineHits(`.mcp-panel-section{padding:.7rem}`), 'CONTROL: the workbench-only mcp-panel-section class WOULD trip the pattern — this is why the gate scopes to tools/ only (§1.2 binds tools)');
assert(!lineHits('the manifest panel lists every tool id'), 'CONTROL: prose mentioning manifest panels passes');
assert(!lineHits('toggleMfstPanel(this)'), 'CONTROL: the sanctioned toggleMfst* family passes');
assert(RETIRED_PATTERNS.length === 3, 'CONTROL: the retired-token set is exactly the three §1.2 spellings (toggleMCP ci, mcp-toggle, mcp-panel)');

if (failures) {
  console.error(`\n✗ check-retired-mcp-toggle.test.mjs: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\n✓ check-retired-mcp-toggle.test.mjs: all fixture assertions passed (RED and GREEN both proven).');
