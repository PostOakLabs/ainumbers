---
type: Attested Computation
title: "Counterparty Internal Limit Check — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-446-counterparty-internal-limit-check.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-446-counterparty-internal-limit-check.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Counterparty Internal Limit Check — attested computation

> §10.2 Attested Computation binding for [Counterparty Internal Limit Check](../tools/art-446-counterparty-internal-limit-check.md).

## Executor

Kernel source: `chaingraph/kernels/art-446-counterparty-internal-limit-check.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:235144f13ce1e5f16af5e68341a3f6eac7579044827d63769a9b062658bd21ab` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
