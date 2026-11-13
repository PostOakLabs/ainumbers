---
type: Attested Computation
title: "SHA-256 and HMAC-SHA256 Digest Demonstrator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-751-sha256-hmac-digest-demonstrator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-751-sha256-hmac-digest-demonstrator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# SHA-256 and HMAC-SHA256 Digest Demonstrator — attested computation

> §10.2 Attested Computation binding for [SHA-256 and HMAC-SHA256 Digest Demonstrator](../tools/art-751-sha256-hmac-digest-demonstrator.md).

## Executor

Kernel source: `chaingraph/kernels/art-751-sha256-hmac-digest-demonstrator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:dd59994be22b706a37764b59b362aa949096494b0dc2496180865a0c49f8aaba` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
