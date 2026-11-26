#!/usr/bin/env node
/**
 * scripts/check-page-kernel-parity.selftest.mjs: paired controls for
 * scripts/check-page-kernel-parity.mjs (GATE-SELFTEST-META-1).
 *
 * Builds SYNTHETIC kernels and pages in a temp dir (never the real estate) and runs the
 * checker against them with --root:
 *   (a) page disagrees with its kernel on one vector            -> MISMATCH naming that vector
 *   (b) agreeing page                                           -> MATCH
 *   (c) DOM-only page (logic inlined in a no-argument handler)  -> UNEXTRACTABLE, never MISMATCH
 *   (d) page differs only in compliance_flags (container / key) -> FLAGS-ONLY
 *   (e) page needing atob and a top-level table-init loop       -> MATCH under whole-block evaluation
 *   (f) whole-block and closure shapes disagree                 -> HARNESS-SUSPECT
 *   (g) page returns a bare payload, kernel returns the envelope-> MATCH
 *   (h) page throws on a vector the kernel answers              -> MISMATCH
 *   (i) --write-baseline records only MISMATCH pairs; stage 1 ignores a baseline already on disk
 * RED first: the same controls run against a deliberately broken copy of the checker (it
 * never reports a mismatch) and must be detected as broken. Then GREEN: the real checker
 * must satisfy every control.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL = resolve(HERE, 'check-page-kernel-parity.mjs');

const tmp = mkdtempSync(join(tmpdir(), 'page-parity-selftest-'));
const cdir = join(tmp, 'chaingraph');
const kdir = join(cdir, 'kernels');
const fdir = join(kdir, 'fixtures');
for (const d of [kdir, fdir]) mkdirSync(d, { recursive: true });

const VECTORS = [
  { name: 'v_low', policy_parameters: { a: 1, b: 2 }, output_payload: { sum: 3, label: 'LOW', extra: 1 } },
  { name: 'v_high', policy_parameters: { a: 10, b: 20 }, output_payload: { sum: 30, label: 'HIGH', extra: 1 } },
];
const kernelBody = (flagsExpr) => `export function compute(p) {
  const sum = p.a + p.b;
  return { output_payload: { sum, label: sum > 10 ? 'HIGH' : 'LOW', extra: 1 }${flagsExpr ? `, compliance_flags: ${flagsExpr}` : ''} };
}\n`;
const page = (scriptBody) => `<!doctype html><html><body><div id="x"></div><script id="manifest" type="application/json">{"a":1}</script><script>\n${scriptBody}\n</script></body></html>\n`;

function plant(id, { kernelSrc = kernelBody(''), html, vectors = VECTORS }) {
  writeFileSync(join(kdir, `${id}.kernel.mjs`), kernelSrc);
  writeFileSync(join(fdir, `${id}.fixtures.json`), JSON.stringify({ tool_id: id, vectors }));
  if (html !== null) writeFileSync(join(cdir, `${id}.html`), html);
}

plant('syn-a-mismatch', { html: page(`function compute(p) { const sum = p.a + p.b; return { sum, label: sum > 2 ? 'HIGH' : 'LOW', extra: 1 }; }`) });
plant('syn-b-match', { html: page(`function compute(p) { const sum = p.a + p.b; return { sum, label: sum > 10 ? 'HIGH' : 'LOW', extra: 1 }; }`) });
plant('syn-c-domonly', { html: page(`function runCompute() { const a = Number(document.getElementById('a').value); document.getElementById('x').textContent = String(a); }\ndocument.getElementById('go').addEventListener('click', runCompute);`) });
plant('syn-d-flags-container', {
  kernelSrc: kernelBody('[]'),
  html: page(`function compute(p) { const sum = p.a + p.b; return { output_payload: { sum, label: sum > 10 ? 'HIGH' : 'LOW', extra: 1 }, compliance_flags: {} }; }`),
});
plant('syn-d-flags-missing', {
  kernelSrc: kernelBody('[]'),
  html: page(`function compute(p) { const sum = p.a + p.b; return { output_payload: { sum, label: sum > 10 ? 'HIGH' : 'LOW', extra: 1 } }; }`),
});
plant('syn-e-atob-table', {
  html: page(`const TABLE = [];
for (let i = 0; i < 4; i++) TABLE[i] = [i, i * 2];
function compute(p) {
  const one = Number(atob('MQ=='));          // "1"
  const sum = p.a + p.b + TABLE[0][1] * one;  // TABLE[0][1] is 0
  return { sum, label: sum > 10 ? 'HIGH' : 'LOW', extra: TABLE[1][0] * one };
}`),
});
plant('syn-f-suspect', {
  // Closure extraction drops the init statement, so the two shapes both run but disagree.
  html: page(`var BIAS = 0;\nBIAS = 5;\nfunction compute(p) { const sum = p.a + p.b; return { sum, label: sum > 10 ? 'HIGH' : 'LOW', extra: BIAS - 4 }; }`),
});
plant('syn-g-bare', {
  kernelSrc: kernelBody('[]'),
  html: page(`function compute(p) { const sum = p.a + p.b; return { sum, label: sum > 10 ? 'HIGH' : 'LOW', extra: 1 }; }`),
});
plant('syn-h-throws', {
  html: page(`function compute(p) { if (p.a === 10) throw new Error('boom'); const sum = p.a + p.b; return { sum, label: sum > 10 ? 'HIGH' : 'LOW', extra: 1 }; }`),
});
plant('syn-z-nopage', { html: null });

function runChecker(script, extra = []) {
  const jsonPath = join(tmp, `out-${Math.random().toString(36).slice(2)}.json`);
  const r = spawnSync(process.execPath, [script, '--root', tmp, '--json', jsonPath, ...extra], { encoding: 'utf8', timeout: 180000 });
  const report = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : null;
  return { code: r.status, stdout: r.stdout || '', report };
}

function controls(label, script) {
  const failures = [];
  const ok = (name, cond) => { if (!cond) failures.push(`${label}: ${name}`); };
  const base = join(tmp, 'baseline.json');
  writeFileSync(base, JSON.stringify({ pages: { 'syn-b-match': { vectors: ['v_low'], count: 1 } }, total_pairs: 1 }));
  const { code, report } = runChecker(script, ['--write-baseline', base + '.new']);
  ok('exit 0 (advisory)', code === 0);
  ok('report written', !!report);
  const by = Object.fromEntries((report ? report.pages : []).map((p) => [p.id, p]));
  const st = (id) => (by[id] ? by[id].state : 'ABSENT');
  ok('(a) disagreeing page is MISMATCH', st('syn-a-mismatch') === 'MISMATCH');
  ok('(a) names the vector v_low', !!by['syn-a-mismatch'] && by['syn-a-mismatch'].mismatches.some((m) => m.vector === 'v_low'));
  ok('(a) does not name the agreeing vector v_high', !!by['syn-a-mismatch'] && !by['syn-a-mismatch'].mismatches.some((m) => m.vector === 'v_high'));
  ok('(b) agreeing page is MATCH', st('syn-b-match') === 'MATCH');
  ok('(c) DOM-only page is UNEXTRACTABLE', st('syn-c-domonly') === 'UNEXTRACTABLE');
  ok('(d) flags container differs -> FLAGS-ONLY', st('syn-d-flags-container') === 'FLAGS-ONLY');
  ok('(d) flags key missing -> FLAGS-ONLY', st('syn-d-flags-missing') === 'FLAGS-ONLY');
  ok('(e) atob + table-init page is MATCH', st('syn-e-atob-table') === 'MATCH');
  ok('(f) shapes disagree -> HARNESS-SUSPECT', st('syn-f-suspect') === 'HARNESS-SUSPECT');
  ok('(g) bare payload vs envelope is MATCH', st('syn-g-bare') === 'MATCH');
  ok('(h) page that throws is MISMATCH', st('syn-h-throws') === 'MISMATCH');
  ok('(h) names the throwing vector v_high', !!by['syn-h-throws'] && by['syn-h-throws'].mismatches.some((m) => m.vector === 'v_high'));
  ok('no-page kernel is NO-PAGE', st('syn-z-nopage') === 'NO-PAGE');
  // (i) the baseline writer records MISMATCH pairs only; the baseline already on disk was ignored (exit 0, syn-b-match still MATCH)
  let nb = null;
  try { nb = JSON.parse(readFileSync(base + '.new', 'utf8')); } catch { /* checked below */ }
  ok('(i) baseline written', !!nb);
  ok('(i) baseline holds MISMATCH pages only', !!nb && Object.keys(nb.pages).sort().join(',') === 'syn-a-mismatch,syn-h-throws');
  ok('(i) baseline pair counts', !!nb && nb.total_pairs === 2);
  ok('(i) stage 1 ignores a baseline file present', st('syn-b-match') === 'MATCH' && code === 0);
  return failures;
}

// RED: a broken copy of the checker that never reports a mismatch must trip the controls.
const brokenSrc = readFileSync(REAL, 'utf8').replace("res.mismatches.push({ vector: v.name, path: d.path, page: d.page, kernel: d.kernel }); return;", 'return;').replace("res.mismatches.push({ vector: v.name, path: '(page threw)', page: run.err, kernel: trunc(kn.payload) }); return;", 'return;');
const brokenPath = join(HERE, `.check-page-kernel-parity.broken-${process.pid}.mjs`);
writeFileSync(brokenPath, brokenSrc);
let red;
try { red = controls('RED(broken)', brokenPath); } finally { rmSync(brokenPath, { force: true }); }
const detected = red.some((f) => f.includes('(a)') || f.includes('(h)'));

const green = controls('GREEN(real)', REAL);
rmSync(tmp, { recursive: true, force: true });

if (!detected) { console.error('RED control failed: the broken checker was not detected'); process.exit(1); }
console.log(`RED ok: broken checker tripped ${red.length} control(s)`);
if (green.length) { console.error(green.join('\n')); process.exit(1); }
console.log('GREEN ok: page-kernel parity controls (a)-(i) satisfied');
