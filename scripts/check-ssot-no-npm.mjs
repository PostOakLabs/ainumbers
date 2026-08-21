#!/usr/bin/env node
// check-ssot-no-npm.mjs — fail the build if a normative SSOT doc regresses into
// telling a claimant to run `npm run` / `npm ci` / `npm install`.
//
// Neither repo has a runnable npm path for a claimant: the site repo carries no
// package.json at all (CONTRACT.md §0, zero-dependency by design), and the worker
// repo's package.json is Dependabot's, never a claimant's — board/STANDING-ORDERS.md
// #10 bans running npm in either repo, full stop. So any of these three strings
// inside one of these docs is, by construction, an unrunnable instruction — the
// gate exists so that never happens silently again.
//
// Born from CONTRACT-DEADCMD-FIX-1 (2026-08-21, 0xAlpha/2026-08-21-mechanical-
// verification-audit.md Finding 1 / Rec A2): CONTRACT.md §6.2 told readers to run
// `npm run lint:manifests` / `npm run test:ap2-exports` / `npm run test:ui-ap2-
// placement`, and §2.5's chain-integrity validator instructions carried `npm run
// validate:chains` twice (an inline alternative + a standalone invocation) — five
// dead sites total, none runnable as written.
//
// Zero-dependency by design (repo convention, CONTRACT.md §0): a literal grep
// over a fixed small file list, no deps, no schema.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

// The normative/onboarding SSOT docs a claimant or agent is told to treat as
// authoritative build instructions. Scanning all four means a dead command can't
// hide in whichever one nobody happened to check.
const FILES = ['CONTRACT.md', 'CLAUDE.md', 'AGENTS.md', 'CONTRIBUTING.md'];
const FORBIDDEN = ['npm run', 'npm ci', 'npm install'];

const hits = [];
for (const file of FILES) {
  let text;
  try {
    text = readFileSync(resolve(REPO, file), 'utf8');
  } catch {
    continue; // file absent from this checkout — nothing to scan
  }
  text.split('\n').forEach((line, i) => {
    for (const needle of FORBIDDEN) {
      if (line.includes(needle)) {
        hits.push(`${file}:${i + 1}: contains "${needle}" — ${line.trim().slice(0, 110)}`);
      }
    }
  });
}

if (hits.length) {
  console.error(`✗ check-ssot-no-npm FAILED (${hits.length} hit(s)) — a normative SSOT doc instructs a command neither repo can run:`);
  for (const h of hits) console.error('  • ' + h);
  console.error('\nNo runnable npm path exists for a claimant in either repo (board/STANDING-ORDERS.md #10): the site repo');
  console.error('has no package.json at all; the worker repo\'s package.json is Dependabot\'s. Replace the instruction with the');
  console.error('real zero-dependency invocation (node scripts/*.mjs, python scripts/*.py) — see CONTRACT-DEADCMD-FIX-1.');
  process.exit(1);
}
console.log(`✓ check-ssot-no-npm clean — ${FILES.length} SSOT doc(s) scanned, no dead npm instructions.`);
