---
type: DecisionTool
title: "L1 Continuous-Fee Runway Model"
description: "Avalanche Evergreen L1 continuous-fee TCO and depletion-runway model. ACP-77 replaced the 2000 AVAX stake requirement with a continuous, dynamic P-Chain fee drawn from an L1 balance that depletes and needs refills, so the fee rate and its growth assumption are always caller inputs, never baked in. Computes validator count times fee rate, plus infra cost, plus current balance into an annual TCO and its per-component breakdown. The novel output is months_to_depletion and depletion_offset_days: the point at which the L1 runs out of balance and stops validating, an offset from the caller-supplied as_of, never a clock read. Also returns the refill amount required to reach a caller-supplied target runway. Zero balance, zero validators or a zero fee rate each resolve to a defined, finite result rather than an unbounded projection. No chain observation, no RPC: every input is caller-transcribed state. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-496-l1-continuous-fee-runway.html
tags: ["compliance_mandate", "wave-78", "mcp:model_l1_fee_runway"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-496-l1-continuous-fee-runway.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-496-l1-continuous-fee-runway.html
    title: "public tool page"
---

# L1 Continuous-Fee Runway Model

> Exports a decision via MCP `model_l1_fee_runway` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-496-l1-continuous-fee-runway.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-496-l1-continuous-fee-runway.md) — §10.2.
