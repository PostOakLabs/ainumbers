---
type: DecisionTool
title: "Islamic MMF Placement Limits"
description: "Checks a money market fund's placements against one pinned authority profile: the Saudi Capital Market Authority Investment Funds Regulations 2025, Article 56(a) to (j), as amended by Board Resolution 1-54-2025. From a fund's net asset value and a list of holdings with opaque issuer, counterparty and group tokens, it reports used percentage, cap, headroom and breach flag for each numeric limit: hedging derivatives, securitisation, single issuer, single counterparty, same group, fund units, weighted average life and liquidity. It also emits a maturity-bucket placement ladder and a stress-test frequency reminder. Government debt that meets the stated exemption is excluded from the concentration tests. Input types outside the permitted list, identifier-like tokens, non-hedging derivatives and any authority other than the pinned Saudi CMA profile are refused by name. Shariah eligibility of each holding is a caller input; the node does not assess it. Outputs are arithmetic and rule checks against the cited text, not a fatwa, Shariah certification, legal opinion or regulatory approval."
resource: https://ainumbers.co/chaingraph/art-851-islamic-mmf-placement-limits.html
tags: ["compliance_control", "wave-150", "mcp:check_islamic_mmf_placement_limits"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-851-islamic-mmf-placement-limits.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-851-islamic-mmf-placement-limits.html
    title: "public tool page"
---

# Islamic MMF Placement Limits

> Exports a decision via MCP `check_islamic_mmf_placement_limits` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-851-islamic-mmf-placement-limits.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-851-islamic-mmf-placement-limits.md) — §10.2.
