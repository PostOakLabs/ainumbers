---
type: Attested Computation
title: "GENIUS Act Monthly Reserve Disclosure Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-275-genius-reserve-disclosure-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-275-genius-reserve-disclosure-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# GENIUS Act Monthly Reserve Disclosure Checker — attested computation

> §10.2 Attested Computation binding for [GENIUS Act Monthly Reserve Disclosure Checker](../tools/art-275-genius-reserve-disclosure-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-275-genius-reserve-disclosure-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ac3fc527b5c2cc4c526d56dcbe1908d9e9837a95aeb29eb92cb1b99055c82f86` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
