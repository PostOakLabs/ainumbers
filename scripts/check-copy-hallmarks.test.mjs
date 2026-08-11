// check-copy-hallmarks.test.mjs — BILAT-CSR-BUILD-SPEC.md §7 vocabulary ban
// (cosignVocabHits): scoped, zero-tolerance ban on accept/final/settled on
// pages that name counter_signed_receipt, and a no-op everywhere else.
// Run:  node scripts/check-copy-hallmarks.test.mjs
import { cosignVocabHits } from './check-copy-hallmarks.mjs';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// (scope) marker absent -> no-op, even with every banned word present. This is
// the "not a sitewide ban" guarantee: ordinary tool copy full of "Accept",
// "final", "settlement" must never trip this.
const noMarker = 'Click Accept to continue. This is the final step before settlement.';
ok(cosignVocabHits(noMarker).length === 0, '(scope) no counter_signed_receipt marker -> zero hits, even with all three words present');

// (bite) marker present + banned word -> flagged. This is the deliberate
// offending string required by BILAT-CSR-LINT-1's done-criteria: observe the
// addition FAILING before trusting it.
const offending = 'This page renders a counter_signed_receipt. The receipt confirms both parties have accepted the final settled result.';
const hits = cosignVocabHits(offending);
ok(hits.length === 3, `(bite) marker + accept/final/settled all flagged — got ${JSON.stringify(hits)}`);
ok(hits.some((h) => h.startsWith('accept/acceptance')), '(bite) "accepted" caught under accept/acceptance');
ok(hits.some((h) => h.startsWith('final/finality')), '(bite) "final" caught under final/finality');
ok(hits.some((h) => h.startsWith('settled')), '(bite) "settled" caught under settled');

// (clean) marker present, compliant vocabulary -> zero hits. Proves the ban
// doesn't over-fire on the page it's actually meant to protect once the copy
// uses the mandated phrasing instead of the banned one.
const compliant = 'This page renders a counter_signed_receipt: proof that both parties recomputed and signed the same result.';
ok(cosignVocabHits(compliant).length === 0, '(clean) marker present, no banned vocabulary -> zero hits');

// (removed) take the offending string, strip the banned words -> the gate the
// spec's done-criteria asks for: "write a deliberate offending string, watch
// the checker flag it, then remove it."
const removed = offending
  .replace(/\baccepted\b/gi, 'countersigned')
  .replace(/\bfinal\b/gi, 'recomputed')
  .replace(/\bsettled\b/gi, 'matching');
ok(cosignVocabHits(removed).length === 0, '(removed) banned words swapped out -> zero hits again');

if (fail) {
  console.error(`\ncheck-copy-hallmarks.test.mjs: ${fail} FAILURE(s)`);
  process.exit(1);
}
console.log('\ncheck-copy-hallmarks.test.mjs: all checks passed.');
