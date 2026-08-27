#!/usr/bin/env node
/**
 * .githooks/pre-push.test.mjs — fixture proof for PREREQ-EXPECTRED-FLAG-1.
 *
 * The builder contract (0xAlpha/audits/BUILDER-CONTRACT-DRAFT.md §2, ":139-:143")
 * states: "if your row's diff is red on a branch purely because its target exists
 * only on an unmerged branch/shard ... you push normally; the hook accepts a
 * declared --expect-red per invocation." scripts/preflight.mjs has carried the
 * matching `--expect-red <gate-id>` flag since PREFLIGHT-KEEPGOING-1 (2026-08-15,
 * #1283); this file proves the HOOK-side half added by this row: forwarding a
 * per-invocation declaration (env var AINUM_EXPECT_RED, never a file) into that
 * flag, disclosing it in the push output, and logging it as an override event —
 * without ever letting the declaration wave through a red gate it did not name.
 *
 * What it proves (red-before-green, per the row's own "PROVE IT" discipline):
 *   1. DEFAULT PATH UNCHANGED — no AINUM_EXPECT_RED set ⇒ preflight is invoked
 *      with exactly the same argv as before this row (`--changed origin/main`,
 *      nothing appended).
 *   2. PARSING — a comma-separated declaration (with stray whitespace) becomes
 *      one `--expect-red <id>` pair per id, in order, forwarded to preflight.
 *   3. GREEN CONTROL — a declared id + preflight exiting 0 (the by-construction
 *      shape: the named gate was the only red, and it waived) ⇒ the hook exits
 *      0, the output names the accepted gate ("ACCEPTED ... [id]"), and an
 *      override event with denied:false is appended to the metrics log.
 *   4. RED CONTROL (load-bearing) — a declaration is present but preflight still
 *      exits non-zero (the real gate suite's own guarantee: any gate NOT
 *      substring-matched by a declared id stays FAIL and fails the run) ⇒ the
 *      hook STILL BLOCKS (non-zero exit, the unchanged "push blocked" message),
 *      and the override event is logged with denied:true. If this ever passed
 *      with denied:false, --expect-red would be --no-verify with a nicer name.
 *   5. NO PERSISTENCE — a second, unflagged invocation (AINUM_EXPECT_RED unset)
 *      against the same red mock preflight blocks exactly as it did before this
 *      row existed, and appends NOTHING to the metrics log — proving nothing
 *      was written to disk by the flagged run that outlives its own process.
 *   6. DISCLOSURE SHAPE — the appended line is valid JSON carrying gate,
 *      mechanism, row and denied fields, so a later reader can fold it into
 *      GUARDRAIL-METRICS.jsonl mechanically, not by trusting a session's memory.
 *
 * This never touches the real scripts/preflight.mjs (a mock stands in, see
 * below) and never touches the real board/reference/GUARDRAIL-METRICS.jsonl
 * (AINUM_GUARDRAIL_METRICS_PATH points the hook at a sandboxed file instead —
 * a test-only override documented in the hook itself). Everything runs inside
 * a fresh, short-lived temp directory per SO #55 (never a shared temp path).
 *
 * Usage: node .githooks/pre-push.test.mjs
 * Exit 0 = every assertion passed. Exit 1 = a fixture assertion failed.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK_SRC = fileURLToPath(new URL('./pre-push', import.meta.url));

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log(`✓ ${msg}`); }
  else { failures++; console.log(`✗ ${msg}`); }
}

const MOCK_PREFLIGHT = `#!/usr/bin/env node
// Mock stand-in for scripts/preflight.mjs — this test proves the HOOK's
// forwarding/disclosure logic, never the real gate suite (out of this row's
// fence: "Zero gate semantics").
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
writeFileSync(process.env.MOCK_ARGV_DUMP, JSON.stringify(args));
console.log('mock preflight received: ' + args.join(' '));
process.exit(process.env.MOCK_PREFLIGHT_EXIT ? Number(process.env.MOCK_PREFLIGHT_EXIT) : 0);
`;

// Fresh, short-lived, session-private sandbox per SO #55 — never a shared temp path.
function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'ain-eR-'));
  mkdirSync(join(dir, '.githooks'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  const hookDst = join(dir, '.githooks', 'pre-push');
  writeFileSync(hookDst, readFileSync(HOOK_SRC, 'utf8'));
  chmodSync(hookDst, 0o755);
  writeFileSync(join(dir, 'scripts', 'preflight.mjs'), MOCK_PREFLIGHT);
  return dir;
}

// Runs the sandboxed hook exactly as `git push` would invoke it: cwd at the
// repo root, refs on stdin (empty is fine — reconcile-guard.mjs is absent so
// that whole block is skipped), env is the ONLY declaration channel.
function runHook(dir, envOverrides) {
  const argvDump = join(dir, 'argv-dump.json');
  const metricsFile = join(dir, 'metrics.jsonl');
  const res = spawnSync('bash', ['.githooks/pre-push'], {
    cwd: dir,
    input: '',
    env: {
      ...process.env,
      MOCK_ARGV_DUMP: argvDump,
      AINUM_GUARDRAIL_METRICS_PATH: metricsFile,
      // Explicitly unset — a leaked value from the outer shell must never
      // leak into a scenario that expects it absent (the no-persistence check).
      AINUM_EXPECT_RED: '',
      AINUM_EXPECT_RED_ROW: '',
      ...envOverrides,
    },
    encoding: 'utf8',
  });
  let argv = null;
  if (existsSync(argvDump)) { try { argv = JSON.parse(readFileSync(argvDump, 'utf8')); } catch { /* leave null */ } }
  let metricsLines = [];
  if (existsSync(metricsFile)) {
    metricsLines = readFileSync(metricsFile, 'utf8').split('\n').filter((l) => l.trim().length);
  }
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '', argv, metricsFile, metricsLines };
}

