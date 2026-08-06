---
type: Attested Computation
title: "Calculation-Agent Independence Attestation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-559-attest-calc-agent-independence.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-559-attest-calc-agent-independence.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Calculation-Agent Independence Attestation — attested computation

> §10.2 Attested Computation binding for [Calculation-Agent Independence Attestation](../tools/art-559-attest-calc-agent-independence.md).

## Executor

Kernel source: `chaingraph/kernels/art-559-attest-calc-agent-independence.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:68c476b24ca693447d4153a954653832e6a9a62a35f2e0da3ac578eb163f74b0` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
