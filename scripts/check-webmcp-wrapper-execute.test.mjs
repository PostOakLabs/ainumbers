#!/usr/bin/env node
/**
 * check-webmcp-wrapper-execute.test.mjs — self-test pairing for
 * scripts/check-webmcp-wrapper-execute.mjs (GATE-SELFTEST-META-1;
 * WEBMCP-WRAPPER-OBJECT-PARAMS-1).
 *
 * Controls, RED before GREEN where a control claims detection:
 *   1. GREEN: the REAL emitter's current output for a TYPE-LESS object
 *      property (the art-118 shape: no `type` keyword in the manifest) driven
 *      through the gate's own vm harness reproduces the expected hash — the
 *      shape-aware write JSON-encodes the object value.
 *   2. RED (the art-118 wedge class): the same block mutated back to the
 *      legacy bare-`String(params.payload)` write (the exact pre-
 *      WRAPPER-OBJECT-PARAMS emitter bytes) writes "[object Object]", the
 *      page's JSON.parse throws inside execute(), and the gate flags it.
 *   3. RED (never-settles): a page whose run() never sets the result global
 *      makes execute() return null — the gate flags the no-result class.
 *   4. RED (required typed validation surfaced): a required type-less
 *      property with the fixture omitting it makes the emitted validation
 *      throw inside execute() — the gate surfaces the structured error
 *      instead of passing silently (the class behind the four wrapper-path
 *      validation baseline entries).
 *   5. LIVE regression specimen: the gate's --only run on
 *      art-118-fsma204-cte-validator (this row's measured wedge page)
 *      reproduces the fixture-0 golden through the wrapper path.
 *   6. RED (stale baseline entry, WEBMCP-WRAPPER-BASELINE-STALE-1): a baseline
 *      entry for a page that now PASSES makes the gate exit 1 with the STALE
 *      line (down-only ratchet) — a stale entry would downgrade a regression
 *      on the healed page to a WARN.
 *   7. SCOPE: the same --only run reports NO other baseline entry as stale —
 *      un-run entries are never reported stale.
 *   8. GREEN: without the synthetic entry the same --only run exits 0 with
 *      zero STALE lines.
 *
 * Controls 6-8 drive the gate through its AINUM_WRAPPER_EXECUTE_BASELINE
 * baseline-read override against temp copies — never by mutating the real
 * baseline file: the full preflight suite runs this gate and this self-test
 * concurrently (AINUM_PREFLIGHT_CONCURRENCY).
 *
 * Usage: node scripts/check-webmcp-wrapper-execute.test.mjs   (exit 0 = all controls pass)
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBlockForPage, insertIntoPage } from './gen-webmcp-registrations.mjs';
import { runWrapperExecute, judgeExecute } from './check-webmcp-wrapper-execute.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? '  ✓ ' : '  ✗ ') + label + (ok || detail === undefined ? '' : ` — ${detail}`));
  if (!ok) failures++;
};

const PAGE_BODY = [
  '<html><head><title>synth wrapper-execute selftest</title></head><body>',
  '<textarea id="payload"></textarea>',
  '<script>',
  'var _lastResult = null;',
  'function run() {',
  "  var parsed = JSON.parse(document.getElementById('payload').value);",
  "  _lastResult = { execution_hash: 'sha256:synth-' + JSON.stringify(parsed) };",
  '}',
  '</script>',
  '</body></html>',
].join('\n');

// The art-118 manifest shape: a property with NO `type` keyword.
function synthManifest(required) {
  return {
    mcp_tool_definition: {
      name: 'run_synth_wrapper_execute',
      description: 'synthetic wrapper-execute selftest tool with one type-less payload property',
      inputSchema: {
        type: 'object',
        required,
        properties: { payload: { description: 'type not evidenced by kernel source' } },
      },
    },
    execution: { function_name: 'run' },
  };
}

const PP = { payload: { kind: 'cte', n: 1 } };
const GOLDEN = 'sha256:synth-{"kind":"cte","n":1}';
const LEGACY_LINE = "document.getElementById('payload').value = String(params.payload);";
const SHAPE_AWARE = "document.getElementById('payload').value = (params.payload !== null && typeof params.payload === 'object') ? JSON.stringify(params.payload) : String(params.payload);";

async function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'cwwx-'));
  try {
    // 1. GREEN: the real emitter's current output passes the gate harness.
    {
      const block = buildBlockForPage(synthManifest([]), 'manifests/synth-wrapper-execute.manifest.json', '_lastResult', undefined, 'run');
      const page = insertIntoPage(PAGE_BODY, block);
      check('control 1 setup: emitted block carries the shape-aware write', page.includes(SHAPE_AWARE), 'emitter output drifted from the shape-aware law');
      const file = join(tmp, 'synth-green.html');
      writeFileSync(file, page);
      const r = await runWrapperExecute(file, 'synth-green.html', PP);
      const j = judgeExecute(r, GOLDEN);
      check('GREEN: real emitter output reproduces the expected hash through execute()', j.ok, j.problem || '');
    }

    // 2. RED: the legacy bare-String() write (the exact pre-fix emitter bytes)
    //    is flagged — "[object Object]" makes the page's JSON.parse throw.
    {
      const block = buildBlockForPage(synthManifest([]), 'manifests/synth-wrapper-execute.manifest.json', '_lastResult', undefined, 'run');
      const legacyPage = insertIntoPage(PAGE_BODY, block).replace(SHAPE_AWARE, LEGACY_LINE);
      check('control 2 setup: legacy mutation replaced the shape-aware write', !legacyPage.includes(SHAPE_AWARE) && legacyPage.includes(LEGACY_LINE));
      const file = join(tmp, 'synth-legacy.html');
      writeFileSync(file, legacyPage);
      const r = await runWrapperExecute(file, 'synth-legacy.html', PP);
      const j = judgeExecute(r, GOLDEN);
      check('RED (art-118 wedge class): bare String() on the object param is flagged', !j.ok && /structured error|did not settle/.test(j.problem || ''), j.problem || 'gate passed a defective wrapper');
    }

    // 3. RED: a run() that never sets the result global — execute() returns null.
    {
      const block = buildBlockForPage(synthManifest([]), 'manifests/synth-wrapper-execute.manifest.json', '_lastResult', undefined, 'run');
      const deadPage = insertIntoPage(PAGE_BODY, block).replace(
        "  _lastResult = { execution_hash: 'sha256:synth-' + JSON.stringify(parsed) };",
        '  void parsed;',
      );
      const file = join(tmp, 'synth-dead.html');
      writeFileSync(file, deadPage);
      const r = await runWrapperExecute(file, 'synth-dead.html', PP);
      const j = judgeExecute(r, GOLDEN);
      check('RED (never-settles): execute() returning null is flagged', !j.ok && (j.problem || '').includes('did not settle with a result artifact'), j.problem || 'gate passed a non-settling wrapper');
    }

    // 4. RED: a required type-less property the fixture omits — the emitted
    //    validation throws inside execute(); the gate surfaces it.
    {
      const block = buildBlockForPage(synthManifest(['payload']), 'manifests/synth-wrapper-execute.manifest.json', '_lastResult', undefined, 'run');
      const file = join(tmp, 'synth-required.html');
      writeFileSync(file, insertIntoPage(PAGE_BODY, block));
      const r = await runWrapperExecute(file, 'synth-required.html', {});
      const j = judgeExecute(r, GOLDEN);
      check('RED (validation surfaced): omitted required member is flagged, not silent', !j.ok && (j.problem || '').includes('structured error'), j.problem || 'gate passed a validation abort');
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // 5. LIVE specimen: art-118 — this row's measured wedge page — reproduces
  //    its fixture-0 golden through the wrapper path on the current tree.
  {
    const fx = JSON.parse(readFileSync(join(REPO, 'chaingraph', 'kernels', 'fixtures', 'art-118-fsma204-cte-validator.fixtures.json'), 'utf8'));
    const golden = (fx.vectors || fx.fixtures)[0].golden_hash.replace(/^sha256:/, '');
    let out = '';
    try {
      out = execFileSync('node', ['scripts/check-webmcp-wrapper-execute.mjs', '--only', 'art-118-fsma204-cte-validator', '--json'], { cwd: REPO, encoding: 'utf8' });
    } catch (e) {
      out = String(e.stdout || '') + String(e.stderr || '');
    }
    const line = out.split('\n').find((l) => l.startsWith('{'));
    let hash = null;
    try { hash = JSON.parse(line).hash; } catch {}
    check('LIVE: art-118 wrapper path reproduces the fixture-0 golden', hash === golden, `produced ${hash}, golden ${golden}`);
  }

  // 6-8. WEBMCP-WRAPPER-BASELINE-STALE-1 controls: the downward ratchet's
  //      other direction. art-118 is a live-passing page (control 5), so a
  //      baseline entry for it must FAIL the gate with the STALE line — left
  //      in place it would downgrade a regression on the healed page to a
  //      WARN. Baseline reads are redirected to temp copies
  //      (AINUM_WRAPPER_EXECUTE_BASELINE); the real file is never touched.
  {
    const tmp2 = mkdtempSync(join(tmpdir(), 'cwwx-stale-'));
    try {
      const realBaseline = readFileSync(join(HERE, 'webmcp-wrapper-execute-baseline.json'), 'utf8');
      const pageKey = 'chaingraph/art-118-fsma204-cte-validator.html';
      const withStale = join(tmp2, 'baseline-with-stale.json');
      const withoutStale = join(tmp2, 'baseline-clean.json');
      const synth = JSON.parse(realBaseline);
      synth[pageKey] = { class: 'hash-mismatch', reason: 'synthetic stale-entry control (check-webmcp-wrapper-execute.test.mjs)' };
      writeFileSync(withStale, JSON.stringify(synth, null, 2) + '\n');
      writeFileSync(withoutStale, realBaseline);
      const runGate = (baselineFile) => {
        try {
          // stdio piped: the RED leg's expected gate failure must not leak its
          // ✗ FAILED block into the suite's output.
          const out = execFileSync('node', ['scripts/check-webmcp-wrapper-execute.mjs', '--only', 'art-118-fsma204-cte-validator'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AINUM_WRAPPER_EXECUTE_BASELINE: baselineFile } });
          return { code: 0, out };
        } catch (e) {
          return { code: e.status ?? 1, out: String(e.stdout || '') + String(e.stderr || '') };
        }
      };
      const red = runGate(withStale);
      // Entry lines carry the em dash; the FAILED summary line ("1 STALE
      // baseline entry over …") must not count as one.
      const staleLines = red.out.split('\n').filter((l) => l.trim().startsWith('STALE baseline entry — '));
      check(
        'RED (stale entry): a baseline entry for a passing page exits 1 with the STALE line',
        red.code === 1 && staleLines.length === 1 && staleLines[0].includes(pageKey) && staleLines[0].includes('down-only ratchet'),
        `exit ${red.code}; stale lines: ${JSON.stringify(staleLines)}`,
      );
      check(
        'SCOPE (--only): no un-run baseline entry is reported stale',
        staleLines.every((l) => l.includes(pageKey)),
        staleLines.join(' | '),
      );
      const green = runGate(withoutStale);
      check(
        'GREEN: without the stale entry the same --only run exits 0 with zero STALE lines',
        green.code === 0 && !green.out.includes('STALE baseline entry'),
        `exit ${green.code}; ${green.out.split('\n').find((l) => l.includes('STALE')) || ''}`,
      );
    } finally {
      rmSync(tmp2, { recursive: true, force: true });
    }
  }

  console.log(failures === 0
    ? '✓ check-webmcp-wrapper-execute controls: PASS (gate detects the art-118 wedge class; the live specimen reproduces its golden through the wrapper path; a stale baseline entry for a passing page FAILS the gate — down-only ratchet)'
    : `✗ check-webmcp-wrapper-execute controls: FAIL (${failures} control(s))`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('✗ controls exception:', e); process.exit(1); });
