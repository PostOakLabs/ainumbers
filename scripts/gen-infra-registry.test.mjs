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
 *   6. CHAINED rules — index.html's `chains` rule's own prefix contains the
 *      digits its `tools.browser` sibling owns, so a rule-at-a-time mask makes
 *      the second rule a silent NO-MATCH and leaves the chain count in the
 *      description. That is the read-back cycle itself, so it gets a control.
 *
 * HUB-COUNT-DERIVE-AT-REGEN-1 adds three more controls over the same
 * buildRegistry(): a hub whose typed numeral is wrong renders the COMPUTED
 * count (derived from the fixture's own card anchors, never a second read of
 * the real repo's guides/ tree); a hub with 0 cards renders no count phrase;
 * a non-hub guide page (filename not ending -hub.html) is untouched.
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
const CHAINED = 'index.html';

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

// index.html's two description rules CHAIN: `tools.browser` captures the first
// count, and `chains` locates the second one by re-matching the first as
// `content="\d+ browser-based fintech tools and `. Masking rule-by-rule kills
// that second match, so 368 (the #1879 digit) survived into the registry.
function chainedPage(tools, chains) {
  return `<html><head><title>AINumbers.co | Fintech Intelligence Suite</title>
<meta name="description" content="${tools} browser-based fintech tools and ${chains} MCP-callable, hash-anchored OpenChainGraph workflows for payments engineers and compliance teams. Zero PII. No install.">
<meta name="ain:category" content="run"></head><body>hi</body></html>`;
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
  writeFileSync(join(dir, CHAINED), chainedPage(201, 369));

  const rows = buildRegistry(dir);
  const row = rows.find(r => r.path === RULED);

  check('description-ruled page is IN the registry (was RED before the fix)', !!row,
    row ? '' : `paths: ${rows.map(r => r.path).join(', ')}`);
  check('its description is populated', !!row && row.description.length > 0, row?.description);
  check('the description carries no count digits', !!row && !/\d/.test(row.description), row?.description);
  check('description_source names the elision', row?.description_source === 'attr-rule', row?.description_source);

  // What verify-counts --fix does later in the same regen pass: the count moves.
  const chained = rows.find(r => r.path === CHAINED);
  check('chained rules: BOTH counts are elided, not just the first',
    !!chained && !/\d/.test(chained.description), chained?.description);

  writeFileSync(join(dir, RULED), ruledPage(13));
  writeFileSync(join(dir, CHAINED), chainedPage(202, 368));
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

  // ── HUB-COUNT-DERIVE-AT-REGEN-1: description WITHOUT a typed numeral, the
  // computed phrase appended, derived from THIS fixture's own cards (never a
  // second read of the real repo's guides/ tree). ──
  const cardedHubPage = `<html><head><title>Carded Hub</title>
<meta name="description" content="8 free browser-based tools covering payment scheme compliance.">
<meta name="ain:category" content="guide"></head><body>
  <a class="tool-card-link" href="../tools/a.html">A</a>
  <a class="tool-card-link" href="../tools/b.html">B</a>
  <a class="tool-card-link" href="../tools/c.html">C</a>
</body></html>`;
  writeFileSync(join(dir, 'guides', 'carded-hub.html'), cardedHubPage);
  const cardedRows = buildRegistry(dir);
  const carded = cardedRows.find(r => r.path === 'guides/carded-hub.html');
  check('a hub whose description claims a wrong numeral renders the COMPUTED count, not the typed one',
    !!carded && carded.description.includes('(3 tools)') && !carded.description.includes('8'),
    carded?.description);

  const zeroCardHubPage = `<html><head><title>Zero-Card Hub</title>
<meta name="description" content="Reference-grade decode and lookup tools for payment professionals.">
<meta name="ain:category" content="guide"></head><body>no cards here</body></html>`;
  writeFileSync(join(dir, 'guides', 'zero-card-hub.html'), zeroCardHubPage);
  const zeroRows = buildRegistry(dir);
  const zeroCard = zeroRows.find(r => r.path === 'guides/zero-card-hub.html');
  check('a hub with 0 cards renders no count phrase',
    zeroCard?.description === 'Reference-grade decode and lookup tools for payment professionals.',
    zeroCard?.description);

  const nonHubGuidePage = `<html><head><title>Not A Hub</title>
<meta name="description" content="8 free browser-based tools, a non-hub guide page.">
<meta name="ain:category" content="guide"></head><body>
  <a class="tool-card-link" href="../tools/a.html">A</a>
</body></html>`;
  writeFileSync(join(dir, 'guides', 'plain-guide-page.html'), nonHubGuidePage);
  const nonHubRows = buildRegistry(dir);
  const nonHub = nonHubRows.find(r => r.path === 'guides/plain-guide-page.html');
  check('a non-hub page is untouched (no filename ending -hub.html: numeral and cards ignored)',
    nonHub?.description === '8 free browser-based tools, a non-hub guide page.',
    nonHub?.description);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('');
if (failures.length) {
  console.error(`✗ gen-infra-registry.test FAILED: ${failures.length} control(s) red.`);
  process.exit(1);
}
console.log('✅ gen-infra-registry.test PASSED — ruled pages stay in scope, counts elided, regen is a fixpoint.');
