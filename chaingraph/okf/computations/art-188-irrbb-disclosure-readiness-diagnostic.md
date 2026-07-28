---
type: Attested Computation
title: "IRRBB Disclosure Readiness Diagnostic — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-188-irrbb-disclosure-readiness-diagnostic.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-188-irrbb-disclosure-readiness-diagnostic.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# IRRBB Disclosure Readiness Diagnostic — attested computation

> §10.2 Attested Computation binding for [IRRBB Disclosure Readiness Diagnostic](../tools/art-188-irrbb-disclosure-readiness-diagnostic.md).

## Executor

Kernel source: `chaingraph/kernels/art-188-irrbb-disclosure-readiness-diagnostic.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:9339e768762bca73b88956e51e3ffc9500c8f2a6a54cba095f989992be265292` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
