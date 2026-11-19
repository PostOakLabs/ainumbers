#!/usr/bin/env node
/**
 * scripts/check-manifest-parity.selftest.mjs: paired controls for
 * scripts/check-manifest-parity.mjs (GATE-SELFTEST-META-1).
 *
 * Builds SYNTHETIC node pages and manifest files in a temp dir (never the real estate)
 * and runs the checker against them with --root:
 *   (a) green page: inline example_execution_hash and output-schema keys (incl. `warnings`)
 *       equal the manifest file                                     -> no advisory row
 *   (b) hash drift: inline hash differs from the file (the 836 shape) -> 1 hash row
 *   (c) missing key: inline output_schema.properties lacks `warnings` -> missing [warnings]
 *   (d) extra key:   inline carries a key the file does not            -> extra [ghost]
 *   (e) absent on both sides: no hash, no schema either side           -> no advisory row
 *   (f) no inline MANIFEST literal (the NAME_RE match still passes)    -> skipped, never a row
 *   (g) no manifest file / unreadable manifest file                    -> skipped, never a row
 *   (h) baseline: --write-baseline records (b),(c),(d) only, and is byte-stable across runs
 *   (i) advisory stays advisory: the full control estate exits 0 despite 3 mismatch rows
 *   (j) blocking preserved: a planted mcp_tool_definition name drift still exits 1, and the
 *       advisory section is still reported on that run
 * RED first: the same controls run against a deliberately broken copy of the checker (it
 * never records an advisory row) and must be detected as broken. Then GREEN: the real
 * checker must satisfy every control.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL = resolve(HERE, 'check-manifest-parity.mjs');

const tmp = mkdtempSync(join(tmpdir(), 'manifest-parity-selftest-'));
const estate = join(tmp, 'estate');
const drift = join(tmp, 'drift');
for (const d of [join(estate, 'chaingraph'), join(estate, 'manifests'), join(drift, 'chaingraph'), join(drift, 'manifests')]) mkdirSync(d, { recursive: true });

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const greenFile = { example_execution_hash: HASH_A, output_schema: { type: 'object', properties: { refused: { type: 'boolean' }, warnings: { type: 'array', items: { type: 'string' } } } } };

function page(id, manifestLiteralJs) {
  writeFileSync(join(estate, 'chaingraph', id + '.html'),
    '<!doctype html><html><head></head><body><script>\n' + manifestLiteralJs + '\n</script></body></html>\n');
}
const literal = (obj) => 'const MANIFEST = ' + JSON.stringify(obj) + ';';
const fileManifest = (id, obj) => writeFileSync(join(estate, 'manifests', id + '.manifest.json'), JSON.stringify(obj));

// (a) green: inline equals file on both surfaces.
page('syn-a-green', literal({ mcp_tool_definition: { name: 'syn-a-green' }, ...greenFile }));
fileManifest('syn-a-green', greenFile);
// (b) hash drift: inline advertises a different example_execution_hash (the 836 shape).
page('syn-b-hashdrift', literal({ mcp_tool_definition: { name: 'syn-b-hashdrift' }, ...greenFile, example_execution_hash: HASH_B }));
fileManifest('syn-b-hashdrift', greenFile);
// (c) missing key: inline output schema lacks `warnings`.
page('syn-c-missingwarn', literal({ mcp_tool_definition: { name: 'syn-c-missingwarn' }, example_execution_hash: HASH_A, output_schema: { type: 'object', properties: { refused: { type: 'boolean' } } } }));
fileManifest('syn-c-missingwarn', greenFile);
// (d) extra key: inline declares a key the file never declared.
page('syn-d-extrakey', literal({ mcp_tool_definition: { name: 'syn-d-extrakey' }, example_execution_hash: HASH_A, output_schema: { type: 'object', properties: { refused: { type: 'boolean' }, warnings: { type: 'array', items: { type: 'string' } }, ghost: { type: 'string' } } } }));
fileManifest('syn-d-extrakey', greenFile);
// (e) absent on both sides: never an entry.
page('syn-e-absent', literal({ mcp_tool_definition: { name: 'syn-e-absent' } }));
fileManifest('syn-e-absent', { tool_id: 'syn-e-absent' });
// (f) no inline MANIFEST literal: the name check still matches, the advisory class skips.
writeFileSync(join(estate, 'chaingraph', 'syn-f-noembed.html'),
  '<!doctype html><html><body><script>\nconst TOOLDEF = ' + JSON.stringify({ mcp_tool_definition: { name: 'syn-f-noembed' } }) + ';\n</script></body></html>\n');
fileManifest('syn-f-noembed', greenFile);
// (g) no manifest file for the tool.
page('syn-g-nofile', literal({ mcp_tool_definition: { name: 'syn-g-nofile' }, ...greenFile }));
// (h-plant) unreadable manifest file.
page('syn-h-unreadable', literal({ mcp_tool_definition: { name: 'syn-h-unreadable' }, ...greenFile }));
writeFileSync(join(estate, 'manifests', 'syn-h-unreadable.manifest.json'), '{oops');

const nodeEntry = (tool_id, mcp_name) => ({ tool_id, mcp_name });
writeFileSync(join(estate, 'chaingraph', 'chaingraph.json'), JSON.stringify({
  nodes: ['syn-a-green', 'syn-b-hashdrift', 'syn-c-missingwarn', 'syn-d-extrakey', 'syn-e-absent', 'syn-f-noembed', 'syn-g-nofile', 'syn-h-unreadable']
    .map((id) => nodeEntry(id, id)),
}));

// (j) drift estate: the blocking name check must still fail the run, advisory still reported.
writeFileSync(join(drift, 'chaingraph', 'syn-i-namedrift.html'),
  '<!doctype html><html><body><script>\n' + literal({ mcp_tool_definition: { name: 'wrong_tool_name' }, ...greenFile }) + '\n</script></body></html>\n');
writeFileSync(join(drift, 'manifests', 'syn-i-namedrift.manifest.json'), JSON.stringify(greenFile));
writeFileSync(join(drift, 'chaingraph', 'chaingraph.json'), JSON.stringify({ nodes: [nodeEntry('syn-i-namedrift', 'right_tool_name')] }));

function runChecker(script, tag, root) {
  const r = spawnSync(process.execPath, [
    script, '--root', root,
    '--json', join(tmp, tag + '.json'),
    '--write-baseline', join(tmp, tag + '.baseline.json'),
  ], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/** Every control the real checker must satisfy. Returns [] when all hold. */
