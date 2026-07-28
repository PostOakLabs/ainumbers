---
type: DecisionTool
title: "Witness Cosignature Verifier"
description: "Verifies a C2SP tlog-checkpoint + witness-cosignature note (SPEC.md §20.2) offline: confirms the note's origin and root match a §20/§20.1 batch anchor's declared anchored_hash, then checks each pinned witness's cosignature against a k-of-n threshold. Supports both Ed25519 cosignature/v1 and ML-DSA-44 (the suite §20.2 names alongside it under the §PQC-1 reserved-extension discipline). Consumes a caller-supplied checkpoint note (e.g. from a c2sp.org/tlog-proof bundle), verify-side only, zero log operation, zero network fetch. Golden fixtures dogfood the tool's own output, including a tampered negative fixture that must fail. States only that ≥k pinned witnesses signed this root; does not establish log honesty, key ownership, or leaf inclusion (see art-280/art-279 and SPEC.md §20.1 for those checks)."
resource: https://ainumbers.co/chaingraph/art-424-witness-cosignature-verifier.html
tags: ["cryptographic_mandate", "wave-50", "mcp:verify_witness_cosignatures"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-424-witness-cosignature-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-424-witness-cosignature-verifier.html
    title: "public tool page"
---

# Witness Cosignature Verifier

> Exports a decision via MCP `verify_witness_cosignatures` — mandate type `cryptographic_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-424-witness-cosignature-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-424-witness-cosignature-verifier.md) — §10.2.
