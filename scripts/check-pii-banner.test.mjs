#!/usr/bin/env node
// check-pii-banner.test.mjs — paired fixture proof for check-pii-banner.mjs
// (PIIBANNER-GATE-SWEEP-1 / SO #34 "verify a checker by mutation, not by reading it").
//
// Drives the exported hasCanonicalBanner() on in-memory HTML fixtures — never touches
// the real tools/ tree — proving the checker CAN go red (dropped clause, reworded
// sentence, entity-encoded dash, hyphen substitute, CSS/JS-only string), DOES go green
// on the sanctioned shape (including a tailored tail sentence, and the sentence wrapped
// across source lines), and stays green when the banner sits inside a live tool's real
// markup shape (span wrapper, extra prose after it).
//
// Usage: node scripts/check-pii-banner.test.mjs
// Exit 0 = every assertion passed. Exit 1 = a fixture assertion failed.

import { hasCanonicalBanner, CANONICAL_BANNER } from './check-pii-banner.mjs';

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log(`✗ ${msg}`); }
  else console.log(`✓ ${msg}`);
}

// ── RED: every drift shape the audit found trips the gate ────────────────
const droppedInstruction = `<div class="pii-notice">🔒 All inputs are processed locally in your browser. No data is transmitted.</div>`;
const droppedSynthetic = `<div class="pii-notice">🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data.</div>`;
const reworded = `<div class="pii-notice">🔒 Everything runs locally in your browser and nothing is sent anywhere. Use fake data only.</div>`;
const entityDash = `<div class="pii-notice">🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data &mdash; use synthetic or anonymised inputs only.</div>`;
const hyphenSubstitute = `<div class="pii-notice">🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data - use synthetic or anonymised inputs only.</div>`;
const cssOnlyClassName = `<style>.pii-notice{color:#fff}</style><script>document.querySelector('.pii-notice');</script><body>no banner text on this page at all</body>`;

assert(!hasCanonicalBanner(droppedInstruction), 'RED: dropping the do-not-enter clause trips the gate');
assert(!hasCanonicalBanner(droppedSynthetic), 'RED: dropping the synthetic-inputs clause trips the gate');
assert(!hasCanonicalBanner(reworded), 'RED: a reworded banner trips the gate');
assert(!hasCanonicalBanner(entityDash), 'RED: an entity-encoded em-dash (&mdash;) trips the gate — the mandate is the literal character');
assert(!hasCanonicalBanner(hyphenSubstitute), 'RED: a plain-hyphen substitute for the em-dash trips the gate');
assert(!hasCanonicalBanner(cssOnlyClassName), 'RED: the class name alone inside <style>/<script>, with no rendered text, trips the gate — the dead-check bug this gate replaces');
console.log('  [quotable] RED   — hasCanonicalBanner(droppedInstruction) => false (dropped clause is not the mandated sentence)');

// ── GREEN: the sanctioned shape, and the real tools/152 template shape, pass ──
const exact = `<div class="pii-notice">${CANONICAL_BANNER}</div>`;
const withTailoredTail = `<div class="pii-notice">${CANONICAL_BANNER} Also avoid entering counterparty or trade identifiers.</div>`;
const wrappedAcrossLines = `<div class="pii-notice">\n  🔒 All inputs are processed locally in your browser.\n  No data is transmitted. Do not enter real personal data — use synthetic\n  or anonymised inputs only.\n</div>`;
const realTemplateShape = `<div class="scope-note"><strong>Scope &amp; reliance —</strong> <span data-i18n="pii.banner">${CANONICAL_BANNER}</span> Embedded rates are static reference values that may age.</div>`;

assert(hasCanonicalBanner(exact), 'GREEN: the exact canonical sentence passes');
assert(hasCanonicalBanner(withTailoredTail), 'GREEN: the canonical sentence plus a tailored tail sentence passes (containment, not equality)');
assert(hasCanonicalBanner(wrappedAcrossLines), 'GREEN: the sentence line-wrapped across the HTML source passes (whitespace collapsed before comparison)');
assert(hasCanonicalBanner(realTemplateShape), 'GREEN: the real tools/152 template shape (span-wrapped, surrounding prose) passes');
console.log('  [quotable] GREEN — hasCanonicalBanner(exact) => true (byte-exact CONTRACT §1.3 sentence present)');

// ── MUTATION CONTROLS: boundary behavior is documented, not accidental ───
assert(!hasCanonicalBanner(CANONICAL_BANNER.slice(0, -1)), 'CONTROL: truncating even the final period trips the gate (byte-exact, not a prefix match)');
assert(hasCanonicalBanner(`prefix text ${CANONICAL_BANNER} suffix text`), 'CONTROL: arbitrary surrounding prose does not block a match (containment)');
assert(!hasCanonicalBanner(CANONICAL_BANNER.replace('synthetic', 'fake')), 'CONTROL: a single-word substitution trips the gate');

if (failures) {
  console.error(`\n✗ check-pii-banner.test.mjs: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\n✓ check-pii-banner.test.mjs: all fixture assertions passed (RED and GREEN both proven).');
