---
type: Attested Computation
title: "Embedded Insurance Pricing Modeller — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-366-price-embedded-insurance.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-366-price-embedded-insurance.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Embedded Insurance Pricing Modeller — attested computation

> §10.2 Attested Computation binding for [Embedded Insurance Pricing Modeller](../tools/art-366-price-embedded-insurance.md).

## Executor

Kernel source: `chaingraph/kernels/art-366-price-embedded-insurance.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:922020678b293aa6eb63c4a37bcb255584dbba538057ff12e804602c901705fe` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
