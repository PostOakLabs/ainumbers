---
type: Attested Computation
title: "Journal-Entry Ruleset Screen — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-462-je-ruleset-screen.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-462-je-ruleset-screen.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Journal-Entry Ruleset Screen — attested computation

> §10.2 Attested Computation binding for [Journal-Entry Ruleset Screen](../tools/art-462-je-ruleset-screen.md).

## Executor

Kernel source: `chaingraph/kernels/art-462-je-ruleset-screen.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5f9f5a9b7c90cd52f8391fad3645938706315d2271784f07a1fb5a831b588599` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
