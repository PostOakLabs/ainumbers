---
type: Attested Computation
title: "Reg E Remittance Disclosure Consistency Check — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-550-reg-e-remittance-disclosure-check.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-550-reg-e-remittance-disclosure-check.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Reg E Remittance Disclosure Consistency Check — attested computation

> §10.2 Attested Computation binding for [Reg E Remittance Disclosure Consistency Check](../tools/art-550-reg-e-remittance-disclosure-check.md).

## Executor

Kernel source: `chaingraph/kernels/art-550-reg-e-remittance-disclosure-check.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:8824902adca9694e5a610a35b14e2eea59ae7f67ef1a98985dea146a6ac144b9` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