// ── 1. DEFAULT PATH UNCHANGED ────────────────────────────────────────────
{
  const dir = makeSandbox();
  writeFileSync(join(dir, 'metrics.jsonl'), ''); // exists but empty — file must exist for the hook's `[ -f ]` guard
  const r = runHook(dir, { MOCK_PREFLIGHT_EXIT: '0' });
  assert(r.status === 0, 'default path (no AINUM_EXPECT_RED): hook exits 0 on a green mock preflight');
  assert(JSON.stringify(r.argv) === JSON.stringify(['--changed', 'origin/main']),
    `default path forwards nothing extra to preflight (got ${JSON.stringify(r.argv)})`);
  assert(r.metricsLines.length === 0, 'default path appends nothing to the metrics log');
  rmSync(dir, { recursive: true, force: true });
}

// ── 2. PARSING — comma-separated ids, stray whitespace, order preserved ──
{
  const dir = makeSandbox();
  writeFileSync(join(dir, 'metrics.jsonl'), '');
  const r = runHook(dir, { AINUM_EXPECT_RED: ' gate-a ,gate-b ', MOCK_PREFLIGHT_EXIT: '0' });
  const expected = ['--changed', 'origin/main', '--expect-red', 'gate-a', '--expect-red', 'gate-b'];
  assert(JSON.stringify(r.argv) === JSON.stringify(expected),
    `comma-separated declaration becomes one --expect-red pair per id, trimmed, in order (got ${JSON.stringify(r.argv)})`);
  rmSync(dir, { recursive: true, force: true });
}

