#!/usr/bin/env node
/**
 * scripts/sync-scene-kit.mjs — ZK-PAGES-SVG-PILOT-1 (2026-09-27)
 *
 * SCENE-KIT v1 lives in scripts/lib/scene-kit.mjs. Generated pages import it;
 * hand-authored explainers cannot (CONTRACT: one self-contained .html per
 * page), so they carry an inline COPY of SCENE_KIT_CSS and SCENE_KIT_HEAD_JS.
 * A copy drifts. This script owns those copies:
 *
 *   · the CSS between the SCENE-KIT:v1:START and SCENE-KIT:v1:END comment
 *     markers inside the page's <style>, and
 *   · the head script between <!-- SCENE-KIT-JS:v1:START --> and
 *     <!-- SCENE-KIT-JS:v1:END --> in the page's <head>,
 *
 * written from the lib byte for byte. The page list is DERIVED by scanning
 * tracked HTML for those markers — never hand-listed, so a page that adopts
 * the kit is covered the moment it carries the markers.
 *
 * MOTION TIMING (WCAG 2.2 success criterion 2.2.2 Pause, Stop, Hide, Level A).
 * Motion that starts automatically, lasts more than five seconds and is
 * presented in parallel with other content needs a pause control, unless it
 * stops within five seconds. The kit meets that by design (sk-travel runs
 * once, sk-pulse twice), and --check holds every page to it: for every page
 * containing <svg class="sk-scene" — marked, generated, or neither — it
 * computes each animated element's end time as (--d delay) + duration ×
 * iterations, with durations and iteration counts PARSED OUT OF SCENE_KIT_CSS
 * rather than hardcoded here (SO #34: the gate recomputes from the primary
 * source), and fails when any scene ends after 5s or when a kit rule carries
 * an `infinite` iteration count. Custom properties inherit, so an element's
 * --d / --dur is read from its own style attribute or, failing that, from its
 * nearest ancestor inside the scene.
 *
 * SCENE-PACKET (SCENE-PACKET-ARROW-LINT-1, Tim 2026-10-02): site PR 2182 fixed
 * message boxes that slid across a scene and vanished, leaving no arrow to show
 * direction — the gate now holds that line. A travel-animated element (class
 * `sk-travel`) that contains a <text> descendant is a labelled packet; a scene
 * holding one needs a persistent arrowhead in the same scene (a <polygon>
 * element, or any element with a marker-start/marker-end attribute). Scope is
 * the scene, not the page: only a scene that is new in the PR or whose bytes
 * differ from the same scene at the base ref (origin/main, resolved through
 * _changed-files-lib.js's resolveChangedScope exactly as the copy gate does)
 * can fail — every other defective scene is counted in one advisory summary
 * line and never fails.
 *
 * Usage:
 *   node scripts/sync-scene-kit.mjs --check     — verify copies + motion timing + the SCENE-PACKET
 *                                                 arrowhead rule (exit 1 on drift)
 *   node scripts/sync-scene-kit.mjs --write     — rewrite every marked page's regions from the lib
 *   node scripts/sync-scene-kit.mjs --selftest  — RED/GREEN mutation control over in-memory fixtures
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitSync } from './_git-env-lib.mjs';
import { resolveChangedScope, isTouched } from './_changed-files-lib.js';
import { SCENE_KIT_CSS, SCENE_KIT_HEAD_JS } from './lib/scene-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const CSS_START = '/* SCENE-KIT:v1:START */';
const CSS_END = '/* SCENE-KIT:v1:END */';
const JS_START = '<!-- SCENE-KIT-JS:v1:START -->';
const JS_END = '<!-- SCENE-KIT-JS:v1:END -->';

// The scene marker every animated page carries, and the WCAG 2.2.2 line.
const SCENE_TAG = '<svg class="sk-scene"';
const MAX_END_MS = 5000;

// SCENE-PACKET: the PR base the packet rule is scoped against, and the one
// travel class it watches.
const PACKET_BASE_REF = 'origin/main';
const TRAVEL_CLS = 'sk-travel';

