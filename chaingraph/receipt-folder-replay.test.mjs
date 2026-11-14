// receipt-folder-replay.test.mjs: gates for chaingraph/receipt-folder-replay.html, each with a red control.
//
//   node chaingraph/receipt-folder-replay.test.mjs           run every gate
//   node chaingraph/receipt-folder-replay.test.mjs --sync    rewrite the page's inlined library block from replay-lib.mjs
//
// Drift  the inlined library block in the page is the library, byte for byte after the documented transform.
// Corpus the inlined library reproduces the corpus result sets in modes A and C.
// R2     no egress: no network, worker, storage or form-post construct in the page, and the CSP is the standard profile.
// R5     an oversize selection is refused, before anything is read.
// R6     the Policy Mandate export validates against the section 3.1 checks; the PII banner is the exact sentence.
import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { hasCanonicalBanner, CANONICAL_BANNER } from '../scripts/check-pii-banner.mjs';
import { nodeKernelLoader } from './replay-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PAGE = resolve(HERE, 'receipt-folder-replay.html');
const LIB = resolve(HERE, 'replay-lib.mjs');
const VERDICT_SRC = resolve(ROOT, 'scripts', 'check-kernel-missing-input-failclosed.mjs');
const CSP_SRC = resolve(ROOT, 'scripts', 'check-csp-consistency.mjs');
const CORPUS = resolve(HERE, 'kernels', '__replay__', 'corpus');
const read = (p) => readFileSync(p, 'utf8');

const block = (text, name) => {
  const a = `/* BEGIN ${name} */`;
  const b = `/* END ${name} */`;
  const i = text.indexOf(a);
  const j = text.indexOf(b);
  if (i < 0 || j < i) throw new Error(`marker pair ${name} not found`);
  return { start: i + a.length, end: j, body: text.slice(i + a.length, j) };
};

/** The library as the page carries it: imports removed, node loader cut, export keywords dropped, verdict reader prepended. */
export function libBlockFromSource() {
  const v = read(VERDICT_SRC);
  const vs = v.indexOf('// Verdict-bearing keys');
  const ve = v.indexOf('\n}\n', v.indexOf('export function readVerdict')) + 3;
  const verdict = v.slice(vs, ve).replace(/^export /gm, '');
  let lib = read(LIB).replace(/^import .*\n/gm, '');
  lib = lib.slice(0, lib.indexOf('// ---- node-only loader')).replace(/^export /gm, '').trimEnd();
  return `\n// ---- verdict reader (scripts/check-kernel-missing-input-failclosed.mjs) ----\n${verdict}\n// ---- replay-lib.mjs ----\n${lib}\n`;
}

if (process.argv.includes('--sync')) {
  const page = read(PAGE);
  const b = block(page, 'replay-lib');
  writeFileSync(PAGE, page.slice(0, b.start) + libBlockFromSource() + page.slice(b.end));
  console.log('receipt-folder-replay: library block rewritten from replay-lib.mjs');
  process.exit(0);
}

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };
let controls = 0;
/** A red control: the gate function must report a problem for the planted input. */
const red = (name, problems) => { controls++; if (problems.length === 0) failures.push(`RED CONTROL FAILED (${name}): the planted fault was not detected`); };

// ---- load the page's own code under node ------------------------------------------------
const pageHtml = read(PAGE);
const HASH_URL = pathToFileURL(resolve(HERE, 'kernels', '_hash.mjs')).href;
async function loadPageModule(libText, helpersText, tag) {
  const dir = mkdtempSync(join(tmpdir(), 'rfr-'));
  const f = join(dir, `${tag}.mjs`);
  writeFileSync(f, `import { executionHash, jcsStringify } from '${HASH_URL}';\n${libText}\n${helpersText}\nexport { replayFile, replayReceipt, parseReceipt, summarize, checkCaps, toCsv, csvCell, buildMandate, AP2Schema, leafPointers, MAX_FILES, MAX_BYTES };\n`);
  return import(pathToFileURL(f).href);
}
const pageLib = block(pageHtml, 'replay-lib').body;
const pageHelpers = block(pageHtml, 'replay-helpers').body;