// ── 3. GREEN CONTROL — declared id, preflight accepts, push proceeds ─────
let greenDenied;
{
  const dir = makeSandbox();
  writeFileSync(join(dir, 'metrics.jsonl'), '');
  const r = runHook(dir, { AINUM_EXPECT_RED: 'CGSHARD-1', AINUM_EXPECT_RED_ROW: 'TEST-ROW-1', MOCK_PREFLIGHT_EXIT: '0' });
  assert(r.status === 0, 'GREEN control: by-construction red + --expect-red ⇒ push proceeds (exit 0)');
  assert(/ACCEPTED/.test(r.stdout) && r.stdout.includes('CGSHARD-1'),
    'GREEN control: output names the accepted gate ("ACCEPTED ... [CGSHARD-1]")');
  assert(r.metricsLines.length === 1, `GREEN control: exactly one override event appended (got ${r.metricsLines.length})`);
  let parsed = null;
  try { parsed = JSON.parse(r.metricsLines[0]); } catch { /* leave null, assertion below fails */ }
  assert(parsed !== null, 'GREEN control: appended line is valid JSON');
  if (parsed) {
    assert(parsed.gate === 'CGSHARD-1', `GREEN control: logged gate matches declaration (got ${parsed.gate})`);
    assert(parsed.mechanism === '--expect-red', 'GREEN control: logged mechanism is --expect-red');
    assert(parsed.row === 'TEST-ROW-1', 'GREEN control: logged row matches AINUM_EXPECT_RED_ROW');
    assert(parsed.denied === false, 'GREEN control: logged denied:false — the declaration was accepted, not blocked');
    greenDenied = parsed.denied;
  }
  rmSync(dir, { recursive: true, force: true });
}

// ── 4. RED CONTROL — declaration present, a genuine defect still blocks ──
// (This is the load-bearing control per the row: if this ever exits 0, the
// flag is --no-verify with a nicer name.)
{
  const dir = makeSandbox();
  writeFileSync(join(dir, 'metrics.jsonl'), '');
  const r = runHook(dir, { AINUM_EXPECT_RED: 'CGSHARD-1', MOCK_PREFLIGHT_EXIT: '1' });
  assert(r.status !== 0, 'RED control: declaration present + preflight still red ⇒ push STILL BLOCKS (non-zero exit)');
  assert(/preflight FAILED — push blocked/.test(r.stdout + r.stderr),
    'RED control: the unchanged "push blocked" message is present');
  assert(/did NOT clear/.test(r.stdout + r.stderr),
    'RED control: hook-level disclosure explains the declaration did not clear the push');
  assert(r.metricsLines.length === 1, `RED control: the attempt is still logged as an override event (got ${r.metricsLines.length})`);
  if (r.metricsLines.length === 1) {
    const parsed = JSON.parse(r.metricsLines[0]);
    assert(parsed.denied === true, 'RED control: logged denied:true — the declaration did NOT waive the block');
  }
  assert(greenDenied === false, 'sanity: GREEN and RED controls produced opposite denied values');
  rmSync(dir, { recursive: true, force: true });
}

// ── 5. NO PERSISTENCE — a second, unflagged push against the same red mock
//      blocks exactly as before this row, and writes nothing to the metrics log
{
  const dir = makeSandbox();
  writeFileSync(join(dir, 'metrics.jsonl'), '');
  // First: a flagged push (declaration made, still denied per RED control).
  const flagged = runHook(dir, { AINUM_EXPECT_RED: 'CGSHARD-1', MOCK_PREFLIGHT_EXIT: '1' });
  assert(flagged.status !== 0, 'no-persistence setup: the flagged push still blocked (RED control, repeated)');
  const linesAfterFlagged = flagged.metricsLines.length;
  // Second: an ordinary push, no flag at all — must behave exactly like a
  // pre-existing, never-touched-by-this-row push against the same red gate.
  const plain = runHook(dir, { MOCK_PREFLIGHT_EXIT: '1' });
  assert(plain.status !== 0, 'NO PERSISTENCE: a second push with no flag still blocks (nothing carried over)');
  assert(JSON.stringify(plain.argv) === JSON.stringify(['--changed', 'origin/main']),
    'NO PERSISTENCE: the unflagged push forwards no --expect-red args (no state survived)');
  assert(plain.metricsLines.length === linesAfterFlagged,
    `NO PERSISTENCE: the unflagged push appended nothing new to the metrics log (had ${linesAfterFlagged}, now ${plain.metricsLines.length})`);
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${failures === 0 ? '✅' : '❌'} ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