const cssRegion = () => `${CSS_START}\n${SCENE_KIT_CSS}\n${CSS_END}`;
const jsRegion = () => `${JS_START}\n<script>${SCENE_KIT_HEAD_JS}</script>\n${JS_END}`;

// ── Region sync ────────────────────────────────────────────────────────────

/**
 * Replace one marker-delimited region with `replacement`.
 * Returns { html, problem }: a page missing one half of a pair is a problem,
 * never a silent skip (SO #34c — absence is not a pass).
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
  // A page carrying one region and not the other is half-adopted: the CSS
  // without the head script means the hidden start states never play, and the
  // head script without the CSS does nothing at all.
  if (css.present !== js.present && !problems.length) {
    problems.push(css.present
      ? `carries the CSS markers but not ${JS_START}`
      : `carries the head-script markers but not ${CSS_START}`);
  }
  return { html: out, problems, marked: css.present || js.present };
}

// ── Motion timing, derived from SCENE_KIT_CSS ──────────────────────────────

/** '.9s' | '250ms' | '0s' → milliseconds. Returns null when not a time. */
export function timeToMs(token) {
  const m = /^(-?\d*\.?\d+)(ms|s)$/.exec(String(token).trim());
  if (!m) return null;
  return m[2] === 'ms' ? Number(m[1]) : Number(m[1]) * 1000;
}

/**
 * Parse the kit's own animation rules out of SCENE_KIT_CSS.
 * Returns Map<className, { durMs, durVar, iterations, delayVar, infinite }>.
 */
export function parseKitTimings(css) {
  const out = new Map();
  const ruleRe = /\.sk-js\s+\.sk-scene\.sk-play\s+\.(sk-[a-z-]+)\s*\{\s*animation:([^}]+)\}/g;
  let m;
  while ((m = ruleRe.exec(css)) !== null) {
    const cls = m[1];
    const decl = m[2].trim();
    // Shorthand tokens, keeping var(...) groups whole.
    const tokens = decl.match(/var\([^)]*\)|[^\s]+/g) ?? [];
    let durMs = null; let durVar = null; let delayVar = null;
    let iterations = 1; let infinite = false;
    for (const tk of tokens) {
      const varMatch = /^var\(\s*(--[a-z-]+)\s*,\s*([^)]+)\)$/.exec(tk);
      if (varMatch) {
        const fallback = timeToMs(varMatch[2]);
        if (fallback === null) continue;
        if (durMs === null) { durMs = fallback; durVar = varMatch[1]; }
        else if (delayVar === null) { delayVar = varMatch[1]; }
        continue;
      }
      if (tk === 'infinite') { infinite = true; continue; }
      const t = timeToMs(tk);
      if (t !== null) { if (durMs === null) durMs = t; continue; }
      if (/^\d+(\.\d+)?$/.test(tk)) { iterations = Number(tk); continue; }
    }
    if (durMs === null) continue;
    out.set(cls, { durMs, durVar, iterations, delayVar: delayVar ?? '--d', infinite });
  }
  return out;
}

/** Custom properties declared in a style attribute: 'style="--d:.6s;--tx:40px"'. */
function customProps(styleAttr) {
  const props = {};
  if (!styleAttr) return props;
  for (const decl of styleAttr.split(';')) {
    const i = decl.indexOf(':');
    if (i === -1) continue;
    const name = decl.slice(0, i).trim();
    if (!name.startsWith('--')) continue;
    props[name] = decl.slice(i + 1).trim();
  }
  return props;
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'use']);

/**
 * Every <svg class="sk-scene"> block in `html`, with its id and the latest
 * moment any animation inside it finishes.
 * Returns [{ id, endMs, worst: { cls, endMs } | null }].
 */
