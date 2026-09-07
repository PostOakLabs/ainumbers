#!/usr/bin/env node
/**
 * scripts/check-llms-lighthouse.mjs
 *
 * LLMS-TXT-AGENTIC-1: advisory preflight for Chrome Lighthouse's llms.txt
 * audit (agentic-browsing category) against the local llms.txt.
 *
 * Contract (AGENT-REACH-BUILD-SPEC §3.11):
 *   - never installs anything (SO #10 / no npm): if a `lighthouse` binary is
 *     already on PATH it is used; otherwise this prints SKIP and exits 0.
 *   - ADVISORY, exit 0 in every path. The mechanical gate for the llms.txt
 *     agentic block is the derived-artifact freshness check
 *     (`node scripts/gen-estate-map.mjs --check`, COVERED id estate-map).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const LLMS_PATH = resolve(REPO, 'llms.txt');

function findLighthouse() {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  try {
    const out = execFileSync(probe, ['lighthouse'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const first = out.trim().split(/\r?\n/).filter(Boolean)[0];
    return first || null;
  } catch {
    return null;
  }
}

function main() {
  const bin = findLighthouse();
  if (!bin) {
    console.log('llms.txt Lighthouse audit: SKIP (no local lighthouse)');
    return;
  }

  // Local file audit: Lighthouse wants a URL; serve nothing, use the file
  // directly. If the installed Lighthouse build rejects file:// or lacks the
  // llms.txt audit, report SKIP — advisory, never blocking, never installed.
  const outDir = mkdtempSync(join(tmpdir(), 'llms-lh-'));
  const outPath = join(outDir, 'report.json');
  try {
    const r = spawnSync(bin, [
      LLMS_PATH,
      '--only-audits=llms-txt',
      '--output=json',
      `--output-path=${outPath}`,
      '--quiet',
      '--chrome-flags=--headless',
    ], { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'ignore', 'pipe'] });

    if (r.status !== 0) {
      const err = (r.stderr || '').trim().split('\n').filter(Boolean).pop() || `exit ${r.status}`;
      console.log(`llms.txt Lighthouse audit: SKIP (lighthouse ran but did not produce a report: ${err})`);
      return;
    }
    const report = JSON.parse(readFileSync(outPath, 'utf8'));
    const audit = report.audits && report.audits['llms-txt'];
    if (!audit || audit.score === null || audit.score === undefined) {
      console.log('llms.txt Lighthouse audit: SKIP (report carried no llms-txt audit result)');
      return;
    }
    const score = Math.round(audit.score * 100);
    console.log(`llms.txt Lighthouse audit (agentic-browsing): score ${score}/100 - ${audit.displayValue || audit.title}`);
  } catch (e) {
    console.log(`llms.txt Lighthouse audit: SKIP (${e.message.split('\n')[0]})`);
  } finally {
    try { rmSync(outDir, { recursive: true, force: true }); } catch { /* temp only */ }
  }
}

main();
process.exitCode = 0;
