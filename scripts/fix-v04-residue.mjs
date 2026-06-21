#!/usr/bin/env node
/**
 * fix-v04-residue.mjs — one-off v0.4 conformance remediation (AUDIT_v0.4_2026-06-21 findings F1+F2).
 * Removes the RETIRED `ap2_version` artifact emitter and bumps stale `chaingraph_version: 0.3.1` -> 0.4.0
 * on the affected node/chain pages. Both fields are EXCLUDED from the execution_hash preimage, so this
 * cannot change any hash (golden-parity stays green). EXCLUDES tools/513 (doubled file — flagged G1).
 * Precise: only removes a line that is itself an `ap2_version: "1.0"/"1.0.0"` assignment (no validator/intake refs).
 * Idempotent. Run from repo root: node scripts/fix-v04-residue.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  // Canton 500-series (F1 ap2_version + F2 version bump) — 513 deliberately excluded (doubled, G1)
  'tools/503-canton-tokenization-readiness-diagnostic.html',
  'tools/504-settlement-risk-capital-optimizer.html',
  'tools/505-tokenized-collateral-eligibility-checker.html',
  'tools/506-onchain-cash-leg-finality-checker.html',
  'tools/507-canton-dvp-atomicity-validator.html',
  'tools/508-repo-haircut-collateral-calculator.html',
  'tools/509-canton-party-allowlist-validator.html',
  'tools/510-digital-asset-regulatory-classifier.html',
  'tools/511-multi-currency-pvp-validator.html',
  'tools/512-tokenized-security-lifecycle-validator.html',
  'tools/514-tokenized-fund-collateral-validator.html',
  'tools/515-collateral-swap-eligibility-validator.html',
  // F1 ap2_version emitter only (these stamp 0.4.0 already)
  'chaingraph/art-38-tempo-onchain-aml.html',
  'chaingraph/chains/agentic-checkout.html',
  'chaingraph/chains/agentic-rail.html',
];

// a line that IS an ap2_version field assignment to "1.0"/"1.0.0" (object-literal emitter), with optional quotes/spacing
const AP2_EMITTER = /^\s*["']?ap2_version["']?\s*:\s*["']1\.0(?:\.0)?["']\s*,?\s*\r?\n/gm;
// chaingraph_version value 0.3.1 -> 0.4.0 (any quote style), only when keyed by chaingraph_version
const VER_031 = /(chaingraph_version["']?\s*:\s*["'])0\.3\.1(["'])/g;

let total = { ap2: 0, ver: 0, files: 0 };
for (const rel of files) {
  const p = join(REPO, rel);
  const before = readFileSync(p, 'utf8');
  const ap2Hits = (before.match(AP2_EMITTER) || []).length;
  const verHits = (before.match(VER_031) || []).length;
  if (ap2Hits === 0 && verHits === 0) { console.log(`· ${rel}: already clean`); continue; }
  let after = before.replace(AP2_EMITTER, '').replace(VER_031, '$10.4.0$2');
  writeFileSync(p, after);
  console.log(`✓ ${rel}: removed ${ap2Hits} ap2_version emitter(s), bumped ${verHits} version stamp(s)`);
  total.ap2 += ap2Hits; total.ver += verHits; total.files++;
}
console.log(`\nDone: ${total.files} files · ${total.ap2} ap2_version emitters removed · ${total.ver} version stamps bumped.`);
console.log('Note: tools/513 intentionally NOT touched (doubled file — see AUDIT_v0.4 G1).');
