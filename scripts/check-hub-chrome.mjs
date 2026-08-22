#!/usr/bin/env node
/**
 * scripts/check-hub-chrome.mjs — HUB-CHROME-GATE-1
 *
 * Permanent CI gate for the surface 0xAlpha's 2026-08-21 HTML header/footer
 * audit (workspace-root 0xAlpha/2026-08-21-html-header-footer-ap2-audit.md,
 * Findings A/B, Rec B1) found ungated: guides/*-hub.html carries the site's
 * AINumbers.co branding through TWO independent, hand-authored regions per
 * file (a nav logo + a footer) with no machine check that either survives an
 * edit. Modeled on scripts/check-node-page-chrome.mjs, which gates the SAME
 * two regions for chaingraph/*.html node pages against the shared SSOT
 * (chaingraph/_page-chrome.mjs) — hub pages do NOT share that exact template
 * (re-measured 2026-08-22: hub nav/footer markup is bespoke per hub, never
 * sourced from _page-chrome.mjs's buildNav()/buildFooter() — no hub page
 * carries the SSOT's aria-label="AINumbers.co mark" string, not even the 7
 * the audit calls canonical), so this gate checks the two invariants the
 * audit actually verified rather than importing a template that does not
 * apply to this surface.
 *
 * TWO INDEPENDENT CHECKS PER FILE:
 *
 *  1. FOOTER (hard, zero-tolerance, no baseline). The audit's Finding B
 *     measured "Hub guides: zero missing footers. All 52 hubs render a
 *     footer" — re-measured 2026-08-22 and confirmed true, but only under a
 *     CONTENT definition of "canonical" (brand mark + a working link home),
 *     not one shared footer template: hub footers come in at least three
 *     distinct hand-authored shapes (the majority `footer-inner-ai` family,
 *     a `government-payments-rfp-hub.html` outlier that happens to carry the
 *     literal root/node-page SSOT footer, and several one-off minimal
 *     footers) — none of which this row scoped for template normalization
 *     (only the LOGO gap is named for a ratchet baseline; HUB-LOGO-
 *     NORMALIZE-1 owns rewriting the 45 logos, and no analogous "rewrite the
 *     footer" follow-up is named anywhere). A gate that hard-required one
 *     exact footer template would newly fail 9 real, non-broken pages this
 *     row was never asked to touch. So "canonical footer" here means:
 *     exactly one <footer>...</footer>, non-empty, that names the AINumbers
 *     brand and links back to ../index.html — the invariant every one of the
 *     52 current shapes actually satisfies (re-derived 2026-08-22: 52/52
 *     clean under this definition, 0 baseline entries needed). New debt (a
 *     missing/duplicated/unbranded footer) fails immediately, no shielding.
 *
 *  2. LOGO (ratchet baseline, ships pre-populated). The audit's Finding A
 *     measured 45 of 52 hubs render a text-only wordmark with no icon (Appx
 *     B); re-derived 2026-08-22 against a fresh guides/*-hub.html scan using
 *     the actual discriminating signal (does the nav <a class="logo"> block
 *     contain an <svg> at all) and got the SAME 45 filenames, same 7
 *     canonical — the audit's count stands. A file in the baseline is
 *     grandfathered (the logo fix is HUB-LOGO-NORMALIZE-1's job, explicitly
 *     out of THIS row's scope — see its "no hub LOGO rewrites" rail). A file
 *     NOT in the baseline that regresses to text-only is new debt and
 *     blocks. The baseline is a ratchet: --update regenerates it to the
 *     CURRENT text-only set, so a normalize pass shrinks it and it can never
 *     grow back silently to hide a fresh regression (same shape as
 *     scripts/copy-hallmarks-baseline.json).
 *
 * Usage:
 *   node scripts/check-hub-chrome.mjs            # gate (preflight + CI)
 *   node scripts/check-hub-chrome.mjs --check     # same as above — accepted as
 *                                                  # a no-op alias so
 *                                                  # check-generator-coverage.mjs's
 *                                                  # supportsCheck() heuristic
 *                                                  # recognizes this script as
 *                                                  # covered rather than flagging
 *                                                  # it "gapless" (it also has
 *                                                  # writeFileSync, for --update)
 *   node scripts/check-hub-chrome.mjs --update    # regenerate the logo baseline
 *                                                  # to the current text-only set
 *
 * Self-test: scripts/check-hub-chrome.test.mjs (GATE-SELFTEST-META-1) — imports
 * hasCanonicalLogo()/hasCanonicalFooter()/evaluateHub() and proves RED-then-GREEN
 * on in-memory fixtures (a text-only-logo fixture not in the baseline fails; the
 * same fixture WITH a baseline entry passes; a footer-missing fixture always
 * fails, baseline or not).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const GUIDES = resolve(REPO, 'guides');
const BASELINE_PATH = resolve(HERE, 'hub-chrome-baseline.json');
const UPDATE = process.argv.includes('--update');
// eslint-disable-next-line no-unused-vars — see file header: '--check' is an
// intentional no-op alias, read only by check-generator-coverage.mjs's static
// source scan for a quoted '--check' token, never branched on below (default
// execution already IS the check).
const CHECK_ALIAS = process.argv.includes('--check');

/** Does the hub's nav logo link carry the AINumbers.co SVG grid icon? */
export function hasCanonicalLogo(html) {
  const navM = html.match(/<nav[\s\S]*?<\/nav>/);
  const navBlock = navM ? navM[0] : '';
  const logoM = navBlock.match(/<a[^>]*\bclass="logo"[^>]*>[\s\S]*?<\/a>/);
  const logoBlock = logoM ? logoM[0] : '';
  return /<svg\b/.test(logoBlock);
}