// ---- drift ------------------------------------------------------------------------------
const wantLib = libBlockFromSource();
check(pageLib === wantLib, 'DRIFT: the library block in the page differs from replay-lib.mjs; run: node chaingraph/receipt-folder-replay.test.mjs --sync');
red('drift', pageLib + 'x' === wantLib ? [] : ['drift detected']);

const M = await loadPageModule(pageLib, pageHelpers, 'page');

// ---- corpus, modes A and C --------------------------------------------------------------
const exp = JSON.parse(read(join(CORPUS, 'expected.json')));
const load = nodeKernelLoader(resolve(HERE, 'kernels'));
const files = readdirSync(CORPUS).filter((f) => f.endsWith('.receipt.json')).sort();
const rows = [];
for (const f of files) {
  const rec = JSON.parse(read(join(CORPUS, f)));
  const a = await M.replayFile(f, rec, { mode: 'A', loadKernel: load });
  const c = await M.replayFile(f, rec, { mode: 'C', loadKernel: load, edits: exp.modeC.edits[rec.tool_id] });
  check(a.state === exp.modeA[f].state && JSON.stringify(a.pointers) === JSON.stringify(exp.modeA[f].pointers), `corpus mode A ${f}: got ${a.state}, expected ${exp.modeA[f].state}`);
  check(c.state === exp.modeC.results[f].state && JSON.stringify(c.pointers) === JSON.stringify(exp.modeC.results[f].pointers), `corpus mode C ${f}: got ${c.state}, expected ${exp.modeC.results[f].state}`);
  rows.push(a);
}
check(files.length === 20, `corpus has ${files.length} receipts, expected 20`);

