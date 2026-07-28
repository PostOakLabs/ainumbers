---
type: Attested Computation
title: "Cyber Incident Notification Clock — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-428-cyber-incident-clock.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-428-cyber-incident-clock.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Cyber Incident Notification Clock — attested computation

> §10.2 Attested Computation binding for [Cyber Incident Notification Clock](../tools/art-428-cyber-incident-clock.md).

## Executor

Kernel source: `chaingraph/kernels/art-428-cyber-incident-clock.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6bbd5af5d5a8f8a001a6b5e62fde257a5a22943d218e038ce6c4ae78bb142c8e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