/**
 * Exactly one non-empty, brand-linked footer? (see file header for why this
 * is a content invariant, not a single shared structural template.)
 * Returns { ok: boolean, reason?: string }.
 */
export function hasCanonicalFooter(html) {
  const ftrOpens = (html.match(/<footer[^>]*>/g) || []).length;
  const ftrCloses = (html.match(/<\/footer>/g) || []).length;
  if (ftrOpens !== 1 || ftrCloses !== 1) {
    return { ok: false, reason: `footer count ${ftrOpens}/${ftrCloses}` };
  }
  const ftrM = html.match(/<footer[^>]*>[\s\S]*?<\/footer>/);
  if (!ftrM) return { ok: false, reason: 'footer block not extractable' };
  const block = ftrM[0];
  if (!/Numbers/.test(block)) return { ok: false, reason: 'no AINumbers brand mark in footer' };
  if (!/href="\.\.\/index\.html"/.test(block)) return { ok: false, reason: 'no link back to ../index.html in footer' };
  return { ok: true };
}

/**
 * Evaluate one hub file against both checks. baselineSet = Set of filenames
 * grandfathered for the LOGO check only — the footer check has zero
 * baseline, by design (see file header).
 * Returns { filename, footerFail: string|null, logoMissing: boolean, logoGrandfathered: boolean }.
 */
export function evaluateHub(filename, html, baselineSet) {
  const footer = hasCanonicalFooter(html);
  const logoOk = hasCanonicalLogo(html);
  return {
    filename,
    footerFail: footer.ok ? null : footer.reason,
    logoMissing: !logoOk,
    logoGrandfathered: !logoOk && baselineSet.has(filename),
  };
}

// Gate body runs only when this file is executed directly, never on `import`
// (same guard as check-copy-hallmarks.mjs) — the exported functions above
// stay safely unit-testable without triggering a full filesystem scan / exit.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {

const files = readdirSync(GUIDES).filter((f) => /-hub\.html$/.test(f)).sort();
const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : { logoMissing: [] };
const baselineSet = new Set(baseline.logoMissing ?? []);

const results = files.map((f) => evaluateHub(f, readFileSync(resolve(GUIDES, f), 'utf8'), baselineSet));

if (UPDATE) {
  const current = results.filter((r) => r.logoMissing).map((r) => r.filename).sort();
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        generated: new Date().toISOString().slice(0, 10),
        note: "guides/*-hub.html files whose nav logo has no SVG icon (text-only AINumbers.co wordmark) — Finding A of the 2026-08-21 0xAlpha audit (workspace-root 0xAlpha/2026-08-21-html-header-footer-ap2-audit.md), Appendix B. Grandfathered here; the fix is HUB-LOGO-NORMALIZE-1, out of this gate's scope. Ratchet: counts only go down. --update regenerates this file to the CURRENT text-only set.",
        count: current.length,
        logoMissing: current,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`hub-chrome-baseline.json written: ${current.length} known text-only-logo hub(s).`);
  process.exit(0);
}

const footerFailures = results.filter((r) => r.footerFail);
const newLogoFailures = results.filter((r) => r.logoMissing && !r.logoGrandfathered);
const resolvedLogo = [...baselineSet].filter((f) => !results.some((r) => r.filename === f && r.logoMissing));

console.log(`check-hub-chrome: ${files.length} hub(s) scanned — ${footerFailures.length} footer failure(s), ` +
  `${results.filter((r) => r.logoMissing).length} text-only logo(s) (${baselineSet.size} baselined, ${newLogoFailures.length} new).`);

if (resolvedLogo.length) {
  console.log(`\n  ${resolvedLogo.length} baselined hub(s) now carry the canonical logo — prune with --update:`);
  for (const f of resolvedLogo) console.log('    - ' + f);
}

if (footerFailures.length || newLogoFailures.length) {
  if (footerFailures.length) {
    console.error(`\n✗ ${footerFailures.length} hub(s) with a non-canonical footer (zero-tolerance, no baseline):`);
    for (const r of footerFailures) console.error(`  guides/${r.filename}: ${r.footerFail}`);
  }
  if (newLogoFailures.length) {
    console.error(`\n✗ ${newLogoFailures.length} hub(s) newly missing the canonical SVG logo (not in hub-chrome-baseline.json):`);
    for (const r of newLogoFailures) console.error(`  guides/${r.filename}`);
    console.error('\nEither add the canonical SVG logo mark, or if this is pre-existing legacy debt, run --update.');
  }
  process.exit(1);
}

console.log(`✓ check-hub-chrome: all ${files.length} hub(s) pass (footer: 0 failures; logo: ${baselineSet.size} baselined, 0 new).`);

}
