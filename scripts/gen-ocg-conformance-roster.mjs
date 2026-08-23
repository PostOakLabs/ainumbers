#!/usr/bin/env node
// gen-ocg-conformance-roster.mjs — derived-not-authored discipline for chaingraph/conformance-roster.html.
//
// The self-run entry on the roster claims "the §15 SSOT gate suite passes." That claim must be
// RECOMPUTED, not read off the page (SO #34 — a checker may never take the value it validates
// from the artifact under test). This script re-runs the three §15 SSOT validate-tier gates
// (schema-validate.mjs, spec-version-consistency.mjs, spec-gate-coverage.mjs — the trio
// repo/CLAUDE.md itself names as "the SSOT gates") live, every time, and either:
//   - (default) rewrites the GEN:ROSTER:AINUMBERS block with the fresh result, date, and commit; or
//   - (--check) fails if a live re-run does not independently reproduce a PASS matching what the
//     page currently claims — a genuine staleness/regression gate, not a format check.
//
// Zero-dependency. Run from the site repo root.
//   node scripts/gen-ocg-conformance-roster.mjs
//   node scripts/gen-ocg-conformance-roster.mjs --check

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PAGE = resolve(REPO, 'chaingraph', 'conformance-roster.html');
const STANDARD_DIR = resolve(REPO, 'chaingraph', 'standard');

// The §15 SSOT validate-tier gate trio (matches repo/CLAUDE.md's own citation of "the SSOT gates").
const GATES = [
  { id: 'schema-validate.mjs', file: 'schema-validate.mjs', summarize: summarizeSchemaValidate },
  { id: 'spec-version-consistency.mjs', file: 'spec-version-consistency.mjs', summarize: summarizeVersionConsistency },
  { id: 'spec-gate-coverage.mjs', file: 'spec-gate-coverage.mjs', summarize: summarizeGateCoverage },
];

function summarizeSchemaValidate(out) {
  const m = out.match(/(\d+) checked, (\d+) failed\./);
  return m ? `schema-validate.mjs: ${m[1]} checked, ${m[2]} failed` : 'schema-validate.mjs: (no summary line found)';
}
function summarizeVersionConsistency(out) {
  const m = out.match(/(\d+) surface\(s\) out of sync\./);
  return m ? `spec-version-consistency.mjs: ${m[1]} surface(s) out of sync` : 'spec-version-consistency.mjs: (no summary line found)';
}
function summarizeGateCoverage(out) {
  const ok = /every §15 rule maps to a real gate on disk/.test(out);
  return ok ? 'spec-gate-coverage.mjs: every §15 rule maps to a real gate on disk' : 'spec-gate-coverage.mjs: FAILED (gate not fully covered)';
}

function runGate(g) {
  try {
    const out = execFileSync(process.execPath, [g.file], { cwd: STANDARD_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ...g, pass: true, summary: g.summarize(out) };
  } catch (e) {
    const out = String((e.stdout || '') + (e.stderr || ''));
    return { ...g, pass: false, summary: g.summarize(out) || `${g.id}: FAILED (exit ${e.status})` };
  }
}

function specVersion() {
  // chaingraph.json.spec_version is the version-of-record (spec-version-consistency.mjs enforces
  // every other surface matches it) — read it from there, not a second parse of a rendered surface.
  const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
  return cg.spec_version || '(unknown)';
}

function headCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { cwd: REPO, env: gitEnv(), encoding: 'utf8' }).trim();
  } catch {
    return '(unknown)';
  }
}

const results = GATES.map(runGate);
const allPass = results.every((r) => r.pass);
const commit = headCommit();
const specV = specVersion();
const today = new Date().toISOString().slice(0, 10);

const page = readFileSync(PAGE, 'utf8');
const BLOCK_RE = /<!-- GEN:ROSTER:AINUMBERS:START[\s\S]*?GEN:ROSTER:AINUMBERS:END -->/;
if (!BLOCK_RE.test(page)) {
  console.error('gen-ocg-conformance-roster: GEN:ROSTER:AINUMBERS markers not found in conformance-roster.html');
  process.exit(2);
}

if (process.argv.includes('--check')) {
  // Staleness/regression gate: re-run the gates live and demand they independently reproduce
  // a PASS. It does NOT compare against the embedded date or commit (those are expected to
  // move every regen) — it recomputes the actual claim and fails if the claim no longer holds.
  if (!allPass) {
    console.error('gen-ocg-conformance-roster --check FAIL: the roster claims the §15 SSOT gate trio passes for AINumbers.co, but a live re-run does NOT reproduce that:');
    results.filter((r) => !r.pass).forEach((r) => console.error(`  FAIL: ${r.summary}`));
    console.error('Fix the underlying gate failure, or if the claim is now false, run: node scripts/gen-ocg-conformance-roster.mjs');
    process.exit(1);
  }
  console.log(`gen-ocg-conformance-roster --check: live re-run of all ${results.length} §15 SSOT gates independently reproduces PASS.`);
  process.exit(0);
}

if (!allPass) {
  console.error('gen-ocg-conformance-roster: refusing to write a PASS claim — a live gate run just failed:');
  results.filter((r) => !r.pass).forEach((r) => console.error(`  FAIL: ${r.summary}`));
  process.exit(1);
}

const block = `<!-- GEN:ROSTER:AINUMBERS:START (generator-owned -- do not hand-edit; regenerate via node scripts/gen-ocg-conformance-roster.mjs) -->
    <div class="roster-card">
      <h3>AINumbers.co</h3>
      <div class="roster-meta">
        <span><span class="lbl">Operated by</span> Post Oak Labs (self-run, not third-party)</span>
        <span><span class="lbl">spec_version</span> <code>${specV}</code></span>
        <span><span class="lbl">chaingraph_version</span> <code>0.4.0</code></span>
        <span><span class="lbl">Gate suite run</span> ${today}</span>
        <span class="status-pass"><span class="lbl">Result</span> PASS</span>
      </div>
      <p>The three §15 SSOT validate-tier gates (<code>schema-validate.mjs</code>, <code>spec-version-consistency.mjs</code>, <code>spec-gate-coverage.mjs</code>) ran clean on <code>main</code> at commit <code>${commit}</code>. This is a self-assessment, run and quoted below.</p>
      <div class="gate-quote">${results.map((r) => r.summary).join('\n')}
Head commit: ${commit}
Run date: ${today}</div>
      <p>Full CI preflight gate suite (every §15 <code>validate</code>-time gate plus this repository's own build-hygiene checks, in CI order) previously ran clean on <code>main</code> at commit <code>c4fdc28</code>: <a href="https://github.com/PostOakLabs/ainumbers/actions/runs/31350213988" target="_blank" rel="noopener">workflow run 31350213988</a>, 2026-08-10T02:35:38Z. Post-deploy gates (<code>hash-sweep.mjs</code>, <code>verify-mcp-registered.mjs</code>, <code>smoke-mcp.mjs</code>, <code>smoke-compute.mjs</code>) are covered separately by the deploy workflow; see <a href="https://github.com/PostOakLabs/ainumbers/actions/workflows/deploy-to-dreamhost.yml?query=branch%3Amain+is%3Asuccess" target="_blank" rel="noopener">Deploy to DreamHost runs on main ↗</a>.</p>
    </div>
    <!-- GEN:ROSTER:AINUMBERS:END -->`;

writeFileSync(PAGE, page.replace(BLOCK_RE, block));
console.log(`gen-ocg-conformance-roster: wrote fresh PASS entry (commit ${commit}, ${today}).`);
