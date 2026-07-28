---
type: Attested Computation
title: "ISO 20022-to-EVM Calldata Mapper — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-288-map-iso20022-to-evm-calldata.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-288-map-iso20022-to-evm-calldata.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ISO 20022-to-EVM Calldata Mapper — attested computation

> §10.2 Attested Computation binding for [ISO 20022-to-EVM Calldata Mapper](../tools/art-288-map-iso20022-to-evm-calldata.md).

## Executor

Kernel source: `chaingraph/kernels/art-288-map-iso20022-to-evm-calldata.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c434dd10ec7cc8e96757d0f1679f3dc90861bb065ca053bfa7646a8afa6e0a6c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
