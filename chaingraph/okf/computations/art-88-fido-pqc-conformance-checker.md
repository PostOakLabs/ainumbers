---
type: Attested Computation
title: "FIDO2 / WebAuthn PQC Conformance Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-88-fido-pqc-conformance-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-88-fido-pqc-conformance-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FIDO2 / WebAuthn PQC Conformance Checker — attested computation

> §10.2 Attested Computation binding for [FIDO2 / WebAuthn PQC Conformance Checker](../tools/art-88-fido-pqc-conformance-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-88-fido-pqc-conformance-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:92b325e20fa5a4e60b6cc1b0080285af19bf639951c96ec6a0b76d69a57b823b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
