---
type: Attested Computation
title: "Web Bot Auth Nonce & Replay-Window Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-593-webbotauth-nonce-replay-check.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-593-webbotauth-nonce-replay-check.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Web Bot Auth Nonce & Replay-Window Checker — attested computation

> §10.2 Attested Computation binding for [Web Bot Auth Nonce & Replay-Window Checker](../tools/art-593-webbotauth-nonce-replay-check.md).

## Executor

Kernel source: `chaingraph/kernels/art-593-webbotauth-nonce-replay-check.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4d4491d75002a02d8a1448ca25e0aa851ccd4ea646dccde0afdd5d745f48967b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
