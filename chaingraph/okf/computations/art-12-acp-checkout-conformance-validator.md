---
type: Attested Computation
title: "ACP Checkout Conformance Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the payment_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-12-acp-checkout-conformance-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-12-acp-checkout-conformance-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ACP Checkout Conformance Validator — attested computation

> §10.2 Attested Computation binding for [ACP Checkout Conformance Validator](../tools/art-12-acp-checkout-conformance-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-12-acp-checkout-conformance-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4ee210e9f360aea1ea09609253ca4e223bc00065d42aa2a672f4ffb5a866afc2` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
