---
type: Attested Computation
title: "x402 Deferred-Scheme Handshake Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-394-x402-deferred-handshake-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-394-x402-deferred-handshake-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# x402 Deferred-Scheme Handshake Validator — attested computation

> §10.2 Attested Computation binding for [x402 Deferred-Scheme Handshake Validator](../tools/art-394-x402-deferred-handshake-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-394-x402-deferred-handshake-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:86b67fe8bd78c4f98cff644943c97efe820149953edf0080e31c279d760f5994` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
