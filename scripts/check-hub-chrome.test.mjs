#!/usr/bin/env node
/**
 * scripts/check-hub-chrome.test.mjs — GATE-SELFTEST-META-1 pair for
 * scripts/check-hub-chrome.mjs (HUB-CHROME-GATE-1).
 *
 * In-memory fixtures only — no filesystem scan of guides/ — proving the
 * checker functions can go RED, not just that today's estate happens to
 * read green. Wired into scripts/preflight.mjs as its own GATES entry
 * alongside check-hub-chrome.mjs itself (pairing form (a) in
 * check-gate-selftest-pairing.mjs's header comment).
 */
import { hasCanonicalLogo, hasCanonicalFooter, evaluateHub } from './check-hub-chrome.mjs';

const CANON_FOOTER = '<footer><div>AINumbers.co<a href="../index.html">Home</a></div></footer>';
const SVG_LOGO_NAV = '<nav><a class="logo"><svg><rect/></svg><span>AINumbers.co</span></a></nav>';
const TEXT_LOGO_NAV = '<nav><a class="logo"><span class="logo-name">AINumbers.co</span></a></nav>';

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.error(`  FAIL ${label}`); failures++; }
}

// ── hasCanonicalLogo: RED proof (text-only fails) + GREEN proof (SVG passes) ──
check('logo: SVG icon present -> true (GREEN)', hasCanonicalLogo(SVG_LOGO_NAV) === true);
check('logo: text-only wordmark -> false (RED proof)', hasCanonicalLogo(TEXT_LOGO_NAV) === false);
check('logo: no <nav> at all -> false', hasCanonicalLogo('<div>no nav here</div>') === false);

// ── hasCanonicalFooter: RED proofs (each independent failure mode) + GREEN ──
check('footer: canonical shape -> ok (GREEN)', hasCanonicalFooter(CANON_FOOTER).ok === true);
check('footer: missing entirely -> RED', hasCanonicalFooter('<div>no footer</div>').ok === false);
check('footer: duplicated (two <footer>) -> RED', hasCanonicalFooter(CANON_FOOTER + CANON_FOOTER).ok === false);
check('footer: no brand mention -> RED', hasCanonicalFooter('<footer><a href="../index.html">Home</a></footer>').ok === false);
check('footer: no link home -> RED', hasCanonicalFooter('<footer>AINumbers.co</footer>').ok === false);

// ── evaluateHub: baseline grandfathering semantics ──
const textOnlyHtml = TEXT_LOGO_NAV + CANON_FOOTER;
const canonicalHtml = SVG_LOGO_NAV + CANON_FOOTER;
const brokenFooterHtml = SVG_LOGO_NAV + '<div>no footer</div>';

const notBaselined = evaluateHub('scratch-hub.html', textOnlyHtml, new Set());
check(
  'evaluateHub: text-only logo, NOT baselined -> logoMissing true, NOT grandfathered (RED — this is what a NEW regression looks like)',
  notBaselined.logoMissing === true && notBaselined.logoGrandfathered === false,
);

const baselined = evaluateHub('scratch-hub.html', textOnlyHtml, new Set(['scratch-hub.html']));
check(
  'evaluateHub: text-only logo, baselined -> grandfathered (GREEN — this is legacy debt the ratchet shields)',
  baselined.logoMissing === true && baselined.logoGrandfathered === true,
);

const canon = evaluateHub('scratch-hub.html', canonicalHtml, new Set());
check('evaluateHub: canonical logo -> logoMissing false regardless of baseline membership', canon.logoMissing === false);

const broken = evaluateHub('scratch-hub.html', brokenFooterHtml, new Set(['scratch-hub.html']));
check(
  'evaluateHub: broken footer -> footerFail set even when the file is logo-baselined (footer carries NO baseline, RED — proves the two checks are independent)',
  typeof broken.footerFail === 'string' && broken.footerFail.length > 0,
);

if (failures) {
  console.error(`\n✗ check-hub-chrome.test: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\n✓ check-hub-chrome.test: all mutation/control cases behave as expected (RED and GREEN both proven).');
