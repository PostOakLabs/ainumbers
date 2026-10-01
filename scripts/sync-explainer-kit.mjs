#!/usr/bin/env node
/**
 * scripts/sync-explainer-kit.mjs — EXPLAINER-KIT-1 (2026-09-28)
 *
 * EXPLAINER-KIT v1 lives in scripts/lib/explainer-kit.mjs: the shared design
 * of an OpenChainGraph explainer page plus its presenter script. A page cannot
 * import it (CONTRACT §1, one self-contained .html per page), so every
 * explainer carries an inline COPY between marker pairs. A copy drifts. This
 * script owns those copies:
 *
 *   · the CSS between EXPLAINER-KIT:v1:START and EXPLAINER-KIT:v1:END inside
 *     the page's <style>, and
 *   · the presenter script between <!-- EXPLAINER-KIT-JS:v1:START --> and
 *     <!-- EXPLAINER-KIT-JS:v1:END --> at the end of the page's <body>,
 *
 * written from the lib byte for byte. The page list is DERIVED by scanning
 * tracked HTML for the markers, never hand-listed, so a page that adopts the
 * kit is covered the moment it carries them.
 *
 * ONE ANIMATION SYSTEM. The explainer kit carries no animation rules of its
 * own: motion comes from SCENE-KIT v1 (scripts/lib/scene-kit.mjs), which the
 * explainer kit composes. --check enforces that composition on every marked
 * page: the page must also carry the SCENE-KIT regions, and outside the four
 * kit regions it may declare no @keyframes and no animation property. A page
 * that grows a private animation system is exactly the drift this gate
 * exists to refuse, and it is how the Agent Staircase explainer's own an-*
 * classes came to be folded into the scene kit rather than kept beside it.
 *
 * Motion timing stays where it already is: sync-scene-kit.mjs --check holds
 * every <svg class="sk-scene"> to WCAG 2.2.2 (Pause, Stop, Hide, Level A) by
 * recomputing each scene's last end time from the scene kit's own CSS. An
 * explainer page carries its scenes in that markup, so adopting this kit puts
 * the page under that scan with nothing to restate here.
 *
 * Usage:
 *   node scripts/sync-explainer-kit.mjs --check       — verify every inline copy and the composition rules
 *   node scripts/sync-explainer-kit.mjs --write       — rewrite every marked page's regions from the libs
 *   node scripts/sync-explainer-kit.mjs --new <slug>  — write a new explainer from the built-in scaffold
 *   node scripts/sync-explainer-kit.mjs --selftest    — RED/GREEN mutation control over in-memory fixtures
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitSync } from './_git-env-lib.mjs';
import { EXPLAINER_KIT_CSS, EXPLAINER_KIT_JS } from './lib/explainer-kit.mjs';
import { SCENE_KIT_CSS, SCENE_KIT_HEAD_JS } from './lib/scene-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const CSS_START = '/* EXPLAINER-KIT:v1:START */';
const CSS_END = '/* EXPLAINER-KIT:v1:END */';
const JS_START = '<!-- EXPLAINER-KIT-JS:v1:START -->';
const JS_END = '<!-- EXPLAINER-KIT-JS:v1:END -->';

// The scene kit's markers. sync-scene-kit.mjs owns those regions; this script
// only needs to know where they are, so it can require them on a marked page
// and exclude them from the no-private-animation scan. The strings are not
// imported, because importing that script would run its argv dispatch, so
// --selftest asserts each one still appears in its source (SO #34: derive the
// claim, never assume it).
const SK_CSS_START = '/* SCENE-KIT:v1:START */';
const SK_CSS_END = '/* SCENE-KIT:v1:END */';
const SK_JS_START = '<!-- SCENE-KIT-JS:v1:START -->';
const SK_JS_END = '<!-- SCENE-KIT-JS:v1:END -->';

