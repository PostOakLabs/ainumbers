#!/usr/bin/env node
/**
 * check-webmcp-spec.mjs — WEBMCP-SPEC-ALIGN-1
 *
 * Conformance gate for the WebMCP registration shape, aligned to the WebMCP CG
 * draft dated 13 Nov 2026. Over every tracked *.html page it checks:
 *   (A) no navigator.modelContext runtime usage (the getter is on Document);
 *   (B) every registerTool() call is promise-handled: wrapped in .catch(...) or
 *       awaited inside a try;
 *   (C) the registered name is <= 128 chars and matches ^[A-Za-z0-9_.-]+$;
 *   (D) annotation keys, when present, are limited to the four spec booleans
 *       readOnlyHint, untrustedContentHint, consequentialHint, debugging.
 *
 * Violations inside a generator-owned region (the marker-delimited block emitted
 * by gen-webmcp-registrations.mjs) are always FATAL: that block is generated and
 * must be byte-fresh and aligned. Violations on a hand-registered page are
 * tolerated only while that page is in the shrink-only baseline
 * (scripts/webmcp-spec-baseline.json); a NEW hand page out of spec is FATAL and
 * needs its own row, never a silent baseline growth. A marker-delimited block on
 * a page the generator's LIVE population no longer claims (its chain shard is
 * not in chaingraph.json) is named explicitly under baseline `unowned_generated`,
 * never silently exempted.
 *
 * Usage:
 *   node scripts/check-webmcp-spec.mjs                (enforce)
 *   node scripts/check-webmcp-spec.mjs --self-test    (RED/GREEN fixture controls)
 *   node scripts/check-webmcp-spec.mjs --update-baseline  (sole baseline writer)
 *
 * Enumeration is git ls-files '*.html' (SO #52), every git child uses gitEnv
 * (SO #57). Zero dependencies (SO #10).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const BASELINE_PATH = join(HERE, 'webmcp-spec-baseline.json');

export const GEN_BEGIN = '<!-- WEBMCP:GEN-BEGIN ';
export const GEN_END = '<!-- WEBMCP:GEN-END -->';
export const MAX_NAME = 128;
export const NAME_RE = /^[A-Za-z0-9_.-]+$/;
export const SPEC_ANNOTATION_KEYS = Object.freeze([
  'readOnlyHint', 'untrustedContentHint', 'consequentialHint', 'debugging',
]);

/** Brace matcher that ignores braces inside quoted strings and comments. */
function matchingBrace(src, openIdx) {
  let depth = 0;
  let inStr = null;
  let lineComment = false;
  let blockComment = false;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && next === '/') { lineComment = true; i++; continue; }
    if (c === '/' && next === '*') { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Script bodies paired with their absolute offset in the page source. */
function scriptBodiesWithOffsets(src) {
  const out = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src))) {
    const body = m[1];
    out.push({ body, bodyStart: m.index + m[0].indexOf(body) });
  }
  return out;
}

/** Marker-delimited generator-owned regions as [start, end) offsets. */
function ownedRegions(src) {
  const regions = [];
  let from = 0;
  for (;;) {
    const b = src.indexOf(GEN_BEGIN, from);
    if (b === -1) break;
    const e = src.indexOf(GEN_END, b);
    if (e === -1) break;
    regions.push([b, e + GEN_END.length]);
    from = e + GEN_END.length;
  }
  return regions;
}

/**
 * Pure per-page check. Returns one object per violation:
 * { rule: 'A'|'B'|'C'|'D', detail, offset, generated }.
 */
