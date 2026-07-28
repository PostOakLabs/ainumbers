---
type: Attested Computation
title: "SWIFT / ISO 20022 PQC Readiness Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-87-iso20022-pqc-readiness-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-87-iso20022-pqc-readiness-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# SWIFT / ISO 20022 PQC Readiness Checker — attested computation

> §10.2 Attested Computation binding for [SWIFT / ISO 20022 PQC Readiness Checker](../tools/art-87-iso20022-pqc-readiness-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-87-iso20022-pqc-readiness-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6e468a348055e83bb98d072b1f2879af2e98a5d8fcca76f119320f136edc0955` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
