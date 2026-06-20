#!/usr/bin/env node
/**
 * retire-ap2-version.mjs — remove the misnamed `ap2_version` envelope field from every
 * ChainGraph artifact emitter. (OCG v0.4 cleanup, decided 2026-06-19.)
 *
 * WHY: `ap2_version: "1.0.0"` is a legacy ENVELOPE-version label, NOT Google's Agent Payments
 * Protocol version (real AP2 is v0.2, FIDO-governed). Its value (1.0) is actually the AINumbers
 * Policy Mandate schema version, which `chaingraph_version` (now 0.4.0) already carries. The name
 * falsely implies AP2-standard conformance on ~100 artifacts. We are retiring it entirely; the few
 * tools that genuinely relate to real AP2 declare that separately and truthfully via dct:conformsTo.
 *
 * SAFETY: ap2_version is OUTSIDE the hash preimage (SHA-256(JCS({policy_parameters, output_payload}))),
 * so removing it cannot change any execution_hash; golden-parity stays green. A v0.3 verifier that
 * ignores unknown fields is unaffected.
 *
 * SURGICAL TARGET: only the BARE-KEY JS object-property emission form, i.e.
 *     ap2_version: '1.0.0',      (own line, single/double quote, value 1.0 or 1.0.0)
 *     …, ap2_version: '1.0.0',   (inline, e.g. the Wave-11 kernels)
 * It deliberately does NOT touch:
 *   - quoted-key JSON forms   "ap2_version": "1.0"      (input samples / schema docs)
 *   - validator domain logic  m.ap2_version, obj.ap2_version === '1.0.0', 'ap2_version' in arrays
 *     (e.g. art-17 ap2-mcp-policy-validator lines 57/58/475/562-567 — its grading rubric, left intact)
 * so the only art-17 change is its own export emission (line ~853).
 *
 * NOTE (flagged separately, NOT done here): art-17's validator still REQUIRES ap2_version in pasted
 * mandates and CONTRACT §3.1 lists it — those are a follow-up rubric/schema decision, not this strip.
 *
 * SCOPE: HTML pages and kernel files (.kernel.mjs) under repo/chaingraph/, searched recursively (source).
 * After --apply, re-vendor with `node generate.mjs` so the worker bundle (mcp-apps-poc/) matches,
 * and commit data/ + kernels/ in the SAME push (CONTRACT §A4). worker.mjs emission is edited by hand.
 *
 * Usage:
 *   node chaingraph/retire-ap2-version.mjs            # dry-run report (default) — shows every match
 *   node chaingraph/retire-ap2-version.mjs --apply    # write in place
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, basename } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));   // repo/chaingraph
const APPLY = process.argv.includes('--apply');

// Bare-key emission only. Anchored so it NEVER hits JSON "ap2_version": (preceded by a quote),
// m.ap2_version (preceded by `.`), 'ap2_version' array members, or `=== '1.0.0'` checks (no colon).
// Handles every real form: clean own-line, aligned, trailing //comment, and MINIFIED one-liners
// (ap2_version:'1.0.0',nextKey...). Value = any semver-ish number.
// A) line-start emission — keeps the leading indent; works whether the line ends OR continues.
const LINE_START = /^([ \t]*)ap2_version:[ \t]*(['"])\d+\.\d+(?:\.\d+)?\2,[ \t]*(?:\/\/[^\n]*)?/gm;
// B) mid-line emission preceded by , or { (fully-minified single-line artifact objects).
const INLINE = /([,{])[ \t]*ap2_version:[ \t]*(['"])\d+\.\d+(?:\.\d+)?\2,/g;
// C) minified JSON-style emission: ...,"ap2_version":"1.0.0",...  (quoted-key, NO space).
//    Restricted to a 3-part value so it can NEVER match art-17's spaced 2-part input placeholder
//    `"ap2_version": "1.0"`. Targets the art-38/39/40 Tempo pages' minified artifact objects.
const JSON_INLINE = /,"ap2_version":"\d+\.\d+\.\d+"/g;

const SKIP_DIRS = new Set(['okf', 'node_modules', '.git', 'exporters', 'fixtures', 'taxonomies']);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else {
      const e = extname(name);
      if (e === '.html' || name.endsWith('.kernel.mjs')) out.push(full);
    }
  }
  return out;
}

const targets = walk(HERE);
const log = [];
let filesChanged = 0, totalRemoved = 0;

for (const f of targets) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  const orig = text;

  // Record exactly what will be removed (for dry-run review — especially art-17).
  const hits = [];
  for (const m of text.matchAll(LINE_START))  hits.push(m[0].trim());
  for (const m of text.matchAll(INLINE))      hits.push(m[0].replace(/^[,{]/, '').trim());
  for (const m of text.matchAll(JSON_INLINE)) hits.push(m[0].replace(/^,/, '').trim());

  text = text.replace(LINE_START, '$1');
  text = text.replace(INLINE, '$1');
  text = text.replace(JSON_INLINE, '');

  // Anomaly guard: any bare-key ap2_version emission left behind in an UNHANDLED value/form.
  const residue = /(^|[,{])\s*ap2_version:\s*['"][^'"]*['"]/m.test(text);

  if (text !== orig) {
    filesChanged++; totalRemoved += hits.length;
    log.push(`  ${basename(f)}  — removed ${hits.length}: ${hits.join('  ·  ')}${residue ? '   ⚠ EMISSION RESIDUE REMAINS — inspect' : ''}`);
    if (APPLY) writeFileSync(f, text, 'utf8');
  } else if (residue) {
    log.push(`  ${basename(f)}  ⚠ has a bare-key ap2_version emission in an unrecognized value/form — inspect manually`);
  }
}

console.log(`Retire ap2_version envelope emission${APPLY ? ' [APPLYING]' : ' [dry-run]'}`);
console.log(`Scanned ${targets.length} files (.html + *.kernel.mjs) under repo/chaingraph/\n`);
for (const line of log) console.log(line);
console.log(`\nSummary: ${filesChanged} files, ${totalRemoved} emissions removed.`);
console.log('SAFETY: ap2_version is outside the hash preimage — no execution_hash changes; golden-parity unaffected.');
console.log('Domain logic NOT touched (quoted-key JSON, m.ap2_version, ===, in-array). Verify art-17 shows only 1 removal.');
if (!APPLY) {
  console.log('\nDry-run only. Review every removal above (confirm art-17 = 1), then re-run with --apply.');
} else {
  console.log('\nApplied (site repo source). Next: edit worker.mjs by hand, then in mcp-apps-poc/ run');
  console.log('  node generate.mjs ; node scripts/check-tool-names.mjs ; node verify... (see deploy sequence)');
}
