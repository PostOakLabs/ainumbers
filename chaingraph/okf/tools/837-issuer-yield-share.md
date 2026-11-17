---
type: DecisionTool
title: "Issuer Reserve Yield Share Check"
description: "Recomputes a white-label stablecoin deal's reserve-income split (issuer, platform, distributor, custodian) from aggregate declared values, a period of days with an average reserve value and an annual yield in basis points, or a declared reserve income, and each party's share in integer minor units, with a conservation check that the floored shares sum exactly to the income. Traces every declared holder-facing reward to its payer and funding source and flags any reward whose payer is an issuer class (issuer, permitted_issuer or foreign_issuer; any other payer role is refused) (enacted statutory profile: PL 119-27 § 4(a)(11) bars a permitted payment stablecoin issuer from paying a holder any form of interest or yield solely in connection with holding, using, or retaining the coin) or whose funding is an issuer flow (reserve income), returning NO_ISSUER_YIELD, REVIEW or ISSUER_YIELD_PRESENT. Adjacent: art-45's narrow genius_yield check inside the Arc xReserve linter flags a declared yield switch; reserve composition comes from art-06 and art-275. The node states facts about declared flows only; it never says a deal is lawful. Inputs are aggregate values and role labels only, no live addresses, no named counterparties, no real deal terms."
resource: https://ainumbers.co/chaingraph/837-issuer-yield-share.html
tags: ["compliance_control", "wave-141", "mcp:check_issuer_reserve_yield_share"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/837-issuer-yield-share.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/837-issuer-yield-share.html
    title: "public tool page"
---

# Issuer Reserve Yield Share Check

> Exports a decision via MCP `check_issuer_reserve_yield_share` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/837-issuer-yield-share.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/837-issuer-yield-share.md) — §10.2.
