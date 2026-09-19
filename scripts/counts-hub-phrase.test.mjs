#!/usr/bin/env node
/**
 * scripts/counts-hub-phrase.test.mjs — HUB-COUNT-DERIVE-AT-REGEN-1 step 1/2.
 *
 * Unit tests for the shared helpers every generator (gen-sitemap-html.mjs,
 * gen-infra-registry.mjs, gen-guides-index.mjs, gen-llms-full.mjs) imports from
 * counts.mjs to compute and splice in a hub's count phrase: hubCountPhrase,
 * stripHubCountNumeral, hubCountsFromHtml. Pure-function tests against inline
 * fixtures — no fixture file lands in guides/ or chaingraph/.
 *
 * Usage: node scripts/counts-hub-phrase.test.mjs
 */
import { hubCountPhrase, stripHubCountNumeral, hubCountsFromHtml } from './counts.mjs';

const failures = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

// ── hubCountPhrase ───────────────────────────────────────────────────────────
check('tools only, plural', hubCountPhrase({ tools: 16, nodes: 0 }) === '16 tools',
  hubCountPhrase({ tools: 16, nodes: 0 }));
check('tools only, singular', hubCountPhrase({ tools: 1, nodes: 0 }) === '1 tool',
  hubCountPhrase({ tools: 1, nodes: 0 }));
check('nodes only, never called tools', hubCountPhrase({ tools: 0, nodes: 3 }) === '3 ChainGraph nodes',
  hubCountPhrase({ tools: 0, nodes: 3 }));
check('nodes only, singular', hubCountPhrase({ tools: 0, nodes: 1 }) === '1 ChainGraph node',
  hubCountPhrase({ tools: 0, nodes: 1 }));
check('tools and nodes combined', hubCountPhrase({ tools: 1, nodes: 2 }) === '1 tool and 2 ChainGraph nodes',
  hubCountPhrase({ tools: 1, nodes: 2 }));
check('both zero: a hub with 0 cards renders no count phrase', hubCountPhrase({ tools: 0, nodes: 0 }) === '',
  JSON.stringify(hubCountPhrase({ tools: 0, nodes: 0 })));
check('no argument defaults to empty', hubCountPhrase() === '', hubCountPhrase());

// ── stripHubCountNumeral (same regex as check-count-prose.mjs, imported) ────
check('strips a leading typed numeral',
  stripHubCountNumeral('8 free browser-based tools for payment scheme compliance.') ===
    'for payment scheme compliance.',
  stripHubCountNumeral('8 free browser-based tools for payment scheme compliance.'));
check('strips an embedded typed numeral',
  stripHubCountNumeral('Toolkit covering 14 regulatory compliance tools for treasury teams.') ===
    'Toolkit covering for treasury teams.',
  stripHubCountNumeral('Toolkit covering 14 regulatory compliance tools for treasury teams.'));
check('a description with no numeral is untouched',
  stripHubCountNumeral('Reference-grade decode and lookup tools for payment professionals.') ===
    'Reference-grade decode and lookup tools for payment professionals.',
  stripHubCountNumeral('Reference-grade decode and lookup tools for payment professionals.'));
check('empty/undefined desc passes through', stripHubCountNumeral('') === '' && stripHubCountNumeral(undefined) === undefined);

// ── hubCountsFromHtml (pure over an in-memory html string, no disk read) ────
const guidesHubHtml = `<html><body>
  <a class="tool-card-link" href="../tools/a.html">A</a>
  <a class="tool-card-link" href="../tools/b.html">B</a>
  <a class="node-link" href="../chaingraph/art-01-x.html">X</a>
</body></html>`;
check('guides hub: counts tools and nodes from card anchors',
  JSON.stringify(hubCountsFromHtml(guidesHubHtml, 'guides')) === JSON.stringify({ tools: 2, nodes: 1 }),
  JSON.stringify(hubCountsFromHtml(guidesHubHtml, 'guides')));

const chaingraphGuideHtml = `<html><body>
  <a class="card" href="art-05-y.html">Y</a>
  <a class="card" href="art-06-z.html">Z</a>
</body></html>`;
check('chaingraph guide: counts nodes from bare art-N hrefs',
  JSON.stringify(hubCountsFromHtml(chaingraphGuideHtml, 'chaingraph')) === JSON.stringify({ tools: 0, nodes: 2 }),
  JSON.stringify(hubCountsFromHtml(chaingraphGuideHtml, 'chaingraph')));

const emptyHtml = `<html><body>no cards here</body></html>`;
check('a hub with 0 cards measures 0/0',
  JSON.stringify(hubCountsFromHtml(emptyHtml, 'guides')) === JSON.stringify({ tools: 0, nodes: 0 }),
  JSON.stringify(hubCountsFromHtml(emptyHtml, 'guides')));

// ── end-to-end: wrong typed numeral -> computed count, not the typed one ────
const wrongNumeralHtml = `<html><head>
<meta name="description" content="8 free browser-based tools covering payment scheme compliance.">
</head><body>
  <a class="tool-card-link" href="../tools/a.html">A</a>
  <a class="tool-card-link" href="../tools/b.html">B</a>
  <a class="tool-card-link" href="../tools/c.html">C</a>
</body></html>`;
{
  const descMatch = wrongNumeralHtml.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const desc = descMatch[1];
  const rec = hubCountsFromHtml(wrongNumeralHtml, 'guides');
  const rendered = `${stripHubCountNumeral(desc)} (${hubCountPhrase(rec)})`.trim();
  check('a wrong typed numeral (8) renders the COMPUTED count (3), not the typed one',
    rendered === 'covering payment scheme compliance. (3 tools)' && !rendered.includes('8'),
    rendered);
}

console.log('');
if (failures.length) {
  console.error(`✗ counts-hub-phrase.test FAILED: ${failures.length} control(s) red.`);
  process.exit(1);
}
console.log('✅ counts-hub-phrase.test PASSED — hubCountPhrase/stripHubCountNumeral/hubCountsFromHtml behave.');