function controls(script, tag) {
  const wrong = [];
  const r = runChecker(script, tag, estate);
  if (r.status !== 0) { wrong.push('advisory estate exited ' + r.status + ', expected 0 (advisory never blocks): ' + r.stderr.slice(0, 200)); return wrong; }
  let report;
  try { report = JSON.parse(readFileSync(join(tmp, tag + '.json'), 'utf8')); } catch (e) { return ['--json report unreadable: ' + String(e && e.message || e)]; }
  const got = report.rows.map((x) => x.id).sort();
  const want = ['syn-b-hashdrift', 'syn-c-missingwarn', 'syn-d-extrakey'].sort();
  if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push('advisory rows ' + JSON.stringify(got) + ' != ' + JSON.stringify(want));
  const byId = Object.fromEntries((report.rows || []).map((x) => [x.id, x]));
  const b = byId['syn-b-hashdrift'];
  if (!b || !b.hash || b.hash.inline !== HASH_B || b.hash.file !== HASH_A) wrong.push('syn-b-hashdrift: hash pair not reported as inline B / file A');
  const c = byId['syn-c-missingwarn'];
  if (!c || JSON.stringify(c.missing) !== '["warnings"]' || c.extra.length) wrong.push('syn-c-missingwarn: expected missing [warnings], extra []');
  const d = byId['syn-d-extrakey'];
  if (!d || JSON.stringify(d.extra) !== '["ghost"]' || d.missing.length) wrong.push('syn-d-extrakey: expected extra [ghost], missing []');
  if (report.totals.checked !== 8) wrong.push('totals.checked ' + report.totals.checked + ' != 8 (the no-literal page is name-checked then skipped)');
  const summary = r.stdout.split('\n').find((l) => l.includes('page(s) with mismatches')) || '';
  for (const needle of ['1 no-inline-MANIFEST', '1 no-manifest-file', '1 unreadable-manifest', '2 clean']) {
    if (!summary.includes(needle)) wrong.push('summary lacks skip count "' + needle + '"');
  }
  // Baseline: the three mismatching pages only, and byte-stable across runs.
  let bl;
  try { bl = JSON.parse(readFileSync(join(tmp, tag + '.baseline.json'), 'utf8')); } catch (e) { return wrong.concat(['baseline unreadable: ' + String(e && e.message || e)]); }
  const blIds = Object.keys(bl.pages || {}).sort();
  if (JSON.stringify(blIds) !== JSON.stringify(want)) wrong.push('baseline pages ' + JSON.stringify(blIds) + ' != the 3 mismatching pages');
  if (bl.pages['syn-c-missingwarn'] && JSON.stringify(bl.pages['syn-c-missingwarn'].schema_keys.missing) !== '["warnings"]') wrong.push('baseline: syn-c-missingwarn missing list wrong');
  if (bl.pages['syn-a-green'] || bl.pages['syn-e-absent'] || bl.pages['syn-f-noembed'] || bl.pages['syn-g-nofile'] || bl.pages['syn-h-unreadable']) wrong.push('baseline: holds a clean or skipped page');
  if (bl.totals.pages_with_mismatches !== 3 || bl.totals.hash_mismatches !== 1 || bl.totals.schema_key_pages !== 2) wrong.push('baseline totals wrong: ' + JSON.stringify(bl.totals));
  const again = runChecker(script, tag + '.again', estate);
  if (again.status !== 0) wrong.push('second baseline run exited ' + again.status);
  else {
    const b1 = readFileSync(join(tmp, tag + '.baseline.json'));
    const b2 = readFileSync(join(tmp, tag + '.again.baseline.json'));
    if (!b1.equals(b2)) wrong.push('baseline not byte-stable across two runs on an unchanged estate');
  }
  return wrong;
}

