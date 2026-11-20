---
type: Attested Computation
title: "x402 Domain & Nonce Window Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-592-x402-domain-nonce-window-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-592-x402-domain-nonce-window-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# x402 Domain & Nonce Window Checker — attested computation

> §10.2 Attested Computation binding for [x402 Domain & Nonce Window Checker](../tools/art-592-x402-domain-nonce-window-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-592-x402-domain-nonce-window-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:fa8518e439bbe1ed04ed5e3c36b0d1bd71986c5c710cd1a4a75f7fc93db082df` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
