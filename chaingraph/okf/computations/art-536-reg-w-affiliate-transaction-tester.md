---
type: Attested Computation
title: "Reg W Affiliate Transaction Tester — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-536-reg-w-affiliate-transaction-tester.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-536-reg-w-affiliate-transaction-tester.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Reg W Affiliate Transaction Tester — attested computation

> §10.2 Attested Computation binding for [Reg W Affiliate Transaction Tester](../tools/art-536-reg-w-affiliate-transaction-tester.md).

## Executor

Kernel source: `chaingraph/kernels/art-536-reg-w-affiliate-transaction-tester.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:97f5aa7c56c8afd1021f3e175b556a66dfbbf632cee7c0f9f88cf0752eae17a4` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
