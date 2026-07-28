---
type: DecisionTool
title: "Arc Multi-Currency Corridor Jurisdiction Router"
description: "Route each leg of a multi-currency Arc corridor to its per-currency home regime (EURC→MiCA EMT, JPYC→JP FSA, BRLA→Brazil CMN/BCB, MXNB→MX CNBV, etc.), flag missing per-regime disclosures, and emit PvP handoff (511) + Travel-Rule batch handoff (art-104). Compliance/settlement routing only; FX economics handled separately by the Arc StableFX chain."
resource: https://ainumbers.co/chaingraph/art-111-arc-corridor-jurisdiction-router.html
tags: ["compliance_mandate", "wave-21", "mcp:route_partner_stablecoin_jurisdiction"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-111-arc-corridor-jurisdiction-router.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-111-arc-corridor-jurisdiction-router.html
    title: "public tool page"
---

# Arc Multi-Currency Corridor Jurisdiction Router

> Exports a decision via MCP `route_partner_stablecoin_jurisdiction` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-111-arc-corridor-jurisdiction-router.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Multi-Currency PvP Validator](./511-multi-currency-pvp-validator.md)

## Attested computation

[executor + attester binding](../computations/art-111-arc-corridor-jurisdiction-router.md) — §10.2.
