---
type: Attested Computation
title: "Servicing Compliance Clock — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the consumer_finance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/733-servicing-compliance-clock.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/733-servicing-compliance-clock.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Servicing Compliance Clock — attested computation

> §10.2 Attested Computation binding for [Servicing Compliance Clock](../tools/733-servicing-compliance-clock.md).

## Executor

Kernel source: `chaingraph/kernels/733-servicing-compliance-clock.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e7eac9a4322542b6e39434f60df84cdc6eb24ceee9887b282aadc16f319bb4ea` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
