#!/usr/bin/env node
/**
 * scripts/gen-page-md-twins.test.mjs — CHAIN-MD-TWIN-REMEDY-A-1
 *
 * Fixture proof for collectTwinTargets()'s own-page rule: every chain in the
 * SSOT contributes BOTH its composer_url page target (unchanged — that is
 * where the receipted runs live) AND its own chains/<name>.html page when that
 * file exists. Three published chain pages (aml-programme, amlr-single-rulebook,
 * eudi-wallet-acceptance) shipped with no markdown twin for exactly this
 * reason, measured by CHAIN-MD-TWIN-ORPHANS-1; this pins the collector rule so
 * a future edit cannot silently drop own-page targets again.
 *
 * A gate never seen red is not a gate (SO #40b): against the UNPATCHED
 * collector the own-page assertion below fails — those pages were never twin
 * targets — so the fixture proves the rule, not the current bytes. It drives
 * collectTwinTargets() directly, so it needs no tree, no git and no network.
 *
 * Usage: node scripts/gen-page-md-twins.test.mjs   (also under `node --test`)
 */

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { collectTwinTargets, renderTwinMd } from './gen-page-md-twins.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function buildFixtureRepo(tmp) {
  mkdirSync(resolve(tmp, 'chaingraph', 'chains'), { recursive: true });
  // Chains-only fixture: the chain branch of the collector is what is under
  // test. No nodes, no manifests, no fixtures — graph-only twins, the same
  // shape the collector produces for a chain page with no node host.
  const cg = {
    nodes: [],
    chains: [
      {
        name: 'orphan-demo',
        title: 'Orphan Demo Chain',
        description: 'A fixture chain whose composer_url points at a consolidated page.',
        domain: 'test',
        composer_url: 'https://ainumbers.co/chaingraph/chains/other-page.html',
        steps: [{ tool_id: '110-customer-risk-rating', handoff: 'feeds stage two' }],
      },
      {
        name: 'self-page',
        title: 'Self Page Chain',
        description: 'A fixture chain whose composer_url is its own page.',
        domain: 'test',
        composer_url: 'https://ainumbers.co/chaingraph/chains/self-page.html',
        steps: [],
      },
    ],
  };
  writeFileSync(resolve(tmp, 'chaingraph', 'chaingraph.json'), JSON.stringify(cg));
  // All three pages exist on disk; head bytes are irrelevant to the collector.
  for (const name of ['orphan-demo', 'other-page', 'self-page']) {
    writeFileSync(
      resolve(tmp, 'chaingraph', 'chains', `${name}.html`),
      `<!doctype html><html><head><title>${name}</title></head><body></body></html>`
    );
  }
}

test('collector own-page rule: a chain whose composer_url points elsewhere still twins its own page', () => {
  const tmp = resolve(HERE, '.tmp-md-twins-fixture');
  try {
    rmSync(tmp, { recursive: true, force: true });
    buildFixtureRepo(tmp);
    const targets = collectTwinTargets(tmp);
    const byPage = new Map(targets.map((t) => [t.pageRel, t]));

    // 1. The composer_url target is unchanged: the consolidated page still
    //    carries the chain's section, exactly as today.
    const composer = byPage.get('chaingraph/chains/other-page.html');
    assert.ok(composer, 'composer_url page must stay a twin target');
    assert.ok(
      composer.chains.some((c) => c.chainId === 'orphan-demo'),
      'consolidated composer page must still list the chain section'
    );

    // 2. THE RULE UNDER TEST (RED on the unpatched collector): the chain's OWN
    //    page is now a target, with its own twin and its own page URL.
    const own = byPage.get('chaingraph/chains/orphan-demo.html');
    assert.ok(own, 'chain own chains/<name>.html page must be a twin target');
    assert.equal(own.twinRel, 'chaingraph/chains/orphan-demo.md');
    assert.equal(own.pageUrl, 'https://ainumbers.co/chaingraph/chains/orphan-demo.html');
    assert.equal(own.chains.length, 1);
    assert.equal(own.chains[0].chainId, 'orphan-demo');

    // 3. De-dup: a chain whose composer_url already points at its own page
    //    produces ONE target with ONE section, as today.
    const self = byPage.get('chaingraph/chains/self-page.html');
    assert.ok(self, 'self-composed chain page must stay a twin target');
    assert.equal(self.chains.length, 1, 'self-composed chain must appear exactly once');
    assert.equal(targets.filter((t) => t.pageRel === 'chaingraph/chains/self-page.html').length, 1);

    // 4. The own-page target renders the real twin bytes the --write run emits.
    const md = renderTwinMd(own);
    assert.match(md, /^# Orphan Demo Chain$/m);
    assert.match(md, /## Workflow chain: Orphan Demo Chain/);
    assert.match(md, /- Page: https:\/\/ainumbers\.co\/chaingraph\/chains\/orphan-demo\.html/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