let failed = 0;
try {
  // RED: a deliberately broken checker (never records an advisory row) must be caught.
  const src = readFileSync(REAL, 'utf8');
  const broken = src.replace('advRows.push(', 'void (');
  if (broken === src) throw new Error('selftest cannot break the checker: marker `advRows.push(` not found');
  const brokenPath = join(tmp, 'broken-checker.mjs');
  writeFileSync(brokenPath, broken);
  const red = controls(brokenPath, 'red');
  if (red.length === 0) {
    console.error('RED control did not go red: the broken checker passed every control.');
    failed++;
  } else {
    console.log('RED  ok: broken checker detected (' + red.length + ' control(s) failed as they must)');
  }
  // GREEN: the real checker satisfies every control.
  const green = controls(REAL, 'green');
  if (green.length) {
    console.error('GREEN control failed:', green.join('; '));
    failed++;
  } else {
    console.log('GREEN ok: hash drift, missing warnings, extra key reported; green and skipped pages silent; baseline holds the 3 rows and is byte-stable; advisory estate exits 0');
  }
  // Blocking preserved: a name drift still exits 1 with the advisory section present.
  const driftRun = runChecker(REAL, 'drift', drift);
  const driftWrong = [];
  if (driftRun.status !== 1) driftWrong.push('drift estate exited ' + driftRun.status + ', expected 1');
  if (!driftRun.stderr.includes('syn-i-namedrift')) driftWrong.push('drift failure does not name the drifted node');
  if (!driftRun.stdout.includes('manifest-parity advisory')) driftWrong.push('advisory section missing from the blocking run');
  if (driftWrong.length) { console.error('GREEN drift control failed:', driftWrong.join('; ')); failed++; }
  else console.log('GREEN ok: planted name drift exits 1 and the advisory report still ships on that run');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
if (failed) { console.error('✗ manifest-parity selftest: ' + failed + ' control group(s) failed'); process.exit(1); }
console.log('✓ manifest-parity selftest: RED then GREEN');
