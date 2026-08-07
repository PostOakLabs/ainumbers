---
type: Attested Computation
title: "Muni Arbitrage Spending-Exception Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-569-muni-arbitrage-spending-exception-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-569-muni-arbitrage-spending-exception-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Muni Arbitrage Spending-Exception Checker — attested computation

> §10.2 Attested Computation binding for [Muni Arbitrage Spending-Exception Checker](../tools/art-569-muni-arbitrage-spending-exception-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-569-muni-arbitrage-spending-exception-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:51f687ecec3fb71291c2dad098f4e0e98618a92218f75eaf7610890d75034ed3` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
