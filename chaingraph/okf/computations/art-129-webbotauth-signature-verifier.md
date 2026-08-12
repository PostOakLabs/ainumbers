---
type: Attested Computation
title: "Web Bot Auth Signature Verifier (RFC 9421) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-129-webbotauth-signature-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-129-webbotauth-signature-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Web Bot Auth Signature Verifier (RFC 9421) — attested computation

> §10.2 Attested Computation binding for [Web Bot Auth Signature Verifier (RFC 9421)](../tools/art-129-webbotauth-signature-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-129-webbotauth-signature-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:540c9d7518ba023177cc5b43c463c8ae89c8fcedb57a44e4f007de93b891ebcf` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
