#!/usr/bin/env node
/**
 * measure-inputschema-bytes.mjs — MCP-INPUTSCHEMA-DESC-TRIM-1 step 1 (READ-ONLY).
 *
 * The served `tools/list` payload's largest single share is `inputSchema`
 * (725,462 B across 719 tools, measured 2026-09-17T23:4xZ live). This script
 * measures where those bytes sit, per manifest, so the trim is aimed at
 * evidence rather than at intuition:
 *
 *   - bytes of `mcp_tool_definition.inputSchema` (the WebMCP/served surface),
 *   - bytes of every property `description` string inside it,
 *   - count of properties whose description exceeds 160 chars (the row's rule),
 *   - "enum-able prose": descriptions that enumerate allowed values in words
 *     while the property carries no `enum` keyword.
 *
 * ⛔ It writes nothing. The ONE distinction that governs what may be edited:
 * a manifest carrying the `derived-from-kernel-reads <date>` provenance mark is
 * OWNED by scripts/gen-input-schemas.mjs — its descriptions are re-derived from
 * kernel reads, so a hand-edit reds `gen-input-schemas.mjs --check`. Only
 * UNMARKED (hand-curated) manifests are this row's editable surface, and the
 * report splits every figure on that line.
 *
 * Usage:
 *   node scripts/measure-inputschema-bytes.mjs            (summary + top 20)
 *   node scripts/measure-inputschema-bytes.mjs --top 50   (longer table)
 *   node scripts/measure-inputschema-bytes.mjs --json     (machine-readable)
 *   node scripts/measure-inputschema-bytes.mjs --over 160 (length threshold)
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const REPO = path.resolve(HERE, '..');

const PROVENANCE_RE = /^derived-from-kernel-reads \d{4}-\d{2}-\d{2}$/;

/** The provenance mark wherever it sits (manifest level, or legacy inner). */
export function provenanceMark(m) {
  return m?.input_schema_provenance ?? m?.input_schema?.x_schema_provenance;
}
export function isOwnedMark(prov) {
  return typeof prov === 'string' && PROVENANCE_RE.test(prov);
}

const bytes = (s) => Buffer.byteLength(s, 'utf8');

/**
 * Enum-able prose: the description spells allowed values out in words while the
 * property declares no `enum`. Conservative on purpose — a hit is a CANDIDATE
 * for a human read, never an automatic rewrite.
 */
export function enumableProse(prop) {
  const d = typeof prop?.description === 'string' ? prop.description : '';
  if (!d) return false;
  if (Array.isArray(prop.enum)) return false;
  // "one of X, Y, Z" | "either X or Y" | "allowed values: ..." | quoted-literal lists
  if (/\b(one of|either|allowed values|valid values|must be one of|accepted values|options are)\b/i.test(d)) return true;
  const quoted = d.match(/'[^']+'|"[^"]+"|`[^`]+`/g) || [];
  if (quoted.length >= 2) return true;
  // bare pipe-separated literal list, e.g. "daily | weekly | monthly"
  if (/\S+\s*\|\s*\S+\s*\|\s*\S+/.test(d)) return true;
  return false;
}

