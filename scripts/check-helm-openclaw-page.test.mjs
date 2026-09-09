// check-helm-openclaw-page.test.mjs — paired self-test for
// check-helm-openclaw-page.mjs (SO #34c / GATE-SELFTEST-META-1).
//
// GREEN: the real helm-openclaw.html evaluates clean (structure + markers).
// RED mutations, each against the same fixed region render: a deleted marker
// pair, a deleted section, a deleted head meta, a corrupted JSON-LD block, and
// a one-character region drift must each fail with the named verdict.
//
// Run: node scripts/check-helm-openclaw-page.test.mjs

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderRegion, REGIONS } from './gen-helm-openclaw-snippets.mjs';
import { evaluate, SECTION_IDS, REQUIRED_METAS } from './check-helm-openclaw-page.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const html = readFileSync(resolve(REPO, 'helm-openclaw.html'), 'utf8');

const regions = {};
for (const id of REGIONS) regions[id] = renderRegion(id);

let fail = 0;
function expect(name, cond, detail) {
  if (cond) console.log(`  ok — ${name}`);
  else {
    fail++;
    console.error(`  FAIL — ${name}${detail ? `: ${detail}` : ''}`);
  }
}

// GREEN
const green = evaluate(html, regions);
expect('GREEN: real page evaluates clean', green.failures.length === 0 && green.drifted === 0, green.failures.join('; '));
expect('GREEN: six TODO-KIT advisories printed', green.advisories.length === REGIONS.length, String(green.advisories.length));

// RED: delete one marker pair
{
  const mutated = html
    .replace('<!--HELMKIT:cron-->\n', '')
    .replace('\n<!--/HELMKIT:cron-->', '');
  const r = evaluate(mutated, regions);
  expect('RED: deleted cron marker pair fails', r.failures.some((f) => f.includes('marker region cron')), r.failures.join('; '));
}

// RED: delete one section id
{
  const mutated = html.replace('id="faq"', 'id="faqx"');
  const r = evaluate(mutated, regions);
  expect('RED: renamed faq section fails', r.failures.some((f) => f.includes('missing section id="faq"')), r.failures.join('; '));
}

// RED: delete one head meta
{
  const mutated = html.replace('<meta name="ain:category" content="helm">\n', '');
  const r = evaluate(mutated, regions);
  expect('RED: missing ain:category meta fails', r.failures.some((f) => f.includes('ain:category')), r.failures.join('; '));
}

// RED: corrupt the JSON-LD block
{
  const mutated = html.replace('<script type="application/ld+json">', '<script type="application/ld+json">{"broken');
  const r = evaluate(mutated, regions);
  expect('RED: malformed JSON-LD fails', r.failures.some((f) => f.includes('JSON-LD')), r.failures.join('; '));
}

// RED: one-character drift inside a region
{
  const mutated = html.replace('helmd list-scenarios', 'helmd list-scenario');
  const r = evaluate(mutated, regions);
  expect('RED: region drift fails', r.failures.some((f) => f.includes('drifted from data/helm-kit/')), r.failures.join('; '));
}

// Calibration: sections/metas lists are the spec's binding sets (spot-check membership)
expect('sections list carries all eight spec ids', SECTION_IDS.length === 8 && ['get','install','trust','try','verify','canvas','faq','links'].every((s) => SECTION_IDS.includes(s)));
expect('metas list carries ain:category + ain:featured', REQUIRED_METAS.length === 2);

console.log('');
if (fail) {
  console.error(`check-helm-openclaw-page.test.mjs: ${fail} FAILURE(s)`);
  process.exit(1);
}
console.log('check-helm-openclaw-page.test.mjs: all checks passed.');
