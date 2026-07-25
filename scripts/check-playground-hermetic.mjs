#!/usr/bin/env node
/**
 * scripts/check-playground-hermetic.mjs
 * Gate: mcp-playground.html must make NO network calls except CONTRACT §A8's
 * one allowlisted host, mcp.ainumbers.co (SI-6, START-INFRA-BUILD-SPEC.md §6).
 * Modeled on scripts/check-ledger-hermetic.mjs (CONTRACT §A7.2).
 *
 * SI-6 has not shipped the page yet (CONTRACT-A8-1 lands the amendment +
 * gate ahead of the build it gates). Until mcp-playground.html exists, this
 * gate exits 0 with a notice rather than failing on a missing file — it
 * polices what the page calls, not whether the page calls anything.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = resolve(REPO, 'mcp-playground.html');
const ALLOWED_ENDPOINT = 'https://mcp.ainumbers.co';

if (!existsSync(TARGET)) {
  console.log('check-playground-hermetic: mcp-playground.html not yet built (SI-6 pending) — nothing to check.');
  process.exit(0);
}

const html = readFileSync(TARGET, 'utf8');

const PATTERNS = [
  { re: /\bfetch\s*\(/g,          label: 'fetch(' },
  { re: /\bXMLHttpRequest\b/g,    label: 'XMLHttpRequest' },
  { re: /new\s+WebSocket\s*\(/g,  label: 'new WebSocket(' },
  { re: /\bEventSource\s*\(/g,    label: 'EventSource(' },
];

const violations = [];

for (const { re, label } of PATTERNS) {
  let m;
  while ((m = re.exec(html)) !== null) {
    const start = Math.max(0, m.index - 80);
    const end   = Math.min(html.length, m.index + 120);
    const ctx   = html.slice(start, end).replace(/\n/g, ' ').trim();
    // Allowlist: either (a) the literal mcp.ainumbers.co endpoint appears in
    // surrounding context, OR (b) the call uses an MCP_ENDPOINT constant
    // (mirrors ledger's ANCHOR_ENDPOINT pattern).
    const ctxWide = html.slice(Math.max(0, m.index - 200), Math.min(html.length, m.index + 300));
    if (ctxWide.includes(ALLOWED_ENDPOINT)) continue;
    if (ctxWide.includes('MCP_ENDPOINT')) continue;
    violations.push(`  ${label} at offset ${m.index}:\n    ...${ctx}...`);
  }
}

if (violations.length) {
  console.error('check-playground-hermetic FAILED: non-allowlisted network call(s) found in mcp-playground.html:\n');
  violations.forEach(v => console.error(v));
  console.error(`\nAllowlisted endpoint (CONTRACT §A8.1): ${ALLOWED_ENDPOINT}`);
  console.error('Remove or allowlist these calls before pushing.');
  process.exit(1);
}

console.log('check-playground-hermetic: OK — mcp-playground.html is hermetic (mcp.ainumbers.co only).');
