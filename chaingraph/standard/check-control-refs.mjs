#!/usr/bin/env node
// check-control-refs.mjs — CTRLREF-1 gate (chaingraph/standard/CONTROL-REFS.md) for the optional node `control_refs` field.
//
// Every `control_refs` entry on every node shard must:
//   1. be exactly { framework, id } (no title, description, or text member),
//   2. use a framework in the shared enum (OCG Execution Receipt predicate v0.2),
//   3. match the id pattern for its framework (nist-800-53r5, aiuc-1),
//   4. for nist-800-53r5, name an id present in the committed id list extracted from the
//      CC0 NIST SP 800-53 Rev. 5 OSCAL catalog (chaingraph/standard/nist-800-53r5-control-ids.json).
//
// Lives in standard/ because spec-gate-coverage.mjs only resolves §15 gates from that directory.
// Standalone: preflight.mjs has no documented extension point for a new gate script.
// Usage: node chaingraph/standard/check-control-refs.mjs [--self-test]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NODES_DIR = path.join(HERE, '..', 'graph', 'nodes');
const ID_LIST = path.join(HERE, 'nist-800-53r5-control-ids.json');

const FRAMEWORKS = ['nist-800-53r5', 'aiuc-1', 'nist-ai-rmf', 'soc2-tsc', 'iso27001-2022'];
const PATTERNS = {
  'nist-800-53r5': /^[A-Z]{2}-\d+(\(\d+\))?$/,
  'aiuc-1': /^AIUC-[A-F]-\d{2}$/,
};

/** Returns an array of problem strings for one node's control_refs value. */
export function checkRefs(refs, nistIds, label) {
  const problems = [];
  if (!Array.isArray(refs)) return [`${label}: control_refs must be an array`];
  refs.forEach((e, i) => {
    const at = `${label} control_refs[${i}]`;
    if (!e || typeof e !== 'object' || Array.isArray(e)) { problems.push(`${at}: not an object`); return; }
    for (const k of Object.keys(e)) {
      if (k !== 'framework' && k !== 'id') problems.push(`${at}: member "${k}" not allowed (ids only, never title or text)`);
    }
    if (!FRAMEWORKS.includes(e.framework)) { problems.push(`${at}: unknown framework ${JSON.stringify(e.framework)}`); return; }
    if (typeof e.id !== 'string' || e.id.length === 0) { problems.push(`${at}: id must be a non-empty string`); return; }
    const pat = PATTERNS[e.framework];
    if (pat && !pat.test(e.id)) problems.push(`${at}: id ${JSON.stringify(e.id)} does not match ${pat} for ${e.framework}`);
    else if (e.framework === 'nist-800-53r5' && !nistIds.has(e.id)) problems.push(`${at}: ${e.id} is not in the pinned NIST SP 800-53 r5 id list`);
  });
  return problems;
}

function selfTest() {
  const nist = new Set(['AC-6', 'AC-6(1)']);
  const ok = [{ framework: 'nist-800-53r5', id: 'AC-6(1)' }, { framework: 'aiuc-1', id: 'AIUC-A-01' }];
  const bad = [
    [{ framework: 'nist-800-53r5', id: 'AC-6', title: 'Least Privilege' }],
    [{ framework: 'nist-800-53r5', id: 'ac-6' }],
    [{ framework: 'nist-800-53r5', id: 'ZZ-99' }],
    [{ framework: 'aiuc-1', id: 'AIUC-G-01' }],
    [{ framework: 'cis', id: 'X' }],
    [{ framework: 'aiuc-1' }],
  ];
  if (checkRefs(ok, nist, 't').length) throw new Error('self-test: valid refs rejected');
  bad.forEach((b, i) => { if (!checkRefs(b, nist, 't').length) throw new Error(`self-test: bad case ${i} accepted`); });
  console.log('check-control-refs self-test OK');
}

if (process.argv.includes('--self-test')) { selfTest(); process.exit(0); }

const list = JSON.parse(fs.readFileSync(ID_LIST, 'utf8'));
const nistIds = new Set(list.ids);
if (list.ids.some((s) => typeof s !== 'string') || nistIds.size < 1000) {
  console.error('check-control-refs FAIL: committed NIST id list is malformed or truncated');
  process.exit(1);
}
const problems = [];
let tagged = 0;
let entries = 0;
for (const f of fs.readdirSync(NODES_DIR).filter((n) => n.endsWith('.json')).sort()) {
  const node = JSON.parse(fs.readFileSync(path.join(NODES_DIR, f), 'utf8'));
  if (node.control_refs === undefined) continue;
  tagged++;
  entries += Array.isArray(node.control_refs) ? node.control_refs.length : 0;
  problems.push(...checkRefs(node.control_refs, nistIds, f));
}
if (problems.length) {
  console.error(`check-control-refs FAIL (${problems.length}):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`check-control-refs OK: ${tagged} node(s) tagged, ${entries} entr${entries === 1 ? 'y' : 'ies'}, ${nistIds.size} NIST ids in list (${list.source_commit.slice(0, 12)})`);
