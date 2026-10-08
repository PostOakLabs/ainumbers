#!/usr/bin/env node
// backup-freshness.mjs — READ-ONLY: is every private/tracked repo on this box pushed and clean?
// Why: 348 internal files had no backup until 2026-09-09 (memory: 0xAlpha program). Nothing watched it.
// Output: one line per repo + a verdict line; writes farm/notes/BACKUP-FRESHNESS.md (append) unless --dry-run.
// Never pushes, never commits, never stashes. Exit 0 always (report-only; the Opus seat reads the verdict).
import { existsSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const WS = 'C:/dev/Claude/Projects';
const REPOS = [
  ['ainumbers-internal', `${WS}/AINumbers/ainumbers-internal`, 'master'],
  ['ainumbers-farm', `${WS}/AINumbers/farm`, 'main'],
  ['ainumbers-helm', `${WS}/AINumbers/helm`, 'main'],
  ['ainumbers-mcp-apps', `${WS}/AINumbers/mcp-apps-poc`, 'master'],
  ['ASIC', `${WS}/ASIC`, 'main'],
  ['ainumbers-evidence (workspace root)', `${WS}/AINumbers`, 'main'],
];
const STALE_H = 24;
const DRY = process.argv.includes('--dry-run');
const git = (dir, args) => { try { return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
const now = Date.now();
const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const lines = []; let bad = 0;
for (const [name, dir, br] of REPOS) {
  if (!existsSync(`${dir}/.git`)) { lines.push(`${name}: NO-REPO at ${dir}`); bad++; continue; }
  git(dir, ['fetch', '-q', 'origin']);
  const unpushed = (git(dir, ['rev-list', '--count', `origin/${br}..HEAD`]) ?? '?');
  const dirty = (git(dir, ['status', '--porcelain']) ?? '').split('\n').filter(Boolean).length;
  const lastPush = git(dir, ['log', `origin/${br}`, '-1', '--format=%cI']);
  const ageH = lastPush ? Math.round((now - Date.parse(lastPush)) / 3600000) : null;
  const lastLocal = git(dir, ['log', '-1', '--format=%cI']);
  const localAgeH = lastLocal ? Math.round((now - Date.parse(lastLocal)) / 3600000) : null;
  // stale = local work newer than the remote by more than STALE_H, or unpushed commits, or dirty files
  const stale = (Number(unpushed) > 0) || dirty > 0 || (ageH !== null && localAgeH !== null && ageH - localAgeH > STALE_H && Number(unpushed) > 0);
  if (stale) bad++;
  lines.push(`${name}: unpushed=${unpushed} dirty=${dirty} remote-head-age=${ageH ?? '?'}h local-head-age=${localAgeH ?? '?'}h ${stale ? 'STALE' : 'ok'}`);
}
const verdict = bad ? `BACKUP-STALE ${bad} repo(s) need a push or a commit — ${stamp}` : `backups fresh — ${stamp}`;
for (const l of lines) console.log(l);
console.log(verdict);
if (!DRY) appendFileSync(`${WS}/AINumbers/farm/notes/BACKUP-FRESHNESS.md`, `\n## ${stamp}\n${lines.map((l) => '- ' + l).join('\n')}\n${verdict}\n`);
