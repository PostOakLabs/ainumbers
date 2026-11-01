#!/usr/bin/env node
/**
 * scripts/ci/run-gate.mjs — CI-THIN-YAML-1 (2026-11-01): the context resolver
 * for the named gates that land-verify.yml and scripts-verify.yml used to wire
 * inline. Each workflow step that needed computed values (an ephemeral derived
 * tree root, a pull_request-vs-merge_group event presentation) becomes a
 * one-line call to this script:
 *
 *     node scripts/ci/run-gate.mjs <gate-name>
 *
 * WHY: workflows change rarely and land by human merge (the automerge App has
 * no workflows permission BY DESIGN), so every byte that lives in
 * `.github/workflows/**` is a human-merge tax on the queue. Adding a gate to
 * DERIVED_ROOT_GATES, or changing WHICH tree a gate reads, is now a scripts/
 * change — the normal automerge path — never a YAML change.
 *
 * CONTEXT RESOLUTION (exactly what the YAML did, byte for byte):
 *   · event name  — GITHUB_EVENT_NAME (runner-reserved; the assembly steps'
 *     `if:` conditions key on the same value the gates' isMainContext() sees).
 *   · derived root — the merge_group / push-non-regen assembly step writes
 *     its scratch root into $RUNNER_TEMP/derived-root.txt (replacing the old
 *     `echo "root=..." >> $GITHUB_OUTPUT` plumbing). Empty when absent.
 *   · s18 root    — the pull_request §18 assembly step writes
 *     $RUNNER_TEMP/s18-derived-root.txt. Empty when absent.
 *
 * ⛔ BEHAVIOURAL PARITY IS THE CONTRACT: same gates, same order, same env
 * values, same GITHUB_EVENT_NAME presentation (the shell-level
 * `GITHUB_EVENT_NAME=push` / `=merge_group` overrides move here unchanged —
 * they select preflight.mjs's and the gates' existing rules; no rule moved),
 * same pass/fail on the same tree. No gate logic, threshold, baseline or
 * required-check name is touched here. The per-gate tables below are the
 * YAML's old run: bodies, transcribed.
 *
 * The fixture test beside this file proves the resolution table against both
 * contexts (pull_request and merge_group) by asserting the SAME env the old
 * YAML steps set. `--plan <gate>` prints the resolution instead of executing
 * it — the before/after parity harness.
 *
 * Usage:
 *   node scripts/ci/run-gate.mjs <gate-name>            exec the gate
 *   node scripts/ci/run-gate.mjs --plan <gate-name>     print the resolution
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function context() {
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const runnerTemp = process.env.RUNNER_TEMP || tmpdir();
  const readRoot = (f) => {
    const p = join(runnerTemp, f);
    if (!existsSync(p)) return '';
    const v = readFileSync(p, 'utf8').trim();
    return v;
  };
  return {
    eventName,
    derivedRoot: readRoot('derived-root.txt'),
    s18Root: readRoot('s18-derived-root.txt'),
  };
}

// ── the gate table ────────────────────────────────────────────────────────────
// Transcribed 1:1 from the two workflows as they stood at the CI-THIN-YAML-1
// base. `env` keys are exactly the step-level env entries that carried a
// COMPUTED value; literal env entries (PREFLIGHT_TIER_LEG, GITHUB_TOKEN,
// PR_BODY) stay in the YAML — they are constants or direct event mappings,
// not resolved context, and the caller's environment passes through untouched.
// `eventOverride` is the shell-level `GITHUB_EVENT_NAME=<v>` prefix the old
// run: bodies applied, reproduced verbatim.
const GATES = {
  // land-verify.yml — "Post-regen copy validators on the ephemeral tree
  // (merge_group, HARD)": env DERIVED_ROOT = steps.derived.outputs.root.
  'post-regen-copy-validators': {
    env: (c) => ({ DERIVED_ROOT: c.derivedRoot }),
    commands: [
      'node scripts/check-copy-hallmarks.mjs',
      'node scripts/check-shipped-prose.mjs',
      'node scripts/check-copy-hallmarks.mjs --source-shards',
    ],
  },
  // land-verify.yml — "§18 compute-proof coverage (HARD on pull_request)":
  // env DERIVED_ROOT = steps.derived.outputs.root || steps.s18tree.outputs.root;
  // on pull_request the body presented GITHUB_EVENT_NAME=push to the gate.
  's18-compute-proof-coverage': {
    env: (c) => ({ DERIVED_ROOT: c.derivedRoot || c.s18Root }),
    eventOverride: (c) => (c.eventName === 'pull_request' ? 'push' : null),
    commands: [
      'node scripts/check-compute-proof-coverage.mjs',
      'node scripts/check-compute-proof-coverage.test.mjs',
    ],
  },
  // land-verify.yml — "§18 digest-freshness ratchet": env S18_DERIVED_ROOT =
  // steps.s18tree.outputs.root (empty off pull_request). The step's third
  // command (check-s18-freshness-fixture-derived-root.test.mjs) stayed literal
  // in the YAML — it is context-independent and its basename must stay visible
  // in workflow text for check-workflow-gate-parity.mjs axis 3.
  's18-digest-freshness': {
    env: (c) => ({ S18_DERIVED_ROOT: c.s18Root }),
    commands: [
      'node scripts/check-s18-digest-freshness.mjs',
      'node scripts/check-s18-digest-freshness.test.mjs',
    ],
  },
  // land-verify.yml — "Count-drift gate": env DERIVED_ROOT =
  // steps.derived.outputs.root; the body called scripts/run-gate.mjs, which
  // keeps owning the PR-advisory / main-blocking split (SO #35). Delegation
  // preserved verbatim — this script resolves context, run-gate.mjs keeps the
  // verdict logic.
  'count-drift': {
    env: (c) => ({ DERIVED_ROOT: c.derivedRoot }),
    commands: [
      'node scripts/run-gate.mjs node scripts/verify-counts.mjs --check',
    ],
  },
  // land-verify.yml — "Derived-freshness, index-sync, sitemap (HARD on
  // merge_group)": env DERIVED_ROOT = steps.derived.outputs.root.
  'derived-freshness-verify': {
    env: (c) => ({ DERIVED_ROOT: c.derivedRoot }),
    commands: [
      'node scripts/derived-artifacts.mjs --verify',
    ],
  },
  // scripts-verify.yml — "Preflight (full gate suite)": env S18_DERIVED_ROOT =
  // steps.s18tree.outputs.root, DERIVED_ROOT = steps.derived.outputs.root; the
  // body presented GITHUB_EVENT_NAME=merge_group to preflight whenever the
  // scratch tree was mounted (preflight's merge_group hard-gate rules).
  'preflight': {
    env: (c) => ({ S18_DERIVED_ROOT: c.s18Root, DERIVED_ROOT: c.derivedRoot }),
    eventOverride: (c) => (c.derivedRoot ? 'merge_group' : null),
    commands: [
      'node scripts/preflight.mjs',
    ],
  },
  // scripts-verify.yml — "§18 ratchet + provenance (HARD on pull_request)":
  // env S18_DERIVED_ROOT = steps.s18tree.outputs.root; GITHUB_EVENT_NAME=push
  // presentation on pull_request (the per-PR derivables promotion).
  's18-ratchet': {
    env: (c) => ({ S18_DERIVED_ROOT: c.s18Root }),
    eventOverride: (c) => (c.eventName === 'pull_request' ? 'push' : null),
    commands: [
      'node scripts/check-compute-proof-coverage.mjs',
    ],
  },
  // scripts-verify.yml — "Node page accessibility tree": env DERIVED_ROOT =
  // (merge_group ? steps.derived.outputs.root : '').
  'a11y-tree': {
    env: (c) => ({ DERIVED_ROOT: c.eventName === 'merge_group' ? c.derivedRoot : '' }),
    commands: [
      'node scripts/check-a11y-tree.mjs',
    ],
  },
};

export { GATES, context };

function plan(name) {
  const gate = GATES[name];
  if (!gate) {
    console.error(`run-gate.mjs: unknown gate '${name}'. Known: ${Object.keys(GATES).join(', ')}`);
    process.exit(2);
  }
  const c = context();
  const env = gate.env(c);
  const override = gate.eventOverride ? gate.eventOverride(c) : null;
  return { name, eventName: c.eventName, derivedRoot: c.derivedRoot, s18Root: c.s18Root, env, eventOverride: override, commands: gate.commands };
}

// ── --self-test ───────────────────────────────────────────────────────────────
// Context-resolution matrix without executing any gate: for pull_request and
// merge_group-shaped environments (with and without the assembly roots on
// disk), the resolved env must equal exactly what the old YAML steps set.
function selfTest() {
  let passed = 0, failed = 0;
  const test = (name, fn) => {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + ' — ' + (e?.message || e)); failed++; }
  };
  const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
  const KEYS = ['GITHUB_EVENT_NAME', 'RUNNER_TEMP'];
  function withEnv(overrides, fn) {
    const saved = {};
    for (const k of KEYS) { saved[k] = process.env[k]; if (overrides[k] === undefined) delete process.env[k]; else process.env[k] = overrides[k]; }
    try { return fn(); } finally { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
  }
  function inTemp(overrides, files, fn) {
    const dir = mkdtempSync(join(tmpdir(), 'run-gate-test-'));
    for (const [f, v] of Object.entries(files)) writeFileSync(join(dir, f), v + '\n');
    try { return withEnv({ ...overrides, RUNNER_TEMP: dir }, fn); }
    finally { rmSync(dir, { recursive: true, force: true }); }
  }
  const savedArgv = process.argv;
  const planOf = (gate) => {
    process.argv = ['node', 'run-gate.mjs', '--plan', gate];
    // plan() reads argv below via main(); here call the exported resolver path
    // by re-importing is overkill — invoke plan through the module table.
    const c = context();
    const g = GATES[gate];
    const env = g.env(c);
    const eventOverride = g.eventOverride ? g.eventOverride(c) : null;
    return { env, eventOverride, commands: g.commands };
  };

  test('pull_request: s18-compute-proof-coverage reads the s18 tree and presents push', () =>
    inTemp({ GITHUB_EVENT_NAME: 'pull_request' }, { 's18-derived-root.txt': '/t/s18' }, () => {
      const p = planOf('s18-compute-proof-coverage');
      assert(p.env.DERIVED_ROOT === '/t/s18', JSON.stringify(p.env));
      assert(p.eventOverride === 'push', String(p.eventOverride));
      assert(p.commands.length === 2, 'two commands');
    }));
  test('merge_group: s18-compute-proof-coverage reads the derived tree, no override', () =>
    inTemp({ GITHUB_EVENT_NAME: 'merge_group' }, { 'derived-root.txt': '/t/derived' }, () => {
      const p = planOf('s18-compute-proof-coverage');
      assert(p.env.DERIVED_ROOT === '/t/derived', JSON.stringify(p.env));
      assert(p.eventOverride === null, String(p.eventOverride));
    }));
  test('pull_request: preflight leaves DERIVED_ROOT empty (committed tree, unchanged)', () =>
    inTemp({ GITHUB_EVENT_NAME: 'pull_request' }, { 's18-derived-root.txt': '/t/s18' }, () => {
      const p = planOf('preflight');
      assert(p.env.DERIVED_ROOT === '', JSON.stringify(p.env));
      assert(p.env.S18_DERIVED_ROOT === '/t/s18', JSON.stringify(p.env));
      assert(p.eventOverride === null, String(p.eventOverride));
    }));
  test('merge_group: preflight presents merge_group with the scratch root', () =>
    inTemp({ GITHUB_EVENT_NAME: 'merge_group' }, { 'derived-root.txt': '/t/derived' }, () => {
      const p = planOf('preflight');
      assert(p.env.DERIVED_ROOT === '/t/derived', JSON.stringify(p.env));
      assert(p.eventOverride === 'merge_group', String(p.eventOverride));
    }));
  test('merge_group: a11y-tree gets the derived root', () =>
    inTemp({ GITHUB_EVENT_NAME: 'merge_group' }, { 'derived-root.txt': '/t/derived' }, () => {
      const p = planOf('a11y-tree');
      assert(p.env.DERIVED_ROOT === '/t/derived', JSON.stringify(p.env));
    }));
  test('pull_request: a11y-tree keeps the committed checkout (empty root)', () =>
    inTemp({ GITHUB_EVENT_NAME: 'pull_request' }, { 'derived-root.txt': '/t/derived' }, () => {
      const p = planOf('a11y-tree');
      assert(p.env.DERIVED_ROOT === '', JSON.stringify(p.env));
    }));
  test('push non-regen: preflight gets the derived root and merge_group presentation', () =>
    inTemp({ GITHUB_EVENT_NAME: 'push' }, { 'derived-root.txt': '/t/derived' }, () => {
      const p = planOf('preflight');
      assert(p.env.DERIVED_ROOT === '/t/derived', JSON.stringify(p.env));
      assert(p.eventOverride === 'merge_group', String(p.eventOverride));
    }));
  test('no roots on disk: every gate resolves empty roots (committed tree)', () =>
    inTemp({ GITHUB_EVENT_NAME: 'push' }, {}, () => {
      for (const gate of Object.keys(GATES)) {
        const p = planOf(gate);
        for (const [k, v] of Object.entries(p.env)) assert(v === '', `${gate}.${k} = ${JSON.stringify(v)}`);
        assert(p.eventOverride === null, `${gate} override = ${String(p.eventOverride)}`);
      }
    }));
  test('missing root file reads as empty, never throws', () =>
    inTemp({ GITHUB_EVENT_NAME: 'merge_group' }, {}, () => {
      const p = planOf('count-drift');
      assert(p.env.DERIVED_ROOT === '', JSON.stringify(p.env));
    }));
  process.argv = savedArgv;
  console.log(`run-gate.mjs --self-test: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === '--self-test') { selfTest(); return; }
  let name = argv[0];
  let printOnly = false;
  if (name === '--plan') { printOnly = true; name = argv[1]; }
  if (!name) {
    console.error('usage: node scripts/ci/run-gate.mjs [--plan] <gate-name>');
    process.exit(2);
  }
  const p = plan(name);
  if (printOnly) {
    console.log(JSON.stringify(p, null, 2));
    return;
  }
  const env = { ...process.env, ...p.env };
  if (p.eventOverride) env.GITHUB_EVENT_NAME = p.eventOverride;
  for (const cmd of p.commands) {
    console.log(`[run-gate] ${p.eventOverride ? `GITHUB_EVENT_NAME=${p.eventOverride} ` : ''}${cmd}`);
    execSync(cmd, { cwd: SCRIPTS, env, stdio: 'inherit' });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
