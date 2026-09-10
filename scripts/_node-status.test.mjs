#!/usr/bin/env node
/**
 * scripts/_node-status.test.mjs — controls for the shared status lens.
 *
 * The lens is the ONE predicate behind all four status-blind generators
 * (GENERATOR-STATUS-FILTER-1), so its edges are worth pinning explicitly —
 * especially the deliberate asymmetry on a MISSING status, which is the one
 * decision a future reader is most likely to "fix" in the wrong direction.
 *
 * SO #40(b): the RED half here is control 1 — the exact live shape (file
 * present, node deprecated) that every one of the four generators used to keep
 * publishing.
 *
 * Run: node scripts/_node-status.test.mjs
 */

import { buildStatusLens, isLive, isNonLive, nodePagePath, normalizeRel, SITE_BASE } from './_node-status.mjs';

let pass = 0, fail = 0;
function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}
function heading(n, s) { console.log(`\n[${n}] ${s}`); }

console.log('▶ _node-status controls (GENERATOR-STATUS-FILTER-1)');

const CG = {
  nodes: [
    { tool_id: 'art-01-live', status: 'live', url: `${SITE_BASE}chaingraph/art-01-live.html` },
    { tool_id: 'art-99-gone', status: 'deprecated', url: `${SITE_BASE}chaingraph/art-99-gone.html` },
    { tool_id: 'art-653-planned', status: 'planned', url: `${SITE_BASE}tools/653-planned.html` },
    { tool_id: 'art-77-nostatus', url: `${SITE_BASE}chaingraph/art-77-nostatus.html` },
    { tool_id: 'art-88-pageless', status: 'live' },
  ],
};
const lens = buildStatusLens(CG);

heading(1, 'RED SHAPE — a deprecated node with its page file still present is NON-LIVE');
check('isNonLive on the deprecated node', isNonLive(CG.nodes[1]));
check('its page path is in nonLivePaths', lens.nonLivePaths.has('chaingraph/art-99-gone.html'));
check('isNonLivePath answers on the repo-relative path', lens.isNonLivePath('chaingraph/art-99-gone.html'));
check('⛔ file presence is NOT consulted anywhere in the lens — the predicate is status only',
  !/existsSync|statSync|readdirSync/.test(buildStatusLens.toString()));

heading(2, 'planned is also non-live (a node that never went live has not left service, but is not published either)');
check('isNonLive(planned)', isNonLive(CG.nodes[2]));
check('its tools/ path is filtered', lens.isNonLivePath('tools/653-planned.html'));

heading(3, 'live stays live');
check('isLive(live node)', isLive(CG.nodes[0]));
check('a live path is NOT filtered', !lens.isNonLivePath('chaingraph/art-01-live.html'));

heading(4, 'THE DELIBERATE ASYMMETRY — a MISSING status is treated as live, i.e. never dropped');
check('isNonLive(no status) === false', isNonLive(CG.nodes[3]) === false);
check('...so its page is never filtered out of a projection', !lens.isNonLivePath('chaingraph/art-77-nostatus.html'));
check('empty-string status is also not a departure', isNonLive({ status: '' }) === false);
check('a non-object is not a departure', isNonLive(undefined) === false && isNonLive(null) === false);

heading(5, 'ABSENCE FROM THE GRAPH IS NOT A DEPARTURE');
check('an unknown tools/ page is not filtered', !lens.isNonLivePath('tools/152-baas-provider-comparator.html'));
check('an unknown docs/ page is not filtered', !lens.isNonLivePath('docs/anything.html'));
check('nonLivePaths holds exactly the 2 declared non-live pages', lens.nonLivePaths.size === 2, [...lens.nonLivePaths].join(','));

heading(6, 'page-path derivation');
check('strips the site base', nodePagePath(CG.nodes[0]) === 'chaingraph/art-01-live.html');
check('a pageless node yields null', nodePagePath(CG.nodes[4]) === null);
check('an off-site url yields null', nodePagePath({ url: 'https://example.org/x.html' }) === null);
check('a fragment is stripped', nodePagePath({ url: `${SITE_BASE}tools/x.html#manifest` }) === 'tools/x.html');
check('windows separators normalise', normalizeRel('.\\tools\\x.html') === 'tools/x.html');
check('leading slash normalises', normalizeRel('/tools/x.html') === 'tools/x.html');
check('isNonLivePath normalises its argument', lens.isNonLivePath('.\\chaingraph\\art-99-gone.html'));

heading(7, 'live/non-live partition is total (nothing is counted twice or lost)');
check('liveNodes + nonLiveNodes === nodes', lens.liveNodes.length + lens.nonLiveNodes.length === CG.nodes.length,
  `${lens.liveNodes.length} + ${lens.nonLiveNodes.length} vs ${CG.nodes.length}`);
check('an empty graph yields an empty lens without throwing', buildStatusLens({}).nonLivePaths.size === 0);

console.log(`\n${fail ? '❌' : '✅'} _node-status controls: ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