const cssRegion = () => `${CSS_START}\n${EXPLAINER_KIT_CSS}\n${CSS_END}`;
const jsRegion = () => `${JS_START}\n<script>\n${EXPLAINER_KIT_JS}\n</script>\n${JS_END}`;
const skCssRegion = () => `${SK_CSS_START}\n${SCENE_KIT_CSS}\n${SK_CSS_END}`;
const skJsRegion = () => `${SK_JS_START}\n<script>${SCENE_KIT_HEAD_JS}</script>\n${SK_JS_END}`;

// ── Region sync ────────────────────────────────────────────────────────────

/**
 * Replace one marker-delimited region with `replacement`.
 * Returns { html, problem, present }: a page missing one half of a pair is a
 * problem, never a silent skip (SO #34c — absence is not a pass).
 */
export function replaceRegion(html, startMark, endMark, replacement) {
  const s = html.indexOf(startMark);
  const e = html.indexOf(endMark);
  if (s === -1 && e === -1) return { html, problem: null, present: false };
  if (s === -1 || e === -1) return { html, problem: `half a marker pair: ${s === -1 ? startMark : endMark} is missing`, present: true };
  if (e < s) return { html, problem: `markers out of order: ${endMark} precedes ${startMark}`, present: true };
  if (html.indexOf(startMark, s + 1) !== -1 || html.indexOf(endMark, e + 1) !== -1) {
    return { html, problem: `duplicate marker pair around ${startMark}`, present: true };
  }
  return { html: html.slice(0, s) + replacement + html.slice(e + endMark.length), problem: null, present: true };
}

/** Everything between a marker pair, removed. Used by the composition scan. */
function stripRegion(html, startMark, endMark) {
  const s = html.indexOf(startMark);
  const e = html.indexOf(endMark);
  if (s === -1 || e === -1 || e < s) return html;
  return html.slice(0, s) + html.slice(e + endMark.length);
}

/** The page as it SHOULD read. Returns { html, problems, marked }. */
export function syncedHtml(src) {
  const problems = [];
  let out = src;
  const css = replaceRegion(out, CSS_START, CSS_END, cssRegion());
  if (css.problem) problems.push(css.problem);
  out = css.html;
  const js = replaceRegion(out, JS_START, JS_END, jsRegion());
  if (js.problem) problems.push(js.problem);
  out = js.html;
  // A page carrying one region and not the other is half-adopted: the design
  // without the script gives a page no presenter mode and no scene playback,
  // and the script without the design styles nothing it drives.
  if (css.present !== js.present && !problems.length) {
    problems.push(css.present
      ? `carries the design markers but not ${JS_START}`
      : `carries the script markers but not ${CSS_START}`);
  }
  return { html: out, problems, marked: css.present || js.present };
}

// ── Composition: one animation system ──────────────────────────────────────

/**
 * A marked page must compose the scene kit and must not grow an animation
 * system beside it. Returns a list of problems.
 */
