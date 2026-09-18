#!/usr/bin/env node
/**
 * scripts/gen-infra-registry.test.mjs — INFRA-REGISTRY-EXEMPT-SCOPE-FIX-1.
 *
 * Proves the description-rule handling in gen-infra-registry.mjs keeps the page
 * IN the registry (the defect: it dropped the page from scope, so four
 * sentinelized hubs vanished from infrastructure.html) while still cutting the
 * read-back cycle REGEN-INFRA-REGISTRY-READBACK-CYCLE-1 exists for.
 *
 * Controls (RED-then-GREEN in spirit: control 1 is the exact assertion that was
 * RED before the fix — the page was absent):
 *   1. a page carrying a description count rule is PRESENT in the registry
 *   2. its description is populated
 *   3. the description carries no count digits from the rule
 *   4. rewriting that count in the page (what `verify-counts --fix` does later
 *      in the same regen pass) leaves the registry row byte-identical — the
 *      fixpoint the exemption was introduced to protect
 *   5. a hand-EXEMPT page is still absent
 *
 * Usage: node scripts/gen-infra-registry.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRegistry } from './gen-infra-registry.mjs';

// A real ATTR_RULES file with description rules: the DORA hub's meta/og/JSON-LD
// descriptions all carry hubTools.dora. Using a real path keeps the fixture
// honest — the rules under test are the shipped ones, not a mock.
const RULED = 'guides/dora-operational-resilience-hub.html';
const EXEMPT_PAGE = 'tools.html';

const failures = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

function ruledPage(n) {
  return `<html><head><title>DORA Hub | AINumbers.co</title>
<meta name="description" content="${n} free browser-based DORA compliance tools covering ICT risk gap analysis and incident reporting.">
<meta property="og:description" content="${n} free browser-based DORA compliance tools covering the full EU 2022/2554 framework.">
<meta name="ain:category" content="guide">
<script type="application/ld+json">{"description":"${n} free browser-based DORA compliance tools covering the full EU 2022/2554 framework."}</script>
</head><body>hi</body></html>`;
}

const plainPage = `<html><head><title>Plain | AINumbers.co</title>
<meta name="description" content="A page with no count sentinel in its description.">
<meta name="ain:category" content="guide"></head><body>hi</body></html>`;

const exemptPage = `<html><head><title>Tools | AINumbers.co</title>
<meta name="description" content="Catalog surface.">
<meta name="ain:category" content="run"></head><body>hi</body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'infra-reg-test-'));
try {
  mkdirSync(join(dir, 'guides'), { recursive: true });
  writeFileSync(join(dir, RULED), ruledPage(12));
  writeFileSync(join(dir, 'guides', 'plain.html'), plainPage);
  writeFileSync(join(dir, EXEMPT_PAGE), exemptPage);

  const rows = buildRegistry(dir);
  const row = rows.find(r => r.path === RULED);

  check('description-ruled page is IN the registry (was RED before the fix)', !!row,
    row ? '' : `paths: ${rows.map(r => r.path).join(', ')}`);
  check('its description is populated', !!row && row.description.length > 0, row?.description);
  check('the description carries no count digits', !!row && !/\d/.test(row.description), row?.description);
  check('description_source names the elision', row?.description_source === 'attr-rule', row?.description_source);

  // What verify-counts --fix does later in the same regen pass: the count moves.
  writeFileSync(join(dir, RULED), ruledPage(13));
  const after = buildRegistry(dir);
  check('registry is a fixpoint under the later count rewrite',
    JSON.stringify(rows) === JSON.stringify(after),
    JSON.stringify(after.find(r => r.path === RULED)));

  const plain = after.find(r => r.path === 'guides/plain.html');
  check('an ordinary page is unaffected',
    plain?.description === 'A page with no count sentinel in its description.'
    && plain?.description_source === 'page',
    JSON.stringify(plain));
  check('a hand-EXEMPT page stays out of the registry',
    !after.some(r => r.path === EXEMPT_PAGE), '');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('');
if (failures.length) {
  console.error(`✗ gen-infra-registry.test FAILED: ${failures.length} control(s) red.`);
  process.exit(1);
}
console.log('✅ gen-infra-registry.test PASSED — ruled pages stay in scope, counts elided, regen is a fixpoint.');
