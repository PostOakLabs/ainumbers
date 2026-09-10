#!/usr/bin/env node
// check-retired-mcp-toggle.mjs — TOMBSTONE GATE for CONTRACT.md §1.2 (row RETIREMENT-TOMBSTONE-GATES-1).
//
// §1.2 (standardized 2026-06-11): every tool exposes its manifest through exactly one
// `.mfst-btn` → `#mfstBody` / `#mfstCode` toggle wired by `toggleMfst()`, lazy-rendering
// `JSON.stringify(MANIFEST, null, 2)`. The legacy `.mcp-toggle` / `.mcp-panel` /
// `toggleMCP()` button-and-panel pattern is RETIRED and MUST NOT appear in new OR
// EXISTING tools. A retirement claim with nothing asserting it is a wish (the
// `ap2_version` lesson); this gate is the assertion.
//
// Boring by design: one grep-shaped scan over `tools/*.html`, one message naming the
// SSOT (CONTRACT.md §1.2), no framework, no shared abstraction. Scope is tools/ only —
// §1.2 binds tools; guides/ hubs, the workbench, and rbe-10's legacy `mcpPanel` element
// id are outside this retirement's bound and outside the row's fence.
//
// Self-test (paired fixture proof, GATE-SELFTEST-META-1): scripts/check-retired-mcp-toggle.test.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

// The retired §1.2 tokens. `toggleMCP` is matched case-insensitively (the estate's
// surviving spellings are `toggleMcp`); the retired class/id strings match literally.
export const RETIRED_PATTERNS = [/toggleMcp/i, /mcp-toggle/, /mcp-panel/];

// Pure line scan — exported so the paired fixture proof can drive it without touching disk.
export function lineHits(line) {
  return RETIRED_PATTERNS.some((re) => re.test(line));
}

// Main-module guard (house pattern, check-gate-selftest-pairing.mjs): the paired
// fixture proof imports lineHits() — the live scan must only run as the CLI entry.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  runCli();
}

function runCli() {
  const files = readdirSync(resolve(REPO, 'tools')).filter((f) => f.endsWith('.html'));
  const hits = [];
  for (const f of files) {
    const text = readFileSync(resolve(REPO, 'tools', f), 'utf8');
    text.split('\n').forEach((line, i) => {
      if (lineHits(line)) hits.push(`tools/${f}:${i + 1}: ${line.trim().slice(0, 110)}`);
    });
  }

  if (hits.length) {
    console.error(`✗ check-retired-mcp-toggle FAILED (${hits.length} line(s) across ${new Set(hits.map((h) => h.split(':')[0])).size} file(s)) — CONTRACT.md §1.2 retired the .mcp-toggle / .mcp-panel / toggleMCP() pattern:`);
    for (const h of hits) console.error('  • ' + h);
    console.error('\nCONTRACT.md §1.2 (standardized 2026-06-11): the manifest disclosure is exactly one');
    console.error('`.mfst-btn` (or inline-styled equivalent) → `#mfstBody` / `#mfstCode`, wired by');
    console.error('`toggleMfst()`, lazy-rendering JSON.stringify(MANIFEST, null, 2). The retired');
    console.error('button/panel/handler bytes are dead code — strip them. (RETIREMENT-TOMBSTONE-GATES-1)');
    process.exit(1);
  }
  console.log(`✓ check-retired-mcp-toggle clean — ${files.length} tools/*.html scanned, CONTRACT.md §1.2's retired mcp-toggle pattern is absent (toggleMfst is the one sanctioned manifest disclosure).`);
}
