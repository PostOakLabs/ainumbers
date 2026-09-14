/**
 * scripts/normalize-node-chrome.test.mjs
 * Phase 0 guards for normalize-node-chrome.mjs (PHASE0-NORMALIZER-GUARDS-1).
 *
 * RED-first history (quoted in the PR body): before these guards, the tool
 * reproduced the K3/K4 destruction on these very fixture classes silently:
 *   K3  fx-css-tail      `:root{` 1→0, `.tool-grid{` 1→0, exit 0
 *   K4  fx-script-footer canonical footer markup injected inside the JS
 *        template literal (618→10360 bytes), exit 0
 *   K4  fx-multifooter   in-script print template stripped (print-only 1→0), exit 0
 *   K11 chaingraph-hub   `--sample chaingraph-hub.html` listed the EXEMPT page
 *        as "Would write / Sample", exit 0
 * These tests pin the guarded-green behavior: every destruction class now
 * skips (byte-identical file) and --apply refuses with exit 1.
 *
 * Zero dependencies: node:test + node:assert + node:child_process only.
 * Fixtures are written to a per-test mkdtemp sandbox (via the --dir override)
 * and never committed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { normalizeChrome, extractSelectors, footersInsideScript } from './normalize-node-chrome.mjs';
import { buildNav, FOOTER, CHROME_CSS, CSS_MARKER, CHROME_EXEMPT } from '../chaingraph/_page-chrome.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI  = resolve(HERE, 'normalize-node-chrome.mjs');

/* ─── fixture builders (the four Phase 0 classes + controls) ─── */

// K4: the ONLY <footer> on the page lives inside a <script> template literal.
const FX_SCRIPT_FOOTER = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>FX Script Footer Fixture · AINumbers.co</title>
<style>body{margin:0;font-family:sans-serif}</style>
</head>
<body>
<nav><div class="nav-legacy">legacy nav</div></nav>
<main><h1>N1 print report fixture</h1><p>Body content only.</p></main>
<script>
/* Print-template footer (the art-139 shape): the only footer element on this
   page lives inside a script template literal. */
var REPORT_TEMPLATE =
  "<footer class=\\"print-only\\">AINumbers.co · quarterly report · CC BY 4.0</footer>";
document.write(REPORT_TEMPLATE);
</script>
</body>
</html>
`;

// K3: page CSS (:root, .tool-grid, .fx-card) AFTER the chrome marker, same <style>.
const FX_CSS_TAIL = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>FX CSS Tail Fixture · AINumbers.co</title>
<style>
${CHROME_CSS}
:root{--page-accent:#b45309;--tool-gap:12px}
.tool-grid{display:grid;gap:var(--tool-gap)}
.fx-card{border:1px solid var(--page-accent)}
</style>
</head>
<body>
<nav>legacy nav</nav>
<main><h1>CSS tail fixture</h1></main>
<footer><div>site footer · AINumbers.co</div></footer>
</body>
</html>
`;

// K4 mixed: in-script template footer PLUS a real body footer.
const FX_MULTI_FOOTER = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>FX Multi Footer Fixture · AINumbers.co</title>
<style>body{margin:0}</style>
</head>
<body>
<nav>legacy nav</nav>
<main><h1>Multi-footer fixture</h1></main>
<script>
var REPORT_TEMPLATE =
  "<footer class=\\"print-only\\">AINumbers.co · print footer · CC BY 4.0</footer>";
</script>
<footer><div>site footer · AINumbers.co · CC BY 4.0</div></footer>
</body>
</html>
`;

// Footer-only demo: canonical CSS span, bare legacy nav, STALE body footer.
const FX_FOOTER_ONLY = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>FX Footer Only Fixture · AINumbers.co</title>
<style>
${CHROME_CSS}
</style>
</head>
<body>
<nav>legacy nav kept by footer-only mode</nav>
<main><h1>Footer-only fixture</h1></main>
<footer><div>STALE footer · pre-canonical</div></footer>
</body>
</html>
`;

