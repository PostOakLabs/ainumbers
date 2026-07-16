---
type: DecisionTool
title: "Financial-Instrument Regime Mapper"
description: "Maps the regulatory regime implied by a pasted Robinhood Chain stock-token characterization. The tokens are tokenized debt securities issued by Robinhood Assets (Jersey) Limited, which puts them inside the MiCA Article 2(4)(a) financial-instrument carve-out, the inverse of the MiCA/GENIUS crypto-asset regime that applies to Tempo and Arc. Flags MiFID II transferable-security classification, prospectus exposure, the no-US-persons gate, and SPV voting-rights disclosure. Never asserts a legal conclusion, only the regime the given characterization implies. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-318-rhc-regime-mapper.html
tags: ["crypto_regulatory_mandate", "wave-56", "mcp:map_robinhood_chain_regime"]
timestamp: 2026-07-14
---

# Financial-Instrument Regime Mapper

> Exports a decision via MCP `map_robinhood_chain_regime` — mandate type `crypto_regulatory_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-318-rhc-regime-mapper.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
