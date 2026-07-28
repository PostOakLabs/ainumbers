---
type: Attested Computation
title: "IRRBB EVE Shock Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-183-irrbb-eve-shock-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-183-irrbb-eve-shock-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# IRRBB EVE Shock Calculator — attested computation

> §10.2 Attested Computation binding for [IRRBB EVE Shock Calculator](../tools/art-183-irrbb-eve-shock-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/art-183-irrbb-eve-shock-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:688cc0519d212cdc48f08b6a4d5ebce07750de7562edc9abad7f91202ba38bf9` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
