#!/usr/bin/env node
// scripts/mcp-activity-embed.mjs — embed data/mcp-activity.json into the
// MCP-ACTIVITY sentinel in index.html (the homepage chart's baked data).
//
// Homepage rule (CONTRACT §0): zero network after page load, so the chart can
// never fetch. This script is the only writer of the sentinel block, mirroring
// the COUNT-sentinel convention (distinct MCP-ACTIVITY namespace so the count
// gates never parse it). Single line of JSON inside one HTML comment: no `--`
// sequences exist in date/number payloads, and the writer asserts that.
//
// Usage:
//   node scripts/mcp-activity-embed.mjs [dataJson] [htmlFile]   # write mode
//   node scripts/mcp-activity-embed.mjs --check                 # exit 1 on drift
//   node scripts/mcp-activity-embed.mjs --self-test             # schema + idempotence

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SENTINEL_RE = /<!--MCP-ACTIVITY v1 .*?-->/;

function loadData(dataPath) {
  const raw = JSON.parse(readFileSync(dataPath, 'utf8'));
  if (!Array.isArray(raw.days)) throw new Error(`${dataPath}: days is not an array`);
  for (const d of raw.days) {
    if (!Array.isArray(d) || !/^\d{4}-\d{2}-\d{2}$/.test(d[0]) ||
        !Number.isFinite(+d[1]) || !Number.isFinite(+d[2])) {
      throw new Error(`${dataPath}: malformed day entry ${JSON.stringify(d).slice(0, 80)}`);
    }
  }
  return raw;
}

function renderBlock(raw) {
  const payload = JSON.stringify({ generated: raw.generated, days: raw.days });
  if (payload.includes('--')) throw new Error('payload contains -- (illegal inside HTML comments)');
  return `<!--MCP-ACTIVITY v1 ${payload} -->`;
}

function embed(dataPath, htmlPath, write) {
  const raw = loadData(dataPath);
  const html = readFileSync(htmlPath, 'utf8');
  if (!SENTINEL_RE.test(html)) throw new Error(`${htmlPath}: MCP-ACTIVITY sentinel not found`);
  const next = html.replace(SENTINEL_RE, () => renderBlock(raw));
  if (next === html) return 'clean';
  if (write) writeFileSync(htmlPath, next);
  return 'dirty';
}

function selfTest(dataPath, htmlPath) {
  loadData(dataPath); // schema asserts
  const before = readFileSync(htmlPath, 'utf8');
  if (!SENTINEL_RE.test(before)) throw new Error('self-test: sentinel missing');
  const once = before.replace(SENTINEL_RE, () => renderBlock(loadData(dataPath)));
  const twice = once.replace(SENTINEL_RE, () => renderBlock(loadData(dataPath)));
  if (once !== twice) throw new Error('self-test: embed is not idempotent');
  const m = once.match(SENTINEL_RE);
  JSON.parse(m[0].replace('<!--MCP-ACTIVITY v1 ', '').replace(/ -->$/, '')); // parses
  console.log('mcp-activity-embed --self-test: schema OK, sentinel OK, idempotent OK.');
}

function main(argv) {
  const dataPath = argv.find((a) => !a.startsWith('--') && a.endsWith('.json')) || join(ROOT, 'data', 'mcp-activity.json');
  const htmlIdx = argv.findIndex((a) => !a.startsWith('--') && a.endsWith('.html'));
  const htmlPath = htmlIdx !== -1 ? argv[htmlIdx] : join(ROOT, 'index.html');
  if (argv.includes('--self-test')) {
    selfTest(dataPath, htmlPath);
    return 0;
  }
  if (argv.includes('--check')) {
    const state = embed(dataPath, htmlPath, false);
    console.log(state === 'clean' ? 'mcp-activity-embed --check: clean.' : 'mcp-activity-embed --check: DRIFT — run without --check.');
    return state === 'clean' ? 0 : 1;
  }
  const state = embed(dataPath, htmlPath, true);
  console.log(state === 'clean' ? 'mcp-activity-embed: already current.' : 'mcp-activity-embed: sentinel updated.');
  return 0;
}

process.exit(main(process.argv.slice(2)));
