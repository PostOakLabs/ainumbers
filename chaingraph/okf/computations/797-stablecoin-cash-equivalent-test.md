---
type: Attested Computation
title: "Stablecoin Cash Equivalent Test (FASB Proposed 2026-08) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/797-stablecoin-cash-equivalent-test.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/797-stablecoin-cash-equivalent-test.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Stablecoin Cash Equivalent Test (FASB Proposed 2026-08) — attested computation

> §10.2 Attested Computation binding for [Stablecoin Cash Equivalent Test (FASB Proposed 2026-08)](../tools/797-stablecoin-cash-equivalent-test.md).

## Executor

Kernel source: `chaingraph/kernels/797-stablecoin-cash-equivalent-test.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:643f5a36069f70daa86c7d7bbee6a65e227f4de5813fe2974819c3e8899de17d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
