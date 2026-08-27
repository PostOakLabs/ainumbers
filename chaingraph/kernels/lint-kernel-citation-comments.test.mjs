// @ts-nocheck — plain CLI test utility, never meant to be type-checked (same exemption as the
// gate it tests — see that file's own top-of-file comment for why chaingraph/kernels/ needs this).
// chaingraph/kernels/lint-kernel-citation-comments.test.mjs — fixture proof for
// KERNEL-CITATION-CLASS-1, including the TOUCHTAX-DIFFSCOPE-1 line-scope shield (J19 §3.3).
//
// findCitations()/classifyHits() are pure — no filesystem, no git — so this proves the B4-shaped
// scenario (RULINGS 2026-08-27: the pre-existing, byte-identical `// 20 CFR 404.409-410` at
// art-282 L13) directly against fixture source text and a hand-built diff-scope. The REAL git
// integration (resolveDiffScopeRef + changedLineSet wired to an actual kernel file) is proven by
// scripts/diff-scope.test.mjs (the shared primitive both this gate and check-clause-digest.mjs
// build on) plus a live sandbox run recorded in the TOUCHTAX-DIFFSCOPE-1 check-off.
//
// Zero-dependency. Non-zero exit blocks.
//   node chaingraph/kernels/lint-kernel-citation-comments.test.mjs

import { findCitations, classifyHits } from './lint-kernel-citation-comments.mjs';

const out = [];
let fail = 0;
const log = (s) => { out.push(s); console.log(s); };
const err = (s) => { out.push(s); console.error(s); fail++; };
const ok = (cond, label) => (cond ? log(`✓ ${label}`) : err(`✗ ${label}`));

log('— findCitations: unchanged behaviour — comments only, never string literals —');
{
  const src = [
    "// Art. 15(3) mandatory buffer",
    "const flag = 'SFTR_ART15_CONSENT_MISSING';",
    "/* CFR reference block */",
  ].join('\n');
  const hits = findCitations(src);
  ok(hits.some((h) => h.token === 'Art. 15'), 'comment citation is found');
  ok(!hits.some((h) => h.token.includes('SFTR_ART15')), 'string-literal compliance_flags value is NEVER scanned');
  ok(hits.some((h) => h.name === 'CFR ref'), 'block-comment citation is found too');
}

log('— classifyHits: B4 shape — pinned/legacy pair, byte-identical legacy line stays shielded —');
{
  // Line 1: pre-existing citation (unchanged vs origin/main). Line 2: a NEW citation this diff
  // actually added. Mirrors the check-clause-digest.test.mjs B4 fixture one file over.
  const src = [
    '// 20 CFR 404.409-410 — legacy, untouched by this diff',
    '// Art. 999 — fabricated NEW citation this diff added',
  ].join('\n');
  const hits = findCitations(src);
  ok(hits.length === 2, 'both citation-shaped tokens are found by the raw scanner');

  // scope: only line 2 changed vs origin/main (the PAYROLL kill-proof shape).
  const scope = { ok: true, isNew: false, lines: new Set([2]) };
  const { blocking, shielded } = classifyHits(hits, scope);
  ok(blocking.length === 1 && blocking[0].line === 2, '(i) only the NEW line-2 citation is blocking');
  ok(shielded.length === 1 && shielded[0].line === 1, '(ii) the legacy line-1 citation is shielded — the PAYROLL kill-proof');
}

log('— classifyHits: fail CLOSED — undeterminable scope shields NOTHING (iii) —');
{
  const src = '// 20 CFR 404.409-410 — legacy, untouched by this diff\n';
  const hits = findCitations(src);
  const undeterminedScope = { ok: false, isNew: false, lines: new Set() };
  const { blocking, shielded } = classifyHits(hits, undeterminedScope);
  ok(blocking.length === 1, 'with an undeterminable scope, the previously-shielded legacy hit now BLOCKS');
  ok(shielded.length === 0, 'nothing is shielded when the comparison itself cannot be trusted');
}

log('— classifyHits: brand-new file (isNew:true) shields NOTHING — full scope, by design —');
{
  const src = '// Art. 1 — brand-new kernel, everything is "new" by construction\n';
  const hits = findCitations(src);
  const newFileScope = { ok: true, isNew: true, lines: new Set() };
  const { blocking, shielded } = classifyHits(hits, newFileScope);
  ok(blocking.length === 1, 'a brand-new kernel file scans every citation, unchanged from pre-row behaviour');
  ok(shielded.length === 0, 'zero shielded on a brand-new file');
}

log('— classifyHits: file untouched (empty changed-line set, not new) — everything shielded —');
{
  const src = '// 20 CFR 404.409-410\n// Art. 5\n';
  const hits = findCitations(src);
  const untouchedScope = { ok: true, isNew: false, lines: new Set() };
  const { blocking, shielded } = classifyHits(hits, untouchedScope);
  ok(blocking.length === 0, 'an untouched file (zero changed lines) blocks nothing — matches the old N-A fast path');
  ok(shielded.length === 2, 'both pre-existing hits report as shielded');
}

console.log(`\n${fail} failure(s) of ${out.filter((s) => s.startsWith('✓') || s.startsWith('✗')).length} assertion(s).`);
process.exit(fail ? 1 : 0);
