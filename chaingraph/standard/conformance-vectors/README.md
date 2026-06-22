# OpenChainGraph v0.4 — Conformance Vectors

Self-test vectors for anyone implementing an OpenChainGraph-compatible tool (or an independent
verifier). Each `*.vector.json` is a **real canonical artifact** produced by the reference kernels:

| field | meaning |
|---|---|
| `policy_parameters`, `output_payload` | the two members of the hash preimage (and nothing else) |
| `canonical_preimage` | the **exact byte string** that gets hashed — `JSON.stringify(cgCanon({policy_parameters, output_payload}))` per `standard/SPEC.md` §4 (recursive key-sort, minimal whitespace, RFC 8785 / JCS aligned) |
| `execution_hash` | lowercase-hex **SHA-256** of `canonical_preimage` |

## How to self-certify

Your implementation conforms iff, for every vector:

1. Your canonicalizer, fed `{policy_parameters, output_payload}`, produces a string **byte-identical** to `canonical_preimage`.
2. `SHA-256(canonical_preimage)` (lowercase hex) equals `execution_hash`.

Minimal check (Node, zero deps):

```js
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = 'chaingraph/standard/conformance-vectors';
for (const f of readdirSync(dir).filter(n => n.endsWith('.vector.json'))) {
  const v = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  const h = createHash('sha256').update(v.canonical_preimage).digest('hex');
  console.log(`${h === v.execution_hash ? 'OK' : 'FAIL'}  ${v.tool_id}`);
}
```

The canonicalizer itself is `cgCanon` in `chaingraph/kernels/_hash.mjs` (browser + Worker + Node, byte-identical).
`@context` stays at the v0.3 URL by design (not version-locked; §1).

## Regenerating

`node chaingraph/standard/conformance-vectors/build-vectors.mjs` (from the repo root) re-emits the vectors
from the reference kernels + their fixtures. Vectors cover agentic/AP2 (`art-01`), agentic-commerce
(`art-12`), capital-markets/Canton (`508`), and cryptographic (`cry-04`) so a verifier exercises diverse payloads.
