---
type: Attested Computation
title: "ViDA EN 16931 E-Invoice Conformance Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-159-vida-einvoice-en16931-conformance-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-159-vida-einvoice-en16931-conformance-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ViDA EN 16931 E-Invoice Conformance Validator — attested computation

> §10.2 Attested Computation binding for [ViDA EN 16931 E-Invoice Conformance Validator](../tools/art-159-vida-einvoice-en16931-conformance-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-159-vida-einvoice-en16931-conformance-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:03f4ebd802b04ae45993fa918c7bfb974304e19186c9a139961b6cf700258d1d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
