---
type: DecisionTool
title: "Arc Multi-Currency Corridor Jurisdiction Router"
description: "Route each leg of a multi-currency Arc corridor to its per-currency home regime (EURC→MiCA EMT, JPYC→JP FSA, BRLA→Brazil CMN/BCB, MXNB→MX CNBV, etc.), flag missing per-regime disclosures, and emit PvP handoff (511) + Travel-Rule batch handoff (art-104). Compliance/settlement routing only; FX economics handled separately by the Arc StableFX chain."
resource: https://ainumbers.co/chaingraph/art-111-arc-corridor-jurisdiction-router.html
tags: ["compliance_mandate", "wave-21", "mcp:route_partner_stablecoin_jurisdiction"]
timestamp: 2026-07-14
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
