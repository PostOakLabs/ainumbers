// sync-ain-bridge.test.mjs — BRIDGE-SNIPPET-SYNC-GEN-1.
//
// The region finder and the page rewriter are pure, so the tests run them over
// the REAL pages of all three measured shapes rather than over hand-written
// fixtures that could quietly stop resembling the estate:
//
//   tools/152-baas-provider-comparator.html        header comment + v1.1 body + bridge_version metadata
//   chaingraph/art-16-google-ap2-mandate-builder.html  node page, header comment, v1.1 body
//   chaingraph/art-01-ap2-mandate-chain-validator.html node page, NO header comment, v1.2 body
//
// The load-bearing assertion is FULL-FILE REVERSIBILITY: undo the two edits the
// writer is allowed to make (the region, the one bridge_version token) and the
// output must equal the input byte for byte. That catches an outside-the-region
// byte change no matter where it happens, which a prefix/suffix spot check does
// not. The SKIP paths are exercised on synthetic strings, because the estate
// (correctly) contains no page shaped like them today.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import {
  MASTER_PATH,
  findBridgeRegion,
  extractMaster,
  readVersion,
  rewritePage,
  publishedPages,
  scan,
  assertNoGateRegression,
} from './sync-ain-bridge.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = extractMaster(readFileSync(MASTER_PATH, 'utf8'));

const SHAPES = [
  ['tools page (header comment, v1.1)', 'tools/152-baas-provider-comparator.html'],
  ['chaingraph node page (header comment)', 'chaingraph/art-16-google-ap2-mandate-builder.html'],
  ['chaingraph node page (no header comment, v1.2)', 'chaingraph/art-01-ap2-mandate-chain-validator.html'],
];

const read = (rel) => readFileSync(resolve(REPO, rel), 'utf8');

/**
 * Undo exactly the two edits the writer is permitted to make, and return the
 * result. If it does not equal the original page, the writer touched something
 * it had no licence to touch.
 */
function undoPermittedEdits(original, out, origRegion) {
  const outRegion = findBridgeRegion(out);
  assert.ok(outRegion.ok, 'the rewritten page must still carry exactly one region');
  const restoredRegion =
    out.slice(0, outRegion.start) + original.slice(origRegion.start, origRegion.end) + out.slice(outRegion.end);
  // A page may declare bridge_version more than once; put each one back in the
  // order it appears, so a writer that stamped only some of them is caught.
  const origValues = [...original.matchAll(/"bridge_version"\s*:\s*"([\d.]+)"/g)].map((m) => m[1]);
  let i = 0;
  return restoredRegion.replace(/("bridge_version"\s*:\s*")[\d.]+(")/g, (_m, a, b) => `${a}${origValues[i++]}${b}`);
}