export function checkPageSpec(src) {
  const violations = [];
  const owned = ownedRegions(src);
  const add = (rule, detail, offset) => violations.push({
    rule, detail, offset, generated: owned.some(([s, e]) => offset >= s && offset < e),
  });

  for (const { body, bodyStart } of scriptBodiesWithOffsets(src)) {
    const navRe = /navigator\s*\.\s*modelContext/g;
    let nav;
    while ((nav = navRe.exec(body))) add('A', 'navigator.modelContext', bodyStart + nav.index);

    const rtRe = /\.\s*registerTool\s*\(\s*\{/g;
    let rt;
    while ((rt = rtRe.exec(body))) {
      const callAbs = bodyStart + rt.index;
      const openBrace = bodyStart + body.indexOf('{', rt.index);
      const closeBrace = matchingBrace(src, openBrace);
      if (closeBrace === -1) { add('B', 'registerTool call object could not be parsed', callAbs); continue; }
      const objText = src.slice(openBrace, closeBrace + 1);

      // Statement extent: previous ';' or newline to the next ';'.
      let semi = src.indexOf(';', closeBrace);
      if (semi === -1) semi = src.length - 1;
      const start = Math.max(src.lastIndexOf(';', callAbs) + 1, src.lastIndexOf('\n', callAbs) + 1);
      const stmt = src.slice(start, semi + 1);
      if (!/\.catch\s*\(/.test(stmt) && !/\bawait\b/.test(stmt)) {
        add('B', 'registerTool promise is neither caught nor awaited', callAbs);
      }

      // (C) required name, length and charset.
      const nm = objText.match(/\bname\s*:\s*(['"])((?:[^'"\\]|\\.)*)\1/);
      if (!nm) add('C', 'registerTool tool name missing', callAbs);
      else {
        const name = nm[2].replace(/\\(['\\])/g, '$1');
        if (name.length > MAX_NAME) add('C', `tool name is ${name.length} chars (max ${MAX_NAME})`, callAbs);
        if (!NAME_RE.test(name)) add('C', `tool name ${JSON.stringify(name)} is outside ${NAME_RE}`, callAbs);
      }

      // (D) annotation keys, when annotations are present.
      const an = objText.match(/\bannotations\s*:\s*\{/);
      if (an) {
        const anOpen = openBrace + an.index + an[0].length - 1;
        const anClose = matchingBrace(src, anOpen);
        if (anClose !== -1) {
          const anText = src.slice(anOpen + 1, anClose);
          const keyRe = /(?:^|[,{])\s*([A-Za-z_$][\w$]*)\s*:/g;
          let k;
          while ((k = keyRe.exec(anText))) {
            if (!SPEC_ANNOTATION_KEYS.includes(k[1])) {
              add('D', `annotation key ${k[1]} is outside the four spec booleans`, callAbs);
            }
          }
        }
      }
    }
  }
  return violations;
}

/**
 * Pure verdict over a page map and the baseline page set.
 * Returns { fatal[], baselined[], shrink[], byRule }.
 */
export function evaluate(pages, baselinePages, unownedGenerated = new Set()) {
  const fatal = [], baselined = [], shrink = [];
  const byRule = { A: 0, B: 0, C: 0, D: 0 };
  for (const [page, src] of pages) {
    const violations = checkPageSpec(src);
    if (!violations.length) {
      if (baselinePages.has(page)) shrink.push(page);
      continue;
    }
    for (const v of violations) byRule[v.rule]++;
    const generated = violations.filter((v) => v.generated);
    if (generated.length && !unownedGenerated.has(page)) {
      fatal.push(`${page}: ${generated.length} violation(s) in generator-owned region (${[...new Set(generated.map((v) => v.rule))].join(',')})`);
    } else if (!baselinePages.has(page)) {
      fatal.push(`${page}: non-baselined registration violates spec (${[...new Set(violations.map((v) => v.rule))].join(',')})`);
    } else {
      baselined.push(page);
    }
  }
  return { fatal, baselined, shrink, byRule };
}

/** Tracked HTML page list (SO #52: git ls-files, never a filesystem walk). */
export function listTrackedPages(repoRoot) {
  const out = execFileSync('git', ['ls-files', '*.html'], {
    cwd: repoRoot, env: gitEnv(), encoding: 'utf8',
  });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

function livePages() {
  const pages = new Map();
  for (const p of listTrackedPages(REPO)) pages.set(p, readFileSync(resolve(REPO, p), 'utf8'));
  return pages;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    throw new Error(`baseline missing: scripts/webmcp-spec-baseline.json (restore it, never default to empty)`);
  }
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  if (!Array.isArray(raw.pages)) throw new Error('baseline.pages must be an array');
  if (!Array.isArray(raw.unowned_generated)) throw new Error('baseline.unowned_generated must be an array');
  return { pages: new Set(raw.pages), unowned: new Set(raw.unowned_generated) };
}

function run() {
  const baseline = loadBaseline();
  const pages = livePages();
  const r = evaluate(pages, baseline.pages, baseline.unowned);
  console.log(`webmcp-spec: ${pages.size} tracked HTML page(s); rule hits A=${r.byRule.A} B=${r.byRule.B} C=${r.byRule.C} D=${r.byRule.D}`);
  console.log(`webmcp-spec: ${r.baselined.length} baselined page(s) tolerated; baseline holds ${baseline.pages.size} (unowned generated: ${baseline.unowned.size})`);
  if (r.shrink.length) {
    console.log(`webmcp-spec: ${r.shrink.length} baseline entr(y/ies) now clean, tighten with --update-baseline: ${r.shrink.slice(0, 20).join(', ')}`);
  }
  if (r.fatal.length) {
    console.error(`✗ webmcp-spec: ${r.fatal.length} page(s) out of WebMCP spec alignment:`);
    r.fatal.slice(0, 40).forEach((f) => console.error(`  ${f}`));
    if (r.fatal.length > 40) console.error(`  ... and ${r.fatal.length - 40} more`);
    process.exit(1);
  }
  console.log('✓ webmcp-spec: WebMCP registration alignment GREEN');
}

function updateBaseline() {
  const pages = livePages();
  const existed = existsSync(BASELINE_PATH);
  const oldRaw = existed ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : { pages: [], unowned_generated: [] };
  const old = new Set(oldRaw.pages);
  const unowned = new Set(oldRaw.unowned_generated || []);
  const tolerated = new Set();
  for (const [page, src] of pages) {
    const violations = checkPageSpec(src);
    if (!violations.length) continue;
    if (violations.some((v) => v.generated) && !unowned.has(page)) {
      console.error(`✗ webmcp-spec --update-baseline REFUSED: ${page} still has a generator-owned violation. Fix the generator and regenerate first.`);
      process.exit(1);
    }
    tolerated.add(page);
  }
  if (existed && old.size > 0) {
    const grown = [...tolerated].filter((p) => !old.has(p));
    if (grown.length) {
      console.error(`✗ webmcp-spec --update-baseline REFUSED: ${grown.length} new page(s) would grow the baseline (a down-only ratchet): ${grown.slice(0, 20).join(', ')}`);
      console.error('  A new hand registration needs its own row, never a silent baseline growth.');
      process.exit(1);
    }
  }
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO, env: gitEnv(), encoding: 'utf8',
  }).trim();
  writeFileSync(BASELINE_PATH, JSON.stringify({
    pages: [...tolerated].sort(),
    unowned_generated: [...unowned].sort(),
    measured_at_sha: sha,
  }, null, 2) + '\n');
  console.log(`webmcp-spec: baseline written for ${tolerated.size} page(s) (unowned generated: ${unowned.size}) @ ${sha}`);
}

function selftest() {
  let failures = 0;
  const check = (name, ok) => { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failures++; };

  const begin = `${GEN_BEGIN}manifest=x generator=scripts/gen-webmcp-registrations.mjs -->`;
  const goodBlock = [
    begin,
    '<script>',
    'const mc = document.modelContext;',
    'if (mc) {',
    "  Promise.resolve(mc.registerTool({ name: 'fixture_tool', description: 'a description', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true }, execute: async function(){ try { return {}; } catch(e){ return {}; } } })).catch(() => {});",
    '}',
    '</script>',
    GEN_END,
  ].join('\n');
  const genPage = `<html><head></head><body>${goodBlock}</body></html>`;

  const green = checkPageSpec(genPage);
  check('GREEN control: spec-aligned generated block has zero violations', green.length === 0);

  const redA = checkPageSpec(genPage.replace('const mc = document.modelContext;', 'const mc = document.modelContext ?? navigator.modelContext;'));
  check('RED A control: navigator.modelContext detected', redA.some((v) => v.rule === 'A'));
  check('RED A control: violation classified inside generated region', redA.some((v) => v.rule === 'A' && v.generated));

  const redB = checkPageSpec(genPage.replace('Promise.resolve(mc.registerTool(', 'mc.registerTool(').replace(')).catch(() => {});', ');'));
  check('RED B control: unhandled registerTool detected', redB.some((v) => v.rule === 'B'));

  const redC1 = checkPageSpec(genPage.replace("name: 'fixture_tool'", "name: 'bad name!'"));
  check('RED C control: off-charset tool name detected', redC1.some((v) => v.rule === 'C'));
  const redC2 = checkPageSpec(genPage.replace("name: 'fixture_tool'", `name: '${'a'.repeat(129)}'`));
  check('RED C control: overlong tool name detected', redC2.some((v) => v.rule === 'C'));

  const redD = checkPageSpec(genPage.replace('annotations: { readOnlyHint: true }', 'annotations: { readOnlyHint: true, openWorldHint: true }'));
  check('RED D control: off-spec annotation key detected', redD.some((v) => v.rule === 'D'));

  const pages = new Map([
    ['chaingraph/generated.html', genPage],
    ['chaingraph/hand.html', '<html><body><script>mc.registerTool({ name: "hand_tool" });</script></body></html>'],
    ['chaingraph/new-hand.html', '<html><body><script>mc.registerTool({ name: "new_tool" });</script></body></html>'],
    ['chaingraph/clean.html', '<html><body>no registrations here</body></html>'],
  ]);
  const baseline = new Set(['chaingraph/hand.html']);
  const ev = evaluate(pages, baseline);
  check('evaluate: generated page stays clean', !ev.fatal.some((f) => f.startsWith('chaingraph/generated.html')));
  check('evaluate: baselined hand page tolerated', ev.baselined.includes('chaingraph/hand.html'));
  check('evaluate: new hand page is FATAL', ev.fatal.some((f) => f.startsWith('chaingraph/new-hand.html')));

  const ev2 = evaluate(new Map([['chaingraph/hand.html', '<html><body>clean now</body></html>']]), baseline);
  check('evaluate: clean baselined page reports a shrink', ev2.shrink.includes('chaingraph/hand.html'));

  const ev3 = evaluate(pages, new Set());
  check('evaluate: removing the baseline makes the hand page FATAL (verdict moves with the baseline)', ev3.fatal.some((f) => f.startsWith('chaingraph/hand.html')));

  const orphanPage = 'chaingraph/chains/orphan.html';
  const staleSrc = genPage.replace('const mc = document.modelContext;', 'const mc = document.modelContext ?? navigator.modelContext;');
  const unowned = new Set([orphanPage]);
  const evU0 = evaluate(new Map([[orphanPage, staleSrc]]), new Set([orphanPage]), unowned);
  check('evaluate: declared unowned generated region is tolerated', evU0.fatal.length === 0 && evU0.baselined.includes(orphanPage));
  const evU1 = evaluate(new Map([[orphanPage, staleSrc]]), new Set([orphanPage]));
  check('evaluate: the same stale region without its declaration is FATAL', evU1.fatal.some((f) => f.startsWith(orphanPage)));

  console.log(failures === 0 ? 'WEBMCP-SPEC SELFTEST: PASS' : 'WEBMCP-SPEC SELFTEST: FAIL');
  process.exit(failures === 0 ? 0 : 1);
}

const invokedAsMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) selftest();
  else if (args.includes('--update-baseline')) updateBaseline();
  else run();
}
