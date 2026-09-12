// agent-identity-binding.test.mjs — §AGID-1 agent-identity binding GATE (SPEC.md §AGID-1).
// Proves: `audit_signature.requesting_agent` is hash-EXCLUDED (adding, mutating, and removing the
// member leaves `execution_hash` byte-identical; both halves of the exclusion proof asserted, so the
// invariance is never vacuous), and the closed v1 scheme discipline holds at the REAL gate: the four
// v1 schemes (did / rfc9421-keyid / webbotauth-card / mcp-i) and the `x-` vendor extension are
// accepted by `schema-validate.mjs`, while a bare unknown scheme, an organizational `lei` scheme
// (§9's slot, NOT admitted in v1), a missing `id`, a wrong `agid_version`, an unknown `asserted_by`,
// an unknown member, and a non-object `evidence` are each rejected. Absence is accepted: an artifact
// without the member is fully conformant (§AGID-1.5c — no MUST-emit).
// Node 18+ (WebCrypto + node: builtins only — zero npm deps).
// Run:  node chaingraph/standard/agent-identity-binding.test.mjs
import { cgCanon, canonicalPreimage, executionHash } from '../kernels/_hash.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// ---- fixture: one artifact, three audit_signature states ------------------------------------------
const policy = { execution_backend: 'server', input_parameters: { document_id: 'DOC-AGID-001', action: 'summarize' } };
const output = { decision: 'completed', characters: 512 };
const rootHash = await executionHash(policy, output);

const member = {
  agid_version: '1',
  scheme: 'did',
  id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
  evidence: { note: 'assertion recorded at request time' },
  asserted_by: 'producer',
};
const shell = { payloadType: 'application/vnd.openchain.graph+json;version=0.2', payload: '', signatures: [] };
const without = { tool_id: 'art-999-agid-fixture', execution_hash: rootHash, chain: { parent_hashes: [], parent_tool_ids: [], chain_depth: 0 }, policy_parameters: policy, output_payload: output, audit_signature: shell };
const withMember = { ...without, audit_signature: { ...shell, requesting_agent: member } };
const withMutated = { ...without, audit_signature: { ...shell, requesting_agent: { ...member, id: 'did:web:producer.example' } } };

// ---- §AGID-1 / §AGID-1.5 THE HASH-EXCLUSION PROOF (non-vacuous, mirrors §21.6/§PPH-1) -------------
ok(JSON.stringify(cgCanon(withMember)) !== JSON.stringify(cgCanon(without)),
   'the member DOES change the artifact\'s canonical form (it is materially present — the next assertions are not vacuous)');
for (const [label, art] of [['added', withMember], ['mutated', withMutated]]) {
  ok(canonicalPreimage(art.policy_parameters, art.output_payload) === canonicalPreimage(without.policy_parameters, without.output_payload),
     `§4 preimage is byte-identical with the member ${label} (the member lives under audit_signature, outside the preimage)`);
  ok(await executionHash(art.policy_parameters, art.output_payload) === rootHash,
     `execution_hash recomputes byte-identical with the member ${label} (member is hash-EXCLUDED)`);
  ok(art.execution_hash === without.execution_hash,
     `the recorded execution_hash does not move with the member ${label} (additive: goldens stay pinned)`);
}
ok(!('requesting_agent' in without.audit_signature), 'an artifact omitting the member is unchanged (absence is conformant, §AGID-1.5c)');
ok(executionHash.length === 2, 'executionHash() takes exactly the two §4 inputs — the member cannot reach the preimage');

// ---- §AGID-1.1 scheme discipline at the REAL gate (no second validator implementation) ------------
// Each case is a full artifact handed to schema-validate.mjs via CHAINGRAPH (its shape-sniff routes a
// document carrying execution_hash to $defs/artifact, where the new audit_signature.requesting_agent
// $ref lives), so the acceptance/rejection verdicts are the gate's own, never re-implemented here.
const dir = mkdtempSync(join(tmpdir(), 'agid-'));
let gate = (art) => {
  const f = join(dir, 'case.json');
  writeFileSync(f, JSON.stringify(art));
  try {
    execFileSync(process.execPath, [join(HERE, 'schema-validate.mjs')], { env: { ...process.env, CHAINGRAPH: f }, stdio: 'pipe' });
    return { code: 0, out: '' };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};
const art = (requesting_agent) => ({
  '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
  chaingraph_version: '0.4.0',
  mandate_type: 'compliance_mandate',
  tool_id: 'art-999-agid-fixture',
  tool_version: '1.0.0',
  generated_at: '2026-09-12T00:00:00Z',
  execution_hash: rootHash,
  chain: { parent_hashes: [], parent_tool_ids: [], chain_depth: 0 },
  policy_parameters: policy,
  output_payload: output,
  audit_signature: requesting_agent === null ? { ...shell } : { ...shell, requesting_agent },
});

for (const scheme of ['did', 'rfc9421-keyid', 'webbotauth-card', 'mcp-i', 'x-acme-bridge']) {
  const r = gate(art({ agid_version: '1', scheme, id: `scheme-scoped-id-for-${scheme}` }));
  ok(r.code === 0, `§AGID-1.1: scheme "${scheme}" accepted by the schema gate${r.code ? ` (got exit ${r.code})` : ''}`);
}
{
  const r = gate(art(null));
  ok(r.code === 0, '§AGID-1.5c: absence of the member accepted (fully conformant, no MUST-emit)');
}
for (const [label, memberCase, fragment] of [
  ['bare unknown scheme rejected', { agid_version: '1', scheme: 'acme-agent', id: 'whatever' }, 'scheme'],
  ['organizational lei scheme rejected (§9 keeps the slot; NOT admitted in v1)', { agid_version: '1', scheme: 'lei', id: '5493001KJTIIGC8Y1R12' }, 'scheme'],
  ['missing id rejected', { agid_version: '1', scheme: 'did' }, 'required "id"'],
  ['wrong agid_version rejected', { agid_version: '2', scheme: 'did', id: 'did:key:z6Mk' }, 'agid_version'],
  ['unknown asserted_by rejected', { scheme: 'did', id: 'did:key:z6Mk', asserted_by: 'gateway' }, 'asserted_by'],
  ['unknown member rejected (closed object)', { scheme: 'did', id: 'did:key:z6Mk', vendor_claim: true }, 'additional property'],
  ['non-object evidence rejected', { scheme: 'did', id: 'did:key:z6Mk', evidence: 'opaque-string' }, 'evidence'],
]) {
  const r = gate(art(memberCase));
  ok(r.code !== 0 && r.out.toLowerCase().includes(fragment.toLowerCase()),
     `§AGID-1.1: ${label} (exit ${r.code})`);
}
rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} failure(s).` : '\nAll §AGID-1 agent-identity-binding checks passed.');
process.exit(fail ? 1 : 0);
