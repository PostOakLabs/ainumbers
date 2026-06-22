#!/usr/bin/env node
// build-vectors.mjs — regenerate the OpenChainGraph v0.4 conformance vectors.
//
// A conformance vector is a CANONICAL artifact + the exact preimage string + the SHA-256
// execution_hash, produced by the reference kernels. An external implementer reproduces it to
// prove their canonicalizer + hashing match the standard (SSOT sign-off item, reconciliation §1).
//
// Run from repo root:  node chaingraph/standard/conformance-vectors/build-vectors.mjs
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getKernel } from '../../kernels/index.mjs';
import { canonicalPreimage } from '../../kernels/_hash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', '..', 'kernels', 'fixtures');
const NOW = '2026-06-21T00:00:00.000Z'; // fixed (generated_at is excluded from the hash preimage anyway)

// representative across domains: agentic/AP2, agentic-commerce, capital-markets/Canton, cryptographic
const TOOLS = [
  'art-01-ap2-mandate-chain-validator',
  'art-12-acp-checkout-conformance-validator',
  '508-repo-haircut-collateral-calculator',
  'cry-04-merkle-batch-verifier',
];

let written = 0;
for (const id of TOOLS) {
  const fx = JSON.parse(readFileSync(join(FIXTURES, `${id}.fixtures.json`), 'utf8'));
  const pp = fx.vectors[0].policy_parameters;
  const kernel = getKernel(id);
  if (!kernel) { console.error(`! no kernel for ${id}`); continue; }
  const artifact = await kernel.buildArtifact(pp, { now: NOW });
  const preimage = canonicalPreimage(pp, artifact.output_payload);
  const vector = {
    _comment: 'OpenChainGraph v0.4 conformance vector. Reproduce: execution_hash = SHA-256 hex of canonical_preimage; canonical_preimage = JSON.stringify(cgCanon({policy_parameters, output_payload})) per standard/SPEC.md §4. See README.md.',
    tool_id: id,
    spec_version: '0.4.0',
    fixture: fx.vectors[0].name,
    policy_parameters: pp,
    output_payload: artifact.output_payload,
    canonical_preimage: preimage,
    execution_hash: artifact.execution_hash,
  };
  writeFileSync(join(HERE, `${id}.vector.json`), JSON.stringify(vector, null, 2) + '\n');
  console.log(`✓ ${id} → ${id}.vector.json (hash ${artifact.execution_hash.slice(0, 16)}…)`);
  written++;
}
console.log(`\nwrote ${written}/${TOOLS.length} conformance vectors.`);