export function measure(repoRoot, { over = 160 } = {}) {
  const dir = path.join(repoRoot, 'manifests');
  const rows = [];
  const totals = {
    manifests: 0, withSchema: 0, owned: 0, hand: 0,
    schemaBytes: 0, descBytes: 0, props: 0, describedProps: 0,
    overCount: 0, enumable: 0,
    ownedSchemaBytes: 0, ownedDescBytes: 0, ownedOver: 0, ownedEnumable: 0,
    handSchemaBytes: 0, handDescBytes: 0, handOver: 0, handEnumable: 0,
  };
  const lengths = [];
  const offenders = { over: [], enumable: [] };
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.manifest.json')).sort()) {
    totals.manifests++;
    let m;
    try { m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    const schema = m?.mcp_tool_definition?.inputSchema;
    if (!schema || !schema.properties || typeof schema.properties !== 'object') continue;
    totals.withSchema++;
    const owned = isOwnedMark(provenanceMark(m));
    owned ? totals.owned++ : totals.hand++;

    const schemaBytes = bytes(JSON.stringify(schema));
    let descBytes = 0, props = 0, describedProps = 0, overCount = 0, enumable = 0, titleBytes = 0;
    for (const prop of Object.values(schema.properties)) {
      props++;
      if (!prop || typeof prop !== 'object') continue;
      if (typeof prop.title === 'string') titleBytes += bytes(prop.title);
      if (typeof prop.description === 'string') {
        describedProps++;
        descBytes += bytes(prop.description);
        lengths.push(prop.description.length);
        if (prop.description.length > over) overCount++;
      }
      if (enumableProse(prop)) enumable++;
    }
    totals.schemaBytes += schemaBytes;
    totals.descBytes += descBytes;
    totals.props += props;
    totals.describedProps += describedProps;
    totals.overCount += overCount;
    totals.enumable += enumable;
    if (owned) {
      totals.ownedSchemaBytes += schemaBytes; totals.ownedDescBytes += descBytes;
      totals.ownedOver += overCount; totals.ownedEnumable += enumable;
    } else {
      totals.handSchemaBytes += schemaBytes; totals.handDescBytes += descBytes;
      totals.handOver += overCount; totals.handEnumable += enumable;
    }
    for (const [name, prop] of Object.entries(schema.properties)) {
      if (!prop || typeof prop !== 'object') continue;
      if (typeof prop.description === 'string' && prop.description.length > over) {
        offenders.over.push({ manifest: `manifests/${f}`, owned, property: name, len: prop.description.length, description: prop.description });
      }
      if (enumableProse(prop)) {
        offenders.enumable.push({ manifest: `manifests/${f}`, owned, property: name, len: (prop.description || '').length, description: prop.description });
      }
    }
    rows.push({ manifest: `manifests/${f}`, owned, schemaBytes, descBytes, titleBytes, props, describedProps, overCount, enumable });
  }
  lengths.sort((a, b) => a - b);
  const pct = (q) => (lengths.length ? lengths[Math.min(lengths.length - 1, Math.floor(q * lengths.length))] : 0);
  const distribution = {
    describedProps: lengths.length,
    min: lengths[0] ?? 0,
    p50: pct(0.5), p75: pct(0.75), p90: pct(0.9), p95: pct(0.95), p99: pct(0.99),
    max: lengths[lengths.length - 1] ?? 0,
    mean: lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0,
  };
  return { rows, totals, distribution, offenders, over };
}

