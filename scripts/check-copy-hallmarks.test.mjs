// check-copy-hallmarks.test.mjs — BILAT-CSR-BUILD-SPEC.md §7 vocabulary ban
// (cosignVocabHits): scoped, zero-tolerance ban on accept/final/settled on
// pages that name counter_signed_receipt, and a no-op everywhere else.
// Run:  node scripts/check-copy-hallmarks.test.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cosignVocabHits, insiderHits, aiVocabHits, notXCount, visibleText } from './check-copy-hallmarks.mjs';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// --- COPY-HALLMARK-METRICS-1 positive control ---
// H1 (,-not density) + H5 (insider-register): pre-fix daf5774b methods.html/
// fv-explainer.html (the "very difficult to read... hallmarks of AI" pages
// Tim flagged 2026-08-14) must trip the new detectors; the post-COPY-HUMANIZE-1
// (PR #1254) versions on disk must score materially lower. Tests the detector
// functions directly, not the baseline-shielded gate — the gate's baseline is
// seeded from CURRENT content by design (same ratchet mechanic as em-dash/
// jargon/bold), so it always passes right after --update; the real control is
// here, on the actual old-vs-new prose.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function h1PlusH5(text) {
  const insider = insiderHits(text).length;
  const notX = notXCount(text);
  return { insider, notX, total: insider + notX };
}
function gitShow(rev, path) {
  return execFileSync('git', ['show', `${rev}:${path}`], { cwd: REPO, encoding: 'utf8' });
}

for (const page of ['methods.html', 'fv-explainer.html']) {
  const oldHtml = gitShow('daf5774b', page);
  const newHtml = readFileSync(resolve(REPO, page), 'utf8');
  const oldScore = h1PlusH5(visibleText(oldHtml));
  const newScore = h1PlusH5(visibleText(newHtml));
  ok(oldScore.total > 0, `(pre-fix) daf5774b:${page} trips H1/H5 detectors — got ${JSON.stringify(oldScore)}`);
  ok(newScore.total < oldScore.total, `(post-fix) ${page} scores materially lower than daf5774b — old ${oldScore.total}, new ${newScore.total}`);
  ok(newScore.notX <= 3, `(post-fix) ${page} ",-not X" count within the DEFAULT_NOTX_CAP (3) — got ${newScore.notX}`);
}

// AI-vocabulary (Wikipedia signs-of-AI-writing list): sanity check the
// detector fires on a deliberately AI-flavored sentence and not on ordinary
// domain prose from a live page.
const aiFlavored = 'This pivotal feature will delve into and showcase how we foster a robust tapestry of trust, a myriad of options in the realm of finance.';
ok(aiVocabHits(aiFlavored).length >= 4, `AI-vocab detector fires on a deliberately AI-flavored sentence — got ${JSON.stringify(aiVocabHits(aiFlavored))}`);
ok(aiVocabHits('This tool computes the leverage ratio with robust error handling.').length === 0, 'AI-vocab detector does not fire on ordinary finance/eng prose ("leverage ratio", "robust error handling")');

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
