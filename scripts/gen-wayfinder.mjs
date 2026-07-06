#!/usr/bin/env node
/**
 * scripts/gen-wayfinder.mjs
 *
 * SSOT: data/suite-map.json
 *
 * Renders the five-step estate pipeline rail and injects it between
 *   <!--WAYFINDER:stepId--> ... <!--/WAYFINDER-->
 * sentinels in static HTML pages.
 *
 * Generated pages (canvas.html, workbench.html) are owned by their own
 * generators (gen-canvas.mjs, gen-workbench.mjs) which import renderRail
 * directly. This script skips those files.
 *
 * Usage:
 *   node scripts/gen-wayfinder.mjs          # inject into all sentinel pages
 *   node scripts/gen-wayfinder.mjs --check  # freshness gate (exit 1 if stale)
 *
 * Exported for use by gen-canvas.mjs and gen-workbench.mjs:
 *   import { renderRail } from './gen-wayfinder.mjs';
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const MAP_PATH = resolve(REPO, 'data', 'suite-map.json');

// Circled-number glyphs for steps 1–5
const GLYPHS = ['&#9312;', '&#9313;', '&#9314;', '&#9315;', '&#9316;'];

/**
 * Render the wayfinder rail HTML.
 *
 * @param {object[]} steps  - ordered array from suite-map.json
 * @param {string}   activeId - step.id that should be lit ("You are here")
 * @returns {string} HTML block to inject between sentinels
 */
export function renderRail(steps, activeId) {
  const activeIdx = steps.findIndex(s => s.id === activeId);
  const stepCount = steps.length;

  const items = steps.map((step, i) => {
    const isActive = step.id === activeId;
    // Prefer first human-facing surface URL; fall back to first surface
    const surface = step.surfaces.find(s => s.audience !== 'agent') || step.surfaces[0];
    const href = surface ? surface.url : '#';
    const glyph = GLYPHS[i] || `${i + 1}`;
    const activeAttr = isActive ? ' class="wf-step wf-active" aria-current="step"' : ' class="wf-step"';
    const hereTag = isActive ? '\n        <div class="wf-here">You are here</div>' : '';
    return (
      `      <a href="${href}"${activeAttr}>\n` +
      `        <div class="wf-dot"></div>\n` +
      `        <div class="wf-meta"><span class="wf-glyph">${glyph}</span> <span class="wf-lbl">${step.label}</span></div>${hereTag}\n` +
      `      </a>`
    );
  }).join('\n');

  return (
    `<style>\n` +
    `.wf-rail{border-bottom:1px solid var(--border);background:rgba(13,22,39,.55);padding:.45rem 0;flex-shrink:0}\n` +
    `.wf-inner{max-width:900px;margin:0 auto;padding:0 1.5rem}\n` +
    `.wf-steps{display:flex;align-items:flex-start;position:relative}\n` +
    `.wf-steps::before{content:'';position:absolute;top:4px;left:10%;right:10%;height:1px;background:var(--border);z-index:0}\n` +
    `.wf-step{flex:1;display:flex;flex-direction:column;align-items:center;text-decoration:none;position:relative;z-index:1;gap:.18rem;padding:.1rem}\n` +
    `.wf-dot{width:10px;height:10px;border-radius:50%;border:1.5px solid var(--muted);background:var(--bg-3);flex-shrink:0}\n` +
    `.wf-step.wf-active .wf-dot{background:var(--teal);border-color:var(--teal);box-shadow:0 0 7px rgba(20,184,166,.4)}\n` +
    `.wf-meta{display:flex;align-items:center;gap:.18rem}\n` +
    `.wf-glyph{font-family:'JetBrains Mono',monospace;font-size:.5rem;color:var(--muted)}\n` +
    `.wf-step.wf-active .wf-glyph{color:var(--teal)}\n` +
    `.wf-lbl{font-size:.62rem;color:var(--body)}\n` +
    `.wf-step.wf-active .wf-lbl{color:var(--teal-lt);font-weight:600}\n` +
    `.wf-here{font-family:'JetBrains Mono',monospace;font-size:.46rem;color:var(--teal);letter-spacing:.07em}\n` +
    `.wf-step:hover:not(.wf-active) .wf-dot{border-color:var(--text)}\n` +
    `.wf-step:hover:not(.wf-active) .wf-lbl{color:var(--text)}\n` +
    `</style>\n` +
    `<div class="wf-rail" role="navigation" aria-label="Estate pipeline · step ${activeIdx + 1} of ${stepCount}">\n` +
    `  <div class="wf-inner">\n` +
    `    <div class="wf-steps">\n` +
    `${items}\n` +
    `    </div>\n` +
    `  </div>\n` +
    `</div>`
  );
}

