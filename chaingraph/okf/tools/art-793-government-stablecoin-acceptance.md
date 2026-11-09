---
type: DecisionTool
title: "Government Stablecoin Acceptance Audit"
description: "Assesses a government acceptor's aggregate stablecoin receipt ledger against its written acceptance policy, which tokens are eligible, how fast receipts must be converted to fiat, how much unconverted value may be held, and how refunds are handled, and reconciles tokens received, converted and credited in fiat line by line, reporting policy conformance, reconciliation breaks, peak unconverted exposure and an overall verdict. Inputs are aggregate per-day-per-token totals in integer minor units; no payer data is accepted. All policy parameters are caller-declared: the pinned Bermuda government statement (gov.bm, 2026-01-19) names agency stablecoin-payment pilots and USDC as principal token but fixes no conversion window, holding cap, refund rule or custody arrangement. Scope limits: no issuer-side reserve evidence (that is the reserve-attestation node's job), no pricing or FX logic, no jurisdiction profiles shipped, the generic profile only."
resource: https://ainumbers.co/chaingraph/art-793-government-stablecoin-acceptance.html
tags: ["compliance_control", "wave-141", "mcp:assess_gov_stablecoin_accept"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-793-government-stablecoin-acceptance.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-793-government-stablecoin-acceptance.html
    title: "public tool page"
---

# Government Stablecoin Acceptance Audit

> Exports a decision via MCP `assess_gov_stablecoin_accept` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-793-government-stablecoin-acceptance.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-793-government-stablecoin-acceptance.md) — §10.2.