export function sceneTimings(html, timings) {
  const scenes = [];
  let from = 0;
  for (;;) {
    const start = html.indexOf(SCENE_TAG, from);
    if (start === -1) break;
    const end = html.indexOf('</svg>', start);
    const block = html.slice(start, end === -1 ? html.length : end + 6).replace(/<!--[\s\S]*?-->/g, '');
    from = end === -1 ? html.length : end + 6;

    // Name the scene for the error message: its own id when it has one, else
    // the figure id the kit's aria-labelledby is built from ("<id>-t <id>-d").
    const openTag = block.slice(0, block.indexOf('>') + 1);
    const ownId = /\bid="([^"]+)"/.exec(openTag)?.[1];
    const labelId = /\baria-labelledby="([^"\s]+)/.exec(openTag)?.[1]?.replace(/-t$/, '');
    const scene = { id: ownId ?? labelId ?? '(unnamed scene)', endMs: 0, worst: null };

    // Walk the tags, carrying inherited custom properties down the stack.
    const stack = [];
    const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g;
    let t;
    while ((t = tagRe.exec(block)) !== null) {
      const [, closing, name, attrs, selfClose] = t;
      if (closing) { if (stack.length) stack.pop(); continue; }
      const inherited = stack.length ? stack[stack.length - 1] : {};
      const own = customProps(/\bstyle="([^"]*)"/.exec(attrs)?.[1]);
      const props = { ...inherited, ...own };

      const classAttr = /\bclass="([^"]*)"/.exec(attrs)?.[1] ?? '';
      for (const cls of classAttr.split(/\s+/)) {
        const rule = timings.get(cls);
        if (!rule) continue;
        const delay = timeToMs(props[rule.delayVar] ?? '0s') ?? 0;
        const dur = rule.durVar ? (timeToMs(props[rule.durVar] ?? '') ?? rule.durMs) : rule.durMs;
        const endMs = delay + dur * rule.iterations;
        if (endMs > scene.endMs) { scene.endMs = endMs; scene.worst = { cls, endMs }; }
      }
      if (!selfClose && !VOID_TAGS.has(name.toLowerCase())) stack.push(props);
    }
    scenes.push(scene);
  }
  return scenes;
}

/**
 * Every problem one page has: region drift first, then motion timing.
 * `src` is the page as committed; `timings` comes from parseKitTimings.
 */
export function checkHtml(src, timings) {
  const problems = [];
  const { html, problems: regionProblems } = syncedHtml(src);
  problems.push(...regionProblems);
  if (!regionProblems.length && html !== src) {
    problems.push(`inline SCENE-KIT copy differs from scripts/lib/scene-kit.mjs — run: node scripts/sync-scene-kit.mjs --write`);
  }
  for (const scene of sceneTimings(src, timings)) {
    if (scene.endMs > MAX_END_MS) {
      problems.push(`scene #${scene.id} keeps moving until ${(scene.endMs / 1000).toFixed(2)}s `
        + `(.${scene.worst.cls} is last) — WCAG 2.2.2 needs every scene still by ${MAX_END_MS / 1000}s`);
    }
  }
  return problems;
}

/** Kit rules that never stop. An infinite animation needs a pause control. */
export function infiniteRules(timings) {
  return [...timings.entries()].filter(([, r]) => r.infinite).map(([cls]) => cls);
}

// ── SCENE-PACKET: a travelling packet that carries text needs an arrowhead ──

/**
 * The one SCENE-PACKET rule (SCENE-PACKET-ARROW-LINT-1). In a scene, a
 * travel-animated element (class `sk-travel`) that contains a <text>
 * descendant is a labelled packet; a scene holding one needs a persistent
 * arrowhead in the same scene — a <polygon> element, or any element with a
 * marker-start/marker-end attribute. Unlabelled marks are exempt.
 *
 * `changed` is the page's changed-scope verdict (resolveChangedScope vs
 * PACKET_BASE_REF); `baseSrc` is the page at the base ref, null when the page
 * is new in the PR. Scope is the scene: a defective scene fails the gate only
 * when it is new (no base scene at its index) or its bytes differ from the
 * base scene at the same index — every other defective scene is returned in
 * `advisory` for the summary line and never fails.
 * Returns { failures, advisory }: gate-RED lines, and the unchanged defect
 * scenes [{ index, id, packets }].
 */
