---
type: Attested Computation
title: "Digital Trade Rules Compliance Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the scheme_rule decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-54-digital-trade-rules-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-54-digital-trade-rules-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Digital Trade Rules Compliance Checker — attested computation

> §10.2 Attested Computation binding for [Digital Trade Rules Compliance Checker](../tools/art-54-digital-trade-rules-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-54-digital-trade-rules-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a7e25b5ced7deecbe2bfaf3ff54f75fec09c0b0058aaa4f1308c175e4f477344` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
