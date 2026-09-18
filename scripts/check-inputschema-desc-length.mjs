#!/usr/bin/env node
/**
 * check-inputschema-desc-length.mjs — MCP-INPUTSCHEMA-DESC-TRIM-1 step 3.
 *
 * ADVISORY RATCHET on the count of served `inputSchema` property descriptions
 * longer than MAX_CHARS. The MCP maintainers' tool-bloat thread (#2036) finds
 * most `tools/list` token bloat originates in `inputSchema`, and endorses
 * one-sentence parameter descriptions with `enum` in place of prose value lists.
 * This gate makes that a one-way door: the count may fall, never rise.
 *
 * It is a RATCHET, not a rule — it does not demand the baseline reach 0, it
 * only refuses regression. A new manifest that ships a 300-char property
 * description reds this gate; shortening any existing one is always allowed
 * (and the baseline is then lowered with --update-baseline).
 *
 *   node scripts/check-inputschema-desc-length.mjs                (exit 1 above baseline)
 *   node scripts/check-inputschema-desc-length.mjs --list         (name every offender)
 *   node scripts/check-inputschema-desc-length.mjs --update-baseline
 *
 * Scope note: the count spans BOTH ownership classes. Generator-owned manifests
 * (`derived-from-kernel-reads` provenance) get their descriptions from
 * scripts/gen-input-schemas.mjs, whose descriptions are mechanical unit-suffix
 * sentences and therefore short by construction; hand-curated manifests are
 * where a long description can appear. Counting both is deliberate — a future
 * generator change that started emitting prose would otherwise be invisible here.
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const REPO = path.resolve(HERE, '..');
const BASELINE_FILE = path.join(HERE, 'inputschema-desc-length-baseline.json');

export const MAX_CHARS = 160;

/** Count served property descriptions longer than `max`, with their locations. */
export function countLongDescriptions(repoRoot, max = MAX_CHARS) {
  const dir = path.join(repoRoot, 'manifests');
  const offenders = [];
  let manifests = 0, described = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.manifest.json')).sort()) {
    let m;
    try { m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    const props = m?.mcp_tool_definition?.inputSchema?.properties;
    if (!props || typeof props !== 'object') continue;
    manifests++;
    for (const [name, prop] of Object.entries(props)) {
      if (!prop || typeof prop !== 'object') continue;
      if (typeof prop.description !== 'string') continue;
      described++;
      if (prop.description.length > max) {
        offenders.push({ manifest: `manifests/${f}`, property: name, len: prop.description.length });
      }
    }
  }
  return { count: offenders.length, offenders, manifests, described };
}

function readBaseline() {
  try {
    const b = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    if (typeof b.count === 'number') return b;
  } catch { /* fall through */ }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const result = countLongDescriptions(REPO);

  if (args.includes('--update-baseline')) {
    const prev = readBaseline();
    if (prev && result.count > prev.count) {
      console.error(`✗ refusing to RAISE the baseline: ${prev.count} → ${result.count}. This gate only ratchets down — shorten the new long description(s) instead (--list names them).`);
      process.exit(1);
    }
    fs.writeFileSync(BASELINE_FILE, JSON.stringify({
      max_chars: MAX_CHARS,
      count: result.count,
      measured: new Date().toISOString().slice(0, 10),
      note: 'Count of served mcp_tool_definition.inputSchema property descriptions longer than max_chars. Ratchet: counts only go down (MCP-INPUTSCHEMA-DESC-TRIM-1).',
    }, null, 2) + '\n', 'utf8');
    console.log(`✓ baseline written: ${result.count} description(s) over ${MAX_CHARS} chars${prev ? ` (was ${prev.count})` : ''}.`);
    process.exit(0);
  }

  if (args.includes('--list')) {
    for (const o of result.offenders) console.log(`${o.manifest}\t${o.property}\t${o.len}`);
  }

  const baseline = readBaseline();
  if (!baseline) {
    console.error(`✗ inputschema-desc-length: no baseline at scripts/${path.basename(BASELINE_FILE)} — create it with: node scripts/check-inputschema-desc-length.mjs --update-baseline`);
    process.exit(1);
  }
  if (result.count > baseline.count) {
    console.error(`✗ inputschema-desc-length RATCHET FAILED — ${result.count} property description(s) over ${MAX_CHARS} chars, baseline ${baseline.count} (${result.count - baseline.count} added).`);
    console.error('  Offenders:');
    for (const o of result.offenders) console.error(`  • ${o.manifest} :: ${o.property} (${o.len} chars)`);
    console.error(`\n  Shorten to one sentence ≤ ${MAX_CHARS} chars; where the prose lists allowed values, move them to \`enum\` instead. The baseline may never be raised.`);
    process.exit(1);
  }
  const moved = baseline.count - result.count;
  console.log(`✓ inputschema-desc-length clean — ${result.count} description(s) over ${MAX_CHARS} chars, baseline ${baseline.count}${moved > 0 ? ` (${moved} below baseline: run --update-baseline to lower it)` : ''} across ${result.manifests} manifest(s) / ${result.described} described propert(ies).`);
  process.exit(0);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('check-inputschema-desc-length.mjs')) main();
