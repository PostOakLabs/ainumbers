#!/usr/bin/env node
// Compares two GitHub ruleset JSON bodies (a live API fetch and the
// repo-owned file) after normalizing away read-only fields and array
// order, so the comparison only fails on a REAL rule difference.
//
// Usage: node scripts/ruleset-diff.mjs <fileA.json> <fileB.json>
// Exit 0 + "IDENTICAL" if they match after normalization; exit 1 +
// a unified-ish diff of the normalized bodies otherwise.
//
// Read-only fields are the ones GitHub adds to a ruleset response that
// never belong in a PUT body: id, source, source_type, created_at,
// updated_at, node_id, _links, current_user_can_bypass.
import { readFileSync } from 'node:fs';

const READ_ONLY_FIELDS = [
  'id', 'source', 'source_type', 'created_at', 'updated_at',
  'node_id', '_links', 'current_user_can_bypass',
];

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeysDeep(value[key]);
    return out;
  }
  return value;
}

export function normalizeRuleset(raw) {
  const body = { ...raw };
  for (const field of READ_ONLY_FIELDS) delete body[field];

  if (Array.isArray(body.rules)) {
    body.rules = body.rules
      .map((rule) => {
        const r = { ...rule };
        if (r.type === 'required_status_checks' && r.parameters?.required_status_checks) {
          r.parameters = {
            ...r.parameters,
            required_status_checks: [...r.parameters.required_status_checks].sort((a, b) =>
              a.context.localeCompare(b.context)),
          };
        }
        return r;
      })
      .sort((a, b) => a.type.localeCompare(b.type));
  }

  if (Array.isArray(body.bypass_actors)) {
    body.bypass_actors = [...body.bypass_actors].sort((a, b) => a.actor_id - b.actor_id);
  }

  return sortKeysDeep(body);
}

export function diffNormalized(a, b) {
  const na = JSON.stringify(normalizeRuleset(a), null, 2);
  const nb = JSON.stringify(normalizeRuleset(b), null, 2);
  return { identical: na === nb, normalizedA: na, normalizedB: nb };
}

function main() {
  const [pathA, pathB] = process.argv.slice(2);
  if (!pathA || !pathB) {
    console.error('Usage: node scripts/ruleset-diff.mjs <fileA.json> <fileB.json>');
    process.exit(2);
  }
  const a = JSON.parse(readFileSync(pathA, 'utf8'));
  const b = JSON.parse(readFileSync(pathB, 'utf8'));
  const { identical, normalizedA, normalizedB } = diffNormalized(a, b);
  if (identical) {
    console.log('IDENTICAL');
    process.exit(0);
  }
  console.log(`--- ${pathA} (normalized)`);
  console.log(normalizedA);
  console.log(`--- ${pathB} (normalized)`);
  console.log(normalizedB);
  process.exit(1);
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) main();
