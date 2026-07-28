---
type: Attested Computation
title: "Wolfsberg Payment Transparency & LEI Binding Linter — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-246-lei-payment-binding-linter.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-246-lei-payment-binding-linter.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Wolfsberg Payment Transparency & LEI Binding Linter — attested computation

> §10.2 Attested Computation binding for [Wolfsberg Payment Transparency & LEI Binding Linter](../tools/art-246-lei-payment-binding-linter.md).

## Executor

Kernel source: `chaingraph/kernels/art-246-lei-payment-binding-linter.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3eb46ada4f435f3207e14efe0cd5349dd78613e1b50bbe42bb85cd95e2cd3c05` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