export function packetArrowFindings(src, { baseSrc = null, changed = false } = {}) {
  // Audit one page: every scene block with its index, name, labelled-packet
  // count and arrowhead flag. Same block-splitting discipline as sceneTimings.
  const audit = (html) => {
    const out = [];
    let from = 0;
    for (;;) {
      const start = html.indexOf(SCENE_TAG, from);
      if (start === -1) break;
      const end = html.indexOf('</svg>', start);
      const block = html.slice(start, end === -1 ? html.length : end + 6).replace(/<!--[\s\S]*?-->/g, '');
      from = end === -1 ? html.length : end + 6;

      // Name the scene the way sceneTimings does: own id, else the figure id
      // the kit's aria-labelledby is built from.
      const openTag = block.slice(0, block.indexOf('>') + 1);
      const ownId = /\bid="([^"]+)"/.exec(openTag)?.[1];
      const labelId = /\baria-labelledby="([^"\s]+)/.exec(openTag)?.[1]?.replace(/-t$/, '');

      // Walk the tags: every sk-travel frame remembers whether a <text>
      // opened inside it; a <polygon> or a marker attribute anywhere in the
      // scene is the persistent arrowhead.
      const frames = [];
      let packets = 0;
      let arrow = block.includes('<polygon');
      const tagRePacket = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g;
      let t;
      while ((t = tagRePacket.exec(block)) !== null) {
        const [, closing, name, attrs, selfClose] = t;
        if (closing) {
          const frame = frames.pop();
          if (frame?.travel && frame.textSeen) packets += 1;
          continue;
        }
        if (/\bmarker-(?:start|end)\s*=/.test(attrs)) arrow = true;
        const classAttr = /\bclass="([^"]*)"/.exec(attrs)?.[1] ?? '';
        const isTravel = classAttr.split(/\s+/).includes(TRAVEL_CLS);
        if (name.toLowerCase() === 'text') {
          for (let i = frames.length - 1; i >= 0; i -= 1) {
            if (frames[i].travel) { frames[i].textSeen = true; break; }
          }
        }
        if (!selfClose && !VOID_TAGS.has(name.toLowerCase())) frames.push({ travel: isTravel, textSeen: false });
      }
      out.push({ index: out.length, id: ownId ?? labelId ?? '(unnamed scene)', block, packets, arrow });
    }
    return out;
  };

  const base = baseSrc === null ? null : audit(baseSrc);
  const failures = [];
  const advisory = [];
  for (const scene of audit(src)) {
    if (!scene.packets || scene.arrow) continue;
    // In scope only when the page is touched AND this scene is new (the base
    // page has no scene at its index) or its bytes differ from the base
    // scene at the same index.
    if (changed && (base === null || scene.index >= base.length || scene.block !== base[scene.index].block)) {
      failures.push(`scene #${scene.index} ${scene.id} carries ${scene.packets} labelled packet(s) `
        + `travelling with no persistent arrowhead — a packet that carries text needs a <polygon> `
        + `or a marker-start/marker-end in the same scene`);
    } else {
      advisory.push({ index: scene.index, id: scene.id, packets: scene.packets });
    }
  }
  return { failures, advisory };
}

// ── Repo walk ──────────────────────────────────────────────────────────────

// SO #52: enumerate with git, never a directory walk — this workspace holds
// dozens of live worktrees and a recursive walk would edit other sessions'
// branches.
function trackedHtml() {
  return gitSync(['ls-files', '-z', '--', '*.html'], { cwd: REPO })
    .split('\0').filter(Boolean);
}

function relevantPages() {
  const pages = [];
  for (const rel of trackedHtml()) {
    const src = readFileSync(resolve(REPO, rel), 'utf8');
    if (src.includes(CSS_START) || src.includes(JS_START) || src.includes(SCENE_TAG)) pages.push({ rel, src });
  }
  return pages;
}