test('the master snippet is readable by the same finder that reads a page', () => {
  // 1.3 since BRIDGE-MCP-APPS-ALIGN-1 added the MCP Apps ui/ layer to the master.
  assert.equal(MASTER.version, '1.3');
  assert.match(MASTER.body, /window\.AINBridge\s*=/);
  assert.match(MASTER.body, /capabilities:\{/, 'B7: the master exports a capabilities object');
  // B7: every flag is derived from a routine, never a hard-coded true.
  for (const k of ['prefill', 'mandate', 'handoff', 'sendToVerify', 'sessionRoot', 'mcpApps']) {
    assert.match(MASTER.body, new RegExp(`${k}:typeof \\w+==='function'`), `${k} is derived, not asserted`);
  }
  assert.match(MASTER.body, /function onComposerMessage\(e\)\{/, 'handoff is derived from a named routine');
  // The master body is about to be stamped onto ~600 pages. A syntax error in
  // it would break every one of them at once, and the JS-syntax gate reads
  // tool HTML, not this snippet. Compile it (never run it) here instead.
  assert.doesNotThrow(() => new Function(MASTER.body), 'the master body must parse');
  assert.match(MASTER.body, /window\.addEventListener\('message',onComposerMessage\)/, 'the named listener is registered');
});

test('readVersion prefers the single BRIDGE_VERSION declaration', () => {
  assert.equal(readVersion("var BRIDGE_VERSION='9.9';window.AINBridge={version:BRIDGE_VERSION}"), '9.9');
  assert.equal(readVersion("window.AINBridge={version:'1.1',apply:x}"), '1.1');
  assert.equal(readVersion('no version here'), null);
});

for (const [label, relPath] of SHAPES) {
  test(`region finder — ${label}`, () => {
    const html = read(relPath);
    const r = findBridgeRegion(html);
    assert.ok(r.ok, `expected a region, got SKIP ${r.reason}`);
    assert.match(r.cfgLine, /^<script>window\.AIN_BRIDGE_CFG=.*<\/script>$/s);
    assert.match(r.body, /window\.AINBridge\s*=/);
    // The region must start at the header comment when a page has one, and at
    // the CFG line when it does not — both shapes are live in the estate.
    assert.equal(r.start, r.comment ? r.comment.start : html.indexOf(r.cfgLine));
    assert.equal(html.slice(r.start, r.end).endsWith('</script>'), true);
  });

  test(`rewrite — ${label}: the CFG line survives byte-identical`, () => {
    const html = read(relPath);
    const region = findBridgeRegion(html);
    const r = rewritePage(html, MASTER);
    assert.ok(r.ok, `unexpected SKIP ${r.reason}`);
    assert.equal(findBridgeRegion(r.out).cfgLine, region.cfgLine);
  });

  test(`rewrite — ${label}: the body becomes the master body`, () => {
    const r = rewritePage(read(relPath), MASTER);
    assert.equal(findBridgeRegion(r.out).body, MASTER.body);
  });

  test(`rewrite — ${label}: the header comment is bumped to the master version`, () => {
    const html = read(relPath);
    const before = findBridgeRegion(html);
    const after = findBridgeRegion(rewritePage(html, MASTER).out);
    if (before.comment) {
      assert.match(after.comment.text, new RegExp(`AIN Bridge v${MASTER.version.replace('.', '\\.')}`));
      // Only the version token moves — the rest of the comment, including the
      // Master: path that names this file, is the page's own prose.
      assert.equal(
        after.comment.text.replace(/AIN Bridge v[\d.]+/, 'V'),
        before.comment.text.replace(/AIN Bridge v[\d.]+/, 'V'),
      );
    } else {
      assert.equal(after.comment, null, 'a page without a header comment must not gain one');
    }
  });

  test(`rewrite — ${label}: EVERY bridge_version metadata field is set to the master version`, () => {
    const html = read(relPath);
    const r = rewritePage(html, MASTER);
    const before = [...html.matchAll(/"bridge_version"\s*:\s*"([\d.]+)"/g)];
    const after = [...r.out.matchAll(/"bridge_version"\s*:\s*"([\d.]+)"/g)];
    assert.equal(after.length, before.length, 'the field count must not move');
    for (const m of after) assert.equal(m[1], MASTER.version);
  });

  test(`rewrite — ${label}: every byte outside the two permitted edits is unchanged`, () => {
    const html = read(relPath);
    const region = findBridgeRegion(html);
    const r = rewritePage(html, MASTER);
    assert.equal(undoPermittedEdits(html, r.out, region), html);
  });

  test(`rewrite — ${label}: idempotent`, () => {
    const once = rewritePage(read(relPath), MASTER).out;
    const twice = rewritePage(once, MASTER);
    assert.equal(twice.changed, false, 'a synced page must report no drift');
    assert.equal(twice.out, once);
  });
}

// ── SKIP paths (safety asserts (a) and (d)) ────────────────────────────────
const CFG = "<script>window.AIN_BRIDGE_CFG={runFn:null};</script>";
// A bridge body is identified by the line that CONSUMES the CFG, so every
// fixture standing in for one must carry that line.
const BODY = "<script>\n(function(){var CFG=window.AIN_BRIDGE_CFG||{};window.AINBridge={version:'1.1'};})();\n</script>";
const page = (...parts) => `<html><body>\n${parts.join('\n')}\n</body></html>`;

test('SKIP: a page with no bridge region', () => {
  assert.deepEqual(findBridgeRegion(page('<p>nothing here</p>')), { ok: false, reason: 'no-bridge-region' });
});

test('SKIP: (a) two regions on one page', () => {
  const r = findBridgeRegion(page(CFG, BODY, CFG, BODY));
  assert.equal(r.ok, false);
  assert.match(r.reason, /^multiple-cfg-lines\(2\)$/);
});

test('SKIP: (d) a WebMCP registration inside the bridge block', () => {
  const merged = "<script>\n(function(){var CFG=window.AIN_BRIDGE_CFG||{};window.AINBridge={version:'1.1'};navigator.modelContext.registerTool({});})();\n</script>";
  const r = findBridgeRegion(page(CFG, merged));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'webmcp-registration-inside-bridge-block');
});

test('SKIP: the run of scripts after the CFG line ends without a bridge', () => {
  const r = findBridgeRegion(page(CFG, '<script>console.log(1);</script>'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'cfg-line-has-no-following-script');
});

test('SKIP: the preamble walk is bounded and never swallows the document', () => {
  const noise = Array.from({ length: 8 }, (_, i) => `<script>console.log(${i});</script>`);
  const r = findBridgeRegion(page(CFG, ...noise, BODY));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'script-after-cfg-is-not-the-bridge');
});

test('a page-specific shim between the CFG line and the bridge survives byte-identical', () => {
  // Measured shape: tools/109-cdd-edd-checklist.html line 534 carries an
  // AIN_BUILD_MANDATE shim there. It is the page's own, like the CFG line.
  const shim = '<script>window.AIN_BUILD_MANDATE=function(){return null;};</script>';
  const html = page(CFG, shim, BODY);
  const r = findBridgeRegion(html);
  assert.ok(r.ok, `expected a region, got SKIP ${r.reason}`);
  assert.equal(r.preamble.includes(shim), true, 'the shim belongs to the region preamble');
  const out = rewritePage(html, MASTER).out;
  assert.equal(out.includes(shim), true, 'the shim must survive the rewrite byte-identical');
  assert.equal(findBridgeRegion(out).body, MASTER.body);
});

test('SKIP: an attributed script carrying the bridge is never rewritten', () => {
  const attributed = '<script type="module">\nvar CFG=window.AIN_BRIDGE_CFG||{};\n</script>';
  const r = findBridgeRegion(page(CFG, attributed));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bridge-block-is-not-a-bare-script-tag');
});

test('an attributed script that is NOT the bridge is walked past, not swallowed', () => {
  const json = '<script type="application/json">{"a":1}</script>';
  const html = page(CFG, json, BODY);
  const r = findBridgeRegion(html);
  assert.ok(r.ok, `expected a region, got SKIP ${r.reason}`);
  assert.equal(rewritePage(html, MASTER).out.includes(json), true);
});

test('SKIP: markup between the CFG line and the bridge block', () => {
  const r = findBridgeRegion(page(CFG, '<div>stray</div>', BODY));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'cfg-line-not-adjacent-to-bridge-block');
});

