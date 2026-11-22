---
type: Attested Computation
title: "Government Stablecoin Acceptance Audit — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-793-government-stablecoin-acceptance.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-793-government-stablecoin-acceptance.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Government Stablecoin Acceptance Audit — attested computation

> §10.2 Attested Computation binding for [Government Stablecoin Acceptance Audit](../tools/art-793-government-stablecoin-acceptance.md).

## Executor

Kernel source: `chaingraph/kernels/art-793-government-stablecoin-acceptance.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d35efd76b9c97ae13a71db844e350570fc1a1748624f040938d56a4ecf39ba64` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
