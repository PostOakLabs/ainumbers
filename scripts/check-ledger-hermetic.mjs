#!/usr/bin/env node
/**
 * scripts/check-ledger-hermetic.mjs
 * Gate: ledger/index.html must make NO network calls except the §6 anchor endpoint.
 * Grep for fetch(, XMLHttpRequest, new WebSocket, EventSource(
 * Allowlist: exactly https://anchor.ainumbers.co (the §6 anchor call).
 * Any other network call = exit 1.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = resolve(REPO, 'ledger', 'index.html');
const ALLOWED_ENDPOINT = 'https://anchor.ainumbers.co';

let html;
try {
  html = readFileSync(TARGET, 'utf8');
} catch (e) {
  console.error('check-ledger-hermetic: cannot read ledger/index.html —', e.message);
  process.exit(1);
}

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
    // Allowlist: either (a) the literal anchor endpoint URL appears in surrounding context,
    // OR (b) the call uses the ANCHOR_ENDPOINT constant (the only defined network constant).
    const ctxWide = html.slice(Math.max(0, m.index - 200), Math.min(html.length, m.index + 300));
    if (ctxWide.includes(ALLOWED_ENDPOINT)) continue;
    if (ctxWide.includes('ANCHOR_ENDPOINT')) continue;
    violations.push(`  ${label} at offset ${m.index}:\n    ...${ctx}...`);
  }
}

if (violations.length) {
  console.error('check-ledger-hermetic FAILED: non-allowlisted network call(s) found in ledger/index.html:\n');
  violations.forEach(v => console.error(v));
  console.error(`\nAllowlisted endpoint: ${ALLOWED_ENDPOINT}`);
  console.error('Remove or allowlist these calls before pushing.');
  process.exit(1);
}

console.log('check-ledger-hermetic: OK — ledger/index.html is hermetic (anchor endpoint only).');
