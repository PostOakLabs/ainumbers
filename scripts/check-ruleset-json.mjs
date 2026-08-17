#!/usr/bin/env node
// Local half of RULESET-AS-CODE-1: proves .github/rulesets/*.json parses
// and has no read-only API fields before it ever reaches ruleset-apply.yml.
// The API-comparing half (does it match live?) needs network + an App
// token and stays CI-only (ruleset-apply.yml / ruleset-drift-gate.yml).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const READ_ONLY_FIELDS = [
  'id', 'source', 'source_type', 'created_at', 'updated_at',
  'node_id', '_links', 'current_user_can_bypass',
];

const dir = '.github/rulesets';
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

if (files.length === 0) {
  console.log('No ruleset files under .github/rulesets/ — nothing to check.');
  process.exit(0);
}

let failed = false;
for (const file of files) {
  const path = join(dir, file);
  let body;
  try {
    body = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`${path}: invalid JSON — ${err.message}`);
    failed = true;
    continue;
  }
  const present = READ_ONLY_FIELDS.filter((f) => f in body);
  if (present.length > 0) {
    console.error(`${path}: contains read-only API field(s) not valid as PUT input: ${present.join(', ')}`);
    failed = true;
    continue;
  }
  for (const required of ['name', 'target', 'enforcement', 'conditions', 'rules']) {
    if (!(required in body)) {
      console.error(`${path}: missing required field "${required}"`);
      failed = true;
    }
  }
  console.log(`${path}: OK`);
}

process.exit(failed ? 1 : 0);