// ---- R2: no egress ----------------------------------------------------------------------
const EGRESS = [
  [/\bfetch\s*\(/, 'fetch('], [/\bXMLHttpRequest\b/, 'XMLHttpRequest'], [/new\s+WebSocket\s*\(/, 'WebSocket'], [/\bEventSource\s*\(/, 'EventSource'],
  [/sendBeacon/, 'sendBeacon'], [/\bnew\s+(Shared)?Worker\s*\(/, 'Worker'], [/serviceWorker/, 'serviceWorker'], [/importScripts\s*\(/, 'importScripts'],
  [/\bimport\s*\(\s*['"`]https?:/, "import('http"], [/\blocalStorage\b/, 'localStorage'], [/\bsessionStorage\b/, 'sessionStorage'], [/\bindexedDB\b/, 'indexedDB'],
  [/document\s*\.\s*cookie/, 'document.cookie'], [/\bcaches\s*\.\s*(open|match)/, 'Cache API'], [/<form\b/i, '<form'], [/\bnew\s+Image\s*\(/, 'new Image('],
];
const egressProblems = (html) => EGRESS.filter(([re]) => re.test(html)).map(([, n]) => n);
const cspOf = (html) => (html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]*)"/) || [])[1] || '';
const cspStd = (read(CSP_SRC).match(/CSP_STANDARD:\s*`([^`]*)`/) || [])[1];
const cspProblems = (html) => (cspStd && cspOf(html).trim() === cspStd.trim() ? [] : ['CSP is not the standard profile']);

check(egressProblems(pageHtml).length === 0, 'R2: egress construct in page: ' + egressProblems(pageHtml).join(', '));
check(cspStd && cspProblems(pageHtml).length === 0, 'R2: page CSP differs from CSP_STANDARD in check-csp-consistency.mjs');
red('R2 fetch', egressProblems(pageHtml + "\nfetch('https://example.invalid/x')"));
red('R2 storage', egressProblems(pageHtml + '\nlocalStorage.setItem("a","b")'));
red('R2 worker', egressProblems(pageHtml + '\nnew Worker("w.js")'));
red('R2 csp', cspProblems(pageHtml.replace("connect-src 'none'", 'connect-src *')));

// ---- R5: caps ---------------------------------------------------------------------------
const many = (n, size) => Array.from({ length: n }, (_, i) => ({ name: `r${i}.json`, size }));
check(M.checkCaps(many(2001, 10)).ok === false, 'R5: 2001 files were not refused');
check(/2,000 files/.test(M.checkCaps(many(2001, 10)).reason || ''), 'R5: the file-count refusal does not state the limit');
check(M.checkCaps(many(3, 8 * 1048576)).ok === false, 'R5: 24 MB was not refused');
check(/20 MB/.test(M.checkCaps(many(3, 8 * 1048576)).reason || ''), 'R5: the size refusal does not state the limit');
check(M.checkCaps(many(2000, 10)).ok === true, 'R5: exactly 2000 small files were refused');
check(M.checkCaps(many(1, 20 * 1048576)).ok === true, 'R5: exactly 20 MB was refused');
const loose = await loadPageModule(pageLib, pageHelpers.replace('MAX_FILES = 2000', 'MAX_FILES = 1e9').replace('20 * 1024 * 1024', '1e12'), 'loose');
red('R5 caps removed', loose.checkCaps(many(2001, 10)).ok === true ? ['oversize set accepted'] : []);

// ---- R6: export contract ----------------------------------------------------------------
const mandate = M.buildMandate({ mode: 'A', edits: [], rows, date: '2026-11-14', buildDigest: 'a'.repeat(64) }, '2026-11-14T00:00:00.000Z');
let valid = true;
try { M.AP2Schema.validate(mandate); } catch (e) { valid = false; failures.push('R6: the change record fails AP2Schema.validate: ' + e.message); }
check(valid, 'R6: change record invalid');
check(mandate.payload.totals.total === 20, 'R6: the change record totals do not cover the 20 corpus receipts');
const throws = (fn) => { try { fn(); return []; } catch (e) { return [e.message]; } };
red('R6 bad uuid', throws(() => M.AP2Schema.validate({ ...mandate, mandate_id: 'not-a-uuid' })));
red('R6 no type', throws(() => M.AP2Schema.validate({ ...mandate, mandate_type: '' })));
check(/id="ap2ExportBtn"/.test(pageHtml), 'R6: the page has no id="ap2ExportBtn"');
const rowStart = pageHtml.indexOf('class="results-export-row"');
const btnAt = pageHtml.indexOf('id="ap2ExportBtn"');
check(rowStart > 0 && btnAt > rowStart && btnAt < rowStart + 600, 'R6: ap2ExportBtn is not inside .results-export-row');
check(/AP2Schema\.validate\(mandate\)[\s\S]{0,200}download\(/.test(pageHtml), 'R6: the export does not validate before the download');
check(hasCanonicalBanner(pageHtml), 'R6: the exact PII banner sentence is missing');
check(pageHtml.includes(CANONICAL_BANNER), 'R6: the PII banner is not byte-exact');
red('R6 banner', hasCanonicalBanner(pageHtml.replace('No data is transmitted.', 'Data stays local.')) ? [] : ['banner missing']);
check(M.csvCell('=cmd|x') === "'=cmd|x", 'R6: a leading = is not neutralised in CSV');
check(M.csvCell('a,"b"') === '"a,""b"""', 'R6: CSV quoting is wrong');
check(M.toCsv(rows).split('\r\n').length === 22, 'R6: the CSV does not hold a header plus 20 rows');

// ---- wording and storage-free copy ------------------------------------------------------
const visible = pageHtml.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
check(!/—/.test(visible.replace(CANONICAL_BANNER, '')), 'copy: an em-dash outside the banner');
check(!/(was|were) (wrong|incorrect|in error)|old receipt (is|was) wrong/i.test(visible), 'copy: the page says an old receipt was wrong');
check(/differs under the stated condition/.test(visible), 'copy: the page does not state that a result differs under the stated condition');

if (failures.length) {
  console.error('receipt-folder-replay: FAIL');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`receipt-folder-replay: OK (drift, corpus A and C over ${files.length} receipts, R2, R5, R6, copy; ${controls} red controls fired)`);
