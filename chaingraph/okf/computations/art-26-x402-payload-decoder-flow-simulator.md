---
type: Attested Computation
title: "x402 Header Decoder, Payload Linter & 402 Flow Simulator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-26-x402-payload-decoder-flow-simulator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-26-x402-payload-decoder-flow-simulator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# x402 Header Decoder, Payload Linter & 402 Flow Simulator — attested computation

> §10.2 Attested Computation binding for [x402 Header Decoder, Payload Linter & 402 Flow Simulator](../tools/art-26-x402-payload-decoder-flow-simulator.md).

## Executor

Kernel source: `chaingraph/kernels/art-26-x402-payload-decoder-flow-simulator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:24dadadd4a0901134a41d251fcac134657970dc8015251d06ab4757f1bcaf17e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
