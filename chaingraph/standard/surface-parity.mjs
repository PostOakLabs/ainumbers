#!/usr/bin/env node
// surface-parity.mjs — GATE (Addendum A / SSOT §4 / SPEC §15)
// Asserts every displayed count on the web surfaces equals data/counts.json (the SSOT generate.mjs
// already emits). Two parts:
//   (1) STRICT: every <… data-ocg-count="KEY">N</…> token must equal counts.json[KEY] (else exit 1)
//   (2) AUDIT (warn): bare numbers sitting next to count keywords ("Tools Live", "MCP tools",
//       "workflow recipes", "named chains") that are NOT inside a token — surfaces still un-migrated.
// Once a surface is fully tokenized + inject-counts.mjs runs in the build, this gate can never fail
// (there's nothing left to drift) — the "17 vs 84 vs 94 vs 110" class becomes structurally impossible.
//
// Zero-dependency. Run in the SITE repo. Place counts.json via env if the worker's data/ isn't a sibling.
//   node surface-parity.mjs
//   node surface-parity.mjs --audit        # also list un-tokenized count-like numbers (warn only)

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const AUDIT = process.argv.includes('--audit');
const COUNTS = process.env.COUNTS || firstExisting([
  join(HERE, '..', 'mcp-apps-poc', 'data', 'counts.json'),
  join(HERE, '..', 'repo', 'chaingraph', 'data', 'counts.json'),
  join(HERE, 'counts.json'),
]);
const SITE = process.env.SITE_REPO || firstExisting([join(HERE, '..', 'repo'), join(HERE, '..')]);
const SURFACES = (process.env.SURFACES || 'mcp.html,chaingraph/chaingraph-hub.html')
  .split(',').map((s) => join(SITE, s.trim()));
function firstExisting(ps) { return ps.find((p) => existsSync(p)) || ps[0]; }

if (!existsSync(COUNTS)) { console.error(`counts.json not found at ${COUNTS} — run generate.mjs first.`); process.exit(2); }
const counts = JSON.parse(readFileSync(COUNTS, 'utf8'));
console.log(`counts.json (SSOT): ${Object.entries(counts).filter(([k]) => k !== 'generated_at').map(([k, v]) => `${k}=${v}`).join(' · ')}\n`);

const TOKEN_RE = /<[^>]*\bdata-ocg-count="([a-z_0-9]+)"[^>]*>([\s\S]*?)<\/[^>]+>/g;
// keyword → the counts.json key its adjacent number should equal (for the audit pass)
const KEYWORD_KEY = [
  [/([\d,]+)\s*(?:MCP\s+)?tools?\s+live/gi, 'chaingraph_nodes_live'],
  [/([\d,]+)\s*MCP\s+tools/gi, 'mcp_tools_total'],
  [/([\d,]+)\s*(?:workflow\s+recipes|named\s+chains|chains\b)/gi, 'named_chains'],
  [/([\d,]+)\s*catalog\s+tools/gi, 'catalog_tools'],
];
let errs = 0;

for (const file of SURFACES) {
  if (!existsSync(file)) { console.warn(`⚠ surface not found: ${rel(file)} — skipped`); continue; }
  const html = readFileSync(file, 'utf8');

  // (1) strict tokenized check
  let tokens = 0, m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(html)) !== null) {
    tokens++;
    const [, key, inner] = m;
    if (!(key in counts)) { console.error(`✗ ${rel(file)}: token "${key}" is not a counts.json key`); errs++; continue; }
    if (inner.trim() !== String(counts[key])) {
      console.error(`✗ ${rel(file)}: "${key}" shows "${inner.trim()}", SSOT says "${counts[key]}"`); errs++;
    }
  }
  console.log(`${tokens ? '✓' : '⚠'} ${rel(file)}: ${tokens} tokenized count(s)${tokens ? '' : ' — not yet tokenized (Option-3 migration pending)'}`);

  // (2) audit: bare count-like numbers not inside a token
  if (AUDIT) {
    const stripped = html.replace(TOKEN_RE, ''); // ignore already-tokenized
    for (const [re, key] of KEYWORD_KEY) {
      re.lastIndex = 0; let a;
      while ((a = re.exec(stripped)) !== null) {
        const shown = a[1].replace(/,/g, '');
        const want = String(counts[key] ?? '?');
        const flag = shown === want ? 'ok' : `≠ ${want}`;
        console.warn(`  ⚠ ${rel(file)}: un-tokenized "${a[0].trim()}" → expected ${key}=${want} (${flag}) — wrap in data-ocg-count="${key}"`);
      }
    }
  }
}

console.log();
console.log(errs ? `✗ ${errs} surface-parity error(s) — a displayed count disagrees with counts.json` : '✓ surface parity: all tokenized counts match the SSOT');
if (AUDIT) console.log('(audit warnings list numbers still hand-typed — tokenize them so they generate)');
process.exitCode = errs ? 1 : 0;
function rel(p) { return p.replace(SITE, '.'); }
