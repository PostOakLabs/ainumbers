// One-off: append MPP-exercising vectors to art-22 + art-30 fixtures and pin output_payload + golden_hash.
// Underscore-prefixed so it is not treated as a node kernel (kernel-contract iterates index.mjs only).
// Run: node kernels/_regen-mpp-fixtures.mjs   (idempotent — skips a vector that already exists)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from './_hash.mjs';
import { compute as compute22 } from './art-22-agentic-payments-protocol-comparator.kernel.mjs';
import { compute as compute30 } from './art-30-agent-commerce-conformance-validator.kernel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const fix = (id) => resolve(HERE, 'fixtures', `${id}.fixtures.json`);

async function addVector(id, compute, vec) {
  const path = fix(id);
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  if (doc.vectors.some((v) => v.name === vec.name)) { console.log(`= ${id}: vector '${vec.name}' already present, skip`); return; }
  const { output_payload } = compute(vec.policy_parameters);
  const golden_hash = await executionHash(vec.policy_parameters, output_payload);
  doc.vectors.push({ name: vec.name, policy_parameters: vec.policy_parameters, output_payload, golden_hash });
  writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
  console.log(`✓ ${id}: added '${vec.name}' (golden ${golden_hash.slice(0, 12)}…)`);
}

// art-22 — all six rails compared, subscription scenario (exercises mpp + agent_subscription)
await addVector('art-22-agentic-payments-protocol-comparator', compute22, {
  name: 'mpp_all_rails_subscription',
  policy_parameters: { protocols: ['ap2', 'acp', 'x402', 'tap', 'mc', 'mpp'], scenario: 'agent_subscription' },
});

// art-30 — AP2 intent + MPP subscription session leg (exercises validateMPP + cross-checks)
await addVector('art-30-agent-commerce-conformance-validator', compute30, {
  name: 'ap2_plus_mpp_subscription',
  policy_parameters: {
    ap2_mandate_trio: {
      intent: {
        mandate_type: 'intent', mandate_id: 'intent-mpp-001', expires_at: '2026-12-31T00:00:00Z',
        scope: { merchant_ids: ['merchant-saas'], currency: 'USD', max_amount: 240 },
        human_not_present: true, issuer_id: 'issuer:test',
      },
      payment: {
        mandate_type: 'payment', mandate_id: 'pay-mpp-001', parent_mandate_id: 'intent-mpp-001',
        parent_hash: 'b'.repeat(64), amount: 20, currency: 'USD', human_not_present: true, payment_method: 'mpp_session',
      },
    },
    mpp_session: {
      mode: 'subscription', session_id: 'sess-001', max_amount: 240, currency: 'USD',
      payee: 'svc:api-provider', cadence: 'monthly', access_key: 'ak:scoped-001',
    },
  },
});