// ─── injection machinery ──────────────────────────────────────────────────────

const SENTINEL_RE = /<!--WAYFINDER:([a-z]+)-->([\s\S]*?)<!--\/WAYFINDER-->/g;

/**
 * Process a single file: replace wayfinder blocks with fresh content.
 * In check mode, returns whether the file is stale without writing.
 */
function processFile(filePath, steps, check) {
  const original = readFileSync(filePath, 'utf8');
  let stale = false;
  const updated = original.replace(SENTINEL_RE, (_match, stepId, _inner) => {
    const fresh = renderRail(steps, stepId);
    const replacement = `<!--WAYFINDER:${stepId}-->\n${fresh}\n<!--/WAYFINDER-->`;
    const existing = `<!--WAYFINDER:${stepId}-->${_inner}<!--/WAYFINDER-->`;
    if (replacement !== existing) stale = true;
    return replacement;
  });
  if (!check && stale) writeFileSync(filePath, updated, 'utf8');
  return stale;
}

// Generated pages own their own wayfinder via renderRail import — skip them here.
const GENERATED = new Set([
  'chaingraph/workbench/canvas.html',
  'chaingraph/workbench/workbench.html',
]);

const SKIP_DIRS = ['node_modules', '.git', 'tools', 'manifests', 'runners'];

function findSentinelFiles(dir, results = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.includes(entry.name)) continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      findSentinelFiles(full, results);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      const rel = relative(REPO, full).replace(/\\/g, '/');
      if (GENERATED.has(rel)) continue;
      const content = readFileSync(full, 'utf8');
      if (content.includes('<!--WAYFINDER:')) results.push(full);
    }
  }
  return results;
}

// ─── entrypoint (only runs when executed directly) ───────────────────────────

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.url.replace('file:///', '').replace(/^\/([A-Z]:)/, '$1'))) {
  const CHECK = process.argv.includes('--check');
  const { steps } = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
  const sentinelFiles = findSentinelFiles(REPO);

  if (sentinelFiles.length === 0 && CHECK) {
    console.error('gen-wayfinder: no sentinel files found (add <!--WAYFINDER:stepId--> sentinels).');
    process.exit(1);
  }

  let anyStale = false;
  for (const f of sentinelFiles) {
    const rel = relative(REPO, f).replace(/\\/g, '/');
    const stale = processFile(f, steps, CHECK);
    if (stale) {
      anyStale = true;
      if (CHECK) console.error(`  stale: ${rel}`);
      else console.log(`  updated: ${rel}`);
    } else if (!CHECK) {
      console.log(`  ok:      ${rel}`);
    }
  }

  if (CHECK) {
    if (anyStale) {
      console.error('gen-wayfinder: stale file(s) found. Run `node scripts/gen-wayfinder.mjs` to refresh.');
      process.exit(1);
    }
    if (sentinelFiles.length > 0) console.log(`gen-wayfinder --check: OK (${sentinelFiles.length} file(s) fresh).`);
    process.exit(0);
  }
  console.log(`gen-wayfinder: done (${sentinelFiles.length} file(s)).`);
}
