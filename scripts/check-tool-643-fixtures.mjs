#!/usr/bin/env node
/**
 * check-tool-643-fixtures.mjs — artifact gate for the T643 converter row
 * (CONVERT-PDF-DOC-MD-2, 2026-09-22 QC pass; anchor:
 * research/T643-CONVERT-FIX-QC-2026-09-22/EVIDENCE.md).
 *
 * PROSE-ONLY BY DESIGN (SO #26 instrument class): golden GENERATION requires
 * real-browser execution of the page's own workerless pipeline, which would
 * be new headless-browser CI tooling (SO #8, Tim-only). This script gates the
 * ARTIFACTS; the browser generates them; both are quoted at check-off:
 *
 *   node scripts/check-tool-643-fixtures.mjs
 *       Structural assertions over the embedded golden outputs (captured from
 *       the real page pipeline: setFile -> convertPdf -> lastResult.md, run 3,
 *       2026-09-22) + byte-determinism of the embedded goldens against their
 *       recorded SHA-256.
 *   node scripts/check-tool-643-fixtures.mjs --verify <fixture> <file>
 *       Byte-compare a freshly browser-regenerated .md against the embedded
 *       golden. Fixtures: text-basic, report, scanned, table-multicol, uniform2.
 *   node scripts/check-tool-643-fixtures.mjs --arxiv <md-file>
 *       Acceptance assertions over a LOCALLY GENERATED conversion of the real
 *       arXiv 2504.15717v2 paper (the 1.3MB PDF never enters the repo; it
 *       lives in the anchor dir). Asserts: references extract in reading
 *       order [1]->[39], no reference-section line carries >=2 entry-start
 *       markers (the measured two-column braiding defect), "terminology" is
 *       rejoined (the hyphen defect), no math-glyph garbage heading, exactly
 *       one H1 (the title).
 *
 * Structural-unchanged note: single-column fixture BLOCK structure is the
 * same as the pre-row engine (counts hard-coded below from the anchor
 * outputs). uniform2 additionally carries an inline right-boundary notice
 * since this row: the fixture's own source line runs past the MediaBox edge,
 * which the old engine clipped silently ("services to be prov"); the row's
 * defect-5 fix reports it. table-multicol INTENTIONALLY changed: the
 * headerless side-by-side prose is no longer wrapped as a fake table.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const GOLDENS = {
  "text-basic": "<!-- Converted by AINumbers.co PDF to DOCX/Markdown Converter (T643) · pdf.js 6.1.200 (pinned, workerless) · text-layer extraction only; column-aware reading order, tables are best-effort; scanned pages and right-boundary truncation are reported inline -->\n\n# Quarterly Operations Review\n\nPrepared by the operations team for internal circulation.\n\n## Background\n\nThis document reviews the operational posture of the platform during the most recent quarter. It covers capacity, incident load and the remediation work that followed the two severity one outages.\n\n## Key Actions\n\n- Provision additional cache nodes in the primary region before the next release window.\n- Retire the legacy batch exporter and move all consumers to the streaming pipeline.\n- Publish the revised on-call rotation and confirm coverage for the holiday period.\n\n## Numbers\n\nIncident volume fell from fourteen to nine across the quarter. Median time to acknowledge improved by six minutes after the paging migration completed in the second month.\n",
  "report": "<!-- Converted by AINumbers.co PDF to DOCX/Markdown Converter (T643) · pdf.js 6.1.200 (pinned, workerless) · text-layer extraction only; column-aware reading order, tables are best-effort; scanned pages and right-boundary truncation are reported inline -->\n\n# Annual Control Attestation\n\n## 1. Scope and Methodology\n\nThe attestation covers the twenty six in-scope controls listed in appendix A. Evidence was collected over a six week window and each control was tested against the stated operating criteria using a combination of inquiry, inspection and reperformance.\n\n## 2. Summary of Results\n\nTwenty three controls operated effectively throughout the period. Three controls are reported as exceptions and are described in section three together with management responses and target remediation dates agreed with the process owners.\n\n## 3. Exceptions and Management Responses\n\nControl AC twelve did not consistently enforce the quarterly review requirement. Management has completed a retrospective review of all access grants and moved the review into the automated joiner mover leaver workflow with effect from the first day of the next quarter.\n\n## 4. Conclusion\n\nExcept for the matters described in section three the controls operated effectively. The team will retest the three exceptions in the next cycle and report the outcome to the audit committee.\n",
  "scanned": "<!-- Converted by AINumbers.co PDF to DOCX/Markdown Converter (T643) · pdf.js 6.1.200 (pinned, workerless) · text-layer extraction only; column-aware reading order, tables are best-effort; scanned pages and right-boundary truncation are reported inline -->\n\n> ⚠ Page 1: no text layer detected (scanned/image page). OCR is out of scope; page skipped.\n\nSecond page has a text layer. This line should be extracted.\n",
  "table-multicol": "<!-- Converted by AINumbers.co PDF to DOCX/Markdown Converter (T643) · pdf.js 6.1.200 (pinned, workerless) · text-layer extraction only; column-aware reading order, tables are best-effort; scanned pages and right-boundary truncation are reported inline -->\n\n# Service Catalog Extract\n\n| Service | Tier | Owner | SLA |\n| --- | --- | --- | --- |\n| checkout-api | 0 | payments | 99.95% |\n| search-indexer | 1 | discovery | 99.9% |\n| profile-store | 2 | identity | 99.5% |\n| webhook-relay | 1 | integrations | 99.9% |\n\n## Regional Notes\n\nThe eastern region completed its storage migration ahead of plan. Replication lag stayed under the alerting threshold for the whole window and no customer impact was recorded.\n\nThe western region deferred its maintenance until the next cycle. Capacity headroom remains adequate and the deferred work is tracked in the standard change queue.\n",
  "uniform2": "<!-- Converted by AINumbers.co PDF to DOCX/Markdown Converter (T643) · pdf.js 6.1.200 (pinned, workerless) · text-layer extraction only; column-aware reading order, tables are best-effort; scanned pages and right-boundary truncation are reported inline -->\n\nEngagement Letter Summary\n\nThis letter confirms the scope of the engagement agreed between the parties. It sets out the services to be prov\n\nServices The provider will deliver monthly reconciliations, quarterly reporting packs and ad hoc analysis requested by the\n\nFees Fees are invoiced monthly in arrears at the fixed rate stated in the fee schedule. Expenses are billed at cost with\n\n> ⚠ Page 1: text runs reach the page's right boundary and can be cut off mid-word by the PDF text layer (a pdf.js extraction behavior). Affected lines may be missing characters; verify against the source PDF.\n"
};

const GOLDEN_SHA = {
  "text-basic": "23c840ba7803c2c5b2a9cc3ecd088d717c99d8605c2ba9ba87970b8f0520f0e4",
  "report": "1a317b444d6a5a64bb7aaf9704c7e0736df17bc293d8c8b290c354dd79b3b9f9",
  "scanned": "5718502c7864c413b340245e54d628d3af7c2dc5c5d10e471c5615889b7922a0",
  "table-multicol": "34be6443acb7dbde21c6dbe8fc7ed42e3b8a3b9b9428e61c5a5c4be1d46c1c51",
  "uniform2": "b99de488ef778884a6a954571e50fca48593a9c20283b6ef778496f37b729c06"
};

let failures = 0;
const fail = (msg) => { failures++; console.log('FAIL ' + msg); };
const pass = (msg) => console.log('ok   ' + msg);

function sha256(s) { return createHash('sha256').update(s, 'utf8').digest('hex'); }

function blockStats(md) {
  const lines = md.split('\n');
  const headings = lines.filter(l => /^#{1,6} /.test(l));
  return {
    h1: headings.filter(l => /^# /.test(l)).length,
    headings: headings.length,
    headingTexts: headings.map(h => h.replace(/^#+ /, '')),
    paragraphs: lines.filter(l => l.trim() && !l.startsWith('<!--') && !/^#{1,6} /.test(l) && !l.startsWith('|') && !l.startsWith('>') && !/^(- |\d+\. )/.test(l)).length,
    listItems: lines.filter(l => /^(- |\d+\. )/.test(l)).length,
    listBlocks: (() => { let n = 0, prev = false; for (const l of lines) { const is = /^(- |\d+\. )/.test(l); if (is && !prev) n++; prev = is; } return n; })(),
    tableLines: lines.filter(l => l.startsWith('|')).length,
    notices: lines.filter(l => l.startsWith('> ⚠')).length,
  };
}

// Expected block structure of the single-column fixtures, measured on the
// PRE-row engine outputs (anchor dir outputs/*.md) — the row must not change it.
const EXPECTED = {
  'text-basic': { headings: 4, paragraphs: 3, listBlocks: 1, listItems: 3, tables: 0, notices: 0 },
  'report': { headings: 5, paragraphs: 4, listBlocks: 0, listItems: 0, tables: 0, notices: 0 },
  'scanned': { headings: 0, paragraphs: 1, listBlocks: 0, listItems: 0, tables: 0, notices: 1 },
  'uniform2': { headings: 0, paragraphs: 4, listBlocks: 0, listItems: 0, tables: 0, notices: 1 }, // notice = defect-5 fix, see header
};

function checkEmbedded(name, md) {
  const s = blockStats(md);
  const exp = EXPECTED[name];
  if (exp) {
    for (const k of ['headings', 'paragraphs', 'listBlocks', 'listItems', 'notices']) {
      if (s[k] !== exp[k]) fail(`${name}: ${k} = ${s[k]}, expected ${exp[k]} (structurally unchanged vs anchor)`);
      else pass(`${name}: ${k} = ${exp[k]}`);
    }
    if (s.tableLines !== 0) fail(`${name}: unexpected pipe-table content`);
  }
  if (sha256(md) !== GOLDEN_SHA[name]) fail(`${name}: embedded golden drifted from recorded SHA-256 (byte-determinism guard)`);
  else pass(`${name}: golden sha256 ${GOLDEN_SHA[name].slice(0, 16)}… verified`);
}

// ---- embedded golden structural assertions --------------------------------
for (const [name, md] of Object.entries(GOLDENS)) {
  checkEmbedded(name, md);
}

// table-multicol: the row's two-direction gate — table intact AND prose
// sequential (not a fake table), from EVIDENCE.md defect 3.
{
  const md = GOLDENS['table-multicol'];
  const lines = md.split('\n');
  const tableRows = lines.filter(l => l.startsWith('|'));
  if (tableRows.length !== 6) fail(`table-multicol: expected 6 pipe lines (header + separator + 4 data rows), got ${tableRows.length}`);
  else pass('table-multicol: pipe table intact (header + separator + 4 data rows)');
  if (!tableRows.some(l => l.includes('Service') && l.includes('Tier') && l.includes('Owner') && l.includes('SLA'))) fail('table-multicol: header row missing');
  if (!tableRows.some(l => l.includes('checkout-api'))) fail('table-multicol: data rows missing');
  const proseAsTable = tableRows.filter(l => /eastern|western|Replication|headroom/i.test(l));
  if (proseAsTable.length) fail(`table-multicol: side-by-side prose wrapped as fake table (${proseAsTable.length} rows)`);
  else pass('table-multicol: prose NOT wrapped as a fake table');
  const eIdx = md.indexOf('The eastern region completed its storage migration');
  const wIdx = md.indexOf('The western region deferred its maintenance');
  if (eIdx === -1 || wIdx === -1) fail('table-multicol: prose paragraphs missing or not merged sequentially');
  else if (wIdx < eIdx) fail('table-multicol: prose out of reading order');
  else pass('table-multicol: prose sequential (eastern before western), paragraphs merged');
}

// meta receipt line describes the column-aware algorithm
{
  const meta = GOLDENS['text-basic'].split('\n')[0];
  if (!/column-aware reading order/.test(meta)) fail('receipt meta-line does not describe column-aware reading order');
  else pass('receipt meta-line describes column-aware reading order');
}

// ---- CLI modes -------------------------------------------------------------
const argv = process.argv.slice(2);
if (argv.includes('--verify')) {
  const i = argv.indexOf('--verify');
  const name = argv[i + 1], file = argv[i + 2];
  if (!name || !file || !GOLDENS[name]) {
    console.log('usage: --verify <fixture> <file>  (fixture: ' + Object.keys(GOLDENS).join(', ') + ')');
    process.exit(2);
  }
  const fresh = readFileSync(file, 'utf8');
  if (fresh === GOLDENS[name]) pass(`--verify ${name}: regenerated output byte-identical to embedded golden`);
  else fail(`--verify ${name}: regenerated output differs from embedded golden (sha ${sha256(fresh).slice(0, 16)}… vs ${GOLDEN_SHA[name].slice(0, 16)}…)`);
}
if (argv.includes('--arxiv')) {
  const i = argv.indexOf('--arxiv');
  const file = argv[i + 1];
  if (!file) { console.log('usage: --arxiv <md-file>'); process.exit(2); }
  const md = readFileSync(file, 'utf8');
  const lines = md.split('\n');
  const headings = lines.filter(l => /^#{1,6} /.test(l));

  const refIdx = lines.findIndex(l => /^#{1,6} REFERENCES\s*$/.test(l));
  if (refIdx === -1) fail('arxiv: REFERENCES heading missing (fused or demoted)');
  else pass('arxiv: REFERENCES is its own heading');

  const entryStart = /\[\d+\]\s+[A-Z“”"*]/g;
  let braided = 0, worst = null;
  for (const l of lines.slice(refIdx + 1)) {
    const m = l.match(entryStart);
    if (m && m.length >= 2) { braided++; if (!worst) worst = l.slice(0, 120); }
  }
  if (braided) fail(`arxiv: ${braided} reference-section line(s) carry >=2 entry-start markers (two-column braiding), e.g.: ${worst}`);
  else pass('arxiv: no reference-section line carries >=2 entry-start markers');

  const entries = lines.map(l => (l.match(/^\[(\d+)\]/) || [])[1]).filter(Boolean).map(Number);
  if (entries.length !== 39) fail(`arxiv: expected 39 reference entries, got ${entries.length}`);
  else pass('arxiv: 39 reference entries');
  let seq = entries.length > 0 && entries[0] === 1;
  for (let k = 1; k < entries.length; k++) if (entries[k] !== entries[k - 1] + 1) seq = false;
  if (!seq) fail('arxiv: references NOT in strict reading order [1]->[39]');
  else pass('arxiv: references in strict reading order [1]->[39]');

  if (/terminol-\s*o/.test(md)) fail('arxiv: hyphenated line-end still split ("terminol- ogy")');
  else if (!/terminology/.test(md)) fail('arxiv: "terminology" not found');
  else pass('arxiv: "terminology" rejoined across the line break');

  const garbage = headings.filter(h => /[{<>|}]/.test(h) || /EIn \}/.test(h));
  if (garbage.length) fail(`arxiv: math-glyph garbage promoted to heading: ${garbage[0].slice(0, 80)}`);
  else pass('arxiv: no math-glyph garbage heading');

  const h1 = headings.filter(h => /^# /.test(h));
  if (h1.length !== 1) fail(`arxiv: expected exactly 1 H1 (merged title), got ${h1.length}`);
  else pass('arxiv: exactly one H1 (title merged, not split)');
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall fixture-gate assertions green');
process.exit(failures ? 1 : 0);
