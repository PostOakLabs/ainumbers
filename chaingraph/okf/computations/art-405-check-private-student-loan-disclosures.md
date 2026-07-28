---
type: Attested Computation
title: "Private Student Loan Disclosure & Rescission Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-405-check-private-student-loan-disclosures.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-405-check-private-student-loan-disclosures.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Private Student Loan Disclosure & Rescission Checker — attested computation

> §10.2 Attested Computation binding for [Private Student Loan Disclosure & Rescission Checker](../tools/art-405-check-private-student-loan-disclosures.md).

## Executor

Kernel source: `chaingraph/kernels/art-405-check-private-student-loan-disclosures.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:75fd46391316b49459fd5cfc046cdfc162076a32e0f76268ed539ffb43e3bd6e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
