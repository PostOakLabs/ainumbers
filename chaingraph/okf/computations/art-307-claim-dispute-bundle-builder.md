---
type: Attested Computation
title: "Claim Dispute Bundle Builder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-307-claim-dispute-bundle-builder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-307-claim-dispute-bundle-builder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Claim Dispute Bundle Builder — attested computation

> §10.2 Attested Computation binding for [Claim Dispute Bundle Builder](../tools/art-307-claim-dispute-bundle-builder.md).

## Executor

Kernel source: `chaingraph/kernels/art-307-claim-dispute-bundle-builder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1daef6202ad1566e6f94d6f395e4e645e4d15288589e2864a84c2c2e33415211` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
