#!/usr/bin/env node
/**
 * scripts/gen-estate-map.mjs
 *
 * SSOT: data/suite-map.json (rail[] -- 3 stops; concepts[] -- 5 conceptual steps)
 *
 * Renders the agent-facing "How the estate fits together" markdown section
 * and injects it into llms.txt between the ESTATE-MAP sentinels. Text only --
 * no visual rail, no wf- / wayfinder CSS, no numeral glyphs (do-not-regress,
 * see scripts/gen-wayfinder.mjs header).
 *
 * Usage:
 *   node scripts/gen-estate-map.mjs          # inject into llms.txt
 *   node scripts/gen-estate-map.mjs --check  # freshness gate (exit 1 if stale)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const MAP_PATH = resolve(REPO, 'data', 'suite-map.json');
const LLMS_PATH = resolve(REPO, 'llms.txt');

const START = '<!--ESTATE-MAP:start-->';
const END = '<!--ESTATE-MAP:end-->';

function audienceLabel(a) {
  if (a === 'agent') return 'agent';
  if (a === 'human') return 'human';
  return 'human + agent';
}

export function renderEstateMap(map) {
  const lines = [];
  lines.push('The AINumbers estate is a closed loop. The user-facing navigation rail has three stops:');
  lines.push('');
  map.rail.forEach((stop, i) => {
    const surfaces = stop.surfaces
      .map(s => `${s.name} (${s.url}, ${audienceLabel(s.audience)})`)
      .join('; ');
    const micro = stop.microtext ? ` (${stop.microtext})` : '';
    lines.push(`${i + 1}. **${stop.label}**${micro} -- ${stop.one_line_role}. Surfaces: ${surfaces}.`);
  });
  lines.push('');
  lines.push('The underlying conceptual model has five steps that map onto those three stops:');
  lines.push('');
  map.concepts.forEach((c, i) => {
    lines.push(`${i + 1}. **${c.label}** -- ${c.one_line_role} (${c.host})`);
  });
  lines.push('');
  lines.push(`Machine-readable rail and concept map (surfaces, URLs, audiences): \`https://ainumbers.co/data/suite-map.json\``);
  return lines.join('\n');
}

function main() {
  const check = process.argv.includes('--check');
  const map = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
  const body = renderEstateMap(map);
  const block = `${START}\n${body}\n${END}`;

  const src = readFileSync(LLMS_PATH, 'utf8');
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (!re.test(src)) {
    console.error(`gen-estate-map: sentinels ${START} / ${END} not found in llms.txt`);
    process.exit(1);
  }
  const next = src.replace(re, block);

  if (check) {
    if (next !== src) {
      console.error('gen-estate-map --check: llms.txt estate map is stale. Run `node scripts/gen-estate-map.mjs`.');
      process.exit(1);
    }
    console.log('gen-estate-map --check: llms.txt estate map is fresh.');
    return;
  }

  writeFileSync(LLMS_PATH, next);
  console.log('gen-estate-map: llms.txt estate map regenerated.');
}

main();