function runCheck() {
  const timings = parseKitTimings(SCENE_KIT_CSS);
  const failures = [];
  const endless = infiniteRules(timings);
  if (endless.length) failures.push(['scripts/lib/scene-kit.mjs', [`kit rules run forever: ${endless.join(', ')} — WCAG 2.2.2 would need a pause control`]]);

  const pages = relevantPages();
  // SCENE-PACKET scope (PREREQ-CHANGED-SCOPING-1): which pages the PR touches,
  // vs the PR base. resolveChangedScope exactly as the copy gate
  // (check-copy-hallmarks.mjs) — an undeterminable diff fails CLOSED.
  const CHANGED = resolveChangedScope(PACKET_BASE_REF, { gate: 'sync-scene-kit.mjs --check (SCENE-PACKET)', failClosed: true });
  const advisoryScenes = [];
  for (const { rel, src } of pages) {
    const problems = checkHtml(src, timings);
    const touched = isTouched(rel, CHANGED);
    // The page at the base ref, for the scene-by-scene byte comparison.
    // A failed `git show` means the page is new in the PR: baseSrc stays null.
    let baseSrc = null;
    if (touched) {
      try { baseSrc = gitSync(['show', `${PACKET_BASE_REF}:${rel}`], { cwd: REPO }); } catch { baseSrc = null; }
    }
    const { failures: packetFailures, advisory } = packetArrowFindings(src, { baseSrc, changed: touched });
    problems.push(...packetFailures);
    for (const scene of advisory) advisoryScenes.push({ rel, ...scene });
    if (problems.length) failures.push([rel, problems]);
  }
  // Unchanged defective scenes NEVER fail (scope is the scene, not the page):
  // one detail line each, then the advisory summary line.
  for (const { rel, index, id, packets } of advisoryScenes) {
    console.log(`SCENE-PACKET (advisory): ${rel} scene #${index} ${id} holds ${packets} labelled packet(s) with no arrowhead`);
  }
  if (advisoryScenes.length) {
    console.log(`SCENE-PACKET (advisory): ${advisoryScenes.length} unchanged scenes hold a labelled packet with no arrowhead`);
  }
  const scenes = pages.reduce((n, p) => n + sceneTimings(p.src, timings).length, 0);
  if (failures.length) {
    console.error('SCENE-KIT sync: RED');
    for (const [rel, problems] of failures) for (const p of problems) console.error(`  ${rel}: ${p}`);
    process.exit(1);
  }
  console.log(`SCENE-KIT sync: OK — ${pages.length} page(s), ${scenes} scene(s), every scene still within ${MAX_END_MS / 1000}s`);
}

function runWrite() {
  const timings = parseKitTimings(SCENE_KIT_CSS);
  let written = 0;
  for (const { rel, src } of relevantPages()) {
    const { html, problems, marked } = syncedHtml(src);
    if (problems.length) {
      console.error(`SCENE-KIT write: ${rel}: ${problems.join('; ')}`);
      process.exit(1);
    }
    if (!marked || html === src) continue;
    writeFileSync(resolve(REPO, rel), html);
    console.log(`SCENE-KIT write: synced ${rel}`);
    written += 1;
  }
  console.log(`SCENE-KIT write: ${written} page(s) rewritten`);
  // Writing fixes the copies; it never fixes a scene that runs too long.
  for (const { rel, src } of relevantPages()) {
    for (const scene of sceneTimings(src, timings)) {
      if (scene.endMs > MAX_END_MS) console.error(`SCENE-KIT write: ${rel} scene #${scene.id} still runs to ${(scene.endMs / 1000).toFixed(2)}s — fix the delays by hand`);
    }
  }
}

// ── Self-test: the checker proved RED before it is trusted GREEN (SO #34c) ──

