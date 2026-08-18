// check-copy-hallmarks.test.mjs — BILAT-CSR-BUILD-SPEC.md §7 vocabulary ban
// (cosignVocabHits): scoped, zero-tolerance ban on accept/final/settled on
// pages that name counter_signed_receipt, and a no-op everywhere else.
// Run:  node scripts/check-copy-hallmarks.test.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cosignVocabHits, insiderHits, aiVocabHits, notXCount, visibleText, panelHits } from './check-copy-hallmarks.mjs';

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

// --- PANEL (SCOPE-PANEL-COPY-AUDIT-1) ---
// Positive control on the real pre-rewrite string (before this WU's edit),
// via git show, so the test proves the detector fires on the actual page
// Tim flagged, not just a synthetic fixture.
{
  const oldHtml = gitShow('origin/main', 'chaingraph/agentcore-x402-hub.html');
  const newHtml = readFileSync(resolve(REPO, 'chaingraph/agentcore-x402-hub.html'), 'utf8');
  const oldHits = panelHits(oldHtml);
  const newHits = panelHits(newHtml);
  ok(oldHits.length > 0, `(pre-fix) origin/main:chaingraph/agentcore-x402-hub.html trips the PANEL detector — got ${JSON.stringify(oldHits)}`);
  ok(newHits.length === 0, `(post-fix) chaingraph/agentcore-x402-hub.html is clean of PANEL hits — got ${JSON.stringify(newHits)}`);
}

// Synthetic heading-plus-bullet-wall shape: labeled heading + >=2 negation
// bullets is exactly the tell CONTRACT §1.4's reasonable-reader rule bans.
const panelBox = '<h2>What this tool does not do</h2><ul><li>Does not custody funds.</li><li>Does not attest to settlement.</li></ul>';
ok(panelHits(panelBox).length === 1, `PANEL detector fires on a heading + 2-bullet negation wall — got ${JSON.stringify(panelHits(panelBox))}`);

// One inline limitation sentence, no heading/box — exactly what the rule
// permits (up to two per page) — must NOT trip the detector.
const inlineOnly = '<p>This tool computes a settlement finality class. It does not verify custody of the underlying funds.</p>';
ok(panelHits(inlineOnly).length === 0, `PANEL detector does not fire on a single inline limitation sentence with no heading/box — got ${JSON.stringify(panelHits(inlineOnly))}`);

// A bare "Scope" heading with positive, non-negation bullets must not fire
// (the ambiguous-label branch requires the bullets themselves to read as
// negations, not just any bullet under a "Scope" label).
const positiveScope = '<h2>Scope</h2><ul><li>Validates the mandate-chain signature.</li><li>Checks expiry ordering.</li></ul>';
ok(panelHits(positiveScope).length === 0, `PANEL detector does not fire on a "Scope" heading with positive (non-negation) bullets — got ${JSON.stringify(panelHits(positiveScope))}`);

if (fail) {
  console.error(`\ncheck-copy-hallmarks.test.mjs: ${fail} FAILURE(s)`);
  process.exit(1);
}
console.log('\ncheck-copy-hallmarks.test.mjs: all checks passed.');
