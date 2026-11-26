#!/usr/bin/env node
// REGEN-PRECOMMIT-DERIVED-READERS-1: run the class-(ii) gates (the ones that
// READ the regenerated monolith or derived set) against the tree
// derived-artifacts-regen.yml just wrote, before "Commit and push".
//
// MODE (env REGEN_READER_MODE, default `loud`):
//   loud   - a red emits `::error title=[REGEN-RED-READER] <gate>::<first
//            finding>`, a job-summary table, and a `red=true` step output, then
//            exits 0 so the regen still commits. Same doctrine as the CONTENT
//            RED branch of the fixpoint step: refusing would freeze every other
//            covered artifact, main's downstream gates and the deploy (they run
//            only on a successful regen) on top of an already-red main.
//   refuse - exits 1 after posting `[REGEN-REFUSED] <gate>`, like the CONTRACT
//            1.4 copy leg. Tim-only; the workflow never sets it by default.
//
// A gate script missing on this tree is skipped and listed, never a red.
// Usage: node scripts/regen-reader-leg.mjs            run the leg
//        node scripts/regen-reader-leg.mjs --self-test
import { spawnSync } from 'node:child_process';
import { existsSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// [gate script, args]. Spellings follow scripts/preflight.mjs GATES.
export const READER_GATES = [
  ['check-webmcp-chain-execute', []],
  ['check-chain-domain', []],
  ['check-chain-step-status', []],
  ['check-chain-edge-contracts', ['--quiet']],
  ['check-chain-l2-contracts', ['--quiet']],
  ['check-showcase-prompts', []],
  ['check-kernel-coverage', []],
  ['check-manifest-parity', []],
  ['check-proof-badge', []],
  ['check-output-schema-coverage', []],
  ['check-recompute-equality', []],
  ['check-ledger-proof-parity', []],
  ['check-showcase-callshape', []],
  ['check-ask-agent-block', []],
  ['check-schema-read-divergence', ['--summary']],
  ['check-webmcp-name-uniqueness', []],
  ['check-trust-signals', []],
];

/** First line that names a finding: skips blanks and shell/group noise. */
export function firstFinding(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const hit = lines.find((l) => /red|fail|error|missing|mismatch|stale|\bnot\b|drift|diverg/i.test(l));
  return (hit || lines[0] || '(no output; exit code only)').slice(0, 300);
}

/**
 * Run every gate through `exec(script, args) -> {status, out}`. Pure of process
 * state so the self-test can drive it with a fake executor.
 */
export function runLeg({ gates = READER_GATES, exec, exists = () => true }) {
  const results = [];
  for (const [gate, args] of gates) {
    if (!exists(gate)) { results.push({ gate, state: 'skipped', finding: 'script not present on this tree' }); continue; }
    const r = exec(gate, args);
    results.push(r.status === 0
      ? { gate, state: 'green', finding: '' }
      : { gate, state: 'red', finding: firstFinding(r.out) });
  }
  return results;
}

export function summaryTable(results) {
  const rows = results.map((r) => `| \`${r.gate}\` | ${r.state} | ${r.finding.replace(/\|/g, '\\|')} |`);
  return ['## Monolith readers on the regenerated tree', '', '| gate | state | first finding |', '|---|---|---|', ...rows, ''].join('\n');
}

function realExec(gate, args) {
  const r = spawnSync(process.execPath, [resolve(ROOT, 'scripts', `${gate}.mjs`), ...args], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return { status: r.status === null ? 1 : r.status, out: `${r.stdout || ''}\n${r.stderr || ''}` };
}

function selfTest() {
  const fake = (red) => (g) => (red.has(g) ? { status: 1, out: `\n${g}: 3 NEW chain(s) fail execute\n` } : { status: 0, out: '' });
  const ok = runLeg({ exec: fake(new Set()) });
  const bad = runLeg({ exec: fake(new Set(['check-webmcp-chain-execute'])) });
  const gone = runLeg({ exec: fake(new Set()), exists: (g) => g !== 'check-proof-badge' });
  const checks = [
    ['all-green leg has 17 green rows', ok.length === 17 && ok.every((r) => r.state === 'green')],
    ['one red gate is reported with its finding', bad.filter((r) => r.state === 'red').length === 1 && /3 NEW/.test(bad[0].finding)],
    ['a missing script is skipped, not red', gone.find((r) => r.gate === 'check-proof-badge').state === 'skipped'],
    ['table escapes pipes', summaryTable([{ gate: 'g', state: 'red', finding: 'a|b' }]).includes('a\\|b')],
  ];
  let badCount = 0;
  for (const [name, pass] of checks) { console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}`); if (!pass) badCount++; }
  process.exit(badCount ? 1 : 0);
}

function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const mode = process.env.REGEN_READER_MODE === 'refuse' ? 'refuse' : 'loud';
  const results = runLeg({ exec: realExec, exists: (g) => existsSync(resolve(ROOT, 'scripts', `${g}.mjs`)) });
  const reds = results.filter((r) => r.state === 'red');
  const skipped = results.filter((r) => r.state === 'skipped').map((r) => r.gate);
  const md = summaryTable(results);
  console.log(md);
  if (skipped.length) console.log(`skipped (not on this tree): ${skipped.join(', ')}`);
  for (const r of reds) {
    console.log(mode === 'refuse'
      ? `::error title=[REGEN-REFUSED] ${r.gate}::${r.finding}`
      : `::error title=[REGEN-RED-READER] ${r.gate}::${r.finding}`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `red=${reds.length ? 'true' : 'false'}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `first_line=${reds.length ? `${reds[0].gate}: ${reds[0].finding}`.replace(/[\r\n]+/g, ' ') : ''}\n`);
  }
  console.log(`mode: ${mode}; ${reds.length} red of ${results.length - skipped.length} run.`);
  process.exit(mode === 'refuse' && reds.length ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
