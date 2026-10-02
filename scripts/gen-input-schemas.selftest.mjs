#!/usr/bin/env node
/**
 * gen-input-schemas.selftest.mjs — controls for MANIFEST-SCHEMA-BACKFILL-1's
 * schema generator (scripts/gen-input-schemas.mjs).
 *
 * GREEN controls prove the inference rules derive what the code evidences;
 * the RED control proves the --check freshness gate actually REDS on a
 * hand-edit to a provenance-marked schema block (SO #34c: a gate that has
 * only ever been observed green has not been observed at all — here it is
 * observed red, by mutation, in the same run).
 *
 * Row-mandated controls:
 *   - enum inference (>=2 evidenced literals -> enum with the literal set)
 *   - unknown-type honesty (no evidenced type -> NO `type` key + the description
 *     sentence; MCP-SCHEMA-CONFORMANCE-1, RULINGS 2026-09-10T20:30:44Z — the
 *     pre-ruling `"type": "unknown"` is not valid JSON Schema)
 * Plus: default capture (?? lit / destructure = lit / safeNum(pp.f, lit)),
 *       required rule (bare-only reads + no default -> required; ?. or default -> optional),
 *       array inference (for..of), conflicting evidence -> type omitted,
 *       property set == sweep extractor's read set (exactness),
 *       provenance mark at the manifest level (never inside the schema object),
 *       --check green on BOTH shapes (new + legacy transition), red-by-mutation,
 *       RED control: a fixture rendered with `"type": "unknown"` FAILS the
 *       check-manifest-schema.mjs illegal-type validator,
 *       WebMCP flip guard (TODO function_name never flips; a real mapped name does).
 *
 * Run: node scripts/gen-input-schemas.selftest.mjs   (exit 1 on any failed control)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { deriveInputSchema, checkDerivedSchemas, wouldFlipToEmittable, PROVENANCE, TYPE_NOT_EVIDENCED } from './gen-input-schemas.mjs';
import { illegalTypeViolations } from './check-manifest-schema.mjs';
import { gitEnv } from './_git-env-lib.mjs';

const failures = [];
function check(name, ok, detail) {
  if (ok) console.log(`  ✓ ${name}`);
  else { console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); failures.push(name); }
}

const KERNELS = {
  'fx-901-enum-inference': `const TOOL_ID = 'fx-901-enum-inference';
function safeNum(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
export function compute(pp) {
  const level = pp.risk_level === 'low' ? 1 : pp.risk_level === 'high' ? 3 : 2;
  if (pp.risk_level === 'medium') { return { level }; }
  const floor = safeNum(pp.floor_usd, 250);
  return { level, floor, mode: level };
}
export function buildArtifact(input) { return { artifact: input }; }
`,
  'fx-902-unknown-honesty': `const TOOL_ID = 'fx-902-unknown-honesty';
export function compute(pp) {
  return { echoed: pp.mystery_payload, other: pp?.mystery_payload };
}
export function buildArtifact(input) { return { artifact: input }; }
`,
  'fx-903-defaults-required': `const TOOL_ID = 'fx-903-defaults-required';
function helper(q) { return q.discount ?? 0; }
export function compute(pp) {
  const { horizon_yrs = 10 } = pp;
  const cap = safeNum(pp.cap_mn, 5);
  const hard = pp.absolute_min + 1;
  const sub = pp.sub_min - 1;
  const soft = pp?.tolerated_min ?? 0;
  let total = 0;
  for (const v of pp.line_items) total += v;
  const dflt = pp.discount ?? 0;
  helper(pp);
  return { total, cap, hard, sub, soft, horizon_yrs, dflt };
}
export function buildArtifact(input) { return { artifact: input }; }
`,
  'fx-904-conflict-unknown': `const TOOL_ID = 'fx-904-conflict-unknown';
export function compute(pp) {
  const a = Number(pp.dual_nature);
  const b = pp.dual_nature.trim();
  return { a, b };
}
export function buildArtifact(input) { return { artifact: input }; }
`,
};

const expected = {
  'fx-901-enum-inference': {
    properties: {
      risk_level: { type: 'string', enum: ['high', 'low', 'medium'] },
      floor_usd: { type: 'number', default: 250, description: 'Amount in US dollars' },
    },
    typeless: [],
    required: ['risk_level'],
  },
  'fx-902-unknown-honesty': {
    properties: { mystery_payload: { description: TYPE_NOT_EVIDENCED } },
    typeless: ['mystery_payload'], // no evidenced type -> NO `type` key + the sentence (never "unknown")
    required: [], // one bare + one ?. read: the kernel contemplates absence -> optional by rule
  },
  'fx-903-defaults-required': {
    properties: {
      horizon_yrs: { type: undefined, default: 10, description: `Duration in years${'; ' + TYPE_NOT_EVIDENCED}` }, // type OMITTED (checked via typeless below)
      cap_mn: { type: 'number', default: 5, description: 'Amount in millions' },
      absolute_min: { description: TYPE_NOT_EVIDENCED }, // `+ 1` is concat-ambiguous in JS — NOT number evidence
      sub_min: { type: 'number' }, // `- 1` has no string overload — number evidence
      tolerated_min: { default: 0, description: TYPE_NOT_EVIDENCED },
      line_items: { type: 'array' },
      discount: { default: 0, description: TYPE_NOT_EVIDENCED },
    },
    typeless: ['horizon_yrs', 'absolute_min', 'tolerated_min', 'discount'],
    required: ['absolute_min', 'sub_min', 'line_items'],
  },
  'fx-904-conflict-unknown': {
    properties: { dual_nature: { description: TYPE_NOT_EVIDENCED } },
    typeless: ['dual_nature'], // conflicting evidence -> OMITTED (never pick a winner)
    required: ['dual_nature'],
  },
};

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'msb-selftest-'));
  try {
    // ── fixture tree ──
    fs.mkdirSync(path.join(tmp, 'chaingraph', 'kernels'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'manifests'), { recursive: true });
    for (const [id, src] of Object.entries(KERNELS)) {
      fs.writeFileSync(path.join(tmp, 'chaingraph', 'kernels', `${id}.kernel.mjs`), src, 'utf8');
    }
    execFileSync('git', ['init', '-q'], { cwd: tmp, env: gitEnv() });
    execFileSync('git', ['add', '-A'], { cwd: tmp, env: gitEnv() });

    // ── GREEN inference controls ──
    console.log('enum inference + defaults + no-evidence honesty (typeless) + required rule:');
    for (const [id, want] of Object.entries(expected)) {
      const { inputSchema, rec } = deriveInputSchema(tmp, `chaingraph/kernels/${id}.kernel.mjs`);
      check(`${id}: property set == sweep read set (exactness)`,
        JSON.stringify(Object.keys(inputSchema.properties).sort()) === JSON.stringify(rec.reads.sort()),
        `properties=[${Object.keys(inputSchema.properties)}] reads=[${rec.reads}]`);
      for (const [field, wantProp] of Object.entries(want.properties)) {
        const got = inputSchema.properties[field];
        for (const [k, v] of Object.entries(wantProp)) {
          if (k === 'type' && v === undefined) continue; // absence asserted via want.typeless
          const gotV = got?.[k];
          const same = JSON.stringify(gotV) === JSON.stringify(v);
          check(`${id}.${field}.${k} === ${JSON.stringify(v)}`, same, `got ${JSON.stringify(gotV)}`);
        }
        if (want.typeless.includes(field)) {
          check(`${id}.${field}: carries NO 'type' key (omitted, never invented)`, !!got && !('type' in got), `got ${JSON.stringify(got)}`);
        }
      }
      check(`${id}: required === ${JSON.stringify(want.required.sort())}`,
        JSON.stringify(inputSchema.required) === JSON.stringify(want.required.sort()),
        `got ${JSON.stringify(inputSchema.required)}`);
      check(`${id}: provenance mark NOT inside the schema object (moved to the manifest-level sibling)`, !('x_schema_provenance' in inputSchema));
    }

    // ── MCP-SCHEMA-CONFORMANCE-1 RED control: "type": "unknown" fails the validator ──
    console.log('illegal-type validator (check-manifest-schema.mjs, recursive):');
    const unknownFixture = { type: 'object', required: [], properties: { mystery_payload: { type: 'unknown' } } };
    const redViolations = illegalTypeViolations(unknownFixture, 'input_schema');
    check('fixture rendered with "type": "unknown" FAILS the validator (illegal-type-name)',
      redViolations.length === 1 && redViolations[0] === 'illegal-type-name input_schema.properties.mystery_payload=unknown',
      `got ${JSON.stringify(redViolations)}`);
    const honestFixture = { type: 'object', required: [], properties: { mystery_payload: { description: TYPE_NOT_EVIDENCED } } };
    check('the honest typeless rendering PASSES the validator', illegalTypeViolations(honestFixture, 'input_schema').length === 0,
      `got ${JSON.stringify(illegalTypeViolations(honestFixture, 'input_schema'))}`);
    const nestedFixture = { type: 'object', properties: { rows: { type: 'array', items: { type: 'unknown' } } } };
    check('illegal type inside nested items FAILS (recursive reach)',
      illegalTypeViolations(nestedFixture, 'input_schema').some((v) => v === 'illegal-type-name input_schema.properties.rows.items=unknown'),
      `got ${JSON.stringify(illegalTypeViolations(nestedFixture, 'input_schema'))}`);

    // ── --check: GREEN on the one accepted shape, RED on mutation (SO #34c), and
    //    the removed transition stays removed: an inner-mark-only manifest is NOT ours ──
    console.log('--check freshness gate (green on the accepted shape, red by mutation, legacy inner mark no longer owned):');
    const derived = deriveInputSchema(tmp, 'chaingraph/kernels/fx-901-enum-inference.kernel.mjs').inputSchema;
    const manifest = {
      tool_id: 'fx-901-enum-inference',
      input_schema: JSON.parse(JSON.stringify(derived)),
      input_schema_provenance: PROVENANCE, // NEW shape: the mark lives at the manifest level
      mcp_tool_definition: { name: 'fx_901_probe', description: 'probe manifest for the freshness mutation control', inputSchema: JSON.parse(JSON.stringify(derived)) },
    };
    fs.writeFileSync(path.join(tmp, 'manifests', 'fx-901-enum-inference.manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    // REMOVED-TRANSITION control: fx-902 rendered the pre-ruling way (`unknown`
    // types + the mark INSIDE the schema object, no top-level key). The
    // MCP-SCHEMA-CONFORMANCE-1 transition used to call this owned; PR-5 removed
    // that fallback, so this fixture must now be invisible to --check — not a
    // silently accepted second shape. The fixture is built here (the generator no
    // longer knows how to render the legacy shape at all).
    const fresh902 = deriveInputSchema(tmp, 'chaingraph/kernels/fx-902-unknown-honesty.kernel.mjs').inputSchema;
    const legacy902 = JSON.parse(JSON.stringify(fresh902));
    for (const prop of Object.values(legacy902.properties || {})) {
      if (prop && typeof prop === 'object' && !Array.isArray(prop) && !('type' in prop)) {
        prop.type = 'unknown';
        delete prop.description;
      }
    }
    legacy902.x_schema_provenance = PROVENANCE;
    const manifest902 = {
      tool_id: 'fx-902-unknown-honesty',
      input_schema: JSON.parse(JSON.stringify(legacy902)), // inner mark only — no longer an ownership mark
      mcp_tool_definition: { name: 'fx_902_probe', description: 'legacy-shape probe manifest for the removed-transition control', inputSchema: JSON.parse(JSON.stringify(legacy902)) },
    };
    fs.writeFileSync(path.join(tmp, 'manifests', 'fx-902-unknown-honesty.manifest.json'), JSON.stringify(manifest902, null, 2) + '\n', 'utf8');
    execFileSync('git', ['add', '-A'], { cwd: tmp, env: gitEnv() });
    const green = checkDerivedSchemas(tmp);
    check('--check GREEN on fresh derived manifest (accepted shape, top-level mark)',
      green.owned === 1 && green.problems.length === 0,
      `owned=${green.owned} problems=${JSON.stringify(green.problems)}`);
    check('legacy inner mark confers NO ownership (the PR-5-removed transition stays removed)',
      green.owned === 1,
      `owned=${green.owned} — an inner x_schema_provenance was counted as ours`);
    // mutation: hand-edit the derived enum (the exact drift class the gate exists for)
    const tampered = JSON.parse(fs.readFileSync(path.join(tmp, 'manifests', 'fx-901-enum-inference.manifest.json'), 'utf8'));
    tampered.input_schema.properties.risk_level.enum = ['high', 'low']; // dropped 'medium' — a hand-widened/narrowed lie
    fs.writeFileSync(path.join(tmp, 'manifests', 'fx-901-enum-inference.manifest.json'), JSON.stringify(tampered, null, 2) + '\n', 'utf8');
    const red = checkDerivedSchemas(tmp);
    check('--check RED on hand-edited derived schema (mutation)', red.problems.length > 0 && red.problems.some((p) => p.includes('drifted')),
      `problems=${JSON.stringify(red.problems)}`);

    // ── WORKER-NULLPARITY-MANIFESTS-1: x_null_distinct home → in-schema fold ──
    // The worker normalizer exempts in-schema `x_null_distinct: true` properties
    // at any depth (mcp-apps-poc/_null_normalize.mjs:47); the declaration HOME is
    // the top-level manifest sibling (same doctrine as x_order_bearing). The
    // derived region must be reachable ONLY through home + generator: fold green,
    // hand in-schema key red, bad path red, one-slot-only parity red.
    console.log('x_null_distinct fold (home → in-schema, items.properties depth, round-trip):');
    const { foldXNullDistinct, nullDistinctHome, foldHomeIntoInputSchema } = await import('./gen-input-schemas.mjs');
    const pristine = JSON.parse(JSON.stringify(manifest)); // the un-tampered manifest written above
    pristine.input_schema = JSON.parse(JSON.stringify(derived));
    pristine.mcp_tool_definition.inputSchema = JSON.parse(JSON.stringify(derived));
    // Pure-function controls on fx-903's derived schema (it has an array property):
    const derived903 = deriveInputSchema(tmp, 'chaingraph/kernels/fx-903-defaults-required.kernel.mjs').inputSchema;
    const folded903 = JSON.parse(JSON.stringify(derived903));
    foldXNullDistinct(folded903, ['properties.discount', 'properties.line_items.items.properties.unit']);
    check('fold creates declaration-only items.properties shell (no type/description invented)',
      JSON.stringify(folded903.properties.line_items.items) === JSON.stringify({ properties: { unit: { x_null_distinct: true } } }),
      `got ${JSON.stringify(folded903.properties.line_items.items)}`);
    check('fold sets the key on an existing terminal property',
      folded903.properties.discount.x_null_distinct === true && folded903.properties.discount.default === 0,
      `got ${JSON.stringify(folded903.properties.discount)}`);
    // RED: a home naming a nonexistent top-level property must never silently fold
    try {
      foldXNullDistinct(JSON.parse(JSON.stringify(derived)), ['properties.nonexistent_property']);
      check('home naming a nonexistent top-level property -> RED (never invents)', false, 'no throw');
    } catch (e) {
      check('home naming a nonexistent top-level property -> RED (never invents)', /read set/.test(e.message), `threw: ${e.message}`);
    }
    // RED: an in-schema x_null_distinct WITHOUT the home is drift like any hand-edit
    const orphan = JSON.parse(JSON.stringify(pristine));
    orphan.input_schema.properties.risk_level.x_null_distinct = true;
    fs.writeFileSync(path.join(tmp, 'manifests', 'fx-901-enum-inference.manifest.json'), JSON.stringify(orphan, null, 2) + '\n', 'utf8');
    const orphanRed = checkDerivedSchemas(tmp);
    check('--check RED on in-schema x_null_distinct without a home (hand-edit class)',
      orphanRed.problems.length > 0 && orphanRed.problems.some((p) => p.includes('drifted')),
      `problems=${JSON.stringify(orphanRed.problems)}`);
    check('nullDistinctHome validates shape (non-array home red)',
      (() => { try { nullDistinctHome({ tool_id: 'x', x_null_distinct: 'properties.a' }); return false; } catch { return true; } })());
    // Disk controls on the fx-901 fixture manifest: home folded into BOTH slots.
    const homeManifest = JSON.parse(JSON.stringify(pristine));
    homeManifest.x_null_distinct = ['properties.risk_level'];
    const folded = JSON.parse(JSON.stringify(deriveInputSchema(tmp, 'chaingraph/kernels/fx-901-enum-inference.kernel.mjs').inputSchema));
    foldXNullDistinct(folded, homeManifest.x_null_distinct);
    homeManifest.input_schema = JSON.parse(JSON.stringify(folded));
    homeManifest.mcp_tool_definition.inputSchema = JSON.parse(JSON.stringify(folded));
    fs.writeFileSync(path.join(tmp, 'manifests', 'fx-901-enum-inference.manifest.json'), JSON.stringify(homeManifest, null, 2) + '\n', 'utf8');
    const foldGreen = checkDerivedSchemas(tmp);
    check('--check GREEN when in-schema keys == fold(top-level home)',
      foldGreen.owned === 1 && foldGreen.problems.length === 0,
      `owned=${foldGreen.owned} problems=${JSON.stringify(foldGreen.problems)}`);
    // RED: two-writer parity — the fold must land in BOTH schema slots
    const parity = JSON.parse(JSON.stringify(homeManifest));
    parity.mcp_tool_definition.inputSchema = JSON.parse(JSON.stringify(pristine.input_schema)); // home folded in one slot only
    fs.writeFileSync(path.join(tmp, 'manifests', 'fx-901-enum-inference.manifest.json'), JSON.stringify(parity, null, 2) + '\n', 'utf8');
    const parityRed = checkDerivedSchemas(tmp);
    check('--check RED when only input_schema carries the fold (two-writer parity)',
      parityRed.problems.length > 0 && parityRed.problems.some((p) => p.includes('two schema writers')),
      `problems=${JSON.stringify(parityRed.problems)}`);
    // round-trip: the same home re-folded onto a fresh derivation reproduces the
    // on-disk schema byte-for-byte (the redraft-stability property --check enforces)
    const refolded = JSON.parse(JSON.stringify(deriveInputSchema(tmp, 'chaingraph/kernels/fx-901-enum-inference.kernel.mjs').inputSchema));
    foldHomeIntoInputSchema(homeManifest, refolded);
    check('round-trip: fold(home, fresh derivation) reproduces the on-disk schema',
      JSON.stringify(refolded) === JSON.stringify(homeManifest.input_schema));
    // restore the GREEN home state for the flip-guard controls below
    fs.writeFileSync(path.join(tmp, 'manifests', 'fx-901-enum-inference.manifest.json'), JSON.stringify(homeManifest, null, 2) + '\n', 'utf8');

    // ── WebMCP flip guard ──
    console.log('WebMCP flip guard:');
    fs.mkdirSync(path.join(tmp, 'chaingraph'), { recursive: true });
    const page = `<html><body><input id="risk_level"><input id="floor_usd">
      <script>function runProbe(){ window._lastResult = 1; }</script></body></html>`;
    fs.writeFileSync(path.join(tmp, 'chaingraph', 'fx-901-enum-inference.html'), page, 'utf8');
    const flipManifest = {
      tool_id: 'fx-901-enum-inference',
      execution: { type: 'browser-javascript', entry: 'chaingraph/fx-901-enum-inference.html', function_name: 'runProbe', timeout_ms: 5000 },
      mcp_tool_definition: { name: 'fx_901_probe', description: 'probe', inputSchema: { type: 'object', properties: { risk_level: { type: 'string' }, floor_usd: { type: 'number' } } } },
    };
    check('real mapped function_name + element ids + result global -> FLIP', wouldFlipToEmittable(flipManifest, tmp) === true);
    const todoManifest = JSON.parse(JSON.stringify(flipManifest));
    todoManifest.execution.function_name = 'TODO_FUNCTION_NAME_REVIEW';
    check('TODO function_name -> never flips', wouldFlipToEmittable(todoManifest, tmp) === false);
    const noIdManifest = JSON.parse(JSON.stringify(flipManifest));
    noIdManifest.mcp_tool_definition.inputSchema.properties.extra_prop = { type: 'string' };
    check('unmapped property id -> no flip', wouldFlipToEmittable(noIdManifest, tmp) === false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  if (failures.length) {
    console.error(`\nGEN-INPUT-SCHEMAS SELFTEST: FAIL (${failures.length})`);
    process.exit(1);
  }
  console.log('\nGEN-INPUT-SCHEMAS SELFTEST: PASS');
}

main();
