---
type: Attested Computation
title: "Agent-Service Metering & Marketplace Economics Modeler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the payment_policy decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-63-agent-service-metering-modeler.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-63-agent-service-metering-modeler.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agent-Service Metering & Marketplace Economics Modeler — attested computation

> §10.2 Attested Computation binding for [Agent-Service Metering & Marketplace Economics Modeler](../tools/art-63-agent-service-metering-modeler.md).

## Executor

Kernel source: `chaingraph/kernels/art-63-agent-service-metering-modeler.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:db80ef83629be0220c5b3db867b3911ee1a7817bb6e530149ec725258b0edafe` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
