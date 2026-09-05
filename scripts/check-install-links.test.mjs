#!/usr/bin/env node
// scripts/check-install-links.test.mjs - MCP-INSTALL-LINKS-1 mutation self-test
// (GATE-SELFTEST-META-1 pair for check-install-links.mjs). Copies the gate and
// its two subject pages into a throwaway fixture tree, proves GREEN untampered,
// then proves RED for each mutation: one base64 char flipped (cursor), one
// URL-encoded char flipped (vscode), one param value changed (goose), and an
// anchor deleted.
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'install-links-test-'));
mkdirSync(join(tmp, 'scripts'));
copyFileSync(join(ROOT, 'scripts', 'check-install-links.mjs'), join(tmp, 'scripts', 'check-install-links.mjs'));
copyFileSync(join(ROOT, 'scripts', 'gen-install-links.mjs'), join(tmp, 'scripts', 'gen-install-links.mjs'));
for (const p of ['mcp.html', 'start.html']) copyFileSync(join(ROOT, p), join(tmp, p));

const run = () => {
  try { execFileSync(process.execPath, [join(tmp, 'scripts', 'check-install-links.mjs')], { cwd: tmp, stdio: 'pipe' }); return 0; }
  catch (e) { return e.status ?? 1; }
};
const fail = (m) => { console.error('check-install-links.test: FAIL\n  X ' + m); rmSync(tmp, { recursive: true, force: true }); process.exit(1); };

if (run() !== 0) fail('untampered fixture did not pass');

function tamper(page, from, to) {
  const f = join(tmp, page);
  const html = readFileSync(f, 'utf8');
  if (!html.includes(from)) fail('tamper source string not found in ' + page);
  writeFileSync(f, html.replace(from, to));
}
function restore(page) { copyFileSync(join(ROOT, page), join(tmp, page)); }

// cursor: flip one base64 char (last sig char of .../mcp -> /mcq)
tamper('mcp.html', 'bWNwIn0=', 'bWNxIn0=');
if (run() === 0) fail('tampered cursor base64 was NOT caught');
restore('mcp.html');
// vscode: flip one URL-encoded char (%2Fmcp -> %2Fmcq)
tamper('start.html', '%2Fmcp%22%7D', '%2Fmcq%22%7D');
if (run() === 0) fail('tampered vscode payload was NOT caught');
restore('start.html');
// goose: change the url param
tamper('start.html', 'url=https%3A%2F%2Fmcp.ainumbers.co%2Fmcp', 'url=https%3A%2F%2Fmcp.ainumbers.co%2Fother');
if (run() === 0) fail('tampered goose url was NOT caught');
restore('start.html');
// missing anchor: delete the cursor anchor line from start.html
tamper('start.html', '<p style="margin:.2rem 0"><a href="cursor://anysphere.cursor-deeplink/mcp/install?name=ainumbers&amp;config=eyJ1cmwiOiJodHRwczovL21jcC5haW51bWJlcnMuY28vbWNwIn0=" data-install-link="cursor">Add to Cursor</a></p>', '');
if (run() === 0) fail('missing goose anchor was NOT caught');
restore('start.html');

if (run() !== 0) fail('restored fixture did not pass again');

rmSync(tmp, { recursive: true, force: true });
console.log('check-install-links.test: GREEN - untampered GREEN; cursor/vscode/goose/missing-anchor mutations each RED');
