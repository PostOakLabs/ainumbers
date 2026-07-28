---
type: Attested Computation
title: "ZK Compliance Proof Generator — attested computation"
runtime: browser
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/cry-01-zk-compliance-proof-generator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/cry-01-zk-compliance-proof-generator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ZK Compliance Proof Generator — attested computation

> §10.2 Attested Computation binding for [ZK Compliance Proof Generator](../tools/cry-01-zk-compliance-proof-generator.md).

## Executor

Kernel source: `chaingraph/kernels/cry-01-zk-compliance-proof-generator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c5d758f79de7b13d3b76a0c77f4a5922703386c1dc80db64fb81a1829465a800` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