test('SKIP: a second AINBridge assignment elsewhere on the page', () => {
  const r = findBridgeRegion(page(CFG, BODY, "<script>window.AINBridge={version:'0.9'};</script>"));
  assert.equal(r.ok, false);
  assert.match(r.reason, /^multiple-AINBridge-assignments\(2\)$/);
});

test('SKIP: the CFG assignment is not inside its own script element', () => {
  // Measured shape: chaingraph/art-15-agentic-mandate-sandbox.html, where the
  // CFG and the bridge body share one <script> with the page's own JS. Named
  // apart from 'no-bridge-region' so the ROLL row can see the hole.
  const inline = "<script>\n/* page js */\nwindow.AIN_BRIDGE_CFG={runFn:'x'};\n(function(){var CFG=window.AIN_BRIDGE_CFG||{};})();\n</script>";
  const r = findBridgeRegion(page(inline));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'cfg-not-in-its-own-script-element');
});

test('an abbreviated v1.0 block that never exports window.AINBridge is still the bridge', () => {
  // 44 pages carry this shape (chaingraph/art-22-agentic-payments-protocol-
  // comparator.html, "AIN Bridge v1.0 (abbreviated)"). They are the pages
  // FURTHEST behind the master, so they must read as drift, never as SKIP.
  const abbreviated = "<script>\n(function(){var CFG=window.AIN_BRIDGE_CFG||{};function b64uDec(s){return s;}})();\n</script>";
  const r = findBridgeRegion(page(CFG, abbreviated));
  assert.ok(r.ok, `expected a region, got SKIP ${r.reason}`);
  assert.equal(rewritePage(page(CFG, abbreviated), MASTER).changed, true);
});

test('both bridge_version fields on a two-field page are stamped', () => {
  const html = page('<script>var A=JSON.parse(\'{"bridge_version": "1.0"}\');</script>', '<b>{"bridge_version":"1.0"}</b>', CFG, BODY);
  const r = rewritePage(html, MASTER);
  assert.ok(r.ok, `unexpected SKIP ${r.reason}`);
  const after = [...r.out.matchAll(/"bridge_version"\s*:\s*"([\d.]+)"/g)];
  assert.equal(after.length, 2);
  for (const m of after) assert.equal(m[1], MASTER.version);
});

// ── the estate scan and the writer ─────────────────────────────────────────
test('--check scans the published estate and finds the drift it is built to find', () => {
  const res = scan(publishedPages(), MASTER);
  assert.ok(res.scanned > 500, `expected the measured ~600 bridge pages, scanned ${res.scanned}`);
  assert.ok(res.drifted.length > 0, 'the master carries B7, so the un-rolled estate must read as drifted');
  // A SKIP is a reported outcome, never a silent pass: every one carries a reason.
  for (const s of res.skipped) assert.match(s.reason, /^[a-zA-Z_-]+(\(\d+\))?$/);
});

test('the writer writes the rewritten bytes and is a no-op on a second run', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sync-ain-bridge-'));
  try {
    const src = read(SHAPES[0][1]);
    const f = join(dir, 'page.html');
    writeFileSync(f, src);
    const r = rewritePage(readFileSync(f, 'utf8'), MASTER);
    await assertNoGateRegression('page.html', src, r.out);
    writeFileSync(f, r.out);
    const after = readFileSync(f, 'utf8');
    assert.equal(after, r.out);
    assert.equal(rewritePage(after, MASTER).changed, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('(c) the gate-regression assert fires when the banner is dropped', async () => {
  const src = read(SHAPES[0][1]);
  const stripped = src.replace(/All inputs are processed locally in your browser/g, 'x');
  await assert.rejects(() => assertNoGateRegression('page.html', src, stripped), /PII banner/);
});
