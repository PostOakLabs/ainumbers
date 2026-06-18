---
type: DecisionTool
title: "Agentic Checkout Protocol Selector"
description: "Scores ACP, UCP, x402, and Visa TAP against platform profile (buyer type, AOV, geography, stack capabilities) and returns a ranked protocol recommendation with fit scores. Node 1 of 3 in the Agentic Checkout Chain."
resource: https://ainumbers.co/chaingraph/art-19-agentic-checkout-protocol-selector.html
tags: ["routing_policy", "wave-A", "mcp:compare_agentic_payment_protocols"]
timestamp: 2026-06-18T13:58:30.949Z
---

# Agentic Checkout Protocol Selector

> Exports a decision via MCP `compare_agentic_payment_protocols` — mandate type `routing_policy`.

**Context:** ACP live; UCP launched Jan 2026; x402 live on Coinbase CDP; TAP from Visa

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-19-agentic-checkout-protocol-selector.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [ACP/UCP Product-Feed Conformance Auditor](./art-20-acp-ucp-product-feed-conformance-auditor.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
