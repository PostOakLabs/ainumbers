#!/usr/bin/env node
/**
 * scripts/check-output-schema-coverage.mjs — OUTPUTSCHEMA-GAP-1.
 *
 * Coverage gate for MCP tool output schemas. Every LIVE node (same predicate the
 * worker's generate.mjs uses: status === 'live' && mcp_name && tool_id) whose
 * manifest exists but declares no `output_schema` member is a coverage gap: MCP
 * clients cannot validate that tool's `structuredContent`. The count is ratcheted
 * by scripts/output-schema-baseline.json — the ceiling only ever goes DOWN
 * (ratchet-baseline.mjs loader, RATCHET-BASELINE-LOADER-1 shape: a deleted or
 * corrupted baseline is a hard fail, never a silent pass).
 *
 * SO #34 (independent derivation): the gate recomputes the gap from the primary
 * sources (chaingraph.json + manifests/*.manifest.json) — it never reads the
 * count from any artifact's self-claim about itself.
 * SO #34c (absence is not a pass): every live-node manifest with an
 * `output_schema` ALSO has every one of its fixture `output_payload`s re-validated
 * against that schema on every run, with a mirrored draft-2020-12-subset validator
 * (same pattern as scripts/check-manifest-schema.mjs mirroring
 * chaingraph/standard/schema-validate.mjs — zero-dep, no ajv). A schema that no
 * longer matches its fixtures is a NEW violation and is always HARD, baseline or
 * not.
 *
 * Usage:
 *   node scripts/check-output-schema-coverage.mjs                # gate (exit 1 on new gap / fixture mismatch)
 *   node scripts/check-output-schema-coverage.mjs --update-baseline
 *                                                                # re-pin the ratchet ceiling (writer path)
 *   node scripts/check-output-schema-coverage.mjs --derive <tool_id>
 *                                                                # print a schema derived from the node's
 *                                                                # fixture output_payloads (AGENT-REACH §3.10
 *                                                                # rules) for eyeball review before it is
 *                                                                # written into the manifest by hand
 *   node scripts/check-output-schema-coverage.mjs --list         # print the current gap ids
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRatchetBaselineOrExit, readBaselineForUpdate } from './ratchet-baseline.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CG_PATH = resolve(REPO, 'chaingraph', 'chaingraph.json');
const MAN_DIR = resolve(REPO, 'manifests');
const FIX_DIR = resolve(REPO, 'chaingraph', 'kernels', 'fixtures');
const BASELINE_PATH = resolve(HERE, 'output-schema-baseline.json');

// SWORN members (AGENT-REACH-BUILD-SPEC §3.10): when present in every fixture
// output they are REQUIRED in the derived schema, like every other always-present key.
const SWORN_MEMBERS = ['regulatory_basis', 'citations', 'table_version', 'honesty', 'honesty_notes'];

const BASELINE_REQUIRED_KEYS = [
  'missing_count',
  { key: 'missing_ids', type: 'name-list' },
  'fixture_mismatch_count',
  { key: 'fixture_mismatch_ids', type: 'name-list' },
];

function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }

// ── the live-node predicate: ONE definition, copied from the worker's generate.mjs ──
export function liveNodes(cg) {
  return (cg.nodes || []).filter((n) => n.status === 'live' && n.mcp_name && n.tool_id);
}

export function coverageGap(cg, { manDir = MAN_DIR } = {}) {
  const missing = [];
  for (const n of liveNodes(cg)) {
    const p = resolve(manDir, n.tool_id + '.manifest.json');
    if (!existsSync(p)) continue; // manifest-less live nodes are NODE-COMPLETENESS-GATE-1's debt, not this gate's
    let m;
    try { m = readJson(p); } catch { continue; } // malformed manifest → check-manifest-schema.mjs's failure, not ours
    if (!m.output_schema) missing.push(n.tool_id);
  }
  return missing.sort();
}

// ── mirrored draft-2020-12 SUBSET validator (same keyword set schema-validate.mjs implements) ──
function typeOk(t, d) {
  if (Array.isArray(t)) return t.some((x) => typeOk(x, d));
  return t === 'object' ? isObj(d)
    : t === 'null' ? d === null
    : t === 'array' ? Array.isArray(d)
    : t === 'string' ? typeof d === 'string'
    : t === 'number' ? typeof d === 'number'
    : t === 'integer' ? Number.isInteger(d)
    : t === 'boolean' ? typeof d === 'boolean'
    : true;
}
const isObj = (d) => d !== null && typeof d === 'object' && !Array.isArray(d);
const jsType = (d) => (Array.isArray(d) ? 'array' : d === null ? 'null' : typeof d);

export function validateSubset(schema, data, path, errs) {
  if (!schema || typeof schema !== 'object') return;
  if (schema.type !== undefined && !typeOk(schema.type, data)) {
    errs.push(`${path}: expected type ${JSON.stringify(schema.type)}, got ${jsType(data)}`);
    return;
  }
  if (schema.enum && !schema.enum.some((v) => JSON.stringify(v) === JSON.stringify(data))) {
    errs.push(`${path}: ${JSON.stringify(data)} not in enum ${JSON.stringify(schema.enum)}`);
    return;
  }
  if (isObj(schema.properties) && isObj(data)) {
    for (const [k, sub] of Object.entries(schema.properties)) {
      if (k in data) validateSubset(sub, data[k], `${path}.${k}`, errs);
    }
  }
  if (Array.isArray(schema.items) === false && schema.items && Array.isArray(data)) {
    data.forEach((el, i) => validateSubset(schema.items, el, `${path}[${i}]`, errs));
  }
  if (isObj(data)) {
    if (Array.isArray(schema.required)) {
      for (const k of schema.required) {
        if (!(k in data)) errs.push(`${path}: missing required property '${k}'`);
      }
    }
    if (schema.additionalProperties === false && isObj(schema.properties)) {
      for (const k of Object.keys(data)) {
        if (!(k in schema.properties)) errs.push(`${path}: additional property '${k}' not allowed`);
      }
    }
  }
}

// ── AGENT-REACH-BUILD-SPEC §3.10 derivation from fixture output_payloads ──
export function deriveSchema(fixtures) {
  const payloads = (fixtures.vectors || []).map((v) => v.output_payload);
  if (!payloads.length) throw new Error('no fixture vectors to derive from');
  return deriveObject(payloads);
}

function deriveObject(values) {
  const keys = new Set();
  for (const v of values) if (isObj(v)) for (const k of Object.keys(v)) keys.add(k);
  const required = [...keys].filter((k) => values.every((v) => isObj(v) && k in v))
    // SWORN members present in every fixture output are required (§3.10) — the
    // generic rule already covers them; the sort keeps them visually first.
    .sort((a, b) => (SWORN_MEMBERS.includes(b) ? 1 : 0) - (SWORN_MEMBERS.includes(a) ? 1 : 0) || a.localeCompare(b));
  const properties = {};
  for (const k of [...keys].sort()) {
    const vals = values.filter((v) => isObj(v) && k in v).map((v) => v[k]);
    properties[k] = deriveField(vals);
  }
  return { type: 'object', properties, required, additionalProperties: false };
}

const ENUM_CAP = 6; // §3.10: enums only for ≤6-member observed value sets
// ⛔ NO FIXTURE-ONLY ACCIDENT BECOMES A CONSTRAINT (§3.10's review-by-eye rule, mechanized so the
// gate and the deriver cannot drift). Three mechanical rules implement it:
//   (1) numbers are NEVER enumerated — a numeric output lives on a continuum; ≤6 observed samples is
//       sampling, not a domain (total_score:[20], im_call:[500000] would otherwise be pinned).
//   (2) booleans enumerate only when BOTH members were observed; a lone observed boolean stays a bare
//       type ( shortfall:[false] is not a domain of one).
//   (3) strings enumerate only when 2..6 DISTINCT short token-like members were observed — closed
//       vocabularies (verdict, venue, mode, hqla_tier, codec). Values that look like hashes (0x…),
//       base32/cids, digests, timestamps, URLs, markup or prose never enumerate (each observed value
//       is an instance, not a member of a vocabulary), and a single observed string is an accident
//       waiting to client-reject the first honest variant.
const ENUM_STRING_MEMBER_RE = /^(?:[a-z0-9_]+|[a-z0-9_-]+[a-z0-9_]|[A-Z0-9_]+)$/;

function tokenLike(s) {
  if (s.length > 32) return false;                      // cids, digests, long compound verdicts are instances
  if (/^0x/i.test(s)) return false;                     // hash / code literals are instances
  if (/^\d+$/.test(s)) return false;                    // numeric amounts encoded as strings
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return false;       // dates
  if (s.includes('-') && /\d/.test(s)) return false;    // id/date-like compounds (LU-FUND-ALPHA-01)
  return ENUM_STRING_MEMBER_RE.test(s);                 // vocabulary tokens only: verdict/mode/venue/class
}

function stringEnumEligible(distinct) {
  return distinct.length >= 2 && distinct.length <= ENUM_CAP
    && distinct.every((v) => typeof v !== 'string' || tokenLike(v))
    && distinct.some((v) => typeof v === 'string'); // null-only sets are type:'null', never an enum
}

function deriveField(vals) {
  const types = [...new Set(vals.map(jsType))];
  let type = types.length === 1 ? types[0] : types;
  // integer + number observed together is just `number`
  if (Array.isArray(type) && type.includes('integer') && type.includes('number')) {
    type = type.filter((t) => t !== 'integer');
  }

  if (types.every((t) => t === 'string' || t === 'number' || t === 'boolean' || t === 'null')) {
    const schema = { type };
    if (types.includes('boolean')) {
      const distinct = [...new Set(vals.map((v) => JSON.stringify(v)))].map((s) => JSON.parse(s));
      if (distinct.length === 2) schema.enum = [false, true]; // both members observed → genuine domain
    } else if (types.includes('string')) {
      const strings = vals.filter((v) => typeof v === 'string');
      const distinct = [...new Set(strings)];
      if (stringEnumEligible(distinct)) schema.enum = distinct.sort();
    }
    // numbers and null are never enumerated (rule 1); unions keep their bare type
    return schema;
  }

  if (types.length === 1 && types[0] === 'array') {
    const elements = vals.flat();
    const schema = { type: 'array' };
    if (elements.length) schema.items = deriveField(elements);
    return schema;
  }

  if (types.length === 1 && types[0] === 'object') {
    return deriveObject(vals);
  }

  // mixed compound shapes: keep the union type, no structural claims
  return { type };
}

// ── fixture re-validation: every live manifest's output_schema vs its fixtures ──
function fixtureMismatches(cg) {
  const failures = [];
  let checked = 0;
  for (const n of liveNodes(cg)) {
    const mp = resolve(MAN_DIR, n.tool_id + '.manifest.json');
    if (!existsSync(mp)) continue;
    let m;
    try { m = readJson(mp); } catch { continue; }
    if (!m.output_schema) continue;
    const fp = resolve(FIX_DIR, n.tool_id + '.fixtures.json');
    if (!existsSync(fp)) continue; // fixture presence is check-node-complete.mjs's axis (e)
    let fx;
    try { fx = readJson(fp); } catch { failures.push(`${n.tool_id}: fixtures file does not parse`); continue; }
    const payloads = (fx.vectors || []).map((v) => v.output_payload).filter((p) => p !== undefined);
    if (!payloads.length) { failures.push(`${n.tool_id}: fixtures carry no output_payload to validate`); continue; }
    payloads.forEach((p, i) => {
      checked++;
      const errs = [];
      validateSubset(m.output_schema, p, `output_payload`, errs);
      if (errs.length) failures.push(`${n.tool_id} fixture #${i}: ${errs.slice(0, 5).join(' | ')}`);
    });
  }
  return { failures, checked };
}

function pinBaseline(missing, mismatchIds) {
  return {
    _comment: 'Ratchet ceiling for OUTPUTSCHEMA-GAP-1 — live-node manifests without output_schema, and pre-existing tools whose fixtures do not validate against their declared output_schema; counts only go DOWN. Regenerate with: node scripts/check-output-schema-coverage.mjs --update-baseline',
    missing_count: missing.length,
    missing_ids: missing,
    fixture_mismatch_count: mismatchIds.length,
    fixture_mismatch_ids: mismatchIds,
  };
}

function main() {
  const cg = readJson(CG_PATH);

  if (process.argv.includes('--derive')) {
    const id = process.argv[process.argv.indexOf('--derive') + 1];
    if (!id) { console.error('--derive requires a tool_id'); process.exit(2); }
    const fp = resolve(FIX_DIR, id + '.fixtures.json');
    if (!existsSync(fp)) { console.error(`--derive: no fixtures file for ${id}: ${fp}`); process.exit(2); }
    console.log(JSON.stringify(deriveSchema(readJson(fp)), null, 1));
    return;
  }

  const missing = coverageGap(cg);

  if (process.argv.includes('--list')) {
    console.log(missing.length ? missing.join('\n') : '(none — full coverage)');
    return;
  }

  if (process.argv.includes('--update-baseline')) {
    const prev = readBaselineForUpdate(BASELINE_PATH, BASELINE_REQUIRED_KEYS, { label: 'output-schema-baseline' });
    const mismatchIds = [...new Set(fixtureMismatches(cg).failures.map((f) => f.split(' ')[0]))].sort();
    const next = pinBaseline(missing, mismatchIds);
    if (prev && (next.missing_count > prev.missing_count || next.fixture_mismatch_count > prev.fixture_mismatch_count)) {
      console.error(`✗ refusing to raise the output-schema baseline: missing ${prev.missing_count} → ${next.missing_count}, fixture-mismatch ${prev.fixture_mismatch_count} → ${next.fixture_mismatch_count}. The ratchet only goes down.`);
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
    console.log(`✓ output-schema baseline updated — ${next.missing_count} live-node manifest(s) without output_schema, ${next.fixture_mismatch_count} pre-existing tool(s) with fixture mismatches shielded.`);
    return;
  }

  // ── gate path ──
  const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_REQUIRED_KEYS, {
    label: 'output-schema-baseline',
    repinCommand: 'node scripts/check-output-schema-coverage.mjs --update-baseline',
  });

  const newMissing = missing.filter((id) => !baseline.missing_ids.includes(id));
  const { failures, checked } = fixtureMismatches(cg);
  const failIds = [...new Set(failures.map((f) => f.split(' ')[0]))].sort();
  const newFailIds = failIds.filter((id) => !baseline.fixture_mismatch_ids.includes(id));
  const newFailures = failures.filter((f) => newFailIds.includes(f.split(' ')[0]));

  const lines = [];
  let failed = false;
  if (missing.length > baseline.missing_count) {
    failed = true;
    lines.push(`✗ coverage regressed: ${missing.length} live-node manifest(s) without output_schema vs baseline ceiling ${baseline.missing_count}`);
  }
  if (newMissing.length) {
    failed = true;
    lines.push(`✗ new output_schema gap(s) not in baseline: ${newMissing.join(', ')}`);
  }
  if (failIds.length > baseline.fixture_mismatch_count) {
    failed = true;
    lines.push(`✗ fixture-mismatch regressed: ${failIds.length} tool(s) failing vs baseline ceiling ${baseline.fixture_mismatch_count}`);
  }
  if (newFailures.length) {
    failed = true;
    lines.push(`✗ ${newFailures.length} fixture output_payload(s) of newly-schema'd tool(s) fail their manifest output_schema:`);
    newFailures.slice(0, 20).forEach((f) => lines.push(`    ${f}`));
    if (newFailures.length > 20) lines.push(`    … +${newFailures.length - 20} more`);
  }
  if (failed) {
    console.error(lines.join('\n'));
    console.error(`\nFix the manifest schema (derive with: node scripts/check-output-schema-coverage.mjs --derive <tool_id>), or if this is legitimate pre-existing debt re-pin with: node scripts/check-output-schema-coverage.mjs --update-baseline`);
    process.exit(1);
  }
  console.log(`✓ output-schema coverage clean — ${missing.length} gap(s) (ceiling ${baseline.missing_count}), ${checked} fixture output_payload(s) re-validated, ${failIds.length} pre-existing mismatched tool(s) shielded by baseline (ceiling ${baseline.fixture_mismatch_count}), 0 new.`);
}

// run the CLI only when invoked directly — importing (the self-test does) must stay side-effect free
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) main();
