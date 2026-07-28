---
type: Attested Computation
title: "Arc Multi-Currency Corridor Jurisdiction Router — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-111-arc-corridor-jurisdiction-router.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-111-arc-corridor-jurisdiction-router.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Arc Multi-Currency Corridor Jurisdiction Router — attested computation

> §10.2 Attested Computation binding for [Arc Multi-Currency Corridor Jurisdiction Router](../tools/art-111-arc-corridor-jurisdiction-router.md).

## Executor

Kernel source: `chaingraph/kernels/art-111-arc-corridor-jurisdiction-router.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:71061d2cb76db82787091a1621aabb6fdba5b88d31db5d6b378f9ea1b5826f72` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
