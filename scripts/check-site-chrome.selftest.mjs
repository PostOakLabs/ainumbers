#!/usr/bin/env node
/**
 * scripts/check-site-chrome.selftest.mjs — SITE-CHROME-GAPS-1
 *
 * GATE-SELFTEST-META-1 / SO #34c RED-then-GREEN controls for
 * check-site-chrome.mjs. Pure, in-memory fixtures: no file writes, no network.
 * RED controls first: a page whose only footer is inside a <script> template
 * must FAIL; then the same page with a rendered footer must PASS. The
 * exemption, baseline-ratchet and universe paths are exercised independently.
 */
import { chromeState, chromeVerdict, publishedHtmlFiles, REPO } from './check-site-chrome.mjs';

const RED_SCRIPT_FOOTER = `<html><head><style>.x{}</style></head><body>
<nav><div class="nav-inner">home</div></nav>
<script>var tpl = '<footer>print only</footer>';</script>
</body></html>`;
const GREEN_RENDERED = `<html><head><style>.x{}</style></head><body>
<nav><div class="nav-inner">home</div></nav>
<footer>site footer</footer>
</body></html>`;

const failures = [];
function expect(label, actual, wanted) {
  if (actual !== wanted) failures.push(`${label}: expected ${wanted}, got ${actual}`);
}

// 1. RED first — script-embedded footer is not rendered chrome.
const redState = chromeState(RED_SCRIPT_FOOTER);
expect('script-template footer count', redState.footer, 0);
expect('RED verdict', chromeVerdict(redState).ok, false);

// 2. GREEN — same page with a rendered footer.
const greenState = chromeState(GREEN_RENDERED);
expect('rendered footer count', greenState.footer, 1);
expect('GREEN verdict', chromeVerdict(greenState).ok, true);

// 3. A class'd nav is in-body content, not site chrome.
const tocState = chromeState('<nav class="toc">toc</nav><footer>site</footer>');
expect('class\'d nav count', tocState.nav, 0);
expect('class\'d nav verdict', chromeVerdict(tocState).ok, false);

// 4. A comment-wrapped footer is inert.
const commentState = chromeState('<nav>site</nav><!-- <footer>old</footer> -->');
expect('comment footer count', commentState.footer, 0);
expect('comment footer verdict', chromeVerdict(commentState).ok, false);

// 5. Exemption carries the red page through, with the reason location reported.
expect('exemption verdict', chromeVerdict(redState, { exempt: true }).ok, true);

// 6. Shrink-only baseline: matching pin holds; stale pins fail in both directions.
expect('matching pin', chromeVerdict(redState, { pin: { nav: 1, footer: 0 } }).ok, true);
expect('clean page still pinned', chromeVerdict(greenState, { pin: { nav: 1, footer: 0 } }).ok, false);
expect('raised pin', chromeVerdict(redState, { pin: { nav: 1, footer: 1 } }).ok, false);
expect('illegal pin shape', chromeVerdict(redState, { pin: { nav: 'zero' } }).ok, false);

// 7. Universe is the shared published-page manifest cross-checked with git,
//    not a filesystem walk: no exporters/, no docs/, both nested and flat dirs.
const files = publishedHtmlFiles(REPO);
expect('universe is large', files.length > 2000, true);
expect('root page included', files.includes('privacy.html'), true);
expect('flat dir included', files.includes('tools/248-iso20022-validator.html'), true);
expect('nested dir included', files.includes('research/zkprof-harness/index.html'), true);
expect('excluded subdir absent', files.includes('chaingraph/exporters/qr-preview.html'), false);
expect('other host absent', files.some((p) => p.startsWith('docs/')), false);

if (failures.length) {
  console.error(`✗ check-site-chrome selftest FAILED (${failures.length} control(s)):`);
  failures.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log(`✓ check-site-chrome selftest: RED script-footer and GREEN rendered-footer controls, class\'d-nav/comment cases, exemption, shrink-only baseline (4 controls), and ${files.length}-page manifest universe all pass.`);
