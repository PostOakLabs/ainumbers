---
type: Attested Computation
title: "PLD Disclosure Pack Builder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-308-pld-disclosure-pack-builder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-308-pld-disclosure-pack-builder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# PLD Disclosure Pack Builder — attested computation

> §10.2 Attested Computation binding for [PLD Disclosure Pack Builder](../tools/art-308-pld-disclosure-pack-builder.md).

## Executor

Kernel source: `chaingraph/kernels/art-308-pld-disclosure-pack-builder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4d73f240d1e0e36ad7081116436c2a27d5b2c23d184cc4269306079ed753ccfb` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
