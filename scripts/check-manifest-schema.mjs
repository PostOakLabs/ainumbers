// check-manifest-schema.mjs — full-shape JSON Schema validation for every
// manifests/*.manifest.json file against chaingraph/schemas/manifest.schema.json.
// check-manifest-parity.mjs only diffs one field pair (mcp_tool_definition.name
// vs chaingraph.json mcp_name); this checks the entire manifest shape — required
// fields, types, no stray/typo'd keys — which nothing checked before (SSOT
// survey 2026-07-14). Baseline-shielded: pre-existing violations are grandfathered
// in scripts/manifest-schema-baseline.json, new violations fail immediately.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SCHEMA_PATH = resolve(REPO, 'chaingraph', 'schemas', 'manifest.schema.json');
const MANIFESTS_DIR = resolve(REPO, 'manifests');
const BASELINE_PATH = resolve(REPO, 'scripts', 'manifest-schema-baseline.json');

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
const validate = ajv.compile(schema);

const update = process.argv.includes('--update');
const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { files: {} };

const files = readdirSync(MANIFESTS_DIR).filter(f => f.endsWith('.manifest.json'));
const violations = {}; // file -> [messages]

for (const f of files) {
  const path = resolve(MANIFESTS_DIR, f);
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    violations[f] = [`invalid JSON: ${e.message}`];
    continue;
  }
  if (!validate(doc)) {
    violations[f] = validate.errors.map(e => `${e.instancePath || '/'} ${e.message}`);
  }
}

if (update) {
  const next = { files: {} };
  for (const f of Object.keys(violations).sort()) next.files[f] = violations[f];
  const { writeFileSync } = await import('node:fs');
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(next, null, 2) + '\n',
    'utf8'
  );
  console.log(`✓ manifest-schema baseline updated — ${Object.keys(next.files).length} pre-existing violation(s) shielded.`);
  process.exit(0);
}

const newViolations = [];
let shielded = 0;
for (const [f, msgs] of Object.entries(violations)) {
  const known = baseline.files[f];
  if (known && JSON.stringify(known) === JSON.stringify(msgs)) {
    shielded++;
    continue;
  }
  newViolations.push([f, msgs]);
}

// Baseline entries for files that now pass are stale credit, not a failure —
// they just mean the debt burned down; --update refreshes the file to reflect that.

if (newViolations.length) {
  console.error(`✗ manifest-schema FAILED — ${newViolations.length} new violation(s) (${shielded} pre-existing shielded by baseline):`);
  for (const [f, msgs] of newViolations) {
    console.error(`  • ${f}`);
    for (const m of msgs) console.error(`      ${m}`);
  }
  console.error('\nFix the manifest, or if this is legitimate pre-existing debt run:');
  console.error('  node scripts/check-manifest-schema.mjs --update');
  process.exit(1);
}

console.log(`✓ manifest-schema clean — ${files.length} manifests checked, ${shielded} pre-existing violation(s) shielded by baseline, 0 new.`);
