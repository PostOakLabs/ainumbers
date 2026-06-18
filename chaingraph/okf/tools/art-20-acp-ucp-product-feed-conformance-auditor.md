---
type: DecisionTool
title: "ACP/UCP Product-Feed Conformance Auditor"
description: "Validates product/checkout/mandate JSON payloads against ACP or UCP field schemas (5 schema arrays). Identifies missing required fields, type mismatches, and unknown fields. Node 2 of 3 in the Agentic Checkout Chain."
resource: https://ainumbers.co/chaingraph/art-20-acp-ucp-product-feed-conformance-auditor.html
tags: ["scheme_rule", "wave-A", "mcp:validate_acp_checkout"]
timestamp: 2026-06-18T13:58:30.949Z
---

# ACP/UCP Product-Feed Conformance Auditor

> Exports a decision via MCP `validate_acp_checkout` — mandate type `scheme_rule`.

**Context:** ACP + UCP both live 2026

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-20-acp-ucp-product-feed-conformance-auditor.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agentic Checkout Protocol Selector](./art-19-agentic-checkout-protocol-selector.md)

**Feeds:** [Agent-Traffic Acceptance Policy Builder](./art-21-agent-traffic-acceptance-policy-builder.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
