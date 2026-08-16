#!/usr/bin/env node
// check-clause-digest.test.mjs — fixture proof for CLAUSE-DIGEST-GATE-1 (SPEC.md §30.5).
//
// Proves all three directions named in §30.5:
//   (a) a new/changed in-scope node with NO resolvable cited_clause_digest FAILS, naming the node.
//   (b) a new/changed in-scope node WITH a registered digest PASSES.
//   (c) a digest that does NOT resolve to a registered snapshot FAILS — the case that matters.
// Plus: undeclared standards_basis fails; "not_applicable" passes with no digest required; and the
// §30.2 granularity refusal (pin-clause-snapshot.mjs rejects an over-cap excerpt).
//
// Zero-dependency. Non-zero exit blocks.  node scripts/check-clause-digest.test.mjs

import { validateNode } from './check-clause-digest.mjs';
import { buildRegistryEntry, EXCERPT_MAX_BYTES } from '../chaingraph/standard/pin-clause-snapshot.mjs';

const out = [];
let fail = 0;
const log = (s) => { out.push(s); console.log(s); };
const err = (s) => { out.push(s); console.error(s); fail++; };
const ok = (cond, label) => (cond ? log(`✓ ${label}`) : err(`✗ ${label}`));

const REGISTERED_DIGEST = 'sha256:' + 'a'.repeat(64);
const UNREGISTERED_DIGEST = 'sha256:' + 'b'.repeat(64);
const REGISTRY = new Set([REGISTERED_DIGEST]);

const validEntry = {
  digest: REGISTERED_DIGEST,
  source_url: 'https://example.gov/reg',
  retrieved_at: '2026-08-15',
  clause_path: '(a)(2)',
};

log('— §30.5(a): new node, no cited_clause_digest, standards_basis implements_standard —');
{
  const node = { tool_id: 'art-999-fixture', standards_basis: 'implements_standard' };
  const { ok: pass, reasons } = validateNode(node, REGISTRY);
  ok(!pass, 'empty cited_clause_digest FAILS');
  ok(reasons.some((r) => r.includes('empty/missing')), 'failure names the empty-array reason');
}

log('— §30.5(b): new node, one valid registered entry —');
{
  const node = { tool_id: 'art-999-fixture', standards_basis: 'implements_standard', cited_clause_digest: [validEntry] };
  const { ok: pass, reasons } = validateNode(node, REGISTRY);
  ok(pass, 'valid registered digest PASSES');
  ok(reasons.length === 0, 'no reasons on pass');
}

log('— §30.5(c): new node, digest not in registry (the case that matters) —');
{
  const node = { tool_id: 'art-999-fixture', standards_basis: 'implements_standard', cited_clause_digest: [{ ...validEntry, digest: UNREGISTERED_DIGEST }] };
  const { ok: pass, reasons } = validateNode(node, REGISTRY);
  ok(!pass, 'unregistered digest FAILS');
  ok(reasons.some((r) => r.includes('does not resolve')), 'failure names the non-resolving-digest reason');
}

log('— mutation control: flip one char of a registered digest, must still fail —');
{
  const flipped = REGISTERED_DIGEST.slice(0, -1) + (REGISTERED_DIGEST.endsWith('a') ? 'b' : 'a');
  const node = { tool_id: 'art-999-fixture', standards_basis: 'implements_standard', cited_clause_digest: [{ ...validEntry, digest: flipped }] };
  ok(!validateNode(node, REGISTRY).ok, 'a single-character-flipped digest is rejected (registry membership is exact, not fuzzy)');
}

log('— §30.3: undeclared standards_basis on a touched node —');
{
  const node = { tool_id: 'art-999-fixture' };
  const { ok: pass, reasons } = validateNode(node, REGISTRY);
  ok(!pass, 'missing standards_basis FAILS (no silent default)');
  ok(reasons.some((r) => r.includes('standards_basis missing')), 'failure names the undeclared reason');
}
{
  const node = { tool_id: 'art-999-fixture', standards_basis: 'yes_probably' };
  ok(!validateNode(node, REGISTRY).ok, 'an invalid standards_basis value FAILS (closed vocabulary)');
}

log('— explicit opt-out: not_applicable requires nothing further —');
{
  const node = { tool_id: 'art-999-fixture', standards_basis: 'not_applicable' };
  ok(validateNode(node, REGISTRY).ok, 'not_applicable PASSES with zero cited_clause_digest entries');
}

log('— entry shape: missing required member fails, naming the entry index —');
{
  const node = { tool_id: 'art-999-fixture', standards_basis: 'implements_standard', cited_clause_digest: [{ digest: REGISTERED_DIGEST, source_url: 'https://x', retrieved_at: '2026-08-15' /* clause_path missing */ }] };
  const { ok: pass, reasons } = validateNode(node, REGISTRY);
  ok(!pass, 'entry missing clause_path FAILS');
  ok(reasons.some((r) => r.includes('cited_clause_digest[0]') && r.includes('clause_path')), 'failure names the missing member');
}

log('— §30.2 granularity: pin-clause-snapshot.mjs refuses an over-cap excerpt —');
{
  const tooBig = Buffer.alloc(EXCERPT_MAX_BYTES + 1, 'x');
  let threw = false, msg = '';
  try {
    buildRegistryEntry(tooBig, { clause_path: '(a)', source_url: 'https://x', retrieved_at: '2026-08-15', registered_by: 'test', registered_at: '2026-08-15' });
  } catch (e) { threw = true; msg = e.message; }
  ok(threw, `excerpt of ${EXCERPT_MAX_BYTES + 1} bytes is REFUSED (whole-document digests structurally impossible)`);
  ok(msg.includes('whole-document'), 'refusal message cites the whole-document rule');
}
{
  const small = Buffer.from('This paragraph states X shall not exceed Y.', 'utf8');
  let threw = false;
  try {
    buildRegistryEntry(small, { clause_path: '(a)', source_url: 'https://x', retrieved_at: '2026-08-15', registered_by: 'test', registered_at: '2026-08-15' });
  } catch { threw = true; }
  ok(!threw, `a real clause-sized excerpt (${small.length} bytes) is ACCEPTED`);
}
{
  const small = Buffer.from('excerpt text', 'utf8');
  let threw = false;
  try {
    buildRegistryEntry(small, { clause_path: '(a)', source_url: 'https://x', retrieved_at: 'not-a-date', registered_by: 'test', registered_at: '2026-08-15' });
  } catch { threw = true; }
  ok(threw, 'a non-ISO retrieved_at is refused');
}

console.log(`\n${fail} failure(s) of ${out.filter((s) => s.startsWith('✓') || s.startsWith('✗')).length} assertion(s).`);
process.exit(fail ? 1 : 0);