export function compositionProblems(src) {
  const problems = [];
  const hasSkCss = src.includes(SK_CSS_START) && src.includes(SK_CSS_END);
  const hasSkJs = src.includes(SK_JS_START) && src.includes(SK_JS_END);
  if (!hasSkCss || !hasSkJs) {
    problems.push(`an explainer takes its motion from SCENE-KIT v1: add the ${hasSkCss ? SK_JS_START : SK_CSS_START} region `
      + `(scripts/lib/scene-kit.mjs), then run: node scripts/sync-scene-kit.mjs --write`);
  }
  let rest = src;
  for (const [a, b] of [[CSS_START, CSS_END], [JS_START, JS_END], [SK_CSS_START, SK_CSS_END], [SK_JS_START, SK_JS_END]]) {
    rest = stripRegion(rest, a, b);
  }
  if (/@keyframes\s/.test(rest)) {
    problems.push('declares @keyframes of its own outside the kit regions — one animation system per estate: '
      + 'add the frames to scripts/lib/scene-kit.mjs and use its sk- classes');
  }
  if (/[{;"'\s]animation(-name)?\s*:/.test(rest)) {
    problems.push('declares an animation property outside the kit regions — one animation system per estate: '
      + 'move the rule into scripts/lib/scene-kit.mjs and use its sk- classes');
  }
  return problems;
}

/** Every problem one page has: region drift first, then composition. */
export function checkHtml(src) {
  const problems = [];
  const { html, problems: regionProblems } = syncedHtml(src);
  problems.push(...regionProblems);
  if (!regionProblems.length && html !== src) {
    problems.push('inline EXPLAINER-KIT copy differs from scripts/lib/explainer-kit.mjs — run: node scripts/sync-explainer-kit.mjs --write');
  }
  problems.push(...compositionProblems(src));
  return problems;
}

// ── The scaffold a new explainer starts from ───────────────────────────────

// CONTRACT §1.3, verbatim. The banner is the one place an em-dash is allowed
// in reader-facing copy (§1.4 exempts it).
const PII_BANNER = '🔒 All inputs are processed locally in your browser. No data is transmitted. '
  + 'Do not enter real personal data — use synthetic or anonymised inputs only.';

function titleFromSlug(slug) {
  return slug.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

/**
 * A complete, self-contained explainer with one worked panel. It carries both
 * kit region pairs, so it reads GREEN under --check the moment it is written.
 * The footer is left out on purpose: the node-footer writer owns that region
 * and adds it from chaingraph/_page-chrome.mjs.
 */
export function scaffold(slug) {
  const title = titleFromSlug(slug);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · OpenChainGraph Explainer</title>
<meta name="description" content="Replace this sentence with what the page explains and what a reader can check for themselves.">
<meta name="ain:category" content="learn">
<meta name="author" content="Post Oak Labs">
<link rel="canonical" href="https://ainumbers.co/chaingraph/${slug}.html">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<style>
${skCssRegion()}
${cssRegion()}
</style>
${skJsRegion()}
</head>
<body>

<header class="hero"><div class="wrap">
  <div class="eyebrow">OpenChainGraph &middot; Explainer</div>
  <h1>${title}</h1>
  <p>One paragraph on what the page walks through and where its numbers come from.</p>
  <div class="hero-actions">
    <button type="button" class="btn btn-primary" id="btnPresent">Present this page</button>
    <span class="hint">Presenter mode shows one step per screen. Arrow keys move, A toggles autoplay, Esc exits.</span>
  </div>
  <div class="stair-map" role="navigation" aria-label="Map of every step on this page">
    <svg id="stairMap" viewBox="0 0 1000 260" aria-hidden="false" role="list"></svg>
  </div>
</div></header>

<section class="panel" id="s-first" data-stair="First step" data-part="1"><div class="wrap">
  <div class="panel-head"><span class="stage-n">1</span><div><div class="kicker">Step 1</div><h2>Name the first idea</h2></div></div>
  <p class="lede">One sentence that adds a single idea to the reader's picture.</p>
  <div class="scene-wrap"><button type="button" class="replay" data-replay>Replay</button><div class="scene-scroll"><svg class="sk-scene" viewBox="0 0 960 200" role="img" aria-label="Describe the drawing in a sentence a screen reader can follow.">
    <g class="sk-fade" style="--d:.1s"><rect x="40" y="52" width="220" height="96" rx="10" fill="var(--bg-3)" stroke="var(--border-2)" stroke-width="1.4"/><text x="150" y="106" text-anchor="middle" class="b sm">the first thing</text></g>
    <path class="sk-draw" d="M268 100 H400" stroke="var(--muted)" stroke-width="1.6" fill="none" style="--len:132;--d:.5s"/>
    <g class="sk-pop" style="--d:1.1s"><rect x="408" y="52" width="220" height="96" rx="10" fill="var(--teal-dim)" stroke="var(--teal)" stroke-width="1.4"/><text x="518" y="106" text-anchor="middle" class="t sm">what it becomes</text></g>
  </svg></div></div>
  <p class="detail">Longer background for a reader who wants it. Presenter mode hides this.</p>
  <div class="prompt"><div class="prompt-head"><span>Who asks at this step</span><span class="lvl">no agent yet</span></div><pre>The prompt an agent can send once this step exists.</pre></div>
</div></section>

<div class="pii">${PII_BANNER}</div>

<div class="pbar" id="pbar" role="toolbar" aria-label="Presenter controls">
  <button type="button" class="btn" id="pPrev" aria-label="Previous step">&#8592;</button>
  <span class="count" id="pCount">1 / 1</span>
  <button type="button" class="btn" id="pNext" aria-label="Next step">&#8594;</button>
  <div class="rail"><svg id="pRail" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true"></svg></div>
  <button type="button" class="btn" id="pAuto" aria-pressed="false">Autoplay</button>
  <button type="button" class="btn" id="pExit">Exit</button>
</div>

${jsRegion()}
</body>
</html>
`;
}

// ── Repo walk ──────────────────────────────────────────────────────────────

// SO #52: enumerate with git, never a directory walk — this workspace holds
// dozens of live worktrees and a recursive walk would edit other sessions'
// branches.
function trackedHtml() {
  return gitSync(['ls-files', '-z', '--', '*.html'], { cwd: REPO })
    .split('\0').filter(Boolean);
}

function markedPages() {
  const pages = [];
  for (const rel of trackedHtml()) {
    const src = readFileSync(resolve(REPO, rel), 'utf8');
    if (src.includes(CSS_START) || src.includes(CSS_END) || src.includes(JS_START) || src.includes(JS_END)) pages.push({ rel, src });
  }
  return pages;
}

function runCheck() {
  const failures = [];
  const pages = markedPages();
  for (const { rel, src } of pages) {
    const problems = checkHtml(src);
    if (problems.length) failures.push([rel, problems]);
  }
  if (failures.length) {
    console.error('EXPLAINER-KIT sync: RED');
    for (const [rel, problems] of failures) for (const p of problems) console.error(`  ${rel}: ${p}`);
    process.exit(1);
  }
  console.log(`EXPLAINER-KIT sync: OK — ${pages.length} page(s) in sync with scripts/lib/explainer-kit.mjs, each composing SCENE-KIT v1`);
}

function runWrite() {
  let written = 0;
  for (const { rel, src } of markedPages()) {
    const { html, problems, marked } = syncedHtml(src);
    if (problems.length) {
      console.error(`EXPLAINER-KIT write: ${rel}: ${problems.join('; ')}`);
      process.exit(1);
    }
    if (!marked || html === src) continue;
    writeFileSync(resolve(REPO, rel), html);
    console.log(`EXPLAINER-KIT write: synced ${rel}`);
    written += 1;
  }
  console.log(`EXPLAINER-KIT write: ${written} page(s) rewritten`);
  // Writing fixes the copies; it never fixes a page that animates on its own.
  for (const { rel, src } of markedPages()) {
    for (const p of compositionProblems(src)) console.error(`EXPLAINER-KIT write: ${rel}: ${p}`);
  }
}

function runNew(slug) {
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    console.error('usage: node scripts/sync-explainer-kit.mjs --new <slug>   (lower case, hyphen separated)');
    process.exit(2);
  }
  const rel = `chaingraph/${slug}.html`;
  const abs = resolve(REPO, rel);
  if (existsSync(abs)) {
    console.error(`EXPLAINER-KIT new: ${rel} already exists — pick another slug or edit the page in place`);
    process.exit(1);
  }
  const html = scaffold(slug);
  writeFileSync(abs, html);
  console.log(`EXPLAINER-KIT new: wrote ${rel}`);
  console.log('Next: write the panels, then run `node scripts/sync-explainer-kit.mjs --check` and `node scripts/preflight.mjs`.');
}

// ── Self-test: the checker proved RED before it is trusted GREEN (SO #34c) ──

function runSelftest() {
  const results = [];
  const assert = (name, cond) => { results.push([name, !!cond]); };

  // The scene-kit marker strings this script hardcodes still exist in the
  // script that owns them.
  const syncScene = readFileSync(resolve(HERE, 'sync-scene-kit.mjs'), 'utf8');
  for (const mark of [SK_CSS_START, SK_CSS_END, SK_JS_START, SK_JS_END]) {
    assert(`sync-scene-kit.mjs still defines ${mark}`, syncScene.includes(mark));
  }

  // GREEN: the scaffold this script writes passes its own gate.
  const green = scaffold('example-explainer');
  assert('the --new scaffold is GREEN', checkHtml(green).length === 0);
  assert('the --new scaffold carries the PII banner (CONTRACT §1.3)', green.includes(PII_BANNER));
  assert('the --new scaffold composes the scene kit', green.includes(SK_CSS_START) && green.includes(SK_JS_START));

  // RED: one byte changed in the CSS copy.
  const cssMutant = green.replace('.wrap{max-width:1000px', '.wrap{max-width:1020px');
  assert('a one-byte CSS drift is RED', checkHtml(cssMutant).some((p) => p.includes('differs from scripts/lib/explainer-kit.mjs')));

  // RED: the presenter script drifts.
  const jsMutant = green.replace('threshold: 0.25', 'threshold: 0.45');
  assert('a presenter-script drift is RED', checkHtml(jsMutant).some((p) => p.includes('differs from scripts/lib/explainer-kit.mjs')));

  // RED: half a marker pair.
  assert('a missing END marker is RED', checkHtml(green.replace(CSS_END, '')).some((p) => p.includes('half a marker pair')));

  // RED: the design without the script.
  const cssOnly = green.replace(JS_START, '').replace(JS_END, '');
  assert('the design without the presenter script is RED', checkHtml(cssOnly).some((p) => p.includes('carries the design markers but not')));

  // RED: the kit without the scene kit, which is the composition rule.
  const noScene = green.replace(SK_CSS_START, '').replace(SK_CSS_END, '');
  assert('dropping the SCENE-KIT region is RED', checkHtml(noScene).some((p) => p.includes('takes its motion from SCENE-KIT v1')));

  // RED: a private animation system, the exact drift the kit exists to refuse.
  const ownFrames = green.replace('</style>', '@keyframes my-own{to{opacity:1}}\n.mine{animation:my-own 1s linear}\n</style>');
  assert('page-local @keyframes are RED', checkHtml(ownFrames).some((p) => p.includes('@keyframes of its own')));
  assert('a page-local animation property is RED', checkHtml(ownFrames).some((p) => p.includes('an animation property outside')));

  // The kit itself holds no animation, which is what makes that rule honest.
  assert('the explainer kit declares no animation', !/@keyframes\s/.test(EXPLAINER_KIT_CSS) && !/[{;\s]animation(-name)?\s*:/.test(EXPLAINER_KIT_CSS));

  // --write repairs exactly what --check flags.
  assert('--write repairs the CSS drift', checkHtml(syncedHtml(cssMutant).html).length === 0);
  assert('--write repairs the script drift', checkHtml(syncedHtml(jsMutant).html).length === 0);

  let failed = 0;
  for (const [name, ok] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) failed += 1;
  }
  if (failed) { console.error(`EXPLAINER-KIT selftest: ${failed} of ${results.length} FAILED`); process.exit(1); }
  console.log(`EXPLAINER-KIT selftest: ${results.length} checks PASS`);
}

// ── Entry ──────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
if (argv.includes('--selftest')) runSelftest();
else if (argv.includes('--new')) runNew(argv[argv.indexOf('--new') + 1]);
else if (argv.includes('--write')) runWrite();
else if (argv.includes('--check')) runCheck();
else {
  console.error('usage: node scripts/sync-explainer-kit.mjs [--check | --write | --new <slug> | --selftest]');
  process.exit(2);
}