// Fully canonical control page: no guard may fire, no change may be proposed.
const FX_CANONICAL = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>FX Canonical Fixture · AINumbers.co</title>
<style>
${CHROME_CSS}
</style>
</head>
<body>
${buildNav('FX Canonical Fixture')}
<main><h1>Canonical fixture</h1></main>
${FOOTER}
</body>
</html>
`;

const FIXTURES = {
  'fx-script-footer.html': FX_SCRIPT_FOOTER,
  'fx-css-tail.html': FX_CSS_TAIL,
  'fx-multifooter.html': FX_MULTI_FOOTER,
  'fx-footeronly.html': FX_FOOTER_ONLY,
  'fx-canonical.html': FX_CANONICAL,
  'chaingraph-hub.html': `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>FX Exempt Stand-in · AINumbers.co</title>
<style>body{margin:0}</style>
</head>
<body>
<nav>ssot legacy nav</nav>
<main><h1>Exempt stand-in page</h1></main>
<footer><div>old footer · AINumbers.co</div></footer>
</body>
</html>
`,
};

function markerSpan(html) {
  const i = html.indexOf(CSS_MARKER);
  const j = html.indexOf('</style>', i);
  return html.slice(i, j);
}

/** Fresh mkdtemp sandbox: minimal chaingraph.json + every fixture file. */
function makeSandbox(t) {
  const sb = mkdtempSync(join(tmpdir(), 'p0ncc-'));
  const cg = join(sb, 'chaingraph');
  mkdirSync(cg);
  writeFileSync(join(cg, 'chaingraph.json'), '{"spec_version":"0.4.1","nodes":[]}\n', 'utf-8');
  for (const [name, html] of Object.entries(FIXTURES)) {
    writeFileSync(join(cg, name), html, 'utf-8');
  }
  t.after(() => rmSync(sb, { recursive: true, force: true }));
  return sb;
}

const readFixture = (sb, name) => readFileSync(join(sb, 'chaingraph', name), 'utf-8');

/* ─── detection helper sanity ─── */

test('extractSelectors parses selectors uniformly; CHROME_CSS selectors are all recognized', (t) => {
  assert.deepEqual(extractSelectors('nav{color:red}  .a > .b { x : y }'), ['nav', '.a > .b']);
  // comments and declaration bodies never leak in as selectors
  assert.deepEqual(extractSelectors('/* .commented-out{none} */ footer{margin:0}'), ['footer']);
  // @media conditions are collected like any other pre-brace run
  assert.ok(extractSelectors(CHROME_CSS).every(s => extractSelectors(`${CHROME_CSS}${CHROME_CSS}`).includes(s)));
  // the exact K3 discriminator: :root is NOT a CHROME_CSS selector
  const chrome = new Set(extractSelectors(CHROME_CSS));
  assert.ok(!chrome.has(':root'));
});

test('footersInsideScript finds template-literal footers only', (t) => {
  assert.equal(footersInsideScript(FX_SCRIPT_FOOTER).length, 1);
  assert.equal(footersInsideScript(FX_MULTI_FOOTER).length, 1);
  assert.equal(footersInsideScript(FX_CANONICAL).length, 0); // body footer, no script
});

/* ─── guard 1 (K4): footer-in-script ─── */

test('guard 1: footer-in-script page is skipped with reason footer-in-script and byte-identical file', (t) => {
  const sb = makeSandbox(t);
  const r = normalizeChrome({ dir: join(sb, 'chaingraph'), targets: ['fx-script-footer.html'], apply: true });
  assert.equal(r.changed.length, 0);
  assert.equal(r.skipped.length, 1);
  assert.equal(r.skipped[0].reason, 'footer-in-script');
  assert.equal(readFixture(sb, 'fx-script-footer.html'), FX_SCRIPT_FOOTER, 'script text must never be edited');
  assert.ok(readFixture(sb, 'fx-script-footer.html').includes('print-only'));
});

test('guard 1 mixed: multi-footer page (in-script template + body footer) refuses', (t) => {
  const sb = makeSandbox(t);
  const r = normalizeChrome({ dir: join(sb, 'chaingraph'), targets: ['fx-multifooter.html'], apply: true });
  assert.equal(r.changed.length, 0);
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0].reason, /^footer-in-script \(mixed: 1 of 2 footers inside <script>\)$/);
  assert.equal(readFixture(sb, 'fx-multifooter.html'), FX_MULTI_FOOTER, 'collapse must never strip the in-script template');
});

/* ─── guard 2 (K3): page CSS after chrome marker ─── */

test('guard 2: page CSS after chrome marker is refused, page CSS preserved', (t) => {
  const sb = makeSandbox(t);
  const r = normalizeChrome({ dir: join(sb, 'chaingraph'), targets: ['fx-css-tail.html'], apply: true });
  assert.equal(r.changed.length, 0);
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0].reason, /^page CSS after chrome marker \(3 selector\(s\) not in CHROME_CSS: :root, \.tool-grid, \.fx-card\)$/);
  const after = readFixture(sb, 'fx-css-tail.html');
  assert.equal(after, FX_CSS_TAIL, 'file must stay byte-identical');
  assert.match(after, /:root\{--page-accent/);
  assert.match(after, /\.tool-grid\{display:grid/);
});

test('guard 2 control: a canonical chrome-only span is NOT skipped (guard discriminates)', (t) => {
  const sb = makeSandbox(t);
  const r = normalizeChrome({ dir: join(sb, 'chaingraph'), targets: ['fx-canonical.html'], apply: true });
  assert.equal(r.skipped.length, 0, `unexpected skips: ${JSON.stringify(r.skipped)}`);
  assert.equal(r.changed.length, 0);
  assert.equal(r.unchanged.length, 1, 'canonical page must be a no-op');
  assert.equal(readFixture(sb, 'fx-canonical.html'), FX_CANONICAL);
});

/* ─── guard 4 (K11): EXEMPT honoured by named --only / --sample lists ─── */

test('guard 4: EXEMPT name on a named target list skips with the EXEMPT reason', (t) => {
  const sb = makeSandbox(t);
  assert.ok(CHROME_EXEMPT.has('chaingraph-hub.html'), 'precondition: chaingraph-hub.html is EXEMPT');
  const r = normalizeChrome({ dir: join(sb, 'chaingraph'), targets: ['chaingraph-hub.html'], apply: true });
  assert.equal(r.changed.length, 0);
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0].reason, /^EXEMPT /);
  assert.equal(readFixture(sb, 'chaingraph-hub.html'), FIXTURES['chaingraph-hub.html']);
});

test('guard 4: an EXEMPT co-target is filtered while the non-exempt page still processes', (t) => {
  const sb = makeSandbox(t);
  const r = normalizeChrome({ dir: join(sb, 'chaingraph'), targets: ['chaingraph-hub.html', 'fx-footeronly.html'], apply: false });
  assert.deepEqual(r.skipped.map(s => s.file), ['chaingraph-hub.html']);
  assert.match(r.skipped[0].reason, /^EXEMPT /);
  assert.deepEqual(r.changed.map(c => c.file), ['fx-footeronly.html']);
});

/* ─── item 5: scope report + footer-only mode ─── */

test('footer-only mode changes ONLY the footer region; nav and CSS stay byte-identical', (t) => {
  const sb = makeSandbox(t);
  const r = normalizeChrome({ dir: join(sb, 'chaingraph'), targets: ['fx-footeronly.html'], apply: true, footerOnly: true });
  assert.equal(r.changed.length, 1);
  assert.deepEqual(r.changed[0].regions, { nav: false, footer: true, css: false });
  const after = readFixture(sb, 'fx-footeronly.html');
  assert.match(after, /legacy nav kept by footer-only mode/, 'nav untouched');
  assert.equal(markerSpan(after), markerSpan(FX_FOOTER_ONLY), 'CSS span untouched');
  assert.match(after, /footer-cols/, 'canonical footer written');
  assert.ok(!after.includes('STALE footer'), 'stale footer replaced');
});

test('the footer-in-script guard still fires in footer-only mode', (t) => {
  const sb = makeSandbox(t);
  const r = normalizeChrome({ dir: join(sb, 'chaingraph'), targets: ['fx-script-footer.html'], apply: true, footerOnly: true });
  assert.equal(r.changed.length, 0);
  assert.equal(r.skipped[0].reason, 'footer-in-script');
  assert.equal(readFixture(sb, 'fx-script-footer.html'), FX_SCRIPT_FOOTER);
});

/* ─── guard 3: fail loud — CLI exit codes over the same fixtures ─── */

test('CLI: --apply exits 1 when skips exist; --dry-run exits 0 and prints the skip list', (t) => {
  const sb = makeSandbox(t);
  const cg = join(sb, 'chaingraph');

  const apply = spawnSync(process.execPath, [CLI, '--apply', '--dir', cg], { encoding: 'utf8' });
  assert.equal(apply.status, 1, `--apply must refuse (exit 1); stdout:\n${apply.stdout}`);
  assert.match(apply.stdout, /SKIP fx-script-footer\.html: footer-in-script/);
  assert.match(apply.stdout, /SKIP fx-css-tail\.html: page CSS after chrome marker/);
  assert.match(apply.stdout, /SKIP fx-multifooter\.html: footer-in-script \(mixed: 1 of 2 footers inside <script>\)/);
  // skip-class fixtures byte-identical after the refused apply (fx-footeronly
  // is a LEGITIMATE target a full --apply correctly rewrites — not asserted here)
  for (const name of ['fx-script-footer.html', 'fx-multifooter.html', 'fx-css-tail.html', 'chaingraph-hub.html', 'fx-canonical.html']) {
    assert.equal(readFixture(sb, name), FIXTURES[name], `${name} must be untouched by a refused --apply`);
  }

  const dry = spawnSync(process.execPath, [CLI, '--dry-run', '--dir', cg], { encoding: 'utf8' });
  assert.equal(dry.status, 0, '--dry-run may exit 0 but must print the skip list');
  assert.match(dry.stdout, /SKIP fx-script-footer\.html: footer-in-script/);
});

test('CLI: --only with an EXEMPT name refuses (exit 1); --sample prints the skip and exits 0', (t) => {
  const sb = makeSandbox(t);
  const cg = join(sb, 'chaingraph');

  const only = spawnSync(process.execPath, [CLI, '--only', 'chaingraph-hub.html', '--apply', '--dir', cg], { encoding: 'utf8' });
  assert.equal(only.status, 1);
  assert.match(only.stdout, /SKIP chaingraph-hub\.html: EXEMPT /);
  assert.equal(readFixture(sb, 'chaingraph-hub.html'), FIXTURES['chaingraph-hub.html']);

  const sample = spawnSync(process.execPath, [CLI, '--sample', 'chaingraph-hub.html', '--dir', cg], { encoding: 'utf8' });
  assert.equal(sample.status, 0);
  assert.match(sample.stdout, /SKIP chaingraph-hub\.html: EXEMPT /);
  assert.match(sample.stdout, /Would change : 0/);
});

test('CLI: --only writes named pages; --apply with zero skips exits 0; footer-only scope line present', (t) => {
  const sb = makeSandbox(t);
  const cg = join(sb, 'chaingraph');

  const ok = spawnSync(process.execPath, [CLI, '--only', 'fx-footeronly.html', '--apply', '--footer-only', '--dir', cg], { encoding: 'utf8' });
  assert.equal(ok.status, 0, `stdout:\n${ok.stdout}`);
  assert.match(ok.stdout, /✓ fx-footeronly\.html .*scope: footer/);
  const after = readFixture(sb, 'fx-footeronly.html');
  assert.match(after, /footer-cols/);
  assert.match(after, /legacy nav kept by footer-only mode/);
});
