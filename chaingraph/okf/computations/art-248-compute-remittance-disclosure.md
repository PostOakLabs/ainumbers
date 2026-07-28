---
type: Attested Computation
title: "Remittance Disclosure Calculator (Reg E Subpart B) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-248-compute-remittance-disclosure.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-248-compute-remittance-disclosure.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Remittance Disclosure Calculator (Reg E Subpart B) — attested computation

> §10.2 Attested Computation binding for [Remittance Disclosure Calculator (Reg E Subpart B)](../tools/art-248-compute-remittance-disclosure.md).

## Executor

Kernel source: `chaingraph/kernels/art-248-compute-remittance-disclosure.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:18f88fa54000e35774488e4e653fe00d09df23fee91ad40e50611f194cf1d7f7` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
