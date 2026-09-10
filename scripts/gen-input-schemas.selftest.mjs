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
 *   - unknown-type honesty (no evidenced type -> "type": "unknown", never a guess)
 * Plus: default capture (?? lit / destructure = lit / safeNum(pp.f, lit)),
 *       required rule (bare-only reads + no default -> required; ?. or default -> optional),
 *       array inference (for..of), conflicting evidence -> unknown,
 *       property set == sweep extractor's read set (exactness),
 *       --check green-then-red-by-mutation,
 *       WebMCP flip guard (TODO function_name never flips; a real mapped name does).
 *
 * Run: node scripts/gen-input-schemas.selftest.mjs   (exit 1 on any failed control)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { deriveInputSchema, checkDerivedSchemas, wouldFlipToEmittable, PROVENANCE } from './gen-input-schemas.mjs';
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
    required: ['risk_level'],
  },
  'fx-902-unknown-honesty': {
    properties: { mystery_payload: { type: 'unknown' } },
    required: [], // one bare + one ?. read: the kernel contemplates absence -> optional by rule
  },
  'fx-903-defaults-required': {
    properties: {
      horizon_yrs: { type: 'unknown', default: 10, description: 'Duration in years' },
      cap_mn: { type: 'number', default: 5, description: 'Amount in millions' },
      absolute_min: { type: 'unknown' }, // `+ 1` is concat-ambiguous in JS — NOT number evidence
      sub_min: { type: 'number' }, // `- 1` has no string overload — number evidence
      tolerated_min: { type: 'unknown', default: 0 },
      line_items: { type: 'array' },
      discount: { default: 0 },
    },
    required: ['absolute_min', 'sub_min', 'line_items'],
  },
  'fx-904-conflict-unknown': {
    properties: { dual_nature: { type: 'unknown' } },
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
    console.log('enum inference + defaults + unknown honesty + required rule:');
    for (const [id, want] of Object.entries(expected)) {
      const { inputSchema, rec } = deriveInputSchema(tmp, `chaingraph/kernels/${id}.kernel.mjs`);
      check(`${id}: property set == sweep read set (exactness)`,
        JSON.stringify(Object.keys(inputSchema.properties).sort()) === JSON.stringify(rec.reads.sort()),
        `properties=[${Object.keys(inputSchema.properties)}] reads=[${rec.reads}]`);
      for (const [field, wantProp] of Object.entries(want.properties)) {
        const got = inputSchema.properties[field];
        for (const [k, v] of Object.entries(wantProp)) {
          const gotV = got?.[k];
          const same = JSON.stringify(gotV) === JSON.stringify(v);
          check(`${id}.${field}.${k} === ${JSON.stringify(v)}`, same, `got ${JSON.stringify(gotV)}`);
        }
      }
      check(`${id}: required === ${JSON.stringify(want.required.sort())}`,
        JSON.stringify(inputSchema.required) === JSON.stringify(want.required.sort()),
        `got ${JSON.stringify(inputSchema.required)}`);
      check(`${id}: provenance stamped`, inputSchema.x_schema_provenance === PROVENANCE);
    }

    // ── --check: GREEN on fresh derivation, RED on mutation (SO #34c) ──
    console.log('--check freshness gate (green, then red by mutation):');
    const derived = deriveInputSchema(tmp, 'chaingraph/kernels/fx-901-enum-inference.kernel.mjs').inputSchema;
    const manifest = {
      tool_id: 'fx-901-enum-inference',
      input_schema: JSON.parse(JSON.stringify(derived)),
      mcp_tool_definition: { name: 'fx_901_probe', description: 'probe manifest for the freshness mutation control', inputSchema: JSON.parse(JSON.stringify(derived)) },
    };
    fs.writeFileSync(path.join(tmp, 'manifests', 'fx-901-enum-inference.manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    execFileSync('git', ['add', '-A'], { cwd: tmp, env: gitEnv() });
    const green = checkDerivedSchemas(tmp);
    check('--check GREEN on fresh derived manifest', green.owned === 1 && green.problems.length === 0,
      `owned=${green.owned} problems=${JSON.stringify(green.problems)}`);
    // mutation: hand-edit the derived enum (the exact drift class the gate exists for)
    const tampered = JSON.parse(fs.readFileSync(path.join(tmp, 'manifests', 'fx-901-enum-inference.manifest.json'), 'utf8'));
    tampered.input_schema.properties.risk_level.enum = ['high', 'low']; // dropped 'medium' — a hand-widened/narrowed lie
    fs.writeFileSync(path.join(tmp, 'manifests', 'fx-901-enum-inference.manifest.json'), JSON.stringify(tampered, null, 2) + '\n', 'utf8');
    const red = checkDerivedSchemas(tmp);
    check('--check RED on hand-edited derived schema (mutation)', red.problems.length > 0 && red.problems.some((p) => p.includes('drifted')),
      `problems=${JSON.stringify(red.problems)}`);

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