function main() {
  const args = process.argv.slice(2);
  const topIdx = args.indexOf('--top');
  const top = topIdx !== -1 ? Number(args[topIdx + 1]) : 20;
  const overIdx = args.indexOf('--over');
  const over = overIdx !== -1 ? Number(args[overIdx + 1]) : 160;
  const result = measure(REPO, { over });
  if (args.includes('--list')) {
    console.log(`descriptions > ${over} chars (${result.offenders.over.length}):`);
    for (const o of result.offenders.over) console.log(`  [${o.owned ? 'GEN' : 'HAND'}] ${o.manifest} :: ${o.property} (${o.len}) ${JSON.stringify(o.description)}`);
    console.log(`\nenum-able prose, no enum keyword (${result.offenders.enumable.length}):`);
    for (const o of result.offenders.enumable) console.log(`  [${o.owned ? 'GEN' : 'HAND'}] ${o.manifest} :: ${o.property} (${o.len}) ${JSON.stringify(o.description)}`);
    return;
  }
  if (args.includes('--parity')) {
    // For every HAND-CURATED manifest: where does the authoritative `input_schema`
    // slot already carry an `enum` that the SERVED `mcp_tool_definition.inputSchema`
    // slot lacks, and where does the served description run longer than the
    // `input_schema` one? Those are rule (b)/(a) fixes with an in-repo source of
    // truth — no invented value sets.
    const dir = path.join(REPO, 'manifests');
    let missingEnum = 0, longerDesc = 0, files = 0;
    const hits = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.manifest.json')).sort()) {
      let m;
      try { m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
      if (isOwnedMark(provenanceMark(m))) continue;
      const served = m?.mcp_tool_definition?.inputSchema?.properties;
      const authoritative = m?.input_schema?.properties;
      if (!served || !authoritative) continue;
      const local = [];
      for (const [name, sp] of Object.entries(served)) {
        const ap = authoritative[name];
        if (!ap || typeof ap !== 'object' || typeof sp !== 'object') continue;
        const enumGap = Array.isArray(ap.enum) && !Array.isArray(sp.enum);
        const descGap = typeof ap.description === 'string' && typeof sp.description === 'string'
          && sp.description.length > ap.description.length;
        if (enumGap) missingEnum++;
        if (descGap) longerDesc++;
        if (enumGap || descGap) {
          local.push(`    ${name}${enumGap ? ` ENUM-GAP(${ap.enum.length} values in input_schema)` : ''}${descGap ? ` DESC served ${sp.description.length} > input_schema ${ap.description.length}` : ''}`);
        }
      }
      if (local.length) { files++; hits.push(`  manifests/${f}`); hits.push(...local); }
    }
    console.log(`HAND-CURATED served-vs-authoritative slot drift: ${files} manifest(s) · ${missingEnum} property enum-gap(s) · ${longerDesc} longer served description(s)`);
    hits.forEach((h) => console.log(h));
    return;
  }
  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const t = result.totals;
  console.log(`inputSchema bytes across ${t.withSchema} manifest(s) with a served mcp_tool_definition.inputSchema (${t.manifests} manifest file(s) scanned)`);
  console.log(`  total inputSchema bytes : ${t.schemaBytes}`);
  console.log(`  property description B  : ${t.descBytes} (${((t.descBytes / t.schemaBytes) * 100).toFixed(1)}% of inputSchema)`);
  console.log(`  properties              : ${t.props} (${t.describedProps} carry a description)`);
  console.log(`  descriptions > ${over} chars : ${t.overCount}`);
  console.log(`  enum-able prose (no enum keyword) : ${t.enumable}`);
  console.log('');
  console.log(`OWNERSHIP SPLIT — gen-input-schemas.mjs re-derives owned descriptions, so ONLY the hand-curated column is editable by MCP-INPUTSCHEMA-DESC-TRIM-1:`);
  console.log(`  generator-owned (derived-from-kernel-reads): ${t.owned} manifests · ${t.ownedSchemaBytes} schema B · ${t.ownedDescBytes} desc B · ${t.ownedOver} over-${over} · ${t.ownedEnumable} enum-able`);
  console.log(`  hand-curated  (no provenance mark)         : ${t.hand} manifests · ${t.handSchemaBytes} schema B · ${t.handDescBytes} desc B · ${t.handOver} over-${over} · ${t.handEnumable} enum-able`);
  console.log('');
  const d = result.distribution;
  console.log(`description LENGTH distribution (chars, n=${d.describedProps}): min ${d.min} · p50 ${d.p50} · p75 ${d.p75} · p90 ${d.p90} · p95 ${d.p95} · p99 ${d.p99} · max ${d.max} · mean ${d.mean}`);
  console.log('');
  const ranked = [...result.rows].sort((a, b) => b.descBytes - a.descBytes || b.schemaBytes - a.schemaBytes).slice(0, top);
  console.log(`TOP ${ranked.length} manifests by property-description bytes:`);
  console.log('  descB\tschemaB\tprops\t>'.concat(String(over), '\tenum?\towner\tmanifest'));
  for (const r of ranked) {
    console.log(`  ${r.descBytes}\t${r.schemaBytes}\t${r.props}\t${r.overCount}\t${r.enumable}\t${r.owned ? 'GEN' : 'HAND'}\t${r.manifest}`);
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('measure-inputschema-bytes.mjs')) main();
