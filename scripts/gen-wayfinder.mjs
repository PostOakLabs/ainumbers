#!/usr/bin/env node
/**
 * scripts/gen-wayfinder.mjs  v2
 *
 * SSOT: data/suite-map.json  (rail[] — 3 stops; concepts[] — 5 conceptual steps)
 *
 * Renders the 3-stop estate rail and injects it between
 *   <!--WAYFINDER:stopId--> ... <!--/WAYFINDER-->
 * sentinels in static HTML pages.
 *
 * Valid sentinel ids: learn | run | ledger
 * (Old "verify" sentinel in ledger/index.html was updated to "ledger".)
 *
 * STATUS (2026-07-06, PR #176): the visual rail was deliberately removed
 * from every deployed page — zero sentinels is the current intended state,
 * not staleness. --check passes clean when no sentinel files exist. If the
 * rail is reintroduced, re-add sentinels and this script resumes enforcing
 * freshness automatically.
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

// Circled-number glyphs for stops 1-5
const GLYPHS = ['&#9312;', '&#9313;', '&#9314;', '&#9315;', '&#9316;'];

/**
 * Render the 3-stop wayfinder rail HTML.
 *
 * @param {object[]} rail     - ordered array from suite-map.json rail[]
 * @param {string}   activeId - stop.id that should be lit ("You are here")
 * @returns {string} HTML block to inject between sentinels
 */
export function renderRail(rail, activeId) {
  const activeIdx = rail.findIndex(s => s.id === activeId);
  const stopCount = rail.length;

  const items = rail.map((stop, i) => {
    const isActive = stop.id === activeId;
    const href = stop.url || '#';
    const glyph = GLYPHS[i] || `${i + 1}`;
    const activeAttr = isActive
      ? ' class="wf-step wf-active" aria-current="step"'
      : ' class="wf-step"';
    const hereTag = isActive ? '\n        <div class="wf-here">You are here</div>' : '';
    const microTag = stop.microtext
      ? `\n        <div class="wf-micro">${stop.microtext}</div>`
      : '';
    return (
      `      <a href="${href}"${activeAttr}>\n` +
      `        <div class="wf-dot"></div>\n` +
      `        <div class="wf-meta"><span class="wf-glyph">${glyph}</span> <span class="wf-lbl">${stop.label}</span></div>${hereTag}${microTag}\n` +
      `      </a>`
    );
  }).join('\n');

  return (
    `<style>\n` +
    `.wf-rail{border-bottom:1px solid var(--border);background:rgba(13,22,39,.55);padding:.45rem 0;flex-shrink:0}\n` +
    `.wf-inner{max-width:900px;margin:0 auto;padding:0 1.5rem}\n` +
    `.wf-steps{display:flex;align-items:flex-start;position:relative}\n` +
    `.wf-steps::before{content:'';position:absolute;top:4px;left:16%;right:16%;height:1px;background:var(--border);z-index:0}\n` +
    `.wf-step{flex:1;display:flex;flex-direction:column;align-items:center;text-decoration:none;position:relative;z-index:1;gap:.18rem;padding:.1rem}\n` +
    `.wf-dot{width:10px;height:10px;border-radius:50%;border:1.5px solid var(--muted);background:var(--bg-3);flex-shrink:0}\n` +
    `.wf-step.wf-active .wf-dot{background:var(--teal);border-color:var(--teal);box-shadow:0 0 7px rgba(20,184,166,.4)}\n` +
    `.wf-meta{display:flex;align-items:center;gap:.18rem}\n` +
    `.wf-glyph{font-family:'JetBrains Mono',monospace;font-size:.5rem;color:var(--muted)}\n` +
    `.wf-step.wf-active .wf-glyph{color:var(--teal)}\n` +
    `.wf-lbl{font-size:.62rem;color:var(--body)}\n` +
    `.wf-step.wf-active .wf-lbl{color:var(--teal-lt);font-weight:600}\n` +
    `.wf-here{font-family:'JetBrains Mono',monospace;font-size:.46rem;color:var(--teal);letter-spacing:.07em}\n` +
    `.wf-micro{font-family:'JetBrains Mono',monospace;font-size:.42rem;color:var(--muted);letter-spacing:.05em;opacity:.7}\n` +
    `.wf-step:hover:not(.wf-active) .wf-dot{border-color:var(--text)}\n` +
    `.wf-step:hover:not(.wf-active) .wf-lbl{color:var(--text)}\n` +
    `</style>\n` +
    `<div class="wf-rail" role="navigation" aria-label="Estate pipeline · step ${activeIdx + 1} of ${stopCount}">\n` +
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
function processFile(filePath, rail, check) {
  const original = readFileSync(filePath, 'utf8');
  let stale = false;
  const updated = original.replace(SENTINEL_RE, (_match, stopId, _inner) => {
    const fresh = renderRail(rail, stopId);
    const replacement = `<!--WAYFINDER:${stopId}-->\n${fresh}\n<!--/WAYFINDER-->`;
    const existing = `<!--WAYFINDER:${stopId}-->${_inner}<!--/WAYFINDER-->`;
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
  const { rail } = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
  const sentinelFiles = findSentinelFiles(REPO);

  if (sentinelFiles.length === 0 && CHECK) {
    // PR #176 (2026-07-06) deliberately stripped the visual rail from all
    // deployed pages. Zero sentinels is the intended steady state now, not
    // a staleness bug — pass clean instead of hard-failing every push.
    console.log('gen-wayfinder --check: OK (0 sentinel files — rail retired, see PR #176).');
    process.exit(0);
  }

  let anyStale = false;
  for (const f of sentinelFiles) {
    const rel = relative(REPO, f).replace(/\\/g, '/');
    const stale = processFile(f, rail, CHECK);
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
