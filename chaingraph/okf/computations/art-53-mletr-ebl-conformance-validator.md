---
type: Attested Computation
title: "MLETR / eBL Conformance & Enforceability Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-53-mletr-ebl-conformance-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-53-mletr-ebl-conformance-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# MLETR / eBL Conformance & Enforceability Validator — attested computation

> §10.2 Attested Computation binding for [MLETR / eBL Conformance & Enforceability Validator](../tools/art-53-mletr-ebl-conformance-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-53-mletr-ebl-conformance-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:0f260f878472634095d299ddde16662204d6432e1b458c6afddc094d2bac7dd8` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
