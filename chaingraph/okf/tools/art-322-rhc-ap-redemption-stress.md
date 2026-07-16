---
type: DecisionTool
title: "AP Concentration + Redemption-Path Stress"
description: "Stress-tests the one-token-equals-one-share economic-exposure claim for Robinhood Chain stock tokens against actual redemption reachability. BBVI is the sole Authorised Participant at issuance; only Authorised Participants may subscribe or redeem directly from Robinhood Assets (Jersey) Limited after KYB, everyone else is secondary-market-only. Enumerates AP concentration, premium/discount exposure if the sole AP stops market-making, and issuer-credit exposure distinct from the underlying equity. Verify-only; never recommends a position. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-322-rhc-ap-redemption-stress.html
tags: ["collateral_mandate", "wave-56", "mcp:stress_test_ap_redemption_path"]
timestamp: 2026-07-14
---

# AP Concentration + Redemption-Path Stress

> Exports a decision via MCP `stress_test_ap_redemption_path` — mandate type `collateral_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-322-rhc-ap-redemption-stress.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