function runSelftest() {
  const results = [];
  const assert = (name, cond) => { results.push([name, !!cond]); };

  const page = (cssBody, jsBody, scene = '') => `<!DOCTYPE html><html><head><style>
${CSS_START}
${cssBody}
${CSS_END}
</style>
${JS_START}
<script>${jsBody}</script>
${JS_END}
</head><body>${scene}</body></html>`;

  const timings = parseKitTimings(SCENE_KIT_CSS);

  // The kit's own rules parsed, not assumed.
  assert('parses sk-pulse from the kit CSS', timings.get('sk-pulse')?.durMs === 2200 && timings.get('sk-pulse')?.iterations === 2);
  assert('parses sk-travel default duration from var(--dur,...)', timings.get('sk-travel')?.durMs === 2600 && timings.get('sk-travel')?.durVar === '--dur');
  assert('no kit rule runs forever', infiniteRules(timings).length === 0);

  // GREEN: regions in sync, a scene ending at 4.8s.
  const okScene = `<figure><div class="sk-scroll">${SCENE_TAG} id="ok-scene" viewBox="0 0 100 100">`
    + `<g class="sk-fade" style="--d:.4s"><rect class="sk-pop"/></g>`
    + `<path class="sk-travel" style="--d:2.2s;--dur:2.6s"/>`
    + `</svg></div></figure>`;
  const green = page(SCENE_KIT_CSS, SCENE_KIT_HEAD_JS, okScene);
  assert('in-sync page with a 4.8s scene is GREEN', checkHtml(green, timings).length === 0);
  assert('the 4.8s scene is measured at 4.8s', sceneTimings(green, timings)[0].endMs === 4800);

  // RED: one byte changed in the CSS copy.
  const cssMutant = page(SCENE_KIT_CSS.replace('.sk-fig{margin:1.1rem', '.sk-fig{margin:1.2rem'), SCENE_KIT_HEAD_JS, okScene);
  assert('a one-byte CSS drift is RED', checkHtml(cssMutant, timings).some((p) => p.includes('differs from scripts/lib/scene-kit.mjs')));

  // RED: the head script drifts.
  const jsMutant = page(SCENE_KIT_CSS, SCENE_KIT_HEAD_JS.replace('threshold:0.2', 'threshold:0.5'), okScene);
  assert('a head-script drift is RED', checkHtml(jsMutant, timings).some((p) => p.includes('differs from scripts/lib/scene-kit.mjs')));

  // RED: half a marker pair.
  const halfMarked = green.replace(CSS_END, '');
  assert('a missing END marker is RED', checkHtml(halfMarked, timings).some((p) => p.includes('half a marker pair')));

  // RED: one delay pushed past five seconds.
  const slowScene = okScene.replace('--d:2.2s', '--d:3.2s').replace('ok-scene', 'slow-scene');
  const slow = page(SCENE_KIT_CSS, SCENE_KIT_HEAD_JS, slowScene);
  assert('a scene ending at 5.8s is RED', checkHtml(slow, timings).some((p) => p.includes('slow-scene') && p.includes('5.80s')));

  // RED: an inherited delay, declared on the group and not on the element.
  const inheritScene = `${SCENE_TAG} id="inherit-scene" viewBox="0 0 10 10"><g style="--d:4.6s"><rect class="sk-pop"/></g></svg>`;
  assert('an inherited --d is counted', sceneTimings(inheritScene, timings)[0].endMs === 5100);
  assert('an inherited over-run is RED', checkHtml(page(SCENE_KIT_CSS, SCENE_KIT_HEAD_JS, inheritScene), timings).some((p) => p.includes('inherit-scene')));

  // RED: a kit rule that never stops.
  const endlessKit = parseKitTimings(SCENE_KIT_CSS.replace('animation:sk-pulse 2.2s ease-in-out 2', 'animation:sk-pulse 2.2s ease-in-out infinite'));
  assert('an infinite kit rule is RED', infiniteRules(endlessKit).includes('sk-pulse'));

  // --write repairs exactly what --check flags.
  assert('--write repairs the CSS drift', checkHtml(syncedHtml(cssMutant).html, timings).length === 0);

  // ── SCENE-PACKET control pair (SCENE-PACKET-ARROW-LINT-1) ──────────────────
  // A travelling packet that carries text needs a persistent arrowhead in its
  // scene when the scene is new in the PR or differs from the base scene.
  const packetScene = (inner) => `${SCENE_TAG} id="packet-scene" viewBox="0 0 100 100">${inner}</svg>`;
  const baseScene = packetScene(`<circle r="1"/>`); // base: no packet in this scene
  const packet = `<g class="sk-travel" style="--d:.4s;--tx:40px"><circle r="4"/><text x="10" y="10">msg</text></g>`;
  const scoped = { baseSrc: baseScene, changed: true };

  // RED: a changed scene whose labelled packet has no polygon or marker.
  const redPacket = packetArrowFindings(packetScene(packet), scoped);
  assert('a changed scene whose labelled packet has no arrowhead is RED',
    redPacket.failures.length === 1 && redPacket.advisory.length === 0 && redPacket.failures[0].includes('packet-scene'));

  // GREEN: the same scene with a <polygon>.
  const polyOut = packetArrowFindings(packetScene(packet + `<polygon points="0,0 4,2 0,4"/>`), scoped);
  assert('the same scene with a <polygon> is GREEN', polyOut.failures.length === 0 && polyOut.advisory.length === 0);

  // GREEN: the same scene with a marker-end path.
  const markerOut = packetArrowFindings(packetScene(packet + `<path d="M0 0L4 2" marker-end="url(#a)"/>`), scoped);
  assert('the same scene with a marker-end path is GREEN', markerOut.failures.length === 0 && markerOut.advisory.length === 0);

  // GREEN: unlabelled marks are exempt — a bare circle that travels, its text
  // living in a plain group, is no packet at all.
  const bare = packetScene(`<g><text x="10" y="10">label</text></g><g class="sk-travel" style="--d:.4s"><circle r="4"/></g>`);
  const bareOut = packetArrowFindings(bare, scoped);
  assert('an unlabelled travelling circle is GREEN (exempt)', bareOut.failures.length === 0 && bareOut.advisory.length === 0);

  // Advisory-only: a scene the PR did not change never fails, whatever it holds.
  const sameBytes = packetArrowFindings(packetScene(packet), { baseSrc: packetScene(packet), changed: true });
  assert('an unchanged defective scene is advisory-only', sameBytes.failures.length === 0 && sameBytes.advisory.length === 1);
  const untouched = packetArrowFindings(packetScene(packet), { changed: false });
  assert('a page outside the changed scope is advisory-only', untouched.failures.length === 0 && untouched.advisory.length === 1);
  // A scene new in the PR (the base page has no scene at its index) is in scope.
  const keptScene = packetScene(`<rect/>`).replace('id="packet-scene"', 'id="kept-scene"');
  const addedPage = keptScene + packetScene(packet).replace('id="packet-scene"', 'id="added-scene"');
  const newScene = packetArrowFindings(addedPage, { baseSrc: keptScene, changed: true });
  assert('a scene new in the PR is in scope', newScene.failures.length === 1 && newScene.failures[0].includes('added-scene'));

  // Mutation control (SO #34c): removing the check must turn the selftest RED.
  // The RED case above only bites through the function the --check path calls,
  // so hold runCheck to its wiring by reading this script's own source.
  const selfSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const runCheckSrc = selfSrc.slice(selfSrc.indexOf('function runCheck'), selfSrc.indexOf('function runWrite'));
  assert('runCheck still invokes the packet check (mutation control)', runCheckSrc.includes('packetArrowFindings('));
  assert('runCheck still resolves the changed scope (mutation control)', runCheckSrc.includes('resolveChangedScope('));

  let failed = 0;
  for (const [name, ok] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) failed += 1;
  }
  if (failed) { console.error(`SCENE-KIT selftest: ${failed} of ${results.length} FAILED`); process.exit(1); }
  console.log(`SCENE-KIT selftest: ${results.length} checks PASS`);
}

// ── Entry ──────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
if (argv.includes('--selftest')) runSelftest();
else if (argv.includes('--write')) runWrite();
else if (argv.includes('--check')) runCheck();
else {
  console.error('usage: node scripts/sync-scene-kit.mjs [--check | --write | --selftest]');
  process.exit(2);
}
